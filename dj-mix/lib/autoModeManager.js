/**
 * autoDjManager.js - Autonomous DJ with waveform-based mix suggestion engine
 * 
 * Features:
 * - Toggleable auto mode for automatic track suggestions
 * - Uses API /mix endpoint for intelligent transition timing
 * - Analyzes energy zones, safe transition points, and breakdown zones
 * - Recommends optimal transition types based on track structure
 * - Tracks previously played songs to avoid repetition
 * - Automatically triggers mix at optimal moment using waveform analysis
 */

import {
  getStoredTrackMeta,
  invalidateStoredTrackMeta,
  patchStoredTrackMeta,
} from './trackMetaStorage.js';
import { appendApiToken } from './downloaderConfig.js';

const AUTO_MODE_KEY = 'dj-mix:auto-mode:enabled';
const AUTO_MODE_HISTORY_KEY = 'dj-mix:auto-mode:history';

/**
 * @typedef {Object} MixData
 * @property {number} durationSec
 * @property {number} probableSongStartSec
 * @property {Array<{startSec: number, endSec: number, score: number, intensity: string}>} peakZones
 * @property {Array<{startSec: number, endSec: number, score: number, reason: string}>} safeTransitionZones
 * @property {Array<{startSec: number, endSec: number, score: number, reason: string}>} avoidTransitionZones
 * @property {Array<{startSec: number, endSec: number, score: number}>} dropZones
 * @property {Array<{startSec: number, endSec: number, score: number, reason: string}>} breakdownZones
 * @property {Array<{startSec: number, endSec: number, neverMissScore: number, label: string, reason: string, source: string}>} neverMissZones
 * @property {Object} indicators
 */

export function createAutoModeManager({
  apiHealthMonitor,
  getDownloaderApiToken,
  getDownloaderApiUrl,
  getFilRougeManager,
  getQueue,
  getCurrentTrackId,
  getCurrentTrackIndex,
  searchTracksViaApi,
  addToQueue,
  showToast,
  logger,
  getTrackMaxDurationSec,
  getAutoFxMinGapMs,
  getAutoFxMaxGapMs,
  getDjMode,
  getDjModeGenrePrefs,
  getCurrentBpm,
  getActualDurationMs,
  onAutomixTimingCalculated,
  onMixDataUpdated,
  onAutoFxPlanCalculated,
}) {
  let autoModeEnabled = false;
  let playHistory = new Set(); // Track IDs of songs that have been played
  let lastSearchedTrackId = null;
  let lastSearchTime = 0;
  let currentTrackMixData = null;
  let pendingNextTrack = null;
  let nextTrackMixData = null;
  let automixTimerHandle = null;
  let pendingAutoFxEvents = [];
  let suggestionSearchEnabled = true;
  let lastPlayedTrackIdVariants = []; // All ID variants of last played track for loop detection
  let loopDetectionCounter = 0; // Counter to detect when same track is queued multiple times
  // Track currently loaded on the active deck. Set synchronously when scheduleAutomixTiming is
  // called so that onTrackFinished searches can exclude it even after it leaves the queue.
  let currentlyPlayingTrack = null;
  
  const SEARCH_COOLDOWN_MS = 5000; // Minimum time between searches
  const MAX_MIX_DATA_CACHE_ENTRIES = 40; // Cap cache to prevent unbounded growth
  const MIX_DATA_CACHE = new Map(); // Cache mix data per track
  const AUTO_FX_LAST_WINDOW_MINUTES = 2; // X minutes mentioned by user requirement
  const AUTO_FX_MAX_IN_LAST_WINDOW = 2;
  const AUTO_FX_MIN_GAP_MS = 14000;
  const AUTO_FX_MAX_GAP_MS = 45000;
  const AUTO_FX_CADENCE_TYPES = Object.freeze(['echoDelay', 'filter', 'reverb']);

  const AUTO_FX_PRIORITY = Object.freeze({
    hotCues: 4,
    sampling: 3,
    scratching: 2,
    keyShift: 1,
  });

  const AUTO_FX_LABELS = Object.freeze({
    keyShift: 'Key Shift / Harmonic',
    scratching: 'Scratching',
    hotCues: 'Hot Cues',
    sampling: 'Sampling',
  });

  function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getAutoFxGapBoundsMs() {
    const minGapMs = Math.max(
      1000,
      toFiniteNumber(getAutoFxMinGapMs?.(), AUTO_FX_MIN_GAP_MS),
    );
    const maxGapRawMs = Math.max(
      minGapMs,
      toFiniteNumber(getAutoFxMaxGapMs?.(), AUTO_FX_MAX_GAP_MS),
    );
    return {
      minGapMs,
      maxGapMs: Math.max(minGapMs, maxGapRawMs),
    };
  }

  function pickZoneAnchorMs(zones, options = {}) {
    const anchorMs = toFiniteNumber(options.anchorMs, 0);
    const maxMs = toFiniteNumber(options.maxMs, Number.POSITIVE_INFINITY);
    const minMs = toFiniteNumber(options.minMs, 0);
    if (!Array.isArray(zones) || zones.length === 0) return -1;

    let bestMs = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const zone of zones) {
      const startMs = toFiniteNumber(zone?.startSec, -1) * 1000;
      const endMs = toFiniteNumber(zone?.endSec, -1) * 1000;
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

      let candidateMs = anchorMs;
      if (candidateMs < startMs) candidateMs = startMs;
      if (candidateMs > endMs) candidateMs = endMs;
      if (candidateMs < minMs || candidateMs > maxMs) continue;

      const distance = Math.abs(candidateMs - anchorMs);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMs = candidateMs;
      }
    }

    return bestMs;
  }

  function enforceAutoFxDensity(events, effectiveEndMs, options = {}) {
    if (!Array.isArray(events) || events.length === 0) return [];
    const { minGapMs, maxGapMs } = getAutoFxGapBoundsMs();

    const sorted = [...events].sort((a, b) => a.timeMs - b.timeMs);
    const spaced = [];

    for (const event of sorted) {
      const previous = spaced[spaced.length - 1];
      if (previous && (event.timeMs - previous.timeMs) < minGapMs) {
        const keepCurrent = (AUTO_FX_PRIORITY[event.type] || 0) > (AUTO_FX_PRIORITY[previous.type] || 0);
        if (keepCurrent) {
          spaced[spaced.length - 1] = event;
        }
        continue;
      }
      spaced.push(event);
    }

    const cadenceMinMs = Math.max(6000, options.minTimelineMs || 6000);
    const cadenceMaxMs = Math.max(cadenceMinMs, toFiniteNumber(options.maxTimelineMs, effectiveEndMs));
    const cadenceTrackKey = String(options.trackKey || 'track');

    const withMaxGap = [];
    let prevTimeMs = cadenceMinMs;
    let cadenceSeq = 0;

    const pushCadenceEventsUntil = (targetTimeMs) => {
      while ((targetTimeMs - prevTimeMs) > maxGapMs) {
        const candidateMs = Math.round(prevTimeMs + maxGapMs);
        if (candidateMs >= targetTimeMs) break;
        const cadenceType = AUTO_FX_CADENCE_TYPES[cadenceSeq % AUTO_FX_CADENCE_TYPES.length];
        cadenceSeq += 1;
        withMaxGap.push({
          id: `${cadenceTrackKey}::cadence::${cadenceType}::${candidateMs}`,
          type: cadenceType,
          label: AUTO_FX_LABELS[cadenceType] || cadenceType,
          timeMs: candidateMs,
          reason: 'max-gap cadence fill',
        });
        prevTimeMs = candidateMs;
      }
    };

    for (const event of spaced) {
      pushCadenceEventsUntil(event.timeMs);
      withMaxGap.push(event);
      prevTimeMs = event.timeMs;
    }

    pushCadenceEventsUntil(cadenceMaxMs);

    const normalized = withMaxGap
      .filter((event) => event.timeMs >= cadenceMinMs && event.timeMs <= cadenceMaxMs)
      .sort((a, b) => a.timeMs - b.timeMs);

    const lastWindowMs = AUTO_FX_LAST_WINDOW_MINUTES * 60 * 1000;
    const tailStartMs = Math.max(cadenceMinMs, effectiveEndMs - lastWindowMs);
    const outsideTail = normalized.filter((event) => event.timeMs < tailStartMs);
    const maxByCadenceInTail = Math.max(
      AUTO_FX_MAX_IN_LAST_WINDOW,
      Math.ceil(lastWindowMs / Math.max(1, maxGapMs)),
    );
    const inTail = normalized
      .filter((event) => event.timeMs >= tailStartMs)
      .sort((a, b) => {
        const pa = AUTO_FX_PRIORITY[a.type] || 0;
        const pb = AUTO_FX_PRIORITY[b.type] || 0;
        if (pb !== pa) return pb - pa;
        return a.timeMs - b.timeMs;
      })
      .slice(0, maxByCadenceInTail)
      .sort((a, b) => a.timeMs - b.timeMs);

    return [...outsideTail, ...inTail].sort((a, b) => a.timeMs - b.timeMs);
  }

  function buildAutoFxPlan({ currentTrack, mixData, triggerMs, maxDurationSec }) {
    const trackDurationMs = toFiniteNumber(currentTrack?.duration, 0);
    const mixDurationMs = Math.round(toFiniteNumber(mixData?.durationSec, 0) * 1000);
    let durationMs = Math.max(trackDurationMs, mixDurationMs, 0);

    if (durationMs <= 0) {
      const fallbackFromMaxDurationMs = toFiniteNumber(maxDurationSec, 0) > 0
        ? Math.round(toFiniteNumber(maxDurationSec, 0) * 1000)
        : 0;
      const fallbackFromTriggerMs = toFiniteNumber(triggerMs, 0) > 0
        ? Math.round(toFiniteNumber(triggerMs, 0) + 20000)
        : 0;
      durationMs = Math.max(fallbackFromMaxDurationMs, fallbackFromTriggerMs, 45000);
    }

    if (durationMs <= 0) return [];

    const maxDurationMs = toFiniteNumber(maxDurationSec, 0) > 0
      ? toFiniteNumber(maxDurationSec, 0) * 1000
      : -1;
    const effectiveEndMs = maxDurationMs > 0 ? Math.min(durationMs, maxDurationMs) : durationMs;
    const timelineMaxMs = Math.max(12000, effectiveEndMs - 5000);
    const transitionAnchorMs = triggerMs > 0
      ? Math.min(triggerMs, timelineMaxMs)
      : Math.round(timelineMaxMs * 0.82);
    const { minGapMs } = getAutoFxGapBoundsMs();

    // --- Helper: snap a time to the nearest phrase boundary within ±snapWindowMs ---
    const phraseGrid = Array.isArray(mixData?.indicators?.phraseGrid)
      ? mixData.indicators.phraseGrid
      : [];
    const snapToPhraseGrid = (preferredMs, snapWindowMs = 3000) => {
      if (phraseGrid.length === 0) return preferredMs;
      let bestMs = preferredMs;
      let bestDist = snapWindowMs;
      for (const { timeSec } of phraseGrid) {
        const gridMs = toFiniteNumber(timeSec, -1) * 1000;
        if (gridMs <= 0) continue;
        const dist = Math.abs(gridMs - preferredMs);
        if (dist < bestDist) {
          bestDist = dist;
          bestMs = gridMs;
        }
      }
      return bestMs;
    };

    // --- Helper: detect if a given time is in a high-vocal region ---
    const vocalProfile = Array.isArray(mixData?.indicators?.vocalPresenceProfile)
      ? mixData.indicators.vocalPresenceProfile
      : [];
    const isHighVocalMoment = (preferredMs, threshold = 0.6) => {
      if (vocalProfile.length === 0) return false;
      const preferredSec = preferredMs / 1000;
      // Find surrounding samples
      let closest = null;
      let closestDist = Infinity;
      for (const { timeSec, value } of vocalProfile) {
        const dist = Math.abs(toFiniteNumber(timeSec, -1) - preferredSec);
        if (dist < closestDist) {
          closestDist = dist;
          closest = { timeSec, value };
        }
      }
      return closest != null && toFiniteNumber(closest.value, 0) >= threshold;
    };

    // --- Helper: find the nearest low-vocal moment close to preferredMs ---
    const findLowVocalNearby = (preferredMs, searchWindowMs = 8000, threshold = 0.45) => {
      if (vocalProfile.length === 0) return preferredMs;
      const minMs = Math.max(6000, preferredMs - searchWindowMs);
      const maxMs = Math.min(timelineMaxMs, preferredMs + searchWindowMs);
      let best = null;
      let bestDist = Infinity;
      for (const { timeSec, value } of vocalProfile) {
        const ms = toFiniteNumber(timeSec, -1) * 1000;
        if (ms < minMs || ms > maxMs) continue;
        const vocalVal = toFiniteNumber(value, 1);
        if (vocalVal <= threshold) {
          const dist = Math.abs(ms - preferredMs);
          if (dist < bestDist) {
            bestDist = dist;
            best = ms;
          }
        }
      }
      return best != null ? best : preferredMs;
    };

    const NMZ_HARSH_TYPES = ['scratching', 'hotCues', 'sampling'];

    const addEvent = (type, preferredMs, reason) => {
      let resolvedMs = preferredMs;

      // Skip harsh FX that would land inside a Never Miss Zone (chorus, hook, climax).
      if (NMZ_HARSH_TYPES.includes(type) && isInNeverMissZone(resolvedMs / 1000, mixData)) {
        return null;
      }

      // Snap vocal-sensitive FX away from high-vocal moments.
      const vocalSensitiveTypes = ['scratching', 'echoDelay'];
      if (vocalSensitiveTypes.includes(type) && isHighVocalMoment(resolvedMs)) {
        const alternative = findLowVocalNearby(resolvedMs);
        if (alternative !== resolvedMs) {
          resolvedMs = alternative;
          reason = `${reason} (shifted from vocal peak)`;
        }
      }

      // Snap all events to the nearest phrase boundary when possible.
      resolvedMs = snapToPhraseGrid(resolvedMs, 3500);

      const timeMs = Math.round(Math.max(6000, Math.min(timelineMaxMs, resolvedMs)));
      if (!Number.isFinite(timeMs)) return null;
      return {
        id: `${String(currentTrack?.id || currentTrack?.uri || currentTrack?.name || 'track')}::${type}::${timeMs}`,
        type,
        label: AUTO_FX_LABELS[type] || type,
        timeMs,
        reason,
      };
    };

    const candidates = [];

    const safeNearAnchorMs = pickZoneAnchorMs(mixData?.safeTransitionZones, {
      anchorMs: Math.max(10000, transitionAnchorMs - 18000),
      minMs: 6000,
      maxMs: timelineMaxMs,
    });

    const breakdownNearAnchorMs = pickZoneAnchorMs(mixData?.breakdownZones, {
      anchorMs: Math.max(8000, transitionAnchorMs - 12000),
      minMs: 6000,
      maxMs: timelineMaxMs,
    });

    const peakNearAnchorMs = pickZoneAnchorMs(mixData?.peakZones, {
      anchorMs: Math.max(9000, transitionAnchorMs - 26000),
      minMs: 6000,
      maxMs: timelineMaxMs,
    });

    candidates.push(
      addEvent(
        'keyShift',
        safeNearAnchorMs > 0 ? safeNearAnchorMs : Math.max(12000, transitionAnchorMs - 45000),
        safeNearAnchorMs > 0 ? 'safe-zone harmonic match' : 'pre-transition harmonic window',
      ),
    );

    candidates.push(
      addEvent(
        'sampling',
        breakdownNearAnchorMs > 0 ? breakdownNearAnchorMs : Math.max(12000, transitionAnchorMs - 55000),
        breakdownNearAnchorMs > 0 ? 'breakdown sampling pocket' : 'energy support before transition',
      ),
    );

    candidates.push(
      addEvent(
        'hotCues',
        peakNearAnchorMs > 0 ? peakNearAnchorMs : Math.max(12000, transitionAnchorMs - 30000),
        peakNearAnchorMs > 0 ? 'peak-zone cue trigger' : 'structured cue rehearsal',
      ),
    );

    candidates.push(
      addEvent(
        'scratching',
        breakdownNearAnchorMs > 0 ? (breakdownNearAnchorMs + 7000) : Math.max(12000, transitionAnchorMs - 12000),
        breakdownNearAnchorMs > 0 ? 'post-breakdown texture' : 'late-track scratch accent',
      ),
    );

    // With shorter min intervals, add softer intermediate accents so the setting has audible impact.
    if (minGapMs <= 10000) {
      const softAnchorA = Math.max(6000, transitionAnchorMs - Math.max(minGapMs * 2, 6000));
      const softAnchorB = Math.max(6000, transitionAnchorMs - Math.max(minGapMs, 3000));
      const softAnchorC = Math.max(6000, transitionAnchorMs - Math.max(Math.round(minGapMs * 0.6), 2000));

      candidates.push(addEvent('echoDelay', softAnchorA, 'rhythmic pre-transition echo'));
      candidates.push(addEvent('filter', softAnchorB, 'smooth pre-transition filter'));
      candidates.push(addEvent('reverb', softAnchorC, 'transition space accent'));
    }

    const planned = enforceAutoFxDensity(
      candidates.filter(Boolean),
      effectiveEndMs,
      {
        minTimelineMs: 6000,
        maxTimelineMs: timelineMaxMs,
        trackKey: String(currentTrack?.id || currentTrack?.uri || currentTrack?.name || 'track'),
      },
    );

    return planned;
  }

  function planAutoFxEvents(context = {}) {
    const planned = buildAutoFxPlan(context).map((event) => ({
      ...event,
      triggered: false,
      trackId: context.currentTrack?.id || null,
      trackName: context.currentTrack?.name || '',
    }));

    pendingAutoFxEvents = planned;
    onAutoFxPlanCalculated?.(planned, {
      lastWindowMinutes: AUTO_FX_LAST_WINDOW_MINUTES,
      maxInLastWindow: AUTO_FX_MAX_IN_LAST_WINDOW,
    });

    logger?.debug?.('autoDj: creative FX plan calculated', {
      count: planned.length,
      events: planned.map((event) => ({
        type: event.type,
        timeMs: event.timeMs,
        reason: event.reason,
      })),
      trackName: context.currentTrack?.name,
      triggerMs: context.triggerMs,
    });
  }

  function consumeReadyAutoFxEvents(positionMs, options = {}) {
    const position = toFiniteNumber(positionMs, 0);
    const currentTrackId = options.currentTrackId || null;
    if (position <= 0 || !pendingAutoFxEvents.length) return [];

    const ready = [];
    const remaining = [];

    for (const event of pendingAutoFxEvents) {
      if (!event) continue;
      if (currentTrackId && event.trackId && event.trackId !== currentTrackId) {
        continue;
      }

      if (position >= event.timeMs) {
        ready.push(event);
      } else {
        remaining.push(event);
      }
    }

    pendingAutoFxEvents = remaining;
    return ready;
  }

  // Load settings and history from localStorage
  function loadSettings() {
    try {
      const rawAutoMode = localStorage.getItem(AUTO_MODE_KEY);
      autoModeEnabled = rawAutoMode == null ? true : rawAutoMode === '1';
      const historyJson = localStorage.getItem(AUTO_MODE_HISTORY_KEY);
      if (historyJson) {
        const history = JSON.parse(historyJson);
        playHistory = new Set(history || []);
      }
    } catch (err) {
      logger?.debug?.('autoDj: failed to load settings', { error: err.message });
    }
  }

  // Save settings to localStorage
  function saveSettings() {
    try {
      localStorage.setItem(AUTO_MODE_KEY, autoModeEnabled ? '1' : '0');
      localStorage.setItem(AUTO_MODE_HISTORY_KEY, JSON.stringify(Array.from(playHistory)));
    } catch (err) {
      logger?.debug?.('autoDj: failed to save settings', { error: err.message });
    }
  }

  /**
   * Fetch mix analysis data from API for a track.
   * Checks localStorage first; persists the result after a successful API call.
   * Invalidates the localStorage entry when the server returns 404 (file removed
   * from the server cache → next download will be treated as a fresh one).
   */
  async function fetchMixData(trackName, artistName) {
    if (!trackName) return null;

    const cacheKey = `${trackName}|${artistName || ''}`;
    if (MIX_DATA_CACHE.has(cacheKey)) {
      logger?.debug?.('autoDj: mix data from memory cache', { trackName, artistName });
      return MIX_DATA_CACHE.get(cacheKey);
    }

    // Hit localStorage before making a network call
    const storedMeta = getStoredTrackMeta(trackName, artistName);
    if (storedMeta?.mixData) {
      MIX_DATA_CACHE.set(cacheKey, storedMeta.mixData);
      // Evict oldest entry if cache exceeds MAX_MIX_DATA_CACHE_ENTRIES
      if (MIX_DATA_CACHE.size > MAX_MIX_DATA_CACHE_ENTRIES) {
        MIX_DATA_CACHE.delete(MIX_DATA_CACHE.keys().next().value);
      }
      logger?.debug?.('autoDj: mix data from localStorage', { trackName, artistName });
      return storedMeta.mixData;
    }

    const PENDING_MAX_RETRIES = 5;
    const PENDING_BASE_DELAY_MS = 1000;
    const PENDING_MAX_DELAY_MS = 30000;

    try {
      const apiUrl = getDownloaderApiUrl();
      if (!apiUrl) return null;
      if (apiHealthMonitor?.isOffline()) return null;

      const params = new URLSearchParams();
      params.append('track', trackName);
      if (artistName) params.append('artist', artistName);

      let data = null;
      for (let attempt = 0; attempt <= PENDING_MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delayMs = Math.min(PENDING_BASE_DELAY_MS * 2 ** (attempt - 1), PENDING_MAX_DELAY_MS);
          logger?.debug?.('autoDj: mix analysis pending, retrying', { trackName, attempt, delayMs });
          await new Promise(r => setTimeout(r, delayMs));
          if (apiHealthMonitor?.isOffline()) return null;
        }

        const response = await fetch(appendApiToken(`${apiUrl}/mix?${params}`, getDownloaderApiToken?.()), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.status === 404) {
          invalidateStoredTrackMeta(trackName, artistName);
          MIX_DATA_CACHE.delete(cacheKey);
          logger?.debug?.('autoDj: mix data 404 – localStorage invalidated', { trackName, artistName });
          return null;
        }

        if (!response.ok) {
          apiHealthMonitor?.recordFailure();
          logger?.debug?.('autoDj: mix data fetch failed', {
            status: response.status,
            trackName,
          });
          return null;
        }

        apiHealthMonitor?.recordSuccess();
        data = await response.json();

        if (data?.status !== 'already_pending') break;
      }

      if (data?.status === 'already_pending') {
        logger?.debug?.('autoDj: mix analysis still pending after retries', { trackName });
        return null;
      }

      const mixData = data?.mix || null;

      if (mixData) {
        MIX_DATA_CACHE.set(cacheKey, mixData);
        if (MIX_DATA_CACHE.size > MAX_MIX_DATA_CACHE_ENTRIES) {
          MIX_DATA_CACHE.delete(MIX_DATA_CACHE.keys().next().value);
        }
        patchStoredTrackMeta(trackName, artistName, { mixData });
      }

      logger?.debug?.('autoDj: mix data fetched', {
        trackName,
        hasSafeZones: !!mixData?.safeTransitionZones?.length,
        durationSec: mixData?.durationSec,
      });

      return mixData;
    } catch (err) {
      apiHealthMonitor?.recordFailure();
      logger?.warn?.('autoDj: failed to fetch mix data', {
        error: err?.message,
        trackName,
      });
      return null;
    }
  }

  /**
   * Check if a time point is within an avoid transition zone
   */
  function isInAvoidZone(timeSec, mixData) {
    if (!mixData?.avoidTransitionZones?.length) return false;
    
    return mixData.avoidTransitionZones.some(
      zone => timeSec >= zone.startSec && timeSec <= zone.endSec
    );
  }

  /**
   * Check if a time point is within a never-miss zone (chorus, hook, climax — must never be cut)
   */
  function isInNeverMissZone(timeSec, mixData) {
    if (!mixData?.neverMissZones?.length) return false;
    return mixData.neverMissZones.some(
      zone => timeSec >= zone.startSec && timeSec <= zone.endSec
    );
  }

  /**
   * Check if a time point is within a drop zone
   */
  function isInDropZone(timeSec, mixData) {
    if (!mixData?.dropZones?.length) return false;
    
    return mixData.dropZones.some(
      zone => timeSec >= zone.startSec && timeSec <= zone.endSec
    );
  }

  /**
   * Check if a zone is valid (not in avoid/drop zones)
   */
  function isValidTransitionZone(zone, mixData) {
    if (!zone) return false;
    
    // Never transition in avoid zones
    if (isInAvoidZone(zone.startSec, mixData) || isInAvoidZone(zone.endSec, mixData)) {
      return false;
    }
    
    // Never transition in drop zones (they're interesting moments)
    if (isInDropZone(zone.startSec, mixData) || isInDropZone(zone.endSec, mixData)) {
      return false;
    }

    // Never transition during never-miss zones (choruses, hooks, climaxes)
    if (isInNeverMissZone(zone.startSec, mixData) || isInNeverMissZone(zone.endSec, mixData)) {
      return false;
    }

    return true;
  }

  /**
   * Strictly blocked zone types when max duration is ON.
   * Covers:
   *   1. high_energy_peak  — peakZones with intensity 'high' or reason matching
   *   2. drop_or_impact    — all dropZones or reason matching
   *   3. high_tension      — avoidTransitionZones with matching reason
   *   4. intro_identification — avoidTransitionZones with matching reason, or before probableSongStartSec
   *
   * Returns { blocked: true, zoneEndSec } | { blocked: false }
   */
  function getMaxDurationStrictBlock(timeSec, mixData) {
    if (!mixData) return { blocked: false };

    const STRICT_BLOCK_REASONS = ['high_energy_peak', 'drop_or_impact', 'high_tension', 'intro_identification'];

    // 1. high_energy_peak: peakZones with intensity containing 'high'
    const peakZones = Array.isArray(mixData.peakZones) ? mixData.peakZones : [];
    for (const zone of peakZones) {
      const intensity = String(zone.intensity || zone.reason || '').toLowerCase();
      if ((intensity.includes('high') || intensity === 'high_energy_peak') &&
          timeSec >= zone.startSec && timeSec <= zone.endSec) {
        return { blocked: true, zoneEndSec: zone.endSec };
      }
    }

    // 2. drop_or_impact: all dropZones
    const dropZones = Array.isArray(mixData.dropZones) ? mixData.dropZones : [];
    for (const zone of dropZones) {
      if (timeSec >= zone.startSec && timeSec <= zone.endSec) {
        return { blocked: true, zoneEndSec: zone.endSec };
      }
    }

    // 3 & 4. avoidTransitionZones with strict-blocked reason, plus intro check
    const avoidZones = Array.isArray(mixData.avoidTransitionZones) ? mixData.avoidTransitionZones : [];
    for (const zone of avoidZones) {
      const reason = String(zone.reason || zone.type || '').toLowerCase().replace(/[\s-]/g, '_');
      if (STRICT_BLOCK_REASONS.some(r => reason.includes(r)) &&
          timeSec >= zone.startSec && timeSec <= zone.endSec) {
        return { blocked: true, zoneEndSec: zone.endSec };
      }
    }

    // 4. intro_identification: time before probableSongStartSec
    const probableStart = toFiniteNumber(mixData.probableSongStartSec, 0);
    if (probableStart > 0 && timeSec < probableStart) {
      return { blocked: true, zoneEndSec: probableStart };
    }

    // 5. neverMissZones — essential artistic moments (chorus, hook, climax)
    const neverMissZones = Array.isArray(mixData.neverMissZones) ? mixData.neverMissZones : [];
    for (const zone of neverMissZones) {
      if (timeSec >= zone.startSec && timeSec <= zone.endSec) {
        return { blocked: true, zoneEndSec: zone.endSec };
      }
    }

    return { blocked: false };
  }

  /**
   * When max-duration constrains triggerMs and that point falls inside a strictly
   * blocked zone, advance triggerMs to just after the zone end.
   * Returns the adjusted triggerMs (may be unchanged).
   */
  function advancePastMaxDurationBlock(triggerMs, mixData, trackDurationMs) {
    if (!mixData) return triggerMs;
    const triggerSec = triggerMs / 1000;
    const block = getMaxDurationStrictBlock(triggerSec, mixData);
    if (!block.blocked) return triggerMs;

    const advancedMs = Math.round(block.zoneEndSec * 1000) + 500; // 0.5 s buffer after zone
    const cap = trackDurationMs > 0 ? Math.max(triggerMs, trackDurationMs - 10000) : advancedMs;
    return Math.min(advancedMs, cap);
  }

  /**
   * Find best safe transition zone in a track.
   *
   * Starting from targetSec, checks whether that point is free of any blocking zone
   * (avoid, drop, never-miss, high-energy peak). If it is blocked, jumps to just after
   * the end of that zone and repeats until a safe point is found or the track ends.
   * A safe point inside a declared safeTransitionZone is returned as type 'safe';
   * a safe point in empty space is returned as type 'clear'.
   */
  function findBestTransitionZone(mixData, options = {}) {
    if (!mixData) return null;

    const durationSec = Number(mixData.durationSec) || 0;
    const requestedTargetSec = Number(options.targetSec);
    const hasTarget = Number.isFinite(requestedTargetSec) && requestedTargetSec > 0;
    const targetSec = hasTarget
      ? requestedTargetSec
      : (durationSec > 0 ? Math.max(0, durationSec - 8) : 0);

    // Zones that block a transition at any given point
    const blockingZones = [
      ...(Array.isArray(mixData.avoidTransitionZones) ? mixData.avoidTransitionZones : []),
      ...(Array.isArray(mixData.dropZones) ? mixData.dropZones : []),
      ...(Array.isArray(mixData.neverMissZones) ? mixData.neverMissZones : []),
      ...(Array.isArray(mixData.peakZones) ? mixData.peakZones : []).filter((z) => {
        const label = String(z.intensity || z.reason || '').toLowerCase();
        return label.includes('high') || label === 'high_energy_peak';
      }),
    ];

    // Returns the endSec of whichever blocking zone contains timeSec, or null if safe.
    const getBlockEnd = (timeSec) => {
      for (const zone of blockingZones) {
        if (timeSec >= zone.startSec && timeSec <= zone.endSec) {
          return zone.endSec;
        }
      }
      return null;
    };

    // If a nearby outro zone exists (target inside it, or outro starts within 30s after target),
    // snap candidateSec to the outro's start so the transition fires at its cleanest entry point.
    const outroZones = Array.isArray(mixData.outroZones) ? mixData.outroZones : [];
    const nearbyOutro = hasTarget
      ? outroZones
          .filter((z) => z.endSec >= targetSec && z.startSec <= targetSec + 30)
          .sort((a, b) => Math.abs(a.startSec - targetSec) - Math.abs(b.startSec - targetSec))[0]
      : null;

    const MAX_ITER = 20;
    let candidateSec = nearbyOutro ? nearbyOutro.startSec : targetSec;

    for (let i = 0; i < MAX_ITER; i++) {
      if (durationSec > 0 && candidateSec >= durationSec) break;

      const blockEnd = getBlockEnd(candidateSec);
      if (blockEnd === null) {
        // candidateSec is safe — match to a declared safe zone if one covers it.
        // safeTransitionZones, outroZones and breakdownZones are all safe landing spots.
        const safeZonePools = [
          ...(mixData.safeTransitionZones || []),
          ...(mixData.outroZones || []),
          ...(mixData.breakdownZones || []),
        ];
        const declaredZone = safeZonePools.find(
          (z) => candidateSec >= z.startSec && candidateSec <= z.endSec,
        );
        const zone = declaredZone || { startSec: candidateSec, endSec: candidateSec };
        return {
          zone,
          type: declaredZone ? 'safe' : 'clear',
          mixData,
          triggerSec: candidateSec,
        };
      }

      // Jump just past the blocking zone and retry
      candidateSec = blockEnd + 0.5;
    }

    logger?.debug?.('autoDj: no safe transition point found', { targetSec });
    return null;
  }

  /**
   * Recommend transition type based on track characteristics
   * Considers drop zones and avoid zones to pick the most appropriate transition.
   * Uses kickReentry, tempoBpm, energyStability, grooveStability when available.
   */
  function recommendTransitionType(currentMixData, nextMixData) {
    const currentIndicators = currentMixData?.indicators || {};
    const nextIndicators = nextMixData?.indicators || {};

    // --- Tempo matching ---
    const currentBpm = toFiniteNumber(currentIndicators.tempoBpm, 0)
      || toFiniteNumber(currentMixData?.audioFeatures?.bpm, 0);
    const nextBpm = toFiniteNumber(nextIndicators.tempoBpm, 0)
      || toFiniteNumber(nextMixData?.audioFeatures?.bpm, 0);
    const deltaBpm = currentBpm > 0 && nextBpm > 0 ? Math.abs(currentBpm - nextBpm) : null;

    // --- Stability indicators ---
    const energyStability = toFiniteNumber(currentIndicators.energyStability, -1);
    const grooveStability = toFiniteNumber(currentIndicators.grooveStability, -1);
    const isCurrentStable = energyStability >= 0.65 && grooveStability >= 0.65;
    const isCurrentUnstable = energyStability >= 0 && energyStability < 0.35;

    // --- Drop zones: check if next track has a drop with kick reentry near the start ---
    const nextFirstDrop = nextMixData?.dropZones?.[0] || null;
    const nextDropIsEarly = nextFirstDrop && nextFirstDrop.startSec < 10;
    const nextDropHasKickReentry = nextFirstDrop && nextFirstDrop.kickReentry === 1;

    if (nextDropIsEarly && nextDropHasKickReentry) {
      // Hard cut or sidechain to land exactly on the kick reentry
      return deltaBpm != null && deltaBpm <= 4 ? 'cut_transition' : 'sidechain_basic';
    }

    if (nextDropIsEarly) {
      return 'filter_sweep_high_to_low'; // Smooth filter sweep before the drop
    }

    // If next track has a clear breakdown at start, use crossfade to it
    if (nextMixData?.breakdownZones?.length && nextMixData.breakdownZones[0].startSec < 5) {
      return 'crossfade_logarithmic';
    }

    // Check current track drop endings with kick reentry — use sidechain to boost energy
    if (currentMixData?.dropZones?.length) {
      const lastDrop = currentMixData.dropZones[currentMixData.dropZones.length - 1];
      if (lastDrop && lastDrop.endSec < (currentMixData.durationSec || Infinity) - 5) {
        if (lastDrop.kickReentry === 1 && isCurrentStable) {
          return 'sidechain_basic'; // Kick reentry + stable groove → sidechain pump
        }
        return 'filter_sweep_low_high'; // Restore energy after drop
      }
    }

    // Unstable energy profile → cut transition avoids jarring crossfades
    if (isCurrentUnstable) {
      return deltaBpm != null && deltaBpm <= 6 ? 'crossfade_linear' : 'cut_transition';
    }

    // Check if we're transitioning from breakdown zone
    if (currentMixData?.breakdownZones?.length) {
      const lastBreakdown = currentMixData.breakdownZones[currentMixData.breakdownZones.length - 1];
      if (lastBreakdown && lastBreakdown.endSec < (currentMixData.durationSec || Infinity) - 2) {
        // Stable groove after breakdown → smooth crossfade
        if (isCurrentStable) return 'crossfade_logarithmic';
        return 'crossfade_linear';
      }
    }

    // BPM-guided fallback using waveform tempoBpm when available
    if (deltaBpm != null) {
      if (deltaBpm <= 1 && isCurrentStable) return 'crossfade_linear';
      if (deltaBpm <= 4) return 'crossfade_logarithmic';
      if (deltaBpm >= 20) return 'filter_automation';
    }

    // Default to a smooth crossfade
    return 'crossfade_linear';
  }

  /**
   * Toggle auto mode on/off
   */
  function toggleAutoMode() {
    autoModeEnabled = !autoModeEnabled;
    clearAutomixTimer();
    saveSettings();
    logger?.info?.('autoDj: toggled', { enabled: autoModeEnabled });
    return autoModeEnabled;
  }

  /**
   * Mark a track as played - store ALL ID variants to prevent looping with different ID formats
   */
  function markTrackAsPlayed(trackId, trackObject) {
    // Store the primary ID
    if (trackId) {
      playHistory.add(trackId);
    }
    // Also store all ID variants from the track object itself
    if (trackObject) {
      if (trackObject.id) playHistory.add(trackObject.id);
      if (trackObject.ratingKey) playHistory.add(trackObject.ratingKey);
      if (trackObject.uri) playHistory.add(trackObject.uri);
      // Store by name+artist combination too as a fallback
      const trackName = String(trackObject.name || trackObject.trackName || '').trim().toLowerCase();
      const artistName = String(trackObject.artist || trackObject.artistName || '').trim().toLowerCase();
      if (trackName && artistName) {
        playHistory.add(`${trackName}|${artistName}`);
      }
    }
    saveSettings();
    logger?.debug?.('autoDj: track marked as played with all ID variants', { trackId, trackObject });
  }

  /**
   * Check if track has already been played - check all ID variants
   */
  function isTrackPlayed(trackId, trackObject) {
    if (!trackId && !trackObject) return false;
    
    // Check primary trackId
    if (trackId && playHistory.has(trackId)) return true;
    
    // Check all variants from track object
    if (trackObject) {
      if (trackObject.id && playHistory.has(trackObject.id)) return true;
      if (trackObject.ratingKey && playHistory.has(trackObject.ratingKey)) return true;
      if (trackObject.uri && playHistory.has(trackObject.uri)) return true;
      // Check name+artist combination
      const trackName = String(trackObject.name || trackObject.trackName || '').trim().toLowerCase();
      const artistName = String(trackObject.artist || trackObject.artistName || '').trim().toLowerCase();
      if (trackName && artistName && playHistory.has(`${trackName}|${artistName}`)) return true;
    }
    
    return false;
  }

  /**
   * Check if we're about to loop on the same track - detects if current/next are same song
   * Returns true if same track, false if different
   */
  function wouldCreateLoopWithCurrentTrack(resultTrack, currentTrack) {
    if (!resultTrack || !currentTrack) return false;

    // Direct ID matching
    const resultId = resultTrack.id || resultTrack.ratingKey || resultTrack.uri;
    const currentId = currentTrack.id || currentTrack.ratingKey || currentTrack.uri;
    if (resultId && currentId && resultId === currentId) return true;

    // Name + artist matching
    const resultName = String(resultTrack.name || resultTrack.trackName || '').trim().toLowerCase();
    const resultArtist = String(resultTrack.artist || resultTrack.artistName || '').trim().toLowerCase();
    const currentName = String(currentTrack.name || currentTrack.trackName || '').trim().toLowerCase();
    const currentArtist = String(currentTrack.artist || currentTrack.artistName || '').trim().toLowerCase();
    
    if (resultName && resultArtist && currentName && currentArtist &&
        resultName === currentName && resultArtist === currentArtist) {
      return true;
    }

    return false;
  }

  /**
   * Clear the pending automix timer
   */
  function clearAutomixTimer() {
    if (automixTimerHandle) {
      clearTimeout(automixTimerHandle);
      automixTimerHandle = null;
    }
  }

  function isSuggestionSearchEnabled() {
    return suggestionSearchEnabled !== false;
  }

  function setSuggestionSearchEnabled(enabled) {
    suggestionSearchEnabled = enabled !== false;
    logger?.info?.('autoDj: suggestion queue search setting changed', {
      suggestionSearchEnabled,
    });
    return suggestionSearchEnabled;
  }

  /**
   * Schedule automix to trigger at optimal moment
   * Called when a new track is added to queue
   */
  function scheduleAutomixTiming(currentTrack) {
    if (!autoModeEnabled || !currentTrack) return;

    // Store synchronously so subsequent searches can exclude this track even after
    // the player removes it from the queue upon playback start.
    currentlyPlayingTrack = currentTrack;

    clearAutomixTimer();
    currentTrackMixData = null;
    pendingAutoFxEvents = [];
    onMixDataUpdated?.(null);

    logger?.debug?.('autoDj: scheduling automix timing for', {
      trackName: currentTrack.name,
      durationMs: currentTrack.duration,
      artistName: currentTrack.artist,
      maxDurationSec: getTrackMaxDurationSec?.() || 0,
    });

    // Fetch mix data for current track
    fetchMixData(currentTrack.name, currentTrack.artist)
      .then(mixData => {
        currentTrackMixData = mixData;
        onMixDataUpdated?.(mixData);

        const rawMaxDurationSec = getTrackMaxDurationSec?.() || 0;
        // The player seeks to autoDjStartOffsetMs before playback, so zone times and
        // triggerMs are absolute positions in the file. Shift the max-duration wall by
        // the same offset so "max duration" is measured from the actual start of playback.
        const startOffsetMs = Math.max(0, Number(currentTrack.autoDjStartOffsetMs) || 0);
        const maxDurationSec = rawMaxDurationSec > 0 ? rawMaxDurationSec + startOffsetMs / 1000 : 0;
        const maxDurationMs = maxDurationSec > 0 ? maxDurationSec * 1000 : -1;

        if (!mixData) {
          logger?.debug?.('autoDj: no mix data available, using duration-based timing');
          const resolvedDurationMs = Math.max(currentTrack.duration || 0, getActualDurationMs?.() || 0);
          
          // If max duration is set, use it as constraint
          if (maxDurationMs > 0) {
            let triggerMs = Math.min(maxDurationMs, Math.max(
              resolvedDurationMs - 20000,
              resolvedDurationMs * 0.75
            ));
            // No mix data → cannot check strict-block zones; keep as-is
            logger?.debug?.('autoDj: calculated fallback timing with max duration constraint', { 
              triggerMs, 
              maxDurationMs 
            });
            onAutomixTimingCalculated?.(triggerMs);
            planAutoFxEvents({
              currentTrack,
              mixData: null,
              triggerMs,
              maxDurationSec,
            });
            return;
          }
          
          // Fallback: trigger 20s before end
          const triggerMs = Math.max(
            resolvedDurationMs - 20000,
            resolvedDurationMs * 0.75
          );
          logger?.debug?.('autoDj: calculated fallback timing', { triggerMs });
          onAutomixTimingCalculated?.(triggerMs);
          planAutoFxEvents({
            currentTrack,
            mixData: null,
            triggerMs,
            maxDurationSec,
          });
          return;
        }

        const targetSecForZone = maxDurationSec > 0 ? maxDurationSec : null;
        const transitionZone = findBestTransitionZone(mixData, {
          targetSec: targetSecForZone,
        });

        // Confidence in transition zone detection: if low, pull trigger earlier as safety buffer.
        const transitionConfidence = toFiniteNumber(mixData.confidence?.transitions, 1);
        const confidenceBufferMs = transitionConfidence < 0.5
          ? Math.round((1 - transitionConfidence) * 8000) // up to 8s earlier when confidence=0
          : 0;

        if (transitionZone) {
          // Trigger inside the selected safe zone (or fallback zone), not at track end.
          const computedTriggerSec = Number.isFinite(transitionZone.triggerSec)
            ? transitionZone.triggerSec
            : transitionZone.zone.startSec;
          let triggerMs = computedTriggerSec * 1000 - confidenceBufferMs;
          let reason = transitionZone.type === 'breakdown'
            ? 'breakdown zone'
            : transitionZone.type === 'safe'
              ? 'safe zone'
              : transitionZone.type === 'gap'
                ? 'gap between problematic zones'
                : 'estimated transition window';

          if (confidenceBufferMs > 0) {
            reason += ` (−${Math.round(confidenceBufferMs / 1000)}s low-confidence buffer)`;
          }

          // Apply max duration constraint if set: trigger at max duration if before zone end
          if (maxDurationMs > 0 && triggerMs > maxDurationMs) {
            logger?.info?.('autoDj: max duration constraint applied (zone end after max)', {
              trackName: currentTrack.name,
              zoneEndMs: triggerMs,
              maxDurationMs,
            });
            triggerMs = maxDurationMs;
            reason += ' (capped by max duration)';

            // Strictly advance past high-energy / drop / tension / intro zones
            const resolvedDurMs = Math.max(currentTrack.duration || 0, getActualDurationMs?.() || 0);
            const advancedMs = advancePastMaxDurationBlock(triggerMs, mixData, resolvedDurMs);
            if (advancedMs !== triggerMs) {
              logger?.info?.('autoDj: max duration trigger advanced past strict-block zone', {
                trackName: currentTrack.name,
                from: triggerMs,
                to: advancedMs,
              });
              triggerMs = advancedMs;
              reason += ' (advanced past strict-block zone)';
            }
          }

          logger?.info?.('autoDj: calculated automix timing', {
            trackName: currentTrack.name,
            triggerMs,
            reason,
            triggerSec: computedTriggerSec,
            zoneStart: transitionZone.zone.startSec,
            zoneEnd: transitionZone.zone.endSec,
            transitionConfidence,
            confidenceBufferMs,
            maxDurationSec,
          });

          onAutomixTimingCalculated?.(triggerMs);
          planAutoFxEvents({
            currentTrack,
            mixData,
            triggerMs,
            maxDurationSec,
          });
          return;
        }

        logger?.debug?.('autoDj: no transition zone found');
        
        // Fallback: try to find any safe point avoiding problematic zones
        const allProblematicZones = [
          ...(mixData.avoidTransitionZones || []),
          ...(mixData.dropZones || []),
          ...(mixData.neverMissZones || []),
        ].sort((a, b) => a.startSec - b.startSec);

        if (allProblematicZones.length > 0) {
          // Try to find a gap before the first problematic zone
          const firstZone = allProblematicZones[0];
          if (firstZone.startSec > 10) {
            const safeTimeMs = Math.max(5000, (firstZone.startSec - 2) * 1000);
            logger?.info?.('autoDj: using fallback safe point before problematic zones', {
              trackName: currentTrack.name,
              triggerMs: safeTimeMs,
            });
            onAutomixTimingCalculated?.(safeTimeMs);
            planAutoFxEvents({
              currentTrack,
              mixData,
              triggerMs: safeTimeMs,
              maxDurationSec,
            });
            return;
          }
        }

        onAutomixTimingCalculated?.(-1);
        planAutoFxEvents({
          currentTrack,
          mixData,
          triggerMs: -1,
          maxDurationSec,
        });
      })
      .catch(err => {
        logger?.warn?.('autoDj: failed to fetch mix data for scheduling', {
          error: err?.message,
        });
        currentTrackMixData = null;
        onMixDataUpdated?.(null);
        // Fallback timing
        const rawMaxDurationSec = getTrackMaxDurationSec?.() || 0;
        const startOffsetMs = Math.max(0, Number(currentTrack.autoDjStartOffsetMs) || 0);
        const maxDurationSec = rawMaxDurationSec > 0 ? rawMaxDurationSec + startOffsetMs / 1000 : 0;
        const maxDurationMs = maxDurationSec > 0 ? maxDurationSec * 1000 : -1;
        
        const resolvedDurationMs = Math.max(currentTrack.duration || 0, getActualDurationMs?.() || 0);
        let triggerMs = Math.max(resolvedDurationMs - 20000, resolvedDurationMs * 0.75);
        if (maxDurationMs > 0) {
          triggerMs = Math.min(maxDurationMs, triggerMs);
        }
        
        onAutomixTimingCalculated?.(triggerMs);
        planAutoFxEvents({
          currentTrack,
          mixData: null,
          triggerMs,
          maxDurationSec,
        });
      });
  }

  /**
   * Build up to two previous-track references for suggestions API.
   * Supports mixed payload items (title string or { track, artist } object).
   */
  function buildSuggestionTrackReferences(currentTrack, queue, currentIndex) {
    if (!Array.isArray(queue) || !Number.isFinite(currentIndex) || currentIndex <= 0) {
      return [];
    }

    const references = [];
    const currentTrackId = currentTrack?.id || null;

    for (let i = currentIndex - 1; i >= 0 && references.length < 2; i--) {
      const item = queue[i];
      if (!item) continue;

      const itemId = item.id || item.ratingKey || item.uri || null;
      if (currentTrackId && itemId && itemId === currentTrackId) continue;

      const trackName = String(item.trackName || item.name || item.title || '').trim();
      const artistName = String(item.artistName || item.artist || '').trim();
      if (!trackName) continue;

      references.push(artistName
        ? { track: trackName, artist: artistName }
        : trackName);
    }

    return references;
  }

  function isTrackAlreadyQueued(queue, track) {
    if (!Array.isArray(queue) || !track) return false;
    const trackId = track.id || track.ratingKey || track.uri || null;
    const trackName = String(track.trackName || track.name || track.title || '').trim();
    const trackArtist = String(track.artistName || track.artist || '').trim();

    return queue.some((item) => {
      if (!item) return false;
      const itemId = item.id || item.ratingKey || item.uri || null;
      if (trackId && itemId && itemId === trackId) return true;
      return trackName && item.name === trackName && item.artist === trackArtist;
    });
  }

  /**
   * Search for recommendations and prepare next track
   */
  async function searchAndAddNextTrack(currentTrack, options = {}) {
    const force = options?.force === true;

    if (!autoModeEnabled) {
      logger?.debug?.('autoDj: disabled, skipping search');
      return false;
    }

    if (!currentTrack) {
      logger?.debug?.('autoDj: no current track, skipping search');
      return false;
    }

    if (!isSuggestionSearchEnabled()) {
      logger?.debug?.('autoDj: suggestion queue search disabled, skipping search');
      return false;
    }

    // Check if there's already a song queued after the current track
    const queue = getQueue();
    const currentIndex = Number(getCurrentTrackIndex?.()) || -1;
    if (!force && currentIndex >= 0 && currentIndex + 1 < queue.length) {
      logger?.debug?.('autoDj: next track already queued, skipping search', {
        currentIndex,
        queueLength: queue.length,
      });
      return false;
    }

    const filRougeManager = getFilRougeManager?.();
    if (filRougeManager?.isActive?.()) {
      const peekedFromFilRouge = filRougeManager.peekNextTrackFromAny?.();
      if (peekedFromFilRouge && !isTrackAlreadyQueued(queue, peekedFromFilRouge)) {
        // Only advance the index now that we know the track isn't already queued
        const nextFromFilRouge = filRougeManager.getNextTrack?.();
        if (nextFromFilRouge) {
          logger?.info?.('autoDj: using fil rouge track instead of searching', {
            currentTrackId: currentTrack.id,
            trackName: nextFromFilRouge.name,
            artistName: nextFromFilRouge.artist,
          });

          // Fetch mix data for the fil rouge track so zones are respected
          // (same flow as for auto-DJ suggested tracks)
          fetchMixData(
            nextFromFilRouge.name || nextFromFilRouge.trackName,
            nextFromFilRouge.artist || nextFromFilRouge.artistName
          )
            .then(mixData => {
              nextTrackMixData = mixData;
              const recommendedTransition = recommendTransitionType(currentTrackMixData, mixData);
              logger?.debug?.('autoDj: fil rouge recommended transition', { type: recommendedTransition });
            })
            .catch(err => {
              logger?.debug?.('autoDj: failed to prefetch fil rouge mix data', { error: err?.message });
            });

          await addToQueue(nextFromFilRouge, {
            source: 'fil-rouge',
            autoDjReferenceTrackId: currentTrack.id || null,
            showAddedToast: false,
          });

          pendingNextTrack = nextFromFilRouge;
          showToast?.(
            `🎶 Fil rouge: "${nextFromFilRouge.name || nextFromFilRouge.trackName || 'morceau'}" ajouté à la queue`,
            false
          );
          return true;
        }
      } else if (peekedFromFilRouge) {
        logger?.debug?.('autoDj: fil rouge track already queued, skipping', {
          currentTrackId: currentTrack.id,
          trackName: peekedFromFilRouge.name,
          artistName: peekedFromFilRouge.artist,
        });
      }
    }

    // Avoid too frequent searches
    const now = Date.now();
    if (!force && now - lastSearchTime < SEARCH_COOLDOWN_MS) {
      logger?.debug?.('autoDj: search cooldown active', {
        currentTrackId: currentTrack.id,
        elapsedMs: now - lastSearchTime,
        cooldownMs: SEARCH_COOLDOWN_MS,
      });
      return false;
    }

    // Avoid searching for the same track multiple times
    if (!force && lastSearchedTrackId === currentTrack.id) {
      logger?.debug?.('autoDj: already searched for this track', {
        currentTrackId: currentTrack.id,
        currentTrackName: currentTrack.name,
      });
      return false;
    }

    lastSearchedTrackId = currentTrack.id;
    lastSearchTime = now;

    try {
      logger?.info?.('autoDj: searching for recommendations', {
        trackName: currentTrack.name,
        artistName: currentTrack.artist,
      });

      let results = [];

      // Primary strategy: use dedicated suggestions endpoint from downloader API.
      try {
        const apiUrl = getDownloaderApiUrl();
        if (apiUrl && !apiHealthMonitor?.isOffline()) {
          const params = new URLSearchParams();
          const previousTrackReferences = buildSuggestionTrackReferences(currentTrack, queue, currentIndex);
          if (currentTrack.name) params.append('track', currentTrack.name);
          if (currentTrack.artist) params.append('artist', currentTrack.artist);
          if (previousTrackReferences.length > 0) {
            params.append('tracks', JSON.stringify(previousTrackReferences));
          }
          params.append('limit', '25');
          params.append('allowSameArtist', 'false');

          // DJ Mode: send additional hints to the suggestions API
          const djMode = getDjMode?.() || 'music';
          const currentBpm = toFiniteNumber(getCurrentBpm?.(), 0);
          const genrePrefs = getDjModeGenrePrefs?.() || [];

          if (djMode === 'dance') {
            if (currentBpm > 0) params.append('minBpm', String(Math.max(1, Math.round(currentBpm - 10))));
            params.append('preferDanceable', 'true');
            if (genrePrefs.length > 0) params.append('preferGenres', JSON.stringify(genrePrefs));
          } else {
            if (currentTrack.genre) params.append('preferGenre', currentTrack.genre);
            if (currentTrack.artist) params.append('preferArtist', currentTrack.artist);
            if (currentBpm > 0 && currentBpm < 90) {
              params.append('maxBpmJump', '30');
            }
          }

          const suggestionPathCandidates = ['/api/suggestions', '/suggestions'];
          for (const path of suggestionPathCandidates) {
            const suggestionUrl = appendApiToken(`${apiUrl}${path}?${params.toString()}`, getDownloaderApiToken?.());
            let suggestionRes;
            try {
              suggestionRes = await fetch(suggestionUrl, {
                method: 'GET',
                headers: { Accept: 'application/json' },
              });
            } catch (fetchErr) {
              apiHealthMonitor?.recordFailure();
              logger?.debug?.('autoDj: suggestions fetch network error', {
                path,
                error: fetchErr?.message,
              });
              break;
            }

            if (!suggestionRes.ok) {
              apiHealthMonitor?.recordFailure();
              logger?.debug?.('autoDj: suggestions endpoint unavailable', {
                path,
                status: suggestionRes.status,
              });
              continue;
            }

            apiHealthMonitor?.recordSuccess();
            const suggestionData = await suggestionRes.json().catch(() => null);
            const suggestionResults = Array.isArray(suggestionData?.results)
              ? suggestionData.results
              : [];

            // Keep API ordering but ensure score-first behavior when scores are present.
            results = [...suggestionResults].sort((a, b) => {
              const scoreA = Number.isFinite(Number(a?.similarityScore)) ? Number(a.similarityScore) : -1;
              const scoreB = Number.isFinite(Number(b?.similarityScore)) ? Number(b.similarityScore) : -1;
              return scoreB - scoreA;
            });

            logger?.debug?.('autoDj: suggestions results', {
              path,
              count: results.length,
              referenceTrack: currentTrack.name,
              referenceArtist: currentTrack.artist,
              referenceTracksCount: previousTrackReferences.length,
            });
            break;
          }
        }
      } catch (err) {
        logger?.warn?.('autoDj: suggestions fetch failed', {
          error: err?.message,
        });
      }

      // Fallback strategy: plain search without "similar" keyword.
      if (!results.length) {
        const query = [currentTrack.artist, currentTrack.name].filter(Boolean).join(' ').trim();
        results = await searchTracksViaApi(query);
      }

      if (!results || results.length === 0) {
        logger?.warn?.('autoDj: no search/suggestion results', {
          trackName: currentTrack.name,
          artistName: currentTrack.artist,
        });
        return false;
      }

      logger?.debug?.('autoDj: search returned results', { count: results.length });

      // DJ Mode: client-side reorder / filter
      const djModeForFilter = getDjMode?.() || 'music';
      const currentBpmForFilter = toFiniteNumber(getCurrentBpm?.(), 0);

      if (djModeForFilter === 'dance' && currentBpmForFilter > 0) {
        // Sort by BPM descending (higher BPM first) among results that have bpm
        results = [...results].sort((a, b) => {
          const bA = toFiniteNumber(a?.bpm, 0);
          const bB = toFiniteNumber(b?.bpm, 0);
          if (bA <= 0 && bB <= 0) return 0;
          if (bA <= 0) return 1;
          if (bB <= 0) return -1;
          return bB - bA;
        });
      } else if (djModeForFilter === 'music') {
        // Boost same genre/artist to top
        results = [...results].sort((a, b) => {
          const scoreA = (a?.genre && currentTrack.genre && String(a.genre).toLowerCase() === String(currentTrack.genre).toLowerCase() ? 2 : 0)
            + (a?.artist && currentTrack.artist && String(a.artist).toLowerCase() === String(currentTrack.artist).toLowerCase() ? 1 : 0);
          const scoreB = (b?.genre && currentTrack.genre && String(b.genre).toLowerCase() === String(currentTrack.genre).toLowerCase() ? 2 : 0)
            + (b?.artist && currentTrack.artist && String(b.artist).toLowerCase() === String(currentTrack.artist).toLowerCase() ? 1 : 0);
          return scoreB - scoreA;
        });
      }

      // Find first result that hasn't been played yet and isn't in queue
      const queueSnapshot = getQueue();
      const queueIds = new Set(queueSnapshot.flatMap(item => [item.id, item.ratingKey, item.uri].filter(Boolean)));

      // Build an exclusion fingerprint for the currently playing track.
      // The player removes the active track from the queue during playback, so a plain
      // queue lookup misses it — causing it to loop alternately on deck A and deck B.
      const currentTrackId1 = currentTrack?.id || null;
      const currentTrackId2 = currentTrack?.ratingKey || null;
      const currentTrackId3 = currentTrack?.uri || null;
      const currentTrackName = String(currentTrack?.name || currentTrack?.trackName || '').trim().toLowerCase();
      const currentTrackArtist = String(currentTrack?.artist || currentTrack?.artistName || '').trim().toLowerCase();

      let selectedTrack = null;
      let selectedIndex = -1;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        // Skip artist results
        if (result.isArtistResult) continue;

        const trackId = result.id || result.ratingKey || result.uri || result.name;
        const trackName = result.trackName || result.name || result.title || '';
        const artistName = result.artistName || result.artist || '';

        // Skip if already played (checking all ID variants via improved function).
        if (isTrackPlayed(trackId, result)) {
          logger?.debug?.('autoDj: skipping already-played track', {
            trackName,
            artistName,
          });
          continue;
        }

        // Skip if in queue
        if (queueIds.has(trackId)) {
          logger?.debug?.('autoDj: skipping queued track', {
            trackName,
            artistName,
          });
          continue;
        }

        // Skip if this result is the currently playing track (it may have been
        // removed from the queue by the player, so queueIds won't catch it).
        const resultName = trackName.trim().toLowerCase();
        const resultArtist = artistName.trim().toLowerCase();
        const isCurrentById =
          (currentTrackId1 && (trackId === currentTrackId1)) ||
          (currentTrackId2 && (trackId === currentTrackId2)) ||
          (currentTrackId3 && (trackId === currentTrackId3));
        const isCurrentByName =
          currentTrackName && resultName &&
          resultName === currentTrackName && resultArtist === currentTrackArtist;
        if (isCurrentById || isCurrentByName) {
          logger?.debug?.('autoDj: skipping currently playing track', { trackName, artistName });
          continue;
        }

        // Exclude the track currently on the active deck. When a crossfade completes the new
        // track is removed from the queue by the player, so queueIds won't catch it and
        // currentTrack (the finished deck) doesn't match it — causing a re-queue loop.
        if (currentlyPlayingTrack && currentlyPlayingTrack !== currentTrack) {
          const liveId1 = currentlyPlayingTrack.id || null;
          const liveId2 = currentlyPlayingTrack.ratingKey || null;
          const liveId3 = currentlyPlayingTrack.uri || null;
          const liveName = String(currentlyPlayingTrack.name || currentlyPlayingTrack.trackName || '').trim().toLowerCase();
          const liveArtist = String(currentlyPlayingTrack.artist || currentlyPlayingTrack.artistName || '').trim().toLowerCase();
          const isLiveById =
            (liveId1 && (trackId === liveId1 || result.id === liveId1 || result.ratingKey === liveId1 || result.uri === liveId1)) ||
            (liveId2 && (trackId === liveId2 || result.id === liveId2 || result.ratingKey === liveId2 || result.uri === liveId2)) ||
            (liveId3 && (trackId === liveId3 || result.id === liveId3 || result.ratingKey === liveId3 || result.uri === liveId3));
          const isLiveByName = liveName && resultName === liveName && resultArtist === liveArtist;
          if (isLiveById || isLiveByName) {
            logger?.debug?.('autoDj: skipping currently-on-deck track (crossfade loop guard)', {
              trackName,
              artistName,
              deckTrack: currentlyPlayingTrack.name,
            });
            continue;
          }
        }

        // LOOP DETECTION: Skip if this would create an infinite loop with the last played track
        if (wouldCreateLoopWithCurrentTrack(result, { 
          id: lastPlayedTrackIdVariants[0],
          ratingKey: lastPlayedTrackIdVariants[1],
          uri: lastPlayedTrackIdVariants[2],
          name: currentTrackName,
          artist: currentTrackArtist,
        })) {
          loopDetectionCounter++;
          logger?.warn?.('autoDj: LOOP DETECTED - skipping same track again', {
            trackName,
            artistName,
            loopCount: loopDetectionCounter,
            lastPlayedVariants: lastPlayedTrackIdVariants,
          });
          if (loopDetectionCounter > 1) {
            showToast?.(
              `🔄 AutoDJ: Boucle détectée sur "${trackName}" - passage forcé au suivant`,
              false
            );
          }
          continue;
        }

        // DJ Mode BPM filtering
        const resultBpm = toFiniteNumber(result?.bpm, 0);
        if (djModeForFilter === 'dance' && currentBpmForFilter > 0 && resultBpm > 0) {
          if (resultBpm < currentBpmForFilter - 15) {
            logger?.debug?.('autoDj: skipping low-BPM suggestion (dance mode)', {
              trackName,
              resultBpm,
              currentBpm: currentBpmForFilter,
            });
            showToast?.(`🕺 AutoDJ: "${trackName}" refusé (BPM trop bas: ${resultBpm})`, false);
            continue;
          }
        }
        if (djModeForFilter === 'music' && currentBpmForFilter > 0 && currentBpmForFilter < 90 && resultBpm > 0) {
          if (resultBpm > currentBpmForFilter + 30) {
            logger?.debug?.('autoDj: skipping high-BPM suggestion (music/slow mode)', {
              trackName,
              resultBpm,
              currentBpm: currentBpmForFilter,
            });
            continue;
          }
        }

        selectedTrack = {
          ...result,
          name: result.name || result.trackName || result.title || '',
          artist: result.artist || result.artistName || '',
          autoDjStartOffsetMs: extractSuggestedStartOffsetMs(result),
        };
        selectedIndex = i;
        loopDetectionCounter = 0; // Reset counter when we successfully select a different track
        break;
      }

      if (selectedTrack) {
        logger?.info?.('autoDj: adding recommended track', {
          name: selectedTrack.trackName || selectedTrack.name,
          artist: selectedTrack.artistName || selectedTrack.artist,
          selectedIndex,
        });

        // Fetch mix data for the recommended track
        fetchMixData(
          selectedTrack.trackName || selectedTrack.name,
          selectedTrack.artistName || selectedTrack.artist
        )
          .then(mixData => {
            nextTrackMixData = mixData;
            const recommendedTransition = recommendTransitionType(
              currentTrackMixData,
              mixData
            );
            logger?.debug?.('autoDj: recommended transition', { type: recommendedTransition });
          })
          .catch(err => {
            logger?.debug?.('autoDj: failed to prefetch next mix data', { error: err?.message });
          });

        await addToQueue(selectedTrack, {
          source: 'auto-dj',
          autoDjReferenceTrackId: currentTrack.id || null,
          showAddedToast: false,
        });
        pendingNextTrack = selectedTrack;

        showToast?.(
          `🤖 AutoDJ: "${selectedTrack.trackName || selectedTrack.name}" queued`,
          false
        );
        return true;
      } else {
        logger?.warn?.('autoDj: no unplayed tracks found in results');
        return false;
      }
    } catch (err) {
      logger?.error?.('autoDj: search failed', {
        error: err?.message,
        currentTrackName: currentTrack.name,
      });
      return false;
    }
  }

  /**
   * Called when a track finishes playing
   * Marks it as played and triggers search for next track
   */
  function onTrackFinished(finishedTrack) {
    if (!finishedTrack) return;

    clearAutomixTimer();
    markTrackAsPlayed(finishedTrack.id, finishedTrack);
    // Store all ID variants for loop detection
    lastPlayedTrackIdVariants = [
      finishedTrack.id,
      finishedTrack.ratingKey,
      finishedTrack.uri,
    ].filter(Boolean);
    currentTrackMixData = null;
    onMixDataUpdated?.(null);
    pendingNextTrack = null;
    nextTrackMixData = null;
    pendingAutoFxEvents = [];
    loopDetectionCounter = 0; // Reset counter for next track

    logger?.debug?.('autoDj: track finished, searching for next', {
      trackName: finishedTrack.name,
      trackId: finishedTrack.id,
      playHistorySize: playHistory.size,
    });

    // Search with a slight delay to allow queue state to update
    setTimeout(() => {
      searchAndAddNextTrack(finishedTrack).catch(err => {
        logger?.error?.('autoDj: onTrackFinished error', { error: err?.message });
      });
    }, 500);
  }

  /**
   * Initialize the auto DJ manager
   * Should be called at app startup
   */
  function initialize() {
    loadSettings();
    logger?.info?.('autoDj: initialized', { enabled: autoModeEnabled });
  }

  /**
   * Clean up for logout
   */
  function reset() {
    clearAutomixTimer();
    playHistory.clear();
    lastSearchedTrackId = null;
    lastSearchTime = 0;
    currentTrackMixData = null;
    onMixDataUpdated?.(null);
    pendingNextTrack = null;
    nextTrackMixData = null;
    pendingAutoFxEvents = [];
    lastPlayedTrackIdVariants = [];
    loopDetectionCounter = 0;
    currentlyPlayingTrack = null;
    MIX_DATA_CACHE.clear();
    autoModeEnabled = false;
    saveSettings();
    logger?.debug?.('autoDj: reset');
  }

  /**
   * Add the pending next track (already found during timing calculation) to queue
   * Returns true if track was added, false otherwise
   */
  async function addPendingTrackToQueue() {
    const queue = getQueue();
    const currentIndex = Number(getCurrentTrackIndex?.()) || 0;
    const hasImmediateNextTrack = currentIndex >= 0 && (currentIndex + 1) < queue.length;

    if (!pendingNextTrack) {
      logger?.debug?.('autoDj: no pending track to add', { hasImmediateNextTrack });
      return hasImmediateNextTrack;
    }

    const pendingId = pendingNextTrack.id || pendingNextTrack.ratingKey || pendingNextTrack.uri || pendingNextTrack.name;
    const pendingName = pendingNextTrack.trackName || pendingNextTrack.name || pendingNextTrack.title || '';
    const pendingArtist = pendingNextTrack.artistName || pendingNextTrack.artist || '';
    const alreadyQueued = queue.some((item) => {
      if (!item) return false;
      if (pendingId && item.id === pendingId) return true;
      return item.name === pendingName && item.artist === pendingArtist;
    });

    if (alreadyQueued) {
      logger?.debug?.('autoDj: pending track already in queue', {
        name: pendingName,
        artist: pendingArtist,
      });
      pendingNextTrack = null;
      return true;
    }

    try {
      logger?.info?.('autoDj: adding pending track to queue', {
        name: pendingNextTrack.trackName || pendingNextTrack.name,
        artist: pendingNextTrack.artistName || pendingNextTrack.artist,
      });

      await addToQueue(pendingNextTrack, {
        source: 'auto-dj',
        autoDjReferenceTrackId: getCurrentTrackId?.() || null,
        showAddedToast: false,
      });
      pendingNextTrack = null;
      return true;
    } catch (err) {
      logger?.error?.('autoDj: failed to add pending track', {
        error: err?.message,
      });
      return false;
    }
  }

  return {
    // State
    isAutoModeEnabled: () => autoModeEnabled,
    toggleAutoMode,
    isTrackPlayed,
    markTrackAsPlayed,

    // Mix data access
    getCurrentTrackMixData: () => currentTrackMixData,
    getNextTrackMixData: () => nextTrackMixData,
    getPendingNextTrack: () => pendingNextTrack,
    getPendingAutoFxEvents: () => [...pendingAutoFxEvents],
    peekNextAutoFxEvent: (afterMs) => {
      const threshold = toFiniteNumber(afterMs, 0);
      for (let i = 0; i < pendingAutoFxEvents.length; i++) {
        if (pendingAutoFxEvents[i]?.timeMs > threshold) return pendingAutoFxEvents[i];
      }
      return null;
    },

    // Zone validation
    isInAvoidZone,
    isInDropZone,
    isValidTransitionZone,
    advancePastMaxDurationBlock,

    // Main functionality
    searchAndAddNextTrack,
    addPendingTrackToQueue,
    scheduleAutomixTiming,
    consumeReadyAutoFxEvents,
    onTrackFinished,
    isSuggestionSearchEnabled,
    setSuggestionSearchEnabled,
    fetchMixData,
    findBestTransitionZone,
    recommendTransitionType,

    // Lifecycle
    initialize,
    reset,
  };
}

function extractSuggestedStartOffsetMs(result) {
  if (!result || typeof result !== 'object') return 0;

  const numberLikeToMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    // Heuristic: values under 1000 are likely seconds.
    return numeric < 1000 ? Math.round(numeric * 1000) : Math.round(numeric);
  };

  const directCandidates = [
    result.autoDjStartOffsetMs,
    result.startOffsetMs,
    result.startTimeMs,
    result.startMs,
    result.offsetMs,
    result.entryPointMs,
    result.cueInMs,
    result.mixStartMs,
    result.startSec,
    result.startTimeSec,
    result.startSeconds,
    result.offsetSec,
    result.entryPointSec,
    result.cueInSec,
    result.mixStartSec,
  ];

  for (const candidate of directCandidates) {
    const ms = numberLikeToMs(candidate);
    if (ms > 0) return ms;
  }

  const nestedCandidates = [
    result.mixSuggestion,
    result.suggestion,
    result.mix,
    result.transition,
    result.recommendation,
    result.meta,
  ];

  for (const nested of nestedCandidates) {
    if (!nested || typeof nested !== 'object') continue;
    const nestedMs = extractSuggestedStartOffsetMs(nested);
    if (nestedMs > 0) return nestedMs;
  }

  return 0;
}

export default createAutoModeManager;

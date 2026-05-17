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
 * @property {Object} indicators
 */

export function createAutoModeManager({
  getDownloaderApiUrl,
  getQueue,
  getCurrentTrackId,
  getCurrentTrackIndex,
  searchTracksViaApi,
  addToQueue,
  showToast,
  logger,
  getTrackMaxDurationSec,
  getAutoFxMinGapMs,
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
  
  const SEARCH_COOLDOWN_MS = 5000; // Minimum time between searches
  const MIX_DATA_CACHE = new Map(); // Cache mix data per track
  const AUTO_FX_LAST_WINDOW_MINUTES = 2; // X minutes mentioned by user requirement
  const AUTO_FX_MAX_IN_LAST_WINDOW = 2;
  const AUTO_FX_MIN_GAP_MS = 14000;

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

  function enforceAutoFxDensity(events, effectiveEndMs) {
    if (!Array.isArray(events) || events.length === 0) return [];
    const minGapMs = Math.max(
      1000,
      toFiniteNumber(getAutoFxMinGapMs?.(), AUTO_FX_MIN_GAP_MS),
    );

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

    const lastWindowMs = AUTO_FX_LAST_WINDOW_MINUTES * 60 * 1000;
    const tailStartMs = Math.max(0, effectiveEndMs - lastWindowMs);
    const outsideTail = spaced.filter((event) => event.timeMs < tailStartMs);
    const inTail = spaced
      .filter((event) => event.timeMs >= tailStartMs)
      .sort((a, b) => {
        const pa = AUTO_FX_PRIORITY[a.type] || 0;
        const pb = AUTO_FX_PRIORITY[b.type] || 0;
        if (pb !== pa) return pb - pa;
        return a.timeMs - b.timeMs;
      })
      .slice(0, AUTO_FX_MAX_IN_LAST_WINDOW)
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
    const minGapMs = Math.max(
      1000,
      toFiniteNumber(getAutoFxMinGapMs?.(), AUTO_FX_MIN_GAP_MS),
    );

    const addEvent = (type, preferredMs, reason) => {
      const timeMs = Math.round(Math.max(6000, Math.min(timelineMaxMs, preferredMs)));
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
   * Fetch mix analysis data from API for a track
   */
  async function fetchMixData(trackName, artistName) {
    if (!trackName) return null;

    const cacheKey = `${trackName}|${artistName || ''}`;
    if (MIX_DATA_CACHE.has(cacheKey)) {
      logger?.debug?.('autoDj: mix data from cache', { trackName, artistName });
      return MIX_DATA_CACHE.get(cacheKey);
    }

    try {
      const apiUrl = getDownloaderApiUrl();
      if (!apiUrl) return null;

      const params = new URLSearchParams();
      params.append('track', trackName);
      if (artistName) params.append('artist', artistName);

      const response = await fetch(`${apiUrl}/mix?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        logger?.debug?.('autoDj: mix data fetch failed', {
          status: response.status,
          trackName,
        });
        return null;
      }

      const data = await response.json();
      const mixData = data?.mix || null;

      if (mixData) {
        MIX_DATA_CACHE.set(cacheKey, mixData);
      }

      logger?.debug?.('autoDj: mix data fetched', {
        trackName,
        hasSafeZones: !!mixData?.safeTransitionZones?.length,
        durationSec: mixData?.durationSec,
      });

      return mixData;
    } catch (err) {
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
    
    return true;
  }

  /**
   * Find best safe transition zone in a track.
   * - If targetSec is provided, pick zone closest to that target (max duration case).
   * - Otherwise prefer a safe zone close to track end, but still before the end.
   */
  function findBestTransitionZone(mixData, options = {}) {
    if (!mixData) return null;

    const durationSec = Number(mixData.durationSec) || 0;
    const requestedTargetSec = Number(options.targetSec);
    const hasTarget = Number.isFinite(requestedTargetSec) && requestedTargetSec > 0;
    const fallbackEndTargetSec = durationSec > 0
      ? Math.max(0, durationSec - 8)
      : 0;
    const targetSec = hasTarget ? requestedTargetSec : fallbackEndTargetSec;

    const clampToZone = (valueSec, zone) => {
      if (!zone) return valueSec;
      const startSec = Number(zone.startSec) || 0;
      const endSec = Number(zone.endSec) || startSec;
      return Math.min(endSec, Math.max(startSec, valueSec));
    };

    const zoneDistanceToTarget = (zone) => {
      if (!zone) return Infinity;
      const startSec = Number(zone.startSec) || 0;
      const endSec = Number(zone.endSec) || startSec;
      if (targetSec < startSec) return startSec - targetSec;
      if (targetSec > endSec) return targetSec - endSec;
      return 0;
    };

    const scoreCandidateZones = (zones = [], type) => {
      let best = null;
      let bestDistance = Infinity;

      for (const zone of zones) {
        if (!isValidTransitionZone(zone, mixData)) {
          logger?.debug?.('autoDj: skipping invalid zone', {
            type,
            startSec: zone.startSec,
            endSec: zone.endSec,
            inAvoid: isInAvoidZone(zone.startSec, mixData),
            inDrop: isInDropZone(zone.startSec, mixData),
          });
          continue;
        }

        const distance = zoneDistanceToTarget(zone);
        if (distance < bestDistance) {
          best = zone;
          bestDistance = distance;
        }
      }

      if (!best) return null;

      return {
        zone: best,
        type,
        mixData,
        triggerSec: clampToZone(targetSec, best),
      };
    };

    // Prefer safeTransitionZones for AutoDJ timing.
    const safeCandidate = scoreCandidateZones(mixData.safeTransitionZones, 'safe');
    if (safeCandidate) return safeCandidate;

    // If no safeTransitionZone exists, fallback to breakdown zones.
    const breakdownCandidate = scoreCandidateZones(mixData.breakdownZones, 'breakdown');
    if (breakdownCandidate) return breakdownCandidate;

    // Fallback: suggest transition window, avoiding problematic zones
    if (mixData.indicators?.transitionWindowHintSec) {
      const hint = mixData.indicators.transitionWindowHintSec;
      const idealStart = Math.max(
        mixData.probableSongStartSec + mixData.durationSec - hint.ideal,
        mixData.probableSongStartSec + mixData.durationSec * 0.6
      );

      // Verify fallback zone is valid
      const fallbackZone = { startSec: idealStart, endSec: idealStart + hint.ideal };
      if (isValidTransitionZone(fallbackZone, mixData)) {
        return {
          zone: fallbackZone,
          type: 'estimated',
          mixData,
          triggerSec: clampToZone(targetSec, fallbackZone),
        };
      }
    }

    // As last resort, try to find a gap between avoid/drop zones
    logger?.debug?.('autoDj: no valid transition zones found, attempting to find gap');
    const allProblematicZones = [
      ...(mixData.avoidTransitionZones || []),
      ...(mixData.dropZones || []),
    ].sort((a, b) => a.startSec - b.startSec);

    if (allProblematicZones.length > 0) {
      // Try to find a gap before the first problematic zone
      const firstZone = allProblematicZones[0];
      if (firstZone.startSec > 10) {
        const gapZone = {
          startSec: Math.max(1, firstZone.startSec - 5),
          endSec: Math.min(firstZone.startSec, firstZone.startSec - 1),
        };
        if (gapZone.endSec > gapZone.startSec) {
          logger?.debug?.('autoDj: using gap before first problematic zone', {
            startSec: gapZone.startSec,
            endSec: gapZone.endSec,
          });
          return {
            zone: gapZone,
            type: 'gap',
            mixData,
            triggerSec: clampToZone(targetSec, gapZone),
          };
        }
      }
    }

    return null;
  }

  /**
   * Recommend transition type based on track characteristics
   * Considers drop zones and avoid zones to pick the most appropriate transition
   */
  function recommendTransitionType(currentMixData, nextMixData) {
    // Check if next track has drops coming - use filter to preserve energy
    if (nextMixData?.dropZones?.length && nextMixData.dropZones[0].startSec < 10) {
      return 'filter_sweep_high_to_low'; // Smooth filter sweep before the drop
    }

    // If next track has a clear breakdown at start, use crossfade to it
    if (nextMixData?.breakdownZones?.length && nextMixData.breakdownZones[0].startSec < 5) {
      return 'crossfade_logarithmic';
    }

    // If current track has drop zones ending soon, want smooth transition out
    if (currentMixData?.dropZones?.length) {
      const lastDrop = currentMixData.dropZones[currentMixData.dropZones.length - 1];
      if (lastDrop && lastDrop.endSec < currentMixData.durationSec - 5) {
        return 'filter_sweep_low_high'; // Restore energy after drop
      }
    }

    // Check if we're transitioning from breakdown zone - can be more aggressive
    if (currentMixData?.breakdownZones?.length) {
      const lastBreakdown = currentMixData.breakdownZones[currentMixData.breakdownZones.length - 1];
      if (lastBreakdown && lastBreakdown.endSec < currentMixData.durationSec - 2) {
        return 'crossfade_linear'; // Standard crossfade works well after breakdown
      }
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
   * Mark a track as played
   */
  function markTrackAsPlayed(trackId) {
    if (trackId) {
      playHistory.add(trackId);
      saveSettings();
      logger?.debug?.('autoDj: track marked as played', { trackId });
    }
  }

  /**
   * Check if track has already been played
   */
  function isTrackPlayed(trackId) {
    return trackId && playHistory.has(trackId);
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

  /**
   * Schedule automix to trigger at optimal moment
   * Called when a new track is added to queue
   */
  function scheduleAutomixTiming(currentTrack) {
    if (!autoModeEnabled || !currentTrack) return;

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

        const maxDurationSec = getTrackMaxDurationSec?.() || 0;
        const maxDurationMs = maxDurationSec > 0 ? maxDurationSec * 1000 : -1;

        if (!mixData) {
          logger?.debug?.('autoDj: no mix data available, using duration-based timing');
          
          // If max duration is set, use it as constraint
          if (maxDurationMs > 0) {
            const triggerMs = Math.min(maxDurationMs, Math.max(
              currentTrack.duration - 20000,
              currentTrack.duration * 0.75
            ));
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
            currentTrack.duration - 20000,
            currentTrack.duration * 0.75
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
        if (transitionZone) {
          // Trigger inside the selected safe zone (or fallback zone), not at track end.
          const computedTriggerSec = Number.isFinite(transitionZone.triggerSec)
            ? transitionZone.triggerSec
            : transitionZone.zone.startSec;
          let triggerMs = computedTriggerSec * 1000;
          let reason = transitionZone.type === 'breakdown'
            ? 'breakdown zone'
            : transitionZone.type === 'safe'
              ? 'safe zone'
              : transitionZone.type === 'gap'
                ? 'gap between problematic zones'
                : 'estimated transition window';

          // Apply max duration constraint if set: trigger at max duration if before zone end
          if (maxDurationMs > 0 && triggerMs > maxDurationMs) {
            logger?.info?.('autoDj: max duration constraint applied (zone end after max)', {
              trackName: currentTrack.name,
              zoneEndMs: triggerMs,
              maxDurationMs,
            });
            triggerMs = maxDurationMs;
            reason += ' (capped by max duration)';
          }

          logger?.info?.('autoDj: calculated automix timing', {
            trackName: currentTrack.name,
            triggerMs,
            reason,
            triggerSec: computedTriggerSec,
            zoneStart: transitionZone.zone.startSec,
            zoneEnd: transitionZone.zone.endSec,
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
        const maxDurationSec = getTrackMaxDurationSec?.() || 0;
        const maxDurationMs = maxDurationSec > 0 ? maxDurationSec * 1000 : -1;
        
        let triggerMs = Math.max(currentTrack.duration - 20000, currentTrack.duration * 0.75);
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
        if (apiUrl) {
          const params = new URLSearchParams();
          const previousTrackReferences = buildSuggestionTrackReferences(currentTrack, queue, currentIndex);
          if (currentTrack.name) params.append('track', currentTrack.name);
          if (currentTrack.artist) params.append('artist', currentTrack.artist);
          if (previousTrackReferences.length > 0) {
            params.append('tracks', JSON.stringify(previousTrackReferences));
          }
          params.append('limit', '25');
          params.append('allowSameArtist', 'false');

          const suggestionPathCandidates = ['/api/suggestions', '/suggestions'];
          for (const path of suggestionPathCandidates) {
            const suggestionUrl = `${apiUrl}${path}?${params.toString()}`;
            const suggestionRes = await fetch(suggestionUrl, {
              method: 'GET',
              headers: { Accept: 'application/json' },
            });

            if (!suggestionRes.ok) {
              logger?.debug?.('autoDj: suggestions endpoint unavailable', {
                path,
                status: suggestionRes.status,
              });
              continue;
            }

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

      // Find first result that hasn't been played yet and isn't in queue
      const queueSnapshot = getQueue();
      const queueIds = new Set(queueSnapshot.map(item => item.id));

      let selectedTrack = null;
      let selectedIndex = -1;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        // Skip artist results
        if (result.isArtistResult) continue;

        const trackId = result.id || result.ratingKey || result.uri || result.name;
        const trackName = result.trackName || result.name || result.title || '';
        const artistName = result.artistName || result.artist || '';

        // Skip if already played or in queue
        if (isTrackPlayed(trackId) || queueIds.has(trackId)) {
          logger?.debug?.('autoDj: skipping already-played track', {
            trackName,
            artistName,
          });
          continue;
        }

        selectedTrack = {
          ...result,
          name: result.name || result.trackName || result.title || '',
          artist: result.artist || result.artistName || '',
          autoDjStartOffsetMs: extractSuggestedStartOffsetMs(result),
        };
        selectedIndex = i;
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
    markTrackAsPlayed(finishedTrack.id);
    currentTrackMixData = null;
    onMixDataUpdated?.(null);
    pendingNextTrack = null;
    nextTrackMixData = null;
    pendingAutoFxEvents = [];

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

    // Zone validation
    isInAvoidZone,
    isInDropZone,
    isValidTransitionZone,

    // Main functionality
    searchAndAddNextTrack,
    addPendingTrackToQueue,
    scheduleAutomixTiming,
    consumeReadyAutoFxEvents,
    onTrackFinished,
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

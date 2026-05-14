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
  onAutomixTimingCalculated,
}) {
  let autoModeEnabled = false;
  let playHistory = new Set(); // Track IDs of songs that have been played
  let lastSearchedTrackId = null;
  let lastSearchTime = 0;
  let currentTrackMixData = null;
  let pendingNextTrack = null;
  let nextTrackMixData = null;
  let automixTimerHandle = null;
  
  const SEARCH_COOLDOWN_MS = 5000; // Minimum time between searches
  const MIX_DATA_CACHE = new Map(); // Cache mix data per track

  // Load settings and history from localStorage
  function loadSettings() {
    try {
      autoModeEnabled = localStorage.getItem(AUTO_MODE_KEY) === '1';
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
   * Find best safe transition zone in a track
   * Prefer breakdown zones, then other safe zones
   */
  function findBestTransitionZone(mixData) {
    if (!mixData) return null;

    // Prefer breakdown zones (they're natural stopping points)
    if (mixData.breakdownZones?.length) {
      // Choose the breakdown zone closest to 2/3 of the track
      const optimalTime = mixData.durationSec * 0.67;
      let best = mixData.breakdownZones[0];
      let bestDiff = Math.abs(best.startSec - optimalTime);

      for (const zone of mixData.breakdownZones) {
        const diff = Math.abs(zone.startSec - optimalTime);
        if (diff < bestDiff) {
          best = zone;
          bestDiff = diff;
        }
      }
      return { zone: best, type: 'breakdown', mixData };
    }

    // Then use general safe transition zones
    if (mixData.safeTransitionZones?.length) {
      const optimalTime = mixData.durationSec * 0.67;
      let best = mixData.safeTransitionZones[0];
      let bestDiff = Math.abs(best.startSec - optimalTime);

      for (const zone of mixData.safeTransitionZones) {
        const diff = Math.abs(zone.startSec - optimalTime);
        if (diff < bestDiff) {
          best = zone;
          bestDiff = diff;
        }
      }
      return { zone: best, type: 'safe', mixData };
    }

    // Fallback: suggest transition window
    if (mixData.indicators?.transitionWindowHintSec) {
      const hint = mixData.indicators.transitionWindowHintSec;
      const idealStart = Math.max(
        mixData.probableSongStartSec + mixData.durationSec - hint.ideal,
        mixData.probableSongStartSec + mixData.durationSec * 0.6
      );
      return {
        zone: { startSec: idealStart, endSec: idealStart + hint.ideal },
        type: 'estimated',
        mixData,
      };
    }

    return null;
  }

  /**
   * Recommend transition type based on track characteristics
   */
  function recommendTransitionType(currentMixData, nextMixData) {
    // If next track has a clear breakdown at start, use crossfade to it
    if (nextMixData?.breakdownZones?.length && nextMixData.breakdownZones[0].startSec < 5) {
      return 'crossfade_logarithmic';
    }

    // If current track has drop zones, might want to fade before that
    if (currentMixData?.dropZones?.length) {
      return 'filter_sweep_low_high';
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

    logger?.debug?.('autoDj: scheduling automix timing for', {
      trackName: currentTrack.name,
      durationMs: currentTrack.duration,
    });

    // Fetch mix data for current track
    fetchMixData(currentTrack.name, currentTrack.artist)
      .then(mixData => {
        currentTrackMixData = mixData;

        if (!mixData) {
          logger?.debug?.('autoDj: no mix data available, using duration-based timing');
          // Fallback: trigger 20s before end
          const triggerMs = Math.max(
            currentTrack.duration - 20000,
            currentTrack.duration * 0.75
          );
          logger?.debug?.('autoDj: calculated fallback timing', { triggerMs });
          onAutomixTimingCalculated?.(triggerMs);
          return;
        }

        const transitionZone = findBestTransitionZone(mixData);
        if (transitionZone) {
          const triggerMs = transitionZone.zone.startSec * 1000;
          const reason = transitionZone.type === 'breakdown'
            ? 'breakdown zone'
            : transitionZone.type === 'safe'
              ? 'safe zone'
              : 'estimated transition window';

          logger?.info?.('autoDj: calculated automix timing', {
            trackName: currentTrack.name,
            triggerMs,
            reason,
            zoneStart: transitionZone.zone.startSec,
            zoneEnd: transitionZone.zone.endSec,
          });

          onAutomixTimingCalculated?.(triggerMs);
          return;
        }

        logger?.debug?.('autoDj: no transition zone found');
        onAutomixTimingCalculated?.(-1);
      })
      .catch(err => {
        logger?.warn?.('autoDj: failed to fetch mix data for scheduling', {
          error: err?.message,
        });
        // Fallback timing
        const triggerMs = Math.max(currentTrack.duration - 20000, currentTrack.duration * 0.75);
        onAutomixTimingCalculated?.(triggerMs);
      });
  }

  /**
   * Search for recommendations and prepare next track
   */
  async function searchAndAddNextTrack(currentTrack) {
    if (!autoModeEnabled) {
      logger?.debug?.('autoDj: disabled, skipping search');
      return;
    }

    if (!currentTrack) {
      logger?.debug?.('autoDj: no current track, skipping search');
      return;
    }

    // Avoid too frequent searches
    const now = Date.now();
    if (now - lastSearchTime < SEARCH_COOLDOWN_MS) {
      logger?.debug?.('autoDj: search cooldown active');
      return;
    }

    // Avoid searching for the same track multiple times
    if (lastSearchedTrackId === currentTrack.id) {
      logger?.debug?.('autoDj: already searched for this track');
      return;
    }

    lastSearchedTrackId = currentTrack.id;
    lastSearchTime = now;

    try {
      logger?.info?.('autoDj: searching for recommendations', {
        trackName: currentTrack.name,
        artistName: currentTrack.artist,
      });

      // Search using current track artist and "similar" query
      const query = `${currentTrack.artist} similar`;
      const results = await searchTracksViaApi(query);

      if (!results || results.length === 0) {
        logger?.warn?.('autoDj: no search results', { query });
        return;
      }

      logger?.debug?.('autoDj: search returned results', { count: results.length });

      // Find first result that hasn't been played yet and isn't in queue
      const queue = getQueue();
      const queueIds = new Set(queue.map(item => item.id));

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

        selectedTrack = result;
        selectedIndex = i;
        break;
      }

      if (selectedTrack) {
        logger?.info?.('autoDj: adding recommended track', {
          name: selectedTrack.trackName || selectedTrack.name,
          artist: selectedTrack.artistName || selectedTrack.artist,
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

        await addToQueue(selectedTrack);
        pendingNextTrack = selectedTrack;

        showToast?.(
          `🤖 AutoDJ: "${selectedTrack.trackName || selectedTrack.name}" queued`,
          false
        );
      } else {
        logger?.warn?.('autoDj: no unplayed tracks found in results');
      }
    } catch (err) {
      logger?.error?.('autoDj: search failed', {
        error: err?.message,
        currentTrackName: currentTrack.name,
      });
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
    pendingNextTrack = null;
    nextTrackMixData = null;

    logger?.debug?.('autoDj: track finished, searching for next', {
      trackName: finishedTrack.name,
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
    pendingNextTrack = null;
    nextTrackMixData = null;
    MIX_DATA_CACHE.clear();
    autoModeEnabled = false;
    saveSettings();
    logger?.debug?.('autoDj: reset');
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

    // Main functionality
    searchAndAddNextTrack,
    scheduleAutomixTiming,
    onTrackFinished,
    fetchMixData,
    findBestTransitionZone,
    recommendTransitionType,

    // Lifecycle
    initialize,
    reset,
  };
}

export default createAutoModeManager;

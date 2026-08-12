import { uiState } from './uiState.js';
import { resetAutomixTimeline } from './automixTimeline.js';
import { computeDjBpmRate } from './djTransitionMapping.js';

/**
 * Manages deck assignment, stem enrichment, start-offset resolution, and
 * the two core playback entry-points: `startPlaybackForIndex` and
 * `launchDeckFromQueue`.
 *
 * @param {object} options
 * @param {() => object|null} options.getPlayer
 * @param {() => object[]} options.getQueue
 * @param {() => string} options.getDjMode
 * @param {() => number|null} options.getActiveDeckBpm
 * @param {() => 'A'|'B'} options.getResolvedActiveDeck
 * @param {() => 'A'|'B'} options.getResolvedInactiveDeck
 * @param {(idx: number, opts?: object) => number} options.getFollowingQueueIndex
 * @param {(item: object) => void} options.touchQueueItem
 * @param {(idx: number) => void} options.removeFromQueue
 * @param {(idx: number) => void} options.prefetchNext
 * @param {(track: object) => number} options.resolveTrackStartOffsetMs
 * @param {(item: object, deck: 'A'|'B') => Promise<void>} options.preloadMixDataForDeckItem
 * @param {(item: object) => Promise<string>} options.ensureLocalSource
 * @param {(item: object, deck: 'A'|'B') => Promise<void>} options.fetchAndStoreArtworkForItem
 * @param {(item: object) => Promise<void>} options.enrichStemsFromServer
 * @param {(fn: Function) => void} options.enqueueBackgroundTask
 * @param {object} options.filRougeManager
 * @param {object} options.djPlanManager
 * @param {() => boolean} options.getDjExternalPlanEnabled
 * @param {object} options.autoModeManager
 * @param {() => boolean} options.getAutoSuggestionQueueSearchEnabled
 * @param {object} options.automixTimeline  mutable timeline state object
 * @param {() => void} options.renderQueue
 * @param {() => void} options.renderFilRouge
 * @param {(item: object, deck: 'A'|'B') => void} options.updateNowPlaying
 * @param {() => void} options.updatePlannedStartMarker
 * @param {() => void} options.updateUpcomingArtwork
 * @param {() => void} options.suggestGenreFromCurrentTrack
 * @param {(mode: string, bpm: number|null) => void} options.applyDjModeFxPreset
 * @param {(fn: Function, delay?: number) => void} options.scheduleIdle
 * @param {() => void} options.trimRetainedAudioSources
 * @param {() => boolean} options.isLowMemoryPlaybackMode
 * @param {(msg: string, isError?: boolean) => void} options.showToast
 * @param {(event: string, payload?: object) => void} options.logInfo
 * @param {(event: string, payload?: object) => void} options.logDebug
 * @param {(event: string, payload?: object) => void} options.logWarn
 * @param {(event: string, payload?: object) => void} options.logError
 * @param {(ratio: number, ms?: number) => void} options.applyDeckMixRatio
 * @param {() => void} options.updateAutoDjMarker
 * @param {() => void} options.updateMaxDurationMarker
 * @param {() => void} options.applyTrackMaxDurationForCurrentPlayback
 * @param {() => void} options.resetTrackCaches
 * @param {(item: object) => Promise<void>} options.fetchMissingMeta
 * @param {() => void} options.refreshDeckMetaDisplays
 * @param {() => void} options.updateDeckCueUI
 * @param {() => object|null} options.getPendingFilRougeOnInactiveDeck
 * @param {(item: object|null) => void} options.setPendingFilRougeOnInactiveDeck
 * @param {HTMLElement|null} [options.deckAstemsIndicator]
 * @param {HTMLElement|null} [options.deckBstemsIndicator]
 * @param {HTMLElement|null} [options.autoMixBtn]
 * @param {(item: object, index: number) => void} [options.onTrackStarted]
 * @param {{ isOffline: () => boolean }} [options.apiHealthMonitor] - si hors ligne au moment
 *   d'un échec de lecture, le morceau n'est pas retiré du Fil Rouge (panne transitoire).
 */
export function createPlaybackController(options) {
  const {
    getPlayer,
    getQueue,
    getDjMode,
    getActiveDeckBpm,
    getResolvedActiveDeck,
    getResolvedInactiveDeck,
    getFollowingQueueIndex,
    touchQueueItem,
    removeFromQueue,
    prefetchNext,
    resolveTrackStartOffsetMs,
    preloadMixDataForDeckItem,
    ensureLocalSource,
    fetchAndStoreArtworkForItem,
    enrichStemsFromServer,
    enqueueBackgroundTask,
    filRougeManager,
    djPlanManager,
    getDjExternalPlanEnabled,
    autoModeManager,
    getAutoSuggestionQueueSearchEnabled,
    automixTimeline,
    renderQueue,
    renderFilRouge,
    updateNowPlaying,
    updatePlannedStartMarker,
    updateUpcomingArtwork,
    suggestGenreFromCurrentTrack,
    applyDjModeFxPreset,
    scheduleIdle,
    trimRetainedAudioSources,
    isLowMemoryPlaybackMode,
    showToast,
    logInfo,
    logDebug,
    logWarn,
    logError,
    applyDeckMixRatio,
    updateAutoDjMarker,
    updateMaxDurationMarker,
    applyTrackMaxDurationForCurrentPlayback,
    resetTrackCaches,
    fetchMissingMeta,
    refreshDeckMetaDisplays,
    updateDeckCueUI,
    getPendingFilRougeOnInactiveDeck,
    setPendingFilRougeOnInactiveDeck,
    deckAstemsIndicator = null,
    deckBstemsIndicator = null,
    autoMixBtn = null,
    onTrackStarted,
    apiHealthMonitor = null,
  } = options;

  // ── Private state ─────────────────────────────────────────────────────────────

  const stemsLoadedPerDeck = { A: false, B: false };

  // Preview state for the upcoming track during crossfade
  let launchPreviewActive = false;
  let launchPreviewArtUrl = '';
  let launchPreviewTitle = '';
  let launchPreviewArtist = '';
  let launchPreviewDeck = null;
  let launchPreviewItem = null;

  // ── Stem button state ─────────────────────────────────────────────────────────

  function updateStemButtonState(deck) {
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const stemsAvailable = stemsLoadedPerDeck[safeDeck] || false;
    if (safeDeck === 'A') {
      if (deckAstemsIndicator) deckAstemsIndicator.hidden = !stemsAvailable;
    } else {
      if (deckBstemsIndicator) deckBstemsIndicator.hidden = !stemsAvailable;
    }
  }

  // ── setDeckItem ───────────────────────────────────────────────────────────────

  function setDeckItem(deck, item) {
    const safeDeck = deck === 'B' ? 'B' : 'A';
    uiState.deckDisplayItems[safeDeck] = item ?? null;

    const hasStemsInCache = !!(
      item?.localStemUrls?.vocalsUrl || item?.localStemUrls?.instrumentalUrl ||
      item?.stems?.vocalsUrl || item?.stems?.instrumentalUrl
    );
    stemsLoadedPerDeck[safeDeck] = hasStemsInCache;
    updateStemButtonState(safeDeck);

    if (item) fetchMissingMeta?.(item).catch(() => {});
    refreshDeckMetaDisplays?.();
    updateDeckCueUI?.();
  }

  // ── backgroundEnrichStems ─────────────────────────────────────────────────────

  function backgroundEnrichStems(deck, item) {
    if (!item || !deck) return;

    const existingStems = item.localStemUrls || item.stems;
    if (existingStems?.vocalsUrl && existingStems?.instrumentalUrl) {
      const player = getPlayer?.();
      if (uiState.deckDisplayItems[deck] === item) {
        stemsLoadedPerDeck[deck] = true;
        updateStemButtonState(deck);
        player?.updateDeckStems(deck, existingStems);
      }
      return;
    }

    enqueueBackgroundTask?.(() => enrichStemsFromServer?.(item)
      .then(() => {
        const stems = item.localStemUrls || item.stems;
        if (!stems?.vocalsUrl && !stems?.instrumentalUrl && !stems?.echoUrl && !stems?.distortionUrl) return;
        if (uiState.deckDisplayItems[deck] !== item) return;

        stemsLoadedPerDeck[deck] = Boolean(stems?.vocalsUrl || stems?.instrumentalUrl);
        updateStemButtonState(deck);

        const player = getPlayer?.();
        player?.updateDeckStems(deck, stems);
        logDebug?.('stems.enriched.deck', {
          deck,
          id: item?.id,
          hasVocals: !!stems.vocalsUrl,
          hasInstrumental: !!stems.instrumentalUrl,
          hasEcho: !!stems.echoUrl,
          hasDistortion: !!stems.distortionUrl,
        });
      })
      .catch((err) => {
        logWarn?.('stems.enrichment.error', { deck, id: item?.id, error: err?.message });
      })
    );
  }

  // ── resolveMixDataStartOffsetMs ───────────────────────────────────────────────

  function resolveMixDataStartOffsetMs(mixData) {
    if (!mixData || typeof mixData !== 'object') return 0;

    const toFiniteNumber = (value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const recommendedSongStartSec = toFiniteNumber(mixData.recommendedSongStartSec);
    const probableStartSec = toFiniteNumber(mixData.probableSongStartSec);
    const hasProbableStart = probableStartSec != null && probableStartSec > 0;

    let recommendedSec = 0;
    if (recommendedSongStartSec != null && recommendedSongStartSec > 0) {
      recommendedSec = recommendedSongStartSec;
    } else if (hasProbableStart) {
      recommendedSec = probableStartSec;
    }

    const explicitOffsetMs = resolveTrackStartOffsetMs?.(mixData) ?? 0;
    if (explicitOffsetMs > 0) {
      recommendedSec = Math.max(recommendedSec, explicitOffsetMs / 1000);
    }

    const startRec = mixData.startRecommendation && typeof mixData.startRecommendation === 'object'
      ? mixData.startRecommendation
      : null;

    const introLooksSlow = startRec != null
      ? Boolean(startRec.introLooksSlow)
      : hasProbableStart && probableStartSec >= 6;

    const introDanceability = toFiniteNumber(startRec?.introDanceability);
    const laterDanceabilityPeak = toFiniteNumber(startRec?.laterDanceabilityPeak);
    const startRecConfidence = toFiniteNumber(startRec?.confidence) ?? 1;

    const indicators = mixData.indicators && typeof mixData.indicators === 'object'
      ? mixData.indicators
      : null;

    const introDanceabilityFallback = introDanceability ?? toFiniteNumber(
      indicators?.introDanceability
      ?? indicators?.openingDanceability
      ?? indicators?.startDanceability
      ?? indicators?.danceabilityIntro
    );
    const introEnergy = toFiniteNumber(
      indicators?.introEnergy
      ?? indicators?.openingEnergy
      ?? indicators?.startEnergy
      ?? indicators?.energyIntro
    );

    const sortedPeakZones = Array.isArray(mixData.peakZones)
      ? [...mixData.peakZones]
        .filter((zone) => Number.isFinite(Number(zone?.startSec)))
        .sort((a, b) => Number(a.startSec) - Number(b.startSec))
      : [];

    const firstPeakZone = sortedPeakZones[0] || null;
    const firstPeakStartSec = Number(firstPeakZone?.startSec);
    const hasPeak = Number.isFinite(firstPeakStartSec) && firstPeakStartSec > 0;
    const firstPeakScore = toFiniteNumber(firstPeakZone?.score);

    const isDanceMode = getDjMode?.() === 'dance';
    const introDanceabilityThreshold = isDanceMode ? 0.55 : 0.45;
    const introEnergyThreshold = isDanceMode ? 0.5 : 0.4;

    const introLooksWeak = startRec != null && startRecConfidence >= 0.5
      ? introLooksSlow || (introDanceability != null && introDanceability <= introDanceabilityThreshold)
      : (
        (introDanceabilityFallback != null && introDanceabilityFallback <= introDanceabilityThreshold)
        || (introEnergy != null && introEnergy <= introEnergyThreshold)
        || (hasProbableStart && probableStartSec >= 6)
      );

    const peakMinOffset = isDanceMode ? 4 : 8;
    const peakIsLateEnough = hasPeak
      && firstPeakStartSec >= Math.max(10, (hasProbableStart ? probableStartSec : 0) + peakMinOffset)
      && (firstPeakScore == null || firstPeakScore >= 0.25);

    if (introLooksWeak && laterDanceabilityPeak != null && laterDanceabilityPeak > 0) {
      if (peakIsLateEnough) recommendedSec = Math.max(recommendedSec, firstPeakStartSec);
    } else if (introLooksWeak && peakIsLateEnough) {
      recommendedSec = Math.max(recommendedSec, firstPeakStartSec);
    }

    if (isDanceMode) {
      const introBpm = toFiniteNumber(startRec?.introBpm);
      const firstCoupletSec = toFiniteNumber(startRec?.firstCoupletSec);
      const introEnergyProfile = startRec?.introEnergyProfile;

      const currentBpm = getActiveDeckBpm?.() ?? 0;
      const introBpmTooLow = introBpm != null && currentBpm > 0 && introBpm < currentBpm - 3;
      const introProfileWeak = introEnergyProfile === 'flat' || introEnergyProfile === 'ambient';

      if (introBpmTooLow || introProfileWeak) {
        const targetSec = (firstCoupletSec != null && firstCoupletSec > 0)
          ? firstCoupletSec
          : hasPeak
            ? firstPeakStartSec
            : (probableStartSec ?? 0);
        if (targetSec > 0) recommendedSec = Math.max(recommendedSec, targetSec);
      }
    }

    // Empty intro detection: if no breakdown/drop/peak/avoidTransition zone starts
    // before 15s, skip to the first such zone.
    const EMPTY_INTRO_THRESHOLD_SEC = 15;
    const allSignificantZones = [
      ...(Array.isArray(mixData.breakdownZones) ? mixData.breakdownZones : []),
      ...(Array.isArray(mixData.dropZones) ? mixData.dropZones : []),
      ...(Array.isArray(mixData.peakZones) ? mixData.peakZones : []),
      ...(Array.isArray(mixData.avoidTransitionZones) ? mixData.avoidTransitionZones : []),
    ]
      .filter((z) => Number.isFinite(Number(z?.startSec)) && Number(z.startSec) > 0)
      .sort((a, b) => Number(a.startSec) - Number(b.startSec));

    if (allSignificantZones.length > 0) {
      const firstZoneStartSec = Number(allSignificantZones[0].startSec);
      const hasZoneBeforeThreshold = allSignificantZones.some(
        (z) => Number(z.startSec) < EMPTY_INTRO_THRESHOLD_SEC,
      );
      if (!hasZoneBeforeThreshold) {
        const durationSec = toFiniteNumber(mixData.durationSec);
        const safeLimit = durationSec != null && durationSec > 30 ? durationSec - 30 : Infinity;
        if (firstZoneStartSec <= safeLimit) {
          recommendedSec = Math.max(recommendedSec, firstZoneStartSec);
        }
      }
    }

    const durationSec = toFiniteNumber(mixData.durationSec);
    if (durationSec != null && durationSec > 0 && recommendedSec > durationSec * 0.5) {
      return 0;
    }

    if (!Number.isFinite(recommendedSec) || recommendedSec <= 0) return 0;
    return Math.round(recommendedSec * 1000);
  }

  // ── applyMixSuggestedStartOffset ──────────────────────────────────────────────

  function applyMixSuggestedStartOffset(item, mixData, opts = {}) {
    if (!item || !mixData) return false;

    const { overrideExisting = false } = opts;
    const existingOffsetMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
    if (existingOffsetMs > 0 && !overrideExisting) return false;

    const suggestedOffsetMs = resolveMixDataStartOffsetMs(mixData);
    if (suggestedOffsetMs <= 0) return false;

    const durationMs = Math.max(0, Number(item.duration) || 0);
    if (durationMs > 0 && suggestedOffsetMs > durationMs * 0.5) return false;

    const cappedOffsetMs = durationMs > 0
      ? Math.max(0, Math.min(suggestedOffsetMs, Math.max(0, durationMs - 1000)))
      : Math.max(0, suggestedOffsetMs);

    if (cappedOffsetMs <= 0 || cappedOffsetMs === existingOffsetMs) return false;

    item.autoDjStartOffsetMs = cappedOffsetMs;
    touchQueueItem?.(item);
    logInfo?.('autoDj: start offset updated from mix data', {
      id: item.id, name: item.name, artist: item.artist, startOffsetMs: cappedOffsetMs,
    });
    return true;
  }

  // ── applyDjStartOffsetIfPlanned ───────────────────────────────────────────────

  function applyDjStartOffsetIfPlanned(item, plan) {
    if (!item || !plan) return false;
    if (!Number.isFinite(plan.mixInSec) || plan.mixInSec < 0) return false;

    const suggestedOffsetMs = Math.round(plan.mixInSec * 1000);
    const existingOffsetMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
    const durationMs = Math.max(0, Number(item.duration) || 0);
    if (durationMs > 0 && suggestedOffsetMs > durationMs * 0.5) return false;

    const cappedOffsetMs = durationMs > 0
      ? Math.max(0, Math.min(suggestedOffsetMs, Math.max(0, durationMs - 1000)))
      : Math.max(0, suggestedOffsetMs);

    if (cappedOffsetMs <= 0 || cappedOffsetMs === existingOffsetMs) return false;

    item.autoDjStartOffsetMs = cappedOffsetMs;
    touchQueueItem?.(item);
    logInfo?.('djPlan: start offset applied', {
      id: item.id, name: item.name, artist: item.artist,
      startOffsetMs: cappedOffsetMs, decisionId: plan.decisionId,
    });
    return true;
  }

  // ── Shared launch-preview helpers ─────────────────────────────────────────────

  function _setLaunchPreview(item, deck) {
    launchPreviewActive = true;
    launchPreviewArtUrl = item?.artUrl || '';
    launchPreviewTitle = item?.name || '';
    launchPreviewArtist = item?.artist || '';
    launchPreviewDeck = deck;
    launchPreviewItem = item;
  }

  function _clearLaunchPreview() {
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
    launchPreviewItem = null;
  }

  // ── launchDeckFromQueue ───────────────────────────────────────────────────────

  async function launchDeckFromQueue(deck, opts = {}) {
    const player = getPlayer?.();
    if (!player) return;

    const queue = getQueue?.() ?? [];

    if (!queue.length) {
      if (filRougeManager?.isActive()) {
        const nextFromFilRouge = filRougeManager.getNextTrack();
        if (nextFromFilRouge) {
          const filRougeItem = {
            id: nextFromFilRouge.id || `filrouge-${Date.now()}`,
            uri: nextFromFilRouge.persistedSourceUrl || '',
            name: nextFromFilRouge.name || 'Inconnu',
            artist: nextFromFilRouge.artist || 'Artiste inconnu',
            artUrl: nextFromFilRouge.artUrl || '',
            duration: nextFromFilRouge.duration || 0,
            bpm: nextFromFilRouge.bpm || null,
            genre: nextFromFilRouge.genre || '',
            cachePath: nextFromFilRouge.cachePath || '',
            persistedSourceUrl: nextFromFilRouge.persistedSourceUrl || '',
            ratingKey: nextFromFilRouge.ratingKey || '',
            stemsStatus: nextFromFilRouge.stemsStatus || '',
            stems: nextFromFilRouge.stems || null,
            sourceState: 'idle',
            sourceError: null,
            sourceMeta: null,
            localBlobUrl: null,
            queueSource: 'fil-rouge',
            lastTouchedAt: Date.now(),
          };
          queue.push(filRougeItem);
          uiState.currentIndex = 0;
          uiState.currentTrackId = filRougeItem.id;
          renderQueue?.();
          renderFilRouge?.();
        }
      }
      if (!queue.length) {
        showToast?.('Ajoutez une chanson dans la file', true);
        return;
      }
    }

    const targetDeck = deck === 'B' ? 'B' : 'A';
    const fallbackIndex = uiState.currentIndex >= 0 && queue[uiState.currentIndex]
      ? uiState.currentIndex
      : 0;
    const inactiveDeck = getResolvedInactiveDeck?.();

    if (targetDeck === inactiveDeck && getPendingFilRougeOnInactiveDeck?.()) {
      setPendingFilRougeOnInactiveDeck?.(null);
    }

    const deckItemIndex = uiState.deckDisplayItems[targetDeck]
      ? queue.findIndex((q) => q.id === uiState.deckDisplayItems[targetDeck]?.id)
      : -1;

    let targetIndex = fallbackIndex;
    if (opts.useCue === true && uiState.deckBCueIndex >= 0 && queue[uiState.deckBCueIndex]) {
      targetIndex = uiState.deckBCueIndex;
    } else if (deckItemIndex >= 0) {
      targetIndex = deckItemIndex;
    } else if (targetDeck === inactiveDeck) {
      targetIndex = getFollowingQueueIndex?.(fallbackIndex) ?? -1;
    }
    if (targetIndex < 0) targetIndex = fallbackIndex;

    const item = queue[targetIndex];
    if (!item) return;

    logInfo?.('launchDeckFromQueue(): deck load requested', {
      deck: targetDeck, targetIndex, currentIndex: uiState.currentIndex,
      itemId: item.id, itemName: item.name, options: opts,
    });

    try {
      await preloadMixDataForDeckItem?.(item, targetDeck);
      setDeckItem(targetDeck, item);
      updatePlannedStartMarker?.();
      const sourceUrl = await ensureLocalSource?.(item);

      // SPEC-1.1.17 : preloadMixDataForDeckItem/ensureLocalSource sont asynchrones
      // (téléchargement possible) — la platine visée a pu entretemps devenir active
      // en jouant déjà ce morceau (via un vrai crossfade concurrent). Abandonner pour
      // ne jamais recharger/mettre en pause un morceau déjà en cours de lecture réelle.
      if (uiState.deckDisplayItems[targetDeck] !== item || uiState.currentTrackId === item.id) {
        logWarn?.('launchDeckFromQueue(): stale deck target aborted', {
          deck: targetDeck,
          targetIndex,
          itemId: item.id,
          itemName: item.name,
          currentTrackId: uiState.currentTrackId,
        });
        return;
      }

      const isFocusDeck = targetDeck === getResolvedActiveDeck?.();
      const paused = typeof opts.paused === 'boolean' ? opts.paused : !isFocusDeck;
      await player.playOnDeck(targetDeck, {
        url: sourceUrl,
        loudnessDb: item.loudnessDb,
        bpm: item.bpm,
        durationMs: item.duration,
        audioFeatures: item.audioFeatures,
        stems: item.stems,
        startPositionMs: Math.max(0, Number(item.autoDjStartOffsetMs) || 0),
      }, { makeActive: false, paused });

      if (isFocusDeck) {
        uiState.currentIndex = targetIndex;
        uiState.currentTrackId = item.id;
        updateNowPlaying?.(item, targetDeck);
        fetchAndStoreArtworkForItem?.(item, targetDeck).catch(() => {});
        uiState.isPlaying = true;
        _clearLaunchPreview();
        prefetchNext?.(getFollowingQueueIndex?.(targetIndex) ?? -1);
        applyDjModeFxPreset?.(getDjMode?.(), item.bpm ?? null);
        suggestGenreFromCurrentTrack?.();
        autoModeManager?.scheduleAutomixTiming(item);
        if (getAutoSuggestionQueueSearchEnabled?.()) {
          scheduleIdle?.(() => {
            autoModeManager?.searchAndAddNextTrack(item).catch((err) => {
              logWarn?.('autoDj: search on launchDeckFromQueue failed', { error: err?.message });
            });
          }, 3000);
        }
      } else {
        _setLaunchPreview(item, targetDeck);
        uiState.deckCueDeck = targetDeck;
        updateUpcomingArtwork?.();
        if (!item.artUrl) {
          fetchAndStoreArtworkForItem?.(item, targetDeck).then(() => {
            if (launchPreviewItem === item) {
              launchPreviewArtUrl = item.artUrl || '';
              updateUpcomingArtwork?.();
            }
          }).catch(() => {});
        }
      }
      renderQueue?.();
      logInfo?.('launchDeckFromQueue(): deck loaded', {
        deck: targetDeck, itemId: item.id, isFocusDeck, paused,
      });
      trimRetainedAudioSources?.();
    } catch (err) {
      logError?.('launchDeckFromQueue(): failed', {
        deck: targetDeck, targetIndex, itemId: item.id, message: err?.message,
      });
      showToast?.(`API: ${err.message}`, true);
    }
  }

  // ── startPlaybackForIndex ─────────────────────────────────────────────────────

  async function startPlaybackForIndex(index, mode, opts = {}) {
    const player = getPlayer?.();
    const queue = getQueue?.() ?? [];
    const item = queue[index];
    if (!item || !player) return;

    let startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
    const targetDeck = opts.targetDeck || ((mode === 'play' || mode === 'switch')
      ? getResolvedActiveDeck?.()
      : getResolvedInactiveDeck?.());

    logInfo?.('startPlaybackForIndex(): begin', {
      index, mode, targetDeck,
      currentIndex: uiState.currentIndex,
      currentTrackId: uiState.currentTrackId,
      itemId: item.id, itemName: item.name,
    });

    if (mode === 'crossfade' && uiState.currentTrackId && item.id !== uiState.currentTrackId) {
      _setLaunchPreview(item, targetDeck);
    } else {
      _clearLaunchPreview();
    }
    updateUpcomingArtwork?.();

    setPendingFilRougeOnInactiveDeck?.(null);

    try {
      touchQueueItem?.(item);
      setDeckItem(targetDeck, item);
      if (mode === 'play') setDeckItem(targetDeck === 'A' ? 'B' : 'A', null);
      updateNowPlaying?.(item, targetDeck);
      fetchAndStoreArtworkForItem?.(item, targetDeck).catch(() => {});

      const djExternalPlanEnabled = getDjExternalPlanEnabled?.() ?? false;
      const djPlan = djExternalPlanEnabled ? djPlanManager?.getDjTransitionPlan(item) : null;

      if (djPlan?.mixInSecDefined) {
        startPositionMs = Math.max(0, Math.round((djPlan.mixInSec || 0) * 1000));
        item.autoDjStartOffsetMs = startPositionMs;
        touchQueueItem?.(item);
        logInfo?.('djPlan: mixInSec exact appliqué', {
          id: item.id, name: item.name, startOffsetMs: startPositionMs, decisionId: djPlan.decisionId,
        });
      } else if (djExternalPlanEnabled && !djPlan) {
        const filRougeItem = filRougeManager?.getPlaylist().find((p) => String(p.id) === String(item.id));
        if (filRougeItem?.djTrackId) {
          const openingCueMs = djPlanManager?.getOpeningCueOffsetMs(filRougeItem.djTrackId) ?? 0;
          if (openingCueMs > 0) {
            startPositionMs = openingCueMs;
            item.autoDjStartOffsetMs = startPositionMs;
            touchQueueItem?.(item);
            logInfo?.('djPlan: openingCue appliqué', {
              id: item.id, name: item.name, startOffsetMs: startPositionMs,
              djTrackId: filRougeItem.djTrackId,
            });
          }
        }
      }

      const mixPreloadPromise = preloadMixDataForDeckItem?.(item, targetDeck);
      if (startPositionMs <= 0) {
        await Promise.race([
          mixPreloadPromise,
          new Promise((resolve) => setTimeout(resolve, 700)),
        ]);
        startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
      }

      updatePlannedStartMarker?.();

      const sourceUrl = await ensureLocalSource?.(item);
      logDebug?.('startPlaybackForIndex(): source resolved', {
        index, mode, targetDeck,
        sourcePreview: String(sourceUrl || '').slice(0, 80),
        sourceState: item.sourceState,
        sourceMeta: item.sourceMeta,
      });

      if ((mode === 'autofade' || mode === 'crossfade') && item.sourceState !== 'ready') {
        logWarn?.('startPlaybackForIndex(): crossfade starting with source not ready', {
          index, mode, targetDeck, id: item.id, name: item.name, sourceState: item.sourceState,
        });
      }

      let djRateApplied = false;
      if (djPlan?.recommendedBpm && player.autoBpm) {
        const djRate = computeDjBpmRate(djPlan.recommendedBpm, item.bpm);
        if (djRate != null) {
          player.setDeckPlaybackRate(targetDeck, djRate);
          djRateApplied = true;
          logDebug?.('djPlan: bpm rate applied', {
            targetDeck, rate: djRate, recommendedBpm: djPlan.recommendedBpm, trackBpm: item.bpm,
          });
        }
      }
      if (!djRateApplied) player.resetDeckPlaybackRate(targetDeck);

      const djModeOverridden = Boolean(djPlan?.mode && djPlan.mode !== player.transitionMode);
      if (djModeOverridden) {
        player.setTransitionMode(djPlan.mode);
        logDebug?.('djPlan: transition mode override', { mode: djPlan.mode, decisionId: djPlan.decisionId });
      }

      const savedCrossfadeDuration = player.crossfadeDuration;
      const djCrossfadeMs = Number.isFinite(djPlan?.crossfadeDurationSec) && djPlan.crossfadeDurationSec > 0
        ? Math.round(djPlan.crossfadeDurationSec * 1000)
        : 0;
      if (djCrossfadeMs > 0) {
        player.crossfadeDuration = djCrossfadeMs;
        logDebug?.('djPlan: crossfade duration override', { crossfadeMs: djCrossfadeMs, decisionId: djPlan.decisionId });
      }

      const trackPayload = {
        url: sourceUrl,
        loudnessDb: item.loudnessDb,
        bpm: item.bpm,
        durationMs: item.duration,
        audioFeatures: item.audioFeatures,
        stems: item.stems,
      };

      let crossfadePerformed = true;
      try {
        if (mode === 'autofade' || mode === 'crossfade') {
          crossfadePerformed = await player.crossfadeToDeck(targetDeck, trackPayload, { startPositionMs });
        } else if (mode === 'switch') {
          await player.playOnDeck(getResolvedActiveDeck?.(), trackPayload, { makeActive: true, paused: false, startPositionMs });
        } else {
          await player.playOnDeck(getResolvedActiveDeck?.(), trackPayload, { makeActive: true, paused: false, startPositionMs });
        }
      } finally {
        if (djCrossfadeMs > 0) player.crossfadeDuration = savedCrossfadeDuration;
        if (djModeOverridden) player.setTransitionMode(player._previousTransitionMode ?? 'auto');
      }

      // SPEC-1.2.5 : crossfadeToDeck() renvoie false si un autre crossfade était déjà en
      // cours — aucune piste n'a alors réellement changé sur les platines. Ne jamais
      // synchroniser uiState/la file sur un morceau qui n'est pas devenu audible.
      if ((mode === 'autofade' || mode === 'crossfade') && crossfadePerformed === false) {
        logWarn?.('startPlaybackForIndex(): crossfade skipped, another crossfade already in progress', {
          index, mode, targetDeck, itemId: item.id, itemName: item.name,
        });
        _clearLaunchPreview();
        renderQueue?.();
        return;
      }

      uiState.currentIndex = index;
      uiState.currentTrackId = item.id;

      if ((mode === 'autofade' || mode === 'crossfade') && player) {
        const newRatio = targetDeck === 'B' ? 1 : 0;
        applyDeckMixRatio?.(newRatio, 0);
      }

      if ((mode === 'autofade' || mode === 'crossfade') && player) {
        const inactiveDeck = getResolvedInactiveDeck?.();
        const nextIndex = getFollowingQueueIndex?.(index, { wrap: false }) ?? -1;
        const nextItem = nextIndex >= 0 ? queue[nextIndex] : null;

        if (nextItem) {
          logDebug?.('startPlaybackForIndex(): preparing inactive deck with next track', {
            inactiveDeck, nextIndex, nextItemId: nextItem.id, nextItemName: nextItem.name,
          });
          setDeckItem(inactiveDeck, nextItem);
          updatePlannedStartMarker?.();
          fetchAndStoreArtworkForItem?.(nextItem, inactiveDeck).catch(() => {});
          const nextMixPreload = preloadMixDataForDeckItem?.(nextItem, inactiveDeck);
          ensureLocalSource?.(nextItem).then(async (nextUrl) => {
            if (!getPlayer?.()) return;
            await nextMixPreload?.catch(() => {});
            // SPEC-1.1.16 : la préparation est asynchrone (téléchargement possible) —
            // re-valider la cible juste avant le chargement pour ne jamais toucher
            // une platine devenue active ni dupliquer le morceau courant.
            if (getResolvedInactiveDeck?.() !== inactiveDeck
              || uiState.deckDisplayItems[inactiveDeck] !== nextItem
              || uiState.currentTrackId === nextItem.id) {
              logWarn?.('startPlaybackForIndex(): stale next-track preload aborted', {
                inactiveDeck,
                resolvedInactiveDeck: getResolvedInactiveDeck?.(),
                nextItemId: nextItem.id,
                currentTrackId: uiState.currentTrackId,
              });
              return;
            }
            const nextStartPositionMs = Math.max(0, Number(nextItem.autoDjStartOffsetMs) || 0);
            await getPlayer?.()?.playOnDeck(inactiveDeck, {
              url: nextUrl,
              loudnessDb: nextItem.loudnessDb,
              bpm: nextItem.bpm,
              durationMs: nextItem.duration,
              audioFeatures: nextItem.audioFeatures,
              stems: nextItem.stems,
            }, { paused: true, startPositionMs: nextStartPositionMs });
            renderQueue?.();
          }).catch(() => {});
        } else if (filRougeManager?.isActive() && !isLowMemoryPlaybackMode?.()) {
          const peekedFilRouge = filRougeManager.peekNextTrackFromAny();
          if (peekedFilRouge) {
            const ghostItem = {
              id: peekedFilRouge.id || `filrouge-ghost-${Date.now()}`,
              uri: peekedFilRouge.persistedSourceUrl || '',
              name: peekedFilRouge.name || 'Inconnu',
              artist: peekedFilRouge.artist || 'Artiste inconnu',
              artUrl: peekedFilRouge.artUrl || '',
              duration: peekedFilRouge.duration || 0,
              bpm: peekedFilRouge.bpm || null,
              genre: peekedFilRouge.genre || '',
              cachePath: peekedFilRouge.cachePath || '',
              persistedSourceUrl: peekedFilRouge.persistedSourceUrl || '',
              ratingKey: peekedFilRouge.ratingKey || '',
              stemsStatus: peekedFilRouge.stemsStatus || '',
              stems: peekedFilRouge.stems || null,
              sourceState: 'idle',
              sourceError: null,
              sourceMeta: null,
              localBlobUrl: null,
              queueSource: 'fil-rouge',
              lastTouchedAt: Date.now(),
            };
            setDeckItem(inactiveDeck, ghostItem);
            setPendingFilRougeOnInactiveDeck?.(ghostItem);
            updatePlannedStartMarker?.();
            logDebug?.('startPlaybackForIndex(): preloading fil rouge ghost on inactive deck', {
              inactiveDeck, ghostId: ghostItem.id, ghostName: ghostItem.name,
            });
            fetchAndStoreArtworkForItem?.(ghostItem, inactiveDeck).catch(() => {});
            const ghostMixPreload = preloadMixDataForDeckItem?.(ghostItem, inactiveDeck);
            ensureLocalSource?.(ghostItem).then(async (ghostUrl) => {
              if (!getPlayer?.() || getPendingFilRougeOnInactiveDeck?.() !== ghostItem) return;
              await ghostMixPreload?.catch(() => {});
              const ghostStartMs = Math.max(0, Number(ghostItem.autoDjStartOffsetMs) || 0);
              // SPEC-1.1.16 : re-valider la cible après la préparation asynchrone.
              if (getPendingFilRougeOnInactiveDeck?.() !== ghostItem
                || getResolvedInactiveDeck?.() !== inactiveDeck
                || uiState.deckDisplayItems[inactiveDeck] !== ghostItem) {
                logWarn?.('startPlaybackForIndex(): stale fil rouge ghost preload aborted', {
                  inactiveDeck,
                  resolvedInactiveDeck: getResolvedInactiveDeck?.(),
                  ghostId: ghostItem.id,
                });
                return;
              }
              await getPlayer?.()?.playOnDeck(inactiveDeck, {
                url: ghostUrl,
                loudnessDb: ghostItem.loudnessDb,
                bpm: ghostItem.bpm,
                durationMs: ghostItem.duration,
                audioFeatures: ghostItem.audioFeatures,
                stems: ghostItem.stems,
              }, { paused: true, startPositionMs: ghostStartMs });
              renderQueue?.();
            }).catch(() => {
              if (getPendingFilRougeOnInactiveDeck?.() === ghostItem) {
                setPendingFilRougeOnInactiveDeck?.(null);
                setDeckItem(inactiveDeck, null);
              }
            });
          }
        }
      }

      uiState.isPlaying = true;
      prefetchNext?.(getFollowingQueueIndex?.(index, { wrap: false }) ?? -1);
      _clearLaunchPreview();
      renderQueue?.();

      logInfo?.('startPlaybackForIndex(): done', {
        mode, index,
        currentIndex: uiState.currentIndex,
        currentTrackId: uiState.currentTrackId,
        targetDeck,
        isPlaying: uiState.isPlaying,
      });

      trimRetainedAudioSources?.();
      resetAutomixTimeline(automixTimeline, targetDeck);
      resetTrackCaches?.();
      applyTrackMaxDurationForCurrentPlayback?.();
      updateAutoDjMarker?.();
      updateMaxDurationMarker?.();
      autoModeManager?.scheduleAutomixTiming(item);
      onTrackStarted?.(item, index);
      if (getAutoSuggestionQueueSearchEnabled?.()) {
        scheduleIdle?.(() => {
          autoModeManager?.searchAndAddNextTrack(item).catch((err) => {
            logWarn?.('autoDj: search on track start failed', { error: err?.message });
          });
        }, 3000);
      }
    } catch (err) {
      item.sourceState = 'error';
      item.sourceError = err.message;
      _clearLaunchPreview();
      renderQueue?.();
      logError?.('startPlaybackForIndex(): failed', {
        mode, index, targetDeck, itemId: item.id, message: err?.message,
      });
      showToast?.(`API: ${err.message}`, true);

      const failedIdx = queue.findIndex((q) => q.id === item.id);
      if (failedIdx >= 0) removeFromQueue?.(failedIdx);
      // Une panne API est transitoire : le morceau n'est pas retiré du fil rouge
      // dans ce cas (il redeviendra téléchargeable une fois l'API revenue), contrairement
      // à un échec réel (piste introuvable/corrompue) qui, lui, justifie un retrait.
      if (!apiHealthMonitor?.isOffline() && filRougeManager?.isActive()) {
        const pq = filRougeManager.getPriorityQueue();
        const pqIdx = pq.findIndex((t) => t.id === item.id);
        if (pqIdx >= 0) filRougeManager.removeFromPriorityQueue(pqIdx);
        const pl = filRougeManager.getPlaylist();
        const plIdx = pl.findIndex((t) => t.id === item.id);
        if (plIdx >= 0) filRougeManager.removeFromPlaylist(plIdx);
      }
      setTimeout(() => autoMixBtn?.click?.(), 400);
      throw err;
    }
  }

  // ── Getters for preview state (used by UI) ────────────────────────────────────

  function getLaunchPreviewState() {
    return {
      active: launchPreviewActive,
      artUrl: launchPreviewArtUrl,
      title: launchPreviewTitle,
      artist: launchPreviewArtist,
      deck: launchPreviewDeck,
      item: launchPreviewItem,
    };
  }

  function getStemsLoadedPerDeck() {
    return { ...stemsLoadedPerDeck };
  }

  return {
    setDeckItem,
    backgroundEnrichStems,
    resolveMixDataStartOffsetMs,
    applyMixSuggestedStartOffset,
    applyDjStartOffsetIfPlanned,
    launchDeckFromQueue,
    startPlaybackForIndex,
    getLaunchPreviewState,
    getStemsLoadedPerDeck,
  };
}

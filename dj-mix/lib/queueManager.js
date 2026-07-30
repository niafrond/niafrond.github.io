import { uiState } from './uiState.js';
import {
  getBestArtworkUrl,
  getTrackDurationMs,
  extractStemSourceUrls,
  extractAudioFeatures,
  extractTrackBpm,
  extractTrackGenre,
  extractTrackLoudnessDb,
} from './searchUtils.js';
import { getDirectPlayableSourceUrl, getTrackCacheKey } from './audioSourceManager.js';
import { clearQueueDragMarkers } from './queueDnD.js';
import { createTrackStore } from './trackStore.js';

/**
 * Gère la file d'attente : ajout, suppression, réordonnancement, index courant
 * et préchargement du prochain morceau.
 *
 * @param {object} options
 * @param {() => boolean} options.getQueueLoopEnabled
 * @param {() => boolean} options.getQueueShuffleEnabled
 * @param {() => object|null} options.getPlayer
 * @param {() => 'A'|'B'} options.getResolvedInactiveDeck
 * @param {(idx: number, mode: string) => Promise<void>} options.startPlaybackForIndex
 * @param {(deck: 'A'|'B', item: object|null) => void} options.setDeckItem
 * @param {() => void} options.closeSearch
 * @param {(v: boolean) => void} options.showCrossfadeRing
 * @param {(msg: string, isError?: boolean) => void} options.showToast
 * @param {(event: string, payload?: object) => void} options.logInfo
 * @param {(event: string, payload?: object) => void} options.logDebug
 * @param {(item: object, deck: 'A'|'B') => Promise<void>} options.fetchAndStoreArtworkForItem
 * @param {(item: object, deck: 'A'|'B') => Promise<void>} options.preloadMixDataForDeckItem
 * @param {(item: object) => Promise<string>} options.ensureLocalSource
 * @param {() => void} options.renderQueue
 * @param {() => void} options.scheduleDjSetQualityRefresh
 * @param {() => void} options.updateDeckCueUI
 * @param {(item: object) => void} options.releaseLocalBlob
 * @param {() => boolean} options.isLowMemoryPlaybackMode
 * @param {() => void} options.trimRetainedAudioSources
 * @param {() => object|null} options.getPendingFilRougeOnInactiveDeck
 * @param {(item: object|null) => void} options.setPendingFilRougeOnInactiveDeck
 * @param {(v: boolean) => void} options.setPendingAutoplay
 * @param {(fn: Function, timeout?: number) => void} options.scheduleIdle
 * @param {(fn: Function) => void} options.enqueueBackgroundTask
 * @param {() => HTMLElement|null} options.getQueueList
 * @param {ReturnType<typeof import('./trackStore.js').createTrackStore>} [options.trackStore]
 *   Registre partagé des morceaux (cf. SPECS.md §2.6). Si non fourni, cette instance
 *   crée et possède son propre trackStore (utile pour les tests).
 * @param {(item: object) => void} [options.renderFilRougeTrackStatus] - SPEC-3.5.5
 * @param {() => void} [options.pushRelayStateIfMaster]
 */
export function createQueueManager(options) {
  const {
    getQueueLoopEnabled,
    getQueueShuffleEnabled,
    getPlayer,
    getResolvedInactiveDeck,
    startPlaybackForIndex,
    setDeckItem,
    closeSearch,
    showCrossfadeRing,
    showToast,
    logInfo,
    logDebug,
    fetchAndStoreArtworkForItem,
    preloadMixDataForDeckItem,
    ensureLocalSource,
    renderQueue,
    scheduleDjSetQualityRefresh,
    updateDeckCueUI,
    releaseLocalBlob,
    isLowMemoryPlaybackMode,
    trimRetainedAudioSources,
    getPendingFilRougeOnInactiveDeck,
    setPendingFilRougeOnInactiveDeck,
    setPendingAutoplay,
    scheduleIdle,
    enqueueBackgroundTask,
    getQueueList,
    trackStore = createTrackStore(),
    renderFilRougeTrackStatus,
    pushRelayStateIfMaster,
  } = options;

  // ── Utility: resolve start offset from a raw API track ───────────────────────

  function resolveTrackStartOffsetMs(track) {
    if (!track || typeof track !== 'object') return 0;

    const parseToMs = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return 0;
      return numeric < 1000 ? Math.round(numeric * 1000) : Math.round(numeric);
    };

    const direct = [
      track.autoDjStartOffsetMs, track.startOffsetMs, track.startTimeMs,
      track.startMs, track.offsetMs, track.entryPointMs, track.cueInMs, track.mixStartMs,
      track.startSec, track.startTimeSec, track.startSeconds, track.offsetSec,
      track.entryPointSec, track.cueInSec, track.mixStartSec,
    ];

    for (const candidate of direct) {
      const ms = parseToMs(candidate);
      if (ms > 0) return ms;
    }

    for (const node of [track.mixSuggestion, track.suggestion, track.mix, track.transition, track.recommendation, track.meta]) {
      if (!node || typeof node !== 'object') continue;
      const ms = resolveTrackStartOffsetMs(node);
      if (ms > 0) return ms;
    }

    return 0;
  }

  // ── touchQueueItem ────────────────────────────────────────────────────────────

  function touchQueueItem(item) {
    if (!item) return;
    item.lastTouchedAt = Date.now();
  }

  // ── updateCurrentIndex ────────────────────────────────────────────────────────

  function updateCurrentIndex() {
    if (!uiState.currentTrackId) {
      uiState.currentIndex = -1;
      return;
    }
    const idx = uiState.queue.findIndex((item) => item.id === uiState.currentTrackId);
    uiState.currentIndex = idx >= 0 ? idx : -1;
  }

  // ── getFollowingQueueIndex ────────────────────────────────────────────────────

  function getWrappedQueueIndex(index) {
    const q = uiState.queue;
    if (!q.length) return -1;
    const numeric = Number(index);
    if (!Number.isFinite(numeric)) return -1;
    return ((numeric % q.length) + q.length) % q.length;
  }

  function getFollowingQueueIndex(index, opts = {}) {
    const q = uiState.queue;
    if (q.length <= 1) return -1;

    const numeric = Number(index);
    if (!Number.isFinite(numeric)) return -1;

    const explicitWrap = 'wrap' in opts;
    const wrap = explicitWrap ? opts.wrap : getQueueLoopEnabled();

    if (getQueueShuffleEnabled() && !explicitWrap) {
      let randomIdx;
      let attempts = 0;
      do {
        randomIdx = Math.floor(Math.random() * q.length);
        attempts++;
      } while (randomIdx === numeric && attempts < 20);
      return randomIdx === numeric ? -1 : randomIdx;
    }

    const nextIndex = numeric + 1;
    if (nextIndex < q.length) return nextIndex;
    return wrap ? getWrappedQueueIndex(nextIndex) : -1;
  }

  // ── removeFromQueue ───────────────────────────────────────────────────────────

  function removeFromQueue(idx) {
    const q = uiState.queue;
    const item = q[idx];
    if (item?.id === uiState.currentTrackId) return;
    const [removed] = q.splice(idx, 1);
    releaseLocalBlob?.(removed);

    if (uiState.deckDisplayItems.A?.id === removed?.id) setDeckItem?.('A', null);
    if (uiState.deckDisplayItems.B?.id === removed?.id) setDeckItem?.('B', null);

    if (uiState.deckBCueIndex === idx) uiState.deckBCueIndex = -1;
    else if (uiState.deckBCueIndex > idx) uiState.deckBCueIndex -= 1;
    if (uiState.deckCueDeck && uiState.deckDisplayItems[uiState.deckCueDeck]?.id === item?.id) {
      uiState.deckCueDeck = null;
    }
    updateDeckCueUI?.();
    updateCurrentIndex();
    renderQueue?.();
    scheduleDjSetQualityRefresh?.();
  }

  // ── reorderQueue ──────────────────────────────────────────────────────────────

  function reorderQueue(fromIndex, targetIndex, insertAfter = false) {
    const q = uiState.queue;
    if (fromIndex === targetIndex) return;
    if (fromIndex < 0 || targetIndex < 0) return;
    if (fromIndex >= q.length || targetIndex >= q.length) return;

    const [moved] = q.splice(fromIndex, 1);
    let insertIndex = targetIndex;
    if (insertAfter) insertIndex += 1;
    if (fromIndex < insertIndex) insertIndex -= 1;
    insertIndex = Math.max(0, Math.min(q.length, insertIndex));
    q.splice(insertIndex, 0, moved);

    if (uiState.deckBCueIndex === fromIndex) {
      uiState.deckBCueIndex = insertIndex;
    } else {
      if (fromIndex < uiState.deckBCueIndex && insertIndex >= uiState.deckBCueIndex) uiState.deckBCueIndex -= 1;
      if (fromIndex > uiState.deckBCueIndex && insertIndex <= uiState.deckBCueIndex) uiState.deckBCueIndex += 1;
    }
    updateDeckCueUI?.();
    updateCurrentIndex();
    const queueList = getQueueList?.();
    if (queueList) clearQueueDragMarkers(queueList);
    renderQueue?.();
  }

  // ── prefetchNext ──────────────────────────────────────────────────────────────

  function prefetchNext(index) {
    if (index < 0) return;
    const next = uiState.queue[index];
    if (!next) return;

    const lowMemory = isLowMemoryPlaybackMode?.();
    if (lowMemory) {
      logDebug?.('prefetchNext(): low-memory mode, trimming other sources but keeping next track warm', {
        index, id: next.id, name: next.name,
      });
      trimRetainedAudioSources?.();
    }
    if (next.localBlobUrl) return;

    scheduleIdle?.(() => {
      if (next.localBlobUrl || !uiState.queue.includes(next)) return;
      logDebug?.('prefetchNext(): prefetching track source', { index, id: next.id, name: next.name });
      touchQueueItem(next);
      enqueueBackgroundTask?.(() => ensureLocalSource?.(next).catch(() => {}));
    });
  }

  // ── addToQueue ────────────────────────────────────────────────────────────────

  async function addToQueue(track, opts = {}) {
    const {
      playNow = false,
      preferFade = false,
      source = 'manual',
      autoDjReferenceTrackId = null,
      showAddedToast = true,
      asNext = false,
      queueDate = null,
    } = opts;

    const artUrl = getBestArtworkUrl(track);
    const duration = getTrackDurationMs(track);
    const stems = extractStemSourceUrls(track);
    const audioFeatures = extractAudioFeatures(track);
    const bpm = extractTrackBpm({ ...track, audioFeatures });
    const genre = extractTrackGenre(track);
    const suggestedStartOffsetMs = resolveTrackStartOffsetMs(track);

    // Résolu (ou créé) via le trackStore partagé : si ce morceau existe déjà
    // ailleurs (Fil Rouge, autre entrée de queue), on récupère la MÊME
    // référence — pas une copie divergente (cf. SPECS.md §2.6).
    const item = trackStore.getOrCreate({
      id: getTrackCacheKey(track) || track.name,
      uri: track.uri || track.downloadUrl || `api:track:${track.id || track.name}`,
      name: track.name || track.title || 'Titre API',
      artist: track.artists
        ? track.artists.map((a) => a.name).join(', ')
        : (track.artist || 'Artiste inconnu'),
      artUrl,
      duration,
      bpm,
      genre,
      loudnessDb: extractTrackLoudnessDb(track),
      audioFeatures,
      stems: {
        vocalsUrl: stems.vocalsUrl,
        instrumentalUrl: stems.instrumentalUrl,
        echoUrl: stems.echoUrl,
        distortionUrl: stems.distortionUrl,
      },
      persistedSourceUrl: getDirectPlayableSourceUrl(track),
    });

    const q = uiState.queue;
    const isDuplicate = q.some(
      (qi) => qi.id === item.id || (qi.name === item.name && qi.artist === item.artist),
    );

    if (isDuplicate) {
      showToast?.(`Déjà dans la file : ${item.name}`, true);

      const player = getPlayer?.();
      if (playNow && player && !player.isCrossfading) {
        const existingIndex = q.findIndex(
          (qi) => qi.id === item.id || (qi.name === item.name && qi.artist === item.artist),
        );
        if (existingIndex >= 0) {
          const useFade = uiState.isPlaying && preferFade;
          if (useFade) showCrossfadeRing?.(true);
          try {
            await startPlaybackForIndex?.(existingIndex, useFade ? 'crossfade' : 'play');
            uiState.currentIndex = existingIndex;
            uiState.currentTrackId = q[existingIndex]?.id ?? null;
            renderQueue?.();
            closeSearch?.();
          } finally {
            if (useFade) showCrossfadeRing?.(false);
          }
        }
      }
      return;
    }

    // Champs "locaux à la queue" : assignés seulement une fois l'ajout confirmé
    // (jamais avant le check de doublon ci-dessus, pour ne pas corrompre la
    // provenance d'une entrée déjà présente lors d'une tentative de ré-ajout).
    item.queueSource = source;
    item.autoDjReferenceTrackId = source === 'auto-dj' ? (autoDjReferenceTrackId || null) : null;
    item.autoDjStartOffsetMs = suggestedStartOffsetMs;
    item.lastTouchedAt = Date.now();

    const normalizedQueueDate = Number.isFinite(Number(queueDate)) ? Number(queueDate) : null;
    item.queueDate = source === 'relay'
      ? (normalizedQueueDate ?? Date.now())
      : (normalizedQueueDate ?? null);

    let addedIndex;
    if (source === 'relay' && Number.isFinite(Number(item.queueDate))) {
      const targetDate = Number(item.queueDate);
      let insertIndex = 0;
      for (const existing of q) {
        const existingDate = Number(existing.queueDate);
        if (Number.isFinite(existingDate) && existingDate > targetDate) break;
        insertIndex += 1;
      }
      addedIndex = Math.min(insertIndex, q.length);
      q.splice(addedIndex, 0, item);
      if (uiState.deckBCueIndex >= addedIndex) uiState.deckBCueIndex += 1;
    } else if (asNext || playNow) {
      addedIndex = Math.min(Math.max(uiState.currentIndex + 1, 0), q.length);
      q.splice(addedIndex, 0, item);
      if (uiState.deckBCueIndex >= addedIndex) uiState.deckBCueIndex += 1;
    } else {
      q.push(item);
      addedIndex = q.length - 1;
    }
    logInfo?.('addToQueue(): item added', {
      addedIndex, asNext, id: item.id, name: item.name,
      artist: item.artist, queueLength: q.length,
    });

    const pendingGhost = getPendingFilRougeOnInactiveDeck?.();
    if (pendingGhost && !playNow) {
      setPendingFilRougeOnInactiveDeck?.(null);
      const inactiveDeck = getResolvedInactiveDeck?.();
      if (inactiveDeck && uiState.deckDisplayItems[inactiveDeck] === pendingGhost) {
        setDeckItem?.(inactiveDeck, item);
        logInfo?.('addToQueue(): replacing fil rouge ghost on inactive deck', {
          inactiveDeck, newItemId: item.id, newItemName: item.name,
        });
        fetchAndStoreArtworkForItem?.(item, inactiveDeck, { skipNotification: true }).catch(() => {});
        const replaceMixPreload = preloadMixDataForDeckItem?.(item, inactiveDeck);
        ensureLocalSource?.(item).then(async (url) => {
          const player = getPlayer?.();
          if (!player || uiState.deckDisplayItems[inactiveDeck] !== item) return;
          await replaceMixPreload?.catch(() => {});
          // SPEC-1.1.16 : re-valider la cible après la préparation asynchrone —
          // la platine visée a pu devenir active, l'item réassigné, ou le morceau
          // être devenu le morceau courant (doublon sur les deux platines).
          if (getResolvedInactiveDeck?.() !== inactiveDeck
            || uiState.deckDisplayItems[inactiveDeck] !== item
            || uiState.currentTrackId === item.id) {
            logInfo?.('addToQueue(): stale ghost-replacement preload aborted', {
              inactiveDeck, itemId: item.id, currentTrackId: uiState.currentTrackId,
            });
            return;
          }
          const startMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
          await player.playOnDeck(inactiveDeck, {
            url,
            loudnessDb: item.loudnessDb,
            bpm: item.bpm,
            durationMs: item.duration,
            audioFeatures: item.audioFeatures,
            stems: item.stems,
          }, { paused: true, startPositionMs: startMs });
          renderQueue?.();
        }).catch(() => {});
      }
    }

    renderQueue?.();
    scheduleDjSetQualityRefresh?.();

    const player = getPlayer?.();
    if (playNow && player && !player.isCrossfading && uiState.isPlaying) {
      const useFade = Boolean(preferFade);
      if (useFade) showCrossfadeRing?.(true);
      try {
        await startPlaybackForIndex?.(addedIndex, useFade ? 'crossfade' : 'play');
        uiState.currentIndex = addedIndex;
        uiState.currentTrackId = item.id;
        renderQueue?.();
        closeSearch?.();
      } finally {
        if (useFade) showCrossfadeRing?.(false);
      }
      return;
    }

    if (!uiState.isPlaying && !player?.isCrossfading) {
      uiState.currentIndex = addedIndex;
      uiState.currentTrackId = item.id;
      renderQueue?.();

      if (player?.isReady) {
        await startPlaybackForIndex?.(uiState.currentIndex, 'play');
      } else {
        setPendingAutoplay?.(true);
      }
    } else if (uiState.currentIndex < 0) {
      uiState.currentIndex = 0;
      uiState.currentTrackId = q[0]?.id ?? null;
      renderQueue?.();
    }

    // Warm cache immédiatement à l'ajout pour une lecture instantanée plus tard.
    ensureLocalSource?.(item).catch(() => {});

    // Précharge les mix data tôt pour que les recommandations de start offset soient
    // dispo avant le cue/play. Une fois résolu, rafraîchit le badge Fil Rouge pour
    // refléter la présence des mix data désormais en localStorage (SPEC-3.5.5).
    preloadMixDataForDeckItem?.(item, getResolvedInactiveDeck?.())
      .then(() => { renderFilRougeTrackStatus?.(item); })
      .catch(() => {});

    if (showAddedToast) {
      showToast?.(`✔ "${item.name}" ajouté`);
    }

    // Maître : notifier les relais qu'une piste a été ajoutée.
    pushRelayStateIfMaster?.();
  }

  return {
    resolveTrackStartOffsetMs,
    touchQueueItem,
    updateCurrentIndex,
    getFollowingQueueIndex,
    removeFromQueue,
    reorderQueue,
    prefetchNext,
    addToQueue,
  };
}

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createPlaybackController } from '../../lib/playbackController.js';
import { uiState } from '../../lib/uiState.js';

function makePlayer(overrides = {}) {
  return {
    isCrossfading: false,
    isReady: true,
    crossfadeDuration: 6000,
    autoBpm: false,
    transitionMode: 'auto',
    _previousTransitionMode: 'auto',
    playOnDeck: jest.fn().mockResolvedValue(undefined),
    crossfadeToDeck: jest.fn().mockResolvedValue(undefined),
    setDeckPlaybackRate: jest.fn(),
    resetDeckPlaybackRate: jest.fn(),
    setTransitionMode: jest.fn(),
    updateDeckStems: jest.fn(),
    ...overrides,
  };
}

function makeController(overrides = {}) {
  return createPlaybackController({
    getPlayer: jest.fn().mockReturnValue(makePlayer()),
    getQueue: jest.fn().mockReturnValue([]),
    getDjMode: jest.fn().mockReturnValue('normal'),
    getActiveDeckBpm: jest.fn().mockReturnValue(null),
    getResolvedActiveDeck: jest.fn().mockReturnValue('A'),
    getResolvedInactiveDeck: jest.fn().mockReturnValue('B'),
    getFollowingQueueIndex: jest.fn().mockReturnValue(-1),
    touchQueueItem: jest.fn(),
    removeFromQueue: jest.fn(),
    prefetchNext: jest.fn(),
    resolveTrackStartOffsetMs: jest.fn().mockReturnValue(0),
    preloadMixDataForDeckItem: jest.fn().mockResolvedValue(undefined),
    ensureLocalSource: jest.fn().mockResolvedValue('blob:fake'),
    fetchAndStoreArtworkForItem: jest.fn().mockResolvedValue(undefined),
    enrichStemsFromServer: jest.fn().mockResolvedValue(undefined),
    enqueueBackgroundTask: jest.fn((fn) => fn()),
    filRougeManager: {
      isActive: jest.fn().mockReturnValue(false),
      getNextTrack: jest.fn().mockReturnValue(null),
      peekNextTrackFromAny: jest.fn().mockReturnValue(null),
      getPlaylist: jest.fn().mockReturnValue([]),
      getPriorityQueue: jest.fn().mockReturnValue([]),
      removeFromPriorityQueue: jest.fn(),
      removeFromPlaylist: jest.fn(),
    },
    djPlanManager: {
      getDjTransitionPlan: jest.fn().mockReturnValue(null),
      getOpeningCueOffsetMs: jest.fn().mockReturnValue(0),
    },
    getDjExternalPlanEnabled: jest.fn().mockReturnValue(false),
    autoModeManager: {
      scheduleAutomixTiming: jest.fn(),
      searchAndAddNextTrack: jest.fn().mockResolvedValue(undefined),
    },
    getAutoSuggestionQueueSearchEnabled: jest.fn().mockReturnValue(false),
    automixTimeline: { nextTriggerMs: -1, triggeredForTrack: false, currentPlayingDeck: 'A' },
    renderQueue: jest.fn(),
    renderFilRouge: jest.fn(),
    updateNowPlaying: jest.fn(),
    updatePlannedStartMarker: jest.fn(),
    updateUpcomingArtwork: jest.fn(),
    suggestGenreFromCurrentTrack: jest.fn(),
    applyDjModeFxPreset: jest.fn(),
    scheduleIdle: jest.fn((fn) => fn()),
    trimRetainedAudioSources: jest.fn(),
    isLowMemoryPlaybackMode: jest.fn().mockReturnValue(false),
    showToast: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
    applyDeckMixRatio: jest.fn(),
    updateAutoDjMarker: jest.fn(),
    updateMaxDurationMarker: jest.fn(),
    applyTrackMaxDurationForCurrentPlayback: jest.fn(),
    resetTrackCaches: jest.fn(),
    fetchMissingMeta: jest.fn().mockResolvedValue(undefined),
    refreshDeckMetaDisplays: jest.fn(),
    updateDeckCueUI: jest.fn(),
    getPendingFilRougeOnInactiveDeck: jest.fn().mockReturnValue(null),
    setPendingFilRougeOnInactiveDeck: jest.fn(),
    ...overrides,
  });
}

function makeTrack(overrides = {}) {
  return { id: 't1', name: 'Track', artist: 'Artist', duration: 180_000, ...overrides };
}

beforeEach(() => {
  uiState.currentIndex = -1;
  uiState.currentTrackId = null;
  uiState.isPlaying = false;
  uiState.deckDisplayItems = { A: null, B: null };
  uiState.deckBCueIndex = -1;
  uiState.deckCueDeck = null;
});

// ── setDeckItem ───────────────────────────────────────────────────────────────

describe('setDeckItem', () => {
  test('sets deckDisplayItems.A on deck A', () => {
    const ctrl = makeController();
    const track = makeTrack();
    ctrl.setDeckItem('A', track);
    expect(uiState.deckDisplayItems.A).toBe(track);
  });

  test('clears deck when item is null', () => {
    const ctrl = makeController();
    uiState.deckDisplayItems.A = makeTrack();
    ctrl.setDeckItem('A', null);
    expect(uiState.deckDisplayItems.A).toBeNull();
  });

  test('calls refreshDeckMetaDisplays', () => {
    const refreshDeckMetaDisplays = jest.fn();
    const ctrl = makeController({ refreshDeckMetaDisplays });
    ctrl.setDeckItem('A', makeTrack());
    expect(refreshDeckMetaDisplays).toHaveBeenCalled();
  });

  test('calls updateDeckCueUI', () => {
    const updateDeckCueUI = jest.fn();
    const ctrl = makeController({ updateDeckCueUI });
    ctrl.setDeckItem('A', makeTrack());
    expect(updateDeckCueUI).toHaveBeenCalled();
  });

  test('calls fetchMissingMeta for non-null item', () => {
    const fetchMissingMeta = jest.fn().mockResolvedValue(undefined);
    const ctrl = makeController({ fetchMissingMeta });
    ctrl.setDeckItem('B', makeTrack());
    expect(fetchMissingMeta).toHaveBeenCalled();
  });

  test('does not call fetchMissingMeta for null item', () => {
    const fetchMissingMeta = jest.fn().mockResolvedValue(undefined);
    const ctrl = makeController({ fetchMissingMeta });
    ctrl.setDeckItem('A', null);
    expect(fetchMissingMeta).not.toHaveBeenCalled();
  });
});

// ── backgroundEnrichStems ─────────────────────────────────────────────────────

describe('backgroundEnrichStems', () => {
  test('no-ops when item is null', () => {
    const enqueueBackgroundTask = jest.fn();
    const ctrl = makeController({ enqueueBackgroundTask });
    ctrl.backgroundEnrichStems('A', null);
    expect(enqueueBackgroundTask).not.toHaveBeenCalled();
  });

  test('no-ops when item already has full stems (vocalsUrl + instrumentalUrl)', () => {
    const enqueueBackgroundTask = jest.fn();
    const player = makePlayer();
    const ctrl = makeController({ enqueueBackgroundTask, getPlayer: jest.fn().mockReturnValue(player) });
    const item = makeTrack({ stems: { vocalsUrl: 'v', instrumentalUrl: 'i' } });
    uiState.deckDisplayItems.A = item;
    ctrl.backgroundEnrichStems('A', item);
    expect(enqueueBackgroundTask).not.toHaveBeenCalled();
    expect(player.updateDeckStems).toHaveBeenCalledWith('A', item.stems);
  });

  test('skips updateDeckStems when item is no longer on the deck', () => {
    const player = makePlayer();
    const ctrl = makeController({ getPlayer: jest.fn().mockReturnValue(player) });
    const item = makeTrack({ stems: { vocalsUrl: 'v', instrumentalUrl: 'i' } });
    // deck A shows a different item
    uiState.deckDisplayItems.A = makeTrack({ id: 'other' });
    ctrl.backgroundEnrichStems('A', item);
    expect(player.updateDeckStems).not.toHaveBeenCalled();
  });

  test('enqueues enrichment task when stems are missing', () => {
    const enqueueBackgroundTask = jest.fn();
    const ctrl = makeController({ enqueueBackgroundTask });
    ctrl.backgroundEnrichStems('A', makeTrack());
    expect(enqueueBackgroundTask).toHaveBeenCalled();
  });
});

// ── resolveMixDataStartOffsetMs ───────────────────────────────────────────────

describe('resolveMixDataStartOffsetMs', () => {
  test('returns 0 for null', () => {
    const ctrl = makeController();
    expect(ctrl.resolveMixDataStartOffsetMs(null)).toBe(0);
  });

  test('uses recommendedSongStartSec over probableSongStartSec', () => {
    const ctrl = makeController();
    const ms = ctrl.resolveMixDataStartOffsetMs({ recommendedSongStartSec: 12, probableSongStartSec: 5 });
    expect(ms).toBe(12_000);
  });

  test('falls back to probableSongStartSec when recommended absent', () => {
    const ctrl = makeController();
    expect(ctrl.resolveMixDataStartOffsetMs({ probableSongStartSec: 8 })).toBe(8_000);
  });

  test('returns 0 when all fields are 0', () => {
    const ctrl = makeController();
    expect(ctrl.resolveMixDataStartOffsetMs({ probableSongStartSec: 0 })).toBe(0);
  });

  test('dance mode uses lower danceability threshold', () => {
    const ctrl = makeController({ getDjMode: jest.fn().mockReturnValue('dance') });
    // introLooksWeak: introDanceabilityFallback 0.5 <= dance threshold 0.55 → true
    // peakZone at 20s (late enough from 0 + 4 = 4, firstPeak 20 > max(10, 4) = 10) → skip to 20s
    const mixData = {
      probableSongStartSec: 0,
      indicators: { introDanceability: 0.5 },
      peakZones: [{ startSec: 20, score: 0.5 }],
    };
    expect(ctrl.resolveMixDataStartOffsetMs(mixData)).toBe(20_000);
  });

  test('empty intro: skips to first zone when no zones before 15s', () => {
    const ctrl = makeController();
    const mixData = {
      durationSec: 240,
      breakdownZones: [{ startSec: 30, endSec: 45, score: 0.6 }],
      dropZones: [],
      peakZones: [],
      avoidTransitionZones: [],
    };
    expect(ctrl.resolveMixDataStartOffsetMs(mixData)).toBe(30_000);
  });

  test('empty intro: no skip when a zone exists before 15s', () => {
    const ctrl = makeController();
    const mixData = {
      durationSec: 240,
      breakdownZones: [{ startSec: 10, endSec: 20, score: 0.5 }],
      dropZones: [{ startSec: 50, endSec: 55, score: 0.8 }],
      peakZones: [],
      avoidTransitionZones: [],
    };
    expect(ctrl.resolveMixDataStartOffsetMs(mixData)).toBe(0);
  });

  test('empty intro: ignores offset that would skip near end of track', () => {
    const ctrl = makeController();
    const mixData = {
      durationSec: 50,
      breakdownZones: [],
      dropZones: [],
      peakZones: [{ startSec: 25, endSec: 30, score: 0.5 }],
      avoidTransitionZones: [],
    };
    // 25 > durationSec - 30 = 20 → ignored
    expect(ctrl.resolveMixDataStartOffsetMs(mixData)).toBe(0);
  });

  test('empty intro: picks earliest zone across all types', () => {
    const ctrl = makeController();
    const mixData = {
      durationSec: 300,
      breakdownZones: [{ startSec: 40, endSec: 50, score: 0.5 }],
      dropZones: [{ startSec: 25, endSec: 30, score: 0.9 }],
      peakZones: [{ startSec: 60, endSec: 70, score: 0.7 }],
      avoidTransitionZones: [{ startSec: 20, endSec: 22, score: 0.3, reason: 'high_tension' }],
    };
    expect(ctrl.resolveMixDataStartOffsetMs(mixData)).toBe(20_000);
  });

  test('empty intro: does not reduce an already higher offset', () => {
    const ctrl = makeController();
    const mixData = {
      durationSec: 300,
      recommendedSongStartSec: 50,
      breakdownZones: [{ startSec: 30, endSec: 40, score: 0.5 }],
      dropZones: [],
      peakZones: [],
      avoidTransitionZones: [],
    };
    // recommendedSongStartSec=50 > firstZone=30 → keeps 50
    expect(ctrl.resolveMixDataStartOffsetMs(mixData)).toBe(50_000);
  });

  test('ignores recommendation beyond half track duration when duration is known in mixData', () => {
    const ctrl = makeController();
    const mixData = {
      durationSec: 200,
      recommendedSongStartSec: 120,
    };
    expect(ctrl.resolveMixDataStartOffsetMs(mixData)).toBe(0);
  });
});

// ── applyDjStartOffsetIfPlanned ───────────────────────────────────────────────

describe('applyDjStartOffsetIfPlanned', () => {
  test('applies plan.mixInSec to item.autoDjStartOffsetMs', () => {
    const ctrl = makeController();
    const item = makeTrack({ autoDjStartOffsetMs: 0 });
    const changed = ctrl.applyDjStartOffsetIfPlanned(item, { mixInSec: 10 });
    expect(changed).toBe(true);
    expect(item.autoDjStartOffsetMs).toBe(10_000);
  });

  test('returns false when plan is null', () => {
    const ctrl = makeController();
    expect(ctrl.applyDjStartOffsetIfPlanned(makeTrack(), null)).toBe(false);
  });

  test('returns false when mixInSec is the same', () => {
    const ctrl = makeController();
    const item = makeTrack({ autoDjStartOffsetMs: 10_000 });
    expect(ctrl.applyDjStartOffsetIfPlanned(item, { mixInSec: 10 })).toBe(false);
  });

  test('caps offsetMs to durationMs - 1000 when under the 50% threshold', () => {
    const ctrl = makeController();
    // Sub-2s duration keeps `duration - 1000` below the 50% mark, exercising the cap branch.
    const item = makeTrack({ autoDjStartOffsetMs: 0, duration: 1_800 });
    ctrl.applyDjStartOffsetIfPlanned(item, { mixInSec: 0.9 }); // 900ms, under 50% of 1800ms
    expect(item.autoDjStartOffsetMs).toBe(800); // 1800 - 1000
  });

  test('rejects offset beyond 50% of track duration and leaves it unset', () => {
    const ctrl = makeController();
    const item = makeTrack({ autoDjStartOffsetMs: 0, duration: 60_000 });
    const changed = ctrl.applyDjStartOffsetIfPlanned(item, { mixInSec: 70 }); // 70s > 50% of 60s track
    expect(changed).toBe(false);
    expect(item.autoDjStartOffsetMs).toBe(0);
  });
});

// ── startPlaybackForIndex — mode: play ────────────────────────────────────────

describe('startPlaybackForIndex mode=play', () => {
  test('sets currentIndex and currentTrackId', async () => {
    const track = makeTrack({ id: 'abc' });
    const ctrl = makeController({ getQueue: jest.fn().mockReturnValue([track]) });
    await ctrl.startPlaybackForIndex(0, 'play');
    expect(uiState.currentIndex).toBe(0);
    expect(uiState.currentTrackId).toBe('abc');
    expect(uiState.isPlaying).toBe(true);
  });

  test('clears the other deck on mode=play', async () => {
    const track = makeTrack({ id: 'abc' });
    uiState.deckDisplayItems.B = makeTrack({ id: 'old' });
    const ctrl = makeController({ getQueue: jest.fn().mockReturnValue([track]) });
    await ctrl.startPlaybackForIndex(0, 'play');
    expect(uiState.deckDisplayItems.B).toBeNull();
  });

  test('calls resetTrackCaches after success', async () => {
    const resetTrackCaches = jest.fn();
    const track = makeTrack();
    const ctrl = makeController({ getQueue: jest.fn().mockReturnValue([track]), resetTrackCaches });
    await ctrl.startPlaybackForIndex(0, 'play');
    expect(resetTrackCaches).toHaveBeenCalled();
  });

  test('calls updateAutoDjMarker after success', async () => {
    const updateAutoDjMarker = jest.fn();
    const track = makeTrack();
    const ctrl = makeController({ getQueue: jest.fn().mockReturnValue([track]), updateAutoDjMarker });
    await ctrl.startPlaybackForIndex(0, 'play');
    expect(updateAutoDjMarker).toHaveBeenCalled();
  });
});

// ── startPlaybackForIndex — djPlan.mixInSec ───────────────────────────────────

describe('startPlaybackForIndex with djPlan', () => {
  test('applies djPlan.mixInSec when mixInSecDefined=true', async () => {
    const track = makeTrack({ autoDjStartOffsetMs: 0 });
    const djPlanManager = {
      getDjTransitionPlan: jest.fn().mockReturnValue({ mixInSecDefined: true, mixInSec: 15, decisionId: 'x' }),
      getOpeningCueOffsetMs: jest.fn().mockReturnValue(0),
    };
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([track]),
      getDjExternalPlanEnabled: jest.fn().mockReturnValue(true),
      djPlanManager,
    });
    await ctrl.startPlaybackForIndex(0, 'play');
    expect(track.autoDjStartOffsetMs).toBe(15_000);
  });
});

// ── startPlaybackForIndex — error handling ────────────────────────────────────

describe('startPlaybackForIndex error handling', () => {
  test('sets sourceState=error on failure', async () => {
    const track = makeTrack();
    const player = makePlayer({ playOnDeck: jest.fn().mockRejectedValue(new Error('no audio')) });
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([track]),
      getPlayer: jest.fn().mockReturnValue(player),
    });
    await expect(ctrl.startPlaybackForIndex(0, 'play')).rejects.toThrow('no audio');
    expect(track.sourceState).toBe('error');
    expect(track.sourceError).toBe('no audio');
  });

  test('shows error toast on failure', async () => {
    const showToast = jest.fn();
    const player = makePlayer({ playOnDeck: jest.fn().mockRejectedValue(new Error('fail')) });
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([makeTrack()]),
      getPlayer: jest.fn().mockReturnValue(player),
      showToast,
    });
    await expect(ctrl.startPlaybackForIndex(0, 'play')).rejects.toThrow();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('fail'), true);
  });

  test('calls removeFromQueue for failed item', async () => {
    const removeFromQueue = jest.fn();
    const player = makePlayer({ playOnDeck: jest.fn().mockRejectedValue(new Error('x')) });
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([makeTrack({ id: 'bad' })]),
      getPlayer: jest.fn().mockReturnValue(player),
      removeFromQueue,
    });
    await expect(ctrl.startPlaybackForIndex(0, 'play')).rejects.toThrow();
    expect(removeFromQueue).toHaveBeenCalledWith(0);
  });

  test('SPEC-8.6.7 onTrackStarted est appelé avec item et index quand la lecture démarre', async () => {
    const onTrackStarted = jest.fn();
    const track = makeTrack({ id: 'tr1' });
    const ctrl = makeController({
      onTrackStarted,
      getQueue: jest.fn().mockReturnValue([track]),
    });
    await ctrl.startPlaybackForIndex(0, 'play');
    expect(onTrackStarted).toHaveBeenCalledTimes(1);
    expect(onTrackStarted).toHaveBeenCalledWith(expect.objectContaining({ id: 'tr1' }), 0);
  });

  test('SPEC-8.6.7 onTrackStarted n\'est pas appelé quand startPlaybackForIndex échoue', async () => {
    const onTrackStarted = jest.fn();
    const player = makePlayer({ playOnDeck: jest.fn().mockRejectedValue(new Error('fail')) });
    const ctrl = makeController({
      onTrackStarted,
      getQueue: jest.fn().mockReturnValue([makeTrack()]),
      getPlayer: jest.fn().mockReturnValue(player),
    });
    await expect(ctrl.startPlaybackForIndex(0, 'play')).rejects.toThrow();
    expect(onTrackStarted).not.toHaveBeenCalled();
  });

  // SPEC-1.2.7 — bug d'origine : une panne API transitoire (piste réellement
  // téléchargée mais serveur local injoignable) faisait perdre le morceau du
  // Fil Rouge en plus de son échec de lecture ponctuel.
  test('SPEC-1.2.7 removes a failed track from the Fil Rouge playlist/priority queue when the API is online', async () => {
    const removeFromPlaylist = jest.fn();
    const removeFromPriorityQueue = jest.fn();
    const track = makeTrack({ id: 'bad' });
    const player = makePlayer({ playOnDeck: jest.fn().mockRejectedValue(new Error('not found')) });
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([track]),
      getPlayer: jest.fn().mockReturnValue(player),
      apiHealthMonitor: { isOffline: () => false },
      filRougeManager: {
        isActive: jest.fn().mockReturnValue(true),
        getNextTrack: jest.fn().mockReturnValue(null),
        peekNextTrackFromAny: jest.fn().mockReturnValue(null),
        getPlaylist: jest.fn().mockReturnValue([track]),
        getPriorityQueue: jest.fn().mockReturnValue([track]),
        removeFromPriorityQueue,
        removeFromPlaylist,
      },
    });
    await expect(ctrl.startPlaybackForIndex(0, 'play')).rejects.toThrow();
    expect(removeFromPriorityQueue).toHaveBeenCalledWith(0);
    expect(removeFromPlaylist).toHaveBeenCalledWith(0);
  });

  test('SPEC-1.2.7 does not remove a failed track from the Fil Rouge playlist/priority queue while the API is offline', async () => {
    const removeFromPlaylist = jest.fn();
    const removeFromPriorityQueue = jest.fn();
    const removeFromQueue = jest.fn();
    const track = makeTrack({ id: 'bad' });
    const player = makePlayer({
      playOnDeck: jest.fn().mockRejectedValue(new Error('API hors ligne – téléchargement impossible')),
    });
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([track]),
      getPlayer: jest.fn().mockReturnValue(player),
      removeFromQueue,
      apiHealthMonitor: { isOffline: () => true },
      filRougeManager: {
        isActive: jest.fn().mockReturnValue(true),
        getNextTrack: jest.fn().mockReturnValue(null),
        peekNextTrackFromAny: jest.fn().mockReturnValue(null),
        getPlaylist: jest.fn().mockReturnValue([track]),
        getPriorityQueue: jest.fn().mockReturnValue([track]),
        removeFromPriorityQueue,
        removeFromPlaylist,
      },
    });
    await expect(ctrl.startPlaybackForIndex(0, 'play')).rejects.toThrow();
    // Toujours retiré de la file d'attente de lecture éphémère...
    expect(removeFromQueue).toHaveBeenCalledWith(0);
    // ...mais jamais du Fil Rouge tant que l'échec est dû à une panne API.
    expect(removeFromPriorityQueue).not.toHaveBeenCalled();
    expect(removeFromPlaylist).not.toHaveBeenCalled();
  });
});

// ── applyMixSuggestedStartOffset ──────────────────────────────────────────────

describe('applyMixSuggestedStartOffset', () => {
  test('sets autoDjStartOffsetMs from mix data', () => {
    const ctrl = makeController();
    const item = makeTrack({ autoDjStartOffsetMs: 0 });
    const result = ctrl.applyMixSuggestedStartOffset(item, { probableSongStartSec: 8 });
    expect(result).toBe(true);
    expect(item.autoDjStartOffsetMs).toBe(8_000);
  });

  test('no-ops when autoDjStartOffsetMs already set and overrideExisting=false', () => {
    const ctrl = makeController();
    const item = makeTrack({ autoDjStartOffsetMs: 5_000 });
    const result = ctrl.applyMixSuggestedStartOffset(item, { probableSongStartSec: 10 });
    expect(result).toBe(false);
    expect(item.autoDjStartOffsetMs).toBe(5_000);
  });

  test('overrides existing when overrideExisting=true', () => {
    const ctrl = makeController();
    const item = makeTrack({ autoDjStartOffsetMs: 5_000 });
    ctrl.applyMixSuggestedStartOffset(item, { probableSongStartSec: 12 }, { overrideExisting: true });
    expect(item.autoDjStartOffsetMs).toBe(12_000);
  });

  test('ignores recommendation beyond half track duration based on item.duration', () => {
    const ctrl = makeController();
    const item = makeTrack({ autoDjStartOffsetMs: 0, duration: 120_000 });
    const result = ctrl.applyMixSuggestedStartOffset(item, { probableSongStartSec: 70 });
    expect(result).toBe(false);
    expect(item.autoDjStartOffsetMs).toBe(0);
  });
});

// ── launchDeckFromQueue — SPEC-1.1.17 stale deck target aborted ──────────────
//
// Bug d'origine (rapporté : "des fois la même chanson est lue deux fois de
// suite" en mode AutoDJ) : preloadMixDataForDeckItem/ensureLocalSource sont
// asynchrones (téléchargement possible). Si, pendant cette attente, la platine
// visée devient active en jouant déjà cet item (via un vrai crossfade
// concurrent, ex. déclenché par l'automix pendant qu'un cue/rafraîchissement
// de suggestion AutoDJ est en préparation), l'ancien code rechargeait quand
// même l'audio depuis son offset de départ sur cette platine — l'auditeur
// entendait le morceau réellement en cours "sauter" en arrière, perçu comme
// une répétition.

function deferredPromise() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('launchDeckFromQueue — SPEC-1.1.17 stale deck target aborted', () => {
  function makeQueueAndController(overrides = {}) {
    const nextTrack = makeTrack({ id: 'next-1' });
    const player = makePlayer();
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([makeTrack({ id: 'current' }), nextTrack]),
      getPlayer: jest.fn().mockReturnValue(player),
      getResolvedInactiveDeck: jest.fn().mockReturnValue('B'),
      getResolvedActiveDeck: jest.fn().mockReturnValue('A'),
      getFollowingQueueIndex: jest.fn().mockReturnValue(1),
      ...overrides,
    });
    uiState.currentIndex = 0;
    uiState.currentTrackId = 'current';
    return { ctrl, player, nextTrack };
  }

  test('control: playOnDeck fires when the deck still shows the item after preparation', async () => {
    const { ctrl, player, nextTrack } = makeQueueAndController();

    await ctrl.launchDeckFromQueue('B');

    expect(player.playOnDeck).toHaveBeenCalledWith(
      'B',
      expect.objectContaining({ url: 'blob:fake' }),
      expect.objectContaining({ paused: true }),
    );
    expect(uiState.deckDisplayItems.B).toBe(nextTrack);
  });

  test('aborts when the deck item was reassigned during preparation', async () => {
    const { promise, resolve } = deferredPromise();
    const { ctrl, player } = makeQueueAndController({
      ensureLocalSource: jest.fn().mockReturnValue(promise),
    });

    const launchPromise = ctrl.launchDeckFromQueue('B');
    await tick();
    // A concurrent real transition claims deck B for a different item while
    // ensureLocalSource() is still resolving.
    uiState.deckDisplayItems.B = makeTrack({ id: 'someone-else' });
    resolve('blob:fake');
    await launchPromise;

    expect(player.playOnDeck).not.toHaveBeenCalled();
  });

  test('aborts when the item already became the current track during preparation', async () => {
    const { promise, resolve } = deferredPromise();
    const { ctrl, player } = makeQueueAndController({
      ensureLocalSource: jest.fn().mockReturnValue(promise),
    });

    const launchPromise = ctrl.launchDeckFromQueue('B');
    await tick();
    // A concurrent real crossfade already promoted this item to the current track.
    uiState.currentTrackId = 'next-1';
    resolve('blob:fake');
    await launchPromise;

    expect(player.playOnDeck).not.toHaveBeenCalled();
  });

  test('logs a warning when aborting a stale target', async () => {
    const { promise, resolve } = deferredPromise();
    const logWarn = jest.fn();
    const { ctrl } = makeQueueAndController({
      ensureLocalSource: jest.fn().mockReturnValue(promise),
      logWarn,
    });

    const launchPromise = ctrl.launchDeckFromQueue('B');
    await tick();
    uiState.currentTrackId = 'next-1';
    resolve('blob:fake');
    await launchPromise;

    expect(logWarn).toHaveBeenCalledWith(
      'launchDeckFromQueue(): stale deck target aborted',
      expect.objectContaining({ deck: 'B', itemId: 'next-1' }),
    );
  });
});

// ── startPlaybackForIndex — SPEC-1.1.16 parity for the "prepare inactive deck
//    with next track" and fil rouge ghost preloads ───────────────────────────
//
// These two async preloads already had the SPEC-1.1.16 stale-preload guard in
// main.js's own copy of startPlaybackForIndex but were missing it here — a
// drift between the two not-yet-consolidated implementations (see the
// project's dj-mix refactoring notes). Fixed to bring lib/playbackController.js
// to parity.

describe('startPlaybackForIndex — SPEC-1.1.16 stale next-track preload aborted', () => {
  function makeCrossfadeController(overrides = {}) {
    const currentTrack = makeTrack({ id: 'now-playing' });
    const upcomingTrack = makeTrack({ id: 'up-next' });
    const player = makePlayer();
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([currentTrack, upcomingTrack]),
      getPlayer: jest.fn().mockReturnValue(player),
      getResolvedActiveDeck: jest.fn().mockReturnValue('A'),
      getResolvedInactiveDeck: jest.fn().mockReturnValue('B'),
      getFollowingQueueIndex: jest.fn().mockReturnValue(1),
      ...overrides,
    });
    return { ctrl, player, currentTrack, upcomingTrack };
  }

  test('control: playOnDeck preloads the inactive deck when nothing changes meanwhile', async () => {
    const { ctrl, player, upcomingTrack } = makeCrossfadeController();

    await ctrl.startPlaybackForIndex(0, 'crossfade');
    await tick();

    expect(player.playOnDeck).toHaveBeenCalledWith(
      'B',
      expect.objectContaining({ url: 'blob:fake' }),
      expect.objectContaining({ paused: true }),
    );
    expect(uiState.deckDisplayItems.B).toBe(upcomingTrack);
  });

  test('aborts when the inactive deck became active on this same item meanwhile', async () => {
    const { promise, resolve } = deferredPromise();
    const { ctrl, player } = makeCrossfadeController({
      ensureLocalSource: jest.fn()
        .mockResolvedValueOnce('blob:current') // ensureLocalSource(currentTrack) inside the crossfade itself
        .mockReturnValueOnce(promise), // ensureLocalSource(upcomingTrack) inside the background preload
    });

    await ctrl.startPlaybackForIndex(0, 'crossfade');
    // A second, real transition finishes and promotes the "upcoming" track to
    // current on deck B while its own background preload is still in flight.
    uiState.currentTrackId = 'up-next';
    resolve('blob:fake');
    await tick();

    expect(player.playOnDeck).not.toHaveBeenCalledWith(
      'B',
      expect.anything(),
      expect.objectContaining({ paused: true }),
    );
  });

  test('aborts when the deck role flips (deck B becomes the resolved active deck) meanwhile', async () => {
    const { promise, resolve } = deferredPromise();
    let resolvedInactiveDeck = 'B';
    const { ctrl, player } = makeCrossfadeController({
      getResolvedInactiveDeck: jest.fn(() => resolvedInactiveDeck),
      ensureLocalSource: jest.fn()
        .mockResolvedValueOnce('blob:current')
        .mockReturnValueOnce(promise),
    });

    await ctrl.startPlaybackForIndex(0, 'crossfade');
    resolvedInactiveDeck = 'A';
    resolve('blob:fake');
    await tick();

    expect(player.playOnDeck).not.toHaveBeenCalledWith(
      'B',
      expect.anything(),
      expect.objectContaining({ paused: true }),
    );
  });
});

describe('startPlaybackForIndex — SPEC-1.1.16 stale fil rouge ghost preload aborted', () => {
  function makeGhostController(overrides = {}) {
    const currentTrack = makeTrack({ id: 'now-playing' });
    const ghostSource = { id: 'ghost-1', name: 'Ghost', artist: 'FilRouge', duration: 180_000 };
    const player = makePlayer();
    let pendingGhost = null;
    const filRougeManager = {
      isActive: jest.fn().mockReturnValue(true),
      peekNextTrackFromAny: jest.fn().mockReturnValue(ghostSource),
      getNextTrack: jest.fn().mockReturnValue(null),
      getPlaylist: jest.fn().mockReturnValue([]),
      getPriorityQueue: jest.fn().mockReturnValue([]),
      removeFromPriorityQueue: jest.fn(),
      removeFromPlaylist: jest.fn(),
    };
    const ctrl = makeController({
      getQueue: jest.fn().mockReturnValue([currentTrack]), // no next queue item -> ghost branch
      getPlayer: jest.fn().mockReturnValue(player),
      getResolvedActiveDeck: jest.fn().mockReturnValue('A'),
      getResolvedInactiveDeck: jest.fn().mockReturnValue('B'),
      getFollowingQueueIndex: jest.fn().mockReturnValue(-1),
      filRougeManager,
      getPendingFilRougeOnInactiveDeck: jest.fn(() => pendingGhost),
      setPendingFilRougeOnInactiveDeck: jest.fn((v) => { pendingGhost = v; }),
      ...overrides,
    });
    return { ctrl, player, currentTrack, filRougeManager };
  }

  test('control: playOnDeck preloads the ghost when nothing changes meanwhile', async () => {
    const { ctrl, player } = makeGhostController();

    await ctrl.startPlaybackForIndex(0, 'crossfade');
    await tick();

    expect(player.playOnDeck).toHaveBeenCalledWith(
      'B',
      expect.objectContaining({ url: 'blob:fake' }),
      expect.objectContaining({ paused: true }),
    );
  });

  test('aborts when the deck role flips (deck B becomes active) meanwhile', async () => {
    const { promise, resolve } = deferredPromise();
    let resolvedInactiveDeck = 'B';
    const { ctrl, player } = makeGhostController({
      getResolvedInactiveDeck: jest.fn(() => resolvedInactiveDeck),
      ensureLocalSource: jest.fn()
        .mockResolvedValueOnce('blob:current')
        .mockReturnValueOnce(promise),
    });

    await ctrl.startPlaybackForIndex(0, 'crossfade');
    resolvedInactiveDeck = 'A';
    resolve('blob:ghost');
    await tick();

    expect(player.playOnDeck).not.toHaveBeenCalledWith(
      'B',
      expect.anything(),
      expect.objectContaining({ paused: true }),
    );
  });
});

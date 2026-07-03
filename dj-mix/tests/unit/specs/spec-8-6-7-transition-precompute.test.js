/**
 * Spec-driven tests for §8.6.7 — Pré-calcul réactif des transitions
 * Reference: SPEC-8.6.7
 *
 * Garantit qu'au démarrage de chaque morceau, `onTrackStarted` est déclenché
 * afin que `scheduleDjSetQualityRefresh()` pré-calcule les ≥ 3 prochaines
 * transitions du fil rouge.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createPlaybackController } from '../../../lib/playbackController.js';
import { uiState } from '../../../lib/uiState.js';

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

function makeTrack(overrides = {}) {
  return { id: 't1', name: 'Track', artist: 'Artist', duration: 180_000, ...overrides };
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

beforeEach(() => {
  uiState.currentIndex = -1;
  uiState.currentTrackId = null;
  uiState.isPlaying = false;
  uiState.deckDisplayItems = { A: null, B: null };
  uiState.deckBCueIndex = -1;
  uiState.deckCueDeck = null;
});

// ── SPEC-8.6.7 ───────────────────────────────────────────────────────────────

describe('SPEC-8.6.7 — Pré-calcul réactif des transitions au démarrage du morceau', () => {
  test('onTrackStarted est appelé avec item et index quand startPlaybackForIndex réussit', async () => {
    const scheduleDjSetQualityRefresh = jest.fn();
    const track = makeTrack({ id: 'song-1' });
    const ctrl = makeController({
      onTrackStarted: scheduleDjSetQualityRefresh,
      getQueue: jest.fn().mockReturnValue([track]),
    });

    await ctrl.startPlaybackForIndex(0, 'play');

    expect(scheduleDjSetQualityRefresh).toHaveBeenCalledTimes(1);
    expect(scheduleDjSetQualityRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'song-1' }),
      0,
    );
  });

  test('onTrackStarted est appelé après scheduleAutomixTiming', async () => {
    const callOrder = [];
    const scheduleAutomixTiming = jest.fn(() => callOrder.push('automix'));
    const onTrackStarted = jest.fn(() => callOrder.push('onTrackStarted'));
    const track = makeTrack();
    const ctrl = makeController({
      onTrackStarted,
      autoModeManager: { scheduleAutomixTiming, searchAndAddNextTrack: jest.fn().mockResolvedValue(undefined) },
      getQueue: jest.fn().mockReturnValue([track]),
    });

    await ctrl.startPlaybackForIndex(0, 'play');

    expect(callOrder).toEqual(['automix', 'onTrackStarted']);
  });

  test('onTrackStarted n\'est pas appelé si startPlaybackForIndex échoue', async () => {
    const onTrackStarted = jest.fn();
    const player = makePlayer({ playOnDeck: jest.fn().mockRejectedValue(new Error('source error')) });
    const ctrl = makeController({
      onTrackStarted,
      getPlayer: jest.fn().mockReturnValue(player),
      getQueue: jest.fn().mockReturnValue([makeTrack()]),
    });

    await expect(ctrl.startPlaybackForIndex(0, 'play')).rejects.toThrow('source error');
    expect(onTrackStarted).not.toHaveBeenCalled();
  });

  test('onTrackStarted est appelé pour chaque morceau démarré successivement', async () => {
    const onTrackStarted = jest.fn();
    const track0 = makeTrack({ id: 'a' });
    const track1 = makeTrack({ id: 'b' });
    const ctrl = makeController({
      onTrackStarted,
      getQueue: jest.fn().mockReturnValue([track0, track1]),
    });

    await ctrl.startPlaybackForIndex(0, 'play');
    await ctrl.startPlaybackForIndex(1, 'play');

    expect(onTrackStarted).toHaveBeenCalledTimes(2);
    expect(onTrackStarted).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'a' }), 0);
    expect(onTrackStarted).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'b' }), 1);
  });

  test('fonctionne sans onTrackStarted (paramètre optionnel)', async () => {
    const ctrl = makeController({ getQueue: jest.fn().mockReturnValue([makeTrack()]) });
    await expect(ctrl.startPlaybackForIndex(0, 'play')).resolves.toBeUndefined();
  });
});

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createQueueManager } from '../../lib/queueManager.js';
import { createFilRougeManager } from '../../lib/filRougeManager.js';
import { createTrackStore } from '../../lib/trackStore.js';
import { uiState } from '../../lib/uiState.js';

function makeManager(overrides = {}) {
  return createQueueManager({
    getQueueLoopEnabled: jest.fn().mockReturnValue(false),
    getQueueShuffleEnabled: jest.fn().mockReturnValue(false),
    getPlayer: jest.fn().mockReturnValue(null),
    getResolvedInactiveDeck: jest.fn().mockReturnValue('B'),
    startPlaybackForIndex: jest.fn().mockResolvedValue(undefined),
    setDeckItem: jest.fn(),
    closeSearch: jest.fn(),
    showCrossfadeRing: jest.fn(),
    showToast: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    fetchAndStoreArtworkForItem: jest.fn().mockResolvedValue(undefined),
    preloadMixDataForDeckItem: jest.fn().mockResolvedValue(undefined),
    ensureLocalSource: jest.fn().mockResolvedValue('blob:fake'),
    renderQueue: jest.fn(),
    scheduleDjSetQualityRefresh: jest.fn(),
    updateDeckCueUI: jest.fn(),
    releaseLocalBlob: jest.fn(),
    isLowMemoryPlaybackMode: jest.fn().mockReturnValue(false),
    trimRetainedAudioSources: jest.fn(),
    getPendingFilRougeOnInactiveDeck: jest.fn().mockReturnValue(null),
    setPendingFilRougeOnInactiveDeck: jest.fn(),
    setPendingAutoplay: jest.fn(),
    scheduleIdle: jest.fn((fn) => fn()),
    enqueueBackgroundTask: jest.fn((fn) => fn()),
    getQueueList: jest.fn().mockReturnValue(null),
    ...overrides,
  });
}

function makeTrack(overrides = {}) {
  return {
    id: 'track-1',
    name: 'Track One',
    artist: 'Artist One',
    duration: 180_000,
    ...overrides,
  };
}

beforeEach(() => {
  uiState.queue = [];
  uiState.currentIndex = -1;
  uiState.currentTrackId = null;
  uiState.isPlaying = false;
  uiState.deckBCueIndex = -1;
  uiState.deckCueDeck = null;
  uiState.deckDisplayItems = { A: null, B: null };
});

// ── addToQueue — deduplication ────────────────────────────────────────────────

describe('addToQueue deduplication', () => {
  test('adds track when queue is empty', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack());
    expect(uiState.queue).toHaveLength(1);
  });

  test('blocks duplicate by id', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'x' }));
    await mgr.addToQueue(makeTrack({ id: 'x' }));
    expect(uiState.queue).toHaveLength(1);
  });

  test('blocks duplicate by name+artist', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'a', name: 'T', artist: 'A' }));
    await mgr.addToQueue(makeTrack({ id: 'b', name: 'T', artist: 'A' }));
    expect(uiState.queue).toHaveLength(1);
  });

  test('shows duplicate toast', async () => {
    const showToast = jest.fn();
    const mgr = makeManager({ showToast });
    await mgr.addToQueue(makeTrack());
    await mgr.addToQueue(makeTrack());
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Déjà dans la file'), true);
  });
});

// ── addToQueue — queueSource ──────────────────────────────────────────────────

describe('addToQueue queueSource', () => {
  test('assigns queueSource from options', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack(), { source: 'fil-rouge' });
    expect(uiState.queue[0].queueSource).toBe('fil-rouge');
  });

  test('defaults queueSource to "manual"', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack());
    expect(uiState.queue[0].queueSource).toBe('manual');
  });

  test('only stores autoDjReferenceTrackId for auto-dj source', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack(), { source: 'auto-dj', autoDjReferenceTrackId: 'ref-x' });
    expect(uiState.queue[0].autoDjReferenceTrackId).toBe('ref-x');
  });

  test('does not store autoDjReferenceTrackId for non-auto-dj source', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack(), { source: 'manual', autoDjReferenceTrackId: 'ref-x' });
    expect(uiState.queue[0].autoDjReferenceTrackId).toBeNull();
  });
});

// ── addToQueue — asNext (SPEC-9.3.5) ─────────────────────────────────────────

describe('addToQueue asNext', () => {
  test('inserts at currentIndex+1 when something is playing', async () => {
    uiState.queue = [makeTrack({ id: 'curr' }), makeTrack({ id: 'old-next' })];
    uiState.currentIndex = 0;
    uiState.currentTrackId = 'curr';
    uiState.isPlaying = true;
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'new-next', name: 'New Next', artist: 'X' }), { asNext: true });
    expect(uiState.queue).toHaveLength(3);
    expect(uiState.queue[1].id).toBe('new-next');
    expect(uiState.queue[2].id).toBe('old-next');
  });

  test('inserts at index 0 when nothing is playing (currentIndex === -1)', async () => {
    uiState.queue = [makeTrack({ id: 'a' })];
    uiState.currentIndex = -1;
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'new', name: 'New', artist: 'Y' }), { asNext: true });
    expect(uiState.queue[0].id).toBe('new');
    expect(uiState.queue[1].id).toBe('a');
  });

  test('appends to end when asNext is false (default)', async () => {
    uiState.queue = [makeTrack({ id: 'curr' }), makeTrack({ id: 'second' })];
    uiState.currentIndex = 0;
    uiState.currentTrackId = 'curr';
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'last', name: 'Last', artist: 'Z' }));
    expect(uiState.queue[2].id).toBe('last');
  });

  test('increments deckBCueIndex when it is at the insertion point', async () => {
    uiState.queue = [makeTrack({ id: 'curr' }), makeTrack({ id: 'cued' })];
    uiState.currentIndex = 0;
    uiState.currentTrackId = 'curr';
    uiState.deckBCueIndex = 1;
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'inserted', name: 'Ins', artist: 'I' }), { asNext: true });
    expect(uiState.queue[1].id).toBe('inserted');
    expect(uiState.queue[2].id).toBe('cued');
    expect(uiState.deckBCueIndex).toBe(2);
  });

  test('does not change deckBCueIndex when cue is before insertion point', async () => {
    uiState.queue = [makeTrack({ id: 'cued' }), makeTrack({ id: 'curr' }), makeTrack({ id: 'third' })];
    uiState.currentIndex = 1;
    uiState.currentTrackId = 'curr';
    uiState.deckBCueIndex = 0;
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'new', name: 'New', artist: 'N' }), { asNext: true });
    expect(uiState.deckBCueIndex).toBe(0);
  });
});

// ── addToQueue — playNow position (SPEC-4.3.8) ───────────────────────────────

describe('addToQueue playNow position', () => {
  test('inserts at currentIndex+1, not at the end of the queue', async () => {
    uiState.queue = [makeTrack({ id: 'curr' }), makeTrack({ id: 'old-next' })];
    uiState.currentIndex = 0;
    uiState.currentTrackId = 'curr';
    uiState.isPlaying = true;
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'now-track', name: 'Now', artist: 'X' }), { playNow: true });
    expect(uiState.queue).toHaveLength(3);
    expect(uiState.queue[1].id).toBe('now-track');
    expect(uiState.queue[2].id).toBe('old-next');
  });

  test('inserts relay tracks after items with lower queueDate', async () => {
    uiState.queue = [
      makeTrack({ id: 'older', name: 'Older', artist: 'A' }),
      makeTrack({ id: 'newer', name: 'Newer', artist: 'A' }),
    ];
    uiState.queue[0].queueDate = 1_000;
    uiState.queue[1].queueDate = 3_000;
    uiState.currentIndex = 0;
    uiState.currentTrackId = 'older';
    const mgr = makeManager();

    await mgr.addToQueue(makeTrack({ id: 'relay-mid', name: 'Relay Mid', artist: 'A' }), {
      source: 'relay',
      queueDate: 2_000,
    });

    expect(uiState.queue.map((item) => item.id)).toEqual(['older', 'relay-mid', 'newer']);
    expect(uiState.queue[1].queueDate).toBe(2_000);
  });

  test('inserts relay tracks by scanning the full queue even when existing items have no queueDate', async () => {
    uiState.queue = [
      makeTrack({ id: 'older', name: 'Older', artist: 'A' }),
      makeTrack({ id: 'manual', name: 'Manual', artist: 'A' }),
      makeTrack({ id: 'newer', name: 'Newer', artist: 'A' }),
    ];
    uiState.queue[0].queueDate = 1_000;
    uiState.queue[2].queueDate = 3_000;
    uiState.currentIndex = 0;
    uiState.currentTrackId = 'older';
    const mgr = makeManager();

    await mgr.addToQueue(makeTrack({ id: 'relay-mid', name: 'Relay Mid', artist: 'A' }), {
      source: 'relay',
      queueDate: 2_000,
    });

    expect(uiState.queue.map((item) => item.id)).toEqual(['older', 'manual', 'relay-mid', 'newer']);
  });

  test('inserts at index 0 when nothing is playing (currentIndex === -1)', async () => {
    uiState.queue = [makeTrack({ id: 'a' })];
    uiState.currentIndex = -1;
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'now-track', name: 'Now', artist: 'Y' }), { playNow: true });
    expect(uiState.queue[0].id).toBe('now-track');
    expect(uiState.queue[1].id).toBe('a');
  });
});

// ── removeFromQueue ───────────────────────────────────────────────────────────

describe('removeFromQueue', () => {
  test('removes item at index', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    uiState.currentTrackId = 'a';
    uiState.currentIndex = 0;
    const mgr = makeManager();
    mgr.removeFromQueue(1);
    expect(uiState.queue).toHaveLength(1);
    expect(uiState.queue[0].id).toBe('a');
  });

  test('does not remove currently playing track', () => {
    uiState.queue = [makeTrack({ id: 'curr' })];
    uiState.currentTrackId = 'curr';
    const mgr = makeManager();
    mgr.removeFromQueue(0);
    expect(uiState.queue).toHaveLength(1);
  });

  test('adjusts deckBCueIndex when item before cue is removed', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    uiState.deckBCueIndex = 2;
    uiState.currentTrackId = 'a';
    const mgr = makeManager();
    mgr.removeFromQueue(1); // remove idx 1 (before cue at 2)
    expect(uiState.deckBCueIndex).toBe(1);
  });

  test('resets deckBCueIndex when cued item is removed', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    uiState.deckBCueIndex = 1;
    uiState.currentTrackId = 'a';
    const mgr = makeManager();
    mgr.removeFromQueue(1); // remove the cued item
    expect(uiState.deckBCueIndex).toBe(-1);
  });

  test('deckBCueIndex unchanged when removing item after cue', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    uiState.deckBCueIndex = 1;
    uiState.currentTrackId = 'a';
    const mgr = makeManager();
    mgr.removeFromQueue(2); // remove after cue
    expect(uiState.deckBCueIndex).toBe(1);
  });

  test('calls releaseLocalBlob for removed item', () => {
    const releaseLocalBlob = jest.fn();
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    uiState.currentTrackId = 'a';
    const mgr = makeManager({ releaseLocalBlob });
    mgr.removeFromQueue(1);
    expect(releaseLocalBlob).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });
});

// ── reorderQueue ──────────────────────────────────────────────────────────────

describe('reorderQueue', () => {
  test('moves item from index to target', () => {
    uiState.queue = [
      makeTrack({ id: 'a' }),
      makeTrack({ id: 'b' }),
      makeTrack({ id: 'c' }),
    ];
    const mgr = makeManager();
    mgr.reorderQueue(0, 2);
    expect(uiState.queue.map((q) => q.id)).toEqual(['b', 'a', 'c']);
  });

  test('no-ops when fromIndex === targetIndex', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const mgr = makeManager();
    mgr.reorderQueue(1, 1);
    expect(uiState.queue.map((q) => q.id)).toEqual(['a', 'b']);
  });

  test('updates deckBCueIndex when cued item is moved', () => {
    uiState.queue = [
      makeTrack({ id: 'a' }),
      makeTrack({ id: 'cued' }),
      makeTrack({ id: 'c' }),
    ];
    uiState.deckBCueIndex = 1;
    const mgr = makeManager();
    mgr.reorderQueue(1, 0); // move cued item before 'a' → cued ends at index 0
    expect(uiState.deckBCueIndex).toBe(0);
  });
});

// ── updateCurrentIndex ────────────────────────────────────────────────────────

describe('updateCurrentIndex', () => {
  test('sets to -1 when currentTrackId is null', () => {
    uiState.queue = [makeTrack()];
    uiState.currentTrackId = null;
    uiState.currentIndex = 0;
    const mgr = makeManager();
    mgr.updateCurrentIndex();
    expect(uiState.currentIndex).toBe(-1);
  });

  test('finds correct index by id', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    uiState.currentTrackId = 'b';
    const mgr = makeManager();
    mgr.updateCurrentIndex();
    expect(uiState.currentIndex).toBe(1);
  });

  test('sets to -1 when id not in queue', () => {
    uiState.queue = [makeTrack({ id: 'a' })];
    uiState.currentTrackId = 'missing';
    const mgr = makeManager();
    mgr.updateCurrentIndex();
    expect(uiState.currentIndex).toBe(-1);
  });
});

// ── getFollowingQueueIndex ────────────────────────────────────────────────────

describe('getFollowingQueueIndex', () => {
  test('returns -1 for single-item queue', () => {
    uiState.queue = [makeTrack()];
    const mgr = makeManager();
    expect(mgr.getFollowingQueueIndex(0)).toBe(-1);
  });

  test('returns next index normally', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    const mgr = makeManager();
    expect(mgr.getFollowingQueueIndex(0)).toBe(1);
    expect(mgr.getFollowingQueueIndex(1)).toBe(2);
  });

  test('returns -1 at end when loop disabled', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const mgr = makeManager({ getQueueLoopEnabled: jest.fn().mockReturnValue(false) });
    expect(mgr.getFollowingQueueIndex(1)).toBe(-1);
  });

  test('wraps to 0 at end when loop enabled', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const mgr = makeManager({ getQueueLoopEnabled: jest.fn().mockReturnValue(true) });
    expect(mgr.getFollowingQueueIndex(1)).toBe(0);
  });

  test('respects explicit wrap=false even when loop enabled', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const mgr = makeManager({ getQueueLoopEnabled: jest.fn().mockReturnValue(true) });
    expect(mgr.getFollowingQueueIndex(1, { wrap: false })).toBe(-1);
  });

  test('shuffle returns different index', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    const mgr = makeManager({ getQueueShuffleEnabled: jest.fn().mockReturnValue(true) });
    // With shuffle we can't predict the exact index, but it should be valid
    const idx = mgr.getFollowingQueueIndex(0);
    expect(idx).toBeGreaterThanOrEqual(-1);
    expect(idx).toBeLessThan(3);
  });
});

// ── resolveTrackStartOffsetMs ─────────────────────────────────────────────────

describe('resolveTrackStartOffsetMs', () => {
  test('returns 0 for no offset', () => {
    const mgr = makeManager();
    expect(mgr.resolveTrackStartOffsetMs({ id: '1' })).toBe(0);
  });

  test('reads autoDjStartOffsetMs in ms', () => {
    const mgr = makeManager();
    expect(mgr.resolveTrackStartOffsetMs({ autoDjStartOffsetMs: 5000 })).toBe(5000);
  });

  test('converts startSec < 1000 to ms', () => {
    const mgr = makeManager();
    expect(mgr.resolveTrackStartOffsetMs({ startSec: 30 })).toBe(30_000);
  });

  test('reads from nested mixSuggestion', () => {
    const mgr = makeManager();
    expect(mgr.resolveTrackStartOffsetMs({ mixSuggestion: { startMs: 10_000 } })).toBe(10_000);
  });

  test('returns 0 for null', () => {
    const mgr = makeManager();
    expect(mgr.resolveTrackStartOffsetMs(null)).toBe(0);
  });
});

// ── addToQueue — trackStore sharing (SPEC-2.6) ───────────────────────────────

describe('addToQueue trackStore sharing', () => {
  test('a track added to the queue and to the fil rouge shares the same object reference', async () => {
    const trackStore = createTrackStore();
    const mgr = makeManager({ trackStore });
    const filRouge = createFilRougeManager({ trackStore });

    await mgr.addToQueue(makeTrack({ id: 'shared', name: 'Shared Song', artist: 'S' }));
    filRouge.addToPlaylist({ id: 'shared', name: 'Shared Song', artist: 'S' });

    expect(uiState.queue[0]).toBe(filRouge.getPlaylist()[0]);
  });

  test('a mutation on the shared track is visible from both the queue and the fil rouge', async () => {
    const trackStore = createTrackStore();
    const mgr = makeManager({ trackStore });
    const filRouge = createFilRougeManager({ trackStore });

    await mgr.addToQueue(makeTrack({ id: 'shared', name: 'Shared Song', artist: 'S' }));
    filRouge.addToPlaylist({ id: 'shared', name: 'Shared Song', artist: 'S' });

    trackStore.patch('shared', { artUrl: 'http://x/art.png' });

    expect(uiState.queue[0].artUrl).toBe('http://x/art.png');
    expect(filRouge.getPlaylist()[0].artUrl).toBe('http://x/art.png');
  });

  test('a rejected duplicate add does not clobber the existing item queueSource', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'x' }), { source: 'manual' });
    await mgr.addToQueue(makeTrack({ id: 'x' }), { source: 'auto-dj', autoDjReferenceTrackId: 'ref' });
    expect(uiState.queue).toHaveLength(1);
    expect(uiState.queue[0].queueSource).toBe('manual');
    expect(uiState.queue[0].autoDjReferenceTrackId).toBeNull();
  });

  test('calls renderFilRougeTrackStatus and pushRelayStateIfMaster after a successful add (SPEC-3.5.5)', async () => {
    const renderFilRougeTrackStatus = jest.fn();
    const pushRelayStateIfMaster = jest.fn();
    const mgr = makeManager({ renderFilRougeTrackStatus, pushRelayStateIfMaster });
    await mgr.addToQueue(makeTrack());
    expect(pushRelayStateIfMaster).toHaveBeenCalled();
    // preloadMixDataForDeckItem resolves asynchronously (mocked via mockResolvedValue) —
    // flush the microtask queue before asserting the chained callback ran.
    await Promise.resolve();
    await Promise.resolve();
    expect(renderFilRougeTrackStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'track-1' }));
  });
});

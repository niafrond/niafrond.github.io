/**
 * Spec-driven tests for §2 — File d'attente (Queue)
 * References: SPEC-2.1–2.4
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createQueueManager } from '../../../lib/queueManager.js';
import { uiState } from '../../../lib/uiState.js';

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
    id: `track-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Track',
    artist: 'Artist',
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

// ── SPEC-2.1 — CRUD operations ──────────────────────────────────────────────

describe('SPEC-2.1 — Queue CRUD', () => {
  test('SPEC-2.1.1 — addToQueue appends track with metadata', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ name: 'Hello', artist: 'World', bpm: 120 }));
    expect(uiState.queue).toHaveLength(1);
    expect(uiState.queue[0].name).toBe('Hello');
    expect(uiState.queue[0].artist).toBe('World');
  });

  test('SPEC-2.1.2 — removeFromQueue blocks removal of currently playing track', () => {
    const track = makeTrack({ id: 'playing' });
    uiState.queue = [track];
    uiState.currentTrackId = 'playing';
    const mgr = makeManager();
    mgr.removeFromQueue(0);
    expect(uiState.queue).toHaveLength(1);
  });

  test('SPEC-2.1.3 — removeFromQueue calls releaseLocalBlob', () => {
    const releaseLocalBlob = jest.fn();
    const a = makeTrack({ id: 'a' });
    const b = makeTrack({ id: 'b' });
    uiState.queue = [a, b];
    uiState.currentTrackId = 'a';
    const mgr = makeManager({ releaseLocalBlob });
    mgr.removeFromQueue(1);
    expect(releaseLocalBlob).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  test('SPEC-2.1.3 — removeFromQueue adjusts deckBCueIndex when item before cue removed', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    uiState.deckBCueIndex = 2;
    uiState.currentTrackId = 'a';
    const mgr = makeManager();
    mgr.removeFromQueue(1);
    expect(uiState.deckBCueIndex).toBe(1);
  });

  test('SPEC-2.1.4 — reorderQueue moves items correctly', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    const mgr = makeManager();
    mgr.reorderQueue(0, 2);
    expect(uiState.queue.map((q) => q.id)).toEqual(['b', 'a', 'c']);
  });
});

// ── SPEC-2.2 — Deduplication ────────────────────────────────────────────────

describe('SPEC-2.2 — Deduplication', () => {
  test('SPEC-2.2.1 — blocks duplicate by id', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'dup-id' }));
    await mgr.addToQueue(makeTrack({ id: 'dup-id' }));
    expect(uiState.queue).toHaveLength(1);
  });

  test('SPEC-2.2.1 — blocks duplicate by name+artist', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'id-1', name: 'Same', artist: 'Same' }));
    await mgr.addToQueue(makeTrack({ id: 'id-2', name: 'Same', artist: 'Same' }));
    expect(uiState.queue).toHaveLength(1);
  });

  test('SPEC-2.2.1 — shows toast on duplicate', async () => {
    const showToast = jest.fn();
    const mgr = makeManager({ showToast });
    await mgr.addToQueue(makeTrack({ id: 'x' }));
    await mgr.addToQueue(makeTrack({ id: 'x' }));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Déjà dans la file'), true);
  });

  test('allows tracks with different name and artist', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack({ id: 'a', name: 'Song A', artist: 'A' }));
    await mgr.addToQueue(makeTrack({ id: 'b', name: 'Song B', artist: 'B' }));
    expect(uiState.queue).toHaveLength(2);
  });
});

// ── SPEC-2.3 — Playback modes ───────────────────────────────────────────────

describe('SPEC-2.3 — Playback modes', () => {
  test('SPEC-2.3.1 — loop wraps to index 0 at end of queue', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const mgr = makeManager({ getQueueLoopEnabled: jest.fn().mockReturnValue(true) });
    expect(mgr.getFollowingQueueIndex(1)).toBe(0);
  });

  test('SPEC-2.3.1 — without loop, returns -1 at end', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const mgr = makeManager({ getQueueLoopEnabled: jest.fn().mockReturnValue(false) });
    expect(mgr.getFollowingQueueIndex(1)).toBe(-1);
  });

  test('SPEC-2.3.2 — shuffle returns valid index', () => {
    uiState.queue = Array.from({ length: 5 }, (_, i) => makeTrack({ id: `t-${i}` }));
    const mgr = makeManager({ getQueueShuffleEnabled: jest.fn().mockReturnValue(true) });
    const idx = mgr.getFollowingQueueIndex(0);
    expect(idx).toBeGreaterThanOrEqual(-1);
    expect(idx).toBeLessThan(5);
  });

  test('SPEC-2.3.2 — shuffle avoids same index (tries up to 20 times)', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const mgr = makeManager({ getQueueShuffleEnabled: jest.fn().mockReturnValue(true) });
    // With 2 items, shuffle should return the other index most of the time
    let differentCount = 0;
    for (let i = 0; i < 20; i++) {
      if (mgr.getFollowingQueueIndex(0) !== 0) differentCount++;
    }
    expect(differentCount).toBeGreaterThan(0);
  });

  test('SPEC-2.3.3 — shuffle takes priority over loop', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
    const mgr = makeManager({
      getQueueLoopEnabled: jest.fn().mockReturnValue(true),
      getQueueShuffleEnabled: jest.fn().mockReturnValue(true),
    });
    // With shuffle, the result should be any valid index (not necessarily sequential)
    const idx = mgr.getFollowingQueueIndex(2);
    expect(idx).toBeGreaterThanOrEqual(-1);
    expect(idx).toBeLessThan(3);
  });

  test('SPEC-2.3.4 — explicit wrap=false overrides loop', () => {
    uiState.queue = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const mgr = makeManager({ getQueueLoopEnabled: jest.fn().mockReturnValue(true) });
    expect(mgr.getFollowingQueueIndex(1, { wrap: false })).toBe(-1);
  });

  test('single-item queue returns -1', () => {
    uiState.queue = [makeTrack()];
    const mgr = makeManager();
    expect(mgr.getFollowingQueueIndex(0)).toBe(-1);
  });
});

// ── SPEC-2.1 — queueSource assignment ───────────────────────────────────────

describe('SPEC-2.1 — queueSource metadata', () => {
  test('defaults queueSource to "manual"', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack());
    expect(uiState.queue[0].queueSource).toBe('manual');
  });

  test('assigns queueSource from options', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack(), { source: 'auto-dj' });
    expect(uiState.queue[0].queueSource).toBe('auto-dj');
  });

  test('stores autoDjReferenceTrackId only for auto-dj source', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack(), { source: 'auto-dj', autoDjReferenceTrackId: 'ref' });
    expect(uiState.queue[0].autoDjReferenceTrackId).toBe('ref');
  });

  test('does not store autoDjReferenceTrackId for manual source', async () => {
    const mgr = makeManager();
    await mgr.addToQueue(makeTrack(), { source: 'manual', autoDjReferenceTrackId: 'ref' });
    expect(uiState.queue[0].autoDjReferenceTrackId).toBeNull();
  });
});

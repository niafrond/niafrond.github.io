/**
 * Spec-driven tests for §1.1 — Gardes de chargement des platines
 * References: SPEC-1.1.13, SPEC-1.1.14, SPEC-1.1.15, SPEC-1.1.16
 *
 * Bug d'origine : pendant la préparation asynchrone (ensureLocalSource),
 * la platine visée pouvait devenir active — le préchargement paused coupait
 * alors la musique en cours, ou chargeait le même titre sur les deux platines.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createQueueManager } from '../../../lib/queueManager.js';
import { uiState } from '../../../lib/uiState.js';

// ── Mock Audio element ──────────────────────────────────────────────────────

function createMockAudio() {
  const listeners = {};
  const audio = {
    src: '',
    currentTime: 0,
    duration: 180,
    volume: 0,
    paused: true,
    ended: false,
    playbackRate: 1,
    preload: '',
    readyState: 0,
    currentSrc: '',
    addEventListener(event, handler, opts) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push({ handler, once: opts?.once ?? false });
    },
    removeEventListener(event, handler) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((e) => e.handler !== handler);
    },
    dispatchEvent(event) {
      const name = typeof event === 'string' ? event : event.type;
      const handlers = listeners[name] || [];
      const toRemove = [];
      for (const entry of handlers) {
        entry.handler(event);
        if (entry.once) toRemove.push(entry);
      }
      for (const entry of toRemove) {
        listeners[name] = (listeners[name] || []).filter((e) => e !== entry);
      }
    },
    load() {
      audio.readyState = 4;
      queueMicrotask(() => audio.dispatchEvent(new Event('canplay')));
    },
    play() {
      audio.paused = false;
      queueMicrotask(() => audio.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    },
    pause() {
      audio.paused = true;
    },
    remove() {},
  };
  return audio;
}

// ── Setup ───────────────────────────────────────────────────────────────────

const mockAudios = [];

let origAudio;
let origRAF;
let origCAF;
let origAudioContext;

beforeEach(() => {
  mockAudios.length = 0;

  origAudio = globalThis.Audio;
  globalThis.Audio = function MockAudio() {
    const a = createMockAudio();
    mockAudios.push(a);
    return a;
  };

  origRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  origCAF = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  origAudioContext = globalThis.AudioContext;
  globalThis.AudioContext = class MockAudioContext {
    state = 'running';
    createMediaElementSource() {
      return { connect() {}, disconnect() {} };
    }
    createGain() {
      return {
        gain: { value: 1, setTargetAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
    createBiquadFilter() {
      return {
        type: 'allpass',
        frequency: { value: 350, setTargetAtTime() {} },
        Q: { value: 1, setTargetAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
    createChannelSplitter() { return { connect() {}, disconnect() {} }; }
    createChannelMerger() { return { connect() {}, disconnect() {} }; }
    get destination() { return {}; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
});

afterEach(() => {
  globalThis.Audio = origAudio;
  globalThis.requestAnimationFrame = origRAF;
  globalThis.cancelAnimationFrame = origCAF;
  globalThis.AudioContext = origAudioContext;
});

// ── Helpers ─────────────────────────────────────────────────────────────────

const tick = () => new Promise((r) => setTimeout(r, 0));

async function createInitializedPlayer() {
  const { DJPlayer } = await import('../../../player.js');
  const player = new DJPlayer();
  player.setTransitionMode('cut_transition');
  await player.init();
  await tick();
  return player;
}

// ── SPEC-1.1.13 — Préchargement refusé sur la platine active en lecture ─────

describe('SPEC-1.1.13 — paused load rejected on active playing deck', () => {
  test('GIVEN deck A active and playing — WHEN playOnDeck(A, paused:true) — THEN load is rejected and playback continues', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await tick();

    const deckA = mockAudios[0];
    expect(deckA.paused).toBe(false);

    await player.playOnDeck('A', 'blob:http://localhost/track-b', { paused: true });

    expect(deckA.paused).toBe(false);
    expect(deckA.src).toBe('blob:http://localhost/track-a');
    player.destroy?.();
  });

  test('GIVEN deck A active but paused — WHEN playOnDeck(A, paused:true) — THEN load is allowed (re-cue)', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await tick();

    player.pauseDeck('A');
    await player.playOnDeck('A', 'blob:http://localhost/track-b', { paused: true });
    await tick();

    const deckA = mockAudios[0];
    expect(deckA.src).toBe('blob:http://localhost/track-b');
    expect(deckA.paused).toBe(true);
    player.destroy?.();
  });
});

// ── SPEC-1.1.14 — Jamais la même source sur les deux platines ───────────────

describe('SPEC-1.1.14 — duplicate source rejected on the other deck', () => {
  test('GIVEN track-a playing on deck A — WHEN playOnDeck(B, track-a, paused:true) — THEN load is rejected', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await tick();

    await player.playOnDeck('B', 'blob:http://localhost/track-a', { paused: true });

    const deckB = mockAudios[1];
    expect(deckB.src).toBe('');
    player.destroy?.();
  });

  test('GIVEN track-a playing on deck A — WHEN playOnDeck(B, track-b, paused:true) — THEN preload succeeds', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await tick();

    await player.playOnDeck('B', 'blob:http://localhost/track-b', { paused: true });
    await tick();

    const deckB = mockAudios[1];
    expect(deckB.src).toBe('blob:http://localhost/track-b');
    expect(deckB.paused).toBe(true);
    player.destroy?.();
  });
});

// ── SPEC-1.1.15 — Crossfade vers la platine active redirigé ─────────────────

describe('SPEC-1.1.15 — crossfade targeting the active playing deck is retargeted', () => {
  test('GIVEN deck A active and playing — WHEN crossfadeToDeck(A, track-b) — THEN track-b lands on deck B and B becomes active', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await tick();
    expect(player.activeDeck).toBe('A');

    await player.crossfadeToDeck('A', 'blob:http://localhost/track-b', 100);
    await tick();

    expect(player.activeDeck).toBe('B');
    expect(mockAudios[1].src).toBe('blob:http://localhost/track-b');
    expect(mockAudios[0].paused).toBe(true);
    player.destroy?.();
  });

  test('GIVEN deck A active and playing — WHEN crossfadeToDeck(B, track-b) — THEN behaviour is unchanged (no redirect)', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await tick();

    await player.crossfadeToDeck('B', 'blob:http://localhost/track-b', 100);
    await tick();

    expect(player.activeDeck).toBe('B');
    expect(mockAudios[1].src).toBe('blob:http://localhost/track-b');
    player.destroy?.();
  });
});

// ── SPEC-1.1.16 — Préchargement asynchrone obsolète abandonné ───────────────

describe('SPEC-1.1.16 — stale async preload aborted (queueManager ghost replacement)', () => {
  let currentInactiveDeck;
  let fakePlayer;

  function makeGhost() {
    return { id: 'ghost-1', name: 'Ghost', artist: 'FilRouge' };
  }

  function makeManager(overrides = {}) {
    return createQueueManager({
      getQueueLoopEnabled: jest.fn().mockReturnValue(false),
      getQueueShuffleEnabled: jest.fn().mockReturnValue(false),
      getPlayer: jest.fn(() => fakePlayer),
      getResolvedInactiveDeck: jest.fn(() => currentInactiveDeck),
      startPlaybackForIndex: jest.fn().mockResolvedValue(undefined),
      setDeckItem: jest.fn((deck, it) => { uiState.deckDisplayItems[deck] = it; }),
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

  beforeEach(() => {
    currentInactiveDeck = 'B';
    fakePlayer = {
      isCrossfading: false,
      isReady: true,
      playOnDeck: jest.fn().mockResolvedValue(undefined),
    };
    uiState.queue = [{ id: 'current', name: 'Current', artist: 'X' }];
    uiState.currentIndex = 0;
    uiState.currentTrackId = 'current';
    uiState.isPlaying = true;
    uiState.deckBCueIndex = -1;
    uiState.deckCueDeck = null;
    uiState.deckDisplayItems = { A: null, B: null };
  });

  async function addTrackReplacingGhost(mgr, ghost, trackOverrides = {}) {
    uiState.deckDisplayItems.B = ghost;
    await mgr.addToQueue({
      id: 'next-1', name: 'Next', artist: 'Artist', duration: 180_000, ...trackOverrides,
    });
  }

  test('GIVEN ghost replacement preload in flight — WHEN target deck is still inactive — THEN playOnDeck(paused) fires (control)', async () => {
    const ghost = makeGhost();
    const mgr = makeManager({ getPendingFilRougeOnInactiveDeck: jest.fn().mockReturnValue(ghost) });

    await addTrackReplacingGhost(mgr, ghost);
    await tick();

    expect(fakePlayer.playOnDeck).toHaveBeenCalledTimes(1);
    expect(fakePlayer.playOnDeck).toHaveBeenCalledWith('B', expect.any(Object), expect.objectContaining({ paused: true }));
  });

  test('GIVEN ghost replacement preload in flight — WHEN target deck became active meanwhile — THEN playOnDeck is aborted', async () => {
    const ghost = makeGhost();
    const mgr = makeManager({ getPendingFilRougeOnInactiveDeck: jest.fn().mockReturnValue(ghost) });

    await addTrackReplacingGhost(mgr, ghost);
    // La platine B devient active pendant que ensureLocalSource se résout.
    currentInactiveDeck = 'A';
    await tick();

    expect(fakePlayer.playOnDeck).not.toHaveBeenCalled();
  });

  test('GIVEN ghost replacement preload in flight — WHEN the item became the current track meanwhile — THEN playOnDeck is aborted', async () => {
    const ghost = makeGhost();
    const mgr = makeManager({ getPendingFilRougeOnInactiveDeck: jest.fn().mockReturnValue(ghost) });

    await addTrackReplacingGhost(mgr, ghost);
    // Le morceau ajouté est lancé sur la platine active pendant le préchargement.
    uiState.currentTrackId = 'next-1';
    await tick();

    expect(fakePlayer.playOnDeck).not.toHaveBeenCalled();
  });

  test('GIVEN ghost replacement preload in flight — WHEN the deck item was reassigned meanwhile — THEN playOnDeck is aborted', async () => {
    const ghost = makeGhost();
    const mgr = makeManager({ getPendingFilRougeOnInactiveDeck: jest.fn().mockReturnValue(ghost) });

    await addTrackReplacingGhost(mgr, ghost);
    uiState.deckDisplayItems.B = { id: 'someone-else', name: 'Other', artist: 'Y' };
    await tick();

    expect(fakePlayer.playOnDeck).not.toHaveBeenCalled();
  });
});

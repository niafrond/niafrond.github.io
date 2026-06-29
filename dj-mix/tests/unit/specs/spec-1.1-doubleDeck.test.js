/**
 * Spec-driven tests for §1.1 — Double platine
 * References: SPEC-1.1.1, SPEC-1.1.2, SPEC-1.1.3, SPEC-1.1.4, SPEC-1.1.5, SPEC-1.1.6
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

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
      return {
        connect() {},
        disconnect() {},
      };
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

async function createInitializedPlayer() {
  const { DJPlayer } = await import('../../../player.js');
  const player = new DJPlayer();
  player.setTransitionMode('cut_transition');
  await player.init();
  // Drain microtasks (canplay events from init load)
  await new Promise((r) => setTimeout(r, 0));
  return player;
}

// ── SPEC-1.1 — Double platine ───────────────────────────────────────────────

describe('SPEC-1.1.1 — Two decks exist', () => {
  test('player has two decks (A and B) backed by Audio elements', async () => {
    const player = await createInitializedPlayer();
    // init() creates 2 Audio elements
    expect(mockAudios).toHaveLength(2);
    player.destroy?.();
  });
});

describe('SPEC-1.1.2 — Single active deck', () => {
  test('activeDeck is A or B', async () => {
    const player = await createInitializedPlayer();
    expect(['A', 'B']).toContain(player.activeDeck);
    player.destroy?.();
  });

  test('default active deck is A', async () => {
    const player = await createInitializedPlayer();
    expect(player.activeDeck).toBe('A');
    player.destroy?.();
  });
});

describe('SPEC-1.1.3 — Crossfade switches #active', () => {
  test('GIVEN deck A active with a track — WHEN crossfade completes — THEN activeDeck becomes B', async () => {
    const player = await createInitializedPlayer();
    expect(player.activeDeck).toBe('A');

    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));
    expect(player.activeDeck).toBe('A');

    await player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 100);
    await new Promise((r) => setTimeout(r, 0));

    expect(player.activeDeck).toBe('B');
    player.destroy?.();
  });

  test('GIVEN deck A active — WHEN crossfade completes — THEN deck A is paused', async () => {
    const player = await createInitializedPlayer();

    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    await player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 100);
    await new Promise((r) => setTimeout(r, 0));

    const deckA = mockAudios[0];
    expect(deckA.paused).toBe(true);
    player.destroy?.();
  });

  test('GIVEN deck B active after first crossfade — WHEN second crossfade completes — THEN activeDeck returns to A', async () => {
    const player = await createInitializedPlayer();

    await player.play('blob:http://localhost/track-1');
    await new Promise((r) => setTimeout(r, 0));

    await player.crossfadeToDeck(null, 'blob:http://localhost/track-2', 100);
    await new Promise((r) => setTimeout(r, 0));
    expect(player.activeDeck).toBe('B');

    await player.crossfadeToDeck(null, 'blob:http://localhost/track-3', 100);
    await new Promise((r) => setTimeout(r, 0));
    expect(player.activeDeck).toBe('A');

    expect(mockAudios[0].paused).toBe(false);
    expect(mockAudios[1].paused).toBe(true);
    player.destroy?.();
  });
});

describe('SPEC-1.1.4 — Incoming deck playback ensured', () => {
  test('GIVEN crossfade completes normally — THEN incoming deck is playing', async () => {
    const player = await createInitializedPlayer();

    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    await player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 100);
    await new Promise((r) => setTimeout(r, 0));

    const deckB = mockAudios[1];
    expect(deckB.paused).toBe(false);
    player.destroy?.();
  });

  test('GIVEN incoming deck got paused during transition — THEN playback is resumed automatically', async () => {
    const player = await createInitializedPlayer();

    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    const deckB = mockAudios[1];
    const originalPlay = deckB.play.bind(deckB);
    let playCallCount = 0;
    deckB.play = () => {
      playCallCount++;
      if (playCallCount === 1) {
        return originalPlay().then(() => { deckB.paused = true; });
      }
      return originalPlay();
    };

    await player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 100);
    await new Promise((r) => setTimeout(r, 0));

    expect(player.activeDeck).toBe('B');
    expect(deckB.paused).toBe(false);
    expect(playCallCount).toBe(2);
    player.destroy?.();
  });
});

describe('SPEC-1.1.5 — Default play target', () => {
  test('GIVEN no active playback — WHEN play(source) is called — THEN it starts on deck A', async () => {
    const player = await createInitializedPlayer();

    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    expect(player.activeDeck).toBe('A');
    expect(mockAudios[0].paused).toBe(false);
    player.destroy?.();
  });
});

describe('SPEC-1.1.6 — Outgoing deck resolution', () => {
  test('GIVEN volB >= volA — WHEN crossfade without explicit target — THEN B is the outgoing deck', async () => {
    const player = await createInitializedPlayer();

    // Set up: play on A, then manually set volumes so B is louder
    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    // Make deck B volume higher than A
    mockAudios[0].volume = 0.3;
    mockAudios[1].volume = 0.8;

    const events = [];
    player.addEventListener('transitionmode', (e) => {
      events.push(e.detail);
    });

    await player.crossfadeToDeck(null, 'blob:http://localhost/track-c', 100);
    await new Promise((r) => setTimeout(r, 0));

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].fromDeck).toBe('B');
    expect(events[0].toDeck).toBe('A');
    player.destroy?.();
  });
});

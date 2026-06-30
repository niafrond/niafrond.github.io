/**
 * Spec-driven tests for §14.4 — Volume global
 * References: SPEC-14.4.3, SPEC-14.4.4
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
    createMediaElementSource() { return { connect() {}, disconnect() {} }; }
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

  localStorage.clear();
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
  await new Promise((r) => setTimeout(r, 0));
  return player;
}

// ── SPEC-14.4.3 — Global volume multiplies effective deck volumes ────────────

describe('SPEC-14.4.3 — globalVolume scales effective audio volumes', () => {
  test('default globalVolume is 1 — deck A gets full volume', async () => {
    const player = await createInitializedPlayer();
    const audioA = mockAudios[0];
    expect(player.globalVolume).toBe(1);
    // Deck A starts at volume 1 × comp × globalVolume(1)
    expect(audioA.volume).toBeCloseTo(1, 5);
    player.destroy?.();
  });

  test('GIVEN globalVolume=0.5 — THEN effective deck volumes are halved', async () => {
    const player = await createInitializedPlayer();
    const audioA = mockAudios[0];
    player.setGlobalVolume(0.5);
    // Deck A base=1, comp≈1, globalVolume=0.5 → effective ≈ 0.5
    expect(audioA.volume).toBeCloseTo(0.5, 5);
    player.destroy?.();
  });

  test('GIVEN globalVolume=0 — THEN all decks are muted', async () => {
    const player = await createInitializedPlayer();
    const audioA = mockAudios[0];
    const audioB = mockAudios[1];
    player.setGlobalVolume(0);
    expect(audioA.volume).toBe(0);
    expect(audioB.volume).toBe(0);
    player.destroy?.();
  });

  test('setGlobalVolume clamps values above 1 to 1', async () => {
    const player = await createInitializedPlayer();
    player.setGlobalVolume(2);
    expect(player.globalVolume).toBe(1);
    player.destroy?.();
  });

  test('setGlobalVolume clamps values below 0 to 0', async () => {
    const player = await createInitializedPlayer();
    player.setGlobalVolume(-0.5);
    expect(player.globalVolume).toBe(0);
    player.destroy?.();
  });
});

// ── SPEC-14.4.4 — Persistence ───────────────────────────────────────────────

describe('SPEC-14.4.4 — globalVolume key in STORAGE_KEYS', () => {
  test('STORAGE_KEYS contains globalVolume key', async () => {
    const { STORAGE_KEYS } = await import('../../../lib/storageKeys.js');
    expect(STORAGE_KEYS.globalVolume).toBe('dj-mix:global-volume');
  });
});

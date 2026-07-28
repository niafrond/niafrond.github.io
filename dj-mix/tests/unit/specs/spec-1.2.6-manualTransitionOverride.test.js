/**
 * Spec-driven tests for §1.2.6 — Reprise manuelle pendant une transition
 * References: SPEC-1.2.6.1, SPEC-1.2.6.2, SPEC-1.2.6.3, SPEC-1.2.6.4
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// ── Mock Audio element (identique à spec-1.1-doubleDeck.test.js) ───────────

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
      return { gain: { value: 1, setTargetAtTime() {} }, connect() {}, disconnect() {} };
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
  // Mode "interval" (pas cut_transition) avec une durée assez longue pour laisser le temps
  // d'annuler la transition en plein vol (l'intervalle tourne toutes les 30ms, cf. player.js).
  player.setTransitionMode('crossfade_linear');
  player.crossfadeDuration = 2000;
  await player.init();
  await new Promise((r) => setTimeout(r, 0));
  return player;
}

// ── SPEC-1.2.6 — Reprise manuelle pendant une transition ───────────────────

describe('SPEC-1.2.6.1 — bouger le mix-slider annule la transition en cours', () => {
  test('setDeckMixRatio() (appelé par le slider) interrompt un crossfade en vol', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    const crossfadePromise = player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 2000);
    await new Promise((r) => setTimeout(r, 60));
    expect(player.isCrossfading).toBe(true);

    player.setDeckMixRatio(0.5, 10);

    const result = await crossfadePromise;
    expect(result).toBe(false);
    expect(player.isCrossfading).toBe(false);
    player.destroy?.();
  });

  test('cancelActiveTransition() émet "transitioncancelled" avec fromDeck/toDeck/mode', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    const crossfadePromise = player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 2000);
    await new Promise((r) => setTimeout(r, 60));

    const cancelledEvents = [];
    player.addEventListener('transitioncancelled', (e) => cancelledEvents.push(e.detail));

    expect(player.cancelActiveTransition()).toBe(true);
    await crossfadePromise;

    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0]).toMatchObject({ fromDeck: 'A', toDeck: 'B', mode: 'crossfade_linear' });
    player.destroy?.();
  });
});

describe('SPEC-1.2.6.2 — pas de handoff définitif sur annulation', () => {
  test('la platine sortante reste chargée et audible (pas de pause / src vidé)', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    const deckA = mockAudios[0];
    const crossfadePromise = player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 2000);
    await new Promise((r) => setTimeout(r, 60));

    player.cancelActiveTransition();
    await crossfadePromise;

    expect(deckA.src).not.toBe('');
    expect(deckA.paused).toBe(false);

    const deckB = mockAudios[1];
    expect(deckB.paused).toBe(false);
    player.destroy?.();
  });
});

describe('SPEC-1.2.6.3 — retour false, pas de bascule de #active', () => {
  test('activeDeck reste sur la platine sortante après annulation (aucun morceau n\'est réellement devenu actif)', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));
    expect(player.activeDeck).toBe('A');

    const crossfadePromise = player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 2000);
    await new Promise((r) => setTimeout(r, 60));

    player.cancelActiveTransition();
    const result = await crossfadePromise;

    expect(result).toBe(false);
    expect(player.activeDeck).toBe('A');
    player.destroy?.();
  });
});

describe('SPEC-1.2.6.4 — cancelActiveTransition() est un no-op sûr hors transition', () => {
  test('renvoie false quand aucune transition n\'est en cours', async () => {
    const player = await createInitializedPlayer();
    expect(player.cancelActiveTransition()).toBe(false);
    player.destroy?.();
  });

  test('un second appel après résolution ne fait rien (pas de double résolution de Promise)', async () => {
    const player = await createInitializedPlayer();
    await player.play('blob:http://localhost/track-a');
    await new Promise((r) => setTimeout(r, 0));

    const crossfadePromise = player.crossfadeToDeck(null, 'blob:http://localhost/track-b', 2000);
    await new Promise((r) => setTimeout(r, 60));

    expect(player.cancelActiveTransition()).toBe(true);
    await crossfadePromise;
    expect(player.cancelActiveTransition()).toBe(false);
    player.destroy?.();
  });
});

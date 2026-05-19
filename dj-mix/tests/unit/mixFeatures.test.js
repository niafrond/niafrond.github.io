/**
 * mixFeatures.test.js — Tests unitaires pour dj-mix/lib/mixFeatures.js
 *
 * Vérifie que l'AudioContext n'est PAS créé tant qu'aucun effet n'est activé,
 * ce qui corrige le bug de progression figée à 0:01.
 */

// ─── Mock AudioContext ────────────────────────────────────────────────────────

let audioCtxConstructorCalls = 0;
let mediaElementSourceCalls = 0;

function createAudioContextMock() {
  audioCtxConstructorCalls += 1;

  const createPassThroughNode = () => ({
    connect: () => {},
  });

  const ctx = {
    state: 'running',
    destination: {},
    close: () => Promise.resolve(),
    createMediaElementSource: (el) => {
      mediaElementSourceCalls += 1;
      return { connect: () => {} };
    },
    createGain: () => ({
      connect: () => {},
      gain: { value: 1, cancelScheduledValues: () => {}, setTargetAtTime: () => {} },
    }),
    createChannelSplitter: () => createPassThroughNode(),
    createChannelMerger: () => createPassThroughNode(),
    createAnalyser: () => ({
      connect: () => {},
      fftSize: 1024,
      getFloatTimeDomainData: (buffer) => buffer.fill(0),
    }),
    createDelay: () => ({
      connect: () => {},
      delayTime: { value: 0 },
    }),
    createWaveShaper: () => ({
      connect: () => {},
      curve: null,
      oversample: 'none',
    }),
    createBiquadFilter: () => ({
      connect: () => {},
      type: 'allpass',
      frequency: { value: 18000, cancelScheduledValues: () => {}, setTargetAtTime: () => {} },
      Q: { value: 0.7, cancelScheduledValues: () => {}, setTargetAtTime: () => {} },
    }),
  };
  return ctx;
}

beforeAll(() => {
  window.AudioContext = createAudioContextMock;
  window.webkitAudioContext = createAudioContextMock;
});

beforeEach(() => {
  audioCtxConstructorCalls = 0;
  mediaElementSourceCalls = 0;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAudioEl() {
  return {
    paused: true,
    currentTime: 0,
    duration: NaN,
    playbackRate: 1,
    volume: 1,
    src: '',
    currentSrc: '',
    play: () => Promise.resolve(),
    pause: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// ─── Import ───────────────────────────────────────────────────────────────────

import { SimpleMixFeatures, computeAdaptiveMidSideGains } from '../../lib/mixFeatures.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SimpleMixFeatures — lazy AudioContext creation', () => {
  test('AudioContext NOT created when all features are disabled (default)', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ autoBpm: false, echo: false, distortion: false });

    expect(audioCtxConstructorCalls).toBe(0);
  });

  test('createMediaElementSource NOT called when all features are disabled', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ autoBpm: false, echo: false, distortion: false });

    expect(mediaElementSourceCalls).toBe(0);
  });

  test('AudioContext IS created when echo is enabled', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ autoBpm: false, echo: true, distortion: false });

    expect(audioCtxConstructorCalls).toBe(1);
    expect(mediaElementSourceCalls).toBe(2); // deck A + deck B
  });

  test('echo keeps the original deck source while creating an auxiliary wet path', async () => {
    const audioA = { ...makeAudioEl(), src: 'track-a.mp3', currentSrc: 'track-a.mp3' };
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ echo: true });
    features.setDeckSourceMetadata('A', {
      url: 'track-a.mp3',
      stems: { vocalsUrl: 'track-a-vocals.mp3', echoUrl: 'track-a-echo.mp3' },
    });

    expect(audioA.src).toBe('track-a.mp3');
    expect(audioA.currentSrc).toBe('track-a.mp3');
    expect(mediaElementSourceCalls).toBe(3);
  });

  test('AudioContext IS created when autoBpm is enabled', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ autoBpm: true, echo: false, distortion: false });

    expect(audioCtxConstructorCalls).toBe(1);
  });

  test('AudioContext IS created when distortion is enabled', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ autoBpm: false, echo: false, distortion: true });

    expect(audioCtxConstructorCalls).toBe(1);
  });

  test('AudioContext IS created when deck vocal removal is enabled', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ deckFx: { A: { vocalRemove: true } } });

    expect(audioCtxConstructorCalls).toBe(1);
    expect(mediaElementSourceCalls).toBe(2);
  });

  test('AudioContext created only once when features toggled on then off', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    // Enable once
    await features.setEnabled({ echo: true });
    // Disable again
    await features.setEnabled({ echo: false, autoBpm: false, distortion: false });

    expect(audioCtxConstructorCalls).toBe(1);
  });

  test('setEnabled with all-false on fresh instance is safe and does not throw', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await expect(
      features.setEnabled({ autoBpm: false, echo: false, distortion: false }),
    ).resolves.toBeUndefined();
  });
});

describe('SimpleMixFeatures — tick() without AudioContext', () => {
  test('tick() does not throw when no features enabled and both decks paused', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ autoBpm: false, echo: false, distortion: false });

    expect(() => features.tick('A')).not.toThrow();
    expect(audioCtxConstructorCalls).toBe(0);
  });

  test('tick() adjusts playbackRate when autoBpm enabled and both decks playing', async () => {
    const audioA = { ...makeAudioEl(), paused: false, currentTime: 1.0, playbackRate: 1 };
    const audioB = { ...makeAudioEl(), paused: false, currentTime: 1.5, playbackRate: 1 };
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ autoBpm: true });

    features.tick('A');

    // inactive deck (B) should have its playbackRate adjusted
    expect(audioB.playbackRate).not.toBe(1);
  });
});

describe('SimpleMixFeatures — destroy()', () => {
  test('destroy() is safe when AudioContext was never created', async () => {
    const audioA = makeAudioEl();
    const audioB = makeAudioEl();
    const features = new SimpleMixFeatures(audioA, audioB);

    await features.setEnabled({ autoBpm: false, echo: false, distortion: false });

    expect(() => features.destroy()).not.toThrow();
    expect(audioA.playbackRate).toBe(1);
    expect(audioB.playbackRate).toBe(1);
  });
});

describe('computeAdaptiveMidSideGains()', () => {
  test('attenuates mid harder for vocal removal on mid-heavy tracks', () => {
    const gains = computeAdaptiveMidSideGains('vocalRemove', 0.92, 0.08);

    expect(gains.midGain).toBeLessThan(0.2);
    expect(gains.sideGain).toBeGreaterThan(0.9);
    expect(gains.midGain).toBeLessThan(gains.sideGain);
  });

  test('attenuates side harder for instrumental removal on wide tracks', () => {
    const gains = computeAdaptiveMidSideGains('instruRemove', 0.18, 0.82);

    expect(gains.sideGain).toBeLessThan(0.25);
    expect(gains.midGain).toBeGreaterThan(0.9);
    expect(gains.sideGain).toBeLessThan(gains.midGain);
  });

  test('keeps more of the target band when the song is poorly separated', () => {
    const gains = computeAdaptiveMidSideGains('vocalRemove', 0.52, 0.48);

    expect(gains.midGain).toBeGreaterThan(0.4);
    expect(gains.sideGain).toBeGreaterThan(0.9);
  });
});

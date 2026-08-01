/**
 * reverseEngine.test.js — Tests unitaires pour dj-mix/lib/reverseEngine.js
 * Référence SPEC-1.3.6.6 (dj-mix/SPECS.md) : vrai reverse audio (buffer inversé), en
 * remplacement des sauts répétés de `HTMLAudioElement.currentTime` (saccadés).
 */
import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { prepareReversedWindow, ReverseGrainEngine } from '../../lib/reverseEngine.js';

function makeFakeBuffer(numberOfChannels, length, sampleRate, fill) {
  const channels = Array.from({ length: numberOfChannels }, (_, ch) => {
    const data = new Float32Array(length);
    if (fill) for (let i = 0; i < length; i++) data[i] = fill(i, ch);
    return data;
  });
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels,
    getChannelData: (ch) => channels[ch],
  };
}

function makeFakeContext({ currentTime = 100, sampleRate = 1000, fullBufferSeconds = 30, fill } = {}) {
  const bufferSourceNodes = [];
  const gainNodes = [];
  const ctx = {
    currentTime,
    createBuffer: (channels, length, rate) => makeFakeBuffer(channels, length, rate),
    decodeAudioData: () => Promise.resolve(makeFakeBuffer(1, fullBufferSeconds * sampleRate, sampleRate, fill)),
    createBufferSource: () => {
      const node = {
        buffer: null,
        playbackRate: { setValueAtTime: jest.fn() },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        disconnect: jest.fn(),
      };
      bufferSourceNodes.push(node);
      return node;
    },
    createGain: () => {
      const node = {
        gain: {
          setValueAtTime: jest.fn(),
          linearRampToValueAtTime: jest.fn(),
        },
        connect: jest.fn(),
        disconnect: jest.fn(),
      };
      gainNodes.push(node);
      return node;
    },
  };
  return { ctx, bufferSourceNodes, gainNodes };
}

describe('prepareReversedWindow', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('fetches the given url and decodes it', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx } = makeFakeContext({ sampleRate: 1000, fullBufferSeconds: 30 });

    await prepareReversedWindow(ctx, 'blob:track', 10, 2);

    expect(global.fetch).toHaveBeenCalledWith('blob:track');
  });

  test('retains only a small window (windowSec + margin), not the whole decoded buffer', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx } = makeFakeContext({ sampleRate: 1000, fullBufferSeconds: 30 });

    const windowBuffer = await prepareReversedWindow(ctx, 'blob:track', 10, 2);

    expect(windowBuffer.length).toBe(2150); // (2 + 0.15 margin) x 1000Hz
    expect(windowBuffer.sampleRate).toBe(1000);
  });

  test('clamps the window to the start of the track when anchorSec - windowSec would go negative', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx } = makeFakeContext({ sampleRate: 1000, fullBufferSeconds: 30 });

    // anchorSec=0.5s -> only 500 samples exist before it, far less than the requested window.
    const windowBuffer = await prepareReversedWindow(ctx, 'blob:track', 0.5, 2);

    expect(windowBuffer.length).toBe(500);
  });

  test('samples come out in reverse order — playing the result forward sounds like the source backward', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    // Fills the fake full buffer with an ascending ramp (sample value == its own index) so
    // reversal is trivially verifiable: reversed[0] must equal source[endSample - 1], etc.
    const { ctx } = makeFakeContext({
      sampleRate: 1000, fullBufferSeconds: 1, fill: (i) => i,
    });

    const windowBuffer = await prepareReversedWindow(ctx, 'blob:track', 0.5, 0.2); // endSample=500
    const data = windowBuffer.getChannelData(0);

    expect(data[0]).toBe(499); // last sample before the anchor, now first
    expect(data[1]).toBe(498);
    expect(data[data.length - 1]).toBe(499 - (data.length - 1));
  });

  test('every channel is reversed independently', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const originalDecode = jest.fn(() => Promise.resolve({
      sampleRate: 1000,
      length: 1000,
      numberOfChannels: 2,
      getChannelData: (ch) => {
        const data = new Float32Array(1000);
        for (let i = 0; i < 1000; i++) data[i] = ch === 0 ? i : -i;
        return data;
      },
    }));
    const ctx = {
      currentTime: 0,
      createBuffer: (channels, length, rate) => makeFakeBuffer(channels, length, rate),
      decodeAudioData: originalDecode,
    };

    const windowBuffer = await prepareReversedWindow(ctx, 'blob:track', 0.5, 0.2);
    expect(windowBuffer.getChannelData(0)[0]).toBe(499);
    expect(windowBuffer.getChannelData(1)[0]).toBe(-499);
  });
});

describe('ReverseGrainEngine', () => {
  test('run() schedules exactly one AudioBufferSourceNode connected through one GainNode to destinationBus', () => {
    const { ctx, bufferSourceNodes, gainNodes } = makeFakeContext({ currentTime: 50 });
    const engine = new ReverseGrainEngine();
    const audioBuffer = makeFakeBuffer(1, 500, 1000); // 0.5s
    const destinationBus = { connect: jest.fn() };

    engine.run({ ctx, destinationBus, audioBuffer });

    expect(bufferSourceNodes).toHaveLength(1);
    expect(gainNodes).toHaveLength(1);
    expect(bufferSourceNodes[0].buffer).toBe(audioBuffer);
    expect(bufferSourceNodes[0].connect).toHaveBeenCalledWith(gainNodes[0]);
    expect(gainNodes[0].connect).toHaveBeenCalledWith(destinationBus);
  });

  test('run() starts immediately at ctx.currentTime and stops after the buffer\'s own duration', () => {
    const { ctx, bufferSourceNodes } = makeFakeContext({ currentTime: 50 });
    const engine = new ReverseGrainEngine();
    const audioBuffer = makeFakeBuffer(1, 500, 1000); // 0.5s @ 1000Hz

    const { durationSec } = engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer });

    expect(durationSec).toBeCloseTo(0.5, 6);
    expect(bufferSourceNodes[0].start).toHaveBeenCalledWith(50);
    expect(bufferSourceNodes[0].stop).toHaveBeenCalledWith(50.52); // t0 + duration + 0.02 margin
  });

  test('run() fades gain in from 0 and out to 0 — no click at grain boundaries', () => {
    const { ctx, gainNodes } = makeFakeContext({ currentTime: 0 });
    const engine = new ReverseGrainEngine();
    const audioBuffer = makeFakeBuffer(1, 500, 1000);

    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer });

    const gain = gainNodes[0].gain;
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    expect(gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 0.5);
  });

  test('a non-default playbackRate shortens the audible duration and is applied to the node', () => {
    const { ctx, bufferSourceNodes } = makeFakeContext({ currentTime: 0 });
    const engine = new ReverseGrainEngine();
    const audioBuffer = makeFakeBuffer(1, 1000, 1000); // 1s of audio

    const { durationSec } = engine.run({
      ctx, destinationBus: { connect: jest.fn() }, audioBuffer, playbackRate: 2,
    });

    expect(durationSec).toBeCloseTo(0.5, 6);
    expect(bufferSourceNodes[0].playbackRate.setValueAtTime).toHaveBeenCalledWith(2, 0);
  });

  test('stop() is idempotent and safe before any run()', () => {
    const engine = new ReverseGrainEngine();
    expect(() => engine.stop()).not.toThrow();
    expect(() => engine.stop()).not.toThrow();
  });

  test('a second run() stops the previous node before scheduling the new one', () => {
    const { ctx, bufferSourceNodes } = makeFakeContext({ currentTime: 0 });
    const engine = new ReverseGrainEngine();
    const audioBuffer = makeFakeBuffer(1, 500, 1000);

    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer });
    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer });

    expect(bufferSourceNodes).toHaveLength(2);
    expect(bufferSourceNodes[0].stop).toHaveBeenCalled();
    expect(bufferSourceNodes[0].disconnect).toHaveBeenCalled();
  });
});

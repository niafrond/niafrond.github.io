import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';
import { createDjFxController } from '../../lib/djFxController.js';

function createController(overrides = {}) {
  return createDjFxController({
    applyMixFeatures: () => {},
    applyTransitionModeSetting: () => {},
    djFxButtons: [],
    getAutomixCurrentPlayingDeck: () => 'A',
    getCurrentIndex: () => 0,
    getCurrentTrackMixData: () => null,
    getDeckDisplayItems: () => ({ A: null, B: null }),
    getDeckMixRatio: () => 0,
    getMixFeatures: () => ({ deckFx: { A: { filterMode: 'off' }, B: { filterMode: 'off' } } }),
    getNextTrackMixData: () => null,
    getPlayer: () => null,
    getQueue: () => [],
    getSelectedTransitionMode: () => 'cut_transition',
    getTrackMixData: () => null,
    setMixFeatureEnabled: () => {},
    setMixFeatures: () => {},
    showToast: jest.fn(),
    transitionModeLabels: {},
    ...overrides,
  });
}

describe('djFxController sampling', () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = window.webkitAudioContext;
  const originalFetch = global.fetch;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    window.webkitAudioContext = originalWebkitAudioContext;
    global.fetch = originalFetch;
  });

  test('waits for AudioContext resume before starting the sampling one-shot', async () => {
    let resolveResume;
    const source = {
      connect: jest.fn(),
      start: jest.fn(),
      playbackRate: { value: 1 },
      buffer: null,
    };
    const gain = {
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
      },
    };
    const fakeDecodedBuffer = { duration: 0.5 };

    class FakeAudioContext {
      constructor() {
        this.state = 'suspended';
        this.currentTime = 4;
        this.destination = { nodeType: 'destination' };
      }

      resume() {
        return new Promise((resolve) => {
          resolveResume = () => {
            this.state = 'running';
            resolve();
          };
        });
      }

      createBufferSource() {
        return source;
      }

      createGain() {
        return gain;
      }

      decodeAudioData() {
        return Promise.resolve(fakeDecodedBuffer);
      }
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = undefined;

    const controller = createController();
    controller.handleDjFxAction('sampling');

    expect(source.start).not.toHaveBeenCalled();

    resolveResume();
    // flush resume + fetch + decodeAudioData promises
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }

    expect(source.start).toHaveBeenCalled();
    expect(gain.connect).toHaveBeenCalledWith(expect.objectContaining({ nodeType: 'destination' }));
  });

  test('only plays samples allowed by getSamplerSoundsSettings', async () => {
    const source = {
      connect: jest.fn(),
      start: jest.fn(),
      playbackRate: { value: 1 },
      buffer: null,
    };
    const gain = {
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
      },
    };
    // Order matches SAMPLER_SOUNDS in djFxController.js: airhorn, stab, laser, siren.
    const decodedBuffersInOrder = [
      { duration: 0.1 },
      { duration: 0.2 },
      { duration: 0.3 },
      { duration: 0.4 },
    ];
    let decodeCallCount = 0;

    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 4;
        this.destination = { nodeType: 'destination' };
      }

      resume() {
        return Promise.resolve();
      }

      createBufferSource() {
        return source;
      }

      createGain() {
        return gain;
      }

      decodeAudioData() {
        const buffer = decodedBuffersInOrder[decodeCallCount % decodedBuffersInOrder.length];
        decodeCallCount += 1;
        return Promise.resolve(buffer);
      }
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = undefined;

    const controller = createController({
      getSamplerSoundsSettings: () => ({
        allowed: { airhorn: false, stab: false, laser: true, siren: false },
      }),
    });
    controller.handleDjFxAction('sampling');

    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }

    expect(source.start).toHaveBeenCalled();
    expect(source.buffer).toBe(decodedBuffersInOrder[2]); // laser is the only allowed sample
  });

  test('shows an error toast and does not play when every sample is disallowed', async () => {
    const source = {
      connect: jest.fn(),
      start: jest.fn(),
      playbackRate: { value: 1 },
      buffer: null,
    };
    const gain = {
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
      },
    };

    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 4;
        this.destination = { nodeType: 'destination' };
      }

      resume() {
        return Promise.resolve();
      }

      createBufferSource() {
        return source;
      }

      createGain() {
        return gain;
      }

      decodeAudioData() {
        return Promise.resolve({ duration: 0.5 });
      }
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = undefined;

    const showToast = jest.fn();
    const controller = createController({
      showToast,
      getSamplerSoundsSettings: () => ({
        allowed: { airhorn: false, stab: false, laser: false, siren: false },
      }),
    });
    controller.handleDjFxAction('sampling');

    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }

    expect(source.start).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('aucun sample autorise'), true);
  });
});

describe('djFxController per-sample buttons', () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = window.webkitAudioContext;
  const originalFetch = global.fetch;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    window.webkitAudioContext = originalWebkitAudioContext;
    global.fetch = originalFetch;
  });

  function setupFakeAudioContext() {
    const source = {
      connect: jest.fn(),
      start: jest.fn(),
      playbackRate: { value: 1 },
      buffer: null,
    };
    const gain = {
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
        setTargetAtTime: jest.fn(),
      },
    };
    // Order matches SAMPLER_SOUNDS in djFxController.js: airhorn, stab, laser, siren.
    const decodedBuffersInOrder = [
      { id: 'airhorn', duration: 0.1 },
      { id: 'stab', duration: 0.2 },
      { id: 'laser', duration: 0.3 },
      { id: 'siren', duration: 0.4 },
    ];
    let decodeCallCount = 0;

    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 4;
        this.destination = { nodeType: 'destination' };
      }

      resume() {
        return Promise.resolve();
      }

      createBufferSource() {
        return source;
      }

      createGain() {
        return gain;
      }

      decodeAudioData() {
        const buffer = decodedBuffersInOrder[decodeCallCount % decodedBuffersInOrder.length];
        decodeCallCount += 1;
        return Promise.resolve(buffer);
      }
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = undefined;

    return { source, decodedBuffersInOrder };
  }

  test.each([
    ['samplingAirhorn', 0],
    ['samplingStab', 1],
    ['samplingLaser', 2],
    ['samplingSiren', 3],
  ])('%s always plays its own sample regardless of random draw', async (action, expectedIndex) => {
    const { source, decodedBuffersInOrder } = setupFakeAudioContext();
    const controller = createController();

    controller.handleDjFxAction(action);

    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }

    expect(source.start).toHaveBeenCalled();
    expect(source.buffer).toBe(decodedBuffersInOrder[expectedIndex]);
  });

  test('a per-sample button shows an error toast and does not play when its sample is disallowed', async () => {
    const { source } = setupFakeAudioContext();
    const showToast = jest.fn();
    const controller = createController({
      showToast,
      getSamplerSoundsSettings: () => ({
        allowed: { airhorn: false, stab: true, laser: true, siren: true },
      }),
    });

    controller.handleDjFxAction('samplingAirhorn');

    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }

    expect(source.start).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('non autorise'), true);
  });
});
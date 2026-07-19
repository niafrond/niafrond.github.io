import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';
import { createDjFxController } from '../../lib/djFxController.js';
import { uiState } from '../../lib/uiState.js';

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

describe('djFxController triggerBeatRepeatTransitionFx', () => {
  let seekCalls;
  let playerMock;
  let savedLastDeckState;

  beforeEach(() => {
    jest.useFakeTimers();
    seekCalls = { A: [], B: [] };
    playerMock = {
      seekDeckTo: jest.fn((deck, ms) => {
        seekCalls[deck === 'B' ? 'B' : 'A'].push(ms);
        return Promise.resolve();
      }),
    };
    savedLastDeckState = uiState.lastDeckState;
  });

  afterEach(() => {
    jest.useRealTimers();
    uiState.lastDeckState = savedLastDeckState;
  });

  test('is exported as a function', () => {
    const controller = createDjFxController({
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
    });
    expect(typeof controller.triggerBeatRepeatTransitionFx).toBe('function');
  });

  test('does not throw when no player is available', () => {
    const controller = createDjFxController({
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
    });
    expect(() => controller.triggerBeatRepeatTransitionFx('A', 'B', 3900, 120)).not.toThrow();
  });

  test('triggers seekDeckTo on outgoing deck immediately at BPM-synced window', () => {
    uiState.lastDeckState = {
      activeDeck: 'A',
      isCrossfading: true,
      deckA: { positionMs: 45000, durationMs: 180000, playing: true, volume: 1, playbackRate: 1, hasSrc: true, loudnessDb: null },
      deckB: { positionMs: 1000, durationMs: 200000, playing: true, volume: 0, playbackRate: 1, hasSrc: true, loudnessDb: null },
    };

    const controller = createDjFxController({
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
      getPlayer: () => playerMock,
      getQueue: () => [],
      getSelectedTransitionMode: () => 'cut_transition',
      getTrackMixData: () => null,
      setMixFeatureEnabled: () => {},
      setMixFeatures: () => {},
      showToast: jest.fn(),
      transitionModeLabels: {},
    });

    // 120 BPM → eighthNote = 250ms, window = 250ms
    // outgoing = A, positionMs = 45000, loopStart = 45000 - 250 = 44750
    controller.triggerBeatRepeatTransitionFx('A', 'B', 3900, 120);

    jest.advanceTimersByTime(250);
    expect(playerMock.seekDeckTo).toHaveBeenCalledWith('A', 44750, { instant: true });
  });

  test('computes BPM-synced window: 128 BPM → 234ms', () => {
    uiState.lastDeckState = {
      activeDeck: 'B',
      isCrossfading: true,
      deckA: { positionMs: 1000, durationMs: 200000, playing: true, volume: 0, playbackRate: 1, hasSrc: true, loudnessDb: null },
      deckB: { positionMs: 60000, durationMs: 200000, playing: true, volume: 1, playbackRate: 1, hasSrc: true, loudnessDb: null },
    };

    const controller = createDjFxController({
      applyMixFeatures: () => {},
      applyTransitionModeSetting: () => {},
      djFxButtons: [],
      getAutomixCurrentPlayingDeck: () => 'B',
      getCurrentIndex: () => 0,
      getCurrentTrackMixData: () => null,
      getDeckDisplayItems: () => ({ A: null, B: null }),
      getDeckMixRatio: () => 0.6,
      getMixFeatures: () => ({ deckFx: { A: { filterMode: 'off' }, B: { filterMode: 'off' } } }),
      getNextTrackMixData: () => null,
      getPlayer: () => playerMock,
      getQueue: () => [],
      getSelectedTransitionMode: () => 'cut_transition',
      getTrackMixData: () => null,
      setMixFeatureEnabled: () => {},
      setMixFeatures: () => {},
      showToast: jest.fn(),
      transitionModeLabels: {},
    });

    // 128 BPM → eighthNote = round(30000/128) = 234ms, loopStart = 60000 - 234 = 59766
    controller.triggerBeatRepeatTransitionFx('B', 'A', 3900, 128);

    jest.advanceTimersByTime(234);
    expect(playerMock.seekDeckTo).toHaveBeenCalledWith('B', 59766, { instant: true });
  });

  test('triggers seekDeckTo on incoming deck after 350ms delay', () => {
    uiState.lastDeckState = {
      activeDeck: 'A',
      isCrossfading: true,
      deckA: { positionMs: 45000, durationMs: 180000, playing: true, volume: 1, playbackRate: 1, hasSrc: true, loudnessDb: null },
      deckB: { positionMs: 800, durationMs: 200000, playing: true, volume: 0, playbackRate: 1, hasSrc: true, loudnessDb: null },
    };

    const controller = createDjFxController({
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
      getPlayer: () => playerMock,
      getQueue: () => [],
      getSelectedTransitionMode: () => 'cut_transition',
      getTrackMixData: () => null,
      setMixFeatureEnabled: () => {},
      setMixFeatures: () => {},
      showToast: jest.fn(),
      transitionModeLabels: {},
    });

    controller.triggerBeatRepeatTransitionFx('A', 'B', 3900, 120);

    // Incoming deck loop should not start yet (before 350ms)
    jest.advanceTimersByTime(349);
    const callsBefore = playerMock.seekDeckTo.mock.calls.filter(c => c[0] === 'B').length;
    expect(callsBefore).toBe(0);

    // Update incoming deck state before 350ms fires
    uiState.lastDeckState = {
      ...uiState.lastDeckState,
      deckB: { positionMs: 350, durationMs: 200000, playing: true, volume: 0, playbackRate: 1, hasSrc: true, loudnessDb: null },
    };

    // After 350ms, incoming deck loop starts
    // 120 BPM → window=250ms, anchor=max(250, 350)=350, loopStart=350-250=100
    jest.advanceTimersByTime(1);
    jest.advanceTimersByTime(250);
    expect(playerMock.seekDeckTo).toHaveBeenCalledWith('B', 100, { instant: true });
  });

  test('falls back to default 120 BPM when bpm is undefined', () => {
    uiState.lastDeckState = {
      activeDeck: 'A',
      isCrossfading: true,
      deckA: { positionMs: 30000, durationMs: 180000, playing: true, volume: 1, playbackRate: 1, hasSrc: true, loudnessDb: null },
      deckB: { positionMs: 0, durationMs: 0, playing: false, volume: 0, playbackRate: 1, hasSrc: false, loudnessDb: null },
    };

    const controller = createDjFxController({
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
      getPlayer: () => playerMock,
      getQueue: () => [],
      getSelectedTransitionMode: () => 'cut_transition',
      getTrackMixData: () => null,
      setMixFeatureEnabled: () => {},
      setMixFeatures: () => {},
      showToast: jest.fn(),
      transitionModeLabels: {},
    });

    // No BPM provided → default 120 BPM → window = 250ms, loopStart = 30000 - 250 = 29750
    controller.triggerBeatRepeatTransitionFx('A', 'B', 3900, undefined);

    jest.advanceTimersByTime(250);
    expect(playerMock.seekDeckTo).toHaveBeenCalledWith('A', 29750, { instant: true });
  });
});

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
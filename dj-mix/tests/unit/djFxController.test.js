import { createDjFxController } from '../../lib/djFxController.js';

function createController() {
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
  });
}

describe('djFxController sampling', () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = window.webkitAudioContext;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    window.webkitAudioContext = originalWebkitAudioContext;
  });

  test('waits for AudioContext resume before starting the sampling one-shot', async () => {
    let resolveResume;
    const osc = {
      connect: jest.fn(),
      frequency: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      start: jest.fn(),
      stop: jest.fn(),
      type: 'sine',
    };
    const filter = {
      connect: jest.fn(),
      frequency: { setValueAtTime: jest.fn() },
      Q: { setValueAtTime: jest.fn() },
      type: 'lowpass',
    };
    const gain = {
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
    };

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

      createOscillator() {
        return osc;
      }

      createBiquadFilter() {
        return filter;
      }

      createGain() {
        return gain;
      }
    }

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = undefined;

    const controller = createController();
    controller.handleDjFxAction('sampling');

    expect(osc.start).not.toHaveBeenCalled();
    expect(osc.stop).not.toHaveBeenCalled();

    resolveResume();
    await Promise.resolve();
    await Promise.resolve();

    expect(osc.start).toHaveBeenCalledWith(4.01);
    expect(osc.stop).toHaveBeenCalledWith(4.63);
    expect(gain.connect).toHaveBeenCalledWith(expect.objectContaining({ nodeType: 'destination' }));
  });
});
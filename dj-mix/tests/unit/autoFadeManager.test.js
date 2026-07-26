import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { AutoFadeManager } from '../../lib/autoFadeManager.js';

function makeManager(overrides = {}) {
  const perform = jest.fn().mockResolvedValue(undefined);
  const onSkipLocked = jest.fn();
  const onStart = jest.fn();
  const onEnd = jest.fn();
  const onError = jest.fn();
  const manager = new AutoFadeManager({
    getQueueLength: () => 3,
    getCurrentIndex: () => 2,
    getQueueLoopEnabled: () => false,
    isPlayerCrossfading: () => false,
    isLocked: () => false,
    onStart,
    onEnd,
    onSkipLocked,
    onError,
    perform,
    ...overrides,
  });
  return { manager, perform, onSkipLocked, onStart, onEnd, onError };
}

describe('AutoFadeManager', () => {
  describe('getNextIndex()', () => {
    // SPEC-5.7.4
    test('returns current+1 when a next track exists in queue', () => {
      const { manager } = makeManager({ getQueueLength: () => 3, getCurrentIndex: () => 0 });
      expect(manager.getNextIndex()).toBe(1);
    });

    test('returns -1 at end of queue when loop is disabled (defers to fil rouge fallback)', () => {
      const { manager } = makeManager({
        getQueueLength: () => 3,
        getCurrentIndex: () => 2,
        getQueueLoopEnabled: () => false,
      });
      expect(manager.getNextIndex()).toBe(-1);
    });

    test('wraps to 0 at end of queue only when loop is explicitly enabled', () => {
      const { manager } = makeManager({
        getQueueLength: () => 3,
        getCurrentIndex: () => 2,
        getQueueLoopEnabled: () => true,
      });
      expect(manager.getNextIndex()).toBe(0);
    });

    test('returns -1 for a single-item queue regardless of loop setting', () => {
      const { manager } = makeManager({ getQueueLength: () => 1, getCurrentIndex: () => 0 });
      expect(manager.getNextIndex()).toBe(-1);
    });
  });

  describe('handleReady()', () => {
    // SPEC-5.7.5
    test('skips without performing when the player is already crossfading', async () => {
      const { manager, perform } = makeManager({ isPlayerCrossfading: () => true });
      await manager.handleReady();
      expect(perform).not.toHaveBeenCalled();
    });

    test('performs the transition when nothing else is crossfading', async () => {
      const { manager, perform } = makeManager({ getCurrentIndex: () => 0 });
      await manager.handleReady();
      expect(perform).toHaveBeenCalledWith(1);
    });

    test('does not perform when locked', async () => {
      const { manager, perform, onSkipLocked } = makeManager({ isLocked: () => true });
      await manager.handleReady();
      expect(perform).not.toHaveBeenCalled();
      expect(onSkipLocked).toHaveBeenCalled();
    });

    test('does not perform when at end of queue with loop disabled', async () => {
      const { manager, perform } = makeManager({ getCurrentIndex: () => 2, getQueueLoopEnabled: () => false });
      await manager.handleReady();
      expect(perform).not.toHaveBeenCalled();
    });
  });
});

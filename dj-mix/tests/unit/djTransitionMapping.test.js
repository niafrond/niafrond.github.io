import {
  DJ_TRANSITION_TYPE_TO_MODE,
  mapDjTransitionTypeToMode,
  computeDjBpmRate,
  isDjTransitionFresh,
} from '../../lib/djTransitionMapping.js';

describe('djTransitionMapping', () => {
  describe('mapDjTransitionTypeToMode', () => {
    test('maps each known transitionType to its automix mode', () => {
      for (const [transitionType, mode] of Object.entries(DJ_TRANSITION_TYPE_TO_MODE)) {
        expect(mapDjTransitionTypeToMode(transitionType)).toBe(mode);
      }
    });

    test('returns null for unknown transitionType', () => {
      expect(mapDjTransitionTypeToMode('something_unknown')).toBeNull();
      expect(mapDjTransitionTypeToMode(undefined)).toBeNull();
      expect(mapDjTransitionTypeToMode(null)).toBeNull();
    });
  });

  describe('computeDjBpmRate', () => {
    test('returns the ratio of recommendedBpm to nextTrackBpm', () => {
      expect(computeDjBpmRate(126, 120)).toBeCloseTo(126 / 120, 5);
    });

    test('clamps to maxRate when the ratio is too high', () => {
      expect(computeDjBpmRate(200, 100)).toBe(1.15);
    });

    test('clamps to minRate when the ratio is too low', () => {
      expect(computeDjBpmRate(80, 120)).toBe(0.85);
    });

    test('honors custom minRate/maxRate options', () => {
      expect(computeDjBpmRate(200, 100, { maxRate: 1.5 })).toBe(1.5);
      expect(computeDjBpmRate(50, 100, { minRate: 0.5 })).toBe(0.5);
    });

    test('returns null when recommendedBpm is missing/invalid', () => {
      expect(computeDjBpmRate(null, 120)).toBeNull();
      expect(computeDjBpmRate(0, 120)).toBeNull();
      expect(computeDjBpmRate(NaN, 120)).toBeNull();
      expect(computeDjBpmRate(undefined, 120)).toBeNull();
    });

    test('returns null when nextTrackBpm is missing/invalid', () => {
      expect(computeDjBpmRate(128, null)).toBeNull();
      expect(computeDjBpmRate(128, 0)).toBeNull();
      expect(computeDjBpmRate(128, NaN)).toBeNull();
      expect(computeDjBpmRate(128, undefined)).toBeNull();
    });
  });

  describe('isDjTransitionFresh', () => {
    test('returns true for a recent transition pointing at toItemId', () => {
      const djTransition = { toItemId: 'b', computedAt: Date.now() };
      expect(isDjTransitionFresh(djTransition, 'b')).toBe(true);
    });

    test('returns false when toItemId does not match', () => {
      const djTransition = { toItemId: 'b', computedAt: Date.now() };
      expect(isDjTransitionFresh(djTransition, 'c')).toBe(false);
    });

    test('returns false when the transition is older than maxAgeMs', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const djTransition = { toItemId: 'b', computedAt: Date.now() - oneDayMs - 1000 };
      expect(isDjTransitionFresh(djTransition, 'b')).toBe(false);
    });

    test('respects a custom maxAgeMs', () => {
      const djTransition = { toItemId: 'b', computedAt: Date.now() - 5000 };
      expect(isDjTransitionFresh(djTransition, 'b', 10000)).toBe(true);
      expect(isDjTransitionFresh(djTransition, 'b', 1000)).toBe(false);
    });

    test('returns false for null/undefined djTransition or toItemId', () => {
      expect(isDjTransitionFresh(null, 'b')).toBe(false);
      expect(isDjTransitionFresh(undefined, 'b')).toBe(false);
      expect(isDjTransitionFresh({ toItemId: 'b', computedAt: Date.now() }, null)).toBe(false);
    });

    test('returns false when computedAt is missing/invalid', () => {
      expect(isDjTransitionFresh({ toItemId: 'b' }, 'b')).toBe(false);
      expect(isDjTransitionFresh({ toItemId: 'b', computedAt: 'nope' }, 'b')).toBe(false);
    });

    test('matches toItemId loosely via string coercion', () => {
      const djTransition = { toItemId: 5, computedAt: Date.now() };
      expect(isDjTransitionFresh(djTransition, '5')).toBe(true);
    });
  });
});

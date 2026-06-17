import { describe, test, expect } from '@jest/globals';
import { computeDjPlanIndicatorState } from '../../lib/djPlanIndicator.js';

function makeItem(id, overrides = {}) {
  return { id: String(id), name: `Track ${id}`, artist: `Artist ${id}`, ...overrides };
}

function makeTransition(toItemId, overrides = {}) {
  return {
    toItemId: String(toItemId),
    transitionType: 'phrase_mix',
    mixOutSec: 180,
    mixInSec: 5,
    crossfadeDurationSec: 8,
    compatibilityScore: 0.85,
    recommendedBpm: 128,
    decisionId: 'dec-001',
    ...overrides,
  };
}

describe('computeDjPlanIndicatorState', () => {
  describe('DJ Plan OFF', () => {
    test('returns visible: false regardless of playlist state', () => {
      const result = computeDjPlanIndicatorState({
        enabled: false,
        playlist: [makeItem(1, { djTransition: makeTransition(2) }), makeItem(2)],
        playingId: '1',
        currentIndex: 0,
      });
      expect(result).toEqual({ visible: false });
    });

    test('returns visible: false with empty playlist', () => {
      const result = computeDjPlanIndicatorState({ enabled: false, playlist: [], playingId: null, currentIndex: -1 });
      expect(result).toEqual({ visible: false });
    });
  });

  describe('DJ Plan ON — always visible', () => {
    test('no-track: empty playlist, no playingId', () => {
      const result = computeDjPlanIndicatorState({ enabled: true, playlist: [], playingId: null, currentIndex: -1 });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-track');
    });

    test('no-track: playingId not found in playlist', () => {
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [makeItem(1)],
        playingId: '999',
        currentIndex: -1,
      });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-track');
    });

    test('no-track: no playingId and currentIndex is -1', () => {
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [makeItem(1)],
        playingId: null,
        currentIndex: -1,
      });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-track');
    });

    test('no-transition: current item has no djTransition', () => {
      const item = makeItem(1);
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [item],
        playingId: '1',
        currentIndex: 0,
      });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-transition');
      expect(result.item).toBe(item);
    });

    test('no-transition: djTransition is null', () => {
      const item = makeItem(1, { djTransition: null });
      const result = computeDjPlanIndicatorState({ enabled: true, playlist: [item], playingId: '1', currentIndex: 0 });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-transition');
    });

    test('no-transition: djTransition exists but has no toItemId', () => {
      const item = makeItem(1, { djTransition: { transitionType: 'cut_transition' } });
      const result = computeDjPlanIndicatorState({ enabled: true, playlist: [item], playingId: '1', currentIndex: 0 });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-transition');
      expect(result.item).toBe(item);
    });

    test('next-not-found: toItemId points to item missing from playlist', () => {
      const t = makeTransition('999');
      const item = makeItem(1, { djTransition: t });
      const result = computeDjPlanIndicatorState({ enabled: true, playlist: [item], playingId: '1', currentIndex: 0 });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('next-not-found');
      expect(result.item).toBe(item);
      expect(result.transition).toBe(t);
    });

    test('ready: full transition data available', () => {
      const t = makeTransition('2');
      const item = makeItem(1, { djTransition: t });
      const nextItem = makeItem(2);
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [item, nextItem],
        playingId: '1',
        currentIndex: 0,
      });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('ready');
      expect(result.item).toBe(item);
      expect(result.transition).toBe(t);
      expect(result.nextItem).toBe(nextItem);
    });
  });

  describe('playingId takes priority over currentIndex', () => {
    test('uses playingId item when both playingId and currentIndex are valid', () => {
      const itemA = makeItem('a');
      const itemB = makeItem('b', { djTransition: makeTransition('c') });
      const itemC = makeItem('c');
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [itemA, itemB, itemC],
        playingId: 'a',
        currentIndex: 1,
      });
      expect(result.state).toBe('no-transition');
      expect(result.item).toBe(itemA);
    });

    test('falls back to currentIndex when playingId is null', () => {
      const item = makeItem(1, { djTransition: makeTransition(2) });
      const nextItem = makeItem(2);
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [item, nextItem],
        playingId: null,
        currentIndex: 0,
      });
      expect(result.state).toBe('ready');
      expect(result.item).toBe(item);
    });

    test('falls back to currentIndex when playingId not found in playlist', () => {
      const item = makeItem(1, { djTransition: makeTransition(2) });
      const nextItem = makeItem(2);
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [item, nextItem],
        playingId: 'missing',
        currentIndex: 0,
      });
      expect(result.state).toBe('ready');
      expect(result.item).toBe(item);
    });
  });

  describe('ID type coercion', () => {
    test('matches numeric playingId against string item id', () => {
      const item = makeItem('1', { djTransition: makeTransition('2') });
      const nextItem = makeItem('2');
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [item, nextItem],
        playingId: 1,
        currentIndex: 0,
      });
      expect(result.state).toBe('ready');
    });

    test('matches string toItemId against numeric item id', () => {
      const t = { toItemId: '2', transitionType: 'cut_transition' };
      const item = { id: 1, name: 'A', artist: 'X', djTransition: t };
      const nextItem = { id: 2, name: 'B', artist: 'Y' };
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: [item, nextItem],
        playingId: 1,
        currentIndex: 0,
      });
      expect(result.state).toBe('ready');
      expect(result.nextItem).toBe(nextItem);
    });
  });

  describe('edge cases', () => {
    test('last item in playlist has no transition — shows no-transition, not hidden', () => {
      const items = [makeItem(1, { djTransition: makeTransition(2) }), makeItem(2)];
      const result = computeDjPlanIndicatorState({
        enabled: true,
        playlist: items,
        playingId: '2',
        currentIndex: 1,
      });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-transition');
    });

    test('playlist of one item with no transition — shows no-transition, not hidden', () => {
      const item = makeItem(1);
      const result = computeDjPlanIndicatorState({ enabled: true, playlist: [item], playingId: '1', currentIndex: 0 });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-transition');
    });

    test('switching enabled from false to true with missing data shows fallback, not crash', () => {
      const result = computeDjPlanIndicatorState({ enabled: true, playlist: [], playingId: null, currentIndex: -1 });
      expect(result.visible).toBe(true);
      expect(result.state).toBe('no-track');
    });
  });
});

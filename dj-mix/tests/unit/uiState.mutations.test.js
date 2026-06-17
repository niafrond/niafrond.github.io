import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  uiState,
  setCurrentIndex,
  setCurrentTrackId,
  setIsPlaying,
  setDeckDisplayItem,
  setDeckBCueIndex,
  setDeckCueDeck,
  setDeckMixRatio,
  setPrevIsCrossfading,
  setLastDeckState,
} from '../../lib/uiState.js';

function resetState() {
  uiState.queue = [];
  uiState.currentIndex = -1;
  uiState.currentTrackId = null;
  uiState.isPlaying = false;
  uiState.deckDisplayItems = { A: null, B: null };
  uiState.deckBCueIndex = -1;
  uiState.deckCueDeck = null;
  uiState.deckMixRatio = 0;
  uiState.prevIsCrossfading = false;
  uiState.lastDeckState = null;
}

beforeEach(() => {
  resetState();
});

describe('setCurrentIndex', () => {
  test('sets a valid number', () => {
    setCurrentIndex(3);
    expect(uiState.currentIndex).toBe(3);
  });

  test('coerces non-number to -1', () => {
    setCurrentIndex('bad');
    expect(uiState.currentIndex).toBe(-1);
  });

  test('accepts 0', () => {
    setCurrentIndex(0);
    expect(uiState.currentIndex).toBe(0);
  });

  test('does not affect other state fields', () => {
    uiState.isPlaying = true;
    setCurrentIndex(5);
    expect(uiState.isPlaying).toBe(true);
  });
});

describe('setCurrentTrackId', () => {
  test('sets string id', () => {
    setCurrentTrackId('abc');
    expect(uiState.currentTrackId).toBe('abc');
  });

  test('sets numeric id', () => {
    setCurrentTrackId(42);
    expect(uiState.currentTrackId).toBe(42);
  });

  test('null/undefined coerces to null', () => {
    setCurrentTrackId('x');
    setCurrentTrackId(null);
    expect(uiState.currentTrackId).toBe(null);
    setCurrentTrackId(undefined);
    expect(uiState.currentTrackId).toBe(null);
  });
});

describe('setIsPlaying', () => {
  test('sets true', () => {
    setIsPlaying(true);
    expect(uiState.isPlaying).toBe(true);
  });

  test('sets false', () => {
    uiState.isPlaying = true;
    setIsPlaying(false);
    expect(uiState.isPlaying).toBe(false);
  });

  test('coerces truthy value', () => {
    setIsPlaying(1);
    expect(uiState.isPlaying).toBe(true);
  });

  test('coerces falsy value', () => {
    setIsPlaying(0);
    expect(uiState.isPlaying).toBe(false);
  });
});

describe('setDeckDisplayItem', () => {
  const item = { id: '1', name: 'Track A' };

  test('sets deck A', () => {
    setDeckDisplayItem('A', item);
    expect(uiState.deckDisplayItems.A).toBe(item);
    expect(uiState.deckDisplayItems.B).toBe(null);
  });

  test('sets deck B', () => {
    setDeckDisplayItem('B', item);
    expect(uiState.deckDisplayItems.B).toBe(item);
    expect(uiState.deckDisplayItems.A).toBe(null);
  });

  test('clears deck with null', () => {
    uiState.deckDisplayItems.A = item;
    setDeckDisplayItem('A', null);
    expect(uiState.deckDisplayItems.A).toBe(null);
  });

  test('invalid deck name defaults to A', () => {
    setDeckDisplayItem('C', item);
    expect(uiState.deckDisplayItems.A).toBe(item);
  });
});

describe('setDeckBCueIndex', () => {
  test('sets valid index', () => {
    setDeckBCueIndex(2);
    expect(uiState.deckBCueIndex).toBe(2);
  });

  test('coerces non-number to -1', () => {
    setDeckBCueIndex('x');
    expect(uiState.deckBCueIndex).toBe(-1);
  });

  test('accepts -1', () => {
    uiState.deckBCueIndex = 3;
    setDeckBCueIndex(-1);
    expect(uiState.deckBCueIndex).toBe(-1);
  });
});

describe('setDeckCueDeck', () => {
  test("sets 'A'", () => {
    setDeckCueDeck('A');
    expect(uiState.deckCueDeck).toBe('A');
  });

  test("sets 'B'", () => {
    setDeckCueDeck('B');
    expect(uiState.deckCueDeck).toBe('B');
  });

  test('invalid deck coerces to null', () => {
    setDeckCueDeck('C');
    expect(uiState.deckCueDeck).toBe(null);
  });

  test('null clears the value', () => {
    uiState.deckCueDeck = 'A';
    setDeckCueDeck(null);
    expect(uiState.deckCueDeck).toBe(null);
  });
});

describe('setDeckMixRatio', () => {
  test('sets 0.5', () => {
    setDeckMixRatio(0.5);
    expect(uiState.deckMixRatio).toBe(0.5);
  });

  test('sets 0', () => {
    uiState.deckMixRatio = 0.8;
    setDeckMixRatio(0);
    expect(uiState.deckMixRatio).toBe(0);
  });

  test('non-numeric coerces to 0', () => {
    setDeckMixRatio('bad');
    expect(uiState.deckMixRatio).toBe(0);
  });
});

describe('setPrevIsCrossfading', () => {
  test('sets true', () => {
    setPrevIsCrossfading(true);
    expect(uiState.prevIsCrossfading).toBe(true);
  });

  test('sets false', () => {
    uiState.prevIsCrossfading = true;
    setPrevIsCrossfading(false);
    expect(uiState.prevIsCrossfading).toBe(false);
  });
});

describe('setLastDeckState', () => {
  const detail = { activeDeck: 'A', isCrossfading: false, deckA: {}, deckB: {} };

  test('sets a deck state object', () => {
    setLastDeckState(detail);
    expect(uiState.lastDeckState).toBe(detail);
  });

  test('clears with null', () => {
    uiState.lastDeckState = detail;
    setLastDeckState(null);
    expect(uiState.lastDeckState).toBe(null);
  });

  test('undefined coerces to null', () => {
    setLastDeckState(undefined);
    expect(uiState.lastDeckState).toBe(null);
  });
});

describe('no cross-field side effects', () => {
  test('setCurrentIndex does not affect isPlaying or deckMixRatio', () => {
    uiState.isPlaying = true;
    uiState.deckMixRatio = 0.7;
    setCurrentIndex(10);
    expect(uiState.isPlaying).toBe(true);
    expect(uiState.deckMixRatio).toBe(0.7);
  });

  test('setDeckDisplayItem does not affect queue', () => {
    uiState.queue = [{ id: '1', name: 'T' }];
    setDeckDisplayItem('A', { id: '2', name: 'U' });
    expect(uiState.queue).toHaveLength(1);
  });
});

import { chooseRoundPair, makePairKey, pruneStemCacheEntries } from '../../game-logic.js';

describe('mix-blind-test game logic', () => {
  test('chooseRoundPair selects closest BPM pair by default', () => {
    const tracks = [
      { id: 'a', bpm: 90 },
      { id: 'b', bpm: 122 },
      { id: 'c', bpm: 124 },
    ];

    const pair = chooseRoundPair(tracks, new Set(), false, () => 0);
    expect(makePairKey(pair.left, pair.right)).toBe('b__c');
    expect(pair.bpmGap).toBe(2);
  });

  test('chooseRoundPair skips already used pairs', () => {
    const tracks = [
      { id: 'a', bpm: 100 },
      { id: 'b', bpm: 101 },
      { id: 'c', bpm: 140 },
    ];

    const used = new Set(['a__b']);
    const pair = chooseRoundPair(tracks, used, false, () => 0);
    expect(makePairKey(pair.left, pair.right)).toBe('a__c');
  });

  test('pruneStemCacheEntries evicts oldest entries until under limits', () => {
    const now = Date.now();
    const result = pruneStemCacheEntries([
      { key: 'fresh', size: 100, lastUsedAt: now },
      { key: 'mid', size: 100, lastUsedAt: now - 1_000 },
      { key: 'old', size: 100, lastUsedAt: now - 2_000 },
    ], { maxBytes: 250, maxEntries: 2 });

    expect(result.kept.map((item) => item.key)).toEqual(['fresh', 'mid']);
    expect(result.evicted.map((item) => item.key)).toEqual(['old']);
    expect(result.totalBytes).toBe(200);
  });
});

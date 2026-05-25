import { chooseRoundPair, makePairKey, pickRandomTracks, pruneStemCacheEntries } from '../../game-logic.js';

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
    expect(makePairKey(pair.left, pair.right)).toBe('b__c');
  });

  test('chooseRoundPair excludes tracks already used in current game', () => {
    const tracks = [
      { id: 'a', bpm: 100 },
      { id: 'b', bpm: 101 },
      { id: 'c', bpm: 102 },
      { id: 'd', bpm: 140 },
    ];
    const excludedTrackIds = new Set(['b', 'c']);
    const pair = chooseRoundPair(tracks, new Set(), false, () => 0, excludedTrackIds);
    expect(makePairKey(pair.left, pair.right)).toBe('a__d');
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

  test('pickRandomTracks returns requested unique subset', () => {
    const tracks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const picked = pickRandomTracks(tracks, 3, (() => {
      const values = [0.8, 0.2, 0.6];
      return () => values.shift() ?? 0;
    })());

    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((item) => item.id)).size).toBe(3);
  });

  test('pickRandomTracks caps at available tracks and defaults invalid count to one', () => {
    const tracks = [{ id: 'a' }, { id: 'b' }];
    expect(pickRandomTracks(tracks, 10, () => 0)).toHaveLength(2);
    expect(pickRandomTracks(tracks, 0, () => 0)).toHaveLength(1);
  });
});

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createDjPlanManager } from '../../lib/djPlanManager.js';

function makeDjApiClient(overrides = {}) {
  return {
    fetchTracks: jest.fn().mockResolvedValue([]),
    fetchTrackDetail: jest.fn().mockResolvedValue(null),
    fetchTransition: jest.fn().mockResolvedValue(null),
    fetchBatchPlan: jest.fn().mockResolvedValue(null),
    sendFeedback: jest.fn().mockResolvedValue(null),
    setIconic: jest.fn().mockResolvedValue(null),
    fetchSetProfiles: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeFakeFilRouge(playlist, { loopEnabled = false } = {}) {
  return {
    getPlaylist: () => playlist.slice(),
    patchPlaylistItem: jest.fn((id, patch) => {
      const item = playlist.find((p) => p.id === id);
      if (!item) return false;
      Object.assign(item, patch);
      return true;
    }),
    isLoopEnabled: () => loopEnabled,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('djPlanManager', () => {
  describe('resolveTrackIdsForItems', () => {
    test('resolves via exact cachePath match', async () => {
      const trackSummaries = [{ trackId: '/music/a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true }];
      const item = { id: '1', name: 'A', artist: 'X', cachePath: '/music/a.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([item]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue(trackSummaries) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.resolveTrackIdsForItems([item]);

      expect(item.djTrackId).toBe('/music/a.mp3');
      expect(item.djHasAnalysis).toBe(true);
      expect(fr.patchPlaylistItem).toHaveBeenCalledWith('1', { djTrackId: '/music/a.mp3', djHasAnalysis: true });
    });

    test('resolves via basename of cachePath when the full path does not match', async () => {
      const trackSummaries = [{ trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true }];
      const item = { id: '1', name: 'A', artist: 'X', cachePath: '/music/sub/a.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([item]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue(trackSummaries) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.resolveTrackIdsForItems([item]);

      expect(item.djTrackId).toBe('a.mp3');
    });

    test('resolves via ratingKey when no cachePath match exists', async () => {
      const trackSummaries = [{ trackId: 'rk123', trackName: 'A', artistName: 'X', hasFullAnalysis: false }];
      const item = { id: '1', name: 'A', artist: 'X', ratingKey: 'rk123', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([item]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue(trackSummaries) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.resolveTrackIdsForItems([item]);

      expect(item.djTrackId).toBe('rk123');
      expect(item.djHasAnalysis).toBe(false);
    });

    test('resolves via normalized name+artist as last resort', async () => {
      const trackSummaries = [{ trackId: 'b.mp3', trackName: "J'ai perdu le nord", artistName: 'Donald Reignoux', hasFullAnalysis: true }];
      const item = { id: '1', name: "J'AI PERDU LE NORD", artist: '  donald   reignoux  ', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([item]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue(trackSummaries) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.resolveTrackIdsForItems([item]);

      expect(item.djTrackId).toBe('b.mp3');
    });

    test('leaves djTrackId null when nothing matches and does not patch', async () => {
      const trackSummaries = [{ trackId: 'other.mp3', trackName: 'Other', artistName: 'Y', hasFullAnalysis: true }];
      const item = { id: '1', name: 'A', artist: 'X', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([item]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue(trackSummaries) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.resolveTrackIdsForItems([item]);

      expect(item.djTrackId).toBeNull();
      expect(fr.patchPlaylistItem).not.toHaveBeenCalled();
    });
  });

  describe('planEdgesForNewItems', () => {
    const trackSummaries = [
      { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
      { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      { trackId: 'c.mp3', trackName: 'C', artistName: 'Z', hasFullAnalysis: true },
    ];
    const transitionResult = {
      transitionType: 'phrase_mix',
      mixOutSec: 12,
      mixInSec: 3,
      recommendedBpm: 124,
      crossfadeDurationSec: 8,
      compatibilityScore: 0.9,
      decisionId: 'd1',
    };

    function makeItems() {
      return [
        { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null },
        { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null },
        { id: '3', name: 'C', artist: 'Z', cachePath: 'c.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null },
      ];
    }

    test('computes the predecessor edge for a newly-added item', async () => {
      const [itemA, itemB] = makeItems();
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.planEdgesForNewItems([itemB], { withWrap: false });

      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('a.mp3', 'b.mp3');
      expect(itemA.djTransition).toMatchObject({ toItemId: '2', transitionType: 'phrase_mix', decisionId: 'd1' });
      expect(itemA.djTransition.computedAt).toBeGreaterThan(0);
    });

    test('does not recompute an edge that is already fresh', async () => {
      const [itemA, itemB] = makeItems();
      itemA.djTransition = { toItemId: '2', transitionType: 'long_blend', computedAt: Date.now(), decisionId: 'old' };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.planEdgesForNewItems([itemB], { withWrap: false });

      expect(djApiClient.fetchTransition).not.toHaveBeenCalled();
      expect(itemA.djTransition.decisionId).toBe('old');
    });

    test('also computes the wrap edge when the new item is last and withWrap is true', async () => {
      const [itemA, itemB, itemC] = makeItems();
      const fr = makeFakeFilRouge([itemA, itemB, itemC], { loopEnabled: true });
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.planEdgesForNewItems([itemC], { withWrap: true });

      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('b.mp3', 'c.mp3');
      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('c.mp3', 'a.mp3');
      expect(itemB.djTransition).toMatchObject({ toItemId: '3' });
      expect(itemC.djTransition).toMatchObject({ toItemId: '1' });
    });

    test('only resolves trackIds and skips edge computation when the playlist has fewer than 2 items', async () => {
      const [itemA] = makeItems();
      const fr = makeFakeFilRouge([itemA]);
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.planEdgesForNewItems([itemA], { withWrap: false });

      expect(itemA.djTrackId).toBe('a.mp3');
      expect(djApiClient.fetchTransition).not.toHaveBeenCalled();
    });

    test('skips edges where a side has no resolved trackId or analysis', async () => {
      const itemA = { id: '1', name: 'Unknown Song', artist: 'Unknown Artist', cachePath: 'unknown.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.planEdgesForNewItems([itemB], { withWrap: false });

      expect(itemA.djTrackId).toBeNull();
      expect(djApiClient.fetchTransition).not.toHaveBeenCalled();
      expect(itemA.djTransition).toBeNull();
    });
  });

  describe('planAllEdges', () => {
    const trackSummaries = [
      { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
      { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      { trackId: 'c.mp3', trackName: 'C', artistName: 'Z', hasFullAnalysis: true },
    ];
    const transitionResult = {
      transitionType: 'long_blend',
      mixOutSec: 10,
      mixInSec: 2,
      recommendedBpm: 120,
      crossfadeDurationSec: 6,
      compatibilityScore: 0.8,
      decisionId: 'd2',
    };

    function makeItems() {
      return [
        { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null },
        { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null },
        { id: '3', name: 'C', artist: 'Z', cachePath: 'c.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null },
      ];
    }

    test('computes every consecutive pairwise edge in playlist order', async () => {
      const [itemA, itemB, itemC] = makeItems();
      const fr = makeFakeFilRouge([itemA, itemB, itemC], { loopEnabled: false });
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.planAllEdges();

      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('a.mp3', 'b.mp3');
      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('b.mp3', 'c.mp3');
      expect(djApiClient.fetchTransition).not.toHaveBeenCalledWith('c.mp3', 'a.mp3');
    });

    test('also computes the wrap edge when loop is enabled', async () => {
      const [itemA, itemB, itemC] = makeItems();
      const fr = makeFakeFilRouge([itemA, itemB, itemC], { loopEnabled: true });
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.planAllEdges();

      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('c.mp3', 'a.mp3');
    });

    test('does nothing when the playlist has fewer than 2 items', async () => {
      const [itemA] = makeItems();
      const fr = makeFakeFilRouge([itemA]);
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.planAllEdges();

      expect(djApiClient.fetchTracks).not.toHaveBeenCalled();
      expect(djApiClient.fetchTransition).not.toHaveBeenCalled();
    });
  });

  describe('computeSetQuality', () => {
    test('returns null when the playlist has fewer than 2 items', async () => {
      const item = { id: '1', name: 'A', artist: 'X', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([item]);
      const djApiClient = makeDjApiClient();
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      expect(await mgr.computeSetQuality()).toBeNull();
      expect(djApiClient.fetchBatchPlan).not.toHaveBeenCalled();
    });

    test('returns null when fewer than 2 items resolve to an analysed trackId', async () => {
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue([]) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      expect(await mgr.computeSetQuality()).toBeNull();
      expect(djApiClient.fetchBatchPlan).not.toHaveBeenCalled();
    });

    test('calls fetchBatchPlan with resolved trackIds and the selected profile', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const batchResult = { globalSetScore: 0.87, reasons: ['good energy curve'], globalComponents: { energy: 0.9 } };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      const result = await mgr.computeSetQuality();

      expect(djApiClient.fetchBatchPlan).toHaveBeenCalledWith(['a.mp3', 'b.mp3'], 'club_peak');
      expect(result).toEqual(batchResult);
    });

    test('calls fetchBatchPlan even when only one item resolves to an analysed trackId', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
      ];
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'Unknown Song', artist: 'Unknown Artist', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const batchResult = { globalSetScore: 0.5, reasons: [], globalComponents: null };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      const result = await mgr.computeSetQuality();

      expect(djApiClient.fetchBatchPlan).toHaveBeenCalledWith(['a.mp3'], 'club_peak');
      expect(result).toEqual(batchResult);
    });
  });

  describe('set profile persistence', () => {
    test('defaults to club_peak when nothing is stored', () => {
      const mgr = createDjPlanManager({ djApiClient: makeDjApiClient(), getFilRougeManager: () => null });
      expect(mgr.getSelectedSetProfile()).toBe('club_peak');
    });

    test('persists the selected profile across instances', () => {
      const mgr1 = createDjPlanManager({ djApiClient: makeDjApiClient(), getFilRougeManager: () => null });
      mgr1.setSelectedSetProfile('festival');

      const mgr2 = createDjPlanManager({ djApiClient: makeDjApiClient(), getFilRougeManager: () => null });
      expect(mgr2.getSelectedSetProfile()).toBe('festival');
    });

    test('getSetProfiles caches the result across calls', async () => {
      const data = { profiles: [{ id: 'club_peak' }, { id: 'festival' }], default: 'club_peak' };
      const djApiClient = makeDjApiClient({ fetchSetProfiles: jest.fn().mockResolvedValue(data) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => null });

      const first = await mgr.getSetProfiles();
      const second = await mgr.getSetProfiles();

      expect(first).toEqual(data);
      expect(second).toEqual(data);
      expect(djApiClient.fetchSetProfiles).toHaveBeenCalledTimes(1);
    });
  });

  describe('setIconic', () => {
    test('returns null without calling the API when the item has no djTrackId', async () => {
      const djApiClient = makeDjApiClient();
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => null });

      const result = await mgr.setIconic({ id: '1', name: 'A', artist: 'X', djTrackId: null }, true);

      expect(result).toBeNull();
      expect(djApiClient.setIconic).not.toHaveBeenCalled();
    });

    test('passes through trackId/iconic/name/artist', async () => {
      const djApiClient = makeDjApiClient({ setIconic: jest.fn().mockResolvedValue({ iconic: true }) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => null });

      const result = await mgr.setIconic({ id: '1', name: 'A', artist: 'X', djTrackId: 'a.mp3' }, true);

      expect(result).toEqual({ iconic: true });
      expect(djApiClient.setIconic).toHaveBeenCalledWith('a.mp3', true, 'A', 'X');
    });
  });

  describe('findDjPredecessorInFilRouge / getDjTransitionPlan', () => {
    test('returns null when no predecessor points at the item', () => {
      const itemA = { id: '1', djTransition: null };
      const itemB = { id: '2', djTransition: null };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const mgr = createDjPlanManager({ djApiClient: makeDjApiClient(), getFilRougeManager: () => fr });

      expect(mgr.findDjPredecessorInFilRouge(itemB)).toBeNull();
      expect(mgr.getDjTransitionPlan(itemB)).toBeNull();
    });

    test('returns a mapped plan when the predecessor has a fresh transition', () => {
      const itemA = {
        id: '1',
        djTransition: {
          toItemId: '2',
          transitionType: 'phrase_mix',
          mixOutSec: 12,
          mixInSec: 3,
          recommendedBpm: 124,
          crossfadeDurationSec: 8,
          compatibilityScore: 0.9,
          decisionId: 'd1',
          computedAt: Date.now(),
        },
      };
      const itemB = { id: '2', djTransition: null };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const mgr = createDjPlanManager({ djApiClient: makeDjApiClient(), getFilRougeManager: () => fr });

      expect(mgr.findDjPredecessorInFilRouge(itemB)).toBe(itemA);

      const plan = mgr.getDjTransitionPlan(itemB);
      expect(plan).toMatchObject({
        transitionType: 'phrase_mix',
        mixOutSec: 12,
        mixInSec: 3,
        recommendedBpm: 124,
        decisionId: 'd1',
        mode: 'crossfade_logarithmic',
      });
    });

    test('returns null when the predecessor transition is stale', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const itemA = {
        id: '1',
        djTransition: {
          toItemId: '2',
          transitionType: 'phrase_mix',
          computedAt: Date.now() - oneDayMs - 1000,
          decisionId: 'd1',
        },
      };
      const itemB = { id: '2', djTransition: null };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const mgr = createDjPlanManager({ djApiClient: makeDjApiClient(), getFilRougeManager: () => fr });

      expect(mgr.getDjTransitionPlan(itemB)).toBeNull();
    });
  });

  describe('submitFeedback', () => {
    test('passes through to djApiClient.sendFeedback', async () => {
      const djApiClient = makeDjApiClient({ sendFeedback: jest.fn().mockResolvedValue({ ok: true }) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => null });

      const result = await mgr.submitFeedback('d1', 'good', 'reason', 'comment');

      expect(result).toEqual({ ok: true });
      expect(djApiClient.sendFeedback).toHaveBeenCalledWith('d1', 'good', 'reason', 'comment');
    });
  });
});

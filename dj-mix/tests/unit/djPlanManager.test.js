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

      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('a.mp3', 'b.mp3', undefined);
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

      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('b.mp3', 'c.mp3', undefined);
      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('c.mp3', 'a.mp3', undefined);
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

      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('a.mp3', 'b.mp3', undefined);
      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('b.mp3', 'c.mp3', undefined);
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

      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('c.mp3', 'a.mp3', undefined);
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
    test('returns null when nothing resolves to an analysed trackId (fil rouge or queue)', async () => {
      const item = { id: '1', name: 'A', artist: 'X', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([item]);
      const djApiClient = makeDjApiClient();
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr, getQueue: () => [] });

      expect(await mgr.computeSetQuality()).toBeNull();
      expect(djApiClient.fetchBatchPlan).not.toHaveBeenCalled();
    });

    test('returns null when no items resolve to an analysed trackId', async () => {
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue([]) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr, getQueue: () => [] });

      expect(await mgr.computeSetQuality()).toBeNull();
      expect(djApiClient.fetchBatchPlan).not.toHaveBeenCalled();
    });

    test('calls fetchBatchPlan from queue items when fil rouge is empty', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const queueItemA = { id: 'q1', name: 'A', artist: 'X', cachePath: 'a.mp3' };
      const queueItemB = { id: 'q2', name: 'B', artist: 'Y', cachePath: 'b.mp3' };
      const batchResult = { globalSetScore: 0.75, reasons: ['good flow'], globalComponents: null };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
      });
      const mgr = createDjPlanManager({
        djApiClient,
        getFilRougeManager: () => null,
        getQueue: () => [queueItemA, queueItemB],
      });

      const result = await mgr.computeSetQuality();

      expect(djApiClient.fetchBatchPlan).toHaveBeenCalledWith(['a.mp3', 'b.mp3'], 'club_peak');
      expect(result).toEqual(batchResult);
    });

    test('calls fetchBatchPlan when fil rouge has 1 item but queue has resolvable items', async () => {
      const trackSummaries = [
        { trackId: 'q1.mp3', trackName: 'Q1', artistName: 'Z', hasFullAnalysis: true },
        { trackId: 'q2.mp3', trackName: 'Q2', artistName: 'W', hasFullAnalysis: true },
      ];
      const frItem = { id: 'f1', name: 'Unknown', artist: 'Unknown', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([frItem]);
      const queueItemA = { id: 'q1', name: 'Q1', artist: 'Z', cachePath: 'q1.mp3' };
      const queueItemB = { id: 'q2', name: 'Q2', artist: 'W', cachePath: 'q2.mp3' };
      const batchResult = { globalSetScore: 0.6, reasons: [], globalComponents: null };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
      });
      const mgr = createDjPlanManager({
        djApiClient,
        getFilRougeManager: () => fr,
        getQueue: () => [queueItemA, queueItemB],
      });

      const result = await mgr.computeSetQuality();

      expect(djApiClient.fetchBatchPlan).toHaveBeenCalledWith(['q1.mp3', 'q2.mp3'], 'club_peak');
      expect(result).toEqual(batchResult);
    });

    test('deduplicates trackIds when a queue item resolves to the same trackId as a fil rouge item', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const frItemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([frItemA]);
      const queueItemA = { id: 'q1', name: 'A', artist: 'X', cachePath: 'a.mp3', queueSource: 'fil-rouge' };
      const queueItemB = { id: 'q2', name: 'B', artist: 'Y', cachePath: 'b.mp3' };
      const batchResult = { globalSetScore: 0.8, reasons: [], globalComponents: null };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
      });
      const mgr = createDjPlanManager({
        djApiClient,
        getFilRougeManager: () => fr,
        getQueue: () => [queueItemA, queueItemB],
      });

      const result = await mgr.computeSetQuality();

      expect(djApiClient.fetchBatchPlan).toHaveBeenCalledWith(['a.mp3', 'b.mp3'], 'club_peak');
      expect(result).toEqual(batchResult);
    });

    test('works correctly when getQueue is not provided (backward compat)', async () => {
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

    test('SPEC-8.6.1 — skips the API call entirely while a fil rouge download is in progress', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue(trackSummaries) });
      const mgr = createDjPlanManager({
        djApiClient,
        getFilRougeManager: () => fr,
        isFilRougeDownloadPending: () => true,
      });

      const result = await mgr.computeSetQuality();

      expect(result).toBeNull();
      expect(djApiClient.fetchTracks).not.toHaveBeenCalled();
      expect(djApiClient.fetchBatchPlan).not.toHaveBeenCalled();
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

    test('persists transitions from batch result onto fil rouge items', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const batchResult = {
        globalSetScore: 0.7,
        reasons: [],
        globalComponents: null,
        transitions: [{
          trackA: 'a.mp3',
          trackB: 'b.mp3',
          transitionType: 'long_blend',
          mixOutSec: 200,
          mixInSec: 4,
          recommendedBpm: 116,
          crossfadeDurationSec: 33,
          compatibilityScore: 0.68,
          decisionId: 'abc-123',
        }],
      };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.computeSetQuality();

      expect(fr.patchPlaylistItem).toHaveBeenCalledWith('1', expect.objectContaining({
        djTransition: expect.objectContaining({
          toItemId: '2',
          transitionType: 'long_blend',
          mixOutSec: 200,
          mixInSec: 4,
          recommendedBpm: 116,
          crossfadeDurationSec: 33,
          compatibilityScore: 0.68,
          decisionId: 'abc-123',
        }),
      }));
    });

    test('skips persisting a batch transition if it is already fresh', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const itemA = {
        id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false,
        djTransition: { toItemId: '2', transitionType: 'quick_cut', computedAt: Date.now() },
      };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const batchResult = {
        globalSetScore: 0.7,
        reasons: [],
        globalComponents: null,
        transitions: [{
          trackA: 'a.mp3', trackB: 'b.mp3', transitionType: 'long_blend',
          mixOutSec: 200, mixInSec: 4, recommendedBpm: 116, crossfadeDurationSec: 33,
          compatibilityScore: 0.68, decisionId: 'abc-123',
        }],
      };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.computeSetQuality();

      // patchPlaylistItem should only have been called for trackId resolution, not for djTransition
      const transitionCalls = fr.patchPlaylistItem.mock.calls.filter(
        ([, patch]) => 'djTransition' in patch,
      );
      expect(transitionCalls).toHaveLength(0);
    });

    test('skips a batch transition that does not match fil rouge order and fetches the correct pair individually', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const fr = makeFakeFilRouge([itemA, itemB]);
      // Batch reordered: returns B→A instead of the fil rouge order A→B
      const batchResult = {
        globalSetScore: 0.7, reasons: [], globalComponents: null,
        transitions: [{ trackA: 'b.mp3', trackB: 'a.mp3', transitionType: 'quick_cut',
          mixOutSec: 180, mixInSec: 2, recommendedBpm: 120, crossfadeDurationSec: 8,
          compatibilityScore: 0.5, decisionId: 'batch-rev' }],
      };
      const transitionResult = {
        transitionType: 'long_blend', mixOutSec: 200, mixInSec: 4,
        recommendedBpm: 116, crossfadeDurationSec: 33, compatibilityScore: 0.68, decisionId: 'ind-123',
      };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.computeSetQuality();

      // Batch transition B→A should NOT have been applied (wrong fil rouge order)
      const transitionCalls = fr.patchPlaylistItem.mock.calls.filter(([, p]) => 'djTransition' in p);
      const batchCall = transitionCalls.find(([id]) => id === '2');
      expect(batchCall).toBeUndefined();

      // Individual transition A→B should have been fetched and applied
      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('a.mp3', 'b.mp3', undefined);
      const indivCall = transitionCalls.find(([id]) => id === '1');
      expect(indivCall).toBeDefined();
      expect(indivCall[1]).toEqual(expect.objectContaining({
        djTransition: expect.objectContaining({ toItemId: '2', decisionId: 'ind-123' }),
      }));
    });

    test('applies matching batch transitions and fetches only reordered pairs individually', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
        { trackId: 'c.mp3', trackName: 'C', artistName: 'Z', hasFullAnalysis: true },
      ];
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const itemC = { id: '3', name: 'C', artist: 'Z', cachePath: 'c.mp3', djTrackId: null, djHasAnalysis: false, djTransition: null };
      const fr = makeFakeFilRouge([itemA, itemB, itemC]);
      // Batch order: [B, A, C] → transitions B→A and A→C
      // Fil rouge order: [A, B, C] → pairs A→B and B→C
      // Only A→C matches both (batch and fil rouge: A is followed by... wait no)
      // In fil rouge [A,B,C]: A→B (id 1→2), B→C (id 2→3)
      // Batch returns: B→A (2→1) doesn't match (fil rouge A's next is B not A), A→C (1→3) doesn't match (fil rouge A's next is B not C)
      // So both batch transitions are skipped, both A→B and B→C go to fetchTransition
      const batchResult = {
        globalSetScore: 0.8, reasons: [], globalComponents: null,
        transitions: [
          { trackA: 'b.mp3', trackB: 'a.mp3', transitionType: 'quick_cut', mixOutSec: 100, mixInSec: 1, recommendedBpm: 120, crossfadeDurationSec: 4, compatibilityScore: 0.4, decisionId: 'ba' },
          { trackA: 'a.mp3', trackB: 'c.mp3', transitionType: 'echo_out', mixOutSec: 150, mixInSec: 3, recommendedBpm: 118, crossfadeDurationSec: 12, compatibilityScore: 0.6, decisionId: 'ac' },
        ],
      };
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchBatchPlan: jest.fn().mockResolvedValue(batchResult),
        fetchTransition: jest.fn().mockResolvedValue({
          transitionType: 'long_blend', mixOutSec: 200, mixInSec: 4,
          recommendedBpm: 116, crossfadeDurationSec: 33, compatibilityScore: 0.7, decisionId: 'ind',
        }),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      await mgr.computeSetQuality();

      // Both fil rouge pairs A→B and B→C must have been fetched individually
      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('a.mp3', 'b.mp3', undefined);
      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('b.mp3', 'c.mp3', undefined);
      expect(djApiClient.fetchTransition).toHaveBeenCalledTimes(2);

      // djTransition applied on A and B from individual calls, not the batch
      const transitionCalls = fr.patchPlaylistItem.mock.calls.filter(([, p]) => 'djTransition' in p);
      const callForA = transitionCalls.find(([id]) => id === '1');
      const callForB = transitionCalls.find(([id]) => id === '2');
      expect(callForA).toBeDefined();
      expect(callForA[1].djTransition.toItemId).toBe('2');
      expect(callForB).toBeDefined();
      expect(callForB[1].djTransition.toItemId).toBe('3');
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

  describe('planCurrentToNextTransition', () => {
    test('returns {ok:false, reason:"last-track"} when current item is last', async () => {
      const itemA = { id: '1', name: 'A', artist: 'X', djTrackId: 'a.mp3', djHasAnalysis: true };
      const fr = makeFakeFilRouge([itemA]);
      const djApiClient = makeDjApiClient();
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      const result = await mgr.planCurrentToNextTransition(itemA);

      expect(result).toEqual({ ok: false, reason: 'last-track' });
      expect(djApiClient.fetchTransition).not.toHaveBeenCalled();
    });

    test('returns {ok:false, reason:"unresolved-tracks"} when tracks cannot be resolved', async () => {
      const itemA = { id: '1', name: 'A', artist: 'X', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue([]) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      const result = await mgr.planCurrentToNextTransition(itemA, { force: true });

      expect(result).toEqual({ ok: false, reason: 'unresolved-tracks' });
    });

    test('returns {ok:false, reason:"missing-analysis"} when djHasAnalysis is false and force is off', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: false },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: false },
      ];
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({ fetchTracks: jest.fn().mockResolvedValue(trackSummaries) });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      const result = await mgr.planCurrentToNextTransition(itemA);

      expect(result).toEqual({ ok: false, reason: 'missing-analysis' });
      expect(djApiClient.fetchTransition).not.toHaveBeenCalled();
    });

    test('force=true bypasses djHasAnalysis guard and calls API', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: false },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: false },
      ];
      const transitionResult = {
        transitionType: 'phrase_mix',
        mixOutSec: 120,
        mixInSec: 5,
        recommendedBpm: 128,
        crossfadeDurationSec: 8,
        compatibilityScore: 0.85,
        decisionId: 'd1',
      };
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      const result = await mgr.planCurrentToNextTransition(itemA, { force: true });

      expect(result).toEqual({ ok: true });
      expect(djApiClient.fetchTransition).toHaveBeenCalledWith('a.mp3', 'b.mp3', undefined);
      expect(itemA.djTransition).toMatchObject({
        toItemId: '2',
        transitionType: 'phrase_mix',
        mixOutSec: 120,
        mixInSec: 5,
      });
    });

    test('returns {ok:false, reason:"api-error"} when fetchTransition returns null', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn().mockResolvedValue(trackSummaries),
        fetchTransition: jest.fn().mockResolvedValue(null),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      const result = await mgr.planCurrentToNextTransition(itemA);

      expect(result).toEqual({ ok: false, reason: 'api-error' });
    });

    test('force=true retries track summaries when initial resolution fails', async () => {
      const trackSummaries = [
        { trackId: 'a.mp3', trackName: 'A', artistName: 'X', hasFullAnalysis: true },
        { trackId: 'b.mp3', trackName: 'B', artistName: 'Y', hasFullAnalysis: true },
      ];
      const transitionResult = {
        transitionType: 'quick_cut',
        mixOutSec: 60,
        mixInSec: 2,
        recommendedBpm: 130,
        crossfadeDurationSec: 3,
        compatibilityScore: 0.7,
        decisionId: 'd2',
      };
      const itemA = { id: '1', name: 'A', artist: 'X', cachePath: 'a.mp3', djTrackId: null, djHasAnalysis: false };
      const itemB = { id: '2', name: 'B', artist: 'Y', cachePath: 'b.mp3', djTrackId: null, djHasAnalysis: false };
      const fr = makeFakeFilRouge([itemA, itemB]);
      let fetchTracksCallCount = 0;
      const djApiClient = makeDjApiClient({
        fetchTracks: jest.fn(() => {
          fetchTracksCallCount++;
          return Promise.resolve(fetchTracksCallCount >= 2 ? trackSummaries : []);
        }),
        fetchTransition: jest.fn().mockResolvedValue(transitionResult),
      });
      const mgr = createDjPlanManager({ djApiClient, getFilRougeManager: () => fr });

      const result = await mgr.planCurrentToNextTransition(itemA, { force: true });

      expect(result).toEqual({ ok: true });
      expect(fetchTracksCallCount).toBe(2);
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

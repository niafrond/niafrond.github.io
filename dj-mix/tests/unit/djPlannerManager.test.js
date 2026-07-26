import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createDjPlannerManager } from '../../lib/djPlannerManager.js';

function makeFilRouge() {
  return { patchPlaylistItem: jest.fn() };
}

function makeManager({ djPlannerClient, filRouge } = {}) {
  const fr = filRouge || makeFilRouge();
  const client = djPlannerClient || {
    checkHealth: jest.fn().mockResolvedValue(true),
    createMixDecision: jest.fn(),
  };
  const manager = createDjPlannerManager({
    djPlannerClient: client,
    getFilRougeManager: () => fr,
    logger: { debug: jest.fn(), warn: jest.fn() },
  });
  return { manager, client, fr };
}

describe('djPlannerManager', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  describe('ensureAvailability / isAvailable', () => {
    test('probes checkHealth and caches the result', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(true), createMixDecision: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      expect(manager.isAvailable()).toBe(false); // not probed yet
      expect(await manager.ensureAvailability()).toBe(true);
      expect(manager.isAvailable()).toBe(true);

      await manager.ensureAvailability();
      expect(client.checkHealth).toHaveBeenCalledTimes(1); // cached, not re-probed
    });

    test('reflects an unreachable backend', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(false), createMixDecision: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      expect(await manager.ensureAvailability()).toBe(false);
      expect(manager.isAvailable()).toBe(false);
    });
  });

  describe('getMixDecision', () => {
    test('returns null when nothing has been computed yet', () => {
      const { manager } = makeManager();
      expect(manager.getMixDecision({ id: 1 }, { id: 2 })).toBeNull();
    });

    test('returns the memoized decision when fresh and pointed at the right toItem', () => {
      const { manager } = makeManager();
      const fromItem = { id: 1, plannerDecision: { compatible: true, toItemId: 2, computedAt: Date.now() } };
      expect(manager.getMixDecision(fromItem, { id: 2 })).toBe(fromItem.plannerDecision);
    });

    test('returns null when the memoized decision points at a different toItem (stale after reorder)', () => {
      const { manager } = makeManager();
      const fromItem = { id: 1, plannerDecision: { compatible: true, toItemId: 999, computedAt: Date.now() } };
      expect(manager.getMixDecision(fromItem, { id: 2 })).toBeNull();
    });

    test('returns null when the memoized decision is older than 24h', () => {
      const { manager } = makeManager();
      const fromItem = { id: 1, plannerDecision: { compatible: true, toItemId: 2, computedAt: Date.now() - (25 * 60 * 60 * 1000) } };
      expect(manager.getMixDecision(fromItem, { id: 2 })).toBeNull();
    });
  });

  describe('planMixDecisionForEdge', () => {
    test('returns null and skips the API call when trackIds are unresolved', async () => {
      const client = { checkHealth: jest.fn(), createMixDecision: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      const result = await manager.planMixDecisionForEdge({ id: 1 }, { id: 2 });

      expect(result).toBeNull();
      expect(client.checkHealth).not.toHaveBeenCalled();
      expect(client.createMixDecision).not.toHaveBeenCalled();
    });

    test('returns null without calling createMixDecision when the backend is unavailable', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(false), createMixDecision: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      const fromItem = { id: 1, djTrackId: 'a.mp3' };
      const toItem = { id: 2, djTrackId: 'b.mp3' };
      const result = await manager.planMixDecisionForEdge(fromItem, toItem);

      expect(result).toBeNull();
      expect(client.createMixDecision).not.toHaveBeenCalled();
    });

    test('computes, persists via patchPlaylistItem, and returns the decision', async () => {
      const decisionData = { compatible: true, confidence: 0.8, transition_type: 'crossfade_linear' };
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        createMixDecision: jest.fn().mockResolvedValue({ ok: true, status: 200, data: decisionData }),
      };
      const { manager, fr } = makeManager({ djPlannerClient: client });

      const fromItem = { id: 1, djTrackId: 'a.mp3' };
      const toItem = { id: 2, djTrackId: 'b.mp3' };
      const result = await manager.planMixDecisionForEdge(fromItem, toItem);

      expect(client.createMixDecision).toHaveBeenCalledWith('a.mp3', 'b.mp3');
      expect(result).toMatchObject({ ...decisionData, toItemId: 2 });
      expect(fr.patchPlaylistItem).toHaveBeenCalledWith(1, { plannerDecision: expect.objectContaining({ toItemId: 2, compatible: true }) });
    });

    test('returns null and does not persist anything when the API call fails', async () => {
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        createMixDecision: jest.fn().mockResolvedValue({ ok: false, status: 500, data: null }),
      };
      const { manager, fr } = makeManager({ djPlannerClient: client });

      const result = await manager.planMixDecisionForEdge({ id: 1, djTrackId: 'a.mp3' }, { id: 2, djTrackId: 'b.mp3' });

      expect(result).toBeNull();
      expect(fr.patchPlaylistItem).not.toHaveBeenCalled();
    });

    test('reuses the memoized decision without re-calling the API when fresh', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(true), createMixDecision: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      const fromItem = { id: 1, djTrackId: 'a.mp3', plannerDecision: { compatible: true, toItemId: 2, computedAt: Date.now() } };
      const result = await manager.planMixDecisionForEdge(fromItem, { id: 2, djTrackId: 'b.mp3' });

      expect(result).toBe(fromItem.plannerDecision);
      expect(client.createMixDecision).not.toHaveBeenCalled();
    });

    test('forceRefresh bypasses the fresh cache and re-calls the API', async () => {
      const decisionData = { compatible: true, confidence: 0.5 };
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        createMixDecision: jest.fn().mockResolvedValue({ ok: true, status: 200, data: decisionData }),
      };
      const { manager } = makeManager({ djPlannerClient: client });

      const fromItem = { id: 1, djTrackId: 'a.mp3', plannerDecision: { compatible: false, toItemId: 2, computedAt: Date.now() } };
      const result = await manager.planMixDecisionForEdge(fromItem, { id: 2, djTrackId: 'b.mp3' }, { forceRefresh: true });

      expect(client.createMixDecision).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject(decisionData);
    });
  });

  describe('getObservedTransition', () => {
    test('returns null when nothing has been computed yet', () => {
      const { manager } = makeManager();
      expect(manager.getObservedTransition({ id: 1 }, { id: 2 })).toBeNull();
    });

    test('returns the memoized observed-transition record when fresh', () => {
      const { manager } = makeManager();
      const fromItem = { id: 1, observedTransition: { observed: true, toItemId: 2, computedAt: Date.now() } };
      expect(manager.getObservedTransition(fromItem, { id: 2 })).toBe(fromItem.observedTransition);
    });

    test('returns null when the memoized record points at a different toItem', () => {
      const { manager } = makeManager();
      const fromItem = { id: 1, observedTransition: { observed: true, toItemId: 999, computedAt: Date.now() } };
      expect(manager.getObservedTransition(fromItem, { id: 2 })).toBeNull();
    });
  });

  describe('planObservedTransitionForEdge', () => {
    test('returns null and skips the API call when trackIds are unresolved', async () => {
      const client = { checkHealth: jest.fn(), fetchObservedTransition: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      const result = await manager.planObservedTransitionForEdge({ id: 1 }, { id: 2 });

      expect(result).toBeNull();
      expect(client.fetchObservedTransition).not.toHaveBeenCalled();
    });

    test('computes, persists via patchPlaylistItem, and returns the record — including observed:false (a normal result, not a failure)', async () => {
      const observedData = { observed: false, occurrence_count: 0, djs: [] };
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        fetchObservedTransition: jest.fn().mockResolvedValue({ ok: true, status: 200, data: observedData }),
      };
      const { manager, fr } = makeManager({ djPlannerClient: client });

      const fromItem = { id: 1, djTrackId: 'a.mp3' };
      const toItem = { id: 2, djTrackId: 'b.mp3' };
      const result = await manager.planObservedTransitionForEdge(fromItem, toItem);

      expect(client.fetchObservedTransition).toHaveBeenCalledWith('a.mp3', 'b.mp3');
      expect(result).toMatchObject({ ...observedData, toItemId: 2 });
      expect(fr.patchPlaylistItem).toHaveBeenCalledWith(1, { observedTransition: expect.objectContaining({ toItemId: 2, observed: false }) });
    });

    test('returns null without persisting when the backend is unavailable', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(false), fetchObservedTransition: jest.fn() };
      const { manager, fr } = makeManager({ djPlannerClient: client });

      const result = await manager.planObservedTransitionForEdge({ id: 1, djTrackId: 'a.mp3' }, { id: 2, djTrackId: 'b.mp3' });

      expect(result).toBeNull();
      expect(client.fetchObservedTransition).not.toHaveBeenCalled();
      expect(fr.patchPlaylistItem).not.toHaveBeenCalled();
    });

    test('reuses the memoized record without re-calling the API when fresh', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(true), fetchObservedTransition: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      const fromItem = { id: 1, djTrackId: 'a.mp3', observedTransition: { observed: true, toItemId: 2, computedAt: Date.now() } };
      const result = await manager.planObservedTransitionForEdge(fromItem, { id: 2, djTrackId: 'b.mp3' });

      expect(result).toBe(fromItem.observedTransition);
      expect(client.fetchObservedTransition).not.toHaveBeenCalled();
    });
  });

  describe('getStyleProgressions', () => {
    test('returns null without calling the client when style is empty', async () => {
      const client = { checkHealth: jest.fn(), fetchStyleProgressions: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      expect(await manager.getStyleProgressions('')).toBeNull();
      expect(client.checkHealth).not.toHaveBeenCalled();
    });

    test('returns null when the backend is unavailable', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(false), fetchStyleProgressions: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      expect(await manager.getStyleProgressions('house')).toBeNull();
      expect(client.fetchStyleProgressions).not.toHaveBeenCalled();
    });

    test('returns the response data on success', async () => {
      const response = { style: 'house', recurring_progressions: [], associated_labels: ['deep'] };
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        fetchStyleProgressions: jest.fn().mockResolvedValue({ ok: true, status: 200, data: response }),
      };
      const { manager } = makeManager({ djPlannerClient: client });

      expect(await manager.getStyleProgressions('house')).toEqual(response);
      expect(client.fetchStyleProgressions).toHaveBeenCalledWith('house');
    });
  });

  describe('createPlaylistPlan / updatePlaylistPlan', () => {
    test('createPlaylistPlan returns null when the backend is unavailable', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(false), createPlaylistPlan: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      expect(await manager.createPlaylistPlan(['a.mp3', 'b.mp3'])).toBeNull();
      expect(client.createPlaylistPlan).not.toHaveBeenCalled();
    });

    test('createPlaylistPlan delegates to the client and returns the plan on success', async () => {
      const plan = { id: 'plan-1', ordered_track_ids: ['a.mp3', 'b.mp3'], transitions: [], energy_curve: [] };
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        createPlaylistPlan: jest.fn().mockResolvedValue({ ok: true, status: 200, data: plan }),
      };
      const { manager } = makeManager({ djPlannerClient: client });

      const result = await manager.createPlaylistPlan(['a.mp3', 'b.mp3'], { lockedPositions: [] });

      expect(client.createPlaylistPlan).toHaveBeenCalledWith(['a.mp3', 'b.mp3'], { lockedPositions: [] });
      expect(result).toEqual(plan);
    });

    test('updatePlaylistPlan delegates to the client and returns the plan on success', async () => {
      const plan = { id: 'plan-1', ordered_track_ids: ['b.mp3', 'a.mp3'], transitions: [], energy_curve: [] };
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        updatePlaylistPlan: jest.fn().mockResolvedValue({ ok: true, status: 200, data: plan }),
      };
      const { manager } = makeManager({ djPlannerClient: client });

      const result = await manager.updatePlaylistPlan('plan-1', ['b.mp3', 'a.mp3'], { lockedPositions: [{ track_id: 'b.mp3', position: 0 }] });

      expect(client.updatePlaylistPlan).toHaveBeenCalledWith('plan-1', ['b.mp3', 'a.mp3'], { lockedPositions: [{ track_id: 'b.mp3', position: 0 }] });
      expect(result).toEqual(plan);
    });

    test('updatePlaylistPlan returns null on API failure', async () => {
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        updatePlaylistPlan: jest.fn().mockResolvedValue({ ok: false, status: 500, data: null }),
      };
      const { manager } = makeManager({ djPlannerClient: client });

      expect(await manager.updatePlaylistPlan('plan-1', ['a.mp3'])).toBeNull();
    });
  });

  describe('importPersonalHistory', () => {
    test('returns null when the backend is unavailable', async () => {
      const client = { checkHealth: jest.fn().mockResolvedValue(false), importPersonalHistory: jest.fn() };
      const { manager } = makeManager({ djPlannerClient: client });

      expect(await manager.importPersonalHistory({ djName: 'DJ X', entries: [{ artist: 'A', title: 'T' }] })).toBeNull();
      expect(client.importPersonalHistory).not.toHaveBeenCalled();
    });

    test('delegates to the client and returns the import summary on success', async () => {
      const response = { set_id: 'set-1', tracks_recognized: 2, tracks_unmatched: 0, transitions_added: 1 };
      const client = {
        checkHealth: jest.fn().mockResolvedValue(true),
        importPersonalHistory: jest.fn().mockResolvedValue({ ok: true, status: 200, data: response }),
      };
      const { manager } = makeManager({ djPlannerClient: client });

      const payload = { djName: 'DJ X', entries: [{ artist: 'A', title: 'T' }] };
      const result = await manager.importPersonalHistory(payload);

      expect(client.importPersonalHistory).toHaveBeenCalledWith(payload);
      expect(result).toEqual(response);
    });
  });
});

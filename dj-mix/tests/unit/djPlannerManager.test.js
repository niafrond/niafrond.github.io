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
});

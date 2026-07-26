import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { createDjPlannerClient } from '../../lib/djPlannerClient.js';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  };
}

function makeClient(overrides = {}) {
  const defaults = {
    getDjPlannerUrl: () => 'http://vision:8080/api/dj-planner',
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  const deps = { ...defaults, ...overrides };
  return { client: createDjPlannerClient(deps), deps };
}

describe('djPlannerClient', () => {
  afterEach(() => {
    delete global.fetch;
  });

  describe('offline / missing config guards', () => {
    test('does not call fetch when getDjPlannerUrl() is empty', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient({ getDjPlannerUrl: () => '' });

      expect(await client.createMixDecision('a.mp3', 'b.mp3')).toEqual({ ok: false, status: 0, data: null });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('does not call fetch when the healthMonitor reports offline', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient({ healthMonitor: { isOffline: () => true, recordSuccess: jest.fn(), recordFailure: jest.fn() } });

      expect(await client.createMixDecision('a.mp3', 'b.mp3')).toEqual({ ok: false, status: 0, data: null });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('checkHealth', () => {
    test('returns true on a 200 /health response', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { status: 'ok' }));
      const { client } = makeClient();

      expect(await client.checkHealth()).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://vision:8080/api/dj-planner/health', expect.any(Object));
    });

    test('returns false when the backend is unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const { client } = makeClient();

      expect(await client.checkHealth()).toBe(false);
    });

    test('returns false when no base URL is configured', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient({ getDjPlannerUrl: () => '' });

      expect(await client.checkHealth()).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('createMixDecision', () => {
    test('posts from_track_id/to_track_id and returns a compatible MixDecision', async () => {
      const decision = { from_track_id: 'a.mp3', to_track_id: 'b.mp3', compatible: true, confidence: 0.9 };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, decision));
      const { client } = makeClient();

      const result = await client.createMixDecision('a.mp3', 'b.mp3');

      expect(result).toEqual({ ok: true, status: 200, data: decision });
      const [url, init] = global.fetch.mock.calls[0];
      expect(url).toBe('http://vision:8080/api/dj-planner/v1/mix-decisions');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ from_track_id: 'a.mp3', to_track_id: 'b.mp3', allow_exception: false });
    });

    test('returns an IncompatibleMixDecision unchanged (compatible:false)', async () => {
      const decision = { from_track_id: 'a.mp3', to_track_id: 'b.mp3', compatible: false, blocking_dimensions: ['harmonic'], explanation: 'clé incompatible' };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, decision));
      const { client } = makeClient();

      expect(await client.createMixDecision('a.mp3', 'b.mp3')).toEqual({ ok: true, status: 200, data: decision });
    });

    test('sends allow_exception:true when explicitly requested', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { compatible: true }));
      const { client } = makeClient();

      await client.createMixDecision('a.mp3', 'b.mp3', { allowException: true });

      const [, init] = global.fetch.mock.calls[0];
      expect(JSON.parse(init.body).allow_exception).toBe(true);
    });

    test('resolves without calling fetch when a trackId is missing', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.createMixDecision(null, 'b.mp3')).toEqual({ ok: false, status: 0, data: null });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('treats 422 as a business response, not a health failure', async () => {
      const recordFailure = jest.fn();
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(422, { detail: [{ loc: ['body', 'from_track_id'], msg: 'field required', type: 'missing' }] }));
      const { client } = makeClient({ healthMonitor: { isOffline: () => false, recordSuccess: jest.fn(), recordFailure } });

      const result = await client.createMixDecision('a.mp3', 'b.mp3');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(422);
      expect(recordFailure).not.toHaveBeenCalled();
    });

    test('records a health failure on a 500 response', async () => {
      const recordFailure = jest.fn();
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, null));
      const { client } = makeClient({ healthMonitor: { isOffline: () => false, recordSuccess: jest.fn(), recordFailure } });

      await client.createMixDecision('a.mp3', 'b.mp3');

      expect(recordFailure).toHaveBeenCalledTimes(1);
    });

    test('records a health failure and resolves safely on a network error', async () => {
      const recordFailure = jest.fn();
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const { client } = makeClient({ healthMonitor: { isOffline: () => false, recordSuccess: jest.fn(), recordFailure } });

      expect(await client.createMixDecision('a.mp3', 'b.mp3')).toEqual({ ok: false, status: 0, data: null });
      expect(recordFailure).toHaveBeenCalledTimes(1);
    });
  });

  describe('createPlaylistPlan / updatePlaylistPlan', () => {
    test('createPlaylistPlan posts track_ids/locked_positions/allow_exception', async () => {
      const plan = { id: 'plan-1', ordered_track_ids: ['a.mp3', 'b.mp3'], transitions: [], energy_curve: [] };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, plan));
      const { client } = makeClient();

      const result = await client.createPlaylistPlan(['a.mp3', 'b.mp3'], { lockedPositions: [{ track_id: 'a.mp3', position: 0 }] });

      expect(result).toEqual({ ok: true, status: 200, data: plan });
      const [url, init] = global.fetch.mock.calls[0];
      expect(url).toBe('http://vision:8080/api/dj-planner/v1/playlist-plans');
      expect(JSON.parse(init.body)).toEqual({
        track_ids: ['a.mp3', 'b.mp3'],
        locked_positions: [{ track_id: 'a.mp3', position: 0 }],
        allow_exception: false,
      });
    });

    test('resolves without calling fetch when track_ids is empty', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.createPlaylistPlan([])).toEqual({ ok: false, status: 0, data: null });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('updatePlaylistPlan PATCHes /v1/playlist-plans/{plan_id}', async () => {
      const plan = { id: 'plan-1', ordered_track_ids: ['b.mp3', 'a.mp3'], transitions: [], energy_curve: [] };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, plan));
      const { client } = makeClient();

      const result = await client.updatePlaylistPlan('plan-1', ['b.mp3', 'a.mp3']);

      expect(result).toEqual({ ok: true, status: 200, data: plan });
      const [url, init] = global.fetch.mock.calls[0];
      expect(url).toBe('http://vision:8080/api/dj-planner/v1/playlist-plans/plan-1');
      expect(init.method).toBe('PATCH');
    });

    test('updatePlaylistPlan resolves without calling fetch when planId is missing', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.updatePlaylistPlan(null, ['a.mp3'])).toEqual({ ok: false, status: 0, data: null });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('fetchObservedTransition', () => {
    test('gets /v1/transitions/observed with from_track_id/to_track_id query params', async () => {
      const observed = { observed: true, occurrence_count: 12, djs: [{ name: 'DJ X', set_id: 's1' }] };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, observed));
      const { client } = makeClient();

      const result = await client.fetchObservedTransition('a.mp3', 'b.mp3');

      expect(result).toEqual({ ok: true, status: 200, data: observed });
      const [url] = global.fetch.mock.calls[0];
      expect(url).toContain('/v1/transitions/observed?');
      expect(url).toContain('from_track_id=a.mp3');
      expect(url).toContain('to_track_id=b.mp3');
    });

    test('observed:false is a normal ok response, not a failure', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { observed: false, occurrence_count: 0, djs: [] }));
      const { client } = makeClient();

      const result = await client.fetchObservedTransition('a.mp3', 'b.mp3');

      expect(result.ok).toBe(true);
      expect(result.data.observed).toBe(false);
    });
  });

  describe('fetchStyleProgressions', () => {
    test('gets /v1/styles/{style}/progressions with the style URL-encoded', async () => {
      const progressions = { style: 'house', recurring_progressions: [], associated_labels: [] };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, progressions));
      const { client } = makeClient();

      const result = await client.fetchStyleProgressions('deep house');

      expect(result).toEqual({ ok: true, status: 200, data: progressions });
      const [url] = global.fetch.mock.calls[0];
      expect(url).toBe('http://vision:8080/api/dj-planner/v1/styles/deep%20house/progressions');
    });
  });

  describe('importPersonalHistory', () => {
    test('posts dj_name/entries and optional event/date/source_url', async () => {
      const response = { set_id: 'set-1', tracks_recognized: 2, tracks_unmatched: 0, transitions_added: 1 };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, response));
      const { client } = makeClient();

      const entries = [{ artist: 'A', title: 'T1' }, { artist: 'B', title: 'T2' }];
      const result = await client.importPersonalHistory({ djName: 'DJ X', entries, event: 'Warehouse', date: '2026-01-01' });

      expect(result).toEqual({ ok: true, status: 200, data: response });
      const [, init] = global.fetch.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({ dj_name: 'DJ X', entries, event: 'Warehouse', date: '2026-01-01' });
    });

    test('resolves without calling fetch when entries is empty', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.importPersonalHistory({ djName: 'DJ X', entries: [] })).toEqual({ ok: false, status: 0, data: null });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

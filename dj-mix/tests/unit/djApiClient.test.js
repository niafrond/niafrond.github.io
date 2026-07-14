import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createDjApiClient } from '../../lib/djApiClient.js';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  };
}

function makeClient(overrides = {}) {
  const defaults = {
    apiHealthMonitor: { isOffline: () => false, recordSuccess: jest.fn(), recordFailure: jest.fn() },
    getDownloaderApiToken: () => '',
    getDownloaderApiUrl: () => 'http://localhost:3000',
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  const deps = { ...defaults, ...overrides };
  return { client: createDjApiClient(deps), deps };
}

describe('djApiClient', () => {
  afterEach(() => {
    delete global.fetch;
  });

  describe('offline / missing config guards', () => {
    test('does not call fetch when apiHealthMonitor.isOffline() is true', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient({ apiHealthMonitor: { isOffline: () => true, recordSuccess: jest.fn(), recordFailure: jest.fn() } });

      expect(await client.fetchTracks()).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('does not call fetch when getDownloaderApiUrl() is empty', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient({ getDownloaderApiUrl: () => '' });

      expect(await client.fetchTracks()).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('fetchTracks', () => {
    test('returns tracks immediately when scan returns tracks without jobId', async () => {
      const tracks = [{ trackId: 'a.mp3', trackName: 'A', artistName: 'X' }];
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { tracks }));
      const { client, deps } = makeClient();

      const result = await client.fetchTracks();

      expect(result).toEqual(tracks);
      expect(deps.apiHealthMonitor.recordSuccess).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/dj/tracks/scan',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    test('polls scan/status when scan returns a jobId', async () => {
      const tracks = [{ trackId: 'a.mp3', trackName: 'A', artistName: 'X' }];
      global.fetch = jest.fn()
        .mockResolvedValueOnce(jsonResponse(200, { jobId: 'j1' }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', progress: 0.5 }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'done', tracks }));
      const { client } = makeClient({ pollIntervalMs: [0] });

      const result = await client.fetchTracks();

      expect(result).toEqual(tracks);
      expect(global.fetch).toHaveBeenCalledTimes(3);
      const statusUrl = global.fetch.mock.calls[1][0];
      expect(statusUrl).toContain('/api/dj/tracks/scan/status');
      expect(statusUrl).toContain('jobId=j1');
    });

    test('returns [] when poll ends with error status', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(jsonResponse(200, { jobId: 'j1' }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'error', error: 'analysis failed' }));
      const { client } = makeClient({ pollIntervalMs: [0] });

      expect(await client.fetchTracks()).toEqual([]);
    });

    test('appends the API token to the URL when provided', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { tracks: [] }));
      const { client } = makeClient({ getDownloaderApiToken: () => 'secret' });

      await client.fetchTracks();

      const [url] = global.fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/dj/tracks/scan?token=secret');
    });

    test('returns [] and records failure on non-ok/non-400/404 status', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, null));
      const { client, deps } = makeClient();

      expect(await client.fetchTracks()).toEqual([]);
      expect(deps.apiHealthMonitor.recordFailure).toHaveBeenCalledTimes(1);
      expect(deps.apiHealthMonitor.recordSuccess).not.toHaveBeenCalled();
    });

    test('returns [] and records failure on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
      const { client, deps } = makeClient();

      expect(await client.fetchTracks()).toEqual([]);
      expect(deps.apiHealthMonitor.recordFailure).toHaveBeenCalledTimes(1);
    });

    test('returns [] when poll times out', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(jsonResponse(200, { jobId: 'j1' }))
        .mockResolvedValue(jsonResponse(200, { status: 'processing' }));
      const { client } = makeClient({ pollIntervalMs: [0], pollMaxAttempts: 3 });

      expect(await client.fetchTracks()).toEqual([]);
    });
  });

  describe('fetchTrackDetail', () => {
    test('returns null without calling fetch when trackId is missing', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.fetchTrackDetail()).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('passes trackId as a query param and returns the analysis on success', async () => {
      const detail = { trackId: 'a.mp3', bpm: 128 };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, detail));
      const { client } = makeClient();

      const result = await client.fetchTrackDetail('a.mp3');

      expect(result).toEqual(detail);
      const [url] = global.fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/dj/tracks/detail?trackId=a.mp3');
    });

    test('returns null on 404 without recording a health failure', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, { error: 'not found' }));
      const { client, deps } = makeClient();

      expect(await client.fetchTrackDetail('missing.mp3')).toBeNull();
      expect(deps.apiHealthMonitor.recordFailure).not.toHaveBeenCalled();
      expect(deps.apiHealthMonitor.recordSuccess).not.toHaveBeenCalled();
    });
  });

  describe('fetchTransition', () => {
    test('returns null without calling fetch when trackA or trackB is missing', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.fetchTransition('a.mp3', null)).toBeNull();
      expect(await client.fetchTransition(null, 'b.mp3')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('POSTs trackA/trackB and returns the recommendation on success', async () => {
      const recommendation = { trackA: 'a.mp3', trackB: 'b.mp3', transitionType: 'phrase_mix', decisionId: 'd1' };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, recommendation));
      const { client } = makeClient();

      const result = await client.fetchTransition('a.mp3', 'b.mp3');

      expect(result).toEqual(recommendation);
      const [url, init] = global.fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/dj/transition');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ trackA: 'a.mp3', trackB: 'b.mp3' });
    });

    test('passes trackA and trackB with .mp3 extension as-is (SPEC-8.5.7)', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));
      const { client } = makeClient();

      await client.fetchTransition('Outkast - Hey Ya!.mp3', 'Chappell Roan - Good Luck, Babe!.mp3');

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.trackA).toBe('Outkast - Hey Ya!.mp3');
      expect(body.trackB).toBe('Chappell Roan - Good Luck, Babe!.mp3');
    });

    test('returns null on 404 without recording a health failure', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, { error: 'no analysis' }));
      const { client, deps } = makeClient();

      expect(await client.fetchTransition('a.mp3', 'b.mp3')).toBeNull();
      expect(deps.apiHealthMonitor.recordFailure).not.toHaveBeenCalled();
    });
  });

  describe('fetchBatchPlan', () => {
    test('returns null without calling fetch when tracks is empty', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.fetchBatchPlan([])).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('includes profile in the body when provided', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { globalSetScore: 0.8 }));
      const { client } = makeClient();

      await client.fetchBatchPlan(['a.mp3', 'b.mp3'], 'club_peak');

      const [, init] = global.fetch.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({ tracks: ['a.mp3', 'b.mp3'], profile: 'club_peak' });
    });

    test('omits profile from the body when not provided', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { globalSetScore: 0.8 }));
      const { client } = makeClient();

      await client.fetchBatchPlan(['a.mp3', 'b.mp3']);

      const [, init] = global.fetch.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({ tracks: ['a.mp3', 'b.mp3'] });
    });

    test('polls batch/status when batch returns a jobId', async () => {
      const batchResult = { globalSetScore: 0.9, transitions: [] };
      global.fetch = jest.fn()
        .mockResolvedValueOnce(jsonResponse(200, { jobId: 'b1' }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'pending' }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'done', ...batchResult }));
      const { client } = makeClient({ pollIntervalMs: [0] });

      const result = await client.fetchBatchPlan(['a.mp3', 'b.mp3']);

      expect(result).toEqual({ status: 'done', ...batchResult });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      const statusUrl = global.fetch.mock.calls[1][0];
      expect(statusUrl).toContain('/api/dj/batch/status');
      expect(statusUrl).toContain('jobId=b1');
    });

    test('returns null when poll ends with error status', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(jsonResponse(200, { jobId: 'b1' }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'error', error: 'compute failed' }));
      const { client } = makeClient({ pollIntervalMs: [0] });

      expect(await client.fetchBatchPlan(['a.mp3'])).toBeNull();
    });
  });

  describe('sendFeedback', () => {
    test('returns null without calling fetch when decisionId or feedback is missing', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.sendFeedback(null, 'good')).toBeNull();
      expect(await client.sendFeedback('d1', null)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('POSTs decisionId/feedback/reason/comment and returns the echoed result', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
      const { client } = makeClient();

      await client.sendFeedback('d1', 'bad', 'wrong_bpm', 'too abrupt');

      const [url, init] = global.fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/dj/feedback');
      expect(JSON.parse(init.body)).toEqual({ decisionId: 'd1', feedback: 'bad', reason: 'wrong_bpm', comment: 'too abrupt' });
    });

    test('returns null on 404 (unknown decisionId) without recording a health failure', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, { error: 'unknown decisionId' }));
      const { client, deps } = makeClient();

      expect(await client.sendFeedback('unknown', 'good')).toBeNull();
      expect(deps.apiHealthMonitor.recordFailure).not.toHaveBeenCalled();
    });
  });

  describe('setIconic', () => {
    test('returns null without calling fetch when trackId is missing', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const { client } = makeClient();

      expect(await client.setIconic(null, true)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('POSTs trackId/iconic/trackName/artistName', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { iconic: true }));
      const { client } = makeClient();

      await client.setIconic('a.mp3', true, 'Track A', 'Artist X');

      const [url, init] = global.fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/dj/iconic');
      expect(JSON.parse(init.body)).toEqual({ trackId: 'a.mp3', iconic: true, trackName: 'Track A', artistName: 'Artist X' });
    });
  });

  describe('fetchSetProfiles', () => {
    test('returns profiles + default on success', async () => {
      const data = { profiles: [{ id: 'club_peak', energyCurve: [] }], default: 'club_peak' };
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, data));
      const { client } = makeClient();

      expect(await client.fetchSetProfiles()).toEqual(data);
    });

    test('returns null and records failure on server error', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, null));
      const { client, deps } = makeClient();

      expect(await client.fetchSetProfiles()).toBeNull();
      expect(deps.apiHealthMonitor.recordFailure).toHaveBeenCalledTimes(1);
    });
  });
});

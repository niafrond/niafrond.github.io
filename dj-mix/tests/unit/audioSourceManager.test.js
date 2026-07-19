import { jest, describe, test, expect } from '@jest/globals';
import { createAudioSourceManager } from '../../lib/audioSourceManager.js';

function makeFakeTrackPathDb(initial = {}) {
  const paths = { ...initial };
  return {
    get: jest.fn((key) => paths[key] || ''),
    set: jest.fn((key, cachePath) => { if (key && cachePath) paths[key] = cachePath; }),
    bulkSet: jest.fn((entries) => { for (const [key, cachePath] of entries) if (key && cachePath) paths[key] = cachePath; }),
    clear: jest.fn(() => { for (const key of Object.keys(paths)) delete paths[key]; }),
    size: jest.fn(() => Object.keys(paths).length),
  };
}

describe('audioSourceManager', () => {
  test('evictTrackSource clears local and session blob references', () => {
    const sessionBlobCache = new Map([
      ['track-1', {
        url: 'blob:session-track-1',
        stems: {
          vocalsUrl: 'blob:session-vocals-1',
          instrumentalUrl: '',
          echoUrl: '',
          distortionUrl: '',
        },
      }],
    ]);
    const touchQueueItem = jest.fn();
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.revokeObjectURL = jest.fn();
    const manager = createAudioSourceManager({
      apiHealthMonitor: null,
      audioCacheName: 'dj-mix:test',
      getDownloaderApiUrl: () => '',
      onQueueUpdated: jest.fn(),
      sessionBlobCache,
      touchQueueItem,
    });
    const item = {
      id: 'track-1',
      uri: 'track-1',
      name: 'Track One',
      localBlobUrl: 'blob:item-track-1',
      localStemUrls: {
        vocalsUrl: 'blob:item-vocals-1',
        instrumentalUrl: '',
        echoUrl: '',
        distortionUrl: '',
      },
      persistedSourceUrl: '',
      sourceState: 'ready',
    };

    const trimmed = manager.evictTrackSource(item, { notify: false });

    expect(trimmed).toBe(true);
    expect(item.localBlobUrl).toBeNull();
    expect(item.localStemUrls).toBeNull();
    expect(item.sourceState).toBe('idle');
    expect(sessionBlobCache.size).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:item-track-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:item-vocals-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-track-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-vocals-1');
    expect(touchQueueItem).toHaveBeenCalled();

    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe('prefetchTrackToLocalCache concurrency', () => {
    const originalFetch = global.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    // POST /api/download is orchestration-only and always returns JSON with
    // a cachePath — never audio bytes directly (see SPEC-11.2.1).
    function makeDownloadJsonResponse(cachePath = '/cache/track.mp3') {
      return {
        ok: true,
        json: async () => ({ cachePath, cacheState: 'MISS' }),
      };
    }

    // GET /api/stream on the CDN serves the actual bytes (SPEC-11.2.3).
    function makeStreamResponse() {
      const blob = new Blob(['audio-bytes'], { type: 'audio/mpeg' });
      return {
        ok: true,
        blob: async () => blob,
      };
    }

    // Routes each call to the right canned response based on whether it's
    // the orchestration POST or the CDN stream GET.
    function makeFetchMock() {
      return jest.fn((url, init) => {
        if (init?.method === 'POST') return Promise.resolve(makeDownloadJsonResponse());
        return Promise.resolve(makeStreamResponse());
      });
    }

    function makeManager(overrides = {}) {
      return createAudioSourceManager({
        apiHealthMonitor: null,
        audioCacheName: 'dj-mix:test',
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => '',
        getDownloaderCdnUrl: () => 'http://cdn.test',
        onQueueUpdated: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
        ...overrides,
      });
    }

    afterEach(() => {
      global.fetch = originalFetch;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    // Regression test: "Tout télécharger", the page-load cache sync, the
    // Spotify sync loop and TXT import all call prefetchTrackToLocalCache
    // independently. Without de-duplication, two of these racing on the same
    // track (e.g. clicking "Tout télécharger" right after a page reload,
    // while the startup sync is still working through the list) fired two
    // concurrent downloads and could leave the track's status flipped by
    // whichever call's write landed last — done  → error even though the
    // file was actually cached.
    test('concurrent calls for the same track share a single network request', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = { id: 'race-track', name: 'Race Track', artist: 'Race Artist' };

      const [a, b] = await Promise.all([
        manager.prefetchTrackToLocalCache(item),
        manager.prefetchTrackToLocalCache(item),
      ]);

      expect(a).toBe(true);
      expect(b).toBe(true);
      // One shared download = one orchestration POST + one CDN stream GET.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/download');
      expect(fetchMock.mock.calls[1][0]).toBe('http://cdn.test/api/stream?cachePath=%2Fcache%2Ftrack.mp3');
    });

    test('concurrent calls for different tracks each trigger their own request', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const manager = makeManager();
      const trackA = { id: 'track-a', name: 'Track A', artist: 'Artist A' };
      const trackB = { id: 'track-b', name: 'Track B', artist: 'Artist B' };

      await Promise.all([
        manager.prefetchTrackToLocalCache(trackA),
        manager.prefetchTrackToLocalCache(trackB),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    // A struggling/failing download must not permanently block retries: once
    // the shared in-flight attempt settles, a later call for the same track
    // has to try again rather than being stuck joining a dead promise.
    test('a later call retries after an earlier in-flight attempt failed', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' })
        .mockResolvedValueOnce(makeDownloadJsonResponse())
        .mockResolvedValueOnce(makeStreamResponse());
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = { id: 'flaky-track', name: 'Flaky Track', artist: 'Flaky Artist' };

      const first = await manager.prefetchTrackToLocalCache(item);
      const second = await manager.prefetchTrackToLocalCache(item);

      expect(first).toBe(false);
      expect(second).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    // SPEC-11.2.2: a download response without cachePath must fail loudly
    // rather than silently proceeding to stream from an undefined path.
    test('download fails when the orchestration response has no cachePath', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = { id: 'no-cachepath', name: 'No CachePath', artist: 'Nobody' };

      const result = await manager.prefetchTrackToLocalCache(item);

      expect(result).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // SPEC-11.2.0: a known cachePath (previous download, or listed from the
    // library/cache index) must skip the orchestration POST on the main API
    // entirely — the whole point of the CDN split is that playback of
    // already-cached tracks keeps working even while the main API is busy.
    test('skips orchestration and streams directly from the CDN when cachePath is already known', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = { id: 'known-track', name: 'Known Track', artist: 'Known Artist', cachePath: '/cache/known-track.mp3' };

      const result = await manager.prefetchTrackToLocalCache(item);

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('http://cdn.test/api/stream?cachePath=%2Fcache%2Fknown-track.mp3');
    });

    // SPEC-11.2.6: once orchestration resolves a cachePath, it's written back
    // onto the item so a later call for the same item takes the SPEC-11.2.0
    // shortcut instead of re-orchestrating on the main API.
    test('patches item.cachePath after resolving a track via orchestration', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = { id: 'fresh-track', name: 'Fresh Track', artist: 'Fresh Artist' };

      expect(item.cachePath).toBeUndefined();
      await manager.prefetchTrackToLocalCache(item);

      expect(item.cachePath).toBe('/cache/track.mp3');
    });

    // SPEC-11.2.7: when item.cachePath is unknown but the local path DB
    // (synced from GET /api/cache/files at startup) already has an entry for
    // this track's cache key, orchestration must be skipped just like the
    // SPEC-11.2.0 shortcut — no POST /api/download at all.
    test('skips orchestration and streams directly from the CDN when the local path DB has an entry', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const trackPathDb = makeFakeTrackPathDb({ 'db-track': '/cache/from-db.mp3' });
      const manager = makeManager({ trackPathDb });
      const item = { id: 'db-track', name: 'DB Track', artist: 'DB Artist' };

      const result = await manager.prefetchTrackToLocalCache(item);

      expect(result).toBe(true);
      expect(item.cachePath).toBe('/cache/from-db.mp3');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('http://cdn.test/api/stream?cachePath=%2Fcache%2Ffrom-db.mp3');
    });

    // SPEC-11.2.8: once orchestration resolves a fresh cachePath, the local
    // path DB is updated too (not just the item), so a *different* item
    // sharing the same cache key benefits from the SPEC-11.2.7 shortcut
    // without ever calling POST /api/download for it.
    test('writes the resolved cachePath into the local path DB after orchestration', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const trackPathDb = makeFakeTrackPathDb();
      const manager = makeManager({ trackPathDb });
      const item = { id: 'new-track', name: 'New Track', artist: 'New Artist' };

      await manager.prefetchTrackToLocalCache(item);

      expect(trackPathDb.set).toHaveBeenCalledWith('new-track', '/cache/track.mp3');
      expect(trackPathDb.get('new-track')).toBe('/cache/track.mp3');
    });
  });

  describe('syncTrackPathDbFromCacheIndex', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    function makeCacheFilesPage(results, hasMore) {
      return { ok: true, json: async () => ({ count: 3, hasMore, results }) };
    }

    // SPEC-11.5.3: only cachePath (+ key) is extracted from each server
    // record — the rest of the /api/cache/files payload (artwork, audio
    // features, mix suggestions, ...) must never reach the local path DB.
    test('paginates the cache index and stores only key -> cachePath pairs', async () => {
      const fetchMock = jest.fn()
        .mockResolvedValueOnce(makeCacheFilesPage([
          { id: 'srv-1', trackName: 'A', artistName: 'Artist A', cachePath: '/mnt/e/AudioDB/a.mp3', artworkUrl: 'http://art/a.jpg' },
          { id: 'srv-2', trackName: 'B', artistName: 'Artist B', cachePath: '/mnt/e/AudioDB/b.mp3', audioFeatures: { bpm: 120 } },
        ], true))
        .mockResolvedValueOnce(makeCacheFilesPage([
          { id: '', trackName: 'C', artistName: 'Artist C', cachePath: '/mnt/e/AudioDB/c.mp3' },
        ], false));
      global.fetch = fetchMock;

      const trackPathDb = makeFakeTrackPathDb();
      const manager = createAudioSourceManager({
        apiHealthMonitor: null,
        audioCacheName: 'dj-mix:test',
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => '',
        onQueueUpdated: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
        trackPathDb,
      });

      const result = await manager.syncTrackPathDbFromCacheIndex();

      expect(result.synced).toBe(3);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/cache/files?limit=200&offset=0');
      expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/api/cache/files?limit=200&offset=2');
      expect(trackPathDb.get('srv-1')).toBe('/mnt/e/AudioDB/a.mp3');
      expect(trackPathDb.get('srv-2')).toBe('/mnt/e/AudioDB/b.mp3');
      // id was blank on the 3rd record: falls back to artist::name, same
      // convention as getTrackCacheKey.
      expect(trackPathDb.get('artist c::c')).toBe('/mnt/e/AudioDB/c.mp3');
    });

    test('is a no-op without a configured trackPathDb', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const manager = createAudioSourceManager({
        apiHealthMonitor: null,
        audioCacheName: 'dj-mix:test',
        getDownloaderApiUrl: () => 'http://api.test',
        onQueueUpdated: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
      });

      const result = await manager.syncTrackPathDbFromCacheIndex();

      expect(result).toEqual({ synced: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

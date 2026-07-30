import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { createAudioSourceManager } from '../../lib/audioSourceManager.js';

function makeFakeTrackPathDb(initial = {}) {
  const paths = { ...initial };
  return {
    get: jest.fn((key) => paths[key] || ''),
    set: jest.fn((key, cachePath) => { if (key && cachePath) paths[key] = cachePath; }),
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

    // SPEC-9.4.15: a relay-triggered add can legitimately take a long time
    // (relay network hop, server-side resolve/download for a track never
    // fetched before). Unlike /api/stems/* or the health probe, the
    // orchestration POST must never carry an AbortSignal.timeout — a timeout
    // would silently drop the track the user is still waiting for.
    test('the orchestration POST /api/download carries no AbortSignal.timeout', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = { id: 'slow-track', name: 'Slow Track', artist: 'Slow Artist' };

      await manager.prefetchTrackToLocalCache(item);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api.test/api/download');
      expect(init?.signal).toBeUndefined();
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

    test('retries a stalled orchestration download after 20s timeout', async () => {
      jest.useFakeTimers();
      try {
        URL.createObjectURL = jest.fn(() => 'blob:fake');
        URL.revokeObjectURL = jest.fn();

        const fetchMock = jest.fn((url, init) => {
          if (init?.method === 'POST') {
            if (fetchMock.mock.calls.filter(([, postInit]) => postInit?.method === 'POST').length === 1) {
              return new Promise(() => {});
            }
            return Promise.resolve({ ok: true, json: async () => ({ cachePath: '/cache/retried.mp3', cacheState: 'MISS' }) });
          }
          return Promise.resolve({ ok: true, blob: async () => new Blob(['audio-bytes'], { type: 'audio/mpeg' }) });
        });
        global.fetch = fetchMock;

        const manager = makeManager();
        const item = { id: 'timeout-track', name: 'Timeout Track', artist: 'Timeout Artist' };

        const pending = manager.prefetchTrackToLocalCache(item);
        jest.advanceTimersByTime(20000);
        await Promise.resolve();

        expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2);
        await pending;
      } finally {
        jest.useRealTimers();
      }
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

  describe('SPEC-13.3.9 — artwork CDN upgrade', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalFetch = global.fetch;

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      global.fetch = originalFetch;
    });

    // POST /api/download's JSON body carries whatever artworkUrl the backend
    // resolved: either a `/api/artwork?cachePath=...` CDN reference (mirrored
    // from iTunes/Deezer, see artworkCache.js on the API server) or, if that
    // mirroring failed, the original raw third-party URL unchanged.
    function makeFetchMock(artworkUrl) {
      return jest.fn((url, init) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ cachePath: '/cache/track.mp3', cacheState: 'MISS', artworkUrl }),
          });
        }
        return Promise.resolve({ ok: true, blob: async () => new Blob(['audio-bytes'], { type: 'audio/mpeg' }) });
      });
    }

    function makeManager(overrides = {}) {
      return createAudioSourceManager({
        apiHealthMonitor: null,
        audioCacheName: 'dj-mix:test',
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => 'tok',
        getDownloaderCdnUrl: () => 'http://cdn.test',
        onQueueUpdated: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
        ...overrides,
      });
    }

    // Third-party artwork CDNs (mzstatic.com, dzcdn.net) don't send
    // Access-Control-Allow-Origin: an <img> tag can still render them, but
    // neither fetch() (SPEC-13.3.2's data URI conversion) nor Android's own
    // Media Session artwork decode can read them, so the system notification
    // falls back to the app icon instead of the real cover.
    test('ensureLocalSource replaces a raw third-party artUrl with the CORS-safe CDN reference and persists it', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      global.fetch = makeFetchMock('/api/artwork?cachePath=%2Fart%2Fabc.jpg');

      const persistArtUrl = jest.fn();
      const manager = makeManager({ persistArtUrl });
      const item = {
        id: 'track-cors',
        name: 'Lebanese Blonde',
        artist: 'Thievery Corporation',
        artUrl: 'https://e-cdns-images.dzcdn.net/images/cover/xxx/500x500.jpg',
        duration: 1000,
      };

      await manager.ensureLocalSource(item);

      const expectedUrl = 'http://cdn.test/api/artwork?cachePath=%2Fart%2Fabc.jpg&token=tok';
      expect(item.artUrl).toBe(expectedUrl);
      expect(persistArtUrl).toHaveBeenCalledWith('track-cors', expectedUrl);
    });

    test('ensureLocalSource leaves item.artUrl untouched when the backend could not mirror the artwork', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const rawUrl = 'https://e-cdns-images.dzcdn.net/images/cover/xxx/500x500.jpg';
      global.fetch = makeFetchMock(rawUrl);

      const persistArtUrl = jest.fn();
      const manager = makeManager({ persistArtUrl });
      const item = { id: 'track-fallback', name: 'Track', artist: 'Artist', artUrl: rawUrl, duration: 1000 };

      await manager.ensureLocalSource(item);

      expect(item.artUrl).toBe(rawUrl);
      expect(persistArtUrl).not.toHaveBeenCalled();
    });

    // Once a track has a known cachePath (from a prior download or a bulk
    // prefetch), ensureLocalSource() takes the direct-to-CDN shortcut and
    // never calls POST /api/download again — so prefetchTrackToLocalCache
    // must apply the same upgrade, or a "Tout télécharger"-only track never
    // gets it before it's actually played.
    test('prefetchTrackToLocalCache applies the same artwork upgrade for tracks not yet playing', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      global.fetch = makeFetchMock('/api/artwork?cachePath=%2Fart%2Fabc.jpg');

      const persistArtUrl = jest.fn();
      const manager = makeManager({ persistArtUrl, getDownloaderApiToken: () => '' });
      const item = {
        id: 'prefetch-track',
        name: 'Prefetch Track',
        artist: 'Prefetch Artist',
        artUrl: 'https://is1-ssl.mzstatic.com/image/thumb/xxx/512x512bb.jpg',
      };

      await manager.prefetchTrackToLocalCache(item);

      const expectedUrl = 'http://cdn.test/api/artwork?cachePath=%2Fart%2Fabc.jpg';
      expect(item.artUrl).toBe(expectedUrl);
      expect(persistArtUrl).toHaveBeenCalledWith('prefetch-track', expectedUrl);
    });
  });

  describe('SPEC-13.3.10 — background artwork refresh for already-cached tracks', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalFetch = global.fetch;

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      global.fetch = originalFetch;
    });

    // item.cachePath already known → downloadTrackViaApi's direct-to-CDN shortcut
    // never calls POST /api/download on its own, so a track resolved before
    // SPEC-13.3.9 existed (or before the backend's own lazy-mirroring fix landed)
    // would otherwise stay stuck on a CORS-blocked raw artUrl forever.
    function makeFetchMock(artworkUrl) {
      return jest.fn((url, init) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ cachePath: '/cache/known.mp3', cacheState: 'HIT', artworkUrl }),
          });
        }
        return Promise.resolve({ ok: true, blob: async () => new Blob(['audio-bytes'], { type: 'audio/mpeg' }) });
      });
    }

    function flushMicrotasks() {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }

    function makeManager(overrides = {}) {
      return createAudioSourceManager({
        apiHealthMonitor: null,
        audioCacheName: 'dj-mix:test',
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => '',
        getDownloaderCdnUrl: () => 'http://cdn.test',
        onQueueUpdated: jest.fn(),
        persistArtUrl: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
        ...overrides,
      });
    }

    test('a known-cachePath track with a stuck raw artUrl fires a background metadata-only refresh, without delaying playback', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock('/api/artwork?cachePath=%2Fart%2Ffixed.jpg');
      global.fetch = fetchMock;

      const persistArtUrl = jest.fn();
      const manager = makeManager({ persistArtUrl });
      const item = {
        id: 'stuck-track',
        name: 'Stuck Track',
        artist: 'Stuck Artist',
        cachePath: '/cache/known.mp3',
        artUrl: 'https://e-cdns-images.dzcdn.net/images/cover/xxx/500x500.jpg',
        duration: 1000,
      };

      const localSource = await manager.ensureLocalSource(item);

      // Played immediately via the direct CDN stream — the artwork refresh (fired
      // first, but fire-and-forget) must not have blocked it.
      expect(localSource).toBe('blob:fake');
      expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
      expect(fetchMock.mock.calls[1][1]?.method).toBeUndefined(); // GET /api/stream

      await flushMicrotasks();

      const expectedUrl = 'http://cdn.test/api/artwork?cachePath=%2Fart%2Ffixed.jpg';
      expect(item.artUrl).toBe(expectedUrl);
      expect(persistArtUrl).toHaveBeenCalledWith('stuck-track', expectedUrl);
    });

    test('does not retry the background refresh on a later play within the same session once attempted', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const rawUrl = 'https://e-cdns-images.dzcdn.net/images/cover/xxx/500x500.jpg';
      // Backend still hasn't mirrored it (keeps echoing the same raw URL) —
      // isolates the session dedup guard from the "already fixed" natural exit.
      const fetchMock = makeFetchMock(rawUrl);
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = {
        id: 'still-stuck-track',
        name: 'Still Stuck',
        artist: 'Still Stuck Artist',
        cachePath: '/cache/known.mp3',
        artUrl: rawUrl,
        duration: 1000,
      };

      await manager.ensureLocalSource(item);
      await flushMicrotasks();
      await manager.ensureLocalSource(item);
      await flushMicrotasks();

      const postCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
      expect(postCalls).toHaveLength(1);
    });

    test('does not fire a background refresh when artUrl already points at our own CDN', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = jest.fn(() => Promise.resolve({
        ok: true,
        blob: async () => new Blob(['audio-bytes'], { type: 'audio/mpeg' }),
      }));
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = {
        id: 'fine-track',
        name: 'Fine Track',
        artist: 'Fine Artist',
        cachePath: '/cache/known.mp3',
        artUrl: 'http://cdn.test/api/artwork?cachePath=%2Fart%2Fok.jpg',
        duration: 1000,
      };

      await manager.ensureLocalSource(item);
      await flushMicrotasks();

      // 2 calls expected: the audio stream, and the artwork-bytes persist
      // (both plain GETs) — neither is the POST /api/download background
      // refresh this test guards against (SPEC-13.3.10).
      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const call of fetchMock.mock.calls) {
        expect(call[1]?.method).toBeUndefined();
      }
    });
  });

  describe('SPEC-13.3.12 — handleArtworkLoadError (dead /api/artwork cachePath, 404)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    function makeManager(overrides = {}) {
      return createAudioSourceManager({
        apiHealthMonitor: null,
        audioCacheName: 'dj-mix:test',
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => '',
        getDownloaderCdnUrl: () => 'http://cdn.test',
        onQueueUpdated: jest.fn(),
        persistArtUrl: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
        ...overrides,
      });
    }

    function flushMicrotasks() {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }

    test('re-resolves and persists a fresh artwork reference when the current one 404s', async () => {
      const fetchMock = jest.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ artworkUrl: '/api/artwork?cachePath=%2Fart%2Ffresh.jpg' }),
      }));
      global.fetch = fetchMock;

      const persistArtUrl = jest.fn();
      const manager = makeManager({ persistArtUrl });
      const item = {
        id: 'dead-artwork-track',
        name: 'Dead Artwork Track',
        artist: 'Some Artist',
        artUrl: 'http://cdn.test/api/artwork?cachePath=%2Fmnt%2Fe%2FAudioDB%2Fartwork%2Fdead.jpg',
      };

      manager.handleArtworkLoadError(item);
      await flushMicrotasks();

      expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/download', expect.objectContaining({ method: 'POST' }));
      const expectedUrl = 'http://cdn.test/api/artwork?cachePath=%2Fart%2Ffresh.jpg';
      expect(item.artUrl).toBe(expectedUrl);
      expect(persistArtUrl).toHaveBeenCalledWith('dead-artwork-track', expectedUrl);
    });

    test('does not fire for an artUrl that is not our own /api/artwork CDN reference', () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const manager = makeManager();
      manager.handleArtworkLoadError({
        id: 'raw-track',
        name: 'Raw Track',
        artist: 'Raw Artist',
        artUrl: 'https://e-cdns-images.dzcdn.net/images/cover/xxx/500x500.jpg',
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('only attempts the self-heal once per track per session', async () => {
      const fetchMock = jest.fn(() => Promise.resolve({
        ok: true,
        json: async () => ({ artworkUrl: '/api/artwork?cachePath=%2Fart%2Ffresh.jpg' }),
      }));
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = {
        id: 'repeat-404-track',
        name: 'Repeat 404 Track',
        artist: 'Some Artist',
        artUrl: 'http://cdn.test/api/artwork?cachePath=%2Fmnt%2Fdead.jpg',
      };

      manager.handleArtworkLoadError(item);
      await flushMicrotasks();
      manager.handleArtworkLoadError(item);
      await flushMicrotasks();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('does not fire while the API health monitor reports offline', () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const manager = makeManager({ apiHealthMonitor: { isOffline: () => true } });
      manager.handleArtworkLoadError({
        id: 'offline-track',
        name: 'Offline Track',
        artist: 'Some Artist',
        artUrl: 'http://cdn.test/api/artwork?cachePath=%2Fmnt%2Fdead.jpg',
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // SPEC-11.3.5 — bug d'origine : après un rechargement de page avec l'API
  // downloader hors ligne, une piste déjà jouée/téléchargée (persistedSourceUrl
  // restauré depuis une session précédente) déclenchait quand même une tentative
  // de re-téléchargement, car canLoadAudioSource() (qui charge l'URL via un
  // élément <audio>) échouait simplement parce que le serveur local était
  // injoignable — pas parce que la piste n'était pas en cache.
  describe('SPEC-11.3.5 — ensureLocalSource trusts known sources while the API is offline', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('returns item.persistedSourceUrl without probing the network or attempting a re-download', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const manager = createAudioSourceManager({
        apiHealthMonitor: { isOffline: () => true },
        audioCacheName: 'dj-mix:test-offline',
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => '',
        onQueueUpdated: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
      });

      const item = {
        id: 'already-local-track',
        name: 'Already Local',
        artist: 'Someone',
        persistedSourceUrl: 'http://api.test/api/cache/already-local.mp3',
      };

      const source = await manager.ensureLocalSource(item);

      expect(source).toBe('http://api.test/api/cache/already-local.mp3');
      expect(item.sourceState).toBe('ready');
      expect(item.sourceError).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('returns the direct playable URI without probing the network when offline', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const manager = createAudioSourceManager({
        apiHealthMonitor: { isOffline: () => true },
        audioCacheName: 'dj-mix:test-offline',
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => '',
        onQueueUpdated: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
      });

      const item = {
        id: 'already-local-track-2',
        name: 'Already Local Two',
        artist: 'Someone',
        uri: 'http://api.test/api/cache/already-local-2.mp3',
      };

      const source = await manager.ensureLocalSource(item);

      expect(source).toBe('http://api.test/api/cache/already-local-2.mp3');
      expect(item.sourceState).toBe('ready');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // SPEC-13.1.4 / SPEC-13.3.9 — local persistence moved from the Cache Storage
  // API (window.caches, unavailable over a plain-HTTP LAN IP — an insecure
  // context — which is this app's real deployment mode) to an IndexedDB-backed
  // blobStore (lib/blobStore.js). These tests inject a small in-memory fake
  // blobStore (rather than a real IndexedDB, already covered by
  // tests/unit/blobStore.test.js) to verify audioSourceManager actually reads
  // and writes through it on every download.
  describe('SPEC-13.1.4 / SPEC-13.3.9 — blobStore-backed local persistence (audio + artwork)', () => {
    const originalFetch = global.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    afterEach(() => {
      global.fetch = originalFetch;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    function makeFakeBlobStore() {
      const store = { audio: new Map(), artwork: new Map() };
      return {
        getBlob: jest.fn(async (kind, key) => store[kind]?.get(key) || null),
        putBlob: jest.fn(async (kind, key, blob) => { store[kind].set(key, blob); return true; }),
        deleteBlob: jest.fn(async (kind, key) => { store[kind]?.delete(key); return true; }),
        clearKind: jest.fn(async (kind) => { store[kind]?.clear(); return true; }),
        clearAll: jest.fn(async () => { store.audio.clear(); store.artwork.clear(); return true; }),
        _store: store,
      };
    }

    const ART_URL = 'http://cdn.test/api/artwork?cachePath=%2Fart%2Fok.jpg';

    function makeFetchMock() {
      return jest.fn((url) => {
        if (String(url).includes('/api/stream')) {
          return Promise.resolve({ ok: true, blob: async () => new Blob(['audio-bytes'], { type: 'audio/mpeg' }) });
        }
        if (String(url) === ART_URL) {
          return Promise.resolve({ ok: true, blob: async () => new Blob(['art-bytes'], { type: 'image/jpeg' }) });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });
    }

    function makeManager(blobStore, overrides = {}) {
      return createAudioSourceManager({
        apiHealthMonitor: null,
        blobStore,
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => '',
        getDownloaderCdnUrl: () => 'http://cdn.test',
        onQueueUpdated: jest.fn(),
        persistArtUrl: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
        ...overrides,
      });
    }

    test('persists both audio and artwork bytes on download, even when cachePath (and artUrl) were already known — direct regression test for the "fil rouge dit déjà téléchargé mais retélécharge" bug', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const blobStore = makeFakeBlobStore();
      const manager = makeManager(blobStore);
      const item = {
        id: 'known-track',
        name: 'Known Track',
        artist: 'Known Artist',
        cachePath: '/cache/known.mp3', // already known — takes the direct-CDN-stream shortcut
        artUrl: ART_URL, // already known — previously meant persistArtwork() never ran at all
        duration: 1000,
      };

      await manager.ensureLocalSource(item);

      expect(blobStore.putBlob).toHaveBeenCalledWith('audio', 'known-track', expect.any(Blob));
      expect(blobStore.putBlob).toHaveBeenCalledWith('artwork', 'known-track', expect.any(Blob));
      expect(blobStore._store.audio.get('known-track')?.type).toBe('audio/mpeg');
      expect(blobStore._store.artwork.get('known-track')?.type).toBe('image/jpeg');
    });

    test('a later ensureLocalSource() for the same track (fresh manager/session, shared blobStore) restores from the store instead of re-fetching', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const blobStore = makeFakeBlobStore();

      // Session 1: real download, populates the shared blobStore.
      global.fetch = makeFetchMock();
      const manager1 = makeManager(blobStore);
      const item1 = {
        id: 'repeat-track', name: 'Repeat Track', artist: 'Someone',
        cachePath: '/cache/repeat.mp3', artUrl: ART_URL, duration: 1000,
      };
      await manager1.ensureLocalSource(item1);

      // Session 2: fresh manager (fresh in-memory sessionBlobCache, exactly
      // like a page reload), same underlying persisted blobStore. Must not
      // hit the network again.
      const fetchMock2 = jest.fn();
      global.fetch = fetchMock2;
      const manager2 = makeManager(blobStore);
      const item2 = {
        id: 'repeat-track', name: 'Repeat Track', artist: 'Someone',
        cachePath: '/cache/repeat.mp3', artUrl: ART_URL, duration: 1000,
      };
      const source = await manager2.ensureLocalSource(item2);

      expect(source).toBe('blob:fake');
      expect(fetchMock2).not.toHaveBeenCalled();
    });

    test('deleteLocalCacheSong evicts both the audio and artwork blobs from the store', async () => {
      const blobStore = makeFakeBlobStore();
      await blobStore.putBlob('audio', 'del-track', new Blob(['a'], { type: 'audio/mpeg' }));
      await blobStore.putBlob('artwork', 'del-track', new Blob(['b'], { type: 'image/jpeg' }));

      global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
      const manager = makeManager(blobStore);

      await manager.deleteLocalCacheSong({ id: 'del-track', name: 'Del Track', artist: 'Someone', cachePath: '/cache/del.mp3' });

      expect(blobStore.deleteBlob).toHaveBeenCalledWith('audio', 'del-track');
      expect(blobStore.deleteBlob).toHaveBeenCalledWith('artwork', 'del-track');
      expect(blobStore._store.audio.has('del-track')).toBe(false);
      expect(blobStore._store.artwork.has('del-track')).toBe(false);
    });

    test('clearAllPersistedBlobs() delegates to blobStore.clearAll()', async () => {
      const blobStore = makeFakeBlobStore();
      const manager = makeManager(blobStore);
      await manager.clearAllPersistedBlobs();
      expect(blobStore.clearAll).toHaveBeenCalledTimes(1);
    });
  });
});

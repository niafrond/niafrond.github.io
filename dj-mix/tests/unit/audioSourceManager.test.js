import { jest, describe, test, expect } from '@jest/globals';
import { createAudioSourceManager } from '../../lib/audioSourceManager.js';

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

    function makeAudioResponse() {
      const blob = new Blob(['audio-bytes'], { type: 'audio/mpeg' });
      return {
        ok: true,
        headers: { get: () => 'audio/mpeg' },
        blob: async () => blob,
      };
    }

    function makeManager() {
      return createAudioSourceManager({
        apiHealthMonitor: null,
        audioCacheName: 'dj-mix:test',
        getDownloaderApiUrl: () => 'http://api.test',
        getDownloaderApiToken: () => '',
        onQueueUpdated: jest.fn(),
        sessionBlobCache: new Map(),
        touchQueueItem: jest.fn(),
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
      const fetchMock = jest.fn().mockResolvedValue(makeAudioResponse());
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = { id: 'race-track', name: 'Race Track', artist: 'Race Artist' };

      const [a, b] = await Promise.all([
        manager.prefetchTrackToLocalCache(item),
        manager.prefetchTrackToLocalCache(item),
      ]);

      expect(a).toBe(true);
      expect(b).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('concurrent calls for different tracks each trigger their own request', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = jest.fn().mockResolvedValue(makeAudioResponse());
      global.fetch = fetchMock;

      const manager = makeManager();
      const trackA = { id: 'track-a', name: 'Track A', artist: 'Artist A' };
      const trackB = { id: 'track-b', name: 'Track B', artist: 'Artist B' };

      await Promise.all([
        manager.prefetchTrackToLocalCache(trackA),
        manager.prefetchTrackToLocalCache(trackB),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // A struggling/failing download must not permanently block retries: once
    // the shared in-flight attempt settles, a later call for the same track
    // has to try again rather than being stuck joining a dead promise.
    test('a later call retries after an earlier in-flight attempt failed', async () => {
      URL.createObjectURL = jest.fn(() => 'blob:fake');
      URL.revokeObjectURL = jest.fn();
      const fetchMock = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' })
        .mockResolvedValueOnce(makeAudioResponse());
      global.fetch = fetchMock;

      const manager = makeManager();
      const item = { id: 'flaky-track', name: 'Flaky Track', artist: 'Flaky Artist' };

      const first = await manager.prefetchTrackToLocalCache(item);
      const second = await manager.prefetchTrackToLocalCache(item);

      expect(first).toBe(false);
      expect(second).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createAutoModeManager } from '../../lib/autoModeManager.js';

function makeManager(overrides = {}) {
  const defaults = {
    apiHealthMonitor: { isOffline: () => false, recordSuccess: jest.fn(), recordFailure: jest.fn() },
    getDownloaderApiUrl: () => '',
    getFilRougeManager: () => ({ isActive: () => false, getNextTrack: () => null }),
    getQueue: () => [],
    getCurrentTrackId: () => null,
    getCurrentTrackIndex: () => 0,
    searchTracksViaApi: jest.fn().mockResolvedValue([]),
    addToQueue: jest.fn().mockResolvedValue(undefined),
    showToast: jest.fn(),
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    getTrackMaxDurationSec: () => 0,
    getAutoFxMinGapMs: () => 14000,
    getAutoFxMaxGapMs: () => 45000,
    getDjMode: () => 'music',
    getDjModeGenrePrefs: () => [],
    getCurrentBpm: () => 0,
    onAutomixTimingCalculated: jest.fn(),
    onMixDataUpdated: jest.fn(),
    onAutoFxPlanCalculated: jest.fn(),
  };
  return createAutoModeManager({ ...defaults, ...overrides });
}

describe('autoModeManager', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  // SPEC-5.3.3: peek before consuming — already-queued track must NOT advance the fil rouge index
  test('SPEC-5.3.3: skips a fil rouge track already in queue WITHOUT advancing index, falls back to suggestions', async () => {
    const queue = [{ id: 'current', name: 'Current Song', artist: 'Artist A' }];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([
      { id: 'suggestion-1', name: 'Suggestion Song', artist: 'Artist B' },
    ]);
    const getNextTrack = jest.fn().mockReturnValue({ id: 'fr-1', name: 'Current Song', artist: 'Artist A' });
    const filRougeManager = {
      isActive: () => true,
      peekNextTrackFromAny: () => ({ id: 'fr-1', name: 'Current Song', artist: 'Artist A' }),
      getNextTrack,
    };

    const manager = makeManager({
      getFilRougeManager: () => filRougeManager,
      getQueue: () => queue,
      getCurrentTrackId: () => 'current',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi,
      addToQueue,
    });

    manager.toggleAutoMode();
    const added = await manager.searchAndAddNextTrack(queue[0]);

    expect(added).toBe(true);
    // getNextTrack must NOT have been called — index must not advance for a skipped track
    expect(getNextTrack).not.toHaveBeenCalled();
    expect(addToQueue).toHaveBeenCalledTimes(1);
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'suggestion-1', name: 'Suggestion Song', artist: 'Artist B' });
    expect(searchTracksViaApi).toHaveBeenCalledTimes(1);
  });

  // SPEC-5.3.3: when peeked track is NOT in queue, getNextTrack() IS called and track is added
  test('SPEC-5.3.3: adds fil rouge track and advances index only when track is not yet queued', async () => {
    const queue = [{ id: 'current', name: 'Current Song', artist: 'Artist A' }];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const nextTrack = { id: 'fr-2', name: 'Next Song', artist: 'Artist B' };
    const getNextTrack = jest.fn().mockReturnValue(nextTrack);
    const filRougeManager = {
      isActive: () => true,
      peekNextTrackFromAny: () => nextTrack,
      getNextTrack,
    };

    const manager = makeManager({
      getFilRougeManager: () => filRougeManager,
      getQueue: () => queue,
      getCurrentTrackId: () => 'current',
      getCurrentTrackIndex: () => 0,
      addToQueue,
    });

    manager.toggleAutoMode();
    const added = await manager.searchAndAddNextTrack(queue[0]);

    expect(added).toBe(true);
    expect(getNextTrack).toHaveBeenCalledTimes(1);
    expect(addToQueue).toHaveBeenCalledTimes(1);
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'fr-2', name: 'Next Song' });
  });

  // SPEC-5.1.5: nextTrackMixData must not leak zones from a previously-selected
  // "next track" onto a newly-selected one while its mix fetch is still pending.
  describe('SPEC-5.1.5: next-track mix data does not leak stale zones across selections', () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    test('resets nextTrackMixData to null (and notifies) before the new fetch resolves', async () => {
      const trackA = { id: 'track-a', name: 'Song A', artist: 'Artist A' };
      const trackB = { id: 'track-b', name: 'Song B', artist: 'Artist B' };
      const trackC = { id: 'track-c', name: 'Song C', artist: 'Artist C' };

      const queue = [trackA];
      const addToQueue = jest.fn().mockResolvedValue(undefined);
      const onMixDataUpdated = jest.fn();

      let resolveMixB;
      let resolveMixC;
      const mixBPromise = new Promise((resolve) => { resolveMixB = resolve; });
      const mixCPromise = new Promise((resolve) => { resolveMixC = resolve; });

      const fetchMock = jest.fn((url) => {
        const u = String(url);
        if (u.includes('artist=Artist+B')) return mixBPromise;
        if (u.includes('artist=Artist+C')) return mixCPromise;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ mix: null }) });
      });
      global.fetch = fetchMock;

      let peeked = trackB;
      let nextReturn = trackB;
      const filRougeManager = {
        isActive: () => true,
        peekNextTrackFromAny: () => peeked,
        getNextTrack: () => nextReturn,
      };

      const manager = makeManager({
        getDownloaderApiUrl: () => 'http://api.test',
        getFilRougeManager: () => filRougeManager,
        getQueue: () => queue,
        getCurrentTrackId: () => trackA.id,
        getCurrentTrackIndex: () => 0,
        addToQueue,
        onMixDataUpdated,
      });

      manager.toggleAutoMode();

      // First search selects trackB and starts (but doesn't finish) fetching its mix data.
      await manager.searchAndAddNextTrack(trackA);
      expect(manager.getNextTrackMixData()).toBeNull();

      // Resolve trackB's mix fetch — it becomes the current "next track" zones.
      resolveMixB({ ok: true, status: 200, json: async () => ({ mix: { durationSec: 200 } }) });
      await flush(); await flush(); await flush();
      expect(manager.getNextTrackMixData()).toEqual({ durationSec: 200 });
      onMixDataUpdated.mockClear();

      // A second search now selects trackC instead, while trackC's mix fetch is still pending.
      peeked = trackC;
      nextReturn = trackC;
      await manager.searchAndAddNextTrack(trackA);

      // trackB's zones must already be cleared — not left showing on trackC.
      expect(manager.getNextTrackMixData()).toBeNull();
      expect(onMixDataUpdated).toHaveBeenCalledWith(null);

      // Once trackC's fetch resolves, its own (correct) mix data takes over.
      resolveMixC({ ok: true, status: 200, json: async () => ({ mix: { durationSec: 150 } }) });
      await flush(); await flush(); await flush();
      expect(manager.getNextTrackMixData()).toEqual({ durationSec: 150 });
    });
  });

  test('skips queued suggestion search when disabled', async () => {
    const queue = [{ id: 'current', name: 'Current Song', artist: 'Artist A' }];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([
      { id: 'suggestion-1', name: 'Suggestion Song', artist: 'Artist B' },
    ]);

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'current',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi,
      addToQueue,
    });

    manager.toggleAutoMode();
    manager.setSuggestionSearchEnabled(false);

    const added = await manager.searchAndAddNextTrack(queue[0]);

    expect(added).toBe(false);
    expect(searchTracksViaApi).not.toHaveBeenCalled();
    expect(addToQueue).not.toHaveBeenCalled();
  });

  // SPEC-5.3.4 / SPEC-5.3.5 — /api/suggestions contract after the swagger update
  describe('/api/suggestions request params and client-side bpm sort', () => {
    afterEach(() => {
      delete global.fetch;
    });

    test('SPEC-5.3.4: sends only server-supported params, no removed hint params', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: [] }),
      });
      const queue = [{ id: 'current', name: 'Current Song', artist: 'Artist A', genre: 'House' }];
      const manager = makeManager({
        getDownloaderApiUrl: () => 'http://api',
        getQueue: () => queue,
        getCurrentTrackId: () => 'current',
        getCurrentTrackIndex: () => 0,
        getDjMode: () => 'music',
        searchTracksViaApi: jest.fn().mockResolvedValue([]),
      });

      manager.toggleAutoMode();
      await manager.searchAndAddNextTrack(queue[0]);

      expect(global.fetch).toHaveBeenCalled();
      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain('/api/suggestions');
      expect(url).not.toMatch(/minBpm|preferDanceable|preferGenres|preferGenre=|preferArtist|maxBpmJump|[?&]tracks=/);
    });

    test('SPEC-5.3.4: dance mode adds sameGenreOnly=true instead of removed hint params', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: [] }),
      });
      const queue = [{ id: 'current', name: 'Current Song', artist: 'Artist A' }];
      const manager = makeManager({
        getDownloaderApiUrl: () => 'http://api',
        getQueue: () => queue,
        getCurrentTrackId: () => 'current',
        getCurrentTrackIndex: () => 0,
        getDjMode: () => 'dance',
        searchTracksViaApi: jest.fn().mockResolvedValue([]),
      });

      manager.toggleAutoMode();
      await manager.searchAndAddNextTrack(queue[0]);

      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain('sameGenreOnly=true');
    });

    test('SPEC-5.3.5: dance mode sorts results by audioFeatures.bpm descending', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: [
            { id: 'slow', trackName: 'Slow', artistName: 'X', audioFeatures: { bpm: 100 } },
            { id: 'fast', trackName: 'Fast', artistName: 'Y', audioFeatures: { bpm: 140 } },
          ],
        }),
      });
      const queue = [{ id: 'current', name: 'Current Song', artist: 'Artist A' }];
      const addToQueue = jest.fn().mockResolvedValue(undefined);
      const manager = makeManager({
        getDownloaderApiUrl: () => 'http://api',
        getQueue: () => queue,
        getCurrentTrackId: () => 'current',
        getCurrentTrackIndex: () => 0,
        getDjMode: () => 'dance',
        getCurrentBpm: () => 120,
        addToQueue,
      });

      manager.toggleAutoMode();
      await manager.searchAndAddNextTrack(queue[0]);

      expect(addToQueue).toHaveBeenCalledTimes(1);
      expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'fast' });
    });
  });

  describe('crossfade loop prevention', () => {
    test('excludes track currently on deck B after crossfade (matched by ID)', async () => {
      // Scenario: deck A played trackA, crossfade moved to deck B playing trackB.
      // trackB was removed from queue when it started. onTrackFinished(trackA) now
      // searches for the next track — trackB must NOT be re-queued.
      const trackA = { id: 'track-a', name: 'Song A', artist: 'Artist A' };
      const trackB = { id: 'track-b', name: 'Song B', artist: 'Artist B' };
      const trackC = { id: 'track-c', name: 'Song C', artist: 'Artist C' };

      // Queue only has trackA — trackB was removed when deck B started playing it
      const queue = [trackA];
      const addToQueue = jest.fn().mockResolvedValue(undefined);
      const searchTracksViaApi = jest.fn().mockResolvedValue([trackB, trackC]);

      const manager = makeManager({
        getQueue: () => queue,
        getCurrentTrackId: () => trackA.id,
        getCurrentTrackIndex: () => 0,
        searchTracksViaApi,
        addToQueue,
      });

      manager.toggleAutoMode();
      // Simulate deck B starting — scheduleAutomixTiming is called with trackB
      manager.scheduleAutomixTiming(trackB);
      // Simulate deck A finishing — search triggered with trackA as reference
      const added = await manager.searchAndAddNextTrack(trackA);

      expect(added).toBe(true);
      expect(addToQueue).toHaveBeenCalledTimes(1);
      // trackB must be excluded; trackC should be selected
      expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'track-c' });
    });

    test('excludes track currently on deck B after crossfade (matched by name+artist)', async () => {
      // Same scenario but trackB on deck has a different internal ID than the search result.
      const trackA = { id: 'track-a', name: 'Song A', artist: 'Artist A' };
      const trackBOnDeck = { id: 'track-b-internal', name: 'Song B', artist: 'Artist B' };
      // Search result for the same song with a different ID format
      const trackBResult = { id: 'track-b-api', name: 'Song B', artist: 'Artist B' };
      const trackC = { id: 'track-c', name: 'Song C', artist: 'Artist C' };

      const queue = [trackA];
      const addToQueue = jest.fn().mockResolvedValue(undefined);
      const searchTracksViaApi = jest.fn().mockResolvedValue([trackBResult, trackC]);

      const manager = makeManager({
        getQueue: () => queue,
        getCurrentTrackId: () => trackA.id,
        getCurrentTrackIndex: () => 0,
        searchTracksViaApi,
        addToQueue,
      });

      manager.toggleAutoMode();
      manager.scheduleAutomixTiming(trackBOnDeck);
      const added = await manager.searchAndAddNextTrack(trackA);

      expect(added).toBe(true);
      expect(addToQueue).toHaveBeenCalledTimes(1);
      expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'track-c' });
    });

    test('does not exclude deck track when it is the same as currentTrack (normal first play)', async () => {
      // When scheduleAutomixTiming and searchAndAddNextTrack are called for the SAME track
      // (normal track start), the existing currentTrack check is sufficient and deck-guard
      // must not break the selection of a valid different track.
      const trackA = { id: 'track-a', name: 'Song A', artist: 'Artist A' };
      const trackB = { id: 'track-b', name: 'Song B', artist: 'Artist B' };

      const queue = [trackA];
      const addToQueue = jest.fn().mockResolvedValue(undefined);
      const searchTracksViaApi = jest.fn().mockResolvedValue([trackB]);

      const manager = makeManager({
        getQueue: () => queue,
        getCurrentTrackId: () => trackA.id,
        getCurrentTrackIndex: () => 0,
        searchTracksViaApi,
        addToQueue,
      });

      manager.toggleAutoMode();
      // Same track: both deck and search reference are trackA
      manager.scheduleAutomixTiming(trackA);
      const added = await manager.searchAndAddNextTrack(trackA);

      expect(added).toBe(true);
      expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'track-b' });
    });

    test('reset clears currentlyPlayingTrack so it does not bleed into next session', async () => {
      const trackA = { id: 'track-a', name: 'Song A', artist: 'Artist A' };
      const trackB = { id: 'track-b', name: 'Song B', artist: 'Artist B' };
      const trackC = { id: 'track-c', name: 'Song C', artist: 'Artist C' };

      const queue = [trackA];
      const addToQueue = jest.fn().mockResolvedValue(undefined);
      const searchTracksViaApi = jest.fn().mockResolvedValue([trackB, trackC]);

      const manager = makeManager({
        getQueue: () => queue,
        getCurrentTrackId: () => trackA.id,
        getCurrentTrackIndex: () => 0,
        searchTracksViaApi,
        addToQueue,
      });

      manager.toggleAutoMode();
      manager.scheduleAutomixTiming(trackB);
      manager.reset();
      manager.toggleAutoMode(); // re-enable after reset

      // After reset, trackB should no longer be excluded
      const added = await manager.searchAndAddNextTrack(trackA);

      expect(added).toBe(true);
      // trackB is the first result and should now be selectable
      expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'track-b' });
    });
  });

  // SPEC-2.5.5: "Actualiser mix data" queue button — refreshMixData bypasses caches
  describe('refreshMixData', () => {
    test('SPEC-2.5.5: bypasses the memory/localStorage cache and re-fetches fresh mix data', async () => {
      const fetchMock = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ mix: { durationSec: 180 } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ mix: { durationSec: 200 } }) });
      global.fetch = fetchMock;

      const manager = makeManager({ getDownloaderApiUrl: () => 'http://api.test' });

      const first = await manager.fetchMixData('Track', 'Artist');
      expect(first).toEqual({ durationSec: 180 });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call is served from cache — no extra network call
      const cached = await manager.fetchMixData('Track', 'Artist');
      expect(cached).toEqual({ durationSec: 180 });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // refreshMixData invalidates the cache and hits the network again
      const refreshed = await manager.refreshMixData('Track', 'Artist');
      expect(refreshed).toEqual({ durationSec: 200 });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Subsequent fetchMixData calls are now served from the refreshed cache entry
      const afterRefresh = await manager.fetchMixData('Track', 'Artist');
      expect(afterRefresh).toEqual({ durationSec: 200 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('SPEC-2.5.5: returns null without a network call when trackName is missing', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const manager = makeManager({ getDownloaderApiUrl: () => 'http://api.test' });

      const result = await manager.refreshMixData('', 'Artist');

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

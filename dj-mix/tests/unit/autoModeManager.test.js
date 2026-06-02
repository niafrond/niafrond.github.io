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

  test('skips a fil rouge track already in queue and falls back to suggestions', async () => {
    const queue = [{ id: 'current', name: 'Current Song', artist: 'Artist A' }];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([
      { id: 'suggestion-1', name: 'Suggestion Song', artist: 'Artist B' },
    ]);
    const filRougeManager = {
      isActive: () => true,
      getNextTrack: () => ({ id: 'fr-1', name: 'Current Song', artist: 'Artist A' }),
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
    expect(addToQueue).toHaveBeenCalledTimes(1);
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'suggestion-1', name: 'Suggestion Song', artist: 'Artist B' });
    expect(searchTracksViaApi).toHaveBeenCalledTimes(1);
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
});

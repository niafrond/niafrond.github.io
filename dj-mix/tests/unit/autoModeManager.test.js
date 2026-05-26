import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createAutoModeManager } from '../../lib/autoModeManager.js';

describe('autoModeManager', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('skips a fil rouge track already in queue and falls back to suggestions', async () => {
    const queue = [
      { id: 'current', name: 'Current Song', artist: 'Artist A' },
    ];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([
      { id: 'suggestion-1', name: 'Suggestion Song', artist: 'Artist B' },
    ]);
    const filRougeManager = {
      isActive: () => true,
      getNextTrack: () => ({ id: 'fr-1', name: 'Current Song', artist: 'Artist A' }),
    };

    const manager = createAutoModeManager({
      apiHealthMonitor: { isOffline: () => false, recordSuccess: jest.fn(), recordFailure: jest.fn() },
      getDownloaderApiUrl: () => '',
      getFilRougeManager: () => filRougeManager,
      getQueue: () => queue,
      getCurrentTrackId: () => 'current',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi,
      addToQueue,
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
    });

    manager.toggleAutoMode();

    const added = await manager.searchAndAddNextTrack(queue[0]);

    expect(added).toBe(true);
    expect(addToQueue).toHaveBeenCalledTimes(1);
    expect(addToQueue.mock.calls[0][0]).toMatchObject({
      id: 'suggestion-1',
      name: 'Suggestion Song',
      artist: 'Artist B',
    });
    expect(searchTracksViaApi).toHaveBeenCalledTimes(1);
  });
});

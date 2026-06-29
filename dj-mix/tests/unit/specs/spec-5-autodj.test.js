/**
 * Spec-driven tests for §5 — Auto DJ (AutoMode)
 * References: SPEC-5.1–5.7
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createAutoModeManager } from '../../../lib/autoModeManager.js';

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

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

// ── SPEC-5.2 — Track exclusion ──────────────────────────────────────────────

describe('SPEC-5.2 — Track exclusion', () => {
  test('SPEC-5.2.1 — excludes played tracks from history', async () => {
    const trackA = { id: 'a', name: 'Song A', artist: 'Artist A' };
    const trackB = { id: 'b', name: 'Song B', artist: 'Artist B' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([trackA, trackB]);

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi,
      addToQueue,
    });
    manager.toggleAutoMode();

    // Mark trackA as played, then search
    manager.onTrackFinished(trackA);
    const added = await manager.searchAndAddNextTrack(trackA);

    expect(added).toBe(true);
    // trackA should be excluded (played + in queue), trackB selected
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'b' });
  });

  test('SPEC-5.2.3 — excludes track on active deck by ID', async () => {
    const trackA = { id: 'a', name: 'Song A', artist: 'Artist A' };
    const trackB = { id: 'b', name: 'Song B', artist: 'Artist B' };
    const trackC = { id: 'c', name: 'Song C', artist: 'Artist C' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([trackB, trackC]);

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi,
      addToQueue,
    });
    manager.toggleAutoMode();
    // Deck B is playing trackB
    manager.scheduleAutomixTiming(trackB);

    const added = await manager.searchAndAddNextTrack(trackA);
    expect(added).toBe(true);
    // trackB on deck → excluded, trackC selected
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'c' });
  });

  test('SPEC-5.2.4 — excludes deck track by name+artist when IDs differ', async () => {
    const trackA = { id: 'a', name: 'Song A', artist: 'Artist A' };
    const trackBDeck = { id: 'b-deck', name: 'Song B', artist: 'Artist B' };
    const trackBSearch = { id: 'b-api', name: 'Song B', artist: 'Artist B' };
    const trackC = { id: 'c', name: 'Song C', artist: 'Artist C' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([trackBSearch, trackC]);

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi,
      addToQueue,
    });
    manager.toggleAutoMode();
    manager.scheduleAutomixTiming(trackBDeck);

    const added = await manager.searchAndAddNextTrack(trackA);
    expect(added).toBe(true);
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'c' });
  });

  test('SPEC-5.2.5 — reset clears deck fingerprint', async () => {
    const trackA = { id: 'a', name: 'Song A', artist: 'Artist A' };
    const trackB = { id: 'b', name: 'Song B', artist: 'Artist B' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([trackB]);

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi,
      addToQueue,
    });
    manager.toggleAutoMode();
    manager.scheduleAutomixTiming(trackB);
    manager.reset();
    manager.toggleAutoMode();

    const added = await manager.searchAndAddNextTrack(trackA);
    expect(added).toBe(true);
    // After reset, trackB should be selectable again
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'b' });
  });
});

// ── SPEC-5.3 — Search chain with fallbacks ──────────────────────────────────

describe('SPEC-5.3 — Fallback chain', () => {
  test('SPEC-5.3.1 — falls through to fil rouge when no results', async () => {
    const trackA = { id: 'a', name: 'Song A', artist: 'Artist A' };
    const filRougeTrack = { id: 'fr-1', name: 'FR Song', artist: 'FR Artist' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const filRougeManager = {
      isActive: () => true,
      getNextTrack: () => filRougeTrack,
    };

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      getFilRougeManager: () => filRougeManager,
      searchTracksViaApi: jest.fn().mockResolvedValue([]),
      addToQueue,
    });
    manager.toggleAutoMode();

    const added = await manager.searchAndAddNextTrack(trackA);
    expect(added).toBe(true);
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'fr-1' });
  });

  test('SPEC-5.3.1 — skips fil rouge track if already in queue', async () => {
    const trackA = { id: 'a', name: 'Current', artist: 'A' };
    const frTrack = { id: 'fr-1', name: 'Current', artist: 'A' };
    const searchResult = { id: 'sr-1', name: 'Search Result', artist: 'B' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const filRougeManager = { isActive: () => true, getNextTrack: () => frTrack };

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      getFilRougeManager: () => filRougeManager,
      searchTracksViaApi: jest.fn().mockResolvedValue([searchResult]),
      addToQueue,
    });
    manager.toggleAutoMode();

    const added = await manager.searchAndAddNextTrack(trackA);
    expect(added).toBe(true);
    // Fil rouge duplicate skipped, search result used
    expect(addToQueue.mock.calls[0][0]).toMatchObject({ id: 'sr-1' });
  });

  test('SPEC-5.3.2 — returns false when API offline and no fil rouge', async () => {
    const trackA = { id: 'a', name: 'Song A', artist: 'A' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);

    const manager = makeManager({
      apiHealthMonitor: { isOffline: () => true, recordSuccess: jest.fn(), recordFailure: jest.fn() },
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi: jest.fn().mockResolvedValue([]),
      addToQueue,
    });
    manager.toggleAutoMode();

    const added = await manager.searchAndAddNextTrack(trackA);
    // With API offline and no fil rouge, nothing can be queued
    expect(added).toBe(false);
    expect(addToQueue).not.toHaveBeenCalled();
  });

  test('returns false when no track found anywhere', async () => {
    const trackA = { id: 'a', name: 'Song A', artist: 'A' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi: jest.fn().mockResolvedValue([]),
      addToQueue,
    });
    manager.toggleAutoMode();

    const added = await manager.searchAndAddNextTrack(trackA);
    expect(added).toBe(false);
    expect(addToQueue).not.toHaveBeenCalled();
  });
});

// ── SPEC-5.1 — Suggestion search toggle ─────────────────────────────────────

describe('SPEC-5.1 — Suggestion search enable/disable', () => {
  test('skips search when suggestion search disabled', async () => {
    const trackA = { id: 'a', name: 'Song A', artist: 'A' };
    const queue = [trackA];
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const searchTracksViaApi = jest.fn().mockResolvedValue([{ id: 'b', name: 'B', artist: 'B' }]);

    const manager = makeManager({
      getQueue: () => queue,
      getCurrentTrackId: () => 'a',
      getCurrentTrackIndex: () => 0,
      searchTracksViaApi,
      addToQueue,
    });
    manager.toggleAutoMode();
    manager.setSuggestionSearchEnabled(false);

    const added = await manager.searchAndAddNextTrack(trackA);
    expect(added).toBe(false);
    expect(searchTracksViaApi).not.toHaveBeenCalled();
  });
});

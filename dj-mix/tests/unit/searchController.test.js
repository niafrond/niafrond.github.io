import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createSearchController } from '../../lib/searchController.js';
import { uiState } from '../../lib/uiState.js';

function makeController(overrides = {}) {
  return createSearchController({
    getDownloaderApiUrl: jest.fn().mockReturnValue('http://api'),
    apiHealthMonitor: { isOffline: jest.fn().mockReturnValue(false) },
    searchTracksRaw: jest.fn().mockResolvedValue({ tracks: [], pollToken: null }),
    pollSearchResults: jest.fn().mockResolvedValue({ pending: false, tracks: [] }),
    deleteLocalCacheSong: jest.fn().mockResolvedValue(undefined),
    getPlayer: jest.fn().mockReturnValue({ isCrossfading: false }),
    addToQueue: jest.fn().mockResolvedValue(undefined),
    startPlaybackForIndex: jest.fn().mockResolvedValue(undefined),
    renderQueue: jest.fn(),
    getResolvedInactiveDeck: jest.fn().mockReturnValue('B'),
    launchDeckFromQueue: jest.fn().mockResolvedValue(undefined),
    deckToPlatineLabel: jest.fn().mockReturnValue('2'),
    updateDeckCueUI: jest.fn(),
    showCrossfadeRing: jest.fn(),
    showToast: jest.fn(),
    logInfo: jest.fn(),
    logError: jest.fn(),
    isCacheTabActive: jest.fn().mockReturnValue(false),
    runCacheSearch: jest.fn(),
    searchResults: null,
    searchInput: null,
    searchClear: null,
    searchClose: null,
    searchOverlay: null,
    autoMixBtn: null,
    ...overrides,
  });
}

beforeEach(() => {
  uiState.queue = [];
  uiState.isPlaying = false;
  uiState.deckBCueIndex = -1;
  uiState.deckCueDeck = null;
});

describe('runSearch', () => {
  test('no-ops when apiUrl not configured', async () => {
    const ctrl = makeController({
      getDownloaderApiUrl: jest.fn().mockReturnValue(null),
    });
    const searchTracksRaw = jest.fn();
    await ctrl.runSearch('daft punk');
    expect(searchTracksRaw).not.toHaveBeenCalled();
  });

  test('no-ops when API is offline', async () => {
    const searchTracksRaw = jest.fn();
    const ctrl = makeController({
      apiHealthMonitor: { isOffline: jest.fn().mockReturnValue(true) },
      searchTracksRaw,
    });
    await ctrl.runSearch('test');
    expect(searchTracksRaw).not.toHaveBeenCalled();
  });

  test('calls searchTracksRaw with query and limit', async () => {
    const searchTracksRaw = jest.fn().mockResolvedValue({ tracks: [], pollToken: null });
    const ctrl = makeController({ searchTracksRaw });
    await ctrl.runSearch('madonna');
    expect(searchTracksRaw).toHaveBeenCalledWith('madonna', 25, false);
  });

  test('skipCache=true is forwarded', async () => {
    const searchTracksRaw = jest.fn().mockResolvedValue({ tracks: [], pollToken: null });
    const ctrl = makeController({ searchTracksRaw });
    await ctrl.runSearch('madonna', true);
    expect(searchTracksRaw).toHaveBeenCalledWith('madonna', 25, true);
  });
});

describe('getQueueIndexForTrack', () => {
  test('finds track by id', () => {
    uiState.queue = [{ id: 'abc', name: 'Track', artist: 'X' }];
    const ctrl = makeController();
    expect(ctrl.getQueueIndexForTrack({ id: 'abc' })).toBe(0);
  });

  test('finds track by name+artist when id differs', () => {
    uiState.queue = [{ id: 'abc', name: 'Track', artist: 'X' }];
    const ctrl = makeController();
    expect(ctrl.getQueueIndexForTrack({ id: 'xyz', name: 'Track', artist: 'X' })).toBe(0);
  });

  test('returns -1 when not in queue', () => {
    uiState.queue = [{ id: 'abc', name: 'Track', artist: 'X' }];
    const ctrl = makeController();
    expect(ctrl.getQueueIndexForTrack({ id: 'zzz' })).toBe(-1);
  });
});

describe('triggerSearchFade', () => {
  test('no-ops when player is crossfading', async () => {
    const addToQueue = jest.fn();
    const ctrl = makeController({
      getPlayer: jest.fn().mockReturnValue({ isCrossfading: true }),
      addToQueue,
    });
    await ctrl.triggerSearchFade({ id: '1', name: 'T' });
    expect(addToQueue).not.toHaveBeenCalled();
  });

  test('calls addToQueue with playNow when not playing', async () => {
    uiState.isPlaying = false;
    const addToQueue = jest.fn().mockResolvedValue(undefined);
    const ctrl = makeController({ addToQueue });
    await ctrl.triggerSearchFade({ id: '1', name: 'T' });
    expect(addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
      expect.objectContaining({ playNow: true, preferFade: false }),
    );
  });

  test('sets deckBCueIndex and triggers automix when already playing', async () => {
    uiState.isPlaying = true;
    uiState.queue = [{ id: 'existing', name: 'Existing', artist: 'X' }];
    const launchDeckFromQueue = jest.fn().mockResolvedValue(undefined);
    const autoMixBtnEl = { click: jest.fn() };
    const ctrl = makeController({
      getPlayer: jest.fn().mockReturnValue({ isCrossfading: false }),
      addToQueue: jest.fn().mockImplementation(async (track) => {
        uiState.queue.push({ ...track });
      }),
      launchDeckFromQueue,
      autoMixBtn: autoMixBtnEl,
    });
    await ctrl.triggerSearchFade({ id: 'new-track', name: 'New', artist: 'Y' });
    expect(launchDeckFromQueue).toHaveBeenCalled();
    expect(autoMixBtnEl.click).toHaveBeenCalled();
  });
});

describe('openSearch / closeSearch', () => {
  test('openSearch shows overlay', () => {
    const overlay = { hidden: true };
    const close = { hidden: true };
    const ctrl = makeController({ searchOverlay: overlay, searchClose: close });
    ctrl.openSearch();
    expect(overlay.hidden).toBe(false);
    expect(close.hidden).toBe(false);
  });

  test('closeSearch hides overlay', () => {
    const overlay = { hidden: false };
    const close = { hidden: false };
    const ctrl = makeController({ searchOverlay: overlay, searchClose: close });
    ctrl.closeSearch();
    expect(overlay.hidden).toBe(true);
    expect(close.hidden).toBe(true);
  });
});

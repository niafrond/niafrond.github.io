import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { createMetaFetchService } from '../../lib/metaFetchService.js';

function makeDeps(overrides = {}) {
  return {
    getStoredTrackMeta: jest.fn().mockReturnValue(null),
    patchStoredTrackMeta: jest.fn(),
    searchTracksViaApi: jest.fn().mockResolvedValue([]),
    filRougeManager: { patchPlaylistItem: jest.fn() },
    invalidateDeckMetaCache: jest.fn(),
    refreshDeckMetaDisplays: jest.fn(),
    renderQueueDebounced: jest.fn(),
    renderFilRougeDebounced: jest.fn(),
    ...overrides,
  };
}

describe('metaFetchService', () => {
  test('does nothing when item already has bpm and genre', async () => {
    const deps = makeDeps();
    const { fetchMissingMeta } = createMetaFetchService(deps);
    const item = { name: 'Song', artist: 'Artist', bpm: 128, genre: 'House' };
    await fetchMissingMeta(item);
    expect(deps.getStoredTrackMeta).not.toHaveBeenCalled();
    expect(deps.searchTracksViaApi).not.toHaveBeenCalled();
  });

  test('does nothing when item has no name', async () => {
    const deps = makeDeps();
    const { fetchMissingMeta } = createMetaFetchService(deps);
    await fetchMissingMeta({ artist: 'Artist' });
    expect(deps.searchTracksViaApi).not.toHaveBeenCalled();
  });

  // SPEC-3.4.7
  test('SPEC-3.4.7 — fills bpm/genre from local cache and triggers debounced re-renders', async () => {
    const deps = makeDeps({
      getStoredTrackMeta: jest.fn().mockReturnValue({ bpm: 128, genre: 'Techno' }),
    });
    const { fetchMissingMeta } = createMetaFetchService(deps);
    const item = { id: 'a', name: 'Song', artist: 'Artist' };
    await fetchMissingMeta(item);
    expect(item.bpm).toBe(128);
    expect(item.genre).toBe('Techno');
    expect(deps.renderQueueDebounced).toHaveBeenCalledTimes(1);
    expect(deps.renderFilRougeDebounced).toHaveBeenCalledTimes(1);
    expect(deps.filRougeManager.patchPlaylistItem).toHaveBeenCalledWith('a', { bpm: 128, genre: 'Techno' });
    // Already complete after the cache hit, no need to call the API.
    expect(deps.searchTracksViaApi).not.toHaveBeenCalled();
  });

  test('falls back to the API when the local cache is empty', async () => {
    const deps = makeDeps({
      searchTracksViaApi: jest.fn().mockResolvedValue([{ bpm: 140, genre: 'Hardstyle' }]),
    });
    const { fetchMissingMeta } = createMetaFetchService(deps);
    const item = { id: 'a', name: 'Song', artist: 'Artist' };
    await fetchMissingMeta(item);
    expect(item.bpm).toBe(140);
    expect(item.genre).toBe('Hardstyle');
    expect(deps.patchStoredTrackMeta).toHaveBeenCalledWith('Song', 'Artist', { bpm: 140, genre: 'Hardstyle' });
    expect(deps.renderQueueDebounced).toHaveBeenCalledTimes(1);
    expect(deps.renderFilRougeDebounced).toHaveBeenCalledTimes(1);
  });

  // SPEC-3.4.8
  test('SPEC-3.4.8 — does not re-render when the API has no data for the track', async () => {
    const deps = makeDeps({ searchTracksViaApi: jest.fn().mockResolvedValue([]) });
    const { fetchMissingMeta } = createMetaFetchService(deps);
    const item = { id: 'a', name: 'Song', artist: 'Artist' };
    await fetchMissingMeta(item);
    expect(deps.renderQueueDebounced).not.toHaveBeenCalled();
    expect(deps.renderFilRougeDebounced).not.toHaveBeenCalled();
    expect(deps.patchStoredTrackMeta).not.toHaveBeenCalled();
  });

  test('SPEC-3.4.8 — marks the track as attempted before the API call so a concurrent call does not re-fetch', async () => {
    let resolveSearch;
    const searchTracksViaApi = jest.fn(() => new Promise((resolve) => { resolveSearch = resolve; }));
    const deps = makeDeps({ searchTracksViaApi });
    const { fetchMissingMeta } = createMetaFetchService(deps);
    const item = { id: 'a', name: 'Song', artist: 'Artist' };

    const first = fetchMissingMeta(item);
    const second = fetchMissingMeta(item); // still in flight -> should not call the API again
    resolveSearch([]);
    await Promise.all([first, second]);

    expect(searchTracksViaApi).toHaveBeenCalledTimes(1);
  });

  test('SPEC-3.4.8 — does not call the API again for a track already attempted this session, even after a later re-render cycle', async () => {
    const deps = makeDeps({ searchTracksViaApi: jest.fn().mockResolvedValue([]) });
    const { fetchMissingMeta } = createMetaFetchService(deps);
    const item = { id: 'a', name: 'Song', artist: 'Artist' };

    await fetchMissingMeta(item); // first attempt, no data found, marked as attempted
    await fetchMissingMeta(item); // simulates a later renderFilRouge() cycle re-invoking it

    expect(deps.searchTracksViaApi).toHaveBeenCalledTimes(1);
  });

  test('does not re-render when bpm/genre did not actually change', async () => {
    const deps = makeDeps({
      getStoredTrackMeta: jest.fn().mockReturnValue({ bpm: 128 }),
      searchTracksViaApi: jest.fn().mockResolvedValue([{ genre: undefined }]),
    });
    const { fetchMissingMeta } = createMetaFetchService(deps);
    const item = { id: 'a', name: 'Song', artist: 'Artist', bpm: 128 };
    await fetchMissingMeta(item);
    // bpm was already set, local cache has no genre, API hit has no genre either.
    expect(deps.renderQueueDebounced).not.toHaveBeenCalled();
    expect(deps.renderFilRougeDebounced).not.toHaveBeenCalled();
  });
});

import { describe, expect, test, jest } from '@jest/globals';
import { refreshQueueTrack } from '../../lib/trackRefresh.js';

describe('refreshQueueTrack', () => {
  test('redownloads the track, then evicts local sources and re-resolves fresh once confirmed', async () => {
    const item = {
      name: 'Track',
      artist: 'Artist',
      cachePath: '/cache/old.mp3',
      persistedSourceUrl: 'blob:old',
    };
    const redownloadTrack = jest.fn().mockResolvedValue(true);
    const evictTrackSource = jest.fn();
    const ensureLocalSource = jest.fn().mockResolvedValue('blob:refreshed');

    const result = await refreshQueueTrack(item, {
      redownloadTrack,
      evictTrackSource,
      ensureLocalSource,
    });

    expect(result).toBe(true);
    expect(redownloadTrack).toHaveBeenCalledWith(item);
    expect(evictTrackSource).toHaveBeenCalledWith(item, { notify: true });
    expect(item.persistedSourceUrl).toBe('');
    expect(ensureLocalSource).toHaveBeenCalledWith(item, { forceFreshResolve: true });
  });

  test('does not touch local caches when the redownload fails or times out', async () => {
    const item = {
      name: 'Track',
      artist: 'Artist',
      cachePath: '/cache/old.mp3',
      persistedSourceUrl: 'blob:old',
    };
    const redownloadTrack = jest.fn().mockResolvedValue(false);
    const evictTrackSource = jest.fn();
    const ensureLocalSource = jest.fn();

    const result = await refreshQueueTrack(item, {
      redownloadTrack,
      evictTrackSource,
      ensureLocalSource,
    });

    expect(result).toBe(false);
    expect(evictTrackSource).not.toHaveBeenCalled();
    expect(ensureLocalSource).not.toHaveBeenCalled();
    expect(item.persistedSourceUrl).toBe('blob:old');
  });

  test('returns null without calling any dependency when the item has no name', async () => {
    const redownloadTrack = jest.fn();
    const result = await refreshQueueTrack({}, { redownloadTrack });
    expect(result).toBeNull();
    expect(redownloadTrack).not.toHaveBeenCalled();
  });
});

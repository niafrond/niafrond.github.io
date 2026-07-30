import { describe, expect, test, jest } from '@jest/globals';
import { refreshQueueTrack } from '../../lib/trackRefresh.js';

describe('refreshQueueTrack', () => {
  test('refreshes mix data, evicts local source, and re-downloads the track', async () => {
    const item = { name: 'Track', artist: 'Artist' };
    const refreshMixData = jest.fn().mockResolvedValue({ durationSec: 180 });
    const evictTrackSource = jest.fn();
    const deleteLocalCacheSong = jest.fn().mockResolvedValue(undefined);
    const ensureLocalSource = jest.fn().mockResolvedValue('blob:refreshed');

    const result = await refreshQueueTrack(item, {
      refreshMixData,
      evictTrackSource,
      deleteLocalCacheSong,
      ensureLocalSource,
    });

    expect(result).toBe(true);
    expect(refreshMixData).toHaveBeenCalledWith('Track', 'Artist');
    expect(evictTrackSource).toHaveBeenCalledWith(item, { notify: true });
    expect(deleteLocalCacheSong).toHaveBeenCalledWith(item);
    expect(ensureLocalSource).toHaveBeenCalledWith(item);
  });
});

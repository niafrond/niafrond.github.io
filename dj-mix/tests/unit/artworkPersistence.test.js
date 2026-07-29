import { describe, test, expect, jest } from '@jest/globals';
import { resolveArtworkForItem } from '../../lib/artworkPersistence.js';

describe('resolveArtworkForItem', () => {
  test('returns the local blob URL when one is already persisted, without backfilling', async () => {
    const restoreArtwork = jest.fn().mockResolvedValue('blob:local-art');
    const persistArtwork = jest.fn();
    const item = { id: 't1', artUrl: 'https://cdn.example/art.jpg' };

    const result = await resolveArtworkForItem(item, { restoreArtwork, persistArtwork });

    expect(result).toEqual({ localBlobUrl: 'blob:local-art', remoteArtUrl: 'https://cdn.example/art.jpg' });
    expect(persistArtwork).not.toHaveBeenCalled();
  });

  test('backfills persistArtwork when a remote artUrl is known but no local blob exists yet — the reported bug case', async () => {
    const restoreArtwork = jest.fn().mockResolvedValue(null);
    const persistArtwork = jest.fn().mockResolvedValue(undefined);
    const item = { id: 't2', artUrl: 'https://cdn.example/art.jpg' };

    const result = await resolveArtworkForItem(item, { restoreArtwork, persistArtwork });

    expect(result).toEqual({ localBlobUrl: '', remoteArtUrl: 'https://cdn.example/art.jpg' });
    expect(persistArtwork).toHaveBeenCalledWith(item, 'https://cdn.example/art.jpg');
  });

  test('does nothing when neither a local blob nor a remote artUrl exist', async () => {
    const restoreArtwork = jest.fn().mockResolvedValue(null);
    const persistArtwork = jest.fn();
    const item = { id: 't3', artUrl: '' };

    const result = await resolveArtworkForItem(item, { restoreArtwork, persistArtwork });

    expect(result).toEqual({ localBlobUrl: '', remoteArtUrl: '' });
    expect(persistArtwork).not.toHaveBeenCalled();
  });

  test('treats an existing blob: artUrl as already resolved — skips the redundant store read and never counts it as remote', async () => {
    const restoreArtwork = jest.fn().mockResolvedValue(null);
    const persistArtwork = jest.fn();
    const item = { id: 't4', artUrl: 'blob:already-local' };

    const result = await resolveArtworkForItem(item, { restoreArtwork, persistArtwork });

    expect(result).toEqual({ localBlobUrl: 'blob:already-local', remoteArtUrl: '' });
    expect(restoreArtwork).not.toHaveBeenCalled();
    expect(persistArtwork).not.toHaveBeenCalled();
  });

  test('a restoreArtwork rejection is treated as a miss, not thrown', async () => {
    const restoreArtwork = jest.fn().mockRejectedValue(new Error('boom'));
    const persistArtwork = jest.fn().mockResolvedValue(undefined);
    const item = { id: 't5', artUrl: 'https://cdn.example/art.jpg' };

    await expect(resolveArtworkForItem(item, { restoreArtwork, persistArtwork })).resolves.toEqual({
      localBlobUrl: '',
      remoteArtUrl: 'https://cdn.example/art.jpg',
    });
  });

  test('returns empty result for a null item without calling restoreArtwork', async () => {
    const restoreArtwork = jest.fn();
    const result = await resolveArtworkForItem(null, { restoreArtwork });
    expect(result).toEqual({ localBlobUrl: '', remoteArtUrl: '' });
    expect(restoreArtwork).not.toHaveBeenCalled();
  });
});

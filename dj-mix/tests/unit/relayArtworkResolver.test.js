import { beforeEach, describe, expect, test, jest } from '@jest/globals';
import { IDBFactory } from 'fake-indexeddb';
import { createBlobStore } from '../../lib/blobStore.js';
import { resolveRelayArtworkUrl } from '../../lib/relayArtworkResolver.js';

describe('relayArtworkResolver', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    // jsdom fournit ni indexedDB ni structuredClone — cf. blobStore.test.js.
    global.indexedDB = new IDBFactory();
    if (typeof structuredClone === 'undefined') {
      global.structuredClone = (val) => {
        if (val instanceof Blob) return new Blob([val], { type: val.type });
        return JSON.parse(JSON.stringify(val));
      };
    }
    // jsdom ne fournit pas non plus URL.createObjectURL.
    URL.createObjectURL = jest.fn(() => `blob:${Math.random()}`);
  });

  test('reuses a locally cached artwork blob before falling back to a remote URL', async () => {
    const store = createBlobStore({ dbName: 'relay-art-cache-1' });
    const cachedBlob = new Blob(['img'], { type: 'image/jpeg' });
    await store.putBlob('artwork', 'track-1', cachedBlob);

    const url = await resolveRelayArtworkUrl({ id: 'track-1' }, 'https://cdn.example/cover.jpg', { blobStore: store });

    expect(url).toMatch(/^blob:/);
  });

  test('fetches and persists artwork bytes when no local cache exists yet', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['img'], { type: 'image/jpeg' }),
    });
    global.fetch = fetchMock;

    const store = createBlobStore({ dbName: 'relay-art-cache-2' });
    const url = await resolveRelayArtworkUrl({ id: 'track-2' }, '/api/artwork?cachePath=%2Fart.jpg', {
      blobStore: store,
      cdnBaseUrl: 'https://cdn.example',
      token: 'secret',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example/api/artwork?cachePath=%2Fart.jpg&token=secret');
    expect(await store.getBlob('artwork', 'track-2')).not.toBeNull();
    expect(url).toMatch(/^blob:/);
  });
});

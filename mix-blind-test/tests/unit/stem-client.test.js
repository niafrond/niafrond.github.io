import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { StemClient } from '../../stem-client.js';

function makeLocalStorageMock() {
  const data = {};
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
  };
}

const makeBlob = (content = 'audio', type = 'audio/mpeg') => new Blob([content], { type });

let mockNow = 1_000_000;

beforeEach(() => {
  global.indexedDB = new IDBFactory();
  global.IDBKeyRange = IDBKeyRange;
  global.localStorage = makeLocalStorageMock();
  global.URL = {
    createObjectURL: () => `blob:test-${Math.random()}`,
    revokeObjectURL: () => {},
  };
  delete global.caches;
  mockNow = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('StemClient — IndexedDB blob store', () => {
  test('writeBlobToIdb / readBlobFromIdb round-trip', async () => {
    const client = new StemClient();
    const blob = makeBlob('audio-data');
    await client.writeBlobToIdb('track::vocals', blob);
    const retrieved = await client.readBlobFromIdb('track::vocals');
    expect(retrieved).not.toBeNull();
    expect(retrieved.size).toBe(blob.size);
    expect(retrieved.type).toBe('audio/mpeg');
  });

  test('readBlobFromIdb returns null for unknown key', async () => {
    const client = new StemClient();
    expect(await client.readBlobFromIdb('nonexistent::vocals')).toBeNull();
  });

  test('deleteBlobFromIdb removes the stored blob', async () => {
    const client = new StemClient();
    const blob = makeBlob('audio-data');
    await client.writeBlobToIdb('track::vocals', blob);
    await client.deleteBlobFromIdb('track::vocals');
    expect(await client.readBlobFromIdb('track::vocals')).toBeNull();
  });

  test('saveStemBlob stores blob in IndexedDB and returns object URL', async () => {
    const client = new StemClient();
    const track = { name: 'Song', artist: 'Artist', cachePath: 'path/song.mp3' };
    const blob = makeBlob('audio');
    const url = await client.saveStemBlob(track, 'vocals', blob);
    expect(url).toMatch(/^blob:/);
    const stored = await client.readBlobFromIdb(client.stemKey(track, 'vocals'));
    expect(stored).not.toBeNull();
    expect(stored.size).toBe(blob.size);
  });

  test('getCachedStemObjectUrl retrieves from IndexedDB after memory cache eviction', async () => {
    const client = new StemClient();
    const track = { name: 'Song', artist: 'Artist', cachePath: 'path/song.mp3' };
    const blob = makeBlob('audio');
    await client.saveStemBlob(track, 'vocals', blob);

    client.objectUrls.clear();
    client.objectUrlOrder = [];

    const url = await client.getCachedStemObjectUrl(track, 'vocals');
    expect(url).toMatch(/^blob:/);
  });

  test('getCachedStemObjectUrl returns empty string when blob absent from all stores', async () => {
    const client = new StemClient();
    const track = { name: 'Song', artist: 'Artist', cachePath: 'path/song.mp3' };
    expect(await client.getCachedStemObjectUrl(track, 'vocals')).toBe('');
  });

  test('pruneCache evicts oldest blob from IndexedDB when maxEntries exceeded', async () => {
    const client = new StemClient({ maxBytes: 1_000_000, maxEntries: 1 });
    const track1 = { cachePath: 'path/song1.mp3' };
    const track2 = { cachePath: 'path/song2.mp3' };

    await client.saveStemBlob(track1, 'vocals', makeBlob('audio1'));
    mockNow += 1000;
    await client.saveStemBlob(track2, 'vocals', makeBlob('audio2'));

    const key1 = client.stemKey(track1, 'vocals');
    const key2 = client.stemKey(track2, 'vocals');

    expect(await client.readBlobFromIdb(key1)).toBeNull();
    expect(await client.readBlobFromIdb(key2)).not.toBeNull();
  });
});

describe('StemClient — config injectée (dj-mix downloaderConfig/apiHealthMonitor)', () => {
  test('sans injection, retombe sur le comportement autonome (localStorage) pour rester instanciable seul', () => {
    const client = new StemClient();
    expect(client.getApiUrl()).toBe('http://vision:3000');
  });

  test('getApiUrl() délègue au getter injecté', () => {
    const client = new StemClient({ getDownloaderApiUrl: () => 'http://192.168.1.50:3000' });
    expect(client.getApiUrl()).toBe('http://192.168.1.50:3000');
  });

  test('fetchStemsStatus ajoute le token à la requête', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ready' }) });
    const client = new StemClient({
      getDownloaderApiUrl: () => 'http://vision:3000',
      getDownloaderApiToken: () => 'secret-token',
    });
    await client.fetchStemsStatus({ name: 'Song', artist: 'Artist' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('token=secret-token'),
      expect.any(Object)
    );
  });

  test('fetchStemsStatus notifie apiHealthMonitor.recordSuccess sur succès', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ready' }) });
    const apiHealthMonitor = { recordSuccess: jest.fn(), recordFailure: jest.fn() };
    const client = new StemClient({ getDownloaderApiUrl: () => 'http://vision:3000', apiHealthMonitor });
    await client.fetchStemsStatus({ name: 'Song', artist: 'Artist' });
    expect(apiHealthMonitor.recordSuccess).toHaveBeenCalled();
    expect(apiHealthMonitor.recordFailure).not.toHaveBeenCalled();
  });

  test('fetchServerCacheTracks notifie apiHealthMonitor.recordFailure sur échec réseau', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const apiHealthMonitor = { recordSuccess: jest.fn(), recordFailure: jest.fn() };
    const client = new StemClient({ getDownloaderApiUrl: () => 'http://vision:3000', apiHealthMonitor });
    const tracks = await client.fetchServerCacheTracks({ forceRefresh: true });
    expect(tracks).toEqual([]);
    expect(apiHealthMonitor.recordFailure).toHaveBeenCalled();
  });

  test('triggerStemGeneration traite HTTP 409 comme un succès (génération déjà en cours)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 409 });
    const client = new StemClient({ getDownloaderApiUrl: () => 'http://vision:3000' });
    const launched = await client.triggerStemGeneration({ name: 'Song', artist: 'Artist' });
    expect(launched).toBe(true);
  });
});

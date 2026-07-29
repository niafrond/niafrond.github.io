import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { IDBFactory } from 'fake-indexeddb';
import { createBlobStore } from '../../lib/blobStore.js';

describe('blobStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
    // jest-environment-jsdom doesn't provide structuredClone, which
    // fake-indexeddb needs internally for put() — real browsers all have it
    // natively (and Blob is a spec-recognized structured-clone type there);
    // this polyfill is test-environment-only. The plain JSON-based fallback
    // used elsewhere in this repo's tests can't clone a Blob (it would lose
    // all binary data), so this one special-cases it via the Blob
    // constructor's "other Blob as a part" support, which is a real,
    // synchronous copy — not just a reference.
    if (typeof structuredClone === 'undefined') {
      global.structuredClone = (val) => {
        if (val instanceof Blob) return new Blob([val], { type: val.type });
        return JSON.parse(JSON.stringify(val));
      };
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('putBlob/getBlob round-trip for the audio kind', async () => {
    const store = createBlobStore({ dbName: 'test-1' });
    const blob = new Blob(['audio-bytes'], { type: 'audio/mpeg' });

    const ok = await store.putBlob('audio', 'artist::track', blob);
    expect(ok).toBe(true);

    const got = await store.getBlob('audio', 'artist::track');
    expect(got).toBeInstanceOf(Blob);
    expect(got.size).toBe(blob.size);
    expect(got.type).toBe('audio/mpeg');
  });

  test('putBlob/getBlob round-trip for the artwork kind, independent of the audio kind', async () => {
    const store = createBlobStore({ dbName: 'test-2' });
    const audioBlob = new Blob(['audio-bytes'], { type: 'audio/mpeg' });
    const artBlob = new Blob(['art-bytes'], { type: 'image/jpeg' });

    await store.putBlob('audio', 'k', audioBlob);
    await store.putBlob('artwork', 'k', artBlob);

    const gotAudio = await store.getBlob('audio', 'k');
    const gotArt = await store.getBlob('artwork', 'k');
    expect(gotAudio.type).toBe('audio/mpeg');
    expect(gotArt.type).toBe('image/jpeg');
  });

  test('getBlob returns null for an unknown key', async () => {
    const store = createBlobStore({ dbName: 'test-3' });
    expect(await store.getBlob('audio', 'nope')).toBeNull();
  });

  test('deleteBlob removes a stored entry', async () => {
    const store = createBlobStore({ dbName: 'test-4' });
    const blob = new Blob(['audio-bytes'], { type: 'audio/mpeg' });
    await store.putBlob('audio', 'k', blob);
    expect(await store.getBlob('audio', 'k')).not.toBeNull();

    const ok = await store.deleteBlob('audio', 'k');
    expect(ok).toBe(true);
    expect(await store.getBlob('audio', 'k')).toBeNull();
  });

  test('clearKind empties only the targeted store', async () => {
    const store = createBlobStore({ dbName: 'test-5' });
    await store.putBlob('audio', 'k', new Blob(['a'], { type: 'audio/mpeg' }));
    await store.putBlob('artwork', 'k', new Blob(['b'], { type: 'image/jpeg' }));

    await store.clearKind('audio');
    expect(await store.getBlob('audio', 'k')).toBeNull();
    expect(await store.getBlob('artwork', 'k')).not.toBeNull();
  });

  test('clearAll empties both stores', async () => {
    const store = createBlobStore({ dbName: 'test-6' });
    await store.putBlob('audio', 'k', new Blob(['a'], { type: 'audio/mpeg' }));
    await store.putBlob('artwork', 'k', new Blob(['b'], { type: 'image/jpeg' }));

    const ok = await store.clearAll();
    expect(ok).toBe(true);
    expect(await store.getBlob('audio', 'k')).toBeNull();
    expect(await store.getBlob('artwork', 'k')).toBeNull();
  });

  test('putBlob rejects a 0-byte blob without touching storage', async () => {
    const store = createBlobStore({ dbName: 'test-7' });
    const ok = await store.putBlob('audio', 'k', new Blob([], { type: 'audio/mpeg' }));
    expect(ok).toBe(false);
    expect(await store.getBlob('audio', 'k')).toBeNull();
  });

  test('every method resolves to a safe empty value (never throws) when indexedDB is unavailable', async () => {
    const store = createBlobStore({ dbName: 'test-8', indexedDBImpl: null });
    await expect(store.getBlob('audio', 'k')).resolves.toBeNull();
    await expect(store.putBlob('audio', 'k', new Blob(['a']))).resolves.toBe(false);
    await expect(store.deleteBlob('audio', 'k')).resolves.toBe(false);
    await expect(store.clearKind('audio')).resolves.toBe(false);
    await expect(store.clearAll()).resolves.toBe(false);
  });
});

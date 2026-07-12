import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createDownloadBatchStore } from '../../lib/downloadBatchStore.js';

function makeBatch(id, overrides = {}) {
  return {
    id,
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
    status: 'running',
    totalFiles: 2,
    completedFiles: 0,
    failedFiles: 0,
    transport: null,
    ...overrides,
  };
}

function makeItem(batchId, cacheKey, overrides = {}) {
  return {
    id: `${batchId}::${cacheKey}`,
    batchId,
    cacheKey,
    trackName: `Track ${cacheKey}`,
    artistName: 'Artist',
    filename: `Artist - Track ${cacheKey}`,
    size: null,
    status: 'pending',
    retries: 0,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('downloadBatchStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
    global.IDBKeyRange = IDBKeyRange;
    // jest-environment-jsdom doesn't provide structuredClone, which
    // fake-indexeddb needs internally for put() — real browsers all have it
    // natively, this polyfill is test-environment-only.
    if (typeof structuredClone === 'undefined') {
      global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createBatch/getBatch/listItems round-trip', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-1' });
    const batch = makeBatch('b1');
    const items = [makeItem('b1', 'a'), makeItem('b1', 'b')];

    await store.createBatch({ batch, items });

    const got = await store.getBatch('b1');
    expect(got).toMatchObject({ id: 'b1', status: 'running', totalFiles: 2 });

    const gotItems = await store.listItems('b1');
    expect(gotItems).toHaveLength(2);
    expect(gotItems.map((i) => i.cacheKey).sort()).toEqual(['a', 'b']);
  });

  test('getBatch/getItem return null for unknown ids', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-2' });
    expect(await store.getBatch('nope')).toBeNull();
    expect(await store.getItem('nope::nope')).toBeNull();
  });

  test('updateBatch merges a patch into the existing row', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-3' });
    await store.createBatch({ batch: makeBatch('b1'), items: [] });

    const merged = await store.updateBatch('b1', { status: 'completed', completedFiles: 2 });

    expect(merged).toMatchObject({ id: 'b1', status: 'completed', completedFiles: 2, totalFiles: 2 });
    expect(await store.getBatch('b1')).toMatchObject({ status: 'completed', completedFiles: 2 });
  });

  test('updateBatch on an unknown id resolves null without creating a row', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-4' });
    expect(await store.updateBatch('ghost', { status: 'completed' })).toBeNull();
    expect(await store.getBatch('ghost')).toBeNull();
  });

  test('updateItem accepts a plain object patch', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-5' });
    await store.createBatch({ batch: makeBatch('b1'), items: [makeItem('b1', 'a')] });

    const merged = await store.updateItem('b1::a', { status: 'completed', completedAt: 42 });

    expect(merged).toMatchObject({ status: 'completed', completedAt: 42, cacheKey: 'a' });
  });

  test('updateItem accepts an updater function for derived patches (retries)', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-6' });
    await store.createBatch({ batch: makeBatch('b1'), items: [makeItem('b1', 'a', { retries: 2 })] });

    const merged = await store.updateItem('b1::a', (existing) => ({
      status: 'failed',
      retries: existing.retries + 1,
    }));

    expect(merged).toMatchObject({ status: 'failed', retries: 3 });
  });

  test('updateItems bulk-updates matching ids and silently skips missing ones', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-7' });
    await store.createBatch({
      batch: makeBatch('b1'),
      items: [makeItem('b1', 'a'), makeItem('b1', 'b')],
    });

    const count = await store.updateItems(['b1::a', 'b1::b', 'b1::ghost'], { status: 'downloading' });

    expect(count).toBe(2);
    expect(await store.getItem('b1::a')).toMatchObject({ status: 'downloading' });
    expect(await store.getItem('b1::b')).toMatchObject({ status: 'downloading' });
  });

  test('listIncompleteBatches excludes only completed batches', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-8' });
    await store.createBatch({ batch: makeBatch('b-running', { status: 'running' }), items: [] });
    await store.createBatch({ batch: makeBatch('b-paused', { status: 'paused-auth' }), items: [] });
    await store.createBatch({ batch: makeBatch('b-failed', { status: 'failed' }), items: [] });
    await store.createBatch({ batch: makeBatch('b-done', { status: 'completed' }), items: [] });

    const incomplete = await store.listIncompleteBatches();

    expect(incomplete.map((b) => b.id).sort()).toEqual(['b-failed', 'b-paused', 'b-running']);
  });

  test('deleteBatch removes the batch row and cascades to its items', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-9' });
    await store.createBatch({
      batch: makeBatch('b1'),
      items: [makeItem('b1', 'a'), makeItem('b1', 'b')],
    });

    const ok = await store.deleteBatch('b1');

    expect(ok).toBe(true);
    expect(await store.getBatch('b1')).toBeNull();
    expect(await store.listItems('b1')).toEqual([]);
  });

  test('pruneOldBatches deletes only old batches whose status is eligible', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-10' });
    const now = 10_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    // Old + completed -> eligible for pruning.
    await store.createBatch({ batch: makeBatch('old-done', { status: 'completed', createdAt: now - 8 * 24 * 60 * 60 * 1000 }), items: [] });
    // Old + still running -> must NOT be pruned (needs to be resumable).
    await store.createBatch({ batch: makeBatch('old-running', { status: 'running', createdAt: now - 8 * 24 * 60 * 60 * 1000 }), items: [] });
    // Recent + completed -> too recent to prune.
    await store.createBatch({ batch: makeBatch('recent-done', { status: 'completed', createdAt: now - 1000 }), items: [] });

    const pruned = await store.pruneOldBatches({ olderThanMs: 7 * 24 * 60 * 60 * 1000 });

    expect(pruned).toBe(1);
    expect(await store.getBatch('old-done')).toBeNull();
    expect(await store.getBatch('old-running')).not.toBeNull();
    expect(await store.getBatch('recent-done')).not.toBeNull();
  });

  test('two batches containing the same cacheKey get independent item rows (composite id)', async () => {
    const store = createDownloadBatchStore({ dbName: 'test-11' });
    await store.createBatch({ batch: makeBatch('batch-1'), items: [makeItem('batch-1', 'shared-track', { status: 'pending' })] });
    await store.createBatch({ batch: makeBatch('batch-2'), items: [makeItem('batch-2', 'shared-track', { status: 'completed' })] });

    await store.updateItem('batch-1::shared-track', { status: 'failed' });

    expect(await store.getItem('batch-1::shared-track')).toMatchObject({ status: 'failed' });
    expect(await store.getItem('batch-2::shared-track')).toMatchObject({ status: 'completed' });
  });

  describe('without indexedDB available', () => {
    beforeEach(() => {
      delete global.indexedDB;
    });

    test('every method resolves to a safe value instead of throwing', async () => {
      const store = createDownloadBatchStore({ dbName: 'test-no-idb' });

      await expect(store.createBatch({ batch: makeBatch('b1'), items: [] })).resolves.toBeNull();
      await expect(store.getBatch('b1')).resolves.toBeNull();
      await expect(store.getItem('b1::a')).resolves.toBeNull();
      await expect(store.updateBatch('b1', { status: 'completed' })).resolves.toBeNull();
      await expect(store.updateItem('b1::a', { status: 'completed' })).resolves.toBeNull();
      await expect(store.updateItems(['b1::a'], { status: 'completed' })).resolves.toBe(0);
      await expect(store.listItems('b1')).resolves.toEqual([]);
      await expect(store.listIncompleteBatches()).resolves.toEqual([]);
      await expect(store.deleteBatch('b1')).resolves.toBe(false);
      await expect(store.pruneOldBatches()).resolves.toBe(0);
    });
  });
});

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createDownloadBatchManager } from '../../lib/downloadBatchManager.js';

// jest-environment-jsdom doesn't expose Request/Notification globals — real
// browsers all have them. Only what showSwNotif/_dispatchBackgroundFetch
// touch needs to exist here.
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(url, init) {
      this.url = String(url);
      Object.assign(this, init);
    }
  };
}
if (typeof Notification === 'undefined') {
  global.Notification = { permission: 'denied' };
}

function makeFakeStore() {
  const batches = new Map();
  const items = new Map();

  return {
    batches,
    items,
    createBatch: jest.fn(async ({ batch, items: rows }) => {
      batches.set(batch.id, { ...batch });
      for (const row of rows) items.set(row.id, { ...row });
      return { batch, items: rows };
    }),
    updateBatch: jest.fn(async (batchId, patch) => {
      const existing = batches.get(batchId);
      if (!existing) return null;
      const merged = { ...existing, ...(typeof patch === 'function' ? patch(existing) : patch) };
      batches.set(batchId, merged);
      return merged;
    }),
    updateItem: jest.fn(async (itemId, patch) => {
      const existing = items.get(itemId);
      if (!existing) return null;
      const merged = { ...existing, ...(typeof patch === 'function' ? patch(existing) : patch) };
      items.set(itemId, merged);
      return merged;
    }),
    updateItems: jest.fn(async (itemIds, patch) => {
      let count = 0;
      for (const id of itemIds) {
        const existing = items.get(id);
        if (!existing) continue;
        items.set(id, { ...existing, ...(typeof patch === 'function' ? patch(existing) : patch) });
        count++;
      }
      return count;
    }),
    getBatch: jest.fn(async (batchId) => batches.get(batchId) || null),
    getItem: jest.fn(async (itemId) => items.get(itemId) || null),
    listItems: jest.fn(async (batchId) => [...items.values()].filter((i) => i.batchId === batchId)),
    listIncompleteBatches: jest.fn(async () => [...batches.values()].filter((b) => b.status !== 'completed')),
    deleteBatch: jest.fn(async () => true),
    pruneOldBatches: jest.fn(async () => 0),
  };
}

function makeTrack(overrides = {}) {
  return { id: 'track-1', name: 'Song A', artist: 'Artist A', ...overrides };
}

function makeManager(overrides = {}) {
  const statuses = new Map();
  const store = overrides.store === undefined ? makeFakeStore() : overrides.store;

  const defaults = {
    store,
    prefetchTrackToLocalCache: jest.fn().mockResolvedValue(true),
    isTrackInLocalCache: jest.fn().mockResolvedValue(false),
    fetchMixData: jest.fn().mockResolvedValue({ probableSongStartSec: 1 }),
    setFilRougeTrackStatus: jest.fn((item, patch) => {
      const key = item.id || item.name;
      statuses.set(key, { ...(statuses.get(key) || {}), ...patch });
    }),
    renderFilRouge: jest.fn(),
    renderTrackStatus: jest.fn(),
    showToast: jest.fn(),
    onProgress: jest.fn(),
    getDownloaderApiUrl: jest.fn().mockReturnValue(undefined),
    getDownloaderApiToken: jest.fn().mockReturnValue(''),
    onAuthExpired: jest.fn(),
    waitFn: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  delete defaults.store;

  const manager = createDownloadBatchManager({ store, ...defaults });
  return { manager, mocks: { store, ...defaults }, statuses };
}

function mockServiceWorker(swReg) {
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(swReg) },
    configurable: true,
  });
}

function clearServiceWorkerMock() {
  delete global.navigator.serviceWorker;
}

describe('downloadBatchManager', () => {
  afterEach(() => {
    clearServiceWorkerMock();
    jest.restoreAllMocks();
  });

  describe('startBatch — internal queue (no Background Fetch configured)', () => {
    test('happy path: downloads, persists to IndexedDB, marks batch completed', async () => {
      const { manager, mocks } = makeManager();
      const track = makeTrack();

      const result = await manager.startBatch([track]);

      expect(result).toMatchObject({ done: 1, failed: 0, total: 1, backgrounded: false, authPaused: false });
      expect(mocks.prefetchTrackToLocalCache).toHaveBeenCalledWith(track, expect.objectContaining({ onError: expect.any(Function) }));
      expect(mocks.store.createBatch).toHaveBeenCalledTimes(1);
      const [{ batch, items }] = mocks.store.createBatch.mock.calls[0];
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ batchId: batch.id, cacheKey: track.id, status: 'pending' });
      const finalBatch = await mocks.store.getBatch(batch.id);
      expect(finalBatch).toMatchObject({ status: 'completed', completedFiles: 1, failedFiles: 0 });
      const finalItem = await mocks.store.getItem(`${batch.id}::${track.id}`);
      expect(finalItem).toMatchObject({ status: 'completed' });
    });

    test('cache-hit tracks bypass IndexedDB entirely and do not count toward total', async () => {
      const { manager, mocks, statuses } = makeManager({
        isTrackInLocalCache: jest.fn().mockResolvedValue(true),
      });
      const track = makeTrack();

      const result = await manager.startBatch([track]);

      expect(result).toMatchObject({ done: 0, failed: 0, total: 0 });
      expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
      expect(mocks.store.createBatch).not.toHaveBeenCalled();
      expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: true });
      expect(mocks.renderFilRouge).toHaveBeenCalled();
    });

    test('all-cached: shows a toast and creates no batch', async () => {
      const { manager, mocks } = makeManager({
        isTrackInLocalCache: jest.fn().mockResolvedValue(true),
      });

      await manager.startBatch([makeTrack()]);

      expect(mocks.showToast).toHaveBeenCalledWith('Tous les morceaux sont déjà en cache (1 retrouvé)');
      expect(mocks.store.createBatch).not.toHaveBeenCalled();
    });

    test('mixed success/failure updates counts and per-item status (failure retried 3x, SPEC-19.6.2)', async () => {
      const ok = makeTrack({ id: 'ok', name: 'OK', artist: 'A' });
      const bad = makeTrack({ id: 'bad', name: 'Bad', artist: 'B' });
      const { manager, mocks } = makeManager({
        prefetchTrackToLocalCache: jest.fn((track) => Promise.resolve(track.id === 'ok')),
      });

      const result = await manager.startBatch([ok, bad]);

      expect(result).toMatchObject({ done: 1, failed: 1, total: 2 });
      const [{ batch }] = mocks.store.createBatch.mock.calls[0];
      expect(await mocks.store.getItem(`${batch.id}::ok`)).toMatchObject({ status: 'completed' });
      // Tentative initiale + 3 retentatives = retries: 4
      expect(await mocks.store.getItem(`${batch.id}::bad`)).toMatchObject({ status: 'failed', retries: 4 });
      expect(mocks.waitFn.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000, 8000]);
    });
  });

  describe('retentatives avec backoff (SPEC-19.6.2)', () => {
    test('un échec transitoire est récupéré à la première retentative', async () => {
      const track = makeTrack();
      const prefetch = jest.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      const { manager, mocks } = makeManager({ prefetchTrackToLocalCache: prefetch });

      const result = await manager.startBatch([track]);

      expect(result).toMatchObject({ done: 1, failed: 0, total: 1 });
      expect(prefetch).toHaveBeenCalledTimes(2);
      expect(mocks.waitFn.mock.calls.map(([ms]) => ms)).toEqual([2000]);
      const [{ batch }] = mocks.store.createBatch.mock.calls[0];
      expect(await mocks.store.getItem(`${batch.id}::${track.id}`)).toMatchObject({ status: 'completed', retries: 1 });
      expect(await mocks.store.getBatch(batch.id)).toMatchObject({ status: 'completed', completedFiles: 1, failedFiles: 0 });
    });

    test("abandonne après 3 retentatives avec backoff exponentiel 2s/4s/8s", async () => {
      const track = makeTrack();
      const prefetch = jest.fn().mockResolvedValue(false);
      const { manager, mocks } = makeManager({ prefetchTrackToLocalCache: prefetch });

      const result = await manager.startBatch([track]);

      expect(result).toMatchObject({ done: 0, failed: 1, total: 1 });
      expect(prefetch).toHaveBeenCalledTimes(4); // initiale + 3 retentatives
      expect(mocks.waitFn.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000, 8000]);
      const [{ batch }] = mocks.store.createBatch.mock.calls[0];
      expect(await mocks.store.getItem(`${batch.id}::${track.id}`)).toMatchObject({ status: 'failed', retries: 4 });
    });

    test('une expiration auth pendant une retentative arrête les vagues suivantes (SPEC-19.6.5)', async () => {
      const track = makeTrack();
      let calls = 0;
      const prefetch = jest.fn((t, opts) => {
        calls++;
        if (calls > 1) opts?.onError?.({ status: 401 }); // la retentative tombe sur un 401
        return Promise.resolve(false);
      });
      const { manager, mocks } = makeManager({ prefetchTrackToLocalCache: prefetch });

      const result = await manager.startBatch([track]);

      expect(result.authPaused).toBe(true);
      expect(prefetch).toHaveBeenCalledTimes(2); // pas de 2e/3e vague
      expect(mocks.waitFn.mock.calls.map(([ms]) => ms)).toEqual([2000]);
      expect(mocks.onAuthExpired).toHaveBeenCalledTimes(1);
      const [{ batch }] = mocks.store.createBatch.mock.calls[0];
      expect(await mocks.store.getBatch(batch.id)).toMatchObject({ status: 'paused-auth' });
    });
  });

  describe('startBatch — auth expiry (SPEC-19.4)', () => {
    test('a 401/403 mid-loop pauses the batch and leaves remaining items pending, not failed', async () => {
      const a = makeTrack({ id: 'track-a', name: 'A', artist: 'X' });
      const b = makeTrack({ id: 'track-b', name: 'B', artist: 'X' }); // will 401
      const c = makeTrack({ id: 'track-c', name: 'C', artist: 'X' });
      const d = makeTrack({ id: 'track-d', name: 'D', artist: 'X' }); // never attempted
      const e = makeTrack({ id: 'track-e', name: 'E', artist: 'X' }); // never attempted

      const { manager, mocks, statuses } = makeManager({
        prefetchTrackToLocalCache: jest.fn((track, opts) => {
          if (track.id === 'track-b') {
            opts?.onError?.({ status: 401 });
            return Promise.resolve(false);
          }
          return Promise.resolve(true);
        }),
      });

      const result = await manager.startBatch([a, b, c, d, e]);

      expect(result.authPaused).toBe(true);
      expect(mocks.onAuthExpired).toHaveBeenCalledTimes(1);
      // Only the first slice (batch size 3: a, b, c) was ever attempted.
      expect(mocks.prefetchTrackToLocalCache).toHaveBeenCalledTimes(3);

      const [{ batch }] = mocks.store.createBatch.mock.calls[0];
      expect(await mocks.store.getBatch(batch.id)).toMatchObject({ status: 'paused-auth' });
      // The 401'd track and the never-attempted tracks are all "pending", not "failed".
      expect(await mocks.store.getItem(`${batch.id}::track-b`)).toMatchObject({ status: 'pending' });
      expect(await mocks.store.getItem(`${batch.id}::track-d`)).toMatchObject({ status: 'pending' });
      expect(await mocks.store.getItem(`${batch.id}::track-e`)).toMatchObject({ status: 'pending' });
      expect(statuses.get('track-b')).toMatchObject({ downloadState: 'idle' });
      expect(statuses.get('track-d')).toMatchObject({ downloadState: 'idle' });
      expect(statuses.get('track-a')).toMatchObject({ downloadState: 'done' });
    });
  });

  describe('startBatch — Background Fetch transport', () => {
    test('dispatches via Background Fetch when available and configured, skipping the internal queue', async () => {
      const bgFetchFn = jest.fn().mockResolvedValue(undefined);
      const swReg = { backgroundFetch: { get: jest.fn().mockResolvedValue(null), fetch: bgFetchFn } };
      mockServiceWorker(swReg);

      const { manager, mocks } = makeManager({
        getDownloaderApiUrl: jest.fn().mockReturnValue('http://api.test'),
        getDownloaderApiToken: jest.fn().mockReturnValue('tok'),
      });
      const track = makeTrack();

      const result = await manager.startBatch([track]);

      expect(result.backgrounded).toBe(true);
      expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
      expect(bgFetchFn).toHaveBeenCalledTimes(1);
      const [batchId, requests] = bgFetchFn.mock.calls[0];
      expect(typeof batchId).toBe('string');
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toContain(`_ck=${encodeURIComponent(track.id)}`);
      expect(requests[0].url).toContain('token=tok');
    });

    test('falls back to the internal queue when the Background Fetch dispatch itself throws', async () => {
      const swReg = {
        backgroundFetch: {
          get: jest.fn().mockResolvedValue(null),
          fetch: jest.fn().mockRejectedValue(new Error('quota exceeded')),
        },
      };
      mockServiceWorker(swReg);

      const { manager, mocks } = makeManager({
        getDownloaderApiUrl: jest.fn().mockReturnValue('http://api.test'),
      });
      const track = makeTrack();

      const result = await manager.startBatch([track]);

      expect(result.backgrounded).toBe(false);
      expect(result.done).toBe(1);
      expect(mocks.prefetchTrackToLocalCache).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordBackgroundFetchResult / recordBackgroundFetchFail', () => {
    test('recordBackgroundFetchResult marks matching items completed/failed and finalizes the batch', async () => {
      const { manager, mocks } = makeManager();
      const store = mocks.store;
      const batchId = 'batch-x';
      await store.createBatch({
        batch: { id: batchId, status: 'running', totalFiles: 2, completedFiles: 0, failedFiles: 0, transport: 'bg-fetch' },
        items: [
          { id: `${batchId}::ok`, batchId, cacheKey: 'ok', status: 'downloading' },
          { id: `${batchId}::bad`, batchId, cacheKey: 'bad', status: 'downloading' },
        ],
      });

      await manager.recordBackgroundFetchResult(batchId, ['ok'], ['bad']);

      expect(await store.getItem(`${batchId}::ok`)).toMatchObject({ status: 'completed' });
      expect(await store.getItem(`${batchId}::bad`)).toMatchObject({ status: 'failed' });
      expect(await store.getBatch(batchId)).toMatchObject({ status: 'completed', completedFiles: 1, failedFiles: 1 });
    });

    test('avec playlist : retente les échecs via la file interne et récupère les mix infos (SPEC-19.6.3/19.6.4)', async () => {
      const okTrack = makeTrack({ id: 'ok', name: 'Song OK', artist: 'Artist OK' });
      const badTrack = makeTrack({ id: 'bad', name: 'Song Bad', artist: 'Artist Bad' });
      const prefetch = jest.fn().mockResolvedValue(true); // la retentative réussit
      const { manager, mocks, statuses } = makeManager({ prefetchTrackToLocalCache: prefetch });
      const store = mocks.store;
      const batchId = 'batch-retry';
      await store.createBatch({
        batch: { id: batchId, status: 'running', totalFiles: 2, completedFiles: 0, failedFiles: 0, transport: 'bg-fetch' },
        items: [
          { id: `${batchId}::ok`, batchId, cacheKey: 'ok', status: 'downloading' },
          { id: `${batchId}::bad`, batchId, cacheKey: 'bad', status: 'downloading' },
        ],
      });

      await manager.recordBackgroundFetchResult(batchId, ['ok'], ['bad'], [okTrack, badTrack]);

      // Seul le morceau échoué est retéléchargé, après un backoff de 2s.
      expect(prefetch).toHaveBeenCalledTimes(1);
      expect(prefetch).toHaveBeenCalledWith(badTrack, expect.any(Object));
      expect(mocks.waitFn.mock.calls.map(([ms]) => ms)).toEqual([2000]);
      // Mix info du morceau réussi via Background Fetch, en parallèle du retry.
      expect(mocks.fetchMixData).toHaveBeenCalledWith('Song OK', 'Artist OK');
      expect(statuses.get('ok')).toMatchObject({ hasMixInfo: true });
      expect(await store.getItem(`${batchId}::ok`)).toMatchObject({ status: 'completed' });
      expect(await store.getItem(`${batchId}::bad`)).toMatchObject({ status: 'completed' });
      expect(await store.getBatch(batchId)).toMatchObject({ status: 'completed', completedFiles: 2, failedFiles: 0 });
    });

    test('avec playlist : après 3 retentatives infructueuses, le lot est finalisé avec les échecs restants', async () => {
      const badTrack = makeTrack({ id: 'bad', name: 'Song Bad', artist: 'Artist Bad' });
      const prefetch = jest.fn().mockResolvedValue(false);
      const { manager, mocks } = makeManager({ prefetchTrackToLocalCache: prefetch });
      const store = mocks.store;
      const batchId = 'batch-retry-fail';
      await store.createBatch({
        batch: { id: batchId, status: 'running', totalFiles: 1, completedFiles: 0, failedFiles: 0, transport: 'bg-fetch' },
        items: [{ id: `${batchId}::bad`, batchId, cacheKey: 'bad', status: 'downloading' }],
      });

      await manager.recordBackgroundFetchResult(batchId, [], ['bad'], [badTrack]);

      expect(prefetch).toHaveBeenCalledTimes(3); // 3 retentatives (la tentative initiale était le bg-fetch)
      expect(mocks.waitFn.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000, 8000]);
      expect(await store.getItem(`${batchId}::bad`)).toMatchObject({ status: 'failed' });
      expect(await store.getBatch(batchId)).toMatchObject({ status: 'failed', completedFiles: 0, failedFiles: 1 });
    });

    test('recordBackgroundFetchFail marks every still-downloading item failed and the batch failed', async () => {
      const { manager, mocks } = makeManager();
      const store = mocks.store;
      const batchId = 'batch-y';
      await store.createBatch({
        batch: { id: batchId, status: 'running', totalFiles: 2, completedFiles: 0, failedFiles: 0, transport: 'bg-fetch' },
        items: [
          { id: `${batchId}::a`, batchId, cacheKey: 'a', status: 'downloading' },
          { id: `${batchId}::b`, batchId, cacheKey: 'b', status: 'downloading' },
        ],
      });

      await manager.recordBackgroundFetchFail(batchId);

      expect(await store.getItem(`${batchId}::a`)).toMatchObject({ status: 'failed' });
      expect(await store.getItem(`${batchId}::b`)).toMatchObject({ status: 'failed' });
      expect(await store.getBatch(batchId)).toMatchObject({ status: 'failed' });
    });
  });

  describe('resumeIncompleteBatches (SPEC-19.2)', () => {
    test('self-heals a batch whose items are all already completed', async () => {
      const { manager, mocks } = makeManager();
      const store = mocks.store;
      await store.createBatch({
        batch: { id: 'b1', status: 'running', totalFiles: 1, completedFiles: 1, failedFiles: 0, transport: 'internal-queue' },
        items: [{ id: 'b1::t1', batchId: 'b1', cacheKey: 't1', status: 'completed' }],
      });

      await manager.resumeIncompleteBatches([]);

      expect(await store.getBatch('b1')).toMatchObject({ status: 'completed' });
      expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
    });

    test('drives remaining pending/failed items of an internal-queue batch through the queue again', async () => {
      const track = makeTrack({ id: 'resume-me' });
      const { manager, mocks } = makeManager();
      const store = mocks.store;
      await store.createBatch({
        batch: { id: 'b1', status: 'paused-auth', totalFiles: 1, completedFiles: 0, failedFiles: 0, transport: 'internal-queue' },
        items: [{ id: 'b1::resume-me', batchId: 'b1', cacheKey: 'resume-me', status: 'pending' }],
      });

      await manager.resumeIncompleteBatches([track]);

      expect(mocks.prefetchTrackToLocalCache).toHaveBeenCalledWith(track, expect.any(Object));
      expect(await store.getItem('b1::resume-me')).toMatchObject({ status: 'completed' });
      expect(await store.getBatch('b1')).toMatchObject({ status: 'completed' });
    });

    test('leaves a bg-fetch batch alone if the browser still has an active registration', async () => {
      const swReg = { backgroundFetch: { get: jest.fn().mockResolvedValue({ id: 'b1' }) } };
      mockServiceWorker(swReg);
      const track = makeTrack({ id: 'still-active' });
      const { manager, mocks } = makeManager();
      const store = mocks.store;
      await store.createBatch({
        batch: { id: 'b1', status: 'running', totalFiles: 1, completedFiles: 0, failedFiles: 0, transport: 'bg-fetch' },
        items: [{ id: 'b1::still-active', batchId: 'b1', cacheKey: 'still-active', status: 'pending' }],
      });

      await manager.resumeIncompleteBatches([track]);

      expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
      expect(await store.getBatch('b1')).toMatchObject({ status: 'running' });
    });

    test('falls back to the internal queue for a bg-fetch batch with no active registration', async () => {
      const swReg = { backgroundFetch: { get: jest.fn().mockResolvedValue(null) } };
      mockServiceWorker(swReg);
      const track = makeTrack({ id: 'orphaned' });
      const { manager, mocks } = makeManager();
      const store = mocks.store;
      await store.createBatch({
        batch: { id: 'b1', status: 'running', totalFiles: 1, completedFiles: 0, failedFiles: 0, transport: 'bg-fetch' },
        items: [{ id: 'b1::orphaned', batchId: 'b1', cacheKey: 'orphaned', status: 'pending' }],
      });

      await manager.resumeIncompleteBatches([track]);

      expect(mocks.prefetchTrackToLocalCache).toHaveBeenCalledWith(track, expect.any(Object));
      expect(await store.getItem('b1::orphaned')).toMatchObject({ status: 'completed' });
    });

    test('skips items whose track is no longer in the current playlist', async () => {
      const { manager, mocks } = makeManager();
      const store = mocks.store;
      await store.createBatch({
        batch: { id: 'b1', status: 'running', totalFiles: 1, completedFiles: 0, failedFiles: 0, transport: 'internal-queue' },
        items: [{ id: 'b1::gone', batchId: 'b1', cacheKey: 'gone', status: 'pending' }],
      });

      await manager.resumeIncompleteBatches([]); // empty playlist -> no track maps to 'gone'

      expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
      expect(await store.getItem('b1::gone')).toMatchObject({ status: 'pending' });
    });
  });

  describe('onInternalQueueActiveChange / isInternalQueueRunning (SPEC-19.7)', () => {
    test('startBatch: toggles true then false around an internal-queue run', async () => {
      const onInternalQueueActiveChange = jest.fn();
      const { manager } = makeManager({ onInternalQueueActiveChange });

      expect(manager.isInternalQueueRunning()).toBe(false);
      await manager.startBatch([makeTrack()]);

      expect(onInternalQueueActiveChange.mock.calls).toEqual([[true], [false]]);
      expect(manager.isInternalQueueRunning()).toBe(false);
    });

    test('startBatch: never called when the batch is fully handled by Background Fetch', async () => {
      const bgFetchFn = jest.fn().mockResolvedValue(undefined);
      const swReg = { backgroundFetch: { get: jest.fn().mockResolvedValue(null), fetch: bgFetchFn } };
      mockServiceWorker(swReg);
      const onInternalQueueActiveChange = jest.fn();
      const { manager } = makeManager({
        onInternalQueueActiveChange,
        getDownloaderApiUrl: jest.fn().mockReturnValue('http://api.test'),
      });

      const result = await manager.startBatch([makeTrack()]);

      expect(result.backgrounded).toBe(true);
      expect(onInternalQueueActiveChange).not.toHaveBeenCalled();
    });

    test('recordBackgroundFetchResult: toggles around the internal-queue retry of failed keys', async () => {
      const badTrack = makeTrack({ id: 'bad', name: 'Song Bad', artist: 'Artist Bad' });
      const onInternalQueueActiveChange = jest.fn();
      const { manager, mocks } = makeManager({
        onInternalQueueActiveChange,
        prefetchTrackToLocalCache: jest.fn().mockResolvedValue(true),
      });
      const store = mocks.store;
      const batchId = 'batch-retry';
      await store.createBatch({
        batch: { id: batchId, status: 'running', totalFiles: 1, completedFiles: 0, failedFiles: 0, transport: 'bg-fetch' },
        items: [{ id: `${batchId}::bad`, batchId, cacheKey: 'bad', status: 'downloading' }],
      });

      await manager.recordBackgroundFetchResult(batchId, [], ['bad'], [badTrack]);

      expect(onInternalQueueActiveChange.mock.calls).toEqual([[true], [false]]);
    });

    test('resumeIncompleteBatches: toggles around resuming an internal-queue batch', async () => {
      const track = makeTrack({ id: 'resume-me' });
      const onInternalQueueActiveChange = jest.fn();
      const { manager, mocks } = makeManager({ onInternalQueueActiveChange });
      const store = mocks.store;
      await store.createBatch({
        batch: { id: 'b1', status: 'paused-auth', totalFiles: 1, completedFiles: 0, failedFiles: 0, transport: 'internal-queue' },
        items: [{ id: 'b1::resume-me', batchId: 'b1', cacheKey: 'resume-me', status: 'pending' }],
      });

      await manager.resumeIncompleteBatches([track]);

      expect(onInternalQueueActiveChange.mock.calls).toEqual([[true], [false]]);
    });

    test('resumeIncompleteBatches: never called when a bg-fetch batch is left alone (active registration)', async () => {
      const swReg = { backgroundFetch: { get: jest.fn().mockResolvedValue({ id: 'b1' }) } };
      mockServiceWorker(swReg);
      const onInternalQueueActiveChange = jest.fn();
      const { manager, mocks } = makeManager({ onInternalQueueActiveChange });
      const store = mocks.store;
      await store.createBatch({
        batch: { id: 'b1', status: 'running', totalFiles: 1, completedFiles: 0, failedFiles: 0, transport: 'bg-fetch' },
        items: [{ id: 'b1::still-active', batchId: 'b1', cacheKey: 'still-active', status: 'pending' }],
      });

      await manager.resumeIncompleteBatches([makeTrack({ id: 'still-active' })]);

      expect(onInternalQueueActiveChange).not.toHaveBeenCalled();
    });
  });
});

import { getTrackCacheKey } from './audioSourceManager.js';
import { computeNextBatchSize } from './downloadBatchSizing.js';
import { INITIAL_PARALLEL_DOWNLOADS } from './constants.js';
import { appendApiToken } from './downloaderConfig.js';

/**
 * @param {object} opts
 * @param {ReturnType<import('./downloadBatchStore.js').createDownloadBatchStore>} opts.store
 * @param {(item: object, opts?: {onError?: (err: Error) => void}) => Promise<boolean>} opts.prefetchTrackToLocalCache
 * @param {(item: object) => Promise<boolean>} opts.isTrackInLocalCache
 * @param {(name: string, artist: string) => Promise<object|null>} [opts.fetchMixData]
 * @param {(item: object, patch: object) => void} opts.setFilRougeTrackStatus
 * @param {() => void} opts.renderFilRouge
 * @param {(item: object) => void} opts.renderTrackStatus
 * @param {(msg: string, isError?: boolean) => void} opts.showToast
 * @param {(done: number, inProgress: number, total: number) => void} [opts.onProgress]
 * @param {() => string} [opts.getDownloaderApiUrl]
 * @param {() => string} [opts.getDownloaderApiToken]
 * @param {() => void} [opts.onAuthExpired]
 */
export function createDownloadBatchManager({
  store,
  prefetchTrackToLocalCache,
  isTrackInLocalCache,
  fetchMixData,
  setFilRougeTrackStatus,
  renderFilRouge,
  renderTrackStatus,
  showToast,
  onProgress,
  getDownloaderApiUrl,
  getDownloaderApiToken,
  onAuthExpired,
}) {
  async function requestNotifPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      return (await Notification.requestPermission()) === 'granted';
    } catch (_) {
      return false;
    }
  }

  async function getSwReg() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      return await navigator.serviceWorker.ready;
    } catch (_) {
      return null;
    }
  }

  async function showSwNotif(reg, title, body, tag = 'djmix-dl', silent = false) {
    if (!reg || Notification.permission !== 'granted') return;
    try {
      await reg.showNotification(title, {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag,
        silent,
        renotify: true,
      });
    } catch (_) {}
  }

  function itemRowId(batchId, cacheKey) {
    return `${batchId}::${cacheKey}`;
  }

  function makeBatchId() {
    return `filrouge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Dispatches a batch via the Background Fetch API. Returns true if the
   * fetch was successfully registered (the browser now owns delivery), false
   * if it couldn't be dispatched (caller should fall back to the internal queue).
   */
  async function _dispatchBackgroundFetch({ batchId, tracks, swReg }) {
    const baseUrl = getDownloaderApiUrl?.();
    if (!baseUrl) return false;
    const token = getDownloaderApiToken?.() || '';

    try {
      const existing = await swReg.backgroundFetch.get(batchId).catch(() => null);
      if (existing) await existing.abort().catch(() => {});
    } catch (_) {}

    const requests = tracks.map((track) => {
      const cacheKey = getTrackCacheKey(track);
      const url = appendApiToken(`${baseUrl}/api/download?_ck=${encodeURIComponent(cacheKey)}`, token);
      return new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackName: track.name,
          artistName: track.artist,
          searchQuery: `${track.artist} ${track.name}`,
          ...(Number.isFinite(track.popularity) ? { popularity: track.popularity } : {}),
        }),
      });
    });

    const itemIds = tracks.map((track) => itemRowId(batchId, getTrackCacheKey(track)));
    for (const track of tracks) {
      setFilRougeTrackStatus(track, { downloadState: 'downloading' });
      renderTrackStatus(track);
    }
    await store?.updateItems(itemIds, { status: 'downloading', startedAt: Date.now() });

    try {
      await swReg.backgroundFetch.fetch(batchId, requests, {
        title: `DJ Mix — ${tracks.length} morceau${tracks.length > 1 ? 'x' : ''} à télécharger`,
        icons: [{ src: './icon-192.png', sizes: '192x192', type: 'image/png' }],
        downloadTotal: 0,
      });
      await store?.updateBatch(batchId, { transport: 'bg-fetch' });
      showToast(`Téléchargement lancé (${tracks.length} morceaux) — continue en arrière-plan`);
      return true;
    } catch (err) {
      console.warn('[downloadBatchManager] Background Fetch non disponible, mode séquentiel', err);
      return false;
    }
  }

  /**
   * Adaptive-parallel internal download queue (fallback when Background
   * Fetch is unavailable, or resuming items left over from a previous
   * internal-queue run). Every item transition is written to IndexedDB
   * immediately alongside the existing in-memory status callbacks.
   */
  async function _runInternalQueueLoop({ batchId, tracks, total, swReg }) {
    let batchSize = INITIAL_PARALLEL_DOWNLOADS;
    let done = 0;
    let failed = 0;
    let i = 0;
    let lastNotifiedAt = 0;

    while (i < tracks.length) {
      const slice = tracks.slice(i, i + batchSize);
      const itemIds = slice.map((track) => itemRowId(batchId, getTrackCacheKey(track)));

      for (const track of slice) {
        setFilRougeTrackStatus(track, { downloadState: 'downloading' });
        renderTrackStatus(track);
      }
      await store?.updateItems(itemIds, { status: 'downloading', startedAt: Date.now() });

      const startedAt = performance.now();
      const authFailedFlags = slice.map(() => false);
      const results = await Promise.allSettled(
        slice.map((track, j) => prefetchTrackToLocalCache(track, {
          onError: (err) => {
            if (err?.status === 401 || err?.status === 403) authFailedFlags[j] = true;
          },
        }))
      );
      batchSize = computeNextBatchSize({
        currentSize: batchSize,
        elapsedMs: performance.now() - startedAt,
        completedCount: slice.length,
      });

      for (let j = 0; j < slice.length; j++) {
        const track = slice[j];
        const ok = results[j].status === 'fulfilled' && results[j].value;
        const id = itemIds[j];
        if (ok) {
          done++;
          const mixData = fetchMixData
            ? await fetchMixData(track.name, track.artist).catch(() => null)
            : null;
          setFilRougeTrackStatus(track, { downloadState: 'done', hasMixInfo: Boolean(mixData) });
          await store?.updateItem(id, { status: 'completed', completedAt: Date.now() });
        } else if (authFailedFlags[j]) {
          // Not the track's fault — leave it retryable, don't count as failed.
          setFilRougeTrackStatus(track, { downloadState: 'idle' });
          await store?.updateItem(id, { status: 'pending' });
        } else {
          failed++;
          setFilRougeTrackStatus(track, { downloadState: 'error' });
          await store?.updateItem(id, (existing) => ({
            status: 'failed',
            retries: (existing?.retries ?? 0) + 1,
          }));
        }
        renderTrackStatus(track);
        onProgress?.(done, 0, total);
      }

      i += slice.length;

      if (authFailedFlags.some(Boolean)) {
        const remaining = tracks.slice(i);
        const remainingIds = remaining.map((track) => itemRowId(batchId, getTrackCacheKey(track)));
        for (const track of remaining) setFilRougeTrackStatus(track, { downloadState: 'idle' });
        await store?.updateItems(remainingIds, { status: 'pending' });
        await store?.updateBatch(batchId, {
          status: 'paused-auth',
          updatedAt: Date.now(),
          completedFiles: done,
          failedFiles: failed,
        });
        onAuthExpired?.();
        return { done, failed, authPaused: true };
      }

      if (done + failed - lastNotifiedAt >= 5 && (done + failed) < total) {
        await showSwNotif(
          swReg,
          'DJ Mix — Téléchargement en cours',
          `${done + failed} / ${total} morceaux`,
          'djmix-dl-progress',
          true,
        );
        lastNotifiedAt = done + failed;
      }
    }

    return { done, failed, authPaused: false };
  }

  /**
   * Downloads tracks not yet in local cache, creating a persisted
   * DownloadBatch/DownloadItem set in IndexedDB before any network activity
   * so progress survives a reload. Uses Background Fetch when available,
   * else an adaptive-parallel internal queue.
   * @param {object[]} tracks
   */
  async function startBatch(tracks) {
    let alreadyCached = 0;
    const toFetch = [];
    for (const track of tracks) {
      const inCache = await isTrackInLocalCache(track).catch(() => false);
      if (inCache) {
        alreadyCached++;
        const mixData = fetchMixData
          ? await fetchMixData(track.name, track.artist).catch(() => null)
          : null;
        setFilRougeTrackStatus(track, { downloadState: 'done', hasMixInfo: Boolean(mixData) });
      } else {
        toFetch.push(track);
      }
    }
    if (alreadyCached > 0) renderFilRouge();

    const total = toFetch.length;
    if (!total) {
      if (alreadyCached > 0) {
        showToast(`Tous les morceaux sont déjà en cache (${alreadyCached} retrouvé${alreadyCached > 1 ? 's' : ''})`);
      }
      return { done: 0, failed: 0, total: 0, backgrounded: false, authPaused: false };
    }

    await requestNotifPermission();
    const swReg = await getSwReg();
    await store?.pruneOldBatches?.().catch(() => {});

    const batchId = makeBatchId();
    const items = toFetch.map((track) => ({
      id: itemRowId(batchId, getTrackCacheKey(track)),
      batchId,
      cacheKey: getTrackCacheKey(track),
      trackName: track.name,
      artistName: track.artist,
      filename: `${track.artist} - ${track.name}`,
      size: null,
      status: 'pending',
      retries: 0,
      startedAt: null,
      completedAt: null,
    }));
    await store?.createBatch({
      batch: {
        id: batchId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'running',
        totalFiles: total,
        completedFiles: 0,
        failedFiles: 0,
        transport: null,
      },
      items,
    });

    console.debug('[downloadBatchManager] start', { batchId, total, tracks: toFetch.map(t => `${t.artist} - ${t.name}`) });
    onProgress?.(0, 0, total);

    const canBgFetch = Boolean(swReg?.backgroundFetch) && Boolean(getDownloaderApiUrl?.());
    if (canBgFetch) {
      const dispatched = await _dispatchBackgroundFetch({ batchId, tracks: toFetch, swReg });
      if (dispatched) {
        onProgress?.(0, 0, 0);
        return { done: 0, failed: 0, total, backgrounded: true, authPaused: false };
      }
    }

    await store?.updateBatch(batchId, { transport: 'internal-queue' });
    const result = await _runInternalQueueLoop({ batchId, tracks: toFetch, total, swReg });

    if (!result.authPaused) {
      await store?.updateBatch(batchId, {
        status: 'completed',
        updatedAt: Date.now(),
        completedFiles: result.done,
        failedFiles: result.failed,
      });
      await showSwNotif(
        swReg,
        'DJ Mix — Téléchargement terminé',
        `${result.done} réussi${result.done > 1 ? 's' : ''}${result.failed > 0 ? ` — ${result.failed} échec${result.failed > 1 ? 's' : ''}` : ''}`,
        'djmix-dl-done',
        false,
      );
    }

    return { done: result.done, failed: result.failed, total, backgrounded: false, authPaused: result.authPaused };
  }

  /**
   * Applies a Background Fetch result (from the SW's `BG_FETCH_DONE`
   * message) to IndexedDB. `succeededKeys`/`failedKeys` are cache keys
   * (matching the `_ck` param sw.js reads off each request).
   */
  async function recordBackgroundFetchResult(batchId, succeededKeys = [], failedKeys = []) {
    if (!batchId || !store) return;
    const now = Date.now();
    await store.updateItems(
      succeededKeys.map((ck) => itemRowId(batchId, ck)),
      { status: 'completed', completedAt: now },
    );
    await store.updateItems(
      failedKeys.map((ck) => itemRowId(batchId, ck)),
      { status: 'failed' },
    );
    await store.updateBatch(batchId, {
      status: (failedKeys.length && !succeededKeys.length) ? 'failed' : 'completed',
      completedFiles: succeededKeys.length,
      failedFiles: failedKeys.length,
      updatedAt: now,
    });
  }

  /**
   * Applies a Background Fetch failure (no per-item detail available) —
   * marks every item still `downloading` as `failed`. Resume treats
   * `pending`/`failed` identically, so no finer distinction is needed.
   */
  async function recordBackgroundFetchFail(batchId) {
    if (!batchId || !store) return;
    const items = await store.listItems(batchId);
    const stillDownloading = items.filter((it) => it.status === 'downloading');
    await store.updateItems(stillDownloading.map((it) => it.id), { status: 'failed' });
    await store.updateBatch(batchId, { status: 'failed', updatedAt: Date.now() });
  }

  /**
   * Resumes any batch left incomplete by a previous session. Never
   * re-downloads a `completed` item. Batches actively being delivered by
   * Background Fetch (registration still found by the browser) are left
   * alone — they'll complete via the normal BG_FETCH_DONE/FAIL message flow.
   * @param {object[]} playlist current Fil Rouge tracks, used to map cacheKey -> track
   */
  async function resumeIncompleteBatches(playlist) {
    if (!store) return;
    const batches = await store.listIncompleteBatches();
    if (!batches.length) return;

    const cacheKeyToTrack = new Map(playlist.map((t) => [getTrackCacheKey(t), t]));
    const swReg = await getSwReg();
    let changed = false;

    for (const batch of batches) {
      const items = await store.listItems(batch.id);
      const remaining = items.filter((it) => it.status !== 'completed');
      if (!remaining.length) {
        await store.updateBatch(batch.id, { status: 'completed' });
        continue;
      }

      if (batch.transport === 'bg-fetch') {
        const active = await swReg?.backgroundFetch?.get(batch.id).catch(() => null);
        if (active) continue; // native resume in progress
      }

      const resumableTracks = remaining
        .map((it) => cacheKeyToTrack.get(it.cacheKey))
        .filter(Boolean);
      if (!resumableTracks.length) continue;

      for (const track of resumableTracks) setFilRougeTrackStatus(track, { downloadState: 'idle' });
      await store.updateBatch(batch.id, { transport: 'internal-queue', status: 'running', updatedAt: Date.now() });

      const result = await _runInternalQueueLoop({
        batchId: batch.id,
        tracks: resumableTracks,
        total: resumableTracks.length,
        swReg,
      });
      changed = true;

      if (!result.authPaused) {
        await store.updateBatch(batch.id, {
          status: 'completed',
          updatedAt: Date.now(),
          completedFiles: (batch.completedFiles || 0) + result.done,
          failedFiles: (batch.failedFiles || 0) + result.failed,
        });
      }
    }

    if (changed) renderFilRouge();
  }

  return {
    startBatch,
    resumeIncompleteBatches,
    recordBackgroundFetchResult,
    recordBackgroundFetchFail,
  };
}

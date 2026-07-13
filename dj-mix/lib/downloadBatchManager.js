import { getTrackCacheKey } from './audioSourceManager.js';
import { computeNextBatchSize } from './downloadBatchSizing.js';
import {
  INITIAL_PARALLEL_DOWNLOADS,
  MAX_DOWNLOAD_RETRY_ATTEMPTS,
  DOWNLOAD_RETRY_BACKOFF_BASE_MS,
} from './constants.js';
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
 * @param {(active: boolean) => void} [opts.onInternalQueueActiveChange] - notifié quand la file interne démarre/s'arrête (permet à l'appelant de garder l'écran allumé, SPEC-19.7)
 * @param {(ms: number) => Promise<void>} [opts.waitFn] - injectable pour les tests (backoff des retentatives)
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
  onInternalQueueActiveChange,
  waitFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  let internalQueueActiveCount = 0;

  /**
   * Enveloppe tout passage par la file interne (parallèle ou retentatives) :
   * notifie `onInternalQueueActiveChange` sur la transition 0→1 / 1→0 d'un
   * compteur, pour que l'appelant puisse acquérir un Wake Lock écran pendant
   * que du JS de page doit rester actif (SPEC-19.7.1).
   */
  async function _withInternalQueueActive(fn) {
    internalQueueActiveCount++;
    if (internalQueueActiveCount === 1) onInternalQueueActiveChange?.(true);
    try {
      return await fn();
    } finally {
      internalQueueActiveCount--;
      if (internalQueueActiveCount === 0) onInternalQueueActiveChange?.(false);
    }
  }

  function isInternalQueueRunning() {
    return internalQueueActiveCount > 0;
  }

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
  async function _runInternalQueueLoop({ batchId, tracks, total, swReg, doneOffset = 0 }) {
    let batchSize = INITIAL_PARALLEL_DOWNLOADS;
    let done = 0;
    let failed = 0;
    const failedTracks = [];
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
          failedTracks.push(track);
          setFilRougeTrackStatus(track, { downloadState: 'error' });
          await store?.updateItem(id, (existing) => ({
            status: 'failed',
            retries: (existing?.retries ?? 0) + 1,
          }));
        }
        renderTrackStatus(track);
        onProgress?.(doneOffset + done, 0, total);
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
          completedFiles: doneOffset + done,
          failedFiles: failed,
        });
        onAuthExpired?.();
        return { done, failed, failedTracks, authPaused: true };
      }

      if (done + failed - lastNotifiedAt >= 5 && (done + failed) < total) {
        await showSwNotif(
          swReg,
          'DJ Mix — Téléchargement en cours',
          `${doneOffset + done + failed} / ${total} morceaux`,
          'djmix-dl-progress',
          true,
        );
        lastNotifiedAt = done + failed;
      }
    }

    return { done, failed, failedTracks, authPaused: false };
  }

  /**
   * Retente les morceaux échoués jusqu'à MAX_DOWNLOAD_RETRY_ATTEMPTS fois via
   * la file interne, avec backoff exponentiel (base · 2^(n−1) : 2s, 4s, 8s)
   * avant chaque vague (SPEC-19.6.2). S'arrête dès que tout est récupéré ou
   * qu'une pause auth survient.
   */
  async function _retryFailedTracks({ batchId, failedTracks, total, doneOffset = 0, swReg }) {
    let done = 0;
    let remaining = failedTracks;
    let authPaused = false;

    for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRY_ATTEMPTS && remaining.length && !authPaused; attempt++) {
      await waitFn(DOWNLOAD_RETRY_BACKOFF_BASE_MS * 2 ** (attempt - 1));
      const result = await _runInternalQueueLoop({
        batchId,
        tracks: remaining,
        total,
        swReg,
        doneOffset: doneOffset + done,
      });
      done += result.done;
      remaining = result.failedTracks;
      authPaused = result.authPaused;
    }

    return { done, failedTracks: remaining, authPaused };
  }

  /**
   * Passe initial de la file interne puis retentatives avec backoff des
   * morceaux échoués. Retourne les compteurs consolidés post-retentatives.
   */
  async function _runInternalQueueWithRetries({ batchId, tracks, total, swReg }) {
    const first = await _runInternalQueueLoop({ batchId, tracks, total, swReg });
    if (first.authPaused || !first.failedTracks.length) {
      return { done: first.done, failed: first.failed, authPaused: first.authPaused };
    }

    const retry = await _retryFailedTracks({
      batchId,
      failedTracks: first.failedTracks,
      total,
      doneOffset: first.done,
      swReg,
    });

    return {
      done: first.done + retry.done,
      failed: retry.failedTracks.length,
      authPaused: retry.authPaused,
    };
  }

  /**
   * Récupère les mix infos des morceaux fraîchement mis en cache (Background
   * Fetch réussi) et positionne `hasMixInfo` — même comportement que la file
   * interne après un téléchargement réussi (SPEC-19.6.4).
   */
  async function _fetchMixInfoForTracks(tracks) {
    if (!fetchMixData) return;
    for (const track of tracks) {
      const mixData = await fetchMixData(track.name, track.artist).catch(() => null);
      setFilRougeTrackStatus(track, { hasMixInfo: Boolean(mixData) });
      renderTrackStatus(track);
    }
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
    const result = await _withInternalQueueActive(() => (
      _runInternalQueueWithRetries({ batchId, tracks: toFetch, total, swReg })
    ));

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
   *
   * Avec `playlist`, les clés échouées sont retentées via la file interne
   * (backoff exponentiel, SPEC-19.6.3) pendant que les mix infos des
   * morceaux réussis sont récupérées en parallèle (SPEC-19.6.4).
   */
  async function recordBackgroundFetchResult(batchId, succeededKeys = [], failedKeys = [], playlist = []) {
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

    const byCacheKey = new Map(
      (Array.isArray(playlist) ? playlist : []).map((t) => [getTrackCacheKey(t), t]),
    );
    const succeededTracks = succeededKeys.map((ck) => byCacheKey.get(ck)).filter(Boolean);
    const failedTracks = failedKeys.map((ck) => byCacheKey.get(ck)).filter(Boolean);

    const mixInfoTask = _fetchMixInfoForTracks(succeededTracks);

    if (!failedTracks.length) {
      await store.updateBatch(batchId, {
        status: (failedKeys.length && !succeededKeys.length) ? 'failed' : 'completed',
        completedFiles: succeededKeys.length,
        failedFiles: failedKeys.length,
        updatedAt: now,
      });
      await mixInfoTask;
      return;
    }

    // Les échecs retrouvés dans le fil rouge repartent via la file interne.
    await store.updateBatch(batchId, {
      status: 'running',
      transport: 'internal-queue',
      updatedAt: now,
    });
    const total = succeededKeys.length + failedKeys.length;
    const swReg = await getSwReg();

    const [retry] = await Promise.all([
      _withInternalQueueActive(() => _retryFailedTracks({
        batchId,
        failedTracks,
        total,
        doneOffset: succeededKeys.length,
        swReg,
      })),
      mixInfoTask,
    ]);

    if (retry.authPaused) return; // batch déjà passé en paused-auth dans la boucle

    // Les clés échouées sans morceau correspondant dans le fil rouge actuel
    // restent comptées en échec (non retentables).
    const unresolvedFailed = failedKeys.length - failedTracks.length;
    const completedFiles = succeededKeys.length + retry.done;
    const failedFiles = retry.failedTracks.length + unresolvedFailed;
    await store.updateBatch(batchId, {
      status: (failedFiles && !completedFiles) ? 'failed' : 'completed',
      completedFiles,
      failedFiles,
      updatedAt: Date.now(),
    });
    showToast(
      failedFiles > 0
        ? `Retentatives terminées : ${retry.done} récupéré${retry.done > 1 ? 's' : ''} — ${failedFiles} échec${failedFiles > 1 ? 's' : ''}`
        : `Retentatives terminées : ${retry.done} morceau${retry.done > 1 ? 'x' : ''} récupéré${retry.done > 1 ? 's' : ''}`,
      failedFiles > 0,
    );
    renderFilRouge();
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

      const result = await _withInternalQueueActive(() => (
        _runInternalQueueWithRetries({
          batchId: batch.id,
          tracks: resumableTracks,
          total: resumableTracks.length,
          swReg,
        })
      ));
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
    isInternalQueueRunning,
  };
}

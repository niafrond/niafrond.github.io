import { getTrackCacheKey } from './audioSourceManager.js';
import { computeNextBatchSize } from './downloadBatchSizing.js';
import {
  INITIAL_PARALLEL_DOWNLOADS,
  MAX_PARALLEL_DOWNLOADS,
  MAX_DOWNLOAD_RETRY_ATTEMPTS,
  DOWNLOAD_RETRY_BACKOFF_BASE_MS,
} from './constants.js';

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
 * @param {() => void} [opts.onAuthExpired]
 * @param {(active: boolean) => void} [opts.onInternalQueueActiveChange] - notifié quand la file interne démarre/s'arrête (permet à l'appelant de garder l'écran allumé, SPEC-19.7)
 * @param {object} [opts.apiHealthMonitor] - si fourni, le moniteur est réinitialisé avant chaque vague de retentatives
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
  onAuthExpired,
  onInternalQueueActiveChange,
  apiHealthMonitor,
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
   * Sliding-window internal download pool (fallback when Background Fetch is
   * unavailable, or resuming items left over from a previous run). Keeps
   * `concurrency` downloads active at all times — a new download starts as
   * soon as any one finishes, eliminating idle gaps between batches.
   *
   * Adaptive concurrency: every `ADJUST_WINDOW` completions we measure the
   * average per-track time and adjust `concurrency` via computeNextBatchSize.
   */
  async function _runInternalQueueLoop({ batchId, tracks, total, swReg, doneOffset = 0 }) {
    let concurrency = INITIAL_PARALLEL_DOWNLOADS;
    let done = 0;
    let failed = 0;
    const failedTracks = [];
    let lastNotifiedAt = 0;
    let authPaused = false;

    // Sliding-window adaptive tracking
    const ADJUST_WINDOW = Math.max(3, INITIAL_PARALLEL_DOWNLOADS);
    let windowStart = performance.now();
    let windowCompletions = 0;

    let idx = 0;
    let activeCount = 0;

    await new Promise((resolveAll) => {
      function maybeNotify() {
        const processed = done + failed;
        if (processed - lastNotifiedAt >= 5 && processed < total) {
          showSwNotif(
            swReg,
            'DJ Mix — Téléchargement en cours',
            `${doneOffset + processed} / ${total} morceaux`,
            'djmix-dl-progress',
            true,
          );
          lastNotifiedAt = processed;
        }
      }

      function maybeDone() {
        if (idx >= tracks.length && activeCount === 0) {
          resolveAll();
          return true;
        }
        if (authPaused && activeCount === 0) {
          resolveAll();
          return true;
        }
        return false;
      }

      function adjustConcurrency() {
        windowCompletions++;
        if (windowCompletions >= ADJUST_WINDOW) {
          const elapsed = performance.now() - windowStart;
          concurrency = computeNextBatchSize({
            currentSize: concurrency,
            elapsedMs: elapsed,
            completedCount: windowCompletions,
          });
          windowStart = performance.now();
          windowCompletions = 0;
        }
      }

      function startNext() {
        while (activeCount < concurrency && idx < tracks.length && !authPaused) {
          const track = tracks[idx];
          idx++;
          activeCount++;

          const cacheKey = getTrackCacheKey(track);
          const itemId = itemRowId(batchId, cacheKey);

          setFilRougeTrackStatus(track, { downloadState: 'downloading' });
          renderTrackStatus(track);
          store?.updateItem(itemId, { status: 'downloading', startedAt: Date.now() });

          let trackAuthFailed = false;
          prefetchTrackToLocalCache(track, {
            onError: (err) => {
              if (err?.status === 401 || err?.status === 403) trackAuthFailed = true;
            },
          }).then((ok) => {
            activeCount--;

            if (ok) {
              done++;
              adjustConcurrency();
              setFilRougeTrackStatus(track, { downloadState: 'done', hasMixInfo: false });
              store?.updateItem(itemId, { status: 'completed', completedAt: Date.now() });
              // Non-blocking mix info fetch — don't hold up the pool
              if (fetchMixData) {
                fetchMixData(track.name, track.artist).catch(() => null).then((mixData) => {
                  setFilRougeTrackStatus(track, { hasMixInfo: Boolean(mixData) });
                  renderTrackStatus(track);
                });
              }
            } else if (trackAuthFailed) {
              if (!authPaused) {
                authPaused = true;
                // Mark remaining un-started tracks as idle/pending (once)
                const remaining = tracks.slice(idx);
                const remainingIds = remaining.map((t) => itemRowId(batchId, getTrackCacheKey(t)));
                for (const t of remaining) setFilRougeTrackStatus(t, { downloadState: 'idle' });
                store?.updateItems(remainingIds, { status: 'pending' });
                store?.updateBatch(batchId, {
                  status: 'paused-auth',
                  updatedAt: Date.now(),
                  completedFiles: doneOffset + done,
                  failedFiles: failed,
                });
                onAuthExpired?.();
              }
              setFilRougeTrackStatus(track, { downloadState: 'idle' });
              store?.updateItem(itemId, { status: 'pending' });
            } else {
              failed++;
              adjustConcurrency();
              failedTracks.push(track);
              setFilRougeTrackStatus(track, { downloadState: 'error' });
              store?.updateItem(itemId, (existing) => ({
                status: 'failed',
                retries: (existing?.retries ?? 0) + 1,
              }));
            }
            renderTrackStatus(track);
            onProgress?.(doneOffset + done, activeCount, total);
            maybeNotify();

            if (!maybeDone()) {
              if (!authPaused) startNext();
            }
          });
        }
        maybeDone();
      }

      startNext();
    });

    return { done, failed, failedTracks, authPaused };
  }

  /**
   * Retente les morceaux échoués jusqu'à MAX_DOWNLOAD_RETRY_ATTEMPTS fois via
   * la file interne, avec backoff exponentiel (base · 2^(n−1) : 2s, 4s, 8s)
   * avant chaque vague (SPEC-19.6.2). Réinitialise le moniteur de santé API
   * avant chaque tentative pour éviter que l'état offline bloque les retries.
   * S'arrête dès que tout est récupéré ou qu'une pause auth survient.
   */
  async function _retryFailedTracks({ batchId, failedTracks, total, doneOffset = 0, swReg }) {
    let done = 0;
    let remaining = failedTracks;
    let authPaused = false;

    for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRY_ATTEMPTS && remaining.length && !authPaused; attempt++) {
      await waitFn(DOWNLOAD_RETRY_BACKOFF_BASE_MS * 2 ** (attempt - 1));
      // Reset health monitor so retries actually reach the network
      apiHealthMonitor?.recordSuccess();
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
   * Downloads tracks not yet in local cache, creating a persisted
   * DownloadBatch/DownloadItem set in IndexedDB before any network activity
   * so progress survives a reload. Uses an adaptive-parallel internal queue
   * with regular fetch (no rate limiting, no Background Fetch API).
   * Already-downloaded tracks are skipped (isTrackInLocalCache check).
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
      return { done: 0, failed: 0, total: 0, authPaused: false };
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
        transport: 'internal-queue',
      },
      items,
    });

    console.debug('[downloadBatchManager] start', { batchId, total, tracks: toFetch.map(t => `${t.artist} - ${t.name}`) });
    onProgress?.(0, 0, total);

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

    return { done: result.done, failed: result.failed, total, authPaused: result.authPaused };
  }

  /**
   * Resumes any batch left incomplete by a previous session. Never
   * re-downloads a `completed` item — tracks already in local cache are
   * skipped to avoid duplicate downloads.
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

      const resumableTracks = remaining
        .map((it) => cacheKeyToTrack.get(it.cacheKey))
        .filter(Boolean);
      if (!resumableTracks.length) continue;

      // Skip tracks that are already in local cache (downloaded since last session)
      const tracksToDownload = [];
      for (const track of resumableTracks) {
        const inCache = await isTrackInLocalCache(track).catch(() => false);
        if (inCache) {
          const itemId = itemRowId(batch.id, getTrackCacheKey(track));
          await store.updateItem(itemId, { status: 'completed', completedAt: Date.now() });
          setFilRougeTrackStatus(track, { downloadState: 'done' });
        } else {
          tracksToDownload.push(track);
          setFilRougeTrackStatus(track, { downloadState: 'idle' });
        }
      }

      if (!tracksToDownload.length) {
        await store.updateBatch(batch.id, { status: 'completed', updatedAt: Date.now() });
        changed = true;
        continue;
      }

      await store.updateBatch(batch.id, { transport: 'internal-queue', status: 'running', updatedAt: Date.now() });

      const result = await _withInternalQueueActive(() => (
        _runInternalQueueWithRetries({
          batchId: batch.id,
          tracks: tracksToDownload,
          total: tracksToDownload.length,
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
    isInternalQueueRunning,
  };
}

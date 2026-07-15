import { createDownloadBatchStore } from './downloadBatchStore.js';
import { createDownloadBatchManager } from './downloadBatchManager.js';

/**
 * @param {object} opts
 * @param {(item: object, opts?: {onError?: (err: Error) => void}) => Promise<boolean>} opts.prefetchTrackToLocalCache
 * @param {(item: object) => Promise<boolean>} opts.isTrackInLocalCache
 * @param {(item: object, patch: object) => void} opts.setFilRougeTrackStatus
 * @param {(item: object) => {downloadState: string}} opts.getFilRougeTrackStatus
 * @param {() => void} opts.renderFilRouge
 * @param {(item: object) => void} opts.renderTrackStatus
 * @param {(msg: string, isError?: boolean) => void} opts.showToast
 * @param {(done: number, inProgress: number, total: number) => void} [opts.onProgress]
 * @param {(name: string, artist: string) => Promise<object|null>} [opts.fetchMixData]
 * @param {(done: number, total: number) => void} [opts.onMixInfoProgress]
 * @param {ReturnType<import('./downloadBatchStore.js').createDownloadBatchStore>} [opts.store]
 * @param {() => void} [opts.onAuthExpired]
 * @param {(active: boolean) => void} [opts.onInternalQueueActiveChange] - notifié quand la file interne démarre/s'arrête (Wake Lock écran, SPEC-19.7)
 * @param {object} [opts.apiHealthMonitor] - moniteur de santé API, réinitialisé avant les retries
 * @param {(ms: number) => Promise<void>} [opts.waitFn] - injectable pour les tests (backoff des retentatives)
 */
export function createFilRougeDownloader({
  prefetchTrackToLocalCache,
  isTrackInLocalCache,
  setFilRougeTrackStatus,
  getFilRougeTrackStatus,
  renderFilRouge,
  renderTrackStatus,
  showToast,
  onProgress,
  fetchMixData,
  onMixInfoProgress,
  store = createDownloadBatchStore(),
  onAuthExpired,
  onInternalQueueActiveChange,
  apiHealthMonitor,
  waitFn,
}) {
  const downloadBatchManager = createDownloadBatchManager({
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
    ...(waitFn ? { waitFn } : {}),
  });

  /**
   * Tâche séquentielle parallèle : met à jour les mix infos des pistes déjà téléchargées
   * qui n'ont pas encore de mix info.
   */
  async function _runMixInfoTask(tracks) {
    for (const track of tracks) {
      try {
        const mixData = await fetchMixData(track.name, track.artist);
        setFilRougeTrackStatus(track, { hasMixInfo: Boolean(mixData) });
      } catch (_) {
        setFilRougeTrackStatus(track, { hasMixInfo: false });
      }
      renderTrackStatus(track);
    }
  }

  /**
   * GIVEN au moins un morceau du fil rouge dont downloadState n'est ni
   * 'done' ni 'downloading' — THEN retourne true (SPEC-3.4.11). Utilisé pour
   * décider s'il faut déclencher automatiquement `downloadAll`.
   * @param {object[]} tracks
   * @returns {boolean}
   */
  function hasMissingDownloads(tracks) {
    return (tracks || []).some((t) => {
      if (!t?.name || !t?.artist) return false;
      const { downloadState } = getFilRougeTrackStatus(t);
      return downloadState !== 'done' && downloadState !== 'downloading';
    });
  }

  /**
   * Télécharge les morceaux du fil rouge qui ne sont pas encore en cache
   * (via le moteur de lot persistant, SPEC-19.x) et met à jour les mix infos
   * manquantes — deux tâches en parallèle.
   * @param {object[]} tracks
   */
  async function downloadAll(tracks) {
    const toDownload = [];
    const toMixInfoOnly = [];

    for (const t of tracks) {
      if (!t?.name || !t?.artist) continue;
      const { downloadState, hasMixInfo } = getFilRougeTrackStatus(t);
      if (downloadState === 'downloading') continue;
      if (downloadState !== 'done') {
        toDownload.push(t);
      } else if (!hasMixInfo && fetchMixData) {
        toMixInfoOnly.push(t);
      }
    }

    if (!toDownload.length && !toMixInfoOnly.length) {
      showToast('Tous les morceaux sont déjà téléchargés');
      return;
    }

    const [dlResult] = await Promise.all([
      downloadBatchManager.startBatch(toDownload),
      _runMixInfoTask(toMixInfoOnly),
    ]);

    if (dlResult.authPaused) {
      // Toast already shown inside the manager (onAuthExpired) — nothing further to report here.
      return;
    }

    const { done, total } = dlResult;
    if (total > 0) {
      showToast(`Téléchargement terminé : ${done}/${total}`);
    } else if (!toDownload.length && toMixInfoOnly.length > 0) {
      showToast(`Mix info mis à jour (${toMixInfoOnly.length} morceau${toMixInfoOnly.length > 1 ? 'x' : ''})`);
    }
  }

  /**
   * Force la récupération des mix suggestions (mix info) manquantes pour les
   * morceaux déjà téléchargés (`downloadState: 'done'`), sans télécharger
   * d'audio. Utilisé par le bouton dédié quand l'auto-fetch de SPEC-3.5.6
   * (déclenché en marge de "Tout télécharger") n'a pas suffi (échec API,
   * mix suggestions pas encore calculées côté serveur au moment du premier
   * essai, etc.).
   * @param {object[]} tracks
   */
  async function downloadMissingMixInfo(tracks) {
    if (!fetchMixData) {
      showToast('Mix info indisponible', true);
      return;
    }

    const missing = tracks.filter((t) => {
      if (!t?.name || !t?.artist) return false;
      const { downloadState, hasMixInfo } = getFilRougeTrackStatus(t);
      return downloadState === 'done' && !hasMixInfo;
    });

    if (!missing.length) {
      showToast('Aucune mix info manquante');
      return;
    }

    const total = missing.length;
    let done = 0;
    let failed = 0;
    onMixInfoProgress?.(0, total);

    for (const track of missing) {
      try {
        const mixData = await fetchMixData(track.name, track.artist);
        const ok = Boolean(mixData);
        setFilRougeTrackStatus(track, { hasMixInfo: ok });
        if (ok) done++; else failed++;
      } catch (_) {
        setFilRougeTrackStatus(track, { hasMixInfo: false });
        failed++;
      }
      renderTrackStatus(track);
      onMixInfoProgress?.(done + failed, total);
    }

    onMixInfoProgress?.(0, 0);
    showToast(
      failed > 0
        ? `Mix info mis à jour (${done}/${total}), ${failed} échec${failed > 1 ? 's' : ''}`
        : `Mix info mis à jour (${done} morceau${done > 1 ? 'x' : ''})`
    );
  }

  return {
    downloadAll,
    downloadMissingMixInfo,
    hasMissingDownloads,
    resumeIncompleteBatches: downloadBatchManager.resumeIncompleteBatches,
    isInternalQueueRunning: downloadBatchManager.isInternalQueueRunning,
  };
}

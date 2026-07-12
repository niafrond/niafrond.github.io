/**
 * @param {object} opts
 * @param {(item: object) => Promise<boolean>} opts.prefetchTrackToLocalCache
 * @param {(item: object) => Promise<boolean>} opts.isTrackInLocalCache
 * @param {(item: object, patch: object) => void} opts.setFilRougeTrackStatus
 * @param {(item: object) => {downloadState: string}} opts.getFilRougeTrackStatus
 * @param {() => void} opts.renderFilRouge
 * @param {(item: object) => void} opts.renderTrackStatus
 * @param {(msg: string, isError?: boolean) => void} opts.showToast
 * @param {(done: number, inProgress: number, total: number) => void} [opts.onProgress]
 * @param {(name: string, artist: string) => Promise<object|null>} [opts.fetchMixData]
 * @param {(done: number, total: number) => void} [opts.onMixInfoProgress]
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

  /**
   * Tâche séquentielle : télécharge les pistes manquantes + fetchMixData après chaque succès.
   * @returns {{ done: number, failed: number, total: number }}
   */
  async function _runDownloadTask(tracks, swReg) {
    let alreadyCached = 0;
    const pending = [];
    for (const track of tracks) {
      const inCache = await isTrackInLocalCache(track).catch(() => false);
      if (inCache) {
        alreadyCached++;
        const mixData = fetchMixData
          ? await fetchMixData(track.name, track.artist).catch(() => null)
          : null;
        setFilRougeTrackStatus(track, { downloadState: 'done', hasMixInfo: Boolean(mixData) });
      } else {
        pending.push(track);
      }
    }
    if (alreadyCached > 0) renderFilRouge();

    const total = pending.length;
    if (!total) {
      if (alreadyCached > 0) {
        showToast(`Tous les morceaux sont déjà en cache (${alreadyCached} retrouvé${alreadyCached > 1 ? 's' : ''})`);
      }
      return { done: 0, failed: 0, total: 0 };
    }

    let done = 0;
    let failed = 0;

    console.debug('[downloadAll] start', { total, tracks: pending.map(t => `${t.artist} - ${t.name}`) });
    onProgress?.(0, 0, total);

    for (const track of pending) {
      setFilRougeTrackStatus(track, { downloadState: 'downloading' });
      renderTrackStatus(track);
      onProgress?.(done, 1, total);

      console.debug('[downloadAll] prefetch start', { artist: track.artist, name: track.name });
      try {
        const ok = await prefetchTrackToLocalCache(track);
        console.debug('[downloadAll] prefetch result', { artist: track.artist, name: track.name, ok });
        if (ok) {
          done++;
          const mixData = fetchMixData
            ? await fetchMixData(track.name, track.artist).catch(() => null)
            : null;
          setFilRougeTrackStatus(track, { downloadState: 'done', hasMixInfo: Boolean(mixData) });
        } else {
          failed++;
          setFilRougeTrackStatus(track, { downloadState: 'error' });
        }
      } catch (err) {
        console.error('[downloadAll] prefetch threw', { artist: track.artist, name: track.name, error: err?.message, err });
        failed++;
        setFilRougeTrackStatus(track, { downloadState: 'error' });
      }
      onProgress?.(done, 0, total);
      renderTrackStatus(track);

      if ((done + failed) % 5 === 0 && (done + failed) < total) {
        await showSwNotif(
          swReg,
          'DJ Mix — Téléchargement en cours',
          `${done + failed} / ${total} morceaux`,
          'djmix-dl-progress',
          true,
        );
      }
    }

    await showSwNotif(
      swReg,
      'DJ Mix — Téléchargement terminé',
      `${done} réussi${done > 1 ? 's' : ''}${failed > 0 ? ` — ${failed} échec${failed > 1 ? 's' : ''}` : ''}`,
      'djmix-dl-done',
      false,
    );
    return { done, failed, total };
  }

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
   * Télécharge les morceaux du fil rouge qui ne sont pas encore en cache
   * et met à jour les mix infos manquantes — deux tâches séquentielles en parallèle.
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

    await requestNotifPermission();
    const swReg = await getSwReg();

    const [dlResult] = await Promise.all([
      _runDownloadTask(toDownload, swReg),
      _runMixInfoTask(toMixInfoOnly),
    ]);

    const { done, total } = dlResult;
    if (total > 0) {
      onProgress?.(done, 0, 0);
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

  return { downloadAll, downloadMissingMixInfo };
}

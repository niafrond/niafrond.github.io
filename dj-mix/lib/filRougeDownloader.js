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
   * Télécharge les morceaux du fil rouge qui ne sont pas encore en cache,
   * un par un en queue séquentielle.
   * @param {object[]} tracks
   */
  async function downloadAll(tracks) {
    const candidates = tracks.filter(t => {
      if (!t?.name || !t?.artist) return false;
      const { downloadState } = getFilRougeTrackStatus(t);
      return downloadState !== 'done' && downloadState !== 'downloading';
    });

    if (!candidates.length) {
      showToast('Tous les morceaux sont déjà téléchargés');
      return;
    }

    const pending = [];
    let alreadyCached = 0;
    for (const track of candidates) {
      const inCache = await isTrackInLocalCache(track).catch(() => false);
      if (inCache) {
        alreadyCached++;
        setFilRougeTrackStatus(track, { downloadState: 'done' });
      } else {
        pending.push(track);
      }
    }
    if (alreadyCached > 0) renderFilRouge();

    if (!pending.length) {
      showToast(`Tous les morceaux sont déjà en cache (${alreadyCached} retrouvé${alreadyCached > 1 ? 's' : ''})`);
      return;
    }

    await requestNotifPermission();
    const swReg = await getSwReg();

    const total = pending.length;
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
          setFilRougeTrackStatus(track, { downloadState: 'done' });
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
    onProgress?.(done, 0, 0);
    showToast(`Téléchargement terminé : ${done}/${total}`);
  }

  return { downloadAll };
}

import { getTrackCacheKey } from './audioSourceManager.js';

const AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1';
const BG_FETCH_ID = 'djmix-filrouge-dl';

/**
 * @param {object} opts
 * @param {() => string} opts.getDownloaderApiUrl
 * @param {() => string} opts.getDownloaderApiToken
 * @param {(item: object) => Promise<boolean>} opts.prefetchTrackToLocalCache
 * @param {(item: object, patch: object) => void} opts.setFilRougeTrackStatus
 * @param {(item: object) => {downloadState: string}} opts.getFilRougeTrackStatus
 * @param {() => void} opts.renderFilRouge
 * @param {(msg: string, isError?: boolean) => void} opts.showToast
 */
export function createFilRougeDownloader({
  getDownloaderApiUrl,
  getDownloaderApiToken,
  prefetchTrackToLocalCache,
  setFilRougeTrackStatus,
  getFilRougeTrackStatus,
  renderFilRouge,
  showToast,
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
   * Télécharge tous les morceaux du fil rouge qui ne sont pas encore en cache.
   * Utilise Background Fetch API si disponible (fonctionne écran éteint),
   * sinon bascule sur un téléchargement séquentiel avec notifications SW.
   * @param {object[]} tracks
   */
  async function downloadAll(tracks) {
    const pending = tracks.filter(t => {
      if (!t?.name || !t?.artist) return false;
      const { downloadState } = getFilRougeTrackStatus(t);
      return downloadState !== 'done' && downloadState !== 'downloading';
    });

    if (!pending.length) {
      showToast('Tous les morceaux sont déjà téléchargés');
      return;
    }

    await requestNotifPermission();
    const swReg = await getSwReg();

    if (swReg && 'backgroundFetch' in swReg) {
      await _downloadWithBackgroundFetch(pending, swReg);
    } else {
      await _downloadSequential(pending, swReg);
    }
  }

  async function _downloadWithBackgroundFetch(tracks, reg) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) {
      showToast('URL API downloader non configurée', true);
      await _downloadSequential(tracks, reg);
      return;
    }
    const token = getDownloaderApiToken?.() || '';

    // Annuler un éventuel BG fetch en cours
    try {
      const existing = await reg.backgroundFetch.get(BG_FETCH_ID);
      if (existing) await existing.abort();
    } catch (_) {}

    const requests = tracks.map(track => {
      const cacheKey = getTrackCacheKey(track);
      const params = new URLSearchParams({ _ck: cacheKey });
      if (token) params.set('token', token);
      return new Request(`${baseUrl}/api/download?${params}`, {
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

    for (const track of tracks) {
      setFilRougeTrackStatus(track, { downloadState: 'downloading' });
    }
    renderFilRouge();

    try {
      await reg.backgroundFetch.fetch(BG_FETCH_ID, requests, {
        title: `DJ Mix — ${tracks.length} morceau${tracks.length > 1 ? 'x' : ''} à télécharger`,
        icons: [{ src: './icon-192.png', sizes: '192x192', type: 'image/png' }],
        downloadTotal: 0,
      });
      showToast(`Téléchargement lancé (${tracks.length} morceaux) — continue en arrière-plan`);
    } catch (err) {
      console.warn('[filRougeDownloader] Background Fetch non disponible, mode séquentiel', err);
      await _downloadSequential(tracks, reg);
    }
  }

  async function _downloadSequential(tracks, swReg) {
    const total = tracks.length;
    let done = 0;
    let failed = 0;

    for (const track of tracks) {
      setFilRougeTrackStatus(track, { downloadState: 'downloading' });
      renderFilRouge();

      try {
        const ok = await prefetchTrackToLocalCache(track);
        if (ok) {
          done++;
          setFilRougeTrackStatus(track, { downloadState: 'done' });
        } else {
          failed++;
          setFilRougeTrackStatus(track, { downloadState: 'error' });
        }
      } catch (_) {
        failed++;
        setFilRougeTrackStatus(track, { downloadState: 'error' });
      }
      renderFilRouge();

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
    showToast(`Téléchargement terminé : ${done}/${total}`);
  }

  return { downloadAll };
}

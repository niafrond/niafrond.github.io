/**
 * androidAutoBridge.js — Pont JS ↔ natif (plugin Capacitor "MediaSession") pour
 * exposer la lecture DJ Mix à Android Auto via MediaBrowserServiceCompat /
 * MediaSessionCompat (voir dj-mix-android/).
 *
 * Sans effet en dehors d'un shell Capacitor natif (PWA / navigateur classique).
 */

function getPlugin() {
  if (!window.Capacitor?.isNativePlatform?.()) return null;
  return window.Capacitor?.Plugins?.MediaSession || null;
}

/**
 * Convertit une URL blob: (artwork d'un fichier local) en data URI base64.
 * Les URLs blob: ne sont résolubles que dans la WebView : le téléchargement
 * natif (HttpURLConnection) ne peut donc pas y accéder directement.
 */
async function resolveArtworkUrl(artworkUrl) {
  const url = String(artworkUrl || '');
  if (!url.startsWith('blob:')) return url;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return '';
  }
}

/** Pousse les métadonnées du morceau en cours vers la session média native. */
export function pushNowPlaying({ id, title, artist, album, artworkUrl, durationMs } = {}) {
  const plugin = getPlugin();
  if (!plugin) return;
  const base = {
    id: String(id || ''),
    title: String(title || 'DJ Mix'),
    artist: String(artist || ''),
    album: String(album || 'DJ Mix'),
    durationMs: Math.max(0, Number(durationMs) || 0),
  };
  resolveArtworkUrl(artworkUrl).then((resolvedArtworkUrl) => {
    plugin.updateMetadata({ ...base, artworkUrl: resolvedArtworkUrl }).catch(() => {});
  });
}

/** Pousse l'état de lecture (lecture/pause, position) vers la session média native. */
export function pushPlaybackState({ playing, positionMs, speed = 1 } = {}) {
  const plugin = getPlugin();
  if (!plugin) return;
  plugin.updatePlaybackState({
    playing: Boolean(playing),
    positionMs: Math.max(0, Number(positionMs) || 0),
    speed: Number(speed) || 1,
  }).catch(() => {});
}

const PUSH_QUEUE_DEBOUNCE_MS = 500;
let pushQueueTimer = null;

/** Pousse la file d'attente (browse tree Android Auto), avec un anti-rebond. */
export function pushQueue(items) {
  const plugin = getPlugin();
  if (!plugin) return;

  if (pushQueueTimer) clearTimeout(pushQueueTimer);
  pushQueueTimer = setTimeout(() => {
    pushQueueTimer = null;
    const mapped = (items || []).map((item) => ({
      id: String(item?.id || ''),
      title: String(item?.name || item?.title || 'DJ Mix'),
      artist: String(item?.artist || ''),
      artworkUrl: String(item?.artUrl || ''),
    }));
    plugin.updateQueue({ items: mapped }).catch(() => {});
  }, PUSH_QUEUE_DEBOUNCE_MS);
}

/**
 * Enregistre un gestionnaire pour les commandes de transport envoyées depuis
 * Android Auto / la notification (play, pause, next, seekTo, playFromMediaId).
 */
export function onMediaCommand(handler) {
  const plugin = getPlugin();
  if (!plugin || typeof handler !== 'function') return;
  plugin.addListener('mediaCommand', (data) => handler(data || {}));
}

/**
 * Récupère une éventuelle commande reçue avant que la WebView soit prête
 * (connexion à froid depuis la voiture, ex. appui sur "Lecture" depuis Android
 * Auto avant que l'application ne soit ouverte). Renvoie `null` s'il n'y en a pas.
 */
export async function getPendingMediaCommand() {
  const plugin = getPlugin();
  if (!plugin?.getPendingCommand) return null;
  try {
    const data = await plugin.getPendingCommand();
    return data?.action ? data : null;
  } catch (_) {
    return null;
  }
}

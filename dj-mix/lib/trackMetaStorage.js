/**
 * trackMetaStorage.js
 *
 * Persistent localStorage cache for per-track metadata (artwork URL, mixData).
 * Keyed by normalised artist+title so the same track reuses the same slot
 * regardless of how it was added to the queue.
 *
 * The cache is intentionally keyed only by name/artist (not by cachePath) so
 * that entries survive server-side re-downloads of the same song.
 *
 * Invalidation:
 *   - Call invalidateStoredTrackMeta() when the /mix endpoint returns 404,
 *     meaning the file was removed from the server cache and any locally stored
 *     analysis data is stale.
 */

const PREFIX = 'dj-mix:track-meta:';

function buildKey(trackName, artistName) {
  const artist = String(artistName || '').trim().toLowerCase();
  const track = String(trackName || '').trim().toLowerCase();
  return `${PREFIX}${artist}::${track}`;
}

/**
 * Read stored metadata for a track.
 * @param {string} trackName
 * @param {string} [artistName]
 * @returns {{ artworkUrl?: string, mixData?: object }|null}
 */
export function getStoredTrackMeta(trackName, artistName) {
  if (!trackName) return null;
  try {
    const raw = localStorage.getItem(buildKey(trackName, artistName));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Merge `patch` into the stored metadata for a track (shallow merge).
 * Creates the entry if it does not exist yet.
 * @param {string} trackName
 * @param {string|undefined} artistName
 * @param {{ artworkUrl?: string, mixData?: object }} patch
 */
export function patchStoredTrackMeta(trackName, artistName, patch) {
  if (!trackName || !patch) return;
  try {
    const existing = getStoredTrackMeta(trackName, artistName) || {};
    localStorage.setItem(buildKey(trackName, artistName), JSON.stringify({ ...existing, ...patch }));
  } catch (_) {
    // localStorage may be full or unavailable – silently ignore
  }
}

/**
 * Remove all stored metadata for a track (e.g. when the server signals the
 * file has been deleted from its cache).
 * @param {string} trackName
 * @param {string} [artistName]
 */
export function invalidateStoredTrackMeta(trackName, artistName) {
  if (!trackName) return;
  try {
    localStorage.removeItem(buildKey(trackName, artistName));
  } catch (_) {}
}

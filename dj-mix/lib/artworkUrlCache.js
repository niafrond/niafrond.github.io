/**
 * artworkUrlCache.js
 *
 * In-memory + localStorage mapping from normalised artist::title keys to
 * remote artwork URLs.  Stored as a single JSON object so all entries can
 * be read in one localStorage.getItem() call on init, rather than one call
 * per track.
 *
 * The cache is write-through: writes go to memory immediately and are
 * flushed to localStorage after a short debounce to batch rapid updates.
 */

const STORAGE_KEY = 'dj-mix:artwork-urls';

function _normalize(name, artist) {
  const a = String(artist || '').trim().toLowerCase();
  const n = String(name || '').trim().toLowerCase();
  return `${a}::${n}`;
}

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

const _cache = _load();
let _timer = null;

function _scheduleSave() {
  clearTimeout(_timer);
  _timer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
    } catch (_) {}
  }, 400);
}

/**
 * Return the cached artwork URL for a track, or null if not found.
 * @param {string} name
 * @param {string} [artist]
 * @returns {string|null}
 */
export function getArtworkUrl(name, artist) {
  if (!name) return null;
  return _cache[_normalize(name, artist)] ?? null;
}

/**
 * Store an artwork URL for a track.  No-ops if the value is unchanged.
 * @param {string} name
 * @param {string|undefined} artist
 * @param {string} url  Remote artwork URL (https://…)
 */
export function setArtworkUrl(name, artist, url) {
  if (!name || !url) return;
  const k = _normalize(name, artist);
  if (_cache[k] === url) return;
  _cache[k] = url;
  _scheduleSave();
}

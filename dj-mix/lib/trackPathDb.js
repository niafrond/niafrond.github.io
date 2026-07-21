import { createLogger } from './logger.js';

const logger = createLogger('track-path-db');

const SAVE_DEBOUNCE_MS = 400;

/**
 * Minimal local key -> cachePath map, persisted to localStorage. Deliberately
 * stores nothing but paths (no track metadata) so lookups/writes stay O(1)
 * and cheap even as the server library grows into the thousands of tracks.
 */
export function createTrackPathDb({ storageKey, storage } = {}) {
  if (!storageKey) throw new Error('createTrackPathDb: storageKey required');
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);

  let paths = loadFromStorage();
  let saveTimer = null;

  function loadFromStorage() {
    if (!store) return {};
    try {
      const raw = store.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function scheduleSave() {
    if (!store) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        store.setItem(storageKey, JSON.stringify(paths));
      } catch (err) {
        logger.warn('save.failed', { message: err?.message });
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function get(key) {
    if (!key) return '';
    return paths[key] || '';
  }

  function set(key, cachePath) {
    if (!key || !cachePath) return;
    if (paths[key] === cachePath) return;
    paths[key] = cachePath;
    scheduleSave();
  }

  function clear() {
    paths = {};
    scheduleSave();
  }

  function size() {
    return Object.keys(paths).length;
  }

  return { get, set, clear, size };
}

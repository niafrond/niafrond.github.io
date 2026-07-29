// Persistent key -> Blob store backed by IndexedDB. Used for downloaded audio
// and artwork bytes (SPEC-13.1.4 / 13.3.9). Deliberately IndexedDB rather than
// the Cache Storage API: `window.caches` only exists in secure contexts
// (HTTPS, or `localhost`/`127.0.0.1` specifically) — it is silently absent
// when the app is accessed over a plain-HTTP LAN IP (e.g. from a phone on the
// same network), which is this app's real deployment mode. `indexedDB` has no
// such restriction and is already relied on the same way by
// downloadBatchStore.js in this same insecure-context deployment.
//
// Errors are always silent (mirrors downloadBatchStore.js / mix-blind-test's
// stem-client.js convention): a failed IDB operation resolves to a safe
// empty/null value instead of rejecting, so callers never need try/catch.

const STORE_NAMES = ['audio', 'artwork'];

export function createBlobStore({
  dbName = 'dj-mix-blobs',
  dbVersion = 1,
  indexedDBImpl,
} = {}) {
  // `undefined` (param omitted) falls back to the global; an explicit `null`
  // forces "unavailable" (used by tests to simulate the insecure-context-like
  // absence without touching the global `indexedDB`).
  const idb = indexedDBImpl !== undefined ? indexedDBImpl : (typeof indexedDB !== 'undefined' ? indexedDB : null);

  function openDb() {
    if (!idb) return Promise.resolve(null);
    return new Promise((resolve) => {
      const req = idb.open(dbName, dbVersion);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function getBlob(kind, key) {
    if (!idb || !key) return null;
    try {
      const db = await openDb();
      if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction(kind, 'readonly');
        const req = tx.objectStore(kind).get(key);
        req.onsuccess = () => {
          const blob = req.result;
          db.close();
          resolve(blob && blob.size > 0 ? blob : null);
        };
        req.onerror = () => { db.close(); resolve(null); };
      });
    } catch (_) {
      return null;
    }
  }

  async function putBlob(kind, key, blob) {
    if (!idb || !key || !blob || blob.size <= 0) return false;
    try {
      const db = await openDb();
      if (!db) return false;
      return await new Promise((resolve) => {
        const tx = db.transaction(kind, 'readwrite');
        tx.objectStore(kind).put(blob, key);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
      });
    } catch (_) {
      return false;
    }
  }

  async function deleteBlob(kind, key) {
    if (!idb || !key) return false;
    try {
      const db = await openDb();
      if (!db) return false;
      return await new Promise((resolve) => {
        const tx = db.transaction(kind, 'readwrite');
        tx.objectStore(kind).delete(key);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
      });
    } catch (_) {
      return false;
    }
  }

  async function clearKind(kind) {
    if (!idb) return false;
    try {
      const db = await openDb();
      if (!db) return false;
      return await new Promise((resolve) => {
        const tx = db.transaction(kind, 'readwrite');
        tx.objectStore(kind).clear();
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
      });
    } catch (_) {
      return false;
    }
  }

  async function clearAll() {
    const results = await Promise.all(STORE_NAMES.map((name) => clearKind(name)));
    return results.every(Boolean);
  }

  return {
    getBlob,
    putBlob,
    deleteBlob,
    clearKind,
    clearAll,
  };
}

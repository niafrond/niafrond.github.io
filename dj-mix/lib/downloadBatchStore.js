// Errors are always silent (mirrors mix-blind-test/stem-client.js's convention,
// SPEC-17.2.4): a failed IDB operation resolves to a safe empty/null value
// instead of rejecting, so callers never need try/catch.

export function createDownloadBatchStore({
  dbName = 'dj-mix-downloads',
  dbVersion = 1,
  indexedDBImpl,
} = {}) {
  const idb = indexedDBImpl || (typeof indexedDB !== 'undefined' ? indexedDB : null);

  function openDb() {
    if (!idb) return Promise.resolve(null);
    return new Promise((resolve) => {
      const req = idb.open(dbName, dbVersion);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('batches')) {
          db.createObjectStore('batches', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('items')) {
          const items = db.createObjectStore('items', { keyPath: 'id' });
          items.createIndex('batchId', 'batchId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function createBatch({ batch, items }) {
    if (!idb) return null;
    try {
      const db = await openDb();
      if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction(['batches', 'items'], 'readwrite');
        tx.objectStore('batches').put(batch);
        for (const item of items) tx.objectStore('items').put(item);
        tx.oncomplete = () => { db.close(); resolve({ batch, items }); };
        tx.onerror = () => { db.close(); resolve(null); };
      });
    } catch (_) {
      return null;
    }
  }

  async function getBatch(batchId) {
    if (!idb) return null;
    try {
      const db = await openDb();
      if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction('batches', 'readonly');
        const req = tx.objectStore('batches').get(batchId);
        req.onsuccess = () => { db.close(); resolve(req.result || null); };
        req.onerror = () => { db.close(); resolve(null); };
      });
    } catch (_) {
      return null;
    }
  }

  async function getItem(itemId) {
    if (!idb) return null;
    try {
      const db = await openDb();
      if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction('items', 'readonly');
        const req = tx.objectStore('items').get(itemId);
        req.onsuccess = () => { db.close(); resolve(req.result || null); };
        req.onerror = () => { db.close(); resolve(null); };
      });
    } catch (_) {
      return null;
    }
  }

  async function updateBatch(batchId, patch) {
    if (!idb) return null;
    try {
      const db = await openDb();
      if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction('batches', 'readwrite');
        const store = tx.objectStore('batches');
        const req = store.get(batchId);
        req.onsuccess = () => {
          const existing = req.result;
          if (!existing) { db.close(); resolve(null); return; }
          const merged = { ...existing, ...patch };
          store.put(merged);
          tx.oncomplete = () => { db.close(); resolve(merged); };
        };
        req.onerror = () => { db.close(); resolve(null); };
        tx.onerror = () => { db.close(); resolve(null); };
      });
    } catch (_) {
      return null;
    }
  }

  // `patch` may be a plain object or a `(existing) => patch` updater — the
  // latter lets callers derive a new value (e.g. incrementing `retries`)
  // from the current row without a separate read.
  async function updateItem(itemId, patch) {
    if (!idb) return null;
    try {
      const db = await openDb();
      if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction('items', 'readwrite');
        const store = tx.objectStore('items');
        const req = store.get(itemId);
        req.onsuccess = () => {
          const existing = req.result;
          if (!existing) { db.close(); resolve(null); return; }
          const resolvedPatch = typeof patch === 'function' ? patch(existing) : patch;
          const merged = { ...existing, ...resolvedPatch };
          store.put(merged);
          tx.oncomplete = () => { db.close(); resolve(merged); };
        };
        req.onerror = () => { db.close(); resolve(null); };
        tx.onerror = () => { db.close(); resolve(null); };
      });
    } catch (_) {
      return null;
    }
  }

  async function updateItems(itemIds, patch) {
    if (!idb || !itemIds?.length) return 0;
    try {
      const db = await openDb();
      if (!db) return 0;
      return await new Promise((resolve) => {
        const tx = db.transaction('items', 'readwrite');
        const store = tx.objectStore('items');
        let updated = 0;
        for (const itemId of itemIds) {
          const req = store.get(itemId);
          req.onsuccess = () => {
            const existing = req.result;
            if (existing) {
              store.put({ ...existing, ...patch });
              updated++;
            }
          };
        }
        tx.oncomplete = () => { db.close(); resolve(updated); };
        tx.onerror = () => { db.close(); resolve(updated); };
      });
    } catch (_) {
      return 0;
    }
  }

  async function listItems(batchId) {
    if (!idb) return [];
    try {
      const db = await openDb();
      if (!db) return [];
      return await new Promise((resolve) => {
        const tx = db.transaction('items', 'readonly');
        const req = tx.objectStore('items').index('batchId').getAll(batchId);
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); resolve([]); };
      });
    } catch (_) {
      return [];
    }
  }

  async function listIncompleteBatches() {
    if (!idb) return [];
    try {
      const db = await openDb();
      if (!db) return [];
      return await new Promise((resolve) => {
        const tx = db.transaction('batches', 'readonly');
        const req = tx.objectStore('batches').getAll();
        req.onsuccess = () => {
          db.close();
          resolve((req.result || []).filter((b) => b.status !== 'completed'));
        };
        req.onerror = () => { db.close(); resolve([]); };
      });
    } catch (_) {
      return [];
    }
  }

  async function deleteBatch(batchId) {
    if (!idb) return false;
    try {
      const db = await openDb();
      if (!db) return false;
      return await new Promise((resolve) => {
        const tx = db.transaction(['batches', 'items'], 'readwrite');
        tx.objectStore('batches').delete(batchId);
        const cursorReq = tx.objectStore('items').index('batchId').openCursor(batchId);
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
      });
    } catch (_) {
      return false;
    }
  }

  async function pruneOldBatches({
    olderThanMs = 7 * 24 * 60 * 60 * 1000,
    eligibleStatuses = ['completed', 'failed'],
  } = {}) {
    if (!idb) return 0;
    try {
      const db = await openDb();
      if (!db) return 0;
      const cutoff = Date.now() - olderThanMs;
      const allBatches = await new Promise((resolve) => {
        const tx = db.transaction('batches', 'readonly');
        const req = tx.objectStore('batches').getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); resolve([]); };
      });
      const toDelete = allBatches.filter(
        (b) => eligibleStatuses.includes(b.status) && (b.createdAt || 0) < cutoff
      );
      for (const b of toDelete) {
        await deleteBatch(b.id);
      }
      return toDelete.length;
    } catch (_) {
      return 0;
    }
  }

  return {
    createBatch,
    updateBatch,
    updateItem,
    updateItems,
    getBatch,
    getItem,
    listItems,
    listIncompleteBatches,
    deleteBatch,
    pruneOldBatches,
  };
}

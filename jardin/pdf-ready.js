// PDF prêt « hors fenêtre » : le fichier généré en arrière-plan est gardé (IndexedDB, repli mémoire) jusqu'à ce que
// l'utilisateur le télécharge en revenant dans l'app. Un événement `jardin-pdf` informe l'interface (bandeau).
const DB = 'jardin-pdf'; const STORE = 'ready'; const KEY = 'last';
let memory = null;

function open(idb) {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function withStore(mode, fn, idb = globalThis.indexedDB) {
  if (!idb) throw new Error('pas d’IndexedDB');
  const db = await open(idb);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode); const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

/** Garde le PDF prêt : {filename, bytes:Uint8Array|ArrayBuffer, name?:string}. → {filename, size, at} */
export async function saveReady({ filename, bytes, name = '' }, opts = {}) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const rec = { filename, name, size: blob.size, at: Date.now(), blob };
  memory = rec;
  try { await withStore('readwrite', (s) => s.put(rec, KEY), opts.idb); } catch { /* repli mémoire */ }
  return { filename, size: rec.size, at: rec.at };
}
/** Dernier PDF prêt (ou null) : {filename, name, size, at, blob}. */
export async function loadReady(opts = {}) {
  try { const r = await withStore('readonly', (s) => s.get(KEY), opts.idb); if (r) return r; } catch { /* repli mémoire */ }
  return memory;
}
export async function clearReady(opts = {}) {
  memory = null;
  try { await withStore('readwrite', (s) => s.delete(KEY), opts.idb); } catch { /* ignoré */ }
}

/** Diffuse l'état de la génération : {type:'running'|'progress'|'ready'|'error'|'cleared', label?, pct?, filename?, message?}. */
export function emitPdf(detail) {
  try { globalThis.dispatchEvent(new CustomEvent('jardin-pdf', { detail })); } catch { /* ignoré */ }
}

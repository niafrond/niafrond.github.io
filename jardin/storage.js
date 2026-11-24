// Stockage local des jardins et réglages : backend injectable (IndexedDB, repli mémoire).
import { createGarden, newId } from './model.js';

const FORMAT = 'jardin-v1';
const STORE_GARDENS = 'gardens';
const STORE_SETTINGS = 'settings';

/** Réglages par défaut. */
export function defaultSettings() {
  return {
    notifications: { enabled: false, hour: 19, minute: 0, frost: true, heat: true, monthlyTasks: true, vacationUntil: null },
    units: 'metric',
    apiCache: {},
  };
}

const copie = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/**
 * Backend mémoire. Interface d'un backend : getAll(store), get(store, key), put(store, key, value), delete(store, key),
 * toutes asynchrones. Les valeurs sont copiées pour éviter tout partage de référence.
 */
export function createMemoryBackend() {
  const stores = { [STORE_GARDENS]: new Map(), [STORE_SETTINGS]: new Map() };
  return {
    async getAll(store) { return [...stores[store].values()].map(copie); },
    async get(store, key) { return copie(stores[store].get(key)); },
    async put(store, key, value) { stores[store].set(key, copie(value)); },
    async delete(store, key) { stores[store].delete(key); },
  };
}

/** Backend IndexedDB (ouverture paresseuse). `idb` = fabrique IndexedDB (injectable pour les tests). */
export function createIndexedDbBackend(idb = globalThis.indexedDB, name = 'jardin') {
  let dbPromise = null;
  const ouvrir = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = idb.open(name, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_GARDENS)) db.createObjectStore(STORE_GARDENS);
          if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  };
  const exec = async (store, mode, fn) => {
    const db = await ouvrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    getAll: (store) => exec(store, 'readonly', (s) => s.getAll()),
    get: (store, key) => exec(store, 'readonly', (s) => s.get(key)),
    put: (store, key, value) => exec(store, 'readwrite', (s) => s.put(copie(value), key)),
    delete: (store, key) => exec(store, 'readwrite', (s) => s.delete(key)),
  };
}

function backendParDefaut() {
  if (typeof indexedDB !== 'undefined' && indexedDB) {
    try { return createIndexedDbBackend(indexedDB); } catch (e) { /* repli mémoire */ }
  }
  return createMemoryBackend();
}

function fusion(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return base;
  const r = { ...base };
  for (const k of Object.keys(extra)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
      && extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k])) {
      r[k] = fusion(base[k], extra[k]);
    } else {
      r[k] = extra[k];
    }
  }
  return r;
}

/** Complète un jardin importé avec les valeurs par défaut du modèle. */
function normaliser(brut) {
  const base = createGarden(brut.name || 'Jardin importé');
  const g = fusion(base, brut);
  g.context = fusion(base.context, brut.context);
  g.sun = fusion(base.sun, brut.sun);
  g.plan = fusion(base.plan, brut.plan);
  return g;
}

/** Crée une instance de stockage (API asynchrone) sur un backend donné. */
export function createStorage(backend = backendParDefaut()) {
  const api = {
    /** Jardins triés du plus récemment modifié au plus ancien. */
    async listGardens() {
      const all = await backend.getAll(STORE_GARDENS);
      return all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },
    async getGarden(id) {
      return (await backend.get(STORE_GARDENS, id)) || null;
    },
    /** Enregistre le jardin (met à jour `updatedAt` sur l'objet passé) et le retourne. */
    async saveGarden(g) {
      if (!g || !g.id) throw new Error('Jardin invalide : identifiant manquant.');
      g.updatedAt = new Date().toISOString();
      await backend.put(STORE_GARDENS, g.id, g);
      return g;
    },
    async deleteGarden(id) {
      await backend.delete(STORE_GARDENS, id);
    },
    /** Copie « variante » : nouvel id, brouillon, plan à regénérer. */
    async duplicateGarden(id) {
      const src = await api.getGarden(id);
      if (!src) return null;
      const now = new Date().toISOString();
      const copieJ = { ...src, id: newId('g_'), name: `${src.name} (variante)`, createdAt: now, updatedAt: now, status: 'draft', plan: { svg: null, validatedAt: null }, tasksDone: {} };
      await backend.put(STORE_GARDENS, copieJ.id, copieJ);
      return copieJ;
    },
    /** Sérialise un jardin : JSON `{format:'jardin-v1', garden}`. */
    exportGarden(g) {
      return JSON.stringify({ format: FORMAT, garden: g }, null, 2);
    },
    /** Valide et importe un JSON exporté : nouvel id, enregistré et retourné. Lève une Error en français. */
    async importGarden(json) {
      let data;
      try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { throw new Error("Fichier illisible : ce n'est pas du JSON valide."); }
      if (!data || data.format !== FORMAT || !data.garden || typeof data.garden !== 'object') {
        throw new Error("Fichier non reconnu : format « jardin-v1 » attendu.");
      }
      const brut = data.garden;
      if (!Array.isArray(brut.boundary) || !Array.isArray(brut.zones ?? [])) {
        throw new Error('Jardin invalide : contour ou zones manquants.');
      }
      const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
      if (!brut.boundary.every(ok)) throw new Error('Jardin invalide : points du contour incorrects.');
      const g = normaliser(brut);
      const now = new Date().toISOString();
      g.id = newId('g_');
      g.updatedAt = now;
      await backend.put(STORE_GARDENS, g.id, g);
      return g;
    },
    async getSettings() {
      const s = await backend.get(STORE_SETTINGS, 'main');
      return fusion(defaultSettings(), s || {});
    },
    async saveSettings(s) {
      const complet = fusion(defaultSettings(), s || {});
      await backend.put(STORE_SETTINGS, 'main', complet);
      return complet;
    },
  };
  return api;
}

/** Instance partagée (IndexedDB si disponible, sinon mémoire). */
export const storage = createStorage();
export default storage;

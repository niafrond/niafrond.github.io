/**
 * trackStore.js — Registre partagé des morceaux.
 *
 * Auparavant, la Queue (`lib/queueManager.js`) et le Fil Rouge
 * (`lib/filRougeManager.js`) construisaient chacun leur propre copie d'un
 * morceau et la persistaient dans leur propre clé localStorage. Le même
 * morceau présent dans les deux listes finissait par exister comme deux
 * objets JS totalement indépendants : une mise à jour d'un côté (artwork,
 * cachePath, stems, bpm/genre...) n'était jamais visible de l'autre.
 *
 * Le trackStore résout ça en devenant la source unique de vérité : un seul
 * enregistrement JS par morceau (identifié par `getTrackCacheKey`), partagé
 * par référence entre toutes les listes qui l'utilisent, et persisté une
 * seule fois sous la clé `dj-mix:tracks`.
 *
 * Voir SPECS.md §2.6.
 */

import { createLogger } from './logger.js';
import { STORAGE_KEYS } from './storageKeys.js';
import { getTrackCacheKey } from './audioSourceManager.js';

const logger = createLogger('trackStore');

// Champs intrinsèques au morceau : partagés entre Queue et Fil Rouge, persistés.
const TRACK_FIELDS = [
  'id', 'uri', 'name', 'artist', 'artUrl', 'duration', 'bpm', 'genre',
  'loudnessDb', 'audioFeatures', 'cachePath', 'ratingKey', 'persistedSourceUrl',
  'stemsStatus', 'stems', 'danceability', 'year',
  'djTrackId', 'djHasAnalysis', 'djTransition', 'djIsIconic',
];

const STEMS_SUB_FIELDS = ['vocalsUrl', 'instrumentalUrl', 'echoUrl', 'distortionUrl'];

function runtimeDefaults() {
  return {
    sourceState: 'idle',
    sourceError: null,
    sourceMeta: null,
    localBlobUrl: null,
    localStemUrls: null,
    lastTouchedAt: Date.now(),
  };
}

function isDeadPersistedArtUrl(value) {
  if (typeof value !== 'string') return false;
  // blob: is a per-document URL, revoked on unload (see below). A bare
  // `/api/artwork?cachePath=...` (SPEC-13.3.9) is the CDN-relative reference
  // as returned by the backend, before being prefixed with the CDN base URL —
  // some call sites persisted it unresolved; left as-is it resolves against
  // this app's own origin on next load and 404s, so treat it as dead too.
  return value.startsWith('blob:') || value.startsWith('/api/artwork');
}

function isFilled(value) {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean') return value === true;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function resolveId(raw) {
  return getTrackCacheKey(raw) || String(raw?.name || raw?.title || '').trim();
}

function mergeStems(existingStems, incomingStems) {
  if (!incomingStems || typeof incomingStems !== 'object') return existingStems || null;
  const merged = { ...(existingStems || {}) };
  for (const field of STEMS_SUB_FIELDS) {
    if (isFilled(incomingStems[field])) merged[field] = incomingStems[field];
  }
  return merged;
}

function createRecordFrom(raw, id) {
  const record = {
    id,
    uri: raw?.uri || '',
    name: raw?.name || raw?.title || '',
    artist: raw?.artist || '',
    artUrl: raw?.artUrl || '',
    duration: Number(raw?.duration) || 0,
    bpm: raw?.bpm ?? null,
    genre: raw?.genre || '',
    loudnessDb: Number.isFinite(Number(raw?.loudnessDb)) ? Number(raw.loudnessDb) : null,
    audioFeatures: raw?.audioFeatures || null,
    cachePath: raw?.cachePath || '',
    ratingKey: raw?.ratingKey || '',
    persistedSourceUrl: raw?.persistedSourceUrl || '',
    stemsStatus: raw?.stemsStatus || '',
    stems: mergeStems(null, raw?.stems),
    danceability: raw?.danceability ?? null,
    year: raw?.year ?? null,
    djTrackId: raw?.djTrackId ?? null,
    djHasAnalysis: Boolean(raw?.djHasAnalysis),
    djTransition: raw?.djTransition ?? null,
    djIsIconic: Boolean(raw?.djIsIconic),
  };
  Object.assign(record, runtimeDefaults());
  return record;
}

function mergeInto(existing, raw) {
  for (const field of TRACK_FIELDS) {
    if (field === 'id' || field === 'stems') continue;
    if (isFilled(raw?.[field])) existing[field] = raw[field];
  }
  if (raw?.stems) existing.stems = mergeStems(existing.stems, raw.stems);
  existing.lastTouchedAt = Date.now();
  return existing;
}

export function createTrackStore() {
  /** @type {Map<string, object>} */
  const records = new Map();

  let _saveTimer = null;
  function scheduleSave() {
    if (_saveTimer !== null) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      save();
    }, 400);
  }

  function save() {
    if (_saveTimer !== null) { clearTimeout(_saveTimer); _saveTimer = null; }
    try {
      const serialized = {};
      for (const [id, record] of records) {
        const picked = {};
        for (const field of TRACK_FIELDS) {
          // blob: URLs are revoked when the document that created them
          // unloads, so persisting one just bricks the artwork on next
          // launch (truthy but dead) instead of letting it re-resolve from
          // the artwork cache/CDN. Drop it; the remote URL gets re-fetched.
          picked[field] = field === 'artUrl' && isDeadPersistedArtUrl(record.artUrl)
            ? ''
            : record[field];
        }
        serialized[id] = picked;
      }
      localStorage.setItem(STORAGE_KEYS.tracks, JSON.stringify(serialized));
      logger.debug('trackStore.save.success', { size: records.size });
    } catch (_) {
      logger.warn('trackStore.save.failed');
    }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.tracks);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      records.clear();
      for (const [id, data] of Object.entries(parsed)) {
        // Defensive cleanup for data persisted before the save()-side guard
        // above existed: any blob: artUrl already sitting in localStorage is
        // guaranteed stale (previous-session document), so clear it here too.
        if (isDeadPersistedArtUrl(data?.artUrl)) data.artUrl = '';
        records.set(id, createRecordFrom(data, id));
      }
      logger.info('trackStore.restore.success', { size: records.size });
    } catch (_) {
      logger.warn('trackStore.restore.failed');
    }
  }

  /**
   * Résout (ou crée) l'enregistrement partagé pour ce morceau et retourne la
   * référence canonique — c'est le SEUL point d'entrée pour obtenir un objet
   * morceau à insérer dans une liste (Queue ou Fil Rouge).
   * @param {object} raw
   * @returns {object}
   */
  function getOrCreate(raw) {
    if (!raw) return raw;
    const id = resolveId(raw);
    if (!id) return raw;
    const existing = records.get(id);
    if (existing) {
      mergeInto(existing, raw);
      scheduleSave();
      return existing;
    }
    const record = createRecordFrom(raw, id);
    records.set(id, record);
    scheduleSave();
    return record;
  }

  /**
   * Applique un correctif de champs sur un enregistrement existant.
   * @param {string} id
   * @param {object} fields
   * @returns {boolean} true si l'enregistrement existait
   */
  function patch(id, fields) {
    const record = records.get(id);
    if (!record) return false;
    if (fields && Object.prototype.hasOwnProperty.call(fields, 'stems')) {
      record.stems = mergeStems(record.stems, fields.stems);
      const { stems, ...rest } = fields;
      Object.assign(record, rest);
    } else {
      Object.assign(record, fields);
    }
    scheduleSave();
    return true;
  }

  function get(id) {
    return records.get(id) || null;
  }

  function has(id) {
    return records.has(id);
  }

  /**
   * Retire du store tout enregistrement dont l'id n'est pas dans `referencedIds`
   * (utilisé pour éviter une croissance illimitée de `dj-mix:tracks`).
   * @param {Iterable<string>} referencedIds
   * @returns {number} nombre d'enregistrements retirés
   */
  function pruneUnreferenced(referencedIds) {
    const keep = referencedIds instanceof Set ? referencedIds : new Set(referencedIds);
    let removed = 0;
    for (const id of records.keys()) {
      if (!keep.has(id)) {
        records.delete(id);
        removed += 1;
      }
    }
    if (removed > 0) scheduleSave();
    return removed;
  }

  function size() {
    return records.size;
  }

  return {
    getOrCreate,
    patch,
    get,
    has,
    pruneUnreferenced,
    size,
    save,
    restore,
  };
}

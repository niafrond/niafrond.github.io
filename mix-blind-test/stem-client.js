import { DEFAULT_DOWNLOADER_API_URL, STORAGE_KEYS } from '../dj-mix/lib/storageKeys.js';
import { appendApiToken } from '../dj-mix/lib/downloaderConfig.js';
import { pruneStemCacheEntries, isServerTracksCacheFresh } from './game-logic.js';

const MIX_API_URL_KEY = 'mix-blind-test:api-url';
const META_KEY = 'mix-blind-test:stem-cache-meta';
const SERVER_TRACKS_CACHE_KEY = 'mix-blind-test:server-tracks-cache';
const SERVER_TRACKS_CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_NAME = 'mix-blind-test:stems:v1';
const CACHE_ORIGIN = 'https://mix-blind-test.local';
const IDB_NAME = 'mix-blind-test-stems';
const IDB_STORE = 'stems';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeApiUrl(value) {
  return normalizeText(value).replace(/\/+$/, '');
}

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

export class StemClient {
  /**
   * @param {object} [options]
   * @param {number} [options.maxBytes]
   * @param {number} [options.maxEntries]
   * @param {Function} [options.getDownloaderApiUrl] — injecté par dj-mix/lib/downloaderConfig.js
   *   (createDownloaderConfigManager). Sans injection, retombe sur l'ancien comportement
   *   autonome (localStorage direct) pour rester testable/instanciable seul.
   * @param {Function} [options.getDownloaderApiToken]
   * @param {object} [options.apiHealthMonitor] — dj-mix/lib/apiHealthMonitor.js (recordSuccess/recordFailure/isOffline)
   */
  constructor({ maxBytes, maxEntries, getDownloaderApiUrl, getDownloaderApiToken, apiHealthMonitor } = {}) {
    this._getDownloaderApiUrl = getDownloaderApiUrl || (() => {
      const stored = localStorage.getItem(MIX_API_URL_KEY) || localStorage.getItem(STORAGE_KEYS.downloaderApiUrl);
      return normalizeApiUrl(stored || DEFAULT_DOWNLOADER_API_URL);
    });
    this._getDownloaderApiToken = getDownloaderApiToken || (() => '');
    this._apiHealthMonitor = apiHealthMonitor || null;
    this.maxBytes = Number(maxBytes) || 180 * 1024 * 1024;
    this.maxEntries = Number(maxEntries) || 24;
    this.maxObjectUrls = 6;
    this.objectUrls = new Map();
    this.objectUrlOrder = [];
  }

  getApiUrl() {
    return this._getDownloaderApiUrl();
  }

  /** @deprecated conservé pour compat — préférer createDownloaderConfigManager (dj-mix/lib/downloaderConfig.js). */
  setApiUrl(url) {
    localStorage.setItem(MIX_API_URL_KEY, normalizeApiUrl(url));
  }

  _apiUrl() {
    return normalizeApiUrl(this._getDownloaderApiUrl());
  }

  _appendToken(url) {
    return appendApiToken(url, this._getDownloaderApiToken());
  }

  trackIdentifier(track) {
    const cachePath = normalizeText(track?.cachePath);
    if (cachePath) return cachePath;
    const name = normalizeText(track?.name);
    const artist = normalizeText(track?.artist);
    if (!name) return '';
    return `${name}::${artist}`;
  }

  stemKey(track, variant) {
    const id = this.trackIdentifier(track);
    if (!id || !variant) return '';
    return `${id}::${variant}`;
  }

  cacheRequest(stemKey) {
    return new Request(`${CACHE_ORIGIN}/stems/${encodeURIComponent(stemKey)}`);
  }

  readMeta() {
    const parsed = safeJsonParse(localStorage.getItem(META_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
  }

  writeMeta(entries) {
    localStorage.setItem(META_KEY, JSON.stringify(entries));
  }

  touchMeta(stemKey, size) {
    const entries = this.readMeta().filter((entry) => entry?.key !== stemKey);
    entries.push({ key: stemKey, size: Math.max(0, Number(size) || 0), lastUsedAt: Date.now() });
    this.writeMeta(entries);
  }

  dropObjectUrl(stemKey) {
    const active = this.objectUrls.get(stemKey);
    if (!active) return;
    URL.revokeObjectURL(active);
    this.objectUrls.delete(stemKey);
    this.objectUrlOrder = this.objectUrlOrder.filter((key) => key !== stemKey);
  }

  rememberObjectUrl(stemKey, objectUrl) {
    this.dropObjectUrl(stemKey);
    this.objectUrls.set(stemKey, objectUrl);
    this.objectUrlOrder.push(stemKey);
    while (this.objectUrlOrder.length > this.maxObjectUrls) {
      const toDrop = this.objectUrlOrder.shift();
      if (!toDrop) break;
      this.dropObjectUrl(toDrop);
    }
  }

  async openIdb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async readBlobFromIdb(stemKey) {
    if (typeof indexedDB === 'undefined') return null;
    try {
      const db = await this.openIdb();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(stemKey);
        req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
        req.onerror = () => { db.close(); resolve(null); };
      });
    } catch (_) {
      return null;
    }
  }

  async writeBlobToIdb(stemKey, blob) {
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await this.openIdb();
      await new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(blob, stemKey);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      });
    } catch (_) { /* ignore write errors */ }
  }

  async deleteBlobFromIdb(stemKey) {
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await this.openIdb();
      await new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(stemKey);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      });
    } catch (_) { /* ignore delete errors */ }
  }

  async pruneCache() {
    const { kept, evicted } = pruneStemCacheEntries(this.readMeta(), {
      maxBytes: this.maxBytes,
      maxEntries: this.maxEntries,
    });

    const cache = ('caches' in globalThis) ? await caches.open(CACHE_NAME) : null;
    for (const entry of evicted) {
      await this.deleteBlobFromIdb(entry.key);
      if (cache) await cache.delete(this.cacheRequest(entry.key));
      this.dropObjectUrl(entry.key);
    }

    this.writeMeta(kept);
  }

  async getCachedStemObjectUrl(track, variant) {
    const stemKey = this.stemKey(track, variant);
    if (!stemKey) return '';

    const active = this.objectUrls.get(stemKey);
    if (active) {
      this.touchMeta(stemKey, this.readMeta().find((entry) => entry?.key === stemKey)?.size || 0);
      return active;
    }

    const idbBlob = await this.readBlobFromIdb(stemKey);
    if (idbBlob && idbBlob.size > 0) {
      const objectUrl = URL.createObjectURL(idbBlob);
      this.rememberObjectUrl(stemKey, objectUrl);
      this.touchMeta(stemKey, idbBlob.size);
      return objectUrl;
    }

    if (!('caches' in globalThis)) return '';
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(this.cacheRequest(stemKey));
    if (!match) return '';
    const blob = await match.blob();
    if (!blob || blob.size <= 0) return '';

    const objectUrl = URL.createObjectURL(blob);
    this.rememberObjectUrl(stemKey, objectUrl);
    this.touchMeta(stemKey, blob.size);
    return objectUrl;
  }

  async saveStemBlob(track, variant, blob) {
    const stemKey = this.stemKey(track, variant);
    if (!stemKey || !blob || blob.size <= 0) return '';

    await this.writeBlobToIdb(stemKey, blob);

    if ('caches' in globalThis) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(this.cacheRequest(stemKey), new Response(blob, {
        headers: { 'content-type': blob.type || 'audio/mpeg' },
      }));
    }

    this.touchMeta(stemKey, blob.size);
    await this.pruneCache();

    const objectUrl = URL.createObjectURL(blob);
    this.rememberObjectUrl(stemKey, objectUrl);
    return objectUrl;
  }

  buildTrackParams(track) {
    const params = new URLSearchParams();
    if (normalizeText(track?.cachePath)) {
      params.set('cachePath', normalizeText(track.cachePath));
      return params;
    }
    if (!normalizeText(track?.name)) return params;
    params.set('trackName', normalizeText(track.name));
    if (normalizeText(track?.artist)) params.set('artistName', normalizeText(track.artist));
    return params;
  }

  async fetchStemsStatus(track) {
    const params = this.buildTrackParams(track);
    const apiUrl = this._apiUrl();
    if (!params.toString() || !apiUrl) return null;
    try {
      const response = await fetch(this._appendToken(`${apiUrl}/api/stems?${params}`), {
        headers: { Accept: 'application/json' },
        signal: createTimeoutSignal(9000),
      });
      if (response.status === 404) return null;
      if (!response.ok) { this._apiHealthMonitor?.recordFailure(); return null; }
      this._apiHealthMonitor?.recordSuccess();
      return await response.json();
    } catch (_) {
      this._apiHealthMonitor?.recordFailure();
      return null;
    }
  }

  async triggerStemGeneration(track) {
    const params = this.buildTrackParams(track);
    const apiUrl = this._apiUrl();
    if (!params.toString() || !apiUrl) return false;

    const payload = Object.fromEntries(params.entries());
    try {
      const response = await fetch(this._appendToken(`${apiUrl}/api/stems`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: createTimeoutSignal(10000),
      });
      const ok = response.ok || response.status === 409;
      if (ok) this._apiHealthMonitor?.recordSuccess();
      else this._apiHealthMonitor?.recordFailure();
      return ok;
    } catch (_) {
      this._apiHealthMonitor?.recordFailure();
      return false;
    }
  }

  async downloadStem(track, variant) {
    const params = this.buildTrackParams(track);
    const apiUrl = this._apiUrl();
    if (!params.toString() || !apiUrl) throw new Error('Chanson non identifiable pour les stems');

    params.set('stem', variant);
    const response = await fetch(this._appendToken(`${apiUrl}/api/stems/download?${params}`), {
      signal: createTimeoutSignal(15000),
    });

    if (!response.ok) {
      this._apiHealthMonitor?.recordFailure();
      throw new Error(`Téléchargement ${variant} impossible (${response.status})`);
    }
    this._apiHealthMonitor?.recordSuccess();

    const blob = await response.blob();
    if (!blob || blob.size <= 0) {
      throw new Error(`Stem ${variant} vide`);
    }
    return blob;
  }

  async ensureStemUrl(track, variant, onStatus) {
    const cached = await this.getCachedStemObjectUrl(track, variant);
    if (cached) return cached;

    if (!this._apiUrl()) throw new Error('URL du serveur manquante');
    const variantsLabel = variant === 'vocals' ? 'voix' : 'instru';

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const status = await this.fetchStemsStatus(track);
      const state = status?.status;
      if (state === 'ready') {
        try {
          onStatus?.(`Téléchargement ${variantsLabel}…`);
          const blob = await this.downloadStem(track, variant);
          return this.saveStemBlob(track, variant, blob);
        } catch (error) {
          if (attempt >= 5) throw error;
          onStatus?.('Erreur de téléchargement, nouvelle tentative…');
          await sleep(1500);
          continue;
        }
      }

      if (state === 'not_started' || !state) {
        onStatus?.('Génération des stems sur le serveur…');
        const launched = await this.triggerStemGeneration(track);
        if (!launched) {
          onStatus?.('Serveur stems indisponible, nouvelle tentative…');
        }
      } else {
        onStatus?.('Stems en cours de préparation…');
      }

      if (attempt < 5) await sleep(2000);
    }

    throw new Error(`Les stems de "${track?.name || 'chanson inconnue'}" ne sont pas prêts`);
  }

  readServerTracksCache() {
    const parsed = safeJsonParse(localStorage.getItem(SERVER_TRACKS_CACHE_KEY), null);
    return isServerTracksCacheFresh(parsed, { ttlMs: SERVER_TRACKS_CACHE_TTL_MS }) ? parsed.tracks : null;
  }

  writeServerTracksCache(tracks) {
    localStorage.setItem(SERVER_TRACKS_CACHE_KEY, JSON.stringify({
      tracks,
      fetchedAt: Date.now(),
    }));
  }

  clearServerTracksCache() {
    localStorage.removeItem(SERVER_TRACKS_CACHE_KEY);
  }

  async fetchServerCacheTracks({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
      const cached = this.readServerTracksCache();
      if (cached) return cached;
    }
    const apiUrl = this._apiUrl();
    if (!apiUrl) return [];
    try {
      const response = await fetch(this._appendToken(`${apiUrl}/api/cache/files`), {
        headers: { Accept: 'application/json' },
        signal: createTimeoutSignal(9000),
      });
      if (!response.ok) { this._apiHealthMonitor?.recordFailure(); return []; }
      this._apiHealthMonitor?.recordSuccess();
      const data = await response.json();
      const files = Array.isArray(data)
        ? data
        : (Array.isArray(data?.results) ? data.results : (Array.isArray(data?.files) ? data.files : []));
      const tracks = files.map((file) => ({
        name: normalizeText(file?.trackName || file?.name || file?.title),
        artist: normalizeText(file?.artistName || file?.artist),
        cachePath: normalizeText(file?.cachePath),
        bpm: file?.bpm,
      })).filter((track) => track.name || track.cachePath);
      this.writeServerTracksCache(tracks);
      return tracks;
    } catch (_) {
      this._apiHealthMonitor?.recordFailure();
      return [];
    }
  }

  dispose() {
    for (const objectUrl of this.objectUrls.values()) {
      URL.revokeObjectURL(objectUrl);
    }
    this.objectUrls.clear();
    this.objectUrlOrder = [];
  }
}

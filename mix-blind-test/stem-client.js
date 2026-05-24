import { DEFAULT_DOWNLOADER_API_URL, STORAGE_KEYS } from '../dj-mix/lib/storageKeys.js';
import { pruneStemCacheEntries } from './game-logic.js';

const MIX_API_URL_KEY = 'mix-blind-test:api-url';
const META_KEY = 'mix-blind-test:stem-cache-meta';
const CACHE_NAME = 'mix-blind-test:stems:v1';
const CACHE_ORIGIN = 'https://mix-blind-test.local';

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
  constructor({ maxBytes, maxEntries } = {}) {
    const storedApi = localStorage.getItem(MIX_API_URL_KEY) || localStorage.getItem(STORAGE_KEYS.downloaderApiUrl);
    this.apiUrl = normalizeApiUrl(storedApi || DEFAULT_DOWNLOADER_API_URL);
    this.maxBytes = Number(maxBytes) || 180 * 1024 * 1024;
    this.maxEntries = Number(maxEntries) || 24;
    this.maxObjectUrls = 6;
    this.objectUrls = new Map();
    this.objectUrlOrder = [];
  }

  getApiUrl() {
    return this.apiUrl;
  }

  setApiUrl(url) {
    this.apiUrl = normalizeApiUrl(url);
    localStorage.setItem(MIX_API_URL_KEY, this.apiUrl);
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

  async pruneCache() {
    if (!('caches' in window)) return;
    const cache = await caches.open(CACHE_NAME);
    const { kept, evicted } = pruneStemCacheEntries(this.readMeta(), {
      maxBytes: this.maxBytes,
      maxEntries: this.maxEntries,
    });

    for (const entry of evicted) {
      await cache.delete(this.cacheRequest(entry.key));
      this.dropObjectUrl(entry.key);
    }

    this.writeMeta(kept);
  }

  async getCachedStemObjectUrl(track, variant) {
    const stemKey = this.stemKey(track, variant);
    if (!stemKey || !('caches' in window)) return '';

    const active = this.objectUrls.get(stemKey);
    if (active) {
      this.touchMeta(stemKey, this.readMeta().find((entry) => entry?.key === stemKey)?.size || 0);
      return active;
    }

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

    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(this.cacheRequest(stemKey), new Response(blob, {
        headers: { 'content-type': blob.type || 'audio/mpeg' },
      }));
      this.touchMeta(stemKey, blob.size);
      await this.pruneCache();
    }

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
    if (!params.toString() || !this.apiUrl) return null;
    try {
      const response = await fetch(`${this.apiUrl}/api/stems?${params}`, {
        headers: { Accept: 'application/json' },
        signal: createTimeoutSignal(9000),
      });
      if (response.status === 404) return null;
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    }
  }

  async triggerStemGeneration(track) {
    const params = this.buildTrackParams(track);
    if (!params.toString() || !this.apiUrl) return false;

    const payload = Object.fromEntries(params.entries());
    try {
      const response = await fetch(`${this.apiUrl}/api/stems`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: createTimeoutSignal(10000),
      });
      return response.ok || response.status === 409;
    } catch (_) {
      return false;
    }
  }

  async downloadStem(track, variant) {
    const params = this.buildTrackParams(track);
    if (!params.toString() || !this.apiUrl) throw new Error('Chanson non identifiable pour les stems');

    params.set('stem', variant);
    const response = await fetch(`${this.apiUrl}/api/stems/download?${params}`, {
      signal: createTimeoutSignal(15000),
    });

    if (!response.ok) {
      throw new Error(`Téléchargement ${variant} impossible (${response.status})`);
    }

    const blob = await response.blob();
    if (!blob || blob.size <= 0) {
      throw new Error(`Stem ${variant} vide`);
    }
    return blob;
  }

  async ensureStemUrl(track, variant, onStatus) {
    const cached = await this.getCachedStemObjectUrl(track, variant);
    if (cached) return cached;

    if (!this.apiUrl) throw new Error('URL du serveur manquante');
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

  async fetchServerCacheTracks() {
    if (!this.apiUrl) return [];
    try {
      const response = await fetch(`${this.apiUrl}/api/cache/files`, {
        headers: { Accept: 'application/json' },
        signal: createTimeoutSignal(9000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      const files = Array.isArray(data)
        ? data
        : (Array.isArray(data?.results) ? data.results : (Array.isArray(data?.files) ? data.files : []));
      return files.map((file) => ({
        name: normalizeText(file?.trackName || file?.name || file?.title),
        artist: normalizeText(file?.artistName || file?.artist),
        cachePath: normalizeText(file?.cachePath),
        bpm: file?.bpm,
      })).filter((track) => track.name || track.cachePath);
    } catch (_) {
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

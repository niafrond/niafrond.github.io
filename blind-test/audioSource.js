/**
 * audioSource.js — Résolution audio et recherche de morceaux via le serveur
 * downloader local (mêmes mécaniques que dj-mix : recherche iTunes/Deezer,
 * téléchargement MP3 via yt-dlp, streaming depuis le CDN).
 *
 * Remplace l'ancien youtube.js (cobalt.tools/Piped/Invidious).
 *
 * Réutilise directement les modules dj-mix (aucune copie) :
 *  - downloaderConfig.js  → config API (url/token/CDN) + bouton "Tester"
 *  - apiHealthMonitor.js  → détection API hors ligne / retour en ligne
 *  - trackStore.js        → registre morceau partagé, persisté localStorage
 *  - audioSourceManager.js (getTrackCacheKey) → clé stable id/artist::name
 *
 * Interface du lecteur (LocalAudioPlayer) : identique à l'ancien
 * YouTubePlayer (init/prefetch/load/pause/play/getCurrentTime/destroy +
 * événement 'error') pour minimiser les changements dans game.js/main.js.
 */

import { createDownloaderConfigManager, appendApiToken, deriveCdnUrlFromApiUrl } from '../dj-mix/lib/downloaderConfig.js';
import { createApiHealthMonitor } from '../dj-mix/lib/apiHealthMonitor.js';
import { createTrackStore } from '../dj-mix/lib/trackStore.js';
import { getTrackCacheKey } from '../dj-mix/lib/audioSourceManager.js';
import { DEFAULT_DOWNLOADER_API_URL, DEFAULT_DOWNLOADER_CDN_URL } from '../dj-mix/lib/storageKeys.js';

const API_URL_KEY = 'blind-test:downloader:api:url';
const API_TOKEN_KEY = 'blind-test:downloader:api:token';
const CDN_URL_KEY = 'blind-test:downloader:cdn:url';

const CACHE_NAME = 'blind-test:audio:v1';
const CACHE_ORIGIN = 'https://blind-test.local';
const REQUEST_TIMEOUT_MS = 12000;
const STREAM_TIMEOUT_MS = 25000;
const DOWNLOAD_TIMEOUT_MS = 30000;

// ─── Config API (url / token / CDN), persistée dans localStorage ────────────

function readStored(key, fallback = '') {
  try {
    const raw = localStorage.getItem(key);
    return raw ? raw.trim() : fallback;
  } catch (_) {
    return fallback;
  }
}

export function getDownloaderApiUrl() {
  return readStored(API_URL_KEY, DEFAULT_DOWNLOADER_API_URL).replace(/\/+$/, '');
}

export function getDownloaderApiToken() {
  return readStored(API_TOKEN_KEY, '');
}

export function getDownloaderCdnUrl() {
  const stored = readStored(CDN_URL_KEY, '');
  if (stored) return stored.replace(/\/+$/, '');
  const apiUrl = getDownloaderApiUrl();
  return apiUrl ? deriveCdnUrlFromApiUrl(apiUrl) : DEFAULT_DOWNLOADER_CDN_URL;
}

let _configManager = null;

/**
 * Instancie le formulaire de config API (hôte uniquement). Les éléments DOM
 * manquants sont tolérés (createDownloaderConfigManager fait de l'optional
 * chaining partout) — pratique pour les tests unitaires sans DOM réel.
 */
export function initApiConfigUI({ inputEl, tokenInputEl, cdnInputEl, saveBtn, testBtn, statusEl } = {}) {
  _configManager = createDownloaderConfigManager({
    defaultUrl: DEFAULT_DOWNLOADER_API_URL,
    cdnDefaultUrl: DEFAULT_DOWNLOADER_CDN_URL,
    storageKey: API_URL_KEY,
    tokenStorageKey: API_TOKEN_KEY,
    cdnStorageKey: CDN_URL_KEY,
    inputEl,
    tokenInputEl,
    cdnInputEl,
    saveBtn,
    testBtn,
    statusEl,
  });
  _configManager.loadIntoForm();
  _configManager.setupEvents();
  return _configManager;
}

// ─── Health monitor (remplace le diagnostic cobalt/Piped/Invidious) ─────────

export const apiHealthMonitor = createApiHealthMonitor({
  getDownloaderApiUrl,
  getDownloaderApiToken,
});

/** Vérification immédiate (contrairement à apiHealthMonitor, qui ne détecte l'état hors-ligne qu'après des échecs). */
export async function checkApiHealth() {
  const apiUrl = getDownloaderApiUrl();
  if (!apiUrl) return false;
  try {
    const url = appendApiToken(`${apiUrl}/health`, getDownloaderApiToken());
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      apiHealthMonitor.recordSuccess();
      return true;
    }
    apiHealthMonitor.recordFailure();
    return false;
  } catch (_) {
    apiHealthMonitor.recordFailure();
    return false;
  }
}

// ─── Registre de morceaux partagé (mêmes mécaniques que dj-mix/lib/trackStore.js) ─

export const trackStore = createTrackStore();
trackStore.restore();

// ─── Diffusion de la config API vers les clients distants (via PeerJS) ──────

/** Appelé par l'hôte au GAME_START pour que les clients distants sachent où streamer l'audio. */
export function getBroadcastConfig() {
  const apiUrl = getDownloaderApiUrl();
  if (!apiUrl) return null;
  return {
    apiUrl,
    cdnUrl: getDownloaderCdnUrl(),
    apiToken: getDownloaderApiToken(),
  };
}

/** Appelé côté client à la réception de GAME_START — configure son propre lecteur sans écran de réglages. */
export function applyBroadcastConfig(cfg) {
  if (!cfg?.apiUrl) return;
  try {
    localStorage.setItem(API_URL_KEY, cfg.apiUrl);
    if (cfg.cdnUrl) localStorage.setItem(CDN_URL_KEY, cfg.cdnUrl);
    if (cfg.apiToken) localStorage.setItem(API_TOKEN_KEY, cfg.apiToken);
  } catch (_) {
    // quota / navigation privée
  }
}

// ─── Identité d'un morceau ───────────────────────────────────────────────────

/** Clé stable pour un morceau : cachePath une fois téléchargé, sinon artist::title. */
export function getSongKey(song) {
  if (song?.cachePath) return song.cachePath;
  return getTrackCacheKey({ artist: song?.artist, name: song?.title });
}

export { getTrackCacheKey };

// ─── Recherche (GET /api/search) ─────────────────────────────────────────────

function normalizeSearchHit(raw) {
  if (!raw) return null;
  const title = String(raw.name || raw.trackName || raw.title || '').trim();
  if (!title) return null;
  const artist = String(
    raw.artist || raw.artistName || (Array.isArray(raw.artists) ? raw.artists[0]?.name : '') || ''
  ).trim();
  const releaseYear = raw.year ?? (raw.releaseDate ? parseInt(String(raw.releaseDate).slice(0, 4), 10) : null);
  return {
    title,
    artist,
    year: Number.isFinite(releaseYear) ? releaseYear : null,
    genre: raw.genre || raw.primaryGenreName || null,
    artUrl: raw.artUrl || raw.album?.images?.[0]?.url || '',
    cachePath: raw.cachePath || '',
  };
}

/** @returns {Promise<Array>} résultats de recherche (tableau vide si API hors service). */
export async function searchTracks(term, { limit = 15 } = {}) {
  const query = String(term || '').trim();
  const apiUrl = getDownloaderApiUrl();
  if (!query || !apiUrl || apiHealthMonitor.isOffline()) return [];

  try {
    const params = new URLSearchParams({ term: query, limit: String(limit) });
    const url = appendApiToken(`${apiUrl}/api/search?${params}`, getDownloaderApiToken());
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      apiHealthMonitor.recordFailure();
      return [];
    }
    apiHealthMonitor.recordSuccess();
    const data = await response.json().catch(() => null);
    const rawResults = data?.tracks?.results ?? data?.results ?? (Array.isArray(data?.tracks) ? data.tracks : []) ?? [];
    return rawResults.map(normalizeSearchHit).filter(Boolean).slice(0, limit);
  } catch (_) {
    apiHealthMonitor.recordFailure();
    return [];
  }
}

// ─── Téléchargement (POST /api/download) ─────────────────────────────────────

function resolveArtworkUrl(artworkUrl) {
  if (!artworkUrl) return '';
  if (/^https?:\/\//i.test(artworkUrl)) return artworkUrl;
  const cdnUrl = getDownloaderCdnUrl();
  if (!cdnUrl) return '';
  const path = artworkUrl.startsWith('/') ? artworkUrl : `/${artworkUrl}`;
  return appendApiToken(`${cdnUrl}${path}`, getDownloaderApiToken());
}

/**
 * Télécharge (ou récupère depuis le cache) le MP3 d'un morceau et renseigne
 * `track.cachePath`/`track.artUrl` en place. Idempotent si déjà téléchargé.
 * @throws si le serveur est injoignable ou renvoie une erreur.
 */
export async function ensureDownloaded(track) {
  if (!track) return track;
  if (track.cachePath) return track;

  const key = getTrackCacheKey({ artist: track.artist, name: track.title });
  const existing = key ? trackStore.get(key) : null;
  if (existing?.cachePath) {
    track.cachePath = existing.cachePath;
    if (existing.artUrl && !track.artUrl) track.artUrl = existing.artUrl;
    return track;
  }

  const apiUrl = getDownloaderApiUrl();
  if (!apiUrl) throw new Error('URL du serveur API manquante');
  if (apiHealthMonitor.isOffline()) throw new Error('Serveur API hors ligne');

  const payload = {
    trackName: track.title,
    artistName: track.artist,
    searchQuery: track.artist ? `${track.artist} ${track.title}` : track.title,
  };

  let response;
  try {
    const url = appendApiToken(`${apiUrl}/api/download`, getDownloaderApiToken());
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    apiHealthMonitor.recordFailure();
    throw new Error(`Téléchargement impossible : ${err?.message || 'erreur réseau'}`);
  }

  if (!response.ok) {
    apiHealthMonitor.recordFailure();
    throw new Error(`Téléchargement impossible (HTTP ${response.status})`);
  }
  apiHealthMonitor.recordSuccess();

  const data = await response.json().catch(() => null);
  if (!data?.cachePath) throw new Error('Réponse de téléchargement invalide (cachePath manquant)');

  track.cachePath = data.cachePath;
  if (!track.artUrl && data.artworkUrl) track.artUrl = resolveArtworkUrl(data.artworkUrl);

  if (key) {
    trackStore.getOrCreate({ id: key, name: track.title, artist: track.artist, artUrl: track.artUrl, cachePath: track.cachePath });
  }

  return track;
}

// ─── Streaming (GET {cdn}/api/stream?cachePath=...) + cache navigateur ──────

function cacheRequest(key) {
  return new Request(`${CACHE_ORIGIN}/audio/${encodeURIComponent(key)}`);
}

async function readCachedBlob(key) {
  if (!('caches' in globalThis)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(cacheRequest(key));
    if (!match) return null;
    const blob = await match.blob();
    return blob && blob.size > 0 ? blob : null;
  } catch (_) {
    return null;
  }
}

async function writeCachedBlob(key, blob) {
  if (!('caches' in globalThis)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheRequest(key), new Response(blob, { headers: { 'content-type': blob.type || 'audio/mpeg' } }));
  } catch (_) {
    // quota / Cache Storage indisponible
  }
}

async function streamFromCdn(cachePath) {
  const cdnUrl = getDownloaderCdnUrl();
  if (!cdnUrl) throw new Error('URL CDN manquante');
  const url = appendApiToken(`${cdnUrl}/api/stream?cachePath=${encodeURIComponent(cachePath)}`, getDownloaderApiToken());

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(STREAM_TIMEOUT_MS) });
  } catch (err) {
    apiHealthMonitor.recordFailure();
    throw new Error(`Flux audio indisponible : ${err?.message || 'erreur réseau'}`);
  }
  if (!response.ok) {
    apiHealthMonitor.recordFailure();
    throw new Error(`Flux audio indisponible (HTTP ${response.status})`);
  }
  apiHealthMonitor.recordSuccess();

  const blob = await response.blob();
  if (!blob || blob.size <= 0) throw new Error('Flux audio vide');
  return blob;
}

/** Résout une clé de morceau (cachePath) en URL blob lisible, via cache navigateur puis CDN. */
async function resolveBlobUrl(cachePath) {
  const cached = await readCachedBlob(cachePath);
  if (cached) return URL.createObjectURL(cached);

  const blob = await streamFromCdn(cachePath);
  await writeCachedBlob(cachePath, blob);
  return URL.createObjectURL(blob);
}

// ─── Lecteur audio local (remplace YouTubePlayer) ────────────────────────────

export class LocalAudioPlayer extends EventTarget {
  constructor() {
    super();
    this._audio = null;
    this._ready = false;
    this._currentKey = null;
    this._prefetched = null; // { key, url }
    this._prefetchJob = null; // { key, promise }
  }

  init() {
    this._audio = new Audio();
    this._audio.preload = 'none';

    this._audio.addEventListener('playing', () => this.dispatchEvent(new CustomEvent('play')));
    this._audio.addEventListener('pause', () => this.dispatchEvent(new CustomEvent('pause')));
    this._audio.addEventListener('ended', () => this.dispatchEvent(new CustomEvent('ended')));

    this._ready = true;
    this.dispatchEvent(new CustomEvent('ready'));
    return Promise.resolve();
  }

  prefetch(key) {
    if (!key) return Promise.resolve(null);
    if (this._prefetched?.key === key) return Promise.resolve(this._prefetched.url);
    if (this._prefetchJob?.key === key) return this._prefetchJob.promise;

    const job = { key, promise: null };
    job.promise = resolveBlobUrl(key)
      .then((url) => {
        this._prefetched = { key, url };
        return url;
      })
      .catch((error) => {
        if (this._prefetched?.key === key) this._prefetched = null;
        throw error;
      })
      .finally(() => {
        if (this._prefetchJob === job) this._prefetchJob = null;
      });

    this._prefetchJob = job;
    return job.promise;
  }

  async _consumePrefetchedSource(key) {
    if (this._prefetched?.key === key) {
      const { url } = this._prefetched;
      this._prefetched = null;
      return url;
    }
    if (this._prefetchJob?.key === key) {
      try {
        const url = await this._prefetchJob.promise;
        if (this._prefetched?.key === key) this._prefetched = null;
        return url;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  async load(key, seekTo = 0) {
    if (!this._ready || !this._audio) return;
    this._currentKey = key;
    const audio = this._audio;

    const applyAndPlay = (url) => {
      if (this._currentKey !== key) return;
      audio.src = url;
      if (seekTo === 'middle') {
        audio.addEventListener('loadedmetadata', () => { audio.currentTime = audio.duration / 2; }, { once: true });
      } else if (seekTo > 0) {
        audio.addEventListener('canplay', () => { audio.currentTime = seekTo; }, { once: true });
      }
      audio.play().catch(() => {});
    };

    try {
      const prefetchedUrl = await this._consumePrefetchedSource(key);
      if (prefetchedUrl) {
        if (this._currentKey !== key) return;
        applyAndPlay(prefetchedUrl);
        return;
      }

      const url = await resolveBlobUrl(key);
      if (this._currentKey !== key) return;
      applyAndPlay(url);
    } catch (error) {
      console.error('[Audio] Aucune source disponible pour', key, error);
      this.dispatchEvent(new CustomEvent('error', {
        detail: { key, reason: error?.message || 'Lecture audio impossible' },
      }));
    }
  }

  pause() { this._audio?.pause(); }

  play() { this._audio?.play().catch(() => {}); }

  getCurrentTime() { return this._audio?.currentTime || 0; }

  getState() {
    if (!this._audio) return -1;
    if (this._audio.ended) return 0;
    if (this._audio.paused) return 2;
    return 1;
  }

  destroy() {
    if (this._audio) {
      this._audio.pause();
      this._audio.src = '';
      this._audio = null;
    }
    this._prefetched = null;
    this._prefetchJob = null;
    this._ready = false;
  }
}

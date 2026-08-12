/**
 * audioSource.js — Résolution audio et recherche de morceaux via le serveur
 * downloader local (mêmes mécaniques que dj-mix/blind-test : recherche
 * iTunes/Deezer, téléchargement MP3 via yt-dlp, streaming depuis le CDN).
 *
 * Réutilise directement les modules dj-mix (aucune copie de la logique
 * serveur) :
 *  - downloaderConfig.js  → config API (url/token/CDN) + bouton "Tester"
 *  - apiHealthMonitor.js  → détection API hors ligne / retour en ligne
 *  - trackStore.js        → registre morceau partagé, persisté localStorage
 *  - audioSourceManager.js (getTrackCacheKey) → clé stable id/artist::name
 *
 * theme-party n'a pas de mode multi-appareils : contrairement à
 * blind-test/audioSource.js, il n'y a donc pas de getBroadcastConfig/
 * applyBroadcastConfig — la config API vit uniquement dans les clés
 * localStorage ci-dessous, propres à cette app (comme blind-test a les
 * siennes plutôt que celles de dj-mix : la config n'est pas partagée
 * automatiquement entre apps).
 */

import { createDownloaderConfigManager, appendApiToken, deriveCdnUrlFromApiUrl } from '../dj-mix/lib/downloaderConfig.js';
import { createApiHealthMonitor } from '../dj-mix/lib/apiHealthMonitor.js';
import { createTrackStore } from '../dj-mix/lib/trackStore.js';
import { getTrackCacheKey } from '../dj-mix/lib/audioSourceManager.js';
import { DEFAULT_DOWNLOADER_API_URL, DEFAULT_DOWNLOADER_CDN_URL } from '../dj-mix/lib/storageKeys.js';

const API_URL_KEY = 'theme-party:downloader:api:url';
const API_TOKEN_KEY = 'theme-party:downloader:api:token';
const CDN_URL_KEY = 'theme-party:downloader:cdn:url';

const CACHE_NAME = 'theme-party:audio:v1';
const CACHE_ORIGIN = 'https://theme-party.local';
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
 * Instancie le formulaire de config API. Les éléments DOM manquants sont
 * tolérés (createDownloaderConfigManager fait de l'optional chaining
 * partout) — pratique pour les tests unitaires sans DOM réel.
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

// ─── Health monitor ──────────────────────────────────────────────────────────

export const apiHealthMonitor = createApiHealthMonitor({
  getDownloaderApiUrl,
  getDownloaderApiToken,
});

// ─── Registre de morceaux partagé (mêmes mécaniques que dj-mix/lib/trackStore.js) ─

export const trackStore = createTrackStore();
trackStore.restore();

// ─── Identité d'un morceau ───────────────────────────────────────────────────

/** Clé stable pour un morceau : cachePath une fois téléchargé, sinon artist::title. */
export function getSongKey(track) {
  if (track?.cachePath) return track.cachePath;
  return getTrackCacheKey({ artist: track?.artist, name: track?.title });
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
  return {
    title,
    artist,
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

// Le picker précharge en tâche de fond toutes les pistes du pool restant
// (voir main.js) pendant que la lecture directe (loadCurrentTrack)
// peut réclamer la même piste au même instant si le Set démarre avant que
// la file de préchargement ne l'ait atteinte. Sans garde, ces deux appels
// concurrents déclenchaient chacun leur propre POST /api/download pour la
// même piste ; la recherche serveur (iTunes/Deezer + yt-dlp) n'étant pas
// garantie déterministe d'un appel à l'autre, le second à répondre pouvait
// écraser `track.cachePath` avec un résultat différent (mauvaise chanson au
// prochain "suivant"), en plus de doubler inutilement l'appel API pendant
// que la partie est en cours. On dédoublonne donc par référence de piste :
// un seul téléchargement en vol par piste, les appels concurrents partagent
// la même promesse.
const pendingDownloads = new WeakMap();

/**
 * Télécharge (ou récupère depuis le cache) le MP3 d'une piste et renseigne
 * `track.cachePath`/`track.artUrl` en place. Idempotent si déjà téléchargé.
 * @throws si le serveur est injoignable ou renvoie une erreur.
 */
export function ensureDownloaded(track) {
  if (!track) return Promise.resolve(track);
  if (track.cachePath) return Promise.resolve(track);

  const pending = pendingDownloads.get(track);
  if (pending) return pending;

  const promise = downloadTrack(track).finally(() => pendingDownloads.delete(track));
  pendingDownloads.set(track, promise);
  return promise;
}

async function downloadTrack(track) {
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

// resolveBlobUrl (lecture directe) et prefetchAudio (préchargement en tâche
// de fond) peuvent réclamer le même cachePath au même instant (ex: le Set
// démarre pile au moment où la file de préchargement l'atteint) — sans
// garde, chacun relancerait son propre GET /api/stream. On dédoublonne par
// cachePath : un seul flux CDN en vol par piste.
const pendingStreams = new Map();

async function fetchAndCacheBlob(cachePath) {
  const pending = pendingStreams.get(cachePath);
  if (pending) return pending;

  const promise = streamFromCdn(cachePath)
    .then(async (blob) => {
      await writeCachedBlob(cachePath, blob);
      return blob;
    })
    .finally(() => pendingStreams.delete(cachePath));
  pendingStreams.set(cachePath, promise);
  return promise;
}

/** Résout une clé de morceau (cachePath) en URL blob lisible, via cache navigateur puis CDN. */
async function resolveBlobUrl(cachePath) {
  const cached = await readCachedBlob(cachePath);
  if (cached) return URL.createObjectURL(cached);

  const blob = await fetchAndCacheBlob(cachePath);
  return URL.createObjectURL(blob);
}

/**
 * Précharge un morceau dans le cache navigateur (Cache Storage) sans créer
 * d'URL blob ni jouer le son — juste pour que load() le trouve déjà en
 * cache le moment venu (voir main.js : lancé dès l'écran de choix des
 * thèmes, pendant que le DJ hésite, pour éviter toute latence au lancement
 * du Set). Ne fait rien si déjà en cache. Best-effort : les erreurs sont
 * silencieuses ici, `ensureDownloaded`/`load()` referont la tentative (avec
 * remontée d'erreur) au moment réel de la lecture si besoin.
 */
export async function prefetchAudio(cachePath) {
  if (!cachePath) return;
  try {
    const cached = await readCachedBlob(cachePath);
    if (cached) return;
    await fetchAndCacheBlob(cachePath);
  } catch (_) {
    // best-effort — voir commentaire ci-dessus
  }
}

// ─── Lecteur audio local ──────────────────────────────────────────────────────

export class LocalAudioPlayer extends EventTarget {
  constructor() {
    super();
    this._audio = null;
    this._ready = false;
    this._currentKey = null;
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

  async load(key, { autoplay = true } = {}) {
    if (!this._ready || !this._audio) return;
    this._currentKey = key;
    const audio = this._audio;

    // Remet currentTime à 0 tout de suite (synchrone), avant même de résoudre
    // la nouvelle source : resolveBlobUrl est async, et pendant cette attente
    // getCurrentTime() renverrait sinon encore la position de l'ancienne
    // piste — la boucle RAF de main.js lirait un temps déjà > HINT_1/HINT_2
    // et révélerait les deux indices instantanément au clic sur "Suivant".
    audio.pause();
    audio.currentTime = 0;

    try {
      const url = await resolveBlobUrl(key);
      if (this._currentKey !== key) return;
      audio.src = url;
      if (autoplay) audio.play().catch(() => {});
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
    this._ready = false;
  }
}

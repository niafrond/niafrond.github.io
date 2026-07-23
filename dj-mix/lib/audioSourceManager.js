import {
  cleanItunesSearchText,
  extractStemSourceUrls,
  extractTrackLoudnessDb,
  splitItunesSearchQuery,
} from './searchUtils.js';
import { appendApiToken } from './downloaderConfig.js';
import { createLogger } from './logger.js';

const logger = createLogger('audio-source');
const logDebug = (event, payload) => logger.debug(event, payload);
const logInfo = (event, payload) => logger.info(event, payload);
const logWarn = (event, payload) => logger.warn(event, payload);
const logError = (event, payload) => logger.error(event, payload);

export function getTrackCacheKey(track) {
  if (!track) return '';
  // Use id or artist::name — NOT uri/persistedSourceUrl which is a session URL
  // and differs between queue items (which set uri=persistedSourceUrl) and
  // fil rouge playlist items (which don't have a uri field), causing cache misses.
  const id = String(track.id || '').trim();
  if (id) return id;
  const artist = String(track.artist || '').trim().toLowerCase();
  const name = String(track.name || track.title || '').trim().toLowerCase();
  return `${artist}::${name}`;
}

export function getDirectPlayableSourceUrl(track, getDownloaderApiUrl) {
  if (!track) return '';

  const candidates = [
    track.persistedSourceUrl,
    track.localBlobUrl,
    track.downloadUrl,
    track.streamUrl,
    track.fileUrl,
    track.audioUrl,
    track.url,
    track.uri,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const value = candidate.trim();
    if (!value) continue;
    if (value.startsWith('blob:')) return value;
    if (/^https?:\/\//i.test(value) && isTrustedLocalAudioUrl(value, getDownloaderApiUrl)) return value;
  }

  return '';
}

export function isTrustedLocalAudioUrl(url, getDownloaderApiUrl) {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url, window.location.href);
    const sameOrigin = parsed.origin === window.location.origin;
    const downloaderApi = getDownloaderApiUrl?.();
    const apiOrigin = downloaderApi ? new URL(downloaderApi, window.location.href).origin : '';
    const fromConfiguredApi = apiOrigin && parsed.origin === apiOrigin;
    const hasCachePath = /\/api\/cache\//i.test(parsed.pathname) || /\/cache\//i.test(parsed.pathname);

    return sameOrigin || (fromConfiguredApi && hasCachePath);
  } catch (_) {
    return false;
  }
}

export function canLoadAudioSource(sourceUrl) {
  return new Promise((resolve) => {
    if (!sourceUrl) {
      resolve(false);
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';

    let settled = false;
    const cleanup = () => {
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      clearTimeout(timeoutId);
      audio.src = '';
    };

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };

    const onCanPlay = () => finish(true);
    const onError = () => finish(false);
    const timeoutId = setTimeout(() => finish(false), 6000);

    audio.addEventListener('canplay', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = sourceUrl;
    audio.load();
  });
}

export function readAudioDurationMs(sourceUrl) {
  return new Promise((resolve) => {
    if (!sourceUrl) {
      resolve(0);
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';

    let settled = false;
    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      clearTimeout(timeoutId);
      audio.src = '';
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        finish(Math.round(audio.duration * 1000));
        return;
      }
      finish(0);
    };

    const onError = () => finish(0);
    const timeoutId = setTimeout(() => finish(0), 8000);

    audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = sourceUrl;
  });
}

function getPersistentAudioCacheRequest(cacheKey) {
  const safeKey = encodeURIComponent(String(cacheKey || 'unknown'));
  return new Request(`https://dj-mix.local/cache-audio/${safeKey}`);
}

async function persistAudioBlob(cacheKey, blob, audioCacheName) {
  if (!cacheKey || !blob || blob.size <= 0) return;
  if (!('caches' in window)) return;

  try {
    const cache = await caches.open(audioCacheName);
    const req = getPersistentAudioCacheRequest(cacheKey);
    const res = new Response(blob, {
      headers: {
        'content-type': blob.type || 'audio/mpeg',
      },
    });
    await cache.put(req, res);
    logDebug('cache.persist.blob', {
      cacheKey,
      size: blob.size,
      type: blob.type || 'audio/mpeg',
      audioCacheName,
    });
  } catch (_) {
    // persistent cache is best effort only
  }
}

async function restorePersistedAudioBlobUrl(cacheKey, audioCacheName) {
  if (!cacheKey) return null;
  if (!('caches' in window)) return null;

  try {
    const cache = await caches.open(audioCacheName);
    const req = getPersistentAudioCacheRequest(cacheKey);
    const cached = await cache.match(req);
    if (!cached) return null;
    const blob = await cached.blob();
    if (!blob || blob.size <= 0) return null;
    logInfo('cache.restore.persisted.hit', {
      cacheKey,
      size: blob.size,
      audioCacheName,
    });
    return URL.createObjectURL(blob);
  } catch (_) {
    return null;
  }
}

function getArtworkCacheRequest(trackKey) {
  const safeKey = encodeURIComponent(String(trackKey || 'unknown'));
  return new Request(`https://dj-mix.local/cache-artwork/${safeKey}`);
}

async function persistArtworkBlob(trackKey, artUrl, cacheName) {
  if (!trackKey || !artUrl || !('caches' in window)) return;
  try {
    const cache = await caches.open(cacheName);
    if (await cache.match(getArtworkCacheRequest(trackKey))) return;
    const res = await fetch(artUrl);
    if (!res.ok) return;
    const blob = await res.blob();
    if (!blob || blob.size <= 0) return;
    await cache.put(getArtworkCacheRequest(trackKey), new Response(blob, {
      headers: { 'content-type': blob.type || 'image/jpeg' },
    }));
  } catch (_) {}
}

async function restorePersistedArtworkBlobUrl(trackKey, cacheName) {
  if (!trackKey || !('caches' in window)) return null;
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(getArtworkCacheRequest(trackKey));
    if (!cached) return null;
    const blob = await cached.blob();
    if (!blob || blob.size <= 0) return null;
    return URL.createObjectURL(blob);
  } catch (_) {
    return null;
  }
}

export function releaseLocalBlob(item, touchQueueItem) {
  if (!item) return;
  logDebug('blob.release.item', { id: item.id, name: item.name });
  if (item.localBlobUrl && String(item.localBlobUrl).startsWith('blob:')) {
    URL.revokeObjectURL(item.localBlobUrl);
  }
  const localStems = item.localStemUrls || {};
  if (localStems.vocalsUrl && String(localStems.vocalsUrl).startsWith('blob:')) {
    URL.revokeObjectURL(localStems.vocalsUrl);
  }
  if (localStems.instrumentalUrl && String(localStems.instrumentalUrl).startsWith('blob:')) {
    URL.revokeObjectURL(localStems.instrumentalUrl);
  }
  if (localStems.echoUrl && String(localStems.echoUrl).startsWith('blob:')) {
    URL.revokeObjectURL(localStems.echoUrl);
  }
  if (localStems.distortionUrl && String(localStems.distortionUrl).startsWith('blob:')) {
    URL.revokeObjectURL(localStems.distortionUrl);
  }
  item.localBlobUrl = null;
  item.localStemUrls = null;
  touchQueueItem?.(item);
}

function evictSessionBlobCacheEntry(sessionBlobCache, cacheKey) {
  if (!cacheKey || !sessionBlobCache?.has(cacheKey)) return false;
  const cachedSource = sessionBlobCache.get(cacheKey);
  const blobUrl = typeof cachedSource === 'string' ? cachedSource : cachedSource?.url;
  if (blobUrl && String(blobUrl).startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
  }
  const stems = cachedSource?.stems || {};
  if (stems.vocalsUrl && String(stems.vocalsUrl).startsWith('blob:')) {
    URL.revokeObjectURL(stems.vocalsUrl);
  }
  if (stems.instrumentalUrl && String(stems.instrumentalUrl).startsWith('blob:')) {
    URL.revokeObjectURL(stems.instrumentalUrl);
  }
  if (stems.echoUrl && String(stems.echoUrl).startsWith('blob:')) {
    URL.revokeObjectURL(stems.echoUrl);
  }
  if (stems.distortionUrl && String(stems.distortionUrl).startsWith('blob:')) {
    URL.revokeObjectURL(stems.distortionUrl);
  }
  sessionBlobCache.delete(cacheKey);
  return true;
}

export function clearSessionBlobCache(sessionBlobCache) {
  const sizeBefore = sessionBlobCache.size;
  for (const cachedSource of sessionBlobCache.values()) {
    const blobUrl = typeof cachedSource === 'string' ? cachedSource : cachedSource?.url;
    if (blobUrl && String(blobUrl).startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl);
    }
    const stems = cachedSource?.stems || {};
    if (stems.vocalsUrl && String(stems.vocalsUrl).startsWith('blob:')) {
      URL.revokeObjectURL(stems.vocalsUrl);
    }
    if (stems.instrumentalUrl && String(stems.instrumentalUrl).startsWith('blob:')) {
      URL.revokeObjectURL(stems.instrumentalUrl);
    }
    if (stems.echoUrl && String(stems.echoUrl).startsWith('blob:')) {
      URL.revokeObjectURL(stems.echoUrl);
    }
    if (stems.distortionUrl && String(stems.distortionUrl).startsWith('blob:')) {
      URL.revokeObjectURL(stems.distortionUrl);
    }
  }
  sessionBlobCache.clear();
  logInfo('blob.sessionCache.cleared', { releasedEntries: sizeBefore });
}

export function createAudioSourceManager(options) {
  const {
    apiHealthMonitor,
    audioCacheName,
    getDownloaderApiToken,
    getDownloaderApiUrl,
    getDownloaderCdnUrl,
    onQueueUpdated,
    persistArtUrl,
    sessionBlobCache,
    shouldWarmStems,
    touchQueueItem,
    trackPathDb,
  } = options;

  const MAX_SESSION_BLOB_CACHE_ENTRIES = 12; // Covers 2 active decks + 10 pre-fetched

  // Tracks in-flight prefetchTrackToLocalCache() calls by cache key so that
  // concurrent bulk-download drivers (startup cache sync, "Tout télécharger",
  // Spotify sync loop, TXT import) racing on the same track share one network
  // request instead of firing duplicate downloads with conflicting outcomes.
  const inFlightPrefetches = new Map();

  // fetch() vers l'API downloader avec ajout automatique de `token=...` (auth API).
  // Les URLs hors API (CDN externes, blobs, etc.) sont laissées inchangées.
  function apiFetch(url, init) {
    const baseUrl = getDownloaderApiUrl();
    const targetsApi = baseUrl && String(url).startsWith(baseUrl);
    const finalUrl = targetsApi ? appendApiToken(url, getDownloaderApiToken?.()) : url;
    return fetch(finalUrl, init);
  }

  // Base URL of the standalone audio CDN (audioCdnServer.js) that serves the
  // actual audio bytes (GET /api/stream, /api/stems/download) independently
  // of the main API. Falls back to the API base URL when no CDN is configured
  // (routes are kept there temporarily during the migration).
  function getCdnBaseUrl() {
    return getDownloaderCdnUrl?.() || getDownloaderApiUrl();
  }

  // Same token auth as apiFetch, but targeting the CDN base URL.
  function cdnFetch(url, init) {
    const baseUrl = getCdnBaseUrl();
    const targetsCdn = baseUrl && String(url).startsWith(baseUrl);
    const finalUrl = targetsCdn ? appendApiToken(url, getDownloaderApiToken?.()) : url;
    return fetch(finalUrl, init);
  }

  function getStemCacheKey(cacheKey, variant) {
    return `${cacheKey}:stem:${variant}`;
  }

  function sanitizeStemSources(raw) {
    const src = raw || {};
    return {
      vocalsUrl: typeof src.vocalsUrl === 'string' ? src.vocalsUrl : '',
      instrumentalUrl: typeof src.instrumentalUrl === 'string' ? src.instrumentalUrl : '',
      echoUrl: typeof src.echoUrl === 'string' ? src.echoUrl : '',
      distortionUrl: typeof src.distortionUrl === 'string' ? src.distortionUrl : '',
    };
  }

  function evictOldestBlobIfNeeded() {
    if (sessionBlobCache.size > MAX_SESSION_BLOB_CACHE_ENTRIES) {
      const oldestKey = sessionBlobCache.keys().next().value;
      evictSessionBlobCacheEntry(sessionBlobCache, oldestKey);
    }
  }

  async function resolveStemVariantUrl(cacheKey, variant, sourceUrl) {
    if (!sourceUrl || typeof sourceUrl !== 'string') return '';
    let trimmed = sourceUrl.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('blob:')) return trimmed;

    if (/^\/(api|cache)\//i.test(trimmed)) {
      const baseUrl = getDownloaderApiUrl();
      if (baseUrl) {
        try {
          trimmed = new URL(trimmed, baseUrl).toString();
        } catch (_) {
          // Keep original if URL construction fails.
        }
      }
    }

    const cachedUrl = await restorePersistedAudioBlobUrl(getStemCacheKey(cacheKey, variant), audioCacheName);
    if (cachedUrl) return cachedUrl;

    if (isTrustedLocalAudioUrl(trimmed, getDownloaderApiUrl)) {
      const playable = await canLoadAudioSource(trimmed);
      if (playable) return trimmed;
    }

    const res = await apiFetch(trimmed);
    if (!res.ok) throw new Error(`stem.${variant}.download.failed:${res.status}`);
    const blob = await res.blob();
    if (!blob || blob.size <= 0) throw new Error(`stem.${variant}.empty`);
    await persistAudioBlob(getStemCacheKey(cacheKey, variant), blob, audioCacheName);
    return URL.createObjectURL(blob);
  }

  async function downloadStemVariantViaApi(item, cacheKey, variant) {
    if (!cacheKey) return '';

    const persisted = await restorePersistedAudioBlobUrl(getStemCacheKey(cacheKey, variant), audioCacheName);
    if (persisted) return persisted;

    const params = new URLSearchParams();
    params.set('stem', variant);
    // The CDN only supports cachePath-based lookup (no trackName/artistName
    // fallback), so prefer it when a cachePath is known; otherwise fall back
    // to the main API, which still resolves by name.
    let useCdn = false;
    if (item?.cachePath) {
      params.set('cachePath', item.cachePath);
      useCdn = true;
    } else if (item?.name) {
      params.set('trackName', item.name);
      if (item.artist) params.set('artistName', item.artist);
    } else {
      return '';
    }

    const baseUrl = useCdn ? getCdnBaseUrl() : getDownloaderApiUrl();
    if (!baseUrl) return '';
    const fetcher = useCdn ? cdnFetch : apiFetch;

    const res = await fetcher(`${baseUrl}/api/stems/download?${params}`, {
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.error(`stem.${variant}.download.api.failed:${res.status}`);
      return '';
     
    }

    const blob = await res.blob();
    if (!blob || blob.size <= 0) throw new Error(`stem.${variant}.download.api.empty`);
    await persistAudioBlob(getStemCacheKey(cacheKey, variant), blob, audioCacheName);
    return URL.createObjectURL(blob);
  }

  async function warmStemLocalSources(item, cacheKey) {
    if (!item || !cacheKey) return;

    const sourceStems = sanitizeStemSources(extractStemSourceUrls(item));
    if (!sourceStems.vocalsUrl && !sourceStems.instrumentalUrl && !sourceStems.echoUrl && !sourceStems.distortionUrl) return;

    const existingStems = sanitizeStemSources(item.localStemUrls || item.stems);

    try {
      const [vocalsUrl, instrumentalUrl, echoUrl, distortionUrl] = await Promise.all([
        existingStems.vocalsUrl || !sourceStems.vocalsUrl
          ? Promise.resolve(existingStems.vocalsUrl || sourceStems.vocalsUrl)
          : resolveStemVariantUrl(cacheKey, 'vocals', sourceStems.vocalsUrl),
        existingStems.instrumentalUrl || !sourceStems.instrumentalUrl
          ? Promise.resolve(existingStems.instrumentalUrl || sourceStems.instrumentalUrl)
          : resolveStemVariantUrl(cacheKey, 'instrumental', sourceStems.instrumentalUrl),
        existingStems.echoUrl || !sourceStems.echoUrl
          ? Promise.resolve(existingStems.echoUrl || sourceStems.echoUrl)
          : resolveStemVariantUrl(cacheKey, 'echo', sourceStems.echoUrl),
        existingStems.distortionUrl || !sourceStems.distortionUrl
          ? Promise.resolve(existingStems.distortionUrl || sourceStems.distortionUrl)
          : resolveStemVariantUrl(cacheKey, 'distortion', sourceStems.distortionUrl),
      ]);

      item.localStemUrls = {
        vocalsUrl: vocalsUrl || sourceStems.vocalsUrl || '',
        instrumentalUrl: instrumentalUrl || sourceStems.instrumentalUrl || '',
        echoUrl: echoUrl || sourceStems.echoUrl || '',
        distortionUrl: distortionUrl || sourceStems.distortionUrl || '',
      };
      item.stems = {
        vocalsUrl: item.localStemUrls.vocalsUrl,
        instrumentalUrl: item.localStemUrls.instrumentalUrl,
        echoUrl: item.localStemUrls.echoUrl,
        distortionUrl: item.localStemUrls.distortionUrl,
      };

      const existingSession = sessionBlobCache.get(cacheKey);
      if (existingSession && typeof existingSession === 'object') {
        sessionBlobCache.set(cacheKey, {
          ...existingSession,
          stems: { ...item.localStemUrls },
        });
        evictOldestBlobIfNeeded();
      }

      touchQueueItem(item);
      onQueueUpdated?.();
      logDebug('source.ensure.stems.cached', {
        cacheKey,
        id: item?.id,
        hasVocals: !!item.localStemUrls.vocalsUrl,
        hasInstrumental: !!item.localStemUrls.instrumentalUrl,
        hasEcho: !!item.localStemUrls.echoUrl,
        hasDistortion: !!item.localStemUrls.distortionUrl,
      });
    } catch (err) {
      logWarn('source.ensure.stems.cache.failed', {
        cacheKey,
        id: item?.id,
        message: err?.message,
      });
    }
  }

  async function hydrateItemDurationFromLocalSource(item) {
    if (!item || item.duration > 0 || !item.localBlobUrl) return;
    if (item.durationProbeInFlight) return;

    item.durationProbeInFlight = true;
    try {
      const durationMs = await readAudioDurationMs(item.localBlobUrl);
      if (durationMs > 0) {
        item.duration = durationMs;
        logDebug('track.duration.hydrated', {
          id: item.id,
          name: item.name,
          durationMs,
        });
        onQueueUpdated?.();
      }
    } finally {
      item.durationProbeInFlight = false;
    }
  }

  function maybeWarmStemLocalSources(item, cacheKey) {
    if (shouldWarmStems?.(item) === false) return;
    void warmStemLocalSources(item, cacheKey);
  }

  // Fetches the actual audio bytes for an already-resolved cachePath from the
  // standalone CDN and persists them locally. Shared by the cachePath-first
  // shortcut and the post-orchestration follow-up below.
  // SPEC-13.3.9 — Resolves a `/api/artwork?cachePath=...` reference (returned
  // by POST /api/download once the backend has mirrored the iTunes/Deezer
  // artwork onto its own CDN, see artworkCache.js) into an absolute, token-
  // authenticated URL. Third-party CDNs (mzstatic.com, dzcdn.net) generally
  // don't send Access-Control-Allow-Origin, so `fetch()` (used to build the
  // Media Session data URI) and Android's own artwork decode both fail
  // silently on them; our own CDN sends permissive CORS, so routing artwork
  // through it is required for the system notification to show the real cover.
  function resolveCdnArtworkUrl(artworkRef) {
    if (typeof artworkRef !== 'string' || !artworkRef.startsWith('/api/artwork')) return '';
    const cdnBaseUrl = getCdnBaseUrl();
    if (!cdnBaseUrl) return '';
    return appendApiToken(`${cdnBaseUrl}${artworkRef}`, getDownloaderApiToken?.());
  }

  async function streamCachedTrackFromCdn(item, cachePath, downloadStartedAt, extra = {}) {
    const cdnBaseUrl = getCdnBaseUrl();
    if (!cdnBaseUrl) {
      throw new Error('URL CDN audio manquante (Config)');
    }
    const streamUrl = `${cdnBaseUrl}/api/stream?cachePath=${encodeURIComponent(cachePath)}`;

    const mediaRes = await cdnFetch(streamUrl);
    if (!mediaRes.ok) {
      logWarn('api.download.stream.failed', {
        id: item?.id,
        status: mediaRes.status,
      });
      const err = new Error(`Téléchargement audio impossible (HTTP ${mediaRes.status})`);
      err.status = mediaRes.status;
      throw err;
    }

    const mediaBlob = await mediaRes.blob();
    if (!mediaBlob || mediaBlob.size === 0) {
      throw new Error('Audio téléchargé vide');
    }
    await persistAudioBlob(getTrackCacheKey(item), mediaBlob, audioCacheName);

    const totalMs = performance.now() - downloadStartedAt;
    logInfo('api.download.response.ok', {
      id: item?.id,
      size: mediaBlob.size,
      cacheState: extra.cacheState,
      requestMs: extra.requestMs != null ? Math.round(extra.requestMs) : null,
      totalMs: Math.round(totalMs),
      throughputKBps: totalMs > 0 ? Math.round((mediaBlob.size / 1024) / (totalMs / 1000)) : null,
    });

    const loudnessDb = Number.isFinite(extra.loudnessDb)
      ? extra.loudnessDb
      : (Number.isFinite(item?.loudnessDb) ? item.loudnessDb : null);
    return {
      url: URL.createObjectURL(mediaBlob),
      loudnessDb,
      sourceMeta: cachePath,
      cachePath,
      artworkUrl: extra.artworkUrl || '',
    };
  }

  async function downloadTrackViaApi(item) {
    if (apiHealthMonitor?.isOffline()) {
      throw new Error('API hors ligne – téléchargement impossible');
    }

    const downloadStartedAt = performance.now();

    // Already know where the file lives (previously downloaded, or listed
    // from the library/cache index with a cachePath): skip the orchestration
    // POST on the main API entirely and go straight to the CDN, which stays
    // reachable even while the main API is busy with a long-running
    // download/search task.
    if (item?.cachePath) {
      logInfo('api.download.cdn.directStream', {
        id: item?.id,
        name: item?.name,
        cachePath: item.cachePath,
      });
      return streamCachedTrackFromCdn(item, item.cachePath, downloadStartedAt);
    }

    // Not resolved on the item itself: consult the local path DB (paths-only,
    // synced from GET /api/cache/files at startup and topped up below after
    // every fresh orchestration resolve) before hitting the network at all.
    const cacheKey = getTrackCacheKey(item);
    let dbCachePath = trackPathDb?.get(cacheKey) || '';
    if (!dbCachePath) {
      const fbArtist = String(item?.artist || '').trim().toLowerCase();
      const fbName = String(item?.name || item?.title || '').trim().toLowerCase();
      const fallbackKey = (fbArtist && fbName) ? `${fbArtist}::${fbName}` : '';
      if (fallbackKey && fallbackKey !== cacheKey) dbCachePath = trackPathDb?.get(fallbackKey) || '';
    }
    if (dbCachePath) {
      item.cachePath = dbCachePath;
      logInfo('api.download.pathDb.directStream', {
        id: item?.id,
        name: item?.name,
        cachePath: dbCachePath,
      });
      return streamCachedTrackFromCdn(item, dbCachePath, downloadStartedAt);
    }

    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) {
      throw new Error('URL API downloader manquante (Config)');
    }

    logInfo('api.download.request', {
      id: item?.id,
      name: item?.name,
      artist: item?.artist,
      baseUrl,
    });

    const payload = {
      trackName: item.name,
      artistName: item.artist,
      searchQuery: `${item.artist} ${item.name}`,
      ...(Number.isFinite(item.popularity) ? { popularity: item.popularity } : {}),
    };

    let res;
    try {
      res = await apiFetch(`${baseUrl}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      apiHealthMonitor?.recordFailure();
      throw err;
    }

    const requestMs = performance.now() - downloadStartedAt;

    if (!res.ok) {
      apiHealthMonitor?.recordFailure();
      const body = await res.text().catch(() => '');
      logWarn('api.download.response.nonOk', { status: res.status, body });
      const err = new Error(`HTTP ${res.status} ${body}`.trim());
      err.status = res.status;
      throw err;
    }

    apiHealthMonitor?.recordSuccess();

    // POST /api/download is orchestration-only and never streams audio bytes
    // itself: it returns JSON metadata including the resolved cachePath. The
    // bytes are fetched separately from the standalone audio CDN so playback
    // stays available even while a long-running download/search task is in
    // flight on the main API.
    const data = await res.json().catch(() => null);
    const cachePath = data?.cachePath;
    if (!cachePath) {
      throw new Error('Réponse API sans cachePath');
    }

    trackPathDb?.set(cacheKey, cachePath);

    return streamCachedTrackFromCdn(item, cachePath, downloadStartedAt, {
      requestMs,
      cacheState: data?.cacheState,
      loudnessDb: extractTrackLoudnessDb(data),
      artworkUrl: resolveCdnArtworkUrl(data?.artworkUrl),
    });
  }

  async function ensureLocalSource(item) {
    logInfo('source.ensure.begin', {
      id: item?.id,
      name: item?.name,
      sourceState: item?.sourceState,
      hasLocalBlobUrl: !!item?.localBlobUrl,
      hasPersistedSourceUrl: !!item?.persistedSourceUrl,
    });
    const cacheKey = getTrackCacheKey(item);

    if (item.localBlobUrl) {
      maybeWarmStemLocalSources(item, cacheKey);
      logDebug('source.ensure.hit.itemBlob', { cacheKey, id: item?.id });
      return item.localBlobUrl;
    }

    // Check in-memory session cache before any network probes
    let cachedSource = sessionBlobCache.get(cacheKey);
    if (!cachedSource) {
      const fbArtist = String(item.artist || '').trim().toLowerCase();
      const fbName = String(item.name || item.title || '').trim().toLowerCase();
      if (fbArtist && fbName) {
        const fallbackKey = `${fbArtist}::${fbName}`;
        if (fallbackKey !== cacheKey) cachedSource = sessionBlobCache.get(fallbackKey);
      }
    }
    if (cachedSource) {
      item.localBlobUrl = typeof cachedSource === 'string' ? cachedSource : cachedSource.url;
      if (Number.isFinite(cachedSource?.loudnessDb)) {
        item.loudnessDb = cachedSource.loudnessDb;
      }
      if (cachedSource?.stems && typeof cachedSource.stems === 'object') {
        item.localStemUrls = sanitizeStemSources(cachedSource.stems);
        item.stems = { ...item.localStemUrls };
      }
      item.sourceState = 'ready';
      item.sourceError = null;
      touchQueueItem(item);
      hydrateItemDurationFromLocalSource(item);
      onQueueUpdated?.();
      maybeWarmStemLocalSources(item, cacheKey);
      logInfo('source.ensure.hit.sessionBlobCache', {
        cacheKey,
        id: item?.id,
      });
      return item.localBlobUrl;
    }

    // Check persistent Cache Storage before any network probes
    let persistedBlobUrl = await restorePersistedAudioBlobUrl(cacheKey, audioCacheName);
    // Fallback: try artist::name key (covers mismatch between queue items
    // whose id was synthesized by addToQueue and tracks downloaded under
    // the artist::name cache key by prefetchTrackToLocalCache)
    if (!persistedBlobUrl) {
      const fbArtist = String(item.artist || '').trim().toLowerCase();
      const fbName = String(item.name || item.title || '').trim().toLowerCase();
      if (fbArtist && fbName) {
        const fallbackKey = `${fbArtist}::${fbName}`;
        if (fallbackKey !== cacheKey) {
          persistedBlobUrl = await restorePersistedAudioBlobUrl(fallbackKey, audioCacheName);
        }
      }
    }
    if (persistedBlobUrl) {
      item.localBlobUrl = persistedBlobUrl;
      sessionBlobCache.set(cacheKey, {
        url: persistedBlobUrl,
        loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
        stems: sanitizeStemSources(item.localStemUrls || item.stems),
      });
      evictOldestBlobIfNeeded();
      item.sourceState = 'ready';
      item.sourceError = null;
      touchQueueItem(item);
      hydrateItemDurationFromLocalSource(item);
      onQueueUpdated?.();
      maybeWarmStemLocalSources(item, cacheKey);
      logInfo('source.ensure.hit.persistentCacheApi', {
        cacheKey,
        id: item?.id,
      });
      return item.localBlobUrl;
    }

    if (item.persistedSourceUrl) {
      const isPlayable = await canLoadAudioSource(item.persistedSourceUrl);
      if (isPlayable) {
        item.localBlobUrl = item.persistedSourceUrl;
        item.sourceState = 'ready';
        item.sourceError = null;
        touchQueueItem(item);
        hydrateItemDurationFromLocalSource(item);
        onQueueUpdated?.();
        maybeWarmStemLocalSources(item, cacheKey);
        logInfo('source.ensure.hit.persistedSourceUrl', { cacheKey, id: item?.id });
        return item.localBlobUrl;
      }
      logWarn('source.ensure.persistedSourceUrl.notPlayable', {
        cacheKey,
        id: item?.id,
      });
      item.persistedSourceUrl = '';
    }

    const directFromUri = getDirectPlayableSourceUrl(item, getDownloaderApiUrl);
    if (directFromUri) {
      const isPlayable = await canLoadAudioSource(directFromUri);
      if (isPlayable) {
        item.persistedSourceUrl = directFromUri;
        item.localBlobUrl = directFromUri;
        item.sourceState = 'ready';
        item.sourceError = null;
        touchQueueItem(item);
        hydrateItemDurationFromLocalSource(item);
        onQueueUpdated?.();
        maybeWarmStemLocalSources(item, cacheKey);
        logInfo('source.ensure.hit.trustedDirectUrl', {
          cacheKey,
          id: item?.id,
          directFromUriPreview: String(directFromUri).slice(0, 96),
        });
        return item.localBlobUrl;
      }
      logWarn('source.ensure.trustedDirectUrl.notPlayable', {
        cacheKey,
        id: item?.id,
      });
    }

    item.sourceState = 'resolving';
    item.sourceError = null;
    onQueueUpdated?.();

    try {
      const downloaded = await downloadTrackViaApi(item);
      item.localBlobUrl = downloaded.url;
      if (downloaded.cachePath) {
        item.cachePath = downloaded.cachePath;
      }
      if (Number.isFinite(downloaded.loudnessDb)) {
        item.loudnessDb = downloaded.loudnessDb;
      }
      // SPEC-13.3.9 — Replace the raw iTunes/Deezer artwork URL with our own
      // CORS-enabled CDN reference so Media Session can actually decode it.
      if (downloaded.artworkUrl && downloaded.artworkUrl !== item.artUrl) {
        item.artUrl = downloaded.artworkUrl;
        persistArtUrl?.(item.id, downloaded.artworkUrl);
      }
      sessionBlobCache.set(cacheKey, {
        url: item.localBlobUrl,
        loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
        stems: sanitizeStemSources(item.localStemUrls || item.stems),
      });
      evictOldestBlobIfNeeded();
      item.sourceState = 'ready';
      item.sourceMode = 'api';
      item.sourceMeta = downloaded.sourceMeta || null;
      touchQueueItem(item);
      hydrateItemDurationFromLocalSource(item);
      onQueueUpdated?.();
      maybeWarmStemLocalSources(item, cacheKey);
      logInfo('source.ensure.resolved.fromApiDownload', {
        cacheKey,
        id: item?.id,
        sourceMeta: item.sourceMeta,
      });
      return item.localBlobUrl;
    } catch (err) {
      item.sourceState = 'error';
      item.sourceError = err.message;
      onQueueUpdated?.();
      logError('source.ensure.failed', {
        cacheKey,
        id: item?.id,
        message: err?.message,
      });
      throw err;
    }
  }

  function evictTrackSource(item, options = {}) {
    if (!item) return false;
    const { notify = true } = options;
    const cacheKey = getTrackCacheKey(item);
    const hadLocalSource = Boolean(item.localBlobUrl || item.localStemUrls);
    releaseLocalBlob(item, touchQueueItem);
    const hadSessionSource = evictSessionBlobCacheEntry(sessionBlobCache, cacheKey);
    item.sourceError = null;
    item.sourceState = item.persistedSourceUrl ? 'ready' : 'idle';
    touchQueueItem(item);
    if (notify) onQueueUpdated?.();
    logDebug('source.evict', {
      cacheKey,
      id: item?.id,
      hadLocalSource,
      hadSessionSource,
    });
    return hadLocalSource || hadSessionSource;
  }

  async function searchTracksRaw(query, limit = 25, skipCache = false) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) throw new Error('URL API downloader manquante (Config)');

    if (apiHealthMonitor?.isOffline()) {
      logInfo('api.search.skipped.offline', { query });
      return { tracks: [] };
    }

    logInfo('api.search.begin', { query, limit, skipCache, baseUrl });

    const parsed = splitItunesSearchQuery(query);
    const term = cleanItunesSearchText(parsed.title || '') || cleanItunesSearchText(query);
    if (!term) return { tracks: [] };

    const params = new URLSearchParams({ term });
    const artist = cleanItunesSearchText(parsed.artist || '');
    if (artist) params.set('artist', artist);
    if (Number.isFinite(limit) && limit > 0) params.set('limit', String(limit));
    if (skipCache) params.set('nocache', '1');

    const url = `${baseUrl}/api/search?${params}`;
    let res;
    try {
      res = await apiFetch(url, { headers: { Accept: 'application/json' } });
    } catch (err) {
      apiHealthMonitor?.recordFailure();
      logWarn('api.search.networkError', { query, error: err?.message });
      throw err;
    }

    if (!res.ok) {
      apiHealthMonitor?.recordFailure();
      logWarn('api.search.failed', { query, status: res.status });
      return { tracks: [] };
    }

    apiHealthMonitor?.recordSuccess();
    const data = await res.json().catch(() => null);
    const tracks = options.normalizeApiSearchResponse(data);

    logDebug('api.search.result', { query, count: tracks.length });
    return { tracks };
  }

  async function searchTracksViaApi(query, limit = 25, skipCache = false) {
    try {
      const { tracks } = await searchTracksRaw(query, limit, skipCache);
      return tracks;
    } catch (err) {
      logWarn('api.search.error', { query, message: err?.message });
      return [];
    }
  }

  /**
   * GET /api/stems – returns { status, vocals, instrumental, ... } or null on failure.
   * Identification priority: cachePath > trackName+artistName.
   */
  async function fetchServerStemsStatus(item) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) return null;
    if (apiHealthMonitor?.isOffline()) return null;

    const params = new URLSearchParams();
    if (item.cachePath) {
      params.set('cachePath', item.cachePath);
    } else if (item.name) {
      params.set('trackName', item.name);
      if (item.artist) params.set('artistName', item.artist);
    } else {
      return null;
    }

    logDebug('api.stems.get', { id: item?.id, cachePath: item?.cachePath });
    try {
      const res = await apiFetch(`${baseUrl}/api/stems?${params}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        apiHealthMonitor?.recordFailure();
        logWarn('api.stems.get.nonOk', { status: res.status });
        return null;
      }
      apiHealthMonitor?.recordSuccess();
      return await res.json();
    } catch (err) {
      apiHealthMonitor?.recordFailure();
      logWarn('api.stems.get.failed', { message: err?.message });
      return null;
    }
  }

  /**
   * POST /api/stems – triggers server-side stem separation (background).
   * Returns the response body or null on failure.
   */
  async function triggerServerStemsGeneration(item) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) return null;
    if (apiHealthMonitor?.isOffline()) return null;

    const payload = {};
    if (item.cachePath) payload.cachePath = item.cachePath;
    if (item.name) payload.trackName = item.name;
    if (item.artist) payload.artistName = item.artist;

    logDebug('api.stems.post', { id: item?.id, cachePath: item?.cachePath });
    try {
      const res = await apiFetch(`${baseUrl}/api/stems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        apiHealthMonitor?.recordFailure();
        logWarn('api.stems.post.nonOk', { status: res.status });
        return null;
      }
      apiHealthMonitor?.recordSuccess();
      return await res.json();
    } catch (err) {
      apiHealthMonitor?.recordFailure();
      logWarn('api.stems.post.failed', { message: err?.message });
      return null;
    }
  }

  /**
   * Attempts to enrich an item's stems from the server.
   * - If the server has stems ready, downloads them as blobs and updates item.localStemUrls.
   * - If stems aren't started yet, triggers generation (fire-and-forget).
   * - If stems are pending, does nothing (generation is already running).
   * Safe to call multiple times; bails early if stems are already resolved locally.
   */
  async function enrichStemsFromServer(item) {
    if (!item) return;

    // Already have primary stems (vocals or instrumental) in memory — nothing to fetch
    const existing = sanitizeStemSources(item.localStemUrls || item.stems);
    if (existing.vocalsUrl && existing.instrumentalUrl) return;

    // Need at least a cachePath or name to identify the track
    if (!item.cachePath && !item.name) return;

    const cacheKey = getTrackCacheKey(item);

    // Check persistent Cache Storage before hitting the server.
    // A track may have only 2 stems (vocals + instrumental), so we restore whatever
    // is present and skip the server if at least one variant is found.
    const [vocalsFromCache, instrumentalFromCache, echoFromCache, distortionFromCache] = await Promise.all([
      existing.vocalsUrl ? Promise.resolve(existing.vocalsUrl) : restorePersistedAudioBlobUrl(getStemCacheKey(cacheKey, 'vocals'), audioCacheName).catch(() => null),
      existing.instrumentalUrl ? Promise.resolve(existing.instrumentalUrl) : restorePersistedAudioBlobUrl(getStemCacheKey(cacheKey, 'instrumental'), audioCacheName).catch(() => null),
      existing.echoUrl ? Promise.resolve(existing.echoUrl) : restorePersistedAudioBlobUrl(getStemCacheKey(cacheKey, 'echo'), audioCacheName).catch(() => null),
      existing.distortionUrl ? Promise.resolve(existing.distortionUrl) : restorePersistedAudioBlobUrl(getStemCacheKey(cacheKey, 'distortion'), audioCacheName).catch(() => null),
    ]);

    if (vocalsFromCache || instrumentalFromCache || echoFromCache || distortionFromCache) {
      item.localStemUrls = {
        vocalsUrl: vocalsFromCache || '',
        instrumentalUrl: instrumentalFromCache || '',
        echoUrl: echoFromCache || '',
        distortionUrl: distortionFromCache || '',
      };
      item.stems = { ...item.localStemUrls };
      const existingSession = sessionBlobCache.get(cacheKey);
      if (existingSession && typeof existingSession === 'object') {
        sessionBlobCache.set(cacheKey, { ...existingSession, stems: { ...item.localStemUrls } });
        evictOldestBlobIfNeeded();
      }
      touchQueueItem(item);
      onQueueUpdated?.();
      logInfo('stems.restored.fromPersistentCache', { cacheKey, id: item?.id });
      return;
    }

    const stemData = await fetchServerStemsStatus(item);
    if (!stemData) return;

    logDebug('api.stems.status', { id: item?.id, status: stemData.status });

    if (stemData.status === 'not_started') {
      logInfo('api.stems.trigger', { id: item?.id, cachePath: item?.cachePath });
      void triggerServerStemsGeneration(item);
      return;
    }

    if (stemData.status !== 'ready') return; // pending or unknown – nothing to do yet

    // Build URLs from the paths returned by the server
    const baseUrl = getDownloaderApiUrl() || '';

    const toStemUrl = async (rawPath, variant) => {
      if (!rawPath || typeof rawPath !== 'string') return '';
      const trimmed = rawPath.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('blob:')) return trimmed;

      // Relative path → prefix with API base URL
      let fullUrl = trimmed;
      if (trimmed.startsWith('/')) {
        fullUrl = baseUrl ? `${baseUrl}${trimmed}` : trimmed;
      }

      return resolveStemVariantUrl(cacheKey, variant, fullUrl).catch(() => '');
    };

    const downloadViaApiOrFallback = async (variant, fallbackPath) => {
      try {
        const downloadedUrl = await downloadStemVariantViaApi(item, cacheKey, variant);
        if (downloadedUrl) return downloadedUrl;
      } catch (err) {
        logWarn('api.stems.download.failed', {
          id: item?.id,
          variant,
          status: Number(String(err?.message || '').split(':').pop()) || undefined,
          message: err?.message,
        });
      }
      return toStemUrl(fallbackPath, variant);
    };

    // Launch both stem downloads immediately in parallel after stems? confirms 'ready'
    const [vocalsUrl, instrumentalUrl, echoUrl, distortionUrl] = await Promise.all([
      existing.vocalsUrl || downloadViaApiOrFallback('vocals', stemData.vocals),
      existing.instrumentalUrl || downloadViaApiOrFallback('instrumental', stemData.instrumental),
      existing.echoUrl || downloadViaApiOrFallback('echo', stemData.echo),
      existing.distortionUrl || downloadViaApiOrFallback('distortion', stemData.distortion),
    ]);

    if (!vocalsUrl && !instrumentalUrl && !echoUrl && !distortionUrl) {
      logWarn('stems.all.failed', { id: item?.id });
      return;
    }

    item.localStemUrls = {
      vocalsUrl: vocalsUrl || existing.vocalsUrl || '',
      instrumentalUrl: instrumentalUrl || existing.instrumentalUrl || '',
      echoUrl: echoUrl || existing.echoUrl || '',
      distortionUrl: distortionUrl || existing.distortionUrl || '',
    };
    item.stems = { ...item.localStemUrls };

    const existingSession = sessionBlobCache.get(cacheKey);
    if (existingSession && typeof existingSession === 'object') {
      sessionBlobCache.set(cacheKey, {
        ...existingSession,
        stems: { ...item.localStemUrls },
      });
      evictOldestBlobIfNeeded();
    }

    touchQueueItem(item);
    onQueueUpdated?.();
    logInfo('api.stems.enriched', {
      id: item?.id,
      hasVocals: !!item.localStemUrls.vocalsUrl,
      hasInstrumental: !!item.localStemUrls.instrumentalUrl,
      hasEcho: !!item.localStemUrls.echoUrl,
      hasDistortion: !!item.localStemUrls.distortionUrl,
    });
  }

  async function deleteLocalCacheSong(track) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) throw new Error('URL API downloader manquante (Config)');

    logInfo('api.cache.delete.request', {
      name: track?.name,
      artist: track?.artist,
      cachePath: track?.cachePath,
    });

    const payload = {};
    if (track.cachePath) {
      payload.cachePath = track.cachePath;
    } else {
      payload.trackName = track.name;
      if (track.artist) payload.artistName = track.artist;
    }

    const res = await apiFetch(`${baseUrl}/api/cache/files`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logWarn('api.cache.delete.response.nonOk', { status: res.status, body });
      throw new Error(`HTTP ${res.status} ${body}`.trim());
    }

    logInfo('api.cache.delete.success', {
      name: track?.name,
      artist: track?.artist,
      cachePath: track?.cachePath,
    });
  }

  /**
   * Checks whether a track is already stored in the local browser Cache Storage
   * (or in the in-memory session blob cache).  Does NOT trigger any download.
   * Returns true if the track is cached, false otherwise.
   */
  async function isTrackInLocalCache(item) {
    if (!item?.name || !item?.artist) return false;
    const cacheKey = getTrackCacheKey(item);
    if (sessionBlobCache.has(cacheKey)) return true;
    const fbArtist = String(item.artist || '').trim().toLowerCase();
    const fbName = String(item.name || item.title || '').trim().toLowerCase();
    const fallbackKey = (fbArtist && fbName) ? `${fbArtist}::${fbName}` : '';
    if (fallbackKey && fallbackKey !== cacheKey && sessionBlobCache.has(fallbackKey)) return true;
    const persisted = await restorePersistedAudioBlobUrl(cacheKey, audioCacheName).catch(() => null);
    if (persisted) {
      URL.revokeObjectURL(persisted);
      return true;
    }
    if (fallbackKey && fallbackKey !== cacheKey) {
      const fallbackPersisted = await restorePersistedAudioBlobUrl(fallbackKey, audioCacheName).catch(() => null);
      if (fallbackPersisted) {
        URL.revokeObjectURL(fallbackPersisted);
        return true;
      }
    }
    return false;
  }

  /**
   * Pre-fetches a track into the local cache without affecting item state.
   * Downloads via the API (which stores it server-side) and persists the blob
   * in browser Cache Storage, then immediately revokes the ephemeral blob URL.
   * Returns true on success, false if skipped or failed.
   */
  async function prefetchTrackToLocalCache(item, { onError } = {}) {
    if (!item?.name || !item?.artist) return false;
    if (apiHealthMonitor?.isOffline()) return false;

    const cacheKey = getTrackCacheKey(item);

    if (sessionBlobCache.has(cacheKey)) {
      logDebug('prefetch.skip.sessionCache', { cacheKey });
      return true;
    }

    const inFlight = inFlightPrefetches.get(cacheKey);
    if (inFlight) {
      logDebug('prefetch.join.inFlight', { cacheKey });
      return inFlight;
    }

    const attempt = _prefetchTrackToLocalCacheUncached(item, cacheKey, { onError });
    inFlightPrefetches.set(cacheKey, attempt);
    try {
      return await attempt;
    } finally {
      inFlightPrefetches.delete(cacheKey);
    }
  }

  async function _prefetchTrackToLocalCacheUncached(item, cacheKey, { onError } = {}) {
    const persisted = await restorePersistedAudioBlobUrl(cacheKey, audioCacheName).catch(() => null);
    if (persisted) {
      URL.revokeObjectURL(persisted);
      logDebug('prefetch.skip.persisted', { cacheKey });
      return true;
    }

    try {
      const result = await downloadTrackViaApi(item);
      if (result?.cachePath) item.cachePath = result.cachePath;
      // SPEC-13.3.9 — applied here too: once a track is prefetched (e.g. "Tout
      // télécharger"), ensureLocalSource() will later hit the item.cachePath
      // fast path and never call downloadTrackViaApi again, so this is the
      // only chance to pick up the CORS-safe CDN artwork reference.
      if (result?.artworkUrl && result.artworkUrl !== item.artUrl) {
        item.artUrl = result.artworkUrl;
        persistArtUrl?.(item.id, result.artworkUrl);
      }
      if (result?.url) URL.revokeObjectURL(result.url);
      logInfo('prefetch.success', { cacheKey, name: item.name, artist: item.artist });
      return true;
    } catch (err) {
      logWarn('prefetch.failed', { cacheKey, name: item?.name, error: err?.message });
      onError?.(err);
      return false;
    }
  }

  function persistArtwork(item, artUrl) {
    return persistArtworkBlob(getTrackCacheKey(item), artUrl, audioCacheName);
  }

  function restoreArtwork(item) {
    return restorePersistedArtworkBlobUrl(getTrackCacheKey(item), audioCacheName);
  }

  return {
    clearSessionBlobCache: () => clearSessionBlobCache(sessionBlobCache),
    deleteLocalCacheSong,
    enrichStemsFromServer,
    ensureLocalSource,
    evictTrackSource,
    isTrackInLocalCache,
    persistArtwork,
    prefetchTrackToLocalCache,
    releaseLocalBlob: (item) => releaseLocalBlob(item, touchQueueItem),
    restoreArtwork,
    searchTracksRaw,
    searchTracksViaApi,
  };
}

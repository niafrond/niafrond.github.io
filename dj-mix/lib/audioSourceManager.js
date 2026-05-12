import {
  cleanItunesSearchText,
  extractTrackLoudnessDb,
  splitItunesSearchQuery,
} from './searchUtils.js';
import { createLogger } from './logger.js';

const logger = createLogger('audio-source');
const logDebug = (event, payload) => logger.debug(event, payload);
const logInfo = (event, payload) => logger.info(event, payload);
const logWarn = (event, payload) => logger.warn(event, payload);
const logError = (event, payload) => logger.error(event, payload);

export function getTrackCacheKey(track) {
  if (!track) return '';
  return String(track.uri || track.id || `${track.artist || ''}::${track.name || track.title || ''}`);
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

export function releaseLocalBlob(item, touchQueueItem) {
  if (!item?.localBlobUrl) return;
  logDebug('blob.release.item', { id: item.id, name: item.name });
  item.localBlobUrl = null;
  touchQueueItem?.(item);
}

export function clearSessionBlobCache(sessionBlobCache) {
  const sizeBefore = sessionBlobCache.size;
  for (const cachedSource of sessionBlobCache.values()) {
    const blobUrl = typeof cachedSource === 'string' ? cachedSource : cachedSource?.url;
    if (blobUrl && String(blobUrl).startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl);
    }
  }
  sessionBlobCache.clear();
  logInfo('blob.sessionCache.cleared', { releasedEntries: sizeBefore });
}

export function createAudioSourceManager(options) {
  const {
    audioCacheName,
    getDownloaderApiUrl,
    onQueueUpdated,
    sessionBlobCache,
    touchQueueItem,
  } = options;

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

  async function downloadTrackViaApi(item) {
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
      title: item.name,
      artist: item.artist,
      id: item.id,
      ratingKey: item.ratingKey,
    };

    const res = await fetch(`${baseUrl}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logWarn('api.download.response.nonOk', { status: res.status, body });
      throw new Error(`HTTP ${res.status} ${body}`.trim());
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('audio') || contentType.includes('octet-stream')) {
      const blob = await res.blob();
      if (!blob || blob.size === 0) throw new Error('Flux audio vide depuis API');
      await persistAudioBlob(getTrackCacheKey(item), blob, audioCacheName);
      logInfo('api.download.response.audioStream.ok', {
        id: item?.id,
        size: blob.size,
        contentType,
      });
      return {
        url: URL.createObjectURL(blob),
        loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
        sourceMeta: 'audio-stream',
      };
    }

    const data = await res.json().catch(() => null);
    const directUrl = data?.downloadUrl || data?.url || data?.fileUrl || data?.audioUrl;
    if (!directUrl) {
      throw new Error('Réponse API sans URL audio');
    }

    const mediaRes = await fetch(directUrl);
    if (!mediaRes.ok) {
      logWarn('api.download.followup.directUrl.failed', {
        id: item?.id,
        status: mediaRes.status,
      });
      throw new Error(`Téléchargement URL API impossible (HTTP ${mediaRes.status})`);
    }

    const mediaBlob = await mediaRes.blob();
    if (!mediaBlob || mediaBlob.size === 0) {
      throw new Error('Audio téléchargé vide');
    }
    await persistAudioBlob(getTrackCacheKey(item), mediaBlob, audioCacheName);

    const loudnessDb = extractTrackLoudnessDb(data);
    return {
      url: URL.createObjectURL(mediaBlob),
      loudnessDb: Number.isFinite(loudnessDb) ? loudnessDb : (Number.isFinite(item.loudnessDb) ? item.loudnessDb : null),
      sourceMeta: data?.source || data?.provider || data?.cachePath || '',
    };
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
    const cachedSource = sessionBlobCache.get(cacheKey);
    if (item.localBlobUrl) {
      logDebug('source.ensure.hit.itemBlob', { cacheKey, id: item?.id });
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
        console.log('Using persisted source URL for item:', { cacheKey, id: item?.id, persistedSourceUrl: item.persistedSourceUrl });
        onQueueUpdated?.();
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

    if (cachedSource) {
      item.localBlobUrl = typeof cachedSource === 'string' ? cachedSource : cachedSource.url;
      if (Number.isFinite(cachedSource?.loudnessDb)) {
        item.loudnessDb = cachedSource.loudnessDb;
      }
      item.sourceState = 'ready';
      item.sourceError = null;
      touchQueueItem(item);
      hydrateItemDurationFromLocalSource(item);
      onQueueUpdated?.();
      logInfo('source.ensure.hit.sessionBlobCache', {
        cacheKey,
        id: item?.id,
      });
      return item.localBlobUrl;
    }

    const persistedBlobUrl = await restorePersistedAudioBlobUrl(cacheKey, audioCacheName);
    if (persistedBlobUrl) {
      item.localBlobUrl = persistedBlobUrl;
      sessionBlobCache.set(cacheKey, {
        url: persistedBlobUrl,
        loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
      });
      item.sourceState = 'ready';
      item.sourceError = null;
      touchQueueItem(item);
      hydrateItemDurationFromLocalSource(item);
      onQueueUpdated?.();
      logInfo('source.ensure.hit.persistentCacheApi', {
        cacheKey,
        id: item?.id,
      });
      return item.localBlobUrl;
    }

    item.sourceState = 'resolving';
    item.sourceError = null;
    onQueueUpdated?.();

    try {
      const downloaded = await downloadTrackViaApi(item);
      item.localBlobUrl = downloaded.url;
      if (Number.isFinite(downloaded.loudnessDb)) {
        item.loudnessDb = downloaded.loudnessDb;
      }
      sessionBlobCache.set(cacheKey, {
        url: item.localBlobUrl,
        loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
      });
      item.sourceState = 'ready';
      item.sourceMode = 'api';
      item.sourceMeta = downloaded.sourceMeta || null;
      touchQueueItem(item);
      hydrateItemDurationFromLocalSource(item);
      onQueueUpdated?.();
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

  async function searchTracksViaApi(query, limit = 25) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) throw new Error('URL API downloader manquante (Config)');

    logInfo('api.search.begin', { query, limit, baseUrl });

    const parsed = splitItunesSearchQuery(query);
    const searchAttempts = [
      { term: parsed.title, artist: parsed.artist },
      { term: cleanItunesSearchText(query), artist: '' },
    ]
      .map((attempt) => ({
        term: cleanItunesSearchText(attempt.term || ''),
        artist: cleanItunesSearchText(attempt.artist || ''),
      }))
      .filter((attempt, index, array) => array.findIndex((candidate) => candidate.term === attempt.term && candidate.artist === attempt.artist) === index)
      .filter((attempt) => attempt.term);

    for (const attempt of searchAttempts) {
      const limitParam = Number.isFinite(limit) && limit > 0 ? `&limit=${encodeURIComponent(limit)}` : '';
      const url = `${baseUrl}/api/search?term=${encodeURIComponent(attempt.term)}${attempt.artist ? `&artist=${encodeURIComponent(attempt.artist)}` : ''}${limitParam}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        logWarn('api.search.attempt.failed', {
          term: attempt.term,
          artist: attempt.artist,
          status: res.status,
        });
        continue;
      }

      const data = await res.json().catch(() => null);
      const items = options.normalizeApiSearchResponse(data);
      logDebug('api.search.attempt.result', {
        term: attempt.term,
        artist: attempt.artist,
        count: items.length,
      });
      if (items.length) return items;
    }

    logInfo('api.search.noResults', { query });
    return [];
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

    const res = await fetch(`${baseUrl}/api/cache/files`, {
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

  return {
    clearSessionBlobCache: () => clearSessionBlobCache(sessionBlobCache),
    deleteLocalCacheSong,
    ensureLocalSource,
    releaseLocalBlob: (item) => releaseLocalBlob(item, touchQueueItem),
    searchTracksViaApi,
  };
}

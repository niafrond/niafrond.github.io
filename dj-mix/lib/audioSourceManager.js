import {
  cleanItunesSearchText,
  extractStemSourceUrls,
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
    getDownloaderApiUrl,
    onQueueUpdated,
    sessionBlobCache,
    shouldWarmStems,
    touchQueueItem,
  } = options;

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

    const res = await fetch(trimmed);
    if (!res.ok) throw new Error(`stem.${variant}.download.failed:${res.status}`);
    const blob = await res.blob();
    if (!blob || blob.size <= 0) throw new Error(`stem.${variant}.empty`);
    await persistAudioBlob(getStemCacheKey(cacheKey, variant), blob, audioCacheName);
    return URL.createObjectURL(blob);
  }

  async function downloadStemVariantViaApi(item, cacheKey, variant) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) return '';
    if (!cacheKey) return '';

    const persisted = await restorePersistedAudioBlobUrl(getStemCacheKey(cacheKey, variant), audioCacheName);
    if (persisted) return persisted;

    const params = new URLSearchParams();
    params.set('stem', variant);
    if (item?.cachePath) {
      params.set('cachePath', item.cachePath);
    } else if (item?.name) {
      params.set('trackName', item.name);
      if (item.artist) params.set('artistName', item.artist);
    } else {
      return '';
    }

    const res = await fetch(`${baseUrl}/api/stems/download?${params}`, {
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

  async function downloadTrackViaApi(item) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) {
      throw new Error('URL API downloader manquante (Config)');
    }

    if (apiHealthMonitor?.isOffline()) {
      throw new Error('API hors ligne – téléchargement impossible');
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

    let res;
    try {
      res = await fetch(`${baseUrl}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      apiHealthMonitor?.recordFailure();
      throw err;
    }

    if (!res.ok) {
      apiHealthMonitor?.recordFailure();
      const body = await res.text().catch(() => '');
      logWarn('api.download.response.nonOk', { status: res.status, body });
      throw new Error(`HTTP ${res.status} ${body}`.trim());
    }

    apiHealthMonitor?.recordSuccess();

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
      maybeWarmStemLocalSources(item, cacheKey);
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

    const persistedBlobUrl = await restorePersistedAudioBlobUrl(cacheKey, audioCacheName);
    if (persistedBlobUrl) {
      item.localBlobUrl = persistedBlobUrl;
      sessionBlobCache.set(cacheKey, {
        url: persistedBlobUrl,
        loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
        stems: sanitizeStemSources(item.localStemUrls || item.stems),
      });
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
        stems: sanitizeStemSources(item.localStemUrls || item.stems),
      });
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

  async function searchTracksViaApi(query, limit = 25, skipCache = false) {
    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) throw new Error('URL API downloader manquante (Config)');

    if (apiHealthMonitor?.isOffline()) {
      logInfo('api.search.skipped.offline', { query });
      return [];
    }

    logInfo('api.search.begin', { query, limit, skipCache, baseUrl });

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

    let anyAttemptMade = false;
    for (const attempt of searchAttempts) {
      const limitParam = Number.isFinite(limit) && limit > 0 ? `&limit=${encodeURIComponent(limit)}` : '';
      const cacheParam = skipCache ? '&nocache=1' : '';
      const url = `${baseUrl}/api/search?term=${encodeURIComponent(attempt.term)}${attempt.artist ? `&artist=${encodeURIComponent(attempt.artist)}` : ''}${limitParam}${cacheParam}`;
      let res;
      try {
        res = await fetch(url, { headers: { Accept: 'application/json' } });
        anyAttemptMade = true;
      } catch (err) {
        apiHealthMonitor?.recordFailure();
        logWarn('api.search.attempt.networkError', { term: attempt.term, error: err?.message });
        continue;
      }
      if (!res.ok) {
        apiHealthMonitor?.recordFailure();
        logWarn('api.search.attempt.failed', {
          term: attempt.term,
          artist: attempt.artist,
          status: res.status,
        });
        continue;
      }

      apiHealthMonitor?.recordSuccess();
      const data = await res.json().catch(() => null);
      const items = options.normalizeApiSearchResponse(data);
      logDebug('api.search.attempt.result', {
        term: attempt.term,
        artist: attempt.artist,
        count: items.length,
      });
      if (items.length) return items;
    }

    if (!anyAttemptMade && searchAttempts.length > 0) {
      // All attempts failed with network errors → already recorded failures above
    }

    logInfo('api.search.noResults', { query });
    return [];
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
      const res = await fetch(`${baseUrl}/api/stems?${params}`, {
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
      const res = await fetch(`${baseUrl}/api/stems`, {
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

    // Already have all stem variants locally in memory
    const existing = sanitizeStemSources(item.localStemUrls || item.stems);
    if (existing.vocalsUrl && existing.instrumentalUrl && existing.echoUrl && existing.distortionUrl) return;

    // Need at least a cachePath or name to identify the track
    if (!item.cachePath && !item.name) return;

    const cacheKey = getTrackCacheKey(item);

    // Skip persistent cache check for now - check if both stems are already in memory/session
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

  /**
   * Pre-fetches a track into the local cache without affecting item state.
   * Downloads via the API (which stores it server-side) and persists the blob
   * in browser Cache Storage, then immediately revokes the ephemeral blob URL.
   * Returns true on success, false if skipped or failed.
   */
  async function prefetchTrackToLocalCache(item) {
    if (!item?.name || !item?.artist) return false;
    if (apiHealthMonitor?.isOffline()) return false;

    const cacheKey = getTrackCacheKey(item);

    if (sessionBlobCache.has(cacheKey)) {
      logDebug('prefetch.skip.sessionCache', { cacheKey });
      return true;
    }

    const persisted = await restorePersistedAudioBlobUrl(cacheKey, audioCacheName).catch(() => null);
    if (persisted) {
      URL.revokeObjectURL(persisted);
      logDebug('prefetch.skip.persisted', { cacheKey });
      return true;
    }

    try {
      const result = await downloadTrackViaApi(item);
      if (result?.url) URL.revokeObjectURL(result.url);
      logInfo('prefetch.success', { cacheKey, name: item.name, artist: item.artist });
      return true;
    } catch (err) {
      logWarn('prefetch.failed', { cacheKey, name: item?.name, error: err?.message });
      return false;
    }
  }

  return {
    clearSessionBlobCache: () => clearSessionBlobCache(sessionBlobCache),
    deleteLocalCacheSong,
    enrichStemsFromServer,
    ensureLocalSource,
    evictTrackSource,
    prefetchTrackToLocalCache,
    releaseLocalBlob: (item) => releaseLocalBlob(item, touchQueueItem),
    searchTracksViaApi,
  };
}

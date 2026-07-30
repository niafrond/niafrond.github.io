import { createBlobStore } from './blobStore.js';
import { resolveArtworkUrlForRelay } from './downloaderConfig.js';

export async function resolveRelayArtworkUrl(item, artworkRef, options = {}) {
  const blobStore = options.blobStore || createBlobStore();
  const cacheKey = item?.id || item?.name || '';
  const resolvedRemoteUrl = resolveArtworkUrlForRelay(artworkRef, options.cdnBaseUrl || '', options.token || '');

  if (!cacheKey) {
    return resolvedRemoteUrl ? resolvedRemoteUrl : '';
  }

  const cachedBlob = await blobStore.getBlob('artwork', cacheKey);
  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob);
  }

  if (!resolvedRemoteUrl) {
    return '';
  }

  try {
    const res = await fetch(resolvedRemoteUrl);
    if (!res.ok) return resolvedRemoteUrl;
    const blob = await res.blob();
    if (!blob || blob.size <= 0) return resolvedRemoteUrl;
    await blobStore.putBlob('artwork', cacheKey, blob);
    return URL.createObjectURL(blob);
  } catch (_) {
    return resolvedRemoteUrl;
  }
}

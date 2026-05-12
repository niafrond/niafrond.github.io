import { createLogger } from './logger.js';

const logger = createLogger('storage');

export function saveQueueToStorage(options) {
  const {
    currentIndex,
    queue,
    storageKey,
  } = options;

  try {
    const serialized = {
      index: currentIndex,
      items: queue.map((item) => ({
        id: item.id,
        uri: item.uri,
        name: item.name,
        artist: item.artist,
        artUrl: item.artUrl,
        duration: item.duration,
        loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
        cachePath: item.cachePath || '',
        ratingKey: item.ratingKey || '',
        persistedSourceUrl: item.persistedSourceUrl || '',
        sourceState: item.sourceState === 'ready' ? 'idle' : item.sourceState,
      })),
    };
    localStorage.setItem(storageKey, JSON.stringify(serialized));
    logger.debug('queue.save.success', {
      storageKey,
      index: currentIndex,
      length: Array.isArray(queue) ? queue.length : 0,
    });
  } catch (_) {
    // ignore quota errors
    logger.warn('queue.save.failed', {
      storageKey,
    });
  }
}

export function restoreQueueFromStorage(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      logger.info('queue.restore.miss.emptyStorage', { storageKey });
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items) || !parsed.items.length) {
      logger.info('queue.restore.miss.emptyItems', { storageKey });
      return null;
    }

    const items = parsed.items.map((item) => ({
      ...item,
      sourceState: 'idle',
      sourceError: null,
      sourceMeta: null,
      localBlobUrl: null,
      cachePath: item.cachePath || '',
      loudnessDb: Number.isFinite(Number(item.loudnessDb)) ? Number(item.loudnessDb) : null,
      persistedSourceUrl: item.persistedSourceUrl || '',
      lastTouchedAt: Date.now(),
    }));

    const index = typeof parsed.index === 'number' ? Math.max(0, parsed.index) : 0;
    logger.info('queue.restore.success', {
      storageKey,
      index,
      length: items.length,
    });
    return {
      index,
      items,
    };
  } catch (_) {
    logger.warn('queue.restore.failed', {
      storageKey,
    });
    return null;
  }
}

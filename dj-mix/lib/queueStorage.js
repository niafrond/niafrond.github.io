import { createLogger } from './logger.js';

const logger = createLogger('storage');

// Champs "locaux à la liste" : décrivent pourquoi/comment un morceau est
// dans la queue, pas le morceau lui-même. Le reste des métadonnées vit dans
// le trackStore partagé (lib/trackStore.js, cf. SPECS.md §2.6).
function pickListLocalFields(item) {
  return {
    id: item.id,
    queueSource: item.queueSource || 'manual',
    autoDjReferenceTrackId: item.autoDjReferenceTrackId ?? null,
    autoDjStartOffsetMs: Number(item.autoDjStartOffsetMs) || 0,
  };
}

export function saveQueueToStorage(options) {
  const {
    currentIndex,
    queue,
    storageKey,
  } = options;

  try {
    const serialized = {
      index: currentIndex,
      items: queue.map(pickListLocalFields),
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

/**
 * Restaure la queue depuis localStorage. Résout chaque item (référence
 * `{id, ...}` au format allégé, ou item complet à l'ancien format riche) via
 * `trackStore.getOrCreate()` — cette étape absorbe indifféremment les deux
 * formats : un item riche persisté par une version antérieure de l'app
 * alimente le trackStore au lieu d'être perdu (cf. SPECS.md SPEC-2.6.7).
 * @param {string} storageKey
 * @param {{ getOrCreate: (raw: object) => object }} trackStore
 */
export function restoreQueueFromStorage(storageKey, trackStore) {
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

    const items = parsed.items.map((rawItem) => {
      const track = trackStore.getOrCreate(rawItem);
      track.queueSource = rawItem.queueSource || 'manual';
      track.autoDjReferenceTrackId = rawItem.autoDjReferenceTrackId ?? null;
      track.autoDjStartOffsetMs = Number(rawItem.autoDjStartOffsetMs) || 0;
      return track;
    });

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

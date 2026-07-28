/**
 * filRougeManager.js — Gestion de la playlist "fil rouge".
 *
 * La playlist fil rouge est une liste de morceaux qui joue en continu en
 * arrière-plan. Elle avance simplement dans l'ordre ou en shuffle.
 *
 * Logique :
 *   - nextTrack() : retourne le prochain morceau à jouer
 *     1. On prend le suivant dans la playlist fil rouge
 *   - La playlist fil rouge est persistée dans localStorage
 *   - L'index courant de la playlist fil rouge est aussi persisté
 */

import { createLogger } from './logger.js';
import { STORAGE_KEYS } from './storageKeys.js';
import { createTrackStore } from './trackStore.js';

const logger = createLogger('filRouge');

/**
 * @typedef {Object} FilRougeItem
 * @property {string|number} id
 * @property {string} name
 * @property {string} artist
 * @property {string} [artUrl]
 * @property {number} [duration]
 * @property {number|null} [bpm]
 * @property {string} [genre]
 * @property {string} [cachePath]
 * @property {string} [persistedSourceUrl]
 * @property {string} [ratingKey]
 * @property {string} [stemsStatus]
 * @property {Object} [stems]
 * @property {number|null} [danceability] - dançabilité 0–1 (Spotify audio features)
 * @property {number|null} [year] - année de sortie (ex. 2021)
 * @property {string|null} [djTrackId] - trackId résolu côté API DJ Planner (`/api/dj/*`)
 * @property {boolean} [djHasAnalysis] - reflète `hasFullAnalysis` du `/api/dj/tracks`
 * @property {Object|null} [djTransition] - résultat `/api/dj/transition` vers l'item suivant
 * @property {string|number} [djTransition.toItemId]
 * @property {string} [djTransition.transitionType]
 * @property {number} [djTransition.mixOutSec]
 * @property {number} [djTransition.mixInSec]
 * @property {number} [djTransition.recommendedBpm]
 * @property {number} [djTransition.crossfadeDurationSec]
 * @property {number} [djTransition.compatibilityScore]
 * @property {string} [djTransition.decisionId]
 * @property {number} [djTransition.computedAt]
 */

/**
 * @param {object} [options]
 * @param {ReturnType<typeof import('./trackStore.js').createTrackStore>} [options.trackStore]
 *   Registre partagé des morceaux (cf. SPECS.md §2.6). Si non fourni, cette instance
 *   crée et possède son propre trackStore (utile pour les tests) — dans ce cas elle
 *   se charge aussi de le restaurer depuis localStorage.
 */
export function createFilRougeManager(options = {}) {
  const ownsTrackStore = !options.trackStore;
  const trackStore = options.trackStore || createTrackStore();

  /** @type {FilRougeItem[]} */
  let playlist = [];

  /** @type {FilRougeItem[]} */
  let priorityQueue = [];

  /** Index courant dans la playlist fil rouge (-1 = pas encore commencé). */
  let currentIndex = -1;

  /** Indique si la lecture est en mode shuffle */
  let shuffleEnabled = false;

  /** Indique si la lecture boucle sur la playlist (true = reboucle en fin, false = s'arrête) */
  let loopEnabled = false;

  // ── Persistence ─────────────────────────────────────────────────────────

  function _saveNow() {
    try {
      const data = {
        playlist: playlist.map((item) => item.id),
        priorityQueue: priorityQueue.map((item) => item.id),
        currentIndex,
        shuffleEnabled,
        loopEnabled,
      };
      localStorage.setItem(STORAGE_KEYS.filRouge, JSON.stringify(data));
      logger.debug('filRouge.save.success', { playlistLength: playlist.length, currentIndex });
    } catch (_) {
      logger.warn('filRouge.save.failed');
    }
  }

  let _saveTimer = null;
  function scheduleSave() {
    if (_saveTimer !== null) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      _saveNow();
    }, 400);
  }

  /**
   * Résout un item persisté — soit une simple référence `id` (nouveau format
   * allégé), soit un item complet à l'ancien format riche — via le trackStore
   * partagé, qui absorbe indifféremment les deux formats (SPEC-2.6.7).
   */
  function resolveStoredItem(raw) {
    if (typeof raw === 'string') return trackStore.getOrCreate({ id: raw });
    return trackStore.getOrCreate(raw);
  }

  function restore() {
    // Ne restaure le trackStore que si cette instance le possède : un trackStore
    // injecté (partagé avec la Queue) est déjà restauré par son propriétaire —
    // le refaire ici écraserait des enregistrements pas encore flush (debounce).
    if (ownsTrackStore) trackStore.restore();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.filRouge);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.playlist)) {
        playlist = data.playlist.map(resolveStoredItem);
      }
      if (Array.isArray(data.priorityQueue)) {
        priorityQueue = data.priorityQueue.map(resolveStoredItem);
      }
      if (typeof data.currentIndex === 'number') {
        currentIndex = data.currentIndex;
      }
      if (typeof data.shuffleEnabled === 'boolean') {
        shuffleEnabled = data.shuffleEnabled;
      }
      if (typeof data.loopEnabled === 'boolean') {
        loopEnabled = data.loopEnabled;
      }
      logger.info('filRouge.restore.success', { playlistLength: playlist.length, currentIndex });
    } catch (_) {
      logger.warn('filRouge.restore.failed');
    }
  }

  // ── Playlist fil rouge ──────────────────────────────────────────────────

  /**
   * Ajoute un morceau à la playlist fil rouge.
   * @param {FilRougeItem} item
   * @returns {boolean} true si ajouté, false si doublon
   */
  function addToPlaylist(item) {
    if (!item) return false;
    const isDuplicate = playlist.some(
      (p) => p.id === item.id || (p.name === item.name && p.artist === item.artist)
    );
    if (isDuplicate) {
      logger.debug('filRouge.addToPlaylist.duplicate', { name: item.name });
      return false;
    }
    playlist.push(trackStore.getOrCreate(item));
    logger.info('filRouge.addToPlaylist', { name: item.name, playlistLength: playlist.length });
    scheduleSave();
    return true;
  }

  /**
   * Ajoute un morceau a la file prioritaire.
   * @param {FilRougeItem} item
   * @returns {boolean} true si ajoute, false si doublon
   */
  function addToPriorityQueue(item) {
    if (!item) return false;
    const isDuplicate = priorityQueue.some(
      (p) => p.id === item.id || (p.name === item.name && p.artist === item.artist)
    );
    if (isDuplicate) {
      logger.debug('filRouge.addToPriorityQueue.duplicate', { name: item.name });
      return false;
    }
    priorityQueue.push(trackStore.getOrCreate(item));
    logger.info('filRouge.addToPriorityQueue', { name: item.name, priorityLength: priorityQueue.length });
    scheduleSave();
    return true;
  }

  /**
   * Supprime un morceau de la file prioritaire par index.
   * @param {number} index
   */
  function removeFromPriorityQueue(index) {
    if (index < 0 || index >= priorityQueue.length) return;
    const removed = priorityQueue.splice(index, 1)[0];
    logger.info('filRouge.removeFromPriorityQueue', { name: removed?.name, priorityLength: priorityQueue.length });
    scheduleSave();
  }

  /**
   * Vide la file prioritaire.
   */
  function clearPriorityQueue() {
    priorityQueue = [];
    logger.info('filRouge.clearPriorityQueue');
    scheduleSave();
  }

  /**
   * Supprime un morceau de la playlist fil rouge par index.
   * @param {number} index
   */
  function removeFromPlaylist(index) {
    if (index < 0 || index >= playlist.length) return;
    const removed = playlist.splice(index, 1)[0];
    // Adjust currentIndex if needed
    if (currentIndex >= playlist.length) {
      currentIndex = playlist.length > 0 ? 0 : -1;
    } else if (index < currentIndex) {
      currentIndex = Math.max(0, currentIndex - 1);
    }
    logger.info('filRouge.removeFromPlaylist', { name: removed?.name, playlistLength: playlist.length });
    scheduleSave();
  }

  /**
   * Met à jour des champs d'un morceau de la playlist en le cherchant par id.
   * @param {string|number} id
   * @param {Partial<FilRougeItem>} patch
   * @returns {boolean} true si l'item a été trouvé et modifié
   */
  function patchPlaylistItem(id, patch) {
    const idx = playlist.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    // Mutation via trackStore.patch (pas Object.assign direct) : la playlist
    // référence désormais l'enregistrement partagé — cela suffit à rendre le
    // correctif visible depuis la Queue si le morceau y est aussi présent, ET
    // à déclencher la persistence du trackStore (dj-mix:tracks).
    trackStore.patch(id, patch);
    return true;
  }

  /**
   * Met à jour des champs d'un morceau du trackStore partagé, qu'il soit
   * actuellement dans la playlist fil rouge ou non (ex: uniquement dans la
   * file d'attente). Contrairement à `patchPlaylistItem`, ne vérifie pas
   * l'appartenance à `playlist` — seule l'existence de l'enregistrement dans
   * le trackStore partagé (Queue et Fil Rouge) est requise.
   * @param {string|number} id
   * @param {Partial<FilRougeItem>} patch
   * @returns {boolean} true si l'enregistrement existait et a été modifié
   */
  function patchTrackById(id, patch) {
    return trackStore.patch(id, patch);
  }

  /**
   * Vide la playlist fil rouge.
   */
  function clearPlaylist() {
    playlist = [];
    currentIndex = -1;
    logger.info('filRouge.clearPlaylist');
    scheduleSave();
  }

  /**
   * Remplace la playlist entière par un nouveau tableau d'items.
   * Tente de conserver currentIndex sur le même morceau (par id) après le remplacement.
   * @param {FilRougeItem[]} items
   */
  function setPlaylist(items) {
    const prevId = playlist[currentIndex]?.id;
    playlist = (Array.isArray(items) ? items : []).map((item) => trackStore.getOrCreate(item));
    if (prevId != null) {
      const newIdx = playlist.findIndex(i => i.id === prevId);
      if (newIdx !== -1) {
        currentIndex = newIdx;
      } else {
        currentIndex = playlist.length > 0 ? Math.min(currentIndex, playlist.length - 1) : -1;
      }
    } else {
      currentIndex = playlist.length > 0 ? currentIndex : -1;
    }
    logger.info('filRouge.setPlaylist', { playlistLength: playlist.length, currentIndex });
    scheduleSave();
  }

  /**
   * Déplace un élément de la playlist fil rouge.
   */
  function reorderPlaylist(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= playlist.length) return;
    if (toIndex < 0 || toIndex >= playlist.length) return;
    const [item] = playlist.splice(fromIndex, 1);
    playlist.splice(toIndex, 0, item);
    // Adjust currentIndex if it was affected
    if (currentIndex === fromIndex) {
      currentIndex = toIndex;
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      currentIndex -= 1;
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      currentIndex += 1;
    }
    scheduleSave();
  }

  // ── Sélection du prochain morceau ──────────────────────────────────────

  /**
   * Retourne le prochain morceau à lire.
  *   1. Avance dans la playlist fil rouge et retourne le suivant
   *
   * @returns {FilRougeItem|null}
   */
  function getNextTrack() {
    if (priorityQueue.length > 0) {
      const nextPriority = priorityQueue.shift() || null;
      scheduleSave();
      if (!nextPriority) return null;
      logger.info('filRouge.getNextTrack.fromPriorityQueue', {
        name: nextPriority.name,
        priorityLength: priorityQueue.length,
      });
      nextPriority.lastTouchedAt = Date.now();
      return nextPriority;
    }

    if (playlist.length === 0) {
      logger.debug('filRouge.getNextTrack.empty');
      return null;
    }

    if (shuffleEnabled) {
      const randomIndex = Math.floor(Math.random() * playlist.length);
      currentIndex = randomIndex;
    } else {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= playlist.length) {
        if (!loopEnabled) {
          logger.info('filRouge.getNextTrack.endOfPlaylist.loopOff');
          return null;
        }
        currentIndex = 0;
      } else {
        currentIndex = nextIndex;
      }
    }

    const next = playlist[currentIndex];
    logger.info('filRouge.getNextTrack.fromPlaylist', {
      name: next?.name,
      index: currentIndex,
      playlistLength: playlist.length,
    });
    scheduleSave();
    if (!next) return null;
    next.lastTouchedAt = Date.now();
    return next;
  }

  /**
   * Peek: retourne le prochain morceau sans avancer l'index.
   * @returns {FilRougeItem|null}
   */
  function peekNextTrack() {
    if (playlist.length === 0) return null;
    if (shuffleEnabled) return playlist[0] || null; // can't predict shuffle
    const peekIndex = currentIndex + 1;
    if (peekIndex >= playlist.length) {
      return loopEnabled ? (playlist[0] || null) : null;
    }
    return playlist[peekIndex] || null;
  }

  /**
   * Peek: retourne le prochain morceau sans avancer l'index.
   * Vérifie d'abord la file prioritaire, puis la playlist.
   * @returns {FilRougeItem|null}
   */
  function peekNextTrackFromAny() {
    if (priorityQueue.length > 0) {
      priorityQueue[0].lastTouchedAt = Date.now();
      return priorityQueue[0];
    }
    return peekNextTrack();
  }

  /**
   * Indique si le fil rouge est actif (a des morceaux).
   */
  function isActive() {
    return playlist.length > 0;
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  function getPlaylist() {
    return playlist.slice();
  }

  function getPlaylistLength() {
    return playlist.length;
  }

  function getPriorityQueue() {
    return priorityQueue.slice();
  }

  function getPriorityQueueLength() {
    return priorityQueue.length;
  }

  function getCurrentIndex() {
    return currentIndex;
  }

  /**
   * Positionne l'index courant sur un morceau specifique de la playlist.
   * @param {number} index
   * @returns {boolean} true si index valide, sinon false
   */
  function setCurrentIndex(index) {
    if (!Number.isInteger(index)) return false;
    if (index < 0 || index >= playlist.length) return false;
    currentIndex = index;
    scheduleSave();
    return true;
  }

  /**
   * Positionne le fil rouge pour que le prochain appel à getNextTrack() retourne le morceau
   * à targetIdx. Tous les morceaux situés entre la position courante et targetIdx sont sautés.
   * @param {number} targetIdx - index du morceau à jouer en prochain
   * @returns {boolean} true si le saut a été effectué, false si l'index est invalide
   */
  function jumpToIndex(targetIdx) {
    if (!Number.isInteger(targetIdx)) return false;
    if (targetIdx < 0 || targetIdx >= playlist.length) return false;
    // Positionner à targetIdx - 1 pour que getNextTrack() retourne targetIdx
    const prevIndex = currentIndex;
    currentIndex = targetIdx - 1;
    logger.info('filRouge.jumpToIndex', { targetIdx, from: prevIndex, skippedCount: targetIdx - prevIndex - 1 });
    scheduleSave();
    return true;
  }

  function isShuffleEnabled() {
    return shuffleEnabled;
  }

  function toggleShuffle() {
    shuffleEnabled = !shuffleEnabled;
    scheduleSave();
    return shuffleEnabled;
  }

  function isLoopEnabled() {
    return loopEnabled;
  }

  function setLoopEnabled(value) {
    loopEnabled = Boolean(value);
    scheduleSave();
    return loopEnabled;
  }

  // ── Initialisation ─────────────────────────────────────────────────────

  restore();

  return {
    // Playlist fil rouge
    addToPlaylist,
    addToPriorityQueue,
    patchPlaylistItem,
    patchTrackById,
    removeFromPlaylist,
    setPlaylist,
    removeFromPriorityQueue,
    clearPlaylist,
    clearPriorityQueue,
    reorderPlaylist,
    getPlaylist,
    getPlaylistLength,
    getPriorityQueue,
    getPriorityQueueLength,
    getCurrentIndex,
    setCurrentIndex,
    jumpToIndex,

    // Lecture
    getNextTrack,
    peekNextTrack,
    peekNextTrackFromAny,
    isActive,

    // Shuffle
    isShuffleEnabled,
    toggleShuffle,

    // Loop
    isLoopEnabled,
    setLoopEnabled,

    // Persistence
    save: () => { _saveNow(); trackStore.save(); },
    restore,
  };
}

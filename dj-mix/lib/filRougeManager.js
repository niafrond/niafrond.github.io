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
 */

export function createFilRougeManager() {
  /** @type {FilRougeItem[]} */
  let playlist = [];

  /** @type {FilRougeItem[]} */
  let priorityQueue = [];

  /** Index courant dans la playlist fil rouge (-1 = pas encore commencé). */
  let currentIndex = -1;

  /** Indique si la lecture est en mode shuffle */
  let shuffleEnabled = false;

  // ── Persistence ─────────────────────────────────────────────────────────

  function save() {
    try {
      const data = {
        playlist: playlist.map(serializeItem),
        priorityQueue: priorityQueue.map(serializeItem),
        currentIndex,
        shuffleEnabled,
      };
      localStorage.setItem(STORAGE_KEYS.filRouge, JSON.stringify(data));
      logger.debug('filRouge.save.success', { playlistLength: playlist.length, currentIndex });
    } catch (_) {
      logger.warn('filRouge.save.failed');
    }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.filRouge);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.playlist)) {
        playlist = data.playlist.map(deserializeItem);
      }
      if (Array.isArray(data.priorityQueue)) {
        priorityQueue = data.priorityQueue.map(deserializeItem);
      }
      if (typeof data.currentIndex === 'number') {
        currentIndex = data.currentIndex;
      }
      if (typeof data.shuffleEnabled === 'boolean') {
        shuffleEnabled = data.shuffleEnabled;
      }
      logger.info('filRouge.restore.success', { playlistLength: playlist.length, currentIndex });
    } catch (_) {
      logger.warn('filRouge.restore.failed');
    }
  }

  function serializeItem(item) {
    return {
      id: item.id,
      name: item.name,
      artist: item.artist,
      artUrl: item.artUrl || '',
      duration: item.duration || 0,
      bpm: item.bpm || null,
      genre: item.genre || '',
      cachePath: item.cachePath || '',
      persistedSourceUrl: item.persistedSourceUrl || '',
      ratingKey: item.ratingKey || '',
      stemsStatus: item.stemsStatus || '',
      stems: item.stems || null,
    };
  }

  function deserializeItem(raw) {
    return {
      ...raw,
      sourceState: 'idle',
      sourceError: null,
      sourceMeta: null,
      localBlobUrl: null,
      lastTouchedAt: Date.now(),
    };
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
    playlist.push(deserializeItem(serializeItem(item)));
    logger.info('filRouge.addToPlaylist', { name: item.name, playlistLength: playlist.length });
    save();
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
    priorityQueue.push(deserializeItem(serializeItem(item)));
    logger.info('filRouge.addToPriorityQueue', { name: item.name, priorityLength: priorityQueue.length });
    save();
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
    save();
  }

  /**
   * Vide la file prioritaire.
   */
  function clearPriorityQueue() {
    priorityQueue = [];
    logger.info('filRouge.clearPriorityQueue');
    save();
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
    save();
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
    Object.assign(playlist[idx], patch);
    save();
    return true;
  }

  /**
   * Vide la playlist fil rouge.
   */
  function clearPlaylist() {
    playlist = [];
    currentIndex = -1;
    logger.info('filRouge.clearPlaylist');
    save();
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
    save();
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
      save();
      if (!nextPriority) return null;
      logger.info('filRouge.getNextTrack.fromPriorityQueue', {
        name: nextPriority.name,
        priorityLength: priorityQueue.length,
      });
      return { ...nextPriority, lastTouchedAt: Date.now() };
    }

    if (playlist.length === 0) {
      logger.debug('filRouge.getNextTrack.empty');
      return null;
    }

    if (shuffleEnabled) {
      const randomIndex = Math.floor(Math.random() * playlist.length);
      currentIndex = randomIndex;
    } else {
      currentIndex = (currentIndex + 1) % playlist.length;
    }

    const next = playlist[currentIndex];
    logger.info('filRouge.getNextTrack.fromPlaylist', {
      name: next?.name,
      index: currentIndex,
      playlistLength: playlist.length,
    });
    save();
    return next ? { ...next, lastTouchedAt: Date.now() } : null;
  }

  /**
   * Peek: retourne le prochain morceau sans avancer l'index.
   * @returns {FilRougeItem|null}
   */
  function peekNextTrack() {
    if (playlist.length === 0) return null;
    const peekIndex = shuffleEnabled
      ? 0 // can't predict shuffle
      : (currentIndex + 1) % playlist.length;
    return playlist[peekIndex] || null;
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
    save();
    return true;
  }

  function isShuffleEnabled() {
    return shuffleEnabled;
  }

  function toggleShuffle() {
    shuffleEnabled = !shuffleEnabled;
    save();
    return shuffleEnabled;
  }

  // ── Initialisation ─────────────────────────────────────────────────────

  restore();

  return {
    // Playlist fil rouge
    addToPlaylist,
    addToPriorityQueue,
    patchPlaylistItem,
    removeFromPlaylist,
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

    // Lecture
    getNextTrack,
    peekNextTrack,
    isActive,

    // Shuffle
    isShuffleEnabled,
    toggleShuffle,

    // Persistence
    save,
    restore,
  };
}

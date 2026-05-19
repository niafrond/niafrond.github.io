/**
 * uiState.js — État centralisé de l'interface DJ Mix.
 *
 * Regroupe les informations sur la file d'attente, les platines et le
 * crossfader. Ce module est un singleton mutable : les autres modules
 * importent l'objet `uiState` et le lisent/modifient directement.
 *
 * Nomenclature des platines :
 *   - Platine A = deck 'A'
 *   - Platine B = deck 'B'
 */

/**
 * @typedef {Object} DeckDisplayItem
 * @property {string|number} id
 * @property {string} name
 * @property {string} [artist]
 * @property {string} [artUrl]
 * @property {number} [duration]   secondes
 * @property {number} [bpm]
 * @property {number} [loudnessDb]
 * @property {string} [genre]
 */

/**
 * @typedef {Object} LiveDeckState
 * @property {boolean} playing
 * @property {number}  volume        0–1
 * @property {number}  positionMs
 * @property {number}  durationMs
 * @property {number}  playbackRate
 * @property {boolean} hasSrc
 * @property {number|null} loudnessDb
 */

/**
 * @typedef {Object} DeckStateDetail
 * @property {'A'|'B'}       activeDeck
 * @property {boolean}       isCrossfading
 * @property {LiveDeckState} deckA
 * @property {LiveDeckState} deckB
 */

/**
 * État global de l'interface. Peut être lu et modifié par n'importe quel
 * module qui l'importe.
 *
 * @type {{
 *   queue: DeckDisplayItem[],
 *   currentIndex: number,
 *   currentTrackId: string|number|null,
 *   isPlaying: boolean,
 *
 *   deckDisplayItems: { A: DeckDisplayItem|null, B: DeckDisplayItem|null },
 *   deckBCueIndex: number,
 *   deckCueDeck: 'A'|'B'|null,
 *   deckMixRatio: number,
 *   prevIsCrossfading: boolean,
 *
 *   lastDeckState: DeckStateDetail|null,
 * }}
 */
export const uiState = {
  // ── File d'attente ──────────────────────────────────────────────────────
  /** Tracks en file d'attente (ordre de lecture). */
  queue: [],

  /** Index de la piste en cours dans `queue` (-1 si aucune). */
  currentIndex: -1,

  /** Id de la piste en cours (null si aucune). */
  currentTrackId: null,

  /** true si une lecture est active. */
  isPlaying: false,

  // ── Platines ────────────────────────────────────────────────────────────
  /**
   * Piste actuellement chargée sur chaque platine.
   * null si la platine est vide.
   */
  deckDisplayItems: { A: null, B: null },

  /**
   * Index dans `queue` de la piste en attente (cue) sur la platine
   * secondaire. -1 si aucun cue.
   */
  deckBCueIndex: -1,

  /**
   * Quelle platine est en mode cue ('A', 'B' ou null).
   * @type {'A'|'B'|null}
   */
  deckCueDeck: null,

  /**
   * Position du crossfader : 0 = platine A seule, 1 = platine B seule.
   */
  deckMixRatio: 0,

  /**
   * État du crossfade lors du dernier rendu (pour détecter la fin du fade).
   */
  prevIsCrossfading: false,

  // ── État temps-réel des platines (émis par DJPlayer via 'deckstate') ───
  /**
   * Dernière valeur reçue de l'event 'deckstate' du DJPlayer.
   * Contient les volumes, positions, durées, etc. pour les deux decks.
   * @type {DeckStateDetail|null}
   */
  lastDeckState: null,
};

// ── Helpers de lecture rapide ────────────────────────────────────────────────

/** Renvoie la piste actuellement en cours de lecture (deck actif). */
export function getCurrentTrack() {
  if (uiState.currentIndex < 0) return null;
  return uiState.queue[uiState.currentIndex] ?? null;
}

/** Renvoie la piste chargée sur la platine indiquée. */
export function getDeckItem(deck) {
  return uiState.deckDisplayItems[deck] ?? null;
}

/** Renvoie l'état temps-réel d'une platine (depuis le dernier deckstate). */
export function getLiveDeckState(deck) {
  const s = uiState.lastDeckState;
  if (!s) return null;
  return deck === 'B' ? s.deckB : s.deckA;
}

/**
 * Renvoie la platine dominante (celle dont le volume est le plus fort),
 * ou 'A' par défaut.
 * @returns {'A'|'B'}
 */
export function getDominantDeck() {
  const s = uiState.lastDeckState;
  if (!s) return 'A';
  return (s.deckB?.volume ?? 0) > (s.deckA?.volume ?? 0) ? 'B' : 'A';
}

/** Renvoie la platine inactive (celle dont le volume est le plus faible). */
export function getInactiveDeckFromState() {
  return getDominantDeck() === 'A' ? 'B' : 'A';
}

/**
 * Renvoie la piste en attente (cue) si elle est définie dans la queue.
 * @returns {DeckDisplayItem|null}
 */
export function getCueTrack() {
  const { deckBCueIndex, queue } = uiState;
  if (deckBCueIndex < 0 || deckBCueIndex >= queue.length) return null;
  return queue[deckBCueIndex] ?? null;
}

/**
 * state.js — État partagé et utilitaires de persistance
 *
 * Contient :
 *  - clientState : état côté client (commun hôte et joueur)
 *  - Clés localStorage et helpers de session / classement / questions posées
 */

import { PHASE, MODE } from './constants.js';

// ─── État global client (partagé hôte et client) ─────────────────────────────

export const clientState = {
  myId: null,
  myName: '',
  isHost: false,
  hostPeerId: null,
  players: [],
  phase: PHASE.LOBBY,
  currentQuestion: null,
  currentIndex: 0,
  total: 0,
  buzzQueue: [],
  eliminatedPlayers: [], // IDs ayant répondu faux en QCM
  selfEliminated: false, // Le joueur local a déjà répondu faux sur cette question (QCM)
  lastResult: null,
  finalScores: [],
  mode: MODE.QCM,
  config: {},
  showAnswerToHost: false,
  hostIsReader: false,
  // Nouvelles fonctionnalités
  doubleDownActive: false, // double ou rien activé par le joueur local
  myBet: null,             // pari secret du joueur local
  myTarget: null,          // cible cachée du joueur local
  betDeadline: null,       // deadline du pari secret
  hostIsAnimateur: false,  // mode animateur (révélation manuelle de la réponse)
  questionSkipped: false,  // la question courante a été passée
};

// ─── Clés localStorage ───────────────────────────────────────────────────────

export const STORAGE_KEY      = 'quiz_session';
export const PLAYER_NAME_KEY  = 'quiz_player_name';
export const LEADERBOARD_KEY  = 'quiz_leaderboard';
export const PARTY_ASKED_KEY  = 'party_asked_questions';
export const HOST_SESSION_KEY = 'quiz_host_session';

/** Durée de vie d'une session hôte : 1 heure */
export const HOST_SESSION_TTL = 60 * 60 * 1000;

// ─── Session (reconnexion) ───────────────────────────────────────────────────

export function saveSession(hostPeerId, playerName) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ hostPeerId, playerName })); } catch (_) {}
}

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); } catch (_) { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

// ─── Session hôte (persistance de l'ID de pair sur 1 heure) ─────────────────

/** Sauvegarde le peer ID de l'hôte avec l'horodatage courant. */
export function saveHostSession(peerId) {
  try { localStorage.setItem(HOST_SESSION_KEY, JSON.stringify({ peerId, savedAt: Date.now() })); } catch (_) {}
}

/**
 * Charge le peer ID hôte s'il est encore valide (< HOST_SESSION_TTL).
 * Purge automatiquement l'entrée si elle est expirée.
 * @returns {string|null} peerId ou null
 */
export function loadHostSession() {
  try {
    const data = JSON.parse(localStorage.getItem(HOST_SESSION_KEY) ?? 'null');
    if (!data) return null;
    if (Date.now() - data.savedAt > HOST_SESSION_TTL) {
      clearHostSession();
      return null;
    }
    return data.peerId;
  } catch (_) {
    return null;
  }
}

/** Supprime la session hôte stockée. */
export function clearHostSession() {
  try { localStorage.removeItem(HOST_SESSION_KEY); } catch (_) {}
}

// ─── Classement localStorage ─────────────────────────────────────────────────

export function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) ?? '[]'); } catch (_) { return []; }
}

export function saveToLeaderboard(scores) {
  try {
    const entries = loadLeaderboard();
    const date = new Date().toLocaleDateString('fr-FR');
    scores.forEach(({ name, score }) => {
      if (name && score > 0) entries.push({ name, score, date });
    });
    entries.sort((a, b) => b.score - a.score);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch (_) {}
}

// ─── Suivi des questions déjà posées (mode Party) ─────────────────────────────

export function loadAskedQuestions() {
  try { return new Set(JSON.parse(localStorage.getItem(PARTY_ASKED_KEY) ?? '[]')); } catch (_) { return new Set(); }
}

export function saveAskedQuestions(ids) {
  try {
    const prev = loadAskedQuestions();
    ids.forEach(id => prev.add(id));
    // Garder max 300 pour éviter de saturer le localStorage
    const arr = [...prev].slice(-300);
    localStorage.setItem(PARTY_ASKED_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('[Party] Impossible de sauvegarder les questions posées :', err?.message);
  }
}

/** Trie les questions pour mettre les non-posées en premier. */
export function prioritizeUnasked(questions) {
  const asked = loadAskedQuestions();
  const unasked = questions.filter(q => q.id && !asked.has(q.id));
  const already  = questions.filter(q => !q.id || asked.has(q.id));
  return [...unasked, ...already];
}

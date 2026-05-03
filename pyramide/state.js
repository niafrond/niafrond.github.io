/**
 * state.js — Constantes et état global du jeu Pyramide
 */

// ─── Clés localStorage ─────────────────────────────────────────────────────────
export const PLAYERS_KEY        = 'pyramide_players';
export const TURN_DURATION_KEY  = 'pyramide_turn_duration';
export const WORD_COUNT_KEY     = 'pyramide_word_count';
export const ENABLE_ROUND5_KEY  = 'pyramide_enable_round5';
export const THEME_KEY          = 'pyramide_theme';

// ─── Valeurs par défaut ────────────────────────────────────────────────────────
export const TURN_DURATION_DEFAULT = 60;
export const WORD_COUNT_DEFAULT    = 20;
export const MIN_PLAYERS           = 2;
export const CLICK_COOLDOWN        = 500;

// ─── Équipes (toujours 2 équipes) ──────────────────────────────────────────────
export const TEAMS_META = [
  { color: 'var(--volcan)', label: 'Équipe Rouge' },
  { color: 'var(--lagon)',  label: 'Équipe Bleue'  },
];

// ─── Écrans de gameplay ────────────────────────────────────────────────────────
export const GAMEPLAY_SCREENS = new Set([
  'screen-turn',
]);

// ─── Contenu des règles par manche ────────────────────────────────────────────
export const PRE_ROUND_CONTENT = {
  1: {
    title:      'Manche 1 — Description libre',
    icon:       '🗣️',
    doText:     'Décrivez le mot librement : synonymes, exemples, anecdotes, gestes…',
    forbidText: 'Le mot lui-même, ou tout mot de la même famille',
    special:    null,
  },
  2: {
    title:      'Manche 2 — Un seul mot',
    icon:       '☝️',
    doText:     'Donnez UN SEUL mot comme indice. Un seul par essai.',
    forbidText: 'Plusieurs mots, variantes ou déclinaisons du même mot',
    special:    null,
  },
  3: {
    title:      'Manche 3 — Expressions',
    icon:       '💬',
    doText:     'Faites deviner une expression complète (locution, proverbe, titre, citation…)',
    forbidText: 'Utiliser les mots contenus dans l\'expression à deviner',
    special:    null,
  },
  4: {
    title:      'Manche 4 — Pyramide',
    icon:       '🔺',
    doText:     'Les mots doivent être devinés DANS L\'ORDRE affiché. Pas de saut.',
    forbidText: 'Passer au mot suivant sans avoir deviné le mot en cours',
    special:    '⛔ Le bouton « Passer » est désactivé dans cette manche.',
  },
  5: {
    title:      'Manche 5 — Finale',
    icon:       '🏆',
    doText:     'Deux phases : d\'abord description libre, puis un seul mot.',
    forbidText: 'Voir les règles des manches 1 et 2',
    special:    'Les mêmes mots sont réutilisés.',
  },
};

// ─── État global ───────────────────────────────────────────────────────────────
export const state = {
  // Joueurs
  playerNames: [],

  // Équipes
  teams: [],
  currentTeamIdx: 0,

  // Réglages
  turnDuration:  TURN_DURATION_DEFAULT,
  wordCount:     WORD_COUNT_DEFAULT,
  enableRound5:  false,

  // Progression de partie
  currentRound:          1,   // 1–5
  currentPhase:          1,   // 1 ou 2 (utilisé pour la manche 5)
  teamsPlayedThisRound:  0,

  // Mots
  allWords:          [],   // pool fixe pour les manches 1, 2, 4, 5
  expressionWords:   [],   // pool fixe pour la manche 3 (expressions idiomatiques)
  currentTurnWords:  [],   // ordre des mots pour le tour en cours
  currentWordIdx:    0,

  // Suivi du tour
  foundWordsThisTurn:    [],
  skippedWordsThisTurn:  [],
  contestedClues:        [],  // [{ word, accepted }]

  // Timer
  timeLeft:      TURN_DURATION_DEFAULT,
  timerInterval: null,
  timerPaused:   false,
};

// ─── Anti-double-clic ──────────────────────────────────────────────────────────
export function withCooldown(fn) {
  let lastClick = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastClick < CLICK_COOLDOWN) return;
    lastClick = now;
    fn.apply(this, args);
  };
}

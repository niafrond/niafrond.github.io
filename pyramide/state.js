/**
 * state.js — Constantes et état global du jeu Pyramide
 */

// ─── Clés localStorage ─────────────────────────────────────────────────────────
export const PLAYERS_KEY        = 'pyramide_players';
export const TURN_DURATION_KEY  = 'pyramide_turn_duration';
export const WORD_COUNT_KEY     = 'pyramide_word_count';
export const ENABLE_ROUND5_KEY  = 'pyramide_enable_round5';
export const THEME_KEY          = 'pyramide_theme';
export const GAME_MODE_KEY      = 'pyramide_game_mode';

// ─── Valeurs par défaut ────────────────────────────────────────────────────────
export const TURN_DURATION_DEFAULT = 60;
export const WORD_COUNT_DEFAULT    = 20;
export const MIN_PLAYERS           = 2;
export const CLICK_COOLDOWN        = 500;

// ─── Mode Officiel (TV) — Constantes ──────────────────────────────────────────
export const ENIGMES_BRICKS      = 13;
export const ENIGMES_WORD_COUNT  = 5;
export const PINGPONG_BRICKS     = 13;
export const PINGPONG_WORD_COUNT = 5;
export const NP_WORD_COUNT       = 3;
export const NP_MAX_BID          = 3;
export const NP_FAIL_BONUS       = 1;   // +1 adversaire si échec bid > 1
export const NP_FAIL_BONUS_1     = 2;   // +2 adversaire si échec bid = 1
export const CLM_TIMER           = 30;
export const CLM_WORD_COUNT      = 7;
export const FINAL_TIMER         = 60;
export const FINAL_BONUS_TIME    = 10;
export const FINAL_WORD_COUNT    = 6;
export const CLUE_TIMER          = 10;

// ─── Mode Officiel — Définition des manches ────────────────────────────────────
export const V2_ROUNDS = [
  { id: 'enigmes',        label: 'Les Énigmes',        icon: '🧩', num: 1 },
  { id: 'pingpong',       label: 'Ping-Pong',          icon: '🏓', num: 2 },
  { id: 'nomspropres',    label: 'Les Noms Propres',   icon: '👤', num: 3 },
  { id: 'contrelamontre', label: 'Contre-la-Montre',   icon: '⏱️', num: 4 },
  { id: 'grandepyramide', label: 'La Grande Pyramide', icon: '🏆', num: 5 },
];

// ─── Mode Officiel — Contenu des écrans pré-manche ────────────────────────────
export const V2_PRE_ROUND_CONTENT = {
  enigmes: {
    title:      'Manche 1 — Les Énigmes',
    icon:       '🧩',
    doText:     '1 brique = 1 mot-indice. Donnez vos indices un par un. Le candidat a 10 secondes pour deviner après chaque indice.',
    forbidText: 'Mots de la même famille étymologique que le mot à deviner.',
    special:    '🧱 13 briques pour 5 mots. Bonus : briques restantes si tous trouvés !',
  },
  pingpong: {
    title:      'Manche 2 — Ping-Pong',
    icon:       '🏓',
    doText:     'Les équipes alternent pour donner les indices. L\'adversaire devine. 1 brique = 1 indice.',
    forbidText: 'Donner plusieurs mots d\'un coup ou passer son tour.',
    special:    '🏓 13 briques partagées pour 5 mots. +1 pour l\'équipe qui devine correctement.',
  },
  nomspropres: {
    title:      'Manche 3 — Les Noms Propres',
    icon:       '👤',
    doText:     'Faites deviner des noms propres (personnes, lieux, œuvres…). Enchérissez le nombre de briques.',
    forbidText: 'Utiliser des mots de la même famille ou donner les initiales seules.',
    special:    '⚖️ Enchères 1-3 briques. Moins = vous donnez les indices. Échec avec 1 brique = +2 pour l\'adversaire !',
  },
  contrelamontre: {
    title:      'Manche 4 — Contre-la-Montre',
    icon:       '⏱️',
    doText:     'Faites deviner le maximum de mots en 30 secondes. Indices libres (phrases, mimiques).',
    forbidText: 'Dire le mot lui-même ou un mot de la même famille.',
    special:    '⚡ Thème imposé. 7 mots. 30 secondes. Pas de briques.',
  },
  grandepyramide: {
    title:      'La Grande Pyramide',
    icon:       '🏆',
    doText:     'Faites deviner 6 expressions en 60 secondes. Phrases complètes et mimiques autorisées.',
    forbidText: 'Mots de la même famille que les mots de l\'expression. Passer est INTERDIT.',
    special:    '🏆 Trouvez les 6 expressions = jackpot ! Tout indice invalide = élimination immédiate.',
  },
};

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

  // Mode de jeu
  gameMode: 'classique',  // 'classique' | 'officiel'

  // ── Mode Classique ────────────────────────────────────────────────────────
  currentRound:          1,   // 1–5
  currentPhase:          1,   // 1 ou 2 (manche 5)
  teamsPlayedThisRound:  0,

  allWords:          [],
  currentTurnWords:  [],
  currentWordIdx:    0,

  foundWordsThisTurn:    [],
  skippedWordsThisTurn:  [],
  contestedClues:        [],

  timeLeft:      TURN_DURATION_DEFAULT,
  timerInterval: null,
  timerPaused:   false,

  // ── Mode Officiel (V2 — TV show) ──────────────────────────────────────────
  v2RoundIdx:    0,         // index dans V2_ROUNDS (0–4)
  v2TeamPlayed:  0,         // équipes ayant joué ce round V2
  v2WordSets:    null,      // { enigmes:{teamA,teamB}, pingpong:[], nomspropres:{theme,words}, clm:{teamA,teamB}, final:[] }

  bricksRemaining:  0,      // briques restantes pour la manche en cours
  cluePending:      false,  // true = brique utilisée, on attend que le candidat devine

  pingpongClueTeam: 0,      // équipe qui donne l'indice actuellement (Round 2)

  bidState: null,           // { bids:[null,null] } pour la manche 3
  npCurrentWord:   0,       // index du nom propre en cours (manche 3)
  npClueTeamIdx:   0,       // équipe qui donne les indices (gagnant enchères)
  npMaxBricks:     3,       // nb max de briques = valeur de l'enchère gagnante
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

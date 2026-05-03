/**
 * main.js — Jeu Pyramide
 *
 * Jeu de devinettes inspiré de l'émission TV "Pyramide".
 * Flux : setup → teams → pre-turn → turn → turn-end → [game-over]
 *
 * 2 équipes, pyramide de 5 niveaux (15 mots), minuterie par tour.
 * Chaque équipe a sa propre progression sur la pyramide.
 * Les équipes alternent leurs tours.
 *
 * Manches disponibles :
 *   - Libre          : pyramide 5 niveaux, 15 mots
 *   - Énigmes        : 5 mots, 13 briques max, 10 s/brique
 *   - Contre-la-montre : 7 mots d'un thème, 30 s
 *   - Noms propres   : enchères + 3 noms liés par thème
 *   - Grande Pyramide : finaliste seul, 6 mots, 60 s + 10 s bonus
 */

import { getGameWords, CATEGORIES, shuffle,
         getEnigmesWords, getContreLaMontre,
         getNomsPropreSet, getGrandePyramideWords } from './words.js';
import {
  playTick, playTickUrgent, playBuzzer, playFound, playLevelUp,
  playGameStart, playButtonClick, playSkip, playGameOver,
  playPyramidComplete, setMuted, getMuted,
} from './sound.js';
import { getVersion, getBuildDate } from '../version.js';
import {
  toggleFullscreen, updateFullscreenBtn, installPwa,
  initServiceWorker, initAutoFullscreen, initApkDownloadLink,
  checkApkUpdate, doApkUpdate, checkPendingReload,
} from './pwa.js';

// ─── Constantes ────────────────────────────────────────────────────────────────
const MIN_PLAYERS = 2;
const CLICK_COOLDOWN = 400;  // ms entre deux clics

const KIDS_MODE_KEY = 'pyramide_kids_mode';

/**
 * Structure de la pyramide :
 * Niveau 0 (bas) : indices 0-4   — 5 mots — 1 pt chacun
 * Niveau 1       : indices 5-8   — 4 mots — 2 pts chacun
 * Niveau 2       : indices 9-11  — 3 mots — 3 pts chacun
 * Niveau 3       : indices 12-13 — 2 mots — 4 pts chacun
 * Niveau 4 (haut): index 14      — 1 mot  — 5 pts
 */
const PYRAMID_ROWS = [
  { indices: [0, 1, 2, 3, 4], pts: 1 },
  { indices: [5, 6, 7, 8],    pts: 2 },
  { indices: [9, 10, 11],     pts: 3 },
  { indices: [12, 13],        pts: 4 },
  { indices: [14],            pts: 5 },
];
const TOTAL_WORDS = 15;

/**
 * Disposition en pyramide pour les modes avec peu de mots.
 * Les rangées sont ordonnées bas → haut (index 0 = rangée du bas la plus large).
 * Le rendu visuellement inverse cet ordre (sommet en haut, base en bas).
 * Ex. pour 3 mots : [[0,1], [2]] → 2 cellules en bas, 1 au sommet.
 */
const MINI_PYRAMID_ROWS = {
  3: [[0, 1], [2]],
  5: [[0, 1, 2], [3, 4]],
  6: [[0, 1, 2], [3, 4], [5]],
  7: [[0, 1, 2, 3], [4, 5, 6]],
};

const TURN_DURATION_KEY  = 'pyramide_turn_duration';
const TURNS_PER_TEAM_KEY = 'pyramide_turns_per_team';
const PLAYERS_KEY        = 'pyramide_players';
const SCORES_KEY         = 'pyramide_scores';
const GAME_MODE_KEY      = 'pyramide_game_mode';

const TEAM_COLORS = ['--team1', '--team2'];
const TEAM_NAMES  = ['Équipe 1', 'Équipe 2'];

// ─── Constantes mode Noms propres ──────────────────────────────────────────────
const NP_FAIL_BONUS           = 1;   // pts pour l'adversaire si enchère > 1 brique et échec
const NP_FAIL_BONUS_ONE_BRICK = 2;   // pts pour l'adversaire si enchère 1 brique et échec

// ─── Configurations des manches ────────────────────────────────────────────────
const GAME_MODES = {
  enigmes: {
    label: '🧩 Les Énigmes',
    desc: '5 mots à faire deviner avec 13 briques maximum. 10 secondes par brique. Score : 1 pt/mot + briques non utilisées.',
    wordCount: 5,
    bricksLimit: 13,
    brickTimer: true,    // timer de 10 s par brique (pas de timer global)
    showPyramid: false,
  },
  contrelamontre: {
    label: '⏱️ Contre-la-montre',
    desc: '7 mots d\'un même thème à faire deviner en 30 secondes. Les équipes jouent en alternance.',
    wordCount: 7,
    timerDuration: 30,
    showPyramid: false,
  },
  nomspropres: {
    label: '🏷️ Noms propres',
    desc: '3 noms propres liés par un thème. Enchères : annoncez en combien de briques vous réussirez (max 3). L\'adversaire peut surenchérir.',
    wordCount: 3,
    noTimer: true,
    showPyramid: false,
  },
  grandepyramide: {
    label: '🏆 La Grande Pyramide',
    desc: 'Le finaliste fait deviner 6 mots en 1 minute. Phrases et mimiques autorisées. Un bonus de +10 secondes est disponible.',
    wordCount: 6,
    timerDuration: 60,
    extraTime: 10,
    showPyramid: false,
    solo: true,
  },
  libre: {
    label: '🔺 Mode libre',
    desc: 'Pyramide classique : 5 niveaux, 15 mots, durée configurable. Chaque équipe gravit sa propre pyramide.',
    wordCount: 15,
    showPyramid: true,
  },
  officielle: {
    label: '🏛️ Mode officiel',
    desc: '5 manches progressives avec arbitrage des joueurs : indices libres, un seul mot, expression, pyramide, finale. Minimum 4 joueurs.',
    wordCount: 8,
    showPyramid: false,
  },
};

// ─── Configuration des manches Mode officiel (V2) ──────────────────────────────
const V2_ROUNDS = [
  {
    id: 1, type: 'free_clue', emoji: '💬', label: 'Indices libres',
    words: 8, time: 45,
    rule: '<strong>Tout est permis</strong> : phrases, gestes, mimiques…',
    desc: '8 mots, 45 secondes. Tous les types d\'indices sont autorisés.',
    ruleShort: 'Tout est permis : phrases, gestes, mimiques…',
  },
  {
    id: 2, type: 'one_word', emoji: '1️⃣', label: 'Un seul mot',
    words: 8, time: 45,
    rule: '<strong>Un seul mot</strong> par indice. Phrases et gestes interdits.',
    desc: '8 mots, 45 secondes. Chaque indice = exactement un seul mot.',
    ruleShort: 'Un seul mot par indice. Phrases interdites.',
  },
  {
    id: 3, type: 'expression', emoji: '💡', label: 'En expression',
    words: 4, time: 60,
    rule: 'Indice = <strong>une expression consacrée</strong> (ex : « avoir le cafard »). Pas d\'autres mots.',
    desc: '4 mots, 60 secondes. Chaque indice = une expression figée de la langue.',
    ruleShort: 'Indice = une expression figée uniquement.',
  },
  {
    id: 4, type: 'pyramid', emoji: '🔺', label: 'La Pyramide',
    words: 6, time: 60,
    rule: '<strong>Un mot par brique</strong>. Un seul indice à la fois, mot à mot.',
    desc: '6 mots, 60 secondes. Style pyramide TV : un mot par indice, une brique à la fois.',
    ruleShort: 'Un mot par brique. Un seul indice à la fois.',
  },
  {
    id: 5, type: 'final', emoji: '🏆', label: 'La Finale',
    words: 6, time: 60,
    rule: '<strong>Phrases complètes</strong> et mimiques autorisées. Un mot par brique.',
    desc: '6 mots, 60 secondes. Manche finale : tout est permis !',
    ruleShort: 'Phrases et mimiques OK. Un indice par brique.',
    optional: true,
  },
];

// ─── État global ────────────────────────────────────────────────────────────────
const state = {
  // Setup
  playerNames: [],
  gameMode: 'enigmes',        // manche courante
  playingAll: true,           // true = jouer toutes les manches (partie complète)
  kidsMode: false,            // mode enfant

  // Game
  teams: null,         // [{name, color, players, words:[n mots], found:[false×n], score, describerIdx}]

  currentTeamIdx: 0,
  turnsDone: [0, 0],
  turnsPerTeam: 2,
  gameOver: false,

  // Turn state
  turnQueue: [],
  turnQueuePos: 0,
  turnFoundThisTurn: [],
  timeLeft: 60,
  timerInterval: null,

  // Options
  turnDuration: 60,

  // ── Briques (Modes Énigmes & Noms propres) ──────────────────────────────
  bricksUsed: 0,
  bricksLimit: 13,

  // ── Mode Contre-la-montre ────────────────────────────────────────────────
  clmUsedCats: new Set(), // catégories déjà jouées (évite les répétitions entre tours)

  // ── Mode Noms propres ────────────────────────────────────────────────────
  npNames: [],           // noms propres de la session
  npNamePos: 0,          // nom en cours (0-indexed)
  npTheme: '',
  npNamesCount: 3,       // nombre de noms par session
  npBidderTeam: 0,       // équipe qui enchérit en premier ce nom
  npBid1: 0,             // enchère de l'équipe 1
  npBidWinner: 0,        // équipe qui a remporté l'enchère
  npBidAmount: 3,        // briques autorisées (résultat de l'enchère)
  npUsedThemes: new Set(),

  // ── Mode Grande Pyramide ─────────────────────────────────────────────────
  gpExtraTimeUsed: false,
  gpFinalistName: '',

  // ── Mode officiel (V2) ──────────────────────────────────────────────────
  v2RoundIdx: 0,          // index courant dans V2_ROUNDS
  v2CurrentRound: null,   // V2_ROUNDS[v2RoundIdx]
  v2UsedWords: null,      // Set des mots déjà utilisés (évite les répétitions)
};

// ─── Utilitaires ────────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function withCooldown(fn) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last < CLICK_COOLDOWN) return;
    last = now;
    fn.apply(this, args);
  };
}

let _toastTimer = null;
function showToast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

const GAME_SCREENS = new Set([
  'screen-teams', 'screen-pre-round',
  'screen-pre-turn', 'screen-turn', 'screen-turn-end', 'screen-game-over', 'screen-bid',
]);

const SHOW_CLOSE_BTN_SCREENS = new Set([
  'screen-pre-turn', 'screen-turn', 'screen-turn-end', 'screen-bid',
]);

// ─── Ordre des manches (enchainement automatique) ───────────────────────────────
const MANCHE_ORDER = ['enigmes', 'contrelamontre', 'nomspropres', 'grandepyramide', 'libre'];

// ─── Contenu des écrans pré-manche ─────────────────────────────────────────────
const PRE_ROUND_CONTENT = {
  enigmes: {
    icon: '🧩',
    title: 'Les Énigmes',
    rules: [
      '5 mots à faire deviner',
      '13 briques au maximum — 10 secondes par brique',
      'Chaque brique = 1 indice ou idée',
      'Score : 1 pt par mot + briques non utilisées',
      'Pas de synonymes, traductions ni gestes',
    ],
  },
  contrelamontre: {
    icon: '⏱️',
    title: 'Contre-la-montre',
    rules: [
      '7 mots d\'un même thème secret',
      '30 secondes pour tous les faire deviner',
      'Toutes les descriptions sont autorisées (phrases, mimes…)',
      'Score : 1 pt par mot trouvé',
    ],
  },
  nomspropres: {
    icon: '🏷️',
    title: 'Noms propres',
    rules: [
      '3 noms propres liés par un thème commun',
      'Enchères : chaque équipe annonce en combien de briques elle peut réussir',
      'L\'adversaire peut surenchérir (moins de briques = défi plus difficile)',
      'Échec → l\'adversaire gagne des points bonus',
    ],
  },
  grandepyramide: {
    icon: '🏆',
    title: 'La Grande Pyramide',
    rules: [
      'Le finaliste doit deviner 6 mots en 1 minute',
      'Les maître-mots décrivent les mots un par un',
      'Phrases complètes et mimiques autorisées ✅',
      'Un bonus de +10 secondes est disponible une seule fois',
    ],
  },
  libre: {
    icon: '🔺',
    title: 'Mode Libre',
    rules: [
      'Pyramide classique : 5 niveaux, 15 mots',
      'Chaque équipe gravit sa propre pyramide',
      'Montez niveau par niveau pour marquer plus de points',
      'Points : +1 pt (bas) jusqu\'à +5 pts (sommet)',
      'Pas de synonymes, traductions ni épelage',
    ],
  },
  officielle: {
    icon: '🏛️',
    title: 'Mode officiel',
    rules: [
      '5 manches progressives : indices libres → un mot → expression → pyramide → finale',
      'Chaque manche a ses propres règles sur le type d\'indices autorisés',
      'Manche 1 (Indices libres) : tout est permis — phrases, gestes, mimiques',
      'Manche 2 (Un seul mot) : un seul mot par indice, pas de phrases',
      'Manche 3 (Expression) : l\'indice doit être une expression figée',
      'Manche 4 (Pyramide) : un seul indice à la fois, mot par mot',
      'Manche 5 (Finale) : phrases et mimiques OK, un indice par brique',
    ],
  },
};

// ─── Navigation avec historique ────────────────────────────────────────────────
const NAV_SCREENS = new Set(['screen-setup', 'screen-leaderboard', 'screen-settings']);

let _currentScreen = 'screen-setup';

function getCurrentScreen() { return _currentScreen; }

function _applyScreen(id) {
  _currentScreen = id;
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  el(id).hidden = false;
  const isNav    = NAV_SCREENS.has(id);
  const isGame   = GAME_SCREENS.has(id);
  el('btn-theme').hidden      = isGame;
  el('btn-mute').hidden       = isGame;
  el('btn-fullscreen').hidden = isGame;
  el('bottom-nav').hidden     = !isNav;
  el('btn-game-close').hidden = !SHOW_CLOSE_BTN_SCREENS.has(id);
  // Highlight active tab
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('bottom-nav-item--active', btn.dataset.tab === id);
  });
}

function showScreen(id) {
  _applyScreen(id);

  // Mise à jour de l'URL sans rechargement (permet la touche Retour)
  if (!GAME_SCREENS.has(id) && id !== 'screen-teams') {
    history.pushState({ screen: id }, '', `#${id}`);
  }

  // Rafraîchir le classement à chaque ouverture de l'écran
  if (id === 'screen-leaderboard') renderScoreboard();

  // Déclencher un rechargement SW différé si on quitte le gameplay
  checkPendingReload(id, GAME_SCREENS);
}

// ─── Persistance options ────────────────────────────────────────────────────────
function loadOptions() {
  try {
    const d = parseInt(localStorage.getItem(TURN_DURATION_KEY), 10);
    if ([30, 45, 60, 90].includes(d)) state.turnDuration = d;
    const t = parseInt(localStorage.getItem(TURNS_PER_TEAM_KEY), 10);
    if ([1, 2, 3].includes(t)) state.turnsPerTeam = t;
    // Toujours démarrer en "partie complète" par défaut ; on ignore les modes
    // individuels sauvegardés lors des sessions précédentes.
    state.playingAll = true;
    state.gameMode = MANCHE_ORDER[0];
  } catch (_) {}
}

function saveOptions() {
  try {
    localStorage.setItem(TURN_DURATION_KEY, String(state.turnDuration));
    localStorage.setItem(TURNS_PER_TEAM_KEY, String(state.turnsPerTeam));
    localStorage.setItem(GAME_MODE_KEY, state.playingAll ? 'all' : state.gameMode);
  } catch (_) {}
}

// ─── Persistance mode enfant ────────────────────────────────────────────────────
function loadKidsMode() {
  try { return localStorage.getItem(KIDS_MODE_KEY) === '1'; } catch (_) { return false; }
}

function saveKidsMode(v) {
  try { localStorage.setItem(KIDS_MODE_KEY, v ? '1' : '0'); } catch (_) {}
}

function updateKidsModeUI() {
  const btn = el('toggle-kids-mode');
  if (!btn) return;
  btn.textContent = state.kidsMode ? 'ON' : 'OFF';
  btn.className = `kids-mode-toggle-btn${state.kidsMode ? ' kids-mode-toggle-btn--on' : ''}`;
  btn.setAttribute('aria-checked', String(state.kidsMode));
}

function toggleKidsMode() {
  state.kidsMode = !state.kidsMode;
  saveKidsMode(state.kidsMode);
  updateKidsModeUI();
}

// ─── Persistance joueurs ────────────────────────────────────────────────────────
function loadPlayers() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYERS_KEY) || '[]');
    if (Array.isArray(saved)) {
      state.playerNames = saved.filter(n => typeof n === 'string' && n.length > 0);
    }
  } catch (_) {}
}

function savePlayers() {
  try {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(state.playerNames));
  } catch (_) {}
}

// ─── Persistance scores ─────────────────────────────────────────────────────────
function loadScores() {
  try {
    const saved = JSON.parse(localStorage.getItem(SCORES_KEY) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
  } catch (_) {}
  return {};
}

function saveGameScores() {
  if (!state.teams) return;
  const scores = loadScores();
  state.teams.forEach(team => {
    team.players.forEach(player => {
      scores[player] = (scores[player] || 0) + team.score;
    });
  });
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch (_) {}
  renderScoreboard();
}

function resetScores() {
  try { localStorage.removeItem(SCORES_KEY); } catch (_) {}
  renderScoreboard();
}

function renderScoreboard() {
  const list  = el('scoreboard-list');
  const empty = el('leaderboard-empty');
  if (!list) return;
  const scores  = loadScores();
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  list.innerHTML = '';
  if (entries.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  entries.forEach(([name, score], idx) => {
    const medals = ['🥇', '🥈', '🥉'];
    const medal = idx < medals.length ? medals[idx] : `${idx + 1}.`;
    const item = document.createElement('div');
    item.className = 'scoreboard-item';

    const rankEl = document.createElement('span');
    rankEl.className = 'scoreboard-rank';
    rankEl.textContent = medal;

    const nameEl = document.createElement('span');
    nameEl.className = 'scoreboard-name';
    nameEl.textContent = name;

    const scoreEl = document.createElement('span');
    scoreEl.className = 'scoreboard-score';
    scoreEl.textContent = `${score} pts`;

    item.appendChild(rankEl);
    item.appendChild(nameEl);
    item.appendChild(scoreEl);
    list.appendChild(item);
  });
}

// ─── Pré-manche : affiche les règles avant chaque manche ───────────────────────
function showPreRound() {
  const mode    = state.gameMode;

  // Mode officiel : afficher les règles de la sous-manche courante
  if (mode === 'officielle' && state.v2CurrentRound) {
    const round = state.v2CurrentRound;
    el('pre-round-icon').textContent  = round.emoji;
    el('pre-round-title').textContent = `Manche ${round.id} — ${round.label}`;

    const ul = el('pre-round-rules');
    ul.innerHTML = '';
    const rules = [
      round.desc,
      `Règle : ${round.ruleShort}`,
      'Après chaque mot trouvé, les juges (équipe adverse) votent sur l\'indice',
      'Indice INVALIDE : point annulé | DOUTEUX : point en attente (correction après le tour)',
    ];
    rules.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });

    const numEl = el('pre-round-manche-num');
    if (numEl) {
      numEl.textContent = `Sous-manche ${round.id} / ${V2_ROUNDS.length}`;
      numEl.hidden = false;
    }
    const backBtn = el('btn-pre-round-back');
    if (backBtn) backBtn.textContent = '← Retour au menu';

    _applyScreen('screen-pre-round');
    return;
  }

  const content = PRE_ROUND_CONTENT[mode] || { icon: '🔺', title: mode, rules: [] };

  el('pre-round-icon').textContent  = content.icon;
  el('pre-round-title').textContent = content.title;

  const ul = el('pre-round-rules');
  ul.innerHTML = '';
  content.rules.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  });

  // Numéro de manche dans la séquence (affiché uniquement en partie complète)
  const idx    = MANCHE_ORDER.indexOf(mode);
  const numEl  = el('pre-round-manche-num');
  if (numEl) {
    if (state.playingAll) {
      numEl.textContent = `Manche ${idx + 1} / ${MANCHE_ORDER.length}`;
      numEl.hidden      = false;
    } else {
      numEl.hidden = true;
    }
  }

  // Bouton retour
  const backBtn = el('btn-pre-round-back');
  if (backBtn) {
    backBtn.textContent = state.playingAll ? '← Annuler la partie' : '← Choisir une autre manche';
  }

  _applyScreen('screen-pre-round');
  // pas de pushState → la touche Retour reviendra à setup
}

// ─── Enchainement des manches ───────────────────────────────────────────────────
function isLastManche() {
  return state.playingAll && MANCHE_ORDER.indexOf(state.gameMode) === MANCHE_ORDER.length - 1;
}

function nextManche() {
  const idx  = MANCHE_ORDER.indexOf(state.gameMode);
  // En partie complète, retour à l'accueil après la dernière manche
  if (isLastManche()) {
    state.gameMode = MANCHE_ORDER[0];
    saveOptions();
    updateModeUI();
    showToast('🎊 Partie complète terminée !');
    showScreen('screen-setup');
    return;
  }
  const next = MANCHE_ORDER[(idx + 1) % MANCHE_ORDER.length];
  state.gameMode = next;
  saveOptions();
  updateModeUI();
  showPreRound();
}

// ─── Gestion du mode de jeu ─────────────────────────────────────────────────────
function updateModeUI() {
  const mode = state.gameMode;

  // Highlight active mode button
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active',
      state.playingAll ? btn.dataset.mode === 'all' : btn.dataset.mode === mode,
    );
  });

  // Description
  if (state.playingAll) {
    el('mode-desc').textContent = "Joue toutes les manches dans l'ordre : Énigmes, Contre-la-montre, Noms propres, Grande Pyramide, Mode libre.";
  } else {
    el('mode-desc').textContent = GAME_MODES[mode].desc;
  }

  // Show/hide mode-specific options (duration/turns now live in settings)
  el('np-names-row').hidden  = (mode !== 'nomspropres' || state.playingAll);
  el('finalist-row').hidden  = (mode !== 'grandepyramide' || state.playingAll);

  // Update start button label
  const startBtn = el('btn-start-game');
  if (startBtn) {
    if (state.playingAll) {
      startBtn.textContent = '🎯 Lancer la partie complète';
    } else {
      startBtn.textContent = mode === 'grandepyramide' ? '🏆 Lancer la Grande Pyramide' : '🔺 Lancer la partie';
    }
  }

  // Refresh finalist select
}

function updateFinalistSelect() {
  const sel = el('select-finalist');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Choisir --</option>';
  state.playerNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  // Restore previous selection if still valid
  if (state.gpFinalistName && state.playerNames.includes(state.gpFinalistName)) {
    sel.value = state.gpFinalistName;
  }
}

function selectMode(mode) {
  if (mode === 'all') {
    state.playingAll = true;
    state.gameMode = MANCHE_ORDER[0];
  } else {
    state.playingAll = false;
    state.gameMode = mode;
  }
  saveOptions();
  updateModeUI();
  renderPlayerList(); // re-check start button
}

// ─── Pyramide helpers ───────────────────────────────────────────────────────────
/** Retourne le niveau actuel (la rangée la plus basse avec des mots non trouvés). */
function getTeamCurrentRow(found) {
  for (let r = 0; r < PYRAMID_ROWS.length; r++) {
    if (PYRAMID_ROWS[r].indices.some(i => !found[i])) return r;
  }
  return PYRAMID_ROWS.length; // pyramide complète
}

/** Construit la file de mots à deviner pour le tour en cours. */
function buildTurnQueue(found) {
  const row = getTeamCurrentRow(found);
  if (row >= PYRAMID_ROWS.length) return [];
  return PYRAMID_ROWS[row].indices.filter(i => !found[i]);
}

/** Calcule le score total d'une équipe depuis son tableau found[]. */
function computeScore(found) {
  let score = 0;
  for (const { indices, pts } of PYRAMID_ROWS) {
    for (const i of indices) {
      if (found[i]) score += pts;
    }
  }
  return score;
}

// ─── Rendu pyramide ─────────────────────────────────────────────────────────────
/**
 * Construit le HTML d'une pyramide.
 * @param {boolean[]} found       - état des 15 mots
 * @param {number}    currentIdx  - index du mot actuel (-1 = aucun)
 * @param {string[]}  wordLabels  - libellés des 15 mots (affiché si found)
 * @param {boolean}   showPts     - afficher les labels de points
 */
function buildPyramidHTML(found, currentIdx, wordLabels, showPts = true) {
  const currentRow = getTeamCurrentRow(found);
  let html = '<div class="pyramid-outer">';

  if (showPts) {
    html += '<div class="pyramid-pts-labels">';
    for (const { pts } of PYRAMID_ROWS) {
      html += `<div class="pts-label">+${pts}pt</div>`;
    }
    html += '</div>';
  }

  html += '<div class="pyramid">';

  // Rows from top to bottom visually (reverse order)
  for (let r = PYRAMID_ROWS.length - 1; r >= 0; r--) {
    const { indices } = PYRAMID_ROWS[r];
    html += '<div class="pyramid-row">';
    for (const i of indices) {
      let cls = 'pyramid-cell ';
      if (found[i]) {
        cls += 'cell-found';
      } else if (i === currentIdx) {
        cls += 'cell-current';
      } else if (r === currentRow) {
        cls += 'cell-pending';
      } else {
        cls += 'cell-locked';
      }

      const label = found[i] ? truncate(wordLabels[i], 12) : (i === currentIdx ? '?' : '?');
      html += `<div class="${cls}" title="${wordLabels[i]}">${found[i] ? label : '?'}</div>`;
    }
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

function truncate(str, max) {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

/**
 * Construit le HTML d'une mini-pyramide pour les modes non-libre (3, 5, 6, 7 mots).
 * @param {boolean[]} found      - état des mots (true = trouvé)
 * @param {number}    currentIdx - index du mot actuel (-1 = aucun)
 */
function buildMiniPyramidHTML(found, currentIdx = -1) {
  const total    = found.length;
  const rows     = MINI_PYRAMID_ROWS[total];
  const foundCnt = found.filter(Boolean).length;

  let html = '<div class="mini-pyramid-wrapper">';
  html += '<div class="pyramid mini-pyramid">';

  if (rows) {
    // Rendu du sommet vers la base (reverse rows)
    for (let r = rows.length - 1; r >= 0; r--) {
      html += '<div class="pyramid-row">';
      for (const i of rows[r]) {
        let cls = 'pyramid-cell ';
        if (found[i])       cls += 'cell-found';
        else if (i === currentIdx) cls += 'cell-current';
        else                cls += 'cell-pending';
        html += `<div class="${cls}"></div>`;
      }
      html += '</div>';
    }
  } else {
    // Fallback : rangée unique
    html += '<div class="pyramid-row">';
    for (let i = 0; i < total; i++) {
      let cls = 'pyramid-cell ';
      if (found[i])       cls += 'cell-found';
      else if (i === currentIdx) cls += 'cell-current';
      else                cls += 'cell-pending';
      html += `<div class="${cls}"></div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  html += `<div class="wp-count">${foundCnt}\u00a0/\u00a0${total}</div>`;
  html += '</div>';
  return html;
}

// ─── ÉCRAN SETUP ───────────────────────────────────────────────────────────────
function renderPlayerList() {
  const list = el('player-list');
  list.innerHTML = '';
  state.playerNames.forEach((name, i) => {
    const item = document.createElement('div');
    item.className = 'player-item';

    const span = document.createElement('span');
    span.className = 'player-item-name';
    span.textContent = `👤 ${name}`;

    const btn = document.createElement('button');
    btn.className = 'btn-icon btn-danger';
    btn.setAttribute('aria-label', `Retirer ${name}`);
    btn.textContent = '✕';
    btn.addEventListener('click', () => removePlayer(i));

    item.appendChild(span);
    item.appendChild(btn);
    list.appendChild(item);
  });

  const count = state.playerNames.length;
  const countEl = el('player-count');
  if (count > 0) {
    countEl.textContent = `${count} joueur${count > 1 ? 's' : ''}`;
    countEl.hidden = false;
  } else {
    countEl.textContent = '';
    countEl.hidden = true;
  }

  // Check start conditions based on mode
  let canStart = count >= MIN_PLAYERS;
  const hints = [];
  if (count < MIN_PLAYERS) hints.push(`Minimum ${MIN_PLAYERS} joueurs requis`);

  if (!state.playingAll && state.gameMode === 'grandepyramide') {
    const finalist = el('select-finalist')?.value;
    if (!finalist) {
      canStart = false;
      hints.push('Sélectionnez un finaliste');
    }
  }

  el('btn-start-game').disabled = !canStart;
  const hint = el('setup-hint');
  if (hints.length > 0) {
    hint.textContent = hints.join(' — ');
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }

  // Update finalist select if needed
  if (!state.playingAll && state.gameMode === 'grandepyramide') updateFinalistSelect();
}

function addPlayer() {
  const input = el('player-input');
  const name = input.value.trim();
  if (!name) { showToast('Entrez un prénom'); return; }
  if (state.playerNames.includes(name)) { showToast('Ce joueur est déjà dans la liste'); return; }
  if (state.playerNames.length >= 12) { showToast('Maximum 12 joueurs'); return; }
  state.playerNames.push(name);
  input.value = '';
  input.focus();
  savePlayers();
  renderPlayerList();
}

function removePlayer(idx) {
  state.playerNames.splice(idx, 1);
  savePlayers();
  renderPlayerList();
}

// ─── COMPOSITION DES ÉQUIPES ────────────────────────────────────────────────────
function assignTeams() {
  const shuffled = shuffle([...state.playerNames]);
  // For Grande Pyramide: finalist is team 0, rest are team 1 (describers)
  if (state.gameMode === 'grandepyramide') {
    const finalist = state.gpFinalistName || state.playerNames[0];
    const others = state.playerNames.filter(p => p !== finalist);
    state.teams = [
      { name: 'Finaliste', colorVar: TEAM_COLORS[0], players: [finalist], found: [], score: 0, describerIdx: 0 },
      { name: 'Maître-mots', colorVar: TEAM_COLORS[1], players: others.length ? others : [finalist], found: [], score: 0, describerIdx: 0 },
    ];
    return;
  }
  state.teams = [0, 1].map((i) => ({
    name:         TEAM_NAMES[i],
    colorVar:     TEAM_COLORS[i],
    players:      shuffled.filter((_, idx) => idx % 2 === i),
    found:        [],
    score:        0,
    describerIdx: 0,
  }));
}

function renderTeams() {
  const grid = el('teams-grid');
  grid.innerHTML = '';
  state.teams.forEach((team) => {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.style.setProperty('--team-color', `var(${team.colorVar})`);
    card.innerHTML = `
      <div class="team-card-name">${team.name}</div>
      <div class="team-card-players">${team.players.map(p => '👤 ' + p).join('<br>')}</div>
    `;
    grid.appendChild(card);
  });
}

function goToTeams() {
  // Read np-names count
  const npNamesEl = el('select-np-names');
  state.npNamesCount = npNamesEl ? parseInt(npNamesEl.value, 10) || 3 : 3;

  // Read finalist name
  if (state.gameMode === 'grandepyramide') {
    state.gpFinalistName = el('select-finalist')?.value || state.playerNames[0] || '';
  }

  assignTeams();

  state.turnsDone = [0, 0];
  state.currentTeamIdx = 0;
  state.gameOver = false;

  const mode = state.gameMode;

  if (mode === 'libre') {
    const words0 = getGameWords(new Set(), state.kidsMode);
    const words1 = getGameWords(new Set(words0.map(w => w.word)), state.kidsMode);
    state.teams.forEach((t, i) => {
      t.words = i === 0 ? words0 : words1;
      t.found = new Array(TOTAL_WORDS).fill(false);
      t.score = 0;
      t.describerIdx = 0;
    });

  } else if (mode === 'enigmes') {
    const words0 = getEnigmesWords(new Set(), state.kidsMode);
    const words1 = getEnigmesWords(new Set(words0.map(w => w.word)), state.kidsMode);
    state.teams.forEach((t, i) => {
      t.words = i === 0 ? words0 : words1;
      t.found = new Array(5).fill(false);
      t.score = 0;
      t.describerIdx = 0;
    });

  } else if (mode === 'contrelamontre') {
    state.clmUsedCats = new Set();
    state.teams.forEach((t) => {
      const { cat, catInfo, words } = getContreLaMontre(state.clmUsedCats, state.kidsMode);
      state.clmUsedCats.add(cat);
      t.words = words;
      t.clmCat = cat;
      t.clmCatInfo = catInfo;
      t.found = new Array(7).fill(false);
      t.score = 0;
      t.describerIdx = 0;
    });

  } else if (mode === 'nomspropres') {
    state.npUsedThemes = new Set();
    const { theme, names } = getNomsPropreSet(state.npUsedThemes);
    state.npUsedThemes.add(theme);
    state.npTheme = theme;
    state.npNames = names;
    state.npNamePos = 0;
    state.npBidderTeam = 0;
    // teams share the same names — words stored on state, not per-team
    state.teams.forEach((t) => {
      t.words = [];
      t.found = [];
      t.score = 0;
      t.describerIdx = 0;
    });

  } else if (mode === 'grandepyramide') {
    const words = getGrandePyramideWords(state.kidsMode);
    state.teams[0].words = words;
    state.teams[0].found = new Array(6).fill(false);
    state.teams[0].score = 0;
    state.teams[0].describerIdx = 0;
    // team 1 (maître-mots) doesn't have their own words
    state.teams[1].words = words;
    state.teams[1].found = new Array(6).fill(false);
    state.teams[1].score = 0;
    state.teams[1].describerIdx = 0;
    state.gpExtraTimeUsed = false;

  } else if (mode === 'officielle') {
    // Initialise le mode officiel : démarre à la manche 1
    state.v2RoundIdx = 0;
    state.v2UsedWords = new Set();
    state.teams.forEach((t) => {
      t.words = [];
      t.found = [];
      t.score = 0;
      t.describerIdx = 0;
    });
    initV2Round();
  }

  renderTeams();
  // Mettre à jour le texte d'info de la page équipes selon le mode
  _updateTeamsModeInfo(mode);
  showScreen('screen-teams');
}

// ─── PRÉ-TOUR ─────────────────────────────────────────────────────────────────
/** Met à jour le bloc d'info de la page équipes selon le mode joué. */
function _updateTeamsModeInfo(mode) {
  const modeInfoEl = el('teams-mode-info');
  if (!modeInfoEl) return;
  // GAME_MODES.*.wordCount et state.npNamesCount sont toujours des entiers (pas de risque XSS).
  const npCount = Number(state.npNamesCount);
  const MODE_INFO = {
    enigmes:        `🧩 <strong style="color:var(--text)">${GAME_MODES.enigmes.wordCount} mots</strong> à faire deviner avec des briques<br>Score : 1 pt/mot + briques non utilisées`,
    contrelamontre: `⏱️ <strong style="color:var(--text)">${GAME_MODES.contrelamontre.wordCount} mots</strong> d'un même thème secret à deviner en <strong style="color:var(--text)">30 secondes</strong>`,
    nomspropres:    `🏷️ <strong style="color:var(--text)">${npCount} noms propres</strong> liés par un thème commun — enchères par briques`,
    grandepyramide: `🏆 Le finaliste doit deviner <strong style="color:var(--text)">${GAME_MODES.grandepyramide.wordCount} mots</strong> en <strong style="color:var(--text)">1 minute</strong><br>Phrases complètes et mimiques autorisées ✅`,
    libre:          `🔺 La pyramide a <strong style="color:var(--text)">5 niveaux</strong> et <strong style="color:var(--text)">15 mots</strong>.<br>Chaque équipe gravit sa propre pyramide.<br>Points : +1 pt (bas) → +5 pts (sommet) 🏆`,
    officielle:     `🏛️ <strong style="color:var(--text)">5 manches progressives</strong> : indices libres → un mot → expression → pyramide → finale`,
  };
  modeInfoEl.innerHTML = MODE_INFO[mode] || MODE_INFO.libre;
}

function startPreTurn() {
  const mode = state.gameMode;
  const team = state.teams[state.currentTeamIdx];
  const describer = team.players[team.describerIdx % team.players.length];

  // Color the screen for this team
  const preWrap = el('pre-turn-wrapper');
  preWrap.style.setProperty('--team-color', `var(${team.colorVar})`);

  if (mode === 'grandepyramide') {
    el('pre-turn-header').textContent = '🏆 La Grande Pyramide';
    const finalist = state.teams[0].players[0];
    const describers = state.teams[1].players;
    el('pre-turn-describe').innerHTML =
      `<strong>${finalist}</strong> est le/la finaliste<br>` +
      `<span style="font-size:0.9rem">Maître-mots : <strong>${describers.join(' & ')}</strong></span><br>` +
      `<span style="font-size:0.82rem;color:var(--text-muted)">Phrases & mimiques autorisées ✅</span>`;
    el('pre-turn-turn-info').textContent = '1 minute pour deviner 6 mots';
  } else if (mode === 'nomspropres') {
    el('pre-turn-header').textContent = `Noms propres — Thème`;
    el('pre-turn-describe').innerHTML =
      `<strong style="color:var(--gold)">${state.npTheme}</strong><br>` +
      `<span style="font-size:0.82rem;color:var(--text-muted)">${state.npNames.length} noms propres à deviner par enchères</span>`;
    el('pre-turn-turn-info').textContent = `Tour ${state.turnsDone[state.currentTeamIdx] + 1} / ${state.turnsPerTeam}`;
  } else if (mode === 'officielle') {
    const round = state.v2CurrentRound;
    el('pre-turn-header').textContent = `${round.emoji} Manche ${round.id} — ${round.label}`;
    const guessers = team.players.filter(p => p !== describer);
    const guesserLabel = guessers.length ? guessers.join(' & ') : 'son/sa coéquipier(e)';
    el('pre-turn-describe').innerHTML =
      `<strong>${describer}</strong> donne les indices<br>` +
      `<span style="font-size:0.9rem">Devine : <strong>${guesserLabel}</strong></span>`;
    el('pre-turn-turn-info').textContent = `${round.words} mots — ${round.time}s`;
  } else {
    el('pre-turn-header').textContent = `${team.name} 🔺`;

    let roleLabel = '';
    if (mode === 'enigmes') {
      const candidat = team.players.filter(p => p !== describer);
      roleLabel = `<span style="font-size:0.82rem;color:var(--text-muted)">Maître-mots : <strong style="color:var(--text)">${describer}</strong> — Candidat : <strong style="color:var(--text)">${candidat.length ? candidat.join(' & ') : 'les autres'}</strong></span>`;
    } else {
      const guessers = team.players.filter(p => p !== describer);
      const guesserLabel = guessers.length ? guessers.join(' & ') : 'tout le monde autour';
      roleLabel = `<span style="font-size:0.9rem">Les autres devinent : <strong>${guesserLabel}</strong></span>`;
    }
    el('pre-turn-describe').innerHTML = `<strong>${describer}</strong> décrit les mots<br>${roleLabel}`;
    el('pre-turn-turn-info').textContent =
      `Tour ${state.turnsDone[state.currentTeamIdx] + 1} / ${state.turnsPerTeam}`;
  }

  // Règle courte adaptée au mode
  const MODE_RULE_HINT = {
    enigmes:        '🧩 Indices en briques — pas de synonymes, traductions ni gestes.',
    contrelamontre: '⏱️ Phrases, mimes, tout est permis — faites deviner vite !',
    nomspropres:    '🏷️ Devinez les noms propres en un minimum de briques.',
    grandepyramide: '🏆 Phrases complètes et mimiques autorisées ✅',
    libre:          '🔺 Décrivez le mot sans le dire, l\'épeler, ni le traduire.',
    officielle:     state.v2CurrentRound ? `🏛️ Règle : ${state.v2CurrentRound.ruleShort}` : '',
  };
  const modeRuleEl = el('pre-turn-mode-rule');
  if (modeRuleEl) modeRuleEl.textContent = MODE_RULE_HINT[mode] || '';

  // Scores
  state.teams.forEach((t, i) => {
    const scoreEl = el(`pre-score-${i}`);
    let rowLabel = '';
    if (mode === 'libre') {
      const row = getTeamCurrentRow(t.found);
      rowLabel = row < PYRAMID_ROWS.length ? `Niveau ${row + 1} / 5` : '🏆 Complète !';
    } else if (mode === 'grandepyramide') {
      rowLabel = i === 0 ? 'Finaliste' : 'Maître-mots';
    } else {
      rowLabel = `${t.score} pt${t.score > 1 ? 's' : ''}`;
    }
    scoreEl.querySelector('.pre-turn-score-name').textContent = t.name;
    scoreEl.querySelector('.pre-turn-score-pts').textContent = t.score;
    scoreEl.querySelector('.pre-turn-score-row').textContent = rowLabel;
    scoreEl.classList.toggle('active', i === state.currentTeamIdx);
    scoreEl.style.setProperty('--team-color', `var(${t.colorVar})`);
  });

  showScreen('screen-pre-turn');
}

// ─── TOUR ─────────────────────────────────────────────────────────────────────
function startTurn() {
  const mode = state.gameMode;

  // Mode Noms propres → écran d'enchères d'abord
  if (mode === 'nomspropres') {
    startBidScreen();
    return;
  }

  const team = state.gameMode === 'grandepyramide'
    ? state.teams[0]  // always team 0 (finalist) in GP
    : state.teams[state.currentTeamIdx];

  state.turnQueuePos = 0;
  state.turnFoundThisTurn = [];
  state.bricksUsed = 0;

  // Mode-specific setup
  if (mode === 'libre') {
    state.turnQueue = buildTurnQueue(team.found);
    state.timeLeft  = state.turnDuration;
    state.bricksLimit = 0;
    if (state.turnQueue.length === 0) {
      state.turnsDone[state.currentTeamIdx]++;
      team.describerIdx++;
      nextTurnOrGameOver();
      return;
    }
  } else if (mode === 'enigmes') {
    // Nouveau tour pour cette équipe : renouveler les mots
    if (state.turnsDone[state.currentTeamIdx] > 0) {
      const usedWords = new Set(state.teams.flatMap(t => (t.words || []).map(w => w?.word).filter(Boolean)));
      team.words = getEnigmesWords(usedWords, state.kidsMode);
      team.found = new Array(5).fill(false);
    }
    const remaining = team.found.map((f, i) => f ? -1 : i).filter(i => i >= 0);
    state.turnQueue = remaining;
    state.timeLeft  = 10;  // per-brick timer
    state.bricksLimit = 13;
  } else if (mode === 'contrelamontre') {
    // Nouveau tour pour cette équipe : renouveler les mots (nouveau thème)
    if (state.turnsDone[state.currentTeamIdx] > 0) {
      const { cat, catInfo, words } = getContreLaMontre(state.clmUsedCats, state.kidsMode);
      state.clmUsedCats.add(cat);
      team.words = words;
      team.clmCat = cat;
      team.clmCatInfo = catInfo;
      team.found = new Array(7).fill(false);
    }
    const remaining = team.found.map((f, i) => f ? -1 : i).filter(i => i >= 0);
    state.turnQueue = remaining;
    state.timeLeft  = 30;
    state.bricksLimit = 0;
  } else if (mode === 'grandepyramide') {
    const gpTeam = state.teams[0];
    const remaining = gpTeam.found.map((f, i) => f ? -1 : i).filter(i => i >= 0);
    state.turnQueue = remaining;
    state.timeLeft  = 60;
    state.bricksLimit = 0;
    state.gpExtraTimeUsed = false;
  } else if (mode === 'officielle') {
    const round = state.v2CurrentRound;
    const remaining = team.found.map((f, i) => f ? -1 : i).filter(i => i >= 0);
    state.turnQueue = remaining;
    state.timeLeft  = round.time;
    state.bricksLimit = 0;
  }

  // Shared UI setup
  const displayTeam = state.gameMode === 'grandepyramide' ? state.teams[0] : team;
  const turnWrap = el('turn-wrapper');
  turnWrap.style.setProperty('--team-color', `var(${displayTeam.colorVar})`);
  el('turn-team-name').textContent = displayTeam.name;

  // Mode-specific UI
  const cfg = GAME_MODES[mode];
  el('brick-display').hidden  = !cfg.brickTimer && mode !== 'enigmes';
  el('turn-theme-badge').hidden = (mode !== 'contrelamontre');
  // Les dots (word-progress) sont réservés à nomspropres, géré via startTurnAfterBid().
  // startTurn() ne traite jamais nomspropres (retour anticipé vers startBidScreen()),
  // donc cette ligne masque les dots pour tous les modes qui passent ici.
  el('word-progress').hidden  = true;
  // Pyramide : pleine pour libre, mini pour les autres (nomspropres gérée dans startTurnAfterBid)
  el('pyramid-area').hidden   = false;
  el('gp-note').hidden        = (mode !== 'grandepyramide');
  el('btn-extra-time').hidden = (mode !== 'grandepyramide');
  const timerContainer = el('timer-container');
  if (timerContainer) timerContainer.hidden = (mode === 'nomspropres');

  // Skip button label
  const skipLabel = el('btn-skip-label');
  if (skipLabel) {
    skipLabel.textContent = mode === 'enigmes' ? 'Brique suivante' : 'Passer';
  }

  // Theme badge for CLT
  if (mode === 'contrelamontre') {
    const t = state.teams[state.currentTeamIdx];
    const info = t.clmCatInfo || {};
    el('turn-theme-badge').textContent = `${info.emoji || ''} Thème : ${info.label || ''}`;
    el('turn-theme-badge').hidden = false;
  }

  // Brick display
  if (mode === 'enigmes') {
    el('brick-used').textContent = '0';
    el('brick-limit').textContent = '13';
    el('brick-display').hidden = false;
  }

  // Extra time
  if (mode === 'grandepyramide') {
    el('btn-extra-time').disabled = false;
    el('btn-extra-time').textContent = '⏰ +10 secondes';
  }

  updateTimerDisplay();
  showCurrentWord();
  playGameStart();
  showScreen('screen-turn');

  if (mode === 'enigmes') {
    startTimer();  // 10s per-brick timer — resets on each brick action
  } else if (mode !== 'nomspropres') {
    startTimer();
  }
}

function showCurrentWord() {
  const mode = state.gameMode;
  const team = mode === 'grandepyramide' ? state.teams[0] : state.teams[state.currentTeamIdx];

  if (state.turnQueue.length === 0) {
    endTurn('allFound');
    return;
  }

  const wordIdx = state.turnQueue[state.turnQueuePos % state.turnQueue.length];
  const word = (mode === 'nomspropres')
    ? { word: state.npNames[state.npNamePos], cat: '' }
    : team.words[wordIdx];

  el('word-text').textContent = word.word;

  if (mode === 'contrelamontre' || mode === 'nomspropres') {
    el('word-category').textContent = '';
  } else if (word.cat) {
    const catInfo = CATEGORIES[word.cat] || { label: word.cat, emoji: '❓' };
    el('word-category').textContent = `${catInfo.emoji} ${catInfo.label}`;
  } else {
    el('word-category').textContent = '';
  }

  // Mise à jour de la pyramide selon le mode
  if (mode === 'libre') {
    el('turn-pyramid').innerHTML = buildPyramidHTML(
      team.found, wordIdx, team.words.map(w => w.word), true,
    );
  } else if (mode === 'nomspropres') {
    // Dots de progression pour nomspropres (pas de pyramide)
    const total      = state.npNames.length;
    const currentDot = state.npNamePos;
    const prog = el('word-progress');
    if (prog) {
      prog.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('span');
        dot.className = 'wp-dot';
        if (i === currentDot) dot.classList.add('current');
        prog.appendChild(dot);
      }
      prog.hidden = false;
    }
  } else {
    // Mini-pyramide pour enigmes / contrelamontre / grandepyramide / officielle
    const found = mode === 'grandepyramide' ? state.teams[0].found : team.found;
    el('turn-pyramid').innerHTML = found.length > 0 ? buildMiniPyramidHTML(found, wordIdx) : '';
  }
}

function getCurrentWordIdx() {
  return state.turnQueue[state.turnQueuePos % state.turnQueue.length];
}

function wordFound() {
  const mode = state.gameMode;
  const team = mode === 'grandepyramide' ? state.teams[0]
             : state.teams[state.currentTeamIdx];
  const idx  = getCurrentWordIdx();
  const word = (mode === 'nomspropres')
    ? state.npNames[state.npNamePos]
    : team.words[idx].word;

  playFound();

  if (mode === 'nomspropres') {
    // Bid winner found the name → +1pt for their team
    state.teams[state.npBidWinner].score++;
    state.turnFoundThisTurn.push({ word, idx: state.npNamePos });
    stopTimer();
    endTurn('found');
    return;
  }

  // Mark word as found
  team.found[idx] = true;
  state.turnFoundThisTurn.push({ word, idx });

  if (mode === 'libre') {
    team.score = computeScore(team.found);
    const pos = state.turnQueuePos % state.turnQueue.length;
    state.turnQueue.splice(pos, 1);
    if (state.turnQueue.length === 0) {
      const newRow = getTeamCurrentRow(team.found);
      if (newRow >= PYRAMID_ROWS.length) {
        playPyramidComplete();
        stopTimer();
        endTurn('pyramidComplete');
        return;
      }
      playLevelUp();
      state.turnQueue = buildTurnQueue(team.found);
      state.turnQueuePos = 0;
    } else {
      if (state.turnQueuePos >= state.turnQueue.length) state.turnQueuePos = 0;
    }
  } else if (mode === 'enigmes') {
    // Consume 1 brick for the successful find
    state.bricksUsed++;
    el('brick-used').textContent = String(state.bricksUsed);
    team.score = team.found.filter(Boolean).length;
    const pos = state.turnQueuePos % state.turnQueue.length;
    state.turnQueue.splice(pos, 1);
    if (state.turnQueuePos >= state.turnQueue.length) state.turnQueuePos = 0;
    if (state.turnQueue.length === 0 || state.bricksUsed >= state.bricksLimit) {
      stopTimer();
      // Bonus: unused bricks
      const bonus = Math.max(0, state.bricksLimit - state.bricksUsed);
      team.score += bonus;
      endTurn(state.turnQueue.length === 0 ? 'allFound' : 'brickLimit');
      return;
    }
    // Reset per-brick timer
    stopTimer();
    state.timeLeft = 10;
    updateTimerDisplay();
    startTimer();
  } else {
    // contrelamontre / grandepyramide
    team.score = team.found.filter(Boolean).length;
    const pos = state.turnQueuePos % state.turnQueue.length;
    state.turnQueue.splice(pos, 1);
    if (state.turnQueuePos >= state.turnQueue.length) state.turnQueuePos = 0;
    if (state.turnQueue.length === 0) {
      stopTimer();
      endTurn('allFound');
      return;
    }
  }

  showCurrentWord();
}

function wordSkip() {
  const mode = state.gameMode;

  if (mode === 'enigmes') {
    // Use 1 brick and keep same word in queue (or if 1 word, consume brick and end)
    state.bricksUsed++;
    el('brick-used').textContent = String(state.bricksUsed);
    if (state.bricksUsed >= state.bricksLimit) {
      stopTimer();
      endTurn('brickLimit');
      return;
    }
    // Reset per-brick timer
    stopTimer();
    state.timeLeft = 10;
    updateTimerDisplay();
    startTimer();
    if (state.turnQueue.length > 1) {
      state.turnQueuePos = (state.turnQueuePos + 1) % state.turnQueue.length;
    }
    playSkip();
    showCurrentWord();
    return;
  }

  if (mode === 'nomspropres') {
    // Use 1 brick (= missed attempt)
    state.bricksUsed++;
    el('brick-used').textContent = String(state.bricksUsed);
    if (state.bricksUsed >= state.npBidAmount) {
      // Failed: +1pt for opponent, +2pt if bid was 1 brick (reward for bold bid)
      const opponent = 1 - state.npBidWinner;
      const pts = state.npBidAmount === 1 ? NP_FAIL_BONUS_ONE_BRICK : NP_FAIL_BONUS;
      state.teams[opponent].score += pts;
      endTurn('brickLimit');
      return;
    }
    playSkip();
    return;
  }

  if (state.turnQueue.length <= 1) {
    showToast('Pas d\'autre mot disponible');
    return;
  }
  playSkip();
  state.turnQueuePos = (state.turnQueuePos + 1) % state.turnQueue.length;
  showCurrentWord();
}

// ─── ENCHÈRES (Mode Noms propres) ──────────────────────────────────────────────
function startBidScreen() {
  el('bid-theme').textContent = `🏷️ ${state.npTheme}`;
  el('bid-name-progress').textContent =
    `Nom ${state.npNamePos + 1} / ${state.npNames.length}`;

  // Step 1: first team bids
  const bidTeam = state.teams[state.npBidderTeam];
  el('bid-step1-title').textContent = `${bidTeam.name} — enchérit`;
  el('bid-step-1').hidden = false;
  el('bid-step-2').hidden = true;
  el('bid-result').hidden = true;

  showScreen('screen-bid');
}

function handleBid1(bricks) {
  state.npBid1 = bricks;
  if (bricks === 1) {
    // Already at minimum — other team can't beat it
    finalizeBid(state.npBidderTeam, 1);
    return;
  }
  // Other team gets to respond
  const otherTeam = state.teams[1 - state.npBidderTeam];
  el('bid-step2-title').textContent = `${otherTeam.name} — surenchérir ?`;
  const opts = el('bid-step2-options');
  opts.innerHTML = '';
  // Counter-bid options: any value < bricks
  for (let b = bricks - 1; b >= 1; b--) {
    const btn = document.createElement('button');
    btn.className = 'bid-btn';
    btn.textContent = `⭐ ${b} brique${b > 1 ? 's' : ''}`;
    btn.addEventListener('click', () => handleBid2(b));
    opts.appendChild(btn);
  }
  const passBtn = document.createElement('button');
  passBtn.className = 'bid-btn pass';
  passBtn.textContent = 'Passer';
  passBtn.addEventListener('click', () => handleBid2('pass'));
  opts.appendChild(passBtn);

  el('bid-step-1').hidden = true;
  el('bid-step-2').hidden = false;
}

function handleBid2(val) {
  if (val === 'pass') {
    finalizeBid(state.npBidderTeam, state.npBid1);
  } else {
    finalizeBid(1 - state.npBidderTeam, val);
  }
}

function finalizeBid(winnerTeam, bricks) {
  state.npBidWinner  = winnerTeam;
  state.npBidAmount  = bricks;
  state.bricksUsed   = 0;
  state.bricksLimit  = bricks;

  const winner = state.teams[winnerTeam];
  el('bid-result-text').innerHTML =
    `<strong style="color:var(--gold)">${winner.name}</strong> joue en ` +
    `<strong>${bricks} brique${bricks > 1 ? 's' : ''}</strong>`;

  el('bid-step-1').hidden = true;
  el('bid-step-2').hidden = true;
  el('bid-result').hidden = false;
}

function startTurnAfterBid() {
  const winnerTeam = state.teams[state.npBidWinner];
  state.currentTeamIdx = state.npBidWinner;

  // Setup turn screen for noms propres
  const turnWrap = el('turn-wrapper');
  turnWrap.style.setProperty('--team-color', `var(${winnerTeam.colorVar})`);
  el('turn-team-name').textContent = winnerTeam.name;

  // Show the proper name
  state.turnQueue = [state.npNamePos];  // single "word" index
  state.turnQueuePos = 0;
  state.turnFoundThisTurn = [];

  // UI
  el('brick-display').hidden = false;
  el('brick-used').textContent = '0';
  el('brick-limit').textContent = String(state.npBidAmount);
  el('turn-theme-badge').textContent = `🏷️ Thème : ${state.npTheme}`;
  el('turn-theme-badge').hidden = false;
  el('word-progress').hidden = true;
  el('pyramid-area').hidden = true;
  el('gp-note').hidden = true;
  el('btn-extra-time').hidden = true;
  const timerContainer = el('timer-container');
  if (timerContainer) timerContainer.hidden = true;
  const skipLabel = el('btn-skip-label');
  if (skipLabel) skipLabel.textContent = 'Brique suivante';

  showCurrentWord();
  playGameStart();
  showScreen('screen-turn');
}

// ─── TEMPS BONUS (Mode Grande Pyramide) ────────────────────────────────────────
function useExtraTime() {
  if (state.gpExtraTimeUsed) return;
  state.gpExtraTimeUsed = true;
  state.timeLeft += 10;
  el('btn-extra-time').disabled = true;
  el('btn-extra-time').textContent = '⏰ +10s utilisé';
  updateTimerDisplay();
  showToast('+10 secondes !');
}

// ─── TIMER ─────────────────────────────────────────────────────────────────────
function startTimer() {
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();
    if (state.timeLeft <= 5) playTickUrgent();
    else if (state.timeLeft <= 10) playTick();
    if (state.timeLeft <= 0) {
      stopTimer();
      playBuzzer();
      endTurn('timeout');
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const t = state.timeLeft;
  // For per-brick timer (enigmes), max is 10; for others use turnDuration or mode default
  const mode  = state.gameMode;
  let total;
  if (mode === 'enigmes') total = 10;
  else if (mode === 'contrelamontre') total = 30;
  else if (mode === 'grandepyramide') total = state.gpExtraTimeUsed ? 70 : 60;
  else if (mode === 'officielle') total = state.v2CurrentRound ? state.v2CurrentRound.time : 60;
  else total = state.turnDuration;

  const fraction = Math.min(1, Math.max(0, t / total));
  const r = 20;
  const circ = 2 * Math.PI * r; // ≈ 125.66

  const prog = el('timer-prog');
  prog.style.strokeDasharray = String(circ);
  prog.style.strokeDashoffset = String(circ * (1 - fraction));
  const urgent = t <= 5;
  prog.classList.toggle('urgent', urgent);
  const timerNum = el('timer-number');
  timerNum.textContent = String(Math.max(0, t));
  timerNum.classList.toggle('urgent', urgent);
  const timerContainer = el('timer-container');
  if (timerContainer) timerContainer.classList.toggle('urgent', urgent);
}

// ─── FIN DE TOUR ───────────────────────────────────────────────────────────────
function endTurn(reason) {
  stopTimer();

  const mode = state.gameMode;

  // Mode Grande Pyramide: win/lose immediately
  if (mode === 'grandepyramide') {
    const gpTeam = state.teams[0];
    const allFound = gpTeam.found.every(Boolean);
    state.gameOver = true;
    showGameOver(allFound ? 'gpWin' : 'gpLose');
    return;
  }

  // Mode Noms propres: advance to next name or end
  if (mode === 'nomspropres') {
    state.npNamePos++;
    state.turnsDone[0]++;
    // Alternate who bids first next round
    state.npBidderTeam = 1 - state.npBidderTeam;

    const turnEnd = el('turn-end-wrapper');
    turnEnd.style.setProperty('--team-color', `var(${state.teams[state.npBidWinner].colorVar})`);

    let title = reason === 'found' ? '✅ Nom trouvé !' : '❌ Pas trouvé';
    el('turn-end-title').textContent = title;
    el('turn-end-team').textContent = `Thème : ${state.npTheme}`;

    el('stat-found').textContent = state.turnFoundThisTurn.length;
    const npFailPts = state.npBidAmount === 1 ? NP_FAIL_BONUS_ONE_BRICK : NP_FAIL_BONUS;
    el('stat-pts').textContent = reason === 'found'
      ? `+1 → ${state.teams[state.npBidWinner].name}`
      : `+${npFailPts} → ${state.teams[1 - state.npBidWinner].name}`;
    el('stat-total').textContent = `${state.teams[0].score} / ${state.teams[1].score}`;
    el('stat-level').textContent = `${state.npNamePos} / ${state.npNames.length}`;

    const chipsEl = el('words-found-chips');
    chipsEl.innerHTML = '';
    if (state.turnFoundThisTurn.length > 0) {
      state.turnFoundThisTurn.forEach(({ word }) => {
        const chip = document.createElement('span');
        chip.className = 'word-chip';
        chip.textContent = word;
        chipsEl.appendChild(chip);
      });
    } else {
      const npName = state.npNames[state.npNamePos - 1] || '';
      chipsEl.innerHTML = `<span style="color:var(--text-muted);font-size:0.85rem">Pas trouvé — c'était : <strong style="color:var(--text)">${npName}</strong></span>`;
    }

    // Hide pyramid display, show score comparison
    el('end-pyramid-0').innerHTML = '';
    el('end-pyramid-1').innerHTML = '';
    el('end-pyramid-team-0').textContent = state.teams[0].name;
    el('end-pyramid-team-1').textContent = state.teams[1].name;
    el('end-pyramid-score-0').textContent = state.teams[0].score + ' pts';
    el('end-pyramid-score-1').textContent = state.teams[1].score + ' pts';

    const allNamesDone = state.npNamePos >= state.npNames.length;
    const allTurnsDone = state.turnsDone[0] >= state.turnsPerTeam;
    const gameEnds = allNamesDone || allTurnsDone;
    if (gameEnds) state.gameOver = true;
    el('btn-turn-end-next').textContent = gameEnds ? '🏁 Voir les résultats' : '➡️ Nom suivant';

    showScreen('screen-turn-end');
    return;
  }

  // Standard end-turn logic
  const team = state.teams[state.currentTeamIdx];
  state.turnsDone[state.currentTeamIdx]++;
  team.describerIdx++;

  // ── Mode officiel : affichage fin de tour ────────────────────────────────
  if (mode === 'officielle') {
    _showV2TurnEnd(reason);
    return;
  }

  const turnEnd = el('turn-end-wrapper');
  turnEnd.style.setProperty('--team-color', `var(${team.colorVar})`);

  let title = 'Temps écoulé ⏰';
  if (reason === 'allFound' && mode === 'libre') title = '🏅 Rangée terminée !';
  if (reason === 'allFound' && mode !== 'libre') title = '🎉 Tous les mots trouvés !';
  if (reason === 'pyramidComplete')              title = '🏆 Pyramide complète !';
  if (reason === 'brickLimit')                   title = '🧱 Briques épuisées !';
  el('turn-end-title').textContent = title;
  el('turn-end-team').textContent = team.name;

  const foundCount = state.turnFoundThisTurn.length;
  let pts;
  if (mode === 'libre') {
    pts = state.turnFoundThisTurn.reduce((acc, { idx }) => {
      const row = PYRAMID_ROWS.findIndex(r => r.indices.includes(idx));
      return acc + (row >= 0 ? PYRAMID_ROWS[row].pts : 0);
    }, 0);
  } else if (mode === 'enigmes') {
    const bonusBricks = Math.max(0, 13 - state.bricksUsed);
    pts = foundCount + bonusBricks;
    // Update stat to show bonus
    el('stat-level').textContent = `+${bonusBricks} bonus`;
  } else {
    pts = foundCount;
  }

  el('stat-found').textContent = foundCount;
  el('stat-pts').textContent = `+${pts}`;
  el('stat-total').textContent = team.score;

  if (mode !== 'enigmes') {
    el('stat-level').textContent = mode === 'libre'
      ? (getTeamCurrentRow(team.found) < PYRAMID_ROWS.length
        ? `${getTeamCurrentRow(team.found) + 1} / 5` : '🏆')
      : `${foundCount} / ${GAME_MODES[mode]?.wordCount || '?'}`;
  }

  // Words found this turn
  const chipsEl = el('words-found-chips');
  chipsEl.innerHTML = '';
  if (state.turnFoundThisTurn.length === 0) {
    chipsEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem">Aucun mot trouvé</span>';
  } else {
    state.turnFoundThisTurn.forEach(({ word }) => {
      const chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = word;
      chipsEl.appendChild(chip);
    });
  }

  // Comparaison des pyramides (fin de tour)
  if (mode === 'libre') {
    el('end-pyramid-0').innerHTML = buildPyramidFull(0);
    el('end-pyramid-1').innerHTML = buildPyramidFull(1);
  } else {
    // Mini-pyramide pour enigmes / contrelamontre
    state.teams.forEach((t, i) => {
      el(`end-pyramid-${i}`).innerHTML = t.found.length > 0
        ? buildMiniPyramidHTML(t.found, -1)
        : '';
    });
  }
  el('end-pyramid-team-0').textContent = state.teams[0].name;
  el('end-pyramid-team-1').textContent = state.teams[1].name;
  el('end-pyramid-score-0').textContent = state.teams[0].score + ' pts';
  el('end-pyramid-score-1').textContent = state.teams[1].score + ' pts';

  // Next button label
  // When a team completes the pyramid, exhaust their remaining turns instead of ending
  // immediately, so the other team still gets to play their fair share of turns.
  if (reason === 'pyramidComplete') state.turnsDone[state.currentTeamIdx] = state.turnsPerTeam;
  const allDone = state.turnsDone.every(d => d >= state.turnsPerTeam) || state.gameOver;
  el('btn-turn-end-next').textContent = allDone ? '🏁 Voir les résultats' : '➡️ Tour suivant';

  showScreen('screen-turn-end');
}

function buildPyramidFull(teamIdx) {
  const team = state.teams[teamIdx];
  return buildPyramidHTML(
    team.found,
    -1,
    team.words.map(w => w.word),
    false,
  );
}

function nextTurnOrGameOver() {
  const mode = state.gameMode;

  // Mode Noms propres: check if more names remain in session
  if (mode === 'nomspropres') {
    const allNamesDone = state.npNamePos >= state.npNames.length;
    const allTurnsDone = state.turnsDone[0] >= state.turnsPerTeam;
    if (allNamesDone || allTurnsDone || state.gameOver) {
      showGameOver();
      return;
    }
    // More names: start bid for next name
    state.currentTeamIdx = state.npBidderTeam;
    startPreTurn();
    return;
  }

  // Mode officiel: advance sub-rounds when both teams have played
  if (mode === 'officielle') {
    const allDone = state.turnsDone.every(d => d >= 1);
    if (allDone) {
      // Both teams played this sub-round
      const nextRoundIdx = state.v2RoundIdx + 1;
      if (nextRoundIdx >= V2_ROUNDS.length) {
        showGameOver();
        return;
      }
      // Advance to next sub-round
      state.v2RoundIdx = nextRoundIdx;
      state.turnsDone = [0, 0];
      state.currentTeamIdx = 0;
      initV2Round();
      showPreRound();
      return;
    }
    // Find the team that hasn't played yet
    let next = (state.currentTeamIdx + 1) % state.teams.length;
    state.currentTeamIdx = next;
    startPreTurn();
    return;
  }

  const allDone = state.turnsDone.every(d => d >= state.turnsPerTeam) || state.gameOver;
  if (allDone) {
    showGameOver();
    return;
  }

  // Find next team that still has turns to do
  let next = (state.currentTeamIdx + 1) % state.teams.length;
  while (state.turnsDone[next] >= state.turnsPerTeam) {
    next = (next + 1) % state.teams.length;
  }
  state.currentTeamIdx = next;
  startPreTurn();
}

// ─── FIN DE PARTIE ─────────────────────────────────────────────────────────────
function showGameOver(gpResult) {
  playGameOver();
  saveGameScores();

  const mode = state.gameMode;

  // Grande Pyramide: special win/lose display
  if (mode === 'grandepyramide') {
    const win = gpResult === 'gpWin';
    el('gameover-banner').textContent = win
      ? `🎊 VICTOIRE ! ${state.gpFinalistName} remporte la cagnotte !`
      : `😢 Dommage ! La prochaine fois sera la bonne !`;
    el('gameover-banner').style.background = win
      ? 'linear-gradient(135deg, var(--gold-dark), var(--gold))'
      : 'linear-gradient(135deg, #7f1d1d, #ef4444)';
    el('gameover-banner').style.color = win ? '#111' : '#fff';

    const gpTeam = state.teams[0];
    const found  = gpTeam.found.filter(Boolean).length;
    el('result-name-0').textContent  = state.gpFinalistName;
    el('result-score-0').textContent = found;
    el('result-level-0').textContent = `${found} / 6 mots`;
    el('result-card-0').style.setProperty('--team-color', `var(${gpTeam.colorVar})`);
    el('result-card-0').classList.toggle('winner', win);

    el('result-name-1').textContent  = state.teams[1].name;
    el('result-score-1').textContent = '';
    el('result-level-1').textContent = 'Maître-mots';
    el('result-card-1').style.setProperty('--team-color', `var(${state.teams[1].colorVar})`);
    el('result-card-1').classList.remove('winner');

    el('gameover-pyramid-0').innerHTML = buildMiniPyramidHTML(gpTeam.found, -1);
    el('gameover-pyramid-1').innerHTML = '';
    if (el('end-name-go-0')) el('end-name-go-0').textContent = state.gpFinalistName;
    if (el('end-name-go-1')) el('end-name-go-1').textContent = state.teams[1].name;

    // Libellé du bouton "Manche suivante" selon le contexte
    const gpNextBtn = el('btn-next-manche');
    if (gpNextBtn) {
      gpNextBtn.textContent = isLastManche() ? '🎊 Terminer la partie' : '▶️ Manche suivante →';
    }

    showScreen('screen-game-over');
    return;
  }

  const scores = state.teams.map((t, i) => ({ i, score: t.score, name: t.name, found: t.found }));
  const maxScore = Math.max(...scores.map(s => s.score));
  const winners = scores.filter(s => s.score === maxScore);
  const isDraw = winners.length > 1;

  let bannerText;
  if (isDraw) {
    bannerText = '🤝 Égalité !';
  } else {
    bannerText = `🏆 ${winners[0].name} remporte la Pyramide !`;
  }
  el('gameover-banner').textContent = bannerText;
  el('gameover-banner').style.background = '';
  el('gameover-banner').style.color = '';

  scores.forEach(({ i, score, name, found }) => {
    const card = el(`result-card-${i}`);
    const team = state.teams[i];
    card.style.setProperty('--team-color', `var(${team.colorVar})`);
    card.classList.toggle('winner', !isDraw && score === maxScore);
    el(`result-name-${i}`).textContent = name;
    el(`result-score-${i}`).textContent = score;
    if (mode === 'libre') {
      const row = getTeamCurrentRow(found);
      el(`result-level-${i}`).textContent =
        row >= PYRAMID_ROWS.length ? '🏆 Complète !' : `Niveau ${row + 1} / 5`;
      el(`gameover-pyramid-${i}`).innerHTML = buildPyramidFull(i);
    } else {
      el(`result-level-${i}`).textContent = `${score} pts`;
      el(`gameover-pyramid-${i}`).innerHTML = found.length > 0
        ? buildMiniPyramidHTML(found, -1)
        : '';
    }
    const goNameEl = el(`end-name-go-${i}`);
    if (goNameEl) goNameEl.textContent = name;
  });

  // Libellé du bouton "Manche suivante" selon le contexte
  const nextMancheBtn = el('btn-next-manche');
  if (nextMancheBtn) {
    nextMancheBtn.textContent = isLastManche() ? '🎊 Terminer la partie' : '▶️ Manche suivante →';
  }

  showScreen('screen-game-over');
}

// ─── MODE OFFICIEL (V2) — FONCTIONS ────────────────────────────────────────────

/** Initialise les mots pour la manche V2 courante. */
function initV2Round() {
  const round = V2_ROUNDS[state.v2RoundIdx];
  state.v2CurrentRound = round;

  // Chaque équipe obtient ses propres mots (différents des mots déjà joués)
  state.teams.forEach((t) => {
    const words = getGameWords(state.v2UsedWords, state.kidsMode).slice(0, round.words);
    words.forEach(w => state.v2UsedWords.add(w.word));
    t.words = words;
    t.found = new Array(words.length).fill(false);
    t.score = t.score || 0;
    t.describerIdx = t.describerIdx || 0;
  });
}

/** Affiche l'écran fin-de-tour pour le mode officiel. */
function _showV2TurnEnd(reason) {
  const team = state.teams[state.currentTeamIdx];
  const round = state.v2CurrentRound;

  const turnEnd = el('turn-end-wrapper');
  turnEnd.style.setProperty('--team-color', `var(${team.colorVar})`);

  let title = 'Temps écoulé ⏰';
  if (reason === 'allFound') title = '🎉 Tous les mots trouvés !';
  el('turn-end-title').textContent = title;
  el('turn-end-team').textContent = `${round.emoji} Manche ${round.id} — ${team.name}`;

  const foundCount = team.found.filter(Boolean).length;
  el('stat-found').textContent = foundCount;
  el('stat-pts').textContent   = `+${team.score}`;
  el('stat-total').textContent = team.score;
  el('stat-level').textContent = `${foundCount} / ${round.words}`;

  // Words found this turn
  const chipsEl = el('words-found-chips');
  chipsEl.innerHTML = '';
  if (state.turnFoundThisTurn.length === 0) {
    chipsEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem">Aucun mot trouvé</span>';
  } else {
    state.turnFoundThisTurn.forEach(({ word }) => {
      const chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = word;
      chipsEl.appendChild(chip);
    });
  }

  // Score display (no pyramid for this mode)
  state.teams.forEach((t, i) => {
    el(`end-pyramid-${i}`).innerHTML = '';
  });
  el('end-pyramid-team-0').textContent = state.teams[0].name;
  el('end-pyramid-team-1').textContent = state.teams[1].name;
  el('end-pyramid-score-0').textContent = state.teams[0].score + ' pts';
  el('end-pyramid-score-1').textContent = state.teams[1].score + ' pts';

  const allTeamsDone = state.turnsDone.every(d => d >= 1);
  const isLastRound  = state.v2RoundIdx >= V2_ROUNDS.length - 1;
  const gameEnds     = allTeamsDone && isLastRound;
  el('btn-turn-end-next').textContent = gameEnds ? '🏁 Voir les résultats' : '➡️ Tour suivant';

  showScreen('screen-turn-end');
}

// ─── THÈME ─────────────────────────────────────────────────────────────────────
const THEME_KEY = 'pyramide_theme';
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  el('btn-theme').textContent = theme === 'light' ? '🌙' : '☀️';
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  applyTheme(next);
}

// ─── MUTE ──────────────────────────────────────────────────────────────────────
const MUTE_KEY = 'pyramide_muted';
function applyMute(muted) {
  setMuted(muted);
  el('btn-mute').textContent = muted ? '🔇' : '🔊';
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (_) {}
}

// ─── OVERLAY ORIENTATION ───────────────────────────────────────────────────────
function updateRotateOverlay() {
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  const overlay = el('rotate-overlay');
  if (overlay) overlay.classList.toggle('active', isLandscape);
}


document.addEventListener('DOMContentLoaded', () => {
  // Version
  try {
    const vEl = el('app-version');
    if (vEl) vEl.textContent = 'v' + getVersion();
  } catch (_) {}

  // Theme
  const savedTheme = (() => { try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; } })();
  applyTheme(savedTheme || 'dark');

  // Mute
  const savedMute = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { return false; } })();
  applyMute(savedMute);

  // Kids mode
  state.kidsMode = loadKidsMode();
  updateKidsModeUI();

  // Options
  loadOptions();
  el('select-duration').value = String(state.turnDuration);
  el('select-turns').value = String(state.turnsPerTeam);

  // Players
  loadPlayers();
  renderScoreboard();

  // ── Mode selector ────────────────────────────────────────────────────────
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => selectMode(btn.dataset.mode));
  });
  updateModeUI();

  // Finalist select
  el('select-finalist')?.addEventListener('change', () => {
    state.gpFinalistName = el('select-finalist').value;
    renderPlayerList();
  });

  // ── Controls ────────────────────────────────────────────────────────────
  el('btn-theme').addEventListener('click', toggleTheme);
  el('btn-mute').addEventListener('click', () => applyMute(!getMuted()));
  el('btn-fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

  // ── Kids mode ───────────────────────────────────────────────────────────
  el('toggle-kids-mode')?.addEventListener('click', () => {
    playButtonClick();
    toggleKidsMode();
  });

  // ── PWA / APK ───────────────────────────────────────────────────────────
  el('btn-install-pwa')?.addEventListener('click', withCooldown(installPwa));
  el('btn-apk-update')?.addEventListener('click', withCooldown(doApkUpdate));

  // ── Setup ───────────────────────────────────────────────────────────────
  el('btn-add-player').addEventListener('click', addPlayer);
  el('player-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });

  el('select-duration').addEventListener('change', e => {
    state.turnDuration = parseInt(e.target.value, 10);
    saveOptions();
  });
  el('select-turns').addEventListener('change', e => {
    state.turnsPerTeam = parseInt(e.target.value, 10);
    saveOptions();
  });

  el('btn-start-game').addEventListener('click', withCooldown(() => {
    playButtonClick();
    showPreRound();
  }));

  // ── Pre-round ────────────────────────────────────────────────────────────
  el('btn-pre-round-start').addEventListener('click', withCooldown(() => {
    playButtonClick();
    // Mode officiel : first sub-round goes to teams, subsequent go directly to pre-turn
    if (state.gameMode === 'officielle' && state.v2RoundIdx > 0) {
      state.turnsDone = [0, 0];
      state.currentTeamIdx = 0;
      startPreTurn();
    } else {
      goToTeams();
    }
  }));
  el('btn-pre-round-back').addEventListener('click', () => {
    playButtonClick();
    showScreen('screen-setup');
  });

  // ── Teams ───────────────────────────────────────────────────────────────
  el('btn-teams-start').addEventListener('click', withCooldown(() => {
    playButtonClick();
    startPreTurn();
  }));
  el('btn-teams-back').addEventListener('click', () => {
    playButtonClick();
    showPreRound();
  });

  // ── Pre-turn ─────────────────────────────────────────────────────────────
  el('btn-pre-turn-start').addEventListener('click', withCooldown(() => {
    playButtonClick();
    startTurn();
  }));

  // ── Turn ────────────────────────────────────────────────────────────────
  el('btn-found').addEventListener('click', withCooldown(() => {
    // Allow action only when timer is running (covers all modes including officielle)
    if (!state.timerInterval && state.gameMode !== 'nomspropres') return;
    wordFound();
  }));
  el('btn-skip').addEventListener('click', withCooldown(() => {
    if (!state.timerInterval && state.gameMode !== 'nomspropres') return;
    wordSkip();
  }));

  // Extra time button (Mode Grande Pyramide)
  el('btn-extra-time').addEventListener('click', withCooldown(() => {
    useExtraTime();
  }));

  // ── Bidding screen (Mode Noms propres) ───────────────────────────────────
  document.querySelectorAll('#bid-step-1 .bid-btn').forEach(btn => {
    btn.addEventListener('click', () => handleBid1(parseInt(btn.dataset.bricks, 10)));
  });

  el('btn-bid-play').addEventListener('click', withCooldown(() => {
    playButtonClick();
    startTurnAfterBid();
  }));

  // ── Turn-end ─────────────────────────────────────────────────────────────
  el('btn-turn-end-next').addEventListener('click', withCooldown(() => {
    playButtonClick();
    nextTurnOrGameOver();
  }));

  // ── Game over ────────────────────────────────────────────────────────────
  el('btn-next-manche').addEventListener('click', withCooldown(() => {
    playButtonClick();
    nextManche();
  }));

  el('btn-replay-same').addEventListener('click', withCooldown(() => {
    playButtonClick();
    showPreRound();
  }));

  el('btn-play-again').addEventListener('click', () => {
    playButtonClick();
    showScreen('screen-setup');
  });

  el('btn-reset-scores').addEventListener('click', () => {
    playButtonClick();
    resetScores();
    showToast('Classement effacé ✅');
  });

  // ── Bottom nav ──────────────────────────────────────────────────────────
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', withCooldown(() => {
      playButtonClick();
      showScreen(btn.dataset.tab);
    }));
  });

  // ── Bouton fermer la partie ──────────────────────────────────────────────
  el('btn-game-close').addEventListener('click', withCooldown(() => {
    playButtonClick();
    if (state.timerInterval !== null) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    showScreen('screen-setup');
  }));

  // Initial render
  renderPlayerList();
  showScreen('screen-setup');

  // ── PWA : service worker, plein écran, APK ──────────────────────────────
  initServiceWorker(getCurrentScreen, GAME_SCREENS);
  initAutoFullscreen();
  initApkDownloadLink();
  checkApkUpdate();

  // ── Orientation overlay ─────────────────────────────────────────────────
  updateRotateOverlay();
  window.addEventListener('resize', updateRotateOverlay);
  window.addEventListener('orientationchange', updateRotateOverlay);

  // ── Bouton Retour (historique) ──────────────────────────────────────────
  window.addEventListener('popstate', (e) => {
    const target = e.state?.screen || 'screen-setup';
    // Revenir au setup depuis n'importe quel écran de navigation (pas depuis le gameplay)
    if (!GAME_SCREENS.has(_currentScreen)) {
      _applyScreen(target);
      if (target === 'screen-leaderboard') renderScoreboard();
      checkPendingReload(target, GAME_SCREENS);
    }
  });
});

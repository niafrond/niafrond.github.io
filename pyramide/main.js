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
};

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

// Écrans de jeu où le bouton ✕ est visible (exclut les transitions et l'écran final)
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
    el('mode-desc').textContent = "Joue toutes les manches dans l'ordre\u00a0: Énigmes, Contre-la-montre, Noms propres, Grande Pyramide, Mode libre.";
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
    const usedCats = new Set();
    state.teams.forEach((t) => {
      const { cat, catInfo, words } = getContreLaMontre(usedCats, state.kidsMode);
      usedCats.add(cat);
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
  }

  renderTeams();
  showScreen('screen-teams');
}

// ─── PRÉ-TOUR ─────────────────────────────────────────────────────────────────
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
    const remaining = team.found.map((f, i) => f ? -1 : i).filter(i => i >= 0);
    state.turnQueue = remaining;
    state.timeLeft  = 10;  // per-brick timer
    state.bricksLimit = 13;
  } else if (mode === 'contrelamontre') {
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
  el('word-progress').hidden  = (mode === 'libre');
  el('pyramid-area').hidden   = (mode !== 'libre');
  el('gp-note').hidden        = (mode !== 'grandepyramide');
  el('btn-extra-time').hidden = (mode !== 'grandepyramide');
  const timerContainer = document.querySelector('.timer-container');
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

  // Update pyramid (libre mode only)
  if (mode === 'libre') {
    el('turn-pyramid').innerHTML = buildPyramidHTML(
      team.found, wordIdx, team.words.map(w => w.word), true,
    );
  }

  // Word progress dots
  if (mode !== 'libre') {
    let found, total, currentDot;
    if (mode === 'nomspropres') {
      found = [];
      total = state.npNames.length;
      currentDot = state.npNamePos;  // highlight current name by position
    } else {
      found = mode === 'grandepyramide' ? state.teams[0].found : team.found;
      total = GAME_MODES[mode]?.wordCount || found.length;
      currentDot = wordIdx;
    }
    const prog = el('word-progress');
    if (prog) {
      prog.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('span');
        dot.className = 'wp-dot';
        if (found[i]) dot.classList.add('found');
        else if (i === currentDot) dot.classList.add('current');
        prog.appendChild(dot);
      }
      prog.hidden = false;
    }
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
  const timerContainer = document.querySelector('.timer-container');
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
  else total = state.turnDuration;

  const fraction = Math.min(1, Math.max(0, t / total));
  const r = 20;
  const circ = 2 * Math.PI * r; // ≈ 125.66

  const prog = el('timer-prog');
  prog.style.strokeDasharray = String(circ);
  prog.style.strokeDashoffset = String(circ * (1 - fraction));
  prog.classList.toggle('urgent', t <= 5);
  el('timer-number').textContent = String(Math.max(0, t));
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

  // Pyramids comparison (libre mode only)
  if (mode === 'libre') {
    el('end-pyramid-0').innerHTML = buildPyramidFull(0);
    el('end-pyramid-1').innerHTML = buildPyramidFull(1);
  } else {
    el('end-pyramid-0').innerHTML = '';
    el('end-pyramid-1').innerHTML = '';
  }
  el('end-pyramid-team-0').textContent = state.teams[0].name;
  el('end-pyramid-team-1').textContent = state.teams[1].name;
  el('end-pyramid-score-0').textContent = state.teams[0].score + ' pts';
  el('end-pyramid-score-1').textContent = state.teams[1].score + ' pts';

  // Next button label
  if (reason === 'pyramidComplete') state.gameOver = true;
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

    el('gameover-pyramid-0').innerHTML = '';
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
      el(`gameover-pyramid-${i}`).innerHTML = '';
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
    goToTeams();
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
    // Allow action if timer is running OR in no-timer modes (nomspropres)
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

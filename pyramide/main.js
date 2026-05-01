/**
 * main.js — Jeu Pyramide
 *
 * Jeu de devinettes inspiré de l'émission TV "Pyramide".
 * Flux : setup → teams → pre-turn → turn → turn-end → [game-over]
 *
 * 2 équipes, pyramide de 5 niveaux (15 mots), minuterie par tour.
 * Chaque équipe a sa propre progression sur la pyramide.
 * Les équipes alternent leurs tours.
 */

import { getGameWords, CATEGORIES, shuffle } from './words.js';
import {
  playTick, playTickUrgent, playBuzzer, playFound, playLevelUp,
  playGameStart, playButtonClick, playSkip, playGameOver,
  playPyramidComplete, setMuted, getMuted,
} from './sound.js';
import { getVersion, getBuildDate } from '../version.js';

// ─── Constantes ────────────────────────────────────────────────────────────────
const MIN_PLAYERS = 2;
const CLICK_COOLDOWN = 400;  // ms entre deux clics

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

const TURN_DURATION_KEY = 'pyramide_turn_duration';
const TURNS_PER_TEAM_KEY = 'pyramide_turns_per_team';
const PLAYERS_KEY = 'pyramide_players';
const SCORES_KEY  = 'pyramide_scores';

const TEAM_COLORS = ['--team1', '--team2'];
const TEAM_NAMES  = ['Équipe 1', 'Équipe 2'];

// ─── État global ────────────────────────────────────────────────────────────────
const state = {
  // Setup
  playerNames: [],

  // Game
  teams: null,         // [{name, color, players, words:[15 mots], found:[false×15], score, describerIdx}]

  currentTeamIdx: 0,
  turnsDone: [0, 0],
  turnsPerTeam: 2,
  gameOver: false,

  // Turn state
  turnQueue: [],       // indices de mots à deviner ce tour
  turnQueuePos: 0,     // position dans turnQueue
  turnFoundThisTurn: [],  // [{word, idx}] trouvés ce tour
  timeLeft: 60,
  timerInterval: null,

  // Options
  turnDuration: 60,
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

function showScreen(id) {
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  el(id).hidden = false;
}

// ─── Persistance options ────────────────────────────────────────────────────────
function loadOptions() {
  try {
    const d = parseInt(localStorage.getItem(TURN_DURATION_KEY), 10);
    if ([30, 45, 60, 90].includes(d)) state.turnDuration = d;
    const t = parseInt(localStorage.getItem(TURNS_PER_TEAM_KEY), 10);
    if ([1, 2, 3].includes(t)) state.turnsPerTeam = t;
  } catch (_) {}
}

function saveOptions() {
  try {
    localStorage.setItem(TURN_DURATION_KEY, String(state.turnDuration));
    localStorage.setItem(TURNS_PER_TEAM_KEY, String(state.turnsPerTeam));
  } catch (_) {}
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
  const card = el('scoreboard-card');
  if (!card) return;
  const scores = loadScores();
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const list = el('scoreboard-list');
  list.innerHTML = '';
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
  el('player-count').textContent = `${count} joueur${count > 1 ? 's' : ''}`;
  el('btn-start-game').disabled = count < MIN_PLAYERS;

  const hint = el('setup-hint');
  if (count < MIN_PLAYERS) {
    hint.textContent = `Minimum ${MIN_PLAYERS} joueurs requis`;
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
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
  state.teams = [0, 1].map((i) => ({
    name:         TEAM_NAMES[i],
    colorVar:     TEAM_COLORS[i],
    players:      shuffled.filter((_, idx) => idx % 2 === i),
    found:        new Array(TOTAL_WORDS).fill(false),
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
  assignTeams();
  // Generate unique word sets for each team (no overlap)
  const words0 = getGameWords();
  const words1 = getGameWords(new Set(words0.map(w => w.word)));
  state.turnsDone = [0, 0];
  state.currentTeamIdx = 0;
  state.gameOver = false;
  // Reset found + score + words for all teams
  state.teams.forEach((t, i) => {
    t.words = i === 0 ? words0 : words1;
    t.found = new Array(TOTAL_WORDS).fill(false);
    t.score = 0;
    t.describerIdx = 0;
  });
  renderTeams();
  showScreen('screen-teams');
}

// ─── PRÉ-TOUR ─────────────────────────────────────────────────────────────────
function startPreTurn() {
  const team = state.teams[state.currentTeamIdx];
  const describer = team.players[team.describerIdx % team.players.length];

  // Color the screen for this team
  const preWrap = el('pre-turn-wrapper');
  preWrap.style.setProperty('--team-color', `var(${team.colorVar})`);

  el('pre-turn-header').textContent = `${team.name} 🔺`;

  const guessers = team.players.filter(p => p !== describer);
  const guesserLabel = guessers.length ? guessers.join(' & ') : 'tout le monde autour';
  el('pre-turn-describe').innerHTML =
    `<strong>${describer}</strong> décrit les mots<br>` +
    `<span style="font-size:0.9rem">Les autres devinent : <strong>${guesserLabel}</strong></span>`;

  // Scores
  el('pre-turn-turn-info').textContent =
    `Tour ${state.turnsDone[state.currentTeamIdx] + 1} / ${state.turnsPerTeam}`;

  state.teams.forEach((t, i) => {
    const scoreEl = el(`pre-score-${i}`);
    const row = getTeamCurrentRow(t.found);
    const rowLabel = row < PYRAMID_ROWS.length
      ? `Niveau ${row + 1} / 5`
      : '🏆 Complète !';
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
  const team = state.teams[state.currentTeamIdx];

  // Build the turn queue from the current row
  state.turnQueue = buildTurnQueue(team.found);
  state.turnQueuePos = 0;
  state.turnFoundThisTurn = [];
  state.timeLeft = state.turnDuration;

  // Guard: pyramid already complete for this team
  if (state.turnQueue.length === 0) {
    state.turnsDone[state.currentTeamIdx]++;
    team.describerIdx++;
    nextTurnOrGameOver();
    return;
  }

  // Styling
  const turnWrap = el('turn-wrapper');
  turnWrap.style.setProperty('--team-color', `var(${team.colorVar})`);
  el('turn-team-name').textContent = team.name;

  updateTimerDisplay();
  showCurrentWord();
  playGameStart();
  showScreen('screen-turn');
  startTimer();
}

function showCurrentWord() {
  const team = state.teams[state.currentTeamIdx];

  if (state.turnQueue.length === 0) {
    endTurn('allFound');
    return;
  }

  const wordIdx = state.turnQueue[state.turnQueuePos % state.turnQueue.length];
  const word = team.words[wordIdx];

  el('word-text').textContent = word.word;
  const catInfo = CATEGORIES[word.cat] || { label: word.cat, emoji: '❓' };
  el('word-category').textContent = `${catInfo.emoji} ${catInfo.label}`;

  // Update pyramid
  el('turn-pyramid').innerHTML = buildPyramidHTML(
    team.found,
    wordIdx,
    team.words.map(w => w.word),
    true,
  );
}

function getCurrentWordIdx() {
  return state.turnQueue[state.turnQueuePos % state.turnQueue.length];
}

function wordFound() {
  const team = state.teams[state.currentTeamIdx];
  const idx = getCurrentWordIdx();
  const word = team.words[idx];

  // Mark as found
  team.found[idx] = true;
  team.score = computeScore(team.found);
  state.turnFoundThisTurn.push({ word: word.word, idx });
  playFound();

  // Remove from queue
  const pos = state.turnQueuePos % state.turnQueue.length;
  state.turnQueue.splice(pos, 1);
  if (state.turnQueue.length === 0) {
    // Row complete — check if there's a next row
    const newRow = getTeamCurrentRow(team.found);
    if (newRow >= PYRAMID_ROWS.length) {
      // Pyramid complete!
      playPyramidComplete();
      stopTimer();
      endTurn('pyramidComplete');
      return;
    }
    playLevelUp();
    // New queue for the next row
    state.turnQueue = buildTurnQueue(team.found);
    state.turnQueuePos = 0;
  } else {
    // Keep position in bounds
    if (state.turnQueuePos >= state.turnQueue.length) {
      state.turnQueuePos = 0;
    }
  }

  showCurrentWord();
}

function wordSkip() {
  playSkip();
  // Move to next word in queue (cyclic)
  state.turnQueuePos = (state.turnQueuePos + 1) % state.turnQueue.length;
  showCurrentWord();
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
  const total = state.turnDuration;
  const fraction = t / total;
  const r = 20;
  const circ = 2 * Math.PI * r; // ≈ 125.66

  const prog = el('timer-prog');
  prog.style.strokeDasharray = String(circ);
  prog.style.strokeDashoffset = String(circ * (1 - fraction));
  prog.classList.toggle('urgent', t <= 5);
  el('timer-number').textContent = String(t);
}

// ─── FIN DE TOUR ───────────────────────────────────────────────────────────────
function endTurn(reason) {
  stopTimer();

  const team = state.teams[state.currentTeamIdx];
  state.turnsDone[state.currentTeamIdx]++;

  // Advance describer index
  team.describerIdx++;

  // Build turn-end screen
  const turnEnd = el('turn-end-wrapper');
  turnEnd.style.setProperty('--team-color', `var(${team.colorVar})`);

  let title = 'Temps écoulé ⏰';
  if (reason === 'allFound')       title = '🏅 Rangée terminée !';
  if (reason === 'pyramidComplete') title = '🏆 Pyramide complète !';
  el('turn-end-title').textContent = title;
  el('turn-end-team').textContent = team.name;

  const foundCount = state.turnFoundThisTurn.length;
  const pts = state.turnFoundThisTurn.reduce((acc, { idx }) => {
    const row = PYRAMID_ROWS.findIndex(r => r.indices.includes(idx));
    return acc + (row >= 0 ? PYRAMID_ROWS[row].pts : 0);
  }, 0);

  el('stat-found').textContent = foundCount;
  el('stat-pts').textContent = `+${pts}`;
  el('stat-total').textContent = team.score;
  el('stat-level').textContent =
    getTeamCurrentRow(team.found) < PYRAMID_ROWS.length
      ? `${getTeamCurrentRow(team.found) + 1} / 5`
      : '🏆';

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

  // Pyramids comparison
  el('end-pyramid-0').innerHTML = buildPyramidFull(0);
  el('end-pyramid-1').innerHTML = buildPyramidFull(1);
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
function showGameOver() {
  playGameOver();
  saveGameScores();

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

  scores.forEach(({ i, score, name, found }) => {
    const card = el(`result-card-${i}`);
    const team = state.teams[i];
    card.style.setProperty('--team-color', `var(${team.colorVar})`);
    card.classList.toggle('winner', !isDraw && score === maxScore);
    el(`result-name-${i}`).textContent = name;
    el(`result-score-${i}`).textContent = score;
    const row = getTeamCurrentRow(found);
    el(`result-level-${i}`).textContent =
      row >= PYRAMID_ROWS.length ? '🏆 Complète !' : `Niveau ${row + 1} / 5`;

    el(`gameover-pyramid-${i}`).innerHTML = buildPyramidFull(i);
    const goNameEl = el(`end-name-go-${i}`);
    if (goNameEl) goNameEl.textContent = name;
  });

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

// ─── INIT ──────────────────────────────────────────────────────────────────────
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

  // Options
  loadOptions();
  el('select-duration').value = String(state.turnDuration);
  el('select-turns').value = String(state.turnsPerTeam);

  // Players
  loadPlayers();
  renderScoreboard();

  // ── Controls ────────────────────────────────────────────────────────────
  el('btn-theme').addEventListener('click', toggleTheme);
  el('btn-mute').addEventListener('click', () => applyMute(!getMuted()));

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
    goToTeams();
  }));

  // ── Teams ───────────────────────────────────────────────────────────────
  el('btn-teams-start').addEventListener('click', withCooldown(() => {
    playButtonClick();
    startPreTurn();
  }));
  el('btn-teams-back').addEventListener('click', () => {
    playButtonClick();
    showScreen('screen-setup');
  });

  // ── Pre-turn ─────────────────────────────────────────────────────────────
  el('btn-pre-turn-start').addEventListener('click', withCooldown(() => {
    playButtonClick();
    startTurn();
  }));

  // ── Turn ────────────────────────────────────────────────────────────────
  el('btn-found').addEventListener('click', withCooldown(() => {
    if (!state.timerInterval) return;
    wordFound();
  }));
  el('btn-skip').addEventListener('click', withCooldown(() => {
    if (!state.timerInterval) return;
    if (state.turnQueue.length <= 1) {
      showToast('Pas d\'autre mot disponible dans cette rangée');
      return;
    }
    wordSkip();
  }));

  // ── Turn-end ─────────────────────────────────────────────────────────────
  el('btn-turn-end-next').addEventListener('click', withCooldown(() => {
    playButtonClick();
    nextTurnOrGameOver();
  }));

  // ── Game over ────────────────────────────────────────────────────────────
  el('btn-play-again').addEventListener('click', () => {
    playButtonClick();
    // Go back to setup (player list is kept from localStorage)
    showScreen('screen-setup');
  });

  el('btn-replay-same').addEventListener('click', withCooldown(() => {
    playButtonClick();
    goToTeams();
  }));

  el('btn-reset-scores').addEventListener('click', () => {
    playButtonClick();
    resetScores();
  });

  // Initial render
  renderPlayerList();
  showScreen('screen-setup');

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

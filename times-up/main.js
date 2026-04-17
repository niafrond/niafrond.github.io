/**
 * main.js — Time's Up Nout Péi
 *
 * Jeu 100 % local, les joueurs se passent le téléphone.
 * Flux : setup → teams → round-intro → pre-turn → turn → turn-end → round-end → game-over
 */

import { getShuffledWords, getCategoryInfo, TOTAL_WORDS } from './words.js';
import {
  playTick, playTickUrgent, playBuzzer,
  playFound, playRoundStart, playGameOver,
  setMuted, getMuted,
} from './sound.js';

// ─── Constantes ────────────────────────────────────────────────────────────────
const TURN_DURATION   = 30;   // secondes par tour
const MIN_PLAYERS     = 4;
const ROUND_RULES     = [
  { num: 1, icon: '🗣️',  title: 'Manche 1 — Tout dire',  desc: 'Décrivez le mot avec autant de mots que vous voulez. Interdits : le mot lui-même et ses traductions directes.' },
  { num: 2, icon: '☝️',  title: 'Manche 2 — Un seul mot', desc: 'Vous ne pouvez utiliser qu\'un seul mot pour faire deviner. Pas de mimique.' },
  { num: 3, icon: '🤐',  title: 'Manche 3 — Mime',        desc: 'Mimez uniquement, sans parler ni faire de bruit. Pas de passage autorisé !' },
];

// ─── État du jeu ───────────────────────────────────────────────────────────────
const state = {
  playerNames: [],
  teams: [],               // [{name, emoji, color, players, score: [0,0,0]}]
  teamPlayerIdx: [],       // index du joueur actif par équipe

  allWords: [],            // mots pour toutes les manches
  roundWords: [],          // mots restants dans la manche en cours
  currentRound: 0,         // 1-3
  currentTeamIdx: 0,

  turnFound: [],
  turnSkipped: [],
  currentWord: null,

  timerInterval: null,
  timeLeft: TURN_DURATION,
};

const TEAMS_META = [
  { name: 'Équipe Volcan', emoji: '🌋', color: 'var(--volcan)' },
  { name: 'Équipe Lagon',  emoji: '🌊', color: 'var(--lagon)' },
];

// ─── Helpers UI ────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  document.getElementById(id).hidden = false;
}

function el(id) { return document.getElementById(id); }

let _toastTimer = null;
function showToast(msg, type = 'info') {
  const t = el('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── ÉCRAN SETUP ───────────────────────────────────────────────────────────────
function renderPlayerList() {
  const list = el('player-list');
  list.innerHTML = '';
  state.playerNames.forEach((name, i) => {
    const item = document.createElement('div');
    item.className = 'player-item';
    item.innerHTML = `
      <span class="player-item-name">👤 ${name}</span>
      <button class="btn-icon btn-danger" aria-label="Supprimer ${name}" data-idx="${i}">✕</button>
    `;
    item.querySelector('button').addEventListener('click', () => removePlayer(i));
    list.appendChild(item);
  });

  const count = state.playerNames.length;
  el('player-count').textContent = `${count} joueur${count > 1 ? 's' : ''}`;
  el('btn-start-game').disabled = count < MIN_PLAYERS;

  const hint = el('setup-hint');
  if (count < MIN_PLAYERS) {
    hint.textContent = `Minimum ${MIN_PLAYERS} joueurs requis (encore ${MIN_PLAYERS - count} à ajouter)`;
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
}

function addPlayer() {
  const input = el('player-input');
  const name = input.value.trim();
  if (!name) { showToast('Entrez un prénom', 'warn'); return; }
  if (state.playerNames.includes(name)) { showToast('Ce joueur existe déjà', 'warn'); return; }
  if (state.playerNames.length >= 20) { showToast('Maximum 20 joueurs', 'warn'); return; }
  state.playerNames.push(name);
  input.value = '';
  input.focus();
  renderPlayerList();
}

function removePlayer(idx) {
  state.playerNames.splice(idx, 1);
  renderPlayerList();
}

// ─── ÉCRAN TEAMS ───────────────────────────────────────────────────────────────
function assignTeams() {
  const players = shuffle([...state.playerNames]);
  const mid = Math.ceil(players.length / 2);
  state.teams = TEAMS_META.map((meta, i) => ({
    ...meta,
    players: i === 0 ? players.slice(0, mid) : players.slice(mid),
    score: [0, 0, 0],
  }));
  state.teamPlayerIdx = state.teams.map(() => 0);
}

function renderTeams() {
  const container = el('teams-container');
  container.innerHTML = '';
  state.teams.forEach((team) => {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.style.setProperty('--team-color', team.color);
    card.innerHTML = `
      <div class="team-header">
        <span class="team-emoji">${team.emoji}</span>
        <span class="team-name">${team.name}</span>
      </div>
      <ul class="team-players">
        ${team.players.map(p => `<li>👤 ${p}</li>`).join('')}
      </ul>
    `;
    container.appendChild(card);
  });
}

function goToTeams() {
  assignTeams();
  renderTeams();
  showScreen('screen-teams');
}

// ─── LOGIQUE DE MANCHE ─────────────────────────────────────────────────────────
function startRound(roundNum) {
  state.currentRound = roundNum;
  state.roundWords = shuffle([...state.allWords]);
  state.currentTeamIdx = 0;

  const r = ROUND_RULES[roundNum - 1];
  el('round-intro-icon').textContent = r.icon;
  el('round-intro-title').textContent = r.title;
  el('round-intro-desc').textContent = r.desc;
  el('round-intro-num').textContent = `${roundNum} / 3`;
  el('round-intro-words-left').textContent = `${state.roundWords.length} mots à faire deviner`;

  playRoundStart();
  showScreen('screen-round-intro');
}

// ─── PRÉ-TOUR ─────────────────────────────────────────────────────────────────
function startPreTurn() {
  const team = state.teams[state.currentTeamIdx];
  const playerIdx = state.teamPlayerIdx[state.currentTeamIdx];
  const playerName = team.players[playerIdx];

  el('pre-turn-team').textContent = `${team.emoji} ${team.name}`;
  el('pre-turn-team').style.color = team.color;
  el('pre-turn-player').textContent = playerName;
  el('pre-turn-round').textContent = `Manche ${state.currentRound} / 3`;
  el('pre-turn-words-left').textContent = `${state.roundWords.length} mot${state.roundWords.length > 1 ? 's' : ''} restant${state.roundWords.length > 1 ? 's' : ''}`;

  showScreen('screen-pre-turn');
}

// ─── TOUR ACTIF ────────────────────────────────────────────────────────────────
function startTurn() {
  state.turnFound = [];
  state.turnSkipped = [];
  state.timeLeft = TURN_DURATION;

  // Manche 3 : pas de passage
  el('btn-skip').hidden = state.currentRound === 3;

  updateTurnStats();
  drawNextWord();
  updateTimerDisplay();
  startTimer();

  showScreen('screen-turn');
}

function drawNextWord() {
  if (state.roundWords.length === 0) {
    endTurn(true);
    return;
  }
  state.currentWord = state.roundWords.shift();
  const cat = getCategoryInfo(state.currentWord.category);
  el('word-card-text').textContent = state.currentWord.word;
  el('word-card-category').textContent = `${cat.emoji} ${cat.label}`;
  el('turn-round-badge').textContent = `Manche ${state.currentRound} — ${ROUND_RULES[state.currentRound - 1].icon}`;
}

function wordFound() {
  playFound();
  state.turnFound.push(state.currentWord);
  updateTurnStats();
  drawNextWord();
}

function wordSkipped() {
  state.turnSkipped.push(state.currentWord);
  // Le mot retourne dans la pioche (en fin de liste)
  state.roundWords.push(state.currentWord);
  updateTurnStats();
  drawNextWord();
}

function updateTurnStats() {
  el('turn-found-count').textContent = state.turnFound.length;
}

// ─── TIMER ─────────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();

    if (state.timeLeft <= 5 && state.timeLeft > 0) {
      playTickUrgent();
    } else if (state.timeLeft <= 10 && state.timeLeft > 5) {
      playTick();
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      playBuzzer();
      endTurn(false);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function updateTimerDisplay() {
  const pct = state.timeLeft / TURN_DURATION;
  const timerNum = el('timer-number');
  const timerRing = el('timer-ring-progress');

  timerNum.textContent = state.timeLeft;

  // SVG circle : circumference ≈ 2π×46 ≈ 289
  const circ = 2 * Math.PI * 46;
  const offset = circ * (1 - pct);
  timerRing.style.strokeDasharray = `${circ}`;
  timerRing.style.strokeDashoffset = `${offset}`;

  // Couleur selon urgence
  if (state.timeLeft <= 5) {
    timerRing.style.stroke = 'var(--danger)';
    timerNum.style.color = 'var(--danger)';
  } else if (state.timeLeft <= 10) {
    timerRing.style.stroke = 'var(--warning)';
    timerNum.style.color = 'var(--warning)';
  } else {
    timerRing.style.stroke = 'var(--success)';
    timerNum.style.color = 'var(--text)';
  }
}

// ─── FIN DE TOUR ───────────────────────────────────────────────────────────────
function endTurn(allWordsFound = false) {
  stopTimer();

  const team = state.teams[state.currentTeamIdx];
  team.score[state.currentRound - 1] += state.turnFound.length;

  el('turn-end-team').textContent = `${team.emoji} ${team.name}`;
  el('turn-end-player').textContent = state.teams[state.currentTeamIdx].players[state.teamPlayerIdx[state.currentTeamIdx]];
  el('turn-end-count').textContent = state.turnFound.length;

  const foundList = el('turn-end-found-list');
  foundList.innerHTML = '';
  state.turnFound.forEach(w => {
    const li = document.createElement('li');
    const cat = getCategoryInfo(w.category);
    li.textContent = `${cat.emoji} ${w.word}`;
    foundList.appendChild(li);
  });

  el('turn-end-words-left').textContent = state.roundWords.length;

  // Avancer au joueur suivant dans l'équipe
  const pi = state.teamPlayerIdx[state.currentTeamIdx];
  state.teamPlayerIdx[state.currentTeamIdx] = (pi + 1) % team.players.length;

  if (allWordsFound || state.roundWords.length === 0) {
    el('btn-next-turn').dataset.nextAction = 'round-end';
    el('turn-end-all-found').hidden = false;
  } else {
    el('btn-next-turn').dataset.nextAction = 'next-turn';
    el('turn-end-all-found').hidden = true;
  }

  showScreen('screen-turn-end');
}

function handleNextTurn() {
  const action = el('btn-next-turn').dataset.nextAction;
  if (action === 'round-end') {
    showRoundEnd();
  } else {
    // Passer à l'équipe suivante
    state.currentTeamIdx = (state.currentTeamIdx + 1) % state.teams.length;
    startPreTurn();
  }
}

// ─── FIN DE MANCHE ─────────────────────────────────────────────────────────────
function showRoundEnd() {
  el('round-end-num').textContent = state.currentRound;

  const scoreRows = el('round-end-scores');
  scoreRows.innerHTML = '';
  state.teams.forEach(team => {
    const tr = document.createElement('tr');
    const roundPts = team.score[state.currentRound - 1];
    const totalPts = team.score.reduce((a, b) => a + b, 0);
    tr.innerHTML = `
      <td><span style="color:${team.color}">${team.emoji} ${team.name}</span></td>
      <td class="score-cell">${roundPts}</td>
      <td class="score-cell total-score">${totalPts}</td>
    `;
    scoreRows.appendChild(tr);
  });

  const isLastRound = state.currentRound === 3;
  el('btn-next-round').hidden = isLastRound;
  el('btn-final-results').hidden = !isLastRound;

  showScreen('screen-round-end');
}

// ─── FIN DU JEU ────────────────────────────────────────────────────────────────
function showGameOver() {
  playGameOver();

  // Calcul du gagnant
  const scored = state.teams.map(t => ({
    team: t,
    total: t.score.reduce((a, b) => a + b, 0),
  }));
  scored.sort((a, b) => b.total - a.total);

  const isTie = scored.length >= 2 && scored[0].total === scored[1].total;

  if (isTie) {
    el('game-over-winner').textContent = '🤝 Égalité !';
    el('game-over-winner').style.color = 'var(--warning)';
  } else {
    const w = scored[0].team;
    el('game-over-winner').textContent = `${w.emoji} ${w.name}`;
    el('game-over-winner').style.color = w.color;
  }

  const finalScores = el('final-scores');
  finalScores.innerHTML = '';
  scored.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'final-score-row';
    div.innerHTML = `
      <span class="final-rank">${i === 0 && !isTie ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
      <span style="color:${s.team.color}">${s.team.emoji} ${s.team.name}</span>
      <span class="final-pts">${s.total} pts</span>
    `;
    finalScores.appendChild(div);
  });

  showScreen('screen-game-over');
}

// ─── INITIALISATION ────────────────────────────────────────────────────────────
function init() {
  // ── Setup ──
  el('btn-add-player').addEventListener('click', addPlayer);
  el('player-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPlayer();
  });
  el('btn-start-game').addEventListener('click', () => {
    if (state.playerNames.length >= MIN_PLAYERS) goToTeams();
  });

  // ── Teams ──
  el('btn-reshuffle').addEventListener('click', () => {
    assignTeams();
    renderTeams();
  });
  el('btn-launch-game').addEventListener('click', () => {
    state.allWords = getShuffledWords();
    startRound(1);
  });

  // ── Round intro ──
  el('btn-round-go').addEventListener('click', () => {
    state.currentTeamIdx = 0;
    startPreTurn();
  });

  // ── Pre-turn ──
  el('btn-ready').addEventListener('click', startTurn);

  // ── Turn ──
  el('btn-found').addEventListener('click', wordFound);
  el('btn-skip').addEventListener('click', wordSkipped);

  // ── Turn end ──
  el('btn-next-turn').addEventListener('click', handleNextTurn);

  // ── Round end ──
  el('btn-next-round').addEventListener('click', () => {
    startRound(state.currentRound + 1);
  });
  el('btn-final-results').addEventListener('click', showGameOver);

  // ── Game over ──
  el('btn-replay').addEventListener('click', () => {
    // Reset complet
    state.playerNames = [];
    state.teams = [];
    state.teamPlayerIdx = [];
    state.allWords = [];
    state.roundWords = [];
    state.currentRound = 0;
    renderPlayerList();
    showScreen('screen-setup');
  });

  // ── Mute toggle ──
  el('btn-mute').addEventListener('click', () => {
    setMuted(!getMuted());
    el('btn-mute').textContent = getMuted() ? '🔇' : '🔊';
  });

  // Afficher l'écran de démarrage
  renderPlayerList();
  showScreen('screen-setup');
}

document.addEventListener('DOMContentLoaded', init);

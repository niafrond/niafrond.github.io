/**
 * main.js — Time's Up Nout Péi
 *
 * Jeu 100 % local, les joueurs se passent le téléphone.
 * Flux : setup → teams → round-intro → pre-turn → turn → turn-end → round-end → game-over
 */

import { getShuffledWords, getCategoryInfo, shuffle } from './words.js';
import {
  playTick, playTickUrgent, playBuzzer,
  playFound, playRoundStart, playGameOver,
  setMuted, getMuted,
} from './sound.js';

// ─── Constantes ────────────────────────────────────────────────────────────────
const TURN_DURATION       = 30;   // secondes par tour
const TIMER_CIRCLE_RADIUS = 46;   // rayon du cercle SVG du timer
const MIN_PLAYERS         = 4;

const ROUND_RULES = [
  {
    num: 1, icon: '🗣️',
    title: 'Manche 1 — Parler librement',
    desc: `L'orateur peut parler librement.
⛔ Interdit : dire le nom (ou une partie), épeler, traduire, passer une carte.
🚨 Faute → tour arrêté immédiatement.`,
    canSkip: false,
    canFault: true,
  },
  {
    num: 2, icon: '☝️',
    title: 'Manche 2 — Un seul mot',
    desc: `L'orateur ne dit qu'un seul mot par carte. L'équipe n'a droit qu'à une seule proposition.
✅ Bonne réponse → carte gagnée.
❌ Mauvaise réponse → carte remise dans le jeu.
⏭ L'orateur peut aussi passer s'il est bloqué.
⛔ Interdits : plus d'un mot, partie du nom, traduction directe.`,
    canSkip: true,
    canFault: false,
  },
  {
    num: 3, icon: '🤐',
    title: 'Manche 3 — Mime et bruitages',
    desc: `L'orateur ne peut plus parler du tout : uniquement des mimes et des bruitages.
Même fonctionnement que la manche 2 :
✅ Bonne réponse → carte gagnée.
❌ Mauvaise réponse → carte remise dans le jeu.
⏭ L'orateur peut passer s'il est bloqué.
⛔ Interdits : parler, former des mots, fredonner une chanson.`,
    canSkip: true,
    canFault: false,
  },
];

// ─── Métadonnées équipes (max 4) ───────────────────────────────────────────────
const TEAMS_META = [
  { name: 'Équipe Volcan', emoji: '🌋', color: 'var(--volcan)' },
  { name: 'Équipe Lagon',  emoji: '🌊', color: 'var(--lagon)'  },
  { name: 'Équipe Forêt',  emoji: '🌿', color: 'var(--foret)'  },
  { name: 'Équipe Soleil', emoji: '☀️', color: 'var(--soleil)' },
];

// Emojis pour le mode jeu libre (5 ou 7 joueurs — pas d'équipes fixes)
const SOLO_EMOJIS = ['🌺', '🦜', '🌴', '🐠', '🌸', '🦩', '🌿'];

// ─── État du jeu ───────────────────────────────────────────────────────────────
const state = {
  playerNames:    [],
  teams:          [],      // [{name, emoji, color, players, score:[0,0,0]}]
  teamPlayerIdx:  [],      // index du joueur actif par équipe
  noTeamsMode:    false,   // true pour 5 ou 7 joueurs

  allWords:     [],        // mots du jeu (identiques aux 3 manches)
  roundWords:   [],        // mots restants dans la manche en cours
  currentRound: 0,         // 1-3
  currentTeamIdx: 0,

  turnFound:   [],
  currentWord: null,

  timerInterval: null,
  timeLeft: TURN_DURATION,
};

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

// ─── ÉCRAN SETUP ───────────────────────────────────────────────────────────────
function renderPlayerList() {
  const list = el('player-list');
  list.innerHTML = '';
  state.playerNames.forEach((name, i) => {
    const item = document.createElement('div');
    item.className = 'player-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-item-name';
    nameSpan.textContent = `👤 ${name}`;

    const btn = document.createElement('button');
    btn.className = 'btn-icon btn-danger';
    btn.setAttribute('aria-label', `Supprimer ${name}`);
    btn.textContent = '✕';
    btn.addEventListener('click', () => removePlayer(i));

    item.appendChild(nameSpan);
    item.appendChild(btn);
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

// ─── COMPOSITION DES ÉQUIPES ───────────────────────────────────────────────────
/**
 * Retourne un tableau de tailles d'équipes pour n joueurs.
 * Retourne null pour 5 ou 7 joueurs (pas d'équipes fixes).
 *   4  → [2, 2]
 *   6  → [2, 2, 2]
 *   8  → [2, 2, 2, 2]
 *   9  → [3, 3, 3]
 *  10  → [3, 3, 2, 2]
 *  11  → [3, 3, 3, 2]
 *  12  → [3, 3, 3, 3]
 * >12  → 4 équipes, répartition aussi égale que possible
 */
function computeTeamLayout(n) {
  switch (n) {
    case 4:  return [2, 2];
    case 5:  return null;
    case 6:  return [2, 2, 2];
    case 7:  return null;
    case 8:  return [2, 2, 2, 2];
    case 9:  return [3, 3, 3];
    case 10: return [3, 3, 2, 2];
    case 11: return [3, 3, 3, 2];
    case 12: return [3, 3, 3, 3];
    default: {
      // Pour > 12 joueurs : 4 équipes aussi égales que possible
      const numTeams = 4;
      const base  = Math.floor(n / numTeams);
      const extra = n % numTeams;
      return Array.from({ length: numTeams }, (_, i) => base + (i < extra ? 1 : 0));
    }
  }
}

function assignTeams() {
  const players = shuffle([...state.playerNames]);
  const layout  = computeTeamLayout(players.length);

  if (layout === null) {
    // 5 ou 7 joueurs : jeu libre, chaque joueur est son propre "camp"
    state.noTeamsMode = true;
    state.teams = players.map((name, i) => ({
      name,
      emoji: SOLO_EMOJIS[i % SOLO_EMOJIS.length],
      color: TEAMS_META[i % TEAMS_META.length].color,
      players: [name],
      score:   [0, 0, 0],
    }));
  } else {
    state.noTeamsMode = false;
    let offset = 0;
    state.teams = layout.map((size, i) => {
      const team = {
        ...TEAMS_META[i],
        players: players.slice(offset, offset + size),
        score:   [0, 0, 0],
      };
      offset += size;
      return team;
    });
  }

  state.teamPlayerIdx = state.teams.map(() => 0);
}

function renderTeams() {
  const container = el('teams-container');
  container.innerHTML = '';

  if (state.noTeamsMode) {
    container.style.gridTemplateColumns = '1fr';
    const banner = document.createElement('div');
    banner.className = 'no-teams-banner';
    banner.textContent =
      `⚠️ ${state.playerNames.length} joueurs — pas d'équipes fixes pour ce nombre. ` +
      'Chaque joueur joue pour lui-même ! (Ajoutez ou retirez un joueur pour avoir des équipes.)';
    container.appendChild(banner);
  } else {
    container.style.gridTemplateColumns = '';
  }

  state.teams.forEach((team) => {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.style.setProperty('--team-color', team.color);

    const header = document.createElement('div');
    header.className = 'team-header';

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'team-emoji';
    emojiSpan.textContent = team.emoji;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'team-name';
    nameSpan.textContent = team.name;
    nameSpan.style.color = team.color;

    header.appendChild(emojiSpan);
    header.appendChild(nameSpan);

    const ul = document.createElement('ul');
    ul.className = 'team-players';
    team.players.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `👤 ${p}`;
      ul.appendChild(li);
    });

    card.appendChild(header);
    card.appendChild(ul);
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
  // Manche 1 : mélange complet ; manches 2 et 3 : mêmes cartes remélangées
  if (roundNum === 1) {
    state.allWords  = getShuffledWords();
  }
  state.roundWords   = shuffle([...state.allWords]);
  state.currentTeamIdx = 0;

  const r = ROUND_RULES[roundNum - 1];
  el('round-intro-icon').textContent  = r.icon;
  el('round-intro-title').textContent = r.title;
  el('round-intro-desc').textContent  = r.desc;
  el('round-intro-num').textContent   = `${roundNum} / 3`;
  el('round-intro-words-left').textContent = `${state.roundWords.length} mots à faire deviner`;

  playRoundStart();
  showScreen('screen-round-intro');
}

// ─── PRÉ-TOUR ─────────────────────────────────────────────────────────────────
function startPreTurn() {
  const team       = state.teams[state.currentTeamIdx];
  const playerName = team.players[state.teamPlayerIdx[state.currentTeamIdx]];

  el('pre-turn-team').textContent  = `${team.emoji} ${team.name}`;
  el('pre-turn-team').style.color  = team.color;
  el('pre-turn-player').textContent = playerName;
  el('pre-turn-round').textContent  = `Manche ${state.currentRound} / 3`;
  el('pre-turn-words-left').textContent =
    `${state.roundWords.length} mot${state.roundWords.length > 1 ? 's' : ''} restant${state.roundWords.length > 1 ? 's' : ''}`;

  showScreen('screen-pre-turn');
}

// ─── TOUR ACTIF ────────────────────────────────────────────────────────────────
function startTurn() {
  state.turnFound  = [];
  state.timeLeft   = TURN_DURATION;

  const rule = ROUND_RULES[state.currentRound - 1];
  el('btn-skip').hidden  = !rule.canSkip;
  el('btn-fault').hidden = !rule.canFault;

  updateTurnStats();
  drawNextWord();
  updateTimerDisplay();
  startTimer();

  showScreen('screen-turn');
}

function drawNextWord() {
  if (state.roundWords.length === 0) {
    endTurn('allFound');
    return;
  }
  state.currentWord = state.roundWords.shift();
  const cat = getCategoryInfo(state.currentWord.category);
  el('word-card-text').textContent     = state.currentWord.word;
  el('word-card-category').textContent = `${cat.emoji} ${cat.label}`;
  el('turn-round-badge').textContent   = `Manche ${state.currentRound} — ${ROUND_RULES[state.currentRound - 1].icon}`;
}

function wordFound() {
  playFound();
  state.turnFound.push(state.currentWord);
  updateTurnStats();
  drawNextWord();
}

function wordSkipped() {
  // Le mot retourne en fin de pioche
  state.roundWords.push(state.currentWord);
  updateTurnStats();
  drawNextWord();
}

function wordFault() {
  // Faute (manche 1) : le mot retourne en tête de pioche, tour arrêté
  if (state.currentWord) {
    state.roundWords.unshift(state.currentWord);
    state.currentWord = null;
  }
  stopTimer();
  playBuzzer();
  endTurn('fault');
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
      endTurn('timeout');
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function updateTimerDisplay() {
  const pct      = state.timeLeft / TURN_DURATION;
  const timerNum  = el('timer-number');
  const timerRing = el('timer-ring-progress');

  timerNum.textContent = state.timeLeft;

  const circ   = 2 * Math.PI * TIMER_CIRCLE_RADIUS;
  const offset = circ * (1 - pct);
  timerRing.style.strokeDasharray  = `${circ}`;
  timerRing.style.strokeDashoffset = `${offset}`;

  if (state.timeLeft <= 5) {
    timerRing.style.stroke = 'var(--danger)';
    timerNum.style.color   = 'var(--danger)';
  } else if (state.timeLeft <= 10) {
    timerRing.style.stroke = 'var(--warning)';
    timerNum.style.color   = 'var(--warning)';
  } else {
    timerRing.style.stroke = 'var(--success)';
    timerNum.style.color   = 'var(--text)';
  }
}

// ─── FIN DE TOUR ───────────────────────────────────────────────────────────────
/**
 * @param {'timeout'|'fault'|'all-found'} reason
 */
function endTurn(reason = 'timeout') {
  stopTimer();

  const team = state.teams[state.currentTeamIdx];
  team.score[state.currentRound - 1] += state.turnFound.length;

  // Message selon la raison
  const reasonMsgs = {
    timeout:   '⏱️ Temps écoulé !',
    fault:     '🚨 Faute — tour arrêté !',
    allFound:  '🎉 Tous les mots trouvés !',
  };
  el('turn-end-reason').textContent = reasonMsgs[reason] ?? '⏱️ Temps écoulé !';

  el('turn-end-team').textContent   = `${team.emoji} ${team.name}`;
  el('turn-end-player').textContent =
    state.teams[state.currentTeamIdx].players[state.teamPlayerIdx[state.currentTeamIdx]];
  el('turn-end-count').textContent  = state.turnFound.length;

  const foundList = el('turn-end-found-list');
  foundList.innerHTML = '';
  state.turnFound.forEach(w => {
    const li  = document.createElement('li');
    const cat = getCategoryInfo(w.category);
    li.textContent = `${cat.emoji} ${w.word}`;
    foundList.appendChild(li);
  });

  el('turn-end-words-left').textContent = state.roundWords.length;

  // Avancer au joueur suivant dans l'équipe
  const pi = state.teamPlayerIdx[state.currentTeamIdx];
  state.teamPlayerIdx[state.currentTeamIdx] = (pi + 1) % team.players.length;

  if (reason === 'allFound' || state.roundWords.length === 0) {
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
    const tr      = document.createElement('tr');
    const roundPts = team.score[state.currentRound - 1];
    const totalPts = team.score.reduce((a, b) => a + b, 0);

    const tdName = document.createElement('td');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${team.emoji} ${team.name}`;
    nameSpan.style.color = team.color;
    tdName.appendChild(nameSpan);

    const tdRound = document.createElement('td');
    tdRound.className = 'score-cell';
    tdRound.textContent = roundPts;

    const tdTotal = document.createElement('td');
    tdTotal.className = 'score-cell total-score';
    tdTotal.textContent = totalPts;

    tr.appendChild(tdName);
    tr.appendChild(tdRound);
    tr.appendChild(tdTotal);
    scoreRows.appendChild(tr);
  });

  const isLastRound = state.currentRound === 3;
  el('btn-next-round').hidden    = isLastRound;
  el('btn-final-results').hidden = !isLastRound;

  showScreen('screen-round-end');
}

// ─── FIN DU JEU ────────────────────────────────────────────────────────────────
function showGameOver() {
  playGameOver();

  const scored = state.teams
    .map(t => ({ team: t, total: t.score.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);

  const isTie = scored.length >= 2 && scored[0].total === scored[1].total;

  const winnerEl = el('game-over-winner');
  if (isTie) {
    winnerEl.textContent = '🤝 Égalité !';
    winnerEl.style.color = 'var(--warning)';
  } else {
    const w = scored[0].team;
    winnerEl.textContent = `${w.emoji} ${w.name}`;
    winnerEl.style.color = w.color;
  }

  const RANK_EMOJIS = ['🥇', '🥈', '🥉', '🎖️'];
  const finalScores = el('final-scores');
  finalScores.innerHTML = '';
  scored.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'final-score-row';

    const rankSpan = document.createElement('span');
    rankSpan.className = 'final-rank';
    rankSpan.textContent = (i === 0 && !isTie)
      ? RANK_EMOJIS[0]
      : RANK_EMOJIS[Math.min(i, RANK_EMOJIS.length - 1)];

    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${s.team.emoji} ${s.team.name}`;
    nameSpan.style.color = s.team.color;

    const ptsSpan = document.createElement('span');
    ptsSpan.className = 'final-pts';
    ptsSpan.textContent = `${s.total} pts`;

    div.appendChild(rankSpan);
    div.appendChild(nameSpan);
    div.appendChild(ptsSpan);
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
  el('btn-fault').addEventListener('click', wordFault);

  // ── Turn end ──
  el('btn-next-turn').addEventListener('click', handleNextTurn);

  // ── Round end ──
  el('btn-next-round').addEventListener('click', () => {
    startRound(state.currentRound + 1);
  });
  el('btn-final-results').addEventListener('click', showGameOver);

  // ── Game over ──
  el('btn-replay').addEventListener('click', () => {
    state.playerNames    = [];
    state.teams          = [];
    state.teamPlayerIdx  = [];
    state.allWords       = [];
    state.roundWords     = [];
    state.currentRound   = 0;
    state.noTeamsMode    = false;
    renderPlayerList();
    showScreen('screen-setup');
  });

  // ── Mute toggle ──
  el('btn-mute').addEventListener('click', () => {
    setMuted(!getMuted());
    el('btn-mute').textContent = getMuted() ? '🔇' : '🔊';
  });

  renderPlayerList();
  showScreen('screen-setup');
}

document.addEventListener('DOMContentLoaded', init);


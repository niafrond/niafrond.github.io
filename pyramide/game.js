/**
 * game.js — Logique de jeu Pyramide
 * 5 rounds: Les Énigmes, Ping-Pong, Noms Propres, Contre-la-Montre, La Grande Pyramide
 */

import { state, TEAMS_META } from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { playFound, playBuzzer, playTick, playTickUrgent, playGameOver, playGameStart, playButtonClick } from './sound.js';
import { getR1Words, getR2Words, getR3Set, getR4Set, getFinalSet } from './words.js';

// ─── Callbacks pour navigation linéaire ───────────────────────────────────────
let _preRoundNext = null;
let _turnEndNext  = null;

export function triggerPreRoundStart() {
  if (_preRoundNext) { const fn = _preRoundNext; _preRoundNext = null; fn(); }
}

export function triggerNextTurn() {
  if (_turnEndNext) { const fn = _turnEndNext; _turnEndNext = null; fn(); }
}

// ─── Teams ─────────────────────────────────────────────────────────────────────

export function assignTeams() {
  const names = [...state.playerNames].sort(() => Math.random() - 0.5);
  state.teams = TEAMS_META.map(meta => ({
    name:    meta.label,
    color:   meta.color,
    players: [],
    score:   0,
  }));
  names.forEach((name, idx) => {
    state.teams[idx % 2].players.push(name);
  });
  state.currentTeam = 0;
}

export function renderTeams() {
  const container = el('teams-container');
  if (!container) return;
  container.innerHTML = state.teams.map(team => `
    <div class="team-card" style="border-left:4px solid ${team.color}">
      <div class="team-name" style="color:${team.color}">${team.name}</div>
      <div class="team-players">${team.players.join(', ') || '–'}</div>
    </div>
  `).join('');
}

// ─── Word sets ─────────────────────────────────────────────────────────────────

export function generateWordSets() {
  const r1 = getR1Words();
  state.wordSets.round1.teamA = r1.slice(0, 5);
  state.wordSets.round1.teamB = r1.slice(5, 10);

  const r2 = getR2Words();
  state.wordSets.round2.shared = r2.slice(0, 5);

  const r3 = getR3Set();
  state.wordSets.round3.theme = r3.theme;
  state.wordSets.round3.words = r3.words.slice(0, 5);

  const r4a = getR4Set();
  state.wordSets.round4.teamA = { theme: r4a.theme, words: r4a.words.slice(0, 7) };
  const r4bCandidates = [0,1,2,3,4,5,6].map(() => getR4Set());
  const r4b = r4bCandidates.find(s => s.theme !== r4a.theme) || r4bCandidates[0];
  state.wordSets.round4.teamB = { theme: r4b.theme, words: r4b.words.slice(0, 7) };

  state.wordSets.final.words = getFinalSet();
}

// ─── Pre-round screen ──────────────────────────────────────────────────────────

const ROUND_INFO = [
  null,
  {
    name: 'Manche 1 — Les Énigmes 🧩',
    color: 'var(--lagon)',
    rules: [
      'Chaque équipe joue à son tour',
      '5 mots à faire deviner — 13 briques par équipe',
      'Chaque indice coûte 1 brique 🧱',
      'Mot trouvé → +1 point ✅',
      'Briques restantes à la fin → points bonus',
      '❌ Interdits : gestes, sons, même famille, traduction directe',
    ],
  },
  {
    name: 'Manche 2 — Ping-Pong 🏓',
    color: 'var(--soleil)',
    rules: [
      '5 mots partagés — 13 briques communes',
      "L'équipe en jeu donne UN seul indice, l'autre équipe devine",
      "Mot trouvé → +1 à l'équipe qui a donné l'indice",
      "Raté → les rôles s'inversent pour le mot suivant",
      '0 brique = fin de manche',
    ],
  },
  {
    name: 'Manche 3 — Noms Propres 🌍',
    color: 'var(--foret)',
    rules: [
      'Chaque équipe mise secrètement 1 à 3 briques',
      'La plus petite mise gagne le rôle de donneur d\'indices',
      'Égalité → nouvelle mise',
      'Mot trouvé → +1 au donneur',
      'Raté avec mise > 1 → +1 à l\'adversaire',
      'Raté avec mise = 1 → +2 à l\'adversaire',
    ],
  },
  {
    name: 'Manche 4 — Contre-la-Montre ⏱️',
    color: 'var(--danger)',
    rules: [
      'Chaque équipe joue à son tour',
      '7 mots à faire deviner en 30 secondes',
      'Pas de briques — seulement le chrono !',
      'Mot trouvé → +1 point ✅',
      'Passer → 0 point pour ce mot',
    ],
  },
  {
    name: 'Finale — La Grande Pyramide 🏛️',
    color: '#ffd700',
    rules: [
      '6 expressions françaises à faire deviner',
      '60 secondes + 1 bonus de +10 secondes (une seule fois)',
      'Toutes trouvées avant la fin → JACKPOT 🎉',
      'Les deux équipes jouent ensemble !',
    ],
  },
];

export function showPreRound(round, onStart) {
  _preRoundNext = onStart;
  const info = ROUND_INFO[round];
  if (!info) return;

  const titleEl  = el('pre-round-title');
  const rulesEl  = el('pre-round-rules');
  const barEl    = el('pre-round-bar');

  if (titleEl) titleEl.textContent = info.name;
  if (barEl)   barEl.style.background = info.color;
  if (rulesEl) {
    rulesEl.innerHTML = info.rules.map(r => `<li>${r}</li>`).join('');
  }

  if (round === 3) {
    const themeNote = el('pre-round-theme');
    if (themeNote) {
      themeNote.textContent = `Thème : ${state.wordSets.round3.theme}`;
      themeNote.hidden = false;
    }
  } else {
    const themeNote = el('pre-round-theme');
    if (themeNote) themeNote.hidden = true;
  }

  showScreen('screen-pre-round');
}

// ─── Shared UI helpers ─────────────────────────────────────────────────────────

function _updateTurnHeader(round, team, subtitle = '') {
  const roundNames = ['', 'Manche 1', 'Manche 2', 'Manche 3', 'Manche 4', 'Finale'];
  const badge = el('turn-round-badge');
  const teamNameEl = el('turn-team-name');
  const subtitleEl = el('turn-subtitle');

  if (badge) badge.textContent = roundNames[round] || '';
  if (teamNameEl) { teamNameEl.textContent = team.name; teamNameEl.style.color = team.color; }
  if (subtitleEl) { subtitleEl.textContent = subtitle; subtitleEl.hidden = !subtitle; }
}

function _updateWord(word) {
  const wordEl = el('turn-word');
  if (wordEl) wordEl.textContent = word || '';
}

function _updateBricks(left, total) {
  const bricksEl = el('turn-bricks');
  if (!bricksEl) return;
  bricksEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const brick = document.createElement('span');
    brick.className = i < (total - left) ? 'brick brick-used' : 'brick brick-active';
    bricksEl.appendChild(brick);
  }
  const countEl = el('turn-bricks-count');
  if (countEl) countEl.textContent = `${left} brique${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''}`;
}

function _updateClueCount(count) {
  const clueEl = el('turn-clue-count');
  if (clueEl) clueEl.textContent = `${count} indice${count !== 1 ? 's' : ''} donné${count !== 1 ? 's' : ''}`;
}

function _updateScores() {
  const html = state.teams.map(t => `
    <div class="score-pill" style="border-color:${t.color}">
      <span style="color:${t.color}">${t.name.replace('Équipe ', '')}</span>
      <strong>${t.score}</strong>
    </div>
  `).join('');
  ['turn-scores', 'timer-scores'].forEach(id => {
    const el2 = el(id);
    if (el2) el2.innerHTML = html;
  });
}

function _showTurnEnd(message, onNext) {
  _turnEndNext = onNext;

  const msgEl    = el('sub-turn-message');
  const scoresEl = el('turn-end-scores');

  if (msgEl) msgEl.textContent = message;
  if (scoresEl) {
    scoresEl.innerHTML = state.teams.map(t => `
      <div class="turn-end-score-row">
        <span class="turn-end-team" style="color:${t.color}">${t.name}</span>
        <span class="turn-end-pts">${t.score} pt${t.score !== 1 ? 's' : ''}</span>
      </div>
    `).join('');
  }

  showScreen('screen-turn-end');
}

// ─── Turn screen button visibility ────────────────────────────────────────────

function _setTurnButtons(mode) {
  // mode: 'clue-only' | 'verdict-only' | 'full'
  const clueBtn    = el('btn-give-clue');
  const foundBtn   = el('btn-word-found');
  const skipBtn    = el('btn-word-skip');

  if (clueBtn)  clueBtn.hidden  = (mode === 'verdict-only');
  if (foundBtn) foundBtn.hidden = (mode === 'clue-only');
  if (skipBtn)  skipBtn.hidden  = (mode === 'clue-only');
}

// ─── Round 1 — Les Énigmes ─────────────────────────────────────────────────────

export function startRound1() {
  state.currentRound = 1;
  showPreRound(1, () => initR1Turn(0));
}

export function initR1Turn(subTeam) {
  state.r1SubTeam   = subTeam;
  state.r1WordIdx   = 0;
  state.r1BricksLeft = 13;
  state.r1ClueCount = 0;
  state.currentTeam = subTeam;

  const team  = state.teams[subTeam];
  const words = subTeam === 0 ? state.wordSets.round1.teamA : state.wordSets.round1.teamB;

  _updateTurnHeader(1, team);
  _updateWord(words[0]);
  _updateBricks(13, 13);
  _updateClueCount(0);
  _updateScores();
  _setTurnButtons('full');

  showScreen('screen-turn');
}

export function r1GiveClue() {
  if (state.r1BricksLeft <= 0) return;
  playButtonClick();

  state.r1BricksLeft--;
  state.r1ClueCount++;
  _updateBricks(state.r1BricksLeft, 13);
  _updateClueCount(state.r1ClueCount);

  if (state.r1BricksLeft <= 0) {
    playBuzzer();
    showToast('Plus de briques ! Mot perdu.', 'warning');
    setTimeout(() => _r1ForceSkip(), 900);
  }
}

function _r1ForceSkip() {
  const words = state.r1SubTeam === 0 ? state.wordSets.round1.teamA : state.wordSets.round1.teamB;
  state.r1WordIdx++;
  state.r1ClueCount = 0;

  if (state.r1WordIdx >= words.length) {
    r1EndSubTurn();
    return;
  }
  _updateWord(words[state.r1WordIdx]);
  _updateClueCount(0);
  _updateBricks(0, 13);
}

export function r1WordFound() {
  const words = state.r1SubTeam === 0 ? state.wordSets.round1.teamA : state.wordSets.round1.teamB;
  playFound();
  state.teams[state.r1SubTeam].score++;
  state.r1WordIdx++;
  state.r1ClueCount = 0;
  _updateScores();

  if (state.r1WordIdx >= words.length) {
    const bonus = state.r1BricksLeft;
    if (bonus > 0) {
      state.teams[state.r1SubTeam].score += bonus;
      _updateScores();
      showToast(`🎉 Tous trouvés ! +${bonus} pts bonus`, 'success');
    } else {
      showToast('🎉 Tous les mots trouvés !', 'success');
    }
    setTimeout(() => r1EndSubTurn(), 1200);
    return;
  }

  _updateWord(words[state.r1WordIdx]);
  _updateClueCount(0);
  _updateBricks(state.r1BricksLeft, 13);
}

export function r1WordSkipped() {
  const words = state.r1SubTeam === 0 ? state.wordSets.round1.teamA : state.wordSets.round1.teamB;
  playBuzzer();
  state.r1WordIdx++;
  state.r1ClueCount = 0;

  if (state.r1WordIdx >= words.length || state.r1BricksLeft <= 0) {
    r1EndSubTurn();
    return;
  }

  _updateWord(words[state.r1WordIdx]);
  _updateClueCount(0);
  _updateBricks(state.r1BricksLeft, 13);
}

export function r1EndSubTurn() {
  if (state.r1SubTeam === 0) {
    _showTurnEnd(`${state.teams[0].name} a terminé !`, () => initR1Turn(1));
  } else {
    _showTurnEnd('Fin de la Manche 1 !', () => startRound2());
  }
}

// ─── Round 2 — Ping-Pong ───────────────────────────────────────────────────────

export function startRound2() {
  state.currentRound = 2;
  state.r2WordIdx    = 0;
  state.r2BricksLeft = 13;
  state.r2Giver      = 0;
  state.r2ClueGiven  = false;
  showPreRound(2, () => _enterR2());
}

function _enterR2() {
  state.r2ClueGiven = false;
  const team  = state.teams[state.r2Giver];
  const words = state.wordSets.round2.shared;
  const opponent = state.teams[1 - state.r2Giver];

  _updateTurnHeader(2, team, `Indice à ${opponent.name}`);
  _updateWord(words[state.r2WordIdx]);
  _updateBricks(state.r2BricksLeft, 13);
  _updateClueCount(0);
  _updateScores();
  _setTurnButtons('clue-only');

  showScreen('screen-turn');
}

export function r2GiveClue() {
  if (state.r2BricksLeft <= 0 || state.r2ClueGiven) return;
  playButtonClick();

  state.r2BricksLeft--;
  state.r2ClueGiven = true;
  _updateBricks(state.r2BricksLeft, 13);
  _setTurnButtons('verdict-only');

  if (state.r2BricksLeft <= 0) {
    showToast('Dernière brique utilisée !', 'warning');
  }
}

export function r2WordFound() {
  if (!state.r2ClueGiven) return;
  playFound();
  state.teams[state.r2Giver].score++;
  state.r2WordIdx++;
  state.r2Giver = 1 - state.r2Giver;
  _updateScores();

  if (state.r2WordIdx >= state.wordSets.round2.shared.length || state.r2BricksLeft <= 0) {
    r2EndRound();
    return;
  }
  _enterR2();
}

export function r2WordMissed() {
  if (!state.r2ClueGiven) return;
  playBuzzer();
  state.r2WordIdx++;
  state.r2Giver = 1 - state.r2Giver;

  if (state.r2WordIdx >= state.wordSets.round2.shared.length || state.r2BricksLeft <= 0) {
    r2EndRound();
    return;
  }
  _enterR2();
}

export function r2EndRound() {
  _showTurnEnd('Fin de la Manche 2 !', () => startRound3());
}

// ─── Round 3 — Noms Propres ────────────────────────────────────────────────────

export function startRound3() {
  state.currentRound = 3;
  state.r3WordIdx    = 0;
  showPreRound(3, () => showBidding(0));
}

export function showBidding(wordIdx) {
  state.r3WordIdx  = wordIdx;
  state.r3BidA     = null;
  state.r3BidB     = null;
  state.r3BidPhase = 'A';

  const themeEl    = el('bidding-theme');
  const wordNumEl  = el('bidding-word-num');
  const totalEl    = el('bidding-total');
  const sectionA   = el('bidding-section-a');
  const sectionB   = el('bidding-section-b');
  const revealEl   = el('bidding-reveal');

  if (themeEl)   themeEl.textContent   = state.wordSets.round3.theme;
  if (wordNumEl) wordNumEl.textContent = wordIdx + 1;
  if (totalEl)   totalEl.textContent   = state.wordSets.round3.words.length;

  if (sectionA) sectionA.hidden = false;
  if (sectionB) sectionB.hidden = true;
  if (revealEl) revealEl.hidden = true;

  document.querySelectorAll('.bid-btn').forEach(b => b.classList.remove('bid-btn--selected'));
  const confirmA = el('btn-bid-confirm-a');
  const confirmB = el('btn-bid-confirm-b');
  if (confirmA) confirmA.disabled = true;
  if (confirmB) confirmB.disabled = true;

  showScreen('screen-bidding');
}

export function selectBid(team, bid) {
  const prefix = team === 0 ? 'a' : 'b';
  document.querySelectorAll(`.bid-btn-${prefix}`).forEach(b => {
    b.classList.toggle('bid-btn--selected', parseInt(b.dataset.bid, 10) === bid);
  });
  const confirmBtn = el(`btn-bid-confirm-${prefix}`);
  if (confirmBtn) confirmBtn.disabled = false;

  if (team === 0) state.r3BidA = bid;
  else            state.r3BidB = bid;
}

export function submitBid(team) {
  if (team === 0) {
    if (state.r3BidA === null) return;
    state.r3BidPhase = 'B';
    const sectionA = el('bidding-section-a');
    const sectionB = el('bidding-section-b');
    const statusA  = el('bidding-status-a');
    if (sectionA) sectionA.hidden = true;
    if (sectionB) sectionB.hidden = false;
    if (statusA)  statusA.textContent = '✅ Mise confirmée';
    document.querySelectorAll('.bid-btn-b').forEach(b => b.classList.remove('bid-btn--selected'));
    const confirmB = el('btn-bid-confirm-b');
    if (confirmB) confirmB.disabled = true;
  } else {
    if (state.r3BidB === null) return;
    _resolveBids();
  }
}

function _resolveBids() {
  const bidA = state.r3BidA;
  const bidB = state.r3BidB;

  const revealEl = el('bidding-reveal');
  const bidAEl   = el('bidding-reveal-a');
  const bidBEl   = el('bidding-reveal-b');

  if (revealEl) revealEl.hidden = false;
  if (bidAEl)   bidAEl.textContent = `${state.teams[0].name} : ${bidA} brique${bidA > 1 ? 's' : ''}`;
  if (bidBEl)   bidBEl.textContent = `${state.teams[1].name} : ${bidB} brique${bidB > 1 ? 's' : ''}`;

  if (bidA === bidB) {
    const tieEl = el('bidding-tie');
    if (tieEl) tieEl.hidden = false;
    setTimeout(() => {
      const tieEl2 = el('bidding-tie');
      if (tieEl2) tieEl2.hidden = true;
      showBidding(state.r3WordIdx);
    }, 1800);
    return;
  }

  if (bidA < bidB) {
    state.r3Giver     = 0;
    state.r3MaxBricks = bidA;
  } else {
    state.r3Giver     = 1;
    state.r3MaxBricks = bidB;
  }

  state.r3BricksLeft = state.r3MaxBricks;
  state.r3ClueCount  = 0;

  const winnerEl = el('bidding-winner');
  if (winnerEl) {
    winnerEl.textContent = `${state.teams[state.r3Giver].name} donne les indices (${state.r3MaxBricks} brique${state.r3MaxBricks > 1 ? 's' : ''})`;
    winnerEl.style.color = state.teams[state.r3Giver].color;
    winnerEl.hidden = false;
  }

  setTimeout(() => r3StartWord(), 1500);
}

export function r3StartWord() {
  const words = state.wordSets.round3.words;
  const team  = state.teams[state.r3Giver];

  _updateTurnHeader(3, team, `Thème : ${state.wordSets.round3.theme}`);
  _updateWord(words[state.r3WordIdx]);
  _updateBricks(state.r3BricksLeft, state.r3MaxBricks);
  _updateClueCount(0);
  _updateScores();
  _setTurnButtons('full');

  showScreen('screen-turn');
}

export function r3GiveClue() {
  if (state.r3BricksLeft <= 0) {
    showToast('Plus de briques disponibles !', 'warning');
    return;
  }
  playButtonClick();
  state.r3BricksLeft--;
  state.r3ClueCount++;
  _updateBricks(state.r3BricksLeft, state.r3MaxBricks);
  _updateClueCount(state.r3ClueCount);
}

export function r3WordFound() {
  playFound();
  state.teams[state.r3Giver].score++;
  _updateScores();
  showToast(`+1 pour ${state.teams[state.r3Giver].name} !`, 'success');
  setTimeout(() => r3NextWord(), 900);
}

export function r3WordFailed() {
  const opponent = 1 - state.r3Giver;
  playBuzzer();

  if (state.r3MaxBricks > 1) {
    state.teams[opponent].score++;
    showToast(`Raté ! +1 pour ${state.teams[opponent].name}`, 'warning');
  } else {
    state.teams[opponent].score += 2;
    showToast(`Raté ! +2 pour ${state.teams[opponent].name}`, 'warning');
  }
  _updateScores();
  setTimeout(() => r3NextWord(), 900);
}

export function r3NextWord() {
  state.r3WordIdx++;
  if (state.r3WordIdx >= state.wordSets.round3.words.length) {
    _showTurnEnd('Fin de la Manche 3 !', () => startRound4());
    return;
  }
  showBidding(state.r3WordIdx);
}

// ─── Round 4 — Contre-la-Montre ────────────────────────────────────────────────

const TIMER_RADIUS = 46;
const TIMER_CIRCUM = 2 * Math.PI * TIMER_RADIUS;

function _updateTimerCircle(timeLeft, total, progressId, labelId) {
  const progress = el(progressId);
  const label    = el(labelId);
  if (progress) {
    const ratio = Math.max(0, timeLeft / total);
    progress.style.strokeDashoffset = TIMER_CIRCUM * (1 - ratio);
    const pct = ratio * 100;
    progress.style.stroke = pct > 50 ? 'var(--success)' : pct > 20 ? 'var(--warning)' : 'var(--danger)';
  }
  if (label) label.textContent = timeLeft;
}

export function startRound4() {
  state.currentRound = 4;
  state.r4SubTeam   = 0;
  showPreRound(4, () => initR4Turn(0));
}

export function initR4Turn(subTeam) {
  stopR4Timer();
  state.r4SubTeam    = subTeam;
  state.r4WordIdx    = 0;
  state.r4FoundCount = 0;
  state.r4TimeRemaining      = 30;
  state.currentTeam  = subTeam;

  const set  = subTeam === 0 ? state.wordSets.round4.teamA : state.wordSets.round4.teamB;
  const team = state.teams[subTeam];

  const teamNameEl = el('timer-team-name');
  const themeEl    = el('timer-theme');
  const wordEl     = el('timer-word');

  if (teamNameEl) { teamNameEl.textContent = team.name; teamNameEl.style.color = team.color; }
  if (themeEl)   themeEl.textContent = `Thème : ${set.theme}`;
  if (wordEl)    wordEl.textContent  = set.words[0];

  _updateTimerCircle(30, 30, 'r4-timer-progress', 'r4-timer-label');
  _updateScores();

  showScreen('screen-timer');
  setTimeout(() => startR4Timer(), 600);
}

export function r4WordFound() {
  const set = state.r4SubTeam === 0 ? state.wordSets.round4.teamA : state.wordSets.round4.teamB;
  playFound();
  state.teams[state.r4SubTeam].score++;
  state.r4FoundCount++;
  state.r4WordIdx++;
  _updateScores();

  if (state.r4WordIdx >= set.words.length) {
    stopR4Timer();
    showToast('🎉 Tous les mots trouvés !', 'success');
    setTimeout(() => r4EndSubTurn(), 1000);
    return;
  }

  const wordEl = el('timer-word');
  if (wordEl) wordEl.textContent = set.words[state.r4WordIdx];
}

export function r4WordSkipped() {
  const set = state.r4SubTeam === 0 ? state.wordSets.round4.teamA : state.wordSets.round4.teamB;
  state.r4WordIdx++;

  if (state.r4WordIdx >= set.words.length) {
    stopR4Timer();
    setTimeout(() => r4EndSubTurn(), 400);
    return;
  }

  const wordEl = el('timer-word');
  if (wordEl) wordEl.textContent = set.words[state.r4WordIdx];
}

export function r4EndSubTurn() {
  stopR4Timer();
  const team = state.teams[state.r4SubTeam];
  const msg  = `${team.name} : ${state.r4FoundCount} mot${state.r4FoundCount !== 1 ? 's' : ''} trouvé${state.r4FoundCount !== 1 ? 's' : ''}`;

  if (state.r4SubTeam === 0) {
    _showTurnEnd(msg, () => initR4Turn(1));
  } else {
    _showTurnEnd('Fin de la Manche 4 !', () => startFinal());
  }
}

export function startR4Timer() {
  stopR4Timer();
  state.r4TimeRemainingInterval = setInterval(() => {
    state.r4TimeRemaining--;

    if (state.r4TimeRemaining <= 5)       playTickUrgent();
    else if (state.r4TimeRemaining <= 10) playTick();

    _updateTimerCircle(state.r4TimeRemaining, 30, 'r4-timer-progress', 'r4-timer-label');

    if (state.r4TimeRemaining <= 0) {
      stopR4Timer();
      playBuzzer();
      r4EndSubTurn();
    }
  }, 1000);
}

export function stopR4Timer() {
  if (state.r4TimeRemainingInterval) {
    clearInterval(state.r4TimeRemainingInterval);
    state.r4TimeRemainingInterval = null;
  }
}

// ─── Finale — La Grande Pyramide ───────────────────────────────────────────────

export function startFinal() {
  state.currentRound    = 5;
  state.finalWordIdx    = 0;
  state.finalTimer      = 60;
  state.finalBonusUsed  = false;
  showPreRound(5, () => _enterFinal());
}

function _enterFinal() {
  const words = state.wordSets.final.words;

  const wordEl    = el('final-word');
  const progressEl = el('final-progress');
  const bonusBtn  = el('btn-final-bonus');

  if (wordEl)     wordEl.textContent     = words[0];
  if (progressEl) progressEl.textContent = `1 / ${words.length}`;
  if (bonusBtn)   bonusBtn.disabled      = false;

  _updateTimerCircle(60, 70, 'final-timer-progress', 'final-timer-label');
  _updateScores();

  showScreen('screen-final');
  setTimeout(() => _startFinalTimer(), 600);
}

function _startFinalTimer() {
  _stopFinalTimer();
  state.finalTimerInterval = setInterval(() => {
    state.finalTimer--;

    if (state.finalTimer <= 5)       playTickUrgent();
    else if (state.finalTimer <= 10) playTick();

    _updateTimerCircle(state.finalTimer, 70, 'final-timer-progress', 'final-timer-label');

    if (state.finalTimer <= 0) {
      _stopFinalTimer();
      playBuzzer();
      endFinal(false);
    }
  }, 1000);
}

function _stopFinalTimer() {
  if (state.finalTimerInterval) {
    clearInterval(state.finalTimerInterval);
    state.finalTimerInterval = null;
  }
}

export function finalWordFound() {
  const words = state.wordSets.final.words;
  playFound();
  state.finalWordIdx++;

  if (state.finalWordIdx >= words.length) {
    _stopFinalTimer();
    endFinal(true);
    return;
  }

  const wordEl     = el('final-word');
  const progressEl = el('final-progress');
  if (wordEl)     wordEl.textContent     = words[state.finalWordIdx];
  if (progressEl) progressEl.textContent = `${state.finalWordIdx + 1} / ${words.length}`;
}

export function finalWordFailed() {
  const words = state.wordSets.final.words;
  playBuzzer();
  state.finalWordIdx++;

  if (state.finalWordIdx >= words.length) {
    _stopFinalTimer();
    endFinal(false);
    return;
  }

  const wordEl     = el('final-word');
  const progressEl = el('final-progress');
  if (wordEl)     wordEl.textContent     = words[state.finalWordIdx];
  if (progressEl) progressEl.textContent = `${state.finalWordIdx + 1} / ${words.length}`;
}

export function useBonusTime() {
  if (state.finalBonusUsed) return;
  state.finalBonusUsed = true;
  state.finalTimer += 10;

  const bonusBtn = el('btn-final-bonus');
  if (bonusBtn) bonusBtn.disabled = true;

  playGameStart();
  showToast('+10 secondes !', 'success');
}

export function endFinal(jackpot) {
  _stopFinalTimer();
  if (jackpot) {
    playGameStart();
    showToast('🎉 JACKPOT ! Toutes les expressions trouvées !', 'success');
  } else {
    playGameOver();
  }
  setTimeout(() => showGameOver(jackpot), 1500);
}

// ─── Game over ─────────────────────────────────────────────────────────────────

export function showGameOver(jackpot = false) {
  const sorted  = [...state.teams].sort((a, b) => b.score - a.score);
  const results = el('game-over-results');

  if (results) {
    results.innerHTML = sorted.map((team, i) => `
      <div class="result-row">
        <span class="result-rank">${i === 0 ? '🏆' : `${i + 1}.`}</span>
        <span class="result-team" style="color:${team.color}">${team.name}</span>
        <span class="result-score">${team.score} pt${team.score !== 1 ? 's' : ''}</span>
      </div>
    `).join('');
  }

  const jackpotEl = el('game-over-jackpot');
  if (jackpotEl) jackpotEl.hidden = !jackpot;

  showScreen('screen-game-over');
}

// ─── Generic round handlers (called from main.js) ──────────────────────────────

export function handleGiveClue() {
  if (state.currentRound === 1) r1GiveClue();
  else if (state.currentRound === 2) r2GiveClue();
  else if (state.currentRound === 3) r3GiveClue();
}

export function handleWordFound() {
  if (state.currentRound === 1) r1WordFound();
  else if (state.currentRound === 2) r2WordFound();
  else if (state.currentRound === 3) r3WordFound();
}

export function handleWordSkip() {
  if (state.currentRound === 1) r1WordSkipped();
  else if (state.currentRound === 2) r2WordMissed();
  else if (state.currentRound === 3) r3WordFailed();
}

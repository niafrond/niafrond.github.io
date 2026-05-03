/**
 * game.js — Logique du jeu Pyramide
 *
 * Flux : setup → teams → pre-round → turn → turn-end → [correction] → round-end → … → game-over
 */

import { state, PRE_ROUND_CONTENT, TEAMS_META } from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { playTick, playTickUrgent, playBuzzer, playFound, playGameStart, playGameOver } from './sound.js';
import { getGameWords, getExpressionWords } from './words.js';

// ─── Équipes ───────────────────────────────────────────────────────────────────

export function assignTeams() {
  const names = [...state.playerNames].sort(() => Math.random() - 0.5);
  state.teams = [
    { name: TEAMS_META[0].label, color: TEAMS_META[0].color, players: [], score: 0 },
    { name: TEAMS_META[1].label, color: TEAMS_META[1].color, players: [], score: 0 },
  ];
  names.forEach((name, idx) => {
    state.teams[idx % 2].players.push(name);
  });
  state.currentTeamIdx = 0;
}

export function renderTeams() {
  const container = el('teams-container');
  if (!container) return;
  container.innerHTML = state.teams.map(team => `
    <div class="team-card" style="border-left: 4px solid ${team.color}">
      <div class="team-name" style="color:${team.color}">${team.name}</div>
      <div class="team-players">${team.players.join(', ')}</div>
    </div>
  `).join('');
}

// ─── Initialisation ────────────────────────────────────────────────────────────

export function initGame() {
  state.allWords            = getGameWords(state.wordCount);
  state.expressionWords     = getExpressionWords(Math.max(10, Math.floor(state.wordCount * 0.75)));
  state.currentRound        = 1;
  state.currentPhase        = 1;
  state.teamsPlayedThisRound = 0;
  state.currentTeamIdx      = 0;
  state.teams.forEach(t => { t.score = 0; });
  showPreRound();
}

// ─── Écran Pré-Manche ──────────────────────────────────────────────────────────

export function showPreRound() {
  const roundNum = state.currentRound;
  const phase    = state.currentPhase;
  const content  = PRE_ROUND_CONTENT[roundNum] || PRE_ROUND_CONTENT[1];

  let title      = content.title;
  let doText     = content.doText;
  let forbidText = content.forbidText;
  let special    = content.special;

  // Personnalisation pour la manche 5 (deux phases)
  if (roundNum === 5) {
    if (phase === 1) {
      title   = 'Manche 5 — Finale · Phase 1';
      doText  = 'Description libre — Décrivez le mot avec tous les moyens.';
      forbidText = 'Le mot lui-même ou tout mot de la même famille';
      special = '⚡ Phase 1/2 de la Finale';
    } else {
      title   = 'Manche 5 — Finale · Phase 2';
      doText  = 'Un seul mot comme indice.';
      forbidText = 'Plusieurs mots, variantes ou déclinaisons';
      special = '⚡ Phase 2/2 de la Finale';
    }
  }

  el('pre-round-title').textContent  = title;
  el('pre-round-icon').textContent   = content.icon;
  el('pre-round-do').textContent     = doText;
  el('pre-round-forbid').textContent = forbidText;

  const specialEl = el('pre-round-special');
  const specialCt = el('pre-round-special-container');
  if (specialEl)  specialEl.textContent = special || '';
  if (specialCt)  specialCt.hidden      = !special;

  // Équipe qui jouera en premier ce tour
  const team = state.teams[state.currentTeamIdx];
  const teamEl = el('pre-round-team');
  if (teamEl) {
    teamEl.textContent = team.name;
    teamEl.style.color = team.color;
  }

  // Numéro de manche
  const mancheEl = el('pre-round-manche-num');
  if (mancheEl) mancheEl.textContent = `Manche ${roundNum}${roundNum === 5 ? ` · Phase ${phase}` : ''}`;

  showScreen('screen-pre-round');
}

// ─── Timer ─────────────────────────────────────────────────────────────────────

const TIMER_RADIUS = 46;
const TIMER_CIRCUM = 2 * Math.PI * TIMER_RADIUS; // ≈ 289

function _updateTimerDisplay() {
  const progress = el('timer-progress');
  const label    = el('timer-label');
  if (progress) {
    const ratio = Math.max(0, state.timeLeft / state.turnDuration);
    progress.style.strokeDashoffset = TIMER_CIRCUM * (1 - ratio);
    const pct = ratio * 100;
    progress.style.stroke =
      pct > 50 ? 'var(--success)' : pct > 20 ? 'var(--warning)' : 'var(--danger)';
  }
  if (label) label.textContent = state.timeLeft;
}

function _onTimerTick() {
  if (state.timerPaused) return;
  state.timeLeft--;
  if (state.timeLeft <= 5)       playTickUrgent();
  else if (state.timeLeft <= 10) playTick();
  _updateTimerDisplay();
  if (state.timeLeft <= 0) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    _onTimeUp();
  }
}

function _onTimeUp() {
  playBuzzer();
  endTurn();
}

export function startTimer() {
  clearInterval(state.timerInterval);
  state.timeLeft    = state.turnDuration;
  state.timerPaused = false;
  _updateTimerDisplay();
  state.timerInterval = setInterval(_onTimerTick, 1000);
}

export function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

// ─── Tour en cours ─────────────────────────────────────────────────────────────

export function startTurn() {
  const team = state.teams[state.currentTeamIdx];

  // Init état du tour
  state.foundWordsThisTurn   = [];
  state.skippedWordsThisTurn = [];
  state.contestedClues       = [];

  // Ordre des mots : expressions pour manche 3, fixe pour manche 4, mélangé sinon
  if (state.currentRound === 3) {
    state.currentTurnWords = [...state.expressionWords].sort(() => Math.random() - 0.5);
  } else if (state.currentRound === 4) {
    state.currentTurnWords = [...state.allWords];
  } else {
    state.currentTurnWords = [...state.allWords].sort(() => Math.random() - 0.5);
  }
  state.currentWordIdx = 0;

  // Affichage équipe
  const teamNameEl = el('turn-team-name');
  if (teamNameEl) {
    teamNameEl.textContent = team.name;
    teamNameEl.style.color = team.color;
  }

  // Libellé de manche
  const ROUND_NAMES = ['', 'Libre', 'Un mot', 'Expressions', 'Pyramide', 'Finale'];
  const roundLabel  = el('turn-round-label');
  if (roundLabel) {
    roundLabel.textContent = `Manche ${state.currentRound} — ${ROUND_NAMES[state.currentRound]}`;
    if (state.currentRound === 5) {
      roundLabel.textContent += ` · Phase ${state.currentPhase}`;
    }
  }

  // Bouton Passer : désactivé en manche 4
  const skipBtn = el('btn-skip');
  if (skipBtn) {
    skipBtn.disabled = (state.currentRound === 4);
    skipBtn.title    = state.currentRound === 4 ? 'Passer désactivé — Manche Pyramide' : 'Passer ce mot';
  }

  // Score
  const scoreEl = el('score-display');
  if (scoreEl) scoreEl.textContent = state.teams[state.currentTeamIdx].score;

  _renderCurrentWord();
  playGameStart();
  startTimer();
  showScreen('screen-turn');
}

function _buildPyramidRows(words) {
  const rows = [];
  let idx = 0;
  let rowSize = 1;
  while (idx < words.length) {
    const end = Math.min(idx + rowSize, words.length);
    rows.push(words.slice(idx, end).map((w, ri) => ({ word: w, globalIdx: idx + ri })));
    idx += rowSize;
    rowSize++;
  }
  return rows;
}

function _renderPyramidView() {
  const view = el('pyramid-view');
  if (!view) return;

  if (state.currentRound !== 4) {
    view.hidden = true;
    return;
  }

  const words   = state.currentTurnWords;
  const current = state.currentWordIdx;
  const rows    = _buildPyramidRows(words);

  view.innerHTML = rows.map(row =>
    `<div class="pyramid-row">${
      row.map(({ word, globalIdx }) => {
        let cls = 'pyramid-brick';
        if (globalIdx < current)       cls += ' pyramid-brick--found';
        else if (globalIdx === current) cls += ' pyramid-brick--current';
        else                           cls += ' pyramid-brick--upcoming';
        const label = globalIdx < current ? '✔' : _escHtml(word);
        return `<div class="${cls}" title="${_escHtml(word)}">${label}</div>`;
      }).join('')
    }</div>`
  ).join('');

  view.hidden = false;
}

function _renderCurrentWord() {
  const content = el('turn-content');
  if (!content) return;

  if (state.currentWordIdx < state.currentTurnWords.length) {
    content.textContent = state.currentTurnWords[state.currentWordIdx];

    // Progression Pyramide
    const progEl = el('turn-pyramid-progress');
    if (progEl) {
      if (state.currentRound === 4) {
        progEl.textContent = `${state.currentWordIdx + 1} / ${state.currentTurnWords.length}`;
        progEl.hidden = false;
      } else {
        progEl.hidden = true;
      }
    }
  } else {
    // Tous les mots épuisés avant la fin du timer
    content.textContent = '🎉 Tous les mots !';
    const progEl = el('turn-pyramid-progress');
    if (progEl) progEl.hidden = true;
    stopTimer();
    setTimeout(() => endTurn(), 900);
  }

  _renderPyramidView();
}

export function wordFound() {
  if (state.currentWordIdx >= state.currentTurnWords.length) return;

  const word = state.currentTurnWords[state.currentWordIdx];
  state.foundWordsThisTurn.push(word);
  state.teams[state.currentTeamIdx].score++;

  const scoreEl = el('score-display');
  if (scoreEl) scoreEl.textContent = state.teams[state.currentTeamIdx].score;

  playFound();
  state.currentWordIdx++;
  _renderCurrentWord();
}

export function wordSkipped() {
  if (state.currentRound === 4) return; // Bloqué en Pyramide
  if (state.currentWordIdx >= state.currentTurnWords.length) return;

  const word = state.currentTurnWords[state.currentWordIdx];
  state.skippedWordsThisTurn.push(word);
  state.currentWordIdx++;
  _renderCurrentWord();
}

export function wordContested() {
  if (state.currentWordIdx >= state.currentTurnWords.length) return;

  const word = state.currentTurnWords[state.currentWordIdx];
  // Compté comme trouvé par défaut — annulable lors de la correction
  state.contestedClues.push({ word, accepted: true });
  state.teams[state.currentTeamIdx].score++;

  const scoreEl = el('score-display');
  if (scoreEl) scoreEl.textContent = state.teams[state.currentTeamIdx].score;

  showToast(`⚠️ "${word}" contesté`, 'warning');
  state.currentWordIdx++;
  _renderCurrentWord();
}

// ─── Fin de tour ───────────────────────────────────────────────────────────────

export function endTurn() {
  stopTimer();

  const team       = state.teams[state.currentTeamIdx];
  const foundCount = state.foundWordsThisTurn.length;
  const contCount  = state.contestedClues.length;
  const totalGuess = foundCount + contCount;

  // Résumé
  const summaryEl = el('turn-end-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="turn-end-score-row">
        <span class="turn-end-team" style="color:${team.color}">${team.name}</span>
        <span class="turn-end-pts">
          ${totalGuess} mot${totalGuess !== 1 ? 's' : ''} trouvé${totalGuess !== 1 ? 's' : ''}
        </span>
      </div>`;
  }

  // Liste mots trouvés
  const foundListEl = el('turn-end-found-list');
  if (foundListEl) {
    const allFound = [
      ...state.foundWordsThisTurn.map(w => `<span class="word-chip word-chip--found">✔ ${w}</span>`),
      ...state.contestedClues.map(c => `<span class="word-chip word-chip--contested">⚠️ ${c.word}</span>`),
    ];
    foundListEl.innerHTML = allFound.length > 0
      ? allFound.join('')
      : '<p class="empty-list-text">Aucun mot trouvé</p>';
  }

  // Bandeau correction
  const corrBadge = el('turn-end-contested-badge');
  if (corrBadge) {
    corrBadge.hidden = contCount === 0;
    if (contCount > 0) {
      corrBadge.textContent =
        `⚠️ ${contCount} indice${contCount > 1 ? 's' : ''} contesté${contCount > 1 ? 's' : ''} — à corriger`;
    }
  }

  // Bouton correction
  const corrBtn = el('btn-go-correction');
  if (corrBtn) corrBtn.hidden = contCount === 0;

  showScreen('screen-turn-end');
}

// ─── Phase de correction ────────────────────────────────────────────────────────

export function startCorrectionPhase() {
  if (state.contestedClues.length === 0) {
    proceedAfterCorrection();
    return;
  }

  const list = el('correction-list');
  if (list) {
    list.innerHTML = state.contestedClues.map((clue, i) => `
      <div class="correction-item" id="corr-item-${i}" data-accepted="true">
        <div class="correction-word">⚠️ ${_escHtml(clue.word)}</div>
        <div class="correction-actions">
          <button class="btn btn-success btn-sm corr-btn corr-btn--valid"
                  data-idx="${i}" data-valid="true">✔ Valider</button>
          <button class="btn btn-danger btn-sm corr-btn corr-btn--invalid"
                  data-idx="${i}" data-valid="false">✖ Invalider</button>
        </div>
        <div class="correction-status" id="corr-status-${i}">En attente…</div>
      </div>
    `).join('');
  }

  // Reset confirmed state
  el('btn-confirm-correction').disabled = false;

  showScreen('screen-correction');
}

export function castCorrectionVote(idx, isValid) {
  const clue = state.contestedClues[idx];
  if (!clue) return;

  const wasAccepted = clue.accepted;
  clue.accepted     = isValid;

  // Mise à jour du score
  if (wasAccepted && !isValid) {
    state.teams[state.currentTeamIdx].score = Math.max(0, state.teams[state.currentTeamIdx].score - 1);
  } else if (!wasAccepted && isValid) {
    state.teams[state.currentTeamIdx].score++;
  }

  // Retour visuel
  const item   = document.getElementById(`corr-item-${idx}`);
  const status = document.getElementById(`corr-status-${idx}`);
  if (item) {
    item.classList.remove('correction-item--valid', 'correction-item--invalid');
    item.classList.add(isValid ? 'correction-item--valid' : 'correction-item--invalid');
    item.dataset.accepted = String(isValid);
  }
  if (status) {
    status.textContent = isValid ? '✔ Validé' : '✖ Invalidé';
    status.className   = `correction-status correction-status--${isValid ? 'valid' : 'invalid'}`;
  }
}

export function proceedAfterCorrection() {
  const ROUND_COUNT = state.enableRound5 ? 5 : 4;

  state.teamsPlayedThisRound++;
  state.currentTeamIdx = (state.currentTeamIdx + 1) % state.teams.length;

  if (state.teamsPlayedThisRound < state.teams.length) {
    // Une autre équipe doit encore jouer ce tour
    startTurn();
  } else {
    // Toutes les équipes ont joué
    state.teamsPlayedThisRound = 0;

    if (state.currentRound === 5 && state.currentPhase === 1) {
      // Passer à la phase 2 de la Finale
      state.currentPhase = 2;
      showPreRound();
    } else if (state.currentRound < ROUND_COUNT) {
      // Fin de manche : afficher résumé avant la suivante
      _showRoundEnd();
    } else {
      // Fin de partie
      showGameOver();
    }
  }
}

// ─── Fin de manche ─────────────────────────────────────────────────────────────

function _showRoundEnd() {
  const ROUND_NAMES = ['', 'Description libre', 'Un seul mot', 'Expressions', 'Pyramide', 'Finale'];
  const titleEl = el('round-end-title');
  if (titleEl) {
    titleEl.textContent = `Fin de la Manche ${state.currentRound} — ${ROUND_NAMES[state.currentRound]}`;
  }

  const scoresEl = el('round-end-scores');
  if (scoresEl) {
    scoresEl.innerHTML = state.teams.map(team => `
      <div class="turn-end-score-row">
        <span class="turn-end-team" style="color:${team.color}">${team.name}</span>
        <span class="turn-end-pts">${team.score} pt${team.score !== 1 ? 's' : ''}</span>
      </div>
    `).join('');
  }

  showScreen('screen-round-end');
}

export function nextRound() {
  state.currentRound++;
  state.currentPhase = 1;
  state.teamsPlayedThisRound = 0;
  showPreRound();
}

// ─── Fin de partie ─────────────────────────────────────────────────────────────

export function showGameOver() {
  stopTimer();
  playGameOver();

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

  showScreen('screen-game-over');
}

// ─── Utilitaires ───────────────────────────────────────────────────────────────

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

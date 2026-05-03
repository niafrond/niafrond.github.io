/**
 * game.js — Logique du jeu Pyramide
 *
 * Flux : setup → teams → pre-round → turn → turn-end → [correction] → round-end → … → game-over
 */

import { state, PRE_ROUND_CONTENT, TEAMS_META,
  V2_ROUNDS, V2_PRE_ROUND_CONTENT,
  ENIGMES_BRICKS, ENIGMES_WORD_COUNT,
  PINGPONG_BRICKS, PINGPONG_WORD_COUNT,
  NP_WORD_COUNT, NP_MAX_BID, NP_FAIL_BONUS, NP_FAIL_BONUS_1,
  CLM_TIMER, CLM_WORD_COUNT,
  FINAL_TIMER, FINAL_BONUS_TIME, FINAL_WORD_COUNT,
  CLUE_TIMER,
} from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { playTick, playTickUrgent, playBuzzer, playFound, playGameStart, playGameOver } from './sound.js';
import { getGameWords, getEnigmesWords, getPingpongWords, getNomsPropreSet, getContreLaMontre, getGrandePyramideWords } from './words.js';

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
  // En mode officiel Manches 1-3, la fin du timer = fin du 10s d'un indice
  if (state.gameMode === 'officiel' && state.cluePending) {
    v2ClueTimeUp();
  } else {
    endTurn();
  }
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

  // Ordre des mots : fixe (pyramide) ou mélangé
  if (state.currentRound === 4) {
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
  // Mode officiel avec indice-en-attente → déléguer
  if (state.gameMode === 'officiel' && state.cluePending) {
    v2WordFound();
    return;
  }
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
  // Mode officiel CLM / Finale → déléguer
  if (state.gameMode === 'officiel') {
    const round = V2_ROUNDS[state.v2RoundIdx];
    if (round.id === 'contrelamontre' || round.id === 'grandepyramide') {
      v2EndTurn();
      return;
    }
  }

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
  // Mode officiel : déléguer au handler V2
  if (state.gameMode === 'officiel') {
    v2ContinueAfterTurn();
    return;
  }

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
  if (state.gameMode === 'officiel') {
    v2NextRoundFromRoundEnd();
    return;
  }
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

// ═══════════════════════════════════════════════════════════════════════════════
// MODE OFFICIEL (V2 — Reproduction fidèle de l'émission Pyramide)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Initialisation ────────────────────────────────────────────────────────────

export function initOfficielGame() {
  // Génère les sets de mots pour toutes les manches
  const enigmesA = getEnigmesWords(ENIGMES_WORD_COUNT);
  const enigmesB = getEnigmesWords(ENIGMES_WORD_COUNT, enigmesA);
  const clmThemeA = getContreLaMontre();
  const clmThemeB = getContreLaMontre([clmThemeA.theme]);

  state.v2WordSets = {
    enigmes: { teamA: enigmesA, teamB: enigmesB },
    pingpong: getPingpongWords(PINGPONG_WORD_COUNT),
    nomspropres: getNomsPropreSet(),
    clm: { teamA: clmThemeA, teamB: clmThemeB },
    final: getGrandePyramideWords(),
  };

  state.v2RoundIdx   = 0;
  state.v2TeamPlayed = 0;
  state.currentTeamIdx = 0;
  state.teams.forEach(t => { t.score = 0; });
  showV2PreRound();
}

// ─── Pré-manche ────────────────────────────────────────────────────────────────

export function showV2PreRound() {
  const round   = V2_ROUNDS[state.v2RoundIdx];
  const content = V2_PRE_ROUND_CONTENT[round.id];

  el('pre-round-manche-num').textContent  = `Manche ${round.num} · ${round.label}`;
  el('pre-round-icon').textContent        = round.icon;
  el('pre-round-title').textContent       = content.title;
  el('pre-round-do').textContent          = content.doText;
  el('pre-round-forbid').textContent      = content.forbidText;

  const specialEl = el('pre-round-special');
  const specialCt = el('pre-round-special-container');
  if (specialEl) specialEl.textContent   = content.special || '';
  if (specialCt) specialCt.hidden        = !content.special;

  // Affiche l'équipe concernée (pour la finale : équipe en tête)
  const team    = state.teams[state.currentTeamIdx];
  const teamEl  = el('pre-round-team');
  if (teamEl) {
    if (round.id === 'grandepyramide') {
      const leading = [...state.teams].sort((a, b) => b.score - a.score)[0];
      teamEl.textContent = leading.name;
      teamEl.style.color = leading.color;
    } else if (round.id === 'pingpong') {
      teamEl.textContent = 'Les deux équipes';
      teamEl.style.color = 'var(--warning)';
    } else {
      teamEl.textContent = team.name;
      teamEl.style.color = team.color;
    }
  }

  showScreen('screen-pre-round');
}

// ─── Dispatch tour V2 ──────────────────────────────────────────────────────────

export function startV2Turn() {
  const round = V2_ROUNDS[state.v2RoundIdx];
  switch (round.id) {
    case 'enigmes':        _startEnigmesTurn();    break;
    case 'pingpong':       _startPingPongTurn();   break;
    case 'nomspropres':    showBidding();           break;
    case 'contrelamontre': _startClmTurn();         break;
    case 'grandepyramide': _startFinalTurn();       break;
  }
}

// ─── Helpers UI communs ────────────────────────────────────────────────────────

function _setBrickBar(visible, bricks, wordNum, wordTotal) {
  const bar = el('brick-bar');
  if (!bar) return;
  bar.hidden = !visible;
  if (!visible) return;

  const left  = el('bricks-left');
  const prog  = el('brick-word-progress');
  const vis   = el('brick-visual');

  if (left) left.textContent = bricks;
  if (prog) prog.textContent = wordTotal > 0 ? ` · Mot ${wordNum}/${wordTotal}` : '';
  if (vis) {
    vis.innerHTML = Array.from({ length: Math.max(0, bricks) })
      .map(() => '<span class="brick-dot">🧱</span>').join('');
  }
}

function _setOfficielClueArea(visible) {
  const area = el('officiel-clue-area');
  if (area) area.hidden = !visible;
}

function _setClueTeamInfo(text, color) {
  const info = el('clue-team-info');
  if (!info) return;
  if (!text) { info.hidden = true; return; }
  info.hidden       = false;
  info.textContent  = text;
  info.style.color  = color || 'var(--text)';
}

function _setActionButtons(found, skip, contest) {
  const btnF = el('btn-found');
  const btnS = el('btn-skip');
  const btnC = el('btn-contest');
  if (btnF) btnF.hidden   = !found;
  if (btnS) btnS.hidden   = !skip;
  if (btnC) btnC.hidden   = !contest;
  // Wrap visibility
  const wrap = btnF?.closest('.turn-actions');
  if (wrap) wrap.hidden = !found && !skip && !contest;
}

function _setEndTurnBtn(visible) {
  const btn = el('btn-end-turn');
  if (btn) btn.hidden = !visible;
}

// ─── MANCHE 1 — Les Énigmes ────────────────────────────────────────────────────

function _startEnigmesTurn() {
  const team   = state.teams[state.currentTeamIdx];
  const side   = state.currentTeamIdx === 0 ? 'teamA' : 'teamB';
  const words  = state.v2WordSets.enigmes[side];

  state.currentTurnWords     = [...words];
  state.currentWordIdx       = 0;
  state.bricksRemaining      = ENIGMES_BRICKS;
  state.cluePending          = false;
  state.foundWordsThisTurn   = [];
  state.skippedWordsThisTurn = [];
  state.contestedClues       = [];

  _renderTurnHeader(team, 'Manche 1 — Les Énigmes');
  _setBrickBar(true, ENIGMES_BRICKS, 1, ENIGMES_WORD_COUNT);
  _setOfficielClueArea(true);
  _setActionButtons(false, false, false);
  _setEndTurnBtn(false);
  _setClueTeamInfo(null);

  el('btn-clue-given').disabled = false;
  el('btn-clue-given').textContent = '💡 Indice donné  (−1 🧱)';

  _renderCurrentWord();
  playGameStart();
  // Pas de timer au départ — seulement par indice
  stopTimer();
  el('timer-label').textContent  = '—';
  el('timer-progress').style.strokeDashoffset = 0;
  showScreen('screen-turn');
}

export function v2EnigmesClueGiven() {
  if (state.gameMode !== 'officiel') return;
  if (state.bricksRemaining <= 0) return;
  if (state.cluePending) return; // déjà en attente

  state.bricksRemaining--;
  state.cluePending = true;

  _setBrickBar(true, state.bricksRemaining,
    state.currentWordIdx + 1, ENIGMES_WORD_COUNT);

  // Affiche "Trouvé" uniquement (pas skip ni contest)
  _setOfficielClueArea(false);
  _setActionButtons(true, false, false);

  // Lance le chrono de 10 secondes
  state.turnDuration = CLUE_TIMER;
  startTimer();
}

export function v2WordFound() {
  if (!state.cluePending && state.gameMode === 'officiel') {
    // Ne peut pas trouver sans avoir donné d'indice
    return;
  }
  stopTimer();
  state.cluePending = false;

  if (state.currentWordIdx >= state.currentTurnWords.length) return;
  const word = state.currentTurnWords[state.currentWordIdx];
  state.foundWordsThisTurn.push(word);

  // Score pour le joueur en cours (ou guesser en Ping-Pong)
  const scoringTeamIdx = (V2_ROUNDS[state.v2RoundIdx].id === 'pingpong')
    ? (state.pingpongClueTeam === 0 ? 1 : 0)   // guesser
    : state.currentTeamIdx;

  state.teams[scoringTeamIdx].score++;

  const scoreEl = el('score-display');
  if (scoreEl) scoreEl.textContent = state.teams[state.currentTeamIdx].score;

  playFound();
  state.currentWordIdx++;

  // Vérifier fin des mots
  const round = V2_ROUNDS[state.v2RoundIdx];
  if (round.id === 'enigmes') {
    _afterEnigmesWordResult(true);
  } else if (round.id === 'pingpong') {
    _afterPingPongWord(true);
  } else if (round.id === 'nomspropres') {
    _afterNomsPropresWord(true);
  }
}

function v2ClueTimeUp() {
  // 10 secondes écoulées = indice raté, retour à l'état "attente d'indice"
  state.cluePending = false;
  stopTimer();
  showToast('⏱ Temps écoulé !', 'warning');

  const round = V2_ROUNDS[state.v2RoundIdx];
  if (round.id === 'enigmes') {
    if (state.bricksRemaining <= 0) {
      // Plus de briques → mot raté, suivant
      _enigmesWordFailed();
    } else {
      // Peut encore donner un indice
      _setActionButtons(false, false, false);
      _setOfficielClueArea(true);
      _setBrickBar(true, state.bricksRemaining,
        state.currentWordIdx + 1, ENIGMES_WORD_COUNT);
    }
  } else if (round.id === 'pingpong') {
    _pingPongNextClueTeam();
  } else if (round.id === 'nomspropres') {
    // Indice raté en Noms Propres
    state.currentWordIdx++;
    if (state.currentWordIdx >= state.currentTurnWords.length) {
      _endNomsPropresRound();
    } else {
      showBidding();
    }
  }
}
export { v2ClueTimeUp };

function _enigmesWordFailed() {
  state.skippedWordsThisTurn.push(state.currentTurnWords[state.currentWordIdx]);
  state.currentWordIdx++;
  _afterEnigmesWordResult(false);
}

function _afterEnigmesWordResult(_found) {
  if (state.currentWordIdx >= state.currentTurnWords.length) {
    // Tous les mots joués → fin du tour Énigmes
    _endEnigmesTurn();
    return;
  }
  if (state.bricksRemaining <= 0) {
    // Briques épuisées : les mots restants sont ratés
    while (state.currentWordIdx < state.currentTurnWords.length) {
      state.skippedWordsThisTurn.push(state.currentTurnWords[state.currentWordIdx]);
      state.currentWordIdx++;
    }
    _endEnigmesTurn();
    return;
  }

  // Mot suivant
  state.cluePending = false;
  _setActionButtons(false, false, false);
  _setOfficielClueArea(true);
  _setBrickBar(true, state.bricksRemaining,
    state.currentWordIdx + 1, ENIGMES_WORD_COUNT);
  _renderCurrentWord();
}

function _endEnigmesTurn() {
  stopTimer();
  const allFound = state.foundWordsThisTurn.length === ENIGMES_WORD_COUNT;
  const bonus    = allFound ? state.bricksRemaining : 0;
  if (bonus > 0) {
    state.teams[state.currentTeamIdx].score += bonus;
    showToast(`🎉 Bonus : +${bonus} briques restantes !`, 'success');
  }
  _showV2TurnEnd(`Énigmes · ${state.teams[state.currentTeamIdx].name}`,
    state.foundWordsThisTurn.length, bonus);
}

// ─── MANCHE 2 — Ping-Pong ─────────────────────────────────────────────────────

function _startPingPongTurn() {
  state.currentTurnWords     = [...state.v2WordSets.pingpong];
  state.currentWordIdx       = 0;
  state.bricksRemaining      = PINGPONG_BRICKS;
  state.cluePending          = false;
  state.pingpongClueTeam     = 0; // L'équipe A commence à donner les indices
  state.foundWordsThisTurn   = [];
  state.skippedWordsThisTurn = [];

  _renderTurnHeader(state.teams[0], 'Manche 2 — Ping-Pong');
  _setBrickBar(true, PINGPONG_BRICKS, 1, PINGPONG_WORD_COUNT);
  _updatePingPongUI();
  _renderCurrentWord();
  playGameStart();
  stopTimer();
  showScreen('screen-turn');
}

function _updatePingPongUI() {
  const clueTeam  = state.teams[state.pingpongClueTeam];
  const guessTeam = state.teams[state.pingpongClueTeam === 0 ? 1 : 0];
  _setClueTeamInfo(
    `💡 ${clueTeam.name} donne l'indice  ⟶  ${guessTeam.name} devine`,
    clueTeam.color,
  );
  _setOfficielClueArea(true);
  _setActionButtons(false, false, false);
}

export function v2PingPongClueGiven() {
  if (state.bricksRemaining <= 0 || state.cluePending) return;
  state.bricksRemaining--;
  state.cluePending = true;

  const guessTeam = state.teams[state.pingpongClueTeam === 0 ? 1 : 0];
  _setClueTeamInfo(`⏳ ${guessTeam.name} devine… (10s)`, guessTeam.color);
  _setOfficielClueArea(false);
  _setActionButtons(true, false, false);
  _setBrickBar(true, state.bricksRemaining,
    state.currentWordIdx + 1, PINGPONG_WORD_COUNT);

  state.turnDuration = CLUE_TIMER;
  startTimer();
}

function _pingPongNextClueTeam() {
  // Alternance : l'autre équipe donne maintenant l'indice
  state.pingpongClueTeam = state.pingpongClueTeam === 0 ? 1 : 0;
  if (state.bricksRemaining <= 0) {
    // Briques épuisées → mot raté
    state.skippedWordsThisTurn.push(state.currentTurnWords[state.currentWordIdx]);
    state.currentWordIdx++;
    _afterPingPongWord(false);
    return;
  }
  _updatePingPongUI();
  _setBrickBar(true, state.bricksRemaining,
    state.currentWordIdx + 1, PINGPONG_WORD_COUNT);
}

function _afterPingPongWord(_found) {
  if (state.currentWordIdx >= state.currentTurnWords.length ||
      state.bricksRemaining <= 0) {
    _endPingPongRound();
    return;
  }
  state.cluePending      = false;
  state.pingpongClueTeam = 0; // L'équipe A commence sur le prochain mot
  _renderCurrentWord();
  _updatePingPongUI();
  _setBrickBar(true, state.bricksRemaining,
    state.currentWordIdx + 1, PINGPONG_WORD_COUNT);
}

function _endPingPongRound() {
  stopTimer();
  _showV2TurnEnd('Ping-Pong', state.foundWordsThisTurn.length, 0, true);
}

// ─── MANCHE 3 — Les Noms Propres (Enchères) ────────────────────────────────────

export function showBidding() {
  const npSet      = state.v2WordSets.nomspropres;
  const wordIdx    = state.npCurrentWord;

  if (wordIdx >= npSet.words.length) {
    _endNomsPropresRound();
    return;
  }

  state.bidState = { bids: [null, null] };

  // Thème
  const themeEl = el('bidding-theme-info');
  if (themeEl) {
    themeEl.innerHTML = `
      <div class="card-title">📂 Thème : ${_escHtml(npSet.theme)}</div>
      <div style="font-size:1.1rem;font-weight:700;margin-top:4px;">
        Nom propre nº ${wordIdx + 1}/${npSet.words.length}
      </div>`;
  }

  // Équipes
  const area = el('bidding-teams-area');
  if (area) {
    area.innerHTML = state.teams.map((team, i) => `
      <div class="bid-team-card" id="bid-card-${i}">
        <div class="bid-team-name" style="color:${team.color}">${team.name}</div>
        <div class="bid-buttons">
          ${[1, 2, 3].map(v => `
            <button class="btn bid-btn" data-team="${i}" data-bid="${v}">${v} 🧱</button>
          `).join('')}
        </div>
        <div class="bid-chosen" id="bid-chosen-${i}">En attente…</div>
      </div>
    `).join('');
  }

  const confirmBtn = el('btn-confirm-bids');
  if (confirmBtn) confirmBtn.disabled = true;

  const resultEl = el('bid-result-info');
  if (resultEl) resultEl.hidden = true;

  showScreen('screen-bidding');
}

export function placeBid(teamIdx, bid) {
  if (!state.bidState) return;
  state.bidState.bids[teamIdx] = bid;

  // Retour visuel
  const card    = document.getElementById(`bid-card-${teamIdx}`);
  const chosen  = document.getElementById(`bid-chosen-${teamIdx}`);
  if (card) {
    card.querySelectorAll('.bid-btn').forEach(b => {
      b.classList.toggle('bid-btn--selected', parseInt(b.dataset.bid, 10) === bid);
    });
  }
  if (chosen) chosen.textContent = `✔ ${bid} brique${bid > 1 ? 's' : ''}`;

  // Activer Confirmer si les deux équipes ont misé
  const confirmBtn = el('btn-confirm-bids');
  if (confirmBtn) {
    confirmBtn.disabled = state.bidState.bids.some(b => b === null);
  }
}

export function confirmBids() {
  const [bidA, bidB] = state.bidState.bids;

  let clueTeam, bid;
  if (bidA < bidB) {
    clueTeam = 0; bid = bidA;
  } else if (bidB < bidA) {
    clueTeam = 1; bid = bidB;
  } else {
    // Égalité : l'équipe A donne les indices
    clueTeam = 0; bid = bidA;
  }

  state.npClueTeamIdx = clueTeam;
  state.npMaxBricks   = bid;
  state.currentTeamIdx = clueTeam; // pour le score display

  const resultEl = el('bid-result-info');
  if (resultEl) {
    const team = state.teams[clueTeam];
    resultEl.hidden = false;
    resultEl.innerHTML = `
      <strong style="color:${team.color}">${team.name}</strong> donne les indices
      avec <strong>${bid} brique${bid > 1 ? 's' : ''}</strong>.
    `;
  }

  const confirmBtn = el('btn-confirm-bids');
  if (confirmBtn) {
    confirmBtn.textContent = '▶ Commencer';
    confirmBtn.onclick = null; // handled by main.js delegation
    // Switch to "start NP word"
    confirmBtn.dataset.action = 'start-np';
  }
}

export function startNomsPropresWord() {
  const npSet      = state.v2WordSets.nomspropres;
  const wordIdx    = state.npCurrentWord;
  const word       = npSet.words[wordIdx];
  const clueTeam   = state.teams[state.npClueTeamIdx];

  state.currentTurnWords   = [word];
  state.currentWordIdx     = 0;
  state.bricksRemaining    = state.npMaxBricks;
  state.cluePending        = false;
  state.foundWordsThisTurn = [];

  _renderTurnHeader(clueTeam, `Manche 3 — Les Noms Propres · ${npSet.theme}`);
  _setBrickBar(true, state.npMaxBricks, wordIdx + 1, npSet.words.length);
  _setOfficielClueArea(true);
  _setActionButtons(false, false, false);
  _setEndTurnBtn(false);
  _setClueTeamInfo(
    `💡 ${clueTeam.name} donne les indices`,
    clueTeam.color,
  );

  el('btn-clue-given').textContent = '💡 Indice donné  (−1 🧱)';
  el('btn-clue-given').disabled    = false;

  _renderCurrentWord();
  playGameStart();
  stopTimer();
  showScreen('screen-turn');
}

export function v2NomsPropresClueGiven() {
  if (state.bricksRemaining <= 0 || state.cluePending) return;
  state.bricksRemaining--;
  state.cluePending = true;

  const guessTeamIdx = state.npClueTeamIdx === 0 ? 1 : 0;
  const guessTeam    = state.teams[guessTeamIdx];
  _setClueTeamInfo(`⏳ ${guessTeam.name} devine… (10s)`, guessTeam.color);
  _setOfficielClueArea(false);
  _setActionButtons(true, false, false);
  _setBrickBar(true, state.bricksRemaining,
    state.npCurrentWord + 1, state.v2WordSets.nomspropres.words.length);

  state.turnDuration = CLUE_TIMER;
  startTimer();
}

function _afterNomsPropresWord(found) {
  stopTimer();
  const clueTeamIdx  = state.npClueTeamIdx;
  const guessTeamIdx = clueTeamIdx === 0 ? 1 : 0;

  if (found) {
    // +1 pour l'équipe qui donne les indices
    state.teams[clueTeamIdx].score++;
    showToast(`✔ +1 pour ${state.teams[clueTeamIdx].name}`, 'success');
  } else {
    // Échec : bonus pour l'adversaire
    const bonus = state.npMaxBricks === 1 ? NP_FAIL_BONUS_1 : NP_FAIL_BONUS;
    state.teams[guessTeamIdx].score += bonus;
    showToast(`✖ Raté — +${bonus} pour ${state.teams[guessTeamIdx].name}`, 'warning');
  }

  state.npCurrentWord++;
  const allDone = state.npCurrentWord >= state.v2WordSets.nomspropres.words.length;

  // Préparer l'action suivante AVANT d'afficher l'écran de résumé
  state._v2NextAction = allDone
    ? () => _v2NextRound()
    : () => showBidding();

  _showV2TurnEnd(
    `Noms Propres · Nom nº${state.npCurrentWord}`,
    found ? 1 : 0,
    0,
    false,    // skipNext
    !allDone, // manualNext (affiche "Prochain nom propre")
  );
}

// ─── MANCHE 4 — Contre-la-Montre ──────────────────────────────────────────────

function _startClmTurn() {
  const side    = state.v2TeamPlayed === 0 ? 'teamA' : 'teamB';
  const wordSet = state.v2WordSets.clm[side];
  const team    = state.teams[state.currentTeamIdx];

  state.currentTurnWords     = [...wordSet.words];
  state.currentWordIdx       = 0;
  state.bricksRemaining      = 0;
  state.cluePending          = false;
  state.foundWordsThisTurn   = [];
  state.skippedWordsThisTurn = [];
  state.contestedClues       = [];

  _renderTurnHeader(team, `Manche 4 — Contre-la-Montre · ${wordSet.theme}`);
  _setBrickBar(false);
  _setOfficielClueArea(false);
  _setActionButtons(true, true, false);
  _setEndTurnBtn(false);
  _setClueTeamInfo(null);

  el('btn-skip').hidden    = false;
  el('btn-contest').hidden = true;

  _renderCurrentWord();
  playGameStart();

  state.turnDuration = CLM_TIMER;
  startTimer();
  showScreen('screen-turn');
}

// wordFound / wordSkipped in CLM → use existing handlers (they call the right function)

function _endClmTurn() {
  stopTimer();
  _showV2TurnEnd(
    `CLM · ${state.teams[state.currentTeamIdx].name}`,
    state.foundWordsThisTurn.length, 0,
  );
}

// ─── FINALE — La Grande Pyramide ──────────────────────────────────────────────

function _startFinalTurn() {
  // L'équipe en tête joue la finale
  const leading = [...state.teams].reduce((a, b) => b.score > a.score ? b : a);
  const teamIdx = state.teams.indexOf(leading);
  state.currentTeamIdx = teamIdx;

  state.currentTurnWords     = [...state.v2WordSets.final];
  state.currentWordIdx       = 0;
  state.bricksRemaining      = 0;
  state.cluePending          = false;
  state.foundWordsThisTurn   = [];
  state.skippedWordsThisTurn = [];
  state.contestedClues       = [];

  _renderTurnHeader(leading, 'La Grande Pyramide 🏆');
  _setBrickBar(false);
  _setOfficielClueArea(false);
  _setActionButtons(true, false, false);  // Pas de Passer en finale
  _setEndTurnBtn(true);
  _setClueTeamInfo(null);

  el('btn-found').textContent  = '✔ Expression trouvée';
  el('btn-skip').hidden        = true;
  el('btn-contest').hidden     = true;

  _renderCurrentWord();
  playGameStart();

  state.turnDuration = FINAL_TIMER;
  startTimer();
  showScreen('screen-turn');
}

function _endFinalTurn() {
  stopTimer();
  const allFound = state.foundWordsThisTurn.length === FINAL_WORD_COUNT;
  if (allFound) {
    playGameOver();
    showToast('🎉 JACKPOT ! Toutes les expressions trouvées !', 'success');
  }
  _showV2TurnEnd(
    'La Grande Pyramide',
    state.foundWordsThisTurn.length, 0, false, false, allFound,
  );
}

// ─── Résumé fin de tour V2 ────────────────────────────────────────────────────

/**
 * Affiche l'écran de résumé de fin de tour (Mode Officiel).
 * @param {string}   roundLabel — Libellé affiché dans le résumé
 * @param {number}   found      — Nombre de mots trouvés
 * @param {number}   bonus      — Points bonus éventuels
 * @param {Function} nextAction — Callback appelé lors du clic sur "Continuer"
 * @param {boolean}  manualNext — Libellé "Prochain nom propre" au lieu de "Continuer"
 * @param {boolean}  jackpot    — Affiche JACKPOT et change le libellé
 */
function _showV2TurnEnd(roundLabel, found, bonus, nextAction = null, manualNext = false, jackpot = false) {
  const team = state.teams[state.currentTeamIdx];

  const summaryEl = el('turn-end-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="turn-end-score-row">
        <span class="turn-end-team" style="color:${team.color}">${team.name}</span>
        <span class="turn-end-pts">
          ${found} mot${found !== 1 ? 's' : ''} trouvé${found !== 1 ? 's' : ''}
          ${bonus > 0 ? `<span style="color:var(--warning)"> +${bonus} bonus</span>` : ''}
        </span>
      </div>
      ${jackpot ? '<div style="font-size:1.5rem;text-align:center;margin-top:8px;">🏆 JACKPOT !</div>' : ''}`;
  }

  const foundListEl = el('turn-end-found-list');
  if (foundListEl) {
    foundListEl.innerHTML = state.foundWordsThisTurn.length > 0
      ? state.foundWordsThisTurn.map(w => `<span class="word-chip word-chip--found">✔ ${w}</span>`).join('')
      : '<p class="empty-list-text">Aucun mot trouvé</p>';
  }

  const corrBadge = el('turn-end-contested-badge');
  if (corrBadge) corrBadge.hidden = true;
  const corrBtn = el('btn-go-correction');
  if (corrBtn) corrBtn.hidden = true;

  const nextBtn = el('btn-next-from-turn-end');
  if (nextBtn) {
    if (jackpot) {
      nextBtn.textContent = '🏆 Voir les résultats';
    } else if (manualNext) {
      nextBtn.textContent = '▶ Prochain nom propre';
    } else {
      nextBtn.textContent = '▶ Continuer';
    }
  }

  // Stocker l'action suivante
  state._v2NextAction = nextAction
    ? nextAction
    : jackpot
      ? () => showGameOver()
      : () => _v2ProceedAfterTurn();

  showScreen('screen-turn-end');
}

export function v2ContinueAfterTurn() {
  if (state._v2NextAction) {
    state._v2NextAction();
    state._v2NextAction = null;
  } else {
    _v2ProceedAfterTurn();
  }
}

function _v2ProceedAfterTurn() {
  const round = V2_ROUNDS[state.v2RoundIdx];

  if (round.id === 'pingpong') {
    // Le Ping-Pong est un round unique (pas de tour par équipe)
    _v2NextRound();
    return;
  }

  if (round.id === 'grandepyramide') {
    showGameOver();
    return;
  }

  if (round.id === 'nomspropres') {
    // Géré par _afterNomsPropresWord → showBidding ou _endNomsPropresRound
    return;
  }

  // Pour Énigmes et CLM : chaque équipe joue une fois
  state.v2TeamPlayed++;
  if (state.v2TeamPlayed < state.teams.length) {
    state.currentTeamIdx = (state.currentTeamIdx + 1) % state.teams.length;
    startV2Turn();
  } else {
    state.v2TeamPlayed = 0;
    _v2NextRound();
  }
}

function _v2NextRound() {
  state.v2RoundIdx++;
  state.v2TeamPlayed   = 0;
  state.npCurrentWord  = 0;
  state.currentTeamIdx = 0;

  if (state.v2RoundIdx >= V2_ROUNDS.length) {
    showGameOver();
    return;
  }

  // Afficher le score inter-manche
  _showV2RoundEnd();
}

function _showV2RoundEnd() {
  const prevRound = V2_ROUNDS[state.v2RoundIdx - 1];
  const titleEl   = el('round-end-title');
  if (titleEl) titleEl.textContent = `Fin de la ${prevRound.label}`;

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

export function v2NextRoundFromRoundEnd() {
  showV2PreRound();
}

// ─── Helpers affichage turn ────────────────────────────────────────────────────

function _renderTurnHeader(team, roundLabel) {
  const teamNameEl = el('turn-team-name');
  if (teamNameEl) {
    teamNameEl.textContent = team.name;
    teamNameEl.style.color = team.color;
  }
  const roundLabelEl = el('turn-round-label');
  if (roundLabelEl) roundLabelEl.textContent = roundLabel;

  const scoreEl = el('score-display');
  if (scoreEl) scoreEl.textContent = team.score;
}

// endTurn override pour le mode officiel (CLM / Finale)
export function v2EndTurn() {
  const round = V2_ROUNDS[state.v2RoundIdx];
  if (round.id === 'contrelamontre') {
    _endClmTurn();
  } else if (round.id === 'grandepyramide') {
    _endFinalTurn();
  }
}

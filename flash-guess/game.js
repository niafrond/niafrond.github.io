/**
 * game.js — Logique de jeu : tours, timer, actions mots, undo/redo, manches, fin de partie
 */

import {
  state, demo, demoHooks,
  ROUND_RULES, TEAMS_META, GAMEPLAY_SCREENS,
  TURN_DURATION, TIMER_CIRCLE_RADIUS,
  WORD_FONT_MIN, WORD_FONT_MAX,
  CHILD_READ_MS_PER_LETTER, CHILD_READ_MIN_MS,
  ELIMINATIONS_PER_PLAYER, DIFFICULTIES,
} from './state.js';
import { el, showScreen, showToast } from './ui.js';
import {
  playTick, playTickUrgent, playBuzzer,
  playFound, playRoundStart, playGameOver, playButtonClick,
  playSkip, playFault, playUndo, playRedo, playGameStart,
} from './sound.js';
import { getShuffledWords, getCategoryInfo, shuffle } from './words.js';
import { saveMembersAfterGame } from './members.js';
import { saveGameResult } from './leaderboard.js';

// ─── Helpers internes ──────────────────────────────────────────────────────────
export function getCurrentRoundRule() { return ROUND_RULES[state.currentRound - 1]; }

export function teamLabel(team) { return team.players.join(' · '); }

/**
 * Calcule l'index de l'équipe qui commence une nouvelle manche.
 * Pour la manche 1, on démarre toujours à l'équipe 0.
 * Pour les manches suivantes, on passe à l'équipe suivante afin
 * qu'une même équipe ne joue pas deux fois de suite lors du changement de manche.
 */
export function nextRoundStartTeamIdx(currentTeamIdx, numTeams, roundNum) {
  return roundNum === 1 ? 0 : (currentTeamIdx + 1) % numTeams;
}

/**
 * En mode devineur tournant, calcule l'index de l'équipe qui devine.
 * Chaque équipe i cible en rotation les (n-1) autres équipes :
 *   cible = (i + 1 + rotatingTarget) % n
 * où rotatingTarget vaut 0..n-2 et avance après chaque tour.
 *
 * @param {number} currentTeamIdx  - index de l'équipe qui parle
 * @param {number} rotatingTarget  - compteur de rotation pour cette équipe
 * @param {number} numTeams        - nombre total d'équipes
 * @returns {number} index de l'équipe qui devine
 */
export function getRotatingGuesserTeamIdx(currentTeamIdx, rotatingTarget, numTeams) {
  return (currentTeamIdx + 1 + rotatingTarget) % numTeams;
}

/** Nombres de joueurs pour lesquels le mode devineur tournant est disponible. */
export const ROTATING_GUESSER_PLAYER_COUNTS = new Set([3, 4, 5, 7]);

// ─── COMPOSITION DES ÉQUIPES ───────────────────────────────────────────────────
export function computeTeamLayout(n) {
  switch (n) {
    case 2:  return [2];
    case 3:  return [1, 1, 1];
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
      const numTeams = 4;
      const base  = Math.floor(n / numTeams);
      const extra = n % numTeams;
      return Array.from({ length: numTeams }, (_, i) => base + (i < extra ? 1 : 0));
    }
  }
}

export function assignTeams() {
  const players = shuffle([...state.playerNames]);
  const n       = players.length;
  const layout  = computeTeamLayout(n);

  // Le mode devineur tournant nécessite que chaque joueur soit sa propre "équipe"
  // (comme le mode sans équipes 5/7 joueurs), même pour 3/4 joueurs dont le layout
  // normal regroupe les joueurs en équipes.
  const useRotating = state.rotatingGuesserMode && ROTATING_GUESSER_PLAYER_COUNTS.has(n);

  if (layout === null || useRotating) {
    // layout === null : nombre de joueurs sans groupement naturel (5, 7…)
    // useRotating     : mode devineur tournant activé — jeu individuel imposé
    state.noTeamsMode = true;
    state.teams = players.map((name, i) => ({
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

  // Initialiser les compteurs de rotation (un par équipe, valeur dans 0..n-2).
  // Un tableau vide signal que le mode est inactif — vérifié via .length > 0.
  state.rotatingGuesserTarget   = useRotating ? state.teams.map(() => 0) : [];
  state.currentGuesserTeamIdx   = -1;
}

export function renderTeams() {
  const container = el('teams-container');
  container.innerHTML = '';

  if (state.noTeamsMode) {
    container.style.gridTemplateColumns = '1fr';
    const banner = document.createElement('div');
    banner.className = 'no-teams-banner';
    if (state.rotatingGuesserMode) {
      banner.textContent =
        `🔄 Mode devineur tournant — chaque joueur joue pour lui-même. ` +
        `Le devineur change à chaque tour de façon tournante.`;
    } else {
      banner.textContent =
        `⚠️ ${state.playerNames.length} joueurs — pas d'équipes fixes pour ce nombre. ` +
        'Chaque joueur joue pour lui-même ! (Ajoutez ou retirez un joueur pour avoir des équipes.)';
    }
    container.appendChild(banner);
  } else {
    container.style.gridTemplateColumns = '';
  }

  state.teams.forEach((team) => {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.style.setProperty('--team-color', team.color);

    const ul = document.createElement('ul');
    ul.className = 'team-players';
    team.players.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `👤 ${p}${state.playerIsChild.has(p) ? ' 🧒' : ''}`;
      ul.appendChild(li);
    });

    card.appendChild(ul);
    container.appendChild(card);
  });

  // Mode coop 2 joueurs : afficher le sélecteur d'objectif uniquement pour 2 joueurs
  const coopSection = el('coop-objective-section');
  const isTwoPlayers = state.playerNames.length === 2;
  if (coopSection) {
    coopSection.hidden = !isTwoPlayers;
    if (isTwoPlayers) updateCoopButtons();
  }

  // Sélecteur de difficulté (mode 2 joueurs uniquement)
  const difficultySection = el('difficulty-section');
  if (difficultySection) {
    difficultySection.hidden = !isTwoPlayers;
    if (isTwoPlayers) updateDifficultyButtons();
  }

  // En mode 2 joueurs, les équipes n'ont pas besoin d'être affichées
  const teamsContainer = el('teams-container');
  if (teamsContainer) teamsContainer.hidden = isTwoPlayers;
  const reshuffleBtn = el('btn-reshuffle');
  if (reshuffleBtn) reshuffleBtn.hidden = isTwoPlayers;
}

function updateCoopButtons() {
  document.querySelectorAll('.btn-coop-opt').forEach(btn => {
    btn.classList.toggle('btn-coop-opt--active', state.coopObjectives.has(btn.dataset.obj));
  });
}

export function setCoopObjective(obj) {
  // obj : 'chrono' (temps cumulé) | 'precision' (moins de tours) — toggle
  if (state.coopObjectives.has(obj)) {
    state.coopObjectives.delete(obj);
  } else {
    state.coopObjectives.add(obj);
  }
  updateCoopButtons();
}

// ─── NIVEAU DE DIFFICULTÉ (mode 2 joueurs) ────────────────────────────────────
export function setDifficultyLevel(level) {
  if (!Object.prototype.hasOwnProperty.call(DIFFICULTIES, level)) return;
  state.difficultyLevel = level;
  updateDifficultyButtons();
}

function updateDifficultyButtons() {
  document.querySelectorAll('.btn-difficulty').forEach(btn => {
    btn.classList.toggle('btn-difficulty--active', btn.dataset.difficulty === state.difficultyLevel);
  });

  const descEl = el('difficulty-desc');
  if (!descEl) return;
  const dur = state.turnDuration;
  const DESCS = {
    facile:    `Tous les mots sont connus à l'avance. Chrono : ${dur} s.`,
    moyen:     `~1/3 des mots sont inconnus à l'avance. Chrono : ${dur} s.`,
    difficile: `~1/2 des mots sont inconnus à l'avance. Chrono : 20 s.`,
    god:       `Aucun tri caché. Chrono : 15 s. ⚠️ Toute erreur en manche 3 est éliminatoire !`,
  };
  descEl.textContent = DESCS[state.difficultyLevel] ?? '';
}

/**
 * Retourne la durée du tour effective en tenant compte du niveau de difficulté.
 * En mode 2 joueurs, Difficile impose 20 s et God impose 15 s.
 * Pour les autres niveaux, la durée configurée par l'utilisateur est utilisée.
 */
export function getEffectiveTurnDuration() {
  if (state.playerNames.length === 2) {
    const { timer } = DIFFICULTIES[state.difficultyLevel] ?? {};
    if (timer !== null && timer !== undefined) return timer;
  }
  return state.turnDuration;
}

// ─── LECTURE ENFANT ────────────────────────────────────────────────────────────
export function isCurrentOrateurChild() {
  if (!state.teams.length) return false;
  const team = state.teams[state.currentTeamIdx];
  if (!team) return false;
  const playerName = team.players[state.teamPlayerIdx[state.currentTeamIdx]];
  return state.playerIsChild.has(playerName);
}

export function showChildReadBtn(visible) {
  const btn     = el('btn-child-read');
  const foundBtn = el('btn-found');
  const errorBtn = el('btn-error');
  const skipBtn  = el('btn-skip');
  if (!btn) return;
  if (state.childReadAutoTimer !== null) {
    clearTimeout(state.childReadAutoTimer);
    state.childReadAutoTimer = null;
  }
  btn.hidden = !visible;
  btn.classList.remove('child-read-btn--countdown');
  if (foundBtn) foundBtn.disabled = visible;
  if (errorBtn) errorBtn.disabled = visible;
  if (skipBtn)  skipBtn.disabled  = visible;
  if (visible && !demo.childReadFrozen) {
    const word     = state.currentWord?.word ?? '';
    // Count only non-space characters so multi-word phrases feel natural
    const letters  = word.replace(/\s/g, '').length;
    const duration = Math.max(CHILD_READ_MIN_MS, letters * CHILD_READ_MS_PER_LETTER);
    void btn.offsetWidth;
    btn.style.setProperty('--child-read-duration', `${duration / 1000}s`);
    btn.classList.add('child-read-btn--countdown');
    state.childReadAutoTimer = setTimeout(() => {
      state.childReadAutoTimer = null;
      childConfirmedRead();
    }, duration);
  }
}

export function childConfirmedRead() {
  showChildReadBtn(false);
  if (demo.mode) {
    state.childReadFirstWord = false;
    return;
  }
  if (state.childReadFirstWord) {
    state.childReadFirstWord = false;
    startTimer();
  } else {
    resumeTimer();
  }
}

// ─── UI — carte mot ────────────────────────────────────────────────────────────
export function fitWordCard() {
  const textEl = el('word-card-text');
  const card   = textEl?.closest('.word-card');
  if (!card || !textEl.textContent.trim()) return;

  const turnArea = document.querySelector('.turn-play-area');
  const foundBtn = el('btn-found');
  const passCol  = el('btn-pass-col');

  const cs     = getComputedStyle(card);
  const areaCS = getComputedStyle(turnArea);
  const gap    = parseFloat(areaCS.columnGap) || 0;

  const leftColW = passCol.offsetWidth;
  const availW = turnArea.clientWidth
    - leftColW
    - foundBtn.offsetWidth
    - 2 * gap
    - parseFloat(cs.paddingLeft)
    - parseFloat(cs.paddingRight);
  if (availW <= 0) return;

  let lo = WORD_FONT_MIN, hi = WORD_FONT_MAX;
  while (hi - lo > 1) {
    const mid = Math.round((lo + hi) / 2);
    textEl.style.fontSize = mid + 'px';
    if (textEl.scrollWidth <= availW) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  textEl.style.fontSize = lo + 'px';
}

export function updateTurnStats() {
  el('turn-found-count').textContent = state.turnFound.length;
  el('turn-words-left').textContent  = state.roundWords.length + (state.currentWord ? 1 : 0);
}

export function updateUndoRedoButtons() {
  el('btn-undo').disabled = state.actionHistory.length === 0;
  el('btn-redo').disabled = state.redoStack.length === 0;
}

// ─── TIMER ─────────────────────────────────────────────────────────────────────
export function updateTimerDisplay() {
  const pct       = state.timeLeft / state.turnDuration;
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

export function startTimer() {
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

export function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerPaused   = false;
}

export function pauseTimer() {
  if (state.timerInterval !== null) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.timerPaused   = true;
  }
}

export function resumeTimer() {
  if (state.timerPaused) {
    state.timerPaused = false;
    startTimer();
  }
}

// ─── LOGIQUE DE MANCHE ─────────────────────────────────────────────────────────
export async function startRound(roundNum) {
  state.currentRound = roundNum;
  if (roundNum === 1) {
    if (state.allWords.length === 0) {
      const words = await getShuffledWords(
        state.selectedCategories.length > 0 ? state.selectedCategories : null,
        state.kidsMode,
      );
      const count = state.cardCount === 0 ? words.length : Math.min(state.cardCount, words.length);
      state.allWords = words.slice(0, count);
      if (state.allWords.length === 0) {
        showToast('Aucun mot dans les catégories sélectionnées !', 'error');
        showScreen('screen-categories');
        return;
      }
    }
    // Initialiser les stats coopératives et l'état God mode au début de la partie
    state.coopTimeUsed    = 0;
    state.coopTurnsCount  = 0;
    state.godModeEliminated = false;
  }
  state.roundWords     = shuffle([...state.allWords]);
  state.currentTeamIdx = nextRoundStartTeamIdx(state.currentTeamIdx, state.teams.length, roundNum);

  const r = ROUND_RULES[roundNum - 1];
  el('round-intro-icon').textContent  = r.icon;
  el('round-intro-title').textContent = r.title;
  el('round-intro-desc').textContent  = r.desc;
  el('round-intro-num').textContent   = `${roundNum} / 3`;
  el('round-intro-words-left').textContent = `${state.roundWords.length} mots à faire deviner`;

  if (roundNum === 1) {
    playGameStart();
  } else {
    playRoundStart();
  }
  showScreen('screen-round-intro');
}

// ─── PRÉ-TOUR ─────────────────────────────────────────────────────────────────
export function startPreTurn() {
  const team       = state.teams[state.currentTeamIdx];
  const playerName = team.players[state.teamPlayerIdx[state.currentTeamIdx]];

  el('pre-turn-round').textContent = `Manche ${state.currentRound} / 3`;

  let guesserLabel;
  if (state.rotatingGuesserMode && state.rotatingGuesserTarget.length > 0) {
    const n = state.teams.length;
    const guesserTeamIdx = getRotatingGuesserTeamIdx(
      state.currentTeamIdx,
      state.rotatingGuesserTarget[state.currentTeamIdx],
      n,
    );
    state.currentGuesserTeamIdx = guesserTeamIdx;
    guesserLabel = teamLabel(state.teams[guesserTeamIdx]);
  } else if (state.noTeamsMode) {
    const n = state.teams.length;
    const leftIdx = (state.currentTeamIdx - 1 + n) % n;
    state.currentGuesserTeamIdx = leftIdx;
    guesserLabel = teamLabel(state.teams[leftIdx]);
  } else {
    state.currentGuesserTeamIdx = -1;
    const teammates = team.players.filter(p => p !== playerName);
    if (teammates.length) {
      guesserLabel = teammates.join(' · ');
    } else {
      const others = state.teams
        .filter((_, idx) => idx !== state.currentTeamIdx)
        .flatMap(t => t.players);
      guesserLabel = others.length ? others.join(' · ') : teamLabel(team);
    }
  }

  const playerSpan = document.createElement('span');
  playerSpan.id = 'pre-turn-player';
  playerSpan.textContent = playerName + (state.playerIsChild.has(playerName) ? ' 🧒' : '');

  const guesserSpan = document.createElement('span');
  guesserSpan.id = 'pre-turn-guesser';
  guesserSpan.textContent = guesserLabel;

  const sentenceEl = el('pre-turn-sentence');
  sentenceEl.innerHTML = '';
  sentenceEl.appendChild(document.createTextNode('Au tour de'));
  sentenceEl.appendChild(document.createElement('br'));
  sentenceEl.appendChild(playerSpan);
  sentenceEl.appendChild(document.createElement('br'));
  sentenceEl.appendChild(document.createTextNode('qui fait deviner à'));
  sentenceEl.appendChild(document.createElement('br'));
  sentenceEl.appendChild(guesserSpan);
  sentenceEl.style.color = team.color;

  showScreen('screen-pre-turn');
  if (demo.mode && demoHooks.showTips) demoHooks.showTips('pre-turn');
}

// ─── TOUR ACTIF ────────────────────────────────────────────────────────────────
export function startTurn() {
  state.turnFound     = [];
  state.turnSkipped   = [];
  state.timeLeft      = getEffectiveTurnDuration();
  state.actionHistory = [];
  state.redoStack     = [];
  updateUndoRedoButtons();

  demo.childReadFrozen = false;
  showChildReadBtn(false);
  state.childReadFirstWord = false;
  demo.firstWordFound = false;

  const rule     = getCurrentRoundRule();
  const errorBtn = el('btn-error');
  const skipBtn  = el('btn-skip');

  errorBtn.hidden = !rule.canFault;
  errorBtn.disabled = false;
  skipBtn.hidden  = !rule.canSkip;
  skipBtn.disabled = false;

  updateTurnStats();
  drawNextWord();

  const team       = state.teams[state.currentTeamIdx];
  const playerName = team.players[state.teamPlayerIdx[state.currentTeamIdx]];
  el('turn-player-name').textContent = `👤 ${playerName}`;

  if (demo.mode) {
    const circ = 2 * Math.PI * TIMER_CIRCLE_RADIUS;
    const ring = el('timer-ring-progress');
    el('timer-number').textContent = '∞';
    el('timer-number').style.color = 'var(--text)';
    ring.style.strokeDasharray  = `${circ}`;
    ring.style.strokeDashoffset = '0';
    ring.style.stroke = 'var(--success)';
    if (isCurrentOrateurChild()) {
      state.childReadFirstWord = true;
      demo.childReadFrozen = true;
      showChildReadBtn(true);
    }
  } else {
    updateTimerDisplay();
    if (isCurrentOrateurChild()) {
      state.childReadFirstWord = true;
      showChildReadBtn(true);
    } else {
      startTimer();
    }
  }

  showScreen('screen-turn');
  fitWordCard();
  if (demo.mode && demoHooks.showTips) demoHooks.showTips(state.currentRound);
}

export function drawNextWord() {
  if (state.roundWords.length === 0) {
    if (state.turnSkipped.length > 0) {
      endTurn('timeout');
    } else {
      endTurn('allFound');
    }
    return;
  }
  state.currentWord = state.roundWords.shift();
  el('word-card-text').textContent     = state.currentWord.word;
  el('turn-round-badge').textContent   = `Manche ${state.currentRound} — ${ROUND_RULES[state.currentRound - 1].icon}`;
  updateTurnStats();
  fitWordCard();

  if (!state.childReadFirstWord && isCurrentOrateurChild()) {
    if (!demo.mode) pauseTimer();
    showChildReadBtn(true);
  }
}

export function wordFound() {
  playFound();
  state.actionHistory.push({ type: 'found', word: state.currentWord });
  state.redoStack = [];
  state.turnFound.push(state.currentWord);
  state.currentWord = null;
  updateTurnStats();
  drawNextWord();
  updateUndoRedoButtons();
  if (demo.mode && !demo.firstWordFound) {
    demo.firstWordFound = true;
    if (demoHooks.showAfterFoundTips) demoHooks.showAfterFoundTips();
  }
}

export function wordSkipped() {
  playSkip();
  state.actionHistory.push({ type: 'skipped', word: state.currentWord });
  state.redoStack = [];
  if (state.currentRound >= 2) {
    state.turnSkipped.push(state.currentWord);
  } else {
    state.roundWords.push(state.currentWord);
  }
  state.currentWord = null;
  updateTurnStats();
  drawNextWord();
  updateUndoRedoButtons();
}

export function wordFault() {
  playFault();
  if (state.currentWord) {
    state.actionHistory.push({ type: 'fault', word: state.currentWord });
    state.redoStack = [];
    state.turnSkipped.push(state.currentWord);
    state.currentWord = null;
  }
  updateTurnStats();

  // God mode (2 joueurs) : une erreur en manche 3 est éliminatoire
  if (
    state.playerNames.length === 2 &&
    state.difficultyLevel === 'god' &&
    state.currentRound === 3
  ) {
    state.godModeEliminated = true;
    stopTimer();
    endTurn('god_fault');
    return;
  }

  drawNextWord();
  updateUndoRedoButtons();
}

export function undoLastAction() {
  if (state.actionHistory.length === 0) return;
  playUndo();
  const action = state.actionHistory.pop();
  state.redoStack.push(action);
  const { type, word } = action;

  if (state.currentWord) {
    state.roundWords.unshift(state.currentWord);
    state.currentWord = null;
  }

  if (type === 'found') {
    const idx = state.turnFound.lastIndexOf(word);
    if (idx !== -1) state.turnFound.splice(idx, 1);
  } else {
    const idx = state.turnSkipped.lastIndexOf(word);
    if (idx !== -1) {
      state.turnSkipped.splice(idx, 1);
    } else {
      const ri = state.roundWords.lastIndexOf(word);
      if (ri !== -1) state.roundWords.splice(ri, 1);
    }
  }

  state.currentWord = word;
  el('word-card-text').textContent     = word.word;
  updateTurnStats();
  fitWordCard();
  updateUndoRedoButtons();
}

export function redoLastAction() {
  if (state.redoStack.length === 0) return;
  const action = state.redoStack.pop();
  state.actionHistory.push(action);
  const { type, word } = action;

  if (type === 'found') {
    playFound();
    state.turnFound.push(word);
  } else {
    playRedo();
    if (state.currentRound >= 2) {
      state.turnSkipped.push(word);
    } else {
      state.roundWords.push(word);
    }
  }
  state.currentWord = null;
  updateTurnStats();
  drawNextWord();
  updateUndoRedoButtons();
}

// ─── FIN DE TOUR ───────────────────────────────────────────────────────────────
export function endTurn(reason = 'timeout') {
  stopTimer();

  if (demo.mode) {
    const team = state.teams[state.currentTeamIdx];
    team.score[state.currentRound - 1] += state.turnFound.length;

    const reasonMsgs = {
      timeout:  '⏱️ Temps écoulé !',
      fault:    '🚨 Faute — tour arrêté !',
      allFound: '🎉 Tous les mots trouvés !',
    };
    el('turn-end-reason').textContent    = reasonMsgs[reason] ?? '⏱️ Temps écoulé !';
    el('turn-end-team').textContent      = teamLabel(team);
    el('turn-end-player').textContent    = team.players[0];
    el('turn-end-count').textContent     = state.turnFound.length;
    el('turn-end-words-left').textContent = state.roundWords.length;
    el('btn-next-turn').dataset.nextAction = 'round-end';
    el('turn-end-all-found').hidden = (reason !== 'allFound');
    el('btn-correct-turn').hidden = (state.turnFound.length === 0);
    showScreen('screen-turn-end');
    if (state.turnFound.length > 0 && demoHooks.showTurnEndTips) demoHooks.showTurnEndTips();
    return;
  }

  // Mode coop 2 joueurs : enregistrer le temps utilisé et le nombre de tours
  if (state.coopObjectives.size > 0) {
    state.coopTimeUsed   += getEffectiveTurnDuration() - state.timeLeft;
    state.coopTurnsCount += 1;
  }

  if (reason === 'timeout' && state.currentWord) {
    state.roundWords.push(state.currentWord);
    state.currentWord = null;
  }

  if (state.turnSkipped.length > 0) {
    state.roundWords.push(...state.turnSkipped);
    state.turnSkipped = [];
  }

  const team = state.teams[state.currentTeamIdx];
  team.score[state.currentRound - 1] += state.turnFound.length;

  // Mode devineur tournant : le devineur gagne aussi les mêmes points, puis on avance la rotation
  if (state.rotatingGuesserMode && state.rotatingGuesserTarget.length > 0) {
    const guesserTeamIdx = state.currentGuesserTeamIdx;
    if (guesserTeamIdx >= 0 && guesserTeamIdx !== state.currentTeamIdx) {
      state.teams[guesserTeamIdx].score[state.currentRound - 1] += state.turnFound.length;
    }
    const n = state.teams.length;
    // Chaque équipe a (n-1) cibles possibles (toutes sauf elle-même), donc le
    // compteur tourne dans [0 .. n-2] avant de revenir à 0.
    state.rotatingGuesserTarget[state.currentTeamIdx] =
      (state.rotatingGuesserTarget[state.currentTeamIdx] + 1) % (n - 1);
  }

  const reasonMsgs = {
    timeout:   '⏱️ Temps écoulé !',
    fault:     '🚨 Faute — tour arrêté !',
    allFound:  '🎉 Tous les mots trouvés !',
    god_fault: '☠️ Éliminé ! Faute en manche 3 — Partie terminée.',
  };
  el('turn-end-reason').textContent = reasonMsgs[reason] ?? '⏱️ Temps écoulé !';
  el('turn-end-team').textContent   = teamLabel(team);
  el('turn-end-player').textContent =
    state.teams[state.currentTeamIdx].players[state.teamPlayerIdx[state.currentTeamIdx]];
  el('turn-end-count').textContent  = state.turnFound.length;
  el('turn-end-words-left').textContent = state.roundWords.length;

  const pi = state.teamPlayerIdx[state.currentTeamIdx];
  state.teamPlayerIdx[state.currentTeamIdx] = (pi + 1) % team.players.length;

  if (reason === 'allFound') {
    el('btn-next-turn').dataset.nextAction = 'round-end';
    el('turn-end-all-found').hidden = false;
  } else if (reason === 'god_fault') {
    el('btn-next-turn').dataset.nextAction = 'game-over';
    el('turn-end-all-found').hidden = true;
  } else {
    el('btn-next-turn').dataset.nextAction = 'next-turn';
    el('turn-end-all-found').hidden = true;
  }

  el('btn-correct-turn').hidden = (state.turnFound.length === 0);
  showScreen('screen-turn-end');
}

// ─── CORRECTION DU TOUR ────────────────────────────────────────────────────────
export function openCorrectTurn() {
  const list = el('correct-turn-list');
  list.innerHTML = '';
  state.turnFound.forEach((word, i) => {
    const cat = getCategoryInfo(word.category);
    const item = document.createElement('label');
    item.className = 'correct-turn-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'correct-turn-checkbox';
    checkbox.dataset.idx = i;
    checkbox.checked = true;

    const wordSpan = document.createElement('span');
    wordSpan.className = 'correct-turn-word';
    wordSpan.textContent = word.word;

    const catSpan = document.createElement('span');
    catSpan.className = 'correct-turn-cat';
    catSpan.textContent = `${cat.emoji} ${cat.label}`;

    item.appendChild(checkbox);
    item.appendChild(wordSpan);
    item.appendChild(catSpan);
    list.appendChild(item);
  });

  el('correct-turn-overlay').hidden = false;
}

export function closeCorrectTurn() {
  el('correct-turn-overlay').hidden = true;
}

export function applyTurnCorrection() {
  if (state.currentRound < 1) return;
  const checkboxes = el('correct-turn-list').querySelectorAll('input[type="checkbox"]');
  const team = state.teams[state.currentTeamIdx];

  const indicesToRemove = [];
  checkboxes.forEach((cb) => {
    if (!cb.checked) indicesToRemove.push(parseInt(cb.dataset.idx, 10));
  });

  if (indicesToRemove.length > 0) {
    indicesToRemove.sort((a, b) => b - a);
    indicesToRemove.forEach(idx => {
      const [word] = state.turnFound.splice(idx, 1);
      state.roundWords.push(word);
    });

    team.score[state.currentRound - 1] -= indicesToRemove.length;
    if (team.score[state.currentRound - 1] < 0) team.score[state.currentRound - 1] = 0;

    // En mode devineur tournant, corriger aussi le score du devineur
    if (state.rotatingGuesserMode && state.currentGuesserTeamIdx >= 0 &&
        state.currentGuesserTeamIdx !== state.currentTeamIdx) {
      const guesserTeam = state.teams[state.currentGuesserTeamIdx];
      guesserTeam.score[state.currentRound - 1] -= indicesToRemove.length;
      if (guesserTeam.score[state.currentRound - 1] < 0) guesserTeam.score[state.currentRound - 1] = 0;
    }

    el('turn-end-count').textContent = state.turnFound.length;
    el('turn-end-words-left').textContent = state.roundWords.length;
    el('btn-correct-turn').hidden = (state.turnFound.length === 0);
  }

  closeCorrectTurn();
}

export function handleNextTurn() {
  const action = el('btn-next-turn').dataset.nextAction;
  if (action === 'round-end') {
    showRoundEnd();
  } else if (action === 'game-over') {
    showGameOver();
  } else {
    state.currentTeamIdx = (state.currentTeamIdx + 1) % state.teams.length;
    startPreTurn();
  }
}

// ─── FIN DE MANCHE ─────────────────────────────────────────────────────────────
export function showRoundEnd() {
  el('round-end-num').textContent = state.currentRound;

  // En mode noTeams classique (5/7 joueurs sans rotation), redistribuer les points
  // pour donner crédit au devineur (voisin de gauche). En mode devineur tournant,
  // les points sont déjà distribués à chaque fin de tour — pas de redistribution.
  if (state.noTeamsMode && !state.rotatingGuesserMode) {
    const n = state.teams.length;
    const roundIdx = state.currentRound - 1;
    const origScores = state.teams.map(t => t.score[roundIdx] || 0);
    state.teams.forEach((team, i) => {
      const rightIdx = (i + 1) % n;
      team.score[roundIdx] = origScores[i] + origScores[rightIdx];
    });
  }

  const scoreRows = el('round-end-scores');
  scoreRows.innerHTML = '';

  const chrono    = state.coopObjectives.has('chrono');
  const precision = state.coopObjectives.has('precision');

  // En-tête du tableau : colonnes classiques + colonnes coop actives
  const theadRow = el('round-end-thead-row');
  if (theadRow) {
    let html = '<th>Équipe</th><th class="score-cell">Cette manche</th><th class="score-cell">Total</th>';
    if (chrono)    html += '<th class="score-cell">⏱️ Chrono</th>';
    if (precision) html += '<th class="score-cell">🎯 Précision</th>';
    theadRow.innerHTML = html;
  }

  const sortedTeams = [...state.teams].sort((a, b) => {
    const totA = a.score.reduce((s, v) => s + v, 0);
    const totB = b.score.reduce((s, v) => s + v, 0);
    return totB - totA;
  });

  sortedTeams.forEach(team => {
    const tr      = document.createElement('tr');
    const roundPts = team.score[state.currentRound - 1];
    const totalPts = team.score.reduce((a, b) => a + b, 0);

    const tdName = document.createElement('td');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = teamLabel(team);
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

    if (chrono) {
      const tdTime = document.createElement('td');
      tdTime.className = 'score-cell';
      tdTime.textContent = formatCoopTime(state.coopTimeUsed);
      tr.appendChild(tdTime);
    }
    if (precision) {
      const tdTurns = document.createElement('td');
      tdTurns.className = 'score-cell';
      tdTurns.textContent = state.coopTurnsCount;
      tr.appendChild(tdTurns);
    }

    scoreRows.appendChild(tr);
  });

  const isLastRound = state.currentRound === 3;
  el('btn-next-round').hidden    = isLastRound;
  el('btn-skip-round3').hidden   = state.currentRound !== 2;
  el('btn-final-results').hidden = !isLastRound;

  showScreen('screen-round-end');
}

function formatCoopTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
}

// ─── FIN DU JEU ────────────────────────────────────────────────────────────────
export function showGameOver() {
  demo.mode = false;
  playGameOver();
  saveMembersAfterGame();

  const isCoop2 = state.coopObjectives.size > 0;
  saveGameResult({
    date:      new Date().toISOString(),
    mode:      isCoop2 ? 'coop2' : 'standard',
    teams:     state.teams.map(t => ({
      players: t.players,
      total:   t.score.reduce((a, b) => a + b, 0),
    })),
    cardCount: state.cardCount,
    ...(isCoop2 ? {
      objectives:    [...state.coopObjectives],
      coopTimeUsed:  state.coopTimeUsed,
      coopTurnsCount: state.coopTurnsCount,
    } : {}),
  });

  const scored = state.teams
    .map(t => ({ team: t, total: t.score.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);

  const maxScore = scored[0].total;
  const isTie = scored.length >= 2 && scored[1].total === maxScore;

  const winnerEl = el('game-over-winner');
  if (state.godModeEliminated) {
    winnerEl.textContent = '☠️ Éliminé — faute en manche 3';
    winnerEl.style.color = 'var(--danger)';
  } else if (isTie) {
    const tiedNames = scored
      .filter(s => s.total === maxScore)
      .map(s => teamLabel(s.team))
      .join(' · ');
    winnerEl.textContent = `🤝 Égalité ! ${tiedNames}`;
    winnerEl.style.color = 'var(--warning)';
  } else {
    const w = scored[0].team;
    winnerEl.textContent = teamLabel(w);
    winnerEl.style.color = w.color;
  }

  const RANK_EMOJIS = ['🥇', '🥈', '🥉', '🎖️'];
  const finalScores = el('final-scores');
  finalScores.innerHTML = '';

  // Group teams by score so tied teams share a single row
  const scoreGroups = [];
  for (const s of scored) {
    const last = scoreGroups[scoreGroups.length - 1];
    if (last && last.total === s.total) {
      last.teams.push(s.team);
    } else {
      scoreGroups.push({ total: s.total, teams: [s.team] });
    }
  }

  let rankIdx = 0;
  scoreGroups.forEach(group => {
    const div = document.createElement('div');
    div.className = 'final-score-row';

    const rankSpan = document.createElement('span');
    rankSpan.className = 'final-rank';
    rankSpan.textContent = RANK_EMOJIS[Math.min(rankIdx, RANK_EMOJIS.length - 1)];

    const nameSpan = document.createElement('span');
    if (group.teams.length > 1) {
      // Multiple teams tied at this score — join names, use warning color
      nameSpan.textContent = group.teams.map(teamLabel).join(' · ');
      nameSpan.style.color = 'var(--warning)';
    } else {
      nameSpan.textContent = teamLabel(group.teams[0]);
      nameSpan.style.color = group.teams[0].color;
    }

    const ptsSpan = document.createElement('span');
    ptsSpan.className = 'final-pts';
    ptsSpan.textContent = `${group.total} pts`;

    div.appendChild(rankSpan);
    div.appendChild(nameSpan);
    div.appendChild(ptsSpan);
    finalScores.appendChild(div);

    rankIdx += group.teams.length;
  });

  // Afficher les performances coop si au moins un objectif est actif
  const chrono    = state.coopObjectives.has('chrono');
  const precision = state.coopObjectives.has('precision');
  if (chrono || precision) {
    const perfDiv = document.createElement('div');
    perfDiv.className = 'coop-perf-summary';
    if (chrono) {
      const p = document.createElement('p');
      p.className = 'coop-perf-line';
      p.textContent = `⏱️ Chrono : ${formatCoopTime(state.coopTimeUsed)}`;
      perfDiv.appendChild(p);
    }
    if (precision) {
      const p = document.createElement('p');
      p.className = 'coop-perf-line';
      p.textContent = `🎯 Précision : ${state.coopTurnsCount} tour${state.coopTurnsCount !== 1 ? 's' : ''}`;
      perfDiv.appendChild(p);
    }
    finalScores.appendChild(perfDiv);
  }

  showScreen('screen-game-over');
}

// ─── WORD DRAFT (TRI CACHÉ) ────────────────────────────────────────────────────

/**
 * Splits an array of words into N chunks as evenly as possible.
 * Total words = cardCount + ELIMINATIONS_PER_PLAYER * N
 * Each chunk has ~(cardCount/N + ELIMINATIONS_PER_PLAYER) words.
 * After each player eliminates ELIMINATIONS_PER_PLAYER words, exactly cardCount remain.
 *
 * @param {Array} words - Shuffled word pool (length >= cardCount + E*N)
 * @param {number} cardCount - Target game word count
 * @param {number} nbPlayers - Number of players
 * @param {number} eliminationsPerPlayer - Words each player eliminates (default: ELIMINATIONS_PER_PLAYER)
 * @returns {Array<Array>} N chunks
 */
export function computeDraftChunks(words, cardCount, nbPlayers, eliminationsPerPlayer = ELIMINATIONS_PER_PLAYER) {
  const total  = cardCount + eliminationsPerPlayer * nbPlayers;
  const pool   = words.slice(0, total);
  const chunks = [];
  let offset   = 0;
  for (let i = 0; i < nbPlayers; i++) {
    const extra = i < (total % nbPlayers) ? 1 : 0;
    const size  = Math.floor(total / nbPlayers) + extra;
    chunks.push(pool.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
}

export async function startWordDraft() {
  const N           = state.playerNames.length;
  const cardCount   = state.cardCount;
  const isTwoPlayer = N === 2;
  const difficulty  = state.difficultyLevel;

  const allShuffled = await getShuffledWords(
    state.selectedCategories.length > 0 ? state.selectedCategories : null,
    state.kidsMode,
  );

  if (allShuffled.length === 0) {
    showToast('Aucun mot dans les catégories sélectionnées !', 'error');
    showScreen('screen-categories');
    return;
  }

  // "Tous les mots" mode (cardCount === 0) ou God mode : pas de tri caché
  if (cardCount === 0 || (isTwoPlayer && difficulty === 'god')) {
    const count    = cardCount === 0 ? allShuffled.length : Math.min(cardCount, allShuffled.length);
    state.allWords = allShuffled.slice(0, count);
    if (state.allWords.length === 0) {
      showToast('Aucun mot dans les catégories sélectionnées !', 'error');
      showScreen('screen-categories');
      return;
    }
    await startRound(1);
    return;
  }

  // La quantité totale de mots nécessaires dans le pool est identique pour tous les
  // niveaux de difficulté : X + E*N. Le diviseur ne change que la répartition interne.
  const totalNeeded = cardCount + ELIMINATIONS_PER_PLAYER * N;

  if (allShuffled.length < totalNeeded) {
    showToast(
      `Pas assez de mots pour le tri caché (${allShuffled.length} disponibles, ${totalNeeded} requis). La partie démarre normalement.`,
      'warn',
    );
    const count    = Math.min(cardCount, allShuffled.length);
    state.allWords = allShuffled.slice(0, count);
    if (state.allWords.length === 0) {
      showToast('Aucun mot dans les catégories sélectionnées !', 'error');
      showScreen('screen-categories');
      return;
    }
    await startRound(1);
    return;
  }

  const divisor = isTwoPlayer ? (DIFFICULTIES[difficulty]?.divisor ?? null) : null;

  // Tri caché avec des mots inconnus : uniquement pour Moyen (D=3) et Difficile (D=4).
  // Pour Facile (D=2) et les modes multi-joueurs, tous les mots passent par les chunks
  // (aucun mot inconnu), ce qui donne le même résultat que le mode standard.
  if (isTwoPlayer && divisor !== null && difficulty !== 'facile') {
    // Moyen (D=3) ou Difficile (D=4) : une partie des mots n'est pas montrée au tri
    const retainedPerPlayer = Math.floor(cardCount / divisor);
    const totalRetained     = N * retainedPerPlayer;    // mots qui passent par les chunks
    const unknownCount      = cardCount - totalRetained; // mots inconnus (pas montrés)
    const totalChunkWords   = totalRetained + ELIMINATIONS_PER_PLAYER * N;

    const draftPool               = allShuffled.slice(0, totalChunkWords);
    state.draftUnknownWords       = allShuffled.slice(totalChunkWords, totalChunkWords + unknownCount);
    // Reserve pool pour le refresh en mode enfant
    state.draftReservePool        = shuffle(allShuffled.slice(totalChunkWords + unknownCount));

    // computeDraftChunks attend cardCount = nombre de mots retenus total (= totalRetained)
    state.draftPlayerChunks       = computeDraftChunks(draftPool, totalRetained, N);
    state.draftCurrentPlayerIdx   = 0;
    state.draftEliminations       = [];
  } else {
    // Facile (D=2) ou mode non-2-joueurs : comportement standard — tous les mots passent par les chunks
    state.draftUnknownWords       = [];
    state.draftPlayerChunks       = computeDraftChunks(allShuffled, cardCount, N);
    state.draftCurrentPlayerIdx   = 0;
    state.draftEliminations       = [];
    // Words beyond the distributed pool serve as the refresh reserve (kidsMode)
    state.draftReservePool        = shuffle(allShuffled.slice(totalNeeded));
  }

  showWordDraftCover(0);
}

export function showWordDraftCover(playerIdx) {
  state.draftCurrentPlayerIdx = playerIdx;
  state.draftEliminations     = [];

  const playerName = state.playerNames[playerIdx];
  el('draft-cover-player').textContent = playerName;
  el('draft-cover-num').textContent    =
    `Joueur ${playerIdx + 1} / ${state.playerNames.length}`;

  showScreen('screen-word-draft-cover');
}

export function showWordDraftTurn(playerIdx) {
  const chunk      = state.draftPlayerChunks[playerIdx];
  const playerName = state.playerNames[playerIdx];
  const list       = el('draft-word-list');

  state.draftEliminations = [];
  list.innerHTML           = '';
  el('draft-player-name').textContent = playerName;
  el('draft-counter').textContent     = `0 / ${ELIMINATIONS_PER_PLAYER}`;
  el('draft-counter').classList.remove('draft-counter-badge--full');
  el('btn-draft-confirm').disabled    = true;

  // Compute grid columns: 2 for ≤4 words, 3 for ≤9, 4 for more
  const n    = chunk.length;
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
  list.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  chunk.forEach((word, i) => {
    if (state.kidsMode) {
      // In kids mode, wrap in a <div> so the refresh <button> inside is valid HTML
      // (interactive elements cannot be descendants of <button>)
      // The div handles elimination on click; the inner button handles refresh.
      const item = document.createElement('div');
      item.className   = 'draft-word-item';
      item.dataset.idx = i;

      const wordSpan     = document.createElement('span');
      wordSpan.className = 'draft-word-text';
      wordSpan.textContent = word.word;
      item.appendChild(wordSpan);

      const refreshBtn = document.createElement('button');
      refreshBtn.type      = 'button';
      refreshBtn.className = 'draft-refresh-btn';
      refreshBtn.title     = 'Changer ce mot';
      refreshBtn.textContent = '🔄';
      refreshBtn.disabled  = state.draftReservePool.length === 0;
      refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        refreshDraftWord(i);
      });
      item.appendChild(refreshBtn);

      item.addEventListener('click', () => toggleDraftElimination(i));
      list.appendChild(item);
    } else {
      const item = document.createElement('button');
      item.className     = 'draft-word-item';
      item.dataset.idx   = i;
      item.setAttribute('type', 'button');

      const wordSpan     = document.createElement('span');
      wordSpan.className = 'draft-word-text';
      wordSpan.textContent = word.word;

      item.appendChild(wordSpan);
      item.addEventListener('click', () => toggleDraftElimination(i));
      list.appendChild(item);
    }
  });

  try { screen.orientation.lock('landscape'); } catch (_) {}
  showScreen('screen-word-draft');
}

function toggleDraftElimination(idx) {
  const items = el('draft-word-list').querySelectorAll('.draft-word-item');
  const pos   = state.draftEliminations.indexOf(idx);

  if (pos === -1) {
    if (state.draftEliminations.length >= ELIMINATIONS_PER_PLAYER) return;
    state.draftEliminations.push(idx);
    items[idx].classList.add('draft-word-item--eliminated');
  } else {
    state.draftEliminations.splice(pos, 1);
    items[idx].classList.remove('draft-word-item--eliminated');
  }

  const count = state.draftEliminations.length;
  el('draft-counter').textContent  = `${count} / ${ELIMINATIONS_PER_PLAYER}`;
  el('draft-counter').classList.toggle('draft-counter-badge--full', count === ELIMINATIONS_PER_PLAYER);
  el('btn-draft-confirm').disabled = count !== ELIMINATIONS_PER_PLAYER;
}

function refreshDraftWord(idx) {
  const reserve   = state.draftReservePool;
  if (reserve.length === 0) return;

  const playerIdx = state.draftCurrentPlayerIdx;
  const chunk     = state.draftPlayerChunks[playerIdx];

  // If the word was marked for elimination, un-mark it first
  const elimPos = state.draftEliminations.indexOf(idx);
  if (elimPos !== -1) {
    state.draftEliminations.splice(elimPos, 1);
  }

  // Pull a random word from the reserve and put it in the chunk
  const reserveIdx = Math.floor(Math.random() * reserve.length);
  const newWord    = reserve.splice(reserveIdx, 1)[0];
  chunk[idx]       = newWord;

  // Update the card's text and visual state
  const items = el('draft-word-list').querySelectorAll('.draft-word-item');
  const item  = items[idx];
  item.querySelector('.draft-word-text').textContent = newWord.word;
  item.classList.remove('draft-word-item--eliminated');

  // Disable all refresh buttons if the reserve is now empty
  if (reserve.length === 0) {
    el('draft-word-list').querySelectorAll('.draft-refresh-btn').forEach(btn => {
      btn.disabled = true;
    });
  }

  // Sync the elimination counter (un-marking may have changed count)
  const count = state.draftEliminations.length;
  el('draft-counter').textContent  = `${count} / ${ELIMINATIONS_PER_PLAYER}`;
  el('draft-counter').classList.toggle('draft-counter-badge--full', count === ELIMINATIONS_PER_PLAYER);
  el('btn-draft-confirm').disabled = count !== ELIMINATIONS_PER_PLAYER;
}

export async function confirmWordDraftEliminations() {
  try { screen.orientation.unlock(); } catch (_) {}
  const playerIdx = state.draftCurrentPlayerIdx;
  const chunk     = state.draftPlayerChunks[playerIdx];

  // Keep only non-eliminated words
  state.draftPlayerChunks[playerIdx] =
    chunk.filter((_, i) => !state.draftEliminations.includes(i));

  const nextIdx = playerIdx + 1;
  if (nextIdx < state.playerNames.length) {
    showWordDraftCover(nextIdx);
  } else {
    // All players done — build the final word list (known + unknown)
    state.allWords = shuffle([...state.draftPlayerChunks.flat(), ...state.draftUnknownWords]);
    state.draftPlayerChunks   = [];
    state.draftEliminations   = [];
    state.draftReservePool    = [];
    state.draftUnknownWords   = [];
    if (state.allWords.length === 0) {
      showToast('Aucun mot restant après le tri !', 'error');
      showScreen('screen-categories');
      return;
    }
    await startRound(1);
  }
}

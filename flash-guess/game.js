/**
 * game.js — Logique de jeu : tours, timer, actions mots, undo/redo, manches, fin de partie
 */

import {
  state, demo, demoHooks,
  ROUND_RULES, TEAMS_META, GAMEPLAY_SCREENS,
  TURN_DURATION, TIMER_CIRCLE_RADIUS,
  WORD_FONT_MIN, WORD_FONT_MAX,
  CHILD_READ_AUTO_MS,
} from './state.js';
import { el, showScreen, showToast } from './ui.js';
import {
  playTick, playTickUrgent, playBuzzer,
  playFound, playRoundStart, playGameOver, playButtonClick,
  playSkip, playFault, playUndo, playRedo, playGameStart,
} from './sound.js';
import { getShuffledWords, getCategoryInfo, shuffle } from './words.js';
import { saveMembersAfterGame } from './members.js';

// ─── Helpers internes ──────────────────────────────────────────────────────────
export function getCurrentRoundRule() { return ROUND_RULES[state.currentRound - 1]; }

export function teamLabel(team) { return team.players.join(' · '); }

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
  const layout  = computeTeamLayout(players.length);

  if (layout === null) {
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
}

export function renderTeams() {
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
    void btn.offsetWidth;
    btn.classList.add('child-read-btn--countdown');
    state.childReadAutoTimer = setTimeout(() => {
      state.childReadAutoTimer = null;
      childConfirmedRead();
    }, CHILD_READ_AUTO_MS);
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
  const pct       = state.timeLeft / TURN_DURATION;
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
export function startRound(roundNum) {
  state.currentRound = roundNum;
  if (roundNum === 1) {
    const words = getShuffledWords(
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
  state.roundWords     = shuffle([...state.allWords]);
  state.currentTeamIdx = 0;

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
  if (state.noTeamsMode) {
    const n = state.teams.length;
    const leftIdx = (state.currentTeamIdx - 1 + n) % n;
    guesserLabel = teamLabel(state.teams[leftIdx]);
  } else {
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
  state.timeLeft      = TURN_DURATION;
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
  const cat = getCategoryInfo(state.currentWord.category);
  el('word-card-text').textContent     = state.currentWord.word;
  el('word-card-category').textContent = `${cat.emoji} ${cat.label}`;
  el('turn-round-badge').textContent   = `Manche ${state.currentRound} — ${ROUND_RULES[state.currentRound - 1].icon}`;
  const kidsBadge = el('word-card-kids-badge');
  if (kidsBadge) kidsBadge.hidden = !state.currentWord.kidFriendly;
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
  const cat = getCategoryInfo(word.category);
  el('word-card-text').textContent     = word.word;
  el('word-card-category').textContent = `${cat.emoji} ${cat.label}`;
  const kidsBadge = el('word-card-kids-badge');
  if (kidsBadge) kidsBadge.hidden = !word.kidFriendly;
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

  const reasonMsgs = {
    timeout:   '⏱️ Temps écoulé !',
    fault:     '🚨 Faute — tour arrêté !',
    allFound:  '🎉 Tous les mots trouvés !',
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
  } else {
    state.currentTeamIdx = (state.currentTeamIdx + 1) % state.teams.length;
    startPreTurn();
  }
}

// ─── FIN DE MANCHE ─────────────────────────────────────────────────────────────
export function showRoundEnd() {
  el('round-end-num').textContent = state.currentRound;

  if (state.noTeamsMode) {
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
  state.teams.forEach(team => {
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
    scoreRows.appendChild(tr);
  });

  const isLastRound = state.currentRound === 3;
  el('btn-next-round').hidden    = isLastRound;
  el('btn-final-results').hidden = !isLastRound;

  showScreen('screen-round-end');
}

// ─── FIN DU JEU ────────────────────────────────────────────────────────────────
export function showGameOver() {
  demo.mode = false;
  playGameOver();
  saveMembersAfterGame();

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
    winnerEl.textContent = teamLabel(w);
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
    nameSpan.textContent = teamLabel(s.team);
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

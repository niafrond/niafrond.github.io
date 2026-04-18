/**
 * main.js — Time's Up Nout Péi
 *
 * Jeu 100 % local, les joueurs se passent le téléphone.
 * Flux : setup → teams → round-intro → pre-turn → turn → turn-end → round-end → game-over
 */

import { getShuffledWords, getCategoryInfo, shuffle, CATEGORY_LABELS, DEFAULT_WORDS, loadWords, saveWords, resetWords } from './words.js';
import {
  playTick, playTickUrgent, playBuzzer,
  playFound, playRoundStart, playGameOver,
  setMuted, getMuted,
} from './sound.js';

// ─── Constantes ────────────────────────────────────────────────────────────────
const TURN_DURATION              = 30;   // secondes par tour
const TIMER_CIRCLE_RADIUS        = 46;   // rayon du cercle SVG du timer
const MIN_PLAYERS                = 4;
const CARD_COUNT_DEFAULT         = 40;   // nombre de cartes par défaut
const CARD_COUNT_KEY             = 'timesup_card_count';
const WORD_CARD_HORIZONTAL_PAD   = 32;   // padding horizontal de .word-card (16px × 2)
const WORD_FONT_MIN              = 16;   // px — taille minimale du mot
const WORD_FONT_MAX              = 200;  // px — taille maximale du mot

// Swipe constants
const SWIPE_THRESHOLD            = 70;   // px — distance minimale pour valider un swipe
const SWIPE_VISUAL_THRESHOLD     = 20;   // px — distance à partir de laquelle l'indicateur s'affiche
const SWIPE_VERTICAL_TOLERANCE   = 10;   // px — tolérance verticale avant d'annuler le swipe
const SWIPE_MIN_OPACITY          = 0.4;  // opacité minimale de la carte pendant le swipe
const SWIPE_OPACITY_DIST         = 280;  // px — distance sur laquelle l'opacité diminue

const ROUND_RULES = [
  {
    num: 1, icon: '🗣️',
    title: 'Manche 1 — Parler librement',
    desc: `L'orateur peut parler librement.
⛔ Interdit : dire le nom (ou une partie), épeler, traduire.
✅ Les joueurs peuvent faire autant de propositions qu'ils souhaitent.
🚨 Faute → tour arrêté immédiatement.`,
    canSkip: false,
    canFault: true,
  },
  {
    num: 2, icon: '☝️',
    title: 'Manche 2 — Un seul mot',
    desc: `L'orateur ne dit qu'un seul mot par carte. L'équipe n'a droit qu'à une seule proposition.
✅ Bonne réponse → carte gagnée.
❌ Mauvaise réponse → carte passée définitivement pour ce tour.
🚨 Faute → tour arrêté immédiatement.
⏭ L'orateur peut aussi passer s'il est bloqué.
⛔ Interdits : plus d'un mot, partie du nom, traduction directe.`,
    canSkip: true,
    canFault: true,
  },
  {
    num: 3, icon: '🤐',
    title: 'Manche 3 — Mime et bruitages',
    desc: `L'orateur ne peut plus parler du tout : uniquement des mimes et des bruitages.
Même fonctionnement que la manche 2 :
✅ Bonne réponse → carte gagnée.
❌ Mauvaise réponse → carte passée définitivement pour ce tour.
🚨 Faute → tour arrêté immédiatement.
⏭ L'orateur peut passer s'il est bloqué.
⛔ Interdits : parler, former des mots, fredonner une chanson.`,
    canSkip: true,
    canFault: true,
  },
];

// ─── Métadonnées équipes (max 4) ───────────────────────────────────────────────
const TEAMS_META = [
  { emoji: '🌋', color: 'var(--volcan)' },
  { emoji: '🌊', color: 'var(--lagon)'  },
  { emoji: '🌿', color: 'var(--foret)'  },
  { emoji: '☀️', color: 'var(--soleil)' },
];

// Emojis pour le mode jeu libre (5 ou 7 joueurs — pas d'équipes fixes)
const SOLO_EMOJIS = ['🌺', '🦜', '🌴', '🐠', '🌸', '🦩', '🌿'];

// ─── Persistance du nombre de cartes ───────────────────────────────────────────
function loadCardCount() {
  const ALLOWED = [0, 20, 30, 40, 50];
  try {
    const v = localStorage.getItem(CARD_COUNT_KEY);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (ALLOWED.includes(n)) return n;
    }
  } catch (_) { /* ignore */ }
  return CARD_COUNT_DEFAULT;
}

function saveCardCount(n) {
  try { localStorage.setItem(CARD_COUNT_KEY, String(n)); } catch (_) { /* ignore */ }
}

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
  turnSkipped: [],   // cartes passées définitivement dans le tour en cours (manches 2 et 3)
  currentWord: null,

  timerInterval: null,
  timeLeft: TURN_DURATION,

  cardCount: CARD_COUNT_DEFAULT,  // 0 = tous les mots disponibles
};

// ─── Helpers UI ────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  document.getElementById(id).hidden = false;
}

function el(id) { return document.getElementById(id); }

function getCurrentRoundRule() { return ROUND_RULES[state.currentRound - 1]; }

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

/** Retourne un libellé court pour une équipe : emoji + liste des joueurs. */
function teamLabel(team) {
  return `${team.emoji} ${team.players.join(' · ')}`;
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

    header.appendChild(emojiSpan);

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
    const words = getShuffledWords();
    const count = state.cardCount === 0 ? words.length : Math.min(state.cardCount, words.length);
    state.allWords  = words.slice(0, count);
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

  el('pre-turn-team').textContent  = teamLabel(team);
  el('pre-turn-team').style.color  = team.color;
  el('pre-turn-player').textContent = playerName;
  el('pre-turn-round').textContent  = `Manche ${state.currentRound} / 3`;
  el('pre-turn-words-left').textContent =
    `${state.roundWords.length} mot${state.roundWords.length > 1 ? 's' : ''} restant${state.roundWords.length > 1 ? 's' : ''}`;

  if (state.noTeamsMode) {
    const n = state.teams.length;
    const leftIdx = (state.currentTeamIdx - 1 + n) % n;
    const leftTeam = state.teams[leftIdx];
    el('pre-turn-guesser').textContent = teamLabel(leftTeam);
    el('pre-turn-guesser-wrap').hidden = false;
  } else {
    el('pre-turn-guesser-wrap').hidden = true;
  }

  showScreen('screen-pre-turn');
}

// ─── TOUR ACTIF ────────────────────────────────────────────────────────────────
function startTurn() {
  state.turnFound   = [];
  state.turnSkipped = [];
  state.timeLeft    = TURN_DURATION;

  const rule = getCurrentRoundRule();
  el('btn-skip').hidden  = !rule.canSkip;
  el('btn-fault').hidden = !rule.canFault;

  // Adapt play-area grid: no left column when fault button is hidden
  const playArea = document.querySelector('.turn-play-area');
  playArea.style.gridTemplateColumns = rule.canFault ? '' : '5fr 2fr';

  el('btn-fault').setAttribute('aria-label', 'Erreur — arrêter le tour');

  // Swipe hint: masquer la flèche gauche si on ne peut pas passer
  const hintEl = el('swipe-hint-text');
  hintEl.innerHTML = rule.canSkip
    ? '← Passer &nbsp;·&nbsp; Trouvé →'
    : 'Glissez à droite → Trouvé';

  updateTurnStats();
  drawNextWord();
  updateTimerDisplay();
  startTimer();

  showScreen('screen-turn');
}

function fitWordCard() {
  const textEl = el('word-card-text');
  const card   = textEl.closest('.word-card');
  if (!card || !textEl.textContent.trim()) return;

  const availW = card.clientWidth - WORD_CARD_HORIZONTAL_PAD;
  if (availW <= 0) return;

  // Binary-search the largest font size where text fits on one line
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

function drawNextWord() {
  if (state.roundWords.length === 0) {
    // S'il reste des cartes passées définitivement, ce n'est pas "tous trouvés" :
    // le tour se termine normalement et ces cartes reviendront pour les prochaines équipes.
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
  fitWordCard();
}

function wordFound() {
  playFound();
  state.turnFound.push(state.currentWord);
  updateTurnStats();
  drawNextWord();
}

function wordSkipped() {
  if (state.currentRound >= 2) {
    // Manches 2 et 3 : la carte est passée définitivement pour ce tour
    state.turnSkipped.push(state.currentWord);
  } else {
    // Manche 1 (ne devrait pas arriver, canSkip=false, mais par sécurité)
    state.roundWords.push(state.currentWord);
  }
  state.currentWord = null;
  updateTurnStats();
  drawNextWord();
}

function wordFault() {
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

  // Remettre le mot courant dans le jeu si le temps est écoulé (ni trouvé ni passé)
  if (reason === 'timeout' && state.currentWord) {
    state.roundWords.push(state.currentWord);
    state.currentWord = null;
  }

  // Remettre les cartes passées définitivement dans le pool de la manche pour les prochains tours
  if (state.turnSkipped.length > 0) {
    state.roundWords.push(...state.turnSkipped);
    state.turnSkipped = [];
  }

  const team = state.teams[state.currentTeamIdx];
  team.score[state.currentRound - 1] += state.turnFound.length;

  // Message selon la raison
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

  if (reason === 'allFound') {
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

  // En mode sans équipes (5 ou 7 joueurs) : partager les points entre orateur et devineur
  // L'orateur (i) et son devineur (voisin gauche = i-1) participent ensemble.
  // Donc le joueur i reçoit ses propres points (quand il a été orateur) +
  // les points du voisin droit (quand i était lui-même devineur).
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
function showGameOver() {
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

// ─── ÉDITEUR DE MOTS ──────────────────────────────────────────────────────────
let editableWords = [];

/** Filtre et normalise un tableau brut en entrées {word, category} valides. */
function filterValidWords(arr) {
  return arr
    .filter(w => w && typeof w.word === 'string' && w.word.trim() &&
                 typeof w.category === 'string' && w.category.trim())
    .map(w => ({ word: w.word.trim(), category: w.category.trim() }));
}

function openWordsEditor() {
  editableWords = loadWords();
  renderWordsList();
  showScreen('screen-words');
}

function renderWordsList() {
  const list = el('words-list');
  list.innerHTML = '';

  el('words-count-info').textContent =
    `${editableWords.length} mot${editableWords.length !== 1 ? 's' : ''} dans le jeu`;

  // Per-category counters
  const catCounts = el('words-cat-counts');
  catCounts.innerHTML = '';
  const counts = {};
  editableWords.forEach(w => { counts[w.category] = (counts[w.category] || 0) + 1; });
  Object.entries(CATEGORY_LABELS).forEach(([key, { label, emoji }]) => {
    const n = counts[key] || 0;
    const badge = document.createElement('span');
    badge.className = `words-cat-badge${n === 0 ? ' words-cat-badge--empty' : ''}`;
    badge.textContent = `${emoji} ${label} ${n}`;
    catCounts.appendChild(badge);
  });

  if (editableWords.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-muted);font-size:0.9rem;text-align:center;padding:12px 0;';
    empty.textContent = 'Aucun mot — ajoutez-en ci-dessus !';
    list.appendChild(empty);
    return;
  }

  editableWords.forEach((entry, i) => {
    const cat = getCategoryInfo(entry.category);
    const row = document.createElement('div');
    row.className = 'word-edit-row';

    const info = document.createElement('div');
    info.className = 'word-edit-info';

    const wordSpan = document.createElement('span');
    wordSpan.className = 'word-edit-text';
    wordSpan.textContent = entry.word;

    const catBadge = document.createElement('span');
    catBadge.className = 'word-edit-cat';
    catBadge.textContent = `${cat.emoji} ${cat.label}`;

    info.appendChild(wordSpan);
    info.appendChild(catBadge);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-danger';
    delBtn.setAttribute('aria-label', `Supprimer ${entry.word}`);
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => deleteWord(i));

    row.appendChild(info);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function addWord() {
  const textInput = el('word-new-text');
  const catSelect = el('word-new-category');
  const word = textInput.value.trim();
  if (!word) { showToast('Entrez un mot', 'warn'); return; }
  if (editableWords.some(w => w.word.toLowerCase() === word.toLowerCase())) {
    showToast('Ce mot existe déjà', 'warn'); return;
  }
  editableWords.push({ word, category: catSelect.value });
  saveWords(editableWords);
  textInput.value = '';
  textInput.focus();
  renderWordsList();
}

function deleteWord(idx) {
  editableWords.splice(idx, 1);
  saveWords(editableWords);
  renderWordsList();
}

function exportWords() {
  const json = JSON.stringify(editableWords, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'timesup-mots.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importWords(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error('Format invalide');
      const valid = filterValidWords(parsed);
      if (valid.length === 0) throw new Error('Aucun mot valide trouvé');
      editableWords = valid;
      saveWords(editableWords);
      renderWordsList();
      showToast(`${valid.length} mot${valid.length !== 1 ? 's' : ''} importé${valid.length !== 1 ? 's' : ''} ✅`);
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

function handleResetWords() {
  if (!confirm('Réinitialiser la liste avec les mots par défaut ?')) return;
  resetWords();
  editableWords = [...DEFAULT_WORDS];
  renderWordsList();
  showToast('Mots remis par défaut ✅');
}

// ─── MEMBRES (historique des joueurs) ─────────────────────────────────────────
const MEMBERS_KEY = 'timesup-members';

function loadMembers() {
  try { return JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]'); } catch { return []; }
}

function saveMembers(members) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

// ─── ONGLETS SETUP ─────────────────────────────────────────────────────────────
function switchSetupTab(tab) {
  el('panel-partie').hidden  = tab !== 'partie';
  el('panel-membres').hidden = tab !== 'membres';
  el('tab-btn-partie').classList.toggle('setup-tab--active', tab === 'partie');
  el('tab-btn-membres').classList.toggle('setup-tab--active', tab === 'membres');
  if (tab === 'membres') renderMembersList();
}

function renderMembersList() {
  const members   = loadMembers();
  const container = el('members-list');
  container.innerHTML = '';

  if (members.length === 0) {
    const p = document.createElement('p');
    p.className = 'members-empty';
    p.textContent = 'Aucun joueur enregistré. Ajoutez-en ci-dessus ou terminez une partie !';
    container.appendChild(p);
    return;
  }

  members.forEach((member, idx) => {
    const alreadyAdded = state.playerNames.includes(member.name);

    const item = document.createElement('div');
    item.className = `member-item${alreadyAdded ? ' member-item--added' : ''}`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'member-item-name';
    nameSpan.textContent = `👤 ${member.name}`;

    const statsSpan = document.createElement('span');
    statsSpan.className = 'member-item-stats';
    statsSpan.textContent = member.games
      ? `${member.games} partie${member.games > 1 ? 's' : ''} · ${member.totalPts || 0} pts`
      : 'Aucune partie';

    item.appendChild(nameSpan);
    item.appendChild(statsSpan);

    if (alreadyAdded) {
      const badge = document.createElement('span');
      badge.className = 'member-item-added-badge';
      badge.textContent = '✓ Ajouté';
      item.appendChild(badge);
    } else {
      item.addEventListener('click', () => addPlayerFromMember(member.name));
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-danger';
    delBtn.setAttribute('aria-label', `Supprimer ${member.name}`);
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeMember(idx); });
    item.appendChild(delBtn);

    container.appendChild(item);
  });
}

function addMember() {
  const input = el('member-input');
  const name  = input.value.trim();
  if (!name) { showToast('Entrez un prénom', 'warn'); return; }
  const members = loadMembers();
  if (members.find(m => m.name === name)) { showToast('Ce joueur existe déjà', 'warn'); return; }
  members.push({ name, games: 0, totalPts: 0 });
  saveMembers(members);
  input.value = '';
  input.focus();
  renderMembersList();
  showToast(`${name} enregistré ✅`);
}

function removeMember(idx) {
  const members = loadMembers();
  members.splice(idx, 1);
  saveMembers(members);
  renderMembersList();
}

function addPlayerFromMember(name) {
  if (state.playerNames.includes(name)) { showToast('Déjà dans la partie', 'warn'); return; }
  if (state.playerNames.length >= 20) { showToast('Maximum 20 joueurs', 'warn'); return; }
  state.playerNames.push(name);
  renderPlayerList();
  renderMembersList();
  showToast(`${name} ajouté à la partie ✅`);
}

/** Sauvegarde les scores des joueurs après une partie terminée. */
function saveMembersAfterGame() {
  const members = loadMembers();
  state.teams.forEach(team => {
    const teamTotal = team.score.reduce((a, b) => a + b, 0);
    team.players.forEach(playerName => {
      const existing = members.find(m => m.name === playerName);
      if (existing) {
        existing.games  = (existing.games  || 0) + 1;
        existing.totalPts = (existing.totalPts || 0) + teamTotal;
      } else {
        members.push({ name: playerName, games: 1, totalPts: teamTotal });
      }
    });
  });
  saveMembers(members);
}


function initSwipe() {
  const card = document.querySelector('.word-card');
  let startX = 0, startY = 0, active = false;

  card.addEventListener('touchstart', (e) => {
    if (el('screen-turn').hidden) return;
    startX  = e.touches[0].clientX;
    startY  = e.touches[0].clientY;
    active  = true;
    card.style.transition = 'none';
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (!active) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx) + SWIPE_VERTICAL_TOLERANCE) { active = false; resetCard(); return; }
    card.style.transform = `translateX(${dx}px)`;
    card.style.opacity   = String(Math.max(SWIPE_MIN_OPACITY, 1 - Math.abs(dx) / SWIPE_OPACITY_DIST));
    card.classList.toggle('swipe-hint--right', dx >  SWIPE_VISUAL_THRESHOLD);
    card.classList.toggle('swipe-hint--left',  dx < -SWIPE_VISUAL_THRESHOLD);
  }, { passive: true });

  card.addEventListener('touchend', (e) => {
    if (!active) return;
    active = false;
    const dx = e.changedTouches[0].clientX - startX;
    resetCard();
    if (dx > SWIPE_THRESHOLD) {
      wordFound();
    } else if (dx < -SWIPE_THRESHOLD) {
      const rule = getCurrentRoundRule();
      if (rule.canSkip) wordSkipped();
    }
  }, { passive: true });

  card.addEventListener('touchcancel', () => { active = false; resetCard(); }, { passive: true });

  function resetCard() {
    card.style.transition = '';
    card.style.transform  = '';
    card.style.opacity    = '';
    card.classList.remove('swipe-hint--right', 'swipe-hint--left');
  }
}

// ─── PLEIN ÉCRAN ───────────────────────────────────────────────────────────────
function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const req = document.documentElement.requestFullscreen
      || document.documentElement.webkitRequestFullscreen;
    if (req) req.call(document.documentElement).catch(() => {});
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document).catch(() => {});
  }
}

function updateFullscreenBtn() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const btn  = el('btn-fullscreen');
  btn.textContent = isFs ? '⊡' : '⛶';
  btn.title       = isFs ? 'Quitter le plein écran' : 'Plein écran';
}

function init() {
  // ── Setup ──
  el('tab-btn-partie').addEventListener('click', () => switchSetupTab('partie'));
  el('tab-btn-membres').addEventListener('click', () => switchSetupTab('membres'));
  el('btn-add-player').addEventListener('click', addPlayer);
  el('player-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPlayer();
  });
  el('btn-start-game').addEventListener('click', () => {
    if (state.playerNames.length >= MIN_PLAYERS) goToTeams();
  });

  // ── Joueurs (membres persistants) ──
  el('btn-add-member').addEventListener('click', addMember);
  el('member-input').addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

  // ── Options de partie ──
  state.cardCount = loadCardCount();
  const selectCardCount = el('select-card-count');
  selectCardCount.value = String(state.cardCount);
  selectCardCount.addEventListener('change', () => {
    state.cardCount = parseInt(selectCardCount.value, 10);
    saveCardCount(state.cardCount);
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

  // ── Words editor ──
  el('btn-edit-words').addEventListener('click', openWordsEditor);
  el('btn-words-back').addEventListener('click', () => showScreen('screen-setup'));
  el('btn-word-add').addEventListener('click', addWord);
  el('word-new-text').addEventListener('keydown', e => { if (e.key === 'Enter') addWord(); });
  el('btn-words-export').addEventListener('click', exportWords);
  el('input-words-import').addEventListener('change', e => {
    importWords(e.target.files[0]);
    e.target.value = '';
  });
  el('btn-words-reset').addEventListener('click', handleResetWords);

  // ── Re-fit word on resize / orientation change ──
  window.addEventListener('resize', () => {
    if (!el('screen-turn').hidden) fitWordCard();
  });

  // ── Fullscreen ──
  el('btn-fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

  // ── Swipe support on turn screen ──
  initSwipe();

  renderPlayerList();
  showScreen('screen-setup');
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}


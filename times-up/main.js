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
import { getMatch3Version, getMatch3BuildDate } from '../match3-quest/version.js';

// ─── Constantes ────────────────────────────────────────────────────────────────
const TURN_DURATION              = 30;   // secondes par tour
const TIMER_CIRCLE_RADIUS        = 46;   // rayon du cercle SVG du timer
const MIN_PLAYERS                = 2;
const CARD_COUNT_DEFAULT         = 40;   // nombre de cartes par défaut
const CARD_COUNT_KEY             = 'timesup_card_count';
const WORD_CARD_HORIZONTAL_PAD   = 32;   // padding horizontal de .word-card (16px × 2)
const WORD_FONT_MIN              = 16;   // px — taille minimale du mot
const WORD_FONT_MAX              = 200;  // px — taille maximale du mot

// Écrans qui nécessitent le mode paysage
const GAMEPLAY_SCREENS = new Set([
  'screen-round-intro',
  'screen-pre-turn',
  'screen-turn',
  'screen-turn-end',
  'screen-round-end',
  'screen-game-over',
]);

// Swipe constants
const SWIPE_THRESHOLD            = 70;   // px — distance minimale pour valider un swipe
const SWIPE_VISUAL_THRESHOLD     = 20;   // px — distance à partir de laquelle l'indicateur s'affiche
const SWIPE_VERTICAL_TOLERANCE   = 10;   // px — tolérance verticale avant d'annuler le swipe
const SWIPE_MIN_OPACITY          = 0.4;  // opacité minimale de la carte pendant le swipe
const SWIPE_OPACITY_DIST         = 280;  // px — distance sur laquelle l'opacité diminue
const CLICK_COOLDOWN             = 500;  // ms — délai minimum entre deux clics sur le même bouton

const ROUND_RULES = [
  {
    num: 1, icon: '🗣️',
    title: 'Manche 1 — Parler librement',
    desc: `L'orateur peut parler librement.
⛔ Interdit : dire le nom (ou une partie), épeler, traduire.
✅ Les joueurs peuvent faire autant de propositions qu'ils souhaitent.`,
    canSkip: false,
    canFault: false,
  },
  {
    num: 2, icon: '☝️',
    title: 'Manche 2 — Un seul mot',
    desc: `L'orateur ne dit qu'un seul mot par carte. L'équipe n'a droit qu'à une seule proposition.
✅ Bonne réponse → carte gagnée.
❌ Mauvaise réponse → carte passée définitivement pour ce tour.
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
❌ Mauvaise réponse ou faute → carte passée définitivement pour ce tour.
⏭ L'orateur peut passer s'il est bloqué.
⛔ Interdits : parler, former des mots, fredonner une chanson.`,
    canSkip: true,
    canFault: true,
  },
];

// ─── Métadonnées équipes (max 4) ───────────────────────────────────────────────
const TEAMS_META = [
  { color: 'var(--volcan)' },
  { color: 'var(--lagon)'  },
  { color: 'var(--foret)'  },
  { color: 'var(--soleil)' },
];

// ─── Cooldown boutons ──────────────────────────────────────────────────────────
// Retourne un handler enveloppé d'un délai minimum de CLICK_COOLDOWN ms entre
// deux appels successifs sur le même bouton (évite le double-clic involontaire).
function withCooldown(fn) {
  let lastClick = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastClick < CLICK_COOLDOWN) return;
    lastClick = now;
    fn.apply(this, args);
  };
}

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
  actionHistory: [], // [{type:'found'|'skipped'|'fault', word}] — pile d'annulation depuis le début de la manche
  redoStack:     [], // pile de ré-application (actions annulées)

  timerInterval: null,
  timeLeft: TURN_DURATION,
  timerPaused: false,      // true quand le timer est suspendu (ex: overlay portrait)

  cardCount: CARD_COUNT_DEFAULT,  // 0 = tous les mots disponibles
};

// ─── Helpers UI ────────────────────────────────────────────────────────────────
let _currentScreen = 'screen-setup';

function showScreen(id) {
  _currentScreen = id;
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  document.getElementById(id).hidden = false;
  const versionEl = document.getElementById('timesup-version');
  if (versionEl) versionEl.hidden = (id !== 'screen-setup');
  if (GAMEPLAY_SCREENS.has(id)) {
    requestLandscapeLock();
    requestFullscreenIfNeeded();
  } else {
    requestPortraitLock();
  }
  updateRotateOverlay();
}

// ─── Plein écran automatique ──────────────────────────────────────────────────
/** Demande le plein écran si ce n'est pas déjà le cas. Silencieux si refusé par le navigateur. */
function requestFullscreenIfNeeded() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const req = document.documentElement.requestFullscreen
    || document.documentElement.webkitRequestFullscreen;
  if (req) req.call(document.documentElement).catch(() => {});
}

// ─── Orientation paysage / portrait ───────────────────────────────────────────
async function requestLandscapeLock() {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (_) { /* Silently ignore — l'overlay sert de repli */ }
}

async function requestPortraitLock() {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock('portrait');
    }
  } catch (_) { /* Silently ignore */ }
}

function updateRotateOverlay() {
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const shouldShow = GAMEPLAY_SCREENS.has(_currentScreen) && isPortrait;
  el('rotate-overlay').classList.toggle('active', shouldShow);
  handleOrientationTimerState(shouldShow);
}

/** Pause le timer si l'overlay portrait apparaît pendant un tour actif, le reprend sinon. */
function handleOrientationTimerState(overlayVisible) {
  if (_currentScreen !== 'screen-turn') return;
  if (overlayVisible) {
    pauseTimer();
  } else if (state.timerPaused) {
    resumeTimer();
  }
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
 *   2  → [2]       (coopératif — 1 équipe de 2)
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

/** Retourne un libellé court pour une équipe : liste des joueurs. */
function teamLabel(team) {
  return team.players.join(' · ');
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

    const ul = document.createElement('ul');
    ul.className = 'team-players';
    team.players.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `👤 ${p}`;
      ul.appendChild(li);
    });

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
      // Single-player team (e.g. 2-player mode): guesser is from all other teams
      const others = state.teams
        .filter((_, idx) => idx !== state.currentTeamIdx)
        .flatMap(t => t.players);
      guesserLabel = others.length ? others.join(' · ') : teamLabel(team);
    }
  }

  const playerSpan = document.createElement('span');
  playerSpan.id = 'pre-turn-player';
  playerSpan.textContent = playerName;

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
}

// ─── TOUR ACTIF ────────────────────────────────────────────────────────────────
function startTurn() {
  state.turnFound   = [];
  state.turnSkipped = [];
  state.timeLeft    = TURN_DURATION;
  state.actionHistory = [];
  state.redoStack     = [];
  updateUndoRedoButtons();

  const rule = getCurrentRoundRule();

  // Bouton Passer (bas de la colonne centrale) — uniquement manche 3 (canFault ET canSkip)
  el('btn-skip').hidden = !(rule.canSkip && rule.canFault);

  const faultBtn     = el('btn-fault');
  const skipSideBtn  = el('btn-skip-side');

  if (rule.canFault) {
    // Manche 3 : Erreur visible à gauche, Passer en bas du centre
    faultBtn.style.visibility    = '';
    faultBtn.style.pointerEvents = '';
    skipSideBtn.style.display    = 'none';
  } else if (rule.canSkip) {
    // Manche 2 : Passer côté visible à gauche, pas de bouton Erreur
    faultBtn.style.visibility    = 'hidden';
    faultBtn.style.pointerEvents = 'none';
    skipSideBtn.style.display    = '';
  } else {
    // Manche 1 : ni Erreur ni Passer
    faultBtn.style.visibility    = 'hidden';
    faultBtn.style.pointerEvents = 'none';
    skipSideBtn.style.display    = 'none';
  }

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
  fitWordCard(); // re-fit now that screen is visible (drawNextWord ran while hidden)
}

function fitWordCard() {
  const textEl   = el('word-card-text');
  const card     = textEl.closest('.word-card');
  if (!card || !textEl.textContent.trim()) return;

  const turnArea = document.querySelector('.turn-play-area');
  const foundBtn = el('btn-found');
  const faultBtn = el('btn-fault');

  const cs     = getComputedStyle(card);
  const areaCS = getComputedStyle(turnArea);
  const gap    = parseFloat(areaCS.columnGap) || 0;

  // Compute the available width for the word by subtracting the side buttons and gaps
  // from the total play area width.  The left column always occupies a fixed slot
  // (btn-fault uses visibility:hidden so its offsetWidth equals the column width in all rounds).
  const leftColW = faultBtn.offsetWidth;
  const availW = turnArea.clientWidth
    - leftColW
    - foundBtn.offsetWidth
    - 2 * gap
    - parseFloat(cs.paddingLeft)
    - parseFloat(cs.paddingRight);
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
  updateTurnStats();
  fitWordCard();
}

function wordFound() {
  playFound();
  state.actionHistory.push({ type: 'found', word: state.currentWord });
  state.redoStack = [];
  state.turnFound.push(state.currentWord);
  state.currentWord = null;
  updateTurnStats();
  drawNextWord();
  updateUndoRedoButtons();
}

function wordSkipped() {
  state.actionHistory.push({ type: 'skipped', word: state.currentWord });
  state.redoStack = [];
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
  updateUndoRedoButtons();
}

function wordFault() {
  // Manches 2 et 3 (canFault=true) : la carte est passée définitivement pour ce tour
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

function updateUndoRedoButtons() {
  el('btn-undo').hidden = state.actionHistory.length === 0;
  el('btn-redo').hidden = state.redoStack.length === 0;
}

function undoLastAction() {
  if (state.actionHistory.length === 0) return;
  const action = state.actionHistory.pop();
  state.redoStack.push(action);
  const { type, word } = action;

  // Remettre le mot courant en tête du deck
  if (state.currentWord) {
    state.roundWords.unshift(state.currentWord);
    state.currentWord = null;
  }

  // Annuler l'action précédente et restaurer la carte
  if (type === 'found') {
    const idx = state.turnFound.lastIndexOf(word);
    if (idx !== -1) state.turnFound.splice(idx, 1);
  } else {
    // 'skipped' ou 'fault'
    const idx = state.turnSkipped.lastIndexOf(word);
    if (idx !== -1) {
      state.turnSkipped.splice(idx, 1);
    } else {
      // manche 1 (canSkip=false en pratique) : la carte avait été remise dans roundWords
      const ri = state.roundWords.lastIndexOf(word);
      if (ri !== -1) state.roundWords.splice(ri, 1);
    }
  }

  state.currentWord = word;
  const cat = getCategoryInfo(word.category);
  el('word-card-text').textContent     = word.word;
  el('word-card-category').textContent = `${cat.emoji} ${cat.label}`;
  updateTurnStats();
  fitWordCard();
  updateUndoRedoButtons();
}

function redoLastAction() {
  if (state.redoStack.length === 0) return;
  const action = state.redoStack.pop();
  state.actionHistory.push(action);
  const { type, word } = action;

  // currentWord doit être `word` à cet instant (c'est lui qui a été affiché après le dernier undo)
  if (type === 'found') {
    playFound();
    state.turnFound.push(word);
  } else {
    // 'skipped' ou 'fault'
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

function updateTurnStats() {
  el('turn-found-count').textContent    = state.turnFound.length;
  el('turn-words-left').textContent     = state.roundWords.length + (state.currentWord ? 1 : 0);
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
  state.timerPaused   = false;
}

function pauseTimer() {
  if (state.timerInterval !== null) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.timerPaused   = true;
  }
}

function resumeTimer() {
  if (state.timerPaused) {
    state.timerPaused = false;
    startTimer();
  }
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

// ─── MISE À JOUR FORCÉE ────────────────────────────────────────────────────────
async function forceUpdate() {
  showToast('🔄 Mise à jour en cours…');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (err) { console.warn('forceUpdate:', err); }
  // Flag to trigger a second reload once the new SW activates (so fresh content is served)
  sessionStorage.setItem('_timesup_update', '1');
  location.reload();
}

// ─── TUTORIEL ──────────────────────────────────────────────────────────────────

const TUTORIAL_SLIDES = [
  {
    icon: '⏱️',
    title: 'Bienvenue dans Time\'s Up !',
    html: `
      <p>Time's Up est un jeu de société en <strong>3 manches progressives</strong> où les équipes
      doivent faire deviner des mots réunionnais — les mêmes à chaque manche, mais avec des règles
      de plus en plus difficiles !</p>
      <p>Ce tutoriel vous explique chaque écran et chaque bouton du jeu. 🌋🌊</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-size:1.5rem;margin-bottom:6px">🗣️ → ☝️ → 🤐</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">Parler librement → Un seul mot → Mime</div>
      </div>
      <p>1 mot trouvé = 1 point · L'équipe avec le plus de points gagne 🏆</p>
    `,
  },
  {
    icon: '👥',
    title: 'Écran d\'accueil — Ajouter des joueurs',
    html: `
      <p>Saisissez au moins <strong>2 prénoms</strong> pour démarrer une partie.
      Le bouton 🚀 se débloque automatiquement dès que le minimum est atteint.</p>
      <div class="tuto-mock">
        <div class="tuto-mock-row">
          <span style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:0.82rem;color:var(--text-muted)">Prénom du joueur…</span>
          <span class="tuto-btn tuto-btn-action">+ Ajouter</span>
        </div>
        <div class="tuto-mock-row">
          <span style="font-size:1.1rem">👤</span>
          <span class="tuto-mock-label"><strong>Lucie</strong></span>
          <span style="font-size:0.75rem;color:var(--danger);cursor:pointer">✕</span>
        </div>
        <div class="tuto-mock-row">
          <span style="font-size:1.1rem">👤</span>
          <span class="tuto-mock-label"><strong>Maxime</strong></span>
          <span style="font-size:0.75rem;color:var(--danger);cursor:pointer">✕</span>
        </div>
      </div>
      <p>Cliquez sur <strong>✕</strong> à côté d'un prénom pour le retirer de la partie.</p>
    `,
  },
  {
    icon: '📋',
    title: 'Onglet Joueurs & Options',
    html: `
      <p>L'onglet <strong>👥 Joueurs</strong> vous permet d'enregistrer des joueurs habituels.
      Cliquez sur un nom enregistré pour l'ajouter rapidement à la partie en cours.</p>
      <div class="tuto-mock">
        <div class="tuto-mock-row" style="gap:4px">
          <span style="flex:1;background:var(--surface);border-radius:6px;padding:5px 10px;font-size:0.82rem;text-align:center;font-weight:700">⚽ Partie</span>
          <span style="flex:1;background:var(--volcan);border-radius:6px;padding:5px 10px;font-size:0.82rem;text-align:center;font-weight:700;color:#fff">👥 Joueurs</span>
        </div>
        <div class="tuto-mock-row">
          <span style="font-size:1rem">👤</span>
          <span class="tuto-mock-label"><strong>Kévin</strong> <span style="font-size:0.72rem">3 parties · 47 pts</span></span>
        </div>
      </div>
      <p>Dans les <strong>⚙️ Options</strong>, choisissez le nombre de mots à utiliser pour la
      partie (20, 30, 40, 50 ou tous les mots disponibles).</p>
    `,
  },
  {
    icon: '🎲',
    title: 'Écran — Les Équipes',
    html: `
      <p>Après avoir cliqué sur <strong>🚀 Répartir les joueurs</strong>, les équipes sont
      formées <strong>aléatoirement</strong>. Pour 2 joueurs : 1 équipe de 2 (coopératif — score commun).
      Pour 4 joueurs : 2 équipes de 2.
      Pour 6 joueurs : 3 équipes de 2, etc.</p>
      <div class="tuto-mock">
        <div class="tuto-mock-row" style="gap:10px">
          <div style="flex:1;background:rgba(232,93,4,0.15);border:1px solid var(--volcan);border-radius:8px;padding:8px;text-align:center;font-size:0.82rem">
            <div style="color:var(--volcan);font-weight:700">Équipe 🔴</div>
            <div style="color:var(--text-muted)">👤 Lucie</div>
            <div style="color:var(--text-muted)">👤 Marc</div>
          </div>
          <div style="flex:1;background:rgba(0,150,199,0.15);border:1px solid var(--lagon);border-radius:8px;padding:8px;text-align:center;font-size:0.82rem">
            <div style="color:var(--lagon);font-weight:700">Équipe 🔵</div>
            <div style="color:var(--text-muted)">👤 Sophie</div>
            <div style="color:var(--text-muted)">👤 Kévin</div>
          </div>
        </div>
        <div class="tuto-mock-row" style="justify-content:center;gap:8px;padding-top:8px">
          <span class="tuto-btn" style="background:transparent;border:1px solid var(--border);color:var(--text-muted)">🔀 Rebattre</span>
          <span class="tuto-btn tuto-btn-action">🌋 C'est parti !</span>
        </div>
      </div>
      <p>Cliquez sur <strong>🔀 Rebattre</strong> pour tirer de nouvelles équipes au hasard.</p>
    `,
  },
  {
    icon: '📖',
    title: 'Présentation de la manche',
    html: `
      <p>Avant chaque manche, un écran rappelle les <strong>règles spécifiques</strong> à
      respecter pendant les 30 secondes de chaque tour.</p>
      <div class="tuto-mock" style="text-align:center">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 14px;display:inline-block;font-size:0.78rem;color:var(--warning);font-weight:700;margin-bottom:8px">Manche 1 / 3</div>
        <div style="font-size:2rem;margin-bottom:4px">🗣️</div>
        <div style="font-weight:800;font-size:0.95rem;margin-bottom:6px">Parler librement</div>
        <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5">Les règles de la manche s'affichent ici.</div>
        <div class="tuto-btn tuto-btn-action" style="margin-top:10px;display:inline-flex">▶ Commencer la manche</div>
      </div>
      <p>Lisez les règles attentivement puis cliquez <strong>▶ Commencer la manche</strong> pour démarrer les tours.</p>
    `,
  },
  {
    icon: '📱',
    title: 'Pré-tour — Passez le téléphone',
    html: `
      <p>Au début de chaque tour, le nom de <strong>l'orateur</strong> (celui qui fait deviner)
      et des <strong>devineurs</strong> (son équipe) est affiché.</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-size:0.78rem;color:var(--text-muted)">Au tour de</div>
        <div style="font-size:1.4rem;font-weight:900;color:#ffd166">Sophie</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">qui fait deviner à</div>
        <div style="font-size:1.4rem;font-weight:900;color:#06d6a0">Marc · Lucie</div>
        <div class="tuto-btn tuto-btn-action" style="margin-top:10px;display:inline-flex">✅ Je suis prêt !</div>
      </div>
      <p>L'orateur prend le téléphone, vérifie les règles, puis clique <strong>✅ Je suis prêt !</strong>
      pour lancer le chronomètre de 30 secondes.</p>
    `,
  },
  {
    icon: '⏱️',
    title: 'Tour actif — Écran de jeu',
    html: `
      <p>L'orateur voit le mot à faire deviner. Le chronomètre de <strong>30 secondes</strong>
      tourne en haut au centre.</p>
      <div class="tuto-mock-turn">
        <div class="tuto-mock-turn-side tuto-btn-fault">🚨<br>Erreur<br><span style="font-size:0.65rem;font-weight:400">(Manche 3)</span></div>
        <div class="tuto-mock-turn-center">
          <div class="tuto-mock-timer">30</div>
          <div class="tuto-mock-word">Séga</div>
          <div style="font-size:0.7rem;color:var(--text-muted);background:var(--surface2);border-radius:99px;padding:2px 10px">🎵 Culture</div>
        </div>
        <div class="tuto-mock-turn-side tuto-btn-found">✅<br>Trouvé !<br><span style="font-size:0.65rem;font-weight:400">→ swipe</span></div>
      </div>
      <div style="display:flex;gap:6px;margin:8px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✅</span><span><strong>Trouvé !</strong> — L'équipe a trouvé le mot</span></div>
      </div>
      <div style="display:flex;gap:6px;margin:4px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⏭</span><span><strong>Passer</strong> — Mot trop difficile (manches 2 & 3)</span></div>
      </div>
      <div style="display:flex;gap:6px;margin:4px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">↩</span><span><strong>Annuler</strong> — Revient sur la dernière action</span></div>
      </div>
    `,
  },
  {
    icon: '🎮',
    title: 'Faux jeu — Repère les boutons',
    html: `
      <p>Voici l'<strong>écran de jeu</strong> avec un seul mot et le chrono figé.
      Repère chaque bouton avant de jouer :</p>
      <div class="tuto-fake-turn">
        <div class="tuto-fake-header">
          <span class="tuto-fake-round-badge">☝️ Manche 2</span>
          <span class="tuto-fake-stat">🃏 5 restant(s)</span>
          <span class="tuto-fake-stat">✅ 2 trouvé(s)</span>
          <span class="tuto-fake-undo-btn">↩ Annuler</span>
        </div>
        <div class="tuto-fake-grid">
          <div class="tuto-fake-side-btn tuto-fake-skip">
            <span style="font-size:1.1rem">⏭</span>
            <span>Passer</span>
          </div>
          <div class="tuto-fake-center-col">
            <div class="tuto-fake-timer-circle"><span>22</span></div>
            <div class="tuto-fake-word">Séga</div>
            <div class="tuto-fake-cat">🎵 Culture</div>
          </div>
          <div class="tuto-fake-side-btn tuto-fake-found">
            <span style="font-size:1.1rem">✅</span>
            <span>Trouvé !</span>
          </div>
        </div>
        <div class="tuto-fake-callouts">
          <div class="tuto-callout tuto-callout-up">⏭ <strong>Passer</strong> — trop difficile, carte remise en jeu plus tard</div>
          <div></div>
          <div class="tuto-callout tuto-callout-up">✅ <strong>Trouvé !</strong> — l'équipe a trouvé le mot</div>
        </div>
        <div class="tuto-fake-undo-callout">↩ <strong>Annuler</strong> (en haut à droite) — revient sur la dernière action (trouvé ou passé)</div>
      </div>
      <p>⏱️ En vrai, le chrono de <strong>30 s</strong> tourne — fais vite !</p>
    `,
  },
  {
    icon: '🗣️',
    title: 'Manche 1 — Parler librement',
    html: `
      <p>L'orateur peut utiliser <strong>tous les mots qu'il veut</strong> pour décrire le mot,
      sauf ceux interdits ci-dessous.</p>
      <div style="display:flex;flex-direction:column;gap:5px;margin:10px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⛔</span><span>Interdits : dire le nom, épeler, traduire directement</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✅</span><span>Les devineurs peuvent faire autant de propositions qu'ils veulent</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">🃏</span><span>Pas de bouton Passer — continuez jusqu'à la fin du temps</span></div>
      </div>
      <p>💡 <strong>Conseil :</strong> mémorisez bien les mots que vous entendez, ils reviendront
      aux manches 2 et 3 !</p>
    `,
  },
  {
    icon: '☝️',
    title: 'Manche 2 — Un seul mot',
    html: `
      <p>L'orateur ne peut dire qu'<strong>un seul mot</strong> pour chaque carte.
      L'équipe n'a droit qu'à <strong>une seule proposition</strong>.</p>
      <div style="display:flex;flex-direction:column;gap:5px;margin:10px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✅</span><span><strong>Bonne réponse</strong> → carte gagnée (cliquer Trouvé !)</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">❌</span><span><strong>Mauvaise réponse</strong> → carte perdue pour ce tour</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⏭</span><span>L'orateur doit <strong>Passer</strong> s'il est bloqué ou s'il n'a pas respecté la règle</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⛔</span><span>Interdits : plusieurs mots, partie du nom, traduction directe</span></div>
      </div>
      <p>Le bouton <strong>⏭ Passer</strong> apparaît à gauche de l'écran.</p>
    `,
  },
  {
    icon: '🤐',
    title: 'Manche 3 — Mime et bruitages',
    html: `
      <p>Plus de paroles ! L'orateur ne peut utiliser que des <strong>mimes</strong>
      et des <strong>bruitages</strong>.</p>
      <div style="display:flex;flex-direction:column;gap:5px;margin:10px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✅</span><span><strong>Bonne réponse</strong> → carte gagnée</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⏭</span><span>L'orateur doit <strong>Passer</strong> s'il est bloqué ou s'il n'a pas respecté la règle</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">🚨</span><span><strong>Erreur</strong> → l'orateur a parlé ou fredonnée — carte perdue</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⛔</span><span>Interdits : parler, former des mots, fredonner une chanson</span></div>
      </div>
      <p>En cas de faute (il parle), <strong>l'orateur</strong> doit appuyer sur <strong>🚨 Erreur</strong> pour signaler la faute.</p>
    `,
  },
  {
    icon: '📊',
    title: 'Fin de tour & Fin de manche',
    html: `
      <p>À la fin de chaque tour (temps écoulé ou tous les mots trouvés), le <strong>récapitulatif</strong>
      s'affiche : nombre de mots trouvés ce tour et nombre restant dans la manche.</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-size:1.2rem;margin-bottom:4px">⏱️ Temps écoulé !</div>
        <div style="font-size:2.5rem;font-weight:900;color:var(--success);line-height:1">4</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">mot(s) ce tour · 12 restant(s)</div>
      </div>
      <p>Quand tous les mots d'une manche sont trouvés, le <strong>tableau des scores</strong>
      s'affiche avec les points de chaque équipe. Les points sont cumulés sur les 3 manches.</p>
      <div class="tuto-mock">
        <div class="tuto-mock-row">
          <span class="tuto-mock-label" style="color:var(--volcan);font-weight:700">Équipe 🔴 (Sophie · Marc)</span>
          <span style="font-weight:700">6</span>
          <span style="font-weight:700;color:var(--warning);margin-left:10px">6 pts</span>
        </div>
        <div class="tuto-mock-row">
          <span class="tuto-mock-label" style="color:var(--lagon);font-weight:700">Équipe 🔵 (Lucie · Kévin)</span>
          <span style="font-weight:700">4</span>
          <span style="font-weight:700;color:var(--warning);margin-left:10px">4 pts</span>
        </div>
      </div>
    `,
  },
  {
    icon: '🎉',
    title: 'Fin de partie — Résultats finaux',
    html: `
      <p>Après les <strong>3 manches</strong>, le classement final s'affiche avec le total
      de points de chaque équipe.</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-size:2rem;margin-bottom:6px">🎉</div>
        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:6px">Vainqueur</div>
        <div style="font-size:1.4rem;font-weight:900;color:var(--volcan);margin-bottom:10px">Sophie · Marc</div>
        <div style="display:flex;flex-direction:column;gap:5px;font-size:0.85rem">
          <div style="background:var(--surface);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px">
            <span style="font-size:1.1rem">🥇</span>
            <span style="font-weight:700;color:var(--volcan);flex:1;text-align:left">Sophie · Marc</span>
            <span style="color:var(--warning);font-weight:700">18 pts</span>
          </div>
          <div style="background:var(--surface);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px">
            <span style="font-size:1.1rem">🥈</span>
            <span style="font-weight:700;color:var(--lagon);flex:1;text-align:left">Lucie · Kévin</span>
            <span style="color:var(--warning);font-weight:700">14 pts</span>
          </div>
        </div>
      </div>
      <p>Cliquez <strong>🔄 Rejouer</strong> pour relancer une nouvelle partie avec les mêmes joueurs. Bonne chance ! 🌋</p>
    `,
  },
];

let _tutorialCurrentSlide = 0;

function openTutorial(startSlide = 0) {
  _tutorialCurrentSlide = startSlide;
  renderTutorialSlide();
  el('tutorial-overlay').hidden = false;
  el('tutorial-close').focus();
}

function closeTutorial() {
  el('tutorial-overlay').hidden = true;
}

function renderTutorialSlide() {
  const total   = TUTORIAL_SLIDES.length;
  const slide   = TUTORIAL_SLIDES[_tutorialCurrentSlide];
  const content = el('tutorial-slide-content');

  content.innerHTML = `
    <div class="tuto-slide-icon">${slide.icon}</div>
    <div class="tuto-slide-title">${slide.title}</div>
    <div class="tuto-slide-body">${slide.html}</div>
  `;

  // Dots
  const dotsEl = el('tutorial-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = `tutorial-dot${i === _tutorialCurrentSlide ? ' active' : ''}`;
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Diapositive ${i + 1}`);
    if (i === _tutorialCurrentSlide) {
      dot.setAttribute('aria-current', 'true');
      dot.setAttribute('aria-selected', 'true');
    } else {
      dot.removeAttribute('aria-current');
      dot.setAttribute('aria-selected', 'false');
    }
    dot.addEventListener('click', () => {
      _tutorialCurrentSlide = i;
      renderTutorialSlide();
    });
    dotsEl.appendChild(dot);
  }

  // Prev / Next buttons
  el('tutorial-prev').disabled = _tutorialCurrentSlide === 0;
  const nextBtn = el('tutorial-next');
  if (_tutorialCurrentSlide === total - 1) {
    nextBtn.textContent = '✅ Fermer';
  } else {
    nextBtn.textContent = 'Suivant ›';
  }

  // Scroll slide content to top on navigation
  content.scrollTop = 0;
}

function tutorialNext() {
  if (_tutorialCurrentSlide < TUTORIAL_SLIDES.length - 1) {
    _tutorialCurrentSlide++;
    renderTutorialSlide();
  } else {
    closeTutorial();
  }
}

function tutorialPrev() {
  if (_tutorialCurrentSlide > 0) {
    _tutorialCurrentSlide--;
    renderTutorialSlide();
  }
}


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
  const versionEl = document.getElementById('timesup-version');
  if (versionEl) {
    const buildDate = getMatch3BuildDate();
    const dateLabel = buildDate
      ? ` · ${new Date(buildDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
      : '';
    versionEl.textContent = `v${getMatch3Version()}${dateLabel}`;
  }

  // ── Setup ──
  el('tab-btn-partie').addEventListener('click', withCooldown(() => switchSetupTab('partie')));
  el('tab-btn-membres').addEventListener('click', withCooldown(() => switchSetupTab('membres')));
  el('btn-add-player').addEventListener('click', withCooldown(addPlayer));
  el('player-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPlayer();
  });
  el('btn-start-game').addEventListener('click', withCooldown(() => {
    if (state.playerNames.length >= MIN_PLAYERS) goToTeams();
  }));

  // ── Joueurs (membres persistants) ──
  el('btn-add-member').addEventListener('click', withCooldown(addMember));
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
  el('btn-reshuffle').addEventListener('click', withCooldown(() => {
    assignTeams();
    renderTeams();
  }));
  el('btn-launch-game').addEventListener('click', withCooldown(() => {
    startRound(1);
  }));

  // ── Round intro ──
  el('btn-round-go').addEventListener('click', withCooldown(() => {
    state.currentTeamIdx = 0;
    startPreTurn();
  }));

  // ── Pre-turn ──
  el('btn-ready').addEventListener('click', withCooldown(startTurn));

  // ── Turn ──
  el('btn-found').addEventListener('click', withCooldown(wordFound));
  el('btn-skip').addEventListener('click', withCooldown(wordSkipped));
  el('btn-skip-side').addEventListener('click', withCooldown(wordSkipped));
  el('btn-fault').addEventListener('click', withCooldown(wordFault));
  el('btn-undo').addEventListener('click', withCooldown(undoLastAction));
  el('btn-redo').addEventListener('click', withCooldown(redoLastAction));

  // ── Turn end ──
  el('btn-next-turn').addEventListener('click', withCooldown(handleNextTurn));

  // ── Round end ──
  el('btn-next-round').addEventListener('click', withCooldown(() => {
    startRound(state.currentRound + 1);
  }));
  el('btn-final-results').addEventListener('click', withCooldown(showGameOver));

  // ── Game over ──
  el('btn-replay').addEventListener('click', withCooldown(() => {
    state.teams          = [];
    state.teamPlayerIdx  = [];
    state.allWords       = [];
    state.roundWords     = [];
    state.currentRound   = 0;
    state.noTeamsMode    = false;
    renderPlayerList();
    showScreen('screen-setup');
  }));

  // ── Mute toggle ──
  el('btn-mute').addEventListener('click', withCooldown(() => {
    setMuted(!getMuted());
    el('btn-mute').textContent = getMuted() ? '🔇' : '🔊';
  }));

  // ── Words editor ──
  el('btn-edit-words').addEventListener('click', withCooldown(openWordsEditor));
  el('btn-force-update').addEventListener('click', withCooldown(forceUpdate));
  el('btn-words-back').addEventListener('click', withCooldown(() => showScreen('screen-setup')));
  el('btn-word-add').addEventListener('click', withCooldown(addWord));
  el('word-new-text').addEventListener('keydown', e => { if (e.key === 'Enter') addWord(); });
  el('btn-words-export').addEventListener('click', withCooldown(exportWords));
  el('input-words-import').addEventListener('change', e => {
    importWords(e.target.files[0]);
    e.target.value = '';
  });
  el('btn-words-reset').addEventListener('click', withCooldown(handleResetWords));

  // ── Tutoriel ──
  el('btn-tutorial').addEventListener('click', withCooldown(() => openTutorial(0)));
  el('tutorial-close').addEventListener('click', withCooldown(closeTutorial));
  el('tutorial-prev').addEventListener('click', withCooldown(tutorialPrev));
  el('tutorial-next').addEventListener('click', withCooldown(tutorialNext));
  el('tutorial-overlay').addEventListener('click', (e) => {
    if (e.target === el('tutorial-overlay')) closeTutorial();
  });
  el('tutorial-overlay').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTutorial();
    else if (e.key === 'ArrowRight') { e.preventDefault(); tutorialNext(); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); tutorialPrev(); }
  });

  // ── Re-fit word on resize / orientation change ──
  window.addEventListener('resize', () => {
    if (!el('screen-turn').hidden) fitWordCard();
    updateRotateOverlay();
  });
  window.addEventListener('orientationchange', updateRotateOverlay);

  // ── Fullscreen ──
  el('btn-fullscreen').addEventListener('click', withCooldown(toggleFullscreen));
  document.addEventListener('fullscreenchange', updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

  // ── Swipe support on turn screen ──
  initSwipe();

  renderPlayerList();
  showScreen('screen-setup');
}

document.addEventListener('DOMContentLoaded', init);

// After a force update, reload a second time once the new SW has activated and
// cached fresh assets, so the user sees the updated version immediately.
if ('serviceWorker' in navigator && sessionStorage.getItem('_timesup_update')) {
  sessionStorage.removeItem('_timesup_update');
  if (navigator.serviceWorker.controller) {
    location.reload();
  } else {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}


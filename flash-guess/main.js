/**
 * main.js — Flash Guess
 *
 * Jeu 100 % local, les joueurs se passent le téléphone.
 * Flux : setup → categories → teams → round-intro → pre-turn → turn → turn-end → round-end → game-over
 */

import {
  getShuffledWords, getCategoryInfo, shuffle,
  CATEGORY_LABELS, DEFAULT_WORDS, loadWords, saveWords, resetWords,
} from './words.js';
import {
  playTick, playTickUrgent, playBuzzer,
  playFound, playRoundStart, playGameOver, playButtonClick,
  playSkip, playFault, playUndo, playRedo, playGameStart,
  setMuted, getMuted,
} from './sound.js';

// ─── Constantes ────────────────────────────────────────────────────────────────
const TURN_DURATION              = 30;
const TIMER_CIRCLE_RADIUS        = 46;
const MIN_PLAYERS                = 2;
const CARD_COUNT_DEFAULT         = 40;
const CARD_COUNT_KEY             = 'flashguess_card_count';
const SELECTED_CATS_KEY          = 'flashguess_selected_cats';
const KIDS_MODE_KEY              = 'flashguess_kids_mode';
const WORD_CARD_HORIZONTAL_PAD   = 32;
const WORD_FONT_MIN              = 16;
const WORD_FONT_MAX              = 200;

const GAMEPLAY_SCREENS = new Set([
  'screen-round-intro',
  'screen-pre-turn',
  'screen-turn',
  'screen-turn-end',
  'screen-round-end',
  'screen-game-over',
]);

const CLICK_COOLDOWN = 500;

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

const TEAMS_META = [
  { color: 'var(--volcan)' },
  { color: 'var(--lagon)'  },
  { color: 'var(--foret)'  },
  { color: 'var(--soleil)' },
];

// ─── Cooldown boutons ──────────────────────────────────────────────────────────
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

// ─── Persistance des catégories sélectionnées ─────────────────────────────────
function loadSelectedCategories() {
  try {
    const raw = localStorage.getItem(SELECTED_CATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const allKeys = Object.keys(CATEGORY_LABELS);
        const valid = parsed.filter(k => allKeys.includes(k));
        if (valid.length > 0) return valid;
      }
    }
  } catch (_) { /* ignore */ }
  // Par défaut : toutes les catégories
  return Object.keys(CATEGORY_LABELS);
}

function saveSelectedCategories(cats) {
  try { localStorage.setItem(SELECTED_CATS_KEY, JSON.stringify(cats)); } catch (_) { /* ignore */ }
}

// ─── Persistance du mode enfant ───────────────────────────────────────────────
function loadKidsMode() {
  try { return localStorage.getItem(KIDS_MODE_KEY) === '1'; } catch (_) { return false; }
}

function saveKidsMode(v) {
  try { localStorage.setItem(KIDS_MODE_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ }
}

// ─── État du jeu ───────────────────────────────────────────────────────────────
const state = {
  playerNames:         [],
  playerIsChild:       new Set(), // noms des joueurs enfants (-12 ans)
  teams:               [],
  teamPlayerIdx:       [],
  noTeamsMode:         false,

  selectedCategories:  [],    // catégories choisies pour cette partie
  kidsMode:            false, // mode enfant : uniquement les mots adaptés -12 ans
  kidsModeManual:      false, // activation manuelle du mode enfant (sans enfant dans la partie)

  allWords:            [],
  roundWords:          [],
  currentRound:        0,
  currentTeamIdx:      0,

  turnFound:           [],
  turnSkipped:         [],
  currentWord:         null,
  actionHistory:       [],
  redoStack:           [],

  timerInterval:       null,
  timeLeft:            TURN_DURATION,
  timerPaused:         false,

  cardCount:           CARD_COUNT_DEFAULT,
};

// ─── Helpers UI ────────────────────────────────────────────────────────────────
let _currentScreen = 'screen-setup';

function showScreen(id) {
  _currentScreen = id;
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  document.getElementById(id).hidden = false;
  const versionEl = document.getElementById('flashguess-version');
  if (versionEl) versionEl.hidden = (id !== 'screen-setup');
  if (GAMEPLAY_SCREENS.has(id)) {
    requestLandscapeLock();
    requestFullscreenIfNeeded();
  } else {
    requestPortraitLock();
  }
  updateRotateOverlay();
}

function requestFullscreenIfNeeded() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const req = document.documentElement.requestFullscreen
    || document.documentElement.webkitRequestFullscreen;
  if (req) req.call(document.documentElement).catch(() => {});
}

async function requestLandscapeLock() {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (_) { /* Silently ignore */ }
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
  el('rotate-overlay').classList.toggle('active', shouldShow || (_demoWaiting && isPortrait));
  handleOrientationTimerState(shouldShow);

  if (_demoWaiting && !isPortrait) {
    _demoWaiting = false;
    _demoMode = true;
    startPreTurn();
  }
}

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

    item.appendChild(nameSpan);

    if (state.playerIsChild.has(name)) {
      const badge = document.createElement('span');
      badge.className = 'player-item-child-badge';
      badge.textContent = '👶 Enfant';
      item.appendChild(badge);
    }

    const btn = document.createElement('button');
    btn.className = 'btn-icon btn-danger';
    btn.setAttribute('aria-label', `Supprimer ${name}`);
    btn.textContent = '✕';
    btn.addEventListener('click', () => removePlayer(i));

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

  updateKidsModeStatus();
}

function addPlayer() {
  const input = el('player-input');
  const name = input.value.trim();
  if (!name) { showToast('Entrez un prénom', 'warn'); return; }
  if (state.playerNames.includes(name)) { showToast('Ce joueur existe déjà', 'warn'); return; }
  if (state.playerNames.length >= 20) { showToast('Maximum 20 joueurs', 'warn'); return; }
  const isChild = el('player-is-child').checked;
  state.playerNames.push(name);
  if (isChild) state.playerIsChild.add(name);
  el('player-is-child').checked = false;
  input.value = '';
  input.focus();
  renderPlayerList();
}

function removePlayer(idx) {
  const name = state.playerNames[idx];
  state.playerIsChild.delete(name);
  state.playerNames.splice(idx, 1);
  renderPlayerList();
}

// ─── MODE ENFANT — statut et toggle ────────────────────────────────────────────
function hasChildInGame() {
  return state.playerNames.some(n => state.playerIsChild.has(n));
}

function updateKidsModeStatus() {
  const forced = hasChildInGame();
  state.kidsMode = forced || state.kidsModeManual;

  const btn = el('toggle-kids-mode');
  const autoTag = el('kids-mode-auto-tag');
  if (!btn) return;

  if (forced) {
    btn.textContent = 'ON';
    btn.className = 'kids-mode-toggle-btn kids-mode-toggle-btn--forced';
    btn.setAttribute('aria-checked', 'true');
    btn.disabled = true;
    if (autoTag) autoTag.hidden = false;
  } else {
    btn.textContent = state.kidsModeManual ? 'ON' : 'OFF';
    btn.className = `kids-mode-toggle-btn${state.kidsModeManual ? ' kids-mode-toggle-btn--on' : ''}`;
    btn.setAttribute('aria-checked', String(state.kidsModeManual));
    btn.disabled = false;
    if (autoTag) autoTag.hidden = true;
  }
}

function toggleKidsMode() {
  if (hasChildInGame()) return; // forced — cannot toggle
  state.kidsModeManual = !state.kidsModeManual;
  saveKidsMode(state.kidsModeManual);
  updateKidsModeStatus();
}

// ─── ORATEUR ENFANT — pause lecture ────────────────────────────────────────────
function isCurrentOrateurChild() {
  if (!state.teams.length) return false;
  const team = state.teams[state.currentTeamIdx];
  if (!team) return false;
  const playerName = team.players[state.teamPlayerIdx[state.currentTeamIdx]];
  return state.playerIsChild.has(playerName);
}

let _childReadFirstWord = false; // true si on attend le premier mot du tour

function showChildReadBtn(visible) {
  const btn = el('btn-child-read');
  const foundBtn = el('btn-found');
  const passBtn  = el('btn-pass');
  if (!btn) return;
  btn.hidden = !visible;
  if (foundBtn) foundBtn.disabled = visible;
  if (passBtn)  passBtn.disabled  = visible;
}

function childConfirmedRead() {
  showChildReadBtn(false);
  if (_childReadFirstWord) {
    _childReadFirstWord = false;
    startTimer();
  } else {
    resumeTimer();
  }
}

// ─── ÉCRAN CATEGORIES ─────────────────────────────────────────────────────────
/**
 * Calcule le nombre de mots disponibles par catégorie (selon la liste actuelle).
 */
function getWordCountsByCategory() {
  const words = loadWords();
  const counts = {};
  words.forEach(w => { counts[w.category] = (counts[w.category] || 0) + 1; });
  return counts;
}

function openCategorySelect() {
  // Charger les catégories précédemment sélectionnées (ou toutes par défaut)
  if (state.selectedCategories.length === 0) {
    state.selectedCategories = loadSelectedCategories();
  }
  renderCategories();
  showScreen('screen-categories');
}

function renderCategories() {
  const grid = el('categories-grid');
  grid.innerHTML = '';
  const counts = getWordCountsByCategory();

  Object.entries(CATEGORY_LABELS).forEach(([key, { label, emoji }]) => {
    const isSelected = state.selectedCategories.includes(key);
    const wordCount  = counts[key] || 0;

    const card = document.createElement('div');
    card.className = `cat-toggle${isSelected ? ' cat-toggle--selected' : ''}`;
    card.dataset.key = key;
    card.setAttribute('role', 'checkbox');
    card.setAttribute('aria-checked', String(isSelected));
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <span class="cat-toggle__emoji">${emoji}</span>
      <span class="cat-toggle__label">${label}</span>
      <span class="cat-toggle__count">${wordCount} mot${wordCount !== 1 ? 's' : ''}</span>
    `;

    card.addEventListener('click', () => toggleCategory(key));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(key); }
    });

    grid.appendChild(card);
  });

  updateCatConfirmBtn();
}

function toggleCategory(key) {
  const idx = state.selectedCategories.indexOf(key);
  if (idx === -1) {
    state.selectedCategories.push(key);
  } else {
    state.selectedCategories.splice(idx, 1);
  }
  // Mettre à jour l'apparence de la carte
  const card = document.querySelector(`[data-key="${key}"]`);
  if (card) {
    const isNowSelected = state.selectedCategories.includes(key);
    card.classList.toggle('cat-toggle--selected', isNowSelected);
    card.setAttribute('aria-checked', String(isNowSelected));
  }
  updateCatConfirmBtn();
}

function selectAllCategories() {
  state.selectedCategories = Object.keys(CATEGORY_LABELS);
  renderCategories();
}

function deselectAllCategories() {
  state.selectedCategories = [];
  renderCategories();
}

function updateCatConfirmBtn() {
  const hasSelection = state.selectedCategories.length > 0;
  el('btn-cats-confirm').disabled = !hasSelection;
  el('cats-hint').hidden = hasSelection;
}

function confirmCategories() {
  if (state.selectedCategories.length === 0) {
    showToast('Sélectionnez au moins une catégorie', 'warn');
    return;
  }
  saveSelectedCategories(state.selectedCategories);
  assignTeams();
  renderTeams();
  showScreen('screen-teams');
}

// ─── COMPOSITION DES ÉQUIPES ───────────────────────────────────────────────────
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

// ─── LOGIQUE DE MANCHE ─────────────────────────────────────────────────────────
function startRound(roundNum) {
  state.currentRound = roundNum;
  if (roundNum === 1) {
    const words = getShuffledWords(state.selectedCategories.length > 0 ? state.selectedCategories : null, state.kidsMode);
    const count = state.cardCount === 0 ? words.length : Math.min(state.cardCount, words.length);
    state.allWords = words.slice(0, count);
    if (state.allWords.length === 0) {
      showToast('Aucun mot dans les catégories sélectionnées !', 'error');
      showScreen('screen-categories');
      return;
    }
  }
  state.roundWords   = shuffle([...state.allWords]);
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
  if (_demoMode) showDemoTips('pre-turn');
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
  const passBtn = el('btn-pass');

  if (rule.canFault) {
    passBtn.style.visibility    = '';
    passBtn.style.pointerEvents = '';
    passBtn.className = 'btn-fault-turn btn-turn-side';
    passBtn.setAttribute('aria-label', 'Erreur — arrêter le tour');
    passBtn.innerHTML = '<span aria-hidden="true">🚨</span><span>Erreur / Passer</span>';
  } else if (rule.canSkip) {
    passBtn.style.visibility    = '';
    passBtn.style.pointerEvents = '';
    passBtn.className = 'btn-skip-side-turn btn-turn-side';
    passBtn.setAttribute('aria-label', 'Passer cette carte');
    passBtn.innerHTML = '<span aria-hidden="true">⏭</span><span>Passer</span>';
  } else {
    passBtn.style.visibility    = 'hidden';
    passBtn.style.pointerEvents = 'none';
  }

  updateTurnStats();
  drawNextWord();

  if (_demoMode) {
    const circ = 2 * Math.PI * TIMER_CIRCLE_RADIUS;
    const ring = el('timer-ring-progress');
    el('timer-number').textContent = '∞';
    el('timer-number').style.color = 'var(--text)';
    ring.style.strokeDasharray = `${circ}`;
    ring.style.strokeDashoffset = '0';
    ring.style.stroke = 'var(--success)';
  } else {
    updateTimerDisplay();
    startTimer();
  }

  showScreen('screen-turn');
  fitWordCard();
  if (_demoMode) showDemoTips(state.currentRound);
}

function fitWordCard() {
  const textEl   = el('word-card-text');
  const card     = textEl.closest('.word-card');
  if (!card || !textEl.textContent.trim()) return;

  const turnArea = document.querySelector('.turn-play-area');
  const foundBtn = el('btn-found');
  const passBtn  = el('btn-pass');

  const cs     = getComputedStyle(card);
  const areaCS = getComputedStyle(turnArea);
  const gap    = parseFloat(areaCS.columnGap) || 0;

  const leftColW = passBtn.offsetWidth;
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

function drawNextWord() {
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

function wordFault() {
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

function updateUndoRedoButtons() {
  el('btn-undo').hidden = state.actionHistory.length === 0;
  el('btn-redo').hidden = state.redoStack.length === 0;
}

function undoLastAction() {
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

function redoLastAction() {
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
function endTurn(reason = 'timeout') {
  stopTimer();

  if (_demoMode) {
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
    if (state.turnFound.length > 0) showDemoTurnEndTips();
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
function openCorrectTurn() {
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

function closeCorrectTurn() {
  el('correct-turn-overlay').hidden = true;
}

function applyTurnCorrection() {
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
  _demoMode = false;
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
let _activeWordsCategory = 'all'; // 'all' ou une clé de catégorie

function filterValidWords(arr) {
  return arr
    .filter(w => w && typeof w.word === 'string' && w.word.trim() &&
                 typeof w.category === 'string' && w.category.trim())
    .map(w => ({
      word: w.word.trim(),
      category: w.category.trim(),
      ...(w.kidFriendly === true ? { kidFriendly: true } : {}),
    }));
}

function openWordsEditor() {
  editableWords = loadWords();
  _activeWordsCategory = 'all';
  renderWordsCatTabs();
  renderWordsList();
  showScreen('screen-words');
}

function renderWordsCatTabs() {
  const tabsEl = el('words-cat-tabs');
  tabsEl.innerHTML = '';

  // Onglet "Toutes"
  const allTab = document.createElement('button');
  allTab.className = `words-cat-tab${_activeWordsCategory === 'all' ? ' words-cat-tab--active' : ''}`;
  allTab.textContent = `🗂️ Toutes (${editableWords.length})`;
  allTab.addEventListener('click', () => { _activeWordsCategory = 'all'; renderWordsCatTabs(); renderWordsList(); });
  tabsEl.appendChild(allTab);

  // Un onglet par catégorie
  const counts = {};
  editableWords.forEach(w => { counts[w.category] = (counts[w.category] || 0) + 1; });

  Object.entries(CATEGORY_LABELS).forEach(([key, { label, emoji }]) => {
    const n = counts[key] || 0;
    const tab = document.createElement('button');
    tab.className = `words-cat-tab${_activeWordsCategory === key ? ' words-cat-tab--active' : ''}`;
    tab.textContent = `${emoji} ${label} (${n})`;
    tab.addEventListener('click', () => {
      _activeWordsCategory = key;
      // Synchroniser le sélecteur d'ajout avec la catégorie active
      el('word-new-category').value = key;
      renderWordsCatTabs();
      renderWordsList();
    });
    tabsEl.appendChild(tab);
  });
}

function renderWordsList() {
  const list = el('words-list');
  list.innerHTML = '';

  const filtered = _activeWordsCategory === 'all'
    ? editableWords
    : editableWords.filter(w => w.category === _activeWordsCategory);

  const catInfo = _activeWordsCategory === 'all'
    ? null
    : CATEGORY_LABELS[_activeWordsCategory];

  el('words-count-info').textContent =
    `${editableWords.length} mot${editableWords.length !== 1 ? 's' : ''} dans le jeu`;

  el('words-list-title').textContent = catInfo
    ? `📋 ${catInfo.emoji} ${catInfo.label} — ${filtered.length} mot${filtered.length !== 1 ? 's' : ''}`
    : `📋 Tous les mots — ${filtered.length}`;

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-muted);font-size:0.9rem;text-align:center;padding:12px 0;';
    empty.textContent = 'Aucun mot dans cette catégorie. Ajoutez-en ci-dessus !';
    list.appendChild(empty);
    return;
  }

  filtered.forEach((entry) => {
    // On retrouve l'index réel dans editableWords pour la suppression
    const realIdx = editableWords.indexOf(entry);
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

    const kidBtn = document.createElement('button');
    kidBtn.className = `btn-icon word-edit-kid-btn${entry.kidFriendly ? ' word-edit-kid-btn--on' : ''}`;
    kidBtn.title = entry.kidFriendly ? 'Adapté -12 ans (cliquer pour retirer)' : 'Marquer comme adapté -12 ans';
    kidBtn.setAttribute('aria-label', entry.kidFriendly ? 'Retirer le marquage -12 ans' : 'Marquer comme -12 ans');
    kidBtn.textContent = '👶';
    kidBtn.addEventListener('click', () => toggleKidFriendly(realIdx));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-danger';
    delBtn.setAttribute('aria-label', `Supprimer ${entry.word}`);
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => deleteWord(realIdx));

    row.appendChild(info);
    row.appendChild(kidBtn);
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
  const category = catSelect.value;
  editableWords.push({ word, category });
  saveWords(editableWords);
  // Activer l'onglet de la catégorie ajoutée
  _activeWordsCategory = category;
  textInput.value = '';
  textInput.focus();
  renderWordsCatTabs();
  renderWordsList();
  showToast(`"${word}" ajouté ✅`);
}

function deleteWord(idx) {
  const deleted = editableWords[idx];
  editableWords.splice(idx, 1);
  saveWords(editableWords);
  renderWordsCatTabs();
  renderWordsList();
  showToast(`"${deleted.word}" supprimé`);
}

function toggleKidFriendly(idx) {
  const entry = editableWords[idx];
  if (!entry) return;
  if (entry.kidFriendly) {
    delete entry.kidFriendly;
  } else {
    entry.kidFriendly = true;
  }
  saveWords(editableWords);
  renderWordsList();
}

function exportWords() {
  const json = JSON.stringify(editableWords, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'flashguess-mots.json';
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
      renderWordsCatTabs();
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
  _activeWordsCategory = 'all';
  renderWordsCatTabs();
  renderWordsList();
  showToast('Mots remis par défaut ✅');
}

// ─── MEMBRES (historique des joueurs) ─────────────────────────────────────────
const MEMBERS_KEY = 'flashguess-members';

function loadMembers() {
  try { return JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]'); } catch { return []; }
}

function saveMembers(members) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

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
  sessionStorage.setItem('_flashguess_update', '1');
  location.reload();
}

// ─── INSTALLATION PWA ──────────────────────────────────────────────────────────
let _pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaInstallPrompt = e;
  const btn = document.getElementById('btn-install-pwa');
  if (btn) btn.hidden = false;
});

window.addEventListener('appinstalled', () => {
  _pwaInstallPrompt = null;
  const btn = document.getElementById('btn-install-pwa');
  if (btn) btn.hidden = true;
});

async function installPwa() {
  if (!_pwaInstallPrompt) return;
  _pwaInstallPrompt.prompt();
  const { outcome } = await _pwaInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    _pwaInstallPrompt = null;
    const btn = document.getElementById('btn-install-pwa');
    if (btn) btn.hidden = true;
  }
}

// ─── DÉMO ──────────────────────────────────────────────────────────────────────
let _demoMode    = false;
let _demoWaiting = false;

const DEMO_TIPS = {
  'pre-turn': [
    { targetId: 'btn-ready', text: '✅ « Je suis prêt ! » — Passe le téléphone à l\'orateur, puis appuie ici quand tout le monde est prêt à jouer.' },
  ],
  1: [
    { targetId: 'timer-number',   text: '⏱️ Le chrono ! En vraie partie il compte 30 secondes. Ici il est infini pour que tu puisses explorer sans pression.' },
    { targetId: 'word-card-text', text: '🃏 Le mot à faire deviner ! Décris-le librement — interdit de le dire, l\'épeler ou le traduire.' },
    { targetId: 'btn-found',      text: '✅ Trouvé ! Appuie ici quand ton équipe trouve le mot.' },
  ],
  2: [
    { targetId: 'btn-pass', text: '⏭ Nouveau en manche 2 ! Si tu es bloqué, passe la carte : elle reviendra pour un autre tour.' },
  ],
  3: [
    { targetId: 'btn-pass', text: '🚨 En manche 3, ce bouton s\'appelle Erreur / Passer. Appuie si l\'orateur a parlé OU s\'il souhaite passer.' },
  ],
};

let _demoTipIdx = 0;

const DEMO_TIPS_TURN_END = [
  { targetId: 'btn-correct-turn', text: '✏️ Corriger le tour — Une faute non signalée ? Appuie ici pour décocher les mots concernés.' },
];

function showDemoTurnEndTips() {
  _demoTipIdx = 0;
  _showDemoTip(DEMO_TIPS_TURN_END);
}

function showDemoTips(round) {
  const tips = DEMO_TIPS[round];
  if (!tips || tips.length === 0) return;
  _demoTipIdx = 0;
  _showDemoTip(tips);
}

function _showDemoTip(tips) {
  const tip     = tips[_demoTipIdx];
  const overlay = el('demo-tooltip-overlay');
  const ring    = el('demo-highlight-ring');
  const textEl  = el('demo-tooltip-text');
  const panel   = el('demo-tooltip-panel');

  textEl.textContent = tip.text;

  const target = tip.targetId ? document.getElementById(tip.targetId) : null;
  if (target) {
    const rect = target.getBoundingClientRect();
    const pad  = 8;
    ring.style.top    = (rect.top    - pad) + 'px';
    ring.style.left   = (rect.left   - pad) + 'px';
    ring.style.width  = (rect.width  + pad * 2) + 'px';
    ring.style.height = (rect.height + pad * 2) + 'px';
    ring.hidden = false;

    const panelW = Math.min(280, window.innerWidth - 32);
    const panelH = 130;
    const gap    = 14;
    let top  = rect.bottom + gap;
    if (top + panelH > window.innerHeight - 10) top = rect.top - panelH - gap;
    if (top < 10) top = 10;
    let left = rect.left + rect.width / 2 - panelW / 2;
    if (left < 10) left = 10;
    if (left + panelW > window.innerWidth - 10) left = window.innerWidth - panelW - 10;
    panel.style.top       = top + 'px';
    panel.style.left      = left + 'px';
    panel.style.transform = '';
  } else {
    ring.hidden = true;
    panel.style.top       = '50%';
    panel.style.left      = '50%';
    panel.style.transform = 'translate(-50%,-50%)';
  }

  overlay.hidden = false;

  el('demo-tooltip-ok').onclick = () => {
    _demoTipIdx++;
    if (_demoTipIdx < tips.length) {
      _showDemoTip(tips);
    } else {
      overlay.hidden = true;
    }
  };
}

function startDemoTurn() {
  state.currentRound    = 1;
  state.currentTeamIdx  = 0;
  state.teamPlayerIdx   = [0];
  state.noTeamsMode     = false;
  state.teams           = [{
    color: 'var(--volcan)',
    players: ['Vous'],
    score: [0, 0, 0],
  }];
  state.actionHistory = [];
  state.redoStack     = [];

  const words    = getShuffledWords(null, state.kidsMode);
  const demoWord = words[0];
  state.allWords  = [demoWord];
  state.roundWords = [demoWord];
  state.currentWord = null;

  if (window.matchMedia('(orientation: portrait)').matches) {
    _demoWaiting = true;
    el('rotate-overlay').classList.add('active');
    return;
  }

  _demoMode = true;
  startPreTurn();
}

// ─── Fullscreen ────────────────────────────────────────────────────────────────
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

// ─── INIT ──────────────────────────────────────────────────────────────────────
function init() {
  // ── Setup ──
  el('tab-btn-partie').addEventListener('click', withCooldown(() => switchSetupTab('partie')));
  el('tab-btn-membres').addEventListener('click', withCooldown(() => switchSetupTab('membres')));
  el('btn-add-player').addEventListener('click', withCooldown(addPlayer));
  el('player-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });
  el('btn-start-game').addEventListener('click', withCooldown(() => {
    if (state.playerNames.length >= MIN_PLAYERS) openCategorySelect();
  }));

  // ── Membres persistants ──
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

  // ── Categories ──
  el('btn-categories-back').addEventListener('click', withCooldown(() => showScreen('screen-setup')));
  el('btn-cats-all').addEventListener('click', withCooldown(selectAllCategories));
  el('btn-cats-none').addEventListener('click', withCooldown(deselectAllCategories));
  el('btn-cats-confirm').addEventListener('click', withCooldown(confirmCategories));

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
    playButtonClick();
    state.currentTeamIdx = 0;
    startPreTurn();
  }));

  // ── Pre-turn ──
  el('btn-ready').addEventListener('click', withCooldown(() => {
    playButtonClick();
    startTurn();
  }));

  // ── Turn ──
  el('btn-found').addEventListener('click', withCooldown(wordFound));
  el('btn-pass').addEventListener('click', withCooldown(() => {
    if (getCurrentRoundRule().canFault) wordFault();
    else wordSkipped();
  }));
  el('btn-undo').addEventListener('click', withCooldown(undoLastAction));
  el('btn-redo').addEventListener('click', withCooldown(redoLastAction));

  // ── Turn end ──
  el('btn-correct-turn').addEventListener('click', withCooldown(openCorrectTurn));
  el('correct-turn-close').addEventListener('click', withCooldown(closeCorrectTurn));
  el('correct-turn-confirm').addEventListener('click', withCooldown(applyTurnCorrection));
  el('correct-turn-overlay').addEventListener('click', (e) => {
    if (e.target === el('correct-turn-overlay')) closeCorrectTurn();
  });
  el('btn-next-turn').addEventListener('click', withCooldown(() => {
    playButtonClick();
    handleNextTurn();
  }));

  // ── Round end ──
  el('btn-next-round').addEventListener('click', withCooldown(() => {
    playButtonClick();
    if (_demoMode) {
      state.currentRound++;
      state.roundWords  = [...state.allWords];
      state.currentWord = null;
      startTurn();
    } else {
      startRound(state.currentRound + 1);
    }
  }));
  el('btn-final-results').addEventListener('click', withCooldown(() => {
    playButtonClick();
    showGameOver();
  }));

  // ── Game over ──
  el('btn-replay').addEventListener('click', withCooldown(() => {
    state.teams          = [];
    state.teamPlayerIdx  = [];
    state.allWords       = [];
    state.roundWords     = [];
    state.currentRound   = 0;
    state.noTeamsMode    = false;
    state.selectedCategories = [];
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
  el('btn-install-pwa').addEventListener('click', withCooldown(installPwa));
  el('btn-words-back').addEventListener('click', withCooldown(() => showScreen('screen-setup')));
  el('btn-word-add').addEventListener('click', withCooldown(addWord));
  el('word-new-text').addEventListener('keydown', e => { if (e.key === 'Enter') addWord(); });
  el('btn-words-export').addEventListener('click', withCooldown(exportWords));
  el('input-words-import').addEventListener('change', e => {
    importWords(e.target.files[0]);
    e.target.value = '';
  });
  el('btn-words-reset').addEventListener('click', withCooldown(handleResetWords));

  // ── Démo ──
  el('btn-launch-demo').addEventListener('click', withCooldown(startDemoTurn));

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

  renderPlayerList();
  showScreen('screen-setup');
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator && sessionStorage.getItem('_flashguess_update')) {
  sessionStorage.removeItem('_flashguess_update');
  if (navigator.serviceWorker.controller) {
    location.reload();
  } else {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(reg => {
      reg.update().catch(() => {});
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      }
    })
    .catch(() => {});
}

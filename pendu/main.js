// ── Constantes ─────────────────────────────────────────────────────────────
const MAX_ERRORS = 6;

// Clavier AZERTY (3 rangées, 26 lettres)
const KEYBOARD_ROWS = [
  ['A','Z','E','R','T','Y','U','I','O','P'],
  ['Q','S','D','F','G','H','J','K','L','M'],
  ['W','X','C','V','B','N'],
];

// Parties du pendu dans l'ordre d'apparition
const HANGMAN_PARTS = [
  'h-head',
  'h-body',
  'h-arm-left',
  'h-arm-right',
  'h-leg-left',
  'h-leg-right',
];

// ── État du jeu ─────────────────────────────────────────────────────────────
let secretWord   = '';   // mot original (avec accents, espaces)
let normalWord   = '';   // mot normalisé (sans accents, majuscules, pour comparaison)
let hint         = '';
let guessed      = new Set();  // lettres normalisées devinées correctement
let wrongLetters = new Set();  // lettres normalisées devinées incorrectement
let gameOver     = false;

// ── Utilitaires ─────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, '');
}

function showScreen(id) {
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  el(id).hidden = false;
}

let _toastTimer = null;
function showToast(msg, type = 'info') {
  const t = el('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.hidden = false;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ── Thème ───────────────────────────────────────────────────────────────────
const THEME_KEY = 'pendu_theme';
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = el('btn-theme');
  if (!btn) return;
  btn.textContent = theme === 'light' ? '☀️' : '🌙';
  btn.title = theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair';
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
  el('btn-theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

// ── Plein écran ─────────────────────────────────────────────────────────────
function initFullscreen() {
  el('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const docEl = document.documentElement;
      (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' }).catch(() => {});
      el('btn-fullscreen').textContent = '⊡';
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
      el('btn-fullscreen').textContent = '⛶';
    }
  });
}

// ── Service Worker ───────────────────────────────────────────────────────────
function initSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
}

// ── Clavier ─────────────────────────────────────────────────────────────────
function buildKeyboard() {
  KEYBOARD_ROWS.forEach((row, i) => {
    const rowEl = el(`kbd-row-${i + 1}`);
    rowEl.innerHTML = '';
    row.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'kbd-btn';
      btn.textContent = letter;
      btn.dataset.letter = letter;
      btn.setAttribute('aria-label', `Lettre ${letter}`);
      btn.addEventListener('click', () => onLetterClick(letter));
      rowEl.appendChild(btn);
    });
  });
}

function resetKeyboard() {
  document.querySelectorAll('.kbd-btn').forEach(btn => {
    btn.disabled = false;
    btn.className = 'kbd-btn';
  });
}

function disableKeyboardBtn(letter, cls) {
  const btn = document.querySelector(`.kbd-btn[data-letter="${letter}"]`);
  if (btn) {
    btn.disabled = true;
    btn.classList.add(cls);
  }
}

// ── Mot affiché ──────────────────────────────────────────────────────────────
function renderWordDisplay() {
  const display = el('word-display');
  display.innerHTML = '';

  for (let i = 0; i < secretWord.length; i++) {
    const char     = secretWord[i];
    const normChar = normalWord[i];

    const slot = document.createElement('span');
    slot.className = 'word-letter';

    if (char === ' ') {
      slot.classList.add('word-letter--space');
      slot.style.minWidth = '20px';
      const charEl = document.createElement('span');
      charEl.className = 'word-letter-char';
      charEl.textContent = ' ';
      slot.appendChild(charEl);
      display.appendChild(slot);
      continue;
    }

    const charEl = document.createElement('span');
    charEl.className = 'word-letter-char';

    if (guessed.has(normChar)) {
      charEl.textContent = char.toUpperCase();
      charEl.classList.add('found');
    } else {
      charEl.textContent = '';
    }

    const line = document.createElement('span');
    line.className = 'word-letter-line';

    slot.appendChild(charEl);
    slot.appendChild(line);
    display.appendChild(slot);
  }
}

// ── Pendu ────────────────────────────────────────────────────────────────────
function renderHangman(errors) {
  HANGMAN_PARTS.forEach((id, idx) => {
    const part = el(id);
    if (!part) return;
    if (idx < errors) {
      part.hidden = false;
      part.style.opacity = '1';
    } else {
      part.hidden = false;
      part.style.opacity = '0';
    }
  });
}

// ── Badge erreurs ────────────────────────────────────────────────────────────
function renderErrorsBadge(errors) {
  const badge = el('game-errors-label');
  badge.textContent = `${errors} / ${MAX_ERRORS} erreur${errors > 1 ? 's' : ''}`;
  badge.classList.remove('danger', 'warning');
  if (errors >= 5) badge.classList.add('danger');
  else if (errors >= 3) badge.classList.add('warning');
}

// ── Mauvaises lettres ────────────────────────────────────────────────────────
function renderWrongLetters() {
  const el2 = el('wrong-letters');
  if (wrongLetters.size === 0) {
    el2.textContent = '';
    return;
  }
  el2.textContent = '✗ ' + [...wrongLetters].join(' ');
}

// ── Vérification victoire/défaite ─────────────────────────────────────────
function isWordFound() {
  return [...normalWord].every(c => c === ' ' || guessed.has(c));
}

// ── Clic lettre ──────────────────────────────────────────────────────────────
function onLetterClick(letter) {
  if (gameOver) return;
  if (guessed.has(letter) || wrongLetters.has(letter)) return;

  const isCorrect = normalWord.includes(letter);
  if (isCorrect) {
    guessed.add(letter);
    disableKeyboardBtn(letter, 'correct');
    renderWordDisplay();
    if (isWordFound()) {
      gameOver = true;
      setTimeout(() => showResult(true), 300);
    }
  } else {
    wrongLetters.add(letter);
    disableKeyboardBtn(letter, 'wrong');
    renderWrongLetters();
    const errors = wrongLetters.size;
    renderHangman(errors);
    renderErrorsBadge(errors);
    if (errors >= MAX_ERRORS) {
      gameOver = true;
      setTimeout(() => showResult(false), 300);
    }
  }
}

// ── Démarrer une partie ──────────────────────────────────────────────────────
function startGame() {
  guessed.clear();
  wrongLetters.clear();
  gameOver = false;

  resetKeyboard();
  renderHangman(0);
  renderErrorsBadge(0);
  renderWordDisplay();
  renderWrongLetters();

  // Indice
  const hintBadge = el('game-hint-label');
  if (hint) {
    hintBadge.textContent = `💡 ${hint}`;
    hintBadge.hidden = false;
  } else {
    hintBadge.hidden = true;
  }

  showScreen('screen-game');
}

// ── Résultat ─────────────────────────────────────────────────────────────────
function showResult(won) {
  el('result-icon').textContent  = won ? '🎉' : '💀';
  el('result-title').textContent = won ? 'Bravo !' : 'Perdu…';
  el('result-sub').textContent   = won
    ? `Le mot a été trouvé avec ${wrongLetters.size} erreur${wrongLetters.size !== 1 ? 's' : ''} !`
    : `Le pendu est complet. Mieux la prochaine fois !`;
  el('result-word').textContent  = secretWord.toUpperCase();
  el('result-errors').textContent = `${wrongLetters.size} erreur${wrongLetters.size !== 1 ? 's' : ''} sur ${MAX_ERRORS} autorisées`;
  showScreen('screen-result');
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  initTheme();
  initFullscreen();
  buildKeyboard();
  initSW();

  // Écran 1 — saisie du mot
  const wordInput  = el('word-input');
  const hintInput  = el('hint-input');
  const confirmBtn = el('btn-confirm-word');
  const toggleBtn  = el('btn-toggle-word');

  wordInput.addEventListener('input', () => {
    const val = wordInput.value.trim();
    const norm = normalize(val);
    const letters = norm.replace(/ /g, '');
    confirmBtn.disabled = letters.length < 2;
  });

  wordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
  });

  toggleBtn.addEventListener('click', () => {
    wordInput.type = wordInput.type === 'password' ? 'text' : 'password';
    toggleBtn.textContent = wordInput.type === 'password' ? '👁' : '🙈';
  });

  confirmBtn.addEventListener('click', () => {
    const raw  = wordInput.value.trim();
    const norm = normalize(raw);
    const letters = norm.replace(/ /g, '');
    if (letters.length < 2) {
      showToast('Le mot doit avoir au moins 2 lettres.', 'warning');
      return;
    }
    secretWord = raw;
    normalWord = norm;
    hint       = hintInput.value.trim();
    // Reset input
    wordInput.value  = '';
    wordInput.type   = 'password';
    toggleBtn.textContent = '👁';
    hintInput.value  = '';
    confirmBtn.disabled = true;
    showScreen('screen-handoff');
  });

  // Écran 2 — passez le téléphone
  el('btn-start-game').addEventListener('click', startGame);
  el('btn-back-enter').addEventListener('click', () => showScreen('screen-enter'));

  // Écran 4 — résultat
  el('btn-play-again').addEventListener('click', () => showScreen('screen-enter'));

  // Afficher l'écran de départ
  showScreen('screen-enter');
}

document.addEventListener('DOMContentLoaded', init);

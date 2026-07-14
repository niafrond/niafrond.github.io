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

// Catégories flash-guess disponibles pour le mot au hasard
const RANDOM_WORD_CATEGORIES = [
  { key: 'general_knowledge',   label: 'Culture Générale' },
  { key: 'geography',           label: 'Géographie' },
  { key: 'history',             label: 'Histoire' },
  { key: 'music',               label: 'Musique' },
  { key: 'film_and_tv',         label: 'Cinéma & TV' },
  { key: 'sport',               label: 'Sport & Loisirs' },
  { key: 'science',             label: 'Sciences' },
  { key: 'arts_and_literature', label: 'Arts & Littérature' },
  { key: 'food_and_drink',      label: 'Cuisine & Boissons' },
  { key: 'anatomy',             label: 'Anatomie' },
  { key: 'disney',              label: 'Disney' },
  { key: 'cars',                label: 'Voitures' },
  { key: 'city',                label: 'En ville' },
  { key: 'clothing',            label: 'Vêtements' },
  { key: 'monuments',           label: 'Monuments' },
  { key: 'space',               label: 'Espace' },
  { key: 'sports',              label: 'Sports' },
  { key: 'superheroes',         label: 'Super héros' },
  { key: 'toys',                label: 'Jouets' },
  { key: 'weather',             label: 'Météo' },
  { key: 'games',               label: 'Jeux' },
  { key: 'school',              label: "À l'École" },
  { key: 'society_and_culture', label: 'Société & Culture' },
  { key: 'board_games',         label: 'Jeux de société' },
  { key: 'beach',               label: 'La Plage' },
];

// ── État du jeu ─────────────────────────────────────────────────────────────
let secretWord   = '';   // mot original (avec accents, espaces)
let normalWord   = '';   // mot normalisé (sans accents, majuscules, pour comparaison)
let hint         = '';
let guessed      = new Set();  // lettres normalisées devinées correctement
let wrongLetters = new Set();  // lettres normalisées devinées incorrectement
let wrongWordMap = new Map();  // lettre → mot proposé en mode IndicePendu
let gameOver     = false;
let wrongWordModeEnabled = false;
let wrongWordPromptOpen = false;
let wrongWordExpectedLetter = '';

// ── Utilitaires ─────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, '');
}

// Développe les ligatures qui ne se décomposent pas via NFD (œ→oe, æ→ae…)
function expandLigatures(str) {
  return str
    .replace(/Œ/g, 'OE').replace(/œ/g, 'oe')
    .replace(/Æ/g, 'AE').replace(/æ/g, 'ae');
}

// Normalise caractère par caractère en conservant la longueur originale.
// Les lettres (avec accents) deviennent leur équivalent A-Z ; les autres
// caractères (tiret, apostrophe, espace…) sont conservés tels quels.
function normalizeWord(str) {
  return [...str].map(c => {
    const n = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return /^[A-Z]$/.test(n) ? n : c;
  }).join('');
}

function countLetters(normalizedWord) {
  return [...normalizedWord].filter(c => /^[A-Z]$/.test(c)).length;
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

  // Découpe le mot en segments séparés par les espaces.
  // Chaque segment (partie du mot) est rendu dans un word-group
  // qui ne peut pas se casser en ligne : les lettres d'un même segment
  // restent toujours ensemble.
  const segments = [];
  let segStart = 0;
  for (let i = 0; i <= secretWord.length; i++) {
    if (i === secretWord.length || secretWord[i] === ' ') {
      if (i > segStart) segments.push({ type: 'word', start: segStart, end: i });
      if (i < secretWord.length) segments.push({ type: 'space' });
      segStart = i + 1;
    }
  }

  segments.forEach(seg => {
    if (seg.type === 'space') {
      // Séparateur invisible entre deux parties du mot
      const spacer = document.createElement('span');
      spacer.className = 'word-space';
      display.appendChild(spacer);
      return;
    }

    // Groupe de lettres qui restera sur une seule ligne
    const groupEl = document.createElement('span');
    groupEl.className = 'word-group';

    for (let i = seg.start; i < seg.end; i++) {
      const char     = secretWord[i];
      const normChar = normalWord[i];
      const isLetter = /^[A-Z]$/.test(normChar);

      const slot = document.createElement('span');
      slot.className = 'word-letter';

      // Caractères non-alphabétiques dans le segment (tiret, apostrophe…)
      if (!isLetter) {
        slot.classList.add('word-letter--space');
        const charEl = document.createElement('span');
        charEl.className = 'word-letter-char';
        charEl.textContent = char;
        slot.appendChild(charEl);
        groupEl.appendChild(slot);
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
      groupEl.appendChild(slot);
    }

    display.appendChild(groupEl);
  });
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
  const items = [...wrongLetters].map(letter => {
    const word = wrongWordMap.get(letter);
    return word ? word.toUpperCase() : letter;
  });
  el2.textContent = '✗ ' + items.join(' · ');
}

// ── Vérification victoire/défaite ─────────────────────────────────────────
function isWordFound() {
  return [...normalWord].every(c => !/^[A-Z]$/.test(c) || guessed.has(c));
}

// ── Clic lettre ──────────────────────────────────────────────────────────────
function onLetterClick(letter) {
  if (gameOver) return;
  if (wrongWordPromptOpen) return;
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
    } else if (wrongWordModeEnabled) {
      openWrongWordPrompt(letter);
    }
  }
}

function openWrongWordPrompt(letter) {
  wrongWordPromptOpen = true;
  wrongWordExpectedLetter = letter;
  const motIndice = hint ? `Mot indice : « ${hint} ». ` : `Lettre ratée : ${letter}. `;
  el('wrong-word-instruction').textContent = `${motIndice}Joueur 1 doit écrire un mot visible qui commence par ${letter}.`;
  el('wrong-word-input').value = '';
  el('wrong-word-panel').hidden = false;
  el('wrong-word-input').focus();
}

function closeWrongWordPrompt() {
  wrongWordPromptOpen = false;
  wrongWordExpectedLetter = '';
  el('wrong-word-panel').hidden = true;
}

function validateWrongWordPrompt() {
  if (!wrongWordPromptOpen || gameOver) return;
  const input = el('wrong-word-input');
  const raw = input.value.trim();
  const norm = normalize(raw).replace(/ /g, '');
  if (!norm) {
    showToast('Entrez un mot.', 'warning');
    return;
  }
  if (norm[0] !== wrongWordExpectedLetter) {
    showToast(`Le mot doit commencer par ${wrongWordExpectedLetter}.`, 'warning');
    return;
  }
  wrongWordMap.set(wrongWordExpectedLetter, raw.trim().toUpperCase());
  renderWrongLetters();
  closeWrongWordPrompt();
}

// ── Démarrer une partie ──────────────────────────────────────────────────────
function startGame() {
  guessed.clear();
  wrongLetters.clear();
  wrongWordMap.clear();
  gameOver = false;
  closeWrongWordPrompt();

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

  // Nombre de lettres
  const letterCount = countLetters(normalWord);
  el('game-length-label').textContent = `${letterCount} lettre${letterCount > 1 ? 's' : ''}`;

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

// ── Mot au hasard (flash-guess) ───────────────────────────────────────────────
async function pickRandomWord() {
  const btn = el('btn-random-word');
  btn.disabled = true;
  try {
    // Choisir une catégorie aléatoire (jusqu'à 5 tentatives si fetch échoue)
    for (let attempt = 0; attempt < 5; attempt++) {
      const cat = RANDOM_WORD_CATEGORIES[Math.floor(Math.random() * RANDOM_WORD_CATEGORIES.length)];
      try {
        const res = await fetch(`../flash-guess/words/${cat.key}.json`);
        if (!res.ok) continue;
        const words = await res.json();
        if (!Array.isArray(words) || words.length === 0) continue;
        const entry = words[Math.floor(Math.random() * words.length)];
        if (!entry || !entry.word) continue;
        return { word: entry.word, category: cat.label };
      } catch (_) { /* essayer une autre catégorie */ }
    }
    showToast('Impossible de charger un mot. Réessayez.', 'warning');
    return null;
  } finally {
    btn.disabled = false;
  }
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
  const modeToggle = el('mode-indice-pendu');
  const wrongWordInput = el('wrong-word-input');

  wordInput.addEventListener('input', () => {
    const val = expandLigatures(wordInput.value.trim());
    const letters = countLetters(normalizeWord(val));
    confirmBtn.disabled = letters < 2;
  });

  el('btn-random-word').addEventListener('click', async () => {
    const result = await pickRandomWord();
    if (!result) return;
    wordInput.value = result.word;
    wordInput.type = 'password';
    toggleBtn.textContent = '👁';
    // Pré-remplir l'indice avec la catégorie si l'indice est vide
    if (!hintInput.value.trim()) hintInput.value = result.category;
    // Déclencher la validation du bouton
    wordInput.dispatchEvent(new Event('input'));
    showToast(`Catégorie : ${result.category}`, 'info');
  });

  wordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
  });

  toggleBtn.addEventListener('click', () => {
    wordInput.type = wordInput.type === 'password' ? 'text' : 'password';
    toggleBtn.textContent = wordInput.type === 'password' ? '👁' : '🙈';
  });

  confirmBtn.addEventListener('click', () => {
    const raw  = expandLigatures(wordInput.value.trim());
    const norm = normalizeWord(raw);
    const letters = countLetters(norm);
    if (letters < 2) {
      showToast('Le mot doit avoir au moins 2 lettres.', 'warning');
      return;
    }
    secretWord = raw;
    normalWord = norm;
    hint       = hintInput.value.trim();
    wrongWordModeEnabled = modeToggle.checked;
    // Reset input
    wordInput.value  = '';
    wordInput.type   = 'password';
    toggleBtn.textContent = '👁';
    hintInput.value  = '';
    confirmBtn.disabled = true;
    showScreen('screen-handoff');
  });

  el('btn-validate-wrong-word').addEventListener('click', validateWrongWordPrompt);
  wrongWordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') validateWrongWordPrompt();
  });

  // Écran 2 — passez le téléphone
  el('btn-start-game').addEventListener('click', startGame);
  el('btn-back-enter').addEventListener('click', () => {
    closeWrongWordPrompt();
    showScreen('screen-enter');
  });

  // Écran 4 — résultat
  el('btn-play-again').addEventListener('click', () => {
    closeWrongWordPrompt();
    showScreen('screen-enter');
  });

  // Afficher l'écran de départ
  showScreen('screen-enter');
}

document.addEventListener('DOMContentLoaded', init);

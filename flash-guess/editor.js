/**
 * editor.js — Éditeur de mots du jeu
 */

import { el, showScreen, showToast } from './ui.js';
import { CATEGORY_LABELS, loadWords, saveWords, resetWords, getCategoryInfo, getDefaultWords } from './words.js';

let editableWords        = [];
let _activeWordsCategory = 'all';

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

export async function openWordsEditor() {
  editableWords = await loadWords();
  _activeWordsCategory = 'all';
  renderWordsCatTabs();
  renderWordsList();
  showScreen('screen-words');
}

export function renderWordsCatTabs() {
  const tabsEl = el('words-cat-tabs');
  tabsEl.innerHTML = '';

  const allTab = document.createElement('button');
  allTab.className = `words-cat-tab${_activeWordsCategory === 'all' ? ' words-cat-tab--active' : ''}`;
  allTab.textContent = `🗂️ Toutes (${editableWords.length})`;
  allTab.addEventListener('click', () => {
    _activeWordsCategory = 'all';
    renderWordsCatTabs();
    renderWordsList();
  });
  tabsEl.appendChild(allTab);

  const counts = {};
  editableWords.forEach(w => { counts[w.category] = (counts[w.category] || 0) + 1; });

  Object.entries(CATEGORY_LABELS).forEach(([key, { label, emoji }]) => {
    const n = counts[key] || 0;
    const tab = document.createElement('button');
    tab.className = `words-cat-tab${_activeWordsCategory === key ? ' words-cat-tab--active' : ''}`;
    tab.textContent = `${emoji} ${label} (${n})`;
    tab.addEventListener('click', () => {
      _activeWordsCategory = key;
      el('word-new-category').value = key;
      renderWordsCatTabs();
      renderWordsList();
    });
    tabsEl.appendChild(tab);
  });
}

export function renderWordsList() {
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
    kidBtn.textContent = '🧒';
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

export function addWord() {
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
  _activeWordsCategory = category;
  textInput.value = '';
  textInput.focus();
  renderWordsCatTabs();
  renderWordsList();
  showToast(`"${word}" ajouté ✅`);
}

export function deleteWord(idx) {
  const deleted = editableWords[idx];
  editableWords.splice(idx, 1);
  saveWords(editableWords);
  renderWordsCatTabs();
  renderWordsList();
  showToast(`"${deleted.word}" supprimé`);
}

export function toggleKidFriendly(idx) {
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

export function exportWords() {
  const json = JSON.stringify(editableWords, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'flashguess-mots.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importWords(file) {
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

export async function handleResetWords() {
  if (!confirm('Réinitialiser la liste avec les mots par défaut ?')) return;
  resetWords();
  editableWords = await getDefaultWords();
  _activeWordsCategory = 'all';
  renderWordsCatTabs();
  renderWordsList();
  showToast('Mots remis par défaut ✅');
}

/**
 * setup.js — Écrans Setup, Catégories et Équipes
 */

import {
  state,
  CARD_COUNT_DEFAULT, CARD_COUNT_KEY, SELECTED_CATS_KEY, KIDS_MODE_KEY,
  MIN_PLAYERS,
} from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { CATEGORY_LABELS, loadWords } from './words.js';
import { assignTeams, renderTeams } from './game.js';
import { renderMembersList, renderGroupsInSetup, autoSaveMember } from './members.js';

// ─── Persistance du nombre de cartes ───────────────────────────────────────────
export function loadCardCount() {
  const ALLOWED = [0, 10, 20, 30, 40, 50];
  try {
    const v = localStorage.getItem(CARD_COUNT_KEY);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (ALLOWED.includes(n)) return n;
    }
  } catch (_) { /* ignore */ }
  return CARD_COUNT_DEFAULT;
}

export function saveCardCount(n) {
  try { localStorage.setItem(CARD_COUNT_KEY, String(n)); } catch (_) { /* ignore */ }
}

// ─── Persistance des catégories sélectionnées ─────────────────────────────────
export function loadSelectedCategories() {
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
  return Object.keys(CATEGORY_LABELS);
}

export function saveSelectedCategories(cats) {
  try { localStorage.setItem(SELECTED_CATS_KEY, JSON.stringify(cats)); } catch (_) { /* ignore */ }
}

// ─── Persistance du mode enfant ───────────────────────────────────────────────
export function loadKidsMode() {
  try { return localStorage.getItem(KIDS_MODE_KEY) === '1'; } catch (_) { return false; }
}

export function saveKidsMode(v) {
  try { localStorage.setItem(KIDS_MODE_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ }
}

// ─── ÉCRAN SETUP — joueurs ─────────────────────────────────────────────────────
export function renderPlayerList() {
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

export function addPlayer() {
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
  autoSaveMember(name, isChild);
  renderPlayerList();
  renderMembersList();
  renderGroupsInSetup();
}

export function removePlayer(idx) {
  const name = state.playerNames[idx];
  state.playerIsChild.delete(name);
  state.playerNames.splice(idx, 1);
  renderPlayerList();
  renderMembersList();
  renderGroupsInSetup();
}

// ─── MODE ENFANT ──────────────────────────────────────────────────────────────
export function hasChildInGame() {
  return state.playerNames.some(n => state.playerIsChild.has(n));
}

export function updateKidsModeStatus() {
  const forced = hasChildInGame();
  state.kidsMode = forced || state.kidsModeManual;

  const btn     = el('toggle-kids-mode');
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

export function toggleKidsMode() {
  if (hasChildInGame()) return;
  state.kidsModeManual = !state.kidsModeManual;
  saveKidsMode(state.kidsModeManual);
  updateKidsModeStatus();
}

// ─── ÉCRAN CATEGORIES ─────────────────────────────────────────────────────────
function getWordCountsByCategory() {
  const words = loadWords();
  const counts = {};
  words.forEach(w => { counts[w.category] = (counts[w.category] || 0) + 1; });
  return counts;
}

export function openCategorySelect() {
  if (state.selectedCategories.length === 0) {
    state.selectedCategories = loadSelectedCategories();
  }
  renderCategories();
  showScreen('screen-categories');
}

export function renderCategories() {
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

export function toggleCategory(key) {
  const idx = state.selectedCategories.indexOf(key);
  if (idx === -1) {
    state.selectedCategories.push(key);
  } else {
    state.selectedCategories.splice(idx, 1);
  }
  const card = document.querySelector(`[data-key="${key}"]`);
  if (card) {
    const isNowSelected = state.selectedCategories.includes(key);
    card.classList.toggle('cat-toggle--selected', isNowSelected);
    card.setAttribute('aria-checked', String(isNowSelected));
  }
  updateCatConfirmBtn();
}

export function selectAllCategories() {
  state.selectedCategories = Object.keys(CATEGORY_LABELS);
  renderCategories();
}

export function deselectAllCategories() {
  state.selectedCategories = [];
  renderCategories();
}

export function updateCatConfirmBtn() {
  const hasSelection = state.selectedCategories.length > 0;
  el('btn-cats-confirm').disabled = !hasSelection;
  el('cats-hint').hidden = hasSelection;
}

export function confirmCategories() {
  if (state.selectedCategories.length === 0) {
    showToast('Sélectionnez au moins une catégorie', 'warn');
    return;
  }
  saveSelectedCategories(state.selectedCategories);
  assignTeams();
  renderTeams();
  showScreen('screen-teams');
}

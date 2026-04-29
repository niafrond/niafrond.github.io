/**
 * setup.js — Écrans Setup, Catégories et Équipes
 */

import {
  state,
  CARD_COUNT_DEFAULT, CARD_COUNT_KEY, SELECTED_CATS_KEY, KIDS_MODE_KEY, KIDS_QUESTIONS_KEY, KIDS_READ_TIME_KEY, WORD_DRAFT_KEY, ROTATING_GUESSER_KEY,
  TURN_DURATION_KEY, DIFFICULTY_KEY, PLAYERS_KEY,
  MIN_PLAYERS,
} from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { CATEGORY_LABELS, loadWords } from './words.js';
import { assignTeams, renderTeams } from './game.js';
import { loadMembers, loadGroups, autoSaveMember } from './members.js';

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
/** Catégories exclues de la sélection par défaut (désélectionnées à la première utilisation). */
const CATEGORIES_OFF_BY_DEFAULT = new Set(['reunion']);

export const DEFAULT_SELECTED_CATEGORIES = Object.keys(CATEGORY_LABELS).filter(
  k => !CATEGORIES_OFF_BY_DEFAULT.has(k)
);

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
  return DEFAULT_SELECTED_CATEGORIES;
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

// ─── Persistance du toggle "activer questions enfants" ────────────────────────
export function loadKidsQuestionsEnabled() {
  try {
    const stored = localStorage.getItem(KIDS_QUESTIONS_KEY);
    return stored === null ? true : stored === '1';
  } catch (_) { return true; }
}

export function saveKidsQuestionsEnabled(v) {
  try { localStorage.setItem(KIDS_QUESTIONS_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ }
}

// ─── Persistance du toggle "activer temps de lecture pour enfants" ─────────────
export function loadKidsReadTimeEnabled() {
  try {
    const stored = localStorage.getItem(KIDS_READ_TIME_KEY);
    return stored === null ? true : stored === '1';
  } catch (_) { return true; }
}

export function saveKidsReadTimeEnabled(v) {
  try { localStorage.setItem(KIDS_READ_TIME_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ }
}

// ─── Persistance du mode choix de mots ───────────────────────────────────────
export function loadWordDraftMode() {
  try {
    const stored = localStorage.getItem(WORD_DRAFT_KEY);
    return stored === null ? true : stored === '1';
  } catch (_) { return true; }
}

export function saveWordDraftMode(v) {
  try { localStorage.setItem(WORD_DRAFT_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ }
}

// ─── Persistance du mode devineur tournant ────────────────────────────────────
export function loadRotatingGuesserMode() {
  try { return localStorage.getItem(ROTATING_GUESSER_KEY) === '1'; } catch (_) { return false; }
}

export function saveRotatingGuesserMode(v) {
  try { localStorage.setItem(ROTATING_GUESSER_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ }
}

// ─── Persistance de la durée du tour ──────────────────────────────────────────
export function loadTurnDuration() {
  const ALLOWED = [15, 20, 30, 45, 60];
  try {
    const v = localStorage.getItem(TURN_DURATION_KEY);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (ALLOWED.includes(n)) return n;
    }
  } catch (_) { /* ignore */ }
  return 30;
}

export function saveTurnDuration(n) {
  try { localStorage.setItem(TURN_DURATION_KEY, String(n)); } catch (_) { /* ignore */ }
}

// ─── Persistance du niveau de difficulté (mode 2 joueurs) ────────────────────
export function loadDifficulty() {
  try {
    const v = localStorage.getItem(DIFFICULTY_KEY);
    if (v && ['facile', 'moyen', 'difficile', 'god'].includes(v)) return v;
  } catch (_) { /* ignore */ }
  return 'moyen';
}

export function saveDifficulty(v) {
  try { localStorage.setItem(DIFFICULTY_KEY, v); } catch (_) { /* ignore */ }
}

// ─── Persistance de la liste de joueurs ───────────────────────────────────────
export function loadCurrentPlayers() {
  try {
    const raw = localStorage.getItem(PLAYERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) { /* ignore */ }
  return [];
}

export function saveCurrentPlayers() {
  try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(state.playerNames)); } catch (_) { /* ignore */ }
}

// ─── ÉCRAN SETUP — joueurs ─────────────────────────────────────────────────────
let _lastAddedPlayer = null;

/** Crée le menu 3-points contextuel pour un joueur. */
function buildPlayerMenu(name, idx, item) {
  const menuBtn = document.createElement('button');
  menuBtn.className = 'player-item-menu-btn btn-icon';
  menuBtn.setAttribute('aria-label', `Options pour ${name}`);
  menuBtn.textContent = '⋯';

  const popup = document.createElement('div');
  popup.className = 'player-item-menu-popup';
  popup.hidden = true;

  // Action : marquer / démarquer enfant
  const childAction = document.createElement('button');
  childAction.className = 'player-menu-action';
  childAction.textContent = state.playerIsChild.has(name) ? '😊 Retirer "Enfant"' : '👶 Marquer comme enfant';
  childAction.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayerChild(name);
    popup.hidden = true;
  });
  popup.appendChild(childAction);

  // Action : modifier le nom
  const renameAction = document.createElement('button');
  renameAction.className = 'player-menu-action';
  renameAction.textContent = '✏️ Modifier le nom';
  renameAction.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.hidden = true;
    startRenamePlayer(idx, item, name);
  });
  popup.appendChild(renameAction);

  // Action : supprimer
  const deleteAction = document.createElement('button');
  deleteAction.className = 'player-menu-action player-menu-delete btn-danger';
  deleteAction.textContent = '🗑️ Supprimer le joueur';
  deleteAction.setAttribute('aria-label', `Supprimer ${name}`);
  deleteAction.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.hidden = true;
    removePlayer(idx);
  });
  popup.appendChild(deleteAction);

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasHidden = popup.hidden;
    // Fermer tous les autres menus ouverts
    document.querySelectorAll('.player-item-menu-popup').forEach(p => { p.hidden = true; });
    popup.hidden = !wasHidden;
  });

  item.appendChild(menuBtn);
  item.appendChild(popup);
}

/** Déclenche le mode renommage inline pour un joueur. */
function startRenamePlayer(idx, item, oldName) {
  // Remplacer temporairement le nom par un champ de saisie
  const nameSpan = item.querySelector('.player-item-name');
  if (!nameSpan) return;

  const input = document.createElement('input');
  input.className = 'player-rename-input';
  input.type = 'text';
  input.value = oldName;
  input.maxLength = 24;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const doRename = () => {
    const newName = input.value.trim();
    if (!newName || newName === oldName) { renderPlayerList(); return; }
    if (state.playerNames.includes(newName)) { showToast('Ce joueur existe déjà', 'warn'); renderPlayerList(); return; }
    const wasChild = state.playerIsChild.has(oldName);
    state.playerIsChild.delete(oldName);
    state.playerNames[idx] = newName;
    if (wasChild) state.playerIsChild.add(newName);
    autoSaveMember(newName, wasChild);
    saveCurrentPlayers();
    renderPlayerList();
    showToast(`${oldName} → ${newName} ✅`);
  };

  input.addEventListener('blur', doRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); renderPlayerList(); }
  });
}

export function renderPlayerList() {
  const list = el('player-list');
  list.innerHTML = '';
  const emptyState = el('player-empty-state');

  state.playerNames.forEach((name, i) => {
    const item = document.createElement('div');
    item.className = name === _lastAddedPlayer ? 'player-item player-item--new' : 'player-item';
    if (name === _lastAddedPlayer) _lastAddedPlayer = null;

    const avatar = document.createElement('span');
    avatar.className = 'player-item-avatar';
    avatar.textContent = '👤';
    avatar.setAttribute('aria-hidden', 'true');
    item.appendChild(avatar);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-item-name';
    nameSpan.textContent = name;
    item.appendChild(nameSpan);

    if (state.playerIsChild.has(name)) {
      const badge = document.createElement('span');
      badge.className = 'player-item-child-badge';
      badge.textContent = '👶 Enfant';
      item.appendChild(badge);
    }

    buildPlayerMenu(name, i, item);
    list.appendChild(item);
  });

  const count = state.playerNames.length;

  // Compteur dans l'en-tête
  const countEl = el('player-count');
  countEl.textContent = count > 0 ? `(${count})` : '';
  countEl.hidden = count === 0;

  // État vide
  if (emptyState) emptyState.hidden = count > 0;

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

export function togglePlayerChild(name) {
  if (state.playerIsChild.has(name)) {
    state.playerIsChild.delete(name);
  } else {
    state.playerIsChild.add(name);
  }
  saveCurrentPlayers();
  renderPlayerList();
  updateKidsModeStatus();
}

export function addPlayer(nameOverride) {
  const input = el('player-input');
  const name = nameOverride !== undefined ? nameOverride : input.value.trim();
  if (!name) { showToast('Entrez un prénom', 'warn'); return null; }
  if (state.playerNames.includes(name)) { showToast('Ce joueur existe déjà', 'warn'); return null; }
  if (state.playerNames.length >= 20) { showToast('Maximum 20 joueurs', 'warn'); return null; }
  state.playerNames.push(name);
  input.value = '';
  input.focus();
  _lastAddedPlayer = name;
  // Respecte le statut enfant enregistré précédemment
  const members = loadMembers();
  const existing = members.find(m => m.name === name);
  if (existing?.isChild) state.playerIsChild.add(name);
  autoSaveMember(name, state.playerIsChild.has(name));
  saveCurrentPlayers();
  renderPlayerList();
  showToast(`${name} ajouté ✅`);
  return name;
}

export function removePlayer(idx) {
  const name = state.playerNames[idx];
  state.playerIsChild.delete(name);
  state.playerNames.splice(idx, 1);
  saveCurrentPlayers();
  renderPlayerList();
}

/** Retourne les suggestions de joueurs/groupes correspondant à la requête (max 5). */
export function getSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  const members = loadMembers();
  members.forEach(m => {
    if (
      m.name.toLowerCase().includes(q) &&
      !state.playerNames.includes(m.name) &&
      results.length < 3
    ) {
      results.push({ type: 'member', name: m.name, label: 'joueur enregistré', isChild: !!m.isChild });
    }
  });
  const groups = loadGroups();
  groups.forEach(g => {
    if (
      g.name.toLowerCase().includes(q) &&
      g.members.length > 0 &&
      results.length < 5
    ) {
      results.push({ type: 'group', name: g.name, label: `groupe (${g.members.length})`, members: g.members });
    }
  });
  return results;
}

// ─── MODE ENFANT ──────────────────────────────────────────────────────────────
export function hasChildInGame() {
  return state.playerNames.some(n => state.playerIsChild.has(n));
}

export function updateKidsModeStatus() {
  const forced = hasChildInGame() && state.kidsQuestionsEnabled;
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
  if (hasChildInGame() && state.kidsQuestionsEnabled) return;
  state.kidsModeManual = !state.kidsModeManual;
  saveKidsMode(state.kidsModeManual);
  updateKidsModeStatus();
}

// ─── ÉCRAN CATEGORIES ─────────────────────────────────────────────────────────
async function getWordCountsByCategory() {
  const words = await loadWords();
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

export async function renderCategories() {
  const grid = el('categories-grid');
  grid.innerHTML = '';
  const counts = await getWordCountsByCategory();

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
  // Réinitialiser les objectifs coop à chaque nouvelle partie
  state.coopObjectives = new Set();
  state.coopTimeUsed   = 0;
  state.coopTurnsCount = 0;
  assignTeams();
  renderTeams();
  showScreen('screen-teams');
}

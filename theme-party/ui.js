// ============================================================
// theme-party/ui.js — Rendu DOM pur des 4 écrans.
// Ne possède aucun état de jeu, ne fait aucun fetch/localStorage :
// reçoit des données et des callbacks, met à jour le DOM.
// ============================================================

import { THEME_TRACK_COUNT } from './constants.js';

const screens = document.querySelectorAll('[data-screen]');

export function showScreen(name) {
  screens.forEach((el) => {
    el.classList.toggle('hidden', el.dataset.screen !== name);
  });
}

// ─── Atelier : liste des thèmes ──────────────────────────────────────────────

export function renderThemeList(container, themes, { onEdit, onDelete, onExport }) {
  container.innerHTML = '';
  if (themes.length === 0) {
    container.innerHTML = '<p class="text-muted">Aucun thème pour l\'instant.</p>';
    return;
  }
  themes.forEach((theme) => {
    const row = document.createElement('div');
    row.className = 'theme-row';
    const complete = theme.tracks.length === THEME_TRACK_COUNT;
    row.innerHTML = `
      <span class="theme-row-name">${escapeHtml(theme.name)}</span>
      <span class="theme-row-badge ${complete ? 'badge-complete' : ''}">${theme.tracks.length}/${THEME_TRACK_COUNT}</span>
      <button class="btn btn-sm" data-action="edit">✏️</button>
      <button class="btn btn-sm" data-action="export">📤</button>
      <button class="btn btn-sm btn-danger" data-action="delete">🗑️</button>
    `;
    row.querySelector('[data-action="edit"]').addEventListener('click', () => onEdit(theme.id));
    row.querySelector('[data-action="export"]').addEventListener('click', () => onExport(theme.id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => onDelete(theme.id));
    container.appendChild(row);
  });
}

// ─── Atelier : éditeur d'un thème ────────────────────────────────────────────

export function renderSearchResults(container, results, onAdd) {
  container.innerHTML = '';
  results.forEach((track) => {
    const li = document.createElement('li');
    li.className = 'search-result';
    li.innerHTML = `<span>${escapeHtml(track.title)} — ${escapeHtml(track.artist || '?')}</span>
      <button class="btn btn-sm" type="button">+ Ajouter</button>`;
    li.querySelector('button').addEventListener('click', () => onAdd(track));
    container.appendChild(li);
  });
}

export function renderThemeTracks(container, theme, { onRemove, onHintChange, onReponseChange }) {
  container.innerHTML = '';
  theme.tracks.forEach((track, index) => {
    const li = document.createElement('li');
    li.className = 'track-row';
    li.innerHTML = `
      <div class="track-row-header">
        <strong>${index + 1}. ${escapeHtml(track.title)} — ${escapeHtml(track.artist || '?')}</strong>
        <button class="btn btn-sm btn-danger" type="button">🗑️</button>
      </div>
      <div class="form-row">
        <input class="input hint-input" data-hint="1" placeholder="Indice 1 (jamais le titre/l'artiste, ex : nationalité, genre...)" value="${escapeAttr(track.hint1)}">
        <input class="input hint-input" data-hint="2" placeholder="Indice 2 (jamais le titre/l'artiste, ex : contexte du morceau)" value="${escapeAttr(track.hint2)}">
      </div>
      <div class="form-row">
        <input class="input reponse-input" data-field="reponse" placeholder="Réponse attendue (ex : chien)" value="${escapeAttr(track.reponse)}">
      </div>
    `;
    li.querySelector('.btn-danger').addEventListener('click', () => onRemove(track.id));
    li.querySelector('[data-hint="1"]').addEventListener('input', (e) => onHintChange(track.id, { hint1: e.target.value }));
    li.querySelector('[data-hint="2"]').addEventListener('input', (e) => onHintChange(track.id, { hint2: e.target.value }));
    li.querySelector('[data-field="reponse"]').addEventListener('input', (e) => onReponseChange(track.id, e.target.value));
    container.appendChild(li);
  });
}

// ─── Accueil ──────────────────────────────────────────────────────────────────

/** Adapte le libellé du gros bouton selon qu'une partie est déjà en cours ou non. */
export function renderLaunchButton(btnEl, hasActiveGame) {
  btnEl.textContent = hasActiveGame ? '▶️ Reprendre la partie' : '🎉 Lancer une partie';
}

// ─── Picker de thème ──────────────────────────────────────────────────────────

export function renderThemePicker(container, emptyMsgEl, themes, onPick) {
  container.innerHTML = '';
  emptyMsgEl.classList.toggle('hidden', themes.length > 0);
  themes.forEach((theme) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.innerHTML = `<span class="theme-card-name">${escapeHtml(theme.name)}</span>`
      + (theme.consigne ? `<span class="theme-card-consigne">${escapeHtml(theme.consigne)}</span>` : '');
    card.addEventListener('click', () => onPick(theme.id));
    container.appendChild(card);
  });
}

// ─── Manche : carousel de disques ────────────────────────────────────────────

export function renderDiscCarousel(container, currentIndex, total) {
  container.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const disc = document.createElement('div');
    disc.className = 'disc' + (i === currentIndex ? ' disc-current' : i < currentIndex ? ' disc-played' : '');
    disc.textContent = String(i + 1);
    container.appendChild(disc);
  }
  const current = container.querySelector('.disc-current');
  current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// ─── Manche : indices ─────────────────────────────────────────────────────────

export function renderHints(hint1El, hint2El, track, hintState) {
  hint1El.textContent = hintState.hint1Revealed ? (track.hint1 || '—') : '?';
  hint1El.classList.toggle('indice-hidden', !hintState.hint1Revealed);
  hint2El.textContent = hintState.hint2Revealed ? (track.hint2 || '—') : '?';
  hint2El.classList.toggle('indice-hidden', !hintState.hint2Revealed);
}

export function renderRevealAnswer(el, track, revealed) {
  el.classList.toggle('hidden', !revealed);
  if (!revealed) return;
  el.textContent = track.reponse
    ? `${track.reponse} (${track.title} — ${track.artist || '?'})`
    : `${track.title} — ${track.artist || '?'}`;
}

/** Affiche la consigne du thème sur l'écran de manche (peut être vide pour un thème créé sans consigne). */
export function renderConsigne(el, theme) {
  el.textContent = theme.consigne || '';
  el.classList.toggle('hidden', !theme.consigne);
}

// ─── Manche : anneau de progression + play/pause ─────────────────────────────

const RING_CIRCUMFERENCE = 2 * Math.PI * 45;

export function renderProgressRing(ringFgEl, fraction) {
  const clamped = Math.max(0, Math.min(1, fraction));
  ringFgEl.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  ringFgEl.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - clamped)}`;
}

export function renderPlayPause(btnEl, isPlaying) {
  btnEl.textContent = isPlaying ? '⏸' : '▶';
}

export function renderRoundError(el, message) {
  el.classList.toggle('hidden', !message);
  if (message) el.textContent = message;
}

// ─── Fin de Set ────────────────────────────────────────────────────────────────

export function renderSetEnd(el, themeName) {
  el.textContent = themeName;
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

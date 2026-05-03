/**
 * main.js — Point d'entrée
 *
 * Flux : setup → teams → turn → turn-end → game-over
 *
 * TODO : Renommez le jeu, ajoutez vos propres écrans et logique.
 */

import { state, withCooldown, PLAYERS_KEY, TURN_DURATION_KEY, TURN_DURATION_DEFAULT, MIN_PLAYERS } from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { setMuted, getMuted, playButtonClick, playGameStart } from './sound.js';
import { getVersion } from './version.js';
import { assignTeams, renderTeams, startTurn, itemFound, endTurn, showGameOver } from './game.js';
import { toggleFullscreen, updateFullscreenBtn, installPwa, initServiceWorker, initAutoFullscreen } from './pwa.js';

// ─── JOUEURS ───────────────────────────────────────────────────────────────────

function _loadPlayers() {
  try {
    const saved = localStorage.getItem(PLAYERS_KEY);
    if (saved) state.playerNames = JSON.parse(saved);
  } catch (_) {}
}

function _savePlayers() {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(state.playerNames));
}

function _renderPlayerList() {
  const list = el('player-list');
  const empty = el('player-empty-state');
  const countEl = el('player-count');
  const startBtn = el('btn-start-game');

  list.innerHTML = state.playerNames.map((name, i) => `
    <div class="player-item player-item--new" data-idx="${i}">
      <span class="player-item-avatar">👤</span>
      <span class="player-item-name">${_escHtml(name)}</span>
      <button class="btn-remove-player" data-idx="${i}" aria-label="Supprimer ${_escHtml(name)}">✕</button>
    </div>
  `).join('');

  if (empty) empty.hidden = state.playerNames.length > 0;
  if (countEl) countEl.textContent = state.playerNames.length > 0
    ? `${state.playerNames.length} joueur${state.playerNames.length > 1 ? 's' : ''}`
    : '';

  if (startBtn) startBtn.disabled = state.playerNames.length < MIN_PLAYERS;

  const hint = el('setup-hint');
  if (hint) hint.hidden = state.playerNames.length >= MIN_PLAYERS || state.playerNames.length === 0;
}

function _addPlayer(name) {
  name = name.trim();
  if (!name) return;
  if (state.playerNames.includes(name)) {
    showToast(`"${name}" est déjà dans la liste`, 'warning');
    return;
  }
  state.playerNames.push(name);
  _savePlayers();
  _renderPlayerList();
}

function _removePlayer(idx) {
  state.playerNames.splice(idx, 1);
  _savePlayers();
  _renderPlayerList();
}

// ─── RÉGLAGES ──────────────────────────────────────────────────────────────────

function _loadSettings() {
  try {
    const dur = parseInt(localStorage.getItem(TURN_DURATION_KEY), 10);
    state.turnDuration = isNaN(dur) ? TURN_DURATION_DEFAULT : Math.max(10, Math.min(120, dur));
  } catch (_) {
    state.turnDuration = TURN_DURATION_DEFAULT;
  }
  const input = el('turn-duration-input');
  if (input) input.value = state.turnDuration;
}

function _saveSettings() {
  localStorage.setItem(TURN_DURATION_KEY, String(state.turnDuration));
}

// ─── THEME ────────────────────────────────────────────────────────────────────
const THEME_KEY = 'template_theme';

function _applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = el('btn-theme');
  if (btn) {
    btn.textContent = theme === 'light' ? '🌙' : '☀️';
    btn.title = theme === 'light' ? 'Mode sombre' : 'Mode clair';
  }
}

function _toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  _applyTheme(next);
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────────

function _goToTeams() {
  if (state.playerNames.length < MIN_PLAYERS) {
    showToast(`Ajoutez au moins ${MIN_PLAYERS} joueurs`, 'warning');
    return;
  }
  assignTeams();
  renderTeams();
  showScreen('screen-teams');
}

function _startGame() {
  playGameStart();
  startTurn();
}

function _goToSetup() {
  showScreen('screen-setup', false);
}

// ─── UTILITAIRES ───────────────────────────────────────────────────────────────
function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── INITIALISATION ────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  // Chargement persistance
  _loadPlayers();
  _loadSettings();
  _applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  // PWA
  initAutoFullscreen();
  initServiceWorker();

  // Version
  const vEl = el('game-version');
  if (vEl) vEl.textContent = `v${getVersion()}`;

  // ── Écran setup ─────────────────────────────────────────────────────────────
  el('btn-start-game')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    _goToTeams();
  }));

  el('btn-add-player')?.addEventListener('click', withCooldown(() => {
    const input = el('player-input');
    _addPlayer(input.value);
    input.value = '';
    input.focus();
  }));

  el('player-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      _addPlayer(e.target.value);
      e.target.value = '';
    }
  });

  el('player-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove-player');
    if (btn) _removePlayer(parseInt(btn.dataset.idx, 10));
  });

  el('turn-duration-input')?.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 10 && v <= 120) {
      state.turnDuration = v;
      _saveSettings();
    }
  });

  // ── Contrôles globaux ───────────────────────────────────────────────────────
  el('btn-theme')?.addEventListener('click', () => { playButtonClick(); _toggleTheme(); });
  el('btn-mute')?.addEventListener('click', () => {
    setMuted(!getMuted());
    el('btn-mute').textContent = getMuted() ? '🔇' : '🔊';
  });
  el('btn-fullscreen')?.addEventListener('click', () => { toggleFullscreen(); updateFullscreenBtn(); });
  document.addEventListener('fullscreenchange',       updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

  el('btn-install-pwa')?.addEventListener('click', () => installPwa());

  // ── Écran teams ─────────────────────────────────────────────────────────────
  el('btn-play-now')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    _startGame();
  }));

  el('btn-back-from-teams')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    showScreen('screen-setup');
  }));

  // ── Écran turn ──────────────────────────────────────────────────────────────
  el('btn-found')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    itemFound();
  }));

  el('btn-end-turn')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    endTurn();
  }));

  // ── Écran turn-end ──────────────────────────────────────────────────────────
  el('btn-next-turn')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    startTurn();
  }));

  el('btn-game-over')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    showGameOver();
  }));

  // ── Écran game-over ─────────────────────────────────────────────────────────
  el('btn-play-again')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    // Réinitialiser les scores
    state.teams.forEach(t => { t.score = 0; });
    state.currentTeamIdx = 0;
    state.currentRound = 1;
    _goToTeams();
  }));

  el('btn-back-home')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    _goToSetup();
  }));

  // ── Navigation navigateur (bouton retour) ───────────────────────────────────
  window.addEventListener('popstate', e => {
    const screen = e.state?.screen || 'screen-setup';
    showScreen(screen, false);
  });

  // Afficher le premier écran
  _renderPlayerList();
  showScreen('screen-setup', false);
});

/**
 * main.js — Point d'entrée du jeu Pyramide
 *
 * Flux : setup → teams → pre-round → turn → turn-end → [correction] → round-end → … → game-over
 */

import {
  state, withCooldown,
  PLAYERS_KEY, TURN_DURATION_KEY, WORD_COUNT_KEY, ENABLE_ROUND5_KEY, THEME_KEY,
  TURN_DURATION_DEFAULT, WORD_COUNT_DEFAULT, MIN_PLAYERS,
} from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { setMuted, getMuted, playButtonClick, playGameStart } from './sound.js';
import { getVersion } from './version.js';
import {
  assignTeams, renderTeams, initGame, showPreRound,
  startTurn, wordFound, wordSkipped, wordContested, endTurn,
  startCorrectionPhase, castCorrectionVote, proceedAfterCorrection,
  nextRound, showGameOver,
} from './game.js';
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

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _renderPlayerList() {
  const list     = el('player-list');
  const empty    = el('player-empty-state');
  const countEl  = el('player-count');
  const startBtn = el('btn-start-game');

  list.innerHTML = state.playerNames.map((name, i) => `
    <div class="player-item player-item--new" data-idx="${i}">
      <span class="player-item-avatar">👤</span>
      <span class="player-item-name">${_escHtml(name)}</span>
      <button class="btn-remove-player" data-idx="${i}" aria-label="Supprimer ${_escHtml(name)}">✕</button>
    </div>
  `).join('');

  if (empty)    empty.hidden    = state.playerNames.length > 0;
  if (countEl)  countEl.textContent = state.playerNames.length > 0
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
    state.turnDuration = isNaN(dur) ? TURN_DURATION_DEFAULT : Math.max(10, Math.min(180, dur));
  } catch (_) { state.turnDuration = TURN_DURATION_DEFAULT; }

  try {
    const wc = parseInt(localStorage.getItem(WORD_COUNT_KEY), 10);
    state.wordCount = isNaN(wc) ? WORD_COUNT_DEFAULT : Math.max(5, Math.min(40, wc));
  } catch (_) { state.wordCount = WORD_COUNT_DEFAULT; }

  try {
    state.enableRound5 = localStorage.getItem(ENABLE_ROUND5_KEY) === 'true';
  } catch (_) { state.enableRound5 = false; }

  const durInput = el('turn-duration-input');
  if (durInput) durInput.value = state.turnDuration;

  const wcInput = el('word-count-input');
  if (wcInput) wcInput.value = state.wordCount;

  const r5Toggle = el('toggle-round5');
  if (r5Toggle) r5Toggle.checked = state.enableRound5;
}

function _saveSettings() {
  localStorage.setItem(TURN_DURATION_KEY, String(state.turnDuration));
  localStorage.setItem(WORD_COUNT_KEY,    String(state.wordCount));
  localStorage.setItem(ENABLE_ROUND5_KEY, String(state.enableRound5));
}

// ─── THÈME ────────────────────────────────────────────────────────────────────

function _applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = el('btn-theme');
  if (btn) {
    btn.textContent = theme === 'light' ? '🌙' : '☀️';
    btn.title       = theme === 'light' ? 'Mode sombre' : 'Mode clair';
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

function _goToSetup() {
  showScreen('screen-setup', false);
}

// ─── INITIALISATION ────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  _loadPlayers();
  _loadSettings();
  _applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  initAutoFullscreen();
  initServiceWorker();

  const vEl = el('game-version');
  if (vEl) vEl.textContent = `v${getVersion()}`;

  // ── Setup ─────────────────────────────────────────────────────────────────
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
    if (e.key === 'Enter') { _addPlayer(e.target.value); e.target.value = ''; }
  });

  el('player-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove-player');
    if (btn) _removePlayer(parseInt(btn.dataset.idx, 10));
  });

  el('turn-duration-input')?.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 10 && v <= 180) { state.turnDuration = v; _saveSettings(); }
  });

  el('word-count-input')?.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 5 && v <= 40) { state.wordCount = v; _saveSettings(); }
  });

  el('toggle-round5')?.addEventListener('change', e => {
    state.enableRound5 = e.target.checked;
    _saveSettings();
  });

  // Contrôles globaux
  el('btn-theme')?.addEventListener('click',      () => { playButtonClick(); _toggleTheme(); });
  el('btn-mute')?.addEventListener('click',       () => {
    setMuted(!getMuted());
    el('btn-mute').textContent = getMuted() ? '🔇' : '🔊';
  });
  el('btn-fullscreen')?.addEventListener('click', () => { toggleFullscreen(); updateFullscreenBtn(); });
  document.addEventListener('fullscreenchange',       updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);
  el('btn-install-pwa')?.addEventListener('click',    () => installPwa());

  // ── Teams ─────────────────────────────────────────────────────────────────
  el('btn-play-now')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    initGame();
  }));

  el('btn-back-from-teams')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    showScreen('screen-setup');
  }));

  // ── Pre-round ─────────────────────────────────────────────────────────────
  el('btn-start-round')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    startTurn();
  }));

  // ── Turn ──────────────────────────────────────────────────────────────────
  el('btn-found')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    wordFound();
  }));

  el('btn-skip')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    wordSkipped();
  }));

  el('btn-contest')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    wordContested();
  }));

  el('btn-end-turn')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    endTurn();
  }));

  // ── Turn-end ──────────────────────────────────────────────────────────────
  el('btn-go-correction')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    startCorrectionPhase();
  }));

  el('btn-next-from-turn-end')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    proceedAfterCorrection();
  }));

  // ── Correction ────────────────────────────────────────────────────────────
  el('correction-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.corr-btn');
    if (!btn) return;
    const idx     = parseInt(btn.dataset.idx, 10);
    const isValid = btn.dataset.valid === 'true';
    castCorrectionVote(idx, isValid);
  });

  el('btn-confirm-correction')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    proceedAfterCorrection();
  }));

  // ── Round-end ─────────────────────────────────────────────────────────────
  el('btn-next-round')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    nextRound();
  }));

  el('btn-round-end-gameover')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    showGameOver();
  }));

  // ── Game over ─────────────────────────────────────────────────────────────
  el('btn-play-again')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    state.teams.forEach(t => { t.score = 0; });
    state.currentTeamIdx = 0;
    state.currentRound   = 1;
    state.currentPhase   = 1;
    state.teamsPlayedThisRound = 0;
    assignTeams();
    renderTeams();
    showScreen('screen-teams');
  }));

  el('btn-back-home')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    _goToSetup();
  }));

  // ── Browser back button ───────────────────────────────────────────────────
  window.addEventListener('popstate', e => {
    const screen = e.state?.screen || 'screen-setup';
    showScreen(screen, false);
  });

  _renderPlayerList();
  showScreen('screen-setup', false);
});

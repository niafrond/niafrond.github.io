/**
 * main.js — Point d'entrée Pyramide
 *
 * Flux : setup → pre-round → turn (→ bidding / timer / final) → turn-end → game-over
 */

import { state, withCooldown, PLAYERS_KEY, R2_BUZZ_DELAY_KEY, MIN_PLAYERS } from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { setMuted, getMuted, playButtonClick, playGameStart } from './sound.js';
import { getVersion } from './version.js';
import {
  assignTeams, renderTeams, generateWordSets,
  triggerPreRoundStart, triggerNextTurn,
  startRound1,
  handleGiveClue, handleWordFound, handleWordSkip,
  r1SelectPhrase, r1CommitClues, r1LinkFound, r1LinkFailed, r1LinkPassDone, r1LinkReadDone,
  r3StartWord,
  r4WordFound, r4WordSkipped,
  finalWordFound, finalWordFailed, useBonusTime,
  showGameOver,
  selectBid, submitBid,
} from './game.js';
import { toggleFullscreen, updateFullscreenBtn, installPwa, initServiceWorker, initAutoFullscreen } from './pwa.js';

// ─── Players ───────────────────────────────────────────────────────────────────

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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _renderPlayerList() {
  const list     = el('player-list');
  const empty    = el('player-empty-state');
  const countEl  = el('player-count');
  const startBtn = el('btn-start-game');

  if (list) {
    list.innerHTML = state.playerNames.map((name, i) => `
      <div class="player-item player-item--new" data-idx="${i}">
        <span class="player-item-avatar">👤</span>
        <span class="player-item-name">${_escHtml(name)}</span>
        <button class="btn-remove-player" data-idx="${i}" aria-label="Supprimer ${_escHtml(name)}">✕</button>
      </div>
    `).join('');
  }

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

// ─── Theme ─────────────────────────────────────────────────────────────────────

const THEME_KEY = 'pyramide_theme';

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

// ─── Game start ────────────────────────────────────────────────────────────────

function _startGame() {
  if (state.playerNames.length < MIN_PLAYERS) {
    showToast(`Ajoutez au moins ${MIN_PLAYERS} joueurs`, 'warning');
    return;
  }
  playGameStart();
  assignTeams();
  generateWordSets();

  // Reset scores for a fresh game
  state.teams.forEach(t => { t.score = 0; });

  startRound1();
}

function _resetGame() {
  state.teams.forEach(t => { t.score = 0; });
  state.currentRound = 0;
  state.playerNames = [];
  _savePlayers();
  _renderPlayerList();
  showScreen('screen-setup');
}

// ─── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  _loadPlayers();
  // Charger le réglage du délai buzz Ping-Pong
  const savedBuzzDelay = parseInt(localStorage.getItem(R2_BUZZ_DELAY_KEY), 10);
  if (!isNaN(savedBuzzDelay) && savedBuzzDelay >= 5) state.r2BuzzDelay = savedBuzzDelay;
  const buzzInput = document.getElementById('r2-buzz-delay');
  if (buzzInput) {
    buzzInput.value = state.r2BuzzDelay;
    buzzInput.addEventListener('change', () => {
      const v = Math.max(5, Math.min(120, parseInt(buzzInput.value, 10) || 15));
      buzzInput.value = v;
      state.r2BuzzDelay = v;
      localStorage.setItem(R2_BUZZ_DELAY_KEY, v);
    });
  }
  _applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  initAutoFullscreen();
  initServiceWorker();

  const vEl = el('game-version');
  if (vEl) vEl.textContent = `v${getVersion()}`;

  // ── Setup screen ────────────────────────────────────────────────────────────
  el('btn-start-game')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    _startGame();
  }));

  el('btn-add-player')?.addEventListener('click', withCooldown(() => {
    const input = el('player-input');
    if (!input) return;
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

  // ── Global controls ─────────────────────────────────────────────────────────
  el('btn-theme')?.addEventListener('click', () => { playButtonClick(); _toggleTheme(); });
  el('btn-mute')?.addEventListener('click', () => {
    setMuted(!getMuted());
    const btn = el('btn-mute');
    if (btn) btn.textContent = getMuted() ? '🔇' : '🔊';
  });
  el('btn-fullscreen')?.addEventListener('click', () => { toggleFullscreen(); updateFullscreenBtn(); });
  document.addEventListener('fullscreenchange',       updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);
  el('btn-install-pwa')?.addEventListener('click', () => installPwa());

  // ── Pre-round screen ────────────────────────────────────────────────────────
  el('btn-pre-round-start')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    triggerPreRoundStart();
  }));

  // ── R1 Phrase selection screen ───────────────────────────────────────────────
  el('r1-phrase-list')?.addEventListener('click', withCooldown(e => {
    const btn = e.target.closest('.r1-phrase-btn');
    if (!btn) return;
    playButtonClick();
    r1SelectPhrase(parseInt(btn.dataset.idx, 10));
  }));

  // ── R1 Commit section (inside screen-turn) ────────────────────────────────
  el('r1-commit-section')?.addEventListener('click', withCooldown(e => {
    const btn = e.target.closest('.r1-commit-btn');
    if (!btn || btn.disabled) return;
    playButtonClick();
    r1CommitClues(parseInt(btn.dataset.n, 10));
  }));

  // ── R1 Link phase screen ─────────────────────────────────────────────────────
  el('btn-r1-pass-done')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    r1LinkPassDone();
  }));

  el('btn-r1-read-done')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    r1LinkReadDone();
  }));
  el('btn-r1-link-found')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    r1LinkFound();
  }));

  el('btn-r1-link-failed')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    r1LinkFailed();
  }));

  // ── Turn screen (R1, R2, R3) ────────────────────────────────────────────────
  el('btn-give-clue')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    handleGiveClue();
  }));

  el('btn-word-found')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    handleWordFound();
  }));

  el('btn-word-skip')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    handleWordSkip();
  }));

  // ── Turn-end screen ─────────────────────────────────────────────────────────
  el('btn-next-sub-turn')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    triggerNextTurn();
  }));

  // ── Bidding screen (R3) ─────────────────────────────────────────────────────
  document.querySelectorAll('.bid-btn-a').forEach(btn => {
    btn.addEventListener('click', withCooldown(() => {
      playButtonClick();
      selectBid(0, parseInt(btn.dataset.bid, 10));
    }));
  });

  document.querySelectorAll('.bid-btn-b').forEach(btn => {
    btn.addEventListener('click', withCooldown(() => {
      playButtonClick();
      selectBid(1, parseInt(btn.dataset.bid, 10));
    }));
  });

  el('btn-bid-confirm-a')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    submitBid(0);
  }));

  el('btn-bid-confirm-b')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    submitBid(1);
  }));
  el('btn-r3-start')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    r3StartWord();
  }));
  // ── Timer screen (R4) ───────────────────────────────────────────────────────
  el('btn-timer-found')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    r4WordFound();
  }));

  el('btn-timer-skip')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    r4WordSkipped();
  }));

  // ── Final screen ─────────────────────────────────────────────────────────────
  el('btn-final-found')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    finalWordFound();
  }));

  el('btn-final-failed')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    finalWordFailed();
  }));

  el('btn-final-bonus')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    useBonusTime();
  }));

  // ── Game-over screen ─────────────────────────────────────────────────────────
  el('btn-play-again')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    _resetGame();
  }));

  el('btn-back-home')?.addEventListener('click', withCooldown(() => {
    playButtonClick();
    _resetGame();
  }));

  // ── Back button ──────────────────────────────────────────────────────────────
  window.addEventListener('popstate', e => {
    const screen = e.state?.screen || 'screen-setup';
    showScreen(screen, false);
  });

  _renderPlayerList();
  showScreen('screen-setup', false);
});

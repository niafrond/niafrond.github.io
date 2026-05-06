/**
 * main.js — Point d'entrée de Geo Party
 *
 * Routing URL :
 *   /geo-party/          → HOST (crée la session)
 *   /geo-party/?host=ID  → CLIENT (rejoint la session)
 */

import { GeoPeer }              from './peer.js';
import {
  state, PHASES, MSG,
  STORAGE_KEY_SETTINGS,
  TIMER_DEFAULT, ROUNDS_DEFAULT, HOST_ID,
}                               from './state.js';
import {
  initGame, addHostPlayer,
  handleClientJoin, handlePlayerLeave,
  handleClientMessage, startGame, submitGuess,
  skipResults, restartGame,
}                               from './game.js';
import {
  el, showScreen, showToast,
  renderLobby, renderWaiting,
  renderPreRound, renderRound, renderResults, renderGameOver,
  updateTimerBar, initGuessMap, resetGuessMap,
  hasGuessMarker, getGuessCoords, initResultsMap, onScreenChange,
}                               from './ui.js';
import { getMuted, setMuted }   from './sound.js';
import { getVersion }           from './version.js';
import { pickLocations }        from './locations.js';
import {
  installPwa, initAutoFullscreen, initServiceWorker, toggleFullscreen,
}                               from './pwa.js';

// ─── Routing ──────────────────────────────────────────────────────────────────
const params     = new URLSearchParams(location.search);
const hostPeerId = params.get('host');
export const isHost = !hostPeerId;

const peer = new GeoPeer();

// ─── Rendu selon la phase ────────────────────────────────────────────────────

async function renderForRole(s, asHost) {
  switch (s.phase) {
    case PHASES.LOBBY:
      if (asHost) {
        const url = `${location.origin}${location.pathname}?host=${peer.peerId}`;
        renderLobby(peer.peerId, url, s.players, s.players.length >= 1);
        showScreen('screen-lobby');
      } else {
        renderWaiting(s.players);
        showScreen('screen-waiting');
      }
      break;

    case PHASES.PRE_ROUND:
      renderPreRound(s);
      showScreen('screen-pre-round');
      break;

    case PHASES.GUESSING:
      showScreen('screen-round');
      renderRound(s, asHost);
      _myGuessConfirmed = false;
      _pendingGuess     = null;
      // Init map only once when entering guessing
      if (!_guessMapReady) {
        _guessMapReady = true;
        await initGuessMap(_onMapClick);
      } else {
        resetGuessMap();
      }
      _updateConfirmBtn();
      break;

    case PHASES.RESULTS:
      showScreen('screen-results');
      renderResults(s);
      if (s.currentLocation?.lat != null) {
        await initResultsMap(s.players, s.currentLocation.lat, s.currentLocation.lng);
      }
      const skipBtn = el('btn-skip-results');
      if (skipBtn) skipBtn.hidden = !asHost;
      break;

    case PHASES.GAME_OVER:
      showScreen('screen-game-over');
      renderGameOver(s, asHost);
      break;
  }
}

// ─── Map interaction (GUESSING) ────────────────────────────────────────────────

let _guessMapReady      = false;
let _myGuessConfirmed   = false;
let _pendingGuess       = null; // { lat, lng }

function _onMapClick(lat, lng) {
  if (_myGuessConfirmed) return;
  _pendingGuess = { lat, lng };
  _updateConfirmBtn();
}

function _updateConfirmBtn() {
  const btn = el('btn-confirm-guess');
  if (!btn) return;
  const hasMark = _pendingGuess !== null || hasGuessMarker();
  btn.disabled    = _myGuessConfirmed || !hasMark;
  if (_myGuessConfirmed) {
    btn.textContent = '✅ Deviné !';
  } else if (hasMark) {
    btn.textContent = '📍 Confirmer ma réponse';
  } else {
    btn.textContent = '📍 Cliquez sur la carte pour deviner';
  }
}

function _confirmGuess() {
  if (_myGuessConfirmed) return;
  const coords = _pendingGuess || getGuessCoords();
  if (!coords) { showToast('Placez une épingle sur la carte !', 'error'); return; }

  _myGuessConfirmed = true;
  _updateConfirmBtn();

  if (isHost) {
    submitGuess(HOST_ID, coords.lat, coords.lng);
  } else {
    peer.sendToHost({ type: MSG.GUESS, lat: coords.lat, lng: coords.lng });
  }
}

// ─── Timer bar HOST ────────────────────────────────────────────────────────────

function _onTick(value, kind) {
  if (kind === 'round') updateTimerBar(value, state.timerDuration);
  if (kind === 'countdown') {
    const numEl = el('pre-round-number');
    if (numEl) numEl.textContent = value;
  }
}

// ─── Flow HOST ────────────────────────────────────────────────────────────────

async function initHostFlow() {
  _loadPersistedSettings();
  const vEl = el('game-version');
  if (vEl) vEl.textContent = `v${getVersion()}`;
  _initSetupControls();
  showScreen('screen-setup');
}

function _loadPersistedSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    if (s.timer)  el('sel-timer').value  = String(s.timer);
    if (s.rounds) el('sel-rounds').value = String(s.rounds);
    if (s.name)   el('input-host-name').value = s.name;
  } catch { /* ignore */ }
}

function _saveSettings() {
  const name   = el('input-host-name').value.trim() || 'Hôte';
  const timer  = parseInt(el('sel-timer').value, 10);
  const rounds = parseInt(el('sel-rounds').value, 10);
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({ name, timer, rounds }));
  return { name, timer, rounds };
}

async function _createSession() {
  const { name, timer, rounds } = _saveSettings();

  // Ajouter le joueur HOST
  addHostPlayer(name);
  state.timerDuration = timer;
  state.totalRounds   = rounds;

  showScreen('screen-lobby');

  try {
    await peer.startHost();
  } catch (err) {
    showToast('Impossible de créer la session : ' + err.message, 'error');
    showScreen('screen-setup');
    return;
  }

  peer.addEventListener('ready', () => {
    const url = `${location.origin}${location.pathname}?host=${peer.peerId}`;
    renderLobby(peer.peerId, url, state.players, false);
    el('btn-copy-url').addEventListener('click', () => {
      navigator.clipboard.writeText(url)
        .then(() => showToast('Lien copié !', 'success'))
        .catch(() => showToast('Copie impossible', 'error'));
    }, { once: true });
  });

  peer.addEventListener('player-join', (e) => {
    // Le JOIN réel arrive dans le message MSG.JOIN
  });

  peer.addEventListener('player-leave', (e) => {
    const { peerId } = e.detail;
    handlePlayerLeave(peerId);
    if (state.phase === PHASES.LOBBY) {
      const url = `${location.origin}${location.pathname}?host=${peer.peerId}`;
      renderLobby(peer.peerId, url, state.players, state.players.length >= 1);
    }
    showToast('Un joueur a quitté la partie', 'error');
  });

  peer.addEventListener('message', (e) => {
    const { from, data } = e.detail;
    handleClientMessage(from, data);
    // Après handleClientMessage, _syncAll() est appelé → _onStateChange → renderForRole
  });

  peer.addEventListener('error', (e) => {
    showToast('Erreur réseau : ' + (e.detail.err?.message ?? ''), 'error');
  });
}

function _hostStartGame() {
  if (state.players.length < 2) {
    showToast('Attendez au moins un autre joueur !', 'error');
    return;
  }
  const { rounds, timer } = _saveSettings();
  const locs = pickLocations(rounds);
  startGame(locs, rounds, timer);
}

// ─── Flow CLIENT ──────────────────────────────────────────────────────────────

async function initClientFlow(hostId) {
  showScreen('screen-join');

  el('btn-join').addEventListener('click', async () => {
    const name = el('input-client-name').value.trim() || 'Joueur';
    el('join-status').textContent = 'Connexion en cours…';
    el('btn-join').disabled = true;

    try {
      await peer.joinHost(hostId);
    } catch (err) {
      el('join-status').textContent = 'Erreur : ' + err.message;
      el('btn-join').disabled = false;
      return;
    }

    peer.addEventListener('ready', () => {
      peer.sendToHost({ type: MSG.JOIN, name });
      el('join-status').textContent = 'Connecté ! En attente du début…';
      showScreen('screen-waiting');
    });

    peer.addEventListener('message', (e) => {
      const data = e.detail.data;
      if (data.type === MSG.SYNC) {
        Object.assign(state, data.state);
        state.players = data.state.players;
        renderForRole(data.state, false);
      } else if (data.type === MSG.TICK) {
        state.timeLeft = data.timeLeft;
        updateTimerBar(data.timeLeft, state.timerDuration);
      }
    });

    peer.addEventListener('player-leave', () => {
      showToast('Connexion perdue avec le serveur', 'error');
    });

    peer.addEventListener('error', (e) => {
      showToast('Erreur : ' + (e.detail.err?.message ?? ''), 'error');
    });
  });
}

// ─── Buttons wiring ───────────────────────────────────────────────────────────

function _wireActions() {
  // Setup → create session
  el('btn-create-game').addEventListener('click', _createSession);

  // Lobby → start game (HOST only)
  el('btn-start-game').addEventListener('click', _hostStartGame);

  // Round → confirm guess
  el('btn-confirm-guess').addEventListener('click', _confirmGuess);

  // Results → skip (HOST only)
  el('btn-skip-results').addEventListener('click', () => {
    if (isHost) skipResults();
  });

  // Game over → replay (HOST only)
  el('btn-replay').addEventListener('click', () => {
    if (!isHost) return;
    const { rounds, timer } = _saveSettings();
    state.timerDuration = timer;
    state.totalRounds   = rounds;
    const locs = pickLocations(rounds);
    _guessMapReady = false;
    restartGame(locs);
  });

  // PWA install
  el('btn-install-pwa')?.addEventListener('click', () => installPwa());
}

// ─── Setup screen controls ────────────────────────────────────────────────────

function _initSetupControls() {
  // Theme
  const saved = localStorage.getItem('geoparty_theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  _applyThemeBtn(saved);

  el('btn-theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('geoparty_theme', next);
    _applyThemeBtn(next);
  });

  el('btn-fullscreen').addEventListener('click', toggleFullscreen);

  el('btn-mute').addEventListener('click', () => {
    const m = !getMuted();
    setMuted(m);
    el('btn-mute').textContent = m ? '🔇' : '🔊';
    localStorage.setItem('geoparty_muted', m ? '1' : '0');
  });
  if (localStorage.getItem('geoparty_muted') === '1') {
    setMuted(true);
    el('btn-mute').textContent = '🔇';
  }
}

function _applyThemeBtn(theme) {
  const btn = el('btn-theme');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAutoFullscreen();
  initServiceWorker();

  initGame(
    peer,
    async (snap) => renderForRole(snap, true),
    _onTick,
  );

  _wireActions();

  if (isHost) {
    initHostFlow();
  } else {
    initClientFlow(hostPeerId);
  }
});

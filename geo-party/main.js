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
  STORAGE_KEY_SETTINGS, STORAGE_KEY_TOKEN,
  TIMER_DEFAULT, ROUNDS_DEFAULT, HOST_ID,
}                               from './state.js';
import {
  initGame, addHostPlayer,
  handleClientJoin, handlePlayerLeave,
  handleClientMessage, startGame, submitGuess,
  skipResults, restartGame, prepareRoundLocations,
}                               from './game.js';
import {
  el, showScreen, showToast,
  renderLobby, renderWaiting,
  renderPreRound, renderRound, renderResults, renderGameOver,
  updateTimerBar, initGuessMap, resetGuessMap,
  hasGuessMarker, getGuessCoords, initResultsMap, onScreenChange,
  setMapillaryToken, showMapillaryImage, destroyMapillaryViewer,
  invalidateGuessMap,
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

    case PHASES.GUESSING: {
      showScreen('screen-round');
      renderRound(s);
      _myGuessConfirmed = false;
      _pendingGuess     = null;
      _collapseMap();
      if (!_guessMapReady) {
        _guessMapReady = true;
        await initGuessMap(_onMapClick);
      } else {
        resetGuessMap();
      }
      // Sync token de l'hôte (reçu via snapshot pour les clients)
      if (s.mapillaryToken) setMapillaryToken(s.mapillaryToken);
      await showMapillaryImage(s.currentLocation?.mapillaryId);
      _updateConfirmBtn();
      break;
    }

    case PHASES.RESULTS:
      destroyMapillaryViewer();
      showScreen('screen-results');
      renderResults(s);
      if (s.currentLocation?.lat != null) {
        await initResultsMap(s.players, s.currentLocation.lat, s.currentLocation.lng);
      }
      { const skipBtn = el('btn-skip-results');
        if (skipBtn) skipBtn.hidden = !asHost; }
      break;

    case PHASES.GAME_OVER:
      destroyMapillaryViewer();
      showScreen('screen-game-over');
      renderGameOver(s, asHost);
      break;
  }
}

// ─── Map interaction (GUESSING) ────────────────────────────────────────────────

let _guessMapReady      = false;
let _myGuessConfirmed   = false;
let _pendingGuess       = null; // { lat, lng }
let _mapExpanded        = false;

function _onMapClick(lat, lng) {
  if (_myGuessConfirmed) return;
  _pendingGuess = { lat, lng };
  _updateConfirmBtn();
}

function _updateConfirmBtn() {
  const btn = el('btn-confirm-guess');
  if (!btn) return;
  const hasMark = _pendingGuess !== null || hasGuessMarker();
  btn.disabled = _myGuessConfirmed || !hasMark;
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

// ─── Map overlay expand/collapse ────────────────────────────────────────────

function _collapseMap() {
  _mapExpanded = false;
  const overlay = el('map-overlay');
  const btn     = el('btn-expand-map');
  if (overlay) overlay.classList.remove('map-expanded');
  if (btn)     btn.textContent = '⛶';
}

function _toggleMap(e) {
  e.stopPropagation();
  _mapExpanded = !_mapExpanded;
  const overlay = el('map-overlay');
  const btn     = el('btn-expand-map');
  if (overlay) overlay.classList.toggle('map-expanded', _mapExpanded);
  if (btn)     btn.textContent = _mapExpanded ? '✕' : '⛶';
  // Recalcul taille Leaflet après transition CSS
  setTimeout(() => invalidateGuessMap(), 320);
}

// ─── Timer bar HOST ────────────────────────────────────────────────────────────

function _onTick(value, kind) {
  if (kind === 'round') updateTimerBar(value, state.timerDuration);
  if (kind === 'countdown') {
    const numEl = el('pre-round-number');
    if (numEl) numEl.textContent = value;
  }
}

// ─── Pré-chargement des panoramas (lobby) ─────────────────────────────────────

/** Nombre de lieux candidats supplémentaires pour garantir assez de panoramas viables. */
const EXTRA_LOC_CANDIDATES = 8;

let _preloadPromise = null; // Promise<object[]>
let _preloadRounds  = null;
let _preloadToken   = null;

/** Lance la résolution Mapillary en arrière-plan dès que la session est créée. */
function _startPreload(rounds, token) {
  _preloadRounds  = rounds;
  _preloadToken   = token;
  const rawLocs   = pickLocations(rounds + EXTRA_LOC_CANDIDATES);
  _preloadPromise = prepareRoundLocations(rawLocs, rounds, token);

  // Mettre à jour l'indicateur de statut dans le lobby
  const statusEl = el('lobby-preload-status');
  if (statusEl) statusEl.textContent = '⏳ Chargement des panoramas en arrière-plan…';

  _preloadPromise.then(() => {
    const s = el('lobby-preload-status');
    if (s) s.textContent = '✅ Panoramas prêts !';
  }).catch(() => {
    const s = el('lobby-preload-status');
    if (s) s.textContent = '⚠️ Impossible de précharger les panoramas.';
  });
}

/**
 * Retourne les lieux préchargés si disponibles et compatibles,
 * sinon les récupère à la demande.
 */
async function _getLocations(rounds, token) {
  if (_preloadPromise && _preloadRounds === rounds && _preloadToken === token) {
    const locs      = await _preloadPromise;
    _preloadPromise = null; // consommer le cache
    return locs;
  }
  const rawLocs = pickLocations(rounds + EXTRA_LOC_CANDIDATES);
  return prepareRoundLocations(rawLocs, rounds, token);
}

// ─── Flow HOST ────────────────────────────────────────────────────────────────

async function initHostFlow() {
  _loadPersistedSettings();
  const vEl = el('game-version');
  if (vEl) vEl.textContent = `v${getVersion()}`;
  _initSetupControls();
  showScreen('screen-setup');
}

// Token Mapillary par défaut (client access token, utilisé côté navigateur)
const DEFAULT_MAPILLARY_TOKEN = 'MLY|27736853439250253|def00cd1848cdcedd08fa8ce951b0d27';

function _loadPersistedSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    if (s.timer)  el('sel-timer').value  = String(s.timer);
    if (s.rounds) el('sel-rounds').value = String(s.rounds);
    if (s.name)   el('input-host-name').value = s.name;
    const token = localStorage.getItem(STORAGE_KEY_TOKEN) || DEFAULT_MAPILLARY_TOKEN;
    el('input-mapillary-token').value = token;
  } catch { /* ignore */ }
}

function _saveSettings() {
  const name   = el('input-host-name').value.trim() || 'Hôte';
  const timer  = parseInt(el('sel-timer').value, 10);
  const rounds = parseInt(el('sel-rounds').value, 10);
  const token  = el('input-mapillary-token').value.trim();
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({ name, timer, rounds }));
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  return { name, timer, rounds, token };
}

async function _createSession() {
  const { name, timer, rounds, token } = _saveSettings();

  // Ajouter le joueur HOST
  addHostPlayer(name);
  state.timerDuration = timer;
  state.totalRounds   = rounds;

  showScreen('screen-lobby');

  // Lancer le pré-chargement des panoramas dès l'entrée dans le lobby
  _startPreload(rounds, token);

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
  });

  peer.addEventListener('error', (e) => {
    showToast('Erreur réseau : ' + (e.detail.err?.message ?? ''), 'error');
  });
}

async function _hostStartGame() {
  if (state.players.length < 2) {
    showToast('Attendez au moins un autre joueur !', 'error');
    return;
  }
  const { rounds, timer, token } = _saveSettings();

  // Récupérer les IDs Mapillary (préchargés ou à la demande)
  const btn = el('btn-start-game');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Chargement des panoramas…'; }

  const locs = await _getLocations(rounds, token);

  if (btn) { btn.disabled = false; btn.textContent = '🚀 Démarrer la partie'; }

  // Stocker token dans l'état pour partage via SYNC
  state.mapillaryToken = token || null;
  setMapillaryToken(token);

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
        // Appliquer le token Mapillary de l'hôte
        if (data.state.mapillaryToken) setMapillaryToken(data.state.mapillaryToken);
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

  // Round → expand/collapse map overlay
  el('btn-expand-map').addEventListener('click', _toggleMap);

  // Results → skip (HOST only)
  el('btn-skip-results').addEventListener('click', () => {
    if (isHost) skipResults();
  });

  // Game over → replay (HOST only)
  el('btn-replay').addEventListener('click', async () => {
    if (!isHost) return;
    const { rounds, timer, token } = _saveSettings();
    state.timerDuration = timer;
    state.totalRounds   = rounds;

    const btn = el('btn-replay');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Chargement…'; }

    const rawLocs = pickLocations(rounds + EXTRA_LOC_CANDIDATES);
    const locs    = await prepareRoundLocations(rawLocs, rounds, token);

    if (btn) { btn.disabled = false; btn.textContent = '🔄 Rejouer'; }

    state.mapillaryToken = token || null;
    setMapillaryToken(token);
    _guessMapReady = false;
    restartGame(locs);
  });

  // PWA install
  el('btn-install-pwa')?.addEventListener('click', () => installPwa());
}

// ─── Setup screen controls ────────────────────────────────────────────────────

function _initSetupControls() {
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

/**
 * main.js — Point d'entrée du jeu Taboo
 *
 * Routing URL :
 *   /taboo/          → rôle HOST (crée la session, setup)
 *   /taboo/?host=ID  → rôle CLIENT (rejoint la session de l'host)
 *
 * Le HOST est la source de vérité. Le CLIENT est un miroir réactif.
 */

import { TabooPeer }                 from './peer.js';
import { state, PHASES, MSG,
         STORAGE_KEY_TEAMS,
         STORAGE_KEY_SETTINGS }      from './state.js';
import {
  initGame, setupCards,
  setHostReady, nextTurn, resetGame,
  handleClientMessage,
  onFound, onPass, onBuzz,
}                                     from './game.js';
import {
  el, showScreen, showToast,
  renderHostLobby, renderClientConnect,
  renderPreTurn, renderTurnGiver, renderTurnJudge,
  renderTurnEnd, renderGameOver,
  updateTimerBar,
}                                     from './ui.js';
import { getMuted, setMuted }         from './sound.js';
import { getVersion }                 from './version.js';
import {
  installPwa, initAutoFullscreen, initServiceWorker, toggleFullscreen,
}                                     from './pwa.js';

// ─── Routing ──────────────────────────────────────────────────────────────────
const params     = new URLSearchParams(location.search);
const hostPeerId = params.get('host');
export const isHost = !hostPeerId;

const peer = new TabooPeer();

// ─── Rendu selon l'état ───────────────────────────────────────────────────────

/**
 * Rend l'interface en fonction de la phase courante.
 * @param {object} s       snapshot de l'état (ou state lui-même pour le HOST)
 * @param {boolean} asHost true si on rend pour le HOST
 */
function renderForRole(s, asHost) {
  // Qui est donneur ? currentTeamIdx 0 → HOST, 1 → CLIENT
  const myTeamIdx = asHost ? 0 : 1;
  const isGiver   = myTeamIdx === s.currentTeamIdx;

  switch (s.phase) {
    case PHASES.PRE_TURN:
      showScreen('screen-pre-turn');
      renderPreTurn(s, asHost);
      break;

    case PHASES.TURN:
      if (isGiver) {
        showScreen('screen-turn-giver');
        renderTurnGiver(s);
      } else {
        showScreen('screen-turn-judge');
        renderTurnJudge(s);
      }
      break;

    case PHASES.TURN_END:
      showScreen('screen-turn-end');
      renderTurnEnd(s, asHost);
      break;

    case PHASES.GAME_OVER:
      showScreen('screen-game-over');
      renderGameOver(s, asHost);
      break;
  }
}

// ─── Timer bar : mise à jour légère (évite un re-rendu complet) ──────────────

function _onHostTick(timeLeft) {
  updateTimerBar(timeLeft, state.timerDuration);
  // Sync also the judge's timer bar elements if they exist
  const barJ   = el('timer-bar-j');
  const labelJ = el('timer-label-j');
  if (barJ) {
    const pct = state.timerDuration > 0 ? (timeLeft / state.timerDuration) * 100 : 0;
    barJ.style.width = `${pct}%`;
    barJ.className   = 'timer-bar';
    if (timeLeft <= 5)       barJ.classList.add('timer-urgent');
    else if (timeLeft <= 10) barJ.classList.add('timer-warning');
  }
  if (labelJ) labelJ.textContent = timeLeft;
}

// ─── Flow HOST ────────────────────────────────────────────────────────────────

async function initHostFlow() {
  _loadPersistedSettings();
  showScreen('screen-setup');
  _initSetupControls();

  el('btn-create-game').addEventListener('click', _createSession);
}

function _loadPersistedSettings() {
  try {
    const teams = JSON.parse(localStorage.getItem(STORAGE_KEY_TEAMS) || '[]');
    if (teams[0]) el('input-team-a').value = teams[0];
    if (teams[1]) el('input-team-b').value = teams[1];
  } catch { /* ignore */ }

  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    if (s.timer)  el('sel-timer').value  = String(s.timer);
    if (s.rounds) el('sel-rounds').value = String(s.rounds);
  } catch { /* ignore */ }
}

function _saveSettings() {
  const nameA  = el('input-team-a').value.trim() || 'Équipe Rouge';
  const nameB  = el('input-team-b').value.trim() || 'Équipe Bleue';
  const timer  = parseInt(el('sel-timer').value,  10);
  const rounds = parseInt(el('sel-rounds').value, 10);

  state.teams[0].name  = nameA;
  state.teams[1].name  = nameB;
  state.timerDuration  = timer;
  state.totalRounds    = rounds;
  state.timeLeft       = timer;

  localStorage.setItem(STORAGE_KEY_TEAMS,    JSON.stringify([nameA, nameB]));
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({ timer, rounds }));
}

async function _createSession() {
  _saveSettings();
  showScreen('screen-host-lobby');

  try {
    await peer.startHost();
  } catch (err) {
    showToast('Impossible de créer la session : ' + err.message, 'error');
    showScreen('screen-setup');
    return;
  }

  peer.addEventListener('ready', (e) => {
    const { peerId } = e.detail;
    const url = `${location.origin}${location.pathname}?host=${peerId}`;
    renderHostLobby(peerId, url);

    // Copy-URL button (registered once after lobby is rendered)
    el('btn-copy-url').addEventListener('click', () => {
      navigator.clipboard.writeText(url)
        .then(() => showToast('Lien copié !', 'success'))
        .catch(() => showToast('Copie impossible', 'error'));
    }, { once: true });
  });

  peer.addEventListener('player-join', async () => {
    showToast("L'autre téléphone est connecté !", 'success');
    const allCards = await _loadCards();
    setupCards(allCards);
    state.phase       = PHASES.PRE_TURN;
    state.hostReady   = false;
    state.clientReady = false;
    renderForRole(state, true);
    // Broadcast initial state to the newly joined client
    peer.broadcast({ type: MSG.SYNC, state: _stateSnap() });
  });

  peer.addEventListener('player-leave', () => {
    if (state.phase !== PHASES.LOBBY && state.phase !== PHASES.GAME_OVER) {
      showToast("L'autre téléphone s'est déconnecté", 'error');
    }
  });

  peer.addEventListener('message', (e) => {
    handleClientMessage(e.detail.data);
    // game.js calls syncAll() which triggers _onStateChange → renderForRole handled there
  });

  peer.addEventListener('error', (e) => {
    showToast('Erreur réseau : ' + (e.detail.err?.message ?? ''), 'error');
  });
}

// Helper: snapshot without internal state (same as game.js _snapshot)
function _stateSnap() {
  return {
    phase:          state.phase,
    teams:          state.teams.map(t => ({ name: t.name, score: t.score })),
    currentTeamIdx: state.currentTeamIdx,
    currentRound:   state.currentRound,
    totalRounds:    state.totalRounds,
    timerDuration:  state.timerDuration,
    timeLeft:       state.timeLeft,
    currentCard:    state.currentCard
      ? { ...state.currentCard, taboo: [...state.currentCard.taboo] }
      : null,
    turnStats:      { ...state.turnStats },
    hostReady:      state.hostReady,
    clientReady:    state.clientReady,
  };
}

// ─── Flow CLIENT ──────────────────────────────────────────────────────────────

async function initClientFlow(hostId) {
  showScreen('screen-client-connect');
  renderClientConnect('Connexion en cours…');

  try {
    await peer.joinHost(hostId);
  } catch (err) {
    renderClientConnect('Erreur : ' + err.message, true);
    return;
  }

  peer.addEventListener('ready', () => {
    renderClientConnect('Connecté ! En attente du début de partie…');
  });

  peer.addEventListener('message', (e) => {
    const data = e.detail.data;

    if (data.type === MSG.SYNC) {
      // Update local state copy for CLIENT-side rendering
      Object.assign(state, data.state);
      // teams is an array of plain objects, assign properly
      data.state.teams.forEach((t, i) => {
        state.teams[i].name  = t.name;
        state.teams[i].score = t.score;
      });
      renderForRole(data.state, false);

    } else if (data.type === MSG.TICK) {
      state.timeLeft = data.timeLeft;
      // Update both possible timer bars (giver or judge, we don't know which is visible)
      _updateClientTimer(data.timeLeft, state.timerDuration);
    }
  });

  peer.addEventListener('player-leave', () => {
    showToast("Connexion perdue avec l'hôte", 'error');
  });

  peer.addEventListener('error', (e) => {
    showToast('Erreur réseau : ' + (e.detail.err?.message ?? ''), 'error');
  });
}

function _updateClientTimer(timeLeft, duration) {
  // Update whichever timer bars exist in the current screen
  const pct = duration > 0 ? (timeLeft / duration) * 100 : 0;

  ['timer-bar', 'timer-bar-j'].forEach(id => {
    const bar = el(id);
    if (!bar || bar.closest('[hidden]')) return;
    bar.style.width  = `${pct}%`;
    bar.className    = 'timer-bar';
    if (timeLeft <= 5)       bar.classList.add('timer-urgent');
    else if (timeLeft <= 10) bar.classList.add('timer-warning');
  });

  ['timer-label', 'timer-label-j'].forEach(id => {
    const lbl = el(id);
    if (lbl && !lbl.closest('[hidden]')) lbl.textContent = timeLeft;
  });
}

// ─── Game action wiring (both HOST and CLIENT) ────────────────────────────────

function _wireGameActions() {
  // Pre-turn: ready
  el('btn-ready').addEventListener('click', () => {
    if (isHost) {
      setHostReady();
    } else {
      peer.sendToHost({ type: MSG.READY });
      // Disable the button optimistically on CLIENT side
      el('btn-ready').disabled     = true;
      el('btn-ready').textContent  = '✅ Prêt !';
      el('pre-turn-wait').hidden   = false;
    }
  });

  // Turn giver: found
  el('btn-found').addEventListener('click', () => {
    if (isHost) {
      onFound();
    } else {
      peer.sendToHost({ type: MSG.FOUND });
    }
  });

  // Turn giver: pass
  el('btn-pass').addEventListener('click', () => {
    if (isHost) {
      onPass();
    } else {
      peer.sendToHost({ type: MSG.PASS });
    }
  });

  // Turn judge: buzz
  el('btn-buzz').addEventListener('click', () => {
    if (isHost) {
      onBuzz();
    } else {
      peer.sendToHost({ type: MSG.BUZZ });
    }
  });

  // Turn end: next turn (HOST only shown)
  el('btn-next-turn').addEventListener('click', () => {
    if (isHost) nextTurn();
  });

  // Game over: replay (HOST only shown)
  el('btn-replay').addEventListener('click', () => {
    if (isHost) resetGame();
  });
}

// ─── Setup screen controls ────────────────────────────────────────────────────

function _initSetupControls() {
  const vEl = el('game-version');
  if (vEl) vEl.textContent = `v${getVersion()}`;

  // Theme
  const savedTheme = localStorage.getItem('taboo_theme') || 'dark';
  document.documentElement.dataset.theme = savedTheme;
  el('btn-theme').textContent = savedTheme === 'light' ? '☀️' : '🌙';

  el('btn-theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    el('btn-theme').textContent = next === 'light' ? '☀️' : '🌙';
    localStorage.setItem('taboo_theme', next);
  });

  // Fullscreen
  el('btn-fullscreen').addEventListener('click', toggleFullscreen);

  // Mute
  el('btn-mute').addEventListener('click', () => {
    const muted = !getMuted();
    setMuted(muted);
    el('btn-mute').textContent = muted ? '🔇' : '🔊';
    localStorage.setItem('taboo_muted', muted ? '1' : '0');
  });

  // Restore muted state
  if (localStorage.getItem('taboo_muted') === '1') {
    setMuted(true);
    el('btn-mute').textContent = '🔇';
  }

  // PWA install
  el('btn-install-pwa').addEventListener('click', () => installPwa());
}

// ─── Card loading ─────────────────────────────────────────────────────────────

async function _loadCards() {
  const resp = await fetch('./words.json');
  if (!resp.ok) throw new Error('Impossible de charger les cartes');
  return resp.json();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Init sounds, fullscreen, service-worker
  initAutoFullscreen();
  initServiceWorker();

  // Register game engine callbacks (HOST side only; no-ops on CLIENT)
  initGame(
    peer,
    /* onStateChange: called by game.js after each action */
    (snap) => renderForRole(snap, true),
    /* onTick: called every second by the timer */
    _onHostTick,
  );

  // Wire all button handlers (safe — hidden buttons exist in DOM but won't be triggered)
  _wireGameActions();

  if (isHost) {
    initHostFlow();
  } else {
    initClientFlow(hostPeerId);
  }
});

/**
 * game.js — Logique de jeu Taboo
 *
 * Le HOST est la source de vérité. Le timer tourne sur le HOST.
 * Chaque action déclenche un SYNC vers le CLIENT via le peer.
 */

import { state, PHASES, MSG } from './state.js';
import {
  playFound, playBuzzer, playBuzz, playTick, playTickUrgent, playGameStart, playGameOver,
} from './sound.js';

let _peer         = null;
let _onStateChange = null;  // callback → affiche l'état sur le HOST
let _onTick       = null;   // callback léger → met à jour uniquement la barre timer sur HOST
let _timerInterval = null;

/**
 * Initialise le module jeu. Doit être appelé une seule fois.
 * @param {TabooPeer} peer
 * @param {function} onStateChange  appelé après chaque changement d'état complet
 * @param {function} onTick         appelé chaque seconde avec (timeLeft)
 */
export function initGame(peer, onStateChange, onTick) {
  _peer          = peer;
  _onStateChange = onStateChange;
  _onTick        = onTick;
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

function _snapshot() {
  return {
    phase:         state.phase,
    teams:         state.teams.map(t => ({ name: t.name, score: t.score })),
    currentTeamIdx: state.currentTeamIdx,
    currentRound:  state.currentRound,
    totalRounds:   state.totalRounds,
    timerDuration: state.timerDuration,
    timeLeft:      state.timeLeft,
    currentCard:   state.currentCard ? { ...state.currentCard, taboo: [...state.currentCard.taboo] } : null,
    turnStats:     { ...state.turnStats },
    hostReady:     state.hostReady,
    clientReady:   state.clientReady,
  };
}

function _syncAll() {
  const snap = _snapshot();
  if (_peer) _peer.broadcast({ type: MSG.SYNC, state: snap });
  if (_onStateChange) _onStateChange(snap);
}

// ─── Gestion du deck ─────────────────────────────────────────────────────────

/** Mélange et initialise le deck. */
export function setupCards(allCards) {
  const arr = [...allCards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  state.cards  = arr;
  state.cardIdx = 0;
}

function _nextCard() {
  if (state.cardIdx >= state.cards.length) {
    // Reshuffle quand le deck est épuisé
    setupCards(state.cards);
  }
  state.currentCard = state.cards[state.cardIdx++];
}

// ─── Phase PRE-TURN ───────────────────────────────────────────────────────────

/** Le HOST appuie sur "Je suis prêt". */
export function setHostReady() {
  state.hostReady = true;
  if (state.clientReady) {
    startTurn();
  } else {
    _syncAll();
  }
}

/** Le CLIENT a envoyé MSG.READY. */
export function handleClientReady() {
  state.clientReady = true;
  if (state.hostReady) {
    startTurn();
  } else {
    _syncAll();
  }
}

// ─── Phase TURN ───────────────────────────────────────────────────────────────

/** Démarre un nouveau tour (appelé quand les deux joueurs sont prêts). */
export function startTurn() {
  _stopTimer();
  state.phase     = PHASES.TURN;
  state.timeLeft  = state.timerDuration;
  state.turnStats = { found: 0, passed: 0, buzzed: 0 };
  _nextCard();
  playGameStart();
  _syncAll();
  _startTimer();
}

function _startTimer() {
  _timerInterval = setInterval(() => {
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    if (_peer) _peer.broadcast({ type: MSG.TICK, timeLeft: state.timeLeft });
    if (_onTick) _onTick(state.timeLeft);

    if (state.timeLeft <= 5)       playTickUrgent();
    else if (state.timeLeft <= 10) playTick();

    if (state.timeLeft === 0) {
      _stopTimer();
      _onTimeUp();
    }
  }, 1000);
}

function _stopTimer() {
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
}

/** Le donneur a fait deviner le mot (appelable depuis HOST ou via message CLIENT). */
export function onFound() {
  if (state.phase !== PHASES.TURN) return;
  state.teams[state.currentTeamIdx].score += 1;
  state.turnStats.found += 1;
  playFound();
  _nextCard();
  _syncAll();
}

/** Le donneur passe la carte (aucun point). */
export function onPass() {
  if (state.phase !== PHASES.TURN) return;
  state.turnStats.passed += 1;
  _nextCard();
  _syncAll();
}

/**
 * Le juge buzze (le donneur a dit un mot interdit).
 * +1 point à l'équipe adverse (équipe du juge).
 */
export function onBuzz() {
  if (state.phase !== PHASES.TURN) return;
  state.teams[1 - state.currentTeamIdx].score += 1;
  state.turnStats.buzzed += 1;
  playBuzz();
  _nextCard();
  _syncAll();
}

function _onTimeUp() {
  playBuzzer();
  state.phase = PHASES.TURN_END;
  _syncAll();
}

// ─── Phase TURN_END / transition ─────────────────────────────────────────────

/** Le HOST appuie sur "Continuer" après le récap du tour. */
export function nextTurn() {
  _stopTimer();
  // La manche avance après que les deux équipes ont joué (idx 0→1→back to 0)
  if (state.currentTeamIdx === 1) {
    state.currentRound += 1;
  }
  state.currentTeamIdx = 1 - state.currentTeamIdx;

  if (state.currentRound > state.totalRounds) {
    state.phase = PHASES.GAME_OVER;
    state.currentCard = null;
    playGameOver();
    _syncAll();
    return;
  }

  state.phase       = PHASES.PRE_TURN;
  state.hostReady   = false;
  state.clientReady = false;
  _syncAll();
}

/** Remet le jeu à zéro pour une nouvelle partie (sans changer les équipes). */
export function resetGame() {
  _stopTimer();
  state.teams.forEach(t => { t.score = 0; });
  state.currentTeamIdx = 0;
  state.currentRound   = 1;
  state.phase          = PHASES.PRE_TURN;
  state.hostReady      = false;
  state.clientReady    = false;
  state.currentCard    = null;
  state.turnStats      = { found: 0, passed: 0, buzzed: 0 };
  setupCards(state.cards);
  _syncAll();
}

// ─── Dispatch messages CLIENT → HOST ─────────────────────────────────────────

/** Interpreting messages received from the CLIENT on the HOST side. */
export function handleClientMessage(data) {
  switch (data.type) {
    case MSG.READY: handleClientReady(); break;
    case MSG.FOUND: onFound();           break;
    case MSG.PASS:  onPass();            break;
    case MSG.BUZZ:  onBuzz();            break;
  }
}

/**
 * game.js — Moteur de jeu Geo Party (HOST autoritaire)
 *
 * Le HOST est la source de vérité. Timer, scoring et transitions sont gérés ici.
 * Les CLIENTs reçoivent des snapshots complets via MSG.SYNC.
 */

import { state, PHASES, MSG, HOST_ID, PLAYER_COLORS, MAX_SCORE_PER_ROUND, RESULTS_DISPLAY_SEC } from './state.js';
import { playFound, playBuzzer, playTick, playTickUrgent, playGameStart, playGameOver } from './sound.js';

let _peer          = null;
let _onStateChange = null;
let _onTick        = null;
let _timerInterval = null;
let _resultsTimer  = null;

/**
 * @param {GeoPeer} peer
 * @param {function} onStateChange  appelé avec snapshot après chaque changement
 * @param {function} onTick         appelé chaque seconde avec (timeLeft)
 */
export function initGame(peer, onStateChange, onTick) {
  _peer          = peer;
  _onStateChange = onStateChange;
  _onTick        = onTick;
}

// ─── Mapillary API ────────────────────────────────────────────────────────────

const _MAPILLARY_IMAGES_URL = 'https://graph.mapillary.com/images';

/**
 * Cherche un panorama Mapillary viable (is_pano=true) proche des coordonnées données.
 * Essaie progressivement des bboxes de plus en plus larges.
 * N'accepte que des vraies images 360° (is_pano vérifié côté API et dans la réponse).
 * @returns {string|null} image id ou null si aucun panorama viable trouvé
 */
async function _fetchMapillaryImageId(lat, lng, token) {
  const attempts = [
    { d: 0.005 },
    { d: 0.02  },
    { d: 0.07  },
    { d: 0.15  },
    { d: 0.4   },
  ];
  for (const { d } of attempts) {
    const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
    const url  = `${_MAPILLARY_IMAGES_URL}?access_token=${encodeURIComponent(token)}`
               + `&fields=id,is_pano&bbox=${bbox}&is_pano=true&limit=20`;
    try {
      const res  = await fetch(url);
      if (!res.ok) return null; // token invalide ou erreur API, ne pas réessayer
      const json = await res.json();
      // Filtrer pour ne garder que les vraies images 360° confirmées
      const panos = (json.data ?? []).filter(img => img.is_pano === true);
      if (panos.length) {
        return panos[Math.floor(Math.random() * panos.length)].id;
      }
    } catch { /* erreur réseau, on essaie le delta suivant */ }
  }
  return null;
}

/**
 * Résout les identifiants Mapillary pour une sélection de lieux.
 * Accepte plus de candidats que nécessaire et préfère ceux ayant un panorama viable.
 *
 * @param {object[]} candidates  lieux candidats (plus que wantCount pour avoir des replis)
 * @param {number}   wantCount   nombre de lieux à retourner pour la partie
 * @param {string}   token       token d'accès Mapillary du HOST
 * @returns {Promise<object[]>}  wantCount lieux enrichis avec { mapillaryId }
 */
export async function prepareRoundLocations(candidates, wantCount, token) {
  if (!token) return candidates.slice(0, wantCount).map(l => ({ ...l, mapillaryId: null }));

  const results = await Promise.all(
    candidates.map(async l => ({
      ...l,
      mapillaryId: await _fetchMapillaryImageId(l.lat, l.lng, token),
    }))
  );

  // Préférer les lieux avec un panorama viable ; compléter avec les autres si nécessaire
  const withPano    = results.filter(l => l.mapillaryId !== null);
  const withoutPano = results.filter(l => l.mapillaryId === null);
  return [...withPano, ...withoutPano].slice(0, wantCount);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Snapshot de l'état envoyé aux clients.
 * En phase GUESSING, on n'envoie PAS les coordonnées réelles (anti-triche).
 * En phase RESULTS+, les coordonnées sont incluses.
 */
function _snapshot(withCoords = false) {
  const loc = state.currentLocation;
  const locSnap = loc ? {
    id:          loc.id,
    mapillaryId: loc.mapillaryId ?? null,
    name:        loc.name,
    country:     loc.country,
    ...(withCoords ? { lat: loc.lat, lng: loc.lng } : {}),
  } : null;

  return {
    phase:            state.phase,
    players:          state.players.map(p => ({ ...p })),
    totalRounds:      state.totalRounds,
    timerDuration:    state.timerDuration,
    currentRound:     state.currentRound,
    timeLeft:         state.timeLeft,
    currentLocation:  locSnap,
    countdown:        state.countdown,
    mapillaryToken:   state.mapillaryToken,
  };
}

function _syncAll(withCoords = false) {
  const snap = _snapshot(withCoords);
  if (_peer) _peer.broadcast({ type: MSG.SYNC, state: snap });
  if (_onStateChange) _onStateChange(snap);
}

function _stopTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

function _stopResultsTimer() {
  if (_resultsTimer) { clearTimeout(_resultsTimer); _resultsTimer = null; }
}

// ─── Calculs géo ─────────────────────────────────────────────────────────────

/** Distance Haversine en km. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Score basé sur la distance (style GeoGuessr, max 5000).
 * Decay factor 2000 km gives ~2866 pts at 1000 km, ~82 pts at 10 000 km. */
const SCORE_DECAY_KM = 2000;

export function calcScore(distKm) {
  return Math.round(MAX_SCORE_PER_ROUND * Math.exp(-distKm / SCORE_DECAY_KM));
}

// ─── Gestion des joueurs ──────────────────────────────────────────────────────

/** Ajoute le joueur HOST. */
export function addHostPlayer(name) {
  const color = PLAYER_COLORS[0];
  state.players = [{
    id: HOST_ID,
    name,
    color,
    score: 0,
    guess: null,
    hasGuessed: false,
    guessDistance: null,
    guessScore: null,
  }];
}

/** Un client se connecte et envoie MSG.JOIN. */
export function handleClientJoin(peerId, name) {
  if (state.phase !== PHASES.LOBBY) return; // refuser si la partie a démarré
  if (state.players.find(p => p.id === peerId)) return; // déjà inscrit

  const colorIdx = state.players.length % PLAYER_COLORS.length;
  state.players.push({
    id: peerId,
    name: name || 'Joueur',
    color: PLAYER_COLORS[colorIdx],
    score: 0,
    guess: null,
    hasGuessed: false,
    guessDistance: null,
    guessScore: null,
  });
  _syncAll();
}

/** Retire un joueur (déconnexion). */
export function handlePlayerLeave(peerId) {
  state.players = state.players.filter(p => p.id !== peerId);
  _syncAll(state.phase === PHASES.RESULTS);
}

// ─── Démarrage de la partie ───────────────────────────────────────────────────

/** HOST démarre la partie. */
export function startGame(locationQueue, totalRounds, timerDuration) {
  state.locationQueue = locationQueue;
  state.totalRounds   = totalRounds;
  state.timerDuration = timerDuration;
  state.currentRound  = 0;
  state.players.forEach(p => { p.score = 0; });
  playGameStart();
  _startPreRound();
}

// ─── Phase PRE_ROUND ──────────────────────────────────────────────────────────

function _startPreRound() {
  _stopTimer();
  _stopResultsTimer();
  state.phase     = PHASES.PRE_ROUND;
  state.countdown = 3;
  _syncAll();

  _timerInterval = setInterval(() => {
    state.countdown--;
    if (state.countdown <= 0) {
      _stopTimer();
      _startGuessing();
    } else {
      _syncAll();
      if (_onTick) _onTick(state.countdown, 'countdown');
    }
  }, 1000);
}

// ─── Phase GUESSING ───────────────────────────────────────────────────────────

function _startGuessing() {
  state.phase = PHASES.GUESSING;
  state.currentRound++;
  state.timeLeft = state.timerDuration;

  const loc = state.locationQueue[state.currentRound - 1];
  state.currentLocation = { ...loc };

  // Réinitialiser les paris de tous les joueurs
  state.players.forEach(p => {
    p.guess        = null;
    p.hasGuessed   = false;
    p.guessDistance = null;
    p.guessScore   = null;
  });

  // Sync SANS coords (anti-triche)
  _syncAll(false);

  // Timer principal
  _timerInterval = setInterval(() => {
    state.timeLeft--;
    if (_onTick) _onTick(state.timeLeft, 'round');

    if (state.timeLeft <= 5 && state.timeLeft > 0) {
      playTickUrgent();
    } else if (state.timeLeft <= 10 && state.timeLeft > 0) {
      playTick();
    }

    // Broadcast tick léger
    if (_peer) _peer.broadcast({ type: MSG.TICK, timeLeft: state.timeLeft });

    if (state.timeLeft <= 0) {
      _stopTimer();
      // Précaution : submitGuess() peut avoir déjà appelé _endRound() et changé la phase
      if (state.phase === PHASES.GUESSING) _endRound();
    }
  }, 1000);
}

/** Un joueur soumet son pari (host ou client). */
export function submitGuess(playerId, lat, lng) {
  const inGuessing = state.phase === PHASES.GUESSING;
  const inResults  = state.phase === PHASES.RESULTS;
  if (!inGuessing && !inResults) return;
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.hasGuessed) return;

  player.guess      = { lat, lng };
  player.hasGuessed = true;

  if (inResults) {
    // Pari tardif reçu après la fin du chrono : recalcule le score de ce joueur
    const loc         = state.currentLocation;
    const dist        = haversineKm(player.guess.lat, player.guess.lng, loc.lat, loc.lng);
    player.guessDistance = dist;
    player.guessScore    = calcScore(dist);
    player.score        += player.guessScore;
    _syncAll(true);
    return;
  }

  // Phase GUESSING normale
  const allGuessed = state.players.every(p => p.hasGuessed);
  if (allGuessed) {
    _stopTimer();
    _endRound();
  } else {
    // Sync partiel : on cache toujours les coords mais on montre hasGuessed
    _syncAll(false);
  }
}

// ─── Phase RESULTS ────────────────────────────────────────────────────────────

function _endRound() {
  playBuzzer();
  state.phase = PHASES.RESULTS;

  const loc = state.currentLocation;

  // Calculer scores
  state.players.forEach(p => {
    if (p.guess) {
      const dist      = haversineKm(p.guess.lat, p.guess.lng, loc.lat, loc.lng);
      const roundScore = calcScore(dist);
      p.guessDistance = dist;
      p.guessScore    = roundScore;
      p.score        += roundScore;
    } else {
      p.guessDistance = null;
      p.guessScore    = 0;
    }
  });

  // Sync AVEC coords (révèle l'emplacement)
  _syncAll(true);

  // Auto-avance après RESULTS_DISPLAY_SEC secondes
  _resultsTimer = setTimeout(() => {
    if (state.currentRound >= state.totalRounds) {
      _endGame();
    } else {
      _startPreRound();
    }
  }, RESULTS_DISPLAY_SEC * 1000);
}

/** HOST peut passer manuellement les résultats. */
export function skipResults() {
  _stopResultsTimer();
  if (state.phase !== PHASES.RESULTS) return;
  if (state.currentRound >= state.totalRounds) {
    _endGame();
  } else {
    _startPreRound();
  }
}

// ─── Phase GAME_OVER ──────────────────────────────────────────────────────────

function _endGame() {
  _stopTimer();
  _stopResultsTimer();
  state.phase = PHASES.GAME_OVER;
  playGameOver();
  _syncAll(false);
}

/** HOST relance une partie. */
export function restartGame(locationQueue) {
  startGame(locationQueue, state.totalRounds, state.timerDuration);
}

// ─── Messages des clients ─────────────────────────────────────────────────────

/** Traite les messages entrants des clients (HOST side). */
export function handleClientMessage(peerId, data) {
  switch (data.type) {
    case MSG.JOIN:
      handleClientJoin(peerId, data.name);
      break;
    case MSG.GUESS:
      submitGuess(peerId, data.lat, data.lng);
      break;
    default:
      console.warn('[game] message inconnu', data.type);
  }
}

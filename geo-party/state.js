// ─── Clés localStorage ─────────────────────────────────────────────────────
export const STORAGE_KEY_SETTINGS = 'geoparty_settings';
export const STORAGE_KEY_TOKEN    = 'geoparty_mapillary_token';

// ─── Constantes ─────────────────────────────────────────────────────────────
export const TIMER_DEFAULT  = 60;
export const ROUNDS_DEFAULT = 5;
export const MAX_SCORE_PER_ROUND = 5000;
export const RESULTS_DISPLAY_SEC = 8; // secondes d'affichage des résultats

export const HOST_ID = 'host';

// Écrans actifs (pour plein écran / SW defer)
export const GAMEPLAY_SCREENS = new Set([
  'screen-round',
]);

// ─── Phases du jeu ────────────────────────────────────────────────────────────
export const PHASES = {
  LOBBY:      'lobby',
  PRE_ROUND:  'pre-round',
  GUESSING:   'guessing',
  RESULTS:    'results',
  GAME_OVER:  'game-over',
};

// ─── Types de messages P2P ───────────────────────────────────────────────────
export const MSG = {
  SYNC:         'SYNC',        // HOST → ALL : snapshot complet
  TICK:         'TICK',        // HOST → ALL : tick timer (secondes)
  PLAYER_JOIN:  'PLAYER_JOIN', // HOST → ALL : un nouveau joueur a rejoint
  JOIN:         'JOIN',        // CLIENT → HOST : { name }
  GUESS:        'GUESS',       // CLIENT → HOST : { lat, lng }
};

// ─── Couleurs joueurs ────────────────────────────────────────────────────────
export const PLAYER_COLORS = [
  '#e74c3c', // rouge
  '#3498db', // bleu
  '#2ecc71', // vert
  '#f39c12', // orange
  '#9b59b6', // violet
  '#1abc9c', // turquoise
  '#e67e22', // orange foncé
  '#e91e63', // rose
];

// ─── État global (source de vérité HOST, miroir côté CLIENT) ─────────────────
export const state = {
  phase: PHASES.LOBBY,

  // Joueurs : [{ id, name, color, score, guess:{lat,lng}|null, hasGuessed, guessDistance, guessScore }]
  players: [],

  // Paramètres
  totalRounds: ROUNDS_DEFAULT,
  timerDuration: TIMER_DEFAULT,

  // Tour en cours
  currentRound: 0,
  timeLeft: TIMER_DEFAULT,

  // Lieu courant : null en GUESSING (mapillaryId seulement), révélé en RESULTS
  currentLocation: null,  // { id, mapillaryId, name, country, lat?, lng? }

  // Countdown pré-round
  countdown: 3,

  // Tous les lieux pré-tirés pour la partie (avec mapillaryId résolu)
  locationQueue: [],  // [{ id, mapillaryId, name, country, lat, lng }]

  // Token Mapillary partagé par le HOST avec tous les clients
  mapillaryToken: null,
};

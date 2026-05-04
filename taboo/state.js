// ─── Clés localStorage ─────────────────────────────────────────────────────
export const STORAGE_KEY_TEAMS    = 'taboo_teams';
export const STORAGE_KEY_SETTINGS = 'taboo_settings';

// ─── Constantes ─────────────────────────────────────────────────────────────
export const TIMER_DEFAULT  = 60;
export const ROUNDS_DEFAULT = 5;

/** Écrans nécessitant le plein écran (utilisé par pwa.js) */
export const GAMEPLAY_SCREENS = new Set([
  'screen-turn-giver',
  'screen-turn-judge',
]);

// ─── Phases du jeu ────────────────────────────────────────────────────────────
export const PHASES = {
  LOBBY:     'lobby',
  PRE_TURN:  'pre-turn',
  TURN:      'turn',
  TURN_END:  'turn-end',
  GAME_OVER: 'game-over',
};

// ─── Types de messages P2P ───────────────────────────────────────────────────
export const MSG = {
  SYNC:  'SYNC',   // HOST → CLIENT : état complet
  TICK:  'TICK',   // HOST → CLIENT : tick du timer (chaque seconde)
  READY: 'READY',  // CLIENT → HOST : client prêt pour le tour
  BUZZ:  'BUZZ',   // CLIENT → HOST : juge buzze un mot interdit
  FOUND: 'FOUND',  // CLIENT → HOST : donneur marque mot trouvé
  PASS:  'PASS',   // CLIENT → HOST : donneur passe la carte
};

// ─── État global ─────────────────────────────────────────────────────────────
export const state = {
  phase: PHASES.LOBBY,
  teams: [
    { name: 'Équipe Rouge', score: 0 },
    { name: 'Équipe Bleue', score: 0 },
  ],
  currentTeamIdx: 0,   // 0 = team rouge (HOST), 1 = team bleue (CLIENT)
  currentRound: 1,
  totalRounds: ROUNDS_DEFAULT,
  timerDuration: TIMER_DEFAULT,
  timeLeft: TIMER_DEFAULT,
  currentCard: null,   // { word: string, taboo: string[] }
  turnStats: { found: 0, passed: 0, buzzed: 0 },
  hostReady: false,
  clientReady: false,
  cards: [],           // deck mélangé
  cardIdx: 0,
};

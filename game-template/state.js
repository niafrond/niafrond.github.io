/**
 * state.js — Constantes et état global
 *
 * TODO : Renommez les constantes avec le préfixe de votre jeu
 *        (ex. 'myjeu_card_count') pour éviter les collisions localStorage.
 */

// ─── Clés localStorage ─────────────────────────────────────────────────────────
export const PLAYERS_KEY      = 'template_players';      // TODO: renommer
export const TURN_DURATION_KEY = 'template_turn_duration'; // TODO: renommer

// ─── Valeurs par défaut ────────────────────────────────────────────────────────
export const TURN_DURATION_DEFAULT = 30;  // secondes par tour
export const MIN_PLAYERS           = 2;   // nombre minimum de joueurs
export const CLICK_COOLDOWN        = 500; // ms — anti-double-clic

// ─── Ecrans de gameplay (verrou orientation paysage) ──────────────────────────
// Listez ici les écrans où le téléphone doit être en paysage.
// Laissez vide si votre jeu tourne en portrait.
export const GAMEPLAY_SCREENS = new Set([
  'screen-turn',
]);

// ─── Couleurs des équipes ──────────────────────────────────────────────────────
export const TEAMS_META = [
  { color: 'var(--volcan)', label: 'Équipe Rouge'  },
  { color: 'var(--lagon)',  label: 'Équipe Bleue'  },
  { color: 'var(--foret)', label: 'Équipe Verte'  },
  { color: 'var(--soleil)', label: 'Équipe Jaune'  },
];

// ─── État global ───────────────────────────────────────────────────────────────
export const state = {
  // Joueurs
  playerNames: [],

  // Équipes (calculées au démarrage)
  teams: [],          // [{ name, players, score }]
  currentTeamIdx: 0,

  // Tour en cours
  turnDuration: TURN_DURATION_DEFAULT,
  timeLeft:     TURN_DURATION_DEFAULT,
  timerInterval: null,
  timerPaused:  false,

  // Partie
  currentRound: 1,

  // TODO : ajoutez ici l'état spécifique à votre jeu
  // Exemple :
  //   currentWord: null,
  //   foundWords:  [],
  //   allWords:    [],
};

// ─── Anti-double-clic ──────────────────────────────────────────────────────────
export function withCooldown(fn) {
  let lastClick = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastClick < CLICK_COOLDOWN) return;
    lastClick = now;
    fn.apply(this, args);
  };
}

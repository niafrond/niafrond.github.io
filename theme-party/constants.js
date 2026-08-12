// ─── Écrans ─────────────────────────────────────────────────────────────────
// Les valeurs doivent correspondre exactement aux attributs data-screen="..."
// posés sur chaque écran dans index.html (ui.showScreen() compare les deux).
export const SCREEN = {
  HOME: 'screen-home',               // Gros bouton "Lancer une partie" + config
  SETUP: 'screen-setup',             // Atelier de création/édition des thèmes
  THEME_PICKER: 'screen-picker',     // Choix d'un des thèmes disponibles pour le Set
  ROUND: 'screen-round',             // Lecture des 7 pistes du thème choisi
  SET_END: 'screen-set-end',         // Fin du Set (7/7), avant retour au picker
  GAME_OVER: 'screen-game-over',     // Tous les thèmes de la partie ont été joués
};

// ─── Timers (ms) ──────────────────────────────────────────────────────────────
export const TIMER = {
  PLAY_MAX: 45000,        // 45s de lecture max par piste
  HINT_1: 10000,          // 1er indice révélé à 10s
  HINT_2: 20000,          // 2e indice révélé à 20s
  REVEAL_DURATION: 5000,  // la réponse dévoilée se recache après 5s
};

export const THEME_TRACK_COUNT = 7;   // pistes par thème (un Set complet)
export const THEME_CHOICE_COUNT = 5;  // thèmes proposés au picker

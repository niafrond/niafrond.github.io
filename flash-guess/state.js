/**
 * state.js — Constantes et état global de Flash Guess
 */

// ─── Constantes ────────────────────────────────────────────────────────────────
export const TURN_DURATION              = 30;
export const TIMER_CIRCLE_RADIUS        = 46;
export const MIN_PLAYERS                = 2;
export const CARD_COUNT_DEFAULT         = 40;
export const CARD_COUNT_KEY             = 'flashguess_card_count';
export const SELECTED_CATS_KEY          = 'flashguess_selected_cats';
export const KIDS_MODE_KEY              = 'flashguess_kids_mode';
export const WORD_DRAFT_KEY             = 'flashguess_word_draft';
export const ROTATING_GUESSER_KEY      = 'flashguess_rotating_guesser';
export const ELIMINATIONS_PER_PLAYER   = 3;
export const GROUPS_KEY                 = 'flashguess_groups';
export const TURN_DURATION_KEY          = 'flashguess_turn_duration';
export const WORD_FONT_MIN              = 16;
export const WORD_FONT_MAX              = 200;
export const CLICK_COOLDOWN             = 500;
export const CHILD_READ_MS_PER_LETTER   = 1420;
export const CHILD_READ_MIN_MS          = 3000;

export const GAMEPLAY_SCREENS = new Set([
  'screen-word-draft-cover',
  'screen-word-draft',
  'screen-round-intro',
  'screen-pre-turn',
  'screen-turn',
  'screen-turn-end',
  'screen-round-end',
  'screen-game-over',
]);

export const ROUND_RULES = [
  {
    num: 1, icon: '🗣️',
    title: 'Manche 1 — Parler librement',
    desc: `L'orateur peut parler librement.
⛔ Interdit : dire le nom (ou une partie), épeler, traduire.
✅ Les joueurs peuvent faire autant de propositions qu'ils souhaitent.`,
    canSkip: false,
    canFault: false,
  },
  {
    num: 2, icon: '☝️',
    title: 'Manche 2 — Un seul mot',
    desc: `L'orateur ne dit qu'un seul mot par carte. L'équipe n'a droit qu'à une seule proposition.
✅ Bonne réponse → carte gagnée.
❌ Mauvaise réponse → carte passée définitivement pour ce tour.
⏭ L'orateur peut aussi passer s'il est bloqué.
⛔ Interdits : plus d'un mot, partie du nom, traduction directe.`,
    canSkip: true,
    canFault: false,
  },
  {
    num: 3, icon: '🤐',
    title: 'Manche 3 — Mime et bruitages',
    desc: `L'orateur ne peut plus parler du tout : uniquement des mimes et des bruitages.
Même fonctionnement que la manche 2 :
✅ Bonne réponse → carte gagnée.
❌ Mauvaise réponse ou faute → carte passée définitivement pour ce tour.
⏭ L'orateur peut passer s'il est bloqué.
⛔ Interdits : parler, former des mots, fredonner une chanson.`,
    canSkip: true,
    canFault: true,
  },
];

export const TEAMS_META = [
  { color: 'var(--volcan)' },
  { color: 'var(--lagon)'  },
  { color: 'var(--foret)'  },
  { color: 'var(--soleil)' },
];

// ─── État du jeu ───────────────────────────────────────────────────────────────
export const state = {
  playerNames:         [],
  playerIsChild:       new Set(),

  teams:               [],
  teamPlayerIdx:       [],
  noTeamsMode:         false,

  selectedCategories:  [],
  kidsMode:            false,
  kidsModeManual:      false,

  allWords:            [],
  roundWords:          [],
  currentRound:        0,
  currentTeamIdx:      0,

  turnFound:           [],
  turnSkipped:         [],
  currentWord:         null,
  actionHistory:       [],
  redoStack:           [],

  timerInterval:       null,
  timeLeft:            TURN_DURATION,
  timerPaused:         false,

  cardCount:           CARD_COUNT_DEFAULT,
  turnDuration:        30,

  // Word draft (tri caché)
  wordDraftMode:       false,
  draftPlayerChunks:   [],
  draftCurrentPlayerIdx: 0,
  draftEliminations:   [], // selected indices in current player's chunk
  draftReservePool:    [], // extra words available for refresh (kidsMode only)

  // Mode devineur tournant
  rotatingGuesserMode:   false,
  rotatingGuesserTarget: [], // par équipe : indice du devineur tournant (0..n-2)
  currentGuesserTeamIdx: -1, // index de l'équipe devinant au tour courant

  // Lecture enfant
  childReadFirstWord:  false,
  childReadAutoTimer:  null,

  // Mode coopératif 2 joueurs : objectifs de performance (multi-sélection)
  coopObjectives: new Set(), // Set<'chrono'|'precision'>
  coopTimeUsed:   0,         // secondes cumulées utilisées par l'équipe
  coopTurnsCount: 0,         // nombre de tours joués par l'équipe
};

// ─── État démo ─────────────────────────────────────────────────────────────────
export const demo = {
  mode:           false,
  waiting:        false,
  firstWordFound: false,
  childReadFrozen:false,
  tipIdx:         0,
};

/**
 * Hooks injectés par demo.js pour éviter les dépendances circulaires.
 * game.js appelle ces fonctions si elles sont définies.
 */
export const demoHooks = {
  showTips:           null, // (round) => void
  showTurnEndTips:    null, // () => void
  showAfterFoundTips: null, // () => void — appelé après le premier mot trouvé en démo
};

// ─── Cooldown boutons ──────────────────────────────────────────────────────────
export function withCooldown(fn) {
  let lastClick = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastClick < CLICK_COOLDOWN) return;
    lastClick = now;
    fn.apply(this, args);
  };
}

// ─── Message types (envoyés via PeerJS DataChannel) ───────────────────────────
export const MSG = {
  // Client → Host
  JOIN: 'JOIN',         // { name }
  READY: 'READY',
  BUZZ: 'BUZZ',         // { ts } timestamp client
  ANSWER: 'ANSWER',     // { text } mode classique/speed
  CHOICE: 'CHOICE',     // { text } mode QCM

  // Host → All (broadcast)
  PLAYER_LIST: 'PLAYER_LIST',     // { players[] }
  GAME_START: 'GAME_START',       // { mode, config }
  SHOW_QUESTION: 'SHOW_QUESTION', // { index, text, choices?, category, difficulty, total }
  BUZZ_QUEUE: 'BUZZ_QUEUE',       // { queue: [peerId,...] }
  WRONG_CHOICE: 'WRONG_CHOICE',   // { playerId, choice }
  ANSWER_RESULT: 'ANSWER_RESULT', // { correct, playerId, answer, scores, points }
  QUESTION_END: 'QUESTION_END',   // { correctAnswer, skipped }
  GAME_OVER: 'GAME_OVER',         // { finalScores[] }
  KICKED: 'KICKED',
};

// ─── Game phases ───────────────────────────────────────────────────────────────
export const PHASE = {
  LOBBY: 'LOBBY',
  QUESTION_PREVIEW: 'QUESTION_PREVIEW',
  BUZZING: 'BUZZING',
  ANSWERING: 'ANSWERING',
  ANSWER_RESULT: 'ANSWER_RESULT',
  QUESTION_END: 'QUESTION_END',
  GAME_OVER: 'GAME_OVER',
};

// ─── Game modes ────────────────────────────────────────────────────────────────
export const MODE = {
  CLASSIC: 'CLASSIC', // Buzzer + réponse texte, tolérance aux fautes
  QCM: 'QCM',         // 4 choix, 1er clic correct = points
  SPEED: 'SPEED',     // Buzzer + réponse rapide, timer court
};

export const MODE_LABELS = {
  [MODE.CLASSIC]: '🎯 Classique',
  [MODE.QCM]: '📋 QCM',
  [MODE.SPEED]: '⚡ Speed',
};

export const MODE_DESCRIPTIONS = {
  [MODE.CLASSIC]: 'Buzzer + réponse texte, tolérance aux fautes',
  [MODE.QCM]: '4 choix, 1er clic correct remporte les points',
  [MODE.SPEED]: 'Buzzer + réponse rapide, timer court (8s)',
};

// ─── Scoring ───────────────────────────────────────────────────────────────────
export const SCORE = {
  CORRECT: 10,
  WRONG_MALUS: -3,
  SPEED_BONUS_MAX: 5, // Bonus maximum de rapidité (réponse instantanée)
};

// ─── Timers (ms) ──────────────────────────────────────────────────────────────
export const TIMER = {
  QUESTION_PREVIEW: 3000,  // 3s d'affichage avant que le buzzer s'active
  BUZZ_DURATION: 30000,    // 30s max pour buzzer avant skip
  ANSWER_DURATION: 15000,  // 15s pour répondre (classique)
  SPEED_ANSWER: 8000,      // 8s pour répondre (speed)
  QCM_DURATION: 20000,     // 20s pour choisir (QCM)
  RESULT_DISPLAY: 2000,    // 2s d'affichage du résultat intermédiaire
  QUESTION_END_DELAY: 4000,// 4s avant question suivante (auto-advance)
};

// ─── Difficulty ────────────────────────────────────────────────────────────────
export const DIFFICULTY_LABELS = {
  '': 'Toutes',
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

// ─── Categories (The Trivia API) ───────────────────────────────────────────────
export const CATEGORY_LABELS = {
  '': 'Toutes catégories',
  arts_and_literature: '📚 Arts & Littérature',
  film_and_tv: '🎬 Cinéma & TV',
  food_and_drink: '🍽️ Cuisine & Boissons',
  general_knowledge: '🌐 Culture Générale',
  geography: '🗺️ Géographie',
  history: '🏛️ Histoire',
  music: '🎵 Musique',
  reunion: '🏝️ Île de la Réunion',
  children: '👶 Enfants (8-12 ans)',
  science: '🔬 Sciences',
  society_and_culture: '👥 Société & Culture',
  sport_and_leisure: '⚽ Sport & Loisirs',
};

export const QUESTION_COUNTS = [5, 10, 15, 20];
export const ANSWER_TIMES = [10, 15, 20, 30]; // secondes

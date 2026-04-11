// ─── Message types (envoyés via PeerJS DataChannel) ───────────────────────────
export const MSG = {
  // Client → Host
  JOIN: 'JOIN',             // { name }
  READY: 'READY',
  BUZZ: 'BUZZ',             // { ts } timestamp client
  ANSWER: 'ANSWER',         // { text } mode classique/speed
  CHOICE: 'CHOICE',         // { text } mode QCM
  BET: 'BET',               // { amount } — pari secret
  DOUBLE_DOWN: 'DOUBLE_DOWN', // {} — double ou rien (avant de répondre)
  TARGET: 'TARGET',         // { targetId } — cible cachée
  USE_POWER: 'USE_POWER',   // { power, targetId } — utiliser un pouvoir
  DRAFT_PICK: 'DRAFT_PICK', // { category } — choisir une catégorie dans le draft

  // Host → All (broadcast)
  PLAYER_LIST: 'PLAYER_LIST',           // { players[] }
  GAME_START: 'GAME_START',             // { mode, config }
  SHOW_QUESTION: 'SHOW_QUESTION',       // { index, text, choices?, category, difficulty, total }
  SHOW_CHOICES: 'SHOW_CHOICES',         // { choices[] } — envoyé en privé au buzzeur (BUZZ_QCM)
  BUZZ_QUEUE: 'BUZZ_QUEUE',             // { queue: [peerId,...] }
  WRONG_CHOICE: 'WRONG_CHOICE',         // { playerId, choice }
  ANSWER_RESULT: 'ANSWER_RESULT',       // { correct, playerId, answer, scores, points }
  BUZZ_RESUME: 'BUZZ_RESUME',           // { remainingMs }
  QUESTION_END: 'QUESTION_END',         // { correctAnswer, skipped, betReveal?, targetsReveal? }
  GAME_OVER: 'GAME_OVER',               // { finalScores[] }
  LOBBY_RESET: 'LOBBY_RESET',
  LOBBY_CONFIG: 'LOBBY_CONFIG',         // { config }
  KICKED: 'KICKED',
  BET_STATE: 'BET_STATE',               // { betCount, total } — combien de paris placés (sans montants)
  POWER_EFFECT: 'POWER_EFFECT',         // { power, byId, targetId }
  DRAFT_STATE: 'DRAFT_STATE',           // { picks, currentPicker, categories, round, totalRounds }
  DOUBLE_DOWN_DECLARED: 'DOUBLE_DOWN_DECLARED', // { playerId } — annonce visible de tous
  REVEAL_ANSWER: 'REVEAL_ANSWER',               // { correctAnswer, trivia } — animateur révèle la réponse
};

// ─── Game phases ───────────────────────────────────────────────────────────────
export const PHASE = {
  LOBBY: 'LOBBY',
  DRAFT: 'DRAFT',                   // choix de catégories avant la partie
  QUESTION_PREVIEW: 'QUESTION_PREVIEW',
  BETTING: 'BETTING',               // pari secret
  BUZZING: 'BUZZING',
  ANSWERING: 'ANSWERING',
  ANSWER_RESULT: 'ANSWER_RESULT',
  QUESTION_END: 'QUESTION_END',
  GAME_OVER: 'GAME_OVER',
};

// ─── Game modes ────────────────────────────────────────────────────────────────
export const MODE = {
  CLASSIC: 'CLASSIC',     // Buzzer + réponse texte, tolérance aux fautes
  QCM: 'QCM',             // 4 choix, 1er clic correct = points
  SPEED: 'SPEED',         // Buzzer + réponse rapide, timer court
  PINGPONG: 'PINGPONG',   // Tour à tour sans buzzer — jusqu'à l'erreur fatale
  PARTY: 'PARTY',         // Mini-jeux enchaînés avec tous les modes (aléatoire)
  BUZZ_QCM: 'BUZZ_QCM',  // Buzzer pour voir les choix en privé — erreur = malus + éliminé
};

export const MODE_LABELS = {
  [MODE.CLASSIC]: '🎯 Classique',
  [MODE.QCM]: '📋 QCM',
  [MODE.SPEED]: '⚡ Speed',
  [MODE.PINGPONG]: '🏓 Ping-Pong',
  [MODE.PARTY]: '🎉 Party',
  [MODE.BUZZ_QCM]: '🔔 Buzz QCM',
};

export const MODE_DESCRIPTIONS = {
  [MODE.CLASSIC]: 'Buzzer + réponse texte, tolérance aux fautes',
  [MODE.QCM]: '4 choix, 1er clic correct remporte les points',
  [MODE.SPEED]: 'Buzzer + réponse rapide, timer court (8s)',
  [MODE.PINGPONG]: 'Tour à tour sans buzzer — jusqu\'à ce que quelqu\'un se trompe',
  [MODE.PARTY]: 'Mini-jeux enchaînés avec tous les modes (aléatoire)',
  [MODE.BUZZ_QCM]: 'Buzzez pour voir les choix en privé — erreur = malus et éliminé de la question',
};

// ─── Scoring ───────────────────────────────────────────────────────────────────
export const SCORE = {
  CORRECT: 10,
  WRONG_MALUS: -3,
  SPEED_BONUS_MAX: 5, // Bonus maximum de rapidité (réponse instantanée)
  TARGET_BONUS: 5,    // Bonus cible cachée (si tu bats ton adversaire)
};

// ─── Streak ────────────────────────────────────────────────────────────────────
export const STREAK = {
  THRESHOLD_1: 3,    // À partir de 3 bonnes réponses consécutives → multiplicateur
  THRESHOLD_2: 5,    // À partir de 5 → multiplicateur plus élevé
  MULTIPLIER_1: 1.5, // x1.5 après 3 consécutives
  MULTIPLIER_2: 2.0, // x2 après 5 consécutives
};

// ─── Powers ───────────────────────────────────────────────────────────────────
export const POWER = {
  SLOW: 'SLOW',     // Réduit le timer d'un joueur de 50%
  HIDE: 'HIDE',     // Cache la réponse d'un joueur aux autres
  DOUBLE: 'DOUBLE', // Double les points gagnés/perdus d'un joueur ce tour
};

export const POWER_LABELS = {
  [POWER.SLOW]: '🐢 Ralentir',
  [POWER.HIDE]: '🙈 Cacher',
  [POWER.DOUBLE]: '⚡ Doubler',
};

export const POWER_DESCRIPTIONS = {
  [POWER.SLOW]: 'Réduit le temps de réponse d\'un adversaire de 50%',
  [POWER.HIDE]: 'Cache la réponse d\'un adversaire aux autres joueurs',
  [POWER.DOUBLE]: 'Double les points gagnés/perdus d\'un adversaire ce tour',
};

export const POWER_COOLDOWN = 3; // nombre de questions entre deux utilisations du même pouvoir

// ─── Timers (ms) ──────────────────────────────────────────────────────────────
export const TIMER = {
  QUESTION_PREVIEW: 3000,   // 3s d'affichage avant que le buzzer s'active
  BUZZ_DURATION: 30000,     // 30s max pour buzzer avant skip
  ANSWER_DURATION: 15000,   // 15s pour répondre (classique)
  SPEED_ANSWER: 8000,       // 8s pour répondre (speed)
  QCM_DURATION: 20000,      // 20s pour choisir (QCM)
  RESULT_DISPLAY: 2000,     // 2s d'affichage du résultat intermédiaire
  QUESTION_END_DELAY: 4000, // 4s avant question suivante (auto-advance)
  BETTING_DURATION: 15000,  // 15s pour placer un pari secret
  DRAFT_PICK_DURATION: 20000, // 20s par joueur pour choisir une catégorie dans le draft
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
  photo: '📸 Photos',
  reunion: '🏝️ Île de la Réunion',
  children: '👶 Enfants (8-12 ans)',
  science: '🔬 Sciences',
  society_and_culture: '👥 Société & Culture',
  sport_and_leisure: '⚽ Sport & Loisirs',
};

export const QUESTION_COUNTS = [5, 10, 15, 20];
export const ANSWER_TIMES = [10, 15, 20, 30]; // secondes

// ─── Minimum players per mode ─────────────────────────────────────────────────
export const MODE_MIN_PLAYERS = {
  [MODE.CLASSIC]:  1,
  [MODE.QCM]:      1,
  [MODE.SPEED]:    1,
  [MODE.PINGPONG]: 2,
  [MODE.PARTY]:    2,
};

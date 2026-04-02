// ─── Message types (envoyés via PeerJS DataChannel) ───────────────────────────
export const MSG = {
  // Client → Host
  JOIN: 'JOIN',           // { name }
  READY: 'READY',
  BUZZ: 'BUZZ',
  ANSWER: 'ANSWER',       // { text }
  JOKER_USE: 'JOKER_USE', // { type, targetId }
  JOKER_WINDOW: 'JOKER_WINDOW', // { remainingS } — fenêtre joker avant la chanson

  // Host → All (broadcast)
  PLAYER_LIST: 'PLAYER_LIST',     // { players[] }
  GAME_START: 'GAME_START',       // { mode, playlist[], jokerConfig }
  PLAY_SONG: 'PLAY_SONG',         // { videoId, roundIndex, startAt }
  STOP_MUSIC: 'STOP_MUSIC',
  RESUME_MUSIC: 'RESUME_MUSIC',
  ANSWER_STEP: 'ANSWER_STEP',   // { step: 'artist'|'title', playerId, artistCorrect? }
  BUZZ_QUEUE: 'BUZZ_QUEUE',       // { queue: [playerId,...] }
  ANSWER_RESULT: 'ANSWER_RESULT', // { playerId, correct, answer, scores }
  WRONG_CHOICE: 'WRONG_CHOICE',   // { playerId, choice, scores, eliminatedChoices }
  SCORES_UPDATE: 'SCORES_UPDATE', // { scores: { [id]: number } }
  JOKER_EFFECT: 'JOKER_EFFECT',   // { type, fromId, targetId }
  ROUND_END: 'ROUND_END',         // { videoId, title, artist }
  GAME_OVER: 'GAME_OVER',         // { finalScores[] }
  PING: 'PING',
  PONG: 'PONG',
  KICKED: 'KICKED',

  // Client → Host (reconnexion hôte)
  STATE_SNAPSHOT: 'STATE_SNAPSHOT', // { mode, playlist, shuffled, currentRound, currentSong, players, phase, choices }
  HOST_RETURN: 'HOST_RETURN',       // relay → tous les clients : l'hôte original est de retour { hostPeerId }
};

// ─── Game phases ───────────────────────────────────────────────────────────────
export const PHASE = {
  LOBBY: 'LOBBY',
  JOKER_WINDOW: 'JOKER_WINDOW',
  COUNTDOWN: 'COUNTDOWN',
  PLAYING: 'PLAYING',
  BUZZED: 'BUZZED',
  ANSWERING: 'ANSWERING',
  ANSWER_RESULT: 'ANSWER_RESULT',
  ROUND_END: 'ROUND_END',
  GAME_OVER: 'GAME_OVER',
};

// ─── Game modes ────────────────────────────────────────────────────────────────
export const MODE = {
  CLASSIC: 'CLASSIC',           // Premier buzz correct → +10
  CLASSIC_MALUS: 'CLASSIC_MALUS', // +10 correct / -5 wrong
  FOUR_CHOICES: 'FOUR_CHOICES', // 4 boutons, pas de buzz
};

export const MODE_LABELS = {
  [MODE.CLASSIC]: 'Classique',
  [MODE.CLASSIC_MALUS]: 'Classique avec malus',
  [MODE.FOUR_CHOICES]: '4 choix',
};

export const ANSWER_FORMAT = {
  ARTIST_THEN_TITLE: 'ARTIST_THEN_TITLE',
  BOTH_TOGETHER: 'BOTH_TOGETHER',
  EITHER_ONE: 'EITHER_ONE',
};

export const ANSWER_FORMAT_LABELS = {
  [ANSWER_FORMAT.ARTIST_THEN_TITLE]: 'Artiste puis titre',
  [ANSWER_FORMAT.BOTH_TOGETHER]: 'Artiste et titre ensemble',
  [ANSWER_FORMAT.EITHER_ONE]: 'Artiste ou titre',
};

export const ANSWER_PROMPTS = {
  artist: { label: '🎤 Donnez l\'artiste', placeholder: 'Artiste…' },
  title: { label: '🎵 Donnez le titre', placeholder: 'Titre…' },
  both: { label: '🎶 Donnez l\'artiste et le titre', placeholder: 'Artiste — Titre…' },
  either: { label: '🎵 Donnez l\'artiste ou le titre', placeholder: 'Artiste ou titre…' },
};

// ─── Joker types ───────────────────────────────────────────────────────────────
export const JOKER = {
  STEAL: 'STEAL',   // 🎯 Vole 5 pts à une cible
  DOUBLE: 'DOUBLE', // ⚡ Prochain gain ×2
  BLOCK: 'BLOCK',   // 🛡️ Bloque les jokers et gains/pertes de la cible 1 round
};

export const JOKER_LABELS = {
  [JOKER.STEAL]: '🎯 Voler',
  [JOKER.DOUBLE]: '⚡ Doubler',
  [JOKER.BLOCK]: '🛡️ Bloquer',
};

export const JOKER_DESCRIPTIONS = {
  [JOKER.STEAL]: 'Vole 5 points à un joueur de votre choix',
  [JOKER.DOUBLE]: 'Double vos points sur le prochain gain',
  [JOKER.BLOCK]: 'Bloque les jokers et gains/pertes d\'un joueur pendant 1 round',
};

// ─── Scoring ───────────────────────────────────────────────────────────────────
export const SCORE = {
  CORRECT: 10,
  ARTIST: 5,
  TITLE: 5,
  WRONG_MALUS: -5,
  STEAL_AMOUNT: 5,
};

// ─── Timers (ms) ──────────────────────────────────────────────────────────────
export const TIMER = {
  PLAY_DURATION: 30000,  // 30s de lecture max avant skip
  ANSWER_DURATION: 15000, // 15s pour répondre après buzz
  ROUND_END_DELAY: 3000, // 3s d'affichage de la réponse avant round suivant
  SYNC_OFFSET: 600,      // Décalage estimé de latence pour sync YouTube (ms)
  COUNTDOWN: 3,          // 3-2-1 avant lecture
  JOKER_WINDOW: 5,       // Secondes pour décider d'un joker avant la chanson
};

export const MIN_PLAYLIST_FOR_FOUR_CHOICES = 4;
export const GAME_SONGS = 15; // Nombre de chansons jouées par partie

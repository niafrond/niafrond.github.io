/**
 * party-game.js — Moteur du mode Party Quiz
 *
 * 6 mini-jeux disponibles (ordre aléatoire) :
 *  STREAK   — 4 à la suite : réponses QCM simultanées, points selon la série max
 *  DUEL     — Interrogatoire : 1 joueur choisit une question, tous les autres répondent en QCM
 *  SPEED_TF — Vrai ou Faux rapide : vote simultané 7 s, bonus / malus
 *  RACE     — Course classique : simultané QCM, bonus selon l'ordre d'arrivée
 *  BLITZ    — QCM ultra-rapide : 5 secondes par question, bonne = +5, erreur = -2
 *  CAROUSEL — Carrousel : tour à tour, seul le joueur désigné peut répondre
 */

import { MSG } from './constants.js';

// ─── Mini-jeux ────────────────────────────────────────────────────────────────

export const PARTY_MINI = {
  STREAK:   'STREAK',
  DUEL:     'DUEL',
  SPEED_TF: 'SPEED_TF',
  RACE:     'RACE',
  BLITZ:    'BLITZ',
  CAROUSEL: 'CAROUSEL',
};

/** Tous les mini-jeux disponibles (pour le mode tout aléatoire) */
export const ALL_PARTY_MINIS = Object.values(PARTY_MINI);

export const PARTY_MINI_LABELS = {
  [PARTY_MINI.STREAK]:   '🔥 4 à la suite',
  [PARTY_MINI.DUEL]:     '🎯 Interrogatoire',
  [PARTY_MINI.SPEED_TF]: '⚡ Vrai ou Faux',
  [PARTY_MINI.RACE]:     '🏁 Course classique',
  [PARTY_MINI.BLITZ]:    '💨 Blitz QCM',
  [PARTY_MINI.CAROUSEL]: '🎠 Carrousel',
};

export const PARTY_MINI_ICONS = {
  [PARTY_MINI.STREAK]:   '🔥',
  [PARTY_MINI.DUEL]:     '🎯',
  [PARTY_MINI.SPEED_TF]: '⚡',
  [PARTY_MINI.RACE]:     '🏁',
  [PARTY_MINI.BLITZ]:    '💨',
  [PARTY_MINI.CAROUSEL]: '🎠',
};

export const PARTY_MINI_RULES = {
  [PARTY_MINI.STREAK]:
    '5 questions QCM pour tous les joueurs.\n' +
    'Chaque bonne réponse prolonge votre série. Une erreur remet le compteur à zéro.\n\n' +
    'Score final selon votre meilleure série :\n' +
    '· 1 de suite = 1 pt  · 2 de suite = 2 pts\n' +
    '· 3 de suite = 3 pts  · 4 ou plus = 8 pts 🔥',
  [PARTY_MINI.DUEL]:
    '5 rounds. À chaque round, un Interrogateur est désigné.\n' +
    'Il choisit (en secret) une question parmi 2 options, puis la pose à tous les autres.\n\n' +
    'Résultat par joueur :\n' +
    '· Bonne réponse → +5 pts pour le joueur, -2 pts pour l\'interrogateur\n' +
    '· Mauvaise réponse → -2 pts pour le joueur, +3 pts pour l\'interrogateur\n\n' +
    'Choisissez bien : une question trop facile peut vous coûter cher !',
  [PARTY_MINI.SPEED_TF]:
    '5 affirmations à juger : "X est la réponse à Y" — VRAI ou FAUX ?\n' +
    'Vous avez 7 secondes pour voter !\n\n' +
    '· Bonne réponse → +3 pts\n' +
    '· Mauvaise réponse → -2 pts\n' +
    '· Pas de vote → 0 pt',
  [PARTY_MINI.RACE]:
    '5 questions QCM — tous les joueurs votent en même temps.\n' +
    'La vitesse compte : les premiers à répondre correctement gagnent plus de points !\n\n' +
    '· 1er correct → +10 pts  · 2e correct → +6 pts\n' +
    '· 3e correct → +3 pts    · Mauvaise réponse → -2 pts',
  [PARTY_MINI.BLITZ]:
    '5 questions QCM ultra-rapides — seulement 5 secondes pour répondre !\n' +
    'Tout le monde répond en même temps.\n\n' +
    '· Bonne réponse → +5 pts\n' +
    '· Mauvaise réponse → -2 pts\n' +
    '· Pas de réponse → 0 pt',
  [PARTY_MINI.CAROUSEL]:
    '5 questions à tour de rôle — un seul joueur répond à chaque question.\n' +
    'Les autres joueurs ne peuvent pas intervenir !\n\n' +
    '· Bonne réponse → +10 pts pour le joueur désigné\n' +
    '· Mauvaise réponse → -3 pts pour le joueur désigné\n' +
    '· Chaque joueur a exactement 12 secondes',
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const PARTY_MSG = {
  // Host → All
  PARTY_MINI_START:        'PARTY_MINI_START',
  PARTY_MINI_READY:        'PARTY_MINI_READY',
  PARTY_MINI_END:          'PARTY_MINI_END',
  PARTY_STREAK_QUESTION:   'PARTY_STREAK_QUESTION',
  PARTY_STREAK_REVEAL:     'PARTY_STREAK_REVEAL',
  PARTY_DUEL_ASSIGN:       'PARTY_DUEL_ASSIGN',
  PARTY_DUEL_QUESTION:     'PARTY_DUEL_QUESTION',
  PARTY_DUEL_RESULT:       'PARTY_DUEL_RESULT',
  PARTY_TF_QUESTION:       'PARTY_TF_QUESTION',
  PARTY_TF_REVEAL:         'PARTY_TF_REVEAL',
  PARTY_RACE_QUESTION:     'PARTY_RACE_QUESTION',
  PARTY_RACE_REVEAL:       'PARTY_RACE_REVEAL',
  PARTY_BLITZ_QUESTION:    'PARTY_BLITZ_QUESTION',
  PARTY_BLITZ_REVEAL:      'PARTY_BLITZ_REVEAL',
  PARTY_CAROUSEL_ASSIGN:   'PARTY_CAROUSEL_ASSIGN',
  PARTY_CAROUSEL_REVEAL:   'PARTY_CAROUSEL_REVEAL',
  // Host → interrogateur seulement (privé)
  PARTY_DUEL_PICK_OPTIONS: 'PARTY_DUEL_PICK_OPTIONS',
  // Client → Host
  PARTY_STREAK_CHOICE:     'PARTY_STREAK_CHOICE',
  PARTY_DUEL_PICK:         'PARTY_DUEL_PICK',
  PARTY_DUEL_CHOICE:       'PARTY_DUEL_CHOICE',
  PARTY_TF_VOTE:           'PARTY_TF_VOTE',
  PARTY_RACE_CHOICE:       'PARTY_RACE_CHOICE',
  PARTY_BLITZ_CHOICE:      'PARTY_BLITZ_CHOICE',
  PARTY_CAROUSEL_CHOICE:   'PARTY_CAROUSEL_CHOICE',
};

// ─── Phases internes ──────────────────────────────────────────────────────────

export const PARTY_PHASE = {
  MINI_INTRO:         'PARTY_MINI_INTRO',
  STREAK_QUESTION:    'PARTY_STREAK_QUESTION',
  STREAK_REVEAL:      'PARTY_STREAK_REVEAL',
  MINI_END:           'PARTY_MINI_END',
  DUEL_ASSIGN:        'PARTY_DUEL_ASSIGN',
  DUEL_PICKING:       'PARTY_DUEL_PICKING',
  DUEL_QUESTION:      'PARTY_DUEL_QUESTION',
  DUEL_RESULT:        'PARTY_DUEL_RESULT',
  TF_QUESTION:        'PARTY_TF_QUESTION',
  TF_VOTING:          'PARTY_TF_VOTING',
  TF_REVEAL:          'PARTY_TF_REVEAL',
  RACE_QUESTION:      'PARTY_RACE_QUESTION',
  RACE_REVEAL:        'PARTY_RACE_REVEAL',
  BLITZ_QUESTION:     'PARTY_BLITZ_QUESTION',
  BLITZ_REVEAL:       'PARTY_BLITZ_REVEAL',
  CAROUSEL_ASSIGN:    'PARTY_CAROUSEL_ASSIGN',
  CAROUSEL_QUESTION:  'PARTY_CAROUSEL_QUESTION',
  CAROUSEL_REVEAL:    'PARTY_CAROUSEL_REVEAL',
  GAME_OVER:          'PARTY_GAME_OVER',
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const MINI_Q_COUNT     = 5;   // 5 questions par mini-jeu
const DUEL_ROUNDS      = 5;   // 5 duels × 2 options = 10 questions duel

const STREAK_ANSWER_MS  = 15000;
const STREAK_REVEAL_MS  = 3500;
const DUEL_ASSIGN_MS    = 3000;
const DUEL_PICK_MS      = 20000;
const DUEL_ANSWER_MS    = 15000;
const DUEL_RESULT_MS    = 4500;
const TF_PREVIEW_MS     = 3000;
const TF_VOTE_MS        = 7000;
const TF_REVEAL_MS      = 3500;
const RACE_ANSWER_MS    = 15000;
const RACE_REVEAL_MS    = 3500;
const BLITZ_ANSWER_MS   = 5000;
const BLITZ_REVEAL_MS   = 3000;
const CAROUSEL_PREP_MS  = 2500;
const CAROUSEL_ANS_MS   = 12000;
const CAROUSEL_REV_MS   = 3000;
const MINI_END_MS       = 6000;

/** Nombre total de questions à pré-charger (6 mini-jeux × 5 questions, + 10 pour le duel) */
export const PARTY_QUESTIONS_NEEDED = MINI_Q_COUNT * 5 + DUEL_ROUNDS * 2; // 35

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function streakPoints(max) {
  if (max >= 4) return 8;
  return max; // 0, 1, 2, 3
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────

export class PartyGameEngine {
  /**
   * @param {import('./peer.js').QuizPeer} peer
   * @param {function(object): void} onStateChange
   */
  constructor(peer, onStateChange) {
    this.peer = peer;
    this.onStateChange = onStateChange;

    this.state = {
      phase: 'LOBBY',
      players: [],      // { id, name, score, ready }
      config: {},
      miniSequence: [],
      currentMiniIndex: -1,
      currentMini: null,

      // ── STREAK ──────────────────────────────────────────────────────────
      streakQuestions: [],
      streakIndex: -1,
      streakCurrentQuestion: null,
      streakAnswers: {},   // { playerId: choice }
      streaks: {},         // { playerId: { current, max } }
      streakReveal: null,

      // ── DUEL ────────────────────────────────────────────────────────────
      duelQuestions: [],
      duelIndex: -1,
      duelInterrogateur: null,
      duelPickOptions: [], // [{ id, text, choices, correctAnswer }]
      duelCurrentQuestion: null,
      duelAnswers: {},     // { playerId: choice }
      duelResult: null,

      // ── SPEED_TF ────────────────────────────────────────────────────────
      tfQuestions: [],
      tfIndex: -1,
      tfStatement: '',
      tfCorrectVote: 'V',
      tfVotes: {},         // { playerId: 'V' | 'F' }
      tfResult: null,

      // ── RACE ─────────────────────────────────────────────────────────────
      raceQuestions: [],
      raceIndex: -1,
      raceCurrentQuestion: null,
      raceAnswers: {},     // { playerId: { choice, ts } }
      raceReveal: null,

      // ── BLITZ ─────────────────────────────────────────────────────────────
      blitzQuestions: [],
      blitzIndex: -1,
      blitzCurrentQuestion: null,
      blitzAnswers: {},    // { playerId: choice }
      blitzReveal: null,

      // ── CAROUSEL ──────────────────────────────────────────────────────────
      carouselQuestions: [],
      carouselIndex: -1,
      carouselCurrentQuestion: null,
      carouselActivePlayer: null,
      carouselAnswer: null,
      carouselReveal: null,

      // ── Shared ──────────────────────────────────────────────────────────
      lastMiniScores: null,
      finalScores: null,
    };

    this._timer = null;
  }

  // ─── Timer helpers ─────────────────────────────────────────────────────────

  _setTimer(ms, fn) { this._clearTimer(); this._timer = setTimeout(fn, ms); }
  _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }

  // ─── Player management ─────────────────────────────────────────────────────

  addPlayer(peerId, name) {
    const existing = this.state.players.find(p => p.id === peerId);
    if (existing) { existing.name = name; this._broadcastPlayerList(); return; }
    const inGame = this.state.phase !== 'LOBBY';
    this.state.players.push({ id: peerId, name, score: 0, ready: peerId === '__host__' || inGame });
    this._broadcastPlayerList();
  }

  removePlayer(peerId) {
    this.state.players = this.state.players.filter(p => p.id !== peerId);
    this._broadcastPlayerList();
    // Si l'interrogateur déconnecte pendant le pick, auto-avancer
    if (this.state.phase === PARTY_PHASE.DUEL_PICKING && this.state.duelInterrogateur === peerId) {
      this._clearTimer();
      this._duelAutoPick();
    }
  }

  markReady(peerId) {
    const p = this.state.players.find(pl => pl.id === peerId);
    if (p) p.ready = true;
    this._broadcastPlayerList();
  }

  _broadcastPlayerList() {
    const players = this.state.players.map(({ id, name, score, ready }) => ({ id, name, score, ready }));
    this.peer.broadcast({ type: MSG.PLAYER_LIST, players });
    this.onStateChange({ ...this.state });
  }

  _getScores() {
    return Object.fromEntries(this.state.players.map(p => [p.id, p.score]));
  }

  // ─── Démarrage ────────────────────────────────────────────────────────────

  startGame(allQuestions, config = {}) {
    this._clearTimer();
    this.state.config = config;

    // Par défaut : sélectionner 3 mini-jeux aléatoirement parmi tous les disponibles
    let chosenMinis;
    if (config.partyMinis?.length) {
      chosenMinis = config.partyMinis;
    } else {
      // Mode tout aléatoire : choisir 3 mini-jeux parmi les 6 disponibles
      chosenMinis = shuffle(ALL_PARTY_MINIS).slice(0, 3);
    }
    this.state.miniSequence = config.partyRandom !== false ? shuffle(chosenMinis) : [...chosenMinis];

    this.state.players.forEach(p => { p.score = 0; p.ready = false; });
    const host = this.state.players.find(p => p.id === '__host__');
    if (host) host.ready = true;

    this.state.streaks = {};
    this.state.players.forEach(p => { this.state.streaks[p.id] = { current: 0, max: 0 }; });

    // Distribuer les questions entre les mini-jeux (pool partagé shufflé)
    const qs = shuffle(allQuestions);
    let qi = 0;
    const take = (n) => { const s = qs.slice(qi, qi + n); qi += n; return s; };

    this.state.streakQuestions   = take(MINI_Q_COUNT);
    this.state.duelQuestions     = take(DUEL_ROUNDS * 2);
    this.state.tfQuestions       = take(MINI_Q_COUNT);
    this.state.raceQuestions     = take(MINI_Q_COUNT);
    this.state.blitzQuestions    = take(MINI_Q_COUNT);
    this.state.carouselQuestions = take(MINI_Q_COUNT);

    this.peer.broadcast({ type: MSG.GAME_START, mode: 'PARTY', config: { ...config, mode: 'PARTY' } });

    this.state.currentMiniIndex = -1;
    this._startNextMini();
  }

  // ─── Transitions entre mini-jeux ──────────────────────────────────────────

  _startNextMini() {
    this._clearTimer();
    this.state.currentMiniIndex++;

    if (this.state.currentMiniIndex >= this.state.miniSequence.length) {
      this._endGame();
      return;
    }

    this.state.currentMini = this.state.miniSequence[this.state.currentMiniIndex];
    this.state.lastMiniScores = null;
    this.state.phase = PARTY_PHASE.MINI_INTRO;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_MINI_START,
      mini: this.state.currentMini,
      miniIndex: this.state.currentMiniIndex,
      totalMinis: this.state.miniSequence.length,
      label: PARTY_MINI_LABELS[this.state.currentMini],
      icon: PARTY_MINI_ICONS[this.state.currentMini],
      rules: PARTY_MINI_RULES[this.state.currentMini],
      scores: this._getScores(),
    });
    this.onStateChange({ ...this.state });
    // L'hôte doit confirmer via hostStartMini() pour lancer le mini-jeu
  }

  /** Appelé par l'hôte pour confirmer et démarrer le mini-jeu courant */
  hostStartMini() {
    if (this.state.phase !== PARTY_PHASE.MINI_INTRO) return;
    this.peer.broadcast({ type: PARTY_MSG.PARTY_MINI_READY, mini: this.state.currentMini });
    switch (this.state.currentMini) {
      case PARTY_MINI.STREAK:   this._startStreak();   break;
      case PARTY_MINI.DUEL:     this._startDuel();     break;
      case PARTY_MINI.SPEED_TF: this._startTF();       break;
      case PARTY_MINI.RACE:     this._startRace();     break;
      case PARTY_MINI.BLITZ:    this._startBlitz();    break;
      case PARTY_MINI.CAROUSEL: this._startCarousel(); break;
    }
  }

  _endMini(miniScores = {}) {
    this._clearTimer();
    this.state.lastMiniScores = miniScores;
    this.state.phase = PARTY_PHASE.MINI_END;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_MINI_END,
      mini: this.state.currentMini,
      miniScores,
      scores: this._getScores(),
    });
    this.onStateChange({ ...this.state });
    this._setTimer(MINI_END_MS, () => this._startNextMini());
  }

  // ─── STREAK ───────────────────────────────────────────────────────────────

  _startStreak() {
    this.state.streakIndex = -1;
    this.state.players.forEach(p => { this.state.streaks[p.id] = { current: 0, max: 0 }; });
    this._streakNext();
  }

  _streakNext() {
    this._clearTimer();
    this.state.streakIndex++;
    this.state.streakAnswers = {};
    this.state.streakReveal = null;

    if (this.state.streakIndex >= this.state.streakQuestions.length) {
      this._streakFinish();
      return;
    }

    const q = this.state.streakQuestions[this.state.streakIndex];
    this.state.streakCurrentQuestion = q;
    this.state.phase = PARTY_PHASE.STREAK_QUESTION;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_STREAK_QUESTION,
      text: q.text,
      choices: q.choices ?? [],
      category: q.category,
      difficulty: q.difficulty,
      index: this.state.streakIndex,
      total: this.state.streakQuestions.length,
    });
    this.onStateChange({ ...this.state });

    this._setTimer(STREAK_ANSWER_MS, () => {
      if (this.state.phase === PARTY_PHASE.STREAK_QUESTION) this._streakReveal();
    });
  }

  handleStreakChoice(peerId, choice) {
    if (this.state.phase !== PARTY_PHASE.STREAK_QUESTION) return;
    if (this.state.streakAnswers[peerId] !== undefined) return;
    this.state.streakAnswers[peerId] = choice;
    this.onStateChange({ ...this.state });

    const active = this.state.players;
    if (active.every(p => this.state.streakAnswers[p.id] !== undefined)) {
      this._clearTimer();
      this._streakReveal();
    }
  }

  _streakReveal() {
    this._clearTimer();
    const q = this.state.streakCurrentQuestion;
    const results = {};

    this.state.players.forEach(p => {
      const choice = this.state.streakAnswers[p.id];
      const correct = choice === q.correctAnswer;
      results[p.id] = { choice: choice ?? null, correct };
      const s = this.state.streaks[p.id] ?? { current: 0, max: 0 };
      if (correct) { s.current++; if (s.current > s.max) s.max = s.current; }
      else { s.current = 0; }
      this.state.streaks[p.id] = s;
    });

    this.state.streakReveal = {
      correctAnswer: q.correctAnswer,
      results,
      streaks: { ...this.state.streaks },
    };
    this.state.phase = PARTY_PHASE.STREAK_REVEAL;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_STREAK_REVEAL,
      correctAnswer: q.correctAnswer,
      results,
      streaks: { ...this.state.streaks },
    });
    this.onStateChange({ ...this.state });
    this._setTimer(STREAK_REVEAL_MS, () => this._streakNext());
  }

  _streakFinish() {
    const miniScores = {};
    this.state.players.forEach(p => {
      const pts = streakPoints((this.state.streaks[p.id] ?? { max: 0 }).max);
      p.score += pts;
      miniScores[p.id] = pts;
    });
    this._endMini(miniScores);
  }

  // ─── DUEL ─────────────────────────────────────────────────────────────────

  _startDuel() {
    if (this.state.players.length < 2) { this._endMini({}); return; }
    this.state.duelIndex = -1;
    this._duelNextRound();
  }

  _duelNextRound() {
    this._clearTimer();
    this.state.duelIndex++;
    this.state.duelResult = null;
    this.state.duelAnswers = {};
    this.state.duelCurrentQuestion = null;
    this.state.duelPickOptions = [];
    this.state.duelInterrogateur = null;

    if (this.state.duelIndex >= DUEL_ROUNDS) { this._endMini({}); return; }

    if (this.state.players.length < 2) { this._endMini({}); return; }

    // Rotation de l'interrogateur parmi tous les joueurs
    this.state.duelInterrogateur = this.state.players[this.state.duelIndex % this.state.players.length].id;

    const start = this.state.duelIndex * 2;
    this.state.duelPickOptions = this.state.duelQuestions.slice(start, start + 2).filter(Boolean);
    if (!this.state.duelPickOptions.length) { this._endMini({}); return; }

    const interrogateurName = this.state.players.find(p => p.id === this.state.duelInterrogateur)?.name ?? '';
    this.state.phase = PARTY_PHASE.DUEL_ASSIGN;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_DUEL_ASSIGN,
      interrogateurId: this.state.duelInterrogateur,
      interrogateurName,
      duelIndex: this.state.duelIndex,
      totalDuels: DUEL_ROUNDS,
    });
    this.onStateChange({ ...this.state });

    // Envoyer les options de choix en privé à l'interrogateur (si ce n'est pas l'hôte)
    if (this.state.duelInterrogateur !== '__host__') {
      this.peer.sendTo(this.state.duelInterrogateur, {
        type: PARTY_MSG.PARTY_DUEL_PICK_OPTIONS,
        options: this.state.duelPickOptions.map(q => ({
          id: q.id, text: q.text, choices: q.choices ?? [], correctAnswer: q.correctAnswer,
        })),
      });
    }
    // Si l'hôte est l'interrogateur, il lit les options depuis state.duelPickOptions

    this._setTimer(DUEL_ASSIGN_MS, () => {
      this.state.phase = PARTY_PHASE.DUEL_PICKING;
      this.onStateChange({ ...this.state });
      this._setTimer(DUEL_PICK_MS, () => {
        if (this.state.phase === PARTY_PHASE.DUEL_PICKING) this._duelAutoPick();
      });
    });
  }

  handleDuelPick(peerId, questionId) {
    if (this.state.phase !== PARTY_PHASE.DUEL_PICKING) return;
    if (peerId !== this.state.duelInterrogateur && peerId !== '__host__') return;
    this._clearTimer();
    const q = this.state.duelPickOptions.find(q => q.id === questionId) ?? this.state.duelPickOptions[0];
    this._duelShowQuestion(q);
  }

  _duelAutoPick() { this._duelShowQuestion(this.state.duelPickOptions[0]); }

  _duelShowQuestion(q) {
    if (!q) { this._duelNextRound(); return; }
    this._clearTimer();
    this.state.duelCurrentQuestion = q;
    this.state.duelAnswers = {};
    this.state.phase = PARTY_PHASE.DUEL_QUESTION;

    const interrogateurName = this.state.players.find(p => p.id === this.state.duelInterrogateur)?.name ?? '';
    this.peer.broadcast({
      type: PARTY_MSG.PARTY_DUEL_QUESTION,
      questionText: q.text,
      choices: q.choices ?? [],
      category: q.category,
      difficulty: q.difficulty,
      interrogateurId: this.state.duelInterrogateur,
      interrogateurName,
      duelIndex: this.state.duelIndex,
      totalDuels: DUEL_ROUNDS,
    });
    this.onStateChange({ ...this.state });

    this._setTimer(DUEL_ANSWER_MS, () => {
      if (this.state.phase === PARTY_PHASE.DUEL_QUESTION) this._duelReveal();
    });
  }

  handleDuelChoice(peerId, choice) {
    if (this.state.phase !== PARTY_PHASE.DUEL_QUESTION) return;
    if (peerId === this.state.duelInterrogateur) return; // l'interrogateur ne répond pas
    if (this.state.duelAnswers[peerId] !== undefined) return;
    this.state.duelAnswers[peerId] = choice;
    this.onStateChange({ ...this.state });

    const answerable = this.state.players.filter(
      p => p.id !== this.state.duelInterrogateur
    );
    if (answerable.every(p => this.state.duelAnswers[p.id] !== undefined)) {
      this._clearTimer();
      this._duelReveal();
    }
  }

  _duelReveal() {
    this._clearTimer();
    const q = this.state.duelCurrentQuestion;
    const results = {};
    let correctCount = 0;
    let wrongCount = 0;

    this.state.players.forEach(p => {
      if (p.id === this.state.duelInterrogateur) return;
      const choice = this.state.duelAnswers[p.id];
      const correct = choice === q.correctAnswer;
      results[p.id] = { choice: choice ?? null, correct };
      if (correct) { correctCount++; p.score += 5; }
      else { wrongCount++; p.score -= 2; }
    });

    const ptsInterrogateur = (-2 * correctCount) + (3 * wrongCount);
    const interrogateur = this.state.players.find(p => p.id === this.state.duelInterrogateur);
    if (interrogateur) interrogateur.score += ptsInterrogateur;

    this.state.duelResult = {
      correctAnswer: q.correctAnswer,
      results,
      interrogateurId: this.state.duelInterrogateur,
      ptsInterrogateur,
      correctCount,
      wrongCount,
    };
    this.state.phase = PARTY_PHASE.DUEL_RESULT;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_DUEL_RESULT,
      correctAnswer: q.correctAnswer,
      results,
      interrogateurId: this.state.duelInterrogateur,
      ptsInterrogateur,
      correctCount,
      wrongCount,
      scores: this._getScores(),
    });
    this.onStateChange({ ...this.state });
    this._setTimer(DUEL_RESULT_MS, () => this._duelNextRound());
  }

  // ─── SPEED_TF ─────────────────────────────────────────────────────────────

  _startTF() {
    this.state.tfIndex = -1;
    this._tfNext();
  }

  _tfNext() {
    this._clearTimer();
    this.state.tfIndex++;
    this.state.tfVotes = {};
    this.state.tfResult = null;

    if (this.state.tfIndex >= this.state.tfQuestions.length) { this._endMini({}); return; }

    const q = this.state.tfQuestions[this.state.tfIndex];
    const isTrue = Math.random() < 0.5;
    let displayAnswer;
    if (isTrue) {
      displayAnswer = q.correctAnswer;
    } else {
      // Choisir la bonne réponse d'une autre question au hasard comme leurre
      const others = this.state.tfQuestions.filter((_, i) => i !== this.state.tfIndex);
      const other = others.length ? others[Math.floor(Math.random() * others.length)] : null;
      displayAnswer = other?.correctAnswer
        ?? q.choices?.find(c => c !== q.correctAnswer)
        ?? 'Réponse indisponible';
    }

    this.state.tfStatement = `"${displayAnswer}" est la bonne réponse à : ${q.text}`;
    this.state.tfCorrectVote = isTrue ? 'V' : 'F';
    this.state.phase = PARTY_PHASE.TF_QUESTION;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_TF_QUESTION,
      statement: this.state.tfStatement,
      tfIndex: this.state.tfIndex,
      totalTF: this.state.tfQuestions.length,
    });
    this.onStateChange({ ...this.state });

    // Aperçu 3 s puis ouverture du vote
    this._setTimer(TF_PREVIEW_MS, () => {
      this.state.phase = PARTY_PHASE.TF_VOTING;
      this.onStateChange({ ...this.state });
      this._setTimer(TF_VOTE_MS, () => {
        if (this.state.phase === PARTY_PHASE.TF_VOTING) this._tfReveal();
      });
    });
  }

  handleTFVote(peerId, vote) {
    if (this.state.phase !== PARTY_PHASE.TF_VOTING) return;
    if (!['V', 'F'].includes(vote)) return;
    if (this.state.tfVotes[peerId] !== undefined) return;
    this.state.tfVotes[peerId] = vote;
    this.onStateChange({ ...this.state });

    const active = this.state.players;
    if (active.every(p => this.state.tfVotes[p.id] !== undefined)) {
      this._clearTimer();
      this._tfReveal();
    }
  }

  _tfReveal() {
    this._clearTimer();
    const correctVote = this.state.tfCorrectVote;
    const votes = { ...this.state.tfVotes };

    this.state.players.forEach(p => {
      const vote = votes[p.id];
      if (!vote) return;
      if (vote === correctVote) p.score += 3;
      else p.score -= 2;
    });

    this.state.tfResult = {
      correctVote,
      votes,
      tfStatement: this.state.tfStatement,
    };
    this.state.phase = PARTY_PHASE.TF_REVEAL;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_TF_REVEAL,
      correctVote,
      votes,
      scores: this._getScores(),
      tfStatement: this.state.tfStatement,
    });
    this.onStateChange({ ...this.state });
    this._setTimer(TF_REVEAL_MS, () => this._tfNext());
  }

  // ─── RACE (Course classique) ──────────────────────────────────────────────

  _startRace() {
    this.state.raceIndex = -1;
    this._raceNext();
  }

  _raceNext() {
    this._clearTimer();
    this.state.raceIndex++;
    this.state.raceAnswers = {};
    this.state.raceReveal = null;

    if (this.state.raceIndex >= this.state.raceQuestions.length) { this._endMini({}); return; }

    const q = this.state.raceQuestions[this.state.raceIndex];
    this.state.raceCurrentQuestion = q;
    this.state.phase = PARTY_PHASE.RACE_QUESTION;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_RACE_QUESTION,
      text: q.text,
      choices: q.choices ?? [],
      category: q.category,
      difficulty: q.difficulty,
      index: this.state.raceIndex,
      total: this.state.raceQuestions.length,
    });
    this.onStateChange({ ...this.state });

    this._setTimer(RACE_ANSWER_MS, () => {
      if (this.state.phase === PARTY_PHASE.RACE_QUESTION) this._raceReveal();
    });
  }

  handleRaceChoice(peerId, choice) {
    if (this.state.phase !== PARTY_PHASE.RACE_QUESTION) return;
    if (this.state.raceAnswers[peerId] !== undefined) return;
    this.state.raceAnswers[peerId] = { choice, ts: Date.now() };
    this.onStateChange({ ...this.state });

    // Dès que tous les joueurs ont répondu → révéler
    const active = this.state.players.filter(p => p.id !== '__host__');
    if (active.every(p => this.state.raceAnswers[p.id] !== undefined)) {
      this._clearTimer();
      this._raceReveal();
    }
  }

  _raceReveal() {
    this._clearTimer();
    const q = this.state.raceCurrentQuestion;
    const answers = { ...this.state.raceAnswers };

    // Trier les joueurs ayant répondu correctement par timestamp
    const correct = Object.entries(answers)
      .filter(([, a]) => a.choice === q.correctAnswer)
      .sort((a, b) => a[1].ts - b[1].ts);

    const RACE_POINTS = [10, 6, 3, 1];
    const results = {};
    this.state.players.forEach(p => {
      if (p.id === '__host__') return;
      const ans = answers[p.id];
      if (!ans) { results[p.id] = { choice: null, correct: false, pts: 0 }; return; }
      const isCorrect = ans.choice === q.correctAnswer;
      if (isCorrect) {
        const rank = correct.findIndex(([pid]) => pid === p.id);
        const pts = RACE_POINTS[rank] ?? 1;
        p.score += pts;
        results[p.id] = { choice: ans.choice, correct: true, pts, rank: rank + 1 };
      } else {
        p.score -= 2;
        results[p.id] = { choice: ans.choice, correct: false, pts: -2 };
      }
    });

    this.state.raceReveal = { correctAnswer: q.correctAnswer, results };
    this.state.phase = PARTY_PHASE.RACE_REVEAL;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_RACE_REVEAL,
      correctAnswer: q.correctAnswer,
      results,
      scores: this._getScores(),
    });
    this.onStateChange({ ...this.state });
    this._setTimer(RACE_REVEAL_MS, () => this._raceNext());
  }

  // ─── BLITZ (QCM ultra-rapide) ─────────────────────────────────────────────

  _startBlitz() {
    this.state.blitzIndex = -1;
    this._blitzNext();
  }

  _blitzNext() {
    this._clearTimer();
    this.state.blitzIndex++;
    this.state.blitzAnswers = {};
    this.state.blitzReveal = null;

    if (this.state.blitzIndex >= this.state.blitzQuestions.length) { this._endMini({}); return; }

    const q = this.state.blitzQuestions[this.state.blitzIndex];
    this.state.blitzCurrentQuestion = q;
    this.state.phase = PARTY_PHASE.BLITZ_QUESTION;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_BLITZ_QUESTION,
      text: q.text,
      choices: q.choices ?? [],
      category: q.category,
      difficulty: q.difficulty,
      index: this.state.blitzIndex,
      total: this.state.blitzQuestions.length,
      timerMs: BLITZ_ANSWER_MS,
    });
    this.onStateChange({ ...this.state });

    this._setTimer(BLITZ_ANSWER_MS, () => {
      if (this.state.phase === PARTY_PHASE.BLITZ_QUESTION) this._blitzReveal();
    });
  }

  handleBlitzChoice(peerId, choice) {
    if (this.state.phase !== PARTY_PHASE.BLITZ_QUESTION) return;
    if (this.state.blitzAnswers[peerId] !== undefined) return;
    this.state.blitzAnswers[peerId] = choice;
    this.onStateChange({ ...this.state });

    const active = this.state.players.filter(p => p.id !== '__host__');
    if (active.every(p => this.state.blitzAnswers[p.id] !== undefined)) {
      this._clearTimer();
      this._blitzReveal();
    }
  }

  _blitzReveal() {
    this._clearTimer();
    const q = this.state.blitzCurrentQuestion;
    const answers = { ...this.state.blitzAnswers };
    const results = {};

    this.state.players.forEach(p => {
      if (p.id === '__host__') return;
      const choice = answers[p.id];
      if (!choice) { results[p.id] = { choice: null, correct: false, pts: 0 }; return; }
      const isCorrect = choice === q.correctAnswer;
      const pts = isCorrect ? 5 : -2;
      p.score += pts;
      results[p.id] = { choice, correct: isCorrect, pts };
    });

    this.state.blitzReveal = { correctAnswer: q.correctAnswer, results };
    this.state.phase = PARTY_PHASE.BLITZ_REVEAL;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_BLITZ_REVEAL,
      correctAnswer: q.correctAnswer,
      results,
      scores: this._getScores(),
    });
    this.onStateChange({ ...this.state });
    this._setTimer(BLITZ_REVEAL_MS, () => this._blitzNext());
  }

  // ─── CAROUSEL (Carrousel tour à tour) ────────────────────────────────────

  _startCarousel() {
    this.state.carouselIndex = -1;
    this.state._carouselPlayerOffset = 0;
    this._carouselNext();
  }

  _carouselNext() {
    this._clearTimer();
    this.state.carouselIndex++;
    this.state.carouselAnswer = null;
    this.state.carouselReveal = null;

    if (this.state.carouselIndex >= this.state.carouselQuestions.length) { this._endMini({}); return; }

    const q = this.state.carouselQuestions[this.state.carouselIndex];
    this.state.carouselCurrentQuestion = q;

    // Désigner le joueur actif en rotation
    const activePlayers = this.state.players.filter(p => p.id !== '__host__');
    const offset = this.state._carouselPlayerOffset ?? 0;
    const player = activePlayers[offset % activePlayers.length];
    this.state.carouselActivePlayer = player?.id ?? null;
    this.state._carouselPlayerOffset = (offset + 1);

    this.state.phase = PARTY_PHASE.CAROUSEL_ASSIGN;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_CAROUSEL_ASSIGN,
      activePlayer: this.state.carouselActivePlayer,
      index: this.state.carouselIndex,
      total: this.state.carouselQuestions.length,
    });
    this.onStateChange({ ...this.state });

    // Courte pause puis affichage de la question
    this._setTimer(CAROUSEL_PREP_MS, () => {
      this.state.phase = PARTY_PHASE.CAROUSEL_QUESTION;
      this.peer.broadcast({
        type: PARTY_MSG.PARTY_CAROUSEL_ASSIGN,
        activePlayer: this.state.carouselActivePlayer,
        text: q.text,
        choices: q.choices ?? [],
        category: q.category,
        difficulty: q.difficulty,
        index: this.state.carouselIndex,
        total: this.state.carouselQuestions.length,
        showQuestion: true,
      });
      this.onStateChange({ ...this.state });

      this._setTimer(CAROUSEL_ANS_MS, () => {
        if (this.state.phase === PARTY_PHASE.CAROUSEL_QUESTION) {
          this._carouselReveal(null);
        }
      });
    });
  }

  handleCarouselChoice(peerId, choice) {
    if (this.state.phase !== PARTY_PHASE.CAROUSEL_QUESTION) return;
    if (peerId !== this.state.carouselActivePlayer) return;
    if (this.state.carouselAnswer !== null) return;
    this.state.carouselAnswer = choice;
    this._clearTimer();
    this._carouselReveal(choice);
  }

  _carouselReveal(choice) {
    this._clearTimer();
    const q = this.state.carouselCurrentQuestion;
    const player = this.state.players.find(p => p.id === this.state.carouselActivePlayer);
    const isCorrect = choice !== null && choice === q.correctAnswer;
    const pts = isCorrect ? 10 : (choice !== null ? -3 : 0);
    if (player) player.score += pts;

    this.state.carouselReveal = {
      correctAnswer: q.correctAnswer,
      activePlayer: this.state.carouselActivePlayer,
      choice,
      correct: isCorrect,
      pts,
    };
    this.state.phase = PARTY_PHASE.CAROUSEL_REVEAL;

    this.peer.broadcast({
      type: PARTY_MSG.PARTY_CAROUSEL_REVEAL,
      correctAnswer: q.correctAnswer,
      activePlayer: this.state.carouselActivePlayer,
      choice,
      correct: isCorrect,
      pts,
      scores: this._getScores(),
    });
    this.onStateChange({ ...this.state });
    this._setTimer(CAROUSEL_REV_MS, () => this._carouselNext());
  }

  // ─── Fin de partie ────────────────────────────────────────────────────────

  _endGame() {
    this._clearTimer();
    this.state.phase = PARTY_PHASE.GAME_OVER;
    const finalScores = [...this.state.players]
      .sort((a, b) => b.score - a.score)
      .map(({ id, name, score }) => ({ id, name, score }));
    this.state.finalScores = finalScores;
    this.peer.broadcast({ type: MSG.GAME_OVER, finalScores });
    this.onStateChange({ ...this.state });
  }

  // ─── Dispatch des messages des clients ────────────────────────────────────

  handleMessage(from, data) {
    switch (data.type) {
      case MSG.JOIN:  this.addPlayer(from, data.name ?? 'Anonyme'); this.markReady(from); break;
      case MSG.READY: this.markReady(from); break;
      case PARTY_MSG.PARTY_STREAK_CHOICE:   this.handleStreakChoice(from, data.choice);   break;
      case PARTY_MSG.PARTY_DUEL_PICK:       this.handleDuelPick(from, data.questionId);   break;
      case PARTY_MSG.PARTY_DUEL_CHOICE:     this.handleDuelChoice(from, data.choice);     break;
      case PARTY_MSG.PARTY_TF_VOTE:         this.handleTFVote(from, data.vote);           break;
      case PARTY_MSG.PARTY_RACE_CHOICE:     this.handleRaceChoice(from, data.choice);     break;
      case PARTY_MSG.PARTY_BLITZ_CHOICE:    this.handleBlitzChoice(from, data.choice);    break;
      case PARTY_MSG.PARTY_CAROUSEL_CHOICE: this.handleCarouselChoice(from, data.choice); break;
    }
  }

  // ─── Contrôles hôte ───────────────────────────────────────────────────────

  hostSkip() {
    switch (this.state.phase) {
      case PARTY_PHASE.STREAK_QUESTION:  this._clearTimer(); this._streakReveal();   break;
      case PARTY_PHASE.DUEL_PICKING:     this._clearTimer(); this._duelAutoPick();   break;
      case PARTY_PHASE.DUEL_QUESTION:    this._clearTimer(); this._duelReveal();     break;
      case PARTY_PHASE.TF_VOTING:        this._clearTimer(); this._tfReveal();       break;
      case PARTY_PHASE.RACE_QUESTION:    this._clearTimer(); this._raceReveal();     break;
      case PARTY_PHASE.BLITZ_QUESTION:   this._clearTimer(); this._blitzReveal();    break;
      case PARTY_PHASE.CAROUSEL_QUESTION: this._clearTimer(); this._carouselReveal(this.state.carouselAnswer); break;
    }
  }
}

/**
 * party-game.js — Moteur du mode Party Quiz
 *
 * 3 mini-jeux enchaînés (ordre configurable) :
 *  STREAK   — 4 à la suite : réponses QCM simultanées, points selon la série max
 *  DUEL     — Interrogatoire : 1 joueur choisit une question, tous les autres répondent en QCM
 *  SPEED_TF — Vrai ou Faux rapide : vote simultané 7 s, bonus / malus
 */

import { MSG } from './constants.js';

// ─── Mini-jeux ────────────────────────────────────────────────────────────────

export const PARTY_MINI = {
  STREAK:   'STREAK',
  DUEL:     'DUEL',
  SPEED_TF: 'SPEED_TF',
};

export const PARTY_MINI_LABELS = {
  [PARTY_MINI.STREAK]:   '🔥 4 à la suite',
  [PARTY_MINI.DUEL]:     '🎯 Interrogatoire',
  [PARTY_MINI.SPEED_TF]: '⚡ Vrai ou Faux',
};

export const PARTY_MINI_ICONS = {
  [PARTY_MINI.STREAK]:   '🔥',
  [PARTY_MINI.DUEL]:     '🎯',
  [PARTY_MINI.SPEED_TF]: '⚡',
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
  // Host → interrogateur seulement (privé)
  PARTY_DUEL_PICK_OPTIONS: 'PARTY_DUEL_PICK_OPTIONS',
  // Client → Host
  PARTY_STREAK_CHOICE:     'PARTY_STREAK_CHOICE',
  PARTY_DUEL_PICK:         'PARTY_DUEL_PICK',
  PARTY_DUEL_CHOICE:       'PARTY_DUEL_CHOICE',
  PARTY_TF_VOTE:           'PARTY_TF_VOTE',
};

// ─── Phases internes ──────────────────────────────────────────────────────────

export const PARTY_PHASE = {
  MINI_INTRO:      'PARTY_MINI_INTRO',
  STREAK_QUESTION: 'PARTY_STREAK_QUESTION',
  STREAK_REVEAL:   'PARTY_STREAK_REVEAL',
  MINI_END:        'PARTY_MINI_END',
  DUEL_ASSIGN:     'PARTY_DUEL_ASSIGN',
  DUEL_PICKING:    'PARTY_DUEL_PICKING',
  DUEL_QUESTION:   'PARTY_DUEL_QUESTION',
  DUEL_RESULT:     'PARTY_DUEL_RESULT',
  TF_QUESTION:     'PARTY_TF_QUESTION',
  TF_VOTING:       'PARTY_TF_VOTING',
  TF_REVEAL:       'PARTY_TF_REVEAL',
  GAME_OVER:       'PARTY_GAME_OVER',
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const MINI_Q_COUNT     = 5;   // 5 questions par mini-jeu
const DUEL_ROUNDS      = 5;   // 5 duels × 2 options = 10 questions duel

const STREAK_ANSWER_MS = 15000;
const STREAK_REVEAL_MS = 3500;
const DUEL_ASSIGN_MS   = 3000;
const DUEL_PICK_MS     = 20000;
const DUEL_ANSWER_MS   = 15000;
const DUEL_RESULT_MS   = 4500;
const TF_PREVIEW_MS    = 3000;
const TF_VOTE_MS       = 7000;
const TF_REVEAL_MS     = 3500;
const MINI_END_MS      = 6000;

/** Nombre total de questions à pré-charger pour une partie Party */
export const PARTY_QUESTIONS_NEEDED = MINI_Q_COUNT + DUEL_ROUNDS * 2 + MINI_Q_COUNT; // 20

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

    const chosenMinis = config.partyMinis?.length
      ? config.partyMinis
      : [PARTY_MINI.STREAK, PARTY_MINI.DUEL, PARTY_MINI.SPEED_TF];
    this.state.miniSequence = config.partyRandom ? shuffle(chosenMinis) : [...chosenMinis];

    this.state.players.forEach(p => { p.score = 0; p.ready = false; });
    const host = this.state.players.find(p => p.id === '__host__');
    if (host) host.ready = true;

    this.state.streaks = {};
    this.state.players.forEach(p => { this.state.streaks[p.id] = { current: 0, max: 0 }; });

    // Distribuer les questions entre les mini-jeux
    const qs = shuffle(allQuestions);
    this.state.streakQuestions = qs.slice(0, MINI_Q_COUNT);
    this.state.duelQuestions   = qs.slice(MINI_Q_COUNT, MINI_Q_COUNT + DUEL_ROUNDS * 2);
    this.state.tfQuestions     = qs.slice(MINI_Q_COUNT + DUEL_ROUNDS * 2, MINI_Q_COUNT + DUEL_ROUNDS * 2 + MINI_Q_COUNT);

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
      case PARTY_MINI.STREAK:   this._startStreak(); break;
      case PARTY_MINI.DUEL:     this._startDuel();   break;
      case PARTY_MINI.SPEED_TF: this._startTF();     break;
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
      case PARTY_MSG.PARTY_STREAK_CHOICE: this.handleStreakChoice(from, data.choice); break;
      case PARTY_MSG.PARTY_DUEL_PICK:     this.handleDuelPick(from, data.questionId); break;
      case PARTY_MSG.PARTY_DUEL_CHOICE:   this.handleDuelChoice(from, data.choice); break;
      case PARTY_MSG.PARTY_TF_VOTE:       this.handleTFVote(from, data.vote); break;
    }
  }

  // ─── Contrôles hôte ───────────────────────────────────────────────────────

  hostSkip() {
    switch (this.state.phase) {
      case PARTY_PHASE.STREAK_QUESTION: this._clearTimer(); this._streakReveal();  break;
      case PARTY_PHASE.DUEL_PICKING:    this._clearTimer(); this._duelAutoPick();  break;
      case PARTY_PHASE.DUEL_QUESTION:   this._clearTimer(); this._duelReveal();    break;
      case PARTY_PHASE.TF_VOTING:       this._clearTimer(); this._tfReveal();      break;
    }
  }
}

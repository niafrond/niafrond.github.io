/**
 * game.js — Moteur de jeu Quiz (côté HOST uniquement)
 *
 * State machine :
 *  LOBBY → [DRAFT] → QUESTION_PREVIEW → [BETTING] → BUZZING → ANSWERING
 *       → ANSWER_RESULT → QUESTION_END → QUESTION_PREVIEW (suivant) → … → GAME_OVER
 *
 * Fonctionnalités spéciales :
 *  - Mode Ping-Pong : tour à tour sans buzzer
 *  - Combo Streak   : multiplicateur sur les bonnes réponses consécutives
 *  - Double ou rien : parier son score avant de répondre
 *  - Pari secret    : miser des points avant chaque question
 *  - Cible cachée   : choisir secrètement un adversaire à battre
 *  - Pouvoirs       : ralentir / cacher / doubler un joueur (avec cooldown)
 *  - Draft catégories : chaque joueur choisit ses thèmes en début de partie
 */

import { MSG, PHASE, MODE, SCORE, TIMER, STREAK, POWER, POWER_COOLDOWN } from './constants.js';
import { validateAnswer, proximityScore } from './fuzzy.js';

/** Distance de Levenshtein maximale pour considérer une réponse comme "presque correcte" */
const NEAR_MISS_THRESHOLD = 1;

/** Calcule le bonus de rapidité (0 à SCORE.SPEED_BONUS_MAX) selon le temps restant */
function calcSpeedBonus(elapsedMs, totalMs) {
  if (totalMs <= 0) return 0;
  const ratio = Math.max(0, 1 - elapsedMs / totalMs);
  return Math.round(SCORE.SPEED_BONUS_MAX * ratio);
}

/** Retourne le multiplicateur de streak pour un nombre de bonnes réponses consécutives */
function streakMultiplier(streak) {
  if (streak >= STREAK.THRESHOLD_2) return STREAK.MULTIPLIER_2;
  if (streak >= STREAK.THRESHOLD_1) return STREAK.MULTIPLIER_1;
  return 1;
}

export class GameEngine {
  /**
   * @param {import('./peer.js').QuizPeer} peer
   * @param {Function} onStateChange — appelé à chaque changement de phase/scores
   */
  constructor(peer, onStateChange) {
    this.peer = peer;
    this.onStateChange = onStateChange;

    this.state = {
      phase: PHASE.LOBBY,
      mode: MODE.CLASSIC,
      players: [],       // { id, name, score, ready, streak, powers, powerEffects }
      questions: [],     // Questions normalisées
      currentIndex: -1,  // Index de la question en cours
      buzzQueue: [],     // [peerId, ...] ordre d'arrivée des buzzes
      buzzDeadline: null, // Timestamp absolu de fin de la fenêtre de buzz
      wrongAnswers: [],  // Joueurs ayant répondu faux en mode buzzer (question courante)
      eliminatedPlayers: [], // Joueurs ayant mal répondu en QCM (question courante)
      lastResult: null,  // { correct, playerId, answer, points, speedBonus, nearMiss }
      config: {
        questionCount: 10,
        answerTime: 15,
        showAnswerToHost: false,
        applyMalus: false,
        mode: MODE.CLASSIC,
        hostIsReader: false,
        comboStreak: false,
        doubleOrNothing: false,
        secretBet: false,
        hiddenTarget: false,
        powers: false,
        draftCategories: false,
      },
      // ── Fonctionnalités spéciales ─────────────────────────────────────────
      bets: {},              // { [playerId]: amount } — paris secrets (non diffusés)
      betDeadline: null,
      doubleDownPlayers: [], // joueurs ayant activé "double ou rien" cette question
      targets: {},           // { [playerId]: targetId } — cibles cachées (non diffusées)
      roundPoints: {},       // { [playerId]: points earned this question }
      pingpongOrderOffset: 0, // rotation du premier joueur en ping-pong
      // ── Draft ────────────────────────────────────────────────────────────
      draftPicks: {},             // { [playerId]: category[] }
      draftCurrentPickerIndex: 0,
      draftCategories: [],        // catégories encore disponibles pour le draft
      draftRound: 0,
      draftTotalRounds: 1,
      _draftCallback: null,
    };

    this._previewTimer = null;
    this._buzzTimer = null;
    this._answerTimer = null;
    this._autoNextTimer = null;
    this._betTimer = null;
    this._draftTimer = null;
    this._answerStartTime = null;

    this.autoAdvance = false;
  }

  // ─── Accesseurs ──────────────────────────────────────────────────────────

  get currentQuestion() {
    return this.state.questions[this.state.currentIndex] ?? null;
  }

  _getAnswerDuration(peerId = null) {
    const base = (this.state.config.answerTime ?? 15) * 1000;
    let dur;
    if (this.state.mode === MODE.SPEED) {
      dur = Math.min(base, TIMER.SPEED_ANSWER);
    } else {
      dur = base;
    }
    // Pouvoir SLOW : divise le timer par 2 pour ce joueur
    if (peerId && this._getPowerEffect(peerId, POWER.SLOW)) {
      dur = Math.round(dur / 2);
    }
    return dur;
  }

  _getScores() {
    return Object.fromEntries(this.state.players.map(p => [p.id, p.score]));
  }

  _getPowerEffect(peerId, power) {
    const player = this.state.players.find(p => p.id === peerId);
    return !!(player?.powerEffects?.[power]);
  }

  // ─── Gestion des joueurs (LOBBY) ─────────────────────────────────────────

  addPlayer(peerId, name) {
    const existing = this.state.players.find(p => p.id === peerId);
    if (existing) {
      existing.name = name;
      this._broadcastPlayerList();
      return;
    }
    const inGame = this.state.phase !== PHASE.LOBBY && this.state.phase !== PHASE.DRAFT;
    this.state.players.push({
      id: peerId,
      name,
      score: 0,
      ready: peerId === '__host__' || inGame,
      streak: 0,
      powers: {},      // { [POWER]: lastUsedQuestionIndex }
      powerEffects: {}, // { [POWER]: boolean } effets actifs cette question
    });
    this._broadcastPlayerList();
  }

  removePlayer(peerId) {
    this.state.players = this.state.players.filter(p => p.id !== peerId);
    this.state.buzzQueue = this.state.buzzQueue.filter(id => id !== peerId);
    this.state.eliminatedPlayers = this.state.eliminatedPlayers.filter(id => id !== peerId);
    this._broadcastPlayerList();

    if (this.state.phase === PHASE.ANSWERING && this.state.mode === MODE.QCM) {
      this._checkAllQcmEliminated();
    }
  }

  markReady(peerId) {
    const p = this.state.players.find(pl => pl.id === peerId);
    if (p) p.ready = true;
    this._broadcastPlayerList();
  }

  _broadcastPlayerList() {
    const players = this.state.players.map(({ id, name, score, ready, streak, powers }) => ({
      id, name, score, ready, streak,
      powerCooldowns: powers, // cooldowns exposés aux clients
    }));
    this.peer.broadcast({ type: MSG.PLAYER_LIST, players });
    this.onStateChange({ ...this.state });
  }

  // ─── Draft de catégories ─────────────────────────────────────────────────

  /**
   * Démarre la phase de draft des catégories.
   * @param {string[]} availableCategories — clés de catégorie disponibles
   * @param {Function} onComplete — appelé avec les catégories choisies quand le draft est fini
   */
  startDraft(availableCategories, onComplete) {
    this._clearAllTimers();
    const players = this._getDraftPlayers();
    if (players.length === 0 || availableCategories.length === 0) {
      onComplete([]);
      return;
    }

    this.state.phase = PHASE.DRAFT;
    this.state.draftPicks = {};
    this.state.draftCurrentPickerIndex = 0;
    this.state.draftCategories = [...availableCategories];
    this.state.draftRound = 1;
    this.state.draftTotalRounds = 1;
    this.state._draftCallback = onComplete;

    players.forEach(p => { this.state.draftPicks[p.id] = []; });

    this._broadcastDraftState();
    this.onStateChange({ ...this.state });
    this._startDraftPickTimer();
  }

  _getDraftPlayers() {
    return this.state.players.filter(p =>
      !(this.state.config.hostIsReader && p.id === '__host__')
    );
  }

  _broadcastDraftState() {
    const players = this._getDraftPlayers();
    const currentPicker = players[this.state.draftCurrentPickerIndex]?.id ?? null;
    this.peer.broadcast({
      type: MSG.DRAFT_STATE,
      picks: { ...this.state.draftPicks },
      currentPicker,
      categories: [...this.state.draftCategories],
      round: this.state.draftRound,
      totalRounds: this.state.draftTotalRounds,
    });
  }

  _startDraftPickTimer() {
    this._clearTimer('draft');
    this._draftTimer = setTimeout(() => {
      const players = this._getDraftPlayers();
      const peerId = players[this.state.draftCurrentPickerIndex]?.id;
      if (peerId && this.state.draftCategories.length > 0) {
        this.handleDraftPick(peerId, this.state.draftCategories[0]);
      } else {
        this._finishDraft();
      }
    }, TIMER.DRAFT_PICK_DURATION);
  }

  handleDraftPick(peerId, category) {
    if (this.state.phase !== PHASE.DRAFT) return;
    const players = this._getDraftPlayers();
    const currentPicker = players[this.state.draftCurrentPickerIndex];
    if (!currentPicker || currentPicker.id !== peerId) return;
    if (!this.state.draftCategories.includes(category)) return;

    this._clearTimer('draft');

    if (!this.state.draftPicks[peerId]) this.state.draftPicks[peerId] = [];
    this.state.draftPicks[peerId].push(category);
    this.state.draftCategories = this.state.draftCategories.filter(c => c !== category);

    this.state.draftCurrentPickerIndex++;
    if (this.state.draftCurrentPickerIndex >= players.length) {
      if (this.state.draftRound >= this.state.draftTotalRounds) {
        this._finishDraft();
        return;
      }
      this.state.draftRound++;
      this.state.draftCurrentPickerIndex = 0;
    }

    this._broadcastDraftState();
    this.onStateChange({ ...this.state });
    this._startDraftPickTimer();
  }

  _finishDraft() {
    this._clearTimer('draft');
    const chosen = [...new Set(Object.values(this.state.draftPicks).flat())];
    this.state.phase = PHASE.LOBBY;
    this.onStateChange({ ...this.state });
    if (this.state._draftCallback) {
      const cb = this.state._draftCallback;
      this.state._draftCallback = null;
      cb(chosen);
    }
  }

  // ─── Démarrage ───────────────────────────────────────────────────────────

  startGame(questions, config = {}) {
    this._clearAllTimers();
    this.state.mode = config.mode ?? MODE.CLASSIC;
    this.state.config = { ...this.state.config, ...config };
    this.state.questions = questions;
    this.state.currentIndex = -1;
    this.state.pingpongOrderOffset = 0;
    this.state.players.forEach(p => {
      p.score = 0;
      p.ready = false;
      p.streak = 0;
      p.powers = {};
      p.powerEffects = {};
    });
    const host = this.state.players.find(p => p.id === '__host__');
    if (host) host.ready = true;

    this.peer.broadcast({ type: MSG.GAME_START, mode: this.state.mode, config: this.state.config });
    this._nextQuestion();
  }

  // ─── Transitions de phase ─────────────────────────────────────────────────

  _nextQuestion() {
    this._clearAllTimers();
    this.state.currentIndex++;
    this.state.buzzQueue = [];
    this.state.buzzDeadline = null;
    this.state.wrongAnswers = [];
    this.state.eliminatedPlayers = [];
    this.state.lastResult = null;
    this.state.bets = {};
    this.state.betDeadline = null;
    this.state.doubleDownPlayers = [];
    this.state.targets = {};
    this.state.roundPoints = {};
    // Réinitialiser les effets de pouvoir
    this.state.players.forEach(p => { p.powerEffects = {}; });

    if (this.state.currentIndex >= this.state.questions.length) {
      this._endGame();
      return;
    }

    this._startPreview();
  }

  _startPreview() {
    const q = this.currentQuestion;
    this.state.phase = PHASE.QUESTION_PREVIEW;
    this.onStateChange({ ...this.state });

    this.peer.broadcast({
      type: MSG.SHOW_QUESTION,
      index: this.state.currentIndex,
      text: q.text,
      choices: (this.state.mode === MODE.QCM || this.state.mode === MODE.PINGPONG) ? q.choices : undefined,
      imageUrl: q.imageUrl ?? null,
      category: q.category,
      difficulty: q.difficulty,
      total: this.state.questions.length,
    });

    this._previewTimer = setTimeout(() => {
      if (this.state.config.secretBet) {
        this._startBetting();
      } else if (this.state.mode === MODE.QCM) {
        this._startQCMAnswering();
      } else if (this.state.mode === MODE.PINGPONG) {
        this._startPingPong();
      } else {
        this._startBuzzing();
      }
    }, TIMER.QUESTION_PREVIEW);
  }

  // ─── Pari secret ─────────────────────────────────────────────────────────

  _startBetting() {
    this.state.phase = PHASE.BETTING;
    this.state.betDeadline = Date.now() + TIMER.BETTING_DURATION;
    this.state.bets = {};

    const eligible = this._getEligibleBettors();
    this.peer.broadcast({
      type: MSG.BET_STATE,
      betCount: 0,
      total: eligible.length,
      deadline: this.state.betDeadline,
    });
    this.onStateChange({ ...this.state });

    this._betTimer = setTimeout(() => this._endBetting(), TIMER.BETTING_DURATION);
  }

  _getEligibleBettors() {
    return this.state.players.filter(p =>
      !(this.state.config.hostIsReader && p.id === '__host__')
    );
  }

  handleBet(peerId, amount) {
    if (this.state.phase !== PHASE.BETTING) return;
    if (this.state.config.hostIsReader && peerId === '__host__') return;
    const player = this.state.players.find(p => p.id === peerId);
    if (!player) return;

    const bet = Math.max(0, Math.min(Math.floor(amount), player.score));
    this.state.bets[peerId] = bet;

    const eligible = this._getEligibleBettors();
    const betCount = eligible.filter(p => this.state.bets[p.id] != null).length;
    this.peer.broadcast({ type: MSG.BET_STATE, betCount, total: eligible.length });
    this.onStateChange({ ...this.state });

    if (betCount >= eligible.length) {
      this._clearTimer('bet');
      this._endBetting();
    }
  }

  _endBetting() {
    this._clearTimer('bet');
    if (this.state.mode === MODE.QCM) {
      this._startQCMAnswering();
    } else if (this.state.mode === MODE.PINGPONG) {
      this._startPingPong();
    } else {
      this._startBuzzing();
    }
  }

  // ─── Mode Ping-Pong ───────────────────────────────────────────────────────

  _startPingPong() {
    const players = this.state.players.filter(p =>
      !(this.state.config.hostIsReader && p.id === '__host__')
    );
    if (players.length === 0) { this._skipQuestion(); return; }

    // Rotation du premier joueur à chaque question
    const startIdx = this.state.pingpongOrderOffset % players.length;
    const ordered = [...players.slice(startIdx), ...players.slice(0, startIdx)];
    this.state.buzzQueue = ordered.map(p => p.id);
    this.state.pingpongOrderOffset++;

    this.state.phase = PHASE.ANSWERING;
    this._answerStartTime = Date.now();
    this.peer.broadcast({ type: MSG.BUZZ_QUEUE, queue: [...this.state.buzzQueue] });
    this.onStateChange({ ...this.state });

    this._setPingPongTimer();
  }

  _setPingPongTimer() {
    this._clearTimer('answer');
    const currentPlayer = this.state.buzzQueue[0];
    const dur = this._getAnswerDuration(currentPlayer);
    this._answerTimer = setTimeout(() => {
      if (this.state.phase === PHASE.ANSWERING) {
        this._advancePingPongTurn();
      }
    }, dur);
  }

  _advancePingPongTurn() {
    this.state.buzzQueue.shift();
    if (this.state.buzzQueue.length > 0) {
      this._answerStartTime = Date.now();
      this.peer.broadcast({ type: MSG.BUZZ_QUEUE, queue: [...this.state.buzzQueue] });
      this.onStateChange({ ...this.state });
      this._setPingPongTimer();
    } else {
      this._skipQuestion();
    }
  }

  // ─── Buzzing ─────────────────────────────────────────────────────────────

  _startBuzzing() {
    this.state.buzzDeadline = Date.now() + TIMER.BUZZ_DURATION;
    this.state.phase = PHASE.BUZZING;
    this.onStateChange({ ...this.state });

    this._buzzTimer = setTimeout(() => {
      if (this.state.phase === PHASE.BUZZING) {
        this._skipQuestion();
      }
    }, TIMER.BUZZ_DURATION);
  }

  _startAnswering() {
    const currentPlayer = this.state.buzzQueue[0];
    if (!currentPlayer) {
      this._skipQuestion();
      return;
    }
    this._clearTimer('buzz');
    this.state.phase = PHASE.ANSWERING;
    this._answerStartTime = Date.now();
    this.peer.broadcast({ type: MSG.BUZZ_QUEUE, queue: [...this.state.buzzQueue] });
    this.onStateChange({ ...this.state });

    const dur = this._getAnswerDuration(currentPlayer);
    this._answerTimer = setTimeout(() => {
      if (this.state.phase === PHASE.ANSWERING) {
        this.state.buzzQueue.shift();
        if (this.state.buzzQueue.length > 0) {
          this._startAnswering();
        } else {
          this._skipQuestion();
        }
      }
    }, dur);
  }

  _startQCMAnswering() {
    this.state.phase = PHASE.ANSWERING;
    this._answerStartTime = Date.now();
    this.onStateChange({ ...this.state });

    this._buzzTimer = setTimeout(() => {
      if (this.state.phase === PHASE.ANSWERING) {
        this._skipQuestion();
      }
    }, TIMER.QCM_DURATION);
  }

  // ─── Buzz ─────────────────────────────────────────────────────────────────

  handleBuzz(peerId) {
    if (this.state.phase !== PHASE.BUZZING && this.state.phase !== PHASE.ANSWERING) return;
    if (this.state.phase === PHASE.ANSWERING && this.state.mode !== MODE.CLASSIC && this.state.mode !== MODE.SPEED) return;
    if (this.state.buzzQueue.includes(peerId)) return;
    if (this.state.wrongAnswers.includes(peerId)) return;
    if (this.state.config.hostIsReader && peerId === '__host__') return;

    this.state.buzzQueue.push(peerId);

    if (this.state.phase === PHASE.BUZZING) {
      this._startAnswering();
    } else {
      this.peer.broadcast({ type: MSG.BUZZ_QUEUE, queue: [...this.state.buzzQueue] });
      this.onStateChange({ ...this.state });
    }
  }

  // ─── Double ou rien ───────────────────────────────────────────────────────

  handleDoubleDown(peerId) {
    if (this.state.phase !== PHASE.ANSWERING) return;
    if (this.state.mode === MODE.QCM) return;
    if (this.state.buzzQueue[0] !== peerId) return;
    if (this.state.doubleDownPlayers.includes(peerId)) return;
    if (!this.state.config.doubleOrNothing) return;

    const player = this.state.players.find(p => p.id === peerId);
    if (!player || player.score <= 0) return;

    this.state.doubleDownPlayers.push(peerId);
    this.peer.broadcast({ type: MSG.DOUBLE_DOWN_DECLARED, playerId: peerId });
    this.onStateChange({ ...this.state });
  }

  // ─── Cible cachée ─────────────────────────────────────────────────────────

  handleTarget(peerId, targetId) {
    if (
      this.state.phase !== PHASE.QUESTION_PREVIEW &&
      this.state.phase !== PHASE.BETTING &&
      this.state.phase !== PHASE.BUZZING &&
      this.state.phase !== PHASE.ANSWERING
    ) return;
    if (!this.state.config.hiddenTarget) return;
    if (!this.state.players.find(p => p.id === targetId)) return;
    if (targetId === peerId) return;
    this.state.targets[peerId] = targetId;
    // Pas de broadcast — secret !
  }

  // ─── Pouvoirs ─────────────────────────────────────────────────────────────

  handlePower(peerId, power, targetId) {
    if (!this.state.config.powers) return;
    if (!Object.values(POWER).includes(power)) return;
    const player = this.state.players.find(p => p.id === peerId);
    const target = this.state.players.find(p => p.id === targetId);
    if (!player || !target || targetId === peerId) return;

    const lastUsed = player.powers[power] ?? -(POWER_COOLDOWN + 1);
    if (this.state.currentIndex - lastUsed < POWER_COOLDOWN) return;

    if (!target.powerEffects) target.powerEffects = {};
    target.powerEffects[power] = true;
    player.powers[power] = this.state.currentIndex;

    this.peer.broadcast({
      type: MSG.POWER_EFFECT,
      power,
      byId: peerId,
      targetId,
      cooldownUntil: this.state.currentIndex + POWER_COOLDOWN,
    });
    this._broadcastPlayerList();
  }

  // ─── Calcul des points (helper) ───────────────────────────────────────────

  _calcPoints(peerId, isCorrect, elapsed, baseDuration) {
    const player = this.state.players.find(p => p.id === peerId);
    const isDoubleDown = this.state.doubleDownPlayers.includes(peerId);
    const isDoublePowered = this._getPowerEffect(peerId, POWER.DOUBLE);
    let points = 0;
    let speedBonus = 0;

    if (isCorrect) {
      speedBonus = calcSpeedBonus(elapsed, baseDuration);
      const mult = this.state.config.comboStreak ? streakMultiplier(player?.streak ?? 0) : 1;
      points = Math.round((SCORE.CORRECT + speedBonus) * mult);

      if (isDoubleDown && player && player.score > 0) {
        points = player.score; // Doubler le score actuel
      } else if (isDoublePowered) {
        points *= 2;
      }

      if (player) {
        const bet = this.state.bets[peerId] ?? 0;
        player.score += points + bet;
        if (this.state.config.comboStreak) player.streak = (player.streak ?? 0) + 1;
      }
      this.state.roundPoints[peerId] = (this.state.roundPoints[peerId] ?? 0) + Math.max(0, points);
    } else {
      if (isDoubleDown && player && player.score > 0) {
        points = -player.score;
        player.score = 0;
      } else if (this.state.config.applyMalus) {
        let malus = SCORE.WRONG_MALUS;
        if (isDoublePowered) malus *= 2;
        points = malus;
        if (player) player.score = Math.max(0, player.score + malus);
      }

      const bet = this.state.bets[peerId] ?? 0;
      if (bet > 0 && player) {
        player.score = Math.max(0, player.score - bet);
        points -= bet;
      }

      if (this.state.config.comboStreak && player) player.streak = 0;
    }

    return { points, speedBonus };
  }

  // ─── Réponse texte (CLASSIC / SPEED) ─────────────────────────────────────

  handleAnswer(peerId, text) {
    if (this.state.phase !== PHASE.ANSWERING) return;
    if (this.state.mode === MODE.QCM || this.state.mode === MODE.PINGPONG) return;
    if (this.state.buzzQueue[0] !== peerId) return;

    this._clearTimer('answer');
    const q = this.currentQuestion;
    const correct = validateAnswer(text, q.correctAnswer);
    const elapsed = this._answerStartTime != null
      ? Date.now() - this._answerStartTime
      : this._getAnswerDuration(peerId);
    const baseDur = this._getAnswerDuration(peerId);

    const { points, speedBonus } = this._calcPoints(peerId, correct, elapsed, baseDur);
    const isHidden = this._getPowerEffect(peerId, POWER.HIDE);
    const nearMiss = !correct && proximityScore(text, q.correctAnswer) === NEAR_MISS_THRESHOLD;
    const scores = this._getScores();
    const player = this.state.players.find(p => p.id === peerId);

    const result = {
      correct,
      playerId: peerId,
      answer: isHidden ? null : text,
      answerHidden: isHidden,
      points,
      speedBonus,
      nearMiss,
      scores,
      streak: correct && this.state.config.comboStreak ? (player?.streak ?? 0) : 0,
    };
    this.state.lastResult = result;
    this.peer.broadcast({ type: MSG.ANSWER_RESULT, ...result });

    if (correct) {
      this._showAnswerResult(() => this._endQuestion(false));
    } else {
      this.state.wrongAnswers.push(peerId);
      this._showAnswerResult(() => {
        this.state.buzzQueue.shift();
        if (this.state.buzzQueue.length > 0) {
          this._startAnswering();
        } else {
          this._resumeBuzzing();
        }
      });
    }
  }

  hostJudgeAnswer(isCorrect) {
    if (this.state.phase !== PHASE.ANSWERING) return;
    if (this.state.mode === MODE.QCM || this.state.mode === MODE.PINGPONG) return;

    this._clearTimer('answer');
    const peerId = this.state.buzzQueue[0];
    if (!peerId) return;

    const elapsed = this._answerStartTime != null
      ? Date.now() - this._answerStartTime
      : this._getAnswerDuration(peerId);

    const { points, speedBonus } = this._calcPoints(peerId, isCorrect, elapsed, this._getAnswerDuration(peerId));
    const scores = this._getScores();
    const player = this.state.players.find(p => p.id === peerId);

    const result = {
      correct: isCorrect,
      playerId: peerId,
      answer: null,
      points,
      speedBonus,
      nearMiss: false,
      scores,
      streak: isCorrect && this.state.config.comboStreak ? (player?.streak ?? 0) : 0,
    };
    this.state.lastResult = result;
    this.peer.broadcast({ type: MSG.ANSWER_RESULT, ...result });

    if (isCorrect) {
      this._showAnswerResult(() => this._endQuestion(false));
    } else {
      this.state.wrongAnswers.push(peerId);
      this._showAnswerResult(() => {
        this.state.buzzQueue.shift();
        if (this.state.buzzQueue.length > 0) {
          this._startAnswering();
        } else {
          this._resumeBuzzing();
        }
      });
    }
  }

  // ─── Choix QCM / Ping-Pong ───────────────────────────────────────────────

  handleChoice(peerId, choice) {
    if (this.state.phase !== PHASE.ANSWERING) return;
    if (this.state.mode !== MODE.QCM && this.state.mode !== MODE.PINGPONG) return;
    if (this.state.mode === MODE.QCM && this.state.eliminatedPlayers.includes(peerId)) return;
    if (this.state.mode === MODE.PINGPONG && this.state.buzzQueue[0] !== peerId) return;
    if (this.state.config.hostIsReader && peerId === '__host__') return;

    const q = this.currentQuestion;
    const correct = choice === q.correctAnswer;
    const player = this.state.players.find(p => p.id === peerId);
    const isDoublePowered = this._getPowerEffect(peerId, POWER.DOUBLE);
    let points = 0;
    let speedBonus = 0;

    if (correct) {
      this._clearTimer('buzz');
      this._clearTimer('answer');
      const elapsed = this._answerStartTime != null ? Date.now() - this._answerStartTime : TIMER.QCM_DURATION;
      speedBonus = calcSpeedBonus(elapsed, TIMER.QCM_DURATION);
      const mult = this.state.config.comboStreak ? streakMultiplier(player?.streak ?? 0) : 1;
      points = Math.round((SCORE.CORRECT + speedBonus) * mult);
      if (isDoublePowered) points *= 2;

      if (player) {
        const bet = this.state.bets[peerId] ?? 0;
        player.score += points + bet;
        if (this.state.config.comboStreak) player.streak = (player.streak ?? 0) + 1;
      }
      this.state.roundPoints[peerId] = (this.state.roundPoints[peerId] ?? 0) + Math.max(0, points);

      const scores = this._getScores();
      const result = {
        correct: true,
        playerId: peerId,
        answer: choice,
        points,
        speedBonus,
        nearMiss: false,
        scores,
        streak: this.state.config.comboStreak ? (player?.streak ?? 0) : 0,
      };
      this.state.lastResult = result;
      this.peer.broadcast({ type: MSG.ANSWER_RESULT, ...result });
      this._showAnswerResult(() => this._endQuestion(false));
    } else if (this.state.mode === MODE.PINGPONG) {
      // Mauvaise réponse en Ping-Pong : passer au joueur suivant
      this._clearTimer('answer');
      let malusPoints = 0;
      if (this.state.config.applyMalus && player) {
        malusPoints = isDoublePowered ? SCORE.WRONG_MALUS * 2 : SCORE.WRONG_MALUS;
        player.score = Math.max(0, player.score + malusPoints);
      }
      const bet = this.state.bets[peerId] ?? 0;
      if (bet > 0 && player) {
        player.score = Math.max(0, player.score - bet);
        malusPoints -= bet;
      }
      if (this.state.config.comboStreak && player) player.streak = 0;

      const scores = this._getScores();
      this.peer.broadcast({ type: MSG.WRONG_CHOICE, playerId: peerId, choice, points: malusPoints, scores });
      this.onStateChange({ ...this.state });

      this._answerTimer = setTimeout(() => this._advancePingPongTurn(), TIMER.RESULT_DISPLAY);
    } else {
      // QCM : mauvaise réponse, éliminer le joueur
      this.state.eliminatedPlayers.push(peerId);
      let malusPoints = 0;
      if (this.state.config.applyMalus && player) {
        malusPoints = isDoublePowered ? SCORE.WRONG_MALUS * 2 : SCORE.WRONG_MALUS;
        player.score = Math.max(0, player.score + malusPoints);
      }
      const bet = this.state.bets[peerId] ?? 0;
      if (bet > 0 && player) {
        player.score = Math.max(0, player.score - bet);
        malusPoints -= bet;
      }
      if (this.state.config.comboStreak && player) player.streak = 0;

      const scores = this._getScores();
      this.peer.broadcast({ type: MSG.WRONG_CHOICE, playerId: peerId, choice, points: malusPoints, scores });
      this.onStateChange({ ...this.state });
      this._checkAllQcmEliminated();
    }
  }

  _checkAllQcmEliminated() {
    const activePlayers = this.state.players.filter(p => {
      if (this.state.eliminatedPlayers.includes(p.id)) return false;
      if (this.state.config.hostIsReader && p.id === '__host__') return false;
      return true;
    });
    if (activePlayers.length === 0) {
      this._clearTimer('buzz');
      this._skipQuestion();
    }
  }

  // ─── Retour en phase buzzer après mauvaise réponse ───────────────────────

  _resumeBuzzing() {
    const remaining = this.state.buzzDeadline ? this.state.buzzDeadline - Date.now() : 0;

    const eligiblePlayers = this.state.players.filter(p => {
      if (this.state.wrongAnswers.includes(p.id)) return false;
      if (this.state.config.hostIsReader && p.id === '__host__') return false;
      return true;
    });

    if (remaining <= 500 || eligiblePlayers.length === 0) {
      this._skipQuestion();
      return;
    }

    this.state.phase = PHASE.BUZZING;
    this.state.buzzQueue = [];
    this.peer.broadcast({ type: MSG.BUZZ_RESUME, remainingMs: Math.floor(remaining) });
    this.onStateChange({ ...this.state });

    this._buzzTimer = setTimeout(() => {
      if (this.state.phase === PHASE.BUZZING) {
        this._skipQuestion();
      }
    }, remaining);
  }

  // ─── Affichage temporaire du résultat ────────────────────────────────────

  _showAnswerResult(callback) {
    this.state.phase = PHASE.ANSWER_RESULT;
    this.onStateChange({ ...this.state });
    setTimeout(callback, TIMER.RESULT_DISPLAY);
  }

  // ─── Fin de question ─────────────────────────────────────────────────────

  _endQuestion(skipped) {
    this._clearAllTimers();
    const q = this.currentQuestion;

    // ─ Cible cachée : calculer les bonus ─────────────────────────────────
    const targetBonuses = {};
    if (this.state.config.hiddenTarget) {
      for (const [playerId, targetId] of Object.entries(this.state.targets)) {
        const myPoints = this.state.roundPoints[playerId] ?? 0;
        const theirPoints = this.state.roundPoints[targetId] ?? 0;
        if (myPoints > theirPoints && myPoints > 0) {
          const player = this.state.players.find(p => p.id === playerId);
          if (player) player.score += SCORE.TARGET_BONUS;
          targetBonuses[playerId] = SCORE.TARGET_BONUS;
        }
      }
    }

    this.state.phase = PHASE.QUESTION_END;

    this.peer.broadcast({
      type: MSG.QUESTION_END,
      correctAnswer: q.correctAnswer,
      trivia: q.trivia ?? null,
      skipped,
      scores: this._getScores(),
      betReveal: Object.keys(this.state.bets).length > 0 ? { ...this.state.bets } : null,
      targetsReveal: Object.keys(this.state.targets).length > 0
        ? { targets: { ...this.state.targets }, bonuses: targetBonuses }
        : null,
    });
    this.onStateChange({ ...this.state });

    if (this.autoAdvance) {
      this._autoNextTimer = setTimeout(() => this.hostNext(), TIMER.QUESTION_END_DELAY);
    }
  }

  _skipQuestion() {
    this._clearAllTimers();
    const result = { correct: false, playerId: null, answer: null, points: 0, nearMiss: false, scores: this._getScores() };
    this.state.lastResult = result;
    this._endQuestion(true);
  }

  /** Appelé par l'hôte pour passer à la question suivante */
  hostNext() {
    this._clearAllTimers();
    if (this.state.phase !== PHASE.QUESTION_END) return;
    this._nextQuestion();
  }

  /** Appelé par l'hôte pour passer la question en cours */
  hostSkip() {
    this._clearAllTimers();
    if (this.state.phase === PHASE.QUESTION_END || this.state.phase === PHASE.LOBBY || this.state.phase === PHASE.GAME_OVER) return;
    this._skipQuestion();
  }

  // ─── Fin de partie ────────────────────────────────────────────────────────

  _endGame() {
    this._clearAllTimers();
    this.state.phase = PHASE.GAME_OVER;
    let players = [...this.state.players];
    if (this.state.config.hostIsReader) {
      players = players.filter(p => p.id !== '__host__');
    }
    const finalScores = players
      .sort((a, b) => b.score - a.score)
      .map(({ id, name, score }) => ({ id, name, score }));
    this.peer.broadcast({ type: MSG.GAME_OVER, finalScores });
    this.onStateChange({ ...this.state, finalScores });
  }

  // ─── Dispatch des messages reçus des clients ──────────────────────────────

  handleMessage(from, data) {
    switch (data.type) {
      case MSG.JOIN:
        this.addPlayer(from, data.name ?? 'Anonyme');
        this.markReady(from);
        break;
      case MSG.READY:
        this.markReady(from);
        break;
      case MSG.BUZZ:
        this.handleBuzz(from);
        break;
      case MSG.ANSWER:
        this.handleAnswer(from, data.text ?? '');
        break;
      case MSG.CHOICE:
        this.handleChoice(from, data.text ?? '');
        break;
      case MSG.BET:
        this.handleBet(from, data.amount ?? 0);
        break;
      case MSG.DOUBLE_DOWN:
        this.handleDoubleDown(from);
        break;
      case MSG.TARGET:
        this.handleTarget(from, data.targetId ?? '');
        break;
      case MSG.USE_POWER:
        this.handlePower(from, data.power, data.targetId ?? '');
        break;
      case MSG.DRAFT_PICK:
        this.handleDraftPick(from, data.category ?? '');
        break;
    }
  }

  // ─── Timers ───────────────────────────────────────────────────────────────

  _clearTimer(name) {
    if (name === 'preview' && this._previewTimer)  { clearTimeout(this._previewTimer);  this._previewTimer  = null; }
    if (name === 'buzz'    && this._buzzTimer)      { clearTimeout(this._buzzTimer);      this._buzzTimer     = null; }
    if (name === 'answer'  && this._answerTimer)    { clearTimeout(this._answerTimer);    this._answerTimer   = null; }
    if (name === 'auto'    && this._autoNextTimer)  { clearTimeout(this._autoNextTimer);  this._autoNextTimer = null; }
    if (name === 'bet'     && this._betTimer)       { clearTimeout(this._betTimer);       this._betTimer      = null; }
    if (name === 'draft'   && this._draftTimer)     { clearTimeout(this._draftTimer);     this._draftTimer    = null; }
  }

  _clearAllTimers() {
    this._clearTimer('preview');
    this._clearTimer('buzz');
    this._clearTimer('answer');
    this._clearTimer('auto');
    this._clearTimer('bet');
    this._clearTimer('draft');
  }
}

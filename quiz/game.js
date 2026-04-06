/**
 * game.js — Moteur de jeu Quiz (côté HOST uniquement)
 *
 * State machine :
 *  LOBBY → QUESTION_PREVIEW → BUZZING → ANSWERING → ANSWER_RESULT
 *       → QUESTION_END → QUESTION_PREVIEW (suivant) → … → GAME_OVER
 *
 * En mode QCM : QUESTION_PREVIEW → ANSWERING (pas de BUZZING)
 */

import { MSG, PHASE, MODE, SCORE, TIMER } from './constants.js';
import { validateAnswer, proximityScore } from './fuzzy.js';

/** Distance de Levenshtein maximale pour considérer une réponse comme "presque correcte" */
const NEAR_MISS_THRESHOLD = 1;

/** Calcule le bonus de rapidité (0 à SCORE.SPEED_BONUS_MAX) selon le temps restant */
function calcSpeedBonus(elapsedMs, totalMs) {
  if (totalMs <= 0) return 0;
  const ratio = Math.max(0, 1 - elapsedMs / totalMs);
  return Math.round(SCORE.SPEED_BONUS_MAX * ratio);
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
      players: [],       // { id, name, score, ready }
      questions: [],     // Questions normalisées
      currentIndex: -1,  // Index de la question en cours
      buzzQueue: [],     // [peerId, ...] ordre d'arrivée des buzzes
      eliminatedPlayers: [], // Joueurs ayant mal répondu en QCM (question courante)
      lastResult: null,  // { correct, playerId, answer, points, speedBonus, nearMiss }
      config: {
        questionCount: 10,
        answerTime: 15,
        showAnswerToHost: false,
        applyMalus: false,
        mode: MODE.CLASSIC,
      },
    };

    this._previewTimer = null;
    this._buzzTimer = null;
    this._answerTimer = null;
    this._autoNextTimer = null;
    this._answerStartTime = null; // Horodatage du début de la phase de réponse

    // Auto-advance entre questions
    this.autoAdvance = false;
  }

  // ─── Accesseurs ──────────────────────────────────────────────────────────

  get currentQuestion() {
    return this.state.questions[this.state.currentIndex] ?? null;
  }

  _getAnswerDuration() {
    const base = (this.state.config.answerTime ?? 15) * 1000;
    if (this.state.mode === MODE.SPEED) {
      return Math.min(base, TIMER.SPEED_ANSWER);
    }
    return base;
  }

  _getScores() {
    return Object.fromEntries(this.state.players.map(p => [p.id, p.score]));
  }

  // ─── Gestion des joueurs (LOBBY) ─────────────────────────────────────────

  addPlayer(peerId, name) {
    const existing = this.state.players.find(p => p.id === peerId);
    if (existing) {
      existing.name = name;
      this._broadcastPlayerList();
      return;
    }
    const inGame = this.state.phase !== PHASE.LOBBY;
    this.state.players.push({
      id: peerId,
      name,
      score: 0,
      ready: peerId === '__host__' || inGame,
    });
    this._broadcastPlayerList();
  }

  removePlayer(peerId) {
    this.state.players = this.state.players.filter(p => p.id !== peerId);
    this.state.buzzQueue = this.state.buzzQueue.filter(id => id !== peerId);
    this.state.eliminatedPlayers = this.state.eliminatedPlayers.filter(id => id !== peerId);
    this._broadcastPlayerList();

    // En QCM : si tous les joueurs restants ont répondu faux, fin de la question
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
    const players = this.state.players.map(({ id, name, score, ready }) => ({ id, name, score, ready }));
    this.peer.broadcast({ type: MSG.PLAYER_LIST, players });
    this.onStateChange({ ...this.state });
  }

  // ─── Démarrage ───────────────────────────────────────────────────────────

  startGame(questions, config = {}) {
    this._clearAllTimers();
    this.state.mode = config.mode ?? MODE.CLASSIC;
    this.state.config = { ...this.state.config, ...config };
    this.state.questions = questions;
    this.state.currentIndex = -1;
    this.state.players.forEach(p => { p.score = 0; p.ready = false; });
    // L'hôte est toujours prêt
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
    this.state.eliminatedPlayers = [];
    this.state.lastResult = null;

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

    // Envoyer la question sans la réponse correcte
    this.peer.broadcast({
      type: MSG.SHOW_QUESTION,
      index: this.state.currentIndex,
      text: q.text,
      choices: this.state.mode === MODE.QCM ? q.choices : undefined,
      category: q.category,
      difficulty: q.difficulty,
      total: this.state.questions.length,
    });

    this._previewTimer = setTimeout(() => {
      if (this.state.mode === MODE.QCM) {
        this._startQCMAnswering();
      } else {
        this._startBuzzing();
      }
    }, TIMER.QUESTION_PREVIEW);
  }

  _startBuzzing() {
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

    this._answerTimer = setTimeout(() => {
      if (this.state.phase === PHASE.ANSWERING) {
        // Timeout : passer au buzzeur suivant
        this.state.buzzQueue.shift();
        if (this.state.buzzQueue.length > 0) {
          this._startAnswering();
        } else {
          this._skipQuestion();
        }
      }
    }, this._getAnswerDuration());
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

    this.state.buzzQueue.push(peerId);

    if (this.state.phase === PHASE.BUZZING) {
      // Premier buzz : passer en ANSWERING
      this._startAnswering();
    } else {
      // Buzz dans la file d'attente : notifier
      this.peer.broadcast({ type: MSG.BUZZ_QUEUE, queue: [...this.state.buzzQueue] });
      this.onStateChange({ ...this.state });
    }
  }

  // ─── Réponse texte (CLASSIC / SPEED) ────────────────────────────────────

  handleAnswer(peerId, text) {
    if (this.state.phase !== PHASE.ANSWERING) return;
    if (this.state.mode === MODE.QCM) return;
    if (this.state.buzzQueue[0] !== peerId) return;

    this._clearTimer('answer');
    const q = this.currentQuestion;
    const correct = validateAnswer(text, q.correctAnswer);
    const player = this.state.players.find(p => p.id === peerId);
    let points = 0;
    let speedBonus = 0;

    if (correct) {
      const elapsed = this._answerStartTime != null ? Date.now() - this._answerStartTime : this._getAnswerDuration();
      speedBonus = calcSpeedBonus(elapsed, this._getAnswerDuration());
      points = SCORE.CORRECT + speedBonus;
      if (player) player.score += points;
    } else if (this.state.config.applyMalus) {
      points = SCORE.WRONG_MALUS;
      if (player) player.score += points;
    }

    const nearMiss = !correct && proximityScore(text, q.correctAnswer) === NEAR_MISS_THRESHOLD;
    const scores = this._getScores();

    const result = { correct, playerId: peerId, answer: text, points, speedBonus, nearMiss, scores };
    this.state.lastResult = result;
    this.peer.broadcast({ type: MSG.ANSWER_RESULT, ...result });

    if (correct) {
      this._showAnswerResult(() => this._endQuestion(false));
    } else {
      // Mauvaise réponse : afficher brièvement, puis passer au suivant dans la queue
      this._showAnswerResult(() => {
        this.state.buzzQueue.shift();
        if (this.state.buzzQueue.length > 0) {
          this._startAnswering();
        } else {
          this._skipQuestion();
        }
      });
    }
  }

  // ─── Choix QCM ────────────────────────────────────────────────────────────

  handleChoice(peerId, choice) {
    if (this.state.phase !== PHASE.ANSWERING) return;
    if (this.state.mode !== MODE.QCM) return;
    if (this.state.eliminatedPlayers.includes(peerId)) return;

    const q = this.currentQuestion;
    const correct = choice === q.correctAnswer;
    const player = this.state.players.find(p => p.id === peerId);
    let points = 0;
    let speedBonus = 0;

    if (correct) {
      this._clearTimer('buzz');
      const elapsed = this._answerStartTime != null ? Date.now() - this._answerStartTime : TIMER.QCM_DURATION;
      speedBonus = calcSpeedBonus(elapsed, TIMER.QCM_DURATION);
      points = SCORE.CORRECT + speedBonus;
      if (player) player.score += points;

      const scores = this._getScores();
      const result = { correct: true, playerId: peerId, answer: choice, points, speedBonus, nearMiss: false, scores };
      this.state.lastResult = result;
      this.peer.broadcast({ type: MSG.ANSWER_RESULT, ...result });
      this._showAnswerResult(() => this._endQuestion(false));
    } else {
      this.state.eliminatedPlayers.push(peerId);
      let malusPoints = 0;
      if (this.state.config.applyMalus && player) {
        malusPoints = SCORE.WRONG_MALUS;
        player.score += malusPoints;
      }
      const scores = this._getScores();
      this.peer.broadcast({ type: MSG.WRONG_CHOICE, playerId: peerId, choice, points: malusPoints, scores });
      this.onStateChange({ ...this.state });
      this._checkAllQcmEliminated();
    }
  }

  _checkAllQcmEliminated() {
    const activePlayers = this.state.players.filter(p => !this.state.eliminatedPlayers.includes(p.id));
    if (activePlayers.length === 0) {
      this._clearTimer('buzz');
      this._skipQuestion();
    }
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
    this.state.phase = PHASE.QUESTION_END;
    this.peer.broadcast({
      type: MSG.QUESTION_END,
      correctAnswer: q.correctAnswer,
      skipped,
      scores: this._getScores(),
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
    const finalScores = [...this.state.players]
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
    }
  }

  // ─── Timers ───────────────────────────────────────────────────────────────

  _clearTimer(name) {
    if (name === 'preview' && this._previewTimer) { clearTimeout(this._previewTimer); this._previewTimer = null; }
    if (name === 'buzz'    && this._buzzTimer)    { clearTimeout(this._buzzTimer);    this._buzzTimer    = null; }
    if (name === 'answer'  && this._answerTimer)  { clearTimeout(this._answerTimer);  this._answerTimer  = null; }
    if (name === 'auto'    && this._autoNextTimer) { clearTimeout(this._autoNextTimer); this._autoNextTimer = null; }
  }

  _clearAllTimers() {
    this._clearTimer('preview');
    this._clearTimer('buzz');
    this._clearTimer('answer');
    this._clearTimer('auto');
  }
}

/**
 * game.js — Moteur de jeu (côté HOST uniquement)
 *
 * State machine :
 *  LOBBY → COUNTDOWN → PLAYING → BUZZED → ANSWERING → ANSWER_RESULT
 *       → ROUND_END → COUNTDOWN (round suivant) → ... → GAME_OVER
 *
 * Communication :
 *  - Reçoit les messages des clients via peer.js (appel externe de handleMessage)
 *  - Broadcast via peer.broadcast()/peer.sendTo()
 *  - Met à jour l'UI via les callbacks fournis à GameEngine
 */

import { MSG, PHASE, MODE, SCORE, TIMER, JOKER, GAME_SONGS } from './constants.js';
import { validateArtist, validateTitle, validateAnswer } from './fuzzy.js';
import { shufflePlaylist, generateFourChoices } from './playlist.js';
import { applyJoker, computeCorrectScore, computeWrongScore, initialJokers } from './joker.js';

export class GameEngine {
  /**
   * @param {import('./peer.js').BlindTestPeer} peer
   * @param {import('./youtube.js').YouTubePlayer} yt
   * @param {Function} onStateChange — appelé à chaque changement de phase/scores
   */
  constructor(peer, yt, onStateChange) {
    this.peer = peer;
    this.yt = yt;
    this.onStateChange = onStateChange;

    this.state = {
      phase: PHASE.LOBBY,
      mode: MODE.CLASSIC,
      players: [],          // { id, name, score, jokers, blockedUntilRound, doubleActive }
      playlist: [],         // toutes les chansons (non shufflées)
      shuffled: [],         // playlist mélangée pour la partie
      currentRound: -1,
      buzzQueue: [],        // [peerId, ...] dans l'ordre de buzz
      currentSong: null,
      choices: [],          // Pour mode FOUR_CHOICES
      eliminatedChoices: [], // Choix grisés dans le round courant
      waitingForJoker: null,// { type, fromId } — en attente de cible
      answerStep: 'artist', // 'étape en cours : 'artist' ou 'title'
      playbackError: null,  // Message d'erreur audio affiché à l'hôte
    };

    this._playTimer = null;
    this._answerTimer = null;
    this._roundEndTimer = null;
    this._jokerWindowInterval = null;
    this._playSongStartedAt = null; // timestamp Date.now() quand la chanson démarre réellement

    // En mode relay : avance automatiquement au round suivant sans clic "Suivant"
    this.autoAdvance = false;

    // Archive des données joueurs en cas de déconnexion temporaire
    this._playerArchive = {};
    // Caches d'instances audio (transmis aux clients qui rejoignent)
    this._instanceCaches = {};
    // Joueur ayant correctement répondu sur l'artiste (attend le titre)
    this._artistScoredPlayer = null;

    // Si une vidéo est indisponible à l'embarquement, on passe au round suivant
    this.yt.addEventListener('error', (evt) => {
      if (this.state.phase === PHASE.PLAYING || this.state.phase === PHASE.COUNTDOWN) {
        const reason = evt?.detail?.reason || 'Lecture audio impossible sur cette chanson';
        this.state.playbackError = reason;
        console.warn('[Game] Erreur audio, passage au round suivant :', reason);
        this._skipRound();
      }
    });
  }

  // ─── Gestion des joueurs (LOBBY) ─────────────────────────────────────────

  addPlayer(peerId, name) {
    const existing = this.state.players.find(p => p.id === peerId);
    if (existing) {
      // Reconnexion : mise à jour du nom uniquement, scores/jokers préservés
      existing.name = name;
      this._broadcastPlayerList();
      // Si la partie est en cours, resynchroniser l'état vers ce joueur
      if (this.state.phase !== PHASE.LOBBY) {
        this._sendGameStateTo(peerId);
      }
      return;
    }
    // Restaurer depuis l'archive si le joueur s'était déconnecté en cours de partie
    const arc = this._playerArchive[peerId];
    if (arc) delete this._playerArchive[peerId];
    const inGame = this.state.phase !== PHASE.LOBBY;
    this.state.players.push({
      id: peerId,
      name: arc?.name ?? name,
      score: arc?.score ?? 0,
      jokers: arc?.jokers ?? initialJokers(),
      blockedUntilRound: arc?.blockedUntilRound ?? -1,
      doubleActive: arc?.doubleActive ?? false,
      // L'hôte est toujours prêt ; les joueurs rejoignant une partie en cours sont aussi immédiatement prêts
      ready: peerId === '__host__' || inGame,
    });
    this._broadcastPlayerList();
  }

  /** Restaure l'état complet depuis un snapshot envoyé par un client (hôte qui revient) */
  restoreFromSnapshot(snap) {
    const hostPlayer = this.state.players.find(p => p.id === '__host__');
    this.state.mode          = snap.mode          ?? this.state.mode;
    this.state.playlist      = snap.playlist      ?? this.state.playlist;
    this.state.shuffled      = snap.shuffled      ?? this.state.shuffled;
    // client.currentRound est 1-indexé (incrémenté à chaque PLAY_SONG),
    // engine.state.currentRound est 0-indexé → soustraire 1 pour aligner.
    this.state.currentRound  = Math.max(-1, (snap.currentRound ?? 1) - 1);
    this.state.currentSong   = snap.currentSong   ?? null;
    this.state.choices       = snap.choices       ?? [];
    this.state.players       = snap.players       ?? this.state.players;
    // Réinsérer __host__ s'il n'est pas dans le snapshot
    if (hostPlayer && !this.state.players.find(p => p.id === '__host__')) {
      this.state.players.unshift(hostPlayer);
    }
    this.state.buzzQueue  = [];
    this.state.answerStep = 'artist';
    // Atterrir sur ROUND_END : état sûr, l'hôte appuie sur "Suivant" pour reprendre
    this.state.phase = PHASE.ROUND_END;
    this._broadcastPlayerList();
    this.onStateChange({ ...this.state });
  }

  removePlayer(peerId) {
    const player = this.state.players.find(p => p.id === peerId);
    if (player) {
      // Archiver les données pour une éventuelle reconnexion
      this._playerArchive[peerId] = {
        name: player.name, score: player.score, jokers: player.jokers,
        blockedUntilRound: player.blockedUntilRound, doubleActive: player.doubleActive,
      };
    }
    this.state.players = this.state.players.filter(p => p.id !== peerId);
    this.state.buzzQueue = this.state.buzzQueue.filter(id => id !== peerId);
    this._broadcastPlayerList();
  }

  markReady(peerId) {
    const p = this.state.players.find(pl => pl.id === peerId);
    if (p) p.ready = true;
    this._broadcastPlayerList();
  }

  _broadcastPlayerList() {
    this.peer.broadcast({
      type: MSG.PLAYER_LIST,
      players: this.state.players.map(({ id, name, score, jokers, blockedUntilRound, doubleActive, ready }) =>
        ({ id, name, score, jokers, blockedUntilRound, doubleActive, ready })
      ),
    });
    this.onStateChange({ ...this.state });
  }

  // ─── Démarrage ───────────────────────────────────────────────────────────

  startGame(mode, playlist, { pipedInstances = [], invidiousInstances = [], preferredAudioSource = null } = {}) {
    this._instanceCaches = { pipedInstances, invidiousInstances, preferredAudioSource };
    this.state.mode = mode;
    this.state.playlist = playlist;
    this.state.shuffled = shufflePlaylist(playlist).slice(0, GAME_SONGS);
    this.state.currentRound = -1;
    this.state.players.forEach(p => { p.score = 0; p.jokers = initialJokers(); p.blockedUntilRound = -1; p.doubleActive = false; });

    this.peer.broadcast({
      type: MSG.GAME_START, mode, playlist,
      shuffled: this.state.shuffled,
      ...(pipedInstances.length     && { pipedInstances }),
      ...(invidiousInstances.length && { invidiousInstances }),
      ...(preferredAudioSource && { preferredAudioSource }),
    });
    this._nextRound();
  }

  // ─── Round ────────────────────────────────────────────────────────────────

  _nextRound() {
    this._clearTimers();
    this.state.currentRound++;
    this.state.buzzQueue = [];
    this.state.answerStep = 'artist';
    this.state.playbackError = null;
    this._artistScoredPlayer = null;

    if (this.state.currentRound >= this.state.shuffled.length) {
      this._endGame();
      return;
    }

    this.state.currentSong = this.state.shuffled[this.state.currentRound];

    // Fenêtre joker : 5s pour décider avant que la chanson commence
    this.state.phase = PHASE.JOKER_WINDOW;
    let windowCount = TIMER.JOKER_WINDOW;
    this.state.jokerWindowRemaining = windowCount;
    this.yt.prefetch(this.state.currentSong.videoId).catch(() => {});
    this.onStateChange({ ...this.state });
    this.peer.broadcast({ type: MSG.JOKER_WINDOW, remainingS: windowCount, videoId: this.state.currentSong.videoId });

    this._jokerWindowInterval = setInterval(() => {
      windowCount--;
      this.state.jokerWindowRemaining = windowCount;
      this.onStateChange({ ...this.state });
      this.peer.broadcast({ type: MSG.JOKER_WINDOW, remainingS: windowCount, videoId: this.state.currentSong.videoId });
      if (windowCount <= 0) {
        clearInterval(this._jokerWindowInterval);
        this._jokerWindowInterval = null;
        this._startCountdown();
      }
    }, 1000);
  }

  _startCountdown() {
    this.state.phase = PHASE.COUNTDOWN;

    if (this.state.mode === MODE.FOUR_CHOICES) {
      this.state.choices = generateFourChoices(this.state.currentSong, this.state.playlist);
      this.state.eliminatedChoices = [];
    }

    let count = TIMER.COUNTDOWN;
    this.yt.prefetch(this.state.currentSong.videoId).catch(() => {});
    this.onStateChange({ ...this.state, countdown: count });
    this.peer.broadcast({ type: 'COUNTDOWN', count, videoId: this.state.currentSong.videoId });

    const tick = setInterval(() => {
      count--;
      this.onStateChange({ ...this.state, countdown: count });
      this.peer.broadcast({ type: 'COUNTDOWN', count, videoId: this.state.currentSong.videoId });
      if (count <= 0) {
        clearInterval(tick);
        this._playSong();
      }
    }, 1000);
  }

  _playSong() {
    const song = this.state.currentSong;
    this.state.phase = PHASE.PLAYING;
    this.state.playbackError = null;

    // L'host joue localement
    this.yt.load(song.videoId, 0);

    // Les clients reçoivent l'instruction de jouer (avec offset de sync)
    const startAt = TIMER.SYNC_OFFSET / 1000;
    const choices = this.state.mode === MODE.FOUR_CHOICES ? this.state.choices : undefined;

    setTimeout(() => {
      this._playSongStartedAt = Date.now();
      this.peer.broadcast({
        type: MSG.PLAY_SONG, videoId: song.videoId, startAt, choices,
        remainingMs: TIMER.PLAY_DURATION,
      });
      this.onStateChange({ ...this.state });
    }, TIMER.SYNC_OFFSET);

    // Timer de round (skip auto si pas de buzz)
    this._playTimer = setTimeout(() => {
      if (this.state.phase === PHASE.PLAYING) {
        this._skipRound();
      }
    }, TIMER.PLAY_DURATION + TIMER.SYNC_OFFSET);
  }

  _skipRound() {
    this._stopMusic();
    this.state.phase = PHASE.ROUND_END;
    const song = this.state.currentSong;
    this.peer.broadcast({
      type: MSG.ROUND_END,
      videoId: song.videoId,
      title: song.title,
      artist: song.artist,
      ...(this.state.playbackError && { playbackError: this.state.playbackError }),
    });
    this.onStateChange({ ...this.state });
    this._afterRoundEnd();
  }

  /** Si autoAdvance est actif, passe automatiquement au round suivant après un délai */
  _afterRoundEnd() {
    if (this.autoAdvance) {
      this._roundEndTimer = setTimeout(() => this.hostNext(), TIMER.ROUND_END_DELAY);
    }
  }

  // ─── Buzz ─────────────────────────────────────────────────────────────────

  handleBuzz(peerId) {
    if (this.state.phase !== PHASE.PLAYING && this.state.phase !== PHASE.BUZZED) return;
    if (this.state.buzzQueue.includes(peerId)) return;

    this.state.buzzQueue.push(peerId);

    if (this.state.phase === PHASE.PLAYING) {
      // Premier buzz : arrêt musique
      this._stopMusic();
      this.state.phase = PHASE.BUZZED;
    }

    this.peer.broadcast({ type: MSG.BUZZ_QUEUE, queue: [...this.state.buzzQueue] });
    this.onStateChange({ ...this.state });
    this._startAnswerTimer();
  }

  _startAnswerTimer() {
    this._clearTimers('answer');
    this.state.phase = PHASE.ANSWERING;
    this.peer.broadcast({ type: MSG.ANSWER_STEP, step: this.state.answerStep, playerId: this.state.buzzQueue[0] });
    this.onStateChange({ ...this.state });

    this._answerTimer = setTimeout(() => {
      // Timeout : si on était à l'étape titre, garder les points artiste et finir la chanson
      if (this.state.answerStep === 'title' && this._artistScoredPlayer) {
        this._artistScoredPlayer = null;
        this._skipRound();
        return;
      }
      // Timeout sur artiste : passer au buzzeur suivant
      this.state.buzzQueue.shift();
      if (this.state.buzzQueue.length > 0) {
        this.peer.broadcast({ type: MSG.BUZZ_QUEUE, queue: [...this.state.buzzQueue] });
        this.state.answerStep = 'artist';
        this._startAnswerTimer();
      } else {
        this.state.answerStep = 'artist';
        this._skipRound();
      }
    }, TIMER.ANSWER_DURATION);
  }

  handleAnswer(peerId, text) {
    if (this.state.phase !== PHASE.ANSWERING) return;
    if (this.state.buzzQueue[0] !== peerId) return;

    const song   = this.state.currentSong;
    const player = this.state.players.find(p => p.id === peerId);

    // ── Étape 1 : l'artiste ───────────────────────────────────────────
    if (this.state.answerStep === 'artist') {
      const correctArtist = validateArtist(text, song);

      if (correctArtist && player) {
        const gain = computeCorrectScore(player, SCORE.ARTIST, this.state.currentRound);
        player.score += gain;
        this._artistScoredPlayer = peerId;
        const scores = this._getScores();
        this.peer.broadcast({
          type: MSG.ANSWER_RESULT,
          playerId: peerId,
          correct: true,
          partial: true,          // artiste correct, attend le titre
          answer: text,
          expected: { artist: song.artist },
          scores,
        });
        this.state.phase = PHASE.ANSWER_RESULT;
        this.state._lastResult = { correct: true, partial: true, answer: text, playerId: peerId };
        this.onStateChange({ ...this.state });

        // Passer à l'étape titre après 1,5 s d'affichage
        setTimeout(() => {
          this.state.answerStep = 'title';
          this._startAnswerTimer();
        }, 1500);
      } else {
        // Artiste incorrect : appliquer malus éventuel, reprendre la musique
        if (player && this.state.mode === MODE.CLASSIC_MALUS) {
          const malus = computeWrongScore(player, SCORE.WRONG_MALUS, this.state.currentRound);
          player.score = Math.max(0, player.score + malus);
        }
        const scores = this._getScores();
        this.peer.broadcast({
          type: MSG.ANSWER_RESULT,
          playerId: peerId,
          correct: false,
          partial: false,
          answer: text,
          expected: null,
          scores,
        });
        this.state.phase = PHASE.ANSWER_RESULT;
        this.state._lastResult = { correct: false, partial: false, answer: text, playerId: peerId };
        this.onStateChange({ ...this.state });
        // Mauvaise réponse artiste : reprendre la chanson
        setTimeout(() => this._resumeAfterWrong(), 1500);
      }
      return;
    }

    // ── Étape 2 : le titre ──────────────────────────────────────────────
    const correctTitle = validateTitle(text, song);

    if (correctTitle && player) {
      const gain = computeCorrectScore(player, SCORE.TITLE, this.state.currentRound);
      player.score += gain;
    }

    this._artistScoredPlayer = null;
    const scores = this._getScores();

    this.peer.broadcast({
      type: MSG.ANSWER_RESULT,
      playerId: peerId,
      correct: correctTitle,
      partial: false,
      answer: text,
      expected: { title: song.title, artist: song.artist },
      scores,
    });
    this.state.phase = PHASE.ANSWER_RESULT;
    this.state._lastResult = { correct: correctTitle, partial: false, answer: text, playerId: peerId };
    this.state.answerStep = 'artist';
    this.onStateChange({ ...this.state });

    // Titre correct ou incorrect : round terminé (points artiste déjà attribués)
    setTimeout(() => {
      this.peer.broadcast({ type: MSG.ROUND_END, videoId: song.videoId, title: song.title, artist: song.artist });
      this.state.phase = PHASE.ROUND_END;
      this.onStateChange({ ...this.state });
      this._afterRoundEnd();
    }, 1500);
  }

  // ─── Mode 4 choix ─────────────────────────────────────────────────────────

  handleFourChoiceAnswer(peerId, choiceText) {
    if (this.state.phase !== PHASE.PLAYING) return;
    const song = this.state.currentSong;
    const correct = choiceText === `${song.title} — ${song.artist}`;
    const player = this.state.players.find(p => p.id === peerId);

    if (correct) {
      if (player) {
        const gain = computeCorrectScore(player, SCORE.CORRECT, this.state.currentRound);
        player.score += gain;
      }
      const scores = this._getScores();
      this._stopMusic();
      this.peer.broadcast({
        type: MSG.ANSWER_RESULT,
        playerId: peerId,
        correct: true,
        answer: choiceText,
        expected: { title: song.title, artist: song.artist },
        scores,
      });
      this.state.phase = PHASE.ANSWER_RESULT;
      this.state._lastResult = { correct: true, answer: choiceText, playerId: peerId };
      this.onStateChange({ ...this.state });
      setTimeout(() => {
        this.peer.broadcast({ type: MSG.ROUND_END, videoId: song.videoId, title: song.title, artist: song.artist });
        this.state.phase = PHASE.ROUND_END;
        this.onStateChange({ ...this.state });
        this._afterRoundEnd();
      }, 1500);
    } else {
      // Mauvaise réponse : -2 pts, griser le choix
      if (player) {
        player.score = Math.max(0, player.score - 2);
      }
      this.state.eliminatedChoices = [...this.state.eliminatedChoices, choiceText];
      const remaining = this.state.choices.length - this.state.eliminatedChoices.length;
      if (remaining <= 2) {
        this._stopMusic();
      }
      const scores = this._getScores();
      this.peer.broadcast({
        type: MSG.WRONG_CHOICE,
        playerId: peerId,
        choice: choiceText,
        scores,
        eliminatedChoices: this.state.eliminatedChoices,
      });
      this.onStateChange({ ...this.state });
    }
  }

  // ─── Jokers ───────────────────────────────────────────────────────────────

  handleJokerUse(fromId, jokerType, targetId) {
    if (this.state.phase !== PHASE.JOKER_WINDOW) return;
    const result = applyJoker(this.state, fromId, jokerType, targetId);
    if (!result.valid) return;

    const scores = this._getScores();
    this.peer.broadcast({
      type: MSG.JOKER_EFFECT,
      jokerType,
      fromId,
      targetId,
      scores,
      players: this.state.players.map(({ id, name, score, jokers, blockedUntilRound, doubleActive }) =>
        ({ id, name, score, jokers, blockedUntilRound, doubleActive })
      ),
    });
    this.onStateChange({ ...this.state });
  }

  _resumeAfterWrong() {
    this._clearTimers();
    // Calculer le temps restant d'après le début effectif de la chanson
    const elapsed = this._playSongStartedAt ? (Date.now() - this._playSongStartedAt) : 0;
    const remaining = Math.max(0, TIMER.PLAY_DURATION - elapsed);
    this.state.buzzQueue = [];
    this.state.answerStep = 'artist';
    this._artistScoredPlayer = null;
    this.state.phase = PHASE.PLAYING;
    // Reprend la musique là où elle était
    this.yt.play();
    this.peer.broadcast({ type: MSG.RESUME_MUSIC, remainingMs: remaining });
    this.onStateChange({ ...this.state });
    // Timer restant (pas un nouveau timer plein)
    this._playTimer = setTimeout(() => {
      if (this.state.phase === PHASE.PLAYING) this._skipRound();
    }, remaining);
  }

  // ─── Bouton Suivant (hôte)────

  hostNext() {
    if (this.state.phase !== PHASE.ROUND_END) return;
    this._clearTimers('round');
    this._nextRound();
  }

  // ─── Fin de partie ────────────────────────────────────────────────────────

  _endGame() {
    this._clearTimers();
    this.state.phase = PHASE.GAME_OVER;
    const finalScores = [...this.state.players]
      .sort((a, b) => b.score - a.score)
      .map(({ id, name, score }) => ({ id, name, score }));

    this.peer.broadcast({ type: MSG.GAME_OVER, finalScores });
    this.onStateChange({ ...this.state, finalScores });
  }

  // ─── Réception de messages (depuis peer.js) ───────────────────────────────

  handleMessage(from, data) {
    const { type } = data;
    switch (type) {
      case MSG.JOIN:
        this.addPlayer(from, data.name);
        // Si la partie est déjà en cours, synchroniser l'état de jeu avec ce joueur
        if (this.state.phase !== PHASE.LOBBY) {
          this._sendGameStateTo(from);
        }
        break;
      case MSG.READY:
        this.markReady(from);
        break;
      case MSG.BUZZ:
        this.handleBuzz(from);
        break;
      case MSG.ANSWER:
        if (this.state.mode === MODE.FOUR_CHOICES) {
          this.handleFourChoiceAnswer(from, data.text);
        } else {
          this.handleAnswer(from, data.text);
        }
        break;
      case MSG.JOKER_USE:
        this.handleJokerUse(from, data.jokerType, data.targetId);
        break;
      case MSG.STATE_SNAPSHOT:
        // Accepté seulement si le moteur est encore en LOBBY (hôte qui vient de se reconnecter)
        if (this.state.phase === PHASE.LOBBY) {
          this.restoreFromSnapshot(data);
        }
        break;
    }
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────

  /** Synchronise l'état complet de la partie vers un joueur spécifique (reconnexion / arrivée tardive) */
  _sendGameStateTo(peerId) {
    const { pipedInstances = [], invidiousInstances = [], preferredAudioSource = null } = this._instanceCaches;
    this.peer.sendTo(peerId, {
      type: MSG.GAME_START,
      mode: this.state.mode,
      playlist: this.state.playlist,
      ...(pipedInstances.length     && { pipedInstances }),
      ...(invidiousInstances.length && { invidiousInstances }),
      ...(preferredAudioSource && { preferredAudioSource }),
    });
    const phase = this.state.phase;
    const song  = this.state.currentSong;
    if (phase === PHASE.JOKER_WINDOW) {
      this.peer.sendTo(peerId, {
        type: MSG.JOKER_WINDOW,
        remainingS: this.state.jokerWindowRemaining ?? 0,
      });
    } else if (phase === PHASE.PLAYING || phase === PHASE.BUZZED || phase === PHASE.ANSWERING) {
      // Envoyer la chanson à la position actuelle de lecture
      const currentTime = this.yt.getCurrentTime();
      const elapsed = this._playSongStartedAt ? (Date.now() - this._playSongStartedAt) : 0;
      const remainingMs = Math.max(0, TIMER.PLAY_DURATION - elapsed);
      this.peer.sendTo(peerId, {
        type: MSG.PLAY_SONG,
        videoId: song.videoId,
        startAt: currentTime,
        remainingMs,
        choices: this.state.choices,
      });
      if (phase === PHASE.BUZZED || phase === PHASE.ANSWERING) {
        this.peer.sendTo(peerId, { type: MSG.STOP_MUSIC });
        this.peer.sendTo(peerId, { type: MSG.BUZZ_QUEUE, queue: [...this.state.buzzQueue] });
      }
    } else if (phase === PHASE.ANSWER_RESULT || phase === PHASE.ROUND_END) {
      this.peer.sendTo(peerId, {
        type: MSG.ROUND_END,
        videoId: song.videoId,
        title: song.title,
        artist: song.artist,
        ...(this.state.playbackError && { playbackError: this.state.playbackError }),
      });
    }
  }

  _stopMusic() {
    this._clearTimers('play');
    this.yt.pause();
    this.peer.broadcast({ type: MSG.STOP_MUSIC });
  }

  _getScores() {
    return Object.fromEntries(this.state.players.map(p => [p.id, p.score]));
  }

  _clearTimers(which = 'all') {
    if (which === 'all' || which === 'play') { clearTimeout(this._playTimer); this._playTimer = null; }
    if (which === 'all' || which === 'answer') { clearTimeout(this._answerTimer); this._answerTimer = null; }
    if (which === 'all' || which === 'round') { clearTimeout(this._roundEndTimer); this._roundEndTimer = null; }
    if (which === 'all' || which === 'jokerWindow') { clearInterval(this._jokerWindowInterval); this._jokerWindowInterval = null; }
  }
}

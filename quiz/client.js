/**
 * client.js — Logique côté client (connexion à l'hôte, traitement des messages)
 */

import { QuizPeer } from './peer.js';
import { PARTY_MSG, PARTY_MINI_LABELS, PARTY_MINI_ICONS, PARTY_MINI_RULES } from './party-game.js';
import { MSG, PHASE, MODE, TIMER } from './constants.js';
import {
  showOnly, renderLobbyPlayers, renderScoreboard, renderGamePhase,
  renderFinalResults, startTimerBar, stopTimerBar,
  flashBuzz, showToast, setLoadingStatus, highlightChoices, disableChoice,
  showWrongPlayerNotification, renderLeaderboard, renderLobbyConfigPreview,
} from './ui.js';
import {
  renderPartyOverlay, hidePartyOverlay,
  renderPartyStreakQuestion, renderPartyStreakReveal, renderStreakBoard,
  renderPartyDuelAssign, renderPartyDuelPick, renderPartyDuelQuestion, renderPartyDuelResult,
  renderPartyTFQuestion, renderPartyTFReveal,
  renderPartyRaceQuestion, renderPartyRaceReveal,
  renderPartyBlitzQuestion, renderPartyBlitzReveal,
  renderPartyCarouselQuestion, renderPartyCarouselReveal,
  renderPartyMiniEnd,
} from './ui-party.js';
import {
  playBuzz, playCorrect, playWrong, playNearMiss,
  playQuestionStart, playGameOver, playTick,
} from './sound.js';
import {
  clientState, PLAYER_NAME_KEY,
  loadLeaderboard, saveToLeaderboard,
  saveSession, loadSession, clearSession,
} from './state.js';

// ─── Overlay "mauvaise réponse" (mode classique) ───────────────────────────

function showWrongAnswerOverlay() {
  const overlay = document.getElementById('wrong-answer-overlay');
  if (overlay) overlay.hidden = false;
}

function hideWrongAnswerOverlay() {
  const overlay = document.getElementById('wrong-answer-overlay');
  if (overlay) overlay.hidden = true;
}

// ─── Initialisation client ────────────────────────────────────────────────────

export async function initClient(hostPeerId) {
  clientState.isHost = false;
  clientState.hostPeerId = hostPeerId;

  // Vérifier si une session est en cours pour cet hôte
  const savedSession = loadSession();
  if (savedSession && savedSession.hostPeerId === hostPeerId && savedSession.playerName) {
    clientState.myName = savedSession.playerName;
    showOnly('screen-lobby');
    setLoadingStatus('Reconnexion en cours…');
    await startClientSession(hostPeerId, savedSession.playerName);
    return;
  }

  showOnly('screen-join');

  // Pré-remplir le nom depuis localStorage
  const savedPlayerName = localStorage.getItem(PLAYER_NAME_KEY);
  const playerNameInput = document.getElementById('player-name');
  if (savedPlayerName && playerNameInput && !playerNameInput.value) playerNameInput.value = savedPlayerName;

  const btnJoin = document.getElementById('btn-join');
  if (btnJoin) {
    btnJoin.addEventListener('click', async () => {
      const nameInput = document.getElementById('player-name');
      const name = nameInput?.value?.trim();
      if (!name) { showToast('Entrez votre pseudo', 'warn'); return; }
      try { localStorage.setItem(PLAYER_NAME_KEY, name); } catch (_) {}
      clientState.myName = name;
      btnJoin.disabled = true;
      btnJoin.textContent = '⏳ Connexion…';
      await startClientSession(hostPeerId, name);
    });
  }

  // Aussi rejoindre si Enter dans le champ nom
  const nameInput = document.getElementById('player-name');
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-join')?.click();
    });
  }
}

async function startClientSession(hostPeerId, playerName) {
  const peer = new QuizPeer();

  // État local du client
  const local = {
    currentQuestion: null,
    choices: null,
    selfEliminated: false,
    hasBuzzedWrong: false, // a déjà répondu faux au buzzer sur cette question
    buzzQueue: [],
    mode: MODE.CLASSIC,
    answerTime: 15,
    correctAnswer: null, // révélé en QUESTION_END
    config: {},
  };

  peer.addEventListener('ready', () => {
    clientState.myId = peer.peerId;
    peer.sendToHost({ type: MSG.JOIN, name: playerName });
    showOnly('screen-lobby');
    setLoadingStatus('');
    // Sauvegarder la session pour une éventuelle reconnexion
    saveSession(hostPeerId, playerName);
  });

  peer.addEventListener('host-reconnecting', () => {
    showToast('Reconnexion à l\'hôte…', 'warn');
  });

  peer.addEventListener('host-reconnected', () => {
    showToast('Reconnecté !', 'info');
    peer.sendToHost({ type: MSG.JOIN, name: playerName });
  });

  peer.addEventListener('player-leave', () => {
    showToast('L\'hôte s\'est déconnecté', 'error');
  });

  peer.addEventListener('error', (e) => {
    showToast('Erreur réseau : ' + e.detail.err?.message, 'error');
  });

  peer.addEventListener('message', (e) => {
    const data = e.detail.data;
    handleClientMessage(data, peer, local, playerName);
  });

  await peer.joinHost(hostPeerId);
}

function handleClientMessage(data, peer, local, playerName) {
  switch (data.type) {
    case MSG.KICKED:
      showToast('Vous avez été exclu de la partie', 'error');
      clearSession();
      showOnly('screen-join');
      break;

    case MSG.PLAYER_LIST:
      clientState.players = data.players ?? [];
      renderLobbyPlayers(clientState.players, false, null);
      renderScoreboard(clientState.players, local.config?.hostIsReader ?? false);
      // Bouton "Prêt"
      setupReadyButton(peer);
      break;

    case MSG.GAME_START:
      local.mode = data.mode ?? MODE.CLASSIC;
      local.config = data.config ?? {};
      local.answerTime = data.config?.answerTime ?? 15;
      clientState.mode = local.mode;
      showOnly('screen-game');
      break;

    case MSG.SHOW_QUESTION:
      local.currentQuestion = {
        text: data.text,
        choices: data.choices ?? [],
        imageUrl: data.imageUrl ?? null,
        category: data.category,
        difficulty: data.difficulty,
      };
      local.selfEliminated = false;
      local.hasBuzzedWrong = false;
      local.correctAnswer = null;
      local.buzzQueue = [];
      clientState.currentIndex = data.index ?? 0;
      clientState.total = data.total ?? 0;
      clientState.currentQuestion = local.currentQuestion;
      clientState.buzzQueue = [];
      clientState.eliminatedPlayers = [];
      clientState.lastResult = null;
      clientState.phase = PHASE.QUESTION_PREVIEW;

      hideWrongAnswerOverlay();
      showOnly('screen-game');
      renderScoreboard(clientState.players, local.config?.hostIsReader ?? false);
      renderGamePhase(PHASE.QUESTION_PREVIEW, buildClientRenderData(local), false);
      stopTimerBar();
      playQuestionStart();
      // Après 3s (même timing que l'hôte), activer le buzzer / les choix
      setTimeout(() => {
        if (local.mode === MODE.QCM) {
          clientState.phase = PHASE.ANSWERING;
          startTimerBar(TIMER.QCM_DURATION, 'timer-fill', 100, playTick);
          renderGamePhase(PHASE.ANSWERING, buildClientRenderData(local, {
            onChoiceClick: (choice) => {
              if (local.selfEliminated) return;
              peer.sendToHost({ type: MSG.CHOICE, text: choice });
              local.selfEliminated = true; // optimisme : on attend la confirmation
            },
          }), false);
        } else {
          clientState.phase = PHASE.BUZZING;
          startTimerBar(TIMER.BUZZ_DURATION, 'timer-fill', 100);
          renderGamePhase(PHASE.BUZZING, buildClientRenderData(local, { canBuzz: true }), false);
          setupClientBuzzButton(peer, local);
        }
      }, TIMER.QUESTION_PREVIEW);
      break;

    case MSG.BUZZ_QUEUE:
      local.buzzQueue = data.queue ?? [];
      clientState.buzzQueue = local.buzzQueue;
      {
        const isCurrent = local.buzzQueue[0] === peer.peerId;
        const dur = local.mode === MODE.SPEED ? TIMER.SPEED_ANSWER : local.answerTime * 1000;
        clientState.phase = PHASE.ANSWERING;
        startTimerBar(dur, 'timer-fill', 100, playTick);
        renderGamePhase(PHASE.ANSWERING, buildClientRenderData(local, { canBuzz: false }), false);
        if (isCurrent && !local.config?.hostIsReader) {
          // C'est mon tour de répondre
          setupClientAnswerForm(peer, local);
        } else {
          // Quelqu'un d'autre répond, ou mode hôte lecteur (réponse à l'oral)
          const inp = document.getElementById('answer-input');
          if (inp) { inp.disabled = true; inp.value = ''; }
        }
      }
      break;

    case MSG.WRONG_CHOICE:
      if (data.playerId === peer.peerId) {
        local.selfEliminated = true;
        disableChoice(data.choice);
        const malusStr = data.points < 0 ? ` (${data.points} pts)` : '';
        showToast(`❌ Mauvaise réponse !${malusStr}`, 'warn');
        showWrongAnswerOverlay();
        playWrong();
      } else {
        disableChoice(data.choice);
        const wrongPlayer = clientState.players.find(p => p.id === data.playerId);
        if (wrongPlayer) showWrongPlayerNotification(wrongPlayer.name);
      }
      if (data.scores) {
        applyScores(data.scores);
        renderScoreboard(clientState.players, local.config?.hostIsReader ?? false);
      }
      break;

    case MSG.ANSWER_RESULT:
      stopTimerBar();
      clientState.lastResult = { ...data, skipped: false };
      clientState.phase = PHASE.ANSWER_RESULT;
      renderGamePhase(PHASE.ANSWER_RESULT, buildClientRenderData(local), false);
      if (data.scores) {
        applyScores(data.scores);
        renderScoreboard(clientState.players, local.config?.hostIsReader ?? false);
      }
      if (local.mode === MODE.QCM && local.currentQuestion?.choices) {
        const wrong = data.correct === false ? data.answer : null;
        highlightChoices(data.correct ? data.answer : null, wrong);
      }
      if (data.correct) {
        if (data.playerId === peer.peerId) flashBuzz();
        playCorrect();
      } else if (data.nearMiss) {
        playNearMiss();
      } else if (data.playerId) {
        playWrong();
      }
      // En mode classique/speed, si le joueur courant a répondu faux, griser l'écran
      if (data.correct === false && data.playerId === peer.peerId) {
        local.hasBuzzedWrong = true;
        showWrongAnswerOverlay();
      }
      break;

    case MSG.BUZZ_RESUME:
      // Retour en phase buzzer après mauvaise réponse — les autres joueurs peuvent buzzer
      hideWrongAnswerOverlay();
      {
        const remainingMs = data.remainingMs ?? TIMER.BUZZ_DURATION;
        const startPct = Math.round((remainingMs / TIMER.BUZZ_DURATION) * 100);
        local.buzzQueue = [];
        clientState.buzzQueue = [];
        clientState.phase = PHASE.BUZZING;
        stopTimerBar();
        startTimerBar(TIMER.BUZZ_DURATION, 'timer-fill', startPct);
        renderGamePhase(PHASE.BUZZING, buildClientRenderData(local, { canBuzz: !local.hasBuzzedWrong }), false);
        if (!local.hasBuzzedWrong) {
          setupClientBuzzButton(peer, local);
        }
      }
      break;

    case MSG.QUESTION_END:
      stopTimerBar();
      hideWrongAnswerOverlay();
      local.correctAnswer = data.correctAnswer;
      if (local.currentQuestion) {
        local.currentQuestion.correctAnswer = data.correctAnswer;
        local.currentQuestion.trivia = data.trivia ?? null;
      }
      clientState.currentQuestion = local.currentQuestion;
      clientState.phase = PHASE.QUESTION_END;
      if (data.scores) {
        applyScores(data.scores);
        renderScoreboard(clientState.players, local.config?.hostIsReader ?? false);
      }
      renderGamePhase(PHASE.QUESTION_END, buildClientRenderData(local, { skipped: data.skipped }), false);
      break;

    case MSG.GAME_OVER:
      stopTimerBar();
      hideWrongAnswerOverlay();
      clearSession();
      clientState.finalScores = data.finalScores ?? [];
      saveToLeaderboard(clientState.finalScores);
      showOnly('screen-game-over');
      renderFinalResults(clientState.finalScores);
      renderLeaderboard(loadLeaderboard(), 'leaderboard-gameover-list', 'leaderboard-gameover-card');
      playGameOver();
      break;

    case MSG.LOBBY_RESET:
      stopTimerBar();
      hideWrongAnswerOverlay();
      hidePartyOverlay();
      clientState.phase = PHASE.LOBBY;
      local.currentQuestion = null;
      local.hasBuzzedWrong = false;
      local.selfEliminated = false;
      local.correctAnswer = null;
      local.buzzQueue = [];
      local.party = null;
      // Réinitialiser l'état du bouton "Prêt" pour la prochaine partie
      {
        const readyBtn = document.getElementById('btn-ready');
        if (readyBtn) {
          readyBtn.disabled = false;
          readyBtn.textContent = '✅ Je suis prêt !';
          delete readyBtn.dataset.bound;
        }
      }
      showOnly('screen-lobby');
      break;

    // ── PARTY ──────────────────────────────────────────────────────────────
    case PARTY_MSG.PARTY_MINI_START: {
      local.party = local.party ?? {};
      local.party.mini = data.mini;
      local.party.miniIndex = data.miniIndex;
      local.party.totalMinis = data.totalMinis;
      local.party.tfVote = null;
      if (data.scores) { applyScores(data.scores); renderScoreboard(clientState.players, false); }
      showOnly('screen-game');
      // Overlay : règles + "En attente de l'hôte"
      renderPartyOverlay(
        { mini: data.mini, miniIndex: data.miniIndex, totalMinis: data.totalMinis,
          label: PARTY_MINI_LABELS[data.mini] ?? data.label,
          icon:  PARTY_MINI_ICONS[data.mini]  ?? data.icon,
          rules: PARTY_MINI_RULES[data.mini]  ?? data.rules },
        false, null
      );
      break;
    }

    case PARTY_MSG.PARTY_MINI_READY:
      hidePartyOverlay();
      break;

    case PARTY_MSG.PARTY_STREAK_QUESTION:
      if (!local.party) local.party = {};
      local.party.streakAnswered = false;
      stopTimerBar();
      renderPartyStreakQuestion(
        { text: data.text, choices: data.choices ?? [], index: data.index, total: data.total },
        false,
        (choice) => {
          if (local.party?.streakAnswered) return;
          local.party.streakAnswered = true;
          peer.sendToHost({ type: PARTY_MSG.PARTY_STREAK_CHOICE, choice });
        }
      );
      startTimerBar(15000, 'timer-fill', 100, playTick);
      break;

    case PARTY_MSG.PARTY_STREAK_REVEAL:
      stopTimerBar();
      renderPartyStreakReveal(data, clientState.players);
      renderStreakBoard(data.streaks ?? {}, clientState.players);
      {
        const myResult = data.results?.[peer.peerId];
        if (myResult?.correct === false && myResult?.choice !== null) {
          showToast('❌ Mauvaise réponse !', 'warn');
          playWrong();
        }
      }
      break;

    case PARTY_MSG.PARTY_DUEL_ASSIGN:
      if (!local.party) local.party = {};
      local.party.duelInterrogateurId = data.interrogateurId;
      local.party.duelAnswered = false;
      renderPartyDuelAssign(data);
      break;

    case PARTY_MSG.PARTY_DUEL_PICK_OPTIONS:
      // Message privé reçu uniquement par l'interrogateur
      if (!local.party) local.party = {};
      renderPartyDuelPick(
        { options: data.options },
        (qid) => peer.sendToHost({ type: PARTY_MSG.PARTY_DUEL_PICK, questionId: qid })
      );
      break;

    case PARTY_MSG.PARTY_DUEL_QUESTION:
      if (!local.party) local.party = {};
      local.party.duelAnswered = false;
      renderPartyDuelQuestion(
        data,
        peer.peerId,
        false,
        (choice) => {
          if (local.party?.duelAnswered) return;
          local.party.duelAnswered = true;
          peer.sendToHost({ type: PARTY_MSG.PARTY_DUEL_CHOICE, choice });
        }
      );
      startTimerBar(15000, 'timer-fill', 100, playTick);
      break;

    case PARTY_MSG.PARTY_DUEL_RESULT:
      stopTimerBar();
      if (data.scores) { applyScores(data.scores); renderScoreboard(clientState.players, false); }
      renderPartyDuelResult(data, clientState.players);
      {
        if (data.interrogateurId !== peer.peerId) {
          const myResult = data.results?.[peer.peerId];
          if (myResult?.correct === false && myResult?.choice !== null) {
            showToast('❌ Mauvaise réponse !', 'warn');
            playWrong();
          }
        }
      }
      break;

    case PARTY_MSG.PARTY_TF_QUESTION:
      if (!local.party) local.party = {};
      local.party.tfVote = null;
      stopTimerBar();
      renderPartyTFQuestion(data, false, null, null, false);
      // Après 3 s, activer les boutons (côté client, même timing que l'hôte)
      setTimeout(() => {
        if (local.party?.tfVote) return; // déjà voté
        renderPartyTFQuestion(data, false, local.party?.tfVote ?? null,
          (vote) => {
            if (local.party?.tfVote) return;
            local.party.tfVote = vote;
            // Mettre à jour les boutons immédiatement
            const btnVrai = document.getElementById('btn-tf-vrai');
            const btnFaux = document.getElementById('btn-tf-faux');
            if (btnVrai) { btnVrai.disabled = true; if (vote === 'V') btnVrai.classList.add('tf-selected'); }
            if (btnFaux) { btnFaux.disabled = true; if (vote === 'F') btnFaux.classList.add('tf-selected'); }
            const votedEl = document.getElementById('party-tf-voted');
            if (votedEl) { votedEl.hidden = false; votedEl.textContent = `Vous avez voté : ${vote === 'V' ? '✅ VRAI' : '❌ FAUX'}`; }
            peer.sendToHost({ type: PARTY_MSG.PARTY_TF_VOTE, vote });
          },
          true
        );
        startTimerBar(7000, 'timer-fill', 100, playTick);
      }, 3000);
      break;

    case PARTY_MSG.PARTY_TF_REVEAL:
      stopTimerBar();
      if (data.scores) { applyScores(data.scores); renderScoreboard(clientState.players, false); }
      renderPartyTFReveal(data, clientState.players);
      {
        const myVote = data.votes?.[peer.peerId];
        if (myVote && myVote !== data.correctVote) {
          showToast('❌ Mauvaise réponse !', 'warn');
          playWrong();
        }
      }
      break;

    case PARTY_MSG.PARTY_RACE_QUESTION:
      if (!local.party) local.party = {};
      local.party.raceAnswered = false;
      stopTimerBar();
      renderPartyRaceQuestion(
        { text: data.text, choices: data.choices ?? [], index: data.index, total: data.total, answers: {}, category: data.category },
        false,
        (choice) => {
          if (local.party?.raceAnswered) return;
          local.party.raceAnswered = true;
          peer.sendToHost({ type: PARTY_MSG.PARTY_RACE_CHOICE, choice });
        }
      );
      startTimerBar(15000, 'timer-fill', 100, playTick);
      break;

    case PARTY_MSG.PARTY_RACE_REVEAL:
      stopTimerBar();
      if (data.scores) { applyScores(data.scores); renderScoreboard(clientState.players, false); }
      renderPartyRaceReveal(data, clientState.players);
      {
        const myResult = data.results?.[peer.peerId];
        if (myResult?.correct === false && myResult?.choice !== null) {
          showToast('❌ Mauvaise réponse !', 'warn');
          playWrong();
        }
      }
      break;

    case PARTY_MSG.PARTY_BLITZ_QUESTION:
      if (!local.party) local.party = {};
      local.party.blitzAnswered = false;
      stopTimerBar();
      renderPartyBlitzQuestion(
        { text: data.text, choices: data.choices ?? [], index: data.index, total: data.total, answers: {}, category: data.category },
        false,
        (choice) => {
          if (local.party?.blitzAnswered) return;
          local.party.blitzAnswered = true;
          peer.sendToHost({ type: PARTY_MSG.PARTY_BLITZ_CHOICE, choice });
        }
      );
      startTimerBar(data.timerMs ?? 5000, 'timer-fill', 100, playTick);
      break;

    case PARTY_MSG.PARTY_BLITZ_REVEAL:
      stopTimerBar();
      if (data.scores) { applyScores(data.scores); renderScoreboard(clientState.players, false); }
      renderPartyBlitzReveal(data, clientState.players);
      {
        const myResult = data.results?.[peer.peerId];
        if (myResult?.correct === false && myResult?.choice !== null) {
          showToast('❌ Mauvaise réponse !', 'warn');
          playWrong();
        }
      }
      break;

    case PARTY_MSG.PARTY_CAROUSEL_ASSIGN: {
      if (!local.party) local.party = {};
      local.party.carouselAnswered = false;
      const isMyTurn = data.activePlayer === peer.peerId;
      const activeName = clientState.players.find(p => p.id === data.activePlayer)?.name ?? '';
      renderPartyCarouselQuestion(
        {
          activePlayer:     data.activePlayer,
          activePlayerName: activeName,
          text:             data.text ?? '',
          choices:          data.choices ?? [],
          category:         data.category,
          index:            data.index,
          total:            data.total,
          showQuestion:     data.showQuestion ?? false,
          correctAnswer:    null,
        },
        peer.peerId,
        false,
        isMyTurn && data.showQuestion
          ? (choice) => {
              if (local.party?.carouselAnswered) return;
              local.party.carouselAnswered = true;
              peer.sendToHost({ type: PARTY_MSG.PARTY_CAROUSEL_CHOICE, choice });
            }
          : null
      );
      if (data.showQuestion && isMyTurn) startTimerBar(12000, 'timer-fill', 100, playTick);
      break;
    }

    case PARTY_MSG.PARTY_CAROUSEL_REVEAL:
      stopTimerBar();
      if (data.scores) { applyScores(data.scores); renderScoreboard(clientState.players, false); }
      renderPartyCarouselReveal(data, clientState.players);
      {
        if (data.activePlayer === peer.peerId && !data.correct && data.choice !== null) {
          showToast('❌ Mauvaise réponse !', 'warn');
          playWrong();
        }
      }
      break;

    case PARTY_MSG.PARTY_MINI_END:
      stopTimerBar();
      if (data.scores) { applyScores(data.scores); renderScoreboard(clientState.players, false); }
      renderPartyMiniEnd(data, clientState.players);
      // Cacher le streak board
      { const board = document.getElementById('streak-board'); if (board) board.hidden = true; }
      break;

    case MSG.LOBBY_CONFIG:
      local.config = { ...local.config, ...data.config };
      renderLobbyConfigPreview(data.config);
      break;
  }
}

function buildClientRenderData(local, extra = {}) {
  return {
    currentIndex: clientState.currentIndex,
    total: clientState.total,
    currentQuestion: local.currentQuestion,
    buzzQueue: local.buzzQueue,
    eliminatedPlayers: local.selfEliminated ? ['__self__'] : [],
    lastResult: { ...clientState.lastResult, skipped: extra.skipped ?? false },
    players: clientState.players,
    myId: clientState.myId,
    mode: local.mode,
    canBuzz: extra.canBuzz ?? false,
    showAnswerToHost: false,
    hostIsReader: local.config?.hostIsReader ?? false,
    onChoiceClick: extra.onChoiceClick,
  };
}

function setupReadyButton(peer) {
  const btn = document.getElementById('btn-ready');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => {
    peer.sendToHost({ type: MSG.READY });
    btn.disabled = true;
    btn.textContent = '✅ Prêt !';
  });
}

function setupClientBuzzButton(peer, local) {
  const btn = document.getElementById('btn-buzz');
  if (!btn) return;
  btn.disabled = false;
  btn.onclick = () => {
    if (clientState.phase !== PHASE.BUZZING && clientState.phase !== PHASE.ANSWERING) return;
    peer.sendToHost({ type: MSG.BUZZ, ts: Date.now() });
    btn.disabled = true;
    flashBuzz();
    playBuzz();
  };
}

function setupClientAnswerForm(peer, local) {
  const form = document.getElementById('answer-form');
  const inp = document.getElementById('answer-input');
  if (!form || !inp) return;
  inp.disabled = false;
  inp.value = '';
  inp.focus();
  form.onsubmit = (e) => {
    e.preventDefault();
    const text = inp.value.trim();
    if (!text) return;
    peer.sendToHost({ type: MSG.ANSWER, text });
    inp.disabled = true;
    inp.value = '';
  };
}

/** Applique les scores reçus du host aux players locaux */
function applyScores(scores) {
  for (const p of clientState.players) {
    if (scores[p.id] != null) p.score = scores[p.id];
  }
}

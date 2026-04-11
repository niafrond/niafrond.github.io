/**
 * host.js — Logique côté hôte (initialisation, gestion de partie, transitions)
 */

import { QuizPeer } from './peer.js';
import { GameEngine } from './game.js';
import { PartyGameEngine, PARTY_MSG, PARTY_PHASE, calcPartyQuestionsNeeded, getPartyMiniRules, PARTY_MINI_LABELS, PARTY_MINI_ICONS } from './party-game.js';
import { fetchQuestions } from './questions.js';
import { MSG, PHASE, MODE, TIMER, CATEGORY_LABELS } from './constants.js';
import {
  showOnly, renderSetupForm, renderShareLink,
  renderLobbyPlayers, renderScoreboard, renderGamePhase,
  renderFinalResults, startTimerBar, stopTimerBar,
  flashBuzz, showToast, setLoadingStatus, highlightChoices,
  showWrongPlayerNotification, renderLeaderboard, updateModeAvailability,
} from './ui.js';
import {
  readPartyOptions,
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
  clientState, PLAYER_NAME_KEY, LEADERBOARD_KEY,
  loadLeaderboard, saveToLeaderboard,
  loadAskedQuestions, saveAskedQuestions, prioritizeUnasked,
  saveHostSession, loadHostSession, clearHostSession,
} from './state.js';

// ─── Config de partie (hôte) ──────────────────────────────────────────────────

const hostConfig = {
  mode: MODE.CLASSIC,
  categories: [],
  difficulties: [],
  questionCount: 10,
  answerTime: 15,
  showAnswerToHost: false,
  applyMalus: false,
  hostIsReader: false,
  comboStreak: false,
  doubleOrNothing: false,
  secretBet: false,
  hiddenTarget: false,
  powers: false,
  draftCategories: false,
  hostIsAnimateur: false,
};

// Référence au conteneur d'engine (partagée entre hôte et helper)
let _currentRef = null;

// Phase party précédente (pour détecter les transitions et éviter les toasts en double)
let _partyPhase = null;

// ─── Initialisation hôte ─────────────────────────────────────────────────────

export async function initHost() {
  showOnly('screen-setup');

  // Pré-remplir le nom depuis localStorage
  const savedName = localStorage.getItem(PLAYER_NAME_KEY);
  const hostNameInput = document.getElementById('host-name');
  if (savedName && hostNameInput && !hostNameInput.value) hostNameInput.value = savedName;

  // Afficher le classement local
  const leaderboard = loadLeaderboard();
  renderLeaderboard(leaderboard, 'leaderboard-setup-list', 'leaderboard-setup-card');

  // Bouton effacer classement
  const btnClear = document.getElementById('btn-clear-leaderboard');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      try { localStorage.removeItem(LEADERBOARD_KEY); } catch (_) {}
      renderLeaderboard([], 'leaderboard-setup-list', 'leaderboard-setup-card');
    });
  }

  const btnHost = document.getElementById('btn-start-host');
  if (btnHost) {
    btnHost.addEventListener('click', async () => {
      const nameInput = document.getElementById('host-name');
      const name = nameInput?.value?.trim() || 'Hôte';
      if (!name) { showToast('Entrez votre pseudo', 'warn'); return; }
      try { localStorage.setItem(PLAYER_NAME_KEY, name); } catch (_) {}
      clientState.myName = name;
      btnHost.disabled = true;
      btnHost.textContent = '⏳ Connexion…';
      await startHostSession(name, loadHostSession());
    });
  }
}

/**
 * Démarre une session hôte PeerJS.
 * @param {string} hostName  - Nom de l'hôte
 * @param {string|null} savedPeerId - Peer ID sauvegardé (tentative de réutilisation), ou null
 * @param {boolean} [isRetry=false]  - true si on réessaie après un ID indisponible
 */
function generateSessionId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function startHostSession(hostName, savedPeerId = null, isRetry = false) {
  const peer = new QuizPeer();
  // Conteneur muable pour permettre l'échange d'engine (normal ↔ party)
  const ref = { engine: null };
  _currentRef = ref;

  showOnly('screen-lobby');
  setLoadingStatus('Connexion au serveur de signalisation…');

  peer.addEventListener('ready', (e) => {
    // Persiste l'ID de session hôte pour permettre la reconnexion dans l'heure
    saveHostSession(e.detail.peerId);

    clientState.myId = '__host__';
    clientState.isHost = true;
    clientState.hostPeerId = e.detail.peerId;

    renderShareLink(e.detail.peerId);
    setLoadingStatus('');

    // Formulaire de configuration dans le lobby
    setupLobbyConfig(peer);

    // Créer le moteur de jeu (GameEngine pour le lobby)
    ref.engine = new GameEngine(peer, (state) => {
      handleHostStateChange(state, ref.engine, peer);
    });

    // Ajouter l'hôte comme joueur
    ref.engine.addPlayer('__host__', hostName);
    clientState.players = ref.engine.state.players;
    renderLobbyPlayers(clientState.players, true, (id) => {
      peer.kick(id);
      ref.engine.removePlayer(id);
    });

    // Bouton "Démarrer"
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart && !btnStart.dataset.bound) {
      btnStart.dataset.bound = '1';
      btnStart.addEventListener('click', () => startGame(ref, peer));
    }
  });

  peer.addEventListener('player-join', () => {
    // Diffuser la config actuelle à tous les joueurs connectés quand quelqu'un rejoint
    peer.broadcast({ type: MSG.LOBBY_CONFIG, config: { ...hostConfig } });
  });

  peer.addEventListener('player-leave', (e) => {
    if (ref.engine) ref.engine.removePlayer(e.detail.peerId);
  });

  peer.addEventListener('message', (e) => {
    if (ref.engine) ref.engine.handleMessage(e.detail.from, e.detail.data);
  });

  peer.addEventListener('error', (e) => {
    // Si l'ID sauvegardé est désormais indisponible, purger et relancer sans ID
    if (!isRetry && e.detail.err?.type === 'unavailable-id') {
      clearHostSession();
      peer.destroy();
      startHostSession(hostName, null, true).catch((err) => {
        showToast('Erreur réseau : ' + err?.message, 'error');
      });
      return;
    }
    showToast('Erreur réseau : ' + e.detail.err?.message, 'error');
  });

  await peer.startHost(savedPeerId || generateSessionId());
}

/**
 * Initialise le formulaire de configuration dans le lobby (côté hôte).
 * Diffuse la config en temps réel à tous les joueurs connectés.
 */
function setupLobbyConfig(peer) {
  renderSetupForm(hostConfig, (changes) => {
    Object.assign(hostConfig, changes);
    peer.broadcast({ type: MSG.LOBBY_CONFIG, config: { ...hostConfig } });
  });
}

async function startGame(ref, peer) {
  const btnStart = document.getElementById('btn-start-game');
  if (btnStart) {
    btnStart.disabled = true;
    btnStart.textContent = '⏳ Chargement des questions…';
  }

  // ── Draft de catégories ─────────────────────────────────────────────────
  if (hostConfig.draftCategories) {
    const availableCats = Object.keys(CATEGORY_LABELS).filter(k => k !== '');
    showToast('Phase de draft — choisissez vos catégories !', 'info');
    ref.engine.startDraft(availableCats, async (pickedCategories) => {
      const categories = pickedCategories.length > 0 ? pickedCategories : hostConfig.categories;
      await _fetchAndStartGame(ref, peer, { ...hostConfig, categories }, btnStart);
    });
    return;
  }

  await _fetchAndStartGame(ref, peer, hostConfig, btnStart);
}

async function _fetchAndStartGame(ref, peer, config, btnStart) {
  showToast('Récupération des questions…', 'info');
  const isParty = config.mode === MODE.PARTY;

  if (isParty) {
    const partyOpts = readPartyOptions();
    Object.assign(config, partyOpts);
  }

  const count = isParty ? calcPartyQuestionsNeeded(config.questionsPerMini) : config.questionCount;

  let questions;
  try {
    questions = await fetchQuestions({
      count,
      categories: config.categories,
      difficulties: config.difficulties,
    });
  } catch (err) {
    showToast('Impossible de charger les questions', 'error');
    if (btnStart) { btnStart.disabled = false; btnStart.textContent = '▶️ Démarrer'; }
    return;
  }

  if (isParty) {
    questions = prioritizeUnasked(questions);
    saveAskedQuestions(questions.map(q => q.id).filter(Boolean));

    const prevPlayers = ref.engine?.state?.players ?? [];
    const partyEngine = new PartyGameEngine(peer, (state) => {
      handlePartyHostStateChange(state, partyEngine, peer);
    });
    prevPlayers.forEach(p => partyEngine.addPlayer(p.id, p.name));
    ref.engine = partyEngine;

    clientState.showAnswerToHost = false;
    clientState.hostIsReader = false;
    clientState.hostIsAnimateur = false;
    _partyPhase = null;
    partyEngine.startGame(questions, { ...config });
    return;
  }

  clientState.showAnswerToHost = config.showAnswerToHost;
  clientState.hostIsReader = config.hostIsReader || config.hostIsAnimateur;
  clientState.hostIsAnimateur = config.hostIsAnimateur ?? false;
  ref.engine.startGame(questions, { ...config });
}

// ─────────────────────────────────────────────────────────────────────────────
// Changements d'état côté HÔTE (mode classique)
// ─────────────────────────────────────────────────────────────────────────────

function handleHostStateChange(state, engine, peer) {
  const prevEliminatedPlayers = clientState.eliminatedPlayers ? [...clientState.eliminatedPlayers] : [];

  clientState.players = state.players;
  clientState.phase = state.phase;
  clientState.mode = state.mode;
  clientState.config = state.config;

  const q = engine.currentQuestion;
  clientState.currentQuestion = q;
  clientState.currentIndex = state.currentIndex;
  clientState.total = state.questions.length;
  clientState.buzzQueue = state.buzzQueue;
  clientState.eliminatedPlayers = state.eliminatedPlayers;
  clientState.lastResult = state.lastResult;

  switch (state.phase) {
    case PHASE.LOBBY:
      showOnly('screen-lobby');
      renderLobbyPlayers(state.players, true, (id) => {
        peer.kick(id);
        engine.removePlayer(id);
      });
      updateModeAvailability(state.players.length, (newMode) => {
        hostConfig.mode = newMode;
        peer.broadcast({ type: MSG.LOBBY_CONFIG, config: { ...hostConfig } });
      });
      break;

    case PHASE.QUESTION_PREVIEW:
      showOnly('screen-game');
      renderScoreboard(state.players, clientState.hostIsReader);
      renderGamePhase(state.phase, buildRenderData(state, engine), true);
      stopTimerBar();
      playQuestionStart();
      break;

    case PHASE.BUZZING:
      showOnly('screen-game');
      renderScoreboard(state.players, clientState.hostIsReader);
      renderGamePhase(state.phase, buildRenderData(state, engine), true);
      {
        const buzzRemaining = state.buzzDeadline ? Math.max(0, state.buzzDeadline - Date.now()) : TIMER.BUZZ_DURATION;
        const buzzStartPct = Math.round((buzzRemaining / TIMER.BUZZ_DURATION) * 100);
        startTimerBar(TIMER.BUZZ_DURATION, 'timer-fill', buzzStartPct);
      }
      // Buzzer hôte (désactivé en mode hôte lecteur)
      if (!clientState.hostIsReader) {
        setupHostBuzzButton(engine);
      }
      break;

    case PHASE.ANSWERING:
      showOnly('screen-game');
      renderScoreboard(state.players, clientState.hostIsReader);
      // Détecter les nouvelles éliminations QCM côté hôte et notifier
      if (state.mode === MODE.QCM) {
        const newElim = state.eliminatedPlayers.filter(id => !prevEliminatedPlayers.includes(id));
        newElim.forEach(id => {
          const p = state.players.find(pl => pl.id === id);
          if (p && p.id !== '__host__') showWrongPlayerNotification(p.name);
        });
        if (newElim.includes('__host__')) {
          showToast('❌ Mauvaise réponse !', 'warn');
          playWrong();
        }
      }
      {
        const dur = (state.mode === MODE.QCM || state.mode === MODE.PINGPONG) ? TIMER.QCM_DURATION
          : state.mode === MODE.SPEED ? TIMER.SPEED_ANSWER
          : (state.config.answerTime ?? 15) * 1000;
        startTimerBar(dur, 'timer-fill', 100, playTick);
      }
      {
        const data = buildRenderData(state, engine);
        if ((state.mode === MODE.QCM || state.mode === MODE.PINGPONG) && !clientState.hostIsReader) {
          const isHostTurn = state.mode === MODE.PINGPONG ? state.buzzQueue[0] === '__host__' : true;
          if (isHostTurn) {
            data.onChoiceClick = (choice) => {
              engine.handleChoice('__host__', choice);
            };
          }
          data.eliminatedPlayers = state.eliminatedPlayers;
        } else if (state.mode === MODE.BUZZ_QCM && !clientState.hostIsReader && state.buzzQcmCurrentBuzzer === '__host__') {
          // L'hôte a buzzé en mode BUZZ_QCM : lui montrer les choix directement
          data.onChoiceClick = (choice) => {
            engine.handleChoice('__host__', choice);
          };
          data.eliminatedPlayers = [];
        }
        renderGamePhase(state.phase, data, true);
      }
      if (clientState.hostIsReader) {
        // Mode hôte lecteur : boutons Correct / Incorrect pour juger à l'oral
        if (state.mode !== MODE.QCM && state.mode !== MODE.PINGPONG && state.mode !== MODE.BUZZ_QCM) {
          setupHostJudgeButtons(engine);
        }
      } else if (state.mode !== MODE.QCM && state.mode !== MODE.PINGPONG && state.mode !== MODE.BUZZ_QCM) {
        // Réponse texte hôte classique
        setupHostAnswerForm(engine, state);
      }
      break;

    case PHASE.ANSWER_RESULT:
      showOnly('screen-game');
      renderScoreboard(state.players, clientState.hostIsReader);
      stopTimerBar();
      renderGamePhase(state.phase, buildRenderData(state, engine), true);
      // Sons de résultat
      if (state.lastResult?.correct) {
        playCorrect();
      } else if (state.lastResult?.nearMiss) {
        playNearMiss();
      } else if (state.lastResult?.playerId) {
        playWrong();
      }
      // Surligner les choix en QCM / Ping-Pong / BUZZ_QCM (quand l'hôte était le buzzeur)
      if ((state.mode === MODE.QCM || state.mode === MODE.PINGPONG ||
           (state.mode === MODE.BUZZ_QCM && state.buzzQcmCurrentBuzzer === '__host__')) && q) {
        const wrong = state.lastResult?.correct === false ? state.lastResult?.answer : null;
        highlightChoices(q.correctAnswer, wrong);
      }
      break;

    case PHASE.QUESTION_END:
      showOnly('screen-game');
      renderScoreboard(state.players, clientState.hostIsReader);
      stopTimerBar();
      renderGamePhase(state.phase, buildRenderData(state, engine), true);
      if (clientState.hostIsAnimateur && !state.answerRevealedForCurrentQuestion) {
        setupRevealButton(engine);
      }
      setupNextButton(engine);
      setupSkipButton(engine);
      break;

    case PHASE.GAME_OVER: {
      let finalScores = state.finalScores ?? [...state.players].sort((a, b) => b.score - a.score);
      // En mode hôte lecteur, s'assurer que l'hôte n'apparaît pas
      if (clientState.hostIsReader) {
        finalScores = finalScores.filter(p => p.id !== '__host__');
      }
      clientState.finalScores = finalScores;
      saveToLeaderboard(finalScores);
      showOnly('screen-game-over');
      renderFinalResults(finalScores);
      renderLeaderboard(loadLeaderboard(), 'leaderboard-gameover-list', 'leaderboard-gameover-card');
      setupPlayAgainButton(_currentRef, peer);
      playGameOver();
      break;
    }
  }
}

function buildRenderData(state, engine) {
  return {
    currentIndex: state.currentIndex,
    total: state.questions?.length ?? 0,
    currentQuestion: engine.currentQuestion,
    buzzQueue: state.buzzQueue,
    eliminatedPlayers: state.eliminatedPlayers,
    lastResult: state.lastResult,
    players: state.players,
    myId: '__host__',
    mode: state.mode,
    canBuzz: !state.buzzQueue.includes('__host__'),
    showAnswerToHost: clientState.showAnswerToHost,
    hostIsReader: clientState.hostIsReader,
    hostIsAnimateur: clientState.hostIsAnimateur,
    answerRevealed: state.answerRevealedForCurrentQuestion ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Changements d'état côté HÔTE (mode Party)
// ─────────────────────────────────────────────────────────────────────────────

function handlePartyHostStateChange(state, engine, peer) {
  const prevPartyPhase = _partyPhase;
  _partyPhase = state.phase;
  const phaseChanged = prevPartyPhase !== state.phase;
  const isHostReader = state.config.hostIsReader ?? false;

  clientState.players = state.players;
  renderScoreboard(state.players, false);

  switch (state.phase) {
    case PARTY_PHASE.MINI_INTRO:
      showOnly('screen-game');
      hidePartyOverlay();
      // Afficher l'overlay avec les règles et le bouton "Commencer !"
      renderPartyOverlay(
        {
          mini:       state.currentMini,
          miniIndex:  state.currentMiniIndex,
          totalMinis: state.miniSequence.length,
          label:      PARTY_MINI_LABELS[state.currentMini],
          icon:       PARTY_MINI_ICONS[state.currentMini],
          rules:      getPartyMiniRules(state.config?.questionsPerMini)[state.currentMini],
        },
        true, // isHost
        () => engine.hostStartMini()
      );
      break;

    case PARTY_PHASE.STREAK_QUESTION:
      hidePartyOverlay();
      {
        const answered = state.streakAnswers['__host__'] !== undefined;
        renderPartyStreakQuestion(
          {
            text:    state.streakCurrentQuestion?.text ?? '',
            choices: state.streakCurrentQuestion?.choices ?? [],
            index:   state.streakIndex,
            total:   state.streakQuestions.length,
            correctAnswer: isHostReader ? state.streakCurrentQuestion?.correctAnswer : undefined,
          },
          true,
          (!isHostReader && !answered) ? (choice) => engine.handleStreakChoice('__host__', choice) : null
        );
      }
      renderStreakBoard(state.streaks, state.players);
      startTimerBar(15000, 'timer-fill', 100, playTick);
      {
        const btnSkip = document.getElementById('btn-skip-question');
        if (btnSkip) btnSkip.onclick = () => engine.hostSkip();
      }
      break;

    case PARTY_PHASE.STREAK_REVEAL:
      stopTimerBar();
      if (state.streakReveal) {
        renderPartyStreakReveal(state.streakReveal, state.players);
        if (phaseChanged && !isHostReader) {
          const hostResult = state.streakReveal.results?.['__host__'];
          if (hostResult?.correct === false && hostResult?.choice !== null) {
            showToast('❌ Mauvaise réponse !', 'warn');
            playWrong();
          }
        }
      }
      break;

    case PARTY_PHASE.DUEL_ASSIGN:
      hidePartyOverlay();
      renderPartyDuelAssign({
        interrogateurName: state.players.find(p => p.id === state.duelInterrogateur)?.name ?? '',
        duelIndex:  state.duelIndex,
        totalDuels: 5,
      });
      break;

    case PARTY_PHASE.DUEL_PICKING:
      // L'hôte est l'interrogateur → montrer les options
      if (state.duelInterrogateur === '__host__') {
        renderPartyDuelPick(
          { options: state.duelPickOptions.map(q => ({ id: q.id, text: q.text, correctAnswer: q.correctAnswer })) },
          (qid) => engine.handleDuelPick('__host__', qid)
        );
      }
      // Sinon l'hôte attend (la phase est affichée sur le panneau assign déjà visible)
      break;

    case PARTY_PHASE.DUEL_QUESTION:
      {
        const isInterrogateur = state.duelInterrogateur === '__host__';
        const answered = state.duelAnswers['__host__'] !== undefined;
        renderPartyDuelQuestion(
          {
            questionText:      state.duelCurrentQuestion?.text ?? '',
            choices:           state.duelCurrentQuestion?.choices ?? [],
            interrogateurId:   state.duelInterrogateur,
            interrogateurName: state.players.find(p => p.id === state.duelInterrogateur)?.name ?? '',
            duelIndex:  state.duelIndex,
            totalDuels: 5,
            correctAnswer: isHostReader ? state.duelCurrentQuestion?.correctAnswer : undefined,
          },
          '__host__', true,
          (!isInterrogateur && !answered && !isHostReader) ? (choice) => engine.handleDuelChoice('__host__', choice) : null
        );
      }
      startTimerBar(15000, 'timer-fill', 100, playTick);
      {
        const btnSkip = document.getElementById('btn-skip-question');
        if (btnSkip) btnSkip.onclick = () => engine.hostSkip();
      }
      break;

    case PARTY_PHASE.DUEL_RESULT:
      stopTimerBar();
      if (state.duelResult) {
        renderPartyDuelResult(state.duelResult, state.players);
        if (phaseChanged && !isHostReader && state.duelResult.interrogateurId !== '__host__') {
          const hostResult = state.duelResult.results?.['__host__'];
          if (hostResult?.correct === false && hostResult?.choice !== null) {
            showToast('❌ Mauvaise réponse !', 'warn');
            playWrong();
          }
        }
      }
      break;

    case PARTY_PHASE.TF_QUESTION:
      hidePartyOverlay();
      renderPartyTFQuestion(
        {
          statement: state.tfStatement,
          tfIndex: state.tfIndex,
          totalTF: state.tfQuestions.length,
          correctVote: isHostReader ? state.tfCorrectVote : undefined,
        },
        true, null, null, false
      );
      break;

    case PARTY_PHASE.TF_VOTING: {
      const myVote = isHostReader ? null : (state.tfVotes['__host__'] ?? null);
      renderPartyTFQuestion(
        {
          statement: state.tfStatement,
          tfIndex: state.tfIndex,
          totalTF: state.tfQuestions.length,
          correctVote: isHostReader ? state.tfCorrectVote : undefined,
        },
        true, myVote,
        (!isHostReader && myVote === null) ? (vote) => engine.handleTFVote('__host__', vote) : null,
        !isHostReader
      );
      if (!isHostReader) {
        startTimerBar(7000, 'timer-fill', 100, playTick);
      }
      {
        const btnSkip = document.getElementById('btn-skip-question');
        if (btnSkip) btnSkip.onclick = () => engine.hostSkip();
      }
      break;
    }

    case PARTY_PHASE.TF_REVEAL:
      stopTimerBar();
      if (state.tfResult) {
        renderPartyTFReveal(state.tfResult, state.players);
        if (phaseChanged && !isHostReader) {
          const hostVote = state.tfResult.votes?.['__host__'];
          if (hostVote && hostVote !== state.tfResult.correctVote) {
            showToast('❌ Mauvaise réponse !', 'warn');
            playWrong();
          }
        }
      }
      break;

    case PARTY_PHASE.RACE_QUESTION:
      hidePartyOverlay();
      renderPartyRaceQuestion(
        {
          text:     state.raceCurrentQuestion?.text ?? '',
          choices:  state.raceCurrentQuestion?.choices ?? [],
          category: state.raceCurrentQuestion?.category,
          index:    state.raceIndex,
          total:    state.raceQuestions.length,
          answers:  state.raceAnswers,
          correctAnswer: isHostReader ? state.raceCurrentQuestion?.correctAnswer : null,
        },
        true, null
      );
      startTimerBar(15000, 'timer-fill', 100, playTick);
      {
        const btnSkip = document.getElementById('btn-skip-question');
        if (btnSkip) btnSkip.onclick = () => engine.hostSkip();
      }
      break;

    case PARTY_PHASE.RACE_REVEAL:
      stopTimerBar();
      if (state.raceReveal) renderPartyRaceReveal(state.raceReveal, state.players);
      break;

    case PARTY_PHASE.BLITZ_QUESTION:
      hidePartyOverlay();
      renderPartyBlitzQuestion(
        {
          text:     state.blitzCurrentQuestion?.text ?? '',
          choices:  state.blitzCurrentQuestion?.choices ?? [],
          category: state.blitzCurrentQuestion?.category,
          index:    state.blitzIndex,
          total:    state.blitzQuestions.length,
          answers:  state.blitzAnswers,
          correctAnswer: isHostReader ? state.blitzCurrentQuestion?.correctAnswer : null,
        },
        true, null
      );
      startTimerBar(5000, 'timer-fill', 100, playTick);
      {
        const btnSkip = document.getElementById('btn-skip-question');
        if (btnSkip) btnSkip.onclick = () => engine.hostSkip();
      }
      break;

    case PARTY_PHASE.BLITZ_REVEAL:
      stopTimerBar();
      if (state.blitzReveal) renderPartyBlitzReveal(state.blitzReveal, state.players);
      break;

    case PARTY_PHASE.CAROUSEL_ASSIGN:
    case PARTY_PHASE.CAROUSEL_QUESTION:
      hidePartyOverlay();
      renderPartyCarouselQuestion(
        {
          activePlayer: state.carouselActivePlayer,
          activePlayerName: state.players.find(p => p.id === state.carouselActivePlayer)?.name ?? '',
          text:     state.carouselCurrentQuestion?.text ?? '',
          choices:  state.carouselCurrentQuestion?.choices ?? [],
          category: state.carouselCurrentQuestion?.category,
          index:    state.carouselIndex,
          total:    state.carouselQuestions.length,
          showQuestion: state.phase === PARTY_PHASE.CAROUSEL_QUESTION,
          correctAnswer: isHostReader ? state.carouselCurrentQuestion?.correctAnswer : null,
        },
        '__host__', true, null
      );
      if (state.phase === PARTY_PHASE.CAROUSEL_QUESTION) {
        startTimerBar(12000, 'timer-fill', 100, playTick);
        const btnSkip = document.getElementById('btn-skip-question');
        if (btnSkip) btnSkip.onclick = () => engine.hostSkip();
      }
      break;

    case PARTY_PHASE.CAROUSEL_REVEAL:
      stopTimerBar();
      if (state.carouselReveal) renderPartyCarouselReveal(state.carouselReveal, state.players);
      break;

    case PARTY_PHASE.MINI_END:
      stopTimerBar();
      renderPartyMiniEnd(
        { mini: state.currentMini, miniScores: state.lastMiniScores,
          scores: Object.fromEntries((state.players ?? []).map(p => [p.id, p.score])) },
        state.players
      );
      break;

    case PARTY_PHASE.GAME_OVER: {
      const finalScores = state.finalScores
        ?? [...state.players].sort((a, b) => b.score - a.score);
      clientState.finalScores = finalScores;
      saveToLeaderboard(finalScores);
      showOnly('screen-game-over');
      renderFinalResults(finalScores);
      renderLeaderboard(loadLeaderboard(), 'leaderboard-gameover-list', 'leaderboard-gameover-card');
      setupPlayAgainButton(_currentRef, peer);
      playGameOver();
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers boutons hôte
// ─────────────────────────────────────────────────────────────────────────────

function setupHostBuzzButton(engine) {
  const btn = document.getElementById('btn-buzz');
  if (!btn) return;
  btn.disabled = false;
  btn.onclick = () => {
    if (engine.state.phase === PHASE.BUZZING) {
      engine.handleBuzz('__host__');
      flashBuzz();
      playBuzz();
      btn.disabled = true;
    }
  };
}

function setupHostAnswerForm(engine, state) {
  const form = document.getElementById('answer-form');
  const inp = document.getElementById('answer-input');
  if (!form || !inp) return;

  if (state.buzzQueue[0] !== '__host__') {
    inp.disabled = true;
    return;
  }
  inp.disabled = false;
  inp.value = '';
  inp.focus();

  form.onsubmit = (e) => {
    e.preventDefault();
    const text = inp.value.trim();
    if (!text) return;
    engine.handleAnswer('__host__', text);
    inp.value = '';
    inp.disabled = true;
  };
}

function setupHostJudgeButtons(engine) {
  const btnCorrect = document.getElementById('btn-judge-correct');
  const btnWrong = document.getElementById('btn-judge-wrong');
  if (!btnCorrect || !btnWrong) return;

  btnCorrect.onclick = () => {
    stopTimerBar();
    btnCorrect.disabled = true;
    btnWrong.disabled = true;
    engine.hostJudgeAnswer(true);
  };
  btnWrong.onclick = () => {
    stopTimerBar();
    btnCorrect.disabled = true;
    btnWrong.disabled = true;
    engine.hostJudgeAnswer(false);
  };
}

function setupNextButton(engine) {
  const btn = document.getElementById('btn-next-question');
  if (btn) btn.onclick = () => engine.hostNext();
}

function setupRevealButton(engine) {
  const btn = document.getElementById('btn-reveal-answer');
  if (btn) btn.onclick = () => engine.hostRevealAnswer();
}

function setupSkipButton(engine) {
  const btn = document.getElementById('btn-skip-question');
  if (btn) btn.onclick = () => engine.hostSkip();
}

function setupPlayAgainButton(ref, peer) {
  const btn = document.getElementById('btn-play-again');
  if (btn) {
    btn.onclick = () => {
      // Prévenir les clients du retour au lobby
      peer.broadcast({ type: MSG.LOBBY_RESET });

      // Récupérer les joueurs connectés depuis l'ancien moteur
      const prevPlayers = (ref.engine?.state?.players ?? []).map(p => ({
        id: p.id,
        name: p.id === '__host__' ? clientState.myName || 'Hôte' : p.name,
      }));

      // Créer un nouveau moteur avec le peer existant
      const newEngine = new GameEngine(peer, (state) => {
        handleHostStateChange(state, newEngine, peer);
      });
      ref.engine = newEngine;

      // Ré-inscrire les joueurs (scores remis à 0, tous marqués prêts car déjà dans la session)
      prevPlayers.forEach(p => newEngine.addPlayer(p.id, p.name));
      newEngine.state.players.forEach(p => { p.ready = true; });

      showOnly('screen-lobby');
      renderLobbyPlayers(newEngine.state.players, true, (id) => {
        peer.kick(id);
        newEngine.removePlayer(id);
      });

      // Re-render le formulaire de configuration dans le lobby
      setupLobbyConfig(peer);
      // Diffuser la config actuelle aux clients déjà connectés
      peer.broadcast({ type: MSG.LOBBY_CONFIG, config: { ...hostConfig } });
      newEngine._broadcastPlayerList();

      // Bouton "Démarrer"
      const btnStart = document.getElementById('btn-start-game');
      if (btnStart) {
        btnStart.disabled = false;
        btnStart.textContent = '▶️ Démarrer la partie';
        delete btnStart.dataset.bound;
        btnStart.onclick = () => startGame(ref, peer);
      }
    };
  }
}

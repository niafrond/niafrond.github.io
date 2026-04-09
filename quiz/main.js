/**
 * main.js — Point d'entrée de l'application Quiz
 *
 * Routing :
 *   ?host=PEERID  → mode client (rejoindre)
 *   (rien)        → mode hôte (créer/configurer)
 */

import { QuizPeer } from './peer.js';
import { GameEngine } from './game.js';
import { PartyGameEngine, PARTY_MSG, PARTY_PHASE, PARTY_QUESTIONS_NEEDED, PARTY_MINI_LABELS, PARTY_MINI_ICONS, PARTY_MINI_RULES } from './party-game.js';
import { fetchQuestions } from './questions.js';
import { MSG, PHASE, MODE, TIMER } from './constants.js';
import {
  showOnly, show, hide, renderSetupForm, renderShareLink,
  renderLobbyPlayers, renderScoreboard, renderGamePhase,
  renderFinalResults, startTimerBar, stopTimerBar,
  flashBuzz, showToast, setLoadingStatus, highlightChoices, disableChoice,
  showWrongPlayerNotification, renderLeaderboard,
  readPartyOptions,
  renderPartyOverlay, hidePartyOverlay,
  renderPartyStreakQuestion, renderPartyStreakReveal, renderStreakBoard,
  renderPartyDuelAssign, renderPartyDuelPick, renderPartyDuelQuestion, renderPartyDuelResult,
  renderPartyTFQuestion, renderPartyTFReveal,
  renderPartyMiniEnd,
} from './ui.js';
import {
  playBuzz, playCorrect, playWrong, playNearMiss,
  playQuestionStart, playGameOver, playTick, setMuted, getMuted,
} from './sound.js';

// ─── Bouton mute (persistant) ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const btnMute = document.getElementById('btn-mute');
  if (btnMute) {
    // Restaurer la préférence mute depuis localStorage
    const savedMute = localStorage.getItem('quiz_muted') === 'true';
    if (savedMute) {
      setMuted(true);
      btnMute.textContent = '🔇 Son';
      btnMute.title = 'Rétablir le son';
      btnMute.setAttribute('aria-label', 'Rétablir le son');
      btnMute.setAttribute('aria-pressed', 'true');
    } else {
      btnMute.setAttribute('aria-label', 'Couper le son');
      btnMute.setAttribute('aria-pressed', 'false');
    }

    btnMute.addEventListener('click', () => {
      const muted = !getMuted();
      setMuted(muted);
      try { localStorage.setItem('quiz_muted', muted); } catch (_) {}
      btnMute.textContent = muted ? '🔇 Son' : '🔊 Son';
      btnMute.title = muted ? 'Rétablir le son' : 'Couper le son';
      btnMute.setAttribute('aria-label', muted ? 'Rétablir le son' : 'Couper le son');
      btnMute.setAttribute('aria-pressed', String(muted));
    });
  }
});

// ─── État global client (partagé host et client) ──────────────────────────────

const clientState = {
  myId: null,
  myName: '',
  isHost: false,
  hostPeerId: null,
  players: [],
  phase: PHASE.LOBBY,
  currentQuestion: null,
  currentIndex: 0,
  total: 0,
  buzzQueue: [],
  eliminatedPlayers: [], // IDs ayant répondu faux en QCM
  selfEliminated: false, // Le joueur local a déjà répondu faux sur cette question (QCM)
  lastResult: null,
  finalScores: [],
  mode: MODE.CLASSIC,
  config: {},
  showAnswerToHost: false,
  hostIsReader: false,
};

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
};

// ─── Initialisation ───────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const hostParam = params.get('host');

// ─── Référence au conteneur d'engine (partagée entre hôte et helper) ──────────
let _currentRef = null;
const STORAGE_KEY = 'quiz_session';
const PLAYER_NAME_KEY = 'quiz_player_name';
const LEADERBOARD_KEY = 'quiz_leaderboard';
const PARTY_ASKED_KEY = 'party_asked_questions';

// ─── Suivi des questions déjà posées (mode Party) ─────────────────────────────

function loadAskedQuestions() {
  try { return new Set(JSON.parse(localStorage.getItem(PARTY_ASKED_KEY) ?? '[]')); } catch (_) { return new Set(); }
}

function saveAskedQuestions(ids) {
  try {
    const prev = loadAskedQuestions();
    ids.forEach(id => prev.add(id));
    // Garder max 300 pour éviter de saturer le localStorage
    const arr = [...prev].slice(-300);
    localStorage.setItem(PARTY_ASKED_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('[Party] Impossible de sauvegarder les questions posées :', err?.message);
  }
}

/** Trie les questions pour mettre les non-posées en premier. */
function prioritizeUnasked(questions) {
  const asked = loadAskedQuestions();
  const unasked = questions.filter(q => q.id && !asked.has(q.id));
  const already  = questions.filter(q => !q.id || asked.has(q.id));
  return [...unasked, ...already];
}

function saveSession(hostPeerId, playerName) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ hostPeerId, playerName })); } catch (_) {}
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); } catch (_) { return null; }
}

function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

// ─── Leaderboard localStorage ─────────────────────────────────────────────────

function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) ?? '[]'); } catch (_) { return []; }
}

function saveToLeaderboard(scores) {
  try {
    const entries = loadLeaderboard();
    const date = new Date().toLocaleDateString('fr-FR');
    scores.forEach(({ name, score }) => {
      if (name && score > 0) entries.push({ name, score, date });
    });
    entries.sort((a, b) => b.score - a.score);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch (_) {}
}

// ─── Overlay mauvaise réponse ─────────────────────────────────────────────────

function showWrongAnswerOverlay() {
  const overlay = document.getElementById('wrong-answer-overlay');
  if (overlay) overlay.hidden = false;
}

function hideWrongAnswerOverlay() {
  const overlay = document.getElementById('wrong-answer-overlay');
  if (overlay) overlay.hidden = true;
}

// Configurer la visibilité des éléments spécifiques à chaque rôle
function applyRoleVisibility(isHost) {
  const hostOnly = document.querySelectorAll('.host-only');
  const clientOnly = document.querySelectorAll('.client-only');
  hostOnly.forEach(el => { el.hidden = !isHost; });
  clientOnly.forEach(el => { el.hidden = isHost; });
}

if (hostParam) {
  applyRoleVisibility(false);
  initClient(hostParam);
} else {
  applyRoleVisibility(true);
  initHost();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE HÔTE
// ─────────────────────────────────────────────────────────────────────────────

async function initHost() {
  showOnly('screen-setup');

  // Formulaire de configuration
  renderSetupForm(hostConfig, (changes) => Object.assign(hostConfig, changes));

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
      await startHostSession(name);
    });
  }
}

async function startHostSession(hostName) {
  const peer = new QuizPeer();
  // Conteneur muable pour permettre l'échange d'engine (normal ↔ party)
  const ref = { engine: null };
  _currentRef = ref;

  showOnly('screen-lobby');
  setLoadingStatus('Connexion au serveur de signalisation…');

  peer.addEventListener('ready', (e) => {
    clientState.myId = '__host__';
    clientState.isHost = true;
    clientState.hostPeerId = e.detail.peerId;

    renderShareLink(e.detail.peerId);
    setLoadingStatus('');

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

  peer.addEventListener('player-join', (e) => {
    // Un client se connecte : il enverra MSG.JOIN
  });

  peer.addEventListener('player-leave', (e) => {
    if (ref.engine) ref.engine.removePlayer(e.detail.peerId);
  });

  peer.addEventListener('message', (e) => {
    if (ref.engine) ref.engine.handleMessage(e.detail.from, e.detail.data);
  });

  peer.addEventListener('error', (e) => {
    showToast('Erreur réseau : ' + e.detail.err?.message, 'error');
  });

  await peer.startHost();
}

async function startGame(ref, peer) {
  const btnStart = document.getElementById('btn-start-game');
  if (btnStart) {
    btnStart.disabled = true;
    btnStart.textContent = '⏳ Chargement des questions…';
  }

  showToast('Récupération des questions…', 'info');

  const isParty = hostConfig.mode === MODE.PARTY;
  const count = isParty ? PARTY_QUESTIONS_NEEDED : hostConfig.questionCount;

  let questions;
  try {
    questions = await fetchQuestions({
      count,
      categories: hostConfig.categories,
      difficulties: hostConfig.difficulties,
    });
  } catch (err) {
    showToast('Impossible de charger les questions', 'error');
    if (btnStart) { btnStart.disabled = false; btnStart.textContent = '▶️ Démarrer'; }
    return;
  }

  if (isParty) {
    // Lire les options party depuis le formulaire
    const partyOpts = readPartyOptions();
    Object.assign(hostConfig, partyOpts);

    // Prioriser les questions non encore posées, mémoriser les IDs utilisés
    questions = prioritizeUnasked(questions);
    saveAskedQuestions(questions.map(q => q.id).filter(Boolean));

    // Créer le PartyGameEngine et remplacer le moteur courant dans le ref
    const prevPlayers = ref.engine?.state?.players ?? [];
    const partyEngine = new PartyGameEngine(peer, (state) => {
      handlePartyHostStateChange(state, partyEngine, peer);
    });
    prevPlayers.forEach(p => partyEngine.addPlayer(p.id, p.name));
    ref.engine = partyEngine;

    clientState.showAnswerToHost = true;
    clientState.hostIsReader = false;
    partyEngine.startGame(questions, { ...hostConfig });
    return;
  }

  clientState.showAnswerToHost = hostConfig.showAnswerToHost;
  clientState.hostIsReader = hostConfig.hostIsReader;
  ref.engine.startGame(questions, { ...hostConfig });
}

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
      }
      {
        const dur = state.mode === MODE.QCM ? TIMER.QCM_DURATION
          : state.mode === MODE.SPEED ? TIMER.SPEED_ANSWER
          : (state.config.answerTime ?? 15) * 1000;
        startTimerBar(dur, 'timer-fill', 100, playTick);
      }
      {
        const data = buildRenderData(state, engine);
        if (state.mode === MODE.QCM && !clientState.hostIsReader) {
          data.onChoiceClick = (choice) => {
            engine.handleChoice('__host__', choice);
          };
          data.eliminatedPlayers = state.eliminatedPlayers;
        }
        renderGamePhase(state.phase, data, true);
      }
      if (clientState.hostIsReader) {
        // Mode hôte lecteur : boutons Correct / Incorrect pour juger à l'oral
        if (state.mode !== MODE.QCM) {
          setupHostJudgeButtons(engine);
        }
      } else if (state.mode !== MODE.QCM) {
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
      // Surligner les choix en QCM
      if (state.mode === MODE.QCM && q) {
        const wrong = state.lastResult?.correct === false ? state.lastResult?.answer : null;
        highlightChoices(q.correctAnswer, wrong);
      }
      break;

    case PHASE.QUESTION_END:
      showOnly('screen-game');
      renderScoreboard(state.players, clientState.hostIsReader);
      stopTimerBar();
      renderGamePhase(state.phase, buildRenderData(state, engine), true);
      setupNextButton(engine);
      setupSkipButton(engine);
      break;

    case PHASE.GAME_OVER: {
      let finalScores = state.finalScores ?? [...state.players].sort((a, b) => b.score - a.score);
      // En mode hôte lecteur, s'assurer que l'hôte n'apparaît pas (sécurité si finalScores vient du fallback)
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
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTY — changements d'état côté HÔTE
// ─────────────────────────────────────────────────────────────────────────────

function handlePartyHostStateChange(state, engine, peer) {
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
          rules:      PARTY_MINI_RULES[state.currentMini],
        },
        true, // isHost
        () => engine.hostStartMini()
      );
      break;

    case PARTY_PHASE.STREAK_QUESTION:
      hidePartyOverlay();
      renderPartyStreakQuestion(
        {
          text:          state.streakCurrentQuestion?.text ?? '',
          choices:       state.streakCurrentQuestion?.choices ?? [],
          index:         state.streakIndex,
          total:         state.streakQuestions.length,
          correctAnswer: state.streakCurrentQuestion?.correctAnswer,
        },
        true, null
      );
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
      renderPartyDuelQuestion(
        {
          questionText:     state.duelCurrentQuestion?.text ?? '',
          choices:          state.duelCurrentQuestion?.choices ?? [],
          correctAnswer:    state.duelCurrentQuestion?.correctAnswer,
          interrogateurId:  state.duelInterrogateur,
          interrogateurName: state.players.find(p => p.id === state.duelInterrogateur)?.name ?? '',
          duelIndex:  state.duelIndex,
          totalDuels: 5,
        },
        '__host__', true, null
      );
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
      }
      break;

    case PARTY_PHASE.TF_QUESTION:
      hidePartyOverlay();
      renderPartyTFQuestion(
        { statement: state.tfStatement, tfIndex: state.tfIndex, totalTF: state.tfQuestions.length,
          correctVote: state.tfCorrectVote },
        true, null, null, false
      );
      break;

    case PARTY_PHASE.TF_VOTING:
      renderPartyTFQuestion(
        { statement: state.tfStatement, tfIndex: state.tfIndex, totalTF: state.tfQuestions.length,
          correctVote: state.tfCorrectVote },
        true, null, null, true
      );
      startTimerBar(7000, 'timer-fill', 100, playTick);
      {
        const btnSkip = document.getElementById('btn-skip-question');
        if (btnSkip) btnSkip.onclick = () => engine.hostSkip();
      }
      break;

    case PARTY_PHASE.TF_REVEAL:
      stopTimerBar();
      if (state.tfResult) {
        renderPartyTFReveal(state.tfResult, state.players);
      }
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
        ?? [...state.players].filter(p => p.id !== '__host__').sort((a, b) => b.score - a.score);
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

function setupSkipButton(engine) {
  const btn = document.getElementById('btn-skip-question');
  if (btn) btn.onclick = () => engine.hostSkip();
}

function setupPlayAgainButton(ref, peer) {
  const btn = document.getElementById('btn-play-again');
  if (btn) {
    btn.onclick = () => {
      // Prévenir les clients du retour au lobby avant de changer d'écran
      peer.broadcast({ type: MSG.LOBBY_RESET });

      // Retourner à l'écran de configuration pour permettre de changer les critères,
      // tout en conservant le même peer ID (les clients gardent leur lien de connexion).
      showOnly('screen-setup');

      // Afficher le classement local mis à jour
      renderLeaderboard(loadLeaderboard(), 'leaderboard-setup-list', 'leaderboard-setup-card');

      // Pré-remplir le nom hôte
      const hostNameInput = document.getElementById('host-name');
      if (hostNameInput) hostNameInput.value = clientState.myName || '';

      // Re-render le formulaire de configuration avec les critères précédents
      renderSetupForm(hostConfig, (changes) => Object.assign(hostConfig, changes));

      // Re-binder le bouton "Héberger" pour réutiliser le peer existant
      const btnHost = document.getElementById('btn-start-host');
      if (btnHost) {
        btnHost.disabled = false;
        btnHost.textContent = '🔄 Relancer la partie';
        // Remplacer le listener précédent via onclick
        btnHost.onclick = () => {
          const nameInput = document.getElementById('host-name');
          const name = nameInput?.value?.trim() || clientState.myName || 'Hôte';
          try { localStorage.setItem(PLAYER_NAME_KEY, name); } catch (_) {}
          clientState.myName = name;

          // Récupérer les joueurs connectés depuis l'ancien moteur et remettre à zéro
          const prevPlayers = (ref.engine?.state?.players ?? []).map(p => ({
            id: p.id,
            name: p.id === '__host__' ? name : p.name,
          }));

          // Créer un nouveau moteur avec le peer existant
          const newEngine = new GameEngine(peer, (state) => {
            handleHostStateChange(state, newEngine, peer);
          });
          ref.engine = newEngine;

          // Ré-inscrire les joueurs (scores remis à 0, hôte marqué prêt)
          prevPlayers.forEach(p => newEngine.addPlayer(p.id, p.name));
          const hostPlayer = newEngine.state.players.find(p => p.id === '__host__');
          if (hostPlayer) hostPlayer.ready = true;

          showOnly('screen-lobby');
          renderLobbyPlayers(newEngine.state.players, true, (id) => {
            peer.kick(id);
            newEngine.removePlayer(id);
          });
          newEngine._broadcastPlayerList();

          // Bouton "Démarrer" — charge les questions au clic (comme le flux normal)
          const btnStart = document.getElementById('btn-start-game');
          if (btnStart) {
            btnStart.disabled = false;
            btnStart.textContent = '▶️ Démarrer la partie';
            delete btnStart.dataset.bound;
            btnStart.onclick = () => startGame(ref, peer);
          }
        };
      }
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE CLIENT
// ─────────────────────────────────────────────────────────────────────────────

async function initClient(hostPeerId) {
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
      if (local.currentQuestion) local.currentQuestion.correctAnswer = data.correctAnswer;
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
      break;

    case PARTY_MSG.PARTY_MINI_END:
      stopTimerBar();
      if (data.scores) { applyScores(data.scores); renderScoreboard(clientState.players, false); }
      renderPartyMiniEnd(data, clientState.players);
      // Cacher le streak board
      { const board = document.getElementById('streak-board'); if (board) board.hidden = true; }
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

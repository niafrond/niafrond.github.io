/**
 * main.js — Point d'entrée de l'application Quiz
 *
 * Routing :
 *   ?host=PEERID  → mode client (rejoindre)
 *   (rien)        → mode hôte (créer/configurer)
 */

import { QuizPeer } from './peer.js';
import { GameEngine } from './game.js';
import { fetchQuestions } from './questions.js';
import { MSG, PHASE, MODE, TIMER } from './constants.js';
import {
  showOnly, show, hide, renderSetupForm, renderShareLink,
  renderLobbyPlayers, renderScoreboard, renderGamePhase,
  renderFinalResults, startTimerBar, stopTimerBar,
  flashBuzz, showToast, setLoadingStatus, highlightChoices, disableChoice,
  showWrongPlayerNotification, renderLeaderboard, renderLobbyConfigPreview,
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

// ─── LocalStorage session ─────────────────────────────────────────────────────
const STORAGE_KEY = 'quiz_session';
const PLAYER_NAME_KEY = 'quiz_player_name';
const LEADERBOARD_KEY = 'quiz_leaderboard';

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
  let engine = null;

  showOnly('screen-lobby');
  setLoadingStatus('Connexion au serveur de signalisation…');

  peer.addEventListener('ready', (e) => {
    clientState.myId = '__host__';
    clientState.isHost = true;
    clientState.hostPeerId = e.detail.peerId;

    renderShareLink(e.detail.peerId);
    setLoadingStatus('');

    // Formulaire de configuration dans le lobby
    setupLobbyConfig(peer);

    // Créer le moteur de jeu
    engine = new GameEngine(peer, (state) => {
      handleHostStateChange(state, engine, peer);
    });

    // Ajouter l'hôte comme joueur
    engine.addPlayer('__host__', hostName);
    clientState.players = engine.state.players;
    renderLobbyPlayers(clientState.players, true, (id) => {
      peer.kick(id);
      engine.removePlayer(id);
    });

    // Bouton "Démarrer"
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart && !btnStart.dataset.bound) {
      btnStart.dataset.bound = '1';
      btnStart.addEventListener('click', () => startGame(engine, peer));
    }
  });

  peer.addEventListener('player-join', () => {
    // Diffuser la config actuelle à tous les joueurs connectés quand quelqu'un rejoint
    peer.broadcast({ type: MSG.LOBBY_CONFIG, config: { ...hostConfig } });
  });

  peer.addEventListener('player-leave', (e) => {
    if (engine) engine.removePlayer(e.detail.peerId);
  });

  peer.addEventListener('message', (e) => {
    if (engine) engine.handleMessage(e.detail.from, e.detail.data);
  });

  peer.addEventListener('error', (e) => {
    showToast('Erreur réseau : ' + e.detail.err?.message, 'error');
  });

  await peer.startHost();
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

async function startGame(engine, peer) {
  const btnStart = document.getElementById('btn-start-game');
  if (btnStart) {
    btnStart.disabled = true;
    btnStart.textContent = '⏳ Chargement des questions…';
  }

  showToast('Récupération des questions…', 'info');

  let questions;
  try {
    questions = await fetchQuestions({
      count: hostConfig.questionCount,
      categories: hostConfig.categories,
      difficulties: hostConfig.difficulties,
    });
  } catch (err) {
    showToast('Impossible de charger les questions', 'error');
    if (btnStart) { btnStart.disabled = false; btnStart.textContent = '▶️ Démarrer'; }
    return;
  }

  clientState.showAnswerToHost = hostConfig.showAnswerToHost;
  clientState.hostIsReader = hostConfig.hostIsReader;
  engine.startGame(questions, { ...hostConfig });
}

function handleHostStateChange(state, engine, peer) {
  // Snapshot avant mise à jour pour détecter les nouvelles éliminations QCM
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
      setupPlayAgainButton(engine, peer);
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

function setupPlayAgainButton(engine, peer) {
  const btn = document.getElementById('btn-play-again');
  if (btn) {
    btn.onclick = () => {
      // Prévenir les clients du retour au lobby
      peer.broadcast({ type: MSG.LOBBY_RESET });

      // Récupérer les joueurs connectés depuis l'ancien moteur
      const prevPlayers = engine.state.players.map(p => ({
        id: p.id,
        name: p.id === '__host__' ? clientState.myName || 'Hôte' : p.name,
      }));

      // Créer un nouveau moteur avec le peer existant
      const newEngine = new GameEngine(peer, (state) => {
        handleHostStateChange(state, newEngine, peer);
      });

      // Ré-inscrire les joueurs (scores remis à 0, hôte marqué prêt)
      prevPlayers.forEach(p => newEngine.addPlayer(p.id, p.name));
      const hostPlayer = newEngine.state.players.find(p => p.id === '__host__');
      if (hostPlayer) hostPlayer.ready = true;

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
        btnStart.onclick = () => startGame(newEngine, peer);
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
      clientState.phase = PHASE.LOBBY;
      local.currentQuestion = null;
      local.hasBuzzedWrong = false;
      local.selfEliminated = false;
      local.correctAnswer = null;
      local.buzzQueue = [];
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

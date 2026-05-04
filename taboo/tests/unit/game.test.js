/**
 * game.test.js — Tests unitaires pour taboo/game.js
 */

// ─── Mock Web Audio API (pas disponible dans jsdom) ──────────────────────────

function createAudioContextMock() {
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: () => Promise.resolve(),
    createOscillator: () => ({
      connect: () => {},
      type: 'sine',
      frequency: { setValueAtTime: () => {} },
      start: () => {},
      stop: () => {},
    }),
    createGain: () => ({
      connect: () => {},
      gain: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      },
    }),
  };
  return ctx;
}

beforeAll(() => {
  window.AudioContext = createAudioContextMock;
  window.webkitAudioContext = createAudioContextMock;
});

import { state, PHASES } from '../../state.js';
import {
  setupCards,
  initGame,
  setHostReady,
  handleClientReady,
  startTurn,
  onFound,
  onPass,
  onBuzz,
  nextTurn,
  resetGame,
  handleClientMessage,
} from '../../game.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCards(n = 10) {
  return Array.from({ length: n }, (_, i) => ({
    word: `mot${i}`,
    taboo: [`interdit${i}a`, `interdit${i}b`],
  }));
}

function resetState() {
  state.phase          = PHASES.LOBBY;
  state.teams          = [{ name: 'Rouge', score: 0 }, { name: 'Bleu', score: 0 }];
  state.currentTeamIdx = 0;
  state.currentRound   = 1;
  state.totalRounds    = 3;
  state.timerDuration  = 60;
  state.timeLeft       = 60;
  state.currentCard    = null;
  state.turnStats      = { found: 0, passed: 0, buzzed: 0 };
  state.hostReady      = false;
  state.clientReady    = false;
  state.cards          = [];
  state.cardIdx        = 0;
}

// Peer et callbacks no-op pour les tests
const noPeer = null;
let stateChanges = [];
let ticks = [];

function initNoTimer() {
  stateChanges = [];
  ticks = [];
  initGame(
    noPeer,
    (snap) => stateChanges.push(snap),
    (t)    => ticks.push(t),
  );
}

// ─── setupCards ───────────────────────────────────────────────────────────────

describe('setupCards', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
  });

  test('mélange et remplit state.cards', () => {
    const cards = makeCards(5);
    setupCards(cards);
    expect(state.cards.length).toBe(5);
    expect(state.cardIdx).toBe(0);
  });

  test('ne modifie pas le tableau source', () => {
    const cards = makeCards(5);
    const firstWordBefore = cards[0].word;
    setupCards(cards);
    expect(cards[0].word).toBe(firstWordBefore);
  });

  test('les cartes sont les mêmes (ensemble)', () => {
    const cards = makeCards(8);
    setupCards(cards);
    const resultWords = state.cards.map(c => c.word);
    const srcWords    = cards.map(c => c.word);
    expect(new Set(resultWords)).toEqual(new Set(srcWords));
  });
});

// ─── startTurn ────────────────────────────────────────────────────────────────

describe('startTurn', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
    setupCards(makeCards(10));
    // Simuler que les deux joueurs sont prêts
    state.hostReady   = true;
    state.clientReady = true;
  });

  afterEach(() => {
    // stopper le timer interne si démarré (fuite dans l'env test)
    // On reset manuellement pour éviter les effets de bord
    resetState();
  });

  test('passe la phase à TURN', () => {
    startTurn();
    expect(state.phase).toBe(PHASES.TURN);
  });

  test('réinitialise turnStats', () => {
    state.turnStats = { found: 3, passed: 2, buzzed: 1 };
    startTurn();
    expect(state.turnStats).toEqual({ found: 0, passed: 0, buzzed: 0 });
  });

  test('remet le timer à timerDuration', () => {
    state.timerDuration = 45;
    startTurn();
    expect(state.timeLeft).toBe(45);
  });

  test('charge la première carte', () => {
    startTurn();
    expect(state.currentCard).not.toBeNull();
    expect(typeof state.currentCard.word).toBe('string');
  });

  test('appelle onStateChange', () => {
    startTurn();
    expect(stateChanges.length).toBeGreaterThan(0);
  });
});

// ─── onFound ──────────────────────────────────────────────────────────────────

describe('onFound', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
    setupCards(makeCards(10));
    state.phase = PHASES.TURN;
  });

  test('+1 point à l\'équipe courante', () => {
    state.currentTeamIdx = 0;
    onFound();
    expect(state.teams[0].score).toBe(1);
    expect(state.teams[1].score).toBe(0);
  });

  test('incrémente turnStats.found', () => {
    onFound();
    expect(state.turnStats.found).toBe(1);
  });

  test('avance la carte (cardIdx)', () => {
    const before = state.cardIdx;
    onFound();
    // cardIdx a avancé d'au moins 1 (ou 2 si startTurn a pris la première)
    expect(state.cardIdx).toBeGreaterThan(before);
  });

  test('ne fait rien si la phase n\'est pas TURN', () => {
    state.phase = PHASES.PRE_TURN;
    onFound();
    expect(state.teams[0].score).toBe(0);
    expect(state.turnStats.found).toBe(0);
  });

  test('score cumulatif sur appels multiples', () => {
    onFound();
    onFound();
    onFound();
    expect(state.teams[state.currentTeamIdx].score).toBe(3);
    expect(state.turnStats.found).toBe(3);
  });
});

// ─── onPass ──────────────────────────────────────────────────────────────────

describe('onPass', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
    setupCards(makeCards(10));
    state.phase = PHASES.TURN;
  });

  test('n\'accorde aucun point', () => {
    onPass();
    expect(state.teams[0].score).toBe(0);
    expect(state.teams[1].score).toBe(0);
  });

  test('incrémente turnStats.passed', () => {
    onPass();
    expect(state.turnStats.passed).toBe(1);
  });

  test('avance la carte', () => {
    const before = state.cardIdx;
    onPass();
    expect(state.cardIdx).toBeGreaterThan(before);
  });

  test('ne fait rien hors de la phase TURN', () => {
    state.phase = PHASES.TURN_END;
    onPass();
    expect(state.turnStats.passed).toBe(0);
  });
});

// ─── onBuzz ──────────────────────────────────────────────────────────────────

describe('onBuzz', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
    setupCards(makeCards(10));
    state.phase = PHASES.TURN;
  });

  test('+1 point à l\'équipe adverse', () => {
    state.currentTeamIdx = 0;
    onBuzz();
    expect(state.teams[0].score).toBe(0);
    expect(state.teams[1].score).toBe(1);
  });

  test('+1 à l\'équipe 0 quand l\'équipe 1 joue', () => {
    state.currentTeamIdx = 1;
    onBuzz();
    expect(state.teams[0].score).toBe(1);
    expect(state.teams[1].score).toBe(0);
  });

  test('incrémente turnStats.buzzed', () => {
    onBuzz();
    expect(state.turnStats.buzzed).toBe(1);
  });

  test('ne fait rien hors de la phase TURN', () => {
    state.phase = PHASES.LOBBY;
    onBuzz();
    expect(state.teams[1].score).toBe(0);
  });
});

// ─── nextTurn ─────────────────────────────────────────────────────────────────

describe('nextTurn', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
    setupCards(makeCards(10));
    state.phase        = PHASES.TURN_END;
    state.totalRounds  = 3;
    state.currentRound = 1;
    state.currentTeamIdx = 0;
  });

  test('après tour équipe 0 → passe à l\'équipe 1, même manche', () => {
    state.currentTeamIdx = 0;
    nextTurn();
    expect(state.currentTeamIdx).toBe(1);
    expect(state.currentRound).toBe(1);
    expect(state.phase).toBe(PHASES.PRE_TURN);
  });

  test('après tour équipe 1 → passe à l\'équipe 0, manche +1', () => {
    state.currentTeamIdx = 1;
    nextTurn();
    expect(state.currentTeamIdx).toBe(0);
    expect(state.currentRound).toBe(2);
    expect(state.phase).toBe(PHASES.PRE_TURN);
  });

  test('réinitialise hostReady et clientReady', () => {
    state.hostReady   = true;
    state.clientReady = true;
    nextTurn();
    expect(state.hostReady).toBe(false);
    expect(state.clientReady).toBe(false);
  });

  test('passe en GAME_OVER quand totalRounds dépassé', () => {
    state.currentTeamIdx = 1;
    state.currentRound   = 3; // dernier tour → après l'équipe 1 → round 4 > totalRounds 3
    nextTurn();
    expect(state.phase).toBe(PHASES.GAME_OVER);
    expect(state.currentCard).toBeNull();
  });
});

// ─── setHostReady / handleClientReady ────────────────────────────────────────

describe('setHostReady / handleClientReady', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
    setupCards(makeCards(10));
    state.phase       = PHASES.PRE_TURN;
    state.hostReady   = false;
    state.clientReady = false;
  });

  test('setHostReady seul → sync mais pas de démarrage', () => {
    setHostReady();
    expect(state.hostReady).toBe(true);
    expect(state.phase).toBe(PHASES.PRE_TURN); // pas encore TURN
  });

  test('handleClientReady seul → sync mais pas de démarrage', () => {
    handleClientReady();
    expect(state.clientReady).toBe(true);
    expect(state.phase).toBe(PHASES.PRE_TURN);
  });

  test('les deux prêts → démarre le tour', () => {
    setHostReady();
    handleClientReady();
    expect(state.phase).toBe(PHASES.TURN);
  });

  test('ordre inverse : client puis host → démarre le tour', () => {
    handleClientReady();
    setHostReady();
    expect(state.phase).toBe(PHASES.TURN);
  });
});

// ─── resetGame ───────────────────────────────────────────────────────────────

describe('resetGame', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
    setupCards(makeCards(10));
    // Simuler une partie jouée
    state.teams[0].score = 5;
    state.teams[1].score = 3;
    state.currentRound   = 4;
    state.currentTeamIdx = 1;
    state.phase          = PHASES.GAME_OVER;
  });

  test('remet tous les scores à 0', () => {
    resetGame();
    expect(state.teams[0].score).toBe(0);
    expect(state.teams[1].score).toBe(0);
  });

  test('revient à la manche 1, équipe 0', () => {
    resetGame();
    expect(state.currentRound).toBe(1);
    expect(state.currentTeamIdx).toBe(0);
  });

  test('repasse en phase PRE_TURN', () => {
    resetGame();
    expect(state.phase).toBe(PHASES.PRE_TURN);
  });

  test('efface la carte courante', () => {
    state.currentCard = { word: 'test', taboo: [] };
    resetGame();
    expect(state.currentCard).toBeNull();
  });
});

// ─── handleClientMessage ─────────────────────────────────────────────────────

describe('handleClientMessage', () => {
  beforeEach(() => {
    resetState();
    initNoTimer();
    setupCards(makeCards(10));
    state.phase = PHASES.TURN;
    state.currentTeamIdx = 0;
  });

  test('MSG.FOUND déclenche onFound', () => {
    handleClientMessage({ type: 'FOUND' });
    expect(state.teams[0].score).toBe(1);
  });

  test('MSG.PASS déclenche onPass', () => {
    handleClientMessage({ type: 'PASS' });
    expect(state.turnStats.passed).toBe(1);
  });

  test('MSG.BUZZ déclenche onBuzz', () => {
    handleClientMessage({ type: 'BUZZ' });
    expect(state.teams[1].score).toBe(1);
  });

  test('MSG inconnu est ignoré silencieusement', () => {
    expect(() => handleClientMessage({ type: 'UNKNOWN' })).not.toThrow();
  });
});

// ─── Reshuffle quand le deck est épuisé ──────────────────────────────────────

describe('reshuffle automatique du deck', () => {
  test('reprend depuis le début quand toutes les cartes ont été jouées', () => {
    resetState();
    initNoTimer();
    const cards = makeCards(3);
    setupCards(cards);
    state.phase = PHASES.TURN;

    // Jouer 3 cartes (épuise le deck)
    onFound();
    onFound();
    onFound();

    // La prochaine action doit réussir sans erreur (reshuffle)
    expect(() => onFound()).not.toThrow();
    expect(state.cards.length).toBe(3);
  });
});

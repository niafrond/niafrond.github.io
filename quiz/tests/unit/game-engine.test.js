/**
 * game-engine.test.js — Tests unitaires du moteur de jeu (GameEngine)
 *
 * On utilise un faux peer (mock) et jest.useFakeTimers() pour contrôler
 * les transitions de phase sans attendre les vrais délais.
 */

import { jest } from '@jest/globals';
import { GameEngine } from '../../game.js';
import { PHASE, MODE, SCORE, TIMER } from '../../constants.js';

// ─── Mock peer ────────────────────────────────────────────────────────────────

function makePeer() {
  return {
    broadcast: jest.fn(),
    sendTo: jest.fn(),
    kick: jest.fn(),
  };
}

// ─── Questions de test ────────────────────────────────────────────────────────

const Q1 = {
  id: 'test-q1',
  text: 'Quelle est la capitale de la France ?',
  correctAnswer: 'Paris',
  choices: ['Paris', 'Lyon', 'Marseille', 'Bordeaux'],
  category: 'geography',
  difficulty: 'easy',
};

const Q2 = {
  id: 'test-q2',
  text: 'Quelle est la capitale de l\'Allemagne ?',
  correctAnswer: 'Berlin',
  choices: ['Berlin', 'Munich', 'Hambourg', 'Francfort'],
  category: 'geography',
  difficulty: 'easy',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEngine() {
  const peer = makePeer();
  const onChange = jest.fn();
  const engine = new GameEngine(peer, onChange);
  return { engine, peer, onChange };
}

function addPlayers(engine, ...names) {
  names.forEach((name, i) => engine.addPlayer(`player${i + 1}`, name));
}

// ─── Gestion des joueurs ──────────────────────────────────────────────────────

describe('Gestion des joueurs', () => {
  test('addPlayer ajoute un joueur avec score 0', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    expect(engine.state.players).toHaveLength(1);
    expect(engine.state.players[0]).toMatchObject({ id: 'p1', name: 'Alice', score: 0 });
  });

  test('addPlayer met à jour le nom si le joueur existe déjà', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p1', 'Alice2');
    expect(engine.state.players).toHaveLength(1);
    expect(engine.state.players[0].name).toBe('Alice2');
  });

  test('addPlayer supprime le doublon par nom lors d\'une reconnexion avec un nouveau peer ID', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    // Alice se reconnecte avec un nouveau peer ID
    engine.addPlayer('p1-new', 'Alice');
    expect(engine.state.players).toHaveLength(2);
    expect(engine.state.players.find(p => p.id === 'p1')).toBeUndefined();
    expect(engine.state.players.find(p => p.id === 'p1-new')).toBeDefined();
    expect(engine.state.players.find(p => p.id === 'p1-new').name).toBe('Alice');
  });

  test('removePlayer supprime le joueur', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.removePlayer('p1');
    expect(engine.state.players).toHaveLength(1);
    expect(engine.state.players[0].id).toBe('p2');
  });

  test('markReady marque le joueur comme prêt', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    expect(engine.state.players[0].ready).toBe(false);
    engine.markReady('p1');
    expect(engine.state.players[0].ready).toBe(true);
  });

  test('broadcast envoyé après addPlayer', () => {
    const { engine, peer } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    expect(peer.broadcast).toHaveBeenCalled();
  });
});

// ─── Démarrage de la partie ───────────────────────────────────────────────────

describe('startGame', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('reset les scores et passe en QUESTION_PREVIEW', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.state.players[0].score = 50; // score initial fictif
    engine.startGame([Q1], { mode: MODE.CLASSIC });
    expect(engine.state.players[0].score).toBe(0);
    expect(engine.state.phase).toBe(PHASE.QUESTION_PREVIEW);
  });

  test('broadcast GAME_START', () => {
    const { engine, peer } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1]);
    const calls = peer.broadcast.mock.calls.map(c => c[0].type);
    expect(calls).toContain('GAME_START');
    expect(calls).toContain('SHOW_QUESTION');
  });

  test('passe en BUZZING après QUESTION_PREVIEW (mode CLASSIC)', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    expect(engine.state.phase).toBe(PHASE.BUZZING);
  });
});

// ─── Mode CLASSIC : buzz → réponse correcte ───────────────────────────────────

describe('Mode CLASSIC — réponse correcte', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('handleBuzz depuis BUZZING passe en ANSWERING', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);

    engine.handleBuzz('p1');
    expect(engine.state.phase).toBe(PHASE.ANSWERING);
    expect(engine.state.buzzQueue[0]).toBe('p1');
  });

  test('handleAnswer correcte ajoute des points et passe en ANSWER_RESULT', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');

    engine.handleAnswer('p1', 'Paris');
    expect(engine.state.players[0].score).toBeGreaterThan(0);
    expect(engine.state.phase).toBe(PHASE.ANSWER_RESULT);
  });

  test('handleAnswer tolère une faute d\'orthographe', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');

    engine.handleAnswer('p1', 'Paaris'); // 1 lettre en trop
    expect(engine.state.players[0].score).toBeGreaterThan(0);
  });

  test('handleAnswer incorrecte n\'ajoute pas de points (sans malus)', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC, applyMalus: false });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');

    engine.handleAnswer('p1', 'Londres');
    expect(engine.state.players[0].score).toBe(0);
  });

  test('handleAnswer incorrecte applique un malus si activé', () => {
    const { engine } = makeEngine();
    engine.autoAdvance = true; // passage automatique à la question suivante
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('__host__', 'Hôte');
    engine.startGame([Q1, Q2], { mode: MODE.CLASSIC, applyMalus: true });

    // Q1 : bonne réponse → gagne des points
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'Paris');
    const scoreAfterQ1 = engine.state.players.find(p => p.id === 'p1').score;
    expect(scoreAfterQ1).toBeGreaterThan(0);

    // Avancer jusqu'au début de la Q2 (RESULT_DISPLAY + auto-next delay + preview)
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + TIMER.QUESTION_END_DELAY + TIMER.QUESTION_PREVIEW + 100);

    // Q2 : mauvaise réponse → pénalité
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'MauvaiseFausse');
    const scoreAfterWrong = engine.state.players.find(p => p.id === 'p1').score;
    expect(scoreAfterWrong).toBeLessThan(scoreAfterQ1);
  });
});

// ─── Mode QCM ─────────────────────────────────────────────────────────────────

describe('Mode QCM', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('passe directement en ANSWERING après QUESTION_PREVIEW', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    expect(engine.state.phase).toBe(PHASE.ANSWERING);
  });

  test('handleChoice correcte donne des points', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);

    engine.handleChoice('p1', 'Paris');
    expect(engine.state.players[0].score).toBeGreaterThan(0);
  });

  test('handleChoice incorrecte élimine le joueur', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame([Q1], { mode: MODE.QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);

    engine.handleChoice('p1', 'Lyon'); // mauvaise réponse
    expect(engine.state.eliminatedPlayers).toContain('p1');
  });

  test('handleBuzz est ignoré en mode QCM', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);

    engine.handleBuzz('p1');
    // En mode QCM on est déjà en ANSWERING, le buzz ne change pas la file
    expect(engine.state.buzzQueue).toHaveLength(0);
  });
});

// ─── Mode BUZZ_QCM ────────────────────────────────────────────────────────────

describe('Mode BUZZ_QCM', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('passe en BUZZING après QUESTION_PREVIEW', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.BUZZ_QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    expect(engine.state.phase).toBe(PHASE.BUZZING);
  });

  test('handleBuzz en BUZZING passe en ANSWERING et envoie les choix en privé', () => {
    const { engine, peer } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.BUZZ_QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);

    engine.handleBuzz('p1');
    expect(engine.state.phase).toBe(PHASE.ANSWERING);
    expect(engine.state.buzzQcmCurrentBuzzer).toBe('p1');
    // Les choix sont envoyés en privé au joueur buzzeur
    const sendToCalls = peer.sendTo.mock.calls;
    expect(sendToCalls.some(c => c[0] === 'p1' && c[1].type === 'SHOW_CHOICES')).toBe(true);
  });

  test('handleChoice correcte donne des points et passe en QUESTION_END', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.BUZZ_QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');

    engine.handleChoice('p1', 'Paris');
    expect(engine.state.players[0].score).toBeGreaterThan(0);
    expect(engine.state.phase).toBe(PHASE.ANSWER_RESULT);

    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + 100);
    expect(engine.state.phase).toBe(PHASE.QUESTION_END);
  });

  test('handleChoice incorrecte sans malus ajoute le joueur aux wrongAnswers et reprend le buzz', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame([Q1], { mode: MODE.BUZZ_QCM, applyMalus: false });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');

    engine.handleChoice('p1', 'Lyon'); // mauvaise réponse
    expect(engine.state.phase).toBe(PHASE.ANSWER_RESULT);
    expect(engine.state.wrongAnswers).toContain('p1');
    expect(engine.state.players[0].score).toBe(0); // pas de malus

    // Après RESULT_DISPLAY, reprendre le buzz
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + 100);
    expect(engine.state.phase).toBe(PHASE.BUZZING);
  });

  test('handleChoice incorrecte avec malus déduit des points', () => {
    const { engine } = makeEngine();
    engine.autoAdvance = true;
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame([Q1, Q2], { mode: MODE.BUZZ_QCM, applyMalus: true });

    // Q1 : bonne réponse → score positif
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    engine.handleChoice('p1', 'Paris');
    const scoreAfterQ1 = engine.state.players.find(p => p.id === 'p1').score;
    expect(scoreAfterQ1).toBeGreaterThan(0);

    // Avancer à Q2
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + TIMER.QUESTION_END_DELAY + TIMER.QUESTION_PREVIEW + 100);

    // Q2 : mauvaise réponse → malus
    engine.handleBuzz('p1');
    engine.handleChoice('p1', 'Munich'); // mauvaise réponse
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + 100);

    const scoreAfterWrong = engine.state.players.find(p => p.id === 'p1').score;
    expect(scoreAfterWrong).toBeLessThan(scoreAfterQ1);
  });

  test('timeout : le buzzeur est ajouté aux wrongAnswers et le buzz reprend', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startGame([Q1], { mode: MODE.BUZZ_QCM, answerTime: 15 });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    expect(engine.state.phase).toBe(PHASE.ANSWERING);

    // Laisser le timer expirer
    jest.advanceTimersByTime(15000 + 100);
    expect(engine.state.wrongAnswers).toContain('p1');
    // Après RESULT_DISPLAY, reprendre le buzz
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + 100);
    expect(engine.state.phase).toBe(PHASE.BUZZING);
  });

  test('tous les joueurs répondent faux → question skippée', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.BUZZ_QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');

    engine.handleChoice('p1', 'Lyon'); // mauvaise réponse, seul joueur
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + 100);
    // Pas assez de temps de buzz restant ou plus de joueurs éligibles → skip
    expect(engine.state.phase).toBe(PHASE.QUESTION_END);
  });

  test('handleAnswer est ignoré en mode BUZZ_QCM', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.BUZZ_QCM });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    expect(engine.state.phase).toBe(PHASE.ANSWERING);

    engine.handleAnswer('p1', 'Paris'); // doit être ignoré
    expect(engine.state.phase).toBe(PHASE.ANSWERING);
    expect(engine.state.players[0].score).toBe(0);
  });

  test('buzzQcmCurrentBuzzer réinitialisé à chaque nouvelle question', () => {
    const { engine } = makeEngine();
    engine.autoAdvance = true;
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1, Q2], { mode: MODE.BUZZ_QCM });

    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    expect(engine.state.buzzQcmCurrentBuzzer).toBe('p1');

    engine.handleChoice('p1', 'Paris'); // correct
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + TIMER.QUESTION_END_DELAY + 100);
    // Nouvelle question : buzzQcmCurrentBuzzer doit être null
    expect(engine.state.buzzQcmCurrentBuzzer).toBeNull();
  });
});

describe('Fin de partie', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('passe en GAME_OVER après la dernière question', () => {
    const { engine } = makeEngine();
    engine.autoAdvance = true;
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'Paris'); // correct

    // ANSWER_RESULT → QUESTION_END → auto-next → GAME_OVER
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + TIMER.QUESTION_END_DELAY + 500);
    expect(engine.state.phase).toBe(PHASE.GAME_OVER);
  });

  test('broadcast GAME_OVER avec les scores finaux', () => {
    const { engine, peer } = makeEngine();
    engine.autoAdvance = true;
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'Paris');
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + TIMER.QUESTION_END_DELAY + 500);

    const types = peer.broadcast.mock.calls.map(c => c[0].type);
    expect(types).toContain('GAME_OVER');
  });

  test('hostNext() force la transition depuis QUESTION_END', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'Paris');
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + 100); // → QUESTION_END

    expect(engine.state.phase).toBe(PHASE.QUESTION_END);
    engine.hostNext(); // → GAME_OVER (une seule question)
    expect(engine.state.phase).toBe(PHASE.GAME_OVER);
  });
});

// ─── Combo streak ─────────────────────────────────────────────────────────────

describe('Combo streak', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('la streak augmente sur les bonnes réponses consécutives', () => {
    const { engine } = makeEngine();
    engine.autoAdvance = true;
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1, Q2], { mode: MODE.CLASSIC, comboStreak: true });

    // Q1 correct
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'Paris');
    expect(engine.state.players[0].streak).toBe(1);

    // Avancer jusqu'à Q2 BUZZING
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + TIMER.QUESTION_END_DELAY + TIMER.QUESTION_PREVIEW + 100);

    // Q2 correct
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'Berlin');
    expect(engine.state.players[0].streak).toBe(2);
  });

  test('la streak se remet à 0 sur une mauvaise réponse', () => {
    const { engine } = makeEngine();
    engine.autoAdvance = true;
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1, Q2], { mode: MODE.CLASSIC, comboStreak: true });

    // Q1 correct → streak = 1
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'Paris');

    // Avancer jusqu'à Q2 BUZZING
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + TIMER.QUESTION_END_DELAY + TIMER.QUESTION_PREVIEW + 100);

    // Q2 mauvaise réponse → streak = 0
    engine.handleBuzz('p1');
    engine.handleAnswer('p1', 'MauvaiseRéponse');
    expect(engine.state.players[0].streak).toBe(0);
  });
});

// ─── Mode Animateur : hostDirectAward ─────────────────────────────────────────

describe('hostDirectAward (mode animateur)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('en phase BUZZING, attribue SCORE.CORRECT points au joueur désigné', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC, hostIsAnimateur: true });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);
    expect(engine.state.phase).toBe(PHASE.BUZZING);

    engine.hostDirectAward('p1');
    expect(engine.state.players[0].score).toBe(SCORE.CORRECT);
    expect(engine.state.phase).toBe(PHASE.ANSWER_RESULT);
  });

  test('passe en QUESTION_END après ANSWER_RESULT', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC, hostIsAnimateur: true });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);

    engine.hostDirectAward('p1');
    jest.advanceTimersByTime(TIMER.RESULT_DISPLAY + 100);
    expect(engine.state.phase).toBe(PHASE.QUESTION_END);
  });

  test('est ignoré si la phase n\'est pas BUZZING', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC, hostIsAnimateur: true });
    // En phase QUESTION_PREVIEW
    expect(engine.state.phase).toBe(PHASE.QUESTION_PREVIEW);

    engine.hostDirectAward('p1');
    expect(engine.state.players[0].score).toBe(0);
    expect(engine.state.phase).toBe(PHASE.QUESTION_PREVIEW);
  });

  test('est ignoré si l\'ID de joueur est invalide', () => {
    const { engine } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC, hostIsAnimateur: true });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);

    engine.hostDirectAward('unknown-player');
    // Doit rester en BUZZING
    expect(engine.state.phase).toBe(PHASE.BUZZING);
    expect(engine.state.players[0].score).toBe(0);
  });

  test('le résultat diffusé contient correct=true et le bon playerId', () => {
    const { engine, peer } = makeEngine();
    engine.addPlayer('p1', 'Alice');
    engine.startGame([Q1], { mode: MODE.CLASSIC, hostIsAnimateur: true });
    jest.advanceTimersByTime(TIMER.QUESTION_PREVIEW + 100);

    engine.hostDirectAward('p1');
    const answerResultCall = peer.broadcast.mock.calls.find(c => c[0].type === 'ANSWER_RESULT');
    expect(answerResultCall).toBeDefined();
    expect(answerResultCall[0].correct).toBe(true);
    expect(answerResultCall[0].playerId).toBe('p1');
    expect(answerResultCall[0].points).toBe(SCORE.CORRECT);
  });
});

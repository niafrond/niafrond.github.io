/**
 * joker.test.js — Tests unitaires pour blind-test/joker.js
 */

import { JOKER, SCORE } from '../../constants.js';
import {
  initialJokers,
  canUseJoker,
  applyJoker,
  computeCorrectScore,
  computeWrongScore,
} from '../../joker.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(id, overrides = {}) {
  return {
    id,
    name: `Player${id}`,
    score: 0,
    jokers: initialJokers(),
    blockedUntilRound: -1,
    doubleActive: false,
    ...overrides,
  };
}

function makeState(players) {
  return { players, currentRound: 5 };
}

// ─── initialJokers ───────────────────────────────────────────────────────────

describe('initialJokers', () => {
  test('retourne 1 de chaque joker', () => {
    const j = initialJokers();
    expect(j[JOKER.STEAL]).toBe(1);
    expect(j[JOKER.DOUBLE]).toBe(1);
    expect(j[JOKER.BLOCK]).toBe(1);
  });
});

// ─── canUseJoker ─────────────────────────────────────────────────────────────

describe('canUseJoker', () => {
  test('retourne true si stock > 0 et non bloqué', () => {
    const p = makePlayer('p1');
    expect(canUseJoker(p, JOKER.STEAL, 5)).toBe(true);
  });

  test('retourne false si stock = 0', () => {
    const p = makePlayer('p1');
    p.jokers[JOKER.STEAL] = 0;
    expect(canUseJoker(p, JOKER.STEAL, 5)).toBe(false);
  });

  test('retourne false si le joueur est bloqué ce round', () => {
    const p = makePlayer('p1', { blockedUntilRound: 6 });
    expect(canUseJoker(p, JOKER.STEAL, 5)).toBe(false);
  });

  test('retourne true si le blocage est expiré', () => {
    const p = makePlayer('p1', { blockedUntilRound: 4 });
    expect(canUseJoker(p, JOKER.STEAL, 5)).toBe(true);
  });
});

// ─── applyJoker — STEAL ──────────────────────────────────────────────────────

describe('applyJoker STEAL', () => {
  test('transfère STEAL_AMOUNT pts de la cible vers le lanceur', () => {
    const from   = makePlayer('from', { score: 10 });
    const target = makePlayer('target', { score: 20 });
    const state  = makeState([from, target]);
    const result = applyJoker(state, 'from', JOKER.STEAL, 'target');
    expect(result.valid).toBe(true);
    expect(from.score).toBe(10 + SCORE.STEAL_AMOUNT);
    expect(target.score).toBe(20 - SCORE.STEAL_AMOUNT);
  });

  test('décrémente le stock STEAL du lanceur', () => {
    const from   = makePlayer('from', { score: 0 });
    const target = makePlayer('target', { score: 10 });
    const state  = makeState([from, target]);
    applyJoker(state, 'from', JOKER.STEAL, 'target');
    expect(from.jokers[JOKER.STEAL]).toBe(0);
  });

  test('ne descend pas en dessous de 0 pour la cible', () => {
    const from   = makePlayer('from', { score: 0 });
    const target = makePlayer('target', { score: 2 });
    const state  = makeState([from, target]);
    applyJoker(state, 'from', JOKER.STEAL, 'target');
    expect(target.score).toBe(0);
  });

  test('sans effet si la cible est bloquée', () => {
    const from   = makePlayer('from', { score: 0 });
    const target = makePlayer('target', { score: 20, blockedUntilRound: 6 });
    const state  = makeState([from, target]);
    applyJoker(state, 'from', JOKER.STEAL, 'target');
    expect(from.score).toBe(0);    // pas de gain
    expect(target.score).toBe(20); // pas de perte
  });

  test('retourne invalid si cible manquante', () => {
    const from  = makePlayer('from');
    const state = makeState([from]);
    const result = applyJoker(state, 'from', JOKER.STEAL, null);
    expect(result.valid).toBe(false);
  });

  test('retourne invalid si plus de stock', () => {
    const from   = makePlayer('from', { jokers: { [JOKER.STEAL]: 0, [JOKER.DOUBLE]: 1, [JOKER.BLOCK]: 1 } });
    const target = makePlayer('target');
    const state  = makeState([from, target]);
    const result = applyJoker(state, 'from', JOKER.STEAL, 'target');
    expect(result.valid).toBe(false);
  });
});

// ─── applyJoker — DOUBLE ─────────────────────────────────────────────────────

describe('applyJoker DOUBLE', () => {
  test('active doubleActive sur le lanceur', () => {
    const from  = makePlayer('from');
    const state = makeState([from]);
    const result = applyJoker(state, 'from', JOKER.DOUBLE, null);
    expect(result.valid).toBe(true);
    expect(from.doubleActive).toBe(true);
  });

  test('décrémente le stock DOUBLE', () => {
    const from  = makePlayer('from');
    const state = makeState([from]);
    applyJoker(state, 'from', JOKER.DOUBLE, null);
    expect(from.jokers[JOKER.DOUBLE]).toBe(0);
  });
});

// ─── applyJoker — BLOCK ──────────────────────────────────────────────────────

describe('applyJoker BLOCK', () => {
  test('bloque la cible jusqu\'au round suivant', () => {
    const from   = makePlayer('from');
    const target = makePlayer('target');
    const state  = makeState([from, target]);
    applyJoker(state, 'from', JOKER.BLOCK, 'target');
    expect(target.blockedUntilRound).toBe(6); // currentRound(5) + 1
  });

  test('décrémente le stock BLOCK', () => {
    const from   = makePlayer('from');
    const target = makePlayer('target');
    const state  = makeState([from, target]);
    applyJoker(state, 'from', JOKER.BLOCK, 'target');
    expect(from.jokers[JOKER.BLOCK]).toBe(0);
  });

  test('retourne invalid si cible manquante', () => {
    const from  = makePlayer('from');
    const state = makeState([from]);
    const result = applyJoker(state, 'from', JOKER.BLOCK, null);
    expect(result.valid).toBe(false);
  });
});

// ─── applyJoker — cas limite ─────────────────────────────────────────────────

describe('applyJoker — cas limite', () => {
  test('joueur introuvable → invalid', () => {
    const state  = makeState([makePlayer('other')]);
    const result = applyJoker(state, 'unknown', JOKER.DOUBLE, null);
    expect(result.valid).toBe(false);
  });

  test('type inconnu → invalid', () => {
    const from  = makePlayer('from');
    const state = makeState([from]);
    const result = applyJoker(state, 'from', 'UNKNOWN_TYPE', null);
    expect(result.valid).toBe(false);
  });
});

// ─── computeCorrectScore ─────────────────────────────────────────────────────

describe('computeCorrectScore', () => {
  test('retourne le score de base', () => {
    const p = makePlayer('p', { doubleActive: false, blockedUntilRound: -1 });
    expect(computeCorrectScore(p, 10, 5)).toBe(10);
  });

  test('double le score si doubleActive', () => {
    const p = makePlayer('p', { doubleActive: true, blockedUntilRound: -1 });
    expect(computeCorrectScore(p, 10, 5)).toBe(20);
  });

  test('désactive doubleActive après utilisation', () => {
    const p = makePlayer('p', { doubleActive: true, blockedUntilRound: -1 });
    computeCorrectScore(p, 10, 5);
    expect(p.doubleActive).toBe(false);
  });

  test('retourne 0 si le joueur est bloqué', () => {
    const p = makePlayer('p', { doubleActive: false, blockedUntilRound: 6 });
    expect(computeCorrectScore(p, 10, 5)).toBe(0);
  });

  test('ne consomme pas le double si bloqué', () => {
    const p = makePlayer('p', { doubleActive: true, blockedUntilRound: 6 });
    computeCorrectScore(p, 10, 5);
    // doubleActive doit rester true (pas consommé quand bloqué)
    expect(p.doubleActive).toBe(true);
  });
});

// ─── computeWrongScore ───────────────────────────────────────────────────────

describe('computeWrongScore', () => {
  test('retourne le malus (valeur négative)', () => {
    const p = makePlayer('p');
    expect(computeWrongScore(p, SCORE.WRONG_MALUS, 5)).toBe(SCORE.WRONG_MALUS);
  });

  test('retourne 0 si le joueur est bloqué', () => {
    const p = makePlayer('p', { blockedUntilRound: 6 });
    expect(computeWrongScore(p, SCORE.WRONG_MALUS, 5)).toBe(0);
  });
});

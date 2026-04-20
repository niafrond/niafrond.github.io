/**
 * state.test.js — Tests unitaires pour state.js (Flash Guess)
 *
 * Teste les constantes, l'état initial et la fonction withCooldown.
 */

import { jest } from '@jest/globals';
import {
  TURN_DURATION, TIMER_CIRCLE_RADIUS, MIN_PLAYERS,
  CARD_COUNT_DEFAULT, CLICK_COOLDOWN, CHILD_READ_AUTO_MS,
  GAMEPLAY_SCREENS, ROUND_RULES, TEAMS_META,
  state, demo, demoHooks,
  withCooldown,
} from '../../state.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

describe('Constantes', () => {
  test('TURN_DURATION est 30 secondes', () => {
    expect(TURN_DURATION).toBe(30);
  });

  test('MIN_PLAYERS est 2', () => {
    expect(MIN_PLAYERS).toBe(2);
  });

  test('CARD_COUNT_DEFAULT est 40', () => {
    expect(CARD_COUNT_DEFAULT).toBe(40);
  });

  test('TIMER_CIRCLE_RADIUS est un nombre positif', () => {
    expect(TIMER_CIRCLE_RADIUS).toBeGreaterThan(0);
  });

  test('CLICK_COOLDOWN est un nombre positif', () => {
    expect(CLICK_COOLDOWN).toBeGreaterThan(0);
  });

  test('CHILD_READ_AUTO_MS est un nombre positif', () => {
    expect(CHILD_READ_AUTO_MS).toBeGreaterThan(0);
  });
});

// ─── GAMEPLAY_SCREENS ─────────────────────────────────────────────────────────

describe('GAMEPLAY_SCREENS', () => {
  test('est un Set', () => {
    expect(GAMEPLAY_SCREENS).toBeInstanceOf(Set);
  });

  test('contient les écrans de jeu', () => {
    expect(GAMEPLAY_SCREENS.has('screen-round-intro')).toBe(true);
    expect(GAMEPLAY_SCREENS.has('screen-pre-turn')).toBe(true);
    expect(GAMEPLAY_SCREENS.has('screen-turn')).toBe(true);
    expect(GAMEPLAY_SCREENS.has('screen-turn-end')).toBe(true);
    expect(GAMEPLAY_SCREENS.has('screen-round-end')).toBe(true);
    expect(GAMEPLAY_SCREENS.has('screen-game-over')).toBe(true);
  });

  test('ne contient pas les écrans hors-jeu', () => {
    expect(GAMEPLAY_SCREENS.has('screen-setup')).toBe(false);
    expect(GAMEPLAY_SCREENS.has('screen-categories')).toBe(false);
  });
});

// ─── ROUND_RULES ──────────────────────────────────────────────────────────────

describe('ROUND_RULES', () => {
  test('contient exactement 3 manches', () => {
    expect(ROUND_RULES).toHaveLength(3);
  });

  test('chaque manche a les propriétés requises', () => {
    ROUND_RULES.forEach(r => {
      expect(r).toHaveProperty('num');
      expect(r).toHaveProperty('icon');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('desc');
      expect(r).toHaveProperty('canSkip');
      expect(r).toHaveProperty('canFault');
    });
  });

  test('manche 1 : pas de skip, pas de faute', () => {
    expect(ROUND_RULES[0].canSkip).toBe(false);
    expect(ROUND_RULES[0].canFault).toBe(false);
  });

  test('manche 2 : skip OK, pas de faute', () => {
    expect(ROUND_RULES[1].canSkip).toBe(true);
    expect(ROUND_RULES[1].canFault).toBe(false);
  });

  test('manche 3 : skip OK, faute OK', () => {
    expect(ROUND_RULES[2].canSkip).toBe(true);
    expect(ROUND_RULES[2].canFault).toBe(true);
  });
});

// ─── TEAMS_META ───────────────────────────────────────────────────────────────

describe('TEAMS_META', () => {
  test('contient 4 couleurs d\'équipes', () => {
    expect(TEAMS_META).toHaveLength(4);
  });

  test('chaque entrée a une propriété color', () => {
    TEAMS_META.forEach(t => {
      expect(typeof t.color).toBe('string');
      expect(t.color.length).toBeGreaterThan(0);
    });
  });
});

// ─── state (structure initiale) ───────────────────────────────────────────────

describe('state', () => {
  test('playerNames est un tableau', () => {
    expect(Array.isArray(state.playerNames)).toBe(true);
  });

  test('playerIsChild est un Set', () => {
    expect(state.playerIsChild).toBeInstanceOf(Set);
  });

  test('timeLeft vaut TURN_DURATION', () => {
    expect(state.timeLeft).toBe(TURN_DURATION);
  });

  test('cardCount vaut CARD_COUNT_DEFAULT', () => {
    expect(state.cardCount).toBe(CARD_COUNT_DEFAULT);
  });

  test('currentRound est 0 initialement', () => {
    expect(state.currentRound).toBe(0);
  });
});

// ─── demo (structure initiale) ────────────────────────────────────────────────

describe('demo', () => {
  test('mode est false initialement', () => {
    expect(demo.mode).toBe(false);
  });

  test('waiting est false initialement', () => {
    expect(demo.waiting).toBe(false);
  });
});

// ─── demoHooks ────────────────────────────────────────────────────────────────

describe('demoHooks', () => {
  test('showTips est null initialement', () => {
    expect(demoHooks.showTips).toBeNull();
  });

  test('showTurnEndTips est null initialement', () => {
    expect(demoHooks.showTurnEndTips).toBeNull();
  });

  test('showAfterFoundTips est null initialement', () => {
    expect(demoHooks.showAfterFoundTips).toBeNull();
  });
});

// ─── withCooldown ─────────────────────────────────────────────────────────────

describe('withCooldown', () => {
  test('appelle la fonction immédiatement', () => {
    const fn = jest.fn();
    const cooled = withCooldown(fn);
    cooled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('bloque les appels rapides (< CLICK_COOLDOWN)', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const cooled = withCooldown(fn);
    cooled();
    cooled(); // trop rapide
    expect(fn).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('autorise un nouvel appel après CLICK_COOLDOWN', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const cooled = withCooldown(fn);
    cooled();
    jest.advanceTimersByTime(CLICK_COOLDOWN + 1);
    cooled();
    expect(fn).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('transmet les arguments à la fonction wrappée', () => {
    const fn = jest.fn();
    const cooled = withCooldown(fn);
    cooled('a', 'b');
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });
});

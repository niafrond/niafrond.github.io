/**
 * roundTimer.test.js — Tests unitaires pour theme-party/roundTimer.js
 * Fonctions pures : aucun DOM, aucune horloge, aucun localStorage nécessaire.
 */

import { createHintRevealState, resetHintReveal, advanceHintReveal } from '../../roundTimer.js';

const TIMINGS = { HINT_1: 10000, HINT_2: 20000, PLAY_MAX: 45000 };

describe('createHintRevealState / resetHintReveal', () => {
  test('état initial : rien révélé, pas arrêté', () => {
    expect(createHintRevealState()).toEqual({
      hint1Revealed: false,
      hint2Revealed: false,
      stopped: false,
    });
  });

  test('resetHintReveal renvoie un état frais identique', () => {
    expect(resetHintReveal()).toEqual(createHintRevealState());
  });
});

describe('advanceHintReveal', () => {
  test('rien ne change avant le seuil du 1er indice', () => {
    const state = createHintRevealState();
    const next = advanceHintReveal(state, 5000, TIMINGS);
    expect(next.hint1Revealed).toBe(false);
    expect(next.hint2Revealed).toBe(false);
    expect(next.stopped).toBe(false);
    expect(next.changed).toBe(false);
  });

  test('révèle hint1 exactement au seuil HINT_1 (pas avant)', () => {
    const state = createHintRevealState();
    expect(advanceHintReveal(state, 9999, TIMINGS).hint1Revealed).toBe(false);
    const atThreshold = advanceHintReveal(state, 10000, TIMINGS);
    expect(atThreshold.hint1Revealed).toBe(true);
    expect(atThreshold.changed).toBe(true);
  });

  test('révèle hint2 exactement au seuil HINT_2, sans redécocher hint1', () => {
    let state = advanceHintReveal(createHintRevealState(), 10000, TIMINGS);
    state = { ...state };
    const next = advanceHintReveal(state, 20000, TIMINGS);
    expect(next.hint1Revealed).toBe(true);
    expect(next.hint2Revealed).toBe(true);
    expect(next.changed).toBe(true);
  });

  test('stopped devient vrai à PLAY_MAX', () => {
    const state = createHintRevealState();
    const next = advanceHintReveal(state, 45000, TIMINGS);
    expect(next.stopped).toBe(true);
    expect(next.changed).toBe(true);
  });

  test('un seul appel peut faire franchir plusieurs seuils à la fois', () => {
    const state = createHintRevealState();
    const next = advanceHintReveal(state, 50000, TIMINGS);
    expect(next.hint1Revealed).toBe(true);
    expect(next.hint2Revealed).toBe(true);
    expect(next.stopped).toBe(true);
    expect(next.changed).toBe(true);
  });

  test('idempotent : rappeler avec le même elapsedMs ne change plus rien', () => {
    let state = advanceHintReveal(createHintRevealState(), 10000, TIMINGS);
    state = { hint1Revealed: state.hint1Revealed, hint2Revealed: state.hint2Revealed, stopped: state.stopped };
    const again = advanceHintReveal(state, 10000, TIMINGS);
    expect(again.changed).toBe(false);
  });

  test('idempotent : un elapsedMs plus petit (lecture qui recule) ne redécoche jamais un indice révélé', () => {
    let state = advanceHintReveal(createHintRevealState(), 20000, TIMINGS);
    state = { hint1Revealed: state.hint1Revealed, hint2Revealed: state.hint2Revealed, stopped: state.stopped };
    const rewound = advanceHintReveal(state, 5000, TIMINGS);
    expect(rewound.hint1Revealed).toBe(true);
    expect(rewound.hint2Revealed).toBe(true);
    expect(rewound.changed).toBe(false);
  });

  test('ne mute jamais son état d\'entrée', () => {
    const state = createHintRevealState();
    const frozenCopy = { ...state };
    advanceHintReveal(state, 45000, TIMINGS);
    expect(state).toEqual(frozenCopy);
  });
});

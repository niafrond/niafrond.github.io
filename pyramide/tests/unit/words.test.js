/**
 * words.test.js — Tests unitaires pour words.js (Pyramide)
 *
 * Vérifie la structure des ensembles de mots pour chaque manche.
 */

import {
  R1_PHRASE_SETS, R1_WORDS,
  R2_WORDS, R3_SETS, R4_SETS, FINAL_SETS,
  getR1PhraseSets, getR1Words,
  getR2Words, getR3Set, getR4Set, getFinalSet,
} from '../../words.js';

// ─── R1_PHRASE_SETS ───────────────────────────────────────────────────────────

describe('R1_PHRASE_SETS', () => {
  test('est un tableau avec au moins 20 sets', () => {
    expect(Array.isArray(R1_PHRASE_SETS)).toBe(true);
    expect(R1_PHRASE_SETS.length).toBeGreaterThanOrEqual(20);
  });

  test('chaque set a une phrase non vide et exactement 5 mots', () => {
    R1_PHRASE_SETS.forEach((set, i) => {
      expect(typeof set.phrase).toBe('string');
      expect(set.phrase.length).toBeGreaterThan(0);
      expect(Array.isArray(set.words)).toBe(true);
      expect(set.words.length).toBe(5);
      set.words.forEach(w => {
        expect(typeof w).toBe('string');
        expect(w.length).toBeGreaterThan(0);
      });
    });
  });

  test('les phrases sont toutes distinctes', () => {
    const phrases = R1_PHRASE_SETS.map(s => s.phrase);
    const unique  = new Set(phrases);
    expect(unique.size).toBe(phrases.length);
  });
});

// ─── R1_WORDS (alias plat) ────────────────────────────────────────────────────

describe('R1_WORDS', () => {
  test('est un tableau plat dérivé de R1_PHRASE_SETS', () => {
    expect(Array.isArray(R1_WORDS)).toBe(true);
    expect(R1_WORDS.length).toBe(R1_PHRASE_SETS.length * 5);
  });

  test('contient uniquement des chaînes non vides', () => {
    R1_WORDS.forEach(w => {
      expect(typeof w).toBe('string');
      expect(w.length).toBeGreaterThan(0);
    });
  });
});

// ─── getR1PhraseSets ──────────────────────────────────────────────────────────

describe('getR1PhraseSets', () => {
  test('retourne le bon nombre de sets', () => {
    expect(getR1PhraseSets(5).length).toBe(5);
    expect(getR1PhraseSets(10).length).toBe(10);
  });

  test('ne retourne pas de phrases dupliquées dans un même appel', () => {
    const sets = getR1PhraseSets(10);
    const phrases = sets.map(s => s.phrase);
    expect(new Set(phrases).size).toBe(10);
  });

  test('chaque set retourné a exactement 5 mots', () => {
    getR1PhraseSets(8).forEach(set => {
      expect(set.words.length).toBe(5);
    });
  });

  test('ne modifie pas le tableau source R1_PHRASE_SETS', () => {
    const before = R1_PHRASE_SETS.map(s => s.phrase).join(',');
    getR1PhraseSets(5);
    const after  = R1_PHRASE_SETS.map(s => s.phrase).join(',');
    expect(after).toBe(before);
  });
});

// ─── getR1Words (legacy) ──────────────────────────────────────────────────────

describe('getR1Words', () => {
  test('retourne un tableau de même longueur que R1_WORDS', () => {
    expect(getR1Words().length).toBe(R1_WORDS.length);
  });

  test('contient les mêmes éléments que R1_WORDS', () => {
    const result = getR1Words();
    expect(new Set(result)).toEqual(new Set(R1_WORDS));
  });
});

// ─── R2_WORDS ────────────────────────────────────────────────────────────────

describe('R2_WORDS', () => {
  test('est un tableau avec au moins 5 mots', () => {
    expect(Array.isArray(R2_WORDS)).toBe(true);
    expect(R2_WORDS.length).toBeGreaterThanOrEqual(5);
  });
});

describe('getR2Words', () => {
  test('retourne un tableau de même longueur que R2_WORDS', () => {
    expect(getR2Words().length).toBe(R2_WORDS.length);
  });
});

// ─── R3_SETS ─────────────────────────────────────────────────────────────────

describe('R3_SETS', () => {
  test('contient au moins 1 thème', () => {
    expect(R3_SETS.length).toBeGreaterThanOrEqual(1);
  });

  test('chaque set a un thème string et au moins 5 mots', () => {
    R3_SETS.forEach(set => {
      expect(typeof set.theme).toBe('string');
      expect(set.theme.length).toBeGreaterThan(0);
      expect(Array.isArray(set.words)).toBe(true);
      expect(set.words.length).toBeGreaterThanOrEqual(5);
    });
  });
});

describe('getR3Set', () => {
  test('retourne un set avec theme et words', () => {
    const set = getR3Set();
    expect(typeof set.theme).toBe('string');
    expect(Array.isArray(set.words)).toBe(true);
  });
});

// ─── R4_SETS ─────────────────────────────────────────────────────────────────

describe('R4_SETS', () => {
  test('contient au moins 1 thème', () => {
    expect(R4_SETS.length).toBeGreaterThanOrEqual(1);
  });

  test('chaque set a un thème et exactement 7 mots', () => {
    R4_SETS.forEach(set => {
      expect(typeof set.theme).toBe('string');
      expect(set.words.length).toBe(7);
    });
  });
});

describe('getR4Set', () => {
  test('retourne un set valide', () => {
    const set = getR4Set();
    expect(typeof set.theme).toBe('string');
    expect(set.words.length).toBe(7);
  });
});

// ─── FINAL_SETS ───────────────────────────────────────────────────────────────

describe('FINAL_SETS', () => {
  test('contient au moins 1 set', () => {
    expect(FINAL_SETS.length).toBeGreaterThanOrEqual(1);
  });

  test('chaque set contient exactement 6 expressions', () => {
    FINAL_SETS.forEach(set => {
      expect(set.length).toBe(6);
    });
  });
});

describe('getFinalSet', () => {
  test('retourne un tableau de 6 expressions', () => {
    expect(getFinalSet().length).toBe(6);
  });

  test('retourne une copie (ne modifie pas la source)', () => {
    const result = getFinalSet();
    const originalFirst = FINAL_SETS[0][0];
    result[0] = 'MUTATION_TEST';
    expect(FINAL_SETS.flat()).toContain(originalFirst);
  });
});

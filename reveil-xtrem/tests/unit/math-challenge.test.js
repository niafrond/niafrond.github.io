import { generateProblem, suggestedProblemsCount, SUGGESTED_PROBLEMS_COUNT } from '../../math-challenge.js';

function evalProblem(text) {
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${text.replace('×', '*').replace('−', '-')});`)();
}

describe('generateProblem', () => {
  test('la réponse fournie correspond bien au calcul énoncé, pour chaque difficulté', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (let i = 0; i < 100; i++) {
        const { text, answer } = generateProblem(difficulty);
        expect(evalProblem(text)).toBe(answer);
      }
    }
  });

  test('easy reste à un chiffre (0-9) de chaque côté', () => {
    for (let i = 0; i < 50; i++) {
      const { text } = generateProblem('easy');
      const [a, , b] = text.split(' ');
      expect(Number(a)).toBeGreaterThanOrEqual(0);
      expect(Number(a)).toBeLessThanOrEqual(9);
      expect(Number(b)).toBeGreaterThanOrEqual(0);
      expect(Number(b)).toBeLessThanOrEqual(9);
    }
  });

  test('une soustraction ne donne jamais un résultat négatif', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (let i = 0; i < 100; i++) {
        const { text, answer } = generateProblem(difficulty);
        if (text.includes('−')) expect(answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('une difficulté inconnue retombe sur le comportement easy', () => {
    const { text } = generateProblem('nope');
    expect(text).toMatch(/^\d [+−] \d$/);
  });
});

describe('suggestedProblemsCount', () => {
  test('suggère un nombre croissant avec la difficulté, ajustable ensuite par l\'utilisateur', () => {
    expect(suggestedProblemsCount('easy')).toBe(1);
    expect(suggestedProblemsCount('medium')).toBe(2);
    expect(suggestedProblemsCount('hard')).toBe(3);
  });

  test('correspond à la table SUGGESTED_PROBLEMS_COUNT', () => {
    expect(suggestedProblemsCount('hard')).toBe(SUGGESTED_PROBLEMS_COUNT.hard);
  });

  test('une difficulté inconnue retombe sur la suggestion easy', () => {
    expect(suggestedProblemsCount('nope')).toBe(SUGGESTED_PROBLEMS_COUNT.easy);
  });
});

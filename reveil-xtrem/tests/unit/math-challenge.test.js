import {
  generateProblem, suggestedProblemsCount, SUGGESTED_PROBLEMS_COUNT, DIFFICULTY_ORDER,
} from '../../math-challenge.js';

function evalProblem(text) {
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${text.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')});`)();
}

describe('generateProblem', () => {
  test('la réponse fournie correspond bien au calcul énoncé, pour chaque difficulté', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      for (let i = 0; i < 200; i++) {
        const { text, answer } = generateProblem(difficulty);
        expect(evalProblem(text)).toBe(answer);
      }
    }
  });

  test('veryEasy reste à un chiffre (0-9) de chaque côté', () => {
    for (let i = 0; i < 50; i++) {
      const { text } = generateProblem('veryEasy');
      const [a, , b] = text.split(' ');
      expect(Number(a)).toBeGreaterThanOrEqual(0);
      expect(Number(a)).toBeLessThanOrEqual(9);
      expect(Number(b)).toBeGreaterThanOrEqual(0);
      expect(Number(b)).toBeLessThanOrEqual(9);
    }
  });

  test('easy combine un nombre à deux chiffres (10-20) et un à un chiffre (1-9)', () => {
    for (let i = 0; i < 50; i++) {
      const { text } = generateProblem('easy');
      const [a, , b] = text.split(' ');
      expect(Number(a)).toBeGreaterThanOrEqual(10);
      expect(Number(a)).toBeLessThanOrEqual(20);
      expect(Number(b)).toBeGreaterThanOrEqual(1);
      expect(Number(b)).toBeLessThanOrEqual(9);
    }
  });

  test('veryEasy et easy restent purement additifs (jamais de × ni de ÷)', () => {
    for (const difficulty of ['veryEasy', 'easy']) {
      for (let i = 0; i < 100; i++) {
        const { text } = generateProblem(difficulty);
        expect(text).not.toMatch(/[×÷]/);
      }
    }
  });

  test('à partir de moyen, la multiplication apparaît bien (pas seulement +/−)', () => {
    for (const difficulty of ['medium', 'hard', 'veryHard']) {
      const seenOps = new Set();
      for (let i = 0; i < 200; i++) {
        const { text } = generateProblem(difficulty);
        if (text.includes('×')) seenOps.add('×');
      }
      expect(seenOps.has('×')).toBe(true);
    }
  });

  test('medium ne produit jamais de division (réservée à "difficile" et au-delà)', () => {
    for (let i = 0; i < 200; i++) {
      const { text } = generateProblem('medium');
      expect(text).not.toMatch(/÷/);
    }
  });

  test('à partir de difficile, la division apparaît et tombe toujours juste (ex. "84 ÷ 7")', () => {
    for (const difficulty of ['hard', 'veryHard']) {
      let foundDivision = false;
      for (let i = 0; i < 200; i++) {
        const { text, answer } = generateProblem(difficulty);
        if (!text.includes('÷')) continue;
        foundDivision = true;
        expect(text).toMatch(/^\d+ ÷ \d+$/);
        expect(Number.isInteger(answer)).toBe(true);
      }
      expect(foundDivision).toBe(true);
    }
  });

  test('hard peut enchaîner trois nombres (ex. "112 − 62 − 27")', () => {
    let foundChain = false;
    for (let i = 0; i < 200; i++) {
      const { text } = generateProblem('hard');
      const numbers = text.match(/\d+/g);
      if (numbers.length !== 3) continue;
      foundChain = true;
      expect(Number(numbers[0])).toBeGreaterThanOrEqual(100);
      expect(Number(numbers[0])).toBeLessThanOrEqual(199);
    }
    expect(foundChain).toBe(true);
  });

  test('veryHard peut combiner une multiplication et une soustraction (ex. "9 × 31 − 264")', () => {
    let foundComposite = false;
    for (let i = 0; i < 200; i++) {
      const { text } = generateProblem('veryHard');
      if (!/^\d+ × \d+ − \d+$/.test(text)) continue;
      foundComposite = true;
    }
    expect(foundComposite).toBe(true);
  });

  test('une soustraction ne donne jamais un résultat négatif, quelle que soit la difficulté', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      for (let i = 0; i < 100; i++) {
        const { text, answer } = generateProblem(difficulty);
        if (text.includes('−')) expect(answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('une difficulté inconnue retombe sur le comportement veryEasy (le plus simple)', () => {
    const { text } = generateProblem('nope');
    expect(text).toMatch(/^\d [+−] \d$/);
  });
});

describe('suggestedProblemsCount', () => {
  test('suggère un nombre croissant avec la difficulté, ajustable ensuite par l\'utilisateur', () => {
    expect(suggestedProblemsCount('veryEasy')).toBe(1);
    expect(suggestedProblemsCount('easy')).toBe(1);
    expect(suggestedProblemsCount('medium')).toBe(2);
    expect(suggestedProblemsCount('hard')).toBe(2);
    expect(suggestedProblemsCount('veryHard')).toBe(3);
  });

  test('correspond à la table SUGGESTED_PROBLEMS_COUNT', () => {
    expect(suggestedProblemsCount('veryHard')).toBe(SUGGESTED_PROBLEMS_COUNT.veryHard);
  });

  test('une difficulté inconnue retombe sur la suggestion veryEasy', () => {
    expect(suggestedProblemsCount('nope')).toBe(SUGGESTED_PROBLEMS_COUNT.veryEasy);
  });
});

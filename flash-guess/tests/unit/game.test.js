/**
 * game.test.js — Tests unitaires pour la logique de jeu (game.js)
 *
 * On teste les fonctions pures / déterministes : computeTeamLayout, teamLabel.
 * assignTeams est intégré car il modifie state mais reste testable.
 */

import {
  computeTeamLayout,
  teamLabel,
  computeDraftChunks,
} from '../../game.js';

// ─── computeTeamLayout ────────────────────────────────────────────────────────

describe('computeTeamLayout', () => {
  test('2 joueurs → 1 équipe de 2', () => {
    expect(computeTeamLayout(2)).toEqual([2]);
  });

  test('3 joueurs → 3 équipes de 1 (individuel)', () => {
    expect(computeTeamLayout(3)).toEqual([1, 1, 1]);
  });

  test('4 joueurs → 2 équipes de 2', () => {
    expect(computeTeamLayout(4)).toEqual([2, 2]);
  });

  test('5 joueurs → null (mode individuel)', () => {
    expect(computeTeamLayout(5)).toBeNull();
  });

  test('6 joueurs → 3 équipes de 2', () => {
    expect(computeTeamLayout(6)).toEqual([2, 2, 2]);
  });

  test('7 joueurs → null (mode individuel)', () => {
    expect(computeTeamLayout(7)).toBeNull();
  });

  test('8 joueurs → 4 équipes de 2', () => {
    expect(computeTeamLayout(8)).toEqual([2, 2, 2, 2]);
  });

  test('9 joueurs → 3 équipes de 3', () => {
    expect(computeTeamLayout(9)).toEqual([3, 3, 3]);
  });

  test('10 joueurs → [3, 3, 2, 2]', () => {
    expect(computeTeamLayout(10)).toEqual([3, 3, 2, 2]);
  });

  test('11 joueurs → [3, 3, 3, 2]', () => {
    expect(computeTeamLayout(11)).toEqual([3, 3, 3, 2]);
  });

  test('12 joueurs → 4 équipes de 3', () => {
    expect(computeTeamLayout(12)).toEqual([3, 3, 3, 3]);
  });

  test('13+ joueurs → 4 équipes, somme = n', () => {
    for (let n = 13; n <= 20; n++) {
      const layout = computeTeamLayout(n);
      expect(layout).toHaveLength(4);
      expect(layout.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  test('le layout pour des grands nombres est réparti équitablement', () => {
    const layout = computeTeamLayout(16);
    expect(layout).toEqual([4, 4, 4, 4]);

    const layout17 = computeTeamLayout(17);
    expect(layout17).toHaveLength(4);
    const max = Math.max(...layout17);
    const min = Math.min(...layout17);
    expect(max - min).toBeLessThanOrEqual(1); // écart max de 1
  });
});

// ─── teamLabel ────────────────────────────────────────────────────────────────

describe('teamLabel', () => {
  test('renvoie les noms séparés par « · »', () => {
    const team = { players: ['Alice', 'Bob'] };
    expect(teamLabel(team)).toBe('Alice · Bob');
  });

  test('un seul joueur → juste son nom', () => {
    const team = { players: ['Charlie'] };
    expect(teamLabel(team)).toBe('Charlie');
  });

  test('trois joueurs', () => {
    const team = { players: ['A', 'B', 'C'] };
    expect(teamLabel(team)).toBe('A · B · C');
  });
});

// ─── computeDraftChunks ───────────────────────────────────────────────────────

describe('computeDraftChunks', () => {
  function makeWords(n) {
    return Array.from({ length: n }, (_, i) => ({ word: `mot${i}`, category: 'test' }));
  }

  test('4 joueurs, 40 mots cibles → pool de 52 mots, 4 chunks', () => {
    const words  = makeWords(52);
    const chunks = computeDraftChunks(words, 40, 4);
    expect(chunks).toHaveLength(4);
    const totalWords = chunks.reduce((s, c) => s + c.length, 0);
    expect(totalWords).toBe(52);
  });

  test('chaque chunk a la bonne taille (40 / 4 + 3 = 13)', () => {
    const words  = makeWords(52);
    const chunks = computeDraftChunks(words, 40, 4);
    chunks.forEach(chunk => expect(chunk).toHaveLength(13));
  });

  test('après élimination de 3 par joueur il reste exactement cardCount mots', () => {
    const words    = makeWords(52);
    const chunks   = computeDraftChunks(words, 40, 4);
    const remaining = chunks.reduce((s, c) => s + (c.length - 3), 0);
    expect(remaining).toBe(40);
  });

  test('3 joueurs, 30 mots cibles → pool de 39, répartition quasi-égale', () => {
    const words  = makeWords(39);
    const chunks = computeDraftChunks(words, 30, 3);
    expect(chunks).toHaveLength(3);
    const totalWords = chunks.reduce((s, c) => s + c.length, 0);
    expect(totalWords).toBe(39);
    chunks.forEach(chunk => expect(chunk.length).toBe(13));
  });

  test('si le pool est plus grand que nécessaire, seuls les N premiers mots sont utilisés', () => {
    const words  = makeWords(100);
    const chunks = computeDraftChunks(words, 20, 2); // total = 26
    const totalWords = chunks.reduce((s, c) => s + c.length, 0);
    expect(totalWords).toBe(26);
    // Les mots utilisés sont les 26 premiers
    const usedWords = chunks.flat();
    usedWords.forEach(w => {
      const idx = parseInt(w.word.replace('mot', ''), 10);
      expect(idx).toBeLessThan(26);
    });
  });

  test('répartition équitable quand total non divisible par N', () => {
    // 3 joueurs, 40 mots cibles → total = 49 = 3*16 + 1
    const words  = makeWords(49);
    const chunks = computeDraftChunks(words, 40, 3);
    const sizes  = chunks.map(c => c.length);
    const max    = Math.max(...sizes);
    const min    = Math.min(...sizes);
    expect(max - min).toBeLessThanOrEqual(1);
    expect(sizes.reduce((s, v) => s + v, 0)).toBe(49);
  });
});

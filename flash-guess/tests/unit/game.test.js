/**
 * game.test.js — Tests unitaires pour la logique de jeu (game.js)
 *
 * On teste les fonctions pures / déterministes : computeTeamLayout, teamLabel.
 * assignTeams est intégré car il modifie state mais reste testable.
 */

import {
  computeTeamLayout,
  teamLabel,
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

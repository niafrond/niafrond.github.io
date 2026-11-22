import { describe, test, expect } from '@jest/globals';
import { defeatGoldLoss, averageVictoryGold, DEFEAT_PENALTY_DIFFICULTIES } from '../../defeatPenalty.js';

describe('coût de la défaite selon la difficulté', () => {
    test('aucun coût en Auto, Histoire, Facile et Normal', () => {
        ['auto', 'story', 'easy', 'normal', undefined].forEach(d => expect(defeatGoldLoss(20, 500, d)).toBe(0));
    });
    test("Difficile et Expert : l'or moyen d'un combat gagné au niveau du héros", () => {
        expect(DEFEAT_PENALTY_DIFFICULTIES).toEqual(['hard', 'expert']);
        expect(averageVictoryGold(20)).toBe(84);
        expect(defeatGoldLoss(20, 500, 'hard')).toBe(84);
        expect(defeatGoldLoss(70, 5000, 'expert')).toBe(284);
    });
    test("cas limites : jamais plus que l'or porté, jamais négatif", () => {
        expect(defeatGoldLoss(20, 30, 'hard')).toBe(30);
        expect(defeatGoldLoss(20, 0, 'expert')).toBe(0);
        expect(defeatGoldLoss(20, -5, 'expert')).toBe(0);
    });
});

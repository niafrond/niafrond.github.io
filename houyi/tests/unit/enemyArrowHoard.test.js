// Ruée sur les flèches : l'IA difficile/experte fait des réserves de points d'action (enemyAI.js : arrowHunger, boardMoveOptions, evaluateBoardMove).
import { describe, test, expect, jest, beforeAll, beforeEach } from '@jest/globals';

const player = { hp: 100, maxHp: 100, mana: {}, combatPoints: 0, resistances: {} };
const enemy = { level: 5, hp: 100, maxHp: 100, mana: { red: 9 }, combatPoints: 0, spells: [], weapon: { name: 'Arc', damage: 8, actionPoints: 2 }, statusEffects: {} };
jest.unstable_mockModule('../../game.js', () => ({ player, enemy, canEntityCastSpell: () => true, spellCostFor: (e, a) => a }));

let ai;
beforeAll(async () => { ai = await import('../../enemyAI.js'); });
beforeEach(() => { Object.assign(enemy, { combatPoints: 0, spells: [], weapon: { name: 'Arc', damage: 8, actionPoints: 2 }, statusEffects: {} }); ai.setAIDifficulty('expert'); });

describe('ruée sur les flèches', () => {
    test('faim de flèches : pleine à vide, nulle à réserve pleine, sans arme ou scellé', () => {
        expect(ai.arrowHunger()).toBe(1);
        enemy.combatPoints = 3; expect(ai.arrowHunger()).toBeCloseTo(0.5);
        enemy.combatPoints = 6; expect(ai.arrowHunger()).toBe(0);
        enemy.combatPoints = 0; enemy.weapon = null; expect(ai.arrowHunger()).toBe(0);
        enemy.weapon = { actionPoints: 2 }; enemy.statusEffects = { sealed: 2 }; expect(ai.arrowHunger()).toBe(0);
    });
    test('les flèches pèsent plus dans le choix du coup quand la réserve est vide', () => {
        const hungry = ai.boardMoveOptions();
        enemy.combatPoints = 6;
        expect(hungry.weights.combat).toBeGreaterThan(1.6);
        expect(ai.boardMoveOptions()).toBeNull();   // réserve pleine et aucun besoin de qì
    });
    test('les paliers sans ruée (facile, normal) restent inchangés', () => {
        ai.setAIDifficulty('normal');
        expect(ai.arrowHunger()).toBe(0);
        expect(ai.boardMoveOptions()).toBeNull();
    });
    test('le plateau devient plus attirant quand la réserve est vide', () => {
        const avg = () => Array.from({ length: 50 }, () => ai.evaluateBoardMove().score).reduce((a, b) => a + b) / 50;
        const empty = avg(); enemy.combatPoints = 6;
        expect(empty).toBeGreaterThan(avg() + 20);
    });
});

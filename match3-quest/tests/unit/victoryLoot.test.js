import { describe, test, expect } from '@jest/globals';
import { rollOverleveledLoot, overleveledLootTier } from '../../victoryLoot.js';

const RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
const owner = level => ({ level, weapons: [], inventory: [] });

describe('butin d\'un ennemi de niveau supérieur', () => {
    test('rien à niveau égal ou inférieur', () => {
        expect(rollOverleveledLoot(0, owner(10))).toEqual([]);
        expect(rollOverleveledLoot(-3, owner(10))).toEqual([]);
        expect(overleveledLootTier(0)).toBeNull();
    });

    test('toujours du butin, jamais au-dessus du niveau du joueur', () => {
        for (const gap of [1, 2, 3, 5]) for (const level of [3, 8, 15, 30]) for (let i = 0; i < 40; i++) {
            const loot = rollOverleveledLoot(gap, owner(level));
            expect(loot.length).toBeGreaterThanOrEqual(1);
            loot.forEach(e => expect((e.item || e.weapon).minLevel).toBeLessThanOrEqual(level));
        }
    });

    test('plus l\'écart est grand, plus c\'est rare (rare au minimum, légendaire de plus en plus souvent)', () => {
        for (let i = 0; i < 60; i++) {
            for (const gap of [1, 2, 3]) rollOverleveledLoot(gap, owner(20)).forEach(e => expect(RANK[e.rarity]).toBeGreaterThanOrEqual(RANK.rare));
            rollOverleveledLoot(4, owner(20)).forEach(e => expect(e.rarity).toBe('legendary'));
        }
        expect(rollOverleveledLoot(3, owner(20)).length).toBe(2);
    });

    test('pas de doublon d\'arme ni de relique dans un même butin', () => {
        const o = owner(20);
        for (let i = 0; i < 80; i++) {
            const loot = rollOverleveledLoot(4, o);
            const ids = loot.filter(e => e.kind === 'weapon' || e.item.type === 'artifact').map(e => (e.item || e.weapon).id);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });
});

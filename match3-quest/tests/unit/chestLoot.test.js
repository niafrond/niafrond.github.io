// Potions des coffres : plus un coffre est difficile à trouver, plus il contient souvent une potion, et plus elle est rare.
import { describe, test, expect } from '@jest/globals';
import { SCREENS, REGION_UNLOCK_LEVEL } from '../../story.js';
import { REGION_ORDER } from '../../world/index.js';
import { chestDifficulty, chestPotion, CHEST_LOOT } from '../../chestLoot.js';
import { createSession, openChest } from '../../exploration.js';

const RANK = { common: 0, uncommon: 1, rare: 2 };
const all = Object.values(SCREENS).flatMap(screen => screen.chests.map(chest => {
    const regionIndex = REGION_ORDER.indexOf(screen.region) + 1;
    const opts = { regionIndex, level: REGION_UNLOCK_LEVEL[screen.region] || 1 };
    return { screen, chest, opts, difficulty: chestDifficulty(chest, screen, regionIndex), potion: chestPotion(chest, screen, opts) };
}));

describe('potions des coffres', () => {
    test('difficulté : palier du coffre, +1 en zone sauvage, autel exclu', () => {
        const wild = { kind: 'wild' }, village = { kind: 'village' };
        expect(chestDifficulty({ id: 'a', gold: 15 }, village, 1)).toBe(1);
        expect(chestDifficulty({ id: 'b', gold: 30 }, village, 1)).toBe(2);
        expect(chestDifficulty({ id: 'c', gold: 45 }, wild, 1)).toBe(4);
        expect(chestDifficulty({ id: 'd', gold: 90 }, wild, 6)).toBe(2);
        expect(chestDifficulty({ id: 'e', gold: 15, difficulty: 3 }, village, 1)).toBe(3);
        expect(chestDifficulty({ id: 'moon_altar', gold: 0, altar: true }, village, 10)).toBe(0);
        all.filter(e => e.chest.altar).forEach(e => expect(e.potion).toBeNull());
    });

    test('tirage déterministe, potions du catalogue seulement', () => {
        all.forEach(e => {
            expect(chestPotion(e.chest, e.screen, e.opts)).toEqual(e.potion);
            if (e.potion) expect(e.potion.type).toBe('consumable');
        });
    });

    test('plus le coffre est difficile, plus il donne de potions et plus elles sont rares', () => {
        const stats = [1, 2, 3, 4].map(d => {
            const list = all.filter(e => e.difficulty === d);
            const potions = list.filter(e => e.potion);
            return {
                rate: potions.length / list.length,
                rarity: potions.reduce((sum, e) => sum + RANK[e.potion.rarity], 0) / Math.max(1, potions.length)
            };
        });
        for (let d = 1; d < 4; d++) {
            expect(stats[d].rate).toBeGreaterThan(stats[d - 1].rate);
            expect(stats[d].rarity).toBeGreaterThan(stats[d - 1].rarity);
        }
        expect(all.filter(e => e.difficulty === 1 && e.potion).every(e => e.potion.rarity === 'common')).toBe(true);
        expect(all.filter(e => e.difficulty === 4).every(e => e.potion && e.potion.rarity !== 'common')).toBe(true);
        expect(CHEST_LOOT[4].chance).toBe(1);
    });

    test('openChest renvoie la potion dans son événement', () => {
        const s = createSession(null);
        const screen = Object.values(s.screens).find(sc => sc.chests.some(c => c.id === 'warden_hoard'));
        s.data.screenId = screen.id;
        const res = openChest(s, 'warden_hoard');
        expect(res.potion).toBeTruthy();
        expect(res.events[0]).toMatchObject({ type: 'chestOpened', potion: res.potion });
    });
});

// Butin des coffres : potions / reliques / armes, plus rares quand le coffre est difficile à trouver.
import { SCREENS } from '../../story.js';
import { chestTier, rollChestLoot, weaponRarity, LOOT_TIERS } from '../../chestLoot.js';
import { allWeapons } from '../../weapons.js';

// Générateur pseudo-aléatoire reproductible.
function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

function averageRank(chest, screen, level, n = 400) {
    const rng = seeded(42);
    let total = 0, count = 0;
    for (let i = 0; i < n; i++) {
        rollChestLoot(chest, screen, { level }, rng).loot.forEach(l => { total += RANK[l.rarity]; count++; });
    }
    return { avg: total / count, perChest: count / n };
}

describe('chestLoot', () => {
    test('palier selon la difficulté : or relatif à la région et emplacement', () => {
        expect(chestTier({ gold: 15 }, { region: 'rizieres', kind: 'village' })).toBe(1);
        expect(chestTier({ gold: 30 }, { region: 'rizieres', kind: 'house' })).toBe(2);
        expect(chestTier({ gold: 30 }, { region: 'rizieres', kind: 'wild' })).toBe(3);
        expect(chestTier({ gold: 45 }, { region: 'rizieres', kind: 'wild' })).toBe(4);
        // même or, région plus avancée : coffre ordinaire là-bas
        expect(chestTier({ gold: 45 }, { region: 'fleuve', kind: 'village' })).toBe(2);
        expect(chestTier({ gold: 90 }, { region: 'fleuve', kind: 'village' })).toBe(3);
        // sanctuaire (au-delà du gardien) : bonus d'emplacement
        expect(chestTier({ gold: 60 }, { region: 'fleuve' })).toBe(3);
    });

    test('pas de butin sans or, ou si désactivé ; palier forcé possible', () => {
        expect(chestTier({ gold: 0 }, { region: 'lune' })).toBe(0);
        expect(rollChestLoot({ gold: 0, id: 'moon_altar' }, { region: 'lune' }, { level: 20 }).loot).toEqual([]);
        expect(chestTier({ gold: 100, loot: false }, { region: 'rizieres' })).toBe(0);
        expect(chestTier({ gold: 10, lootTier: 4 }, { region: 'lune', kind: 'house' })).toBe(4);
    });

    test('tous les coffres du monde ont un palier cohérent', () => {
        const tiers = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        Object.values(SCREENS).forEach(s => s.chests.forEach(c => { tiers[chestTier(c, s)]++; }));
        expect(tiers[0]).toBe(1); // l'autel de la lune
        [1, 2, 3, 4].forEach(t => expect(tiers[t]).toBeGreaterThan(0));
        expect(tiers[1]).toBeGreaterThan(tiers[4]);
    });

    test('plus le coffre est dur à trouver, plus le butin est abondant et rare', () => {
        const screen = { region: 'tonnerre', kind: 'wild' };
        const results = [1, 2, 3, 4].map(t => averageRank({ gold: 50, lootTier: t }, screen, 12));
        for (let i = 1; i < results.length; i++) {
            expect(results[i].avg).toBeGreaterThan(results[i - 1].avg);
            expect(results[i].perChest).toBeGreaterThanOrEqual(results[i - 1].perChest);
        }
        expect(results[0].perChest).toBeLessThan(1);
        expect(results[3].perChest).toBe(2);
    });

    test('le butin contient potions, reliques et armes, sans dépasser le niveau permis', () => {
        const rng = seeded(7);
        const kinds = new Set();
        for (let i = 0; i < 300; i++) {
            rollChestLoot({ gold: 50, lootTier: 3 }, { region: 'rizieres', kind: 'wild' }, { level: 6 }, rng).loot.forEach(l => {
                const obj = l.item || l.weapon;
                expect(obj.minLevel).toBeLessThanOrEqual(6 + LOOT_TIERS[3].levelBonus);
                kinds.add(l.kind === 'weapon' ? 'weapon' : l.item.type);
            });
        }
        expect(kinds).toEqual(new Set(['artifact', 'weapon', 'shield', 'reusable']));
    });

    test('ni arme déjà possédée ni relique déjà portée', () => {
        const owner = { level: 20, weapons: allWeapons.slice(), inventory: [] };
        const rng = seeded(3);
        for (let i = 0; i < 200; i++) {
            const { loot } = rollChestLoot({ gold: 1, lootTier: 4 }, { region: 'lune' }, owner, rng);
            loot.forEach(l => {
                expect(l.kind).toBe('item');
                if (l.item.type === 'artifact') {
                    expect(owner.inventory.some(i => i.id === l.item.id)).toBe(false);
                    owner.inventory.push(l.item);
                }
            });
        }
    });

    test('rareté des armes : celle de leur fiche', () => {
        expect(weaponRarity(allWeapons.find(w => w.id === 'arc_de_fortune'))).toBe('common');
        expect(weaponRarity(allWeapons.find(w => w.id === 'arc_des_dix_soleils'))).toBe('legendary');
    });
});

describe('bonus de biome des arcs', () => {
    test('+25 % (min +2) dans le bon biome, rien ailleurs', async () => {
        const { weaponBiomeBonus, getWeaponById } = await import('../../weapons.js');
        const feu = getWeaponById('arc_de_feu');
        expect(feu.biome).toBe('volcano');
        expect(weaponBiomeBonus(feu, 'volcano')).toBe(Math.round(feu.damage * 0.25));
        expect(weaponBiomeBonus(feu, 'bamboo')).toBe(0);
        expect(weaponBiomeBonus(getWeaponById('arc_de_fortune'), 'volcano')).toBe(0);
        expect(weaponBiomeBonus(getWeaponById('arc_de_bambou'), 'bamboo')).toBeGreaterThanOrEqual(2);
    });
});

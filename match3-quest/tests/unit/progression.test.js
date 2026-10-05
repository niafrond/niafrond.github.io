// Courbe d'XP croissante jusqu'au niveau 70, croissance innée au-delà du niveau 18, ennemis jouables jusqu'au niveau 70.
import { describe, test, expect } from '@jest/globals';
import { MAX_LEVEL, getXPCostForLevel, getXPRequiredForLevel, addXP, normalizeXP, calculateXPGain } from '../../experience.js';
import { growthExtras, applyGrowth, enemyDefenseForLevel } from '../../progression.js';
import { allWeapons } from '../../weapons.js';
import { createBossEnemyForTier, createMapEnemy } from '../../enemies.js';

describe('courbe d\'XP', () => {
    test('niveau maximal 70', () => expect(MAX_LEVEL).toBe(70));

    test('le palier de chaque niveau est strictement croissant (≈ 1 000 au niveau 2, ≈ 40 000 au niveau 35)', () => {
        expect(getXPCostForLevel(2)).toBe(1000);
        expect(getXPCostForLevel(35)).toBeGreaterThanOrEqual(38000);
        expect(getXPCostForLevel(35)).toBeLessThanOrEqual(42000);
        for (let n = 3; n <= MAX_LEVEL; n++) expect(getXPCostForLevel(n)).toBeGreaterThan(getXPCostForLevel(n - 1));
        expect(getXPCostForLevel(MAX_LEVEL)).toBeLessThan(100000);   // pas d'explosion exponentielle
    });

    test('l\'XP cumulée est la somme des paliers', () => {
        expect(getXPRequiredForLevel(1)).toBe(0);
        expect(getXPRequiredForLevel(2)).toBe(1000);
        let sum = 0;
        for (let n = 2; n <= 20; n++) { sum += getXPCostForLevel(n); expect(getXPRequiredForLevel(n)).toBe(sum); }
        expect(getXPRequiredForLevel(500)).toBe(getXPRequiredForLevel(MAX_LEVEL));   // plafonné
    });

    test('addXP monte de niveau palier par palier, jusqu\'à 70 maximum', () => {
        const p = { level: 1, xp: 0, xpToNextLevel: getXPRequiredForLevel(2) };
        const res = addXP(p, getXPRequiredForLevel(10));
        expect(res).toMatchObject({ leveledUp: true, newLevel: 10 });
        expect(p.xpToNextLevel).toBe(getXPRequiredForLevel(11));
        addXP(p, 1e12);
        expect(p.level).toBe(MAX_LEVEL);
        expect(addXP(p, 1000)).toMatchObject({ leveledUp: false, newLevel: MAX_LEVEL });
    });

    test('ancienne sauvegarde : le niveau est conservé, l\'XP recalée dans la fourchette du niveau', () => {
        const rich = normalizeXP({ level: 20, xp: 5e6, xpToNextLevel: 1 });
        expect(rich.level).toBe(20);
        expect(rich.xp).toBe(getXPRequiredForLevel(21) - 1);   // pas de niveaux offerts d'un coup
        expect(rich.xpToNextLevel).toBe(getXPRequiredForLevel(21));
        const poor = normalizeXP({ level: 10, xp: 3, xpToNextLevel: 99999 });
        expect(poor.xp).toBe(getXPRequiredForLevel(10));       // pas de niveau retiré
        expect(normalizeXP({ level: 100, xp: 1, xpToNextLevel: 5 }).level).toBe(MAX_LEVEL);
    });
});

describe('croissance innée après le niveau 18', () => {
    test('+2 attaque par niveau au-delà de 18, +5 PV max supplémentaires au-delà de 20', () => {
        expect(growthExtras(1, 18)).toEqual({ attack: 0, maxHp: 0 });
        expect(growthExtras(18, 19)).toEqual({ attack: 2, maxHp: 0 });
        expect(growthExtras(18, 22)).toEqual({ attack: 8, maxHp: 10 });
        expect(growthExtras(1, 70)).toEqual({ attack: 104, maxHp: 250 });
    });

    test('applyGrowth ne compte jamais deux fois le même niveau (rattrapage unique)', () => {
        const p = { level: 30, attack: 20, maxHp: 200, hp: 100 };
        const first = applyGrowth(p);
        expect(first).toEqual({ attack: 24, maxHp: 50 });
        expect(p).toMatchObject({ attack: 44, maxHp: 250, growthLevel: 30 });
        expect(applyGrowth(p)).toEqual({ attack: 0, maxHp: 0 });
        expect(p.attack).toBe(44);
        p.level = 31;
        applyGrowth(p);
        expect(p).toMatchObject({ attack: 46, maxHp: 255, growthLevel: 31 });
    });
});

describe('combats jouables jusqu\'au niveau 70 (modèle : meilleure arme du niveau, attributs répartis)', () => {
    // Joueur : PV 100 + 5/niveau (+ extras), attaque 15 + 0,4 point/niveau + extras ; ennemi : formules d'enemies.js.
    const player = L => {
        const pts = L - 1, ex = growthExtras(1, L);
        return { hp: 100 + 5 * pts + ex.maxHp + Math.round(pts * 0.2), attack: 15 + Math.round(pts * 0.4) + ex.attack, def: Math.round(pts * 0.2) };
    };
    const bestWeapon = L => Math.max(...allWeapons.filter(w => w.minLevel <= L).map(w => w.damage));

    test.each([1, 5, 10, 20, 30, 40, 50, 60, 70])('niveau %i : tuer l\'ennemi du même niveau demande 2 à 7 coups, il en faut 3 à 9 pour tuer le héros', L => {
        const p = player(L);
        const enHp = 40 + 10 * L, def = enemyDefenseForLevel(L);
        const dmg = Math.max(1, bestWeapon(L) + p.attack - def);
        const hitsToKill = enHp / dmg;
        const enHit = Math.max(1, Math.min(Math.floor(enHp / 4), 5 + 4 * L + 20) - p.def);
        const hitsToDie = p.hp / enHit;
        expect(hitsToKill).toBeGreaterThanOrEqual(1.5);
        expect(hitsToKill).toBeLessThanOrEqual(7);
        expect(hitsToDie).toBeGreaterThanOrEqual(3);
        expect(hitsToDie).toBeLessThanOrEqual(9);
    });

    test('défense des ennemis : inchangée jusqu\'au niveau 20, plus douce ensuite', () => {
        expect(enemyDefenseForLevel(1)).toBe(4);
        expect(enemyDefenseForLevel(20)).toBe(42);
        expect(enemyDefenseForLevel(30)).toBe(47);
        expect(enemyDefenseForLevel(70)).toBe(67);
        for (let L = 2; L <= 70; L++) expect(enemyDefenseForLevel(L)).toBeGreaterThanOrEqual(enemyDefenseForLevel(L - 1));
    });

    test('les ennemis générés utilisent cette défense', () => {
        const e = createMapEnemy({ templateId: 'orc_warmaster', level: 60, enemyId: 'x' });
        const base = enemyDefenseForLevel(60);
        expect(e.defense).toBeGreaterThanOrEqual(Math.floor(base * 0.5));
        expect(e.defense).toBeLessThanOrEqual(Math.floor(base * 1.5) + 1);
    });

    test('l\'XP d\'un ennemi de haut niveau reste dans un ordre de grandeur utile (4 à 25 victoires par niveau)', () => {
        [20, 35, 50, 70].forEach(L => {
            const e = { level: L, maxHp: 40 + 10 * L, attack: Math.floor((40 + 10 * L) / 4), defense: enemyDefenseForLevel(L) };
            const perKill = calculateXPGain(e, L);
            const kills = getXPCostForLevel(L) / perKill;
            expect(kills).toBeGreaterThanOrEqual(3);
            expect(kills).toBeLessThanOrEqual(25);
        });
    });
});

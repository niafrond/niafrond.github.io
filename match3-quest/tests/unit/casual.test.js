import { describe, test, expect } from '@jest/globals';
import { calibrateEnemy } from '../../combatBalance.js';
import { planSpells, spellScore, casualDurationFactor, biasFor, stuffScore, planStuff, weaponScore, planWeapons, planAttributes, LOSS_STREAK_DEFENSIVE, LOSS_STREAK_TANK } from '../../casual.js';

const CATALOG = {
    casque_off: { id: 'casque_off', slot: 'head', minLevel: 1, atkBonus: 3 },
    casque_def: { id: 'casque_def', slot: 'head', minLevel: 1, defBonus: 2, maxHp: 40 },
    casque_haut: { id: 'casque_haut', slot: 'head', minLevel: 30, defBonus: 9 },
    bague: { id: 'bague', slot: 'ring', minLevel: 1, atkBonus: 1 }
};
const get = id => CATALOG[id];

describe('mode Casual', () => {
    test('le profil devient défensif puis protecteur avec les défaites', () => {
        expect(biasFor(0)).toBe('balanced');
        expect(biasFor(LOSS_STREAK_DEFENSIVE)).toBe('defensive');
        expect(biasFor(LOSS_STREAK_TANK)).toBe('tank');
    });
    test('le stuff est choisi pour le profil, sans dépasser le niveau', () => {
        const hero = { level: 5, stuffOwned: ['casque_off', 'casque_def', 'casque_haut', 'bague'], stuff: {} };
        expect(planStuff(hero, 'balanced', get).head).toBe('casque_off');   // 9 contre 6 + 2 = 8
        expect(planStuff(hero, 'defensive', get).head).toBe('casque_def');
        expect(planStuff(hero, 'balanced', get).ring).toBe('bague');
        expect(planStuff(hero, 'balanced', get).neck).toBeNull();
        expect(stuffScore(CATALOG.casque_haut, 'balanced')).toBeGreaterThan(0);
    });
    test('à égalité, la pièce portée est gardée', () => {
        const hero = { level: 5, stuffOwned: ['casque_off'], stuff: { head: 'casque_off' } };
        expect(planStuff(hero, 'balanced', get).head).toBe('casque_off');
    });
    test('armes : la meilleure en main droite, la deuxième en main gauche, la deux mains seulement si elle vaut mieux', () => {
        const hero = { level: 10, weapons: [
            { id: 'a', damage: 10, actionPoints: 4, minLevel: 1 },
            { id: 'b', damage: 8, actionPoints: 4, minLevel: 1 },
            { id: 'gros', damage: 12, actionPoints: 4, minLevel: 1, twoHanded: true },
            { id: 'trop_haut', damage: 99, actionPoints: 1, minLevel: 50 }
        ] };
        expect(planWeapons(hero, 'balanced')).toEqual({ right: 'a', left: 'b' });
        hero.weapons[2].damage = 40;
        expect(planWeapons(hero, 'balanced')).toEqual({ right: 'gros', left: null });
        expect(planWeapons({ level: 1, weapons: [] }, 'balanced')).toEqual({ right: null, left: null });
    });
    test('un profil prudent préfère une arme économe en points d\'action', () => {
        const cheap = { id: 'c', damage: 6, actionPoints: 2 }, big = { id: 'g', damage: 10, actionPoints: 6 };
        expect(weaponScore(big, 'balanced')).toBeGreaterThan(weaponScore(cheap, 'balanced') * 0.9);
        expect(weaponScore(cheap, 'tank')).toBeGreaterThan(weaponScore(big, 'tank'));
    });
    test('les points d\'attribut vont à l\'attribut en retard, plus de défense en profil défensif', () => {
        const attrs = { strength: 0, agility: 0, intelligence: 0, stamina: 0, morale: 0 };
        const balanced = planAttributes(attrs, 20, 'balanced');
        const tank = planAttributes(attrs, 20, 'tank');
        expect(balanced).toHaveLength(20);
        const count = (list, a) => list.filter(x => x === a).length;
        expect(count(tank, 'stamina') + count(tank, 'agility')).toBeGreaterThan(count(balanced, 'stamina') + count(balanced, 'agility'));
        expect(planAttributes(attrs, 0)).toEqual([]);
    });
    test('les combats Casual durent plus longtemps sans être plus dangereux par tour', () => {
        const base = { heroMaxHp: 300, heroLevel: 20, enemyLevel: 20, records: [] };
        for (const category of ['normal', 'boss']) {
            const std = calibrateEnemy({ ...base, category });
            const casual = calibrateEnemy({ ...base, category, durationFactor: casualDurationFactor(category) });
            expect(casual.hp).toBeGreaterThan(std.hp * 1.5);
            expect(casual.damageMult).toBeLessThanOrEqual(std.damageMult);
        }
    });
    test('sorts : les 4 mieux notés, couleurs variées, plus de soin en profil défensif', () => {
        const hero = { level: 10, activeSpells: [], availableSpells: [
            { id: 'r1', cost: { red: 3 }, dmg: 30 }, { id: 'r2', cost: { red: 3 }, dmg: 28 }, { id: 'r3', cost: { red: 3 }, dmg: 27 },
            { id: 'b1', cost: { blue: 3 }, dmg: 20 }, { id: 'g1', cost: { green: 4 }, heal: 30 }, { id: 'faible', cost: { yellow: 5 }, dmg: 2 },
            { id: 'trop_haut', cost: { red: 1 }, dmg: 999, minLevel: 50 }
        ] };
        const balanced = planSpells(hero, 'balanced');
        expect(balanced).toHaveLength(4);
        expect(balanced).toContain('b1');
        expect(balanced).not.toContain('trop_haut');
        expect(balanced).not.toContain('faible');
        expect(planSpells(hero, 'tank')).toContain('g1');
        expect(spellScore({ cost: 2, heal: 10 }, 'tank')).toBeGreaterThan(spellScore({ cost: 2, heal: 10 }, 'balanced'));
        expect(planSpells({ level: 1, availableSpells: [] }, 'balanced')).toEqual([]);
    });
});

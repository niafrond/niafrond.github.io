// Couloir de dégâts (damageCorridor.js) : armes en dégâts par PA, sorts de dégâts en dégâts par qì, ±25 % de la courbe de leur niveau.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allWeapons } from '../../weapons.js';
import { referenceAt, weaponOutliers, spellOutliers, spellQiCost, WEAPON_DAMAGE_PER_AP, SPELL_DAMAGE_PER_QI } from '../../damageCorridor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const spells = JSON.parse(readFileSync(join(root, 'spells.json'), 'utf8')).allSpells;
const show = list => list.map(x => `${x.id} (niv. ${x.level}) : ${x.ratio.toFixed(2)} pour ${x.reference.toFixed(2)} attendu (${x.deviation > 0 ? '+' : ''}${Math.round(x.deviation * 100)} %)`);

describe('couloir de dégâts : outils', () => {
    test('interpolation entre les points d\'ancrage', () => {
        expect(referenceAt(WEAPON_DAMAGE_PER_AP, 1)).toBe(3.8);
        expect(referenceAt(WEAPON_DAMAGE_PER_AP, 7.5)).toBeCloseTo(7.5, 5);
        expect(referenceAt(WEAPON_DAMAGE_PER_AP, 200)).toBe(35);
        expect(referenceAt(SPELL_DAMAGE_PER_QI, 8)).toBe(2.4);
    });
    test('coût en qì : nombre ou coloris', () => {
        expect(spellQiCost(10)).toBe(10);
        expect(spellQiCost({ red: 8, blue: 8 })).toBe(16);
    });
    test('une arme ou un sort trop fort ou trop faible est repéré', () => {
        expect(weaponOutliers([{ id: 'trop_fort', minLevel: 10, damage: 90, actionPoints: 6 }]).map(x => x.id)).toEqual(['trop_fort']);
        expect(weaponOutliers([{ id: 'trop_faible', minLevel: 30, damage: 100, actionPoints: 10 }]).map(x => x.id)).toEqual(['trop_faible']);
        expect(spellOutliers([{ id: 'sort_fou', type: 'damage', cost: 20, dmg: 90, minLevel: 5 }]).map(x => x.id)).toEqual(['sort_fou']);
        expect(weaponOutliers([{ id: 'normale', minLevel: 10, damage: 54, actionPoints: 6 }])).toEqual([]);
    });
});

describe('couloir de dégâts : contenu du jeu', () => {
    test('toutes les armes sont dans le couloir', () => {
        const out = weaponOutliers(allWeapons);
        expect(show(out)).toEqual([]);
    });
    test('tous les sorts de dégâts sont dans le couloir', () => {
        const out = spellOutliers(spells);
        expect(show(out)).toEqual([]);
    });
});

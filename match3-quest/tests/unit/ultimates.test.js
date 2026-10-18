// Sorts ultimes : jauge de rage chargée par les dégâts subis, 2 ultimes par classe, hors limite des 4 sorts.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import {
    RAGE_MAX, getUltimatesForClass, getUltimateById, rageFromDamage, addRage, resetRage, isRageFull,
    registerUltimateCinematic, playUltimateCinematic
} from '../../ultimates.js';
import { ultimateSpells, getSpellsByClass } from '../../spells.js';
import { playerClasses } from '../../classes.js';

describe('catalogue', () => {
    test('deux ultimes différents par classe', () => {
        for (const cls of Object.keys(playerClasses)) {
            const list = getUltimatesForClass(cls);
            expect(list).toHaveLength(2);
            expect(new Set(list.map(s => s.id)).size).toBe(2);
        }
        expect(ultimateSpells).toHaveLength(8);
    });
    test('très gourmands en mana et très puissants', () => {
        for (const sp of ultimateSpells) {
            const total = Object.values(sp.cost).reduce((a, b) => a + b, 0);
            expect(total).toBeGreaterThanOrEqual(50);
            expect(sp.dmg).toBeGreaterThanOrEqual(100);
            expect(sp.cinematic).toBeTruthy();
        }
    });
    test('hors des sorts de classe équipables', () => {
        const ids = new Set(ultimateSpells.map(s => s.id));
        for (const cls of Object.keys(playerClasses)) {
            expect(getSpellsByClass(cls, 99).some(s => ids.has(s.id))).toBe(false);
        }
        expect(getUltimateById('ultimateSkyWolf').class).toBe('barbarian');
    });
});

describe('jauge de rage', () => {
    test('gain proportionnel aux PV perdus, au moins 1', () => {
        expect(rageFromDamage(0, 100)).toBe(0);
        expect(rageFromDamage(1, 1000)).toBe(1);
        expect(rageFromDamage(20, 100)).toBe(30);
    });
    test('plafonnée, pleine à RAGE_MAX, remise à zéro', () => {
        const hero = {};
        expect(addRage(hero, 60)).toBe(60);
        expect(isRageFull(hero)).toBe(false);
        expect(addRage(hero, 100)).toBe(RAGE_MAX - 60);
        expect(isRageFull(hero)).toBe(true);
        resetRage(hero);
        expect(hero.rage).toBe(0);
    });
});

describe('cinématique (terrain préparé)', () => {
    test('sans scène enregistrée, résolue immédiatement ; sinon la scène est jouée', async () => {
        await expect(playUltimateCinematic({ cinematic: 'inconnue' })).resolves.toBeUndefined();
        const played = [];
        registerUltimateCinematic('test-scene', async sp => { played.push(sp.id); });
        await playUltimateCinematic({ id: 'x', cinematic: 'test-scene' });
        expect(played).toEqual(['x']);
    });
});

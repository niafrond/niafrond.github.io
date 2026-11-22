import { describe, test, expect } from '@jest/globals';
import { grimoireSynergyPct, alternationPct, applySynergy, SYNERGY_MAX_PCT } from '../../synergy.js';

const red = { id: 'a', color: 'red', cost: 10 };
const redBlue = { id: 'b', cost: { red: 20, blue: 20 } };
const green = { id: 'c', color: 'green', cost: 10 };

describe('synergies de combat', () => {
    test('grimoire : +5 % si un AUTRE sort partage une couleur', () => {
        expect(grimoireSynergyPct([red, redBlue], red)).toBe(5);
        expect(grimoireSynergyPct([red, green], red)).toBe(0);
        expect(grimoireSynergyPct([red], red)).toBe(0);   // le sort lui-même ne compte pas
        expect(grimoireSynergyPct(undefined, red)).toBe(0);
    });
    test('alternance : +5 % quand la classe change, rien au premier coup', () => {
        expect(alternationPct(null, 'assassin')).toBe(0);
        expect(alternationPct('assassin', 'assassin')).toBe(0);
        expect(alternationPct('assassin', 'monk')).toBe(5);
    });
    test('cumul plafonné à +10 %, arrondi inférieur, dégâts nuls inchangés', () => {
        expect(SYNERGY_MAX_PCT).toBe(10);
        expect(applySynergy(100, 5, 5)).toBe(110);
        expect(applySynergy(100, 5, 5, 5)).toBe(110);
        expect(applySynergy(19, 5)).toBe(19);   // 19,95 → 19
        expect(applySynergy(0, 5)).toBe(0);
        expect(applySynergy(50)).toBe(50);
    });
});

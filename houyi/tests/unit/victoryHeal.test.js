import { describe, test, expect } from '@jest/globals';
import { victoryHealPct, victoryHealAmount, victoryHealBreakdown, VICTORY_HEAL_MAX } from '../../victoryHeal.js';

describe('houyi · soin de victoire', () => {
    test('part de base au niveau 1 sans Stamina', () => { expect(victoryHealPct(1, 0)).toBe(5); });
    test('grandit avec le niveau', () => { expect(victoryHealPct(40, 0)).toBeGreaterThan(victoryHealPct(10, 0)); });
    test('grandit avec les points de Stamina', () => { expect(victoryHealPct(20, 30)).toBeGreaterThan(victoryHealPct(20, 0)); });
    test('plafonnée', () => { expect(victoryHealPct(70, 69)).toBeLessThanOrEqual(VICTORY_HEAL_MAX); });
    test('montant : part des PV max, au moins 1', () => {
        expect(victoryHealAmount({ maxHp: 200, level: 1, attributes: { stamina: 0 } })).toBe(10);
        expect(victoryHealAmount({ maxHp: 1, level: 1, attributes: {} })).toBe(1);
    });
});

describe('houyi · détail du soin de victoire', () => {
    test('niveau 1 sans Stamina : seulement la base', () => {
        expect(victoryHealBreakdown(1, 0)).toBe('5 % des PV max : 5 de base');
    });
    test('niveau 20 avec 10 points de Stamina : base + niveau + Stamina', () => {
        expect(victoryHealBreakdown(20, 10)).toBe('10 % des PV max : 5 de base + 3 de niveau + 3 de Stamina');
    });
    test('plafond signalé', () => {
        expect(victoryHealBreakdown(70, 200)).toMatch(/\(plafond\)$/);
        expect(victoryHealBreakdown(70, 200)).toMatch(/^35 %/);
    });
});

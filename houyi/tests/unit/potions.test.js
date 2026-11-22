import { describe, test, expect } from '@jest/globals';
import { POTIONS, POTION_SIZES, potionHeal, potionPrice, buyPotion, drinkPotion, drinkBlockReason, normalizePotions, applyQueuedPotion } from '../../potions.js';

const hero = (extra = {}) => ({ hp: 20, maxHp: 100, gold: 1000, combatPoints: 3, ...extra });

describe('potions de soin à usage unique', () => {
    test('trois tailles : 25 %, 50 % et 75 % des PV max, sans point d\'action (déjà payées en or)', () => {
        expect(POTION_SIZES.map(s => [POTIONS[s].healPct, POTIONS[s].actionPoints])).toEqual([[25, 0], [50, 0], [75, 0]]);
        expect(POTION_SIZES.map(s => potionHeal(hero(), s))).toEqual([25, 50, 75]);
    });
    test('le prix monte avec la région et avec la taille', () => {
        expect(potionPrice('small', 1)).toBeLessThan(potionPrice('small', 30));
        expect(potionPrice('small', 10)).toBeLessThan(potionPrice('medium', 10));
        expect(potionPrice('medium', 10)).toBeLessThan(potionPrice('large', 10));
    });
    test('on peut en acheter beaucoup ; chaque achat coûte de l\'or', () => {
        const h = hero();
        for (let i = 0; i < 5; i++) expect(buyPotion(h, 'small', 1).ok).toBe(true);
        expect(h.potions.small).toBe(5);
        expect(buyPotion(hero({ gold: 1 }), 'large', 1).ok).toBe(false);
        expect(buyPotion(h, 'enorme', 1).ok).toBe(false);
    });
    test('boire retire UNE potion et rend les PV, plafonnés', () => {
        const h = hero({ hp: 90 });
        normalizePotions(h); h.potions.small = 2;
        const res = drinkPotion(h, 'small');
        expect(res).toMatchObject({ ok: true, healed: 10 });
        expect(h.hp).toBe(100);
        expect(h.potions.small).toBe(1);
        expect(drinkPotion(h, 'small').ok).toBe(false);   // PV pleins : la potion n'est pas gaspillée
        expect(h.potions.small).toBe(1);
    });
    test("en combat : aucun point d'action (la potion a été payée en or), même sans PA", () => {
        const h = hero({ combatPoints: 0 });
        normalizePotions(h); h.potions.large = 1; h.potions.medium = 1;
        expect(drinkBlockReason(h, 'large', true)).toBeNull();
        expect(drinkBlockReason(h, 'large', false)).toBeNull();
        expect(drinkPotion(h, 'medium', { inCombat: true }).ok).toBe(true);
        expect(h.combatPoints).toBe(0);
        expect(h.hp).toBe(70);
    });
    test('un Hou Yi à terre (0 PV) ne se relève pas en buvant hors combat : il faut un point de repos ou une résurrection', () => {
        const down = hero({ hp: 0, potions: { small: 2, medium: 0, large: 0 } });
        expect(drinkBlockReason(down, 'small', false)).toMatch(/à terre/);
        expect(drinkPotion(down, 'small').ok).toBe(false);
        expect(down.hp).toBe(0);
    });
    test("potion en file : si Hou Yi est tombé entre-temps, elle est rendue au sac et ne soigne rien", () => {
        const h = hero({ hp: 0, potions: { small: 0, medium: 0, large: 0 } });
        expect(applyQueuedPotion(h, 'small', true)).toEqual({ ok: false, healed: 0, refunded: true });
        expect(h.hp).toBe(0);
        expect(h.potions.small).toBe(1);
        expect(applyQueuedPotion(hero({ hp: 0 }), 'small', false).refunded).toBe(true);   // 0 PV sans drapeau : même règle
    });
    test("potion en file : héros debout, soin plafonné aux PV max (cas limite)", () => {
        const h = hero({ hp: 95, potions: { small: 0, medium: 0, large: 0 } });
        expect(applyQueuedPotion(h, 'small', false)).toEqual({ ok: true, healed: 5, refunded: false });
        expect(h.hp).toBe(100);
        expect(h.potions.small).toBe(0);
        expect(applyQueuedPotion(h, 'enorme').ok).toBe(false);
    });
});

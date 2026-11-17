import { describe, test, expect } from '@jest/globals';
import { POTIONS, POTION_SIZES, potionHeal, potionPrice, buyPotion, drinkPotion, drinkBlockReason, normalizePotions } from '../../potions.js';

const hero = (extra = {}) => ({ hp: 20, maxHp: 100, gold: 1000, combatPoints: 3, ...extra });

describe('potions de soin à usage unique', () => {
    test('trois tailles : 25 %, 50 % et 75 % des PV max pour 1, 2 et 3 PA', () => {
        expect(POTION_SIZES.map(s => [POTIONS[s].healPct, POTIONS[s].actionPoints])).toEqual([[25, 1], [50, 2], [75, 3]]);
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
    test('en combat : coûte des points d\'action, refusée s\'il en manque', () => {
        const h = hero({ combatPoints: 2 });
        normalizePotions(h); h.potions.large = 1; h.potions.medium = 1;
        expect(drinkBlockReason(h, 'large', true)).toMatch(/3 points d'action/);
        expect(drinkBlockReason(h, 'large', false)).toBeNull();   // hors combat : gratuit
        expect(drinkPotion(h, 'medium', { inCombat: true }).ok).toBe(true);
        expect(h.combatPoints).toBe(0);
        expect(h.hp).toBe(70);
    });
});

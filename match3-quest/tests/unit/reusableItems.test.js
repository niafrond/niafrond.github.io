// Objets rechargeables : charges consommées à l'usage, rechargées au retour en exploration.
import { describe, test, expect } from '@jest/globals';
import { allItems, useItem, rechargeReusableItems, tickReusableRecharge, describeRecharge, getRechargeTurns } from '../../items.js';

const fresh = id => ({ ...allItems.find(i => i.id === id) });
const makePlayer = inventory => ({ hp: 10, maxHp: 100, attack: 5, defense: 0, mana: { red: 0 }, maxMana: 100, inventory });

describe('objets rechargeables', () => {
    test('un objet neuf (sans chargesLeft) est utilisable et consomme une charge', () => {
        const vial = fresh('honey_vial');
        const player = makePlayer([vial]);
        const res = useItem('honey_vial', player, null, 0);
        expect(res.success).toBe(true);
        expect(player.hp).toBe(35);
        expect(vial.chargesLeft).toBe(vial.chargesPerCycle - 1);
        expect(player.inventory).toHaveLength(1);
    });

    test('plus de charge : refus jusqu\'à la recharge', () => {
        const vial = { ...fresh('honey_vial'), chargesLeft: 0 };
        const player = makePlayer([vial]);
        expect(useItem('honey_vial', player, null, 0).success).toBe(false);
        const recharged = rechargeReusableItems(player);
        expect(recharged).toHaveLength(1);
        expect(vial.chargesLeft).toBe(vial.chargesPerCycle);
        expect(useItem('honey_vial', player, null, 0).success).toBe(true);
    });

    test('rechargeReusableItems ignore les objets pleins ou non rechargeables', () => {
        const player = makePlayer([fresh('honey_vial'), { id: 'x', type: 'consumable' }]);
        expect(rechargeReusableItems(player)).toEqual([]);
    });
});

describe('recharge en combat : « x tours pour se recharger »', () => {
    test('chaque objet rechargeable annonce son délai (rechargeTurns) dans le catalogue et la description', () => {
        allItems.filter(i => i.type === 'reusable').forEach(i => {
            expect(i.rechargeTurns).toBeGreaterThanOrEqual(2);
            expect(i.description).toContain(`rechargé en ${i.rechargeTurns} tours`);
        });
    });
    test('dernière charge utilisée : le compte à rebours démarre ; rechargé après x tours', () => {
        const vial = { ...fresh('honey_vial'), chargesLeft: 1 };
        const player = makePlayer([vial]);
        expect(useItem('honey_vial', player, null, 0).success).toBe(true);
        expect(vial.chargesLeft).toBe(0);
        expect(vial.rechargeLeft).toBe(vial.rechargeTurns);
        const refus = useItem('honey_vial', player, null, 0);
        expect(refus.success).toBe(false);
        expect(refus.message).toMatch(/recharge encore 4 tours/);
        for (let t = 1; t < vial.rechargeTurns; t++) {
            expect(tickReusableRecharge(player)).toEqual([]);
            expect(vial.chargesLeft).toBe(0);
        }
        expect(describeRecharge(vial)).toBe('recharge en 1 tour');
        expect(tickReusableRecharge(player)).toEqual([vial]);
        expect(vial.chargesLeft).toBe(vial.chargesPerCycle);
        expect(useItem('honey_vial', player, null, 0).success).toBe(true);
    });
    test('un objet qui a encore des charges ne se recharge pas tout seul ; les non rechargeables sont ignorés', () => {
        const vial = { ...fresh('honey_vial'), chargesLeft: 2 };
        const player = makePlayer([vial, { id: 'x', type: 'consumable' }]);
        expect(tickReusableRecharge(player)).toEqual([]);
        expect(vial.chargesLeft).toBe(2);
    });
    test('anciennes sauvegardes sans rechargeTurns : délai du catalogue', () => {
        const old = { id: 'power_talisman', type: 'reusable', chargesPerCycle: 2, chargesLeft: 0 };
        expect(getRechargeTurns(old)).toBe(6);
        const player = makePlayer([old]);
        for (let t = 0; t < 5; t++) tickReusableRecharge(player);
        expect(old.chargesLeft).toBe(0);
        tickReusableRecharge(player);
        expect(old.chargesLeft).toBe(2);
    });
    test('la recharge d\'exploration remet aussi le compteur à zéro', () => {
        const vial = { ...fresh('honey_vial'), chargesLeft: 0, rechargeLeft: 3 };
        rechargeReusableItems(makePlayer([vial]));
        expect(vial.rechargeLeft).toBe(0);
        expect(vial.chargesLeft).toBe(vial.chargesPerCycle);
    });
});

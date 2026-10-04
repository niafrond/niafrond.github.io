// Objets rechargeables : charges consommées à l'usage, rechargées au retour en exploration.
import { describe, test, expect } from '@jest/globals';
import { allItems, useItem, rechargeReusableItems } from '../../items.js';

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

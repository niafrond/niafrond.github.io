import { repairMaxMana, equipRelic, unequipRelic, allItems } from '../../items.js';

const relic = allItems.find(i => i.type === 'artifact' && i.effect?.permMaxMana);

describe('réserve de qì de base', () => {
    test('une valeur dérivée est recalculée : 50 + qì max des reliques portées', () => {
        const hero = { level: 70, maxMana: 6, inventory: [{ ...relic, applied: true }, { ...relic, id: 'autre', applied: false }] };
        expect(repairMaxMana(hero)).toBe(50 + relic.effect.permMaxMana);
        expect(hero.maxMana).toBe(50 + relic.effect.permMaxMana);
    });
    test('sans relique portée : 50, et porter puis retirer ne dérive plus', () => {
        const hero = { level: 70, maxMana: 3, hp: 10, maxHp: 10, inventory: [{ ...relic }] };
        expect(repairMaxMana(hero)).toBe(50);
        equipRelic(hero, hero.inventory[0]);
        unequipRelic(hero, hero.inventory[0]);
        expect(repairMaxMana(hero)).toBe(50);
    });
});

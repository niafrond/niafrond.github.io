import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { allItems, useItem } from '../../items.js';
import { reuseOf, isSingleUse, isReusableRelic, reuseLabel, REUSABLE_IDS } from '../../itemReuse.js';

const hero = (inventory, extra = {}) => ({ hp: 10, maxHp: 100, level: 50, mana: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 }, manaCaps: { red: 50, blue: 50, green: 50, yellow: 50, purple: 50 }, statusEffects: {}, inventory, activeInventoryIndex: 0, activeInventoryIndex2: null, ...extra });
const copy = id => ({ ...allItems.find(i => i.id === id) });

describe('réutilisabilité des objets', () => {
    test('tout objet utilisable du catalogue est à usage unique ou relique réutilisable', () => {
        allItems.filter(i => i.type === 'reusable').forEach(i => expect(['single', 'relic']).toContain(i.reuse));
    });
    test('les objets durables sont des reliques réutilisables, les élixirs et pilules sont à usage unique', () => {
        expect(isReusableRelic(copy('power_talisman'))).toBe(true);
        expect(isReusableRelic(copy('phoenixFeather'))).toBe(true);
        expect(isSingleUse(copy('healthPotion'))).toBe(true);
        expect(isSingleUse(copy('antidotePill'))).toBe(true);
        REUSABLE_IDS.forEach(id => expect(allItems.some(i => i.id === id)).toBe(true));   // pas d'id fantôme
    });
    test('un objet à usage unique ne parle plus de recharge', () => {
        allItems.filter(i => i.reuse === 'single').forEach(i => expect(i.description).not.toMatch(/rechargé en/));
    });
    test('libellés', () => {
        expect(reuseLabel(copy('power_talisman'))).toBe('Relique réutilisable');
        expect(reuseLabel(copy('healthPotion'))).toBe('Usage unique');
        expect(reuseOf({ type: 'shield' })).toBeNull();
    });
    test("un objet à usage unique est consommé à l'usage", () => {
        const h = hero([copy('healthPotion')]);
        const res = useItem('healthPotion', h, {}, 0);
        expect(res.success).toBe(true);
        expect(h.inventory).toHaveLength(0);
    });
    test('une relique réutilisable reste dans le sac et se décharge', () => {
        const h = hero([copy('honey_vial')]);
        const res = useItem('honey_vial', h, {}, 0);
        expect(res.success).toBe(true);
        expect(h.inventory).toHaveLength(1);
        expect(h.inventory[0].chargesLeft).toBe(h.inventory[0].chargesPerCycle - 1);
    });
});

import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { ALTERATION_LABELS, POSITIVE_KEYS, inflictBuff, inflictAlteration, tickAlterations } from '../../alterations.js';
import { activeStatuses } from '../../statusBadges.js';
import { allItems, useItem } from '../../items.js';

const hero = (extra = {}) => ({ hp: 50, maxHp: 100, level: 30, name: 'Hou Yi', mana: {}, manaCaps: {}, statusEffects: {}, inventory: [], ...extra });

describe('altérations positives', () => {
    test('Hâte, Concentré et Élan sont des altérations positives', () => {
        expect(POSITIVE_KEYS).toEqual(['haste', 'focused', 'surge']);
        POSITIVE_KEYS.forEach(k => expect(ALTERATION_LABELS[k].positive).toBe(true));
    });
    test("elles se posent sur soi, même immunisé aux effets négatifs, et s'estompent avec les tours", () => {
        const h = hero({ statusEffects: { immunityEffects: 2 } });
        expect(inflictAlteration(h, 'chilled', 2)).toBe(false);   // le malus est bloqué
        expect(inflictBuff(h, 'haste', 2)).toBe(true);            // pas le bonus
        expect(h.statusEffects.haste).toBe(2);
        tickAlterations(h); tickAlterations(h);
        expect(h.statusEffects.haste).toBeUndefined();
        expect(inflictBuff(h, 'inconnue', 2)).toBe(false);
    });
    test('elles apparaissent en bonus (pastille verte) sur la carte', () => {
        const h = hero({ statusEffects: { haste: 3, focused: 1 } });
        const buffs = activeStatuses(h).filter(s => s.kind === 'buff').map(s => s.id);
        expect(buffs).toEqual(expect.arrayContaining(['haste', 'focused']));
    });
    test("les pilules de Célérité et l'infusion de Concentration en donnent", () => {
        const item = id => ({ ...allItems.find(i => i.id === id) });
        const h = hero({ inventory: [item('swiftPotion')], combatPoints: 0 });
        expect(useItem('swiftPotion', h, {}, 0).success).toBe(true);
        expect(h.statusEffects.haste).toBe(3);
        const h2 = hero({ inventory: [item('celestial_swiftness_pill')], combatPoints: 0 });
        useItem('celestial_swiftness_pill', h2, {}, 0);
        expect(h2.statusEffects.surge).toBe(3);
        const h3 = hero({ inventory: [item('focusPotion')] });
        useItem('focusPotion', h3, {}, 0);
        expect(h3.statusEffects.focused).toBe(4);
    });
});

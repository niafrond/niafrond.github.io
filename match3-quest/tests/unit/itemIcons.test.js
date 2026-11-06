import { describe, test, expect } from '@jest/globals';
import { allItems } from '../../items.js';
import { itemIcon, itemFamily, ITEM_FAMILIES, RARITY_HEX } from '../../icons.js';

describe('pictos d\'objets', () => {
    test('chaque objet a une famille connue et un picto SVG sans emoji ni non ASCII', () => {
        for (const item of allItems) {
            expect(ITEM_FAMILIES).toContain(itemFamily(item));
            const svg = itemIcon(item);
            expect(svg.startsWith('<svg')).toBe(true);
            expect(svg).toMatch(/^[\x20-\x7e]*$/);
        }
    });

    test('les familles suivent le nom : pilule (boîte à remède), élixir, tisane, talisman, plume, bague', () => {
        const fam = id => itemFamily(allItems.find(i => i.id === id));
        expect(fam('manaPotion')).toBe('remedy');
        expect(fam('healthPotion')).toBe('flask');
        expect(fam('thousand_springs_tisane')).toBe('cup');
        expect(fam('power_talisman')).toBe('talisman');
        expect(fam('phoenixFeather')).toBe('feather');
        expect(fam('red_phoenix_ring')).toBe('ring');
        expect(fam('jade_shield')).toBe('shield');
    });

    test('la teinte suit la rareté', () => {
        for (const [rarity, hex] of Object.entries(RARITY_HEX)) expect(itemIcon({ name: 'Pilule', rarity })).toContain(hex);
    });

    test('un objet inconnu retombe sur un flacon', () => {
        expect(itemFamily({ name: 'Truc', type: 'reusable' })).toBe('flask');
    });
});

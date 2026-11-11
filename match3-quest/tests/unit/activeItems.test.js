// Deux objets actifs au combat : index, normalisation, décalage après vente / jet.
import './fixtures/playerForge.js';
import { describe, test, expect } from '@jest/globals';
import { activeItemIndexes, shiftActiveItemIndexes, allItems } from '../../items.js';
import { MAX_ACTIVE_ITEMS, MAX_ACTIVE_SPELLS } from '../../constants.js';

describe('objets actifs', () => {
    test('limites : 2 objets, 4 sorts', () => {
        expect(MAX_ACTIVE_ITEMS).toBe(2);
        expect(MAX_ACTIVE_SPELLS).toBe(4);
    });
    test('index lus dans l\'ordre objet 1, objet 2 (null si vide)', () => {
        expect(activeItemIndexes({ activeInventoryIndex: 3, activeInventoryIndex2: null })).toEqual([3, null]);
        expect(activeItemIndexes({})).toEqual([null, null]);
    });
    test('un objet retiré du sac décale les index suivants', () => {
        const h = { activeInventoryIndex: 4, activeInventoryIndex2: 2 };
        shiftActiveItemIndexes(h, 1);
        expect(h).toMatchObject({ activeInventoryIndex: 3, activeInventoryIndex2: 1 });
    });
    test('l\'objet 2 retiré se vide, l\'objet 1 est renormalisé par le jeu', () => {
        const h = { activeInventoryIndex: 0, activeInventoryIndex2: 2 };
        shiftActiveItemIndexes(h, 2);
        expect(h.activeInventoryIndex2).toBeNull();
        expect(h.activeInventoryIndex).toBe(0);
    });
    test('le catalogue offre au moins deux objets d\'usage distincts de bas niveau', () => {
        expect(allItems.filter(i => i.type === 'reusable' && i.minLevel <= 5).length).toBeGreaterThanOrEqual(2);
    });
});

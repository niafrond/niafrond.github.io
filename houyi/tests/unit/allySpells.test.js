import { describe, it, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { MAX_ACTIVE_SPELLS } from '../../constants.js';
import { allyPool, activeAllySpellIds, availableAllySpells, equipAllySpell, unequipAllySpell } from '../../allySpells.js';

const hero = (extra = {}) => ({ level: 30, ...extra });

describe('sorts actifs par compagnon', () => {
    it('par défaut : les premiers sorts de sa classe, au plus MAX_ACTIVE_SPELLS', () => {
        const h = hero();
        const ids = activeAllySpellIds(h, 'monk');
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.length).toBeLessThanOrEqual(MAX_ACTIVE_SPELLS);
        expect(ids).toEqual(allyPool(h, 'monk').slice(0, ids.length).map(s => s.id));
    });

    it('retirer un sort ne concerne que ce compagnon', () => {
        const h = hero();
        const monk = activeAllySpellIds(h, 'monk');
        const shaman = activeAllySpellIds(h, 'shaman');
        const res = unequipAllySpell(h, 'monk', monk[0]);
        expect(res.ok).toBe(true);
        expect(activeAllySpellIds(h, 'monk')).toEqual(monk.slice(1));
        expect(activeAllySpellIds(h, 'shaman')).toEqual(shaman);
        expect(availableAllySpells(h, 'monk').map(s => s.id)).toContain(monk[0]);
    });

    it('rééquiper un sort retiré, puis refus d\'un doublon', () => {
        const h = hero();
        const first = activeAllySpellIds(h, 'monk')[0];
        unequipAllySpell(h, 'monk', first);
        expect(equipAllySpell(h, 'monk', first).ok).toBe(true);
        expect(equipAllySpell(h, 'monk', first).ok).toBe(false);
    });

    it('liste pleine : il faut désigner le sort remplacé', () => {
        const h = hero();
        const spare = availableAllySpells(h, 'monk')[0];
        if (!spare) return;   // classe sans sort en réserve à ce niveau
        const ids = activeAllySpellIds(h, 'monk');
        if (ids.length < MAX_ACTIVE_SPELLS) return;
        expect(equipAllySpell(h, 'monk', spare.id).needsReplace).toBe(true);
        expect(equipAllySpell(h, 'monk', spare.id, ids[0]).ok).toBe(true);
        expect(activeAllySpellIds(h, 'monk')).toContain(spare.id);
        expect(activeAllySpellIds(h, 'monk')).not.toContain(ids[0]);
    });

    it('refuse un sort d\'une autre classe et un personnage inconnu', () => {
        const h = hero();
        const other = allyPool(h, 'shaman')[0];
        expect(equipAllySpell(h, 'monk', other.id).ok).toBe(false);
        expect(unequipAllySpell(h, 'assassin', 'x').ok).toBe(false);
    });

    it('une liste choisie vide reste vide (pas de remplissage automatique)', () => {
        const h = hero({ allySpells: { monk: [] } });
        expect(activeAllySpellIds(h, 'monk')).toEqual([]);
    });
});

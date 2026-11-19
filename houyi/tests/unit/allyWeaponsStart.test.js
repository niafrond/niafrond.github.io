import { describe, it, expect } from '@jest/globals';
import { ensureAllyWeapon, ensureAllyWeapons, startingWeaponFor, weaponsFor, allyEquippedWeapon } from '../../allyWeapons.js';
import { ALLIES, ALLY_IDS } from '../../allies.js';
import { grantClass } from '../../classRoster.js';

const hero = (extra = {}) => ({ level: 1, weapons: [], allyWeapons: {}, ...extra });

describe('arme de départ des compagnons', () => {
    it.each(ALLY_IDS)('%s a une arme de départ de son type, utilisable au niveau 1', id => {
        const w = startingWeaponFor(id);
        expect(w).toBeTruthy();
        expect(w.type).toBe(ALLIES[id].weapon);
        expect(w.minLevel).toBe(1);
    });

    it('un compagnon recruté sans arme reçoit son arme de départ et l\'équipe', () => {
        const h = hero();
        const r = ensureAllyWeapon(h, 'monk');
        expect(r.given).toBeTruthy();
        expect(h.weapons).toContain(r.given);
        expect(allyEquippedWeapon(h, 'monk')?.id).toBe(r.given.id);
    });

    it('ne donne rien de plus s\'il porte déjà une arme', () => {
        const h = hero();
        ensureAllyWeapon(h, 'monk');
        const n = h.weapons.length;
        const again = ensureAllyWeapon(h, 'monk');
        expect(again).toEqual({ given: null, equipped: null });
        expect(h.weapons).toHaveLength(n);
    });

    it('équipe une arme de son type déjà dans le sac sans en ajouter', () => {
        const h = hero();
        const owned = startingWeaponFor('templar');
        h.weapons.push(owned);
        const r = ensureAllyWeapon(h, 'templar');
        expect(r.given).toBeNull();
        expect(r.equipped?.id).toBe(owned.id);
        expect(h.weapons).toHaveLength(1);
    });

    it('deux compagnons n\'équipent pas la même arme', () => {
        const h = hero();
        ensureAllyWeapon(h, 'monk');
        ensureAllyWeapon(h, 'alchemist');
        expect(h.allyWeapons.monk).not.toBe(h.allyWeapons.alchemist);
        expect(weaponsFor(h, 'monk').length).toBeGreaterThan(0);
    });

    it('une sauvegarde ancienne : tous les compagnons recrutés sont armés', () => {
        const h = hero();
        grantClass(h, 'monk'); grantClass(h, 'shaman');
        const done = ensureAllyWeapons(h);
        expect(done.map(d => d.classId).sort()).toEqual(['monk', 'shaman']);
        expect(allyEquippedWeapon(h, 'monk')).toBeTruthy();
        expect(allyEquippedWeapon(h, 'shaman')).toBeTruthy();
        expect(ensureAllyWeapons(h)).toEqual([]);
    });
});

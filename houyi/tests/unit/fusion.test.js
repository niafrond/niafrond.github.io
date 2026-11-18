import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { FUSIONS, fusionOffers, fuseWeapons, fusionFee, isForge } from '../../fusion.js';
import { getWeaponById, allWeapons, companionWeapons } from '../../weapons.js';
import { MERCHANTS, merchantStock } from '../../merchants.js';

const hero = (ids, extra = {}) => ({ level: 40, gold: 10000, weapons: ids.map(id => ({ id })), equippedWeapon: null, ...extra });

test('chaque recette relie deux armes et un résultat existants, réservé à la fusion', () => {
    FUSIONS.forEach(f => {
        expect(getWeaponById(f.a)).toBeTruthy();
        expect(getWeaponById(f.b)).toBeTruthy();
        const r = getWeaponById(f.result);
        expect(r.fusionOnly).toBe(true);
        expect(r.damage).toBeGreaterThan(Math.max(getWeaponById(f.a).damage, getWeaponById(f.b).damage));
        expect(fusionFee(f)).toBeGreaterThan(0);
    });
});

test('les armes de fusion ne sont jamais en boutique', () => {
    MERCHANTS.forEach(m => {
        const weapons = merchantStock(m.id, 0, 99).filter(o => o.kind === 'weapon');
        weapons.forEach(o => expect([...allWeapons, ...companionWeapons].find(w => w.id === o.id).fusionOnly).toBeFalsy());
    });
});

test('fusion : consomme les deux armes et l\'or', () => {
    const h = hero(['arc_de_feu', 'arc_de_forge', 'arc_leger']);
    const res = fuseWeapons(h, 'brasier_royal');
    expect(res.ok).toBe(true);
    expect(h.weapons.map(w => w.id).sort()).toEqual(['arc_du_brasier_royal', 'arc_leger']);
    expect(h.gold).toBe(10000 - res.offer.fee);
});

test('fusion refusée : arme manquante, en main, trop peu d\'or', () => {
    expect(fuseWeapons(hero(['arc_de_feu']), 'brasier_royal').ok).toBe(false);
    expect(fuseWeapons(hero(['arc_de_feu', 'arc_de_forge'], { equippedWeapon: { id: 'arc_de_feu' } }), 'brasier_royal').ok).toBe(false);
    expect(fuseWeapons(hero(['arc_de_feu', 'arc_de_forge'], { gold: 1 }), 'brasier_royal').ok).toBe(false);
    expect(fuseWeapons(hero([]), 'inconnue').ok).toBe(false);
});

test('seuls certains marchands sont forgerons', () => {
    expect(isForge('merchant_volcan')).toBe(true);
    expect(isForge('merchant_rizieres')).toBe(false);
    expect(fusionOffers(hero([])).every(o => !o.ready)).toBe(true);
});

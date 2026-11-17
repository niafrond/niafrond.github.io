import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { readGameSource } from './fixtures/gameSource.js';

// game.js dépend du DOM : vérification statique que sorts, armes et objets passent tous par bindTooltip (appui long).
const src = readGameSource();   // game.js + modules game*.js extraits

describe('infobulles : appui bref sans infobulle', () => {
    it('plus aucun appui direct (touchstart / mousedown) n\'affiche une infobulle', () => {
        expect(src).not.toMatch(/addEventListener\('(touchstart|mousedown)', showDetails/);
    });
    it('sorts, armes et objets utilisent bindTooltip', () => {
        expect((src.match(/bindTooltip\(/g) || []).length).toBeGreaterThanOrEqual(7);
    });
    it('l\'infobulle n\'apparaît qu\'après un appui long', () => {
        expect(src).toMatch(/TOOLTIP_LONG_PRESS_MS = \d{3}/);
        expect(src).toMatch(/pointerType === 'mouse'/);
    });
});

describe('armes des anciennes sauvegardes', () => {
    it('equipWeapon et loadGameData passent par le catalogue (getWeaponById, ids hérités convertis)', () => {
        expect(src).toMatch(/const weapon = getWeaponById\(weaponId\);/);
        expect(src).toMatch(/const catalogWeapon = w => \(w\?\.id \? getWeaponById\(w\.id\) : null\);/);
    });
});

describe('bouclier et arme à deux mains', () => {
    it('equipGear range l\'arme à deux mains au lieu de refuser sans rien dire', () => {
        expect(src).toMatch(/const freedWeapon = player\.equipment\.rightHand\?\.twoHanded/);
        expect(src).toMatch(/if\(freedWeapon\) createWeaponButton\(\);/);
    });
});

describe('infobulle d\'un sort : coût en qì coloré', () => {
    it('showSpellTooltip affiche les pastilles de coût en tête de la fiche', () => {
        expect(src).toMatch(/showSpellTooltip\(button, spell, costHtml = ''\)/);
        expect(src).toMatch(/Qì : \$\{costHtml\}/);
    });
    it('les trois listes de sorts passent leur coût (spellCostHtml) à l\'infobulle', () => {
        expect(src).toMatch(/showSpellTooltip\(btn, sp, costHTML\)/);
        expect(src).toMatch(/showSpellTooltip\(div, sp, costDisplay\)/);
        expect(src).toMatch(/showSpellTooltip\(div, sp, spellCostHtml\(sp, player\)\)/);
    });
});

describe('absorption par bouclier : dégâts classiques', () => {
    it('plus d\'annonce d\'absorption : le bouclier se lit sur la barre de PV', () => {
        expect(src).not.toMatch(/lastDamageAbsorbed|ABSORBÉ/);
    });
});

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';

// game.js dépend du DOM : vérification statique que sorts, armes et objets passent tous par bindTooltip (appui long).
const src = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');

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

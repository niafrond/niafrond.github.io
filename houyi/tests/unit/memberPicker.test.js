// Personnage choisi en combat : une couleur par personnage, reprise par son bouton éclairé, la flèche et le cadre de ses actions.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MEMBER_COLORS, memberColor } from '../../allies.js';
import { CLASS_IDS } from '../../classRoster.js';

const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');

describe('personnage choisi en combat', () => {
    test('chaque classe a sa couleur, toutes différentes', () => {
        CLASS_IDS.forEach(id => expect(MEMBER_COLORS[id]).toMatch(/^#[0-9a-f]{6}$/i));
        expect(new Set(CLASS_IDS.map(id => MEMBER_COLORS[id])).size).toBe(CLASS_IDS.length);
        expect(memberColor('inconnu')).toBe('#ffffff');
    });
    test('le bouton choisi porte sa couleur, les autres sont atténués, et le cadre des actions reprend la couleur', () => {
        const css = read('style-hud.css');
        expect(css).toMatch(/\.class-picker \.class-pick:not\(\.on\):not\(\.ko\) \{ filter: brightness/);
        expect(css).toMatch(/\.class-picker \.class-pick\.on::after/);   // la flèche vers les actions
        expect(css).toMatch(/#player-spells\[data-member\]/);
        const src = read('gameSpellList.js');
        expect(src).toMatch(/--mc:\$\{memberColor\(id\)\}/);
        expect(src).toMatch(/actions\.dataset\.member = current/);
        expect(src).toMatch(/Actions de \$\{memberName\(current\)\}/);
    });
    test('le survol collé après un toucher ne repeint pas le bouton (thème rétro)', () => {
        expect(read('retro.css')).toMatch(/body\.rt \.class-picker \.class-pick:hover:not\(:disabled\):not\(\.disabled\) \{ background: #1d2530; \}/);
    });
});

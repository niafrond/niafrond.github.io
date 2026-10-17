// Un sort qui modifie le plateau (cases détruites ou transformées, régénération) ne passe pas la main aussitôt :
// les combinaisons déclenchées par la chute profitent à celui qui a lancé le sort (voir classSpellEffects.js : endPlayerSpellTurn).
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');

describe('fin de tour après un sort qui modifie le plateau', () => {
    const game = read('game.js');
    const effects = read('classSpellEffects.js');

    test('les sorts de classe passent par endPlayerSpellTurn au lieu de finishPlayerTurn direct', () => {
        expect((game.match(/module\.endPlayerSpellTurn\(boardBefore\)/g) || []).length).toBe(2);   // lancer normal + cheat
        expect((game.match(/module\.snapshotBoard\(\)/g) || []).length).toBe(2);
        expect(game).not.toMatch(/applyClassSpellEffect\(spell\)\) \{\s*saveUpdate\(\);\s*tutorialCallbacks\.onSpellCast\?\.\(\);\s*finishPlayerTurn\(\);/);
    });

    test('plateau modifié : checkMatches(true) sous le tour du lanceur ; sinon fin de tour classique', () => {
        const fn = effects.slice(effects.indexOf('export function endPlayerSpellTurn'));
        const body = fn.slice(0, fn.indexOf('\n}\n'));
        expect(body).toMatch(/if\(changed\) checkMatches\(true\);\s*else finishPlayerTurn\(\);/);
    });
});

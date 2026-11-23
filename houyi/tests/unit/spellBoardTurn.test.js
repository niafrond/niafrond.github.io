// Un sort qui modifie le plateau (cases détruites ou transformées, régénération) ne passe pas la main aussitôt :
// les combinaisons déclenchées par la chute profitent à celui qui a lancé le sort (voir classSpellEffects.js : endPlayerSpellTurn).
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readGameSource } from './fixtures/gameSource.js';

const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');

describe('fin de tour après un sort qui modifie le plateau', () => {
    const game = readGameSource();
    const effects = read('classSpellEffects.js');

    test('les sorts de classe passent par endPlayerSpellTurn au lieu de finishPlayerTurn direct', () => {
        expect((game.match(/module\.endPlayerSpellTurn\((?:boardBefore|before)\)/g) || []).length).toBe(5);   // lancer normal + ultime + cheat, et leurs versions indépendantes du plateau (sort de plateau, ultime)
        expect((game.match(/module\.snapshotBoard\(\)/g) || []).length).toBe(5);   // idem
        expect(game).not.toMatch(/applyClassSpellEffect\(spell\)\) \{\s*saveUpdate\(\);\s*tutorialCallbacks\.onSpellCast\?\.\(\);\s*finishPlayerTurn\(\);/);
    });

    test('plateau modifié : checkMatches(true) sous le tour du lanceur ; sinon fin de tour classique', () => {
        const fn = effects.slice(effects.indexOf('export function endPlayerSpellTurn'));
        const body = fn.slice(0, fn.indexOf('\n}\n'));
        expect(body).toMatch(/if\(changed\) checkMatches\(true\);\s*else if\(currentTurn === 'enemy'\) finishEnemyTurn\(\);[^\n]*\n\s*else finishPlayerTurn\(\);/);
    });
});

describe('Tir Furtif : tour bonus pour celui qui le lance', () => {
    const game = readGameSource();

    test('le lanceur (joueur ou ennemi) reçoit le bonus (barre remplie, ou tour bonus en tutoriel / duel) dans applyStandardSpellEffects', () => {
        const fn = game.slice(game.indexOf('function applyStandardSpellEffects'));
        const body = fn.slice(0, fn.indexOf('\n}\n'));
        expect(body).toMatch(/spell\.effect === 'bonusTurn'[\s\S]*grantActionBonus\(caster, spell\)/);
        expect(game).toMatch(/export function grantActionBonus[\s\S]*addBonusTurn\(caster, 1\)[\s\S]*refillActionBar/);
    });
});

describe('visée d\'un sort pendant le tour de plateau de l\'ennemi', () => {
    test('la capture de visée impose le héros comme lanceur (Faux de Braise ne blesse plus le héros)', () => {
        const source = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
        expect(source).toMatch(/captureBoardTarget\(\(\) => module\.runAs\('player', \(\) => module\.applyClassSpellEffect\(spell\)\)/);
        expect(source).not.toMatch(/captureBoardTarget\(\(\) => module\.applyClassSpellEffect\(spell\)/);
    });
    test('runAs remet le lanceur à zéro dès que la partie synchrone est passée', () => {
        const effects = readFileSync(new URL('../../classSpellEffects.js', import.meta.url), 'utf8');
        expect(effects).toMatch(/gameState\.casterOverride = who;\s*try \{ return fn\(\); \} finally \{ gameState\.casterOverride = null; \}/);
    });
});

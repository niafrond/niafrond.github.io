// Le duel-tutoriel contre Fengmeng (boss) doit rester en plateau 8×8 : TUTORIAL_BOARD est figé à 64 tuiles,
// et l'étape du sort ne doit jamais laisser le sort achever l'adversaire (l'étape 5 conclut le duel).
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');

describe('duel-tutoriel', () => {
    test('le plateau reste en 8×8 même contre un boss tutoriel', () => {
        expect(read('game.js')).toMatch(/selectedEnemy\?\.isBoss && !selectedEnemy\.isTutorialEnemy\) \? BOSS_BOARD_SIZE : BASE_BOARD_SIZE/);
    });

    test('TUTORIAL_BOARD compte 8×8 tuiles', () => {
        const src = read('tutorial.js');
        const body = src.match(/const TUTORIAL_BOARD = \[([\s\S]*?)\];/)[1];
        expect([...body.matchAll(/'(\w+)'/g)]).toHaveLength(64);
    });

    test("l'adversaire a une grande réserve de PV à l'étape du sort, ramenée à ENEMY_FINISH_HP après le lancer", () => {
        const src = read('tutorial.js');
        expect(src).toMatch(/foe\.hp = ENEMY_SPELL_HP_BUFFER/);
        expect(src).toMatch(/onSpellCast = \(\) => \{\s*if \(_game\?\.enemy\) \{ _game\.enemy\.hp = ENEMY_FINISH_HP;/);
    });

    test("seuls les échanges du joueur font avancer le tutoriel (pas ceux de l'adversaire)", () => {
        expect(read('board.js')).toMatch(/if\(currentTurn === 'player'\) tutorialCallbacks\.onTileSwap\?\.\(i, j, true\)/);
    });
});

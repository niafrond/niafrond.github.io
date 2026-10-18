import { readFileSync } from 'node:fs';
import { gbaAttackFrames } from '../../sprites/index.js';
import { DEAD_TREES } from '../../sprites/deadtrees.js';
import { DECOR_NAMES } from '../../sprites/decor.js';
import { ARENA_BIOMES } from '../../arena.js';

describe('animations d\'attaque du portrait de combat', () => {
    test.each(['archer', 'templar', 'barbarian', 'assassin', 'sorcerer'])('%s tire à l\'arc (4 images)', cls => {
        const frames = gbaAttackFrames(cls);
        expect(frames).toHaveLength(4);
        frames.forEach(f => expect(f).toMatch(/^data:image\/png;base64,/));
    });

    test('une clé sans animation renvoie un tableau vide', () => {
        expect(gbaAttackFrames('farmer_lin')).toEqual([]);
        expect(gbaAttackFrames('inconnu')).toEqual([]);
    });

    test('les ennemis générés ont une animation d\'au moins 4 images', () => {
        expect(gbaAttackFrames('frost_dragon').length).toBeGreaterThanOrEqual(4);
        expect(gbaAttackFrames('bone_reaver').length).toBeGreaterThanOrEqual(4);
    });
});

describe('arbres morts du décor', () => {
    test('16 variantes, déclarées comme décor', () => {
        expect(DEAD_TREES).toHaveLength(16);
        expect(DECOR_NAMES).toContain('deadtree');
    });
    test('plus de lanternes ni de feux de camp dans les arènes extérieures', () => {
        for (let i = 1; i <= 8; i++) expect(ARENA_BIOMES[`arena_${i}`].decor).not.toEqual(expect.arrayContaining(['lantern']));
    });
});

describe('déclenchement de l\'animation d\'attaque', () => {
    const game = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
    const board = readFileSync(new URL('../../board.js', import.meta.url), 'utf8');
    test('coups d\'arme et sorts offensifs (annonce de dégâts) jouent l\'animation du lanceur', () => {
        const fn = game.slice(game.indexOf('export function showCombatAnimation'));
        expect(fn.slice(0, 1200)).toMatch(/damage !== null[\s\S]*playFighterAttack\(isPlayerAttack\)/);
    });
    test('les matchs de crânes aussi', () => {
        expect(board).toMatch(/playFighterAttack\(attacker === player\);\s*applyDamage\(opponent, dmg\)/);
    });
    test('Hou Yi regarde à droite, l\'ennemi à gauche', () => {
        expect(game).toMatch(/gbaSprite\(player\.class, 'right'\)/);
        expect(game).toMatch(/gbaSprite\(eKey, 'left'\)/);
    });
});

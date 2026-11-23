// Crânes = dégâts de zone (équipe entière / tous les ennemis) : garde-fous de structure (game.js et board.js dépendent du DOM, non importables ici).
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';

const game = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
const board = readFileSync(new URL('../../board.js', import.meta.url), 'utf8');

describe('crânes : dégâts de zone', () => {
    test("les crânes d'un match sont des coups de zone (sauf crânes retournés par la confusion)", () => {
        expect(board).toMatch(/applyDamage\(opponent, dmg, \{ damageSource: 'skull', area: !selfHit \}\)/);
        expect(board).toMatch(/applyDamage\(opponent, bonus, \{ damageSource: 'skull', area: true \}\)/);
    });
    test("côté équipe : Hou Yi (s'il est debout) puis chaque compagnon vivant encaissent le coup en entier, le bouclier d'allié est restauré", () => {
        const fn = game.slice(game.indexOf('function applyPartySkullDamage'), game.indexOf('export function applyDamage'));
        expect(fn).toMatch(/if\(!gameState\.heroKo\)/);
        expect(fn).toMatch(/for\(const ally of livingAllies\(gameState\.allies\)\)/);
        expect(fn).toMatch(/gameState\.allyShield = saved/);
    });
    test('applyDamage aiguille les crânes de zone sur le joueur vers la zone d\'équipe, une seule fois (splash)', () => {
        expect(game).toMatch(/target === player && options\.area && options\.damageSource === 'skull' && !options\.splash && damage > 0\) return applyPartySkullDamage/);
    });
});

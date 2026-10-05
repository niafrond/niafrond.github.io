/** @jest-environment jsdom */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { flyManaToCounter } from '../../manaFlight.js';

const rect = (l, t) => ({ left: l, top: t, width: 20, height: 20 });

describe('flyManaToCounter', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="board"></div><span id="player-mana-blue"></span>';
        const board = document.getElementById('board');
        for (let i = 0; i < 10; i++) {
            const t = document.createElement('div');
            t.getBoundingClientRect = () => rect(i * 10, 50);
            board.appendChild(t);
        }
        document.getElementById('player-mana-blue').getBoundingClientRect = () => rect(0, 0);
        Element.prototype.animate = function () { return {}; };
        window.matchMedia = () => ({ matches: false });
    });

    test('un point par tuile, plafonné à 6', () => {
        flyManaToCounter([0, 1, 2], 'blue');
        expect(document.querySelectorAll('.mana-fly-dot')).toHaveLength(3);
        document.querySelectorAll('.mana-fly-dot').forEach(d => d.remove());
        flyManaToCounter([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'blue');
        expect(document.querySelectorAll('.mana-fly-dot').length).toBeLessThanOrEqual(6);
    });

    test('rien pour l\'ennemi, une couleur inconnue ou un compteur absent', () => {
        flyManaToCounter([0, 1, 2], 'blue', { isPlayer: false });
        flyManaToCounter([0, 1, 2], 'pink');
        flyManaToCounter([0, 1, 2], 'red');
        expect(document.querySelectorAll('.mana-fly-dot')).toHaveLength(0);
    });

    test('reduced-motion : aucune animation', () => {
        window.matchMedia = () => ({ matches: true });
        flyManaToCounter([0, 1, 2], 'blue');
        expect(document.querySelectorAll('.mana-fly-dot')).toHaveLength(0);
    });

    test('ne lève jamais d\'erreur', () => {
        document.body.innerHTML = '';
        expect(() => flyManaToCounter([0], 'blue')).not.toThrow();
    });
});

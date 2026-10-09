/** @jest-environment jsdom */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { setOption } from '../../gameOptions.js';
import { flyManaToCounter } from '../../manaFlight.js';

const rect = (l, t) => ({ left: l, top: t, width: 20, height: 20 });

describe('flyManaToCounter', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="board"></div><span id="player-mana-blue"></span><span id="enemy-mana-red"></span><div id="player-stats"><span class="pa-stat"></span></div><div id="enemy-stats"><span class="pa-stat"></span></div>';
        const board = document.getElementById('board');
        for (let i = 0; i < 10; i++) {
            const t = document.createElement('div');
            t.getBoundingClientRect = () => rect(i * 10, 50);
            board.appendChild(t);
        }
        ['player-mana-blue', 'enemy-mana-red', 'player-stats', 'enemy-stats'].forEach((id) => { document.getElementById(id).getBoundingClientRect = () => rect(0, 0); });
        document.querySelectorAll('.pa-stat').forEach((e) => { e.getBoundingClientRect = () => rect(5, 5); });
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

    test('rien pour une couleur inconnue, un compteur absent ou un type inconnu', () => {
        flyManaToCounter([0, 1, 2], 'blue', { isPlayer: false }); // pas d'enemy-mana-blue
        flyManaToCounter([0, 1, 2], 'pink');
        flyManaToCounter([0, 1, 2], 'red'); // pas de player-mana-red
        flyManaToCounter([0, 1, 2], null, { type: 'foo' });
        expect(document.querySelectorAll('.mana-fly-dot')).toHaveLength(0);
    });

    test('ennemi : particules vers son compteur de mana', () => {
        flyManaToCounter([0, 1, 2], 'red', { isPlayer: false });
        expect(document.querySelectorAll('.mana-fly-dot')).toHaveLength(3);
    });

    test('flèches et crânes : particules de couleur dédiée, joueur et ennemi', () => {
        flyManaToCounter([0, 1, 2], null, { type: 'combat' });
        const combat = document.querySelectorAll('.mana-fly-dot');
        expect(combat).toHaveLength(3);
        const combatBg = combat[0].style.background;
        document.querySelectorAll('.mana-fly-dot').forEach(d => d.remove());
        flyManaToCounter([0, 1, 2, 3], null, { type: 'skull', isPlayer: false });
        const skull = document.querySelectorAll('.mana-fly-dot');
        expect(skull).toHaveLength(4);
        expect(skull[0].style.background).not.toBe(combatBg);
    });

    test('option manaFlight désactivée : rien', () => {
        setOption('manaFlight', false);
        flyManaToCounter([0, 1, 2], 'blue');
        flyManaToCounter([0, 1, 2], null, { type: 'combat' });
        expect(document.querySelectorAll('.mana-fly-dot')).toHaveLength(0);
        setOption('manaFlight', true);
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

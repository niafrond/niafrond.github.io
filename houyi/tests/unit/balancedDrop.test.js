// Tuiles qui tombent : la répartition cible doit tenir sur tout le plateau après la chute (joker.js : rollBalancedTile).
import { describe, test, expect } from '@jest/globals';
import { rollBalancedTile } from '../../joker.js';

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
const PROBS = { skullProb: 0.19, combatProb: 0.17, jokerProb: 0.0035 };

// Tire au sort un plateau de 64 cases dont `holes` trous sont comblés par rollBalancedTile ; renvoie les effectifs finaux.
function refill(kept, holes, rng){
    const board = [...kept, ...Array(holes).fill(null)];
    for(let i = kept.length; i < board.length; i++) board[i] = rollBalancedTile(board, PROBS, COLORS, {}, rng);
    return board;
}

describe('rollBalancedTile', () => {
    test('compense un plateau sans crâne : les trous reçoivent surtout des crânes et des flèches', () => {
        const kept = Array.from({ length: 52 }, (_, i) => COLORS[i % COLORS.length]);
        let seed = 7;
        const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const board = refill(kept, 12, rng);
        const added = board.slice(52).filter(t => t === 'skull' || t === 'skull5' || t === 'combat').length;
        expect(added).toBeGreaterThanOrEqual(10);   // le plateau manque de ≈ 12 crânes et ≈ 11 flèches : presque tous les trous les comblent
    });

    test('ne force pas le joker et garde le tirage valide', () => {
        const board = Array(64).fill(null);
        let seed = 3;
        const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for(let i = 0; i < 64; i++) board[i] = rollBalancedTile(board, PROBS, COLORS, {}, rng);
        expect(board.filter(t => t === 'joker').length).toBeLessThanOrEqual(2);
        expect(board.every(t => ['skull', 'skull5', 'combat', 'joker', ...COLORS].includes(t))).toBe(true);
        const combat = board.filter(t => t === 'combat').length;
        expect(combat).toBeGreaterThanOrEqual(6);
        expect(combat).toBeLessThanOrEqual(16);
    });
});

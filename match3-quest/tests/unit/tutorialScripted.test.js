// Tutoriel scripté : tuiles neuves pré-générées au tour du joueur ; au tour de l'adversaire, tuiles neutres et coups sans dégâts ni
// tour bonus (Fengmeng ne peut ni tuer le joueur ni enchaîner).
import { describe, test, expect } from '@jest/globals';
import { TUTORIAL_DROPS_SCRIPT, _dropTile, _pickEnemyMove } from '../../tutorial.js';

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

describe('tutoriel scripté', () => {
    test('la suite pré-générée est fixe, de 96 tuiles connues, sans triple', () => {
        expect(TUTORIAL_DROPS_SCRIPT).toHaveLength(96);
        TUTORIAL_DROPS_SCRIPT.forEach((t, i) => {
            expect([...COLORS, 'skull', 'combat']).toContain(t);
            if (i >= 2) expect(!(t === TUTORIAL_DROPS_SCRIPT[i - 1] && t === TUTORIAL_DROPS_SCRIPT[i - 2])).toBe(true);
        });
    });

    test("tour du joueur : la suite pré-générée, dans l'ordre", () => {
        const board = new Array(64).fill(null);
        const got = Array.from({ length: 5 }, (_, i) => _dropTile(i, board, 'player'));
        expect(got.every(t => TUTORIAL_DROPS_SCRIPT.includes(t))).toBe(true);
    });

    test("tour de l'adversaire : une couleur, jamais de crâne ni d'épée, jamais de ligne de 3 formée", () => {
        for (let trial = 0; trial < 200; trial++) {
            const board = Array.from({ length: 64 }, (_, i) => COLORS[(i * 7 + trial * 3 + Math.floor(i / 8)) % 5]);
            const idx = (trial * 5) % 64;
            const tile = _dropTile(idx, board, 'enemy');
            expect(COLORS).toContain(tile);
            const size = 8, r = Math.floor(idx / size), c = idx % size;
            const at = (rr, cc) => (rr < 0 || cc < 0 || rr >= size || cc >= size ? undefined : board[rr * size + cc]);
            const lines = [[at(r, c - 1), at(r, c - 2)], [at(r, c + 1), at(r, c + 2)], [at(r, c - 1), at(r, c + 1)], [at(r - 1, c), at(r - 2, c)], [at(r + 1, c), at(r + 2, c)], [at(r - 1, c), at(r + 1, c)]];
            const forced = COLORS.every(col => lines.some(([a, b]) => a === col && b === col));
            if (!forced) expect(lines.some(([a, b]) => a === tile && b === tile)).toBe(false);
        }
    });

    test("coup de l'adversaire : évite les crânes et les matchs de 4+, prend le plus petit gain", () => {
        const moves = [
            { from: 1, to: 2, matchLength: 5, matchType: 'color' },
            { from: 3, to: 4, matchLength: 3, matchType: 'skull' },
            { from: 5, to: 6, matchLength: 4, matchType: 'skull' },
            { from: 7, to: 8, matchLength: 3, matchType: 'color' }
        ];
        for (let i = 0; i < 20; i++) expect(_pickEnemyMove(moves)).toEqual(moves[3]);
        const onlySkulls = [{ from: 1, to: 2, matchLength: 4, matchType: 'skull' }, { from: 3, to: 4, matchLength: 3, matchType: 'skull' }];
        expect(_pickEnemyMove(onlySkulls)).toEqual(onlySkulls[1]);
        expect(_pickEnemyMove([])).toBeNull();
    });
});

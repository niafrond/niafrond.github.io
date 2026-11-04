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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');

describe('tutoriel : conseils, agilité et PV de l\'adversaire', () => {
    test('pas de conseil standard pendant le tutoriel, rétabli à la fin', () => {
        expect(read('board.js')).toMatch(/if\(tutorialCallbacks\.noSuggestions\) return;/);
        const src = read('tutorial.js');
        expect(src).toMatch(/tutorialCallbacks\.noSuggestions = true/);
        expect((src.match(/tutorialCallbacks\.noSuggestions = false/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    test("l'adversaire du tutoriel n'a aucune agilité (mannequin et Fengmeng)", () => {
        const src = read('tutorial.js');
        expect(src).toMatch(/attributes: \{ strength: 0, agility: 0,/);
        expect(src).toMatch(/attributes: \{ \.\.\._duelEnemy\.attributes, agility: 0 \}/);
    });

    test("plus de réserve de 500 PV : un plancher de PV empêche la mort avant l'étape finale", () => {
        const src = read('tutorial.js');
        expect(src).not.toMatch(/500/);
        expect(src).toMatch(/tutorialCallbacks\.enemyHpFloor = 1/);
        expect(src).toMatch(/tutorialCallbacks\.enemyHpFloor = 0;\s+\/\/ dernier coup/);
        expect(read('game.js')).toMatch(/const nextHp = Math\.max\(hpFloor, currentHp - normalizedDamage\)/);
    });
});

import { rollBlock, resolveStrike } from '../../combatStats.js';
describe("tutoriel : l'adversaire ne bloque jamais", () => {
    test('même avec une forte défense et un niveau élevé, aucun blocage ni parade', () => {
        const foe = { isTutorialEnemy: true, level: 40, defense: 500, attributes: { agility: 50 } };
        for (let i = 0; i < 200; i++) expect(rollBlock(foe, () => 0)).toBe('none');
        expect(resolveStrike(10, { level: 1, attack: 1 }, foe, { rng: () => 0.99 }).block).toBe('none');
        expect(rollBlock({ level: 40, defense: 500 }, () => 0)).not.toBe('none');   // un ennemi normal bloque toujours
    });
});

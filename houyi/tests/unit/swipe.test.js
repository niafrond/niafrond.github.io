// Glisser pour échanger : direction et seuil (swipe.js), et câblage sur le plateau (board.js, style.css, index.html).
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { swipeTarget, swipeThreshold } from '../../swipe.js';

const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');
const SIZE = 8;

describe('swipe : tuile visée', () => {
    test('les quatre directions donnent la voisine', () => {
        const i = 3 * SIZE + 3;
        expect(swipeTarget(i, SIZE, 20, 0, 12)).toBe(i + 1);
        expect(swipeTarget(i, SIZE, -20, 0, 12)).toBe(i - 1);
        expect(swipeTarget(i, SIZE, 0, 20, 12)).toBe(i + SIZE);
        expect(swipeTarget(i, SIZE, 0, -20, 12)).toBe(i - SIZE);
    });
    test("en diagonale, l'axe dominant décide", () => {
        const i = 3 * SIZE + 3;
        expect(swipeTarget(i, SIZE, 30, 18, 12)).toBe(i + 1);
        expect(swipeTarget(i, SIZE, -14, -30, 12)).toBe(i - SIZE);
    });
    test('mouvement trop court : pas un glisser (c\'est un appui)', () => {
        expect(swipeTarget(10, SIZE, 5, -4, 12)).toBeNull();
    });
    test('jamais hors du plateau', () => {
        expect(swipeTarget(0, SIZE, -30, 0, 12)).toBeNull();
        expect(swipeTarget(0, SIZE, 0, -30, 12)).toBeNull();
        expect(swipeTarget(SIZE * SIZE - 1, SIZE, 30, 0, 12)).toBeNull();
        expect(swipeTarget(SIZE - 1, SIZE, 30, 0, 12)).toBeNull();   // dernière colonne : pas de retour à la ligne suivante
        expect(swipeTarget(SIZE * SIZE - 1, SIZE, 0, 30, 12)).toBeNull();
    });
    test('plateau de 10 cases (boss) et entrées invalides', () => {
        expect(swipeTarget(14, 10, 20, 0, 12)).toBe(15);
        expect(swipeTarget(NaN, 10, 20, 0, 12)).toBeNull();
        expect(swipeTarget(3, 0, 20, 0, 12)).toBeNull();
    });
    test('seuil : un quart de tuile, au moins 10 px', () => {
        expect(swipeThreshold(48)).toBe(12);
        expect(swipeThreshold(20)).toBe(10);
        expect(swipeThreshold(0)).toBe(10);
    });
});

describe('swipe : câblage', () => {
    test('le plateau écoute le glisser, ne vole pas le ciblage des sorts et ignore le clic qui suit', () => {
        const src = read('board.js');
        expect(src).toMatch(/import \{ swipeTarget, swipeThreshold \} from '\.\/swipe\.js'/);
        expect(src).toMatch(/tileClickInterceptor\) \{ swipe = null/);
        expect(src).toMatch(/if\(swipeJustDone\(\)\) return; selectTile\(i\)/);
        expect(src).toMatch(/selectTile\(from\);\s+if\(selected === from\) selectTile\(to\)/);   // mêmes règles que deux appuis
    });
    test('la page ne défile pas sous le doigt et le module est déclaré à l\'import map', () => {
        expect(read('style.css')).toMatch(/#board \{\s+touch-action: none;/);
        expect(read('index.html')).toContain('"swipe.js"');
    });
});

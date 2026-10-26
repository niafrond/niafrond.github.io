import { scoreMove, pickSmartMove, neededColorOf } from '../../companionMoves.js';
import { boardSize } from '../../constants.js';

// Plateau sans aucun alignement : damier de 5 couleurs décalé.
const base = () => Array.from({ length: boardSize * boardSize }, (_, i) => {
    const r = Math.floor(i / boardSize), c = i % boardSize;
    return ['red', 'blue', 'green', 'yellow', 'purple'][(r * 2 + c * 3) % 5];
});

describe('coups de Xiao Gui', () => {
    test('un alignement de crânes vaut plus qu\'un alignement de qì', () => {
        const b = base();
        [0, 1, 3].forEach(i => { b[i] = 'skull'; }); b[boardSize + 2] = 'skull';   // échange 2<->10 : 3 crânes
        const c = base();
        [0, 1, 3].forEach(i => { c[i] = 'red'; }); c[boardSize + 2] = 'red';
        const move = { from: 2, to: boardSize + 2 };
        expect(scoreMove(b, move)).toBeGreaterThan(scoreMove(c, move));
    });
    test('choisit le coup au meilleur score et ne modifie pas le plateau', () => {
        const b = base();
        [0, 1, 3].forEach(i => { b[i] = 'skull'; }); b[boardSize + 2] = 'skull';
        const snap = [...b];
        const good = { from: 2, to: boardSize + 2 }, bad = { from: 30, to: 31 };
        expect(pickSmartMove(b, [bad, good])).toBe(good);
        expect(b).toEqual(snap);
        expect(pickSmartMove(b, [])).toBeNull();
    });
    test('couleur la plus utile : la plus petite réserve', () => {
        expect(neededColorOf({ red: 5, blue: 0, green: 3, yellow: 2, purple: 9 })).toBe('blue');
        expect(neededColorOf(null)).toBeNull();
    });
    test('Monte-Carlo : tuiles retombées tirées par refill, plateau intact, résultat reproductible', () => {
        const b = base();
        [0, 1, 3].forEach(i => { b[i] = 'skull'; }); b[boardSize + 2] = 'skull';
        const snap = [...b];
        const mk = () => { let x = 1; return () => { x = (x * 16807) % 2147483647; return ['red', 'blue', 'green', 'yellow', 'purple', 'skull'][x % 6]; }; };
        const move = { from: 2, to: boardSize + 2 };
        const a = scoreMove(b, move, { refill: mk(), samples: 10 });
        expect(scoreMove(b, move, { refill: mk(), samples: 10 })).toBe(a);
        expect(a).toBeGreaterThanOrEqual(scoreMove(b, move) - 1e-9);   // les cascades de hasard ne font qu'ajouter
        expect(b).toEqual(snap);
    });
});

// Scénario du tutoriel : Hou Yi (J1) et Fengmeng (J2) jouent des coups écrits d'avance ; le joueur déclenche lui-même ses actions.
// Vérifie la mise en place des coups prévus (alignement exact, sans cascade) avec le vrai moteur de plateau, et le câblage du scénario.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as mm from '../../matchMechanics.js';
import { _findScriptedMove, _plantMove, _dropTile } from '../../tutorial.js';
import { rollBlock } from '../../combatStats.js';

const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

// Plateau 8×8 sans aucun alignement ni coup possible, sur lequel on plante le coup demandé.
function quietBoard() {
    const board = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) board.push(COLORS[(r * 2 + c * 3) % 5]);
    return board;
}

describe('scénario du tutoriel : coups prévus', () => {
    const wants = [
        { type: 'color', len: 3, color: 'red' },
        { type: 'color', len: 3, color: 'blue' },
        { type: 'skull', len: 3, color: null },
        { type: 'combat', len: 4, color: null },
        { type: 'skull', len: 5, color: null },
        { type: 'color', len: 4, color: 'red' },
    ];

    test.each(wants)('on plante %j : un seul alignement, exactement celui demandé', want => {
        const board = quietBoard();
        expect(mm.collectMatches(board)).toHaveLength(0);
        const planted = _plantMove(board, want, mm);
        expect(planted).not.toBeNull();
        expect(mm.collectMatches(planted.board)).toHaveLength(0);            // rien n'est déjà aligné
        const found = _findScriptedMove(planted.board, want, mm);             // et le coup est repérable
        expect(found).not.toBeNull();
        const swapped = [...planted.board];
        [swapped[planted.from], swapped[planted.to]] = [swapped[planted.to], swapped[planted.from]];
        const matches = mm.collectMatches(swapped);
        expect(matches).toHaveLength(1);
        expect(matches[0].info.type).toBe(want.type);
        expect(matches[0].info.len).toBe(want.len);
        if (want.color) expect(matches[0].info.color).toBe(want.color);
    });

    test("un alignement de 4 donne bien un tour bonus (4 tuiles ou plus), un de 3 non", () => {
        const four = _plantMove(quietBoard(), wants.find(w => w.len === 4), mm);
        const three = _plantMove(quietBoard(), wants[0], mm);
        const lenOf = p => { const b = [...p.board]; [b[p.from], b[p.to]] = [b[p.to], b[p.from]]; return mm.collectMatches(b)[0].info.len; };
        expect(lenOf(four)).toBeGreaterThanOrEqual(4);
        expect(lenOf(three)).toBe(3);
    });

    test('une tuile neuve du joueur ne forme jamais de ligne avec les tuiles déjà posées', () => {
        for (let trial = 0; trial < 300; trial++) {
            const board = Array.from({ length: 64 }, (_, i) => COLORS[(i * 7 + trial * 3 + Math.floor(i / 8)) % 5]);
            const idx = (trial * 5) % 64;
            const tile = _dropTile(idx, board, 'player');
            const at = (r, c) => (r < 0 || c < 0 || r >= 8 || c >= 8 ? undefined : board[r * 8 + c]);
            const r = Math.floor(idx / 8), c = idx % 8;
            const lines = [[at(r, c - 1), at(r, c - 2)], [at(r, c + 1), at(r, c + 2)], [at(r, c - 1), at(r, c + 1)], [at(r - 1, c), at(r - 2, c)], [at(r + 1, c), at(r + 2, c)], [at(r - 1, c), at(r + 1, c)]];
            const forced = COLORS.every(col => lines.some(([a, b]) => a === col && b === col));
            if (!forced) expect(lines.some(([a, b]) => a === tile && b === tile)).toBe(false);
        }
    });
});

describe('scénario du tutoriel : câblage', () => {
    const src = read('tutorial.js');

    test('onze étapes : J1 joue en premier, puis alternance prévue (3 couleur, 3 couleur, 3 crânes, 3 crânes, 4 couleur, sort, sort, 4 flèches, arme, 3 gâteaux, 5 crânes)', () => {
        expect(src).toMatch(/const TOTAL_STEPS = 11;/);
        const steps = src.slice(src.indexOf('const STEPS = ['), src.indexOf('// Sort de Fengmeng'));
        const seq = [...steps.matchAll(/who: '(player|enemy)', kind: '(swap|spell|weapon)'(?:, match: \{ type: '(color|skull|combat)', len: (\d)[^}]*\})?/g)]
            .map(m => [m[1], m[2], m[3] || '', m[4] || ''].join(':'));
        expect(seq).toEqual([
            'player:swap:color:3', 'enemy:swap:color:3', 'player:swap:skull:3', 'enemy:swap:skull:3',
            'player:swap:color:4', 'player:spell::', 'enemy:spell::', 'player:swap:combat:4', 'player:weapon::', 'enemy:swap:color:3', 'player:swap:skull:5',
        ]);
        expect(read('index.html')).toMatch(/<span id="tutorial-step-total">11<\/span>/);
    });

    test("Fengmeng joue ses coups imposés, sans pièges ni agilité, et le tour du joueur rend la main au scénario", () => {
        expect(src).toMatch(/tutorialCallbacks\.enemyDecision = _enemyDecision/);
        expect(src).toMatch(/tutorialCallbacks\.onPlayerTurn = _onPlayerTurn/);
        expect(src).toMatch(/duel: null/);
        const flow = read('gameTurnFlow.js');
        expect(flow).toMatch(/tutorialCallbacks\.enemyDecision\?\.\(\) \|\| makeDecision\(\)/);
        expect(flow).toMatch(/tutorialCallbacks\.onPlayerTurn\?\.\('bonus'\)/);
        expect(flow).toMatch(/tutorialCallbacks\.onPlayerTurn\?\.\('turn'\)/);
    });

    test('le sort de Fengmeng est bloqué : un blocage imposé est consommé une seule fois', () => {
        const hero = { tutorialBlock: 'total', level: 1, defense: 0 };
        expect(rollBlock(hero, () => 0.99)).toBe('total');
        expect(hero.tutorialBlock).toBeNull();
        expect(rollBlock(hero, () => 0.99)).toBe('none');
    });

    test("l'arme n'est acceptée qu'à l'étape de l'arme, et l'étape de Fengmeng dit seulement « L'ennemi joue »", () => {
        expect(read('game.js')).toMatch(/tutorialCallbacks\.allowWeapon && !tutorialCallbacks\.allowWeapon\(\)/);
        expect(read('game.js')).toMatch(/tutorialCallbacks\.onWeaponUsed\?\.\(\);\s+finishPlayerTurn\(\)/);
        expect((src.match(/title: \(\) => "L'ennemi joue"/g) || [])).toHaveLength(4);
    });

    test("les sorts ne sont acceptés qu'à l'étape du sort (plus de garde par numéro d'étape dans game.js)", () => {
        expect(read('game.js')).not.toMatch(/getTutorialStep\(\) < 4/);
        expect(src).toMatch(/Pas encore : suivez les instructions du tutoriel/);
    });
});

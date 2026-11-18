// Scénario du tutoriel : Hou Yi (J1) et Fengmeng (J2) jouent des coups écrits d'avance ; le joueur déclenche lui-même ses actions.
// Vérifie la mise en place des coups prévus (alignement exact, sans cascade) avec le vrai moteur de plateau, et le câblage du scénario.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rollBlock } from '../../combatStats.js';

const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

// Plateau 8×8 sans aucun alignement ni coup possible, sur lequel on plante le coup demandé.
function quietBoard() {
    const board = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) board.push(COLORS[(r * 2 + c * 3) % 5]);
    return board;
}

describe('scénario du tutoriel : câblage', () => {
    const src = read('tutorial.js');

    test('quatorze étapes : J1 joue en premier, puis alternance prévue (3 couleur, 3 couleur, 3 crânes, 3 crânes, 4 couleur, sort, sort, 4 flèches, arme, 3 gâteaux, 5 crânes, 3 gâteaux avec le joker, 3 gâteaux, 3 crânes)', () => {
        expect(src).toMatch(/const TOTAL_STEPS = 14;/);
        const steps = src.slice(src.indexOf('const STEPS = ['), src.indexOf('// Sort de Fengmeng'));
        const seq = [...steps.matchAll(/who: '(player|enemy)', kind: '(swap|spell|weapon)'(?:, match: \{ type: '(color|skull|combat)', len: (\d)[^}]*\})?/g)]
            .map(m => [m[1], m[2], m[3] || '', m[4] || ''].join(':'));
        expect(seq).toEqual([
            'player:swap:color:3', 'enemy:swap:color:3', 'player:swap:skull:3', 'enemy:swap:skull:3',
            'player:swap:color:4', 'player:spell::', 'enemy:spell::', 'player:swap:combat:4', 'player:weapon::', 'enemy:swap:color:3', 'player:swap:skull:5', 'player:swap:color:3', 'enemy:swap:color:3', 'player:swap:skull:3',
        ]);
        expect(read('index.html')).toMatch(/<span id="tutorial-step-total">14<\/span>/);
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
        expect((src.match(/title: \(\) => "L'ennemi joue"/g) || [])).toHaveLength(5);
    });

    test("les sorts ne sont acceptés qu'à l'étape du sort (plus de garde par numéro d'étape dans game.js)", () => {
        expect(read('game.js')).not.toMatch(/getTutorialStep\(\) < 4/);
        expect(src).toMatch(/Pas encore : suivez les instructions du tutoriel/);
    });
});

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

    test("vingt et une étapes : J1 joue en premier ; gâteaux et joker d'abord, puis le sort, les crânes, la Xiūxiān, la potion, l'altération, les flèches, l'arme et le coup final, avec des découvertes entre les coups", () => {
        expect(src).toMatch(/const TOTAL_STEPS = 21;/);
        const steps = src.slice(src.indexOf('const STEPS = ['), src.indexOf('// Sort de Fengmeng'));
        const seq = [...steps.matchAll(/who: '(player|enemy)', kind: '(swap|spell|weapon|info|xiuxian|potion)'(?:, match: \{ type: '(color|skull|combat)', len: (\d)[^}]*\})?/g)]
            .map(m => [m[1], m[2], m[3] || '', m[4] || ''].join(':'));
        expect(seq).toEqual([
            'player:swap:color:3', 'enemy:swap:color:3', 'player:info::', 'player:info::', 'player:swap:color:4', 'player:swap:color:5', 'player:swap:color:3', 'enemy:swap:color:3',
            'player:info::', 'player:spell::', 'enemy:spell::', 'player:swap:skull:3', 'enemy:swap:skull:3', 'player:xiuxian::', 'player:potion::', 'enemy:spell::', 'player:info::',
            'player:swap:combat:4', 'player:weapon::', 'enemy:swap:color:3', 'player:swap:skull:3',
        ]);
    });

    test("les découvertes n'apparaissent qu'au début d'un tour du joueur ou après une action qui ne finit pas son tour (jamais après un coup qui passe la main)", () => {
        const steps = src.slice(src.indexOf('const STEPS = ['), src.indexOf('// Sort de Fengmeng'));
        const seq = [...steps.matchAll(/who: '(player|enemy)', kind: '(\w+)'(?:, match: \{ type: '\w+', len: (\d))?/g)].map(m => ({ who: m[1], kind: m[2], len: Number(m[3] || 0) }));
        seq.forEach((st, i) => {
            if (st.kind !== 'info') return;
            const prev = seq[i - 1];
            expect(prev.who === 'enemy' || prev.kind === 'info' || prev.kind === 'xiuxian').toBe(true);
        });
        // La potion termine le tour : Fengmeng joue juste après ; la Xiūxiān ne le termine pas : une action du joueur suit.
        const potion = seq.findIndex(st => st.kind === 'potion');
        expect(seq[potion + 1].who).toBe('enemy');
        const xiu = seq.findIndex(st => st.kind === 'xiuxian');
        expect(seq[xiu + 1].who).toBe('player');
    });

    test('potion et Xiūxiān : acceptées seulement à leur étape, et elles font avancer le scénario', () => {
        const game = read('game.js');
        expect(game).toMatch(/tutorialCallbacks\.allowXiuxian && !tutorialCallbacks\.allowXiuxian\(\)/);
        expect(game).toMatch(/tutorialCallbacks\.onXiuxian\?\.\(\)/);
        expect(game).toMatch(/tutorialCallbacks\.allowPotion && !tutorialCallbacks\.allowPotion\(\)/);
        expect(game).toMatch(/tutorialCallbacks\.onPotionUsed\?\.\(\);[^\n]*\n\s+endAction\(\)/);
        expect(src).toMatch(/alteration: 'cursed'/);
        expect(read('index.html')).toMatch(/id="tutorial-next-btn"/);
    });

    test("le joker se crée avec 5 gâteaux de la couleur du joueur (pas des crânes) et le joueur lance un sort avant tout coup de crânes", () => {
        const steps = src.slice(src.indexOf('const STEPS = ['), src.indexOf('// Sort de Fengmeng'));
        expect(steps).toMatch(/type: 'color', len: 5, side: 'me'/);
        expect(steps).not.toMatch(/len: 5[^}]*skull|skull[^}]*len: 5/);
        expect(steps.indexOf("kind: 'spell'")).toBeLessThan(steps.indexOf("type: 'skull', len: 3"));
    });

    test("aucun nombre d'étapes affiché au joueur", () => {
        expect(read('index.html')).not.toMatch(/tutorial-step-total|tutorial-step-current|tutorial-step-badge/);
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
        expect(read('game.js')).toMatch(/tutorialCallbacks\.onWeaponUsed\?\.\(\);\s+endAction\(\)/);
        expect((src.match(/title: \(\) => "L'ennemi joue( : votre barre de classe se recharge)?"/g) || [])).toHaveLength(6);   // le premier coup de Fengmeng annonce aussi le chargement
    });

    test("tâche demandée : tout le reste du plateau et des actions est grisé, et le grisé est retiré dès que la tâche change", () => {
        for (const task of ['swap', 'weapon', 'spell']) expect(src).toContain(`_setDim('${task}')`);
        expect(src).toContain('_setDim(step.kind)');   // Xiūxiān et potion : la tâche porte le nom du type d'étape
        expect(src).toMatch(/function _cleanupHighlights\(\) \{\s+_setDim\(null\);/);
        const css = read('style-tutorial.css');
        expect(css).toMatch(/#tab-combat\[data-tuto-task\] #board \.tile:not\(\.tutorial-highlight\)/);
        expect(css).toMatch(/#tab-combat\[data-tuto-task\] #class-picker/);
    });

    test("les sorts ne sont acceptés qu'à l'étape du sort (plus de garde par numéro d'étape dans game.js)", () => {
        expect(read('game.js')).not.toMatch(/getTutorialStep\(\) < 4/);
        expect(src).toMatch(/Pas encore : suivez les instructions du tutoriel/);
    });
});

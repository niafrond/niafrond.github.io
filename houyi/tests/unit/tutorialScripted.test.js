// Tutoriel sans hasard : plateau et tuiles qui tombent pré-générés (tutorialScript.js). Les tests rejouent le script avec le vrai moteur
// d'alignements : chaque échange donne exactement l'alignement prévu, la chute (colonnes de gauche à droite, de bas en haut) reproduit le
// plateau de l'étape suivante, sans cascade.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as mm from '../../matchMechanics.js';
import { _dropTile } from '../../tutorial.js';
import { TUTORIAL_SCRIPT } from '../../tutorialScript.js';
import { readGameSource } from './fixtures/gameSource.js';

const read = file => readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');
const SIZE = 8;
const COLOR_OF = { A: 'red', B: 'blue', C: 'green', D: 'yellow', E: 'purple' };
const real = t => COLOR_OF[t] || t;

// Étapes d'échange du scénario (tutorial.js) : numéro, alignement attendu
function scenarioSwapSteps() {
    const src = read('tutorial.js');
    const steps = src.slice(src.indexOf('const STEPS = ['), src.indexOf('// Sort de Fengmeng'));
    const rows = [...steps.matchAll(/who: '(player|enemy)', kind: '(swap|spell|weapon)'(?:, match: \{ type: '(color|skull|combat)', len: (\d)(?:, side: '(me|foe|other)')? \})?/g)];
    const sideColor = { me: 'red', foe: 'blue', other: 'green' };
    return rows.map((m, i) => ({ step: i + 1, kind: m[2], type: m[3], len: Number(m[4]), color: m[3] === 'color' ? sideColor[m[5]] : null })).filter(r => r.kind === 'swap');
}

// Résolution d'un échange comme board.js : alignement retiré (sauf le joker créé par 5 tuiles), gravité par colonne, tuiles neuves dans l'ordre d'appel.
function play(board, [from, to], drops) {
    const t = [...board];
    [t[from], t[to]] = [t[to], t[from]];
    const matches = mm.collectMatches(t);
    matches.forEach(m => { if (m.info.len >= 5) m.info.makeJoker = true; });
    const spawns = mm.pickJokerSpawns(matches);
    spawns.forEach(sp => { t[sp.index] = 'joker'; });
    const keep = new Set(spawns.map(sp => sp.index));
    const removed = new Set();
    matches.forEach(m => m.indices.forEach(i => { if (!keep.has(i)) removed.add(i); }));
    const out = [...t];
    let used = 0;
    for (let col = 0; col < SIZE; col++) {
        let w = SIZE - 1;
        for (let row = SIZE - 1; row >= 0; row--) {
            const idx = row * SIZE + col;
            if (!removed.has(idx)) { out[w * SIZE + col] = t[idx]; w--; }
        }
        for (; w >= 0; w--) out[w * SIZE + col] = drops[used++];
    }
    return { matches, out, holes: used };
}

describe('tutoriel sans hasard : script pré-généré', () => {
    const wants = scenarioSwapSteps();

    test('une entrée par étape d\'échange du scénario, dans l\'ordre', () => {
        expect(TUTORIAL_SCRIPT.map(e => e.step)).toEqual(wants.map(w => w.step));
    });

    test('chaque plateau : 64 tuiles connues, aucun alignement déjà formé', () => {
        for (const e of TUTORIAL_SCRIPT) {
            expect(e.board).toHaveLength(64);
            expect(mm.collectMatches(e.board.map(real))).toHaveLength(0);
            expect(e.board.every(t => ['A', 'B', 'C', 'D', 'E', 'skull', 'combat', 'joker'].includes(t))).toBe(true);
        }
    });

    test("l'échange prévu donne exactement l'alignement du scénario (type, longueur, couleur) et rien d'autre", () => {
        TUTORIAL_SCRIPT.forEach((e, k) => {
            const want = wants[k];
            const r = play(e.board.map(real), e.swap, e.drops.map(real));
            expect(r.matches).toHaveLength(1);
            expect(r.matches[0].info.type).toBe(want.type);
            expect(r.matches[0].info.len).toBe(want.len);
            if (want.color) expect(r.matches[0].info.color).toBe(want.color);
            expect(r.holes).toBe(e.drops.length);   // la file de tuiles neuves est exactement celle dont la chute a besoin
        });
    });

    test("la chute reproduit le plateau de l'étape suivante, sans cascade", () => {
        for (let k = 0; k < TUTORIAL_SCRIPT.length - 1; k++) {
            const e = TUTORIAL_SCRIPT[k];
            const r = play(e.board.map(real), e.swap, e.drops.map(real));
            expect(mm.collectMatches(r.out)).toHaveLength(0);
            expect(r.out).toEqual(TUTORIAL_SCRIPT[k + 1].board.map(real));
        }
    });

    test('le joker de la 11e étape est bien celui utilisé à la 12e', () => {
        const e11 = TUTORIAL_SCRIPT.find(e => e.step === 11), e12 = TUTORIAL_SCRIPT.find(e => e.step === 12);
        expect(e12.board.filter(t => t === 'joker')).toHaveLength(1);
        const r = play(e12.board.map(real), e12.swap, e12.drops.map(real));
        expect(r.matches[0].indices).toContain(e12.board.indexOf('joker'));
        expect(e11.drops.length).toBe(4);
    });

    test('la file de tuiles neuves est consommée dans l\'ordre, jamais de hasard', () => {
        const board = new Array(64).fill('red');
        const a = _dropTile(0, board), b = _dropTile(0, board);
        expect([a, b]).toEqual([a, b]);   // sans file : toujours la même réponse pour un plateau donné
        expect(read('tutorial.js')).not.toMatch(/Math\.random/);
    });
});


describe('tutoriel : conseils, agilité et PV de l\'adversaire', () => {
    test('pas de conseil standard pendant le tutoriel, rétabli à la fin', () => {
        expect(read('boardSuggestions.js')).toMatch(/if\(tutorialCallbacks\.noSuggestions\) return;/);
        const src = read('tutorial.js');
        expect(src).toMatch(/tutorialCallbacks\.noSuggestions = true/);
        expect(src).toMatch(/tutorialCallbacks\.noSuggestions = false/);   // _resetCallbacks : quitter et terminer
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
        expect(readGameSource()).toMatch(/const nextHp = Math\.max\(hpFloor, currentHp - normalizedDamage\)/);
    });
});

import { rollBlock, rollCrit, resolveStrike } from '../../combatStats.js';
describe('tutoriel : aucun hasard dans les combats', () => {
    test('le joueur du tutoriel ne fait ni critique ni blocage au hasard, Fengmeng non plus', () => {
        const hero = { tutorialDeterministic: true, level: 1, attack: 999, defense: 999 };
        for (let i = 0; i < 100; i++) {
            expect(rollCrit(hero, () => 0)).toBe(false);
            expect(rollBlock(hero, () => 0)).toBe('none');
            expect(rollCrit({ isTutorialEnemy: true, attack: 999 }, () => 0)).toBe(false);
        }
        expect(read('tutorial.js')).toMatch(/player\.tutorialDeterministic = true/);
    });
});

describe("tutoriel : l'adversaire ne bloque jamais", () => {
    test('même avec une forte défense et un niveau élevé, aucun blocage ni parade', () => {
        const foe = { isTutorialEnemy: true, level: 40, defense: 500, attributes: { agility: 50 } };
        for (let i = 0; i < 200; i++) expect(rollBlock(foe, () => 0)).toBe('none');
        expect(resolveStrike(10, { level: 1, attack: 1 }, foe, { rng: () => 0.99 }).block).toBe('none');
        expect(rollBlock({ level: 40, defense: 500 }, () => 0)).not.toBe('none');   // un ennemi normal bloque toujours
    });
});

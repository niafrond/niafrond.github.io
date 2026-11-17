import { describe, it, expect } from '@jest/globals';
import { thinkingTimeFactor, pickWeightedOption } from '../../enemyAIChoice.js';

describe('thinkingTimeFactor', () => {
    it.each([[1, 1], [9, 1], [10, 0.7], [12, 0.7], [14, 0.7], [15, 0.5], [30, 0.5]])('niveau %i → ×%f', (level, factor) => {
        expect(thinkingTimeFactor(level)).toBe(factor);
    });

    it('ne descend jamais sous la moitié du temps', () => {
        for (let level = 0; level <= 200; level++) expect(thinkingTimeFactor(level)).toBeGreaterThanOrEqual(0.5);
    });
});

describe('pickWeightedOption', () => {
    const spell = { type: 'spell', probability: 0.3 };
    const weapon = { type: 'weapon', probability: 0.2 };
    const board = { type: 'board', probability: 0.4 };
    const pick = (options, r) => pickWeightedOption(options, () => r)?.type;

    it('renvoie null sans option disponible', () => {
        expect(pickWeightedOption([], () => 0.5)).toBeNull();
        expect(pickWeightedOption(undefined, () => 0.5)).toBeNull();
    });

    it('avec une seule option, la choisit toujours', () => {
        for (const r of [0, 0.5, 0.999999]) expect(pick([board], r)).toBe('board');
    });

    it('board seul parmi des probabilités < 1 : plus de biais', () => {
        expect(pick([board], 0.99)).toBe('board');
    });

    it('renormalise sur les actions restantes (board + sort : 0,3 / 0,7)', () => {
        const opts = [spell, board];   // total 0,7 → sort 3/7 ≈ 0,4286
        expect(pick(opts, 0)).toBe('spell');
        expect(pick(opts, 0.42)).toBe('spell');
        expect(pick(opts, 0.43)).toBe('board');
        expect(pick(opts, 0.9999)).toBe('board');
    });

    it('renormalise sur les actions restantes (board + arme : 0,2 / 0,6)', () => {
        const opts = [weapon, board];  // arme 1/3
        expect(pick(opts, 0.33)).toBe('weapon');
        expect(pick(opts, 0.34)).toBe('board');
    });

    it('trois actions disponibles : seuils sur la somme 0,9', () => {
        const opts = [spell, weapon, board];   // sort 1/3, arme 2/9, board 4/9
        expect(pick(opts, 0.33)).toBe('spell');
        expect(pick(opts, 0.34)).toBe('weapon');
        expect(pick(opts, 0.55)).toBe('weapon');
        expect(pick(opts, 0.56)).toBe('board');
        expect(pick(opts, 0.9999)).toBe('board');
    });

    it('respecte l\'ordre fourni (priorité aux meilleurs scores)', () => {
        expect(pick([board, spell], 0.1)).toBe('board');
        expect(pick([spell, board], 0.1)).toBe('spell');
    });

    it('ne choisit jamais une option de probabilité nulle', () => {
        const opts = [{ type: 'a', probability: 0 }, { type: 'b', probability: 0.5 }, { type: 'c', probability: 0 }];
        for (const r of [0, 0.3, 0.999999]) expect(pick(opts, r)).toBe('b');
    });

    it('tirage uniforme si aucune probabilité exploitable', () => {
        const opts = [{ type: 'a', probability: 0 }, { type: 'b', probability: NaN }, { type: 'c' }];
        expect(pick(opts, 0)).toBe('a');
        expect(pick(opts, 0.5)).toBe('b');
        expect(pick(opts, 0.999999)).toBe('c');
    });

    it('chaque action reçoit exactement sa part normalisée sur une grille de tirages', () => {
        const opts = [spell, weapon, board];
        const counts = { spell: 0, weapon: 0, board: 0 };
        const N = 9000;
        for (let i = 0; i < N; i++) counts[pick(opts, i / N)]++;
        expect(counts.spell).toBe(3000);
        expect(counts.weapon).toBe(2000);
        expect(counts.board).toBe(4000);
    });
});

import { findLethalOption, applyScoreSharpness } from '../../enemyAIChoice.js';

describe('estocade et poids du score', () => {
    test('findLethalOption renvoie le coup fatal le mieux noté, sinon null', () => {
        const a = { type: 'spell', score: 250, data: { reason: 'coup fatal' } };
        const b = { type: 'weapon', score: 260, data: { reason: 'coup fatal' } };
        const c = { type: 'board', score: 300, data: { reason: 'besoin de qì' } };
        expect(findLethalOption([a, b, c])).toBe(b);
        expect(findLethalOption([c])).toBeNull();
        expect(findLethalOption([])).toBeNull();
    });

    test('applyScoreSharpness : 0 inchangé, sinon favorise le meilleur score sans exclure les autres', () => {
        const mk = () => [{ score: 100, probability: 0.5 }, { score: 50, probability: 0.5 }, { score: 0, probability: 0.5 }];
        expect(applyScoreSharpness(mk(), 0).map(o => o.probability)).toEqual([0.5, 0.5, 0.5]);
        const [hi, mid, lo] = applyScoreSharpness(mk(), 1);
        expect(hi.probability).toBeCloseTo(0.5);
        expect(mid.probability).toBeCloseTo(0.25);
        expect(lo.probability).toBeCloseTo(0.025);   // plancher 0,05
        expect(lo.probability).toBeGreaterThan(0);
    });
});

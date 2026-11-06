// Chemin réel de la décision ennemie (enemyAI.js : setAIDifficultyByLevel puis makeDecision), game.js remplacé par un double.
import { describe, test, expect, jest, beforeAll, beforeEach } from '@jest/globals';

const player = { hp: 100, maxHp: 100, mana: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 }, combatPoints: 0, resistances: {} };
const enemy = { level: 5, hp: 100, maxHp: 100, mana: { red: 9, blue: 0, green: 0, yellow: 0, purple: 0 }, combatPoints: 5, spells: [], weapon: null, attack: 10, defense: 5, personality: undefined };
jest.unstable_mockModule('../../game.js', () => ({ player, enemy, canEntityCastSpell: (e, spell) => (spell.cost || 0) <= e.mana.red }));

let ai;
beforeAll(async () => { ai = await import('../../enemyAI.js'); });

const seeded = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const damageSpell = { id: 'bolt', name: 'Éclair', dmg: 12, color: 'red', cost: 3 };
const healSpell = { id: 'mend', name: 'Soin', heal: 15, color: 'red', cost: 3 };

function stats(personality, n = 4000) {
    enemy.personality = personality;
    const rng = seeded(11);
    const counts = { spell: 0, weapon: 0, board: 0 };
    for (let i = 0; i < n; i++) counts[ai.makeDecision(rng).action]++;
    return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / n]));
}

beforeEach(() => {
    Object.assign(enemy, { hp: 100, level: 5, personality: undefined, combatPoints: 5, spells: [damageSpell, healSpell], weapon: { name: 'Épée', damage: 8, actionPoints: 2 } });
    ai.setAIDifficulty('expert');   // peu d'erreurs : l'effet du style est visible
});

describe('chemin de décision ennemie', () => {
    test('difficulté fixe choisie : setAIDifficultyByLevel l\'applique sans l\'adapter au niveau', () => {
        expect(ai.setAIDifficultyByLevel(20, 1, enemy, 'easy')).toBe('easy');
        expect(ai.getAIDifficulty().name).toBe('Facile');
        expect(ai.setAIDifficultyByLevel(1, 20, { isOverleveledChoice: true }, 'normal')).toBe('normal');
        expect(ai.getAIDifficulty().name).toBe('Normal');
        expect(ai.setAIDifficultyByLevel(1, 20, { isOverleveledChoice: true }, 'auto')).toBe('expert');
        expect(ai.getAIDifficulty().name).toBe('Hors niveau');
    });

    test('la personnalité de l\'ennemi est lue par makeDecision et l\'expose dans la décision', () => {
        enemy.personality = 'cunning';
        expect(ai.makeDecision(seeded(1)).personality).toBe('cunning');
        expect(ai.enemyPersonalities.cunning.name).toBe('Rusé');
        expect(ai.assignPersonality('loup')).toBe(ai.assignPersonality('loup'));
    });

    test('agressif joue plus l\'arme et moins le plateau que téméraire-neutre / défensif', () => {
        const none = stats(undefined);
        const aggressive = stats('aggressive');
        expect(aggressive.weapon).toBeGreaterThan(none.weapon + 0.03);
        expect(aggressive.board).toBeLessThan(none.board);
    });

    test('défensif, à PV bas, lance plus souvent un sort (le soin est alors le sort retenu)', () => {
        enemy.hp = 20;
        const none = stats(undefined);
        const defensive = stats('defensive');
        expect(defensive.spell).toBeGreaterThan(none.spell + 0.03);
    });

    test('le style ne rend pas le combat prévisible : les trois actions restent possibles pour chaque personnalité', () => {
        for (const key of Object.keys(ai.enemyPersonalities)) {
            const f = stats(key, 3000);
            expect(f.spell).toBeGreaterThan(0.05);
            expect(f.weapon).toBeGreaterThan(0.05);
            expect(f.board).toBeGreaterThan(0.05);
        }
    });

    test('actions invalides jamais proposées : sans arme utilisable ni sort abordable, seul le plateau reste, quel que soit le style', () => {
        Object.assign(enemy, { weapon: { name: 'Arc', damage: 8, actionPoints: 99 }, spells: [{ ...damageSpell, cost: 50 }] });
        for (const key of Object.keys(ai.enemyPersonalities)) {
            enemy.personality = key;
            for (let i = 0; i < 50; i++) expect(ai.makeDecision(seeded(i)).action).toBe('board');
        }
    });
});

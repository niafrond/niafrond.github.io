import { describe, it, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { MAX_ENEMIES, groupAllowed, rollGroupSize, shouldSummon, hasRoom, pickSummonTemplate, summonableTemplates, nextLivingIndex, reinforcementLevel, packSize, summonSettings } from '../../enemyGroup.js';

const foe = (hp = 10, extra = {}) => ({ hp, maxHp: 10, level: 5, statusEffects: {}, ...extra });
const catalog = [{ id: 'a' }, { id: 'b' }, { id: 'sun_1', copyOf: 'a' }, { id: 'fengmeng_1' }, { id: 'petit_gui', copyOf: 'a' }];

describe('groupes d\'ennemis', () => {
    it('limite à 3 ennemis', () => {
        expect(MAX_ENEMIES).toBe(3);
        expect(hasRoom([foe(), foe(), foe()])).toBe(false);
        expect(hasRoom([foe(), foe(), foe(0)])).toBe(true);
    });
    it('jamais de groupe contre un boss, un tutoriel, un duel ou en arène', () => {
        for (const x of [{ isBoss: true }, { isTutorialEnemy: true }, { duel: {} }, { arena: {} }, { training: 'monk' }]) expect(groupAllowed(x)).toBe(false);
        expect(rollGroupSize({ isBoss: true, level: 20 }, () => 0)).toBe(1);
    });
    it('taille du groupe selon le tirage', () => {
        const lead = { level: 10 };
        expect(rollGroupSize(lead, () => 0)).toBe(3);
        expect(rollGroupSize(lead, () => 0.2)).toBe(2);
        expect(rollGroupSize(lead, () => 0.99)).toBe(1);
        expect(rollGroupSize({ level: 1 }, () => 0)).toBe(1);
    });
    it('invocation : pouvoir, place, appels restants, pas deux tours de suite', () => {
        const s = foe(10, { summon: { chance: 1, maxCalls: 1 } });
        expect(shouldSummon(s, [s], () => 0)).toBe(true);
        expect(shouldSummon(foe(), [foe()], () => 0)).toBe(false);
        expect(shouldSummon(s, [s, foe(), foe()], () => 0)).toBe(false);
        expect(shouldSummon({ ...s, summonsMade: 1 }, [s], () => 0)).toBe(false);
        expect(shouldSummon({ ...s, summonedLastTurn: true }, [s], () => 0)).toBe(false);
        expect(shouldSummon({ ...s, statusEffects: { stunned: 1 } }, [s], () => 0)).toBe(false);
        expect(shouldSummon({ ...s, isBoss: true }, [s], () => 0)).toBe(false);
        expect(shouldSummon({ ...s, summon: { chance: 0.3, maxCalls: 1 } }, [s], () => 0.99)).toBe(false);
    });
    it('gabarit invoqué : précis ou au hasard, jamais un boss', () => {
        expect(summonableTemplates(catalog).map(t => t.id)).toEqual(['a', 'b']);
        expect(pickSummonTemplate({ summon: { templateId: 'petit_gui' } }, catalog).id).toBe('petit_gui');
        expect(pickSummonTemplate({ templateId: 'a', summon: {} }, catalog, () => 0).id).toBe('b');
    });
    it('relève : prochain ennemi vivant, circulaire', () => {
        expect(nextLivingIndex([foe(0), foe(), foe()], 0)).toBe(1);
        expect(nextLivingIndex([foe(), foe(0), foe(0)], 0)).toBe(0);
        expect(nextLivingIndex([foe(0), foe(0)], 0)).toBe(-1);
        expect(reinforcementLevel(1)).toBe(1);
        expect(reinforcementLevel(8)).toBe(7);
    });
});

describe('meutes (pack)', () => {
    test('une meute compte toujours plus d\'un ennemi, même à bas niveau, et jamais plus de MAX_ENEMIES', () => {
        const lead = { level: 1, pack: { min: 2, max: 3 } };
        for (const r of [0, 0.3, 0.5, 0.99]) {
            const size = rollGroupSize(lead, () => r);
            expect(size).toBeGreaterThanOrEqual(2);
            expect(size).toBeLessThanOrEqual(MAX_ENEMIES);
        }
        expect(rollGroupSize(lead, () => 0)).toBe(2);
        expect(rollGroupSize(lead, () => 0.99)).toBe(3);
    });
    test('taille de meute bornée et valeurs absurdes corrigées', () => {
        expect(packSize({ min: 2, max: 2 })).toBe(2);
        expect(packSize({ min: 9, max: 12 })).toBe(MAX_ENEMIES);
        expect(packSize({ min: 0, max: 0 })).toBe(2);
        expect(packSize(null)).toBe(2);
    });
    test('un boss ou un duel ne forme jamais de meute', () => {
        expect(rollGroupSize({ level: 10, isBoss: true, pack: { min: 2 } }, () => 0)).toBe(1);
    });
});

describe('invocation du Crabe-soldat', () => {
    const crab = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8')).find(t => t.id === 'crabe_soldat');
    test('il ramène un crabe de même force et, rarement, un Crabe combattant doré de niveau élevé', () => {
        const s = summonSettings(crab);
        expect(s.templateId).toBe('crabe_soldat');
        expect(s.sameStrength).toBe(true);
        expect(s.rare).toMatchObject({ templateId: 'crabe_combattant_dore', levelAbovePlayer: 6, goldMult: 8 });
        expect(s.rare.chance).toBeGreaterThan(0);
        expect(s.rare.chance).toBeLessThanOrEqual(0.15);
    });
    test('le crabe doré n\'est jamais tiré au hasard comme renfort', () => {
        const all = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
        expect(summonableTemplates(all).some(t => t.id === 'crabe_combattant_dore')).toBe(false);
    });
    test('sans réglage rare ou sameStrength, les anciennes invocations sont inchangées', () => {
        const s = summonSettings({ summon: { chance: 0.3, maxCalls: 2 } });
        expect(s.sameStrength).toBe(false);
        expect(s.rare).toBeNull();
    });
});

import { describe, it, expect } from '@jest/globals';
import { MAX_ENEMIES, groupAllowed, rollGroupSize, shouldSummon, hasRoom, pickSummonTemplate, summonableTemplates, nextLivingIndex, reinforcementLevel } from '../../enemyGroup.js';

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

// Boss semi-scriptés (bossScript.js) : échauffement annoncé, attaque dévastatrice, préparation du héros, interruption.
import { describe, test, expect } from '@jest/globals';
import { createBossScript, stepBossScript, signatureDamage, preparationReduction, CHARGE_TURNS, SIGNATURE_SHARE, MAX_REDUCTION, PERIOD } from '../../bossScript.js';

const boss = (extra = {}) => ({ isBoss: true, mapEnemyId: 'sun_1', preferredColor: 'red', hp: 1000, maxHp: 1000, ...extra });

describe('boss semi-scriptés', () => {
    test('seuls les boss de la carte en ont un ; le script est fixe pour un même boss', () => {
        expect(createBossScript({ isBoss: false })).toBeNull();
        expect(createBossScript(boss({ arena: {} }))).toBeNull();
        expect(createBossScript(boss({ duel: {} }))).toBeNull();
        const a = createBossScript(boss()), b = createBossScript(boss());
        expect(a).toEqual(b);
        expect(a.name).toBe('Brasier dévastateur');
        expect(a.period).toBeGreaterThanOrEqual(PERIOD.min);
        expect(a.period).toBeLessThan(PERIOD.min + PERIOD.spread);
    });
    test('déroulé : échauffement (pas d\'action), un tour normal, puis l\'attaque ; le rythme reprend ensuite', () => {
        const s = createBossScript(boss()), e = boss();
        const actions = [];
        for (let t = 0; t < 24; t++) actions.push(stepBossScript(s, e).action);
        const start = actions.indexOf('start');
        expect(actions.slice(start, start + 3)).toEqual(['start', 'charging', 'release']);
        expect(actions.filter(a => a === 'release').length).toBeGreaterThanOrEqual(2);
    });
    test('phases : passer sous 66 % puis 33 % des PV déclenche un échauffement, une seule fois chacune', () => {
        const s = createBossScript(boss()), e = boss();
        s.nextAt = 99;   // pas de rythme régulier dans ce test
        expect(stepBossScript(s, e).action).toBe('none');
        e.hp = 600;
        expect(stepBossScript(s, e)).toMatchObject({ action: 'start', phase: true });
        stepBossScript(s, e); stepBossScript(s, e);   // charging, release
        expect(stepBossScript(s, e).action).toBe('none');   // 66 % déjà franchi
        e.hp = 200;
        expect(stepBossScript(s, e).action).toBe('start');
    });
    test('interruption : étourdi ou endormi pendant l\'échauffement, l\'attaque n\'a pas lieu', () => {
        const s = createBossScript(boss()), e = boss();
        s.nextAt = 1;
        expect(stepBossScript(s, e).action).toBe('start');
        expect(stepBossScript(s, e, { lostTurn: true }).action).toBe('interrupted');
        expect(s.charge).toBe(0);
    });
    test('puissance : part des PV max selon le mode, jamais mortelle d\'un coup ; la préparation la réduit, le Bastion l\'annule', () => {
        const s = createBossScript(boss(), 'expert');
        expect(s.share).toBe(SIGNATURE_SHARE.expert);
        expect(Math.max(...Object.values(SIGNATURE_SHARE))).toBeLessThan(1);
        const hero = { maxHp: 500, statusEffects: {}, statBuffs: {} };
        expect(signatureDamage(s, hero).damage).toBe(Math.round(500 * SIGNATURE_SHARE.expert));
        expect(signatureDamage(s, { ...hero, statBuffs: { defense: { amount: 25, turns: 3 } } }).damage).toBe(Math.round(500 * SIGNATURE_SHARE.expert * 0.75));
        expect(signatureDamage(s, { ...hero, statusEffects: { shieldWall: 2 } })).toMatchObject({ damage: 0, blocked: true });
        expect(preparationReduction({ statBuffs: { defense: { amount: 300 } }, damageReduction: 0.45 })).toBe(MAX_REDUCTION);
        expect(createBossScript(boss(), 'easy').share).toBeLessThan(createBossScript(boss(), 'expert').share);
    });
    test('attaque préparée = un sort gratuit du boss, inactif tant qu\'il ne l\'a pas annoncée, sans puissance annoncée', () => {
        const s = createBossScript(boss({ level: 30 }));
        expect(s.spell).toMatchObject({ id: 'bossSignature', name: 'Brasier dévastateur', color: 'red', cost: {} });
        expect(s.spell.description).not.toMatch(/\d+ ?%|dégâts?\b.*\d/);
        expect(s.charge).toBe(0);   // inactif au départ : la fiche s'allume quand charge > 0
        const e = boss();
        s.nextAt = 1;
        expect(stepBossScript(s, e).action).toBe('start');
        expect(s.charge).toBe(CHARGE_TURNS);
    });
});

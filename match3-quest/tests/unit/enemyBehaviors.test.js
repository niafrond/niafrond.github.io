// Comportements de boss : Dragon de feu, Reine de glace, Chevalier noir (+ brûlure, ralentissement, brouillage).
import './fixtures/playerForge.js';
import { describe, test, expect } from '@jest/globals';
import {
    behaviorIdOf, createBehavior, adjustDamageTaken, stepBehavior, damageKindOf, chilledGain, burnOf, behaviorBadges,
    ICE_QUEEN, BLACK_KNIGHT, FIRE_DRAGON
} from '../../enemyBehaviors.js';
import { createBossScript, stepBossScript, noteChargeDamage, signatureDamage } from '../../bossScript.js';
import { inflictAlteration, cureStatuses, tickAlterations } from '../../alterations.js';
import { activeStatuses } from '../../statusBadges.js';

const boss = (extra = {}) => ({ isBoss: true, name: 'Boss', hp: 1000, maxHp: 1000, templateId: 'x', preferredColor: 'blue', statusEffects: {}, ...extra });
const hero = () => ({ name: 'Hou Yi', hp: 300, maxHp: 300, statusEffects: {} });

describe('attribution', () => {
    test('boss seulement, par gabarit ou par race et élément', () => {
        expect(behaviorIdOf(boss({ templateId: 'dame_des_neiges' }))).toBe('iceQueen');
        expect(behaviorIdOf(boss({ templateId: 'gui_guerrier' }))).toBe('blackKnight');
        expect(behaviorIdOf(boss({ preferredColor: 'red' }), { race: 'Dragon' })).toBe('fireDragon');
        expect(behaviorIdOf(boss({ isBoss: false, templateId: 'dame_des_neiges' }))).toBeNull();
        expect(behaviorIdOf(boss())).toBeNull();
        expect(createBehavior(boss())).toBeNull();
    });
});

describe('Dragon de feu', () => {
    const dragon = () => { const e = boss({ preferredColor: 'red' }); return { e, script: createBossScript(e, 'auto', 'fireDragon') }; };
    test('attaque de zone nommée, interruptible par les dégâts, qui brûle', () => {
        const { e, script } = dragon();
        expect(script).toMatchObject({ name: FIRE_DRAGON.name, burn: true, color: 'red' });
        script.nextAt = 1;
        expect(stepBossScript(script, e).action).toBe('start');
        expect(noteChargeDamage(script, e, 100)).toBe(false);
        expect(noteChargeDamage(script, e, 100)).toBe(true);   // 20 % des PV max
        expect(stepBossScript(script, e).action).toBe('interrupted');
        expect(script.charge).toBe(0);
    });
    test('les dégâts hors échauffement ne comptent pas ; un boss ordinaire n\'est pas interruptible par les dégâts', () => {
        const { e, script } = dragon();
        expect(noteChargeDamage(script, e, 999)).toBe(false);
        const plain = createBossScript(boss(), 'auto');
        plain.charge = 2;
        expect(noteChargeDamage(plain, boss(), 999)).toBe(false);
    });
    test('renforcer sa défense réduit toujours l\'attaque ; brûlure = 3 % des PV max', () => {
        const { script } = dragon();
        const h = { ...hero(), statBuffs: { defense: { amount: 40, turns: 2 } } };
        expect(signatureDamage(script, h).damage).toBeLessThan(signatureDamage(script, hero()).damage);
        expect(burnOf(hero())).toEqual({ turns: 3, damage: 9 });
    });
    test('brûlure : posée, guérie par un remède', () => {
        const h = hero();
        expect(inflictAlteration(h, 'burning', 3, { burnDamage: 9 })).toBe(true);
        expect(activeStatuses(h).some(s => s.id === 'burning')).toBe(true);
        expect(cureStatuses(h, ['burning'])).toEqual(['burning']);
        expect(h.statusEffects.burnDamage).toBeUndefined();
    });
});

describe('Reine de glace', () => {
    const queen = () => { const e = boss({ templateId: 'dame_des_neiges' }); return { e, b: createBehavior(e) }; };
    test('armure de givre : −30 % hors Feu ; un sort de Feu la fait fondre avec un bonus', () => {
        const { b } = queen();
        expect(adjustDamageTaken(b, 100, { kind: 'physical' }).damage).toBe(70);
        expect(adjustDamageTaken(b, 100, { kind: 'magic', colors: ['blue'] }).damage).toBe(70);
        const fire = adjustDamageTaken(b, 100, { kind: 'magic', colors: ['red'] });
        expect(fire).toMatchObject({ damage: 125, melted: true });
        expect(b.armor).toBe(false);
        expect(adjustDamageTaken(b, 100, { kind: 'physical' }).damage).toBe(100);   // armure fondue : plein tarif
    });
    test('l\'armure se reforme au bout de 3 tours', () => {
        const { e, b } = queen();
        adjustDamageTaken(b, 10, { kind: 'magic', colors: ['red'] });
        stepBehavior(b, e, hero()); stepBehavior(b, e, hero());
        expect(b.armor).toBe(false);
        expect(stepBehavior(b, e, hero()).rearmed).toBe(true);
        expect(b.armor).toBe(true);
    });
    test('tempête tous les 3 tours', () => {
        const { e, b } = queen();
        const acts = [1, 2, 3, 4, 5, 6].map(() => stepBehavior(b, e, hero()).action);
        expect(acts).toEqual(['none', 'none', 'storm', 'none', 'none', 'storm']);
    });
    test('ralentissement : −1 flèche par match, dissipé par le temps', () => {
        const h = hero();
        expect(inflictAlteration(h, 'chilled', ICE_QUEEN.chillTurns)).toBe(true);
        expect(chilledGain(3, h)).toBe(2);
        expect(chilledGain(1, h)).toBe(1);
        expect(chilledGain(3, hero())).toBe(3);
        tickAlterations(h); tickAlterations(h);
        expect(chilledGain(3, h)).toBe(3);
    });
});

describe('Chevalier noir', () => {
    const knight = () => { const e = boss({ templateId: 'gui_guerrier' }); return { e, b: createBehavior(e) }; };
    test('nature des coups', () => {
        expect(damageKindOf({ sourceSpell: {} })).toBe('magic');
        expect(damageKindOf({ damageSource: 'weapon' })).toBe('physical');
        expect(damageKindOf({ damageSource: 'skull' })).toBe('physical');
        expect(damageKindOf({})).toBeNull();
    });
    test('garde physique : −60 % et contre-attaque promise ; la magie passe', () => {
        const { b } = knight();
        expect(adjustDamageTaken(b, 100, { kind: 'magic' })).toMatchObject({ damage: 100, counterReady: false });
        const hit = adjustDamageTaken(b, 100, { kind: 'physical' });
        expect(hit).toMatchObject({ damage: 40, counterReady: true });
        expect(b.counterReady).toBe(true);
    });
    test('contre-attaque jouée au tour suivant, puis plus rien', () => {
        const { e, b } = knight();
        adjustDamageTaken(b, 100, { kind: 'physical' });
        const step = stepBehavior(b, e, hero());
        expect(step).toMatchObject({ action: 'counter', damage: Math.round(300 * BLACK_KNIGHT.counterShare) });
        expect(stepBehavior(b, e, hero()).action).toBe('none');
    });
    test('il se met en garde contre ce que le héros emploie le plus : il faut alterner', () => {
        const { e, b } = knight();
        adjustDamageTaken(b, 10, { kind: 'physical' }); b.counterReady = false;
        adjustDamageTaken(b, 300, { kind: 'magic' });
        expect(stepBehavior(b, e, hero()).stance).toBe('ward');   // la magie dominait
        expect(adjustDamageTaken(b, 100, { kind: 'physical' }).damage).toBe(100);   // le physique passe désormais
        expect(adjustDamageTaken(b, 100, { kind: 'magic' }).damage).toBe(40);
    });
    test('pastilles d\'état', () => {
        const { b } = knight();
        expect(behaviorBadges(b)[0].label).toBe('Garde physique');
        b.counterReady = true;
        expect(behaviorBadges(b).map(x => x.id)).toContain('knightCounter');
        expect(activeStatuses({ statusEffects: {}, behavior: b }).length).toBeGreaterThan(0);
    });
});

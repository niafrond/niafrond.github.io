import { describe, test, expect } from '@jest/globals';
import { CHARGE_BASE, CHARGE_MIN, classChargeTime, enemyChargeTime, newCharge, classChargeMs, enemyChargeMs, chargeTick, isClassReady, classProgress, classRemainingMs, spendClass, spendEnemy, isEnemyReady, chargeRunning, BOARD_IDLE_PAUSE_MS, initCharge, startChargePctOf, newActionQueue, enqueueAction, takeNextDue, hasQueuedAction, upcomingBeads } from '../../classCharge.js';

const hero = (extra = {}) => ({ attributes: {}, mana: {}, skills: {}, ...extra });

describe('classCharge : temps de chargement des classes', () => {
    test('sans bonus : temps de base', () => {
        expect(classChargeTime(hero(), 'assassin')).toBe(CHARGE_BASE);
        expect(enemyChargeTime({ level: 0 })).toBe(CHARGE_BASE);
    });
    test('agilité, moral, attribut propre et qì réduisent le chargement', () => {
        const slow = classChargeTime(hero(), 'assassin');
        expect(classChargeTime(hero({ attributes: { agility: 20 } }), 'assassin')).toBeLessThan(slow);
        expect(classChargeTime(hero({ attributes: { morale: 20 } }), 'assassin')).toBeLessThan(slow);
        expect(classChargeTime(hero({ mana: { yellow: 10 } }), 'assassin')).toBeLessThan(slow);
        expect(classChargeTime(hero({ mana: { yellow: 10 } }), 'barbarian')).toBe(slow);   // qì jaune : seulement le Rôdeur
    });
    test('compétences : bonus de chargement', () => {
        const withSkill = hero({ skills: { active: ['oeil_du_dragon'] } });
        expect(classChargeTime(withSkill, 'assassin')).toBeLessThan(CHARGE_BASE);
    });
    test('plancher', () => {
        expect(classChargeTime(hero({ attributes: { agility: 900 } }), 'assassin')).toBe(CHARGE_MIN);
    });
    test('une classe prête agit, puis se recharge en temps réel ; elle est de nouveau prête une fois le temps écoulé', () => {
        const c = newCharge(), h = hero();
        expect(isClassReady(c, 'assassin')).toBe(true);
        spendClass(c, h, 'assassin');
        expect(isClassReady(c, 'assassin')).toBe(false);
        expect(classProgress(c, h, 'assassin')).toBe(0);
        chargeTick(c, classChargeMs(h, 'assassin') / 2);
        expect(classProgress(c, h, 'assassin')).toBeCloseTo(0.5, 1);
        expect(classRemainingMs(c, 'assassin')).toBe(classChargeMs(h, 'assassin') / 2);
        chargeTick(c, classChargeMs(h, 'assassin'));
        expect(isClassReady(c, 'assassin')).toBe(true);
        expect(classProgress(c, h, 'assassin')).toBe(1);
    });
    test('chaque classe a sa propre barre : une classe peut agir pendant que l\'autre se recharge', () => {
        const c = newCharge(), h = hero();
        spendClass(c, h, 'assassin');
        expect(isClassReady(c, 'barbarian')).toBe(true);
        spendClass(c, h, 'barbarian');
        expect(isClassReady(c, 'barbarian')).toBe(false);
    });
    test("l'ennemi se recharge aussi", () => {
        const c = newCharge(), e = { level: 10 };
        expect(isEnemyReady(c)).toBe(true);
        spendEnemy(c, e);
        expect(isEnemyReady(c)).toBe(false);
        chargeTick(c, enemyChargeMs(e));
        expect(isEnemyReady(c)).toBe(true);
    });
    test('le facteur raccourcit le chargement (tutoriel)', () => {
        expect(classChargeMs(hero(), 'assassin', 0.2)).toBe(Math.round(classChargeMs(hero(), 'assassin') * 0.2));
    });
    test('un chargement moyen de milieu de partie est d\'environ 15 s', () => {
        const mid = hero({ attributes: { agility: 20, morale: 10 }, mana: { yellow: 15 } });
        const ms = classChargeMs(mid, 'assassin');
        expect(ms).toBeGreaterThan(12000);
        expect(ms).toBeLessThan(18000);
    });

    test("file d'attente commune : la plus anciennement prête part d'abord, sans montrer l'ordre", () => {
        const q = newActionQueue(), c = newCharge(), h = hero();
        spendClass(c, h, 'assassin');
        enqueueAction(q, { owner: 'player', classId: 'assassin', label: 'a', dueAt: c.ready.assassin });
        enqueueAction(q, { owner: 'player', classId: 'barbarian', label: 'b', dueAt: 0 });
        spendEnemy(c, { level: 5 });
        enqueueAction(q, { owner: 'enemy', label: 'e', dueAt: c.enemyReady });
        expect(hasQueuedAction(q, 'player')).toBe(true);
        const ready = it => (it.classId ? isClassReady(c, it.classId) : isEnemyReady(c));
        expect(takeNextDue(q, ready).label).toBe('b');   // l'assassin et l'ennemi se rechargent encore : la classe prête passe
        expect(takeNextDue(q, ready)).toBeNull();
        chargeTick(c, 10 ** 6);                            // le temps passe : les deux sont prêts ; l'assassin l'était avant l'ennemi
        expect(takeNextDue(q, ready).label).toBe(c.ready.assassin <= c.enemyReady ? 'a' : 'e');
        expect(takeNextDue(q, ready)).not.toBeNull();
        expect(q).toHaveLength(0);
    });
    test('tempo : plateau inactif depuis 5 s, les chargements se mettent en pause ; un combo les relance', () => {
        expect(BOARD_IDLE_PAUSE_MS).toBe(5000);
        expect(chargeRunning(1000, 0)).toBe(true);
        expect(chargeRunning(4999, 0)).toBe(true);
        expect(chargeRunning(5000, 0)).toBe(false);
        expect(chargeRunning(9000, 0)).toBe(false);
        expect(chargeRunning(9000, 8500)).toBe(true);   // un combo vient d'avoir lieu
    });

    test('début de combat : toutes les barres (classes et ennemi) sont vides', () => {
        const c = newCharge(), h = hero(), e = { level: 5 };
        initCharge(c, h, ['assassin', 'barbarian'], e);
        expect(isClassReady(c, 'assassin')).toBe(false);
        expect(classProgress(c, h, 'assassin')).toBe(0);
        expect(isEnemyReady(c)).toBe(false);
    });
    test('un bonus de chargement initial (compétence) remplit d\'avance la barre des classes ; celui de l\'ennemi aussi', () => {
        const h = hero({ skills: { learned: ['reflexes_aiguises'], active: ['reflexes_aiguises'], progress: {} } });
        expect(startChargePctOf(h)).toBe(30);
        const c = newCharge();
        initCharge(c, h, ['assassin'], { level: 5, startChargePct: 100 });
        expect(classProgress(c, h, 'assassin')).toBeCloseTo(0.3, 1);
        expect(isEnemyReady(c)).toBe(true);
    });

    test("perles des actions à venir : une par action, verte (joueur) ou rouge (ennemi), dans l'ordre de départ", () => {
        const c = newCharge(), h = hero(), q = newActionQueue();
        expect(upcomingBeads(c, q, null)).toEqual([]);
        spendClass(c, h, 'assassin');
        spendClass(c, h, 'barbarian');
        chargeTick(c, 1000);
        enqueueAction(q, { owner: 'player', classId: 'barbarian', dueAt: c.ready.barbarian });   // se recharge plus longtemps que le Chasseur
        enqueueAction(q, { owner: 'player', classId: 'assassin', dueAt: c.ready.assassin });
        spendEnemy(c, { level: 5 });
        enqueueAction(q, { owner: 'enemy', dueAt: c.enemyReady });
        const beads = upcomingBeads(c, q, false);
        expect(beads).toHaveLength(3);
        expect(beads.filter(b => b === 'foe')).toHaveLength(1);
        expect(beads.filter(b => b === 'hero')).toHaveLength(2);
    });
});

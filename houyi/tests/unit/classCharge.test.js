import { describe, test, expect } from '@jest/globals';
import { CHARGE_BASE, CHARGE_MIN, classChargeTime, enemyChargeTime, newCharge, nextActor, playerActed, enemyActed, readyClasses } from '../../classCharge.js';

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
    test('à égalité, les tours alternent', () => {
        const c = newCharge(), usable = ['assassin'];
        expect(nextActor(c, usable)).toBe('player');
        playerActed(c, hero(), 'assassin');
        expect(nextActor(c, usable)).toBe('enemy');
        enemyActed(c, { level: 0 });
        expect(nextActor(c, usable)).toBe('player');
    });
    test('plusieurs classes jouent plus souvent que l\'ennemi', () => {
        const c = newCharge(), usable = ['assassin', 'barbarian'], h = hero({ attributes: { agility: 20 } });
        let playerTurns = 0, enemyTurns = 0;
        for (let i = 0; i < 12; i++) {
            if (nextActor(c, usable) === 'player') { playerActed(c, h, readyClasses(c, usable)[0]); playerTurns++; }
            else { enemyActed(c, { level: 10 }); enemyTurns++; }
        }
        expect(playerTurns).toBeGreaterThan(enemyTurns);
    });
});

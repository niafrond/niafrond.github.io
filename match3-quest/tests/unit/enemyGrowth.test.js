import { growEnemy, allocateAttributes, extraLevelUps, ATTRIBUTE_KEYS } from '../../enemyGrowth.js';
import { createMapEnemy } from '../../enemies.js';

const sum = a => ATTRIBUTE_KEYS.reduce((n, k) => n + a[k], 0);

describe('croissance des ennemis', () => {
    test('un monstre de niveau 22 dépense autant de points que de montées (21 + quelques-unes de plus)', () => {
        for (let i = 0; i < 40; i++) {
            const g = growEnemy(22, { playerClass: 'barbarian', preferredColor: 'red' });
            expect(sum(g.attributes)).toBe(g.levelUps);
            expect(g.levelUps).toBeGreaterThanOrEqual(21);
            expect(g.levelUps).toBeLessThanOrEqual(21 + 3);
        }
        expect(growEnemy(1, {}).levelUps).toBeGreaterThanOrEqual(0);
        expect(extraLevelUps(20, { boss: true, rng: () => 0 })).toBe(1);
    });
    test('les choix suivent la nature : un barbare mise sur la force, un sorcier sur l\'intelligence', () => {
        const avg = (cls, color, key) => { let t = 0; for (let i = 0; i < 200; i++) t += allocateAttributes(30, { playerClass: cls, preferredColor: color })[key]; return t / 200; };
        expect(avg('barbarian', 'red', 'strength')).toBeGreaterThan(avg('sorcerer', 'blue', 'strength'));
        expect(avg('sorcerer', 'blue', 'intelligence')).toBeGreaterThan(avg('barbarian', 'red', 'intelligence'));
        expect(avg('templar', 'green', 'stamina')).toBeGreaterThan(avg('assassin', 'yellow', 'stamina'));
    });
    test('les statistiques découlent des points (force → attaque, agilité + moral → défense, endurance → PV)', () => {
        const g = growEnemy(10, { playerClass: 'assassin', preferredColor: 'yellow', rng: () => 0 });
        expect(g.attack).toBe(g.attributes.strength);
        expect(g.defense).toBe(g.attributes.agility + g.attributes.morale);
        expect(g.hpBonus).toBeGreaterThanOrEqual(g.attributes.stamina);
    });
    test('un ennemi créé porte ses attributs complets et plus de points à haut niveau', () => {
        const low = createMapEnemy({ templateId: 'canglong', level: 3 });
        const high = createMapEnemy({ templateId: 'canglong', level: 40 });
        expect(sum(high.attributes)).toBeGreaterThan(sum(low.attributes));
        expect(sum(high.attributes)).toBeGreaterThanOrEqual(39);
        expect(high.levelUps).toBe(sum(high.attributes));
    });
});

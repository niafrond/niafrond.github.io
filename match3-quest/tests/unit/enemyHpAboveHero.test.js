import { describe, it, expect } from '@jest/globals';
import { heroMaxHpAtLevel, raiseEnemyHpAboveHero } from '../../enemyGrowth.js';

describe('PV max estimés du héros', () => {
    it('niveau identique : inchangé', () => expect(heroMaxHpAtLevel(1000, 10, 10)).toBe(1000));
    it('+6 PV par niveau jusqu\'au 20, +11 au-delà', () => {
        expect(heroMaxHpAtLevel(1000, 10, 12)).toBe(1012);
        expect(heroMaxHpAtLevel(1000, 20, 22)).toBe(1022);
    });
    it('niveau inférieur : retranche symétriquement', () => {
        expect(heroMaxHpAtLevel(1022, 22, 20)).toBe(1000);
        expect(heroMaxHpAtLevel(5, 40, 1)).toBe(1);
    });
});

describe('ennemis générés : plus de PV que le héros au niveau supérieur', () => {
    const hero = { level: 29, maxHp: 1226 };
    it('relève un ennemi trop fragile au-dessus du héros du niveau N+1', () => {
        const enemy = { level: 29, hp: 658, maxHp: 658 };
        raiseEnemyHpAboveHero(enemy, hero);
        expect(enemy.maxHp).toBe(heroMaxHpAtLevel(1226, 29, 30) + 1);
        expect(enemy.hp).toBe(enemy.maxHp);
    });
    it('ne touche pas un ennemi déjà assez costaud', () => {
        const enemy = { level: 29, hp: 5000, maxHp: 5000 };
        expect(raiseEnemyHpAboveHero(enemy, hero)).toBe(0);
        expect(enemy.maxHp).toBe(5000);
    });
    it('un ennemi blessé garde ses PV perdus', () => {
        const enemy = { level: 29, hp: 300, maxHp: 658 };
        const added = raiseEnemyHpAboveHero(enemy, hero);
        expect(enemy.hp).toBe(300 + added);
    });
    it('l\'ennemi facile (moins de PV que le héros) est exclu', () => {
        const enemy = { level: 27, hp: 600, maxHp: 600, isEasyChoice: true };
        expect(raiseEnemyHpAboveHero(enemy, hero)).toBe(0);
        expect(enemy.maxHp).toBe(600);
    });
});

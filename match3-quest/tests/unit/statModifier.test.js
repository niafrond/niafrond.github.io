import { statModifier, addStatBuff } from '../../combatStats.js';

describe('statModifier (part temporaire d\'Atk / Déf affichée en vert ou rouge)', () => {
    test('sort de bonus : Pas de l\'Ombre +25 défense', () => {
        const hero = { attack: 10, defense: 20, statusEffects: {} };
        expect(statModifier(hero, 'defense')).toBe(0);
        addStatBuff(hero, { defense: 25, turns: 3 });
        expect(statModifier(hero, 'defense')).toBe(25);
        expect(statModifier(hero, 'attack')).toBe(0);
    });

    test('Force et Peau de Jade comptent tant qu\'ils durent', () => {
        const hero = { statusEffects: { strength: 2, strengthBonus: 4, stoneskin: 1, stoneskinDefense: 6 } };
        expect(statModifier(hero, 'attack')).toBe(4);
        expect(statModifier(hero, 'defense')).toBe(6);
        expect(statModifier({ statusEffects: { strength: 0, strengthBonus: 4 } }, 'attack')).toBe(0);
    });

    test('affaiblissement : malus d\'attaque', () => {
        const enemy = { statusEffects: { weakened: 2, weakenedAmount: 7 } };
        expect(statModifier(enemy, 'attack')).toBe(-7);
        expect(statModifier(enemy, 'defense')).toBe(0);
    });
});

import { readFileSync } from 'fs';
import { COMPANION_POWERS, rollCompanionPowers, turnPowerIds, MANA_COLORS } from '../../companionPowers.js';
import { COMPANIONS } from '../../companions.js';
import { QUESTS } from '../../story.js';

const game = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
const hero = { maxHp: 100, level: 10 };

describe('pouvoirs des compagnons', () => {
    test('chaque compagnon a un pouvoir, et inversement', () => {
        expect(COMPANIONS.map(c => c.id).sort()).toEqual(Object.keys(COMPANION_POWERS).sort());
    });
    test('Xiao Gui est géré à part, les autres jouent en fin de tour', () => {
        expect(turnPowerIds(['xiao_gui', 'zhi', 'inconnu', 'yu'])).toEqual(['zhi', 'yu']);
    });
    test('un tirage trop haut ne déclenche rien', () => {
        expect(rollCompanionPowers(['zhi', 'dawa', 'yu', 'etincelle'], hero, () => 0.99)).toEqual([]);
    });
    test('un tirage bas déclenche tout, avec les bons montants', () => {
        const fired = rollCompanionPowers(['zhi', 'dawa', 'yu', 'etincelle'], hero, () => 0);
        const by = Object.fromEntries(fired.map(f => [f.id, f]));
        expect(by.zhi.amount).toBe(10);
        expect(by.yu.amount).toBe(14);
        expect(by.etincelle.amount).toBe(4);
        expect(MANA_COLORS).toContain(by.etincelle.color);
        expect(by.dawa.power.kind).toBe('mirage');
    });
    test('chaque compagnon se recrute par une quête annexe existante', () => {
        const ids = Object.values(QUESTS).map(q => q.id);
        COMPANIONS.forEach(c => expect(ids).toContain(c.joinWhen));
    });
    test("game.js applique les pouvoirs une fois par tour", () => {
        expect(game).toContain('applyCompanionPowers()');
        expect(game).toContain('companionsActedThisTurn');
    });
});

describe('agilité dans les statistiques de combat', () => {
    test("l'onglet Stats affiche l'agilité", () => {
        expect(game).toContain('Agilité (initiative)');
    });
});

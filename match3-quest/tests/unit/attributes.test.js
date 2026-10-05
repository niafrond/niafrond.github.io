import {
    ATTRIBUTE_MANA_RULES, ATTRIBUTE_ORDER, describeAttributeChoice, manaPerMatch, summarizeColorBonuses
} from '../../attributes.js';
import { getColorMatchManaBaseGain } from '../../matchMechanics.js';

const hero = (attrs = {}) => ({ maxMana: 50, attributes: { strength: 0, agility: 0, intelligence: 0, stamina: 0, morale: 0, ...attrs } });

describe('attributs de niveau et bonus de couleur', () => {
    test('chaque attribut est lié à une couleur différente', () => {
        const colors = ATTRIBUTE_ORDER.map(a => ATTRIBUTE_MANA_RULES[a].color);
        expect(new Set(colors).size).toBe(5);
    });

    test('Bleu (intelligence) : un match de 3 donne 4 mana bleu au lieu de 3', () => {
        expect(manaPerMatch('intelligence', 0, 3)).toBe(3);
        expect(manaPerMatch('intelligence', 1, 3)).toBe(4);
        expect(manaPerMatch('intelligence', 2, 3)).toBe(5);
        const info = { type: 'color', color: 'blue', len: 3 };
        expect(getColorMatchManaBaseGain(info) + 1).toBe(4);
    });

    test('la description annonce les valeurs réelles avant -> après', () => {
        const d = describeAttributeChoice(hero({ intelligence: 1 }), 'intelligence');
        expect(d.points).toBe(1);
        expect(d.nextPoints).toBe(2);
        expect(d.lines.join(' ')).toMatch(/donne 5 mana bleu au lieu de 4/);
        expect(d.lines.join(' ')).toMatch(/\+1 mana bleu en début de combat/);
        expect(describeAttributeChoice(hero(), 'agility').lines[0]).toMatch(/\+1 défense/);
    });

    test('le résumé permanent reflète les points acquis', () => {
        const s = summarizeColorBonuses(hero({ strength: 2 })).find(c => c.attr === 'strength');
        expect(s).toMatchObject({ color: 'red', perMatch3: 5, initial: 2, cap: 54 });
    });
});

describe('réinitialisation des points d\'attribut', () => {
    // Joueur ayant dépensé des points comme applyAttributeBonus (game.js) : Battle/Morale +1 attaque, Agilité +1 défense, Endurance +1 PV max.
    const spent = () => ({
        attack: 15 + 3 + 2, defense: 1 + 4, maxHp: 100 + 5, hp: 90, unspentLevelPoints: 1,
        attributes: { strength: 3, agility: 4, intelligence: 2, stamina: 5, morale: 2 }
    });

    test('rend tous les points, retire leur effet direct et ne touche pas à la croissance de base', async () => {
        const { respecAttributes, totalAttributePoints } = await import('../../attributes.js');
        const p = spent();
        expect(totalAttributePoints(p)).toBe(16);
        expect(respecAttributes(p)).toEqual({ refunded: 16 });
        expect(p.attributes).toEqual({ strength: 0, agility: 0, intelligence: 0, stamina: 0, morale: 0 });
        expect(p.attack).toBe(15);        // 20 − 3 (Battle) − 2 (Morale)
        expect(p.defense).toBe(1);        // 5 − 4 (Agilité)
        expect(p.maxHp).toBe(100);        // 105 − 5 (Endurance)
        expect(p.hp).toBe(90);            // les PV actuels ne dépassent jamais le nouveau maximum
        expect(p.unspentLevelPoints).toBe(17);   // 1 déjà en réserve + 16 rendus
    });

    test('les PV actuels sont plafonnés au nouveau maximum, jamais en dessous de 1', async () => {
        const { respecAttributes } = await import('../../attributes.js');
        const p = { attack: 5, defense: 0, maxHp: 30, hp: 30, unspentLevelPoints: 0, attributes: { strength: 0, agility: 0, intelligence: 0, stamina: 29, morale: 0 } };
        respecAttributes(p);
        expect(p.maxHp).toBe(1);
        expect(p.hp).toBe(1);
    });

    test('sans point dépensé, rien ne change ; refaire la réinitialisation est sans effet', async () => {
        const { respecAttributes } = await import('../../attributes.js');
        const p = { attack: 15, defense: 0, maxHp: 100, hp: 100, unspentLevelPoints: 2, attributes: { strength: 0, agility: 0, intelligence: 0, stamina: 0, morale: 0 } };
        expect(respecAttributes(p)).toEqual({ refunded: 0 });
        expect(p).toMatchObject({ attack: 15, maxHp: 100, unspentLevelPoints: 2 });
        const q = spent();
        respecAttributes(q);
        expect(respecAttributes(q)).toEqual({ refunded: 0 });
        expect(q.unspentLevelPoints).toBe(17);
    });

    test('réaffectation : dépenser à nouveau les points rendus redonne exactement les mêmes stats', async () => {
        const { respecAttributes } = await import('../../attributes.js');
        const p = spent();
        const before = { attack: p.attack, defense: p.defense, maxHp: p.maxHp };
        respecAttributes(p);
        // tout en Battle (+1 attaque par point), puis retour
        p.attributes.strength = 17; p.attack += 17; p.unspentLevelPoints = 0;
        expect(p.attack).toBe(15 + 17);
        respecAttributes(p);
        expect(p).toMatchObject({ attack: 15, defense: 1, maxHp: 100, unspentLevelPoints: 17 });
        expect(before.attack).toBe(20);   // la réinitialisation retire l'effet des points, pas celui des niveaux
    });
});

import { startingRage, boostedRageGain, ATTRIBUTE_RAGE_RULES,
    ATTRIBUTE_MANA_RULES, ATTRIBUTE_ORDER, ATTRIBUTE_STAT_EFFECTS, agilityScore, describeAttributeChoice, manaPerMatch, manaBonusFor, summarizeColorBonuses
} from '../../attributes.js';
import { getColorMatchManaBaseGain } from '../../matchMechanics.js';

const hero = (attrs = {}) => ({ maxMana: 50, attributes: { strength: 0, agility: 0, intelligence: 0, stamina: 0, morale: 0, ...attrs } });

describe('attributs de niveau et bonus de couleur', () => {
    test('chaque attribut est lié à une couleur différente', () => {
        const colors = ATTRIBUTE_ORDER.map(a => ATTRIBUTE_MANA_RULES[a].color);
        expect(new Set(colors).size).toBe(5);
    });

    test('Bleu (intelligence) : le gain par match alterne (+1 aux points 3, 7, 11…, tout est entier)', () => {
        expect(manaPerMatch('intelligence', 0, 3)).toBe(3);
        expect(manaPerMatch('intelligence', 1, 3)).toBe(3);   // le 1er point : +1 qì de départ, pas de gain de match
        expect(manaPerMatch('intelligence', 2, 3)).toBe(3);
        expect(manaPerMatch('intelligence', 3, 3)).toBe(4);
        expect(manaPerMatch('intelligence', 7, 3)).toBe(5);
    });

    test('rythme des bonus de couleur : départ aux points 1, 5, 9…, match aux points 3, 7, 11…, réserve tous les 3 points', () => {
        expect(manaBonusFor('intelligence', 5, 'initial')).toBe(2);
        expect(manaBonusFor('intelligence', 5, 'gain')).toBe(1);
        expect(manaBonusFor('intelligence', 5, 'max')).toBe(1);
        expect(manaBonusFor('intelligence', 69, 'max')).toBe(23);
        expect(manaBonusFor('intelligence', 69, 'initial')).toBe(18);
        expect(manaBonusFor('intelligence', 69, 'gain')).toBe(17);
        for (const type of ['initial', 'gain', 'max']) for (let n = 0; n < 80; n++) {
            expect(Number.isInteger(manaBonusFor('strength', n, type))).toBe(true);
            expect(manaBonusFor('strength', n + 1, type) - manaBonusFor('strength', n, type)).toBeLessThanOrEqual(1);
        }
    });

    test('la description annonce les valeurs réelles avant -> après', () => {
        const d = describeAttributeChoice(hero({ intelligence: 1 }), 'intelligence');
        expect(d.points).toBe(1);
        expect(d.nextPoints).toBe(2);
        expect(d.lines.join(' ')).toMatch(/pas de gain de match/);   // le point n° 2 ne donne rien de plus au match
        expect(d.lines.join(' ')).toMatch(/Pas de qì bleu de départ en plus/);
        expect(describeAttributeChoice(hero({ intelligence: 2 }), 'intelligence').lines.join(' ')).toMatch(/donne 4 qì bleu au lieu de 3/);
        expect(describeAttributeChoice(hero({ intelligence: 4 }), 'intelligence').lines.join(' ')).toMatch(/\+1 qì bleu en début de combat/);
        expect(describeAttributeChoice(hero(), 'agility').lines[0]).toMatch(/\+1 défense/);
    });

    test('le résumé permanent reflète les points acquis', () => {
        const s = summarizeColorBonuses(hero({ strength: 2 })).find(c => c.attr === 'strength');
        expect(s).toMatchObject({ color: 'red', perMatch3: 3, initial: 1, cap: 50 });
    });
});

describe('réinitialisation des points d\'attribut', () => {
    // Joueur ayant dépensé des points comme applyAttributeBonus (game.js) : Battle +1 attaque, Agilité et Morale +1 défense, Endurance +1 PV max.
    const spent = () => ({
        attack: 15 + 3, defense: 1 + 4 + 2, maxHp: 100 + 5, hp: 90, unspentLevelPoints: 1,
        attributes: { strength: 3, agility: 4, intelligence: 2, stamina: 5, morale: 2 }
    });

    test('rend tous les points, retire leur effet direct et ne touche pas à la croissance de base', async () => {
        const { respecAttributes, totalAttributePoints } = await import('../../attributes.js');
        const p = spent();
        expect(totalAttributePoints(p)).toBe(16);
        expect(respecAttributes(p)).toEqual({ refunded: 16 });
        expect(p.attributes).toEqual({ strength: 0, agility: 0, intelligence: 0, stamina: 0, morale: 0 });
        expect(p.attack).toBe(15);        // 18 − 3 (Battle)
        expect(p.defense).toBe(1);        // 7 − 4 (Agilité) − 2 (Morale)
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
        expect(before.attack).toBe(18);   // la réinitialisation retire l'effet des points, pas celui des niveaux
    });
});

describe('le Moral (violet) donne de l\'agilité, pas de l\'attaque', () => {
    test('effet direct : +1 défense (comme l\'Agilité), plus aucune attaque', () => {
        expect(ATTRIBUTE_STAT_EFFECTS.morale).toMatchObject({ stat: 'defense', amount: 1 });
        expect(ATTRIBUTE_STAT_EFFECTS.strength.stat).toBe('attack');
        expect(describeAttributeChoice(hero(), 'morale').lines[0]).toMatch(/\+1 défense et \+1 agilité/);
        expect(describeAttributeChoice(hero(), 'morale').statTitle).toBe('Agilité morale');
    });

    test("l'initiative compte les points de Moral comme ceux d'Agilité", () => {
        expect(agilityScore(hero({ agility: 2, morale: 3 }))).toBe(5);
        expect(agilityScore(hero({ strength: 4 }))).toBe(0);
    });
});

describe('la rage dépend des attributs de montée de niveau', () => {
    test('Battle donne de la rage dès le début du combat (quantité)', () => {
        expect(startingRage(hero())).toBe(0);
        expect(startingRage(hero({ strength: 4 }))).toBe(6);   // 1 par point + 1 de plus aux points pairs
        expect(startingRage(hero({ strength: 69 }))).toBe(100);   // plafonnée à la jauge
        expect(startingRage(hero({ strength: 200 }))).toBe(100);
        expect(describeAttributeChoice(hero({ strength: 1 }), 'strength').lines.join(' ')).toMatch(/Rage : \+2 de jauge/);
    });

    test("le Moral accélère l'accumulation de la rage", () => {
        expect(boostedRageGain(hero(), 20)).toBe(20);
        expect(boostedRageGain(hero({ morale: 4 }), 20)).toBe(21);   // +6 % (3 % aux points pairs)
        expect(boostedRageGain(hero({ morale: 200 }), 20)).toBe(40);   // jamais plus du double
        expect(boostedRageGain(hero({ morale: 4 }), 0)).toBe(0);
        expect(describeAttributeChoice(hero(), 'morale').lines.join(' ')).toMatch(/pas de bonus de rage gagnée/);   // le 1er point est impair
        expect(describeAttributeChoice(hero({ morale: 1 }), 'morale').lines.join(' ')).toMatch(/\+3 % de rage gagnée/);
    });
});

describe('plafond de qì par niveau', () => {
    test('73 de qì par les points au niveau 70 (69 points dans une couleur), les 27 restants viennent de l\'équipement', () => {
        expect(summarizeColorBonuses(hero({ strength: 69 })).find(c => c.attr === 'strength').cap).toBe(73);
        expect(summarizeColorBonuses(hero({ strength: 39 })).find(c => c.attr === 'strength').cap).toBe(63);
    });
});

describe('describeAttributeChoice : lignes qui changent (affichées en vert à la montée de niveau)', () => {
    test('`changes` est parallèle à `lines` ; la statistique change toujours', () => {
        for (const attr of ['strength', 'agility', 'intelligence', 'stamina', 'morale']) {
            const d = describeAttributeChoice(hero(), attr);
            expect(d.changes).toHaveLength(d.lines.length);
            expect(d.changes[0]).toBe(true);
        }
    });
    test('une ligne n\'est verte que si le point apporte vraiment quelque chose', () => {
        const d = describeAttributeChoice(hero({ intelligence: 1 }), 'intelligence');   // le point n° 2 ne donne rien de plus au match de 3
        d.lines.forEach((line, i) => {
            if (/pas de gain de match|Pas de qì .* de départ en plus|inchangée/.test(line)) expect(d.changes[i]).toBe(false);
        });
        const up = describeAttributeChoice(hero({ intelligence: 2 }), 'intelligence');   // donne 4 qì au lieu de 3
        expect(up.changes[1]).toBe(true);
        const start = describeAttributeChoice(hero({ intelligence: 4 }), 'intelligence');
        expect(start.changes[3]).toBe(true);
    });
});

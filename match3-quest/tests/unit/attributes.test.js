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

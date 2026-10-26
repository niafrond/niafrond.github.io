import { gearManaBonus, describeManaMax, MANA_COLORS } from '../../manaGear.js';
import { allWeapons } from '../../weapons.js';
import { allStuff, describeStuff } from '../../stuff.js';

describe('qì max de l\'équipement', () => {
    test('somme arme, bouclier et stuff portés, sans compter deux fois la même arme', () => {
        const bow = { id: 'b', manaMax: { red: 10 } };
        const hero = { equippedWeapon: bow, equipment: { rightHand: bow, leftHand: { id: 's', manaMax: { red: 2 } } }, stuff: { ring: 'bague_du_souffle_rouge' } };
        expect(gearManaBonus(hero, 'red')).toBe(10 + 2 + 8);
        expect(gearManaBonus(hero, 'blue')).toBe(0);
    });

    test('descriptions : une couleur, deux couleurs, toutes', () => {
        expect(describeManaMax({ manaMax: { red: 10 } })).toBe('Qì max rouge +10');
        expect(describeManaMax({ manaMax: { green: 12, yellow: 12 } })).toBe('Qì max vert et jaune +12');
        expect(describeManaMax({ manaMax: Object.fromEntries(MANA_COLORS.map(c => [c, 5])) })).toBe('Qì max +5 (toutes les couleurs)');
        expect(describeManaMax({})).toBe('');
    });

    test('le catalogue propose des armes et des stuffs à une, deux et cinq couleurs', () => {
        const sizes = list => new Set(list.filter(x => x.manaMax).map(x => Object.keys(x.manaMax).length));
        [allWeapons, allStuff].forEach(list => { [1, 2, 5].forEach(n => { if (list === allWeapons || n !== 0) expect(sizes(list).has(n)).toBe(true); }); });
        expect(describeStuff(allStuff.find(s => s.id === 'collier_de_la_source'))).toContain('Qì max bleu et vert +8');
    });
});

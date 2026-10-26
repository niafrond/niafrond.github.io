import { previewEquip, equippedCounterpart, isComparable } from '../../equipPreview.js';
import { lootableStuff } from '../../stuff.js';

describe('aperçu d\'équipement chez le marchand', () => {
    const hero = () => ({ attack: 10, defense: 5, maxHp: 100, maxMana: 50, stuff: {}, equipment: { leftHand: null }, equippedWeapon: { id: 'a', atkBonus: 3, defBonus: 0 } });
    const by = (rows, label) => rows.find(r => r.label === label);

    test('arme : remplace l\'arme en main droite', () => {
        const rows = previewEquip(hero(), 'weapon', { id: 'b', atkBonus: 8, defBonus: 2 });
        expect(by(rows, 'Attaque')).toMatchObject({ before: 13, after: 18, delta: 5 });
        expect(by(rows, 'Défense')).toMatchObject({ before: 5, after: 7, delta: 2 });
    });

    test('bouclier : sa défense de base remplace celle du bouclier porté', () => {
        const h = hero();
        h.defense = 5 + 4;
        h.equipment.leftHand = { id: 's1', type: 'shield', defense: 4 };
        const rows = previewEquip(h, 'item', { id: 's2', type: 'shield', defense: 10, defBonus: 1 });
        expect(by(rows, 'Défense')).toMatchObject({ before: 9, after: 16, delta: 7 });
        expect(equippedCounterpart(h, 'item', { type: 'shield' }).id).toBe('s1');
    });

    test('stuff : PV max et stats, sans modifier le héros', () => {
        const piece = lootableStuff()[0];
        const h = hero();
        const rows = previewEquip(h, 'stuff', piece);
        expect(by(rows, 'PV max').after).toBe(100 + (piece.maxHp || 0));
        expect(by(rows, 'Attaque').delta).toBe(piece.atkBonus || 0);
        expect(h.stuff).toEqual({});
    });

    test('seuls armes, stuffs et boucliers sont comparables', () => {
        expect(isComparable('item', { type: 'artifact' })).toBe(false);
        expect(isComparable('item', { type: 'shield' })).toBe(true);
    });
});

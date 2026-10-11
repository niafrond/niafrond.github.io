import { isLongAbsence, buildRecap, absenceDays, ABSENCE_MS } from '../../welcomeBack.js';

describe('welcomeBack', () => {
    it('détecte une absence d\'au moins 2 jours', () => {
        const now = 10 * ABSENCE_MS;
        expect(isLongAbsence(now - ABSENCE_MS, now)).toBe(true);
        expect(isLongAbsence(now - ABSENCE_MS + 1, now)).toBe(false);
        expect(isLongAbsence(null, now)).toBe(false);
        expect(absenceDays(now - 3 * 24 * 3600 * 1000, now)).toBe(3);
    });
    it('résume armes, sorts activés, potions et quêtes', () => {
        const player = {
            weapons: [{ id: 'a', name: 'Arc', description: 'vieux' }], equippedWeapon: { id: 'a' },
            activeSpells: [{ name: 'Feu', description: 'brûle' }],
            inventory: [{ name: 'Élixir', type: 'reusable' }, { name: 'Amulette', type: 'artifact' }]
        };
        const r = buildRecap(player, [{ title: 'Q', objective: 'Aller', ready: false }]);
        expect(r.weapons[0].equipped).toBe(true);
        expect(r.spells).toHaveLength(1);
        expect(r.potions.map(p => p.name)).toEqual(['Élixir']);
        expect(r.quests[0].name).toBe('Q');
    });
});

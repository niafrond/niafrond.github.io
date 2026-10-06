import { bossIntroLines } from '../../cinematics.js';

describe('dialogues d\'avant-combat des soleils', () => {
    test.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('sun_%i a un échange unique de 4 répliques alternées', n => {
        const lines = bossIntroLines({ enemyId: `sun_${n}`, name: 'Soleil', level: 5 });
        expect(lines.map(l => l.who)).toEqual(['boss', 'hero', 'boss', 'hero']);
        lines.forEach(l => expect(l.text.length).toBeLessThanOrEqual(190));
    });
    test('les échanges des soleils sont tous différents', () => {
        const all = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => bossIntroLines({ enemyId: `sun_${n}`, name: 'S', level: 1 })[0].text);
        expect(new Set(all).size).toBe(9);
    });
    test('un boss sans échange dédié garde la réplique générique', () => {
        expect(bossIntroLines({ enemyId: 'x', name: 'Soleil', level: 1 })).toHaveLength(2);
    });
});

import { dialogFlags } from '../../dialogState.js';

describe('dialogFlags', () => {
    const choices = { lines: ['Suivre ?'], choices: [{ label: 'Oui' }, { label: 'Non' }] };
    const plain = { lines: ['a', 'b'] };

    test('un dialogue à choix montre ses boutons même avec un autre dialogue en attente derrière lui', () => {
        expect(dialogFlags(choices, 0, 1)).toMatchObject({ showChoices: true, closing: true });
        expect(dialogFlags(choices, 0, 2)).toMatchObject({ showChoices: true, closing: false });
    });

    test('pas de boutons avant la dernière réplique ni sans choix', () => {
        expect(dialogFlags({ ...choices, lines: ['1', '2'] }, 0, 1).showChoices).toBe(false);
        expect(dialogFlags(plain, 1, 2)).toMatchObject({ showChoices: false, lastLine: true, closing: false });
        expect(dialogFlags(plain, 1, 1).closing).toBe(true);
    });
});

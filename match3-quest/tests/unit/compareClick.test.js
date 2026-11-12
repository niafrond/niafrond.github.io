/** @jest-environment jsdom */
import { describe, test, expect } from '@jest/globals';
import { onCompareClick, getCompareSelection, compareAttrs } from '../../compareView.js';

describe('comparaison au clic sur une carte', () => {
    test('les attributs de carte portent le type et l\'identifiant', () => {
        expect(compareAttrs('stuff', 'a')).toBe(' data-cmp-kind="stuff" data-cmp-id="a"');
    });

    test('un clic choisit, un second clic sur la même carte désélectionne', () => {
        expect(onCompareClick('stuff', 'a')).toBe('selected');
        expect(getCompareSelection()).toEqual({ kind: 'stuff', id: 'a' });
        expect(onCompareClick('stuff', 'a')).toBe('cleared');
        expect(getCompareSelection()).toBeNull();
    });

    test('changer de type remplace la référence', () => {
        onCompareClick('stuff', 'a');
        expect(onCompareClick('weapon', 'a')).toBe('selected');
        expect(getCompareSelection()).toEqual({ kind: 'weapon', id: 'a' });
        onCompareClick('weapon', 'a');
    });
});

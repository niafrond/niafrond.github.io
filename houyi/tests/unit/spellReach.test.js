import { describe, test, expect } from '@jest/globals';
import { unreachableCosts, unreachableText } from '../../spellReach.js';

describe('sorts hors de portée de la réserve de qì', () => {
    const cap = c => ({ red: 50, blue: 50, green: 62 }[c] ?? 50);
    test('un coût qui dépasse la réserve d\'une couleur est signalé', () => {
        const parts = unreachableCosts({ cost: { red: 56, blue: 40, green: 55 } }, cap);
        expect(parts).toEqual([{ color: 'red', cost: 56, cap: 50 }]);
    });
    test('cas limite : coût égal à la réserve, coût simple ou absent, sort à portée', () => {
        expect(unreachableCosts({ cost: { red: 50 } }, cap)).toEqual([]);
        expect(unreachableCosts({ cost: 30, color: 'red' }, cap)).toEqual([]);
        expect(unreachableCosts({}, cap)).toEqual([]);
        expect(unreachableCosts(null, cap)).toEqual([]);
        expect(unreachableText([])).toBe('');
    });
    test('la phrase nomme la couleur, le coût et la réserve', () => {
        const text = unreachableText([{ color: 'red', cost: 56, cap: 50 }]);
        expect(text).toMatch(/rouge/);
        expect(text).toMatch(/56/);
        expect(text).toMatch(/50/);
    });
});

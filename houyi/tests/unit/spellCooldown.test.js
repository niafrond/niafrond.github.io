import { spellCooldownLeft, startSpellCooldown, tickSpellCooldowns, resetSpellCooldowns } from '../../spellCooldown.js';

describe('temps de recharge des sorts', () => {
    beforeEach(() => resetSpellCooldowns());

    test('un sort sans cooldown reste disponible', () => {
        startSpellCooldown({ id: 'a' });
        expect(spellCooldownLeft('a')).toBe(0);
    });

    test('cooldown 2 : indisponible un tour, puis disponible', () => {
        startSpellCooldown({ id: 'brasierSeals', cooldown: 2 });
        expect(spellCooldownLeft('brasierSeals')).toBe(2);
        expect(tickSpellCooldowns()).toEqual([]);
        expect(spellCooldownLeft('brasierSeals')).toBe(1);
        expect(tickSpellCooldowns()).toEqual(['brasierSeals']);
        expect(spellCooldownLeft('brasierSeals')).toBe(0);
    });

    test('reset vide les compteurs', () => {
        startSpellCooldown({ id: 'a', cooldown: 3 });
        resetSpellCooldowns();
        expect(spellCooldownLeft('a')).toBe(0);
    });
});

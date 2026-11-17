import { jest } from '@jest/globals';
import { flashStatusDamage } from '../../statusFlash.js';

describe('clignotement des altérations qui blessent', () => {
    afterEach(() => { jest.useRealTimers(); delete globalThis.document; delete globalThis.Element; delete globalThis.window; });

    test('hors navigateur : sans effet, sans erreur', () => {
        expect(() => flashStatusDamage(true, 'poisoned')).not.toThrow();
    });
    test('anime la pastille et la barre de vie du bon combattant, après le redessin de la fiche', () => {
        jest.useFakeTimers();
        const animated = [];
        const el = name => ({ animate: (frames, opts) => animated.push({ name, frames: frames.length, ms: opts.duration }) });
        const found = { '#enemy-stats .status-badge[data-status="poisoned"]': el('badge'), '#enemy-stats .hp-bar-container': el('bar') };
        globalThis.Element = { prototype: { animate() {} } };
        globalThis.window = { matchMedia: () => ({ matches: false }) };
        globalThis.document = { body: { classList: { contains: () => false } }, querySelector: sel => found[sel] || null };
        flashStatusDamage(false, 'poisoned');
        expect(animated).toEqual([]);                 // pas avant le redessin
        jest.advanceTimersByTime(300);
        expect(animated.map(a => a.name)).toEqual(['badge', 'bar']);
        expect(animated.every(a => a.ms === 700 && a.frames === 5)).toBe(true);
    });
    test('mouvement réduit : aucun clignotement', () => {
        jest.useFakeTimers();
        const animate = jest.fn();
        globalThis.Element = { prototype: { animate() {} } };
        globalThis.window = { matchMedia: () => ({ matches: true }) };
        globalThis.document = { body: { classList: { contains: () => false } }, querySelector: () => ({ animate }) };
        flashStatusDamage(true, 'burning');
        jest.advanceTimersByTime(500);
        expect(animate).not.toHaveBeenCalled();
    });
});

/** @jest-environment jsdom */
import { jest, describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { installFocusPause } from '../../focusPause.js';

describe('focusPause', () => {
    let api, fired;
    beforeAll(() => { jest.useFakeTimers(); api = installFocusPause(window); });
    beforeEach(() => { fired = []; });
    afterAll(() => jest.useRealTimers());

    test('gèle les minuteries pendant la pause et les reprend avec le temps restant', () => {
        setTimeout(() => fired.push('t'), 1000);
        jest.advanceTimersByTime(400);
        window.dispatchEvent(new Event('blur'));
        expect(api.isPaused()).toBe(true);
        expect(document.documentElement.classList.contains('focus-paused')).toBe(true);
        jest.advanceTimersByTime(5000);
        expect(fired).toEqual([]);
        window.dispatchEvent(new Event('focus'));
        expect(api.isPaused()).toBe(false);
        jest.advanceTimersByTime(500);
        expect(fired).toEqual([]);
        jest.advanceTimersByTime(200);
        expect(fired).toEqual(['t']);
    });

    test('une minuterie créée pendant la pause ne démarre qu\'au retour du focus, et clearTimeout fonctionne', () => {
        api.pause();
        setTimeout(() => fired.push('a'), 100);
        const b = setTimeout(() => fired.push('b'), 100);
        clearTimeout(b);
        jest.advanceTimersByTime(1000);
        expect(fired).toEqual([]);
        api.resume();
        jest.advanceTimersByTime(100);
        expect(fired).toEqual(['a']);
    });

    test('les intervalles sont gelés puis repartent', () => {
        const id = setInterval(() => fired.push('i'), 100);
        jest.advanceTimersByTime(250);
        api.pause();
        jest.advanceTimersByTime(1000);
        expect(fired).toEqual(['i', 'i']);
        api.resume();
        jest.advanceTimersByTime(100);
        expect(fired).toEqual(['i', 'i', 'i']);
        clearInterval(id);
        jest.advanceTimersByTime(500);
        expect(fired.length).toBe(3);
    });
});

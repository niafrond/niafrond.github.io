/** @jest-environment jsdom */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { breakThreshold, breakDurationLabel, buildBreakMessage, showBreakReminder, createBreakWatcher, BREAK_VARIANT_COUNT } from '../../breakReminder.js';

beforeEach(() => { document.body.innerHTML = ''; });

describe('rappel de pause', () => {
    test('seuils : 1 h puis toutes les 30 min', () => {
        expect([0, 1, 2, 3].map(breakThreshold)).toEqual([3600, 5400, 7200, 9000]);
    });

    test('durée lisible', () => {
        expect([3600, 3700, 5400, 7200, 9000].map(breakDurationLabel)).toEqual(['1 h', '1 h', '1 h 30', '2 h', '2 h 30']);
    });

    test('le message est composé et varie avec le tirage', () => {
        const low = buildBreakMessage(3600, () => 0);
        const high = buildBreakMessage(3600, () => 0.999);
        expect(low.hook).toContain('1 h');
        expect(low).not.toEqual(high);
        expect(BREAK_VARIANT_COUNT).toBeGreaterThan(1000);
    });

    test('aucune accroche ne laisse un blanc à la place de la durée', () => {
        for (let i = 0; i < 100; i++) {
            const m = buildBreakMessage(5400, () => i / 100);
            expect(m.hook).toMatch(/1 h 30/);
            expect(Object.values(m).join(' ')).not.toMatch(/undefined|\$\{/);
        }
    });

    test('la popup est affichée une seule fois et se ferme', () => {
        const first = showBreakReminder(3600);
        expect(first).not.toBeNull();
        expect(showBreakReminder(3600)).toBeNull();
        document.getElementById('break-reminder-close').click();
        expect(document.getElementById('break-reminder-modal')).toBeNull();
    });
});

describe('surveillance du temps de jeu', () => {
    const run = (calm = () => true) => {
        const show = jest.fn();
        const tick = createBreakWatcher({ isCalm: calm, show });
        let now = Date.now();
        const advance = seconds => { for (let s = 0; s < seconds; s++) { now += 1000; tick(now); } };
        return { show, advance };
    };

    test('rien avant 1 h, un rappel à 1 h, puis un toutes les 30 min', () => {
        const { show, advance } = run();
        advance(3599);
        expect(show).not.toHaveBeenCalled();
        advance(1);
        expect(show).toHaveBeenCalledTimes(1);
        advance(1799);
        expect(show).toHaveBeenCalledTimes(1);
        advance(1);
        expect(show).toHaveBeenCalledTimes(2);
    });

    test('attend un moment calme sans perdre le rappel', () => {
        let calm = false;
        const { show, advance } = run(() => calm);
        advance(4000);
        expect(show).not.toHaveBeenCalled();
        calm = true;
        advance(1);
        expect(show).toHaveBeenCalledTimes(1);
        advance(1);
        expect(show).toHaveBeenCalledTimes(1);   // pas de rafale de rappels manqués
    });
});

describe('fermeture de la popup', () => {
    test('Échap et clic à côté ferment, sans toucher au compteur de session', () => {
        const show = jest.fn(s => showBreakReminder(s));
        const tick = createBreakWatcher({ show });
        let now = Date.now();
        const advance = n => { for (let i = 0; i < n; i++) { now += 1000; tick(now); } };
        advance(3600);
        expect(document.getElementById('break-reminder-modal')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(document.getElementById('break-reminder-modal')).toBeNull();
        advance(1799);
        expect(show).toHaveBeenCalledTimes(1);   // fermer ne relance pas la popup
        advance(1);
        expect(show).toHaveBeenCalledTimes(2);   // prochain rappel 30 min après le seuil, pas après la fermeture
        const modal = document.getElementById('break-reminder-modal');
        modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById('break-reminder-modal')).toBeNull();
    });
});

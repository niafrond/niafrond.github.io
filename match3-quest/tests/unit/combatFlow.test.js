import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import {
    MIN_ANNOUNCE_MS, createAnnouncement, announceDurationMs, waitUntil, isHpBarEmpty,
    openingStrikeCount, isWeaknessShown
} from '../../combatFlow.js';
import { createActionGuard } from '../../actionGuard.js';

const game = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');

describe('annonces : 2 s minimum, fermables ensuite', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('un clic avant 2 s est ignoré, après 2 s il ferme', () => {
        const done = jest.fn();
        const a = createAnnouncement({ autoMs: 6000, onDone: done });
        jest.advanceTimersByTime(MIN_ANNOUNCE_MS - 1);
        expect(a.canSkip()).toBe(false);
        expect(a.skip()).toBe(false);
        expect(done).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(a.canSkip()).toBe(true);
        expect(a.skip()).toBe(true);
        expect(done).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(10000);
        expect(done).toHaveBeenCalledTimes(1);   // jamais deux fois
    });
    test('sans clic elle se ferme seule, jamais avant 2 s', () => {
        const done = jest.fn();
        createAnnouncement({ autoMs: 500, onDone: done });
        jest.advanceTimersByTime(MIN_ANNOUNCE_MS - 1);
        expect(done).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(done).toHaveBeenCalledTimes(1);
    });
    test('la durée automatique croît avec le nombre de lignes', () => {
        expect(announceDurationMs(0, 1)).toBe(MIN_ANNOUNCE_MS);
        expect(announceDurationMs(3, 1)).toBeGreaterThan(announceDurationMs(1, 1));
    });
    test('cancel termine sans condition', () => {
        const done = jest.fn();
        const a = createAnnouncement({ onDone: done });
        a.cancel();
        expect(done).toHaveBeenCalledTimes(1);
    });
});

describe('écran de victoire / défaite : barre de PV réellement vide', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('isHpBarEmpty exige un compteur terminé et une valeur affichée à 0', () => {
        expect(isHpBarEmpty({ shownValue: 12, animating: true })).toBe(false);
        expect(isHpBarEmpty({ shownValue: 0, animating: true })).toBe(false);
        expect(isHpBarEmpty({ shownValue: 3, animating: false })).toBe(false);
        expect(isHpBarEmpty({ shownValue: 0, animating: false })).toBe(true);
        expect(isHpBarEmpty({ shownValue: null, animating: false })).toBe(true);
    });
    test('waitUntil attend la condition puis rappelle une seule fois', () => {
        let ready = false;
        const cb = jest.fn();
        waitUntil(() => ready, cb, { pollMs: 50, maxMs: 5000 });
        jest.advanceTimersByTime(1000);
        expect(cb).not.toHaveBeenCalled();
        ready = true;
        jest.advanceTimersByTime(60);
        expect(cb).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(5000);
        expect(cb).toHaveBeenCalledTimes(1);
    });
    test('filet de sécurité : rappel après maxMs même si la barre ne se vide pas', () => {
        const cb = jest.fn();
        waitUntil(() => false, cb, { pollMs: 50, maxMs: 1000 });
        jest.advanceTimersByTime(1100);
        expect(cb).toHaveBeenCalledTimes(1);
    });
    test('game.js attend la barre de PV avant l\'écran de fin', () => {
        expect(game).toMatch(/function whenLoserHpBarEmpty/);
        expect(game).toMatch(/whenLoserHpBarEmpty\(isVictory, \(\) => \{[\s\S]*finalizeCombatEndUI\(true\)/);
    });
});

describe('coups d\'ouverture et faiblesse repérée', () => {
    test('l\'embuscade donne un coup, la faiblesse repérée aucun', () => {
        expect(openingStrikeCount({ tags: ['ambush'] })).toBe(1);
        expect(openingStrikeCount({ tags: ['observed'] })).toBe(0);
        expect(openingStrikeCount({ tags: ['ambush', 'observed', 'trap'] })).toBe(1);
        expect(openingStrikeCount(null)).toBe(0);
    });
    test('la ligne Faiblesse n\'apparaît que si elle est repérée', () => {
        expect(isWeaknessShown({ weaknessRevealed: true })).toBe(true);
        expect(isWeaknessShown({ weaknessRevealed: false })).toBe(false);
        expect(isWeaknessShown(undefined)).toBe(false);
    });
    test('game.js n\'utilise plus \'observed\' pour les coups d\'ouverture et n\'a plus de bandeau séparé', () => {
        expect(game).not.toMatch(/t === 'observed'/);
        expect(game).not.toMatch(/showPrepBanner/);
        expect(game).toMatch(/showCombatIntro\(/);
        expect(game).toMatch(/bindEnemyCardTap\(enemyDiv\)/);
    });
});

describe('boutons du joueur verrouillés hors de son tour', () => {
    test('l\'actionGuard refuse tout tant que le tour est verrouillé, puis réautorise', () => {
        const g = createActionGuard(() => 100000);
        g.setTurnLocked(true);
        expect(g.blockReason()).toBe('turn');
        g.setTurnLocked(false);
        expect(g.blockReason()).toBeNull();
    });
    test('reset() déverrouille', () => {
        const g = createActionGuard(() => 100000);
        g.setTurnLocked(true);
        g.reset();
        expect(g.isTurnLocked()).toBe(false);
    });
    test('game.js synchronise le verrouillage à chaque updateStats', () => {
        expect(game).toMatch(/export function updateStats\(\)\{\s*syncPlayerControlsLock\(\)/);
        expect(game).toMatch(/actionGuard\.setTurnLocked\(locked\)/);
        expect(css).toMatch(/#player-spells\.turn-locked/);
    });
});

describe('écran de résultat : trois sections', () => {
    test('expérience, pièces et objets ont chacune titre, icône et cadre', () => {
        ['xp', 'gold', 'items'].forEach(k => {
            expect(game).toContain(`section('${k}'`);
            expect(css).toContain(`.battle-result-sec-${k}`);
        });
        expect(game).toMatch(/Aucun butin/);
        expect(css).toMatch(/100dvh/);
    });
});

/** @jest-environment jsdom */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { addPlayTime, playTimeStats, realPlayTimeStats, formatDuration, PLAYTIME_STORAGE_KEY } from '../../playTime.js';

beforeEach(() => localStorage.clear());

describe('temps de jeu', () => {
    const wed = new Date(2026, 9, 21, 12);   // mercredi 21 octobre 2026

    test('aujourd\'hui, hier, semaine (depuis lundi) et total', () => {
        addPlayTime(100, new Date(2026, 9, 19, 9));    // lundi
        addPlayTime(200, new Date(2026, 9, 20, 9));    // mardi (hier)
        addPlayTime(300, wed);                          // aujourd'hui
        addPlayTime(400, new Date(2026, 9, 18, 9));    // dimanche précédent : hors semaine
        expect(playTimeStats(wed)).toEqual({ today: 300, yesterday: 200, week: 600, total: 1000 });
    });

    test('le total survit à l\'élagage des anciens jours', () => {
        addPlayTime(50, new Date(2026, 0, 1));
        addPlayTime(10, wed);
        const s = playTimeStats(wed);
        expect(s.total).toBe(60);
        expect(Object.keys(JSON.parse(localStorage.getItem(PLAYTIME_STORAGE_KEY)).days)).toEqual(['2026-10-21']);
    });

    test('stockage corrompu ou durée invalide : repart de zéro', () => {
        localStorage.setItem(PLAYTIME_STORAGE_KEY, '{pas du json');
        addPlayTime(-5, wed); addPlayTime(NaN, wed);
        expect(playTimeStats(wed)).toEqual({ today: 0, yesterday: 0, week: 0, total: 0 });
    });

    test('temps de jeu réel : seulement la part où le joueur agit', () => {
        addPlayTime(100, wed, 40);
        addPlayTime(50, new Date(2026, 9, 20, 9), 50);
        addPlayTime(30, wed);
        expect(playTimeStats(wed).total).toBe(180);
        expect(realPlayTimeStats(wed)).toEqual({ today: 40, yesterday: 50, week: 90, total: 90 });
    });

    test('ancien stockage sans temps réel : réel à zéro', () => {
        localStorage.setItem(PLAYTIME_STORAGE_KEY, JSON.stringify({ total: 70, days: { '2026-10-21': 70 } }));
        expect(realPlayTimeStats(wed).total).toBe(0);
        expect(playTimeStats(wed).total).toBe(70);
    });

    test('format de durée', () => {
        expect(formatDuration(20)).toBe('20 s');
        expect(formatDuration(125)).toBe('2 min');
        expect(formatDuration(3725)).toBe('1 h 02');
    });
});

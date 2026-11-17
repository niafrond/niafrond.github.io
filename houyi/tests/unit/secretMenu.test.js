import { describe, test, expect } from '@jest/globals';
import { createClickCounter, setHeroLevel } from '../../secretLogic.js';

describe('menu secret', () => {
    test('6 clics rapprochés déclenchent, un délai trop long remet à zéro', () => {
        let t = 0;
        const hit = createClickCounter(6, 3000, () => t);
        const res = [];
        for (let i = 0; i < 5; i++) { t += 500; res.push(hit()); }
        expect(res.some(Boolean)).toBe(false);
        t += 500;
        expect(hit()).toBe(true);
        for (let i = 0; i < 3; i++) { t += 500; hit(); }
        t += 5000;
        for (let i = 0; i < 5; i++) { t += 500; expect(hit()).toBe(false); }
    });

    test('setHeroLevel borne le niveau et aligne l\'XP', () => {
        const hero = {};
        expect(setHeroLevel(hero, 999)).toBe(70);
        expect(setHeroLevel(hero, 0)).toBe(1);
        expect(setHeroLevel(hero, 12)).toBe(12);
        expect(hero.xp).toBeGreaterThan(0);
    });
});

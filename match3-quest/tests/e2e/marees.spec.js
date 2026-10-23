// Hautes-Eaux de la Lune Montante (world/PLAN-MAREES.md) : chaque écran se charge et se dessine sans erreur (sol en planches, eau-herbe, maisons sur pilotis).
// Avec MAREES_SHOTS=<dossier>, une capture de chaque écran y est enregistrée (relecture visuelle).
import { test, expect } from '@playwright/test';

const URL = '/match3-quest/';
const SCREENS = [
    ['marees_road', 6, 11], ['marees_village', 2, 12], ['marees_wild', 2, 12], ['marees', 3, 10]
];

const loaded = page => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });

test.describe('match3-quest · Hautes-Eaux', () => {
    test.setTimeout(90_000);

    for (const [id, x, y] of SCREENS) {
        test(`${id} : se charge et se dessine sans erreur`, async ({ page }) => {
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(URL);
            await loaded(page);
            await page.click('.class-card');
            await page.click('#confirm-class');
            await page.waitForSelector('#explore-canvas', { state: 'visible' });
            await page.evaluate(([screenId, px, py]) => {
                const p = JSON.parse(localStorage.getItem('player'));
                Object.assign(p.exploration, { screenId, x: px, y: py });
                p.exploration.quests = { ...(p.exploration.quests || {}), sq_pas_de_yu: 'done' };
                localStorage.setItem('player', JSON.stringify(p));
            }, [id, x, y]);
            await page.reload();
            await loaded(page);
            await page.waitForSelector('#explore-canvas', { state: 'visible' });
            await page.waitForTimeout(2500);
            if (process.env.MAREES_SHOTS) await page.screenshot({ path: `${process.env.MAREES_SHOTS}/${id}.png` });
            expect(await page.evaluate(() => JSON.parse(localStorage.getItem('player')).exploration.screenId)).toBe(id);
            expect(errors).toEqual([]);
        });
    }
});

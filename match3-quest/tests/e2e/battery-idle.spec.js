// Batterie : héros immobile sur la carte, la boucle de rendu ne doit plus se réveiller à chaque rafraîchissement d'écran
// (elle dort entre deux images d'ambiance, ~30 i/s), repart à pleine cadence dès que le héros marche, et ralentit encore
// (~11 i/s) quand plus rien n'est touché depuis 20 s.
import { test, expect } from '@playwright/test';

const URL = '/match3-quest/';
const loaded = page => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });

test.describe('match3-quest · économie de batterie', () => {
    test.setTimeout(120_000);

    test('la carte au repos ne redessine pas à chaque rafraîchissement', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        // Compte les demandes d'image (requestAnimationFrame) de toute la page.
        await page.addInitScript(() => {
            window.__raf = 0;
            const raf = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = cb => { window.__raf++; return raf(cb); };
        });
        await page.goto(URL);
        await loaded(page);
        await page.click('.class-card');
        await page.click('#confirm-class');
        await page.waitForSelector('#explore-canvas', { state: 'visible' });
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('player'));
            Object.assign(p.exploration, { screenId: 'rizieres_village', x: 6, y: 8 });
            localStorage.setItem('player', JSON.stringify(p));
        });
        await page.reload();
        await loaded(page);
        await page.waitForSelector('#explore-canvas', { state: 'visible' });
        await page.waitForTimeout(2500);

        const rate = async ms => {
            const start = await page.evaluate(() => window.__raf);
            await page.waitForTimeout(ms);
            return (await page.evaluate(() => window.__raf) - start) * 1000 / ms;
        };
        const idle = await rate(3000);
        await page.keyboard.down('ArrowRight');
        const moving = await rate(800);
        await page.keyboard.up('ArrowRight');
        // Téléphone posé : plus aucune saisie depuis 20 s, l'ambiance passe à ~11 i/s.
        await page.waitForTimeout(21_000);
        const deep = await rate(2000);
        console.log(`requestAnimationFrame/s : repos ${idle.toFixed(1)}, marche ${moving.toFixed(1)}, veille profonde ${deep.toFixed(1)}`);
        expect(idle).toBeLessThan(40);          // ~30 i/s au repos (une par rafraîchissement d'écran avant : 60 à 120)
        expect(moving).toBeGreaterThan(idle);   // la marche repart à la cadence de l'écran
        expect(deep).toBeLessThan(15);
        expect(errors).toEqual([]);
    });
});

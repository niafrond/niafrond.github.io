// Compagnon suiveur en exploration : il apparaît derrière le héros, marche avec lui et se dessine sans erreur.
// Avec COMPANION_SHOTS=<dossier>, des captures (à l'arrêt, en marche, après un virage) y sont enregistrées pour relecture visuelle.
import { test, expect } from '@playwright/test';

const URL = '/match3-quest/';
const loaded = page => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });

test.describe('match3-quest · compagnon suiveur', () => {
    test.setTimeout(120_000);

    test('Xiao Gui suit le héros à la trace sans erreur', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(URL);
        await loaded(page);
        await page.click('.class-card');
        await page.click('#confirm-class');
        await page.waitForSelector('#explore-canvas', { state: 'visible' });
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('player'));
            Object.assign(p.exploration, { screenId: 'rizieres_village', x: 6, y: 8, activeCompanion: 'xiao_gui' });
            p.exploration.quests = { ...(p.exploration.quests || {}), sq_rice_thief: 'done' };
            localStorage.setItem('player', JSON.stringify(p));
        });
        await page.reload();
        await loaded(page);
        await page.waitForSelector('#explore-canvas', { state: 'visible' });
        await page.waitForTimeout(2000);
        const shot = async name => { if (process.env.COMPANION_SHOTS) await page.screenshot({ path: `${process.env.COMPANION_SHOTS}/${name}.png` }); };
        await shot('1-arret');
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(700);
        await shot('2-marche-droite');
        await page.keyboard.up('ArrowRight');
        await page.keyboard.down('ArrowDown');
        await page.waitForTimeout(500);
        await shot('3-virage-bas');
        await page.keyboard.up('ArrowDown');
        await page.waitForTimeout(1200);
        await shot('4-arret-apres');
        expect(errors).toEqual([]);
    });
});

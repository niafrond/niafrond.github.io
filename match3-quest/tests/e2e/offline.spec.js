// Jeu hors ligne : après une première visite, le service worker (sw.js) sert le jeu depuis le téléphone, sans aucun réseau.
import { test, expect } from '@playwright/test';

const URL = '/match3-quest/';
const loaded = page => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });

test.describe('match3-quest · hors ligne (service worker)', () => {
    test.setTimeout(90_000);

    test('après une première visite, le jeu redémarre sans réseau', async ({ page, context }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(URL);
        await loaded(page);

        // Service worker actif et prêt à contrôler la page, cache du cœur rempli (≈ 180 fichiers). `expect.poll` : `waitForFunction` ne
        // sait pas attendre un prédicat asynchrone (la promesse retournée serait toujours « vraie »).
        await expect.poll(() => page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg || !reg.active || !navigator.serviceWorker.controller) return false;
            const name = (await caches.keys()).find(k => k.startsWith('match3-core-v'));
            return Boolean(name) && (await (await caches.open(name)).keys()).length > 150;
        }), { timeout: 30_000 }).toBe(true);

        await context.setOffline(true);
        await page.reload();
        await loaded(page);
        await expect(page.locator('.class-card').first()).toBeVisible();
        expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
        expect(errors).toEqual([]);
    });

    test('sans service worker, le même scénario hors ligne échoue (témoin : le test mesure bien le cache)', async ({ browser }) => {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        const page = await context.newPage();
        await page.goto(URL);
        await loaded(page);
        await context.setOffline(true);
        const reloaded = await page.reload().then(() => true, () => false);
        const playable = reloaded && await page.locator('.class-card').first().isVisible().catch(() => false);
        expect(playable).toBe(false);
        await context.close();
    });
});

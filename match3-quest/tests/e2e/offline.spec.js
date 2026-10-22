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

    test('« tout pré-télécharger » : musiques et dessins sont disponibles sans réseau, et le statut des Options le dit', async ({ page, context }) => {
        test.setTimeout(240_000);
        await page.goto(URL);
        await loaded(page);
        await expect.poll(() => page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return Boolean(reg && reg.active && navigator.serviceWorker.controller);
        }), { timeout: 30_000 }).toBe(true);

        // Options : « Jeu hors ligne » (le téléchargement démarre seul après quelques secondes ; sinon on le lance)
        await page.evaluate(() => document.getElementById('options-modal').classList.add('active'));
        const status = page.locator('#offline-status');
        await expect(status).toContainText(/Non téléchargé|Téléchargement|Prêt hors ligne/, { timeout: 30_000 });
        const button = page.locator('#offline-btn');
        if ((await button.textContent()) === 'Télécharger') await button.click();
        await expect(status).toContainText('Prêt hors ligne', { timeout: 200_000 });

        await context.setOffline(true);
        const fetched = await page.evaluate(async () => {
            const urls = ['audio/music/title.mp3', 'audio/music/boss-a0.mp3', 'sprites/ultimates/ultimateFiveElements-1.png', 'sprites/spellfx/index.json', 'sprites/prologue/index.json'];
            const out = {};
            for (const url of urls) {
                try { const res = await fetch(url); out[url] = [res.status, (await res.arrayBuffer()).byteLength > 0]; } catch (e) { out[url] = ['erreur', false]; }
            }
            return out;
        });
        Object.values(fetched).forEach(([status, hasBody]) => { expect(status).toBe(200); expect(hasBody).toBe(true); });

        // Rechargé sans réseau, le jeu redémarre et les Options affichent toujours « prêt »
        await page.reload();
        await loaded(page);
        await page.evaluate(() => document.getElementById('options-modal').classList.add('active'));
        await expect(status).toContainText('Prêt hors ligne', { timeout: 30_000 });
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

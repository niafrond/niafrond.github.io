// Tests de performance « mobile bas de gamme » : Pixel 5 émulé + processeur ralenti ×4 (CDP).
// Les assertions fondées sur des compteurs (appels canvas, propriétés animées, options audio) sont déterministes ;
// celles fondées sur le temps ont de larges marges pour rester stables en CI (rendu logiciel, machine variable).
import { test, expect } from '@playwright/test';

const URL = '/match3-quest/';
const CPU_SLOWDOWN = 4;

// Compteurs injectés avant le chargement : appels canvas, images, tâches longues, contextes audio.
const instrument = ({ cores }) => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => (cores <= 4 ? 2 : 8) });

    const c = (window.__perf = { shadowBlur: 0, fillRect: 0, frames: 0, longTasks: 0, blockingMs: 0, audioArgs: [] });
    const P = CanvasRenderingContext2D.prototype;
    const blur = Object.getOwnPropertyDescriptor(P, 'shadowBlur');
    Object.defineProperty(P, 'shadowBlur', {
        get() { return blur.get.call(this); },
        set(v) { if (v > 0) c.shadowBlur++; blur.set.call(this, v); }
    });
    const fillRect = P.fillRect;
    P.fillRect = function (...a) { c.fillRect++; return fillRect.apply(this, a); };
    const loop = () => { c.frames++; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try {
        new PerformanceObserver(list => list.getEntries().forEach(e => { c.longTasks++; c.blockingMs += e.duration - 50; }))
            .observe({ entryTypes: ['longtask'] });
    } catch { /* longtask non supporté */ }

    const Native = window.AudioContext;
    if (Native) {
        window.AudioContext = function (opts) { c.audioArgs.push(opts === undefined ? null : opts); return new Native(opts); };
        window.AudioContext.prototype = Native.prototype;
    }
};

const resetCounters = page => page.evaluate(() => {
    const c = window.__perf;
    c.shadowBlur = c.fillRect = c.frames = c.longTasks = c.blockingMs = 0;
});

async function openGame(page, context, { cores = 4 } = {}) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
    await page.addInitScript(instrument, { cores });
    const errors = [];
    const failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) failed.push(`${r.status()} ${r.url()}`); });

    const t0 = Date.now();
    await page.goto(URL);
    await page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });
    return { loadMs: Date.now() - t0, errors, failed };
}

async function enterExploration(page) {
    await page.click('#skip-class');
    await page.waitForSelector('#explore-canvas', { state: 'visible' });
    await page.waitForTimeout(2000); // chargement des dessins de la région + mise en cache du sol
}

test.describe('match3-quest · performances mobile (CPU ×4)', () => {
    test.setTimeout(60_000);

    test('démarrage : budget de chargement, aucune erreur ni ressource manquante', async ({ page, context }) => {
        const { loadMs, errors, failed } = await openGame(page, context);
        expect(errors).toEqual([]);
        expect(failed).toEqual([]);
        expect(loadMs).toBeLessThan(20_000);
    });

    test('exploration : le fond est mis en cache (pas de flou ni de rafale de fillRect par image)', async ({ page, context }) => {
        await openGame(page, context);
        await enterExploration(page);
        await resetCounters(page);
        await page.waitForTimeout(3000);
        const c = await page.evaluate(() => window.__perf);

        expect(c.frames).toBeGreaterThan(20);
        // shadowBlur (ombre floue de la falaise) n'est appliqué qu'à la construction du calque, jamais à chaque image
        expect(c.shadowBlur).toBeLessThanOrEqual(2);
        // Avant la mise en cache : ≈ 640 fillRect / image. Marge confortable au-dessus du ≈ 160 actuel.
        expect(c.fillRect / c.frames).toBeLessThan(320);
    });

    test('exploration : fluidité et blocage du thread principal bornés', async ({ page, context }) => {
        await openGame(page, context);
        await enterExploration(page);
        await resetCounters(page);
        await page.waitForTimeout(4000);
        const c = await page.evaluate(() => window.__perf);

        // ≥ 6 images/s même avec un CPU ralenti ×4 en rendu logiciel (le plancher réel mesuré est ≈ 15)
        expect(c.frames / 4).toBeGreaterThan(6);
        // Temps de blocage cumulé (au-delà de 50 ms par tâche) sur 4 s : mesuré ≈ 600 ms, plafond large
        expect(c.blockingMs).toBeLessThan(2500);
    });

    test('coup suggéré : seules des propriétés composables sont animées', async ({ page, context }) => {
        await openGame(page, context);
        const props = await page.evaluate(() => {
            const tile = document.createElement('div');
            tile.className = 'tile red suggested';
            document.body.appendChild(tile);
            const names = new Set();
            for (const a of tile.getAnimations({ subtree: true })) {
                for (const kf of a.effect.getKeyframes()) {
                    Object.keys(kf).forEach(k => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(k)) names.add(k); });
                }
            }
            tile.remove();
            return [...names].sort();
        });
        expect(props.length).toBeGreaterThan(0);
        // `outlineColor` : contour d'un seul élément, peu coûteux ; box-shadow / filter (flous) sont proscrits
        const allowed = new Set(['transform', 'opacity', 'outlineColor']);
        expect(props.filter(p => !allowed.has(p))).toEqual([]);
    });

    test('audio : tampon élargi sur appareil modeste, comportement par défaut sinon', async ({ page, context }) => {
        await openGame(page, context, { cores: 2 });
        await page.mouse.click(180, 400); // geste utilisateur : crée le contexte audio
        await page.waitForFunction(() => window.__perf.audioArgs.length > 0);
        expect(await page.evaluate(() => window.__perf.audioArgs[0])).toEqual({ latencyHint: 0.15 });
    });

    test('audio : appareil puissant, contexte audio par défaut', async ({ page, context }) => {
        await openGame(page, context, { cores: 8 });
        await page.mouse.click(180, 400);
        await page.waitForFunction(() => window.__perf.audioArgs.length > 0);
        expect(await page.evaluate(() => window.__perf.audioArgs[0])).toBeNull();
    });
});

// Utilitaires communs des scripts de mesure de performance (voir README.md).
import { chromium } from '@playwright/test';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

export const DIR = dirname(fileURLToPath(import.meta.url));
export const CACHE = join(DIR, '.cache');   // screens.json, base-player.json, captures : générés, non versionnés
export const BASE_URL = `${(process.env.URL || 'http://127.0.0.1:4180').replace(/\/$/, '')}/match3-quest/`;
export const VIEWPORT = { width: 393, height: 851 };   // téléphone portrait

/** Chromium : CHROMIUM_PATH (exécutable) et CHROMIUM_ARGS (ex. « --use-angle=gl --enable-gpu-rasterization ») pour une machine avec GPU. */
export const launch = (extra = []) => chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [...(process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean), ...extra]
});

export const readJson = name => JSON.parse(fs.readFileSync(join(CACHE, name), 'utf8'));
export const writeCache = (name, data) => { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(join(CACHE, name), data); };

export const loaded = page => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 120_000 });

// Compteurs injectés avant le chargement : intervalles entre images, tâches longues, position de la caméra (décalage du calque de sol).
const instrument = () => {
    window.__f = { t: [], block: 0, maxLong: 0 };
    let last = performance.now();
    const loop = now => { window.__f.t.push(now - last); last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try {
        new PerformanceObserver(list => list.getEntries().forEach(e => { window.__f.block += e.duration - 50; window.__f.maxLong = Math.max(window.__f.maxLong, e.duration); }))
            .observe({ entryTypes: ['longtask'] });
    } catch (e) { /* longtask non supporté */ }
    window.__cam = [];
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
        if (img && img.width > 1500 && a.length >= 2) window.__cam.push([a[0], a[1]]);
        return drawImage.call(this, img, ...a);
    };
};

/**
 * Ouvre le jeu avec le héros posé sur `screen` ({ id, spawn }) grâce à la sauvegarde `base-player.json`.
 * @param {{ rate?: number, dpr?: number, freeze?: boolean }} opts rate : ralentissement CPU (appliqué après le chargement) ; freeze : temps et aléa figés (captures)
 */
export async function openScreen(browser, screen, { rate = 1, dpr = 2, freeze = false, instrumented = true } = {}) {
    const base = readJson('base-player.json');
    if (screen) { base.exploration.screenId = screen.id; base.exploration.x = screen.spawn.x; base.exploration.y = screen.spawn.y; }
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    await ctx.addInitScript(save => {
        if (!localStorage.getItem('__bench')) { localStorage.setItem('player', save); localStorage.setItem('__bench', '1'); }
    }, JSON.stringify(base));
    if (freeze) {
        await ctx.addInitScript(() => {
            let a = 12345;
            Math.random = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
            const raf = window.requestAnimationFrame.bind(window);
            window.__freeze = () => { window.requestAnimationFrame = cb => raf(() => cb(100000)); };
        });
    }
    if (instrumented) await ctx.addInitScript(instrument);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE_URL);
    await loaded(page);
    await page.waitForTimeout(2000);
    if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    return { ctx, page, cdp, errors };
}

export const resetCounters = page => page.evaluate(() => { window.__f.t = []; window.__f.block = 0; window.__f.maxLong = 0; window.__cam = []; });

export const readCounters = (page, seconds) => page.evaluate(sec => {
    const t = window.__f.t, sorted = t.slice().sort((a, b) => a - b), cam = window.__cam;
    let travel = 0;
    for (let k = 1; k < cam.length; k++) travel += Math.abs(cam[k][0] - cam[k - 1][0]) + Math.abs(cam[k][1] - cam[k - 1][1]);
    return {
        fps: +(t.length / sec).toFixed(1), p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] || 0), maxGap: Math.round(sorted[sorted.length - 1] || 0),
        blockMs: Math.round(window.__f.block), maxLongMs: Math.round(window.__f.maxLong), cameraPositions: new Set(cam.map(c => c.join(','))).size, cameraTravelPx: Math.round(travel)
    };
}, seconds);

/** Arrête le profileur CPU et renvoie les `n` fonctions les plus coûteuses (temps propre, hors repos). */
export async function stopProfile(cdp, n = 8) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(), nodes = new Map(profile.nodes.map(x => [x.id, x]));
    profile.samples.forEach((id, i) => {
        const f = nodes.get(id).callFrame;
        const key = `${f.functionName || 'anon'}@${f.url.split('/').pop().split('?')[0]}:${f.lineNumber}`;
        self.set(key, (self.get(key) || 0) + profile.timeDeltas[i]);
    });
    const all = [...self.entries()].filter(([k]) => !k.startsWith('(idle)'));
    const total = all.reduce((sum, [, v]) => sum + v, 0);
    return all.sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(100 * v / total).toFixed(0)}% ${k}`);
}

export const KEYS = [...Array(6).fill('ArrowRight'), ...Array(3).fill('ArrowDown'), ...Array(6).fill('ArrowLeft'), ...Array(3).fill('ArrowUp')];
export const exitKey = e => (e.dx > 0 ? 'ArrowRight' : e.dx < 0 ? 'ArrowLeft' : e.dy > 0 ? 'ArrowDown' : 'ArrowUp');

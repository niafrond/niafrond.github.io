// Tests de performance « mobile bas de gamme » : Pixel 5 émulé + processeur ralenti ×4 (CDP).
// Les assertions fondées sur des compteurs (appels canvas, propriétés animées, options audio) sont déterministes ;
// celles fondées sur le temps ont de larges marges pour rester stables en CI (rendu logiciel, machine variable).
import { test, expect } from '@playwright/test';

const URL = '/match3-quest/';
// Profil de l'appareil émulé : lu dans `metadata` du projet Playwright (voir playwright.config.js), valeurs par défaut = Pixel 5.
let CPU_SLOWDOWN = 4;
let DEFAULT_CORES = 4;
let LOAD_BUDGET_MS = 20_000;
let MIN_FPS = 6;

// Compteurs injectés avant le chargement : appels canvas, images, tâches longues, contextes audio.
const instrument = ({ cores }) => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => (cores <= 4 ? 2 : 8) });

    const c = (window.__perf = { shadowBlur: 0, fillRect: 0, mapFrames: 0, frames: 0, longTasks: 0, blockingMs: 0, maxLongMs: 0, fullFills: 0, audioArgs: [] });
    const P = CanvasRenderingContext2D.prototype;
    const blur = Object.getOwnPropertyDescriptor(P, 'shadowBlur');
    Object.defineProperty(P, 'shadowBlur', {
        get() { return blur.get.call(this); },
        set(v) { if (v > 0) c.shadowBlur++; blur.set.call(this, v); }
    });
    const fillRect = P.fillRect;
    P.fillRect = function (...a) {
        c.fillRect++;
        // images où la carte d'exploration a été (re)dessinée : `frames` avance à chaque rafraîchissement d'écran
        if (this.canvas && this.canvas.id === 'explore-canvas' && c.mapMark !== c.frames) { c.mapMark = c.frames; c.mapFrames++; }
        // remplissage couvrant tout le canvas d'exploration (le fond plein écran d'avant, repeint à chaque image)
        if (this.canvas && this.canvas.id === 'explore-canvas' && a[2] >= this.canvas.clientWidth && a[3] >= this.canvas.clientHeight) c.fullFills++;
        return fillRect.apply(this, a);
    };
    const loop = () => { c.frames++; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try {
        new PerformanceObserver(list => list.getEntries().forEach(e => { c.longTasks++; c.blockingMs += e.duration - 50; c.maxLongMs = Math.max(c.maxLongMs, e.duration); }))
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
    c.shadowBlur = c.fillRect = c.mapFrames = c.frames = c.longTasks = c.blockingMs = c.maxLongMs = c.fullFills = 0;
});

async function openGame(page, context, { cores = DEFAULT_CORES } = {}) {
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
    await page.click('.class-card');
    await page.click('#confirm-class');
    await page.waitForSelector('#explore-canvas', { state: 'visible' });
    await page.waitForTimeout(2000); // chargement des dessins de la région + mise en cache du sol
}

// Place le héros sur un écran donné (la sauvegarde est lue au chargement) puis recharge le jeu jusqu'à l'exploration.
async function reloadAt(page, screenId, x, y) {
    await page.evaluate(([id, px, py]) => {
        const p = JSON.parse(localStorage.getItem('player'));
        Object.assign(p.exploration, { screenId: id, x: px, y: py });
        localStorage.setItem('player', JSON.stringify(p));
    }, [screenId, x, y]);
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });
    await page.waitForSelector('#explore-canvas', { state: 'visible' });
}

test.describe('match3-quest · performances mobile', () => {
    test.beforeEach(({}, testInfo) => {
        const m = testInfo.project.metadata || {};
        CPU_SLOWDOWN = m.cpuSlowdown ?? 4;
        DEFAULT_CORES = m.cores ?? 4;
        LOAD_BUDGET_MS = m.loadBudgetMs ?? 20_000;
        MIN_FPS = m.minFps ?? 6;
    });
    test.setTimeout(60_000 * 2);

    test('démarrage : budget de chargement, aucune erreur ni ressource manquante', async ({ page, context }) => {
        const { loadMs, errors, failed } = await openGame(page, context);
        console.log(`[perf] chargement: ${loadMs} ms`);
        expect(errors).toEqual([]);
        expect(failed).toEqual([]);
        expect(loadMs).toBeLessThan(LOAD_BUDGET_MS);
    });

    test('exploration : le fond est mis en cache (pas de flou ni de rafale de fillRect par image)', async ({ page, context }) => {
        await openGame(page, context);
        await enterExploration(page);
        await resetCounters(page);
        await page.waitForTimeout(3000);
        const c = await page.evaluate(() => window.__perf);
        console.log(`[perf] cache fond: ${JSON.stringify(c)}`);

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

        console.log(`[perf] fluidité: ${(c.frames / 4).toFixed(1)} img/s, blocage ${Math.round(c.blockingMs)} ms, tâche max ${Math.round(c.maxLongMs)} ms`);
        // ≥ 6 images/s même avec un CPU ralenti ×4 en rendu logiciel (le plancher réel mesuré est ≈ 15)
        expect(c.frames / 4).toBeGreaterThan(MIN_FPS);
        // Temps de blocage cumulé (au-delà de 50 ms par tâche) sur 4 s : mesuré ≈ 600 ms, plafond large
        expect(c.blockingMs).toBeLessThan(2500);
    });

    test('exploration : sur une grande zone sauvage, seul ce qui est à l\'écran est dessiné', async ({ page, context }) => {
        await openGame(page, context);
        await enterExploration(page);
        // Zone sauvage de 64×32 cases (≈ 2 000 cases, dont beaucoup hors écran sur un téléphone) : on y place le héros à son point d'arrivée puis on recharge
        const spawn = await page.evaluate(async () => (await import('./story.js')).SCREENS.rizieres_wild.spawn);
        await reloadAt(page, 'rizieres_wild', spawn.x, spawn.y);
        await page.waitForTimeout(2500);
        await resetCounters(page);
        await page.waitForTimeout(3000);
        const c = await page.evaluate(() => window.__perf);
        console.log(`[perf] zone sauvage: ${JSON.stringify(c)}`);
        expect(c.frames).toBeGreaterThan(10);
        // Mesuré sur cette zone : 315 fillRect / image avant le découpage hors écran, 46 après ; plafond large
        expect(c.fillRect / c.frames).toBeLessThan(150);
        // Le fond plein écran n'est plus repeint à chaque image quand la carte recouvre l'écran (seules les bandes autour de la carte le sont)
        expect(c.fullFills).toBe(0);
    });

    test('transition d\'écran : le sol de la carte voisine est préparé avant la sortie (pas de tâche bloquante > 450 ms)', async ({ page, context }) => {
        await openGame(page, context);
        await enterExploration(page);
        // Cave du fleuve, au pied de la sortie vers la zone sauvage (48×24) : avant, la transition peignait d'un coup ~1 150 cases (≈ 770 ms à CPU ×4)
        await reloadAt(page, 'fleuve_cave', 1, 5);
        await page.waitForTimeout(5000);   // le héros est près de la sortie : le sol voisin se prépare par tranches
        await resetCounters(page);
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(3000);
        const c = await page.evaluate(() => window.__perf);
        console.log(`[perf] transition: ${JSON.stringify(c)}`);
        expect(c.frames).toBeGreaterThan(10);
        expect(c.maxLongMs).toBeLessThan(450);
    });

    // Écart toléré (px) entre la taille du bitmap et celle de la tuile : sous CPU très ralenti, la mise en page peut encore bouger de quelques pixels
    const TILE_BITMAP_TOLERANCE = 4;
    test('combat : les fonds des tuiles sont des bitmaps à la taille d\'affichage (pas 64 SVG vectoriels rejoués par le GPU)', async ({ page, context }) => {
        await openGame(page, context);
        await enterExploration(page);
        // Interface de combat réellement affichée (comme startEncounterCombat de main.js)
        await page.evaluate(async () => {
            const g = await import('./game.js'), bd = await import('./board.js'), en = await import('./enemies.js');
            document.getElementById('explore-container').style.display = 'none';
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('tab-combat').classList.add('active');
            document.querySelector('.stats-container').style.display = 'flex';
            document.getElementById('board').style.display = 'grid';
            document.getElementById('spells-container').style.display = 'flex';
            g.startNewCombat(en.createMapEnemy({ level: 1 }));
            bd.generateBoard();
            bd.renderBoard();
        });
        // Côté en pixels du fond de la première tuile, et côté attendu (taille CSS × densité de pixels)
        const measure = () => page.evaluate(async () => {
            const tile = document.querySelector('#board .tile');
            const url = /url\("([^"]+)"\)/.exec(getComputedStyle(tile).backgroundImage)?.[1] || '';
            const img = new Image();
            img.src = url;
            await img.decode().catch(() => {});
            return { bitmap: url.startsWith('data:image/png'), side: img.naturalWidth, expected: Math.round(parseFloat(getComputedStyle(tile).width) * window.devicePixelRatio) };
        });
        await expect.poll(async () => (await measure()).bitmap, { timeout: 15_000 }).toBe(true);
        const first = await measure();
        expect(Math.abs(first.side - first.expected)).toBeLessThanOrEqual(TILE_BITMAP_TOLERANCE);
        expect(first.side).toBeGreaterThan(40);
        // Les 9 saveurs (dont le crâne +5) ont leur règle
        expect(await page.evaluate(() => document.getElementById('tile-bitmaps').textContent.match(/background-image/g).length)).toBe(9);

        // Un redimensionnement (rotation, fenêtre) refait les bitmaps à la nouvelle taille
        await page.setViewportSize({ width: 300, height: 640 });
        await expect.poll(async () => { const m = await measure(); return m.bitmap && Math.abs(m.side - m.expected) <= TILE_BITMAP_TOLERANCE && m.side !== first.side; }, { timeout: 15_000 }).toBe(true);
    });

    test('exploration : la carte n\'est plus redessinée à pleine cadence sous un modal ni sous une cinématique', async ({ page, context }) => {
        await openGame(page, context);
        await enterExploration(page);
        const measure = async ms => {
            await resetCounters(page);
            await page.waitForTimeout(ms);
            return page.evaluate(() => window.__perf.mapFrames);   // images de carte dessinées (pas le nombre d'appels : il varie d'une image à l'autre)
        };
        // Carte libre, héros immobile : cadence d'ambiance (~15 à 30 i/s selon le niveau d'effets, explorationViewConsts.js)
        const free = await measure(2000);
        expect(free).toBeGreaterThan(0);

        // Carte du monde ouverte (voile à 70 %) : redessin à ~4 images/s au lieu de toutes les images
        await page.evaluate(() => document.getElementById('worldmap-modal').classList.add('active'));
        const underModal = await measure(2000);
        // borne absolue (une image toutes les 250 ms, COVERED_DRAW_MS) : sur le profil bas de gamme, la carte libre est déjà
        // limitée par le processeur (~6 i/s), un rapport avec `free` ne voudrait rien dire
        expect(underModal).toBeLessThanOrEqual(2000 / 250 + 2);
        await page.evaluate(() => document.getElementById('worldmap-modal').classList.remove('active'));

        // Cinématique opaque par-dessus : plus aucun dessin de la carte
        await page.evaluate(() => { const el = document.createElement('div'); el.className = 'cine-overlay'; el.id = 'perf-fake-cine'; document.body.appendChild(el); });
        const underCine = await measure(1500);
        expect(underCine).toBeLessThan(free * 0.1);
        await page.evaluate(() => document.getElementById('perf-fake-cine').remove());

        // Retour à la normale : la carte reprend sa cadence d'ambiance
        const after = await measure(2000);
        expect(after).toBeGreaterThan(free * 0.5);
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

// Captures d'écran des cartes citées par la soluce (soluce/img/<écran>.png, carte seule à 44 px par case, sans bandeau).
// Pour chaque écran : sauvegarde d'exploration préparée (héros sur l'apparition, prologue vu), fenêtre dimensionnée pour que la carte
// tienne entière (tuile minimale du jeu : 44 px), puis capture du canvas. Le cercle rouge est posé ensuite par les pages de la soluce
// (build-soluce.mjs), à partir des coordonnées des entités : une même capture sert à toutes les quêtes de l'écran.
// Usage : NODE_PATH=$(npm root -g) node match3-quest/tools/build-soluce-shots.mjs [--base=http://localhost:4173] [--only=id1,id2] [--jobs=4]
// Prérequis : un serveur statique à la racine du dépôt (ex. `python3 -m http.server 4173`) et Playwright (Chromium).
import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREENS } from '../story.js';
import { shotScreens } from './soluce-targets.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const BASE = arg('base', 'http://localhost:4173');
const JOBS = Number(arg('jobs', 4));
const ONLY = arg('only', '').split(',').filter(Boolean);
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'soluce', 'img');
const TILE = 44, HUD_TOP = 64, HUD_BOTTOM = 8;   // mêmes constantes que explorationView.js
mkdirSync(OUT, { recursive: true });

const loaded = page => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });
const ids = (ONLY.length ? ONLY : shotScreens()).filter(id => SCREENS[id]);
const browser = await chromium.launch();

async function worker(queue) {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('erreur page :', e.message));
    await page.goto(`${BASE}/match3-quest/`);
    await loaded(page);
    await page.click('.class-card');
    await page.click('#confirm-class');
    await page.waitForSelector('#explore-canvas', { state: 'visible' });
    while (queue.length) {
        const id = queue.shift();
        const s = SCREENS[id];
        const spawn = s.spawn || { x: 1, y: 1 };
        await page.setViewportSize({ width: s.w * TILE, height: s.h * TILE + HUD_TOP + HUD_BOTTOM });
        await page.evaluate(([screenId, x, y]) => {
            const p = JSON.parse(localStorage.getItem('player'));
            Object.assign(p.exploration, { screenId, x, y, introSeen: true });
            localStorage.setItem('player', JSON.stringify(p));
        }, [id, spawn.x, spawn.y]);
        await page.reload();
        await loaded(page);
        await page.waitForSelector('#explore-canvas', { state: 'visible' });
        await page.waitForTimeout(2500);
        const cur = await page.evaluate(() => JSON.parse(localStorage.getItem('player')).exploration.screenId);
        if (cur !== id) { console.log(`ÉCHEC ${id} : le jeu est sur ${cur}`); continue; }
        await page.screenshot({ path: join(OUT, `${id}.png`), clip: { x: 0, y: HUD_TOP, width: s.w * TILE, height: s.h * TILE } });
        console.log('ok', id);
    }
    await ctx.close();
}

const queue = [...ids];
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, () => worker(queue)));
await browser.close();

// PNG → JPEG réduit (largeur ≤ 1200 px) pour garder le dépôt léger ; les PNG bruts sont supprimés.
const { execFileSync } = await import('node:child_process');
execFileSync('python3', ['-c', `
import sys, glob, os
from PIL import Image
for p in glob.glob(os.path.join(sys.argv[1], '*.png')):
    im = Image.open(p).convert('RGB')
    if im.width > 1200:
        im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
    im.save(p[:-4] + '.jpg', quality=78, optimize=True)
    os.remove(p)
`, OUT]);

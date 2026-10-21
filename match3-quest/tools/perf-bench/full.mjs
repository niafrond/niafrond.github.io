#!/usr/bin/env node
// Benchmark complet : exploration (immobile, transition, marche) sur les écrans types, carte du monde, animation de sort, ultimes, cinématiques.
// Usage : node full.mjs <étiquette> [ralentissement CPU, 4 par défaut]     puis     node full.mjs --compare <étiquetteA> <étiquetteB>
// Résultats : .cache/full-<étiquette>.jsonl. Durée : une dizaine de minutes. Ne rien lancer d'autre en parallèle (les mesures se fausseraient).
import fs from 'fs';
import { launch, openScreen, readJson, writeCache, resetCounters, readCounters, stopProfile, exitKey, CACHE } from './common.mjs';
import { join } from 'path';

const load = tag => fs.readFileSync(join(CACHE, `full-${tag}.jsonl`), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
if (process.argv[2] === '--compare') {
    const [a, b] = [load(process.argv[3]), load(process.argv[4])];
    const key = o => `${o.test}|${o.id || ''}|x${o.rate}`;
    const bm = new Map(b.map(o => [key(o), o]));
    for (const o of a) {
        const n = bm.get(key(o));
        if (!n) continue;
        const [x, y] = o.walk ? [o.walk, n.walk] : [o, n];
        console.log(`${o.test.padEnd(12)} ${(o.id || '').padEnd(18)} x${o.rate}  ${x.fps} → ${y.fps} images/s · blocage ${x.blockMs} → ${y.blockMs} ms`);
    }
    process.exit(0);
}
const tag = process.argv[2];
const rate = Number(process.argv[3] || 4);
if (!tag) { console.error('étiquette manquante'); process.exit(2); }
const out = [];
const emit = o => { out.push(o); console.log(JSON.stringify(o).slice(0, 300)); writeCache(`full-${tag}.jsonl`, `${out.map(x => JSON.stringify(x)).join('\n')}\n`); };

const screens = readJson('screens.json');
const browser = await launch();

for (const screen of screens) {
    const { ctx, page, cdp, errors } = await openScreen(browser, screen, { rate });
    const r = { test: 'explore', id: screen.id, label: screen.label, size: `${screen.w}x${screen.h}`, rate };
    try {
        await resetCounters(page);
        await page.waitForTimeout(4000);
        r.still = await readCounters(page, 4);
        await resetCounters(page);
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.start');
        const box = await page.locator('#explore-canvas').boundingBox();
        const t0 = Date.now();
        for (let i = 0; Date.now() - t0 < 9000; i++) {
            await page.mouse.click(box.x + box.width * [0.85, 0.15, 0.5, 0.9, 0.1][i % 5], box.y + box.height * [0.5, 0.7, 0.25, 0.8, 0.4][i % 5]);
            await page.waitForTimeout(1500);
        }
        r.walk = await readCounters(page, (Date.now() - t0) / 1000);
        r.walk.top = await stopProfile(cdp, 5);
    } catch (e) { r.err = String(e).slice(0, 160); }
    r.errors = errors.slice(0, 2);
    emit(r);
    await ctx.close();
}

// Transitions (plus longue tâche après la sortie)
for (const id of ['rizieres_h_grenier', 'fleuve_cave', 'rizieres_village']) {
    const screen = screens.find(s => s.id === id);
    if (!screen || !screen.exit) continue;
    const { ctx, page } = await openScreen(browser, screen, { rate });
    await resetCounters(page);
    await page.keyboard.press(exitKey(screen.exit));
    await page.waitForTimeout(3000);
    emit({ test: 'transition', id, rate, ...(await readCounters(page, 3)) });
    await ctx.close();
}

// Carte du monde, animation de sort, ultimes
{
    const { ctx, page, cdp } = await openScreen(browser, screens.find(s => s.id === 'rizieres_village'), { rate });
    await resetCounters(page);
    await page.evaluate(() => document.getElementById('worldmap-modal').classList.add('active'));
    await page.waitForTimeout(4000);
    emit({ test: 'worldmap', rate, ...(await readCounters(page, 4)) });
    await page.evaluate(() => document.getElementById('worldmap-modal').classList.remove('active'));

    await page.evaluate(async () => {
        const g = await import('./game.js'), bd = await import('./board.js'), en = await import('./enemies.js');
        document.querySelectorAll('.tabs').forEach(t => { t.style.display = 'none'; });
        g.startNewCombat(en.createMapEnemy({ level: 1 }));
        bd.generateBoard();
        bd.renderBoard();
    });
    await page.waitForTimeout(1500);
    await resetCounters(page);
    await page.evaluate(async () => { (await import('./game.js')).showCombatAnimation({ icon: 'cross', title: 'Cinq Éléments', damage: 1100 }, true); });
    await page.waitForTimeout(4500);
    emit({ test: 'combat-sort', rate, ...(await readCounters(page, 4.5)) });

    for (const id of ['ultimateFiveElements', 'ultimateHeavenlyThunder', 'ultimateThousandRiders']) {
        for (const pass of ['1re lecture', '2e lecture']) {
            await resetCounters(page);
            const t0 = Date.now();
            await page.evaluate(async uid => { const u = await import('./ultimateCinematics.js'); await u.playUltimateScene({ id: uid, name: uid }); }, id);
            emit({ test: `ultime ${pass}`, id, rate, ...(await readCounters(page, (Date.now() - t0) / 1000)) });
        }
    }
    await ctx.close();
}

// Cinématiques (attention : l'exploration tourne derrière, voir README)
{
    const { ctx, page } = await openScreen(browser, null, { rate });
    for (const fn of ['playTitleScreen', 'playPrologueAnimation']) {
        await resetCounters(page);
        await page.evaluate(async name => { window.__cine = (await import('./cinematics.js'))[name](); }, fn);
        await page.waitForTimeout(8000);
        emit({ test: `cinématique ${fn}`, rate, ...(await readCounters(page, 8)) });
        await page.evaluate(() => document.querySelectorAll('[class*=cine]').forEach(e => { try { e.click(); } catch (err) { /* ignoré */ } }));
        await page.waitForTimeout(500);
    }
    await ctx.close();
}
await browser.close();
console.log(`terminé : ${CACHE}/full-${tag}.jsonl`);

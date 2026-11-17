#!/usr/bin/env node
// Combat : le plateau est joué automatiquement (premier coup possible, toutes les 1,8 s), images/s, blocage, et avec TRACE=1 la décomposition du thread
// principal et du thread GPU (les couches DOM du plateau et leurs animations CSS sont rastérisées côté GPU).
// Usage : node combat.mjs <ralentissement CPU> [durée en s, 15 par défaut]
import { launch, openScreen, readJson, resetCounters, readCounters, stopProfile, startCombat } from './common.mjs';
import { analyse } from './trace.mjs';

const [rate = '4', seconds = '15'] = process.argv.slice(2);
const screens = readJson('screens.json');
const browser = await launch();
const { ctx, page, cdp } = await openScreen(browser, screens.find(s => s.id === 'rizieres_village'), { rate: Number(rate) });
const board = await startCombat(page);
console.log(`plateau ${board.w}×${board.h} px, CPU ×${rate}`);
await page.waitForTimeout(2000);
await resetCounters(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.start');
if (process.env.TRACE) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc', 'gpu', 'viz'], screenshots: false });
const t0 = Date.now();
let moves = 0;
while (Date.now() - t0 < Number(seconds) * 1000) {
    const move = await page.evaluate(async () => {
        if (document.body.classList.contains('combat-ended')) return null;
        const bd = await import('./board.js'), mm = await import('./matchMechanics.js');
        return mm.findPossibleMatches(bd.board)[0] || null;
    });
    if (!move) { await page.waitForTimeout(500); continue; }
    await page.evaluate(({ from, to }) => { const t = document.querySelectorAll('#board .tile'); t[from].click(); t[to].click(); }, move);
    moves++;
    await page.waitForTimeout(1800);
}
const m = await readCounters(page, (Date.now() - t0) / 1000);
console.log(`combat x${rate} : ${m.fps} images/s · p95 ${m.p95} ms · écart max ${m.maxGap} ms · blocage ${m.blockMs} ms (tâche max ${m.maxLongMs} ms) · ${moves} coups joués`);
console.log('   JS :', (await stopProfile(cdp, 6)).join(' ; '));
if (process.env.TRACE) {
    const { busy, perThread } = analyse(JSON.parse((await browser.stopTracing()).toString()).traceEvents);
    console.log('   charge par thread (ms) :', [...busy].filter(([, v]) => v > 150).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k.replace(/ \(\d+:\d+\)/, '')} ${v.toFixed(0)}`).join(' · '));
    for (const re of [/CrRendererMain/, /CrGpuMain/]) {
        const t = [...perThread].filter(([k]) => re.test(k)).sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))[0];
        if (!t) continue;
        const total = [...t[1].values()].reduce((x, y) => x + y, 0);
        console.log(`   ${t[0].replace(/ \(\d+:\d+\)/, '')} : ` + [...t[1]].sort((a, b) => b[1] - a[1]).slice(0, 9).map(([n, v]) => `${(100 * v / total).toFixed(0)}% ${n}`).join(' · '));
    }
}
await ctx.close();
await browser.close();

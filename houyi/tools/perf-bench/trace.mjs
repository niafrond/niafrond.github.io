#!/usr/bin/env node
// Trace Chromium d'une marche : temps propre par type d'événement sur le thread principal, charge par thread, et coût de `toDataURL`.
// Le profileur CPU ne voit que le JavaScript : `(program)` y regroupe tout le natif (style, mise en page, enregistrement du dessin, attentes du GPU).
// Cette trace le détaille.
// Usage : node trace.mjs <ralentissement CPU> <id d'écran…>      ex. node trace.mjs 4 rizieres_wild
import fs from 'fs';
import { join } from 'path';
import { CACHE, launch, openScreen, readJson, resetCounters, readCounters } from './common.mjs';

const [rate = '4', ...ids] = process.argv.slice(2);
const screens = readJson('screens.json');
const CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc', 'gpu', 'viz'];

/** Temps propre (durée moins celle des événements imbriqués) par nom, et temps occupé (événements de plus haut niveau) par thread. */
export function analyse(events) {
    const names = new Map();   // "pid:tid" → nom du thread
    for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
    const byThread = new Map();
    for (const e of events) {
        if (e.ph !== 'X' || !(e.dur > 0)) continue;
        const k = `${e.pid}:${e.tid}`;
        if (!byThread.has(k)) byThread.set(k, []);
        byThread.get(k).push(e);
    }
    const busy = new Map();
    const perThread = new Map();
    const longTasks = new Map();   // thread → tâches de plus haut niveau ≥ 80 ms, avec ce qui les compose
    let t0 = Infinity;   // (pas de Math.min(...tableau) : trop d'événements pour la pile)
    for (const e of events) if (e.ts > 0 && e.ts < t0) t0 = e.ts;
    for (const [k, list] of byThread) {
        list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
        const stack = [];
        const self = new Map();
        const longs = [];
        let top = 0;
        for (const e of list) {
            while (stack.length && stack[stack.length - 1].end <= e.ts) closeFrame(stack, self, longs, t0);
            if (!stack.length) top += e.dur;
            else stack[stack.length - 1].child += e.dur;
            const frame = { name: e.name, ts: e.ts, dur: e.dur, end: e.ts + e.dur, child: 0, args: e.args };
            frame.root = stack.length ? stack[0] : frame;
            if (frame.root === frame) frame.breakdown = new Map();
            stack.push(frame);
        }
        while (stack.length) closeFrame(stack, self, longs, t0);
        const name = names.get(k) || k;
        busy.set(`${name} (${k})`, top / 1000);
        perThread.set(`${name} (${k})`, self);
        longTasks.set(`${name} (${k})`, longs);
    }
    return { busy, perThread, longTasks };
}
function closeFrame(stack, self, longs, t0) {
    const f = stack.pop();
    const own = Math.max(0, f.dur - f.child);
    self.set(f.name, (self.get(f.name) || 0) + own);
    f.root.breakdown.set(f.name, (f.root.breakdown.get(f.name) || 0) + own);
    if (f.root === f && f.dur >= 80000) {
        const detail = f.args && f.args.data && (f.args.data.url || f.args.data.functionName || f.args.data.type || '');
        longs.push({ name: f.name, ms: f.dur / 1000, at: (f.ts - t0) / 1e6, detail: String(detail).split('/').slice(-2).join('/').slice(0, 60),
            parts: [...f.breakdown].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `${n} ${(v / 1000).toFixed(0)}`).join(' · ') });
    }
}

if (process.argv[1] && process.argv[1].endsWith('trace.mjs')) {
    const browser = await launch();
    for (const id of ids) {
        const screen = screens.find(s => s.id === id);
        if (!screen) { console.log(`écran inconnu : ${id}`); continue; }
        const { ctx, page } = await openScreen(browser, screen, { rate: Number(rate) });
        // `toDataURL` : nombre d'appels et temps passé (sur GPU chaque appel relit le canvas : synchrone)
        await page.evaluate(() => {
            const original = HTMLCanvasElement.prototype.toDataURL;
            window.__tdu = { n: 0, ms: 0, big: 0 };
            HTMLCanvasElement.prototype.toDataURL = function (...a) {
                const t = performance.now();
                const r = original.apply(this, a);
                window.__tdu.n++; window.__tdu.ms += performance.now() - t;
                if (this.width * this.height > 20000) window.__tdu.big++;
                return r;
            };
        });
        await resetCounters(page);
        await browser.startTracing(page, { categories: CATEGORIES, screenshots: false });
        const box = await page.locator('#explore-canvas').boundingBox();
        const t0 = Date.now();
        for (let i = 0; Date.now() - t0 < 9000; i++) {
            await page.mouse.click(box.x + box.width * [0.85, 0.15, 0.5, 0.9, 0.1][i % 5], box.y + box.height * [0.5, 0.7, 0.25, 0.8, 0.4][i % 5]);
            await page.waitForTimeout(1500);
        }
        const seconds = (Date.now() - t0) / 1000;
        const m = await readCounters(page, seconds);
        const buffer = await browser.stopTracing();
        const tdu = await page.evaluate(() => window.__tdu);
        fs.writeFileSync(join(CACHE, `trace-${id}.json`), buffer);
        const { busy, perThread, longTasks } = analyse(JSON.parse(buffer.toString()).traceEvents);
        console.log(`\n== ${id} · CPU ×${rate} · ${m.fps} images/s · p95 ${m.p95} ms · blocage ${m.blockMs} ms · toDataURL : ${tdu.n} appels (${tdu.big} grands), ${tdu.ms.toFixed(0)} ms`);
        console.log('   charge par thread (ms, événements de plus haut niveau) :',
            [...busy].filter(([, v]) => v > 150).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k.replace(/ \(\d+:\d+\)/, '')} ${v.toFixed(0)}`).join(' · '));
        const main = [...perThread].filter(([k]) => /CrRendererMain/.test(k)).sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))[0];
        if (main) {
            const total = [...main[1].values()].reduce((x, y) => x + y, 0);
            console.log(`   thread principal (${main[0]}), temps propre par événement :`);
            console.log('   ' + [...main[1]].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([n, v]) => `${(100 * v / total).toFixed(0)}% ${n}`).join(' · '));
            // thread du processus GPU : s'il est saturé, le goulot est le nombre ou la complexité des opérations de dessin, pas le JavaScript
            const gpu = [...perThread].filter(([k]) => /CrGpuMain/.test(k))[0];
            if (gpu) {
                const gTotal = [...gpu[1].values()].reduce((x, y) => x + y, 0);
                console.log(`   thread GPU (${gpu[0]}), ${(gTotal / 1000).toFixed(0)} ms de travail, temps propre par événement :`);
                console.log('   ' + [...gpu[1]].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, v]) => `${(100 * v / gTotal).toFixed(0)}% ${n}`).join(' · '));
            }
            const longs = (longTasks.get(main[0]) || []).sort((a, b) => b.ms - a.ms);
            console.log(`   tâches ≥ 80 ms : ${longs.length}, cumul ${longs.reduce((s, l) => s + l.ms, 0).toFixed(0)} ms ; les plus longues (instant depuis le début de la trace) :`);
            longs.slice(0, 6).forEach(l => console.log(`     ${l.ms.toFixed(0).padStart(5)} ms @${l.at.toFixed(1)}s  ${l.name} ${l.detail} → ${l.parts}`));
        }
        await ctx.close();
    }
    await browser.close();
}

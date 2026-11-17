#!/usr/bin/env node
// Animations de sorts (planches `sprites/spellfx`, lecture en CSS) : un sort par palier, mesuré pendant son animation, en plein combat.
// Les paliers 4 et 5 s'étalent sur tout le plateau (spellFx.js `bigScale`) : c'est là que se jouent les coûts d'affichage.
// Usage : node spells.mjs <ralentissement CPU> [palier…]      ex. node spells.mjs 4        ou        node spells.mjs 4 5
import fs from 'fs';
import { join } from 'path';
import { DIR, launch, openScreen, readJson, resetCounters, readCounters, startCombat } from './common.mjs';

const [rate = '4', ...wanted] = process.argv.slice(2);
const index = JSON.parse(fs.readFileSync(join(DIR, '..', '..', 'sprites', 'spellfx', 'index.json'), 'utf8'));
const byTier = new Map();
for (const [id, e] of Object.entries(index)) if (!byTier.has(e.tier)) byTier.set(e.tier, { id, ...e });
const tiers = [...byTier.keys()].sort((a, b) => a - b).filter(t => !wanted.length || wanted.includes(String(t)));

const browser = await launch();
const { ctx, page } = await openScreen(browser, readJson('screens.json').find(s => s.id === 'rizieres_village'), { rate: Number(rate) });
const board = await startCombat(page);
await page.waitForTimeout(2500);
console.log(`plateau ${board.w}×${board.h} px, CPU ×${rate}`);
for (const tier of tiers) {
    const spell = byTier.get(tier);
    await resetCounters(page);
    await page.evaluate(async name => { (await import('./game.js')).showCombatAnimation({ icon: 'cross', title: name, damage: 100 }, true); }, spell.name);
    await page.waitForTimeout(600);
    await resetCounters(page);
    await page.waitForTimeout(2500);
    const m = await readCounters(page, 2.5);
    const css = await page.evaluate(() => { const e = document.querySelector('.spellfx'); if (!e) return 'pas de planche affichée'; const r = e.getBoundingClientRect(); return `élément ${Math.round(r.width)}×${Math.round(r.height)}, fond ${getComputedStyle(e).backgroundSize}`; });
    console.log(`palier ${tier} (${spell.id}, ${spell.frames} images de ${spell.size}px) : ${String(m.fps).padStart(5)} images/s · p95 ${String(m.p95).padStart(3)} ms · écart max ${String(m.maxGap).padStart(3)} ms · ${css}`);
    // laisser l'overlay se refermer avant le palier suivant
    await page.evaluate(() => { document.querySelectorAll('.attack-overlay').forEach(o => o.click()); document.querySelectorAll('.attack-caption-close').forEach(b => b.click()); });
    await page.waitForFunction(() => !document.querySelector('.attack-overlay'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
}
await ctx.close();
await browser.close();

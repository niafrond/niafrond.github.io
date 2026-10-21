#!/usr/bin/env node
// Captures du canvas d'exploration à temps et aléa figés, pour prouver qu'une optimisation ne change aucun pixel.
// Usage : node pixels.mjs <étiquette>      puis      node pixels.mjs --compare <étiquetteA> <étiquetteB>
// Procédure : lancer sur la version de référence (git stash / worktree), puis sur la version modifiée, puis comparer. Deux captures de la même
// version doivent être identiques entre elles (sinon le protocole est bruité).
import fs from 'fs';
import crypto from 'crypto';
import { join } from 'path';
import { CACHE, launch, openScreen, readJson, writeCache, loaded, exitKey, BASE_URL } from './common.mjs';

if (process.argv[2] === '--compare') {
    const [a, b] = [process.argv[3], process.argv[4]].map(t => readJson(`pixels-${t}.json`));
    const diff = Object.keys(a).filter(k => a[k] !== b[k]);
    console.log(`${Object.keys(a).length - diff.length} / ${Object.keys(a).length} captures identiques${diff.length ? ` ; différentes : ${diff.join(', ')}` : ''}`);
    process.exit(diff.length ? 1 : 0);
}
const tag = process.argv[2];
if (!tag) { console.error('étiquette manquante'); process.exit(2); }
const screens = readJson('screens.json');
const hashes = {};
const browser = await launch();
const hash = png => crypto.createHash('md5').update(png).digest('hex');
const save = (name, png) => { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(join(CACHE, `pixels-${tag}-${name}.png`), png); hashes[name] = hash(png); };

// Cartes chargées directement (téléphone et tablette)
const ids = ['rizieres_wild', 'mer_wild', 'tonnerre_wild', 'volcan_village', 'gobi_village', 'rizieres_h_grenier', 'arena_c8', 'fleuve_cave', 'lune_wild'];
for (const width of [393, 820]) {
    for (const id of ids) {
        const { ctx, page } = await openScreen(browser, screens.find(s => s.id === id), { dpr: 1, freeze: true, instrumented: false });
        await page.setViewportSize({ width, height: width === 393 ? 851 : 1180 });
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.__freeze());   // temps figé : la pulsation des auras et les reflets de l'eau en dépendent
        await page.waitForTimeout(600);
        save(`${width}-${id}`, await page.locator('#explore-canvas').screenshot());
        await ctx.close();
    }
}
// Arrivées par transition (l'animation de défilement est terminée, puis le temps est figé)
for (const id of ['rizieres_h_grenier', 'fleuve_cave', 'rizieres_village']) {
    const screen = screens.find(s => s.id === id);
    const { ctx, page } = await openScreen(browser, screen, { dpr: 1, freeze: true, instrumented: false });
    await page.waitForTimeout(1500);
    await page.keyboard.press(exitKey(screen.exit));
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.__freeze());
    await page.waitForTimeout(600);
    save(`trans-${id}`, await page.locator('#explore-canvas').screenshot());
    await ctx.close();
}
writeCache(`pixels-${tag}.json`, JSON.stringify(hashes, null, 1));
console.log(`${tag} : ${Object.keys(hashes).length} captures`);
await browser.close();

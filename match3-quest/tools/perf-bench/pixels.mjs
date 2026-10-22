#!/usr/bin/env node
// Captures du canvas d'exploration à temps et aléa figés, pour prouver qu'une optimisation ne change aucun pixel.
// Usage : node pixels.mjs <étiquette>      puis      node pixels.mjs --compare <étiquetteA> <étiquetteB>
// Procédure : lancer sur la version de référence (git stash / worktree), puis sur la version modifiée, puis comparer. Deux captures de la même
// version doivent être identiques entre elles (sinon le protocole est bruité).
import fs from 'fs';
import crypto from 'crypto';
import { join } from 'path';
import { PNG } from 'pngjs';
import { CACHE, launch, openScreen, readJson, writeCache, exitKey, startCombat } from './common.mjs';

// Écart entre deux captures : pixels différents et plus grand écart de canal. Sur GPU l'arrondi peut changer un pixel d'un niveau : on tolère
// jusqu'à TOLERANCE_LEVEL de différence sur au plus TOLERANCE_SHARE des pixels (rien de visible), pas davantage.
const TOLERANCE_LEVEL = 2, TOLERANCE_SHARE = 0.0001;
function pngDiff(fileA, fileB) {
    const [a, b] = [fileA, fileB].map(f => PNG.sync.read(fs.readFileSync(f)));
    if (a.width !== b.width || a.height !== b.height) return { count: Infinity, share: 1, max: 255 };
    let count = 0, max = 0, sum = 0, big = 0;
    for (let i = 0; i < a.data.length; i += 4) {
        const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
        sum += (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3;
        if (d > 0) { count++; if (d > max) max = d; }
        if (d > 32) big++;
    }
    const total = a.width * a.height;
    return { count, share: count / total, max, mean: sum / total, bigShare: big / total };
}
// « Proche » : le même dessin rastérisé par un chemin différent (anticrénelage des contours) : écart moyen ≤ 3 niveaux et ≤ 0,1 % des pixels à plus de 32 niveaux.
// Ce n'est PAS « identique » : à confirmer à l'œil (agrandir une tuile et comparer) avant de conclure.
const CLOSE_MEAN = 3, CLOSE_BIG_SHARE = 0.001;

if (process.argv[2] === '--compare') {
    const [ta, tb] = [process.argv[3], process.argv[4]];
    const [a, b] = [ta, tb].map(t => readJson(`pixels-${t}.json`));
    const differing = Object.keys(a).filter(k => a[k] !== b[k]);
    const real = [];
    let rounding = 0, close = 0;
    differing.forEach(k => {
        const d = pngDiff(join(CACHE, `pixels-${ta}-${k}.png`), join(CACHE, `pixels-${tb}-${k}.png`));
        const level = d.max <= TOLERANCE_LEVEL && d.share <= TOLERANCE_SHARE ? 'arrondi' : d.mean <= CLOSE_MEAN && d.bigShare <= CLOSE_BIG_SHARE ? 'proche' : 'DIFFÉRENT';
        console.log(`  ${level.padEnd(9)} ${k} : ${d.count} pixels (${(100 * d.share).toFixed(2)} %), écart moyen ${d.mean.toFixed(2)}, max ${d.max}, > 32 : ${(100 * d.bigShare).toFixed(3)} %`);
        if (level === 'arrondi') rounding++; else if (level === 'proche') close++; else real.push(k);
    });
    console.log(`${Object.keys(a).length - differing.length} / ${Object.keys(a).length} captures identiques, ${rounding} à l'arrondi près, ${close} proches (anticrénelage : à juger à l'œil), ${real.length} différentes`);
    process.exit(real.length ? 1 : 0);
}
const tag = process.argv[2];
if (!tag) { console.error('étiquette manquante'); process.exit(2); }
const screens = readJson('screens.json');
const hashes = {};
const browser = await launch();
const hash = png => crypto.createHash('md5').update(png).digest('hex');
const save = (name, png) => { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(join(CACHE, `pixels-${tag}-${name}.png`), png); hashes[name] = hash(png); };

// Capture répétée jusqu'à ce que deux prises successives soient identiques : le chargement asynchrone des sprites ne doit pas fausser la comparaison.
async function stableShot(page, selector = '#explore-canvas') {
    let previous = await page.locator(selector).screenshot();
    for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(400);
        const next = await page.locator(selector).screenshot();
        if (hash(next) === hash(previous)) return next;
        previous = next;
    }
    return previous;
}

// Cartes chargées directement (téléphone et tablette)
const ids = ['rizieres_wild', 'mer_wild', 'tonnerre_wild', 'volcan_village', 'gobi_village', 'rizieres_h_grenier', 'arena_c8', 'fleuve_cave', 'lune_wild'];
for (const width of [393, 820]) {
    for (const id of ids) {
        const { ctx, page } = await openScreen(browser, screens.find(s => s.id === id), { dpr: 1, freeze: true, instrumented: false });
        await page.setViewportSize({ width, height: width === 393 ? 851 : 1180 });
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.__freeze());   // temps figé : la pulsation des auras et les reflets de l'eau en dépendent
        await page.waitForTimeout(600);
        save(`${width}-${id}`, await stableShot(page));
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
    save(`trans-${id}`, await stableShot(page));
    await ctx.close();
}
// Plateau de combat (fonds des tuiles) à plusieurs densités de pixels : les bitmaps des tuiles dépendent de la densité
for (const dpr of [1, 2, 3]) {
    const { ctx, page } = await openScreen(browser, screens.find(s => s.id === 'rizieres_village'), { dpr, freeze: true, instrumented: false });
    await startCombat(page);
    await page.waitForTimeout(3000);   // fonds des tuiles prêts (bitmaps) ; capture avant l'apparition de la suggestion de coup (clignotement)
    await page.evaluate(() => window.__freeze());
    await page.waitForTimeout(600);
    save(`combat-dpr${dpr}`, await stableShot(page, '#board'));
    await ctx.close();
}
writeCache(`pixels-${tag}.json`, JSON.stringify(hashes, null, 1));
console.log(`${tag} : ${Object.keys(hashes).length} captures`);
await browser.close();

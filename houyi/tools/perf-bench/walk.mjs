#!/usr/bin/env node
// Marche dans des cartes : images/s, blocage, déplacement réel de la caméra, fonctions les plus coûteuses.
// Usage : node walk.mjs <clic|touches> <ralentissement CPU> <id d'écran…>      ex. node walk.mjs clic 4 rizieres_wild tonnerre_wild
// `clic` : clics de marche (le jeu calcule le chemin : la caméra parcourt 800 à 1 450 px) ; `touches` : flèches (le héros reste souvent bloqué
// contre un obstacle : à éviter pour juger la fluidité du défilement).
import { launch, openScreen, readJson, resetCounters, readCounters, stopProfile, KEYS } from './common.mjs';

const [mode = 'clic', rate = '1', ...ids] = process.argv.slice(2);
const screens = readJson('screens.json');
const browser = await launch();
for (const id of ids) {
    const screen = screens.find(s => s.id === id);
    if (!screen) { console.log(`écran inconnu : ${id}`); continue; }
    const { ctx, page, cdp } = await openScreen(browser, screen, { rate: Number(rate) });
    await resetCounters(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
    const box = await page.locator('#explore-canvas').boundingBox();
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < 9000) {
        if (mode === 'touches') { await page.keyboard.press(KEYS[i++ % KEYS.length]); await page.waitForTimeout(170); }
        else {
            const fx = [0.85, 0.15, 0.5, 0.9, 0.1][i % 5], fy = [0.5, 0.7, 0.25, 0.8, 0.4][i % 5];
            i++;
            await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
            await page.waitForTimeout(1500);
        }
    }
    const m = await readCounters(page, (Date.now() - t0) / 1000);
    console.log(`${mode} x${rate} ${id.padEnd(16)} ${m.fps} images/s · p95 ${m.p95} ms · blocage ${m.blockMs} ms · caméra : ${m.cameraPositions} positions, ${m.cameraTravelPx} px`);
    console.log('   ', (await stopProfile(cdp, 8)).join(' ; '));
    await ctx.close();
}
await browser.close();

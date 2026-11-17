#!/usr/bin/env node
// Échauffement à l'entrée en combat : cadence relevée toutes les 2 s pendant les premières secondes après `startCombat`, pour une série de variantes
// (règle CSS appliquée AVANT le combat, ou réglage du jeu). Sur GPU la cadence monte progressivement ; ce banc dit ce qui l'allonge ou le raccourcit.
// Usage : node warmup.mjs <ralentissement CPU> [variante…]      (sans variante : toutes ; voir VARIANTS)
import { launch, openScreen, readJson, resetCounters, readCounters, startCombat } from './common.mjs';

const css = rules => `document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(rules)};document.head.appendChild(s);});`;
const bitmapTiles = px => `window.addEventListener('load', async () => {
    let rules = '';
    for (const n of ['red','blue','green','yellow','purple','combat','skull','joker']) {
        const img = new Image(); img.src = 'sprites/tiles/tile-' + n + '.svg'; await img.decode();
        const c = document.createElement('canvas'); c.width = c.height = ${px};
        c.getContext('2d').drawImage(img, 0, 0, ${px}, ${px});
        rules += 'body.rt .tile.' + n + '{background-image:url(' + c.toDataURL() + ') !important}';
    }
    const s = document.createElement('style'); s.textContent = rules; document.head.appendChild(s);
});`;
const VARIANTS = {
    reference: '',
    'sans-fond-de-page': css('body.rt[data-combat-biome]{background-image:none !important}'),
    'sans-ombres': css('*{box-shadow:none !important;text-shadow:none !important}'),
    'sans-filtres': css('*{filter:none !important;backdrop-filter:none !important}'),
    'sans-animations': css('*,*::before,*::after{animation:none !important;transition:none !important}'),
    'plateau-masque': css('#board{visibility:hidden !important}'),
    'effets-economes': 'try{localStorage.setItem("match3quest.options",JSON.stringify({effects:"low"}))}catch(e){}',
    // les 8 SVG des tuiles rastérisés une fois en PNG (côté en pixels) puis utilisés comme fond, avant le combat
    'tuiles-bitmap-90': bitmapTiles(90),
    'tuiles-bitmap-128': bitmapTiles(128),
    'tuiles-sans-image': css('#board .tile{background-image:none !important}'),
    'tuiles-sans-arrondi': css('#board .tile{border-radius:0 !important}'),
    'tuiles-sans-transition': css('#board .tile{transition:none !important}'),
    'plateau-sans-effets': css('#board,#board .tile{box-shadow:none !important;filter:none !important;transition:none !important;animation:none !important}'),
    'tout-retire': css('*,*::before,*::after{box-shadow:none !important;text-shadow:none !important;filter:none !important;backdrop-filter:none !important;background-image:none !important;animation:none !important;transition:none !important}')
};

const [rate = '4', ...wanted] = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(VARIANTS);
const WINDOWS = 8, WINDOW_S = 2;
const browser = await launch();
for (const name of names) {
    if (!(name in VARIANTS)) { console.log(`variante inconnue : ${name}`); continue; }
    process.env.INIT_SCRIPT = VARIANTS[name];
    const { ctx, page } = await openScreen(browser, readJson('screens.json').find(s => s.id === 'rizieres_village'), { rate: Number(rate) });
    await startCombat(page);
    const series = [];
    for (let i = 0; i < WINDOWS; i++) {
        await resetCounters(page);
        await page.waitForTimeout(WINDOW_S * 1000);
        series.push((await readCounters(page, WINDOW_S)).fps);
    }
    const settled = series.findIndex((v, i) => v >= 55 && (series[i + 1] ?? 60) >= 55);
    console.log(`${name.padEnd(18)} ${series.map(v => String(Math.round(v)).padStart(3)).join(' ')}  | moyenne ${(series.reduce((a, b) => a + b, 0) / series.length).toFixed(1)} · stable à 55+ après ${settled < 0 ? '> ' + WINDOWS * WINDOW_S : settled * WINDOW_S} s`);
    await ctx.close();
}
await browser.close();

#!/usr/bin/env node
// Changement de carte : plus longue tâche et plus grand écart entre deux images juste après la sortie.
// Usage : WAIT=<ms d'attente avant la sortie, 1500 par défaut> node transition.mjs <ralentissement CPU> <id d'écran avec sortie…>
//         (ex. rizieres_h_grenier, fleuve_cave, rizieres_village). Le ralentissement s'applique dès le chargement (cas défavorable).
import { launch, openScreen, readJson, resetCounters, readCounters, exitKey } from './common.mjs';

const [rate = '1', ...ids] = process.argv.slice(2);
const screens = readJson('screens.json');
const browser = await launch();
for (const id of ids) {
    const screen = screens.find(s => s.id === id);
    if (!screen || !screen.exit) { console.log(`${id} : pas de sortie voisine de l'apparition`); continue; }
    const { ctx, page } = await openScreen(browser, screen, { rate: 1 });
    await page.waitForTimeout(Number(process.env.WAIT || 1500));
    if (Number(rate) > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(rate) });
    await resetCounters(page);
    await page.keyboard.press(exitKey(screen.exit));
    await page.waitForTimeout(3000);
    const m = await readCounters(page, 3);
    console.log(`x${rate} ${id} → ${screen.exit.to} | plus longue tâche ${m.maxLongMs} ms · plus grand écart entre images ${m.maxGap} ms · blocage ${m.blockMs} ms`);
    await ctx.close();
}
await browser.close();

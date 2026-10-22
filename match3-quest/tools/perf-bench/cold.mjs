#!/usr/bin/env node
// Première visite puis visite suivante (service worker), avec ou sans réseau lent.
// Usage : node cold.mjs <4g|aucun>      (4g : 1,6 Mb/s, 150 ms ; CPU ×4)
import { launch, loaded, BASE_URL, VIEWPORT } from './common.mjs';

const cfg = process.argv[2] || '4g';
const browser = await launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
if (cfg === '4g') await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 7.5e5 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
let t = Date.now();
await page.goto(BASE_URL);
await loaded(page);
const first = Date.now() - t;
// le service worker doit avoir rempli le cache du cœur avant la visite suivante
await page.waitForFunction(async () => {
    const k = (await caches.keys()).find(x => x.startsWith('match3-core-v'));
    return Boolean(k) && (await (await caches.open(k)).keys()).length > 150;
}, null, { timeout: 240_000 }).catch(() => {});
t = Date.now();
await page.reload();
await loaded(page);
const second = Date.now() - t;
console.log(`${cfg} · CPU ×4 | 1re visite ${first} ms | visite suivante ${second} ms | page contrôlée par le service worker : ${await page.evaluate(() => Boolean(navigator.serviceWorker.controller))}`);
await browser.close();

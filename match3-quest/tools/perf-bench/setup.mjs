#!/usr/bin/env node
// Prépare .cache/ : screens.json (écrans types, avec point d'apparition et sortie voisine) et base-player.json (sauvegarde d'un héros neuf).
// Le serveur du jeu doit tourner (voir README.md).
import { BASE_URL, launch, loaded, writeCache, VIEWPORT } from './common.mjs';

// 1. Écrans types : une zone sauvage par biome, 3 villages, un intérieur, une grotte, l'arène (niveau 8)
const X = await import('../../exploration.js');
const screens = X.createSession(null).screens;
const pick = [];
const add = (id, label) => {
    const s = screens[id];
    if (!s) return;
    const e = (s.exits || []).find(x => Math.abs(x.x - s.spawn.x) + Math.abs(x.y - s.spawn.y) === 1);
    pick.push({ id, label, w: s.w, h: s.h, spawn: s.spawn, biome: s.biome, exit: e ? { dx: e.x - s.spawn.x, dy: e.y - s.spawn.y, to: e.to } : null, npcs: s.npcs.length, enemies: s.enemies.length });
};
Object.values(screens).filter(s => /_wild$/.test(s.id)).forEach(s => add(s.id, 'wild'));
Object.values(screens).filter(s => /_village$/.test(s.id)).slice(0, 3).forEach(s => add(s.id, 'village'));
add('rizieres_h_grenier', 'house'); add('fleuve_cave', 'cave'); add('arena_c8', 'arena');
writeCache('screens.json', JSON.stringify(pick, null, 1));
console.log(`screens.json : ${pick.length} écrans`);

// 2. Sauvegarde d'un héros neuf (classe choisie, exploration lancée)
const browser = await launch();
const page = await (await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true })).newPage();
await page.goto(BASE_URL);
await loaded(page);
await page.click('.class-card');
await page.click('#confirm-class');
await page.waitForSelector('#explore-canvas', { state: 'visible' });
await page.waitForTimeout(1500);
writeCache('base-player.json', await page.evaluate(() => localStorage.getItem('player')));
console.log('base-player.json : sauvegarde écrite');
await browser.close();

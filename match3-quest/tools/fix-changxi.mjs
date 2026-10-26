#!/usr/bin/env node
/**
 * fix-changxi.mjs — Nettoie les artefacts du sprite de Changxi (sprites/png/changxi_{front,back,left,right}.png et l'entrée « changxi »
 * de sprites/generated.js) : retire les plaques de fond blanc pur (≥ 10 px) restées entre le corps et les ailes, puis les îlots isolés de moins de
 * 8 pixels. Les tons clairs de la robe (gris perle) ne sont pas touchés : seul le blanc quasi pur (> 238 sur les 3 canaux) est retiré.
 * Usage : node tools/fix-changxi.mjs   puis   node sprites/build-gba.mjs --only=changxi
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const { PNG } = createRequire(import.meta.url)('pngjs');
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'sprites', 'png');

function clean(png) {
  const { width: w, height: h, data } = png;
  let cleared = 0;
  const a = i => data[i * 4 + 3];
  const white = i => a(i) > 0 && Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) > 238;
  // seules les plaques blanches d'au moins 10 pixels (4-connexes) sont du fond : les reflets du visage, plus petits, restent
  const wseen = new Uint8Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (wseen[s] || !white(s)) continue;
    const comp = [], stack = [s];
    wseen[s] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      comp.push(i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, j = Y * w + X;
        if (X < 0 || Y < 0 || X >= w || Y >= h || wseen[j] || !white(j)) continue;
        wseen[j] = 1; stack.push(j);
      }
    }
    if (comp.length >= 10) comp.forEach(i => { data[i * 4 + 3] = 0; cleared++; });
  }
  // îlots isolés (composantes 8-connexes de moins de 8 pixels opaques)
  const seen = new Uint8Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !a(s)) continue;
    const comp = [], stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      comp.push(i);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy, j = Y * w + X;
        if (X < 0 || Y < 0 || X >= w || Y >= h || seen[j] || !a(j)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    if (comp.length < 8) comp.forEach(i => { data[i * 4 + 3] = 0; cleared++; });
  }
  return cleared;
}

for (const dir of ['front', 'back', 'left', 'right']) {
  const file = join(DIR, `changxi_${dir}.png`), png = PNG.sync.read(readFileSync(file));
  console.log(`changxi_${dir} : ${clean(png)} pixel(s) retirés`);
  writeFileSync(file, PNG.sync.write(png));
}

// Source du jeu : sprites/generated.js (toutes les images de l'entrée « changxi »).
const GEN = join(DIR, '..', 'generated.js');
const src = readFileSync(GEN, 'utf8');
const a = src.indexOf('  "changxi": {'), b = src.indexOf('\n  },', a);
let block = src.slice(a, b), total = 0;
block = block.replace(/(\w+: )"data:image\/png;base64,([^"]+)"/g, (m, key, b64) => {
  const png = PNG.sync.read(Buffer.from(b64, 'base64'));
  total += clean(png);
  return `${key}"data:image/png;base64,${PNG.sync.write(png).toString('base64')}"`;
});
writeFileSync(GEN, src.slice(0, a) + block + src.slice(b));
console.log(`generated.js : ${total} pixel(s) retirés dans changxi`);

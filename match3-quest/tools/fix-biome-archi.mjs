#!/usr/bin/env node
/**
 * fix-biome-archi.mjs — Nettoie les artefacts d'un sprite d'architecture (sprites/biome/<id>.png et son entrée de sprites/biomeArchi.js) :
 * retire les restes du fond gris uni (pixels neutres de luminosité moyenne), les îlots opaques de moins de 12 pixels, puis recalcule l'ombre
 * portée (silhouette décalée de 1 px à droite et 2 px vers le bas, noir translucide).
 * Usage : node tools/fix-biome-archi.mjs paddy_hut [autre_id …]
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const { PNG } = createRequire(import.meta.url)('pngjs');
const GAME = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(GAME, 'sprites', 'biomeArchi.js');

function clean(png) {
  const { width: w, height: h, data } = png;
  let cleared = 0;
  // ombre précédente : retirée (elle sera recalculée)
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] > 0 && data[i * 4 + 3] < 255) data[i * 4 + 3] = 0;
  const solid = i => data[i * 4 + 3] === 255;
  // restes du fond gris : neutres (écart de canaux < 14), luminosité 90-170
  for (let i = 0; i < w * h; i++) {
    if (!solid(i)) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 14 && mx >= 90 && mx <= 170) { data[i * 4 + 3] = 0; cleared++; }
  }
  // liseré gris au contact du vide (bord de fond mal détouré) : neutres plus larges, retirés par deux passes depuis l'extérieur
  for (let pass = 0; pass < 2; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!solid(i)) continue;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn >= 26 || mx < 70 || mx > 200) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X < 0 || Y < 0 || X >= w || Y >= h || !solid(Y * w + X); })) kill.push(i);
    }
    kill.forEach(i => { data[i * 4 + 3] = 0; cleared++; });
  }
  // îlots isolés (8-connexes) de moins de 12 pixels
  const seen = new Uint8Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !solid(s)) continue;
    const comp = [], stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      comp.push(i);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy, j = Y * w + X;
        if (X < 0 || Y < 0 || X >= w || Y >= h || seen[j] || !solid(j)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    if (comp.length < 12) comp.forEach(i => { data[i * 4 + 3] = 0; cleared++; });
  }
  // ombre portée
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = solid(i) ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - 1, sy = y - 2, i = y * w + x;
    if (mask[i] || sx < 0 || sy < 0 || !mask[sy * w + sx]) continue;
    data[i * 4] = 20; data[i * 4 + 1] = 12; data[i * 4 + 2] = 6; data[i * 4 + 3] = 110;
  }
  return cleared;
}

let src = readFileSync(OUT, 'utf8');
for (const id of process.argv.slice(2)) {
  const file = join(GAME, 'sprites', 'biome', `${id}.png`), png = PNG.sync.read(readFileSync(file));
  console.log(`${id} : ${clean(png)} pixel(s) retirés`);
  writeFileSync(file, PNG.sync.write(png));
  const uri = 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
  const re = new RegExp(`(  ${id}: \\{ w: \\d+, h: \\d+, uri: )"[^"]*"`);
  if (!re.test(src)) throw new Error(`${id} absent de biomeArchi.js`);
  src = src.replace(re, (m, pre) => pre + JSON.stringify(uri));
}
writeFileSync(OUT, src);

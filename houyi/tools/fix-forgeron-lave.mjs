#!/usr/bin/env node
/**
 * fix-forgeron-lave.mjs — Nettoie le détourage du Forgeron de lave (sprites/png/forgeron_lave_{front,back,left,right}.png) : retire le
 * liseré blanc/clair resté autour du personnage et la plaque de sol grise sous ses pieds. Flood-fill depuis le fond transparent, qui ne
 * traverse que des pixels « de fond » (clairs et neutres, ou de la couleur du sol échantillonnée au bas de l'image).
 * Usage : node tools/fix-forgeron-lave.mjs   puis   node sprites/build-gba.mjs --only=forgeron_lave (régénère le module et gbaIndex.js).
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const { PNG } = createRequire(import.meta.url)('pngjs');
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'sprites', 'png');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function clean(png, wide = false) {
  const { width: w, height: h, data } = png;
  let cleared = 0;
  const px = (x, y) => [data[(y * w + x) * 4], data[(y * w + x) * 4 + 1], data[(y * w + x) * 4 + 2]], alpha = (x, y) => data[(y * w + x) * 4 + 3];
  // couleur du sol : pixel opaque le plus à gauche des trois rangées les plus basses (le bord de la plaque, jamais les pieds)
  let ground = null;
  for (let y = h - 1; y >= h - 3 && !ground; y--) for (let x = 0; x < w && !ground; x++) if (alpha(x, y) > 0) ground = px(x, y);
  const pale = c => Math.min(...c) > 165 && Math.max(...c) - Math.min(...c) < 70;   // beige, rosé, gris clair
  const light = c => Math.min(...c) > 185 && Math.max(...c) - Math.min(...c) < 40;          // blanc, gris très clair, rosé pâle
  const isGround = (c, y) => y > h * 0.7 && dist(c, ground) < 45;                            // plaque sous les pieds
  const seen = new Uint8Array(w * h), stack = [];
  const add = (x, y) => { const i = y * w + x; if (x < 0 || y < 0 || x >= w || y >= h || seen[i]) return; if (alpha(x, y) > 0 && !(light(px(x, y)) || isGround(px(x, y), y))) return; seen[i] = 1; stack.push(i); };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); } for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  while (stack.length) { const i = stack.pop(), x = i % w, y = (i / w) | 0; add(x + 1, y); add(x - 1, y); add(x, y + 1); add(x, y - 1); }
  for (let i = 0; i < w * h; i++) if (seen[i] && data[i * 4 + 3] > 0) { data[i * 4 + 3] = 0; cleared++; }
  // liseré clair restant : pixels très clairs au contact du fond, retirés par passes successives (les poches entre bras et ventre)
  for (let pass = 0; pass < 3; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (alpha(x, y) === 0 || !light(px(x, y))) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X < 0 || Y < 0 || X >= w || Y >= h || alpha(X, Y) === 0; })) kill.push(y * w + x);
    }
    kill.forEach(i => { data[i * 4 + 3] = 0; cleared++; });
  }
  // poches pâles enfermées entre les bras et le ventre (restes du fond, jamais au contact du vide) : retirées sous la tête
  for (let y = Math.ceil(h * 0.25); y < h; y++) for (let x = 0; x < w; x++) if ((x < w * (wide ? 0.4 : 0.3) || x > w * (wide ? 0.6 : 0.7)) && alpha(x, y) > 0 && pale(px(x, y))) { data[(y * w + x) * 4 + 3] = 0; cleared++; }
  return cleared;
}

for (const dir of ['front', 'back', 'left', 'right']) {
  const file = join(DIR, `forgeron_lave_${dir}.png`), png = PNG.sync.read(readFileSync(file));
  console.log(`forgeron_lave_${dir} : ${clean(png, dir === "left" || dir === "right")} pixel(s) retirés`);
  writeFileSync(file, PNG.sync.write(png));
}

// Source du jeu : sprites/generated.js (toutes les images de l'entrée « forgeron_lave » : directions, marche, attaque).
const GEN = join(DIR, '..', 'generated.js');
let src = readFileSync(GEN, 'utf8');
const a = src.indexOf('  "forgeron_lave": {'), b = src.indexOf('\n  },', a);
let block = src.slice(a, b), total = 0;
block = block.replace(/(\w+: )"data:image\/png;base64,([^"]+)"/g, (m, key, b64) => {
  const png = PNG.sync.read(Buffer.from(b64, 'base64'));
  total += clean(png, /left|right/.test(key));
  return `${key}"data:image/png;base64,${PNG.sync.write(png).toString('base64')}"`;
});
writeFileSync(GEN, src.slice(0, a) + block + src.slice(b));
console.log(`generated.js : ${total} pixel(s) retirés dans forgeron_lave`);

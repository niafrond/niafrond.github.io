#!/usr/bin/env node
/**
 * Dérive les sprites des classes assassin/sorcerer/warrior
 * depuis les sprites archer par rotation de teinte HSL.
 *
 * Usage : node match3-quest/tools/recolor-sprites.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const GENERATED_PATH = join(__dirname, '..', 'sprites', 'generated.js');
const PNG_DIR = join(__dirname, '..', 'sprites', 'png');

// ─── Palettes : décalage de teinte (degrés) + saturation/luminosité scale ──

// L'archer est rouge (~0°/360°), on décale les teintes des autres classes.
// hueShift : rotation en degrés appliquée à la teinte de chaque pixel coloré
// satScale : multiplicateur de saturation (1 = inchangé)
const CLASS_RECOLOR = {
  // archer : source, inchangé
  warrior: { hueShift: 210, satScale: 0.9, label: 'bleu/or' },   // rouge → bleu roi
  assassin: { hueShift: 270, satScale: 0.85, label: 'violet/argent' }, // rouge → violet
  sorcerer: { hueShift: 150, satScale: 0.8, label: 'vert jade/or' },  // rouge → vert jade
};

// ─── Conversion RGB ↔ HSL ───────────────────────────────────────────────────

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ─── Recoloriage d'un PNG base64 ────────────────────────────────────────────

function recolorSprite(b64, hueShift, satScale) {
  const buf = Buffer.from(b64, 'base64');
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const a = data[idx + 3];
    if (a === 0) continue; // pixel transparent

    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    let [h, s, l] = rgbToHsl(r, g, b);

    // Ne pas recolorer les pixels quasi-noirs (contours) ni quasi-blancs
    if (l < 0.08 || l > 0.92) continue;
    // Ne pas recolorer les pixels très peu saturés (gris/peau neutre)
    if (s < 0.08) continue;

    h = (h + hueShift) % 360;
    s = Math.min(1, s * satScale);

    const [nr, ng, nb] = hslToRgb(h, s, l);
    data[idx] = nr; data[idx + 1] = ng; data[idx + 2] = nb;
  }

  return PNG.sync.write(png).toString('base64');
}

// ─── Main ────────────────────────────────────────────────────────────────────

const src = readFileSync(GENERATED_PATH, 'utf8');
const m = src.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);
if (!m) { console.error('Impossible de parser generated.js'); process.exit(1); }
const sprites = Function(`return ${m[1]}`)();

const archerSprites = sprites['archer'];
if (!archerSprites) { console.error('Sprites archer introuvables'); process.exit(1); }

console.log('Source : archer');

for (const [cls, { hueShift, satScale, label }] of Object.entries(CLASS_RECOLOR)) {
  console.log(`\n  [${cls}] hueShift=${hueShift}° satScale=${satScale} → ${label}`);
  sprites[cls] = {};
  for (const dir of ['front', 'back', 'left', 'right']) {
    const srcB64 = archerSprites[dir].replace('data:image/png;base64,', '');
    const outB64 = recolorSprite(srcB64, hueShift, satScale);
    sprites[cls][dir] = `data:image/png;base64,${outB64}`;
    process.stdout.write(`    ${dir} ✓  `);

    // Export PNG
    mkdirSync(PNG_DIR, { recursive: true });
    writeFileSync(join(PNG_DIR, `${cls}_${dir}.png`), Buffer.from(outB64, 'base64'));
  }
  console.log();
}

// Réécrit generated.js en préservant l'archer et les autres persos
const lines = [
  '// Généré par match3-quest/tools/gen-sprites.mjs — ne pas éditer à la main',
  `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`,
  '// Lancez: node match3-quest/tools/gen-sprites.mjs --only=all --dir=all',
  'export const GBA_SPRITES = {',
];
for (const [key, dirs] of Object.entries(sprites)) {
  lines.push(`  ${JSON.stringify(key)}: {`);
  for (const [dir, uri] of Object.entries(dirs)) {
    lines.push(`    ${dir}: ${JSON.stringify(uri)},`);
  }
  lines.push('  },');
}
lines.push('};');
writeFileSync(GENERATED_PATH, lines.join('\n') + '\n', 'utf8');

console.log(`\nEcrit → ${GENERATED_PATH}`);
console.log(`PNGs → ${PNG_DIR}`);

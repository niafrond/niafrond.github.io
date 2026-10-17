#!/usr/bin/env node
/**
 * Extrait les 4 sprites de direction du héros (Bas/Haut/Gauche/Droite) depuis tools/hero-source.png
 * (planche dessinée par l'utilisateur) et les écrit dans sprites/generated.js (clé « archer »).
 * Les classes s'en déduisent ensuite par changement de couleur : node tools/recolor-sprites.mjs
 *
 * Usage : node tools/extract-hero.mjs [--height=30]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { PNG } = createRequire(import.meta.url)('pngjs');
const GENERATED = join(__dirname, '..', 'sprites', 'generated.js');
const PNG_DIR = join(__dirname, '..', 'sprites', 'png');
const H = Number((process.argv.find(a => a.startsWith('--height=')) || '--height=30').split('=')[1]);
const SIZE = 32;

// Zones (x0, x1) des 4 sprites de la rangée du haut ; y0..y1 = rangée.
const CELLS = { front: [150, 310], back: [420, 580], left: [685, 845], right: [965, 1130] };
const Y0 = 55, Y1 = 255;

const src = PNG.sync.read(readFileSync(join(__dirname, 'hero-source.png')));
const px = (x, y) => { const i = (y * src.width + x) * 4; return [src.data[i], src.data[i + 1], src.data[i + 2]]; };
const isBg = c => Math.abs(c[0] - 73) < 22 && Math.abs(c[1] - 112) < 22 && Math.abs(c[2] - 76) < 22;

function analyse([x0, x1], Y0, Y1) {
  const w = x1 - x0, h = Y1 - Y0, mask = new Uint8Array(w * h);   // 1 = sprite
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = isBg(px(x0 + x, Y0 + y)) ? 0 : 1;
  // Ne garde que la plus grande composante (ignore reflets/étiquettes)
  const lab = new Int32Array(w * h), sizes = [0]; let n = 0;
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || lab[s]) continue;
    n++; sizes[n] = 0; const st = [s]; lab[s] = n;
    while (st.length) {
      const k = st.pop(); sizes[n]++; const x = k % w, y = (k - x) / w;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (mask[j] && !lab[j]) { lab[j] = n; st.push(j); }
      }
    }
  }
  const best = sizes.indexOf(Math.max(...sizes.slice(1)));
  let minx = w, maxx = 0, miny = h, maxy = 0;
  for (let k = 0; k < w * h; k++) if (lab[k] === best) { const x = k % w, y = (k - x) / w; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  return { x0, Y0, w, lab, best, minx, miny, bw: maxx - minx + 1, bh: maxy - miny + 1 };
}

/** Réduit une image analysée à 32×32 avec l'échelle donnée (pieds en bas, centrée sur la boîte). */
function render(a, scale) {
  const { x0, Y0, w, lab, best, minx, miny, bw, bh } = a;
  const ow = Math.round(bw * scale), oh = Math.round(bh * scale), out = new PNG({ width: SIZE, height: SIZE });
  const ox = Math.floor((SIZE - ow) / 2), oy = SIZE - 1 - oh;
  // Réduction par moyenne de boîte ; pixel opaque si > 40 % de la boîte appartient au sprite
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const sx0 = minx + x / scale, sx1 = minx + (x + 1) / scale, sy0 = miny + y / scale, sy1 = miny + (y + 1) / scale;
    let r = 0, g = 0, b = 0, c = 0, t = 0;
    for (let yy = Math.floor(sy0); yy < Math.min(Math.ceil(sy1), miny + bh); yy++) for (let xx = Math.floor(sx0); xx < Math.min(Math.ceil(sx1), minx + bw); xx++) {
      t++; if (lab[yy * w + xx] !== best) continue;
      const p = px(x0 + xx, Y0 + yy); r += p[0]; g += p[1]; b += p[2]; c++;
    }
    if (!c || c / t < 0.4) continue;
    const X = ox + x, Y = oy + y; if (X < 0 || X >= SIZE || Y < 0) continue;
    const i = (Y * SIZE + X) * 4; out.data[i] = r / c; out.data[i + 1] = g / c; out.data[i + 2] = b / c; out.data[i + 3] = 255;
  }
  return PNG.sync.write(out);
}

const gen = readFileSync(GENERATED, 'utf8');
const sprites = Function(`return ${gen.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/)[1]}`)();
mkdirSync(PNG_DIR, { recursive: true });
sprites.archer = {};
const put = (key, buf) => { sprites.archer[key] = `data:image/png;base64,${buf.toString('base64')}`; writeFileSync(join(PNG_DIR, `archer_${key}.png`), buf); };
for (const [dir, cell] of Object.entries(CELLS)) { const a = analyse(cell, Y0, Y1); put(dir, render(a, H / a.bh)); }

// Cycles de marche (rangée « Marche ») : même échelle pour toutes les images d'une direction (la plus haute = H px)
const WY0 = 385, WY1 = 505;
const WALK = {
  front: [[56, 114], [118, 187], [193, 253], [260, 320]],
  back: [[395, 454], [454, 513], [513, 572], [572, 630]],
  left: [[694, 763], [772, 834], [844, 905]],
  right: [[991, 1051], [1064, 1125], [1142, 1207]]
};
for (const [dir, cells] of Object.entries(WALK)) {
  const an = cells.map(c => analyse(c, WY0, WY1)), scale = H / Math.max(...an.map(a => a.bh));
  an.forEach((a, i) => put(`walk_${dir}_${i}`, render(a, scale)));
}
const lines = ['// Généré par match3-quest/tools/gen-sprites.mjs — ne pas éditer à la main', `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`, '// Lancez: node match3-quest/tools/gen-sprites.mjs --only=all --dir=all', 'export const GBA_SPRITES = {'];
for (const [k, dirs] of Object.entries(sprites)) { lines.push(`  ${JSON.stringify(k)}: {`); for (const [d, u] of Object.entries(dirs)) lines.push(`    ${d}: ${JSON.stringify(u)},`); lines.push('  },'); }
lines.push('};');
writeFileSync(GENERATED, lines.join('\n') + '\n', 'utf8');
console.log('archer extrait (4 directions)');

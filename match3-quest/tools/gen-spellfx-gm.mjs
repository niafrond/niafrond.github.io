#!/usr/bin/env node
/**
 * gen-spellfx-gm.mjs — Mini-animations pixel art des sorts de flèches d'action, générées EN LOCAL (ComfyUI : SDXL + LoRA Pixel Art XL,
 * pile game-maker lancée par `tools/gm up pixel`, dans WSL) : alternative à gen-spellfx.mjs (Pixel Lab, payant).
 *
 * Pour chaque sort de FX : image clé SDXL (fond uni) → détourage → grille de 8 px → réduction 48×48 → animation déterministe
 * (balancement, éclatement, balayage de teinte…) + particules dessinées en code. Écrit sprites/spellfx/<id>.png (planche horizontale)
 * et complète sprites/spellfx/index.json (même format que gen-spellfx.mjs). Les frames ont donc un sujet cohérent d'une image à l'autre.
 *
 * Usage (WSL, Node 22) : node tools/gen-spellfx-gm.mjs [--only=a,b] [--force] [--seed=n] [--steps=25] [--cfg=7] [--lora=1] [--host=<ip>]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const STEPS = Number(args.steps || 25), CFG = Number(args.cfg || 7), LORA = Number(args.lora ?? 1);
const SIZE = 48, FRAMES = 8, FPS = 10, TIER = 2, PORT = 8188, GEN = 512;
const OUT = join(GAME, 'sprites', 'spellfx'), INDEX = join(OUT, 'index.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// id -> [nom (comme spells.json), motif de l'image clé, mouvement]
const SPELLS = {
  legionForge: ["Forge des Légions", 'a black iron blacksmith anvil seen from the side, glowing blue and golden embers on top', 'forge'],
  steelHarvest: ["Moisson d'Acier", 'a farmer harvest scythe, long straight wooden handle with a large curved crescent-shaped steel blade at the top, green glow, side view', 'harvest'],
  brokenBlades: ['Lames Brisées', 'a broken red sword blade snapped in two pieces', 'shatter'],
  steelMoult: ["Mue d'Acier", 'a shed steel snake skin shimmering with purple light, ring shape', 'moult']
};

const NEGATIVE = '3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres, ' +
  'character, person, face, multiple objects, collage, grid, color palette, cropped, cut off, ground shadow, floor, scenery, frame, border';

async function findHost() {
  const cands = [args.host, process.env.COMFY_HOST, '127.0.0.1'].filter(Boolean);
  try {
    if (/microsoft/i.test(readFileSync('/proc/version', 'utf8'))) cands.push(execSync('ip route show default', { encoding: 'utf8' }).split(/\s+/)[2]);
  } catch { /* hors WSL */ }
  for (const h of cands) {
    try { if ((await fetch(`http://${h}:${PORT}/system_stats`, { signal: AbortSignal.timeout(2000) })).ok) return h; } catch { /* suivant */ }
  }
  throw new Error(`ComfyUI injoignable (${cands.join(', ')}:${PORT}) : lancer \`tools/gm up pixel\` (WSL)`);
}

const workflow = (prompt, seed) => ({
  1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
  2: { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['1', 1], lora_name: 'pixel-art-xl.safetensors', strength_model: LORA, strength_clip: LORA } },
  3: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: prompt } },
  4: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: NEGATIVE } },
  5: { class_type: 'EmptyLatentImage', inputs: { width: GEN, height: GEN, batch_size: 1 } },
  6: { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps: STEPS, cfg: CFG, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
  7: { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['1', 2] } },
  8: { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'match3-spellfx/s' } }
});

const seedOf = id => ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) + Number(args.seed || 0) * 104729) % 2147483647;

async function render(base, prompt, seed) {
  const sub = await (await fetch(`${base}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow(prompt, seed) }) })).json();
  if (!sub.prompt_id) throw new Error(JSON.stringify(sub).slice(0, 300));
  let entry;
  while (!(entry = (await (await fetch(`${base}/history/${sub.prompt_id}`)).json())[sub.prompt_id])) await sleep(1500);
  if (entry.status?.status_str !== 'success') throw new Error(JSON.stringify(entry.status?.messages ?? entry.status).slice(0, 300));
  const img = Object.values(entry.outputs).flatMap(o => o.images || [])[0];
  const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' });
  return PNG.sync.read(Buffer.from(await (await fetch(`${base}/view?${q}`)).arrayBuffer()));
}

// ── Détourage et réduction (même principe que gen-sprites-gm.mjs : grille de 8 px de la LoRA, couleur majoritaire par bloc) ──
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function cutout(png, tol = 95) {
  const { width: w, height: h, data } = png;
  const px = (x, y) => [data[(y * w + x) * 4], data[(y * w + x) * 4 + 1], data[(y * w + x) * 4 + 2]];
  const corners = [px(2, 2), px(w - 3, 2), px(2, h - 3), px(w - 3, h - 3)];
  const bg = [0, 1, 2].map(k => corners.map(c => c[k]).sort((a, b) => a - b)[1]);
  const seen = new Uint8Array(w * h), stack = [];
  const push = (x, y) => { const i = y * w + x; if (!seen[i] && dist(px(x, y), bg) < tol) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  for (let i = 0; i < w * h; i++) if (seen[i]) data[i * 4 + 3] = 0;
  return png;
}

function toCells(png) {
  const n = png.width >> 3, cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const s = ((y * 8 + 4) * png.width + x * 8 + 4) * 4;
    cells.push(png.data[s + 3] < 128 ? null : [png.data[s], png.data[s + 1], png.data[s + 2]]);
  }
  return { cells, n };
}

// Recadre la boîte englobante et la réduit dans un carré `box` (centré dans un canevas SIZE×SIZE) → tableau de pixels [r,g,b] | null.
function toGrid({ cells, n }, box) {
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  cells.forEach((c, i) => { if (c) { const x = i % n, y = (i / n) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  if (x1 < 0) throw new Error('image vide après détourage');
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, scale = box / Math.max(bw, bh);
  const tw = Math.max(1, Math.round(bw * scale)), th = Math.max(1, Math.round(bh * scale));
  const grid = Array.from({ length: SIZE * SIZE }, () => null), ox = (SIZE - tw) >> 1, oy = (SIZE - th) >> 1;
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const sx0 = x0 + Math.floor(tx / scale), sx1 = Math.max(sx0 + 1, x0 + Math.floor((tx + 1) / scale));
    const sy0 = y0 + Math.floor(ty / scale), sy1 = Math.max(sy0 + 1, y0 + Math.floor((ty + 1) / scale));
    const votes = new Map(); let solid = 0, total = 0;
    for (let sy = sy0; sy < Math.min(sy1, y1 + 1); sy++) for (let sx = sx0; sx < Math.min(sx1, x1 + 1); sx++) {
      total++; const c = cells[sy * n + sx]; if (!c) continue;
      solid++; const k = c.join(','); votes.set(k, (votes.get(k) || 0) + 1);
    }
    if (!total || solid * 2 < total) continue;
    grid[(oy + ty) * SIZE + ox + tx] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  }
  return grid;
}

// Contrôle qualité : fond retiré, un seul sujet, taille raisonnable.
function checkCutout(png) {
  const { cells, n } = toCells(png), solid = cells.filter(Boolean).length, total = n * n;
  const seen = new Uint8Array(total); let biggest = 0;
  cells.forEach((c, i0) => {
    if (!c || seen[i0]) return;
    let size = 0; const st = [i0]; seen[i0] = 1;
    while (st.length) {
      const i = st.pop(); size++; const x = i % n, y = (i / n) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx; if (cells[j] && !seen[j]) { seen[j] = 1; st.push(j); }
      }
    }
    biggest = Math.max(biggest, size);
  });
  const frac = solid / total, main = solid ? biggest / solid : 0;
  const votes = new Map(); cells.forEach(c => { if (c) { const k = c.map(v => v >> 4).join(','); votes.set(k, (votes.get(k) || 0) + 1); } });
  const flat = solid ? Math.max(...votes.values()) / solid : 0;
  const why = frac > 0.6 || flat > 0.45 ? 'fond non retiré' : frac < 0.05 ? 'trop petit' : main < 0.7 ? 'plusieurs sujets' : '';
  return { ok: !why, why, score: main - Math.abs(frac - 0.3) };
}

// ── Animation déterministe ─────────────────────────────────────────────────────────────────────────────────────────────────
const blank = () => Array.from({ length: SIZE * SIZE }, () => null);
const put = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) g[y * SIZE + x] = c; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const OUTLINE = [24, 18, 30];

// Rotation au plus proche voisin autour du centre, avec décalage (dx, dy) et échelle.
function transform(grid, angle, dx = 0, dy = 0, scale = 1, keep = () => true) {
  const out = blank(), c = (SIZE - 1) / 2, cos = Math.cos(-angle), sin = Math.sin(-angle);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const rx = (x - c - dx) / scale, ry = (y - c - dy) / scale;
    const sx = Math.round(rx * cos - ry * sin + c), sy = Math.round(rx * sin + ry * cos + c);
    if (sx >= 0 && sy >= 0 && sx < SIZE && sy < SIZE && keep(sx, sy)) out[y * SIZE + x] = grid[sy * SIZE + sx];
  }
  return out;
}
const tint = (grid, col, t) => grid.map(p => (p ? mix(p, col, t) : p));
const shade = (grid, k) => grid.map(p => (p ? p.map(v => Math.max(0, Math.min(255, Math.round(v * k)))) : p));

const ARROW = (g, x, y, col) => {   // flèche d'action pointée vers le haut : pointe 5 de large, hampe 2 px, contour sombre
  const body = [[0, -4], [-1, -3], [0, -3], [1, -3], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [0, -1], [1, -1], [0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [-1, 3], [0, 3], [2, 3], [1, 3]];
  body.forEach(([i, j]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => put(g, x + i + a, y + j + b, OUTLINE)));
  body.forEach(([i, j]) => put(g, x + i, y + j, j > 1 ? WHITE : col));
};
const SKULL = [   // crâne 9×9 (silhouette lisible, sans gore)
  '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', 'XX..X..XX', 'XX..X..XX', 'XXXXXXXXX', '.XXX.XXX.', '..X.X.X..', '..XXXXX..'
];
const drawSkull = (g, cx, cy, col, eye = OUTLINE) => SKULL.forEach((row, j) => [...row].forEach((ch, i) => {
  if (ch === 'X') put(g, cx - 4 + i, cy - 4 + j, col);
  else if (ch === '.' && j >= 3 && j <= 4 && i >= 2 && i <= 6 && i !== 4) put(g, cx - 4 + i, cy - 4 + j, eye);
}));

const GOLD = [255, 214, 80], BLUE = [90, 170, 255], GREEN = [120, 230, 130], RED = [235, 70, 60], PURPLE = [170, 90, 230], WHITE = [250, 250, 245], STEEL = [150, 160, 175];
const ease = t => t * t * (3 - 2 * t);

const MOTIONS = {
  // 4 flèches jaillissent de l'enclume (gâteaux de lune → flèches), l'enclume rougeoie et tressaute.
  forge(key, f) {
    const t = f / (FRAMES - 1), g = shade(transform(key, 0, 0, f % 2 ? 1 : 0), 1 + 0.25 * Math.sin(t * Math.PI));
    const out = tint(g, GOLD, 0.25 * Math.sin(t * Math.PI));
    [[-15, 0.00], [-5, 0.12], [5, 0.24], [15, 0.36]].forEach(([x, d], i) => {
      const u = (t - d) / 0.6; if (u <= 0 || u > 1) return;
      const y = 20 - 14 * ease(Math.min(1, u * 1.1)); ARROW(out, 24 + x, y, i % 2 ? BLUE : GOLD);
      put(out, 24 + x - 2, y + 7 + (f % 2), GOLD); put(out, 24 + x + 2, y + 9, BLUE);
    });
    for (let i = 0; i < 5; i++) put(out, 24 + ((i * 11 + f * 7) % 21) - 10, 30 + ((i * 5 + f * 3) % 10), i % 2 ? GOLD : BLUE);
    return out;
  },
  // la faux balaie de gauche à droite ; des étincelles bleues (qì) s'élèvent vers la fin.
  harvest(key, f) {
    const t = f / (FRAMES - 1), a = (-0.9 + 1.8 * ease(t)), out = transform(key, a, Math.sin(t * Math.PI) * 2, 0);
    for (let i = 0; i < 12; i++) { // arc de coupe
      const u = i / 11, ang = -0.9 + 1.8 * ease(Math.max(0, t - 0.1)) * u - 0.2;
      if (u * 1.8 - 0.9 > a) continue;
      put(out, 24 + Math.cos(ang - 1.5) * 19, 30 - Math.sin(ang - 1.5) * 12 + 6, mix(WHITE, GREEN, u));
    }
    if (t > 0.45) for (let i = 0; i < 6; i++) {
      const u = (t - 0.45) / 0.55, x = 8 + i * 6 + (i % 2) * 2, y = 38 - u * (14 + (i * 5) % 10);
      put(out, x, y, BLUE); put(out, x + 1, y, WHITE); put(out, x, y - 1, BLUE);
    }
    return out;
  },
  // la lame se fend en deux, les moitiés s'écartent, un crâne apparaît puis s'envole.
  shatter(key, f) {
    const t = f / (FRAMES - 1), split = ease(Math.min(1, t * 1.6)), shake = f % 2 ? 1 : -1;
    const out = blank(), l = transform(key, -0.18 * split, -9 * split + (t < 0.4 ? shake : 0), 2 * split, 1, (x, y) => x - y * 0.12 < 23);
    const r = transform(key, 0.22 * split, 9 * split, -1 * split, 1, (x, y) => x - y * 0.12 >= 23);
    l.forEach((p, i) => { if (p) out[i] = p; }); r.forEach((p, i) => { if (p) out[i] = p; });
    if (t > 0.35) { const u = ease((t - 0.35) / 0.65); drawSkull(out, 24, 24 - Math.round(u * 8), mix(WHITE, RED, 0.35 * (1 - u))); }
    for (let i = 0; i < 6; i++) { // éclats
      const u = Math.min(1, t * 1.4), a = i * 1.05 + 0.4;
      put(out, 24 + Math.cos(a) * (6 + 16 * u), 24 + Math.sin(a) * (6 + 14 * u) + u * 4, i % 2 ? STEEL : RED);
    }
    return out;
  },
  // la peau d'acier se détache, balayage d'une teinte grise à violette, étincelles en anneau.
  moult(key, f) {
    const t = f / (FRAMES - 1), sweep = (x, y) => (x + y) / (2 * SIZE) < t * 1.4 - 0.2;
    const grey = tint(key, STEEL, 0.55), pur = tint(key, PURPLE, 0.5);
    const base = key.map((p, i) => (p ? (sweep(i % SIZE, (i / SIZE) | 0) ? pur[i] : grey[i]) : null));
    const out = transform(base, 0.06 * Math.sin(t * Math.PI * 2), 0, -Math.sin(t * Math.PI) * 2, 1 + 0.06 * Math.sin(t * Math.PI));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 1.5, rr = 8 + 14 * ease(t);
      put(out, 24 + Math.cos(a) * rr, 24 + Math.sin(a) * rr * 0.8, i % 2 ? PURPLE : WHITE);
    }
    return out;
  }
};

function toPng(frames) {
  const sheet = new PNG({ width: SIZE * frames.length, height: SIZE });
  frames.forEach((g, f) => {
    // contour sombre d'un pixel autour des formes
    const solid = i => g[i] != null;
    g.forEach((p, i) => {
      const x = i % SIZE, y = (i / SIZE) | 0;
      let c = p;
      if (!c && ((x > 0 && solid(i - 1)) || (x < SIZE - 1 && solid(i + 1)) || (y > 0 && solid(i - SIZE)) || (y < SIZE - 1 && solid(i + SIZE)))) c = OUTLINE;
      if (!c) return;
      const d = (y * sheet.width + f * SIZE + x) * 4;
      sheet.data[d] = c[0]; sheet.data[d + 1] = c[1]; sheet.data[d + 2] = c[2]; sheet.data[d + 3] = 255;
    });
  });
  return sheet;
}

const host = await findHost(), base = `http://${host}:${PORT}`;
console.log(`ComfyUI : ${base}`);
mkdirSync(OUT, { recursive: true });
const index = JSON.parse(readFileSync(INDEX, 'utf8'));
const todo = Object.keys(SPELLS).filter(id => (!ONLY || ONLY.includes(id)) && (args.force || !existsSync(join(OUT, `${id}.png`))));
console.log(`${todo.length} sort(s) à générer`);
let ok = 0, fail = 0;
for (const id of todo) {
  const [name, motif, motion] = SPELLS[id], t0 = Date.now();
  try {
    const prompt = `pixel art, ${motif}, one single object alone, centered, plain solid flat medium gray (#808080) background, ` +
      'video game spell icon, clean bold dark outline, flat shading, limited color palette, ancient Chinese style';
    let best = null; const whys = [];
    for (let attempt = 0; attempt < 6 && !(best && best.q.ok); attempt++) {
      const img = cutout(await render(base, prompt, (seedOf(id) + attempt * 7919) % 2147483647)), q = checkCutout(img);
      if (!q.ok) whys.push(q.why);
      if (!best || q.score > best.q.score) best = { img, q };
    }
    if (!best.q.ok) throw new Error(`contrôle qualité échoué (${whys.join(', ')})`);
    const key = toGrid(toCells(best.img), 34);
    writeFileSync(join(OUT, `${id}.png`), PNG.sync.write(toPng(Array.from({ length: FRAMES }, (_, f) => MOTIONS[motion](key, f)))));
    index[id] = { name, frames: FRAMES, size: SIZE, fps: FPS, tier: TIER };
    writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
    ok++; console.log(`OK   ${id} (${Math.round((Date.now() - t0) / 1000)} s)`);
  } catch (e) { fail++; console.log(`ERR  ${id}: ${e.message}`); }
}
console.log(`Terminé : ${ok} ok, ${fail} échec(s)`);

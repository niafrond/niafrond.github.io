#!/usr/bin/env node
/**
 * gen-puzzle-sprites.mjs — Dessins des énigmes à plateau (puzzle/) générés EN LOCAL (ComfyUI : SDXL + LoRA Pixel Art XL, pile game-maker
 * lancée par `tools/gm up pixel`, dans WSL) : émetteur de soleil, récepteur (éteint / allumé), jarres, charrettes.
 *
 * Même chaîne que gen-sprites-gm.mjs : génération 8 px par bloc sur fond gris uni → détourage → réduction (couleur majoritaire par bloc),
 * avec contrôle qualité et re-tirage. Différences : cases de 32×32 (charrettes : 64×32 pour 2 cases, 96×32 pour 3), sprite centré dans son canevas,
 * vue de dessus. Écrit puzzle/sprites.js (data URI, ne pas modifier à la main) et sprites/puzzle/<id>.png (aperçus).
 *
 * Usage (WSL, Node 22) : node tools/gen-puzzle-sprites.mjs [--only=a,b] [--force] [--steps=25] [--cfg=7] [--lora=1] [--seed=0] [--host=<ip>]
 * Le fichier est réécrit après chaque sprite : on peut interrompre et relancer (les sprites existants sont sautés sans --force).
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const STEPS = Number(args.steps || 25), CFG = Number(args.cfg || 7), LORA = Number(args.lora ?? 1), PORT = 8188;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CELL = 32;

const OUT = join(GAME, 'puzzle', 'sprites.js');
const PNG_DIR = join(GAME, 'sprites', 'puzzle');

// ── Palette et motifs : univers de Hou Yi (bronzes Shang, laque rouge, jade, corbeaux d'or des dix soleils), voir tools/bible-graphique.mjs ──
const STYLE = (view = 'top-down view seen from above') => `pixel art, ${view}, one single small object alone, centered with a wide empty margin all around, plain solid flat medium gray (#808080) background, ` +
  `clean bold dark outline, flat shading, limited color palette, ancient Chinese mythological style, weathered ritual bronze and lacquer, video game item`;
const SUN = 'golden sun disc with a three-legged jinwu sun crow emblem';

// Charrettes : un dessin propre à chaque orientation (h = horizontale, vue de côté ; v = verticale, vue de derrière) et à chaque taille (2 ou 3 cases),
// en plusieurs chargements ; la charrette rouge existe dans les deux orientations. Aucun dessin n'est une rotation d'un autre : l'ombre est calculée
// ensuite d'après la silhouette (lumière en haut à gauche), donc elle suit l'orientation.
const CARGO = { 2: [['a', 'hay bundles'], ['b', 'clay jars tied with rope'], ['c', 'sacks of grain']], 3: [['a', 'stacked logs tied with rope'], ['b', 'bamboo poles and barrels']] };
const CARTS = [];
for (const [o, len] of [['h', 2], ['h', 3], ['v', 2], ['v', 3]]) {
  const wheels = len === 2 ? 'two big spoked wheels' : 'four wheels';
  const [w, h] = o === 'h' ? [len, 1] : [1, len], gen = o === 'h' ? [len * 512, 512] : [512, len * 512];
  const view = o === 'h' ? 'side view' : len === 2 ? 'overhead view looking straight down, symmetrical' : 'back view, seen from directly behind, symmetrical';
  const pose = o === 'h' ? 'one single long pole pointing to the right' : len === 2 ? 'wheels sticking out on the left side and the right side, one long pole pointing up' : 'a wheel on the left side and a wheel on the right side, one long pole pointing up';
  const body = len === 2 ? (o === 'h' ? 'simple wooden cart' : 'simple wooden cart, rectangular bed made of planks with side rails') : 'one single long wooden flatbed wagon, one body, no cab, not a car, not a truck';
  for (const [k, cargo] of CARGO[len]) CARTS.push({ id: 'cart_' + o + len + '_' + k, w, h, gen, shadow: true, wheels: o === 'v' && !(len === 3 && k === 'a') ? (len === 2 ? [0.2, 0.68] : [0.18, 0.7]) : undefined, view, desc: body + ' with ' + wheels + ', wooden bed loaded with ' + cargo + ', ' + pose });
}
for (const o of ['h', 'v']) CARTS.push({ id: 'cart_hero_' + o, w: o === 'h' ? 2 : 1, h: o === 'h' ? 1 : 2, gen: o === 'h' ? [1024, 512] : [512, 1024], shadow: true,
  view: o === 'h' ? 'side view' : 'back view, seen from directly behind, symmetrical',
  desc: 'bright red painted wooden cart with two big wheels, red box bed with golden trim, ' + (o === 'h' ? 'one long pole pointing to the right' : 'a wheel on the left side and a wheel on the right side, one long pole pointing up, no umbrella, no banner') });

// Chaque entrée : id, cases (w × h), taille de génération, description. `dir` : orientation du dessin source (les charrettes regardent à droite).
const SPRITES = [
  { id: 'emetteur', w: 1, gen: [512, 512],
    desc: `ornate round bronze sun lantern, a glowing ${SUN} in the center, ring of rays, verdigris patina, taotie rim, radial symmetric` },
  { id: 'recepteur', w: 1, gen: [512, 512],
    derive: { from: 'recepteur_allume', darken: 0.45 }, desc: '' },
  { id: 'recepteur_allume', w: 1, gen: [512, 512],
    view: 'front view', desc: 'a single bright glowing golden yellow crystal orb resting on a small round bronze stand, shining with light, simple', seedOf: 'recepteur' },
  // Jarre : celle du décor du jeu (sprites/decor.js, « jar », pixellisée à 32 px), conservée telle quelle dans puzzle/sprites.js, jamais générée.
  { id: 'jarre_a', w: 1, keep: true, desc: '' },
  ...CARTS
];

const NEGATIVE = '3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres, ' +
  'multiple objects, multiple views, sprite sheet, collage, grid, color palette, swatches, character, person, animal, cropped, cut off, ' +
  'ground shadow, floor, scenery, landscape, frame, border, white background, gray border, modern car, truck, van, engine, windows, umbrella, banner';

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

const workflow = (prompt, seed, [width, height]) => ({
  1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
  2: { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['1', 1], lora_name: 'pixel-art-xl.safetensors', strength_model: LORA, strength_clip: LORA } },
  3: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: prompt } },
  4: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: NEGATIVE } },
  5: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
  6: { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps: STEPS, cfg: CFG, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
  7: { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['1', 2] } },
  8: { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'match3-puzzle/s' } }
});

const seedOf = id => ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11) + Number(args.seed || 0) * 104729) % 2147483647;

async function render(base, prompt, seed, size) {
  const sub = await (await fetch(`${base}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow(prompt, seed, size) }) })).json();
  if (!sub.prompt_id) throw new Error(JSON.stringify(sub).slice(0, 300));
  let entry;
  while (!(entry = (await (await fetch(`${base}/history/${sub.prompt_id}`)).json())[sub.prompt_id])) await sleep(1500);
  if (entry.status?.status_str !== 'success') throw new Error(JSON.stringify(entry.status?.messages ?? entry.status).slice(0, 300));
  const img = Object.values(entry.outputs).flatMap(o => o.images || [])[0];
  const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' });
  return PNG.sync.read(Buffer.from(await (await fetch(`${base}/view?${q}`)).arrayBuffer()));
}

// ── Traitement d'image : fond uni → transparent, grille 8 px, réduction à (cases × 32) × 32 ───────────────────────────────

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
  const nx = png.width >> 3, ny = png.height >> 3, cells = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const s = ((y * 8 + 4) * png.width + x * 8 + 4) * 4;
    cells.push(png.data[s + 3] < 128 ? null : [png.data[s], png.data[s + 1], png.data[s + 2]]);
  }
  return { cells, nx, ny };
}

// Recadre la boîte englobante, l'étire à l'intérieur du canevas (cases × 32) × 32 (marge de 1 px) en gardant la couleur majoritaire de chaque
// bloc ; le rapport largeur/hauteur est conservé pour les objets d'une case (jarre, émetteur, récepteur), libre pour les charrettes.
function toSprite({ cells, nx, ny }, cw, ch, keepRatio, pad = { l: 1, t: 1, r: 1, b: 1 }) {
  let x0 = nx, y0 = ny, x1 = -1, y1 = -1;
  cells.forEach((c, i) => { if (c) { const x = i % nx, y = (i / nx) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  if (x1 < 0) throw new Error('image vide après détourage');
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, availW = cw - pad.l - pad.r, availH = ch - pad.t - pad.b;
  let tw = availW, th = availH;
  if (keepRatio) { const s = Math.min(availW / bw, availH / bh); tw = Math.max(1, Math.round(bw * s)); th = Math.max(1, Math.round(bh * s)); }
  const out = new PNG({ width: cw, height: ch }), ox = pad.l + ((availW - tw) >> 1), oy = pad.t + ((availH - th) >> 1);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const sx0 = x0 + Math.floor(tx * bw / tw), sx1 = Math.max(sx0 + 1, x0 + Math.floor((tx + 1) * bw / tw));
    const sy0 = y0 + Math.floor(ty * bh / th), sy1 = Math.max(sy0 + 1, y0 + Math.floor((ty + 1) * bh / th));
    const votes = new Map(); let solid = 0, total = 0;
    for (let sy = sy0; sy < Math.min(sy1, y1 + 1); sy++) for (let sx = sx0; sx < Math.min(sx1, x1 + 1); sx++) {
      total++; const c = cells[sy * nx + sx]; if (!c) continue;
      solid++; const k = c.join(','); votes.set(k, (votes.get(k) || 0) + 1);
    }
    if (!total || solid * 2 < total) continue;
    const [r, g, b] = [...votes.entries()].sort((a, b2) => b2[1] - a[1])[0][0].split(',').map(Number);
    const d = ((oy + ty) * cw + ox + tx) * 4;
    out.data[d] = r; out.data[d + 1] = g; out.data[d + 2] = b; out.data[d + 3] = 255;
  }
  return out;
}

// Contrôle qualité : fond retiré (≥ 30 % transparent), un seul objet (la plus grande composante porte ≥ 75 % des cellules pleines), taille raisonnable.
function checkCutout(png) {
  const { cells, nx, ny } = toCells(png), solid = cells.filter(Boolean).length, total = nx * ny;
  const seen = new Uint8Array(total); let biggest = 0;
  cells.forEach((c, i0) => {
    if (!c || seen[i0]) return;
    let size = 0; const st = [i0]; seen[i0] = 1;
    while (st.length) {
      const i = st.pop(); size++; const x = i % nx, y = (i / nx) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
        const j = Y * nx + X; if (cells[j] && !seen[j]) { seen[j] = 1; st.push(j); }
      }
    }
    biggest = Math.max(biggest, size);
  });
  const frac = solid / total, main = solid ? biggest / solid : 0;
  const votes = new Map(); cells.forEach(c => { if (c) { const k = c.map(v => v >> 4).join(','); votes.set(k, (votes.get(k) || 0) + 1); } });
  const flat = solid ? Math.max(...votes.values()) / solid : 0;
  const why = frac > 0.75 || flat > 0.5 ? 'fond non retiré' : frac < 0.1 ? 'trop petit' : main < 0.75 ? 'plusieurs sujets' : '';
  return { ok: !why, why, score: main - Math.abs(frac - 0.45) };
}

// Ombre portée : la silhouette décalée de 1 px à droite et de 2 px vers le bas (lumière en haut à gauche), en noir translucide sous le dessin.
function addWheels(png, fractions) {
  const { width: w, height: h, data } = png;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] === 255) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const put = (x, y, r, g, b) => { const i = (y * w + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; };
  for (const f of fractions) {
    const top = Math.round(y0 + (y1 - y0 - 8) * f);
    for (const left of [x0, x1 - 2]) for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 3; dx++) {
      const edge = dy === 0 || dy === 7 || dx === (left === x0 ? 0 : 2);        // contour sombre, centre brun clair avec un reflet
      put(left + dx, top + dy, ...(edge ? [32, 20, 10] : dx === (left === x0 ? 1 : 1) && dy < 3 ? [138, 96, 50] : [84, 56, 28]));
    }
  }
  return png;
}
const SHADOW_PAD = { l: 1, t: 1, r: 3, b: 4 };
function addShadow(png) {
  const { width: w, height: h, data } = png, solid = i => data[i * 4 + 3] === 255;
  const mask = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) mask[i] = solid(i) ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - 1, sy = y - 2, i = y * w + x;
    if (mask[i] || sx < 0 || sy < 0 || !mask[sy * w + sx]) continue;
    data[i * 4] = 20; data[i * 4 + 1] = 12; data[i * 4 + 2] = 6; data[i * 4 + 3] = 110;
  }
  return png;
}
const uriOf = png => 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');

// ── Lecture / écriture de puzzle/sprites.js (écriture atomique) ────────────────────────────────────────────────────────

function load() {
  if (!existsSync(OUT)) return {};
  const m = readFileSync(OUT, 'utf8').match(/export const PUZZLE_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);
  return m ? Function(`return ${m[1]}`)() : {};
}
function save(sprites) {
  const lines = ['// Dessins des énigmes à plateau (data URI, cases de 32 px ; w × h cases : une charrette horizontale de 2 cases fait 64 × 32 px, une verticale de 3 cases 32 × 96 px).',
    '// Fichier généré par tools/gen-puzzle-sprites.mjs (SDXL + LoRA Pixel Art XL) — ne pas modifier à la main.',
    `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`, 'export const PUZZLE_SPRITES = {'];
  for (const s of SPRITES) if (sprites[s.id]) lines.push(`  ${s.id}: { w: ${s.w}, h: ${s.h || 1}, uri: ${JSON.stringify(sprites[s.id].uri)} },`);
  lines.push('};', '');
  writeFileSync(OUT + '.tmp', lines.join('\n'), 'utf8');
  renameSync(OUT + '.tmp', OUT);
}

const host = await findHost(), base = `http://${host}:${PORT}`;
console.log(`ComfyUI : ${base}`);
mkdirSync(PNG_DIR, { recursive: true });
const sprites = load();
const CAND_DIR = join(PNG_DIR, 'cand');
if (args.use) {   // --use=cart_v2_a:3,cart_v2_b:0 : copie la variante choisie dans puzzle/sprites.js
  for (const pair of String(args.use).split(',')) {
    const [id, k] = pair.split(':'), s = SPRITES.find(x => x.id === id);
    if (!s) throw new Error('sprite inconnu : ' + id);
    const png = PNG.sync.read(readFileSync(join(CAND_DIR, id + '__' + k + '.png')));
    if (s.wheels) addWheels(png, s.wheels);
    sprites[id] = { uri: uriOf(png) }; writeFileSync(join(PNG_DIR, id + '.png'), PNG.sync.write(png)); console.log('adopté', id, 'variante', k, s.wheels ? '(roues ajoutées)' : '');
  }
  save(sprites); process.exit(0);
}
const NCAND = Number(args.cand || 0);
const todo = SPRITES.filter(s => !s.derive && !s.keep && (!ONLY || ONLY.includes(s.id)) && (NCAND || args.force || !sprites[s.id]));
console.log(`${todo.length} sprite(s) à générer`);

let ok = 0, fail = 0;
for (const s of todo) {
  const t0 = Date.now();
  try {
    const prompt = `${STYLE(s.view)}, ${s.desc}`;
    if (NCAND) {   // plusieurs variantes à comparer, sans modifier puzzle/sprites.js
      mkdirSync(CAND_DIR, { recursive: true });
      for (let k = 0; k < NCAND; k++) {
        let best = null;
        for (let attempt = 0; attempt < 4 && !(best && best.q.ok); attempt++) {
          const img = cutout(await render(base, prompt, (seedOf(s.id) + (k * 6 + attempt) * 7919) % 2147483647, s.gen)), q = checkCutout(img);
          if (!best || q.score > best.q.score) best = { img, q };
        }
        const out = toSprite(toCells(best.img), s.w * CELL, (s.h || 1) * CELL, s.w === 1 && !(s.h > 1), s.shadow ? SHADOW_PAD : undefined);
        if (s.shadow) addShadow(out);
        writeFileSync(join(CAND_DIR, s.id + '__' + k + '.png'), PNG.sync.write(out));
        console.log('CAND', s.id, k, best.q.ok ? 'ok' : best.q.why);
      }
      ok++; continue;
    }
    const seed = seedOf(s.seedOf || s.id);
    let best = null; const whys = [];
    for (let attempt = 0; attempt < 10 && !(best && best.q.ok); attempt++) {
      const img = cutout(await render(base, prompt, (seed + attempt * 7919) % 2147483647, s.gen)), q = checkCutout(img);
      if (!q.ok) whys.push(q.why);
      if (!best || q.score > best.q.score) best = { img, q };
    }
    if (!best.q.ok) throw new Error(`contrôle qualité échoué (${whys.join(', ')})`);
    const out = toSprite(toCells(best.img), s.w * CELL, (s.h || 1) * CELL, s.w === 1 && !(s.h > 1), s.shadow ? SHADOW_PAD : undefined);
    if (s.shadow) addShadow(out);
    sprites[s.id] = { uri: uriOf(out) };
    writeFileSync(join(PNG_DIR, `${s.id}.png`), PNG.sync.write(out));
    save(sprites);
    ok++; console.log(`OK   ${s.id} (${Math.round((Date.now() - t0) / 1000)} s)`);
  } catch (e) { fail++; console.log(`ERR  ${s.id}: ${e.message}`); }
}
// Sprites dérivés d'un autre (objet éteint = même dessin que l'allumé, couleurs ternies et assombries) : toujours refaits, c'est instantané.
for (const s of SPRITES.filter(x => x.derive && (!ONLY || ONLY.includes(x.id)))) {
  const src = sprites[s.derive.from];
  if (!src) { fail++; console.log(`ERR  ${s.id}: ${s.derive.from} manquant`); continue; }
  const out = PNG.sync.read(Buffer.from(src.uri.split(',')[1], 'base64'));
  for (let i = 0; i < out.data.length; i += 4) {
    const g = (out.data[i] + out.data[i + 1] + out.data[i + 2]) / 3;
    for (let k = 0; k < 3; k++) out.data[i + k] = Math.round((out.data[i + k] * 0.4 + g * 0.6) * s.derive.darken);
  }
  sprites[s.id] = { uri: uriOf(out) };
  writeFileSync(join(PNG_DIR, `${s.id}.png`), PNG.sync.write(out));
  save(sprites); ok++; console.log(`OK   ${s.id} (dérivé de ${s.derive.from})`);
}
console.log(`Terminé : ${ok} ok, ${fail} échec(s)`);

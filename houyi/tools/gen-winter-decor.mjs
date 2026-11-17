#!/usr/bin/env node
/**
 * gen-winter-decor.mjs — Décors du Royaume des âmes errantes (lanterne, encensoir, stèle, lion gardien, urne, cloche, talismans, offrande, fleurs, miroir) en pixel art, généré EN LOCAL
 * (ComfyUI : SDXL + LoRA Pixel Art XL, ou FLUX.2 Klein 4B avec --flux (recommandé), pile game-maker lancée par `tools/gm up pixel`, dans WSL). Même chaîne que gen-puzzle-sprites.mjs :
 * génération 8 px par bloc sur fond gris uni → détourage → réduction 32×32 (couleur majoritaire par bloc), contrôle qualité et re-tirage.
 * Écrit sprites/winter-decor.js (data URI, ne pas modifier à la main) et sprites/house/<id>.png (aperçus). 
 *
 * Usage (WSL, Node 22) : node tools/gen-winter-decor.mjs [--only=a,b] [--force] [--cand=4] [--use=shelf:2,bed:0] [--steps=25] [--cfg=7] [--lora=1] [--seed=0] [--flux]
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
const CELL = Number(args.cell || 32);   // --detail : 1024 px (grille de 128 blocs) réduits à --cell=64 (la porte est en 96), au lieu de 512 px réduits à 32
const DETAIL = !!args.detail;

const OUT = join(GAME, 'sprites', 'winter-decor.js');
const PNG_DIR = join(GAME, 'sprites', 'winter-decor');

// ── Palette et motifs : univers de Hou Yi (bronzes Shang, laque rouge, jade, corbeaux d'or des dix soleils), voir tools/bible-graphique.mjs ──
const STYLE = (view = 'front view') => `pixel art, ${view}, one single small object alone, centered with a wide empty margin all around, plain solid flat medium gray (#808080) background, ` +
  `clean bold dark outline, ${DETAIL ? 'highly detailed, intricate fine details, rich texture, multi-tone shading and highlights, many small decorative elements, isolated object only, NO background, NO scenery, NO mountains, NO landscape' : 'flat shading, limited color palette'}, warm festive Chinese winter mountain style, snow, red and gold lanterns, jade green accents, cozy and magical, video game item`;
const SUN = 'golden sun disc with a three-legged jinwu sun crow emblem';

// Décors du biome « Royaume des âmes errantes » (événement, events/wanderingSouls/) : motifs de la fête des fantômes chinoise.
const SPRITES = [
  { id: 'snow_pine', w: 1, gen: [512, 512], view: 'front view', desc: 'tall pine tree heavily covered with thick white snow, dark green needles peeking through, small red silk ribbon tied on a low branch' },
  { id: 'frozen_bamboo', w: 1, gen: [512, 512], view: 'front view', desc: 'cluster of bamboo stalks coated in frost and ice crystals, pale jade green stems, icicles hanging from the leaves' },
  { id: 'ice_block', w: 1, gen: [512, 512], view: 'front view, straight-on flat elevation like a classic 16-bit RPG sprite, the camera at the height of the object, almost no top surface visible', desc: 'translucent glacier blue ice cube block with white cracks and a faint golden glint inside, sitting on snow' },
  { id: 'snow_rock', w: 1, gen: [512, 512], view: 'front view', desc: 'gray boulder with a thick cap of white snow, small icicles on the side, a few dry winter grass blades' },
  { id: 'stone_column_snow', w: 1, gen: [512, 512], view: 'front view', desc: 'short carved stone column with a rounded top, dragon relief pattern, snow piled on the capital, faint red paint remaining' },
  { id: 'ice_crystal', w: 1, gen: [512, 512], view: 'front view', desc: 'glowing glacier blue crystal cluster with a soft golden light inside, snow at the base' },
  { id: 'lantern_red', w: 1, gen: [512, 512], view: 'front view', desc: 'round cinnabar red paper lantern on a wooden pole, golden tassels, warm orange glow, thin cap of snow on top' },
  { id: 'lantern_gold', w: 1, gen: [512, 512], view: 'front view', desc: 'round golden yellow paper lantern on a wooden pole, red tassels, warm glow, snow on top' },
  { id: 'lantern_unlit', w: 1, derive: { from: 'lantern_red', darken: 0.62 } },
  { id: 'snow_flowers', w: 1, gen: [512, 512], view: 'front view', desc: 'winter plum blossoms with pink and white petals on a bare branch dusted with snow, tiny golden stamens' },
  { id: 'guardian_statue_snow', w: 1, gen: [512, 512], view: 'front view', desc: 'stone guardian lion statue on a pedestal, snow on its head and back, red silk scarf tied around its neck' },
  { id: 'bronze_bell', w: 1, gen: [512, 512], view: 'front view', desc: 'small bronze temple bell hanging from a branch covered with frost, verdigris patina, red ribbon' },
  { id: 'tangyuan_basket', w: 1, gen: [512, 512], view: 'front view, straight-on flat elevation like a classic 16-bit RPG sprite, the camera at the height of the object, almost no top surface visible', desc: 'bamboo basket full of round glutinous rice dumplings in white, pink and golden colors, steam rising' },
  { id: 'hot_spring', w: 1, gen: [512, 512], view: 'front view, straight-on flat elevation like a classic 16-bit RPG sprite, the camera at the height of the object, almost no top surface visible', desc: 'small round stone hot spring basin seen from the front, the low stone wall in front, water surface barely visible, white steam rising, warm orange glow, snow around the rim' },
  { id: 'fallen_log_snow', w: 1, gen: [512, 512], view: 'front view', desc: 'fallen tree trunk lying sideways under snow, brown bark, small frozen mushrooms, icicles' },
  { id: 'ice_stalagmite', w: 1, gen: [512, 512], view: 'front view', desc: 'pointed pale blue ice stalagmite cluster rising from the ground, translucent crystals, white highlights' },
  { id: 'lantern_white', w: 1, gen: [512, 512], view: 'front view', desc: 'white paper lantern with a soft pale blue glow, silver tassels, hanging from a wooden pole, snow on top' },
  { id: 'lantern_jade', w: 1, gen: [512, 512], view: 'front view', desc: 'jade green paper lantern with gold floral cutouts, warm soft glow, hanging from a wooden pole' },
  { id: 'silk_ribbons', w: 1, gen: [512, 512], view: 'front view', desc: 'bundle of red and gold silk ribbons tied to a wooden post, fluttering in the wind, snow on the post' },
  { id: 'jade_ornament', w: 1, gen: [512, 512], view: 'front view', desc: 'carved jade pendant shaped like a crane on a red cord hanging from a short stand, deep green translucent jade' },
  { id: 'snow_hare', w: 1, gen: [512, 512], view: 'front view', desc: 'small white winter hare sitting in snow, pale blue shadow, black eyes, cute' },
  { id: 'smoke_chimney', w: 1, gen: [512, 512], view: 'front view', desc: 'traditional Chinese tile rooftop chimney with a gentle plume of white smoke rising, snow on the tiles' },
  { id: 'feast_table', w: 1, gen: [512, 512], view: 'front view, straight-on flat elevation like a classic 16-bit RPG interior sprite, the camera at the height of the furniture, almost no top surface visible', desc: 'low wooden festive table seen from the front, red tablecloth hanging over the front, steaming bowls and a plate of white pink and golden rice dumplings on top, chopsticks, cozy indoor furniture' },
  { id: 'paper_cutting', w: 1, gen: [512, 512], view: 'front view', desc: 'red paper cut window decoration with a pattern of plum blossoms and a crane, stuck on a wooden lattice window' },
  { id: 'glowing_crystal_lamp', w: 1, gen: [512, 512], view: 'front view', desc: 'small floating crystal lamp with a warm golden light, glacier blue facets, sparkles' },
  { id: 'frozen_door', w: 1, gen: [512, 512], view: 'front view', desc: 'wooden double door of a mountain shrine covered by a thick layer of translucent ice, red paint underneath, icicles, snow' },
  { id: 'ice_bridge', w: 1, gen: [512, 512], view: 'front view, straight-on flat elevation like a classic 16-bit RPG sprite, the camera at the height of the object, almost no top surface visible', desc: 'short fragile arched bridge of pale blue ice seen from the side, spanning a small gap, cracks across the surface, wooden handrails with frost' },
  { id: 'slippery_ice_tile', w: 1, gen: [512, 512], view: 'top-down view', desc: 'polished translucent glacier blue ice floor tile with white reflection streaks and fine cracks' },
  // Mobilier d'intérieur (maisons du village) : pas de neige, lumière chaude de feu et de lanterne.
  { id: 'kang', w: 1, gen: [512, 512], view: 'front view, straight-on flat elevation like a classic 16-bit RPG interior sprite, the camera at the height of the furniture, almost no top surface visible', desc: 'compact Chinese kang seen from the front, a raised platform bench built of gray bricks and rammed adobe clay, a thick red and gold quilted mattress on top with a folded blanket and a round embroidered cushion, a small warm glowing stove opening in the brick base, cozy indoor furniture, no snow' },
  { id: 'brazier', w: 1, gen: [512, 512], view: 'front view', desc: 'round bronze charcoal brazier on three legs with glowing orange embers and a few sparks, a copper kettle resting on a grate, indoor furniture, no snow' },
  { id: 'tea_shelf', w: 1, gen: [512, 512], view: 'front view', desc: 'tall dark wooden shelf with several tiers holding teapots, small porcelain cups, blue and white jars and a bamboo tea scoop, indoor furniture, no snow' },
  { id: 'calligraphy_scroll', w: 1, gen: [512, 512], view: 'front view', desc: 'hanging Chinese calligraphy scroll on cream silk with black brush characters and a red seal, wooden rods and red cords at the ends, indoor wall decoration, no snow' },
  { id: 'lacquer_chest', w: 1, gen: [512, 512], view: 'front view, straight-on flat elevation like a classic 16-bit RPG interior sprite, the camera at the height of the furniture, almost no top surface visible', desc: 'red lacquered wooden storage chest seen from the front with gold dragon patterns and brass lock fittings, closed lid, indoor furniture, no snow' },
  { id: 'floor_rug', w: 1, gen: [512, 512], view: 'top-down view', desc: 'round woven floor rug with a red and gold lotus and cloud pattern and a dark blue border, flat, indoor decoration, no snow' },
  { id: 'indoor_lantern', w: 1, gen: [512, 512], view: 'front view', desc: 'hanging red silk palace lantern with gold tassels and a wooden frame, hanging from a short chain, warm soft glow, indoor decoration, no snow' },
  { id: 'firewood_basket', w: 1, gen: [512, 512], view: 'front view', desc: 'woven bamboo basket filled with split firewood logs and a bundle of dry kindling, indoor furniture, no snow' },
  { id: 'wlm_gate', w: 1, cell: 64, gen: [512, 512], view: 'front view', desc: 'ornate Chinese mountain paifang gate, two red lacquered pillars with gold dragon patterns, curved dark tiled roof topped with snow, two glowing red paper lanterns hanging, the doorway opening onto a snowy mountain path, warm and welcoming' }
];

const NEGATIVE = 'western christmas, santa claus, reindeer, sleigh, elf, holly wreath, candy cane, snowman with carrot nose, japanese torii, dark, gloomy, horror, skull, 3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres, ' +
  'multiple objects, multiple views, sprite sheet, collage, grid, color palette, swatches, character, person, animal, cropped, cut off, ' +
  'ground shadow, floor, scenery, landscape, frame, border, white background, gray border, room, wall, floor, person, hands';

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
  8: { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'match3-winter-decor/s' } }
});

// Moteur FLUX.2 Klein 4B (--flux) : texte → image bien plus propre que SDXL (objet isolé, pas de décor parasite) ; même détourage et même réduction ensuite.
const FLUX = !!args.flux;
const workflowFlux = (prompt, seed, [width, height]) => ({
  1: { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-base-4b-fp8.safetensors', weight_dtype: 'default' } },
  3: { class_type: 'CLIPLoaderGGUF', inputs: { clip_name: 'Qwen_Qwen3-4B-Q8_0.gguf', type: 'flux2' } },
  4: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
  8: { class_type: 'CLIPTextEncode', inputs: { clip: ['3', 0], text: prompt } },
  9: { class_type: 'CLIPTextEncode', inputs: { clip: ['3', 0], text: NEGATIVE } },
  12: { class_type: 'EmptyFlux2LatentImage', inputs: { width, height, batch_size: 1 } },
  13: { class_type: 'Flux2Scheduler', inputs: { steps: Number(args.steps || 28), width, height } },
  14: { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['8', 0], negative: ['9', 0], cfg: Number(args.cfg || 4) } },
  15: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
  16: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
  17: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['16', 0], guider: ['14', 0], sampler: ['15', 0], sigmas: ['13', 0], latent_image: ['12', 0] } },
  18: { class_type: 'VAEDecode', inputs: { samples: ['17', 0], vae: ['4', 0] } },
  19: { class_type: 'SaveImage', inputs: { images: ['18', 0], filename_prefix: 'match3-winter-decor/f' } }
});
const FLUX_STYLE = (view, desc) => `A single game sprite in crisp retro 16-bit pixel art style: ${desc}. ${view}. Bold dark outline, chunky visible pixels, rich shading with highlights, saturated warm festive colors. ` +
  'The object is alone and centered, fully visible with a wide margin around it, on a perfectly flat plain solid medium gray (#808080) background, no ground, no shadow, no scenery.';

const seedOf = id => ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11) + Number(args.seed || 0) * 104729) % 2147483647;

async function render(base, prompt, seed, size) {
  const sub = await (await fetch(`${base}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: (FLUX ? workflowFlux : workflow)(prompt, seed, size) }) })).json();
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

// ── Lecture / écriture de sprites/winter-decor.js (écriture atomique) ────────────────────────────────────────────────────────

function load() {
  if (!existsSync(OUT)) return {};
  const m = readFileSync(OUT, 'utf8').match(/export const WINTER_DECOR\s*=\s*(\{[\s\S]*\});\s*$/);
  return m ? Function(`return ${m[1]}`)() : {};
}
function save(sprites) {
  const lines = ['// Mobilier des maisons en pixel art (data URI PNG 32 × 32), utilisé par sprites/decor.js à la place des dessins SVG.',
    '// Fichier généré par tools/gen-winter-decor.mjs (FLUX.2 Klein ou SDXL + LoRA Pixel Art XL) — ne pas modifier à la main.',
    `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`, 'export const WINTER_DECOR = {'];
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
if (args.use) {   // --use=cart_v2_a:3,cart_v2_b:0 : copie la variante choisie dans sprites/winter-decor.js
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
    const prompt = FLUX ? FLUX_STYLE(s.view, s.desc) : `${STYLE(s.view)}, ${s.desc}`, px = DETAIL ? (s.cell ? Math.round(s.cell * 1.5) : CELL) : (s.cell || CELL);
    if (NCAND) {   // plusieurs variantes à comparer, sans modifier sprites/winter-decor.js
      mkdirSync(CAND_DIR, { recursive: true });
      for (let k = 0; k < NCAND; k++) {
        let best = null;
        for (let attempt = 0; attempt < 4 && !(best && best.q.ok); attempt++) {
          const img = cutout(await render(base, s.variants?.[k] ? `${STYLE(s.view)}, ${s.variants[k]}` : prompt, (seedOf(s.id) + (k * 6 + attempt) * 7919) % 2147483647, DETAIL ? [1024, 1024] : s.gen)), q = checkCutout(img);
          if (!best || q.score > best.q.score) best = { img, q };
        }
        const out = toSprite(toCells(best.img), s.w * px, (s.h || 1) * px, s.w === 1 && !(s.h > 1), s.shadow ? SHADOW_PAD : undefined);
        if (s.shadow) addShadow(out);
        writeFileSync(join(CAND_DIR, s.id + '__' + k + '.png'), PNG.sync.write(out));
        console.log('CAND', s.id, k, best.q.ok ? 'ok' : best.q.why);
      }
      ok++; continue;
    }
    const seed = seedOf(s.seedOf || s.id);
    let best = null; const whys = [];
    for (let attempt = 0; attempt < 10 && !(best && best.q.ok); attempt++) {
      const img = cutout(await render(base, prompt, (seed + attempt * 7919) % 2147483647, DETAIL ? [1024, 1024] : s.gen)), q = checkCutout(img);
      if (!q.ok) whys.push(q.why);
      if (!best || q.score > best.q.score) best = { img, q };
    }
    if (!best.q.ok) throw new Error(`contrôle qualité échoué (${whys.join(', ')})`);
    const out = toSprite(toCells(best.img), s.w * px, (s.h || 1) * px, s.w === 1 && !(s.h > 1), s.shadow ? SHADOW_PAD : undefined);
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

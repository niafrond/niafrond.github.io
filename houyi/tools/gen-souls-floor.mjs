#!/usr/bin/env node
/**
 * gen-souls-floor.mjs — Décors du Royaume des âmes errantes (lanterne, encensoir, stèle, lion gardien, urne, cloche, talismans, offrande, fleurs, miroir) en pixel art, généré EN LOCAL
 * (ComfyUI : SDXL + LoRA Pixel Art XL, pile game-maker lancée par `tools/gm up pixel`, dans WSL). Même chaîne que gen-puzzle-sprites.mjs :
 * génération 8 px par bloc sur fond gris uni → détourage → réduction 32×32 (couleur majoritaire par bloc), contrôle qualité et re-tirage.
 * Écrit sprites/souls-decor.js (data URI, ne pas modifier à la main) et sprites/house/<id>.png (aperçus). 
 *
 * Usage (WSL, Node 22) : node tools/gen-souls-floor.mjs [--only=a,b] [--force] [--cand=4] [--use=shelf:2,bed:0] [--steps=25] [--cfg=7] [--lora=1] [--seed=0]
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


// ── Palette et motifs : univers de Hou Yi (bronzes Shang, laque rouge, jade, corbeaux d'or des dix soleils), voir tools/bible-graphique.mjs ──

// Décors du biome « Royaume des âmes errantes » (événement, events/wanderingSouls/) : motifs de la fête des fantômes chinoise.

const NEGATIVE = '3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres, ' +
  'photo, blurry, noisy, sprite sheet, collage, swatches, ' +
  'text, letters, watermark, frame, border, character, person, animal, object, furniture, perspective, 3d';

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
  8: { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'match3-souls-floor/s' } }
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

// ── Dalles de sol du Royaume des âmes errantes : 4 textures SDXL réduites à 16×16 sur une palette fixe, cuites dans sprites/soulsFloor.js ──
// Palette du biome (events/wanderingSouls : pierre grise, noir encre, bleu nuit, vert fantôme, or vieilli) : chaque pixel prend la couleur la plus proche.
const PALETTE = ['#4a4c52', '#5a5c62', '#686a70', '#7a7c82', '#2c3040', '#171a24', '#273b59', '#315f54', '#78b8a0', '#8c7b55'];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const nearest = c => PALETTE.reduce((best, p, i) => { const d = dist(c, hex(p)); return d < best.d ? { i, d } : best; }, { i: 0, d: 1e9 }).i;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const VARIANTS = [
  'cracked dark gray stone flagstone floor slab seen from directly above, top-down flat texture filling the whole image, fine cracks, tiny moss spots',
  'smooth dark gray stone floor slabs with thin pale seams seen from directly above, top-down flat texture filling the whole image, a few small pale green glowing runes',
  'worn ancient temple paving stones seen from directly above, top-down flat texture filling the whole image, dark gray with a few scattered pale dead leaves'
];
const base = await findHost().then(h => `http://${h}:${PORT}`);
const tiles = [];
for (let k = 0; k < VARIANTS.length; k++) {
  const png = await render(base, `pixel art, ${VARIANTS[k]}, flat shading, limited color palette, ancient Chinese temple ruin, night`, seedOf(`floor${k}`), [512, 512]);
  const rows = [];
  for (let ty = 0; ty < 16; ty++) {
    let row = '';
    for (let tx = 0; tx < 16; tx++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = ty * 32; y < ty * 32 + 32; y++) for (let x = tx * 32; x < tx * 32 + 32; x++) { const i = (y * 512 + x) * 4; r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++; }
      row += nearest([r / n, g / n, b / n]).toString(16);
    }
    rows.push(row);
  }
  tiles.push(rows);
  console.log(`OK   dalle ${k}`);
}
const out = ['// Dalles de sol du Royaume des âmes errantes (événement) : 16×16 pixels, indices dans PALETTE (hexadécimal).',
  '// Fichier généré par tools/gen-souls-floor.mjs (SDXL + LoRA Pixel Art XL) — ne pas modifier à la main.',
  'export const SOULS_FLOOR = {', `  palette: ${JSON.stringify(PALETTE)},`, '  tiles: ['];
tiles.forEach((rows, i) => out.push(`    [${rows.map(r => `'${r}'`).join(', ')}]${i < tiles.length - 1 ? ',' : ''}`));
out.push('  ]', '};', '');
writeFileSync(join(GAME, 'sprites', 'soulsFloor.js'), out.join('\n'));
console.log('sprites/soulsFloor.js écrit');

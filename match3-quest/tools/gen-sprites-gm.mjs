#!/usr/bin/env node
/**
 * gen-sprites-gm.mjs — Sprites GBA 32×32 des créatures du bestiaire, générés EN LOCAL (ComfyUI : SDXL + LoRA Pixel Art XL,
 * pile game-maker lancée par `tools/gm up pixel`, dans WSL) : alternative à gen-sprites.mjs (Pixel Lab, payant).
 *
 * Pour chaque créature de tools/bestiary-data.mjs qui n'a pas ses 4 directions dans sprites/generated.js :
 *   face, dos et profil gauche (3 générations SDXL 512², même graine) → détourage du fond uni → grille de 8 px (LoRA) →
 *   réduction à 32×32 (couleur majoritaire par bloc, bas du sprite aligné) ; profil droit = miroir du gauche.
 * Écrit sprites/generated.js (même format que gen-sprites.mjs) et sprites/png/<id>_<dir>.png.
 * Ne touche ni aux créatures déjà complètes ni aux animations d'attaque (gen-attacks.mjs, Pixel Lab).
 *
 * Usage (WSL, Node 22) : node tools/gen-sprites-gm.mjs [--only=a,b] [--force] [--steps=25] [--cfg=7] [--lora=1] [--host=<ip>]
 * Le fichier est réécrit après chaque créature : on peut interrompre et relancer (les créatures complètes sont sautées).
 * Puis : node tools/build-bestiary.mjs (ajoute au catalogue et aux hautes herbes celles qui ont leurs sprites).
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { BESTIARY as BASE_BESTIARY } from './bestiary-data.mjs';
import { OVERRIDES } from './sprite-overrides.mjs';
import { biblePrompt } from './bible-graphique.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const STEPS = Number(args.steps || 25), CFG = Number(args.cfg || 7), LORA = Number(args.lora ?? 1);
const SIZE = 512, PORT = 8188, OUT_PX = 32, MAX_PX = 30;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const GENERATED = join(GAME, 'sprites', 'generated.js');
const PNG_DIR = join(GAME, 'sprites', 'png');
const DIRS = ['front', 'back', 'left', 'right'];
// bestiaire + créatures de sprite-overrides.mjs (une surcharge remplace l'entrée de même id)
const BESTIARY = [...BASE_BESTIARY.filter(b => !OVERRIDES.some(o => o[0] === b[0])), ...OVERRIDES];
const VIEWS = {
  front: 'front view, facing the viewer',
  back: 'back view, seen from behind, facing away from the viewer',
  left: 'side profile view, facing left'
};
const NEGATIVE = '3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres, ' +
  'multiple characters, multiple views, sprite sheet, character sheet, reference sheet, turnaround, collage, grid, color palette, swatches, ' +
  'cropped, cut off, ground shadow, floor, scenery, landscape, frame, border, white background, gray background';

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
  5: { class_type: 'EmptyLatentImage', inputs: { width: SIZE, height: SIZE, batch_size: 1 } },
  6: { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps: STEPS, cfg: CFG, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
  7: { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['1', 2] } },
  8: { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'match3-sprites/s' } }
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

// ── Traitement d'image : fond uni → transparent, grille 8 px, réduction à 32×32 ────────────────────────────────────────

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Fond uni : couleur médiane des quatre coins, puis remplissage par les bords (le fond intérieur isolé est conservé).
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

// Échantillon au centre de chaque bloc de 8×8 (la LoRA dessine sur une grille de 8 px) → cellules {r,g,b,a}.
function toCells(png) {
  const n = png.width >> 3, cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const s = ((y * 8 + 4) * png.width + x * 8 + 4) * 4;
    cells.push(png.data[s + 3] < 128 ? null : [png.data[s], png.data[s + 1], png.data[s + 2]]);
  }
  return { cells, n };
}

// Recadre la boîte englobante, réduit à ≤ MAX_PX en gardant la couleur majoritaire de chaque bloc, centre en bas d'un canevas 32×32.
function toSprite({ cells, n }) {
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  cells.forEach((c, i) => { if (c) { const x = i % n, y = (i / n) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  if (x1 < 0) throw new Error('image vide après détourage');
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, scale = Math.min(1, MAX_PX / Math.max(bw, bh));
  const tw = Math.max(1, Math.round(bw * scale)), th = Math.max(1, Math.round(bh * scale));
  const out = new PNG({ width: OUT_PX, height: OUT_PX }), ox = (OUT_PX - tw) >> 1, oy = OUT_PX - 1 - th;
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const sx0 = x0 + Math.floor(tx / scale), sx1 = Math.max(sx0 + 1, x0 + Math.floor((tx + 1) / scale));
    const sy0 = y0 + Math.floor(ty / scale), sy1 = Math.max(sy0 + 1, y0 + Math.floor((ty + 1) / scale));
    const votes = new Map(); let solid = 0, total = 0;
    for (let sy = sy0; sy < Math.min(sy1, y1 + 1); sy++) for (let sx = sx0; sx < Math.min(sx1, x1 + 1); sx++) {
      total++; const c = cells[sy * n + sx]; if (!c) continue;
      solid++; const k = c.join(','); votes.set(k, (votes.get(k) || 0) + 1);
    }
    if (!total || solid * 2 < total) continue;
    const [r, g, b] = [...votes.entries()].sort((a, b2) => b2[1] - a[1])[0][0].split(',').map(Number);
    const d = ((oy + ty) * OUT_PX + ox + tx) * 4;
    out.data[d] = r; out.data[d + 1] = g; out.data[d + 2] = b; out.data[d + 3] = 255;
  }
  return out;
}

// Contrôle qualité d'un détourage : fond retiré (≥ 30 % transparent), une seule créature (la plus grande composante porte ≥ 75 % des
// cellules pleines), ni trop petite ni trop grande (5 à 60 % de la surface). Renvoie { ok, why, score }.
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
  const flat = solid ? Math.max(...votes.values()) / solid : 0;      // une couleur occupe presque tout : cadre de fond resté
  const why = frac > 0.6 || flat > 0.45 ? 'fond non retiré' : frac < 0.05 ? 'trop petit' : main < 0.75 ? 'plusieurs sujets' : '';
  return { ok: !why, why, score: main - Math.abs(frac - 0.3) };
}

const flip = png => {
  const o = new PNG({ width: png.width, height: png.height });
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const s = (y * png.width + x) * 4, d = (y * png.width + (png.width - 1 - x)) * 4;
    for (let k = 0; k < 4; k++) o.data[d + k] = png.data[s + k];
  }
  return o;
};
const uriOf = png => 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');

// ── Lecture / écriture de sprites/generated.js (même format que gen-sprites.mjs, écriture atomique) ────────────────────

function loadGenerated() {
  const m = readFileSync(GENERATED, 'utf8').match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);
  return Function(`return ${m[1]}`)();
}
function saveGenerated(sprites) {
  const lines = ['// Généré par match3-quest/tools/gen-sprites.mjs — ne pas éditer à la main', `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`,
    '// Lancez: node match3-quest/tools/gen-sprites.mjs --only=all --dir=all', 'export const GBA_SPRITES = {'];
  for (const [key, dirs] of Object.entries(sprites)) {
    lines.push(`  ${JSON.stringify(key)}: {`);
    for (const [dir, uri] of Object.entries(dirs)) lines.push(`    ${dir}: ${JSON.stringify(uri)},`);
    lines.push('  },');
  }
  lines.push('};');
  writeFileSync(GENERATED + '.tmp', lines.join('\n') + '\n', 'utf8');
  renameSync(GENERATED + '.tmp', GENERATED);   // jamais de fichier à moitié écrit
}

const host = await findHost(), base = `http://${host}:${PORT}`;
console.log(`ComfyUI : ${base}`);
mkdirSync(PNG_DIR, { recursive: true });
const sprites = loadGenerated();
const complete = id => DIRS.every(d => sprites[id]?.[d]);
const todo = BESTIARY.filter(b => (!ONLY || ONLY.includes(b[0])) && (args.force || !complete(b[0])));
console.log(`${todo.length} créature(s) à générer`);

let ok = 0, fail = 0;
for (const entry of todo) {
  const [id, , , , color, , , baseDesc] = entry, bible = biblePrompt(entry), desc = bible ? baseDesc + ", " + bible : baseDesc;   // bible graphique : motifs de l'iconographie ancienne
  const t0 = Date.now();
  try {
    const bg = args.bg ? String(args.bg).replace(/_/g, ' ') : 'flat medium gray (#808080)';
    const seed = seedOf(id), made = {};
    for (const view of ['front', 'back', 'left']) {
      const prompt = `pixel art, ${desc}, ${VIEWS[view]}, one single creature alone, full body, centered, plain solid flat ${bg} background, ` +
        'video game monster, chibi proportions, clean bold dark outline, flat shading, limited color palette, ancient Chinese mythological style';
      let best = null; const whys = [];
      for (let attempt = 0; attempt < 6 && !(best && best.q.ok); attempt++) {   // re-tirage avec une autre graine tant que le contrôle échoue
        const img = cutout(await render(base, prompt, (seed + attempt * 7919) % 2147483647)), q = checkCutout(img);
        if (!q.ok) whys.push(q.why);
        if (!best || q.score > best.q.score) best = { img, q };
      }
      if (!best.q.ok) throw new Error(`${view} : contrôle qualité échoué (${whys.join(', ')})`);
      made[view] = toSprite(toCells(best.img));
    }
    made.right = flip(made.left);
    sprites[id] = Object.fromEntries(DIRS.map(d => [d, uriOf(made[d])]));
    DIRS.forEach(d => writeFileSync(join(PNG_DIR, `${id}_${d}.png`), PNG.sync.write(made[d])));
    saveGenerated(sprites);
    ok++; console.log(`OK   ${id} (${Math.round((Date.now() - t0) / 1000)} s)`);
  } catch (e) { fail++; console.log(`ERR  ${id}: ${e.message}`); }
}
console.log(`Terminé : ${ok} ok, ${fail} échec(s)`);

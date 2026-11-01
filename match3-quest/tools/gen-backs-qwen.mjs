#!/usr/bin/env node
/**
 * gen-backs-qwen.mjs — Dos des personnages `wlm_*` générés à partir de leur face avec Qwen-Image-Edit-2511 (GGUF Q4_K_S) + LoRA
 * « Multiple Angles » (fal) + LoRA Lightning 4 étapes, dans ComfyUI (pile game-maker, `tools/gm up pixel`, WSL). SDXL (gen-sprites-gm.mjs) ne
 * sait pas dessiner « le même personnage de dos » : ici la face est l'image source et seule la caméra tourne (`<sks> back view …`).
 *
 * Chaîne : face 64×64 posée sur fond gris, agrandie à 768² (plus proche voisin) → édition Qwen → détourage du fond → recadrage → réduction à
 * 64×64 (couleur majoritaire par bloc), recalée sur la boîte de la face (même taille, même pose au sol). Candidats dans sprites/png/back-cand/.
 *
 * Usage (WSL, Node 22) : node tools/gen-backs-qwen.mjs --only=a,b --cand=3 [--seed=0] [--strength=0.9] [--prompt=texte] [--view=back|left|right]
 *                        node tools/gen-backs-qwen.mjs --use=wlm_ancien:1,wlm_cuisinier:0   (adopte un candidat : generated.js + sprites/png)
 * Puis : node sprites/build-gba.mjs
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const IDS = ['wlm_ancien', 'wlm_cuisinier', 'wlm_artisan', 'wlm_gardien_sanctuaire', 'wlm_enfants', 'wlm_esprit_village', 'wlm_famille', 'wlm_pelerin', 'wlm_renard_neiges', 'wlm_esprit_givre', 'wlm_oiseau_givre', 'wlm_gardien_glace', 'wlm_gardien_flamme'];
const ONLY = args.only ? String(args.only).split(',') : IDS;
const NCAND = Number(args.cand || 2), STRENGTH = Number(args.strength || 0.9), PORT = 8188, SIZE = 768, OUT_PX = 64;
const VIEW = args.view || 'back';   // back | left | right : angle de caméra demandé à la LoRA (le nom des candidats porte la vue, sauf « back »)
const VIEWS = { back: 'back view', left: 'left side view', right: 'right side view' };
const PROMPT = args.prompt || `<sks> ${VIEWS[VIEW]} eye-level shot medium shot`;
const tag = id => (VIEW === 'back' ? id : `${id}_${VIEW}`);
const GEN = join(GAME, 'sprites', 'generated.js'), PNG_DIR = join(GAME, 'sprites', 'png'), CAND = join(PNG_DIR, 'back-cand');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BG = [128, 128, 128];

async function findHost() {
  for (const h of [args.host, process.env.COMFY_HOST, '127.0.0.1'].filter(Boolean)) {
    try { if ((await fetch(`http://${h}:${PORT}/system_stats`, { signal: AbortSignal.timeout(2000) })).ok) return h; } catch { /* suivant */ }
  }
  throw new Error('ComfyUI injoignable : lancer `tools/gm up pixel` (WSL)');
}

const workflow = (image, seed) => ({
  1: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: 'qwen-image-edit-2511-Q4_K_S.gguf' } },
  2: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: 'Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors', strength_model: 1 } },
  3: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['2', 0], lora_name: 'qwen-image-edit-2511-multiple-angles-lora.safetensors', strength_model: STRENGTH } },
  4: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['3', 0], shift: 3 } },
  5: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_2.5_vl_7b_fp8_scaled.safetensors', type: 'qwen_image', device: 'default' } },
  6: { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' } },
  7: { class_type: 'LoadImage', inputs: { image } },
  8: { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['5', 0], prompt: PROMPT, vae: ['6', 0], image1: ['7', 0] } },
  9: { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['5', 0], prompt: '', vae: ['6', 0], image1: ['7', 0] } },
  10: { class_type: 'VAEEncode', inputs: { pixels: ['7', 0], vae: ['6', 0] } },
  11: { class_type: 'KSampler', inputs: { model: ['4', 0], positive: ['8', 0], negative: ['9', 0], latent_image: ['10', 0], seed, steps: 4, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
  12: { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['6', 0] } },
  13: { class_type: 'SaveImage', inputs: { images: ['12', 0], filename_prefix: 'match3-backs/b' } }
});

async function upload(base, name, png) {
  const fd = new FormData();
  fd.append('image', new Blob([PNG.sync.write(png)], { type: 'image/png' }), name);
  fd.append('overwrite', 'true');
  const r = await (await fetch(`${base}/upload/image`, { method: 'POST', body: fd })).json();
  return r.name;
}
async function render(base, image, seed) {
  const sub = await (await fetch(`${base}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow(image, seed) }) })).json();
  if (!sub.prompt_id) throw new Error(JSON.stringify(sub).slice(0, 400));
  let entry;
  while (!(entry = (await (await fetch(`${base}/history/${sub.prompt_id}`)).json())[sub.prompt_id])) await sleep(2000);
  if (entry.status?.status_str !== 'success') throw new Error(JSON.stringify(entry.status?.messages ?? entry.status).slice(0, 400));
  const img = Object.values(entry.outputs).flatMap(o => o.images || [])[0];
  const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' });
  return PNG.sync.read(Buffer.from(await (await fetch(`${base}/view?${q}`)).arrayBuffer()));
}

// face 64×64 transparente → 768² sur fond gris uni (×12, plus proche voisin)
function frontOnGray(front) {
  const k = SIZE / front.width, out = new PNG({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const s = (Math.floor(y / k) * front.width + Math.floor(x / k)) * 4, d = (y * SIZE + x) * 4, a = front.data[s + 3] / 255;
    for (let c = 0; c < 3; c++) out.data[d + c] = Math.round(front.data[s + c] * a + BG[c] * (1 - a));
    out.data[d + 3] = 255;
  }
  return out;
}
const bboxOf = (png, isFg) => {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) if (isFg(png, (y * png.width + x) * 4)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// résultat 768² → sprite 64×64 : fond retiré par remplissage depuis les bords, recadrage, réduction par couleur majoritaire, recalage sur la boîte de la face
function toSprite(res, front) {
  const { width: w, height: h, data } = res, px = (x, y) => [data[(y * w + x) * 4], data[(y * w + x) * 4 + 1], data[(y * w + x) * 4 + 2]];
  const corners = [px(3, 3), px(w - 4, 3), px(3, h - 4), px(w - 4, h - 4)];
  const bg = [0, 1, 2].map(k => corners.map(c => c[k]).sort((a, b) => a - b)[1]);
  const seen = new Uint8Array(w * h), st = [];
  const push = (x, y) => { const i = y * w + x; if (!seen[i] && dist(px(x, y), bg) < 40) { seen[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const i = st.pop(), x = i % w, y = Math.floor(i / w); if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = seen[i] ? 0 : 255;
  const b = bboxOf(res, (p, i) => p.data[i + 3] > 0), fb = bboxOf(front, (p, i) => p.data[i + 3] > 128);
  if (!b || !fb) throw new Error('image vide');
  const scale = Math.min(fb.h / b.h, (OUT_PX - 2) / b.w), tw = Math.max(1, Math.round(b.w * scale)), th = Math.max(1, Math.round(b.h * scale));
  const out = new PNG({ width: OUT_PX, height: OUT_PX }), ox = Math.round(fb.x0 + (fb.w - tw) / 2), oy = fb.y1 + 1 - th;
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const sx0 = b.x0 + Math.floor(tx / scale), sx1 = Math.max(sx0 + 1, b.x0 + Math.floor((tx + 1) / scale)), sy0 = b.y0 + Math.floor(ty / scale), sy1 = Math.max(sy0 + 1, b.y0 + Math.floor((ty + 1) / scale));
    const votes = new Map(); let solid = 0, total = 0;
    for (let sy = sy0; sy < Math.min(sy1, b.y1 + 1); sy++) for (let sx = sx0; sx < Math.min(sx1, b.x1 + 1); sx++) {
      total++; const i = (sy * w + sx) * 4; if (data[i + 3] < 128) continue; solid++;
      const k = [data[i], data[i + 1], data[i + 2]].join(','); votes.set(k, (votes.get(k) || 0) + 1);
    }
    if (!total || solid * 2 < total) continue;
    const [r, g, bl] = [...votes.entries()].sort((a, c) => c[1] - a[1])[0][0].split(',').map(Number), x = ox + tx, y = oy + ty;
    if (x < 0 || y < 0 || x >= OUT_PX || y >= OUT_PX) continue;
    const d = (y * OUT_PX + x) * 4; out.data[d] = r; out.data[d + 1] = g; out.data[d + 2] = bl; out.data[d + 3] = 255;
  }
  return out;
}

const src = readFileSync(GEN, 'utf8');
const sprites = Function(`return ${src.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/)[1]}`)();
const dec = uri => PNG.sync.read(Buffer.from(uri.split(',')[1], 'base64'));

if (args.use) {
  for (const pair of String(args.use).split(',')) {
    const [id, k] = pair.split(':'), png = PNG.sync.read(readFileSync(join(CAND, `${tag(id)}__${k}.png`)));
    sprites[id][VIEW] = 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
    writeFileSync(join(PNG_DIR, `${id}_${VIEW}.png`), PNG.sync.write(png));
    console.log('adopté', id, k);
  }
  const head = src.slice(0, src.indexOf('export const GBA_SPRITES')), body = ['export const GBA_SPRITES = {'];
  for (const [k, dirs] of Object.entries(sprites)) {
    body.push(`  ${JSON.stringify(k)}: {`);
    for (const [d, uri] of Object.entries(dirs)) body.push(`    ${d}: ${JSON.stringify(uri)},`);
    body.push('  },');
  }
  body.push('};', '');
  writeFileSync(GEN + '.tmp', head + body.join('\n'));
  renameSync(GEN + '.tmp', GEN);
  process.exit(0);
}

mkdirSync(CAND, { recursive: true });
const base = `http://${await findHost()}:${PORT}`;
for (const id of ONLY) {
  const front = dec(sprites[id].front), name = await upload(base, `${id}_front.png`, frontOnGray(front));
  for (let k = 0; k < NCAND; k++) {
    const t0 = Date.now();
    try {
      const res = await render(base, name, (Number(args.seed || 0) + k * 7919 + id.length * 101) % 2147483647);
      writeFileSync(join(CAND, `${tag(id)}__${k}_raw.png`), PNG.sync.write(res));
      writeFileSync(join(CAND, `${tag(id)}__${k}.png`), PNG.sync.write(toSprite(res, front)));
      console.log(`OK   ${id} #${k} (${Math.round((Date.now() - t0) / 1000)} s)`);
    } catch (e) { console.log(`ERR  ${id} #${k}: ${e.message}`); }
  }
}

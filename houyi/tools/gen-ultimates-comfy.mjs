#!/usr/bin/env node
/**
 * gen-ultimates-comfy.mjs — Génère en local (ComfyUI + SDXL base 1.0 + LoRA Pixel Art XL) une image par plan des 8 ultimes,
 * pour comparer avec les planches Pixel Lab de sprites/ultimates/. Les prompts viennent de gen-ultimates.mjs (ULTIMATES, BIBLES).
 * Sortie : sprites/ultimates-sdxl/<id>-<plan>.png (brut 768×1344) et <id>-<plan>-px.png (réduit 8× au plus proche voisin = pixels réels).
 * Ne touche pas à sprites/ultimates/.
 *
 * Prérequis : ComfyUI lancé par game-maker (`tools/gm up pixel`, dans WSL) ; à lancer sous WSL (Node 22).
 * Usage : node tools/gen-ultimates-comfy.mjs [--only=ultimateSkyWolf,...] [--plans=1,2] [--steps=25] [--cfg=7] [--lora=1] [--force]
 *                                            [--host=<ip>]   (sinon COMFY_HOST, 127.0.0.1 ou la passerelle WSL)
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
const PLANS = args.plans ? String(args.plans).split(',').map(Number) : [1, 2, 3, 4];
const STEPS = Number(args.steps || 25), CFG = Number(args.cfg || 7), LORA = Number(args.lora ?? 1);
const W = 768, H = 1344, PORT = 8188;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Réutilise les données de gen-ultimates.mjs (qui lance Pixel Lab à l'import : on n'en extrait que les constantes).
const src = readFileSync(join(__dirname, 'gen-ultimates.mjs'), 'utf8');
const grab = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const { ULTIMATES, BIBLES, STYLE, seedOf } = new Function(`${grab('const STYLE', 'export const ULTIMATES')}
  ${grab('export const ULTIMATES', 'async function api').replace('export const', 'const')}
  return { ULTIMATES, BIBLES, STYLE, seedOf };`)();

// Plan 1 des séquences : héros petit en bas du cadre, ciel dégagé au-dessus (place pour l'entité des clés suivantes).
const FRAMING = ', extreme wide establishing shot, the whole figure tiny in the lower third of the frame, huge empty sky above him, distant view';
const NEGATIVE = '3d render, realistic, photo, blurry, noisy, smooth gradients, antialiased, jpeg artifacts, text, letters, watermark, lowres, close-up, portrait, big face, european medieval knight, crusader, plate armor, western castle';

async function findHost() {
  const cands = [args.host, process.env.COMFY_HOST, '127.0.0.1'].filter(Boolean);
  try {
    if (/microsoft/i.test(readFileSync('/proc/version', 'utf8'))) cands.push(execSync('ip route show default', { encoding: 'utf8' }).split(/\s+/)[2]); // passerelle WSL2 (NAT)
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
  5: { class_type: 'EmptyLatentImage', inputs: { width: W, height: H, batch_size: 1 } },
  6: { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps: STEPS, cfg: CFG, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
  7: { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['1', 2] } },
  8: { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'ultimates-sdxl/u' } }
});

// Réduction 8× au plus proche voisin (échantillon au centre de chaque bloc de 8×8) : la LoRA dessine sur une grille de 8 px.
function pixelize(buf) {
  const p = PNG.sync.read(buf), w = p.width >> 3, h = p.height >> 3, o = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y * 8 + 4) * p.width + x * 8 + 4) * 4, d = (y * w + x) * 4;
    for (let k = 0; k < 4; k++) o.data[d + k] = p.data[s + k];
  }
  return PNG.sync.write(o);
}

const host = await findHost(), base = `http://${host}:${PORT}`;
const OUT = join(GAME, 'sprites', 'ultimates-sdxl');
mkdirSync(OUT, { recursive: true });
console.log(`ComfyUI : ${base}`);

let ok = 0, fail = 0;
for (const [id, plans] of Object.entries(ULTIMATES)) {
  if (ONLY && !ONLY.includes(id)) continue;
  for (const n of PLANS) {
    const file = join(OUT, `${id}-${n}.png`);
    if (!args.force && existsSync(file)) { console.log(`SKIP ${id}-${n}`); continue; }
    const t0 = Date.now();
    try {
      const prompt = `pixel art, ${STYLE}, ${BIBLES[id]}, ${plans[n - 1][0]}${n === 1 ? FRAMING : ''}`;
      const sub = await (await fetch(`${base}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow(prompt, seedOf(id) + n) }) })).json();
      if (!sub.prompt_id) throw new Error(JSON.stringify(sub).slice(0, 400));
      let entry;
      while (!(entry = (await (await fetch(`${base}/history/${sub.prompt_id}`)).json())[sub.prompt_id])) await sleep(2000);
      if (entry.status?.status_str !== 'success') throw new Error(JSON.stringify(entry.status?.messages ?? entry.status).slice(0, 400));
      const img = Object.values(entry.outputs).flatMap(o => o.images || [])[0];
      const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' });
      const buf = Buffer.from(await (await fetch(`${base}/view?${q}`)).arrayBuffer());
      writeFileSync(file, buf);
      writeFileSync(join(OUT, `${id}-${n}-px.png`), pixelize(buf));
      ok++; console.log(`OK   ${id}-${n} (${Math.round((Date.now() - t0) / 1000)} s)`);
    } catch (e) { fail++; console.log(`ERR  ${id}-${n}: ${e.message}`); }
  }
}
console.log(`Terminé : ${ok} ok, ${fail} échec(s)`);

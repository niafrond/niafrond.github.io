#!/usr/bin/env node
/**
 * gen-companion-sides.mjs — Vue de profil réaliste d'un compagnon, pour colorier les côtés de son maillage 3D (tools/render-companion-3d.py).
 * Part de l'image de face de tools/gen-companion-3d.mjs (sprites/png/model3d/<id>_src.png) et fait tourner la caméra avec Qwen-Image-Edit-2511
 * (GGUF Q4_K_S) + LoRA Lightning 4 étapes + LoRA multiple-angles (même chaîne que tools/gen-backs-qwen.mjs). « right side view » montre le
 * personnage tourné vers la gauche de l'image : c'est la vue gauche du jeu, la vue droite en est le miroir.
 * Écrit sprites/png/model3d/<id>_side.png.
 *
 * Usage (WSL, Node 22, `tools/gm up pixel` lancé) : node tools/gen-companion-sides.mjs companion_zhi [companion_yu …] [--seed=0] [--strength=0.9]
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; }));
const IDS = args.filter(a => a.startsWith('companion_')), BASE = 'http://127.0.0.1:8188', DIR = join(GAME, 'sprites', 'png', 'model3d');
const SEED = Number(opt.seed || 0), STRENGTH = Number(opt.strength || 0.9);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const workflow = image => ({
  1: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: 'qwen-image-edit-2511-Q4_K_S.gguf' } },
  2: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: 'Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors', strength_model: 1 } },
  3: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['2', 0], lora_name: 'qwen-image-edit-2511-multiple-angles-lora.safetensors', strength_model: STRENGTH } },
  4: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['3', 0], shift: 3 } },
  5: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_2.5_vl_7b_fp8_scaled.safetensors', type: 'qwen_image', device: 'default' } },
  6: { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' } },
  7: { class_type: 'LoadImage', inputs: { image } },
  14: { class_type: 'ImageScale', inputs: { image: ['7', 0], upscale_method: 'lanczos', width: 768, height: 768, crop: 'disabled' } },
  8: { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['5', 0], prompt: '<sks> right side view eye-level shot medium shot', vae: ['6', 0], image1: ['14', 0] } },
  9: { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['5', 0], prompt: '', vae: ['6', 0], image1: ['14', 0] } },
  10: { class_type: 'VAEEncode', inputs: { pixels: ['14', 0], vae: ['6', 0] } },
  11: { class_type: 'KSampler', inputs: { model: ['4', 0], positive: ['8', 0], negative: ['9', 0], latent_image: ['10', 0], seed: SEED, steps: 4, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
  12: { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['6', 0] } },
  13: { class_type: 'SaveImage', inputs: { images: ['12', 0], filename_prefix: 'match3-3d/side' } }
});

for (const id of IDS) {
  const t0 = Date.now(), fd = new FormData();
  fd.append('image', new Blob([readFileSync(join(DIR, `${id}_src.png`))], { type: 'image/png' }), `${id}_src.png`); fd.append('overwrite', 'true');
  const name = (await (await fetch(`${BASE}/upload/image`, { method: 'POST', body: fd })).json()).name;
  const sub = await (await fetch(`${BASE}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow(name) }) })).json();
  if (!sub.prompt_id) throw new Error(JSON.stringify(sub).slice(0, 500));
  let e;
  while (!(e = (await (await fetch(`${BASE}/history/${sub.prompt_id}`)).json())[sub.prompt_id])) await sleep(3000);
  if (e.status?.status_str !== 'success') { console.log('ERR ', id, JSON.stringify(e.status?.messages).slice(0, 400)); continue; }
  const f = Object.values(e.outputs).flatMap(o => o.images || [])[0];
  writeFileSync(join(DIR, `${id}_side.png`), Buffer.from(await (await fetch(`${BASE}/view?` + new URLSearchParams({ filename: f.filename, subfolder: f.subfolder || '', type: f.type || 'output' }))).arrayBuffer()));
  console.log(`OK   ${id} (${Math.round((Date.now() - t0) / 1000)} s)`);
}

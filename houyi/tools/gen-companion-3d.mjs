#!/usr/bin/env node
/**
 * gen-companion-3d.mjs — Modèles 3D des compagnons : FLUX.2 Klein (image de face « figurine ») → Hunyuan3D 2 (maillage .glb), via ComfyUI (`tools/gm up pixel`, WSL).
 * Les vues de face / gauche / droite en pixel art sont ensuite rendues depuis ce maillage par tools/render-companion-3d.py.
 * Écrit sprites/png/model3d/<id>_src.png (image source) et <id>.glb (non suivis par git).
 *
 * Usage (WSL, Node 22) : node tools/gen-companion-3d.mjs [--only=companion_zhi,...] [--seed=0] [--steps=30]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',') : null, PORT = 8188, BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(GAME, 'sprites', 'png', 'model3d');
const SIZE = Number(args.size || 1280), OCTREE = Number(args.octree || 384);   // définition choisie pour tenir dans les 8 Go de la carte (1536 px / octree 512 changeaient les proportions et le résultat était moins bon)
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Descriptions : celles des PNJ compagnons (tools/sprite-overrides.mjs), sans la mention « chibi » de pixel art.
const DESC = {};
const src = readFileSync(join(GAME, 'tools', 'sprite-overrides.mjs'), 'utf8');
for (const m of src.matchAll(/\['(companion_[a-z_]+)',[^\]]*?\n\s*'([^']+)'\]/g)) DESC[m[1]] = m[2];

const NEG = 'shadows, shading, gradients, highlights, glossy, text, watermark, background scenery, ground, shadow, multiple characters, cropped, blurry, extra limbs';
// Éclairage uniforme (« sans ombre ») : les ombres et dégradés incrustés dans l'image se retrouvent sinon dans les couleurs du pixel art.
const prompt = d => `A cute 3D vinyl toy figurine in flat cel-shaded style, full body clearly visible from head to feet, standing, front view, perfectly uniform flat lighting with absolutely no shadows, no shading gradients, no highlights, no ambient occlusion, solid flat colors, a clear detailed face with normal expressive eyes each showing a white sclera, a large round black pupil and iris and a tiny white catchlight, defined eyebrows, nose and mouth, crisp clean sculpted forms with sharp readable details, ${d}. ` +
  'One single figurine centered with a wide margin, on a perfectly flat plain white background, no ground, no shadow.';

const fluxWf = (text, seed) => ({
  1: { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-base-4b-fp8.safetensors', weight_dtype: 'default' } },
  3: { class_type: 'CLIPLoaderGGUF', inputs: { clip_name: 'Qwen_Qwen3-4B-Q8_0.gguf', type: 'flux2' } },
  4: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
  8: { class_type: 'CLIPTextEncode', inputs: { clip: ['3', 0], text } },
  9: { class_type: 'CLIPTextEncode', inputs: { clip: ['3', 0], text: NEG } },
  12: { class_type: 'EmptyFlux2LatentImage', inputs: { width: SIZE, height: SIZE, batch_size: 1 } },
  13: { class_type: 'Flux2Scheduler', inputs: { steps: 28, width: SIZE, height: SIZE } },
  14: { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['8', 0], negative: ['9', 0], cfg: 4 } },
  15: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
  16: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
  17: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['16', 0], guider: ['14', 0], sampler: ['15', 0], sigmas: ['13', 0], latent_image: ['12', 0] } },
  18: { class_type: 'VAEDecode', inputs: { samples: ['17', 0], vae: ['4', 0] } },
  19: { class_type: 'SaveImage', inputs: { images: ['18', 0], filename_prefix: 'match3-3d/src' } }
});

const hunyuanWf = (image, seed, steps) => ({
  1: { class_type: 'ImageOnlyCheckpointLoader', inputs: { ckpt_name: 'hunyuan3d-dit-v2_fp16.safetensors' } },
  2: { class_type: 'LoadImage', inputs: { image } },
  3: { class_type: 'CLIPVisionEncode', inputs: { clip_vision: ['1', 1], image: ['2', 0], crop: 'center' } },
  4: { class_type: 'Hunyuan3Dv2Conditioning', inputs: { clip_vision_output: ['3', 0] } },
  5: { class_type: 'EmptyLatentHunyuan3Dv2', inputs: { resolution: 3072, batch_size: 1 } },
  6: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 1 } },
  7: { class_type: 'KSampler', inputs: { model: ['6', 0], positive: ['4', 0], negative: ['4', 1], latent_image: ['5', 0], seed, steps, cfg: 5, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
  8: { class_type: 'VAEDecodeHunyuan3D', inputs: { samples: ['7', 0], vae: ['1', 2], num_chunks: 8000, octree_resolution: OCTREE } },
  9: { class_type: 'VoxelToMeshBasic', inputs: { voxel: ['8', 0], threshold: 0.6 } },
  10: { class_type: 'SaveGLB', inputs: { mesh: ['9', 0], filename_prefix: 'match3-3d/mesh' } }
});

async function run(wf) {
  const sub = await (await fetch(`${BASE}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf }) })).json();
  if (!sub.prompt_id) throw new Error(JSON.stringify(sub).slice(0, 600));
  let e;
  while (!(e = (await (await fetch(`${BASE}/history/${sub.prompt_id}`)).json())[sub.prompt_id])) await sleep(2000);
  if (e.status?.status_str !== 'success') throw new Error(JSON.stringify(e.status?.messages ?? e.status).slice(0, 800));
  return Object.values(e.outputs).flatMap(o => [...(o.images || []), ...(o['3d'] || []), ...(o.result || [])]);
}
const fetchFile = async f => Buffer.from(await (await fetch(`${BASE}/view?` + new URLSearchParams({ filename: f.filename, subfolder: f.subfolder || '', type: f.type || 'output' }))).arrayBuffer());

async function upload(name, buf) {
  const fd = new FormData(); fd.append('image', new Blob([buf], { type: 'image/png' }), name); fd.append('overwrite', 'true');
  const r = await (await fetch(`${BASE}/upload/image`, { method: 'POST', body: fd })).json();
  return r.name;
}

mkdirSync(OUT, { recursive: true });
const seed = Number(args.seed || 0), steps = Number(args.steps || 30);
for (const id of Object.keys(DESC)) {
  if (ONLY && !ONLY.includes(id)) continue;
  const t0 = Date.now(), srcPath = join(OUT, `${id}_src.png`);
  if (!existsSync(srcPath) || args.force) {
    const [img] = await run(fluxWf(prompt(DESC[id].replace(/chibi super-deformed /g, '').replace(/two heads tall, /g, '')), 1000 + seed));
    writeFileSync(srcPath, await fetchFile(img));
  }
  const name = await upload(`${id}_src.png`, readFileSync(srcPath));
  const outs = await run(hunyuanWf(name, seed, steps));
  const glb = outs.find(o => /\.glb$/i.test(o.filename || ''));
  if (!glb) { console.log('ERR ', id, JSON.stringify(outs).slice(0, 300)); continue; }
  writeFileSync(join(OUT, `${id}.glb`), await fetchFile(glb));
  console.log(`OK   ${id} (${Math.round((Date.now() - t0) / 1000)} s)`);
}

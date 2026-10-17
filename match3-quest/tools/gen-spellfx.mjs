#!/usr/bin/env node
/**
 * gen-spellfx.mjs — Génère une mini-animation pixel art par sort via Pixel Lab.
 *
 * Pour chaque sort de spells.json : image clé (PixFlux) puis animation (animate-with-text-v3).
 * Plus le sort coûte cher (somme des mana), plus l'animation est grande, longue et détaillée (voir TIERS).
 *
 * Sortie : sprites/spellfx/<id>.png (planche horizontale, une frame par colonne) + sprites/spellfx/index.json
 *          { id: { frames, size, fps, tier } }. Les sorts déjà générés sont sautés (reprise possible).
 *
 * Usage :
 *   node tools/gen-spellfx.mjs [--only=id1,id2] [--tier=1..5] [--force] [--dry-run] [--concurrency=2]
 *   node tools/gen-spellfx.mjs --clean   Retire les fonds blancs opaques des planches existantes et ajoute les noms à index.json
 *   Clé : --key=… ou PIXELLAB_API_KEY ou pixel-art/config.js (comme gen-sprites.mjs).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { MOTIFS, SIZE_OVERRIDE } from './spellfx-motifs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '..');
const OUT = join(GAME, 'sprites', 'spellfx');
const INDEX = join(OUT, 'index.json');

// Plus le sort est cher, plus l'animation est grande, longue et détaillée.
export const TIERS = [
  { tier: 1, maxCost: 10,       size: 32,  frames: 4,  fps: 8,  detail: 'low detail',    shading: 'flat shading' },
  { tier: 2, maxCost: 24,       size: 48,  frames: 8,  fps: 10, detail: 'medium detail', shading: 'basic shading' },
  { tier: 3, maxCost: 49,       size: 64,  frames: 8,  fps: 10, detail: 'medium detail', shading: 'medium shading' },
  { tier: 4, maxCost: 99,       size: 96,  frames: 12, fps: 12, detail: 'highly detailed', shading: 'detailed shading' },
  { tier: 5, maxCost: Infinity, size: 128, frames: 16, fps: 12, detail: 'highly detailed', shading: 'detailed shading' }
];

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true];
}));
const ONLY = args.only ? String(args.only).split(',') : null;
const ONLY_TIER = args.tier ? Number(args.tier) : null;
const FORCE = !!args.force;
const DRY = !!args['dry-run'];
const CONCURRENCY = Number(args.concurrency || 2);
const ENGINE = args.engine || 'minimax';   // minimax (PixMiniMax, mouvement ample) | v3 (animate-with-text-v3)

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadApiKey() {
  if (args.key && args.key !== true) return args.key;
  if (process.env.PIXELLAB_API_KEY) return process.env.PIXELLAB_API_KEY;
  const p = resolve(GAME, '..', 'pixel-art', 'config.js');
  if (existsSync(p)) { const m = readFileSync(p, 'utf8').match(/PIXELLAB_API_KEY\s*=\s*['"]([^'"]+)['"]/); if (m) return m[1]; }
  return null;
}

export function totalCost(cost) {
  if (typeof cost === 'number') return cost;
  return Object.values(cost || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}
export const tierFor = (total) => TIERS.find(t => total <= t.maxCost);

export function loadSpells() {
  const cat = JSON.parse(readFileSync(join(GAME, 'spells.json'), 'utf8'));
  const seen = new Map();
  for (const list of Object.values(cat)) {
    if (!Array.isArray(list)) continue;
    for (const s of list) if (s && s.id && !seen.has(s.id)) seen.set(s.id, s);
  }
  return [...seen.values()].map(s => {
    const t = tierFor(totalCost(s.cost));
    return { id: s.id, name: s.name, total: totalCost(s.cost), ...t, size: SIZE_OVERRIDE[s.id] ?? t.size };
  });
}

const NEGATIVE = 'character, person, human face, text, letters, watermark, background scenery, blurry';

async function api(url, key, init = {}, retries = 5) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  if ((res.status === 429 || res.status >= 500) && retries > 0) { await sleep(8000 + Math.random() * 5000); return api(url, key, init, retries - 1); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`HTTP ${res.status}: ${JSON.stringify(e).slice(0, 300)}`); }
  return res.json();
}

const b64 = (img) => (typeof img === 'string' ? img : img?.base64 ?? img?.image?.base64);

async function keyFrame(key, spell, motif) {
  const description = `pixel art magic spell effect, ${motif}, glowing, vivid colors, ${spell.detail}, no character, isolated effect`;
  const data = await api('https://api.pixellab.ai/v1/generate-image-pixflux', key, {
    method: 'POST',
    body: JSON.stringify({
      description, negative_description: NEGATIVE, image_size: { width: spell.size, height: spell.size },
      outline: 'selective outline', shading: spell.shading, detail: spell.detail, view: 'side', no_background: true
    })
  });
  const out = data.image?.base64;
  if (!out) throw new Error('image clé absente');
  return out;
}

async function animate(key, spell, frame, motion) {
  const dyn = `${motion}, big dynamic energetic movement across the whole frame`;
  const job = ENGINE === 'v3'
    ? await api('https://api.pixellab.ai/v2/animate-with-text-v3', key, {
      method: 'POST',
      body: JSON.stringify({ first_frame: { type: 'base64', base64: frame, format: 'png' }, action: `${dyn}, looping magic effect`, frame_count: spell.frames, no_background: true, enhance_prompt: true })
    })
    : await api('https://api.pixellab.ai/v2/animate-pixminimax', key, {
      method: 'POST',
      body: JSON.stringify({ first_frame: { type: 'base64', base64: frame, format: 'png' }, description: dyn, frame_count: spell.frames, no_background: true, enhance_prompt: true, subject_description: 'a magic spell visual effect' })
    });
  const id = job.background_job_id;
  for (let i = 0; i < 120; i++) {
    await sleep(4000);
    const st = await api(`https://api.pixellab.ai/v2/background-jobs/${id}`, key, { method: 'GET' });
    if (st.status === 'completed') {
      const imgs = (st.last_response?.images || []).map(b64).filter(Boolean);
      if (!imgs.length) throw new Error('animation sans image');
      return imgs;
    }
    if (st.status === 'failed') throw new Error(`animation échouée: ${JSON.stringify(st.last_response).slice(0, 200)}`);
  }
  throw new Error('animation: délai dépassé');
}

/** Rend transparent le fond blanc/quasi blanc relié aux bords de la frame (le modèle laisse parfois un fond opaque). */
export function clearWhiteBackground(png) {
  const { width: w, height: h, data } = png;
  const isBg = (i) => data[i + 3] > 0 && data[i] >= 235 && data[i + 1] >= 235 && data[i + 2] >= 235;
  const seen = new Uint8Array(w * h), stack = [];
  const push = (x, y) => { const k = y * w + x; if (!seen[k] && isBg(k * 4)) { seen[k] = 1; stack.push(k); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop(), x = k % w, y = (k - x) / w;
    data[k * 4 + 3] = 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  return png;
}

/** Assemble les frames (PNG base64) en planche horizontale, chaque frame centrée dans une case size×size. */
export function buildStrip(framesB64, size) {
  const pngs = framesB64.map(b => clearWhiteBackground(PNG.sync.read(Buffer.from(b, 'base64'))));
  const strip = new PNG({ width: size * pngs.length, height: size });
  pngs.forEach((p, i) => {
    const ox = i * size + Math.floor((size - p.width) / 2), oy = Math.floor((size - p.height) / 2);
    PNG.bitblt(p, strip, 0, 0, Math.min(p.width, size), Math.min(p.height, size), ox, oy);
  });
  return PNG.sync.write(strip);
}

function cleanExisting(index) {
  const names = new Map(loadSpells().map(s => [s.id, s.name]));
  for (const [id, e] of Object.entries(index)) {
    e.name = names.get(id) ?? e.name;
    const file = join(OUT, `${id}.png`);
    const sheet = PNG.sync.read(readFileSync(file));
    const size = e.size;
    for (let f = 0; f < e.frames; f++) {
      const frame = new PNG({ width: size, height: size });
      PNG.bitblt(sheet, frame, f * size, 0, size, size, 0, 0);
      clearWhiteBackground(frame);
      PNG.bitblt(frame, sheet, 0, 0, size, size, f * size, 0);   // bitblt copie aussi les pixels transparents
    }
    writeFileSync(file, PNG.sync.write(sheet));
  }
  const ordered = Object.fromEntries(Object.entries(index).map(([id, e]) => [id, { name: e.name, frames: e.frames, size: e.size, fps: e.fps, tier: e.tier }]));
  writeFileSync(INDEX, JSON.stringify(ordered, null, 2) + '\n');
  console.log(`${Object.keys(index).length} planches nettoyées`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : {};
  if (args.clean) return cleanExisting(index);
  let spells = loadSpells();
  const missing = spells.filter(s => !MOTIFS[s.id]).map(s => s.id);
  if (missing.length) console.warn(`Sans motif (ignorés) : ${missing.join(', ')}`);
  spells = spells.filter(s => MOTIFS[s.id] && (!ONLY || ONLY.includes(s.id)) && (!ONLY_TIER || s.tier === ONLY_TIER) && (FORCE || !index[s.id]));
  console.log(`${spells.length} animation(s) à générer`);
  if (DRY) { for (const s of spells) console.log(`T${s.tier} ${String(s.total).padStart(3)} ${s.size}px x${s.frames}  ${s.id}: ${MOTIFS[s.id][0]}`); return; }
  const key = loadApiKey();
  if (!key) { console.error('Clé API Pixel Lab introuvable (--key=, PIXELLAB_API_KEY ou pixel-art/config.js)'); process.exit(1); }

  const queue = [...spells];
  let done = 0, failed = 0;
  const worker = async () => {
    while (queue.length) {
      const s = queue.shift();
      const [motif, motion] = MOTIFS[s.id];
      try {
        const first = await keyFrame(key, s, motif);
        const frames = await animate(key, s, first, motion);
        writeFileSync(join(OUT, `${s.id}.png`), buildStrip(frames, s.size));
        index[s.id] = { name: s.name, frames: frames.length, size: s.size, fps: s.fps, tier: s.tier };
        writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');
        done++; console.log(`OK  ${s.id} (T${s.tier}, ${frames.length} frames) [${done}/${spells.length}]`);
      } catch (e) {
        failed++; console.log(`ERR ${s.id}: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Terminé : ${done} ok, ${failed} en échec`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

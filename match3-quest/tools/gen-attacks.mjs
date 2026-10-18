#!/usr/bin/env node
/**
 * gen-attacks.mjs — Animation d'attaque (arme, griffes, souffle…) de chaque ennemi via Pixel Lab (PixMiniMax).
 * Part du sprite de profil gauche (tourné vers Hou Yi, qui est à gauche à l'écran ; sinon de face) de `sprites/generated.js`, ajoute les images `attack_0..n` à l'entrée de l'ennemi
 * (lues par `gbaAttackFrames` dans sprites/index.js, jouées sur le portrait de combat).
 *
 * Usage : node tools/gen-attacks.mjs [--only=a,b] [--force] [--concurrency=3] [--frames=8] [--dry-run]
 * Clé : PIXELLAB_API_KEY ou pixel-art/config.js.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const GENERATED = join(GAME, 'sprites', 'generated.js');
const PNG_DIR = join(GAME, 'sprites', 'png');
const { SPRITE_MANIFEST } = await import('./sprite-prompts.js');

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const FRAMES = Number(args.frames || 8), CONC = Number(args.concurrency || 3);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const key = (() => {
  if (process.env.PIXELLAB_API_KEY) return process.env.PIXELLAB_API_KEY;
  const p = resolve(GAME, '..', 'pixel-art', 'config.js');
  return existsSync(p) ? (readFileSync(p, 'utf8').match(/PIXELLAB_API_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1] : null;
})();

function load() {
  const m = readFileSync(GENERATED, 'utf8').match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);
  return Function(`return ${m[1]}`)();
}
function save(sprites) {
  const lines = ['// Généré par match3-quest/tools/gen-sprites.mjs — ne pas éditer à la main', `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`, '// Lancez: node match3-quest/tools/gen-sprites.mjs --only=all --dir=all', 'export const GBA_SPRITES = {'];
  for (const [k, dirs] of Object.entries(sprites)) { lines.push(`  ${JSON.stringify(k)}: {`); for (const [d, u] of Object.entries(dirs)) lines.push(`    ${d}: ${JSON.stringify(u)},`); lines.push('  },'); }
  lines.push('};');
  writeFileSync(GENERATED, lines.join('\n') + '\n', 'utf8');
}

async function api(url, init = {}, retries = 5) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  if ((res.status === 429 || res.status >= 500) && retries > 0) { await sleep(8000 + Math.random() * 5000); return api(url, init, retries - 1); }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(await res.json().catch(() => ({}))).slice(0, 300)}`);
  return res.json();
}
const b64 = img => (typeof img === 'string' ? img : img?.base64 ?? img?.image?.base64);

async function animate(frame64, description) {
  const job = await api('https://api.pixellab.ai/v2/animate-pixminimax', { method: 'POST', body: JSON.stringify({
    first_frame: { type: 'base64', base64: frame64, format: 'png' }, description, frame_count: FRAMES, no_background: true, enhance_prompt: true, subject_description: 'a pixel art monster or fighter' }) });
  for (let i = 0; i < 120; i++) {
    await sleep(4000);
    const st = await api(`https://api.pixellab.ai/v2/background-jobs/${job.background_job_id}`, { method: 'GET' });
    if (st.status === 'completed') return (st.last_response?.images || []).map(b64).filter(Boolean);
    if (st.status === 'failed') throw new Error('animation échouée');
  }
  throw new Error('délai dépassé');
}

/** Remet chaque image en 32×32 (centrée, pieds alignés sur ceux de l'image d'origine) et retire un éventuel fond blanc. */
function normalize(b) {
  const p = PNG.sync.read(Buffer.from(b, 'base64')), out = new PNG({ width: 32, height: 32 });
  const ox = Math.floor((32 - p.width) / 2), oy = Math.floor((32 - p.height) / 2);
  PNG.bitblt(p, out, 0, 0, Math.min(p.width, 32), Math.min(p.height, 32), ox, oy);
  return PNG.sync.write(out);
}

const sprites = load();
const todo = Object.keys(SPRITE_MANIFEST.enemies).filter(k => (sprites[k]?.left || sprites[k]?.front) && (!ONLY || ONLY.includes(k)) && (args.force || !sprites[k].attack_0));
console.log(`${todo.length} animation(s) d'attaque`);
if (args['dry-run'] || !todo.length) process.exit(0);
if (!key) { console.error('Clé Pixel Lab introuvable'); process.exit(1); }
mkdirSync(PNG_DIR, { recursive: true });
const queue = [...todo]; let ok = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) {
    const k = queue.shift();
    try {
      const desc = `${SPRITE_MANIFEST.enemies[k].desc.split(',').slice(0, 3).join(',')}; facing left, performs a violent attack toward the left: winds up then lunges forward to the left and strikes hard with its weapon, claws or fangs, whole body moving, then returns`;
      const frames = await animate((sprites[k].left || sprites[k].front).replace('data:image/png;base64,', ''), desc);
      if (frames.length < 4) throw new Error('trop peu d\'images');
      const cur = load();   // relit : d'autres workers ont écrit entre-temps
      frames.forEach((f, i) => { const buf = normalize(f); cur[k][`attack_${i}`] = `data:image/png;base64,${buf.toString('base64')}`; writeFileSync(join(PNG_DIR, `${k}_attack_${i}.png`), buf); });
      save(cur); ok++; console.log(`OK  ${k} (${frames.length} images) [${ok}/${todo.length}]`);
    } catch (e) { console.log(`ERR ${k}: ${e.message}`); }
  }
}));
console.log(`Terminé : ${ok}/${todo.length}`);

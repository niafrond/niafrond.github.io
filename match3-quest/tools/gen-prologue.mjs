#!/usr/bin/env node
/**
 * gen-prologue.mjs — Régénère les tableaux du prologue (5, nouvelle partie) ou de la cinématique de fin (4, `--set=ending`) avec Pixel Lab.
 * Pour chaque tableau et chaque orientation (paysage 256×144, portrait 144×256) : décor clé (PixFlux, opaque)
 * puis boucle animée (PixMiniMax, 12 images) assemblée en planche horizontale.
 * Sortie : sprites/<set>/<n>-<land|port>.png + sprites/<set>/index.json { frames, fps, land:[w,h], port:[w,h] }.
 *
 * Usage : node tools/gen-prologue.mjs [--set=prologue|ending] [--only=1,3] [--force] [--concurrency=4] [--frames=12]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',').map(Number) : null;
const FRAMES = Number(args.frames || 12), CONC = Number(args.concurrency || 4), FPS = 6;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = process.env.PIXELLAB_API_KEY || (() => { const p = resolve(GAME, '..', 'pixel-art', 'config.js'); return existsSync(p) ? (readFileSync(p, 'utf8').match(/PIXELLAB_API_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1] : null; })();

const STYLE = '16-bit pixel art illustration, ancient China mythology, rich warm colors, dramatic lighting, wide cinematic scene, no text';
const PROLOGUE = [
  { n: 1, scene: 'the giant sacred Fusang tree at dawn with ten small glowing golden suns sleeping among its branches, a golden three-legged crow pulling a small sun chariot across a teal and gold sky, misty hills below',
    motion: 'the golden crow flaps its wings and pulls the sun chariot slowly across the sky, the sleeping suns pulse softly, leaves sway, clouds drift' },
  { n: 2, scene: 'ten blazing suns rising together in a red-orange sky over a scorched land, a dried-up cracked riverbed, yellowed dying rice paddies, forests on fire, frightened villagers fleeing',
    motion: 'the ten suns pulse and glow, flames flicker in the forests, heat shimmers over the land, smoke drifts, villagers run' },
  { n: 3, scene: 'old Emperor Yao in imperial robes kneeling on a palace terrace with raised hands, begging the sky, above him ten laughing smiling suns with faces in a burning sky',
    motion: 'Emperor Yao raises and lowers his hands pleading, the laughing suns bob and glow, robes flutter in the hot wind' },
  { n: 4, scene: 'the divine archer Hou Yi with a golden bow standing with his wife Chang\'e in a white silver hanfu, his young disciple Fengmeng, and a small glowing vial of the elixir of immortality on a stone table, warm palace courtyard at dusk',
    motion: 'the elixir vial glows and sparkles pulsing, robes and ribbons flutter, Hou Yi lifts his bow slightly, lantern light flickers' },
  { n: 5, scene: 'the archer Hou Yi seen from behind walking on a path through dry withered rice paddies toward a small village on the horizon, nine suns burning in a red sky, golden bow on his back, red scarf blowing',
    motion: 'Hou Yi walks forward along the path, his red scarf flutters, heat haze shimmers, the suns glow, dust blows' }
];
const ENDING = [
  { n: 1, scene: 'the steep Moon Peak mountain at twilight, a lone archer hero Hou Yi climbing the rocky stairs toward the summit, a single last sun setting behind the hills, first stars appearing in a teal and gold sky',
    motion: 'Hou Yi climbs upward step by step, his cloak flutters, the setting sun glows, stars twinkle, clouds drift' },
  { n: 2, scene: 'a stone altar at the summit of a mountain at night, the archer Hou Yi kneeling and placing round golden mooncakes and burning incense as an offering, a huge full moon rising behind, warm candle light',
    motion: 'incense smoke curls upward, candle flames flicker, Hou Yi bows and places a mooncake, the moon glows brighter' },
  { n: 3, scene: 'a gigantic glowing full moon filling the sky with the silhouette of the moon goddess Change in a white and silver hanfu waving her long sleeve with flowing ribbons, a small archer Hou Yi looking up from the mountain peak, golden pollen falling',
    motion: 'Change waves her long sleeve gracefully, ribbons float, the moon halo pulses, golden pollen drifts down, Hou Yi raises his hand' },
  { n: 4, scene: 'a peaceful valley village on an autumn festival night, many glowing red and gold paper lanterns floating up into the sky toward a huge full moon, lit houses, mid-autumn festival, serene and joyful',
    motion: 'paper lanterns float slowly upward, house windows flicker warm light, the moon glows, stars twinkle' }
];
// Duel de mi-parcours contre Fengmeng (gorges du Volcan) : l'archer jaloux, revenu du Kunlun, tient le défilé.
const FENGMENG = [
  { n: 1, scene: 'a young archer Fengmeng in dark red and black armor standing alone on a high rocky ridge at dusk, looking down with bitter jealous eyes at a distant campfire in a valley, ash and ember sky, distant snowy Kunlun mountains',
    motion: 'his scarf and cloak flutter in the wind, embers drift upward, the distant campfire flickers, his shoulders tremble with anger' },
  { n: 2, scene: 'the dark archer Fengmeng drawing a bow with a burning crimson fire arrow aimed at the sky, red lightning and flames swirling around him, a vision of the gentle Queen Mother of the West laughing in the clouds behind',
    motion: 'the fire arrow burns and crackles, flames swirl around him, the bow string tightens and trembles, red sparks fly, clouds churn' },
  { n: 3, scene: 'a narrow volcanic mountain pass between two cliffs with glowing lava rivers, a lone archer silhouette Fengmeng blocking the path with his bow, red smoke and burning sky, black basalt rocks',
    motion: 'lava flows and bubbles, smoke rises, embers float, the archer shifts his stance and tightens his grip on the bow' },
  { n: 4, scene: 'two archers facing each other across a volcanic gorge, master Hou Yi with a golden bow in red and gold and his disciple Fengmeng in dark crimson, both drawing arrows, lava glowing below, tense dramatic duel, sparks',
    motion: 'both archers draw their bows tighter, arrow tips glow, lava glows pulsing, embers and sparks fly between them, cloaks flutter' }
];
const SETS = { prologue: PROLOGUE, ending: ENDING, fengmeng: FENGMENG };
const SET = String(args.set || 'prologue');
const SCENES = SETS[SET];
const OUT = join(GAME, 'sprites', SET);
const INDEX = join(OUT, 'index.json');
const ORI = { land: [256, 144], port: [144, 256] };

async function api(url, init = {}, retries = 5) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  if ((res.status === 429 || res.status >= 500) && retries > 0) { await sleep(8000 + Math.random() * 5000); return api(url, init, retries - 1); }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(await res.json().catch(() => ({}))).slice(0, 300)}`);
  return res.json();
}
const b64 = img => (typeof img === 'string' ? img : img?.base64 ?? img?.image?.base64);

async function keyFrame(scene, [w, h]) {
  const d = await api('https://api.pixellab.ai/v1/generate-image-pixflux', { method: 'POST', body: JSON.stringify({
    description: `${STYLE}, ${scene}`, negative_description: 'text, letters, watermark, blurry, photo, 3d render', image_size: { width: w, height: h },
    outline: 'lineless', shading: 'detailed shading', detail: 'highly detailed', no_background: false }) });
  if (!d.image?.base64) throw new Error('image clé absente');
  return d.image.base64;
}
async function animate(frame, motion) {
  const job = await api('https://api.pixellab.ai/v2/animate-pixminimax', { method: 'POST', body: JSON.stringify({
    first_frame: { type: 'base64', base64: frame, format: 'png' }, description: motion, frame_count: FRAMES, no_background: false, enhance_prompt: true, subject_description: 'a pixel art painted scene' }) });
  for (let i = 0; i < 150; i++) {
    await sleep(4000);
    const st = await api(`https://api.pixellab.ai/v2/background-jobs/${job.background_job_id}`, { method: 'GET' });
    if (st.status === 'completed') return (st.last_response?.images || []).map(b64).filter(Boolean);
    if (st.status === 'failed') throw new Error('animation échouée');
  }
  throw new Error('délai dépassé');
}
function strip(frames, [w, h]) {
  const pngs = frames.map(b => PNG.sync.read(Buffer.from(b, 'base64'))), out = new PNG({ width: w * pngs.length, height: h });
  pngs.forEach((p, i) => PNG.bitblt(p, out, 0, 0, Math.min(p.width, w), Math.min(p.height, h), i * w, 0));
  return PNG.sync.write(out);
}

mkdirSync(OUT, { recursive: true });
const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : {};
const jobs = SCENES.filter(s => !ONLY || ONLY.includes(s.n)).flatMap(s => Object.keys(ORI).map(o => ({ s, o })))
  .filter(({ s, o }) => args.force || !existsSync(join(OUT, `${s.n}-${o}.png`)));
console.log(`${jobs.length} animation(s) de prologue`);
let ok = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (jobs.length) {
    const { s, o } = jobs.shift();
    try {
      const first = await keyFrame(s.scene, ORI[o]);
      const frames = await animate(first, s.motion);
      writeFileSync(join(OUT, `${s.n}-${o}.png`), strip(frames, ORI[o]));
      const cur = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : {};
      cur[`${s.n}-${o}`] = { frames: frames.length, fps: FPS, size: ORI[o] };
      writeFileSync(INDEX, JSON.stringify(cur, null, 2) + '\n');
      ok++; console.log(`OK  ${s.n}-${o} (${frames.length} images)`);
    } catch (e) { console.log(`ERR ${s.n}-${o}: ${e.message}`); }
  }
}));
console.log(`Terminé : ${ok}`);

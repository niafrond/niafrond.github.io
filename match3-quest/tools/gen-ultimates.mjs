#!/usr/bin/env node
/**
 * gen-ultimates.mjs — Génère avec Pixel Lab les 4 plans (portrait 144×256) de chaque cinématique d'ultime, façon invocation FF9.
 * Pour chaque plan : décor clé (PixFlux, opaque) puis boucle animée (PixMiniMax, 12 images) assemblée en planche horizontale.
 * Sortie : sprites/ultimates/<id>-<plan>.png + sprites/ultimates/index.json { "<id>-<plan>": { frames, fps, size } }.
 *
 * Usage : node tools/gen-ultimates.mjs [--only=ultimateImperialDragon,...] [--force] [--concurrency=4] [--frames=12]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const FRAMES = Number(args.frames || 12), CONC = Number(args.concurrency || 4), FPS = 6;
const SIZE = [144, 256];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = process.env.PIXELLAB_API_KEY || (() => { const p = resolve(GAME, '..', 'pixel-art', 'config.js'); return existsSync(p) ? (readFileSync(p, 'utf8').match(/PIXELLAB_API_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1] : null; })();

const STYLE = '16-bit pixel art illustration, ancient China mythology, epic Final Fantasy IX summon cutscene, vertical composition, dramatic lighting, rich saturated colors, no text';

// 4 plans par ultimate : 1 incantation, 2 apparition de l'entité, 3 attaque signature, 4 impact.
export const ULTIMATES = {
  ultimateFiveElements: [
    ['a Chinese sorcerer in flowing robes from behind, arms raised, a huge glowing circle of five colored runes (red fire, blue water, green wood, yellow earth, white metal) spinning on the ground, dark night sky', 'the rune circle spins faster, five colored lights rise and orbit the sorcerer, robes flutter'],
    ['five colossal elemental spirits towering in a vertical column filling the whole sky: a fire phoenix, a water serpent, a wood tree giant, an earth golem, a metal tiger, swirling cosmic clouds', 'the five spirits glow and swirl together, energy crackles, clouds churn'],
    ['five beams of red, blue, green, yellow and white light converging downward into a single blinding point of power, spiral energy, speed lines', 'the beams spiral and tighten downward, sparks fly, the light intensifies'],
    ['a gigantic elemental explosion crater viewed from above, rainbow shockwave rings, flying debris, blinding light at center', 'the shockwave expands outward, debris flies, colors flash']
  ],
  ultimateHeavenlyThunder: [
    ['a Chinese sorcerer on a mountain peak at night pointing a jade staff at the sky, dark purple storm clouds gathering, wind whipping robes', 'clouds spiral and darken, lightning flickers, robes whip in the wind'],
    ['the Heavenly Tribunal in the clouds: a colossal thunder god with drum ring and lightning hammer, glowing yellow eyes, huge storm vortex filling the sky', 'the thunder god raises his hammer, the vortex rotates, lightning crackles around him'],
    ['a giant column of golden-purple lightning bolts descending from the heavens in a vertical shot, jagged forks, blinding white core', 'lightning bolts flash and fork downward, the core pulses, sparks spray'],
    ['a scorched ground struck by a massive lightning bolt, white shockwave, electric arcs, smoke and glowing cracks', 'electric arcs dance, smoke rises, cracks glow and pulse']
  ],
  ultimateThousandArrows: [
    ['a Chinese archer assassin from behind drawing a huge bow toward a dark red sky, wind blowing his cloak, a golden glowing arrow on the string', 'the archer draws the string tighter, cloak flutters, the arrow glows brighter'],
    ['the sky split open as a thousand glowing golden arrows materialize in a massive vertical wall of arrows hanging in the air, red and gold clouds', 'the arrows shimmer and tremble in formation, light rays sweep across'],
    ['a thousand golden arrows raining down at high speed in a vertical dense storm, motion streaks, sparks', 'arrows streak downward fast, motion blur, sparks fly'],
    ['a field covered by thousands of golden arrows stuck in the ground, dust cloud, golden light shockwave', 'dust billows, golden sparks float, light pulses']
  ],
  ultimateSunPiercer: [
    ['the divine archer Hou Yi with a legendary golden bow on a cliff at dawn, aiming up at a giant blazing sun filling the top of the sky, red scarf blowing', 'the scarf and cloak blow, the sun pulses, the arrow tip glows gold'],
    ['a colossal blazing sun with a screaming face and three-legged golden crow, scorching red-orange sky, heat distortion, filling the whole screen', 'the sun flares and pulses, flames lick outward, the crow flaps its wings'],
    ['a single enormous golden spiraling arrow of light shooting upward piercing through clouds toward the sun, shockwave rings, speed lines', 'the arrow spins and surges upward, shockwave rings expand, clouds part'],
    ['the giant sun cracking and exploding into golden shards and fire, a blinding white burst, falling feathers of light', 'the sun shatters, shards fly outward, light flashes, feathers drift']
  ],
  ultimateImperialDragon: [
    ['an ancient Chinese imperial general (wujiang) in lacquered lamellar armor with a horsehair-plumed helmet raising a straight jian sword to the sky, a glowing golden dragon sigil circle on the ground, Chinese palace pagoda silhouette, stormy gold sky', 'the sigil circle spins, golden light rises along the sword, silk banners flutter'],
    ['a colossal golden Chinese imperial dragon coiling through clouds filling the whole vertical screen, glowing eyes, flowing whiskers, jade and gold scales, emperor palace far below', 'the dragon coils and flows through the clouds, whiskers undulate, scales shimmer'],
    ['the golden imperial dragon diving straight at the viewer with open roaring mouth full of golden fire, clouds ripped apart, speed lines', 'the dragon surges forward roaring, golden fire builds, clouds rip apart'],
    ['a huge golden fire explosion shaped like a dragon head, shockwave, burning embers, sacred golden light healing glow', 'fire and embers swirl, shockwave expands, golden light pulses']
  ],
  ultimateEternalBastion: [
    ['an ancient Chinese imperial general (wujiang) in lacquered lamellar armor kneeling and planting a great round bronze-and-jade shield in the ground, blue-green Chinese seal-script runes glowing around him, Chinese watchtower at dusk', 'runes pulse around the general, the shield glows, his silk sash flutters'],
    ['a colossal ethereal Great Wall of glowing jade and blue light rising from the earth into the sky with giant guardian statues and watchtowers, vertical view', 'the wall grows upward, the statues glow, light motes rise'],
    ['a massive translucent blue-green barrier dome shield forming with hexagonal runes and rippling energy, golden sparks deflecting', 'runes ripple across the dome, energy pulses, sparks bounce off'],
    ['a shockwave of holy jade light blasting outward from a glowing shield, rings of energy, healing sparkles floating up', 'rings expand outward, sparkles float up, light pulses']
  ],
  ultimateThousandRiders: [
    ['an ancient Chinese northern steppe warrior chieftain (Xiongnu style) with a fur-trimmed hanfu coat, braided hair and a huge red Chinese war banner on a hilltop at sunset, raising a dao saber, dusty steppe horizon near the Great Wall, red sky', 'the banner flaps wildly, the coat whips, dust blows'],
    ['a vast horde of a thousand ancient Chinese steppe cavalrymen in lamellar armor with red silk banners galloping over the horizon toward the viewer, a Great Wall watchtower in the distance, huge dust cloud, red setting sun, vertical depth', 'the riders gallop, banners flutter, dust billows'],
    ['a giant ghostly red warhorse with a Chinese bronze war mask leading a thunderous cavalry charge straight at the viewer, hooves striking sparks, dust and speed lines', 'hooves pound, sparks fly, dust surges, banners whip'],
    ['a trampled battlefield with an enormous shockwave of dust and red energy, flying Chinese pennants and broken halberds, blinding impact', 'the dust cloud expands, pennants fly, red energy pulses']
  ],
  ultimateSkyWolf: [
    ['a barbarian shaman with wolf pelt and bone staff on a snowy mountain top at night, howling at a huge full moon, purple aurora', 'the pelt flutters, breath steams, the aurora ripples, the moon glows'],
    ['a colossal celestial blue-white spirit wolf made of stars and aurora standing in the night sky, glowing eyes, constellations in its fur, filling the vertical screen', 'the star wolf breathes, constellations twinkle in its fur, aurora swirls'],
    ['the celestial wolf howling with head thrown back, shockwave rings of purple-blue sound waves spreading across the sky, stars shaking', 'sound rings expand, stars tremble, the wolf howls'],
    ['a huge purple-blue shockwave of spirit energy crashing on a snowy plain, stars falling, wolf-shaped glow, snow blown by the blast', 'the shockwave rolls out, snow blows, stars fall']
  ]
};

// « Bible » visuelle de chaque ultime, ajoutée à tous ses plans : même héros, même palette, même lumière (cohérence).
// Le plan 1 est généré en premier ; son image sert ensuite de palette imposée (`color_image`) aux plans 2 à 4.
const BIBLES = {
  ultimateFiveElements: 'recurring hero: the same Chinese sorcerer in white and teal robes with a jade staff; palette: deep indigo night with five accent colors red, blue, green, gold and white; mystical twilight lighting',
  ultimateHeavenlyThunder: 'recurring hero: the same Chinese sorcerer in deep violet robes with a jade staff; palette: dark purple storm, electric gold and white lightning; stormy night lighting',
  ultimateThousandArrows: 'recurring hero: the same Chinese assassin archer in a dark red hooded cloak with a golden bow; palette: crimson sky, black silhouettes, bright gold arrows; dusk lighting',
  ultimateSunPiercer: 'recurring hero: the same divine archer Hou Yi with a red scarf and a golden bow; palette: blazing orange, red and gold on deep crimson; fiery dawn lighting',
  ultimateImperialDragon: 'recurring hero: the same ancient Chinese imperial general in golden lacquered lamellar armor with a jian sword; palette: gold, jade green and deep crimson; stormy golden sky lighting',
  ultimateEternalBastion: 'recurring hero: the same ancient Chinese imperial general in jade-green lacquered lamellar armor with a great round shield; palette: teal, jade and pale gold on deep blue; dusk lighting',
  ultimateThousandRiders: 'recurring hero: the same ancient Chinese steppe warrior chieftain in a fur-trimmed coat with a dao saber and a red war banner; palette: red, rust orange and dust brown; sunset lighting',
  ultimateSkyWolf: 'recurring hero: the same barbarian shaman in a wolf pelt with a bone staff; palette: deep blue, violet, ice white and starlight; cold moonlit lighting'
};
const seedOf = id => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000000;

async function api(url, init = {}, retries = 5) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  if ((res.status === 429 || res.status >= 500) && retries > 0) { await sleep(8000 + Math.random() * 5000); return api(url, init, retries - 1); }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(await res.json().catch(() => ({}))).slice(0, 300)}`);
  return res.json();
}
const b64 = img => (typeof img === 'string' ? img : img?.base64 ?? img?.image?.base64);

async function keyFrame(id, scene, palette) {
  const d = await api('https://api.pixellab.ai/v1/generate-image-pixflux', { method: 'POST', body: JSON.stringify({
    description: `${STYLE}, ${BIBLES[id]}, ${scene}`, negative_description: 'text, letters, watermark, blurry, photo, 3d render, european medieval knight, crusader, templar, plate armor, visored helmet, cross emblem, western castle, viking', image_size: { width: SIZE[0], height: SIZE[1] },
    outline: 'lineless', shading: 'detailed shading', detail: 'highly detailed', no_background: false, seed: seedOf(id),
    ...(palette ? { color_image: { type: 'base64', base64: palette, format: 'png' } } : {}) }) });
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

const OUT = join(GAME, 'sprites', 'ultimates');
const INDEX = join(OUT, 'index.json');
mkdirSync(OUT, { recursive: true });
const sheetPath = (id, n) => join(OUT, `${id}-${n}.png`);
// Première image d'une planche déjà générée (palette de référence du plan 1).
const firstFrame = file => { const p = PNG.sync.read(readFileSync(file)), o = new PNG({ width: SIZE[0], height: SIZE[1] }); PNG.bitblt(p, o, 0, 0, SIZE[0], SIZE[1], 0, 0); return PNG.sync.write(o).toString('base64'); };

// Un plan : image clé (palette du plan 1 si fournie) puis animation ; renvoie l'image clé.
async function makePlan(id, n, scene, motion, palette) {
  const key = await keyFrame(id, scene, palette);
  const frames = await animate(key, motion);
  writeFileSync(sheetPath(id, n), strip(frames, SIZE));
  const cur = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : {};
  cur[`${id}-${n}`] = { frames: frames.length, fps: FPS, size: SIZE };
  writeFileSync(INDEX, JSON.stringify(cur, null, 2) + '\n');
  console.log(`OK  ${id}-${n} (${frames.length} images)`);
  return key;
}

const todo = Object.entries(ULTIMATES).filter(([id]) => !ONLY || ONLY.includes(id))
  .map(([id, plans]) => ({ id, plans, missing: plans.map((_, i) => i + 1).filter(n => args.force || !existsSync(sheetPath(id, n))) }))
  .filter(u => u.missing.length);
console.log(`${todo.reduce((s, u) => s + u.missing.length, 0)} plan(s) d'ultime`);
let ok = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (todo.length) {
    const { id, plans, missing } = todo.shift();
    try {
      // plan 1 d'abord : il fixe la palette des trois autres
      let palette = null;
      if (missing.includes(1)) { palette = await makePlan(id, 1, ...plans[0], null); ok++; }
      else if (existsSync(sheetPath(id, 1))) palette = firstFrame(sheetPath(id, 1));
      await Promise.all(missing.filter(n => n !== 1).map(async n => { await makePlan(id, n, ...plans[n - 1], palette); ok++; }));
    } catch (e) { console.log(`ERR ${id}: ${e.message}`); }
  }
}));
console.log(`Terminé : ${ok}`);

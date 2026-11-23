#!/usr/bin/env node
/**
 * gen-fountain-pixellab.mjs — Génère le sprite de la fontaine de jade (point de repos des routes, explorationRest.js) via Pixel Lab (PixFlux).
 * Clé `fountain_jade` dans sprites/generated.js (face seule). Usage : node tools/gen-fountain-pixellab.mjs [--size=64] [--seed=n] [--key=…] [--dry-run]
 * Clé : --key, env PIXELLAB_API_KEY ou .env.local (racine du dépôt). Puis : node sprites/build-gba.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const SIZE = Number(args.size || 64);
const KEY = 'fountain_jade';
const GENERATED = join(GAME, 'sprites', 'generated.js'), PNG_DIR = join(GAME, 'sprites', 'png');
const DESC = 'pixel art ancient Chinese stone fountain, round carved grey stone basin filled with clear blue water, small central pillar with a jade green dragon head spouting a sparkling arc of water, jade green ornaments, water splashes, GBA RPG map object, clean bold dark outline, flat cel shading, limited color palette, transparent background, pixel perfect, no anti-aliasing, no gradients, object only, no character';
const NEG = 'blurry, text, watermark, person, character, ground, grass, background scenery, photo, realistic, 3d render, anti-aliasing, gradient';

if (args['dry-run']) { console.log(DESC); process.exit(0); }
function apiKey() {
    if (args.key) return args.key;
    if (process.env.PIXELLAB_API_KEY) return process.env.PIXELLAB_API_KEY;
    const f = join(GAME, '..', '.env.local');
    if (existsSync(f)) { const m = readFileSync(f, 'utf8').match(/^\s*PIXELLAB_API_KEY\s*=\s*['"]?([^'"\r\n]+)['"]?\s*$/m); if (m) return m[1]; }
    return null;
}
const key = apiKey();
if (!key) { console.error('Clé Pixel Lab introuvable'); process.exit(1); }
const body = { description: DESC, negative_description: NEG, image_size: { width: SIZE, height: SIZE }, outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail', view: 'low top-down', direction: 'south', no_background: true };
if (args.seed) body.seed = Number(args.seed);
const res = await fetch('https://api.pixellab.ai/v1/generate-image-pixflux', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const data = await res.json().catch(() => ({}));
if (!res.ok || !data.image?.base64) { console.error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`); process.exit(1); }
const b64 = data.image.base64;
mkdirSync(PNG_DIR, { recursive: true });
writeFileSync(join(PNG_DIR, `${KEY}_front.png`), Buffer.from(b64, 'base64'));
const src = readFileSync(GENERATED, 'utf8');
const sprites = Function(`return ${src.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/)[1]}`)();
sprites[KEY] = { front: `data:image/png;base64,${b64}` };
const lines = ['// Généré par houyi/tools/gen-sprites.mjs — ne pas éditer à la main', `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`, '// Lancez: node houyi/tools/gen-sprites.mjs --only=all --dir=all', 'export const GBA_SPRITES = {'];
for (const [k, dirs] of Object.entries(sprites)) { lines.push(`  ${JSON.stringify(k)}: {`); for (const [d, uri] of Object.entries(dirs)) lines.push(`    ${d}: ${JSON.stringify(uri)},`); lines.push('  },'); }
lines.push('};');
writeFileSync(GENERATED, lines.join('\n') + '\n', 'utf8');
console.log(`✓ ${KEY} (${SIZE}px) → sprites/png/${KEY}_front.png`);

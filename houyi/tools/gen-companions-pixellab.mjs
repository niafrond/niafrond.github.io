#!/usr/bin/env node
/**
 * gen-companions-pixellab.mjs — Redessine les compagnons de route (`companion_<id>`, companions.js) via Pixel Lab (PixFlux).
 * Une seule image de face (direction south) : pas de dos, de profil ni de cycle de marche (l'exploration retombe sur la face :
 * `gbaSprite(clé, dir)` renvoie `front` si la direction manque). Remplace l'entrée entière dans sprites/generated.js.
 *
 * Usage : node tools/gen-companions-pixellab.mjs [--only=xiao_gui,zhi] [--size=64] [--key=…] [--dry-run]
 * Clé : --key, env PIXELLAB_API_KEY ou .env.local (racine du dépôt). Puis : node sprites/build-gba.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { OVERRIDES } from './sprite-overrides.mjs';
import { NEGATIVE_PROMPT } from './sprite-prompts.js';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const SIZE = Number(args.size || 64);
const GENERATED = join(GAME, 'sprites', 'generated.js'), PNG_DIR = join(GAME, 'sprites', 'png');

function apiKey() {
    if (args.key) return args.key;
    if (process.env.PIXELLAB_API_KEY) return process.env.PIXELLAB_API_KEY;
    const f = join(GAME, '..', '.env.local');
    if (existsSync(f)) { const m = readFileSync(f, 'utf8').match(/^\s*PIXELLAB_API_KEY\s*=\s*['"]?([^'"\r\n]+)['"]?\s*$/m); if (m) return m[1]; }
    return null;
}

const rows = OVERRIDES.filter(o => o[0].startsWith('companion_') && (!ONLY || ONLY.includes(o[0].slice(10))));
const STYLE = 'GBA pixel art RPG sprite, ancient Chinese mythological world, chibi full-body character, clean bold dark outline, flat cel shading, limited color palette, transparent background, pixel perfect, no anti-aliasing, no gradients, neutral idle pose, whole body visible, facing the viewer, front view';
const promptOf = ([, , , , , , , desc]) => `pixel art sprite, ${desc.replace(/, side profile shows[^,]*(,[^,]*)?/i, '')}, ${STYLE}`;

if (args['dry-run']) { for (const r of rows) console.log(`[${r[0]}] ${promptOf(r)}\n`); process.exit(0); }
const key = apiKey();
if (!key) { console.error('Clé Pixel Lab introuvable'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function pixflux(description, retries = 5) {
    const res = await fetch('https://api.pixellab.ai/v1/generate-image-pixflux', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, negative_description: NEGATIVE_PROMPT + ', side view, back view, multiple characters', image_size: { width: SIZE, height: SIZE },
            outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail', view: 'low top-down', direction: 'south', no_background: true })
    });
    if (res.status === 429 && retries) { await sleep(10000); return pixflux(description, retries - 1); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.image?.base64) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return data.image.base64;
}

const src = readFileSync(GENERATED, 'utf8');
const sprites = Function(`return ${src.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/)[1]}`)();
mkdirSync(PNG_DIR, { recursive: true });
for (const r of rows) {
    process.stdout.write(`[${r[0]}] PixFlux ${SIZE}px ... `);
    try {
        const b64 = await pixflux(promptOf(r));
        sprites[r[0]] = { front: `data:image/png;base64,${b64}` };
        writeFileSync(join(PNG_DIR, `${r[0]}_front.png`), Buffer.from(b64, 'base64'));
        console.log('✓');
    } catch (e) { console.log(`✗ ${e.message}`); }
    await sleep(2500);
}
const lines = ['// Généré par houyi/tools/gen-sprites.mjs — ne pas éditer à la main', `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`, '// Lancez: node houyi/tools/gen-sprites.mjs --only=all --dir=all', 'export const GBA_SPRITES = {'];
for (const [k, dirs] of Object.entries(sprites)) { lines.push(`  ${JSON.stringify(k)}: {`); for (const [d, uri] of Object.entries(dirs)) lines.push(`    ${d}: ${JSON.stringify(uri)},`); lines.push('  },'); }
lines.push('};');
writeFileSync(GENERATED, lines.join('\n') + '\n', 'utf8');

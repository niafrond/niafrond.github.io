#!/usr/bin/env node
/**
 * gen-attack-frames.mjs — Animation d'attaque procédurale (8 images `attack_0…7`) pour les sprites générés en local, qui n'ont que leurs
 * 4 directions (gen-sprites-gm.mjs ; les animations d'origine viennent de Pixel Lab, payant, voir gen-attacks.mjs).
 *
 * Part du sprite de profil gauche (tourné vers Hou Yi, à gauche à l'écran ; sinon de face) et le fait « charger » : recul et écrasement
 * (préparation), fente vers l'avant avec étirement (frappe), maintien, retour. Pixels nets (plus proche voisin), pivot au bas du sprite.
 * Écrit les images dans sprites/generated.js (même format que gen-sprites.mjs) — les fichiers ne sont réécrits qu'une fois pour toutes.
 *
 * Usage (WSL, Node 22) : node tools/gen-attack-frames.mjs [--only=a,b] [--force]
 * Par défaut : les ennemis nommés (sprite-prompts-named.js), l'Assassin Masqué, et les ennemis des Hautes-Eaux, sans animation d'attaque.
 */
import { readFileSync, writeFileSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';
import { NAMED_ENEMIES } from './sprite-prompts-named.js';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const GENERATED = join(GAME, 'sprites', 'generated.js');

// Image : décalage horizontal (en 32es de sprite ; négatif = vers l'avant, à gauche), écrasement vertical, étirement horizontal
const FRAMES = [
    { dx: 0, sy: 1, sx: 1 },
    { dx: 1, sy: 0.95, sx: 1.03 },
    { dx: 2, sy: 0.9, sx: 1.06 },
    { dx: -3, sy: 1.04, sx: 0.96 },
    { dx: -6, sy: 1.08, sx: 1.1 },
    { dx: -5, sy: 1.05, sx: 1.06 },
    { dx: -2, sy: 1, sx: 1.02 },
    { dx: 0, sy: 1, sx: 1 }
];

function loadGenerated() {
    const m = readFileSync(GENERATED, 'utf8').match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);
    return Function(`return ${m[1]}`)();
}
function saveGenerated(sprites) {
    const lines = ['// Généré par match3-quest/tools/gen-sprites.mjs — ne pas éditer à la main', `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`,
        '// Lancez: node match3-quest/tools/gen-sprites.mjs --only=all --dir=all', 'export const GBA_SPRITES = {'];
    for (const [key, dirs] of Object.entries(sprites)) {
        lines.push(`  ${JSON.stringify(key)}: {`);
        for (const [dir, uri] of Object.entries(dirs)) lines.push(`    ${dir}: ${JSON.stringify(uri)},`);
        lines.push('  },');
    }
    lines.push('};');
    writeFileSync(GENERATED + '.tmp', lines.join('\n') + '\n', 'utf8');
    renameSync(GENERATED + '.tmp', GENERATED);
}
const decode = uri => PNG.sync.read(Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64'));
const encode = png => 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');

// Transforme le sprite autour de son pivot (centre bas), au plus proche voisin
function transform(src, { dx, sy, sx }) {
    const { width: w, height: h } = src;
    const out = new PNG({ width: w, height: h });
    const shift = Math.round(dx * w / 32), cx = w / 2, bottom = h - 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const srcX = Math.floor((x - shift - cx) / sx + cx), srcY = Math.floor(bottom - (bottom - y) / sy);
        if (srcX < 0 || srcX >= w || srcY < 0 || srcY >= h) continue;
        const s = (srcY * w + srcX) * 4, d = (y * w + x) * 4;
        for (let k = 0; k < 4; k++) out.data[d + k] = src.data[s + k];
    }
    return out;
}

const sprites = loadGenerated();
const ids = args.only ? String(args.only).split(',') : [...Object.keys(NAMED_ENEMIES), 'assassin_masque'];
let done = 0;
for (const id of ids) {
    const s = sprites[id];
    const base = s?.left || s?.front;
    if (!base) { console.log(`ABSENT ${id} (pas de sprite)`); continue; }
    if (s.attack_0 && !args.force) continue;
    const src = decode(base);
    FRAMES.forEach((f, i) => { s[`attack_${i}`] = encode(transform(src, f)); });
    done++;
    console.log(`OK ${id} (${src.width}×${src.height}, ${FRAMES.length} images)`);
}
saveGenerated(sprites);
console.log(`${done} animation(s) écrite(s)`);

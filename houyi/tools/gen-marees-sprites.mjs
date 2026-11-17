#!/usr/bin/env node
/**
 * gen-marees-sprites.mjs — Dessins de carte (PNG data URI) des ennemis des Hautes-Eaux : paquet `marees` (sprites/cn/marees.js).
 * Lit l'image de face générée par tools/gen-sprites-gm.mjs (sprites/png/<id>_front.png), la rend telle quelle (pixel art, sans
 * flou) et l'écrit sous la clé du gabarit : les écrans de carte et de combat n'ont ainsi qu'un seul chemin de dessin (comme le paquet `legends`).
 * Puis : node sprites/build-packs.mjs   (met à jour l'index sprites/packs.js).
 * Usage : node tools/gen-marees-sprites.mjs [id,id,…]
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IDS = (process.argv[2] ? process.argv[2].split(',') : ['shuimu_denglong', 'baoyu_jian', 'lu_ci_gui', 'hai_ma_xing', 'changxi', 'hai_gui', 'hai_she', 'ren_yu']);
const lines = ['// Dessins de carte des ennemis des Hautes-Eaux (world/maps/marees.js).',
    '// Fichier généré par tools/gen-marees-sprites.mjs (PNG pixel art issus de gen-sprites-gm.mjs) — ne pas modifier à la main.',
    'export const MAREES_SPRITES = {'];
for (const id of IDS) {
    const png = readFileSync(join(GAME, 'sprites', 'png', `${id}_front.png`));
    lines.push(`  ${id}: 'data:image/png;base64,${png.toString('base64')}',`);
    console.log(`${id} (${Math.round(png.length / 1024 * 10) / 10} Ko)`);
}
lines.push('};\n');
writeFileSync(join(GAME, 'sprites', 'cn', 'marees.js'), lines.join('\n'));
console.log('sprites/cn/marees.js écrit');

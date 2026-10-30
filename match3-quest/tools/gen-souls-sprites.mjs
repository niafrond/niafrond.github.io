#!/usr/bin/env node
/**
 * gen-souls-sprites.mjs — Dessins de carte (PNG data URI) des ennemis de l'événement « La Nuit des âmes errantes » : paquet `souls` (sprites/cn/souls.js).
 * Lit l'image de face générée par tools/gen-sprites-gm.mjs (sprites/png/<id>_front.png), la rend telle quelle (pixel art, sans
 * flou) et l'écrit sous la clé du gabarit : les écrans de carte et de combat n'ont ainsi qu'un seul chemin de dessin (comme le paquet `legends`).
 * Puis : node sprites/build-packs.mjs   (met à jour l'index sprites/packs.js).
 * Usage : node tools/gen-souls-sprites.mjs [id,id,…]
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Trois ennemis propres à l'événement (64×64), puis les gabarits des terrains agrandis (Wuchang, fantômes) qui n'avaient pas de dessin de carte.
const IDS = (process.argv[2] ? process.argv[2].split(',') : ['ws_gardien_jugement', 'ws_jiangshi_patrouille', 'ws_huli_jing', 'heibai_wuchang', 'yuan_gui', 'nu_gui', 'diaosi_gui', 'shui_gui', 'mu_gui', 'wangliang']);
const lines = ['// Dessins de carte des ennemis du royaume des âmes errantes (events/wanderingSouls/).',
    '// Fichier généré par tools/gen-souls-sprites.mjs (PNG pixel art issus de gen-sprites-gm.mjs) — ne pas modifier à la main.',
    'export const SOULS_SPRITES = {'];
for (const id of IDS) {
    const png = readFileSync(join(GAME, 'sprites', 'png', `${id}_front.png`));
    lines.push(`  ${id}: 'data:image/png;base64,${png.toString('base64')}',`);
    console.log(`${id} (${Math.round(png.length / 1024 * 10) / 10} Ko)`);
}
lines.push('};\n');
writeFileSync(join(GAME, 'sprites', 'cn', 'souls.js'), lines.join('\n'));
console.log('sprites/cn/souls.js écrit');

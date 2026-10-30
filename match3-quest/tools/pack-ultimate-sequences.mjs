#!/usr/bin/env node
/**
 * pack-ultimate-sequences.mjs — Range les plans-séquences terminés des ultimes (sprites/ultimates-seq/<id>/px/fNNNN.png, 144×256)
 * en UNE planche en grille `sprites/ultimates/<id>-seq.png` et déclare `<id>-seq` dans sprites/ultimates/index.json
 * ({ frames, fps, size, cols }) : lue par `loadSequence` (ultimateCinematics.js), qui joue la séquence à la place des 4 plans.
 * Traite aussi les intros de biome (`biome_<région>`, tools/gen-biome-intros.py). Ne retient que les séquences terminées (px/preview.gif présent, comme gen-all-ultimate-sequences.py).
 *
 * Usage (WSL, Node 22) : node tools/pack-ultimate-sequences.mjs [--only=ultimateFiveElements,…] [--fps=24] [--cols=16]
 * Après un changement de planches : incrémenter ULTIMATE_ART_VERSION (ultimateCinematics.js).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const FPS = Number(args.fps || 24), COLS = Number(args.cols || 16), MAX_SIDE = 16384;
const IDS = ['ultimateFiveElements', 'ultimateHeavenlyThunder', 'ultimateThousandArrows', 'ultimateSunPiercer', 'ultimateImperialDragon',
  'ultimateEternalBastion', 'ultimateThousandRiders', 'ultimateSkyWolf',
  // ultimes de légende (Quatre Gardiens Célestes)
  'ultimateVermilionBird', 'ultimateBlackTortoise', 'ultimateWhiteTiger', 'ultimateAzureDragon',
  // mini-animations d'arrivée dans un biome (tools/gen-biome-intros.py) : `biome_<région>`
  ...['rizieres', 'volcan', 'gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang', 'lune', 'wandering_souls'].map(r => `biome_${r}`),
  // boucles des écrans de fin de combat (tools/gen-combat-end.py) : `combatend_<issue>`
  'combatend_victory', 'combatend_defeat'];

const indexPath = join(GAME, 'sprites', 'ultimates', 'index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
let packed = 0;
for (const id of IDS) {
  if (ONLY && !ONLY.includes(id)) continue;
  const dir = join(GAME, 'sprites', 'ultimates-seq', id, 'px');
  if (!existsSync(join(dir, 'preview.gif'))) { console.log(`SKIP ${id} : séquence non terminée`); continue; }
  const files = readdirSync(dir).filter(f => /^f\d+\.png$/.test(f)).sort();
  if (!files.length) { console.log(`SKIP ${id} : aucune image`); continue; }
  const first = PNG.sync.read(readFileSync(join(dir, files[0]))), W = first.width, H = first.height, rows = Math.ceil(files.length / COLS);
  if (W * COLS > MAX_SIDE || H * rows > MAX_SIDE) throw new Error(`${id} : planche trop grande (${W * COLS}×${H * rows})`);
  const sheet = new PNG({ width: W * COLS, height: H * rows });
  files.forEach((f, n) => {
    const p = PNG.sync.read(readFileSync(join(dir, f)));
    if (p.width !== W || p.height !== H) throw new Error(`${id}/${f} : taille ${p.width}×${p.height} ≠ ${W}×${H}`);
    PNG.bitblt(p, sheet, 0, 0, W, H, (n % COLS) * W, ((n / COLS) | 0) * H);
  });
  const out = join(GAME, 'sprites', 'ultimates', `${id}-seq.png`);
  writeFileSync(out, PNG.sync.write(sheet));
  // PNG indexé (Pillow, WSL) : les images sont déjà quantifiées (≈ 50 couleurs) → même rendu, ≈ 4× plus léger. Sans Pillow : PNG RGBA conservé.
  try {
    execFileSync('python3', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");assert len(im.getcolors(1<<24))<=256;im.quantize(colors=256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).save(sys.argv[1],optimize=True)', out]);
  } catch { console.log(`     (${id} : indexation ignorée — Pillow absent ou plus de 256 couleurs)`); }
  index[`${id}-seq`] = { frames: files.length, fps: FPS, size: [W, H], cols: COLS, ...(id.startsWith('biome_') || id.startsWith('combatend_') ? { loop: true } : {}) };   // les clips de biome et de fin de combat sont des boucles courtes
  packed++; console.log(`OK   ${id} : ${files.length} images (${(files.length / FPS).toFixed(1)} s), planche ${W * COLS}×${H * rows}, ${(statSync(out).size / 1e6).toFixed(1)} Mo`);
}
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`Terminé : ${packed} séquence(s) rangée(s)`);

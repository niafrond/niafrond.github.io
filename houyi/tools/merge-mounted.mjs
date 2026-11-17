#!/usr/bin/env node
/**
 * merge-mounted.mjs — Range les héros à cheval (tools/gen-mounted-heroes.py → sprites/ultimates-seq/horse/mounted.json) dans sprites/generated.js,
 * sous les clés `<classe>_horse` (mêmes champs que les héros : front, back, left, right, walk_<dir>_<n>). Relit generated.js au dernier moment
 * (d'autres outils y écrivent aussi). Puis : node sprites/build-gba.mjs && node tools/precache-manifest.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED = join(GAME, 'sprites', 'generated.js');
const mounted = JSON.parse(readFileSync(join(GAME, 'sprites', 'ultimates-seq', 'horse', 'mounted.json'), 'utf8'));
const gen = readFileSync(GENERATED, 'utf8');
const sprites = Function(`return ${gen.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/)[1]}`)();
Object.assign(sprites, mounted);
const lines = ['// Généré par match3-quest/tools/gen-sprites.mjs — ne pas éditer à la main', `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`,
  '// Lancez: node match3-quest/tools/gen-sprites.mjs --only=all --dir=all', 'export const GBA_SPRITES = {'];
for (const [k, dirs] of Object.entries(sprites)) { lines.push(`  ${JSON.stringify(k)}: {`); for (const [d, u] of Object.entries(dirs)) lines.push(`    ${d}: ${JSON.stringify(u)},`); lines.push('  },'); }
lines.push('};');
writeFileSync(GENERATED, lines.join('\n') + '\n', 'utf8');
console.log(`${Object.keys(mounted).length} héros à cheval rangés : ${Object.keys(mounted).join(', ')}`);

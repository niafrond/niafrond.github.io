#!/usr/bin/env node
/**
 * build-bestiary.mjs — Intègre le bestiaire (tools/bestiary-data.mjs) au jeu. Idempotent.
 *   1. enemies.catalog.json : un gabarit par créature (statistiques d'après l'archétype, résistances d'après la couleur) ;
 *   2. tools/sprite-prompts-bestiary.js : prompts Pixel Lab (lus par sprite-prompts.js → gen-sprites.mjs) ;
 *   3. world/maps/<région>.js : les créatures de la région sont ajoutées aux tables de hautes herbes (réparties entre les cartes).
 * Usage : node tools/build-bestiary.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { BESTIARY } from './bestiary-data.mjs';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

// Archétypes : multiplicateurs, classe de combat, nombre de sorts, butin, poids et décalage de niveau dans les hautes herbes.
const ARCH = {
  m: { hp: 1.0, atk: 1.1, def: 0.95, bias: 0, cls: 'assassin', spells: 3, gold: 0.6, drop: 0.45, weapon: 0.05, weight: 5, offset: -1 },
  b: { hp: 1.5, atk: 1.3, def: 1.2, bias: 0, cls: 'barbarian', spells: 3, gold: 1.2, drop: 0.55, weapon: 0.1, weight: 3, offset: 0 },
  c: { hp: 1.1, atk: 1.4, def: 0.9, bias: 0, cls: 'sorcerer', spells: 4, gold: 1.3, drop: 0.6, weapon: 0.05, weight: 3, offset: 0 },
  e: { hp: 1.8, atk: 1.5, def: 1.3, bias: 1, cls: 'sorcerer', spells: 5, gold: 3.0, drop: 0.75, weapon: 0.3, weight: 1, offset: 1 },
  l: { hp: 2.0, atk: 1.6, def: 1.4, bias: 1, cls: 'sorcerer', spells: 5, gold: 4.0, drop: 0.8, weapon: 0.4, weight: 1, offset: 1 }
};
// Couleur secondaire des sorts selon la couleur dominante.
const SECOND = { red: 'yellow', blue: 'purple', green: 'blue', yellow: 'red', purple: 'blue' };

const entry = ([id, name, race, title, color, , arch]) => {
  const a = ARCH[arch];
  const res = Object.fromEntries(COLORS.map(c => [c, c === color ? 0.3 : c === SECOND[color] ? 0.12 : 0.08]));
  const f = n => String(Math.round(n * 100) / 100);
  return [
    '  {',
    `    "id": "${id}",`,
    `    "name": ${JSON.stringify(name)},`,
    `    "race": ${JSON.stringify(race)},`,
    '',
    `    "title": ${JSON.stringify(title)},`,
    `    "playerClass": "${a.cls}",`,
    '    "hasWeapon": false,',
    `    "statsModifiers": { "hpMult": ${f(a.hp)}, "atkMult": ${f(a.atk)}, "defMult": ${f(a.def)} },`,
    `    "levelBias": ${a.bias},`,
    '    "spellProfile": {',
    `      "preferredColors": ["${color}", "${color}", "${SECOND[color]}"],`,
    '      "preferClassSpells": false,',
    `      "targetSpellCount": ${a.spells}`,
    '    },',
    `    "resistanceProfile": { ${COLORS.map(c => `"${c}": ${f(res[c])}`).join(', ')} },`,
    `    "dropProfile": { "goldMult": ${f(a.gold)}, "dropChance": ${a.drop.toFixed(2)}, "weaponChance": ${a.weapon.toFixed(2)} }`,
    '  }'
  ].join('\n');
};

// Sprites disponibles : seules les créatures dont les 4 directions existent dans sprites/generated.js entrent dans le jeu
// (les autres restent dans bestiary-data.mjs jusqu'à leur génération ; relancer ce script ensuite).
const genSrc = readFileSync(join(GAME, 'sprites', 'generated.js'), 'utf8');
const generated = Function('return ' + genSrc.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/)[1])();
const hasSprites = id => ['front', 'back', 'left', 'right'].every(d => generated[id]?.[d]);
const READY = BESTIARY.filter(b => hasSprites(b[0]));
const PENDING = new Set(BESTIARY.filter(b => !hasSprites(b[0])).map(b => b[0]));

// 1. Catalogue : ajoute les créatures prêtes, retire celles dont le sprite manque
const catPath = join(GAME, 'enemies.catalog.json');
const catText = readFileSync(catPath, 'utf8');
const parsed = JSON.parse(catText);
const known = new Set(parsed.map(e => e.id));
const fresh = READY.filter(b => !known.has(b[0]));
let out = catText;
const stale = parsed.filter(e => PENDING.has(e.id)).map(e => e.id);
if (stale.length) {
  const kept = parsed.filter(e => !PENDING.has(e.id));
  out = catText;
  for (const id of stale) out = out.replace(new RegExp(String.raw`\n  \{\n    "id": "${id}",[\s\S]*?\n  \},?`), '');
  out = out.replace(/,(\s*\])\s*$/, '$1');
  if (JSON.parse(out).length !== kept.length) throw new Error('prune catalogue incohérent');
}
if (fresh.length) {
  out = out.replace(/\s*\]\s*$/, ',\n' + fresh.map(entry).join(',\n') + '\n]\n');
}
JSON.parse(out);
if (!DRY && out !== catText) writeFileSync(catPath, out);
console.log('catalogue : +' + fresh.length + ' gabarits, -' + stale.length + ' sans sprite (' + READY.length + '/' + BESTIARY.length + ' prêtes)');

// 2. Prompts de sprites (toutes les créatures, y compris celles à générer)
const prompts = ['// Généré par tools/build-bestiary.mjs depuis tools/bestiary-data.mjs — ne pas éditer à la main.',
  '// Prompts Pixel Lab des créatures du bestiaire (fusionnés dans SPRITE_MANIFEST.enemies par sprite-prompts.js).', '',
  'export const BESTIARY_MANIFEST = {',
  BESTIARY.map(b => '  ' + b[0] + ': { desc: ' + JSON.stringify(b[7]) + ' }').join(',\n'), '};', ''].join('\n');
if (!DRY) writeFileSync(join(GAME, 'tools', 'sprite-prompts-bestiary.js'), prompts);

// 3. Hautes herbes : les créatures prêtes absentes d'une carte de la région y sont réparties ; celles sans sprite en sont retirées.
const byRegion = {};
BESTIARY.forEach(b => (byRegion[b[5]] ||= []).push(b));
for (const [region, list] of Object.entries(byRegion)) {
  const file = join(GAME, 'world', 'maps', region + '.js');
  let src = readFileSync(file, 'utf8');
  // retire l'entrée (et sa virgule précédente) ; si elle était la dernière de la table, la virgule restante est ôtée plus bas
  for (const id of PENDING) src = src.replace(new RegExp(String.raw`,\n\s*\{ templateId: '${id}'[^\n]*?\}(?=,?\n)`, 'g'), '');
  const todo = list.filter(b => !PENDING.has(b[0]) && !src.includes("templateId: '" + b[0] + "'"));
  const re = /(table:\s*\[)([\s\S]*?)(\n\s*\])/g;
  const tables = [...src.matchAll(re)];
  if (!tables.length) throw new Error(region + ' : aucune table de hautes herbes');
  const buckets = tables.map(() => []);
  todo.forEach((b, i) => buckets[i % tables.length].push(b));
  let k = 0;
  src = src.replace(re, (m, open, body, close) => {
    const add = buckets[k++].map(b => {
      const a = ARCH[b[6]];
      return ',\n                { templateId: \'' + b[0] + '\', name: ' + JSON.stringify(b[1]) + ', weight: ' + a.weight + ', offset: ' + a.offset + ' }';
    }).join('');
    return open + body.replace(/\s*$/, '') + add + close;
  });
  if (!DRY) writeFileSync(file, src);
  console.log(region + ' : +' + todo.length + ' dans ' + tables.length + ' table(s)');
}

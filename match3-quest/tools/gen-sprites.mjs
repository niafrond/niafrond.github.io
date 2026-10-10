#!/usr/bin/env node
/**
 * Génère les sprites GBA pour match3-quest via l'API pixel.lab.
 * Sortie : match3-quest/sprites/generated.js
 *
 * Usage :
 *   node match3-quest/tools/gen-sprites.mjs [options]
 *
 * Options :
 *   --only=heroes|npcs|enemies|all   Catégorie à générer (défaut: heroes)
 *   --dir=front|all                  Directions à générer (défaut: all)
 *   --size=32|64|128                 Taille en pixels (défaut: 32)
 *   --key=<api_key>                  Clé pixel.lab (ou env PIXELLAB_API_KEY)
 *   --concurrency=<n>                Requêtes en parallèle (défaut: 4)
 *   --dry-run                        Affiche les prompts sans appeler l'API
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ─── Chargement de la clé API ───────────────────────────────────────────────

function loadApiKey() {
  // 1. Argument CLI --key=...
  const keyArg = process.argv.find(a => a.startsWith('--key='));
  if (keyArg) return keyArg.split('=').slice(1).join('=');

  // 2. Variable d'environnement
  if (process.env.PIXELLAB_API_KEY) return process.env.PIXELLAB_API_KEY;

  // 3. pixel-art/config.js (gitignored, contient la clé locale)
  const configPath = join(ROOT, 'pixel-art', 'config.js');
  if (existsSync(configPath)) {
    const src = readFileSync(configPath, 'utf8');
    const m = src.match(/PIXELLAB_API_KEY\s*=\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  }

  return null;
}

// ─── Parsing des arguments ──────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; })
);

const ONLY        = (args.only || 'heroes').split(',');
const DIRS        = args.dir === 'front' ? ['front'] : ['front', 'back', 'left', 'right'];
const SIZE        = parseInt(args.size || '32', 10);
const CONCURRENCY = parseInt(args.concurrency || '4', 10);
const DRY_RUN     = !!args['dry-run'];

// ─── Chargement du manifest ─────────────────────────────────────────────────

const { SPRITE_MANIFEST, DIR_PROMPTS, STYLE_SUFFIX, NEGATIVE_PROMPT } =
  await import('./sprite-prompts.js');

// ─── Appel API ───────────────────────────────────────────────────────────────

const API_URL = 'https://api.pixellab.ai/v1/generate-image-pixflux';

// Direction pixel.lab : 'south'=front, 'north'=back, 'west'=left, 'east'=right
const DIR_TO_PIXELLAB = { front: 'south', back: 'north', left: 'west', right: 'east' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callPixelLab(apiKey, description, dir, size, retries = 5) {
  const body = {
    description,
    negative_description: NEGATIVE_PROMPT,
    image_size: { width: size, height: size },
    outline: 'single color black outline',
    shading: 'flat shading',
    detail: 'low detail',
    view: 'low top-down',
    direction: DIR_TO_PIXELLAB[dir] ?? 'south',
    no_background: true,
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && retries > 0) {
    const wait = 10000 + Math.random() * 5000;
    process.stdout.write(`(429, retry dans ${Math.round(wait/1000)}s) `);
    await sleep(wait);
    return callPixelLab(apiKey, description, dir, size, retries - 1);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status}: ${err.detail ?? err.message ?? JSON.stringify(err)}`);
  }

  const data = await res.json();
  const b64 = data.image?.base64;
  if (!b64) throw new Error(`Format de réponse inattendu: ${JSON.stringify(data).slice(0, 200)}`);
  return `data:image/png;base64,${b64}`;
}

// ─── Queue de concurrence ────────────────────────────────────────────────────

async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── Chargement du generated.js existant ────────────────────────────────────

const GENERATED_PATH = join(__dirname, '..', 'sprites', 'generated.js');

function loadExisting() {
  if (!existsSync(GENERATED_PATH)) return {};
  try {
    const src = readFileSync(GENERATED_PATH, 'utf8');
    // Évalue le JS pour extraire GBA_SPRITES (fichier statique sans dépendances)
    const m = src.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);
    if (!m) return {};
    return Function(`return ${m[1]}`)();
  } catch {
    return {};
  }
}

// ─── Écriture de generated.js ────────────────────────────────────────────────

function writeGenerated(sprites) {
  const lines = [
    '// Généré par match3-quest/tools/gen-sprites.mjs — ne pas éditer à la main',
    `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`,
    '// Lancez: node match3-quest/tools/gen-sprites.mjs --only=all --dir=all',
    'export const GBA_SPRITES = {',
  ];

  for (const [key, dirs] of Object.entries(sprites)) {
    lines.push(`  ${JSON.stringify(key)}: {`);
    for (const [dir, uri] of Object.entries(dirs)) {
      // Tronquer l'URI pour la lisibilité dans git diff (le vrai contenu est là)
      lines.push(`    ${dir}: ${JSON.stringify(uri)},`);
    }
    lines.push('  },');
  }

  lines.push('};');
  writeFileSync(GENERATED_PATH, lines.join('\n') + '\n', 'utf8');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = DRY_RUN ? 'dry-run' : loadApiKey();
  if (!apiKey) {
    console.error(
      'Clé API pixel.lab introuvable.\n' +
      '  Option 1 : node gen-sprites.mjs --key=<votre_cle>\n' +
      '  Option 2 : export PIXELLAB_API_KEY=<votre_cle>\n' +
      '  Option 3 : créer pixel-art/config.js avec PIXELLAB_API_KEY'
    );
    process.exit(1);
  }

  // Sélection des catégories
  const categories = ONLY.includes('all')
    ? ['heroes', 'npcs', 'enemies']
    : ONLY.filter(c => SPRITE_MANIFEST[c]);

  // Collecte des tâches
  const tasks = [];
  for (const cat of categories) {
    for (const [key, { desc }] of Object.entries(SPRITE_MANIFEST[cat])) {
      for (const dir of DIRS) {
        tasks.push({ key, desc, dir, cat });
      }
    }
  }

  console.log(`Génération : ${tasks.length} sprites (${categories.join(', ')}, dirs: ${DIRS.join('/')})`);
  if (DRY_RUN) {
    for (const t of tasks) {
      const prompt = `pixel art character sprite, ${t.desc}, ${DIR_PROMPTS[t.dir]}, ${STYLE_SUFFIX}`;
      console.log(`\n[${t.key}/${t.dir}]\n  ${prompt}`);
    }
    return;
  }

  const existing = loadExisting();
  let done = 0;
  let failed = 0;

  const DELAY_MS = parseInt(args.delay || '2000', 10);

  const apiFns = tasks.map(({ key, desc, dir }, i) => async () => {
    if (i > 0) await sleep(DELAY_MS);
    const description = `pixel art character sprite, ${desc}, ${STYLE_SUFFIX}`;
    process.stdout.write(`  [${key}/${dir}] ... `);
    try {
      const uri = await callPixelLab(apiKey, description, dir, SIZE);
      if (!existing[key]) existing[key] = {};
      existing[key][dir] = uri;
      done++;
      console.log('✓');
    } catch (err) {
      failed++;
      console.log(`✗ ${err.message}`);
    }
    writeGenerated(existing); // sauvegarde progressive (résistant aux interruptions)
  });

  await runWithConcurrency(apiFns, CONCURRENCY);

  console.log(`\nTerminé : ${done} générés, ${failed} échecs → ${GENERATED_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });

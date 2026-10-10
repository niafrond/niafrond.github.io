#!/usr/bin/env node
/**
 * Génère les tuiles de terrain GBA pour match3-quest via pixel.lab Bitforge.
 * Sortie : match3-quest/terrain/generated-tiles.js
 *
 * Usage :
 *   node match3-quest/tools/gen-tiles.mjs [options]
 *
 * Options :
 *   --only=paddy,riverbed,...  Biomes à générer (défaut: all)
 *   --types=ground,path,liquid Types de tuile (défaut: all)
 *   --size=16|32               Taille en pixels (défaut: 16)
 *   --key=<api_key>            Clé pixel.lab
 *   --delay=<ms>               Délai entre requêtes (défaut: 3000)
 *   --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ─── Clé API ─────────────────────────────────────────────────────────────────

function loadApiKey() {
  const keyArg = process.argv.find(a => a.startsWith('--key='));
  if (keyArg) return keyArg.split('=').slice(1).join('=');
  if (process.env.PIXELLAB_API_KEY) return process.env.PIXELLAB_API_KEY;
  const configPath = join(ROOT, 'pixel-art', 'config.js');
  if (existsSync(configPath)) {
    const src = readFileSync(configPath, 'utf8');
    const m = src.match(/PIXELLAB_API_KEY\s*=\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  }
  return null;
}

// ─── Arguments ───────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; })
);

const DRY_RUN  = !!args['dry-run'];
const SIZE     = parseInt(args.size || '32', 10);
const DELAY_MS = parseInt(args.delay || '3000', 10);

const { TILE_MANIFEST, TILE_TYPES, TILE_STYLE_SUFFIX, TILE_NEGATIVE } =
  await import('./tile-prompts.js');

const ALL_BIOMES = Object.keys(TILE_MANIFEST);
const ONLY_BIOMES = args.only ? args.only.split(',') : ALL_BIOMES;
const ONLY_TYPES  = args.types ? args.types.split(',') : TILE_TYPES;

// ─── API Bitforge ─────────────────────────────────────────────────────────────

const BITFORGE_URL = 'https://api.pixellab.ai/v1/generate-image-bitforge';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callBitforge(apiKey, description, size, retries = 5) {
  const body = {
    description,
    negative_description: TILE_NEGATIVE,
    image_size: { width: size, height: size },
    outline: 'lineless',
    shading: 'flat shading',
    detail: 'medium detail',
    view: 'high top-down',
    no_background: false,
    text_guidance_scale: 9,
  };

  const res = await fetch(BITFORGE_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && retries > 0) {
    const wait = 10000 + Math.random() * 5000;
    process.stdout.write(`(429, retry dans ${Math.round(wait / 1000)}s) `);
    await sleep(wait);
    return callBitforge(apiKey, description, size, retries - 1);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status}: ${err.detail ?? err.message ?? JSON.stringify(err)}`);
  }
  const data = await res.json();
  const b64 = data.image?.base64;
  if (!b64) throw new Error(`Réponse inattendue: ${JSON.stringify(data).slice(0, 200)}`);
  return `data:image/png;base64,${b64}`;
}

// ─── Fichiers output ──────────────────────────────────────────────────────────

const TERRAIN_DIR     = join(__dirname, '..', 'terrain');
const GENERATED_PATH  = join(TERRAIN_DIR, 'generated-tiles.js');
const PNG_DIR         = join(TERRAIN_DIR, 'png');
const PREVIEW_PATH    = join(__dirname, 'tile-preview.html');

mkdirSync(TERRAIN_DIR, { recursive: true });

function loadExisting() {
  if (!existsSync(GENERATED_PATH)) return {};
  try {
    const src = readFileSync(GENERATED_PATH, 'utf8');
    const m = src.match(/export const GBA_TILES\s*=\s*(\{[\s\S]*\});\s*$/);
    if (!m) return {};
    return Function(`return ${m[1]}`)();
  } catch { return {}; }
}

function writeGenerated(tiles) {
  const lines = [
    '// Généré par match3-quest/tools/gen-tiles.mjs — ne pas éditer à la main',
    `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`,
    '// Lancez: node match3-quest/tools/gen-tiles.mjs',
    'export const GBA_TILES = {',
  ];
  for (const [biome, types] of Object.entries(tiles)) {
    lines.push(`  ${JSON.stringify(biome)}: {`);
    for (const [type, uri] of Object.entries(types)) {
      lines.push(`    ${type}: ${JSON.stringify(uri)},`);
    }
    lines.push('  },');
  }
  lines.push('};');
  writeFileSync(GENERATED_PATH, lines.join('\n') + '\n', 'utf8');
}

function exportPngs(tiles) {
  mkdirSync(PNG_DIR, { recursive: true });
  let n = 0;
  for (const [biome, types] of Object.entries(tiles)) {
    for (const [type, uri] of Object.entries(types)) {
      writeFileSync(
        join(PNG_DIR, `${biome}_${type}.png`),
        Buffer.from(uri.replace('data:image/png;base64,', ''), 'base64')
      );
      n++;
    }
  }
  return n;
}

// ─── Preview HTML ─────────────────────────────────────────────────────────────

function writePreview(tiles) {
  const cards = Object.entries(tiles).map(([biome, types]) => {
    const label = TILE_MANIFEST[biome]?.label || biome;
    const thumbs = TILE_TYPES.map(type => {
      const uri = types[type];
      if (!uri) return `<div class="thumb missing"><span>${type}</span></div>`;
      // affiche × 8 pour voir les pixels
      return `<div class="thumb"><img src="${uri}" width="128" height="128" style="image-rendering:pixelated"><span>${type}</span></div>`;
    }).join('');
    return `<div class="card"><div class="card-name">${biome}<br><small>${label}</small></div><div class="thumbs">${thumbs}</div></div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Tile Preview — match3-quest Terrains GBA</title>
<style>
  body { background: #1a1a2e; color: #eee; font-family: monospace; margin: 0; padding: 16px; }
  h1 { color: #e94560; margin: 0 0 8px; }
  .stats { color: #aaa; font-size: 12px; margin-bottom: 24px; }
  .grid { display: flex; flex-wrap: wrap; gap: 16px; }
  .card { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 12px; min-width: 220px; }
  .card-name { font-size: 12px; color: #e94560; font-weight: bold; margin-bottom: 8px; }
  small { color: #a8dadc; font-size: 10px; }
  .thumbs { display: flex; gap: 8px; flex-wrap: wrap; }
  .thumb { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .thumb img { border: 1px solid #333; border-radius: 2px; }
  .thumb.missing { width: 128px; height: 128px; background: #111; border: 1px dashed #444; border-radius: 2px; display: flex; align-items: center; justify-content: center; }
  .thumb span { font-size: 9px; color: #888; }
</style>
</head>
<body>
<h1>Tuiles de terrain GBA — match3-quest</h1>
<p class="stats">Généré le ${new Date().toLocaleString('fr-FR')} — ${Object.keys(tiles).length} biomes</p>
<div class="grid">${cards}</div>
</body>
</html>`;

  writeFileSync(PREVIEW_PATH, html, 'utf8');
  return PREVIEW_PATH;
}

function openInBrowser(filePath) {
  try {
    const winPath = execSync(`wslpath -w "${filePath}"`).toString().trim();
    execSync(`cmd.exe /c start "" "${winPath}"`, { stdio: 'ignore' });
  } catch {
    try { execSync(`xdg-open "${filePath}"`, { stdio: 'ignore' }); } catch { /* ignore */ }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = DRY_RUN ? 'dry-run' : loadApiKey();
  if (!apiKey) {
    console.error('Clé API introuvable. --key=, PIXELLAB_API_KEY, ou pixel-art/config.js');
    process.exit(1);
  }

  // Collecte des tâches
  const tasks = [];
  for (const biome of ONLY_BIOMES) {
    const def = TILE_MANIFEST[biome];
    if (!def) { console.warn(`Biome inconnu : ${biome}`); continue; }
    for (const type of ONLY_TYPES) {
      if (!def[type]) continue; // ex. house n'a pas de liquid
      tasks.push({ biome, type, prompt: def[type] });
    }
  }

  const totalCalls = tasks.length;
  console.log(`Biomes : ${ONLY_BIOMES.join(', ')}`);
  console.log(`Types  : ${ONLY_TYPES.join(', ')}`);
  console.log(`Total  : ${totalCalls} appels Bitforge (${SIZE}×${SIZE}px)\n`);

  if (DRY_RUN) {
    for (const { biome, type, prompt } of tasks) {
      console.log(`[${biome}/${type}]\n  ${prompt}\n  + ${TILE_STYLE_SUFFIX}\n`);
    }
    const existing = loadExisting();
    const previewPath = writePreview(existing);
    console.log(`Preview : ${previewPath}`);
    openInBrowser(previewPath);
    return;
  }

  const existing = loadExisting();
  let done = 0, failed = 0;

  for (let i = 0; i < tasks.length; i++) {
    const { biome, type, prompt } = tasks[i];
    if (existing[biome]?.[type]) {
      console.log(`  [${biome}/${type}] déjà généré, skip`);
      continue;
    }
    if (i > 0) await sleep(DELAY_MS);
    const description = `${prompt}, ${TILE_STYLE_SUFFIX}`;
    process.stdout.write(`  [${biome}/${type}] Bitforge ... `);
    try {
      const uri = await callBitforge(apiKey, description, SIZE);
      if (!existing[biome]) existing[biome] = {};
      existing[biome][type] = uri;
      done++;
      console.log('✓');
    } catch (err) {
      failed++;
      console.log(`✗ ${err.message}`);
    }
    writeGenerated(existing);
  }

  console.log(`\nTerminé : ${done} générés, ${failed} échecs → ${GENERATED_PATH}`);

  const pngCount = exportPngs(existing);
  console.log(`PNGs exportés : ${pngCount} → match3-quest/terrain/png/`);

  const previewPath = writePreview(existing);
  console.log(`Preview : ${previewPath}`);
  openInBrowser(previewPath);
}

main().catch(err => { console.error(err); process.exit(1); });

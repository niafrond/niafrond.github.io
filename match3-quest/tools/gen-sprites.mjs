#!/usr/bin/env node
/**
 * Génère les sprites GBA pour match3-quest via l'API pixel.lab.
 * Sortie : match3-quest/sprites/generated.js
 *
 * Stratégie (NPCs / ennemis) :
 *   1. Génère le sprite de face (south) via PixFlux avec un prompt détaillé
 *   2. Dérive back/left/right via l'endpoint /rotate (cohérence visuelle garantie)
 *
 * Usage :
 *   node match3-quest/tools/gen-sprites.mjs [options]
 *
 * Options :
 *   --only=heroes|npcs|enemies|all   Catégorie à générer (défaut: heroes)
 *   --dir=front|all                  Directions à générer (défaut: all)
 *   --size=32|64|128                 Taille en pixels (défaut: 32)
 *   --key=<api_key>                  Clé pixel.lab (ou env PIXELLAB_API_KEY)
 *   --concurrency=<n>                Requêtes en parallèle (défaut: 1)
 *   --delay=<ms>                     Délai entre requêtes (défaut: 3000)
 *   --dry-run                        Affiche les prompts sans appeler l'API
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ─── Chargement de la clé API ───────────────────────────────────────────────

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

// ─── Parsing des arguments ──────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; })
);

const ONLY        = (args.only || 'heroes').split(',');
const DIRS        = args.dir === 'front' ? ['front'] : ['front', 'back', 'left', 'right'];
const SIZE        = parseInt(args.size || '32', 10);
const CONCURRENCY = parseInt(args.concurrency || '1', 10);
const DELAY_MS    = parseInt(args.delay || '3000', 10);
const DRY_RUN     = !!args['dry-run'];

// ─── Chargement du manifest ─────────────────────────────────────────────────

const { SPRITE_MANIFEST, STYLE_SUFFIX, NEGATIVE_PROMPT } =
  await import('./sprite-prompts.js');

// ─── API pixel.lab ───────────────────────────────────────────────────────────

// Direction pixel.lab : 'south'=front, 'north'=back, 'west'=left, 'east'=right
const DIR_TO_PIXELLAB = { front: 'south', back: 'north', left: 'west', right: 'east' };

const PIXFLUX_URL = 'https://api.pixellab.ai/v1/generate-image-pixflux';
const ROTATE_URL  = 'https://api.pixellab.ai/v1/rotate';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, options, retries = 5) {
  const res = await fetch(url, options);
  if (res.status === 429 && retries > 0) {
    const wait = 10000 + Math.random() * 5000;
    process.stdout.write(`(429, retry dans ${Math.round(wait / 1000)}s) `);
    await sleep(wait);
    return fetchWithRetry(url, options, retries - 1);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status}: ${err.detail ?? err.message ?? JSON.stringify(err)}`);
  }
  return res.json();
}

// Génère un sprite de face via PixFlux (prompt texte → pixel art)
async function callPixelLab(apiKey, description, size) {
  const body = {
    description,
    negative_description: NEGATIVE_PROMPT,
    image_size: { width: size, height: size },
    outline: 'single color black outline',
    shading: 'flat shading',
    detail: 'medium detail',
    view: 'low top-down',
    direction: 'south',
    no_background: true,
  };
  const data = await fetchWithRetry(PIXFLUX_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const b64 = data.image?.base64;
  if (!b64) throw new Error(`Réponse inattendue PixFlux: ${JSON.stringify(data).slice(0, 200)}`);
  return `data:image/png;base64,${b64}`;
}

// Pivote un sprite existant (front → back/left/right) via /rotate
async function callRotate(apiKey, frontUri, toDir, size) {
  const rawB64 = frontUri.replace('data:image/png;base64,', '');
  const body = {
    from_image: { type: 'base64', base64: rawB64 },
    from_direction: 'south',
    to_direction: DIR_TO_PIXELLAB[toDir],
    from_view: 'low top-down',
    to_view: 'low top-down',
    image_size: { width: size, height: size },
    image_guidance_scale: 7,
  };
  const data = await fetchWithRetry(ROTATE_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const b64 = data.image?.base64;
  if (!b64) throw new Error(`Réponse inattendue Rotate: ${JSON.stringify(data).slice(0, 200)}`);
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

// ─── Chargement / écriture de generated.js ───────────────────────────────────

const GENERATED_PATH = join(__dirname, '..', 'sprites', 'generated.js');

function loadExisting() {
  if (!existsSync(GENERATED_PATH)) return {};
  try {
    const src = readFileSync(GENERATED_PATH, 'utf8');
    const m = src.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);
    if (!m) return {};
    return Function(`return ${m[1]}`)();
  } catch {
    return {};
  }
}

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
      lines.push(`    ${dir}: ${JSON.stringify(uri)},`);
    }
    lines.push('  },');
  }
  lines.push('};');
  writeFileSync(GENERATED_PATH, lines.join('\n') + '\n', 'utf8');
}

// ─── Export PNG (pour aperçu PR) ─────────────────────────────────────────────

const PNG_DIR = join(__dirname, '..', 'sprites', 'png');

function exportPngs(sprites) {
  mkdirSync(PNG_DIR, { recursive: true });
  let count = 0;
  for (const [key, dirs] of Object.entries(sprites)) {
    for (const [dir, uri] of Object.entries(dirs)) {
      const b64 = uri.replace('data:image/png;base64,', '');
      writeFileSync(join(PNG_DIR, `${key}_${dir}.png`), Buffer.from(b64, 'base64'));
      count++;
    }
  }
  return count;
}

// ─── Preview HTML ────────────────────────────────────────────────────────────

const PREVIEW_PATH = join(__dirname, 'sprite-preview.html');

function writePreview(sprites) {
  const categories = { heroes: [], npcs: [], enemies: [] };
  for (const [key] of Object.entries(sprites)) {
    if (SPRITE_MANIFEST.heroes[key]) categories.heroes.push(key);
    else if (SPRITE_MANIFEST.npcs[key]) categories.npcs.push(key);
    else if (SPRITE_MANIFEST.enemies[key]) categories.enemies.push(key);
    else categories.heroes.push(key);
  }

  const renderGroup = (title, keys) => {
    if (!keys.length) return '';
    const cards = keys.map(key => {
      const dirs = sprites[key] || {};
      const thumbs = ['front', 'back', 'left', 'right'].map(dir => {
        const uri = dirs[dir];
        if (!uri) return `<div class="thumb missing"><span>${dir}</span></div>`;
        return `<div class="thumb"><img src="${uri}" width="64" height="64" style="image-rendering:pixelated"><span>${dir}</span></div>`;
      }).join('');
      return `<div class="card"><div class="card-name">${key}</div><div class="thumbs">${thumbs}</div></div>`;
    }).join('');
    return `<section><h2>${title}</h2><div class="grid">${cards}</div></section>`;
  };

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Sprite Preview — match3-quest GBA</title>
<style>
  body { background: #1a1a2e; color: #eee; font-family: monospace; margin: 0; padding: 16px; }
  h1 { color: #e94560; margin: 0 0 24px; }
  h2 { color: #a8dadc; border-bottom: 1px solid #333; padding-bottom: 6px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 32px; }
  .card { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 10px; min-width: 180px; }
  .card-name { font-size: 11px; color: #e94560; margin-bottom: 8px; font-weight: bold; }
  .thumbs { display: flex; gap: 6px; flex-wrap: wrap; }
  .thumb { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .thumb img { background: #0f3460; border: 1px solid #333; border-radius: 3px; }
  .thumb.missing { width: 64px; height: 64px; background: #111; border: 1px dashed #444; border-radius: 3px; display: flex; align-items: center; justify-content: center; }
  .thumb span { font-size: 9px; color: #888; }
  .stats { color: #aaa; font-size: 12px; margin-bottom: 16px; }
</style>
</head>
<body>
<h1>Sprites GBA — match3-quest</h1>
<p class="stats">Généré le ${new Date().toLocaleString('fr-FR')} — ${Object.keys(sprites).length} personnages</p>
${renderGroup('Héros', categories.heroes)}
${renderGroup('PNJ', categories.npcs)}
${renderGroup('Ennemis', categories.enemies)}
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

  const categories = ONLY.includes('all')
    ? ['heroes', 'npcs', 'enemies']
    : ONLY.filter(c => SPRITE_MANIFEST[c]);

  // Collecte des personnages à traiter (une entrée par clé, pas par direction)
  const chars = [];
  for (const cat of categories) {
    for (const [key, { desc }] of Object.entries(SPRITE_MANIFEST[cat])) {
      chars.push({ key, desc, cat });
    }
  }

  const needRotate = DIRS.length > 1; // true sauf si --dir=front
  const totalPixflux = chars.length;
  const totalRotate  = needRotate ? chars.length * 3 : 0;
  console.log(
    `Stratégie : ${totalPixflux} générations PixFlux (face) + ${totalRotate} rotations → ${totalPixflux + totalRotate} appels API\n` +
    `Personnages : ${categories.join(', ')} (${chars.length})\n`
  );

  if (DRY_RUN) {
    for (const { key, desc } of chars) {
      console.log(`[${key}] front → rotate back/left/right`);
      console.log(`  prompt: pixel art character sprite, ${desc}, ${STYLE_SUFFIX}\n`);
    }
    const existing = loadExisting();
    const previewPath = writePreview(existing);
    console.log(`Preview (sprites existants) : ${previewPath}`);
    openInBrowser(previewPath);
    return;
  }

  const existing = loadExisting();
  let done = 0;
  let failed = 0;
  let callIdx = 0; // compteur global pour le délai entre appels

  const charFns = chars.map(({ key, desc }) => async () => {
    // ── Étape 1 : face (PixFlux) ──────────────────────────────────────────
    if (DIRS.includes('front') && !existing[key]?.front) {
      if (callIdx++ > 0) await sleep(DELAY_MS);
      process.stdout.write(`  [${key}/front] PixFlux ... `);
      try {
        const description = `pixel art character sprite, ${desc}, ${STYLE_SUFFIX}`;
        const uri = await callPixelLab(apiKey, description, SIZE);
        if (!existing[key]) existing[key] = {};
        existing[key].front = uri;
        done++;
        console.log('✓');
      } catch (err) {
        failed++;
        console.log(`✗ ${err.message}`);
        writeGenerated(existing);
        return; // pas de rotation si la face a échoué
      }
      writeGenerated(existing);
    }

    if (!needRotate) return;

    // ── Étape 2 : rotations depuis la face ───────────────────────────────
    const frontUri = existing[key]?.front;
    if (!frontUri) {
      console.log(`  [${key}] ⚠ pas de face disponible, rotation ignorée`);
      return;
    }

    for (const dir of ['back', 'left', 'right']) {
      if (!DIRS.includes(dir)) continue;
      if (existing[key]?.[dir]) continue; // déjà généré

      if (callIdx++ > 0) await sleep(DELAY_MS);
      process.stdout.write(`  [${key}/${dir}] Rotate ... `);
      try {
        const uri = await callRotate(apiKey, frontUri, dir, SIZE);
        existing[key][dir] = uri;
        done++;
        console.log('✓');
      } catch (err) {
        failed++;
        console.log(`✗ ${err.message}`);
      }
      writeGenerated(existing);
    }
  });

  await runWithConcurrency(charFns, CONCURRENCY);

  console.log(`\nTerminé : ${done} générés, ${failed} échecs → ${GENERATED_PATH}`);

  const pngCount = exportPngs(existing);
  console.log(`PNGs exportés : ${pngCount} → match3-quest/sprites/png/`);

  const previewPath = writePreview(existing);
  console.log(`Preview : ${previewPath}`);
  openInBrowser(previewPath);
}

main().catch(err => { console.error(err); process.exit(1); });

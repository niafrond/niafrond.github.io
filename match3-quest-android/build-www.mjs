#!/usr/bin/env node
/**
 * build-www.mjs — Assemble match3-quest-android/www : le jeu entièrement embarqué dans l'APK (aucune ressource distante).
 * Contenu = exactement `core` + `media` de match3-quest/precache-manifest.json (ce que le jeu demande vraiment : pas de sprites/png,
 * de sources de génération ni de musiques jamais jouées). Adaptations pour l'APK :
 *   - version.js : copie autonome (celui du jeu réexporte ../version.js, absent de l'APK) ;
 *   - index.html : la version anti-cache est lue dans ./version.js (et non sur GitHub Pages) ; le compteur de visites distant est retiré ;
 *   - pas de sw.js : tout est déjà sur l'appareil, le pré-téléchargement hors ligne n'a rien à faire.
 *
 * Usage (WSL, Node 22) : node match3-quest-android/build-www.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '../match3-quest');
const OUT = join(HERE, 'www');

const manifest = JSON.parse(readFileSync(join(GAME, 'precache-manifest.json'), 'utf8'));
const files = [...manifest.core, ...manifest.media.map(f => f.p)].filter(p => p !== 'sw.js');

rmSync(OUT, { recursive: true, force: true });
const missing = [];
for (const p of files) {
    const src = join(GAME, p);
    if (!existsSync(src)) { missing.push(p); continue; }
    mkdirSync(dirname(join(OUT, p)), { recursive: true });
    copyFileSync(src, join(OUT, p));
}
if (missing.length) { console.error(`Fichiers du manifeste introuvables (npm run precache:build ?) :\n${missing.join('\n')}`); process.exit(1); }

// version.js autonome : la version du site + les alias MATCH3_* attendus par le jeu.
writeFileSync(join(OUT, 'version.js'), readFileSync(resolve(GAME, '../version.js'), 'utf8')
    + "\nexport { SITE_SEMVER as MATCH3_SEMVER, getVersion as getMatch3Version, getBuildDate as getMatch3BuildDate };\n");

// index.html : version locale, pas de compteur distant.
let html = readFileSync(join(OUT, 'index.html'), 'utf8');
const urlExpr = "(/\\.github\\.io$/.test(location.hostname) ? '../version.js' : 'https://niafrond.github.io/version.js')";
if (!html.includes(urlExpr)) { console.error('index.html : lecture de la version introuvable (le script anti-cache a changé ?)'); process.exit(1); }
html = html.replace(urlExpr, "'version.js'");
html = html.replace(/^.*stats\.fontaine\.one\/count\.js.*\n/m, '');
writeFileSync(join(OUT, 'index.html'), html);

const remote = html.match(/https?:\/\/(?!ko-fi\.com)[^\s"'<>)]+/g) || [];
console.log(`${files.length} fichiers copiés dans ${OUT}`);
if (remote.length) console.log(`Adresses distantes restant dans index.html : ${[...new Set(remote)].join(', ')}`);

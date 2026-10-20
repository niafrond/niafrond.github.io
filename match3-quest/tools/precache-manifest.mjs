#!/usr/bin/env node
/**
 * precache-manifest.mjs — Liste ce que le jeu charge réellement (code, feuilles de style, polices, données, sons, dessins animés) dans
 * `precache-manifest.json`, lue par le service worker (sw.js) et par le pré-téléchargement hors ligne (offlineCache.js).
 *
 *   - `core`  : le cœur (code, css, polices, json, effets sonores) : mis en cache à l'installation du service worker, une version par build.
 *   - `media` : les gros fichiers (musiques, dessins des ultimes, des sorts et des cinématiques), { p: chemin, s: octets, h: empreinte } :
 *               le cache média survit aux versions du jeu, seuls les fichiers dont l'empreinte change sont retéléchargés.
 *
 * Ne figurent PAS dans le manifeste : sprites/png, sprites/ultimates-*, tools, tests, docs… (sources de génération, jamais demandées par le
 * jeu) ni `../version.js` (réécrit à chaque release : le service worker le gère à part). Un test jest vérifie que le fichier est à jour.
 *
 * Usage : node match3-quest/tools/precache-manifest.mjs   (ou : npm run precache:build)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

export const GAME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_FILE = 'precache-manifest.json';

// Dossiers de dessins chargés à la demande par le jeu (cinématiques, sorts, ultimes).
export const MEDIA_SPRITE_DIRS = ['ultimates', 'spellfx', 'prologue', 'sunfall', 'ending', 'fengmeng', 'launcher'];

const list = (root, dir, accept) => {
    const full = join(root, dir);
    if (!existsSync(full)) return [];
    return readdirSync(full).filter(name => statSync(join(full, name)).isFile() && accept(name)).sort().map(name => (dir ? `${dir}/${name}` : name));
};
const ext = (...exts) => name => exts.some(e => name.endsWith(e));
// Idem, en descendant dans les sous-dossiers (world/text/…).
const listDeep = (root, dir, accept) => {
    const full = join(root, dir);
    if (!existsSync(full)) return [];
    return readdirSync(full).sort().flatMap(name => {
        const path = `${dir}/${name}`;
        return statSync(join(root, path)).isDirectory() ? listDeep(root, path, accept) : accept(name) ? [path] : [];
    });
};

const hashOf = (root, path) => createHash('md5').update(readFileSync(join(root, path))).digest('hex').slice(0, 10);
const media = (root, path) => ({ p: path, s: statSync(join(root, path)).size, h: hashOf(root, path) });

/** @returns {{ version: number, core: string[], media: Array<{p: string, s: number, h: string}> }} */
export function buildManifest(root = GAME_DIR) {
    const core = [
        'index.html',
        ...list(root, '', name => ext('.js', '.css', '.json', '.svg')(name) && name !== MANIFEST_FILE && !name.startsWith('test-')),
        ...listDeep(root, 'world', ext('.js')),
        ...list(root, 'sprites', ext('.js')),
        ...list(root, 'sprites/cn', ext('.js')),
        ...list(root, 'sprites/tiles', ext('.svg')),
        ...list(root, 'fonts', ext('.woff2')),
        ...list(root, 'audio', ext('.json')),
        ...list(root, 'audio/sfx', ext('.mp3'))
    ];
    const music = list(root, 'audio/music', ext('.mp3'));
    const art = MEDIA_SPRITE_DIRS.flatMap(dir => list(root, `sprites/${dir}`, ext('.png', '.json')));
    // Ordre de téléchargement : petits fichiers de décor d'abord, musiques ensuite (la majorité des octets)
    return { version: 1, core, media: [...art, ...music].map(path => media(root, path)) };
}

export const serialize = manifest => `${JSON.stringify(manifest, null, 1)}\n`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const manifest = buildManifest();
    writeFileSync(join(GAME_DIR, MANIFEST_FILE), serialize(manifest));
    const bytes = manifest.media.reduce((sum, f) => sum + f.s, 0);
    console.log(`${MANIFEST_FILE} : ${manifest.core.length} fichiers de cœur, ${manifest.media.length} médias (${(bytes / 1e6).toFixed(1)} Mo)`);
}

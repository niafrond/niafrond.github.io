// Découpe sprites/generated.js (sprites GBA, ≈ 3 Mo, réécrit par les outils de génération) en un module par clé dans sprites/gba/, et écrit
// l'index sprites/gbaIndex.js (clé → fichier). Le jeu ne télécharge ainsi que les dessins de la région affichée (sprites/index.js
// loadGbaSprites), au lieu de tout le fichier au démarrage. Le nom de chaque fichier porte l'empreinte de son contenu : un dessin modifié
// change d'adresse (pas de cache périmé), le service worker les range parmi les médias.
// À relancer après toute modification de generated.js :  node match3-quest/sprites/build-gba.mjs
// (tests/unit/sprites.test.js vérifie que le découpage est à jour).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

export const GBA_DIR = new URL('./gba/', import.meta.url);
const INDEX_FILE = new URL('./gbaIndex.js', import.meta.url);

export function readGenerated() {
    const src = readFileSync(new URL('./generated.js', import.meta.url), 'utf8');
    return Function(`return ${src.match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/)[1]}`)();
}

/** @returns {{ files: Record<string, string>, index: string }} contenu attendu de sprites/gba/ et de sprites/gbaIndex.js */
export function splitGba(sprites = readGenerated()) {
    const files = {};
    const names = {};
    Object.keys(sprites).sort().forEach(key => {
        if (!/^[a-z0-9_]+$/.test(key)) throw new Error(`clé de sprite GBA invalide pour un nom de fichier : ${key}`);
        const body = `// Généré par sprites/build-gba.mjs à partir de sprites/generated.js — ne pas modifier à la main.\nexport default ${JSON.stringify(sprites[key])};\n`;
        const name = `${key}.${createHash('md5').update(body).digest('hex').slice(0, 8)}.js`;
        files[name] = body;
        names[key] = name;
    });
    const index = `// Fichier généré par sprites/build-gba.mjs — ne pas modifier à la main.
// Sprites GBA disponibles : clé → module de sprites/gba/ (chargé à la demande par sprites/index.js).
export const GBA_FILES = {
${Object.entries(names).map(([k, n]) => `    ${k}: '${n}'`).join(',\n')}
};
`;
    return { files, index };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { files, index } = splitGba();
    if (!existsSync(GBA_DIR)) mkdirSync(GBA_DIR);
    readdirSync(GBA_DIR).filter(n => !(n in files)).forEach(n => unlinkSync(new URL(n, GBA_DIR)));
    Object.entries(files).forEach(([n, body]) => writeFileSync(new URL(n, GBA_DIR), body));
    writeFileSync(INDEX_FILE, index);
    console.log(`sprites/gba : ${Object.keys(files).length} modules`);
}

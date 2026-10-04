// Régénère sprites/packs.js (index « clé de sprite → paquet ») à partir des fichiers de sprites/cn/.
// À relancer après tout ajout ou renommage de sprite :  node match3-quest/sprites/build-packs.mjs
// (tests/unit/sprites.test.js vérifie que l'index est à jour).
import { writeFileSync } from 'fs';
import { SPRITE_PACK_FILES, packContents } from './packContents.js';

const npc = {};
const enemy = {};
for (const pack of Object.keys(SPRITE_PACK_FILES)) {
    const mod = await import(new URL(SPRITE_PACK_FILES[pack], import.meta.url));
    const { npcs, enemies } = packContents(mod);
    Object.keys(npcs).forEach(k => { npc[k] = pack; });
    Object.keys(enemies).forEach(k => { enemy[k] = pack; });
}
const line = obj => Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)).map(([k, p]) => `    ${k}: '${p}'`).join(',\n');
writeFileSync(new URL('./packs.js', import.meta.url),
`// Fichier généré par sprites/build-packs.mjs — ne pas modifier à la main.
// Paquet de sprites (fichier de sprites/cn/) qui contient chaque PNJ et chaque ennemi dessiné : sert à ne charger
// que les paquets utiles à la région affichée.
export const NPC_PACK = {
${line(npc)}
};

export const ENEMY_PACK = {
${line(enemy)}
};
`);
console.log(`packs.js : ${Object.keys(npc).length} PNJ, ${Object.keys(enemy).length} ennemis`);

// Sprites SVG des personnages (héros, PNJ, coffres, ennemis, soleils) : de vrais dessins vectoriels
// (viewBox 64x64, pieds vers y = 58, sans ombre au sol) dans l'univers de « Hou Yi et les Dix Soleils »
// (voir UNIVERS.md). Les tuiles du plateau (gâteaux de lune, soleil, flèche) sont des fichiers SVG dans tiles/.
//  - cn/actors-a.js  : les 4 styles de Hou Yi (clés = ids de classes), PNJ des régions 1 à 5, coffres
//  - cn/actors-b.js  : PNJ des régions 6 à 10, Fengmeng (4 rencontres)
//  - cn/enemies-1.js / cn/enemies-2.js : ennemis, clés = identifiants de gabarits du catalogue
//  - cn/suns.js      : les neuf Soleils-Boss (clés sun_1…sun_9) et trois bêtes
// Une clé d'ennemi nommé (boss, rival) prime sur celle de son gabarit.

import { HERO_SPRITES, NPC_SPRITES_A, CHEST_SPRITES } from './cn/actors-a.js';
import { NPC_SPRITES_B, FENGMENG_SPRITES } from './cn/actors-b.js';
import { ENEMY_SPRITES_CN_1 } from './cn/enemies-1.js';
import { ENEMY_SPRITES_CN_2 } from './cn/enemies-2.js';
import { SUN_SPRITES, BEAST_SPRITES } from './cn/suns.js';
import { villagerSprite } from './villagers.js';

export { HERO_SPRITES, CHEST_SPRITES };
export const NPC_SPRITES = { ...NPC_SPRITES_A, ...NPC_SPRITES_B };
export const ENEMY_SPRITES = {
    ...ENEMY_SPRITES_CN_1,
    ...ENEMY_SPRITES_CN_2,
    ...BEAST_SPRITES,
    ...SUN_SPRITES,
    ...FENGMENG_SPRITES
};

// Fichiers des tuiles du plateau, par classe CSS de tuile.
export const TILE_FILES = ['red', 'blue', 'green', 'yellow', 'purple', 'skull', 'combat', 'joker']
    .map(name => `sprites/tiles/tile-${name}.svg`);

export const heroSprite = classId => HERO_SPRITES[classId] || null;
// PNJ dessinés à la main, sinon villageois généré à partir de l'identifiant (`hint` = emoji, oriente l'âge).
const villagerCache = new Map();
export const npcSprite = (npcId, hint = '') => {
    if (NPC_SPRITES[npcId]) return NPC_SPRITES[npcId];
    if (!villagerCache.has(npcId)) villagerCache.set(npcId, villagerSprite(npcId, hint));
    return villagerCache.get(npcId);
};
export const chestSprite = opened => CHEST_SPRITES[opened ? 'open' : 'closed'] || null;

// Un ennemi nommé (soleil, rival) a son propre dessin ; sinon on prend celui de son gabarit.
export const enemySprite = (enemyId, templateId) => ENEMY_SPRITES[enemyId] || ENEMY_SPRITES[templateId] || null;

export const spriteUri = svg => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '');

const imageCache = new Map();

// Image chargée (une seule fois par SVG). Utiliser img.complete && img.naturalWidth avant de dessiner.
export function spriteImage(svg) {
    let img = imageCache.get(svg);
    if (!img) {
        img = new Image();
        img.src = spriteUri(svg);
        imageCache.set(svg, img);
    }
    return img;
}

export function preloadSprites() {
    [...Object.values(HERO_SPRITES), ...Object.values(NPC_SPRITES), ...Object.values(CHEST_SPRITES),
        ...Object.values(ENEMY_SPRITES)].forEach(spriteImage);
}

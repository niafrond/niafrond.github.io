// Sprites SVG des personnages (héros, PNJ, coffres, ennemis) : de vrais dessins vectoriels
// (viewBox 64x64, pieds vers y = 58, sans ombre au sol) qui remplacent les anciens emojis.
//  - actors.js   : héros par classe, PNJ, coffres
//  - enemies1.js / enemies2.js : ennemis, clés = identifiant d'ennemi (boss / ennemis nommés)
//                                ou identifiant de gabarit du catalogue
// Ce module ne dépend pas du DOM pour la sélection des sprites ; seul spriteImage() crée des Image.

import { HERO_SPRITES, NPC_SPRITES, CHEST_SPRITES } from './actors.js';
import { ENEMY_SPRITES_1 } from './enemies1.js';
import { ENEMY_SPRITES_2 } from './enemies2.js';

export { HERO_SPRITES, NPC_SPRITES, CHEST_SPRITES };
export const ENEMY_SPRITES = { ...ENEMY_SPRITES_1, ...ENEMY_SPRITES_2 };

export const heroSprite = classId => HERO_SPRITES[classId] || null;
export const npcSprite = npcId => NPC_SPRITES[npcId] || null;
export const chestSprite = opened => CHEST_SPRITES[opened ? 'open' : 'closed'] || null;

// Un ennemi nommé (boss, quête) a son propre dessin ; sinon on prend celui de son gabarit.
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

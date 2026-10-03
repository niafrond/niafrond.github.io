// Sprites SVG des personnages (héros, PNJ, coffres, ennemis, soleils) : de vrais dessins vectoriels
// (viewBox 64x64, pieds vers y = 58, sans ombre au sol) dans l'univers de « Hou Yi et les Dix Soleils »
// (voir UNIVERS.md). Les tuiles du plateau (gâteaux de lune, soleil, flèche) sont des fichiers SVG dans tiles/.
//  - cn/actors-a.js  : les 4 styles de Hou Yi (clés = ids de classes), PNJ des régions 1 à 5, coffres
//  - cn/actors-b.js  : PNJ des régions 6 à 10, Fengmeng (4 rencontres)
//  - cn/enemies-1.js / cn/enemies-2.js : ennemis, clés = identifiants de gabarits du catalogue
//  - cn/suns.js      : les neuf Soleils-Boss (clés sun_1…sun_9) et trois bêtes
// Une clé d'ennemi nommé (boss, rival) prime sur celle de son gabarit.
//
// Chargement à la demande : chaque fichier de cn/ est un « paquet » importé dynamiquement (loadSpritePacks) quand une
// région en a besoin (packsForKeys + l'index généré packs.js). Tant qu'un paquet n'est pas chargé, ses sprites valent
// null (le rendu retombe sur l'emoji). Les images décodées sont gardées en cache pour la région courante seulement
// (retainSprites libère les autres) : on ne décode jamais tous les dessins du jeu d'un coup.

import { SPRITE_PACK_FILES, packContents } from './packContents.js';
import { NPC_PACK, ENEMY_PACK } from './packs.js';
import { villagerSprite } from './villagers.js';

export const SPRITE_PACKS = Object.keys(SPRITE_PACK_FILES);
// Héros et coffres : toujours présents à l'écran (et sur la carte du monde).
export const CORE_PACK = 'actors-a';

// Remplis au fil des chargements de paquets (mêmes objets, donc lisibles à tout moment).
export const HERO_SPRITES = {};
export const CHEST_SPRITES = {};
export const NPC_SPRITES = {};
export const ENEMY_SPRITES = {};

const loadedPacks = new Map();     // paquet → module
const pendingPacks = new Map();    // paquet → Promise
const failedAt = new Map();        // paquet → date du dernier échec (pas de nouvel essai à chaque image)
const RETRY_MS = 5000;

// Les objets publics sont reconstruits dans l'ordre canonique des paquets (le dernier gagne en cas de clé partagée).
function rebuild() {
    [HERO_SPRITES, CHEST_SPRITES, NPC_SPRITES, ENEMY_SPRITES].forEach(o => Object.keys(o).forEach(k => delete o[k]));
    SPRITE_PACKS.filter(p => loadedPacks.has(p)).forEach(p => {
        const c = packContents(loadedPacks.get(p));
        Object.assign(HERO_SPRITES, c.heroes);
        Object.assign(CHEST_SPRITES, c.chests);
        Object.assign(NPC_SPRITES, c.npcs);
        Object.assign(ENEMY_SPRITES, c.enemies);
    });
}

export const isPackLoaded = pack => loadedPacks.has(pack);

export function loadSpritePack(pack) {
    if (loadedPacks.has(pack)) return Promise.resolve();
    if (!SPRITE_PACK_FILES[pack]) return Promise.reject(new Error(`paquet de sprites inconnu : ${pack}`));
    if (!pendingPacks.has(pack)) {
        const last = failedAt.get(pack);
        if (last && Date.now() - last < RETRY_MS) return Promise.reject(new Error(`paquet de sprites indisponible : ${pack}`));
        pendingPacks.set(pack, import(SPRITE_PACK_FILES[pack]).then(mod => {
            loadedPacks.set(pack, mod);
            failedAt.delete(pack);
            rebuild();
        }, err => {
            failedAt.set(pack, Date.now());
            throw err;
        }).finally(() => pendingPacks.delete(pack)));
    }
    return pendingPacks.get(pack);
}

export const loadSpritePacks = packs => Promise.all([...new Set(packs)].map(loadSpritePack));
export const loadAllSprites = () => loadSpritePacks(SPRITE_PACKS);

// Paquets nécessaires pour un ensemble d'entités : { npcs: [id], enemies: [[clé, gabarit]] }.
export function packsForKeys({ npcs = [], enemies = [] } = {}) {
    const packs = new Set([CORE_PACK]);
    npcs.forEach(id => { if (NPC_PACK[id]) packs.add(NPC_PACK[id]); });
    enemies.forEach(([key, templateId]) => {
        const pack = ENEMY_PACK[key] || ENEMY_PACK[templateId];
        if (pack) packs.add(pack);
    });
    return [...packs];
}

// Fichiers des tuiles du plateau, par classe CSS de tuile.
export const TILE_FILES = ['red', 'blue', 'green', 'yellow', 'purple', 'skull', 'combat', 'joker']
    .map(name => `sprites/tiles/tile-${name}.svg`);

export const heroSprite = classId => HERO_SPRITES[classId] || null;
// PNJ dessinés à la main, sinon villageois généré à partir de l'identifiant (`hint` = emoji, oriente l'âge).
// Un PNJ dessiné dont le paquet n'est pas encore chargé vaut null (et son paquet est demandé).
const villagerCache = new Map();
export const npcSprite = (npcId, hint = '') => {
    if (NPC_SPRITES[npcId]) return NPC_SPRITES[npcId];
    if (NPC_PACK[npcId]) { loadSpritePack(NPC_PACK[npcId]).catch(() => {}); return null; }
    if (!villagerCache.has(npcId)) villagerCache.set(npcId, villagerSprite(npcId, hint));
    return villagerCache.get(npcId);
};
export const chestSprite = opened => CHEST_SPRITES[opened ? 'open' : 'closed'] || null;

// Un ennemi nommé (soleil, rival) a son propre dessin ; sinon on prend celui de son gabarit.
export const enemySprite = (enemyId, templateId) => {
    const svg = ENEMY_SPRITES[enemyId] || null;
    if (svg) return svg;
    // dessin propre pas encore chargé : on ne retombe pas sur celui du gabarit
    if (ENEMY_PACK[enemyId]) { loadSpritePack(ENEMY_PACK[enemyId]).catch(() => {}); return null; }
    if (ENEMY_SPRITES[templateId]) return ENEMY_SPRITES[templateId];
    if (ENEMY_PACK[templateId]) loadSpritePack(ENEMY_PACK[templateId]).catch(() => {});
    return null;
};

export const spriteUri = svg => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '');

const imageCache = new Map();

// Image chargée (une seule fois par SVG tant qu'elle est retenue). Utiliser img.complete && img.naturalWidth avant de dessiner.
export function spriteImage(svg) {
    let img = imageCache.get(svg);
    if (!img) {
        img = new Image();
        img.decoding = 'async';
        img.src = spriteUri(svg);
        imageCache.set(svg, img);
    }
    return img;
}

// Décode les images données (attend la fin du décodage) ; une image en erreur ne bloque pas.
export function decodeSprites(svgs) {
    return Promise.all(svgs.filter(Boolean).map(svg => {
        const img = spriteImage(svg);
        if (img.complete && img.naturalWidth) return Promise.resolve();
        return (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; })).catch(() => {});
    }));
}

// Ne garde en cache que les images de `svgs` : les autres sont libérées (le navigateur peut rendre leur mémoire).
export function retainSprites(svgs) {
    const keep = new Set(svgs.filter(Boolean));
    for (const [svg, img] of imageCache) {
        if (keep.has(svg)) continue;
        img.removeAttribute('src');
        imageCache.delete(svg);
    }
}

export const cachedSpriteCount = () => imageCache.size;

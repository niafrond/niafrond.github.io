// Sprites SVG des personnages (héros, PNJ, coffres, ennemis, soleils) : de vrais dessins vectoriels
// (viewBox 64x64, pieds vers y = 58, sans ombre au sol) dans l'univers de « Hou Yi et les Dix Soleils »
// (voir UNIVERS.md). Les tuiles du plateau (gâteaux de lune, soleil, flèche) sont des fichiers SVG dans tiles/.
//  - cn/actors-a.js  : les 4 styles de Hou Yi (clés = ids de classes), PNJ des régions 1 à 5, coffres
//  - cn/actors-b.js  : PNJ des régions 6 à 10, Fengmeng (4 rencontres)
//  - cn/enemies-1.js / cn/enemies-2.js : ennemis, clés = identifiants de gabarits du catalogue
//  - cn/suns.js      : les neuf Soleils-Boss en pixel art (clés sun_1…sun_9), générés par gen-suns.mjs ; cn/beasts.js : trois bêtes
// Une clé d'ennemi nommé (boss, rival) prime sur celle de son gabarit.
//
// Chargement à la demande : chaque fichier de cn/ est un « paquet » importé dynamiquement (loadSpritePacks) quand une
// région en a besoin (packsForKeys + l'index généré packs.js). Tant qu'un paquet n'est pas chargé, ses sprites valent
// null (rien n'est dessiné en attendant). Les images décodées sont gardées en cache pour la région courante seulement
// (retainSprites libère les autres) : on ne décode jamais tous les dessins du jeu d'un coup.

import { SPRITE_PACK_FILES, packContents } from './packContents.js';
import { NPC_PACK, ENEMY_PACK } from './packs.js';
import { villagerSprite } from './villagers.js';
import { tintSvg, isTintable } from './biomeTint.js';
export { BIOME_TINTS, tintSvg } from './biomeTint.js';

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
// PNJ dessinés à la main, sinon villageois (ou créature) généré à partir de l'identifiant.
// Un PNJ dessiné dont le paquet n'est pas encore chargé vaut null (et son paquet est demandé).
const villagerCache = new Map();
export const npcSprite = npcId => {
    if (NPC_SPRITES[npcId]) return NPC_SPRITES[npcId];
    if (NPC_PACK[npcId]) { loadSpritePack(NPC_PACK[npcId]).catch(() => {}); return null; }
    if (!villagerCache.has(npcId)) villagerCache.set(npcId, villagerSprite(npcId));
    return villagerCache.get(npcId);
};
export const chestSprite = opened => CHEST_SPRITES[opened ? 'open' : 'closed'] || null;

// Un ennemi nommé (soleil, rival) a son propre dessin ; sinon on prend celui de son gabarit.
// `biome` (optionnel) recolore le dessin aux teintes du biome (voir biomeTint.js) ; sans biome, ou pour un biome sans teinte,
// le dessin d'origine est renvoyé. Le résultat est mis en cache par (dessin, biome) : même chaîne à chaque appel.
const baseEnemySprite = (enemyId, templateId) => {
    const svg = ENEMY_SPRITES[enemyId] || null;
    if (svg) return { svg, key: enemyId };
    // dessin propre pas encore chargé : on ne retombe pas sur celui du gabarit
    if (ENEMY_PACK[enemyId]) { loadSpritePack(ENEMY_PACK[enemyId]).catch(() => {}); return null; }
    if (ENEMY_SPRITES[templateId]) return { svg: ENEMY_SPRITES[templateId], key: templateId };
    if (ENEMY_PACK[templateId]) loadSpritePack(ENEMY_PACK[templateId]).catch(() => {});
    return null;
};
export const enemySprite = (enemyId, templateId, biome) => {
    const base = baseEnemySprite(enemyId, templateId);
    if (!base) return null;
    return biome && isTintable(base.key) ? tintSvg(base.svg, biome) : base.svg;
};

// Rendu « pixel art GBA » appliqué à TOUS les sprites de personnages (héros, PNJ, ennemis, soleils, coffres, décors) : un filtre SVG
// échantillonne le dessin vectoriel sur une grille de PIXEL_STEP unités (32 × 32 pixels logiques pour un viewBox de 64), recadre le canal alpha
// (bords nets, sans anti-crénelage) et réduit chaque couche à 6 niveaux (palette limitée). Les dessins source restent vectoriels.
export const PIXEL_STEP = 2;
const PIXEL_FILTER = `<defs><filter id="m3px" filterUnits="userSpaceOnUse" x="0" y="0" width="64" height="64" color-interpolation-filters="sRGB">` +
    `<feFlood x="${PIXEL_STEP / 2 - 0.5}" y="${PIXEL_STEP / 2 - 0.5}" width="1" height="1"/><feComposite width="${PIXEL_STEP}" height="${PIXEL_STEP}"/><feTile result="t"/>` +
    `<feComposite in="SourceGraphic" in2="t" operator="in"/><feMorphology operator="dilate" radius="${(PIXEL_STEP - 1) / 2}"/>` +
    `<feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/><feFuncR type="discrete" tableValues="0 .2 .4 .6 .8 1"/>` +
    `<feFuncG type="discrete" tableValues="0 .2 .4 .6 .8 1"/><feFuncB type="discrete" tableValues="0 .2 .4 .6 .8 1"/></feComponentTransfer></filter></defs>`;
const pixelCache = new Map();
export function pixelate(svg) {
    if (!svg || !/^\s*<svg[\s>]/.test(svg) || !svg.includes('viewBox="0 0 64 64"')) return svg;
    let out = pixelCache.get(svg);
    if (!out) {
        const open = svg.indexOf('>', svg.indexOf('<svg')) + 1;
        const close = svg.lastIndexOf('</svg>');
        out = close < 0 ? svg : `${svg.slice(0, open)}${PIXEL_FILTER}<g filter="url(#m3px)">${svg.slice(open, close)}</g></svg>`;
        if (pixelCache.size > 600) pixelCache.clear();
        pixelCache.set(svg, out);
    }
    return out;
}
const rawUri = svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// ── Pixellisation nette (canvas) ───────────────────────────────────────────
// Le dessin vectoriel est rastérisé à 4 × la grille puis échantillonné : chaque « pixel » de la grille prend la couleur DOMINANTE de
// son bloc de 4 × 4 (et non la moyenne : pas de teintes boueuses ni de bruit sur les aplats), à condition que la couverture soit ≥ 50 %
// (sinon transparent : bords nets, sans anti-crénelage), quantifiée à 6 niveaux par couche ; les pixels très sombres retombent sur
// la couleur du contour. Deux définitions, comme sur GBA :
//   - grille 32 (défaut) : sprites de carte et vignettes, contour de 1 pixel ;
//   - grille 64 : grands plans (écran de rencontre), contour du dessin affiné pour garder un trait d'un pixel.
// Le résultat est agrandi ×4 SANS lissage ; à l'écran il se dessine avec `imageSmoothingEnabled = false` (canvas) ou
// `image-rendering: pixelated` (balises img), donc jamais flou. Tant que la conversion n'est pas prête (asynchrone), spriteUri renvoie la
// version filtrée SVG, remplacée ensuite dans les <img>.
export const PX_GRID_BIG = 64;
const PX_GRID = 32, PX_LEVELS = 6, PX_SAMPLE = 4;
const OUTLINE_RGB = [43, 27, 23];
const pixelDone = new Map();      // `${grille}|${svg}` → { canvas, uri }
const pixelPending = new Map();   // idem → Promise
const q = v => Math.round(Math.round(v / 255 * (PX_LEVELS - 1)) * 255 / (PX_LEVELS - 1));
const pxKey = (svg, grid) => `${grid}|${svg}`;
const normGrid = grid => (grid === PX_GRID_BIG ? PX_GRID_BIG : PX_GRID);
// Trait d'un pixel quelle que soit la grille : le contour (2 sur 64) est affiné pour la grille 64.
const thinStrokes = svg => svg.replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${(w * 0.6).toFixed(2)}"`);

function buildPixelCanvas(img, grid) {
    const S = grid * PX_SAMPLE;
    const big = document.createElement('canvas');
    big.width = big.height = S;
    const bg = big.getContext('2d', { willReadFrequently: true });
    bg.drawImage(img, 0, 0, S, S);
    const src = bg.getImageData(0, 0, S, S).data;
    const small = document.createElement('canvas');
    small.width = small.height = grid;
    const sg = small.getContext('2d');
    const out = sg.createImageData(grid, grid);
    const B = PX_SAMPLE;
    for (let cy = 0; cy < grid; cy++) for (let cx = 0; cx < grid; cx++) {
        let n = 0;
        const buckets = new Map();
        for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
            const i = ((cy * B + y) * S + cx * B + x) * 4;
            if (src[i + 3] < 96) continue;
            n++;
            const key = (src[i] >> 5) << 6 | (src[i + 1] >> 5) << 3 | (src[i + 2] >> 5);
            let e = buckets.get(key);
            if (!e) { e = { n: 0, r: 0, g: 0, b: 0 }; buckets.set(key, e); }
            e.n++; e.r += src[i]; e.g += src[i + 1]; e.b += src[i + 2];
        }
        if (n < B * B * 0.5) continue;
        let best = null;
        for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
        let r = best.r / best.n, g = best.g / best.n, b = best.b / best.n;
        const o = (cy * grid + cx) * 4;
        if (Math.abs(r - 43) + Math.abs(g - 27) + Math.abs(b - 23) < 60) [r, g, b] = OUTLINE_RGB;   // contour : couleur exacte (la quantification la verdirait)
        else { r = q(r); g = q(g); b = q(b); }
        out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = 255;
    }
    sg.putImageData(out, 0, 0);
    const up = document.createElement('canvas');
    up.width = up.height = grid * 4;
    const ug = up.getContext('2d');
    ug.imageSmoothingEnabled = false;
    ug.drawImage(small, 0, 0, up.width, up.height);
    return up;
}

// Canvas pixellisé du sprite (4 × la grille) s'il est prêt, sinon null et la conversion démarre.
export function pixelSprite(svg, grid = PX_GRID) {
    if (!svg || typeof document === 'undefined') return null;
    const g = normGrid(grid);
    const done = pixelDone.get(pxKey(svg, g));
    if (done) return done.canvas;
    preparePixelSprite(svg, g);
    return null;
}

export function preparePixelSprite(svg, grid = PX_GRID) {
    if (!svg || typeof document === 'undefined' || !/^\s*<svg[\s>]/.test(svg)) return Promise.resolve();
    const g = normGrid(grid);
    const key = pxKey(svg, g);
    if (pixelDone.has(key)) return Promise.resolve();
    if (!pixelPending.has(key)) {
        pixelPending.set(key, (async () => {
            const img = g === PX_GRID ? spriteImage(svg) : Object.assign(new Image(), { src: rawUri(thinStrokes(svg)) });
            if (!(img.complete && img.naturalWidth)) await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
            const canvas = buildPixelCanvas(img, g);
            const uri = canvas.toDataURL('image/png');
            pixelDone.set(key, { canvas, uri });
            // les <img> qui affichaient la version de repli passent à la version nette
            const fallback = fallbackUri(svg, g);
            document.querySelectorAll?.('img').forEach(el => { if (el.getAttribute('src') === fallback) el.setAttribute('src', uri); });
        })().catch(() => {}).finally(() => pixelPending.delete(key)));
    }
    return pixelPending.get(key);
}

// Version de repli (filtre SVG) : le fragment distingue les grilles pour que chaque <img> reçoive la bonne version nette.
const fallbackUri = (svg, grid) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pixelate(svg))}${grid === PX_GRID ? '' : `#g${grid}`}`;

export function spriteUri(svg, grid = PX_GRID) {
    if (!svg) return '';
    const g = normGrid(grid);
    const done = pixelDone.get(pxKey(svg, g));
    if (done) return done.uri;
    preparePixelSprite(svg, g);
    return fallbackUri(svg, g);
}

const imageCache = new Map();

// Image chargée (une seule fois par SVG tant qu'elle est retenue). Utiliser img.complete && img.naturalWidth avant de dessiner.
export function spriteImage(svg) {
    let img = imageCache.get(svg);
    if (!img) {
        img = new Image();
        img.decoding = 'async';
        img.src = rawUri(svg);
        imageCache.set(svg, img);
    }
    return img;
}

// Décode les images données (attend la fin du décodage) ; une image en erreur ne bloque pas.
export function decodeSprites(svgs) {
    return Promise.all(svgs.filter(Boolean).map(svg => {
        const img = spriteImage(svg);
        const decoded = img.complete && img.naturalWidth ? Promise.resolve()
            : (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; })).catch(() => {});
        return decoded.then(() => preparePixelSprite(svg));
    }));
}

// Ne garde en cache que les images de `svgs` : les autres sont libérées (le navigateur peut rendre leur mémoire).
export function retainSprites(svgs) {
    const keep = new Set(svgs.filter(Boolean));
    for (const [svg, img] of imageCache) {
        if (keep.has(svg)) continue;
        img.removeAttribute('src');
        imageCache.delete(svg);
        pixelDone.delete(pxKey(svg, PX_GRID));
        pixelDone.delete(pxKey(svg, PX_GRID_BIG));
    }
}

export const cachedSpriteCount = () => imageCache.size;

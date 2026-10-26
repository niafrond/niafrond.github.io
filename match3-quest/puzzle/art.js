// Dessins des énigmes : émetteur de soleil, récepteur, jarres, charrettes (puzzle/sprites.js, générés par tools/gen-puzzle-sprites.mjs).
// Les images sont déclarées une seule fois par plateau (`spriteDefs`, dans le <defs> du SVG) et posées par `<use>` : redessiner le plateau
// à chaque coup ne recharge donc aucune image. Si un dessin manque, `sprite` renvoie '' et le mode garde son dessin géométrique.
import { PUZZLE_SPRITES } from './sprites.js';

const SPRITES = { ...PUZZLE_SPRITES };
const ID = name => `pz-${name}`;
const PIXELATED = 'image-rendering:crisp-edges;image-rendering:pixelated';

export const hasSprite = name => Boolean(SPRITES[name]);

/** Dessin du héros du joueur (data URI d une case), posé par le jeu : remplace le pion bleu de l’énigme des jarres. */
export const setHeroSprite = uri => { if (uri) SPRITES.hero = { w: 1, h: 1, uri }; else delete SPRITES.hero; };

/** `<image>` de chaque dessin, à placer dans un `<defs>` (une unité de repère = une case ; largeur et hauteur = nombre de cases du dessin). */
export const spriteDefs = () => Object.entries(SPRITES)
    .map(([name, s]) => `<image id="${ID(name)}" width="${s.w}" height="${s.h || 1}" preserveAspectRatio="none" style="${PIXELATED}" href="${s.uri}"/>`).join('');

/** Dessin `name` placé dans la case (x, y) ; `turn` = quarts de tour horaires (un dessin horizontal de `w` cases devient vertical à 1). */
export function sprite(name, x, y, turn = 0) {
    const s = SPRITES[name];
    if (!s) return '';
    if (!turn) return `<use href="#${ID(name)}" x="${x}" y="${y}"/>`;
    // rotation autour du coin haut gauche, puis recalage : (u, v) → (−v, u) pour 1 quart de tour, etc.
    const t = turn & 3, tx = [0, 1, s.w, 0][t], ty = [0, 0, 1, s.w][t];
    return `<use href="#${ID(name)}" transform="translate(${x + tx} ${y + ty}) rotate(${t * 90})"/>`;
}

/** Choix stable d'une variante de dessin parmi `names` selon un rang (jarre n° 2, charrette n° 5…). */
export const variant = (names, i) => names.filter(hasSprite)[i % Math.max(1, names.filter(hasSprite).length)] || '';

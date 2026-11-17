/**
 * companionTrail.js — le compagnon suit le héros à la trace en exploration (module pur, sans DOM).
 *
 * Le héros laisse derrière lui une piste de points (sa position à l'écran, image après image) ; le compagnon vise le point de la
 * piste situé `gap` cases en arrière, et s'y rend en glissant (vitesse bornée) : il reste donc toujours derrière le héros, sur le
 * chemin que celui-ci a pris (jamais dans un mur), tourne les coins comme lui et rattrape son retard à l'arrêt. Sans piste (arrivée
 * sur une carte, téléportation), il se place derrière le héros, à l'opposé de sa direction de regard.
 */

export const FOLLOW_GAP = 0.9;            // distance (en cases) derrière le héros
const POINT_STEP = 0.06;                  // écart minimal entre deux points de la piste
const MAX_SPEED = 11;                     // cases par seconde : un peu plus vite que le héros pour rattraper son retard
const SMOOTH_MS = 80;                     // amorti de la glissade
const WALK_FRAMES_PER_TILE = 2.4;         // images de marche par case parcourue
const MOVING_EPS = 0.35;                  // cases par seconde au-dessus desquelles le compagnon « marche »

/** Vecteur unitaire d'une direction de vue (`front` = vers le bas de l'écran, `back` = vers le haut). */
export const DIR_VECTOR = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] };

export function createTrail() {
    return { pts: [], head: 0, s: 0, x: null, y: null, dir: 'front', phase: 0, moving: false };
}

/** Efface la piste et replace le compagnon derrière le héros (arrivée sur une carte, téléportation, saut de plus de 3 cases). */
export function resetTrail(t, heroX, heroY, heroDir = 'front') {
    const [vx, vy] = DIR_VECTOR[heroDir] || DIR_VECTOR.front;
    // piste de départ : un segment droit derrière le héros, pour que le compagnon ait déjà « un chemin » à suivre
    t.pts = [{ x: heroX - vx * FOLLOW_GAP, y: heroY - vy * FOLLOW_GAP, s: 0 }, { x: heroX, y: heroY, s: FOLLOW_GAP }];
    t.head = FOLLOW_GAP;
    t.s = 0;
    t.x = heroX - vx * FOLLOW_GAP;
    t.y = heroY - vy * FOLLOW_GAP;
    t.dir = heroDir;
    t.phase = 0;
    t.moving = false;
    return t;
}

/** Ajoute la position courante du héros à la piste (ignore les micro-déplacements ; repart de zéro sur un saut). */
export function recordHero(t, x, y, heroDir = 'front') {
    const last = t.pts[t.pts.length - 1];
    if (!last || t.x === null || Math.hypot(x - last.x, y - last.y) > 3) { resetTrail(t, x, y, heroDir); return t; }
    const d = Math.hypot(x - last.x, y - last.y);
    if (d >= POINT_STEP) { t.head += d; t.pts.push({ x, y, s: t.head }); }
    // mémoire bornée : on oublie les points que le compagnon a déjà dépassés (avec une marge)
    while (t.pts.length > 2 && t.pts[1].s < t.s - 1) t.pts.shift();
    return t;
}

/** Position sur la piste à l'abscisse curviligne `s` (bornée à la piste). */
export function pointAt(t, s) {
    const pts = t.pts;
    if (s <= pts[0].s) return { x: pts[0].x, y: pts[0].y };
    for (let i = 1; i < pts.length; i++) {
        if (s <= pts[i].s) {
            const a = pts[i - 1], b = pts[i], f = (s - a.s) / ((b.s - a.s) || 1);
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }
    }
    const e = pts[pts.length - 1];
    return { x: e.x, y: e.y };
}

/** Point de la piste situé à `gap` cases (le long du chemin) derrière la tête de piste ; null si la piste est plus courte. */
export function pointBehind(t, gap = FOLLOW_GAP) {
    const s = t.head - gap;
    return s < t.pts[0].s ? null : pointAt(t, s);
}

/** Direction de vue d'un déplacement (dx, dy) ; `fallback` si presque immobile. */
export function dirOfMove(dx, dy, fallback = 'front') {
    if (Math.hypot(dx, dy) < 1e-6) return fallback;
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'back' : 'front');
}

/**
 * Avance le compagnon de `dtMs` : il progresse le long de la piste (donc jamais en coupant un coin) vers le point situé `gap` derrière
 * le héros, à vitesse bornée avec un léger amorti ; met à jour sa direction (celle de sa marche, sinon celle du héros), sa phase de
 * marche et son état `moving`. Renvoie le compagnon `{ x, y, dir, phase, moving }` (le même objet que `t`).
 */
export function stepCompanion(t, hero, dtMs, heroDir = 'front') {
    if (t.x === null) resetTrail(t, hero.x, hero.y, heroDir);
    const dt = Math.max(0, dtMs);
    const targetS = Math.max(t.pts[0].s, t.head - FOLLOW_GAP);
    const k = 1 - Math.exp(-dt / SMOOTH_MS);
    const ds = Math.min((targetS - t.s) * k, MAX_SPEED * dt / 1000);
    t.s += Math.max(0, ds);
    const p = pointAt(t, t.s);
    const dx = p.x - t.x, dy = p.y - t.y, moved = Math.hypot(dx, dy);
    t.x = p.x; t.y = p.y;
    t.moving = dt > 0 ? moved / (dt / 1000) > MOVING_EPS : t.moving;
    if (t.moving) { t.dir = dirOfMove(dx, dy, t.dir); t.phase += moved * WALK_FRAMES_PER_TILE; }
    else t.dir = heroDir;
    return t;
}

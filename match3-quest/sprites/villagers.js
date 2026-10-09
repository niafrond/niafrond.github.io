// Villageois génériques en pixel art : sprite chibi (viewBox 64x64, pieds vers y = 58, contour #2b1b17 d'un pixel, sans ombre au
// sol) composé à partir de l'identifiant du PNJ (peau, robe, coiffure, couvre-chef, barbe, accessoire) pour que chaque habitant du
// Grand Monde ait un dessin propre sans sprite écrit à la main. Déterministe : même id → même personnage. L'identifiant oriente aussi
// l'âge (OLD_IDS : cheveux blancs, barbe ; CHILD_ID / CHILD_IDS : plus petit, couettes), le sexe (FEMALE_IDS : épingles, cils) et l'habit
// (moines : crâne rasé, robe safran). Les PNJ non humains (animaux, esprits, épouvantail…) sont dessinés par creatures.js.
//
// Direction artistique (agents/animation-pixel-art.md, « pixel art soigné et brillant ») : le dessin est une grille de 64 x 64 pixels
// indexés par couleur (classe Pix) convertie en SVG de rectangles alignés sur la grille (shape-rendering="crispEdges", ni dégradé,
// ni filtre, ni opacité). Chaque pièce (tête, robe, cheveux, chapeau…) est peinte avec un contour d'un pixel, une rampe de 3 à 4 tons,
// un liseré clair en haut à gauche et une ombre en bas à droite ; les cheveux portent un reflet laqué. Toutes les couleurs sont sur le
// réseau à 6 niveaux de la pixellisation du jeu (sprites/index.js) : elles s'affichent exactement comme dessinées aux grilles 32 et 64.
// La silhouette est alignée (stabilize) pour que le vote de chaque bloc 2 x 2 de la grille 32 garde un contour continu.

import { creatureSprite } from './creatures.js';

export const N = 64;
export const OUTLINE = '#2b1b17';

const mk = () => new Uint8Array(N * N);
export const ell = (cx, cy, rx, ry) => {
    const m = mk();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) m[y * N + x] = 1;
    }
    return m;
};
export const box = (x0, y0, x1, y1) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const m = mk();
    for (let y = Math.max(0, y0); y < Math.min(N, y1); y++) for (let x = Math.max(0, x0); x < Math.min(N, x1); x++) m[y * N + x] = 1;
    return m;
};
export const poly = pts => {
    const m = mk();
    for (let y = 0; y < N; y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
            const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
            if (y1 === y2) continue;
            if (yc >= Math.min(y1, y2) && yc < Math.max(y1, y2)) xs.push(x1 + (yc - y1) * (x2 - x1) / (y2 - y1));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
            for (let x = 0; x < N; x++) if (x + 0.5 >= xs[i] && x + 0.5 < xs[i + 1]) m[y * N + x] = 1;
        }
    }
    return m;
};
export const union = (...ms) => { const m = mk(); ms.forEach(a => { for (let i = 0; i < N * N; i++) if (a[i]) m[i] = 1; }); return m; };
export const minus = (a, b) => { const m = mk(); for (let i = 0; i < N * N; i++) m[i] = a[i] && !b[i] ? 1 : 0; return m; };
export const inter = (a, b) => { const m = mk(); for (let i = 0; i < N * N; i++) m[i] = a[i] && b[i] ? 1 : 0; return m; };
export const shift = (a, dx, dy) => {
    const m = mk();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (a[y * N + x]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N) m[ny * N + nx] = 1; }
    return m;
};
export const flipX = a => { const m = mk(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (a[y * N + x]) m[y * N + (N - 1 - x)] = 1; return m; };

const at = (m, x, y) => (x >= 0 && y >= 0 && x < N && y < N ? m[y * N + x] : 0);

export class Pix {
    constructor() { this.c = new Array(N * N).fill(null); this.f = new Array(N * N).fill(undefined); }
    set(x, y, col) { if (x >= 0 && y >= 0 && x < N && y < N) this.c[y * N + x] = col; }
    get(x, y) { return x >= 0 && y >= 0 && x < N && y < N ? this.c[y * N + x] : null; }
    fill(mask, col) { for (let i = 0; i < N * N; i++) if (mask[i]) this.c[i] = col; }
    // Rect plein (x0,y0 inclus ; x1,y1 exclus).
    rect(x0, y0, x1, y1, col) { this.fill(box(x0, y0, x1, y1), col); }
    // Art ASCII : rows = tableau de chaines, legend = { lettre: couleur } ('.' ou ' ' = ne rien poser).
    stamp(x0, y0, rows, legend, mirror = false, feature = false) {
        rows.forEach((row, j) => [...row].forEach((ch, i) => {
            const col = legend[ch];
            if (!col) return;
            const x = mirror ? x0 + row.length - 1 - i : x0 + i, y = y0 + j;
            if (feature && x >= 0 && y >= 0 && x < N && y < N && this.f[y * N + x] === undefined) this.f[y * N + x] = this.c[y * N + x];   // couleur dessous
            this.set(x, y, col);
        }));
    }
    // Contour d'un pixel (voisinage 4) puis remplissage par rampe [hi, base, sh, deep].
    paint(mask, ramp, o = {}) {
        const { out = OUTLINE, mode = 'round', band = 3, deep = false, dither = false, rim = true } = o;
        if (out) {
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                if (mask[y * N + x]) continue;
                if (at(mask, x - 1, y) || at(mask, x + 1, y) || at(mask, x, y - 1) || at(mask, x, y + 1)) this.set(x, y, out);
            }
        }
        const [hi, base, sh, dp] = ramp;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            if (!mask[y * N + x]) continue;
            let tl = 1; while (at(mask, x - tl, y - tl)) tl++;
            let br = 1; while (at(mask, x + br, y + br)) br++;
            let col = base;
            if (mode === 'round') {
                const chord = tl + br - 1;
                const w = Math.min(band, Math.max(1, Math.round(chord / 3)));
                if (br <= w) col = (deep && br === 1 && w >= 2 && dp) ? dp : sh;
                else if (dither && br === w + 1 && ((x + y) & 1) === 0) col = sh;
                else if (rim && tl === 1 && chord >= 6) col = hi;
            } else if (mode === 'flat') {
                let r = 1; while (at(mask, x + r, y)) r++;
                let b = 1; while (at(mask, x, y + b)) b++;
                let l = 1; while (at(mask, x - l, y)) l++;
                if (r <= band || b <= 1) col = (deep && (r === 1 || b === 1) && dp) ? dp : sh;
                else if (dither && r === band + 1 && ((x + y) & 1) === 0) col = sh;
                else if (rim && l === 1) col = hi;
            }
            this.c[y * N + x] = col;
        }
    }
    // Croissant de reflet laque en haut a gauche (pixels de profondeur 2-3 depuis le bord haut-gauche, secteur haut-gauche).
    gloss(mask, col, { cx, cy, a0 = 195, a1 = 270, d0 = 2, d1 = 3, rmin = 0 } = {}) {
        let sx = 0, sy = 0, n = 0;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (mask[y * N + x]) { sx += x; sy += y; n++; }
        const ccx = cx ?? sx / n, ccy = cy ?? sy / n;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            if (!mask[y * N + x]) continue;
            let tl = 1; while (at(mask, x - tl, y - tl)) tl++;
            if (tl < d0 || tl > d1) continue;
            const a = (Math.atan2(y + 0.5 - ccy, x + 0.5 - ccx) * 180 / Math.PI + 360) % 360;
            const r = Math.hypot(x + 0.5 - ccx, y + 0.5 - ccy);
            if (a >= a0 && a <= a1 && r >= rmin) this.c[y * N + x] = col;
        }
    }
    // Ramene la palette a `max` couleurs : la couleur la moins employee (hors contour et blanc) est fondue dans la plus proche.
    limitColors(max = 16) {
        const rgb = h => { const t = h.length === 4 ? [...h.slice(1)].map(c => parseInt(c + c, 16)) : [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return t; };
        for (;;) {
            const cnt = new Map();
            this.c.forEach(c => { if (c) cnt.set(c, (cnt.get(c) || 0) + 1); });
            if (cnt.size <= max) return this;
            const [victim] = [...cnt.entries()].filter(([c]) => c !== OUTLINE && c !== '#fff').sort((a, b) => a[1] - b[1])[0];
            const rv = rgb(victim);
            let best = null, bd = 1e9;
            for (const c of cnt.keys()) {
                if (c === victim) continue;
                const rc = rgb(c); const d = Math.abs(rc[0] - rv[0]) + Math.abs(rc[1] - rv[1]) + Math.abs(rc[2] - rv[2]);
                if (d < bd) { bd = d; best = c; }
            }
            this.c = this.c.map(c => (c === victim ? best : c));
            this.f = this.f.map(c => (c === victim ? best : c));
        }
    }
    solid(x, y) { return this.get(x, y) !== null; }
    // Aligne la silhouette pour que la pixellisation 32 x 32 du jeu garde un contour continu : un pixel de contour
    // en bordure droite/basse doit tomber sur une coordonnee paire (sinon il perd le vote de son bloc 2 x 2).
    stabilize() {
        const thick = (x, y, dx, dy) => this.solid(x - dx, y - dy) && this.c[(y - dy) * N + x - dx] !== OUTLINE && this.solid(x - 2 * dx, y - 2 * dy) && this.c[(y - 2 * dy) * N + x - 2 * dx] !== OUTLINE;
        for (let it = 0; it < 8; it++) {
            const rm = [], add = [];
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                if (!this.solid(x, y)) continue;
                if ((x & 1) && !this.solid(x + 1, y)) { if (thick(x, y, 1, 0)) rm.push(y * N + x); else add.push([x + 1, y]); }
                if ((y & 1) && !this.solid(x, y + 1)) { if (thick(x, y, 0, 1)) rm.push(y * N + x); else add.push([x, y + 1]); }
            }
            if (!rm.length && !add.length) break;
            rm.forEach(i => { this.c[i] = null; });
            add.forEach(([x, y]) => { if (!this.solid(x, y)) this.set(x, y, OUTLINE); });
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                if (this.solid(x, y) && (!this.solid(x - 1, y) || !this.solid(x + 1, y) || !this.solid(x, y - 1) || !this.solid(x, y + 1))) this.c[y * N + x] = OUTLINE;
            }
        }
        // pixels orphelins (aucun voisin 4 plein) : supprimes
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            if (this.solid(x, y) && !this.solid(x - 1, y) && !this.solid(x + 1, y) && !this.solid(x, y - 1) && !this.solid(x, y + 1)) this.c[y * N + x] = null;
        }
        return this;
    }
    // SVG de rectangles alignes sur la grille, un <path> par couleur. Les couleurs sont posees dans l'ordre du peintre
    // (contour d'abord) : un rectangle peut recouvrir des pixels des couleurs POSEES APRES, ce qui divise le nombre de rectangles.
    svg(opts = {}) {
        // Option features : les traits du visage (yeux, sourcils, bouche, joues) sont emis en <path> separes et petits, apres le corps,
        // pour que side.js puisse les decaler (profil) ou les retirer (dos) ; le corps recouvre alors la couleur de dessous.
        const keep = this.c;
        const feats = [];
        if (opts.features) {
            this.c = this.c.slice();
            this.f.forEach((under, i) => { if (under !== undefined) { feats.push([i % N, Math.floor(i / N), keep[i]]); this.c[i] = under; } });
        }
        const cols = [...new Set(this.c.filter(Boolean))];
        const count = new Map(cols.map(c => [c, 0]));
        this.c.forEach(c => { if (c) count.set(c, count.get(c) + 1); });
        cols.sort((a, b) => (a === OUTLINE ? -1 : b === OUTLINE ? 1 : count.get(b) - count.get(a)));
        const rank = new Map(cols.map((c, i) => [c, i]));
        let body = '';
        cols.forEach((col, i) => {
            const own = (x, y) => this.c[y * N + x] === col;
            const ok = (x, y) => { const c = this.c[y * N + x]; return c !== null && rank.get(c) >= i; };
            const done = new Uint8Array(N * N);
            let d = '';
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                if (!own(x, y) || done[y * N + x]) continue;
                let wmax = 0; while (x + wmax < N && ok(x + wmax, y)) wmax++;
                let best = { w: 1, h: 1, a: 0 };
                for (let w = 1; w <= wmax; w++) {
                    let h = 1;
                    while (y + h < N) { let all = true; for (let k = 0; k < w; k++) if (!ok(x + k, y + h)) { all = false; break; } if (!all) break; h++; }
                    let fresh = 0; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (own(x + xx, y + yy) && !done[(y + yy) * N + x + xx]) fresh++;
                    if (fresh > best.a || (fresh === best.a && w * h < best.w * best.h)) best = { w, h, a: fresh };
                }
                for (let yy = 0; yy < best.h; yy++) for (let xx = 0; xx < best.w; xx++) if (own(x + xx, y + yy)) done[(y + yy) * N + x + xx] = 1;
                d += `M${x} ${y}h${best.w}v${best.h}h-${best.w}`;
            }
            body += `<path fill="${col}" d="${d}"/>`;
        });
        this.c = keep;
        if (feats.length) {
            // groupes de traits : composantes connexes (8 voisins), un <path> par couleur et par groupe
            const idx = new Map(feats.map(([x, y, c], i) => [y * N + x, i]));
            const seen = new Set();
            feats.forEach(([x, y], i0) => {
                if (seen.has(i0)) return;
                const group = [], stack = [i0]; seen.add(i0);
                while (stack.length) {
                    const i = stack.pop(); group.push(feats[i]);
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                        const j = idx.get((feats[i][1] + dy) * N + feats[i][0] + dx);
                        if (j !== undefined && !seen.has(j)) { seen.add(j); stack.push(j); }
                    }
                }
                const byCol = new Map();
                group.forEach(([gx, gy, c]) => { if (!byCol.has(c)) byCol.set(c, []); byCol.get(c).push([gx, gy]); });
                byCol.forEach((pts, c) => {
                    const set = new Set(pts.map(([px, py]) => py * N + px));
                    let d = '';
                    [...pts].sort((a, b) => a[1] - b[1] || a[0] - b[0]).forEach(([px, py]) => {
                        if (!set.has(py * N + px)) return;
                        let w = 1; while (set.has(py * N + px + w)) w++;
                        let h = 1; for (;;) { let all = true; for (let k = 0; k < w; k++) if (!set.has((py + h) * N + px + k)) { all = false; break; } if (!all) break; h++; }
                        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) set.delete((py + yy) * N + px + xx);
                        d += `M${px} ${py}h${w}v${h}h-${w}`;
                    });
                    body += `<path fill="${c}" d="${d}"/>`;
                });
            });
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">${body}</svg>`;
    }
    ascii() {
        const cols = [...new Set(this.c.filter(Boolean))];
        const sym = '0123456789abcdefghijklmnop';
        const rows = [];
        for (let y = 0; y < N; y++) { let r = ''; for (let x = 0; x < N; x++) { const c = this.c[y * N + x]; r += c ? sym[cols.indexOf(c)] : '.'; } rows.push(r); }
        return { rows, legend: Object.fromEntries(cols.map((c, i) => [sym[i], c])) };
    }
}


// ── Palettes (couleurs sur le reseau a 6 niveaux de la pixellisation du jeu : aucune teinte n'est deformee) ─────────────────
export const SKINS = [
    { hi: '#ffc', b: '#fc9', s: '#c96' },
    { hi: '#fc9', b: '#c96', s: '#963' },
    { hi: '#c96', b: '#963', s: '#630' }
];
export const HAIRS = {
    black: ['#669', '#336', '#333'],
    brown: ['#c63', '#930', '#630'],
    umber: ['#963', '#633', '#333'],
    white: ['#fff', '#ccc', '#999']
};
// Garnitures : deux tons seulement (or ou creme), pour tenir dans les 16 couleurs d'un sprite.
export const GOLD = ['#fe6', '#fc3', '#c90'];
const TRIM_GOLD = ['#fe6', '#fc3'], TRIM_CREAM = ['#ffc', '#fc9'], TRIM_RED = ['#f66', '#c33'];
export const ROBES = [
    { r: ['#6c9', '#396', '#063'], trim: TRIM_GOLD },        // jade
    { r: ['#f66', '#c33', '#933'], trim: TRIM_GOLD },        // rouge laque
    { r: ['#f96', '#c63', '#933'], trim: TRIM_CREAM },       // rouille
    { r: ['#69c', '#369', '#336'], trim: TRIM_CREAM },       // bleu
    { r: ['#9c6', '#693', '#363'], trim: TRIM_CREAM },       // vert
    { r: ['#c9c', '#939', '#636'], trim: TRIM_GOLD },        // pourpre
    { r: ['#fc6', '#c90', '#960'], trim: TRIM_RED },         // moutarde
    { r: ['#ccc', '#999', '#666'], trim: TRIM_GOLD }         // gris
];
export const SAFFRON = { r: ['#fc3', '#f90', '#c60'], trim: TRIM_RED };
const WOOD = ['#fc3', '#c90', '#c90'];
const STRAW = ['#fe6', '#fc3', '#c90', '#c90'];
export const IRIS = ['#c63', '#630', '#369', '#396'];

// Sourcils : motifs de 6 x 3 pixels du sourcil gauche (le droit en est le miroir).
const BROWS = { angry: ['KK....', '.KKK..', '...KKK'], sad: ['...KKK', '.KKK..', 'KK....'] };

export function compose(o) {
    o = { hair: HAIRS.black, ...o };
    const p = new Pix();
    const H = o.hooks || {};
    const age = o.age || 'adult';
    const child = age === 'child';
    const hy = child ? 3 : 0;               // la tete descend chez l'enfant (corps plus court)
    const hdy = o.headDy || 0;
    const fy = hy + hdy;
    const sk = o.skin, R = o.robe;
    const skinR = [sk.hi, sk.b, sk.s, sk.s];
    const robeR = [R.r[0], R.r[1], R.r[2], R.r[2]];
    const trimR = [R.trim[0], R.trim[1], R.trim[1]];
    const hairHat = ['straw', 'scholar', 'scarf'].includes(o.hat) || typeof o.hat === 'function' || o.hatCovers;
    const top = child ? 41 : 37;
    const ctx = { p, hy, fy, top, skinR, robeR, trimR, o, child };

    // 1. objet tenu, derriere le corps
    if (o.item === 'staff') {
        p.paint(box(48, 22, 50, 57), WOOD, { mode: 'flat', band: 1 });
        p.paint(ell(49, 21, 3.4, 3.4), GOLD, { band: 2 });
    }
    H.behind?.(ctx);

    // 2. cheveux longs derriere les epaules
    if (o.style === 'long') {
        p.paint(poly([[17, 22 + fy], [14, 36 + fy], [15, 49], [23, 47], [41, 47], [49, 49], [50, 36 + fy], [47, 22 + fy]]), o.hair, { mode: 'flat', band: 3 });
    }

    // 3. robe, ceinture, col croise
    const robe = o.robeMask || poly([[24, top], [40, top], [44, top + 11], [46, 54], [45, 56], [19, 56], [18, 54], [20, top + 11]]);
    p.paint(robe, robeR, { mode: 'flat', band: 4, dither: o.dither !== false });
    const beltY = o.beltY ?? (child ? 47 : 46);
    const bl = o.belt || trimR;
    if (!o.noBelt) {
        p.rect(21, beltY, 43, beltY + 3, bl[1]);
        p.rect(21, beltY, 43, beltY + 1, bl[0]);
        p.rect(21, beltY + 2, 43, beltY + 3, o.belt ? bl[2] : R.r[2]);
        p.rect(30, beltY - 1, 34, beltY + 4, o.belt ? bl[2] : R.r[2]);
        p.rect(31, beltY, 33, beltY + 3, bl[0]);
    }
    if (o.hem) p.rect(20, 52, 44, 53, trimR[1]);
    const lap = child ? 4 : 7;
    const cl = o.collar === undefined ? trimR[1] : o.collar;
    if (cl) for (let i = 0; i < lap; i++) {
        p.set(25 + i, top + 1 + i, cl); p.set(26 + i, top + 1 + i, cl);
        p.set(38 - i, top + 1 + i, cl); p.set(37 - i, top + 1 + i, cl);
    }
    H.afterRobe?.(ctx);

    // 4. manches et mains
    const sl = child ? 9 : 14;
    const sleeve = o.sleeveMask || poly([[24, top + 1], [20, top + 2], [15, top + 8], [15, top + sl + 1], [22, top + sl + 1], [24, top + 7]]);
    const sleeveR = o.bareArms ? skinR : robeR;
    if (!o.noHands) {
        p.paint(ell(18, top + sl + 2, 2.5, 2.2), skinR, { band: 1 });
        p.paint(ell(46, top + sl + 2, 2.5, 2.2), skinR, { band: 1 });
    }
    p.paint(sleeve, sleeveR, { mode: 'flat', band: 3 });
    p.paint(flipX(sleeve), sleeveR, { mode: 'flat', band: 3 });
    if (!o.bareArms && !o.noCuff) {
        p.rect(16, top + sl - 1, 22, top + sl + 1, trimR[1]);
        p.rect(42, top + sl - 1, 48, top + sl + 1, trimR[1]);
    }
    H.afterSleeves?.(ctx);

    // 5. objet tenu, devant
    if (o.item === 'basket') {
        const fc = GOLD;
        p.paint(box(46, 43, 48, 51), fc, { mode: 'flat', band: 1 });
        p.paint(box(52, 43, 54, 51), fc, { mode: 'flat', band: 1 });
        p.paint(poly([[43, 50], [57, 50], [55, 57], [45, 57]]), fc, { mode: 'flat', band: 2 });
    } else if (o.item === 'lantern') {
        p.paint(ell(52, 50, 4.5, 5.5), ['#f66', '#c33', '#c33'], { band: 3 });
        p.rect(49, 44, 56, 46, trimR[1]); p.rect(49, 54, 56, 56, trimR[1]);
    } else if (o.item === 'scroll') {
        p.paint(box(47, 41, 51, 53), ['#fff', '#fff', '#ccc'], { mode: 'flat', band: 1 });
        p.paint(ell(49, 41, 3, 1.6), GOLD, { band: 1 });
        p.paint(ell(49, 53, 3, 1.6), GOLD, { band: 1 });
        p.rect(47, 46, 51, 48, trimR[1]);
    } else if (o.item === 'gourd') {
        p.paint(ell(51, 47, 3, 3), GOLD, { band: 2 });
        p.paint(ell(51, 53, 4, 4), GOLD, { band: 3 });
        p.rect(50, 42, 52, 44, R.r[2]);
    }
    H.front?.(ctx);

    // 6. chaussons
    const shoe = o.shoe || [o.hair[1], o.hair[1], o.hair[2]];
    if (!o.noShoes) {
        p.paint(ell(26, 56, 4.5, 2), shoe, { band: 1 });
        p.paint(ell(38, 56, 4.5, 2), shoe, { band: 1 });
    }
    H.afterShoes?.(ctx);

    // 7. tete
    const headM = ell(32, 26 + fy, 14, 12);
    p.paint(headM, skinR, { band: sk === SKINS[2] ? 1 : 2 });
    H.afterHead?.(ctx);

    // 8. barbe / moustache
    if (o.facial === 'beard') {
        const b = poly([[21, 31 + fy], [24, 35 + fy], [32, 37 + fy], [40, 35 + fy], [43, 31 + fy], [41, 41 + fy], [36, 47 + fy], [32, 49 + fy], [28, 47 + fy], [23, 41 + fy]]);
        p.paint(inter(b, union(headM, box(0, 36 + fy, 64, 64))), o.beardCol, { mode: 'flat', band: 3 });
    }

    H.beforeHair?.(ctx);
    // 9. cheveux
    if (o.style !== 'bald' && o.style !== 'none') {
        const cap = ell(32, 25 + fy, 15.5, 13.5);
        const win = poly([[21.5, 40 + fy], [21.5, 27 + fy], [24, 21.5 + fy], [29, 23 + fy], [32, 24.5 + fy], [35, 23 + fy], [40, 21.5 + fy], [42.5, 27 + fy], [42.5, 40 + fy]]);
        const hm = minus(cap, win);
        if (!hairHat) {
            if (o.style === 'bun') p.paint(ell(32, 9 + fy, 5, 5), o.hair, { band: 2 });
            if (o.style === 'topknot') p.paint(poly([[28, 14 + fy], [29, 6 + fy], [35, 6 + fy], [36, 14 + fy]]), o.hair, { band: 2 });
            if (o.style === 'tufts' || o.style === 'twin') {
                const r = o.style === 'twin' ? 5 : 4;
                p.paint(ell(18, 14 + fy, r, r), o.hair, { band: 2 });
                p.paint(ell(46, 14 + fy, r, r), o.hair, { band: 2 });
            }
        }
        p.paint(hm, o.hair, { band: 3 });
        p.gloss(hm, o.hair[0] === '#fff' ? '#fff' : (o.glossCol || '#fff'), { cy: 25 + fy });
        if (o.pin && !hairHat) {
            if (o.style === 'bun') p.rect(34, 9 + fy, 38, 11 + fy, '#fc3');
            else p.rect(40, 14 + fy, 43, 16 + fy, '#fc3');
        }
    } else if (o.style === 'bald') {
        p.gloss(headM, sk.hi, { a0: 200, a1: 260, d0: 2, d1: 2 });
    }
    H.afterHair?.(ctx);

    // 10. visage
    const ec = o.iris || R.r[1];
    const mood = o.eyes || 'open';
    const eyeLeg = { K: OUTLINE, W: '#fff', I: ec, P: OUTLINE, G: o.glow || '#fff' };
    const rowsOf = { open: ['.KK.', 'KKKK', 'WWII', 'WWIP', 'IIPP', '.II.'], glow: ['.KK.', 'KKKK', 'WWGG', 'WGGG', 'GGGG', '.GG.'], happy: ['.KK.', 'K..K'], closed: ['K..K', '.KK.'] };
    const eyeRows = rowsOf[mood] || rowsOf.open;
    const ey = mood === 'happy' ? 28 : mood === 'closed' ? 29 : 26;
    if (mood !== 'none') [24, 36].forEach(x => p.stamp(x, ey + fy, eyeRows, eyeLeg, false, true));
    if (o.female && (mood === 'open' || mood === 'glow')) { p.stamp(23, 26 + fy, ['K'], { K: OUTLINE }, false, true); p.stamp(40, 26 + fy, ['K'], { K: OUTLINE }, false, true); }
    // sourcils
    const bc = o.brow || OUTLINE;
    if (o.brows && BROWS[o.brows]) {
        p.stamp(23, 22 + fy, BROWS[o.brows], { K: bc }, false, true);
        p.stamp(35, 22 + fy, BROWS[o.brows], { K: bc }, true, true);
    } else {
        const thick = o.female ? 1 : 2;
        for (const [bx, by] of [[23, 23], [36, 23]]) p.stamp(bx, by + fy, Array(thick).fill('KKKKK'), { K: bc }, false, true);
    }
    // joues
    const blush = o.blush === undefined ? '#f99' : o.blush;
    if (blush && o.facial !== 'beard') { p.stamp(22, 32 + fy, ['BBB', 'BBB'], { B: blush }, false, true); p.stamp(39, 32 + fy, ['BBB', 'BBB'], { B: blush }, false, true); }
    // bouche
    if (o.facial === 'beard' || o.mouth === 'none') { /* cachee */ }
    else if (o.facial === 'mustache') p.paint(box(27, 33 + fy, 37, 35 + fy), o.beardCol, { mode: 'flat', band: 1, out: false });
    else if (o.mouth === 'open') p.stamp(29, 34 + fy, ['KKKK', 'KRRK', '.KK.'], { K: OUTLINE, R: '#f66' }, false, true);
    else if (o.mouth === 'sad') p.stamp(29, 34 + fy, ['.KK.', 'K..K'], { K: OUTLINE }, false, true);
    else if (o.mouth === 'grin') p.stamp(28, 34 + fy, ['KKKKKK', '.KWWK.', '..KK..'], { K: OUTLINE, W: '#fff' }, false, true);
    else p.stamp(29, 34 + fy, ['K..K', '.KK.'], { K: OUTLINE }, false, true);
    H.afterFace?.(ctx);

    // 11. couvre-chef
    if (typeof o.hat === 'function') o.hat(ctx);
    else if (o.hat === 'straw') {
        p.paint(union(poly([[9, 22 + fy], [32, 4 + fy], [55, 22 + fy]]), ell(32, 21 + fy, 24, 3.5)), o.hatCol || STRAW, { band: 4 });
    } else if (o.hat === 'scholar') {
        p.paint(poly([[20, 21 + fy], [20, 12 + fy], [25, 5 + fy], [39, 5 + fy], [44, 12 + fy], [44, 21 + fy]]), HAIRS.black, { band: 3 });
        p.rect(20, 17 + fy, 44, 19 + fy, GOLD[1]);
    } else if (o.hat === 'scarf') {
        // foulard noue : couvre le haut du crane, noeud sur le cote droit
        const wrap = inter(ell(32, 25 + fy, 15.5, 13.5), box(0, 0, 64, 21 + fy));
        p.paint(poly([[43, 14 + fy], [52, 15 + fy], [53, 22 + fy], [48, 20 + fy]]), robeR, { mode: 'flat', band: 2 });
        p.paint(wrap, robeR, { band: 2 });
        p.rect(18, 19 + fy, 46, 21 + fy, trimR[1]);
        p.gloss(wrap, robeR[0], { cy: 25 + fy, d0: 2, d1: 2 });
    }
    H.top?.(ctx);
    return p;
}


function hashOf(id) {
    let h = 2166136261;
    for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
}
const pick = (list, h, shift) => list[(h >>> shift) % list.length];
const OLD_IDS = new Set(['aunt_liu', 'grandma_tao', 'ke_paper', 'bath_old_wang', 'grandma_altan', 'old_nomad_bayan']);
const OLD_ID = /(^|_)(old|grandma|grandpa|elder)(_|$)/;
const CHILD_IDS = new Set(['xiaobao', 'star_child_xing', 'cricket_boy_hao', 'eagle_boy_temur']);
const CHILD_ID = /(^|_)(kid|kids|boy|girl|child|orphan|twins|apprentice)(_|$)/;
const MONK_ID = /(^|_)(monk|nun)(_|$)/;
const FEMALE_IDS = new Set(['ping', 'aunt_liu', 'matchmaker_hong', 'orphan_xiaoyu', 'apprentice_zhu', 'keeper_nur', 'kids_leimei', 'widow_cai', 'cook_dada',
    'cheese_sa', 'pearl_diver_xi', 'lighthouse_ming', 'priestess_mazu', 'singer_hailing', 'child_yuer', 'astronomer_xing', 'keeper_lunar', 'spinner_yue',
    'weaver_zhinu', 'shaman_ula', 'rug_seller_zeynep', 'hermit_nu', 'incense_lanxiang', 'moon_child_lan']);
const FEMALE_ID = /(^|_)(lady|girl|nun|grandma|fairy|hua)(_|$)/;

// Description du personnage tire de l'identifiant (age, sexe, habit, coiffure...) : sert au dessin et aux tests.
export function villagerOptions(id) {
    const h = hashOf(id);
    const old = OLD_IDS.has(id) || OLD_ID.test(id);
    const child = !old && (CHILD_IDS.has(id) || CHILD_ID.test(id));
    const monk = MONK_ID.test(id);
    const female = FEMALE_IDS.has(id) || FEMALE_ID.test(id);
    const o = { age: old ? 'old' : child ? 'child' : 'adult', female };
    o.skin = SKINS[[0, 1, 0, 2, 1][(h >>> 3) % 5]];
    o.robe = monk ? SAFFRON : pick(ROBES, h, 6);
    o.hair = HAIRS[old ? 'white' : pick(['black', 'black', 'brown', 'umber'], h, 11)];
    if (monk) { o.style = 'bald'; o.hat = 'none'; }
    else if (child) { o.style = female ? 'twin' : 'tufts'; o.hat = 'none'; }
    else {
        o.style = female ? pick(['bun', 'long', 'twin', 'bun', 'long'], h, 18) : pick(['topknot', 'bun', 'topknot', 'long', 'topknot'], h, 18);
        o.hat = old ? pick(['none', female ? 'scarf' : 'scholar', 'straw'], h, 14)
            : female ? pick(['none', 'straw', 'scarf', 'none', 'scarf'], h, 14) : pick(['none', 'straw', 'scholar', 'scarf', 'none'], h, 14);
    }
    o.item = pick(['none', 'staff', 'basket', 'lantern', 'scroll', 'gourd', 'none'], h, 22);
    if (!female && !child && !monk) {
        o.facial = old ? 'beard' : pick(['none', 'none', 'mustache', 'beard', 'none'], h, 25);
        o.beardCol = o.hair;
    }
    o.iris = pick(IRIS, h, 28);
    o.eyes = old || (!child && (h & 7) === 0) ? 'happy' : 'open';
    o.mouth = child && ((h >>> 9) & 1) ? 'open' : 'smile';
    o.pin = female && ((h >>> 13) & 1) === 1;
    o.hem = ((h >>> 5) & 1) === 1;
    if (old) o.brow = '#ccc';
    return o;
}
export function villagerSprite(id) {
    const creature = creatureSprite(id);
    if (creature) return creature;
    return compose(villagerOptions(id)).stabilize().limitColors(16).svg();
}
export const villagerLook = villagerOptions;

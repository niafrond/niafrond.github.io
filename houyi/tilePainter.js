// Rendu « tuiles à la Pokémon (GBA) » de l'exploration : herbe en nappes de tons, chemins et étangs aux coins arrondis et aux
// bords irréguliers, sapins ombrés et décalés, rochers, maisons en volume. Module sans état ni DOM : chaque fonction reçoit un
// contexte 2D.
//
// Principes de la charte (voir agents/animation-pixel-art.md) : une tuile = grille de 16 unités logiques, contour sombre
// unique (#2b1b17), éclairage haut-gauche, trois tons par matière (ombre, base, lumière) + un reflet, ombres portées
// douces au sol (vers le bas-droite), bruit continu d'une tuile à l'autre (jamais de motif répété case par case),
// coordonnées arrondies au pixel de l'écran pour garder des bords nets.



import { paintDirt, paintFlagstone, paintPlanks, paintRug, paintTerrainDetail, paintWater } from './tilePainterTerrain.js';
export { BORDER_KIND, borderKindOf, drawBorderTree, drawBoulder, drawPine, drawWallTile, wallDecoOf } from './tilePainterDecor.js';
export { drawHouse } from './tilePainterBuildings.js';

export const OUTLINE = '#2b1b17';
export const TILE_GRID = 16;

const clamp = v => Math.max(0, Math.min(255, v));
const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export function shade(hex, amt) {
    const [r, g, b] = rgbOf(hex);
    return `rgb(${clamp(r + amt)},${clamp(g + amt)},${clamp(b + amt)})`;
}
// Même teinte en hexadécimal (pour dériver une couleur de feuillage ou de toit depuis la palette d'un biome).
export function darkHex(hex, amt) {
    const [r, g, b] = rgbOf(hex);
    const h = v => clamp(v).toString(16).padStart(2, '0');
    return `#${h(r + amt)}${h(g + amt)}${h(b + amt)}`;
}
// Hachage déterministe : même dessin à chaque image et à chaque rechargement.
export const cellHash = (x, y, salt = 0) => Math.abs(Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453) % 1;

// Bruit de valeurs lissé (0..1), continu sur toute la carte : les nappes d'herbe traversent les limites de tuiles.
export function noise(fx, fy, salt) {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = cellHash(x0, y0, salt), b = cellHash(x0 + 1, y0, salt);
    const c = cellHash(x0, y0 + 1, salt), d = cellHash(x0 + 1, y0 + 1, salt);
    const top = a + (b - a) * sx, bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
}

// Rectangle en unités logiques d'une tuile dont le coin haut-gauche est (px, py), arrondi au pixel.
export function unitRect(g, px, py, u, ux, uy, uw, uh, fill) {
    const x0 = Math.round(px + ux * u), y0 = Math.round(py + uy * u);
    const x1 = Math.round(px + (ux + uw) * u), y1 = Math.round(py + (uy + uh) * u);
    g.fillStyle = fill;
    g.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
}

// Ombre portée douce : ellipse sombre translucide (vers le bas-droite), posée AVANT l'objet.
export function softShadow(g, cx, cy, rx, ry, alpha = 0.26) {
    g.save();
    g.fillStyle = `rgba(20,30,10,${alpha})`;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
}

// ── Coins arrondis ─────────────────────────────────────────────────────────

// Arrondit un coin de tuile : remplit la zone extérieure d'un quart de disque de rayon r (unités) avec `outside`, puis
// trace l'arc en `edge`. corner : 'tl' | 'tr' | 'bl' | 'br'.
export function roundCorner(R, corner, r, outside, edge) {
    const fx = corner[1] === 'r', fy = corner[0] === 'b';
    for (let i = 0; i < r; i++) {
        const dy = r - i - 0.5;
        const w = r - Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
        const y = fy ? TILE_GRID - 1 - i : i;
        const x = fx ? TILE_GRID - w : 0;
        if (w > 0) R(x, y, w, 1, outside);
        if (edge) R(fx ? TILE_GRID - w - 1 : w, y, 1, 1, edge);
    }
}

// ── Sol ────────────────────────────────────────────────────────────────────

// `isPath(x, y)` / `isLiquid(x, y)` : appartenance d'une case (hors carte = faux pour l'eau, vrai pour les chemins).
// `tiled` : sol de salle (intérieur, arène) en dalles biseautées plutôt qu'en herbe.
// `isTall(x, y)` : case de hautes herbes (rencontres aléatoires, exploration.js > grassOf), dessinée en touffes sombres par-dessus le sol.
export function paintGroundTile(g, biome, tile, px, py, x, y, { isPath, isLiquid, tiled = false, biomeId = '', isTall = null, rug = null }) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
    const grass = () => paintGrass(R, biome, x, y, biomeId);
    const tall = isTall && !tiled && !isLiquid(x, y) && isTall(x, y);

    if (isLiquid(x, y)) {
        paintWater(R, biome, x, y, isLiquid, biomeId);
        return;
    }
    if (isPath(x, y) && (biomeId === 'tides' || biomeId === 'tides_calm')) {   // passerelle de bois : planches claires
        R(0, 0, 16, 16, biome.path);
        paintTerrainDetail(R, biome.path, x, y, biomeId);
        return;
    }
    if (isPath(x, y)) {
        paintDirt(R, biome, x, y, isPath, grass);
        if (tall) paintTallGrass(R, biome, x, y, isTall);
        return;
    }
    if (tiled) { if (biomeId === 'house') paintPlanks(R, biome, x, y); else paintFlagstone(R, biome, x, y); if (rug) paintRug(R, rug, x, y); return; }
    grass();
    if (tall) paintTallGrass(R, biome, x, y, isTall);
    // coins concaves : l'herbe s'arrondit autour d'un chemin ou d'un étang qui la longe sur deux côtés
    const rim = (test, inside, edge) => {
        const N = test(x, y - 1), S = test(x, y + 1), W = test(x - 1, y), E = test(x + 1, y);
        if (N && W) roundCorner(R, 'tl', 6, inside, edge);
        if (N && E) roundCorner(R, 'tr', 6, inside, edge);
        if (S && W) roundCorner(R, 'bl', 6, inside, edge);
        if (S && E) roundCorner(R, 'br', 6, inside, edge);
    };
    rim(isLiquid, biome.liquid, shade(biome.liquid, -70));
    rim(isPath, biome.path, shade(biome.path, -44));
    // rive : un liseré de sable mouillé et de roseaux là où l'herbe touche l'eau
    if (isLiquid(x, y + 1) || isLiquid(x, y - 1) || isLiquid(x - 1, y) || isLiquid(x + 1, y)) {
        const sand = shade(biome.path, -10);
        if (isLiquid(x, y - 1)) for (let i = 0; i < 16; i++) if (cellHash(x * 16 + i, y, 50) < 0.7) R(i, 0, 1, 2, sand);
        if (isLiquid(x, y + 1)) for (let i = 0; i < 16; i++) if (cellHash(x * 16 + i, y, 51) < 0.7) R(i, 14, 1, 2, sand);
        if (isLiquid(x - 1, y)) for (let i = 0; i < 16; i++) if (cellHash(x, y * 16 + i, 52) < 0.7) R(0, i, 2, 1, sand);
        if (isLiquid(x + 1, y)) for (let i = 0; i < 16; i++) if (cellHash(x, y * 16 + i, 53) < 0.7) R(14, i, 2, 1, sand);
    }
}

// Corniche (rebord à sens unique, exploration.js > ledgeAt) : une marche de terre dont la lèvre sombre regarde le sens du saut
// (dx, dy), peinte par-dessus le sol. Contour sombre unique, éclairage haut-gauche.
export function drawLedge(g, biome, tile, px, py, dx, dy, x = 0, y = 0) {
    const u = tile / TILE_GRID;
    const earth = shade(biome.path, -18), top = shade(biome.path, 14), deep = shade(biome.path, -48);
    // repère local : on peint pour un saut vers le bas (0, 1) puis on tourne les rectangles
    const rect = (ux, uy, uw, uh, fill) => {
        let rx = ux, ry = uy, rw = uw, rh = uh;
        if (dx === 1) { rx = TILE_GRID - uy - uh; ry = ux; rw = uh; rh = uw; }
        else if (dx === -1) { rx = uy; ry = ux; rw = uh; rh = uw; }
        else if (dy === -1) { ry = TILE_GRID - uy - uh; }
        unitRect(g, px, py, u, rx, ry, rw, rh, fill);
    };
    rect(0, 3, 16, 10, earth);          // talus
    rect(0, 3, 16, 3, top);             // lèvre éclairée
    rect(0, 13, 16, 3, deep);           // ombre au pied
    rect(0, 2, 16, 1, OUTLINE);         // contour haut
    rect(0, 12, 16, 1, OUTLINE);        // contour bas du talus
    for (let i = 0; i < 16; i += 2) if (cellHash(x * 16 + i, y, 71) < 0.55) rect(i, 7 + Math.floor(cellHash(x * 16 + i, y, 72) * 4), 2, 1, shade(earth, -26));
}

// Herbe : fond + nappes claires et sombres issues d'un bruit continu (blocs de 2 unités), touffes en V, fleurs rares.
function paintGrass(R, biome, x, y, biomeId = '') {
    const base = biome.a;
    R(0, 0, 16, 16, base);
    const light = shade(base, 16), deep = shade(base, -17);
    for (let j = 0; j < 8; j++) {
        let runStart = -1, runKind = 0;
        for (let i = 0; i <= 8; i++) {
            let kind = 0;
            if (i < 8) {
                const gx = x * 8 + i, gy = y * 8 + j;
                const n = 0.65 * noise(gx / 5, gy / 4, 1) + 0.35 * noise(gx / 2, gy / 2, 2);
                kind = n > 0.6 ? 1 : n < 0.36 ? 2 : 0;
            }
            if (kind !== runKind) {
                if (runKind) R(runStart * 2, j * 2, (i - runStart) * 2, 2, runKind === 1 ? light : deep);
                runStart = i; runKind = kind;
            }
        }
    }
    if (paintTerrainDetail(R, base, x, y, biomeId)) return;
    const dark = shade(base, -36), hi = shade(base, 34);
    const n = Math.floor(cellHash(x, y, 6) * 4);
    for (let i = 0; i < n; i++) {
        const tx = 1 + Math.floor(cellHash(x, y, 30 + i) * 12);
        const ty = 3 + Math.floor(cellHash(x, y, 40 + i) * 10);
        R(tx, ty, 1, 2, dark); R(tx + 2, ty, 1, 2, dark); R(tx + 1, ty + 1, 1, 1, dark); R(tx + 1, ty - 1, 1, 2, hi);
    }
    if (cellHash(x, y, 7) < 0.08) {
        const fx = 3 + Math.floor(cellHash(x, y, 8) * 9), fy = 3 + Math.floor(cellHash(x, y, 9) * 9);
        const petal = cellHash(x, y, 11) < 0.5 ? '#f6eef2' : '#f2c14e';
        R(fx, fy, 1, 1, petal); R(fx - 1, fy + 1, 1, 1, petal); R(fx + 1, fy + 1, 1, 1, petal); R(fx, fy + 2, 1, 1, petal);
        R(fx, fy + 1, 1, 1, '#d8602a');
    }
}

// Hautes herbes : nappe plus sombre que l'herbe normale (même teinte de biome), touffes de brins hauts à pointes claires, bord de
// nappe irrégulier (1 à 2 unités) là où la case voisine n'est pas en hautes herbes ; peinte par-dessus l'herbe de base.
function paintTallGrass(R, biome, x, y, isTall) {
    const base = biome.a;
    const T = biome.tall;   // palette propre au biome (poudreuse blanche et bleutée de la montagne des lanternes), sinon dérivée de la teinte de base
    const bg = T?.bg || shade(base, -30), mid = T?.mid || shade(base, -54), deep = T?.deep || shade(base, -78), tip = T?.tip || shade(base, 16);
    const N = isTall(x, y - 1), S = isTall(x, y + 1), W = isTall(x - 1, y), E = isTall(x + 1, y);
    // fond : une colonne par unité, raccourcie en haut / en bas aux bords de la nappe ; colonnes de bord éclaircies au hasard
    for (let i = 0; i < 16; i++) {
        if (i === 0 && !W || i === 15 && !E) {
            for (let j = 1; j < 15; j++) if (cellHash(x * 16 + i, y * 16 + j, 401) < 0.6) R(i, j, 1, 1, bg);
            continue;
        }
        const top = !N ? 1 + (cellHash(x * 16 + i, y, 400) < 0.45 ? 1 : 0) : 0;
        const bottom = !S ? 15 - (cellHash(x * 16 + i, y, 402) < 0.45 ? 1 : 0) : 16;
        R(i, top, 1, bottom - top, bg);
    }
    // touffes : 2 rangées de 3, décalées d'une rangée à l'autre ; chacune = brin haut central + deux brins latéraux
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
            const cx = 3 + col * 5 + (row ? 2 : 0) + Math.floor(cellHash(x * 3 + col, y * 2 + row, 410) * 2) - 1;
            const by = 7 + row * 6 + Math.floor(cellHash(x * 3 + col, y * 2 + row, 411) * 2);
            const cxx = Math.min(12, Math.max(3, cx));
            R(cxx - 2, by + 1, 5, 1, deep);                                    // pied de la touffe
            R(cxx, by - 4, 1, 5, mid); R(cxx, by - 5, 1, 1, tip);              // brin central
            R(cxx - 2, by - 2, 1, 3, deep); R(cxx - 3, by - 3, 1, 1, mid);     // brin gauche
            R(cxx + 2, by - 2, 1, 3, deep); R(cxx + 3, by - 3, 1, 1, mid);     // brin droit
            R(cxx - 1, by - 3, 1, 3, tip);                                     // reflet
        }
    }
    if (!S) R(1, 14, 14, 1, deep);                                             // ombre au pied de la nappe
}

// Frémissement : brins posés devant le héros qui se tient dans les hautes herbes (au premier plan, ils lui cachent les pieds).
// (px, py) : coin haut-gauche de la case en pixels ; `now` : temps en ms pour l'oscillation ; `moving` : amplitude plus forte.
export function drawGrassFront(g, tile, px, py, biome, now = 0, moving = false) {
    const u = tile / TILE_GRID;
    const base = biome.a;
    const T = biome.tall;
    const mid = T?.mid || shade(base, -54), deep = T?.deep || shade(base, -78), tip = T?.tip || shade(base, 16);
    g.save();
    g.imageSmoothingEnabled = false;
    g.fillStyle = T?.bg || shade(base, -30);
    g.fillRect(Math.round(px + u), Math.round(py + 13.5 * u), Math.round(14 * u), Math.max(1, Math.round(2.5 * u)));
    for (let i = 0; i < 7; i++) {
        const sway = Math.sin(now / 150 + i * 1.7) * u * (moving ? 1.6 : 0.7);
        const bx = px + (1 + i * 2.1) * u;
        const top = py + (9.5 + (i % 3) * 1.2) * u;
        const low = py + 15 * u;
        const mi = (low + top) / 2;
        const w = Math.max(2, Math.round(u * 1.3));
        g.fillStyle = deep;
        g.fillRect(Math.round(bx), Math.round(mi), w, Math.max(1, Math.round(low - mi)));
        g.fillStyle = mid;
        g.fillRect(Math.round(bx + sway), Math.round(top), w, Math.max(1, Math.round(mi - top)));
        g.fillStyle = tip;
        g.fillRect(Math.round(bx + sway), Math.round(top), w, Math.max(1, Math.round(u * 1.2)));
    }
    g.restore();
}



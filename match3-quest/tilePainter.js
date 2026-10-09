// Rendu « tuiles à la Pokémon (GBA) » de l'exploration : herbe en nappes de tons, chemins et étangs aux coins arrondis et aux
// bords irréguliers, sapins ombrés et décalés, rochers, maisons en volume. Module sans état ni DOM : chaque fonction reçoit un
// contexte 2D.
//
// Principes de la charte (voir agents/animation-pixel-art.md) : une tuile = grille de 16 unités logiques, contour sombre
// unique (#2b1b17), éclairage haut-gauche, trois tons par matière (ombre, base, lumière) + un reflet, ombres portées
// douces au sol (vers le bas-droite), bruit continu d'une tuile à l'autre (jamais de motif répété case par case),
// coordonnées arrondies au pixel de l'écran pour garder des bords nets.

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
function noise(fx, fy, salt) {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = cellHash(x0, y0, salt), b = cellHash(x0 + 1, y0, salt);
    const c = cellHash(x0, y0 + 1, salt), d = cellHash(x0 + 1, y0 + 1, salt);
    const top = a + (b - a) * sx, bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
}

// Rectangle en unités logiques d'une tuile dont le coin haut-gauche est (px, py), arrondi au pixel.
function unitRect(g, px, py, u, ux, uy, uw, uh, fill) {
    const x0 = Math.round(px + ux * u), y0 = Math.round(py + uy * u);
    const x1 = Math.round(px + (ux + uw) * u), y1 = Math.round(py + (uy + uh) * u);
    g.fillStyle = fill;
    g.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
}

// Ombre portée douce : ellipse sombre translucide (vers le bas-droite), posée AVANT l'objet.
function softShadow(g, cx, cy, rx, ry, alpha = 0.26) {
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
function roundCorner(R, corner, r, outside, edge) {
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
export function paintGroundTile(g, biome, tile, px, py, x, y, { isPath, isLiquid, tiled = false, biomeId = '' }) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
    const grass = () => paintGrass(R, biome, x, y, biomeId);

    if (isLiquid(x, y)) {
        paintWater(R, biome, x, y, isLiquid, biomeId);
        return;
    }
    if (isPath(x, y)) {
        paintDirt(R, biome, x, y, isPath, grass);
        return;
    }
    if (tiled) { paintFlagstone(R, biome, x, y); return; }
    grass();
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


// Détails de sol propres à chaque région (retourne vrai si le biome dessine son propre sol, sinon l'herbe à touffes s'applique).
function paintTerrainDetail(R, base, x, y, biomeId) {
    const h = (salt) => cellHash(x, y, salt);
    const at = (salt, span) => Math.floor(h(salt) * span);
    switch (biomeId) {
        case 'gobi': case 'coast': case 'riverbed': case 'savanna': {       // sable : rides en arcs, cailloux, brins secs
            for (let i = 0; i < 2; i++) {
                const rx = 1 + at(200 + i, 8), ry = 3 + at(210 + i, 9) + i * 2;
                R(rx, ry, 5, 1, shade(base, -22)); R(rx + 1, ry + 1, 3, 1, shade(base, 18)); R(rx - 1, ry, 1, 1, shade(base, -22));
            }
            if (h(220) < 0.2) { const px_ = 2 + at(221, 11), py_ = 3 + at(222, 10); R(px_, py_, 2, 1, shade(base, -40)); R(px_, py_ - 1, 1, 1, shade(base, 26)); }
            if (biomeId === 'savanna' && h(223) < 0.5) { const tx = 2 + at(224, 11); R(tx, 8, 1, 3, '#8a7230'); R(tx + 1, 9, 1, 2, '#a88a3a'); R(tx - 1, 9, 1, 2, '#a88a3a'); }
            if (biomeId === 'coast' && h(225) < 0.12) { const sx = 3 + at(226, 9); R(sx, 11, 3, 1, '#f4ead6'); R(sx + 1, 10, 1, 1, '#f08a7a'); }
            return true;
        }
        case 'volcano': {                                                   // cendres : éclats sombres, fissures de braise
            for (let i = 0; i < 3; i++) R(1 + at(230 + i, 12), 2 + at(240 + i, 12), 2, 1, shade(base, i ? 18 : -14));
            if (h(250) < 0.3) {
                const cx = 2 + at(251, 8), cy = 3 + at(252, 8);
                R(cx, cy, 2, 1, '#ff5a1f'); R(cx + 1, cy + 1, 2, 1, '#ff8a2e'); R(cx + 3, cy + 2, 2, 1, '#ff5a1f'); R(cx + 2, cy + 3, 1, 1, '#ffd24a');
            }
            return true;
        }
        case 'storm': {                                                     // roche de tempête : plaques, flaques sombres, mousse grise
            for (let i = 0; i < 3; i++) { const sx = 1 + at(260 + i, 10), sy = 2 + at(270 + i, 11); R(sx, sy, 4, 1, shade(base, 16)); R(sx, sy + 1, 4, 1, shade(base, -22)); }
            if (h(280) < 0.18) { const fx = 3 + at(281, 8), fy = 5 + at(282, 7); R(fx, fy, 5, 2, '#3f4478'); R(fx + 1, fy, 2, 1, '#6a70b0'); }
            return true;
        }
        case 'moon': {                                                      // poussière lunaire : cratères, éclats stellaires
            if (h(290) < 0.3) { const cx = 3 + at(291, 8), cy = 4 + at(292, 7); R(cx, cy, 5, 1, shade(base, -26)); R(cx - 1, cy + 1, 7, 2, shade(base, -14)); R(cx, cy + 3, 5, 1, shade(base, 24)); }
            if (h(293) < 0.35) { const sx = 2 + at(294, 12), sy = 2 + at(295, 12); R(sx, sy, 1, 1, '#ffffff'); R(sx - 1, sy, 3, 1, 'rgba(255,255,255,0.55)'); R(sx, sy - 1, 1, 3, 'rgba(255,255,255,0.55)'); }
            return true;
        }
        case 'fusang': {                                                    // sol doré : pétales tombés, herbe sèche
            for (let i = 0; i < 3; i++) { const fx = 1 + at(300 + i, 13), fy = 2 + at(310 + i, 12); R(fx, fy, 2, 1, i % 2 ? '#e8742e' : '#fff3b0'); R(fx + 1, fy + 1, 1, 1, '#d8602a'); }
            return false;
        }
        case 'bamboo': {                                                    // litière : feuilles tombées, mousse
            for (let i = 0; i < 3; i++) { const fx = 1 + at(320 + i, 12), fy = 2 + at(330 + i, 12); R(fx, fy, 3, 1, '#a8b878'); R(fx + 1, fy + 1, 1, 1, '#6f8a4a'); }
            return false;
        }
        case 'cave': {                                                      // cailloux et gravats
            for (let i = 0; i < 3; i++) { const cx = 1 + at(340 + i, 12), cy = 2 + at(350 + i, 12); R(cx, cy, 2, 2, shade(base, 14)); R(cx, cy + 1, 2, 1, shade(base, -20)); }
            return true;
        }
        default: return false;
    }
}

// Terre battue : nappes de teinte, cailloux, bords irréguliers (jitter d'une unité) avec lèvre claire, coins arrondis.
function paintDirt(R, biome, x, y, isPath, grass) {
    const base = biome.path;
    R(0, 0, 16, 16, base);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const n = noise((x * 8 + i) / 3, (y * 8 + j) / 3, 4);
        if (n > 0.62) R(i * 2, j * 2, 2, 2, shade(base, 10));
        else if (n < 0.34) R(i * 2, j * 2, 2, 2, shade(base, -10));
    }
    for (let i = 0; i < 4; i++) {
        const gx = 1 + Math.floor(cellHash(x, y, 10 + i) * 13), gy = 1 + Math.floor(cellHash(x, y, 20 + i) * 13);
        R(gx, gy, 2, 1, shade(base, -28)); R(gx, gy - 1, 1, 1, shade(base, 24));
    }
    const edge = shade(base, -46), lip = shade(base, 22);
    const N = isPath(x, y - 1), S = isPath(x, y + 1), W = isPath(x - 1, y), E = isPath(x + 1, y);
    const wob = (gx, gy, salt) => (cellHash(gx, gy, salt) < 0.35 ? 1 : 0);
    for (let i = 0; i < 16; i++) {
        if (!N) { const o = wob(x * 16 + i, y, 60); R(i, o, 1, 1, edge); R(i, o + 1, 1, 1, lip); if (o) R(i, 0, 1, 1, shade(biome.a, 0)); }
        if (!S) { const o = wob(x * 16 + i, y, 61); R(i, 15 - o, 1, 1, edge); if (o) R(i, 15, 1, 1, shade(biome.a, 0)); }
        if (!W) { const o = wob(x, y * 16 + i, 62); R(o, i, 1, 1, edge); R(o + 1, i, 1, 1, lip); if (o) R(0, i, 1, 1, shade(biome.a, 0)); }
        if (!E) { const o = wob(x, y * 16 + i, 63); R(15 - o, i, 1, 1, edge); if (o) R(15, i, 1, 1, shade(biome.a, 0)); }
    }
    // coins convexes : on arrondit en dévoilant l'herbe, arc sombre
    const cut = (corner) => { roundCorner(R, corner, 6, shade(biome.a, 0), edge); };
    if (!N && !W) cut('tl');
    if (!N && !E) cut('tr');
    if (!S && !W) cut('bl');
    if (!S && !E) cut('br');
}

// Eau : fond profond, vaguelettes en tirets décalés (continues d'une case à l'autre), contour sombre + écume, coins arrondis.
function paintWater(R, biome, x, y, isLiquid, biomeId = '') {
    const base = biome.liquid;
    R(0, 0, 16, 16, base);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const n = noise((x * 8 + i) / 3, (y * 8 + j) / 3, 5);
        if (n > 0.64) R(i * 2, j * 2, 2, 2, shade(base, 14));
        else if (n < 0.32) R(i * 2, j * 2, 2, 2, shade(base, -16));
    }
    // vaguelettes : tirets horizontaux sur des lignes décalées en damier
    for (let row = 0; row < 3; row++) {
        const wy = 2 + row * 5 + ((x + row) % 2);
        const wx = Math.floor(cellHash(x, y, 70 + row) * 8);
        R(wx, wy, 4, 1, shade(base, 44));
        R(wx + 5, wy + 1, 2, 1, shade(base, 28));
    }
    if (biomeId === 'volcano') {   // lave : croûte sombre fissurée, braises vives
        for (let i = 0; i < 4; i++) {
            const cx = Math.floor(cellHash(x, y, 140 + i) * 12), cy = Math.floor(cellHash(x, y, 150 + i) * 12);
            R(cx, cy, 3, 2, '#3b1a12'); R(cx + 1, cy + 2, 2, 1, '#6a2a14');
        }
        R(Math.floor(cellHash(x, y, 160) * 10), Math.floor(cellHash(x, y, 161) * 12) + 2, 3, 1, '#ffd24a');
    }
    const out = biomeId === 'volcano' ? '#2a0f0a' : shade(base, -72), foam = shade(base, 56);
    const N = isLiquid(x, y - 1), S = isLiquid(x, y + 1), W = isLiquid(x - 1, y), E = isLiquid(x + 1, y);
    if (!N) { R(0, 0, 16, 1, out); R(0, 1, 16, 1, foam); R(0, 2, 16, 1, shade(base, 24)); }
    if (!S) { R(0, 15, 16, 1, out); R(0, 14, 16, 1, shade(base, -34)); }
    if (!W) { R(0, 0, 1, 16, out); R(1, 0, 1, 16, foam); }
    if (!E) { R(15, 0, 1, 16, out); R(14, 0, 1, 16, shade(base, -26)); }
    const land = shade(biome.a, 0);
    if (!N && !W) roundCorner(R, 'tl', 6, land, out);
    if (!N && !E) roundCorner(R, 'tr', 6, land, out);
    if (!S && !W) roundCorner(R, 'bl', 6, land, out);
    if (!S && !E) roundCorner(R, 'br', 6, land, out);
}

// Dalle de salle : teinte propre à chaque dalle, biseau, veines, joints foncés.
function paintFlagstone(R, biome, x, y) {
    const t = (cellHash(x, y, 80) - 0.5) * 14;
    const base = ((x + y) % 2 ? biome.a : biome.b);
    const tone = shade(base, t);
    R(0, 0, 16, 16, tone);
    R(0, 0, 16, 1, shade(base, 24)); R(0, 0, 1, 16, shade(base, 16));
    R(0, 15, 16, 1, shade(base, -38)); R(15, 0, 1, 16, shade(base, -26));
    R(1, 14, 14, 1, shade(base, -14));
    if (cellHash(x, y, 3) < 0.45) {
        const vx = 3 + Math.floor(cellHash(x, y, 4) * 8), vy = 3 + Math.floor(cellHash(x, y, 5) * 8);
        R(vx, vy, 3, 1, shade(base, -18)); R(vx + 2, vy + 1, 2, 1, shade(base, -18));
    }
}

// ── Décors ─────────────────────────────────────────────────────────────────

// Sapin de bordure : tronc, trois étages de feuillage aux coins arrondis, 3 tons + reflets, ombre portée au sol.
// Un sapin dépasse d'environ une demi-tuile au-dessus de sa case ; `seed` varie légèrement taille, teinte et décalage.
export function drawPine(g, tile, px, py, { leaf = '#2f7a3a', trunk = '#6b3d22', seed = 0 } = {}) {
    const u = tile / TILE_GRID;
    const v = cellHash(seed, seed * 3 + 1, 90);
    const lean = Math.round((v - 0.5) * 2) * 0;                   // pas d'inclinaison : seule la taille varie
    const sc = 0.92 + 0.16 * cellHash(seed * 5, seed, 91);
    const tone = darkHex(leaf, Math.round((cellHash(seed, 7, 92) - 0.5) * 20));
    softShadow(g, px + 9.5 * u, py + 15 * u, 7 * u, 2.4 * u);
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px + lean, py, u, 8 + (ux - 8) * sc, 16 + (uy - 16) * sc * 1.15, uw * sc, uh * sc * 1.15, fill);
    const dark = shade(tone, -40), mid = shade(tone, -14), light = shade(tone, 34);
    R(7, 13, 2, 3, OUTLINE); R(7, 13, 1, 3, trunk); R(8, 13, 1, 3, shade(trunk, -28));
    const tiers = [[0, 8, 16, 6], [2, 4, 12, 6], [4, 0, 8, 5], [6, -3, 4, 4]];
    // contour (coins coupés pour l'arrondi)
    tiers.forEach(([ux, uy, uw, uh]) => {
        R(ux, uy + 1, uw, uh - 1, OUTLINE); R(ux + 1, uy, uw - 2, uh + 1, OUTLINE);
    });
    tiers.forEach(([ux, uy, uw, uh]) => {
        R(ux + 1, uy + 1, uw - 2, uh - 1, tone);
        R(ux + 2, uy, uw - 4, 1, tone);
        // ombre à droite et en bas, lumière à gauche, grain de feuillage
        R(ux + uw - 4, uy + 2, 3, uh - 2, mid);
        R(ux + uw - 3, uy + 3, 2, uh - 3, dark);
        R(ux + 1, uy + uh - 1, uw - 2, 1, dark);
        R(ux + 1, uy + 1, Math.max(2, Math.floor(uw / 3)), 2, light);
        R(ux + 1, uy + 3, 2, 1, light);
        for (let k = 0; k < 3; k++) R(ux + 3 + Math.floor(cellHash(ux, uy, 93 + k) * (uw - 7)), uy + 2 + Math.floor(cellHash(uy, ux, 96 + k) * (uh - 3)), 2, 1, dark);
    });
}


// ── Végétation de bordure par biome ────────────────────────────────────────

export const BORDER_KIND = {
    paddy: 'broadleaf', riverbed: 'reed', bamboo: 'bamboo', gobi: 'cactus', storm: 'deadpine', volcano: 'spire',
    savanna: 'acacia', coast: 'palm', fusang: 'goldtree', moon: 'crystal', cave: 'stalagmite'
};
export const borderKindOf = biomeId => BORDER_KIND[biomeId] || 'pine';

// Masse de feuillage arrondie (rangées de largeurs données, centrée en cx) : contour, ton moyen, lumière à gauche, ombre à droite.
function blob(R, cx, top, widths, tone, light, dark) {
    widths.forEach((wd, i) => R(cx - wd / 2 - 1, top + i, wd + 2, 1, OUTLINE));
    R(cx - widths[0] / 2, top - 1, widths[0], 1, OUTLINE);
    R(cx - widths[widths.length - 1] / 2, top + widths.length, widths[widths.length - 1], 1, OUTLINE);
    widths.forEach((wd, i) => {
        R(cx - wd / 2, top + i, wd, 1, tone);
        R(cx - wd / 2, top + i, Math.max(1, Math.floor(wd / 4)), 1, light);
        R(cx + wd / 2 - Math.max(2, Math.floor(wd / 3)), top + i, Math.max(2, Math.floor(wd / 3)), 1, dark);
    });
}

// Arbre / plante de bordure d'un biome ; `kind` vient de borderKindOf. Posé sur la case (px, py) et dépasse au-dessus.
export function drawBorderTree(g, tile, px, py, kind, opts = {}) {
    if (kind === 'pine') return drawPine(g, tile, px, py, opts);
    const { leaf = '#2f7a3a', seed = 0 } = opts;
    const u = tile / TILE_GRID;
    const sc = 0.92 + 0.16 * cellHash(seed * 5, seed, 91);
    const tone = darkHex(leaf, Math.round((cellHash(seed, 7, 92) - 0.5) * 18));
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, 8 + (ux - 8) * sc, 16 + (uy - 16) * sc * 1.1, uw * sc, uh * sc * 1.1, fill);
    const trunk = '#6b4a2b';
    softShadow(g, px + 9.5 * u, py + 15 * u, 6.5 * u, 2.2 * u);
    switch (kind) {
        case 'broadleaf': case 'goldtree': {
            const t = kind === 'goldtree' ? '#e0a82a' : tone;
            R(7, 10, 3, 6, OUTLINE); R(7, 10, 2, 6, trunk); R(9, 11, 1, 5, shade(trunk, -26));
            blob(R, 8, -2, [6, 10, 12, 14, 14, 14, 12, 10], t, shade(t, 32), shade(t, -34));
            R(4, 2, 2, 1, shade(t, 50)); R(7, 5, 3, 1, shade(t, -48)); R(10, 7, 2, 1, shade(t, -48));
            if (kind === 'goldtree') { R(6, 1, 1, 1, '#fff3b0'); R(10, 4, 1, 1, '#fff3b0'); R(5, 6, 1, 1, '#e8742e'); }
            break;
        }
        case 'bamboo': {
            [[3, '#7fb35a', -6], [7, '#6aa04a', -9], [11, '#8ac464', -5]].forEach(([bx, c, top]) => {
                R(bx - 1, top, 4, 16 - top, OUTLINE); R(bx, top + 1, 2, 15 - top, c); R(bx, top + 1, 1, 15 - top, shade(c, 34));
                for (let y = top + 4; y < 15; y += 4) R(bx - 1, y, 4, 1, shade(c, -50));
                R(bx + 2, top + 3, 4, 1, '#9fd06a'); R(bx - 4, top + 6, 4, 1, '#8fc058'); R(bx + 2, top + 9, 3, 1, '#9fd06a');
            });
            break;
        }
        case 'palm': {
            for (let i = 0; i < 12; i++) { const bend = Math.round(Math.sin(i / 11 * 1.6) * 2); R(7 + bend - 1, 14 - i, 4, 1, OUTLINE); R(7 + bend, 14 - i, 2, 1, i % 3 ? trunk : shade(trunk, -26)); }
            const tx = 7 + 2;
            [[-6, -1], [-5, 1], [-3, 2], [3, 2], [5, 1], [6, -1], [0, -3]].forEach(([dx, dy], k) => {
                const len = Math.abs(dx) || 2; for (let j = 0; j <= len; j++) { const fx = tx + (dx > 0 ? j : dx < 0 ? -j : 0), fy = 3 - dy * (j / len * 3) + (dy > 0 ? j * 0.4 : 0); R(fx - 0.5, fy - 0.5, 2, 2, j % 2 ? '#3f8a3a' : '#5aa84a'); }
            });
            R(tx - 1, 3, 3, 2, '#7a5a2a');
            break;
        }
        case 'acacia': {
            R(7, 7, 2, 9, OUTLINE); R(7, 7, 1, 9, trunk); R(5, 8, 2, 2, trunk); R(9, 6, 3, 2, trunk);
            blob(R, 8, 1, [8, 14, 18, 16], '#7a8f3a', '#a8bc54', '#4f6126');
            R(3, 4, 3, 1, '#c8d878');
            break;
        }
        case 'cactus': {
            R(6, 2, 5, 14, OUTLINE); R(7, 3, 3, 13, '#5d9a4a'); R(7, 3, 1, 13, '#86bf6a'); R(9, 3, 1, 13, '#3f7634');
            R(2, 6, 5, 8, OUTLINE); R(3, 7, 3, 5, '#5d9a4a'); R(3, 7, 1, 5, '#86bf6a'); R(3, 11, 5, 3, '#5d9a4a');
            R(10, 4, 5, 7, OUTLINE); R(11, 5, 3, 4, '#5d9a4a'); R(10, 9, 3, 2, '#5d9a4a');
            R(8, 1, 1, 1, '#f27aa0'); R(4, 6, 1, 1, '#f27aa0'); for (let y = 4; y < 14; y += 3) R(8, y, 1, 1, '#e8f0c8');
            break;
        }
        case 'deadpine': {
            R(7, 3, 2, 13, OUTLINE); R(7, 3, 1, 13, '#4a4038'); R(8, 3, 1, 13, '#2e2824');
            [[3, 6, 4], [9, 8, 4], [4, 11, 3], [9, 12, 3]].forEach(([bx, by, l]) => { R(bx, by, l, 2, OUTLINE); R(bx, by, l, 1, '#4a4038'); });
            R(2, 5, 2, 1, '#f4f2ea'); R(10, 7, 3, 1, '#f4f2ea'); R(6, 2, 4, 1, '#f4f2ea'); R(4, 10, 2, 1, '#f4f2ea');
            break;
        }
        case 'spire': {
            R(4, 6, 9, 10, OUTLINE); R(5, 3, 6, 4, OUTLINE); R(6, 0, 3, 4, OUTLINE);
            R(5, 7, 7, 8, '#4a3c3a'); R(6, 4, 4, 4, '#4a3c3a'); R(7, 1, 2, 4, '#5a4a48');
            R(5, 7, 3, 8, '#665452'); R(10, 8, 2, 7, '#2e2426');
            R(8, 3, 1, 3, '#ff5a1f'); R(7, 8, 1, 4, '#ff7a2e'); R(9, 10, 1, 3, '#ff5a1f'); R(8, 12, 1, 1, '#ffd24a');
            break;
        }
        case 'crystal': {
            [[3, 5, '#a8b8f0'], [7, 1, '#c8d4ff'], [11, 6, '#8a9ce0']].forEach(([cx, top, c]) => {
                R(cx - 2, top + 3, 5, 13 - top, OUTLINE); R(cx - 1, top + 1, 3, 3, OUTLINE); R(cx, top, 1, 2, OUTLINE);
                R(cx - 1, top + 3, 3, 12 - top, c); R(cx, top + 1, 1, 3, shade(c, 30));
                R(cx - 1, top + 3, 1, 10 - top, shade(c, 40)); R(cx + 1, top + 4, 1, 10 - top, shade(c, -40));
            });
            R(8, 3, 1, 1, '#ffffff'); R(4, 7, 1, 1, '#ffffff');
            break;
        }
        case 'stalagmite': {
            [[3, 6, 4], [7, 1, 5], [11, 8, 3]].forEach(([cx, top, wd]) => {
                R(cx - wd / 2 - 1, top + 3, wd + 2, 13 - top, OUTLINE); R(cx - 1, top, 3, 4, OUTLINE);
                R(cx - wd / 2, top + 3, wd, 12 - top, '#6a625a'); R(cx, top + 1, 1, 3, '#6a625a');
                R(cx - wd / 2, top + 3, 1, 10 - top, '#8a8278'); R(cx + wd / 2 - 1, top + 4, 1, 10 - top, '#47403a');
            });
            break;
        }
        case 'reed': {
            for (let i = 0; i < 7; i++) { const bx = 1 + i * 2 + (i % 2), top = 2 + ((i * 5) % 6), c = i % 2 ? '#8a7a3a' : '#a89a4a';
                R(bx, top, 1, 16 - top, OUTLINE); R(bx + (i % 2 ? 1 : 0), top + 1, 1, 15 - top, c); R(bx - 1, top, 3, 3, '#6a4a2a'); }
            R(5, 12, 7, 3, '#7a6a34');
            break;
        }
        default: return drawPine(g, tile, px, py, opts);
    }
}

// Rocher : masse irrégulière à facettes (lumière haut-gauche, ombre bas-droite), mousse, ombre portée au sol.
export function drawBoulder(g, tile, px, py) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
    softShadow(g, px + 9 * u, py + 14.5 * u, 7.5 * u, 2.2 * u);
    // contour irrégulier
    R(3, 4, 11, 11, OUTLINE); R(2, 6, 13, 7, OUTLINE); R(5, 2, 7, 3, OUTLINE); R(4, 3, 3, 2, OUTLINE);
    // faces : haut clair, flanc gauche moyen, flanc droit et bas sombres
    R(5, 3, 6, 3, '#d9d5cd'); R(4, 5, 8, 2, '#c3beb5');
    R(3, 7, 6, 5, '#aaa59c'); R(9, 6, 5, 6, '#8c887f');
    R(4, 12, 9, 2, '#6f6b64'); R(10, 12, 4, 1, '#5d5953');
    R(5, 3, 3, 1, '#f1eee6'); R(4, 5, 2, 1, '#f1eee6');
    // fissures et mousse
    R(7, 7, 1, 3, '#6f6b64'); R(8, 9, 2, 1, '#6f6b64'); R(6, 10, 1, 2, '#6f6b64');
    R(3, 11, 3, 1, '#5f8f4a'); R(4, 12, 2, 1, '#4a7a3a'); R(11, 5, 2, 1, '#6f9f55');
}

// Murs d'intérieur : planches en relief, plinthe sombre sous le mur du haut, ombre portée sur le sol.
export function drawWallTile(g, biome, tile, px, py, top) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
    const base = shade(biome.cliff, 0);
    const b = biome.cliff;
    R(0, 0, 16, 16, base);
    for (let i = 0; i < 16; i += 4) {
        R(i, 0, 1, 16, shade(b, 22)); R(i + 1, 0, 2, 16, shade(b, 8)); R(i + 3, 0, 1, 16, shade(b, -22));
    }
    R(0, 0, 16, 2, shade(b, 34));
    if (top) { R(0, 12, 16, 4, shade(b, -34)); R(0, 15, 16, 1, OUTLINE); } else R(0, 15, 16, 1, shade(b, -30));
}

// ── Bâtiments ──────────────────────────────────────────────────────────────

// Habitation de la Chine mythique (aucun élément anachronique : ni verre, ni volets, ni cheminée, ni tuiles à l'européenne) :
// murs en terre damée sur soubassement de pierre, poteaux et poutre de bois, fenêtre à barreaux de bois sur fond d'ombre,
// porte à deux vantaux de planches cloutés de bronze sous un linteau, grand toit de chaume aux avant-toits relevés.
// `thatch` : couleur de base du toit (paille, chaume sombre ou ardoise). (px, py) : coin haut-gauche de l'emprise,
// w × h en pixels, door : { dx, dy } en pixels depuis ce coin.
export function drawHouse(g, px, py, w, h, tile, thatch, door) {
    const u = tile / TILE_GRID;
    const roofH = Math.round(Math.max(tile * 0.95, h * 0.52));
    const wallTop = py + roofH - Math.round(u * 2);
    const wallH = h - (wallTop - py);
    g.save();
    g.imageSmoothingEnabled = false;
    const fill = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(ww)), Math.max(1, Math.round(hh))); };
    const wood = '#6b4a2b', woodLight = '#8a6238', woodDark = '#4a321c';

    softShadow(g, px + w * 0.55 + u * 2, py + h - u * 0.5, w * 0.62, u * 3.2, 0.28);

    // murs : terre damée (strates), côté droit à l'ombre, soubassement de pierres brutes, ombre sous le toit
    fill(px + u, wallTop, w - 2 * u, wallH, OUTLINE);
    fill(px + 2 * u, wallTop, w - 4 * u, wallH - u, '#d2b27a');
    for (let y = wallTop + u * 4; y < py + h - 5 * u; y += u * 4) fill(px + 2 * u, y, w - 4 * u, 1, '#b8975f');
    fill(px + w - 5 * u, wallTop, 3 * u, wallH - u, '#b8975f');
    fill(px + w - 3 * u, wallTop, u, wallH - u, '#a0804c');
    fill(px + 2 * u, wallTop, w - 4 * u, u * 3, 'rgba(60,40,20,0.34)');
    fill(px + 2 * u, py + h - 4 * u, w - 4 * u, 3 * u, '#8f887a');
    for (let sx = px + 2 * u, k = 0; sx < px + w - 3 * u; sx += u * 3.5, k++) fill(sx, py + h - (k % 2 ? 3 : 4) * u, 1, u * 2, '#5f594d');
    // poteaux de bois aux angles et poutre sous l'avant-toit
    fill(px + 2 * u, wallTop, u * 2, wallH - u, wood); fill(px + 2 * u, wallTop, 1, wallH - u, woodLight);
    fill(px + w - 4 * u, wallTop, u * 2, wallH - u, woodDark);
    fill(px + 2 * u, wallTop + u * 2, w - 4 * u, u * 1.4, wood);

    // fenêtres : ouverture à barreaux de bois sur fond d'ombre (pas de vitre)
    const winW = Math.round(tile * 0.38), winH = Math.round(tile * 0.34);
    const winY = wallTop + Math.round((wallH - winH) * 0.42);
    const doorCx = px + door.dx + tile / 2;
    [0.22, 0.68].forEach(fx => {
        const wx = Math.round(px + w * fx);
        if (Math.abs(wx + winW / 2 - doorCx) < tile * 0.6) return;
        fill(wx - 2, winY - 2, winW + 4, winH + 4, OUTLINE);
        fill(wx - 1, winY - 1, winW + 2, winH + 2, wood);
        fill(wx, winY, winW, winH, '#2a1d12');
        for (let bx = wx + Math.round(u * 1.5); bx < wx + winW - 1; bx += Math.max(3, Math.round(u * 2.6))) fill(bx, winY, Math.max(1, Math.round(u * 0.8)), winH, woodLight);
    });

    // porte : deux vantaux de planches, clous de bronze, linteau, seuil de pierre
    const dx = px + door.dx, dy = py + door.dy;
    const dW = Math.round(tile * 0.66), dxl = dx + Math.round((tile - dW) / 2);
    const top = dy + tile * 0.1, dh = tile * 0.9;
    fill(dxl - 2, top - 2, dW + 4, dh + 2, OUTLINE);
    fill(dxl, top, dW, dh, '#6b4326');
    fill(dxl, top, dW / 2 - 1, dh, '#7d4f2d');
    fill(dxl + dW / 2 - 1, top, 2, dh, OUTLINE);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        fill(dxl + dW * (c ? 0.62 : 0.2), top + dh * (0.2 + r * 0.26), Math.max(2, u * 1.4), Math.max(2, u * 1.4), '#d6b04e');
    }
    fill(dxl - u * 2, top - u * 2, dW + u * 4, u * 2.2, wood);
    fill(dxl - u * 2, top - u * 2, dW + u * 4, 1, woodLight);
    fill(dxl - u * 2, dy + tile - u * 1.6, dW + u * 4, Math.max(2, u * 1.6), '#a39c8a');
    fill(dxl - u * 2, dy + tile - 1, dW + u * 4, 1, '#6f6a5c');

    // toit de chaume : masse épaisse, brins en diagonale, arête nouée, frange irrégulière, avant-toits relevés aux extrémités
    const rx = px - Math.round(u * 2), rw = w + Math.round(u * 4);
    const body = roofH - 3;
    fill(rx - 1, py, rw + 2, roofH, OUTLINE);
    fill(rx, py + 1, rw, body, thatch);
    for (let sy = py + 2; sy < py + body; sy += Math.max(2, Math.round(u * 1.7))) {
        for (let sx = rx + ((sy - py) % 3); sx < rx + rw - 1; sx += Math.max(3, Math.round(u * 2.4))) {
            const hsh = cellHash(sx, sy, 130);
            fill(sx, sy, 1, Math.max(2, u * 1.6), hsh < 0.5 ? shade(thatch, -34) : shade(thatch, 30));
        }
    }
    fill(rx, py + 1, rw, Math.max(2, u * 2), shade(thatch, -48));                 // faîtage lié
    for (let sx = rx + u * 2; sx < rx + rw - u; sx += u * 5) fill(sx, py + 1, Math.max(1, u * 0.9), Math.max(2, u * 2), shade(thatch, 36));
    fill(rx + rw - Math.round(u * 3), py + 1 + u * 2, Math.round(u * 3), body - u * 2, 'rgba(0,0,0,0.18)');
    for (let sx = rx; sx < rx + rw; sx++) {                                       // frange basse
        const drop = Math.floor(cellHash(sx, py, 131) * u * 2.2);
        fill(sx, py + roofH - 3, 1, drop + 1, shade(thatch, -22));
        fill(sx, py + roofH - 3 + drop, 1, 1, OUTLINE);
    }
    fill(rx, py + roofH - 3 - Math.max(2, u * 1.3), rw, Math.max(2, u * 1.3), shade(thatch, -52));
    // extrémités relevées
    fill(rx - u * 1.5, py + roofH - u * 4, u * 2, u * 2, OUTLINE); fill(rx - u * 0.8, py + roofH - u * 5, u * 1.4, u * 2, thatch);
    fill(rx + rw - u * 0.5, py + roofH - u * 4, u * 2, u * 2, OUTLINE); fill(rx + rw - u * 0.6, py + roofH - u * 5, u * 1.4, u * 2, thatch);
    g.restore();
    return { roofH };
}

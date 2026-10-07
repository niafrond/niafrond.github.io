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
export function paintGroundTile(g, biome, tile, px, py, x, y, { isPath, isLiquid, tiled = false }) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
    const grass = () => paintGrass(R, biome, x, y);

    if (isLiquid(x, y)) {
        paintWater(R, biome, x, y, isLiquid, grass);
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
function paintGrass(R, biome, x, y) {
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
function paintWater(R, biome, x, y, isLiquid) {
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
    const out = shade(base, -72), foam = shade(base, 56);
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

// Maison en volume : ombre portée, murs crépis avec soubassement en pierre et ombre sous l'avant-toit, fenêtres à volets,
// porte à auvent, grand toit à rangs de tuiles avec arête claire et cheminée. (px, py) : coin haut-gauche de l'emprise,
// w × h en pixels, door : { dx, dy } en pixels depuis ce coin.
export function drawHouse(g, px, py, w, h, tile, roof, door) {
    const u = tile / TILE_GRID;
    const roofH = Math.round(Math.max(tile * 0.95, h * 0.52));
    const wallTop = py + roofH - Math.round(u * 2);
    const wallH = h - (wallTop - py);
    g.save();
    g.imageSmoothingEnabled = false;
    const fill = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(ww)), Math.max(1, Math.round(hh))); };

    // ombre portée au sol, vers la droite
    softShadow(g, px + w * 0.55 + u * 2, py + h - u * 0.5, w * 0.62, u * 3.2, 0.28);

    // cheminée (derrière le toit)
    if (w >= tile * 2) {
        const cx = px + w * 0.74, cw = Math.round(u * 4);
        fill(cx - 1, py - u * 4, cw + 2, u * 6, OUTLINE);
        fill(cx, py - u * 3, cw, u * 5, '#9a4a38');
        fill(cx, py - u * 3, Math.round(u * 1.5), u * 5, '#b86048');
        fill(cx - u, py - u * 4, cw + 2 * u, u * 1.4, '#6f6b64');
    }

    // murs : contour, crépi clair + ombre à droite, soubassement de pierre, ombre sous le toit
    fill(px + u, wallTop, w - 2 * u, wallH, OUTLINE);
    fill(px + 2 * u, wallTop, w - 4 * u, wallH - u, '#f1e8d2');
    fill(px + w - 5 * u, wallTop, 3 * u, wallH - u, '#d9cca8');
    fill(px + w - 3 * u, wallTop, u, wallH - u, '#c5b78f');
    fill(px + 2 * u, wallTop, w - 4 * u, u * 3, 'rgba(60,40,20,0.30)');
    fill(px + 2 * u, py + h - 4 * u, w - 4 * u, 3 * u, '#9a917a');
    for (let sx = px + 2 * u, k = 0; sx < px + w - 3 * u; sx += u * 3.5, k++) fill(sx, py + h - (k % 2 ? 3 : 4) * u, 1, u * 2, '#6f6853');

    // fenêtres à croisillon, volets et rebord
    const winW = Math.round(tile * 0.42), winH = Math.round(tile * 0.36);
    const winY = wallTop + Math.round((wallH - winH) * 0.3);
    const doorCx = px + door.dx + tile / 2;
    [0.2, 0.7].forEach(fx => {
        const wx = Math.round(px + w * fx);
        if (Math.abs(wx + winW / 2 - doorCx) < tile * 0.6) return;
        fill(wx - u * 2, winY - 1, u * 2, winH + 2, '#3f7d4e'); fill(wx + winW, winY - 1, u * 2, winH + 2, '#3f7d4e');
        fill(wx - 1, winY - 1, winW + 2, winH + 2, OUTLINE);
        fill(wx, winY, winW, winH, '#8fd0ee');
        fill(wx, winY, winW, Math.round(winH * 0.34), '#d3f0fa');
        fill(wx + winW - u * 2, winY, u * 2, winH, '#6fb4d6');
        fill(wx + Math.round(winW / 2) - 1, winY, 2, winH, OUTLINE);
        fill(wx, winY + Math.round(winH / 2) - 1, winW, 2, OUTLINE);
        fill(wx - 2, winY + winH + 1, winW + 4, Math.max(2, u * 1.4), '#b3a98c');
    });

    // porte à auvent et marche
    const dx = px + door.dx, dy = py + door.dy;
    const dW = Math.round(tile * 0.62), dxl = dx + Math.round((tile - dW) / 2);
    fill(dxl - 1, dy + tile * 0.1 - 1, dW + 2, tile * 0.9 + 1, OUTLINE);
    fill(dxl, dy + tile * 0.1, dW, tile * 0.9, '#8a4e2a');
    fill(dxl, dy + tile * 0.1, dW / 2 - 1, tile * 0.9, '#a85f34');
    fill(dxl + dW / 2, dy + tile * 0.1, 1, tile * 0.9, OUTLINE);
    fill(dxl + dW - u * 3, dy + tile * 0.55, Math.max(2, u * 1.2), Math.max(2, u * 1.2), '#f2c14e');
    fill(dxl - u, dy + tile * 0.06, dW + 2 * u, u * 2, shade(roof.startsWith('#') ? roof : '#b23a30', -30));
    fill(dxl - u * 2, dy + tile - u * 1.6, dW + 4 * u, Math.max(2, u * 1.6), '#cfc8b2');
    fill(dxl - u * 2, dy + tile - 1, dW + 4 * u, 1, '#8a8470');

    // toit : contour, rangs de tuiles décalés, arête claire, ombre sous l'avant-toit
    const rx = px - Math.round(u * 1.5), rw = w + Math.round(u * 3);
    fill(rx - 1, py, rw + 2, roofH, OUTLINE);
    fill(rx, py + 1, rw, roofH - 3, roof);
    fill(rx, py + 1, rw, Math.max(2, u * 1.6), shade(roof, 52));
    fill(rx, py + 1 + u * 1.6, rw, Math.max(1, u * 0.8), shade(roof, 24));
    const rows = Math.max(3, Math.round(roofH / (u * 4)));
    const rowH = (roofH - 3) / rows;
    for (let r = 1; r < rows; r++) {
        const ry = py + Math.round(rowH * r);
        fill(rx, ry, rw, Math.max(1, u * 0.9), shade(roof, -42));
        const step = Math.round(u * 5), off = (r % 2) * Math.round(u * 2.5);
        for (let sx = rx + off; sx < rx + rw; sx += step) fill(sx, ry - rowH + 2, 1, rowH - 2, shade(roof, -26));
    }
    fill(rx + rw - Math.round(u * 3), py + 1, Math.round(u * 3), roofH - 3, 'rgba(0,0,0,0.16)');
    fill(rx, py + roofH - 3 - Math.max(2, u * 1.4), rw, Math.max(2, u * 1.4), shade(roof, -56));
    fill(rx - 1, py + roofH - 2, rw + 2, 2, OUTLINE);
    g.restore();
    return { roofH };
}

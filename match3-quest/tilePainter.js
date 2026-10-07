// Rendu « tuiles à la Pokémon (GBA) » de l'exploration : sol à touffes, chemins bordés, eau à reflets, sapins
// de bordure, rochers de salle, maisons à grand toit. Module sans état ni DOM : chaque fonction reçoit un contexte 2D.
//
// Principes de la charte (voir agents/animation-pixel-art.md) : une tuile = grille de 16 unités logiques, contour sombre
// unique (#2b1b17), éclairage haut-gauche, deux tons par matière (base + ombre) et un reflet, aucune ombre portée floue,
// coordonnées arrondies au pixel de l'écran pour garder des bords nets.

export const OUTLINE = '#2b1b17';
export const TILE_GRID = 16;

const clamp = v => Math.max(0, Math.min(255, v));
export function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${clamp((n >> 16) + amt)},${clamp(((n >> 8) & 255) + amt)},${clamp((n & 255) + amt)})`;
}
// Même teinte en hexadécimal (pour dériver une couleur de feuillage ou de toit depuis la palette d'un biome).
export function darkHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const h = v => clamp(v).toString(16).padStart(2, '0');
    return `#${h((n >> 16) + amt)}${h(((n >> 8) & 255) + amt)}${h((n & 255) + amt)}`;
}
// Hachage déterministe d'une case : même dessin à chaque image et à chaque rechargement.
export const cellHash = (x, y, salt = 0) => Math.abs(Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453) % 1;

// Rectangle en unités logiques d'une tuile dont le coin haut-gauche est (px, py), arrondi au pixel.
function unitRect(g, px, py, u, ux, uy, uw, uh, fill) {
    const x0 = Math.round(px + ux * u), y0 = Math.round(py + uy * u);
    const x1 = Math.round(px + (ux + uw) * u), y1 = Math.round(py + (uy + uh) * u);
    g.fillStyle = fill;
    g.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
}

// ── Sol ────────────────────────────────────────────────────────────────────

// `isPath(x, y)` / `isLiquid(x, y)` : appartenance d'une case (hors carte = faux).
// `tiled` : sol de salle (intérieur, arène) en dalles biseautées plutôt qu'en herbe.
export function paintGroundTile(g, biome, tile, px, py, x, y, { isPath, isLiquid, tiled = false }) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);

    if (isLiquid(x, y)) {
        const base = biome.liquid;
        R(0, 0, 16, 16, base);
        // reflets : deux traits clairs décalés selon la case, comme les vaguelettes de Pokémon
        const o = Math.floor(cellHash(x, y, 1) * 6);
        R(2 + o, 4, 4, 1, shade(base, 38));
        R(8 - Math.floor(o / 2), 11, 5, 1, shade(base, 38));
        R(4 + o, 12, 2, 1, shade(base, -22));
        // écume sur les rives : un liseré clair du côté où l'eau rencontre la terre
        if (!isLiquid(x, y - 1)) R(0, 0, 16, 2, shade(base, 52));
        if (!isLiquid(x, y + 1)) R(0, 14, 16, 2, shade(base, -34));
        if (!isLiquid(x - 1, y)) R(0, 0, 2, 16, shade(base, 36));
        if (!isLiquid(x + 1, y)) R(14, 0, 2, 16, shade(base, -26));
        return;
    }

    if (isPath(x, y)) {
        const base = biome.path;
        R(0, 0, 16, 16, (x + y) % 2 ? base : shade(base, -4));
        // gravillons
        for (let i = 0; i < 3; i++) {
            const gx = Math.floor(cellHash(x, y, 10 + i) * 13) + 1;
            const gy = Math.floor(cellHash(x, y, 20 + i) * 13) + 1;
            R(gx, gy, 1, 1, shade(base, i % 2 ? -26 : 20));
        }
        // bordure : terre sombre puis liseré clair du côté où le chemin rencontre l'herbe
        const edge = shade(base, -42), lip = shade(base, 24);
        if (!isPath(x, y - 1)) { R(0, 0, 16, 1, edge); R(0, 1, 16, 1, lip); }
        if (!isPath(x, y + 1)) { R(0, 15, 16, 1, edge); }
        if (!isPath(x - 1, y)) { R(0, 0, 1, 16, edge); R(1, 0, 1, 16, lip); }
        if (!isPath(x + 1, y)) { R(15, 0, 1, 16, edge); }
        return;
    }

    const base = (x + y) % 2 ? biome.a : biome.b;
    R(0, 0, 16, 16, base);
    if (tiled) {
        // dalle de salle : biseau clair en haut / à gauche, sombre en bas / à droite, joint dans la couleur du mur
        R(0, 0, 16, 1, shade(base, 22));
        R(0, 0, 1, 16, shade(base, 14));
        R(0, 15, 16, 1, shade(base, -34));
        R(15, 0, 1, 16, shade(base, -22));
        if (cellHash(x, y, 3) < 0.35) R(Math.floor(cellHash(x, y, 4) * 10) + 3, Math.floor(cellHash(x, y, 5) * 10) + 3, 2, 1, shade(base, -16));
        return;
    }
    // herbe : touffes en V d'un ton plus sombre, parfois une fleur ; le damier se lit à peine
    const n = 1 + Math.floor(cellHash(x, y, 6) * 3);
    for (let i = 0; i < n; i++) {
        const tx = 1 + Math.floor(cellHash(x, y, 30 + i) * 12);
        const ty = 2 + Math.floor(cellHash(x, y, 40 + i) * 11);
        const dark = shade(biome.a, -30), light = shade(biome.a, 26);
        R(tx, ty, 1, 2, dark);
        R(tx + 2, ty, 1, 2, dark);
        R(tx + 1, ty + 1, 1, 1, dark);
        R(tx + 1, ty - 1, 1, 1, light);
    }
    if (cellHash(x, y, 7) < 0.07) {
        const fx = 3 + Math.floor(cellHash(x, y, 8) * 9), fy = 3 + Math.floor(cellHash(x, y, 9) * 9);
        const petal = cellHash(x, y, 11) < 0.5 ? '#f4e9ee' : '#f2c14e';
        R(fx, fy, 1, 1, petal); R(fx - 1, fy + 1, 1, 1, petal); R(fx + 1, fy + 1, 1, 1, petal); R(fx, fy + 2, 1, 1, petal);
        R(fx, fy + 1, 1, 1, '#d8602a');
    }
}

// ── Décors ─────────────────────────────────────────────────────────────────

// Sapin de bordure (arbres serrés au pourtour des cartes). Posé sur la case (px, py), un peu plus haut que la case.
export function drawPine(g, tile, px, py, { leaf = '#2f7a3a', trunk = '#6b3d22' } = {}) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
    const dark = shade(leaf, -34), light = shade(leaf, 30);
    // tronc
    R(7, 13, 2, 3, OUTLINE); R(7, 13, 1, 3, trunk); R(8, 13, 1, 3, shade(trunk, -26));
    // trois étages de feuillage, du plus large au plus étroit, contour sombre d'abord
    const tiers = [[1, 8, 14, 6], [3, 4, 10, 6], [5, 1, 6, 5]];
    tiers.forEach(([ux, uy, uw, uh]) => R(ux - 1 + 0, uy - 1, uw + 2, uh + 1, OUTLINE));
    tiers.forEach(([ux, uy, uw, uh]) => {
        R(ux, uy, uw, uh, leaf);
        R(ux, uy, Math.max(2, Math.floor(uw / 3)), uh, light);
        R(ux + uw - Math.max(2, Math.floor(uw / 3)), uy + 1, Math.max(2, Math.floor(uw / 3)), uh - 1, dark);
        R(ux + 1, uy + uh - 1, uw - 2, 1, dark);
    });
}

// Rocher rond gris à contour sombre (blocs des salles d'arène, éboulis).
export function drawBoulder(g, tile, px, py) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
    // contour arrondi : trois bandes d'abord, remplissage ensuite
    R(3, 3, 10, 12, OUTLINE); R(2, 5, 12, 8, OUTLINE); R(4, 2, 8, 1, OUTLINE);
    R(4, 4, 8, 10, '#a6a29c'); R(3, 6, 10, 6, '#a6a29c'); R(5, 3, 6, 1, '#a6a29c');
    // lumière haut-gauche, ombre bas-droite, fissure
    R(4, 4, 4, 2, '#d8d4cc'); R(3, 6, 2, 3, '#d8d4cc');
    R(10, 8, 3, 4, '#7c7872'); R(5, 12, 8, 1, '#7c7872');
    R(7, 7, 1, 3, '#7c7872'); R(8, 9, 1, 2, '#7c7872');
}

// Haie / muret de jardin décoratif (dalles de bordure d'un intérieur : bois sombre).
export function drawWallTile(g, biome, tile, px, py, top) {
    const u = tile / TILE_GRID;
    const R = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
    const base = shade(biome.cliff, top ? -6 : 8);
    R(0, 0, 16, 16, base);
    // planches verticales
    for (let i = 0; i < 16; i += 4) { R(i, 0, 1, 16, shade(base, 10)); R(i + 3, 0, 1, 16, shade(base, -16)); }
    if (top) R(0, 13, 16, 3, shade(base, -34));
    R(0, 0, 16, 1, shade(base, 24));
}

// ── Bâtiments ──────────────────────────────────────────────────────────────

// Maison à grand toit plat à rangs de tuiles, murs clairs, fenêtres à croisillon, porte à marche (le toit déborde).
// (px, py) : coin haut-gauche de l'emprise, w × h en pixels, door : { dx, dy } en pixels depuis le coin, dw : largeur de porte.
export function drawHouse(g, px, py, w, h, tile, roof, door) {
    const u = tile / TILE_GRID;
    const roofH = Math.round(Math.max(tile * 0.95, h * 0.52));
    const wallTop = py + roofH - Math.round(u * 2);
    const wallH = h - (wallTop - py);
    g.save();
    g.imageSmoothingEnabled = false;
    const fill = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); };

    // murs : contour, crépi clair, ombre à droite, soubassement
    fill(px + u, wallTop, w - 2 * u, wallH, OUTLINE);
    fill(px + 2 * u, wallTop, w - 4 * u, wallH - u, '#efe6cf');
    fill(px + w - 4 * u, wallTop, 2 * u, wallH - u, '#d6c9a6');
    fill(px + 2 * u, py + h - 3 * u, w - 4 * u, 2 * u, '#a39a82');

    // fenêtres à croisillon, de part et d'autre de la porte
    const winW = Math.round(tile * 0.42), winH = Math.round(tile * 0.36);
    const winY = wallTop + Math.round((wallH - winH) * 0.32);
    const doorCx = px + door.dx + tile / 2;
    [0.2, 0.7].forEach(fx => {
        const wx = Math.round(px + w * fx);
        if (Math.abs(wx + winW / 2 - doorCx) < tile * 0.6) return;
        fill(wx - 1, winY - 1, winW + 2, winH + 2, OUTLINE);
        fill(wx, winY, winW, winH, '#8fd0ee');
        fill(wx, winY, winW, Math.round(winH * 0.3), '#c8ecf8');
        fill(wx + Math.round(winW / 2) - 1, winY, 2, winH, OUTLINE);
        fill(wx, winY + Math.round(winH / 2) - 1, winW, 2, OUTLINE);
        fill(wx - 2, winY + winH + 1, winW + 4, Math.max(2, Math.round(u)), '#a39a82');
    });

    // porte à marche
    const dx = px + door.dx, dy = py + door.dy;
    const dW = Math.round(tile * 0.62), dxl = dx + Math.round((tile - dW) / 2);
    fill(dxl - 1, dy + Math.round(tile * 0.1) - 1, dW + 2, Math.round(tile * 0.9) + 1, OUTLINE);
    fill(dxl, dy + Math.round(tile * 0.1), dW, Math.round(tile * 0.9), '#8a4e2a');
    fill(dxl, dy + Math.round(tile * 0.1), Math.round(dW / 2) - 1, Math.round(tile * 0.9), '#a85f34');
    fill(dxl + dW - Math.round(u * 3), dy + Math.round(tile * 0.55), Math.max(2, Math.round(u * 1.2)), Math.max(2, Math.round(u * 1.2)), '#f2c14e');
    fill(dxl - Math.round(u), dy + tile - Math.round(u * 1.5), dW + Math.round(u * 2), Math.max(2, Math.round(u * 1.5)), '#c9c2ac');

    // toit : contour, rangs de tuiles décalés, rive claire en haut, ombre sous l'avant-toit
    const rx = px - Math.round(u * 1.5), rw = w + Math.round(u * 3);
    fill(rx - 1, py, rw + 2, roofH, OUTLINE);
    fill(rx, py + 1, rw, roofH - 3, roof);
    fill(rx, py + 1, rw, Math.max(2, Math.round(u * 1.4)), shade(roof, 44));
    const rows = Math.max(3, Math.round(roofH / (u * 4)));
    for (let r = 1; r < rows; r++) {
        const ry = py + Math.round((roofH - 3) * r / rows);
        fill(rx, ry, rw, Math.max(1, Math.round(u * 0.8)), shade(roof, -38));
        const step = Math.round(u * 5), off = (r % 2) * Math.round(u * 2.5);
        for (let sx = rx + off; sx < rx + rw; sx += step) fill(sx, ry - Math.round(roofH / rows) + 1, 1, Math.round(roofH / rows) - 1, shade(roof, -24));
    }
    fill(rx, py + roofH - 3 - Math.max(2, Math.round(u * 1.2)), rw, Math.max(2, Math.round(u * 1.2)), shade(roof, -50));
    fill(rx - 1, py + roofH - 2, rw + 2, 2, OUTLINE);
    g.restore();
    return { roofH };
}

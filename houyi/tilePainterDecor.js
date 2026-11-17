// Décors de bordure de la vue d exploration : pins, arbres de bordure, rochers, murs. Extrait de tilePainter.js.
import { OUTLINE, TILE_GRID, cellHash, darkHex, shade, softShadow, unitRect } from './tilePainter.js';

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
    paddy: 'fence', riverbed: 'reed', bamboo: 'bamboo', gobi: 'cactus', storm: 'deadpine', volcano: 'spire',
    savanna: 'acacia', coast: 'palm', fusang: 'goldtree', moon: 'crystal', cave: 'stalagmite',
    wandering_souls: 'souls',   // Royaume des âmes errantes (événement) : racines noires
    winter_lantern_mountain: 'pine'   // Montagne des lanternes enneigées (événement) : sapins enneigés
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
        case 'souls': {   // racines noires torsadées et brume : tronc d'encre, branches nues, lueur vert fantôme
            const ink = '#1d2130', mid = '#4a5270';
            R(5, 4, 6, 12, OUTLINE); R(6, 5, 4, 11, ink); R(6, 5, 1, 11, mid); R(8, 7, 1, 7, mid);
            [[3, 4, 4, 2], [1, 2, 3, 2], [9, 3, 4, 2], [12, 1, 3, 2], [5, 1, 2, 4], [10, 0, 2, 3]].forEach(([bx, by, bw, bh]) => { R(bx - 1, by - 1, bw + 2, bh + 2, OUTLINE); R(bx, by, bw, bh, ink); });
            R(3, 14, 4, 2, ink); R(9, 14, 5, 2, ink);
            R(8, 8, 1, 1, '#78b8a0'); R(4, 4, 1, 1, '#78b8a0'); R(12, 2, 1, 1, '#78b8a0'); R(7, 12, 1, 1, '#315f54');
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
        case 'spire': {   // petit volcan fumant : cône de basalte, cratère de lave, coulée orange, panache de fumée
            blob(R, 8, 3, [4, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14, 16], '#4a3c3a', '#6a5856', '#2e2426');
            R(6, 2, 4, 1, OUTLINE); R(6, 3, 4, 1, '#ff7a2e'); R(7, 3, 2, 1, '#ffd24a'); R(5, 4, 1, 1, '#2e2426'); R(10, 4, 1, 1, '#2e2426');
            [[9, 5], [9, 6], [10, 7], [10, 8], [10, 9], [11, 10], [11, 11], [11, 12]].forEach(([fx, fy]) => { R(fx, fy, 1, 1, '#ff5a1f'); R(fx - 1, fy, 1, 1, '#ffb030'); });
            R(5, 9, 1, 1, '#ff7a2e'); R(4, 11, 1, 1, '#ff5a1f'); R(6, 12, 1, 1, '#ffb030');
            R(3, 13, 2, 1, '#665452'); R(12, 13, 2, 1, '#2e2426');
            blob(R, 9, -2, [3, 5, 5, 3], '#8a8280', '#aaa2a0', '#605a58');
            blob(R, 6, -5, [2, 3, 2], '#a89f9c', '#c4bcb8', '#7a7270');
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
        case 'fence': {   // petite barrière de bois : deux piquets pointus et deux lisses pleine largeur (les cases voisines se rejoignent)
            const F = (ux, uy, uw, uh, fill) => unitRect(g, px, py, u, ux, uy, uw, uh, fill);
            const wood = '#a8864a', dark = '#7a5c30', light = '#c8a468';
            const lean = cellHash(seed, 3, 95) < 0.25 ? 1 : 0;   // un piquet de travers de temps en temps
            F(0, 6, 16, 3, OUTLINE); F(0, 10, 16, 3, OUTLINE);
            F(0, 7, 16, 1, wood); F(0, 8, 16, 1, dark); F(0, 11, 16, 1, wood); F(0, 12, 16, 1, dark); F(0, 7, 16, 0.5, light);
            [[2, 0], [11, lean]].forEach(([bx, off]) => {
                F(bx - 1 + off, 3, 5, 13, OUTLINE); F(bx + off, 2, 3, 1, OUTLINE); F(bx + 1 + off, 1, 1, 1, OUTLINE);
                F(bx + off, 4, 3, 11, wood); F(bx + 1 + off, 3, 1, 1, wood); F(bx + off, 4, 1, 11, light); F(bx + 2 + off, 5, 1, 10, dark); F(bx + 1 + off, 8, 1, 1, dark);
            });
            break;
        }
        case 'reed': {   // gerbe de riz mûr : tiges dorées en éventail, épis lourds qui retombent, lien rouge, feuilles vertes au pied
            const px1 = (x, y, fill) => R(Math.round(x), Math.round(y), 1, 1, fill);
            const stalk = (x1, y1, bend, fn) => { for (let t = 0; t <= 1.001; t += 0.04) fn(8 + (x1 - 8) * t + Math.sin(t * Math.PI) * bend, 15 - (15 - y1) * t); };
            const stalks = [[1, 2, -2], [4, -2, -1], [8, -4, 0], [12, -2, 1], [15, 2, 2], [6, 1, -1], [10, 1, 1]];
            stalks.forEach(([x1, y1, bend]) => stalk(x1, y1, bend, (x, y) => { px1(x - 1, y, OUTLINE); px1(x + 1, y, OUTLINE); px1(x, y - 1, OUTLINE); }));
            stalks.forEach(([x1, y1, bend], i) => stalk(x1, y1, bend, (x, y) => px1(x, y, i % 2 ? '#d8b040' : '#e8c858')));
            stalks.forEach(([x1, y1, bend]) => {   // épi : grains pâles en grappe, plus lourds du côté où l'épi retombe
                const dir = x1 < 8 ? -1 : 1;
                [[0, 0], [dir, 1], [dir, 2], [0, 1], [dir * 2, 2]].forEach(([gx, gy]) => { px1(x1 + gx - 1, y1 + gy, OUTLINE); });
                [[0, 0], [dir, 1], [dir, 2], [0, 1], [dir * 2, 2]].forEach(([gx, gy], k) => px1(x1 + gx, y1 + gy, k % 2 ? '#f6e08a' : '#fff0b0'));
            });
            R(5, 8, 7, 3, OUTLINE); R(6, 9, 5, 1, '#c8402e'); R(6, 9, 2, 1, '#e8604a');   // lien de paille tressée
            R(1, 12, 6, 3, OUTLINE); R(2, 12, 4, 2, '#6a9a3a'); R(2, 12, 2, 1, '#8aba52');
            R(10, 12, 6, 3, OUTLINE); R(11, 12, 4, 2, '#5a8a32'); R(13, 12, 2, 1, '#8aba52');
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
// Décor du mur du fond d'une maison : 1 = fenêtre à treillis de bois, 2 = rouleau peint, 0 = mur nu (jamais sur les coins ni la porte).
export function wallDecoOf(x, w) {
    if (x < 2 || x > w - 3) return 0;
    return [1, 0, 2, 0, 1, 0, 2, 0][x % 8];
}

export function drawWallTile(g, biome, tile, px, py, top, deco = 0) {
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
    if (deco === 1) {   // fenêtre : cadre de bois, papier huilé, croisillons
        R(2, 2, 12, 9, '#5a3a24'); R(3, 3, 10, 7, '#f1dfae');
        R(7, 3, 2, 7, '#7a5232'); R(3, 6, 10, 1, '#7a5232');
    } else if (deco === 2) {   // rouleau vertical : baguettes, papier, idéogramme
        R(4, 1, 8, 1, '#5a3a24'); R(5, 2, 6, 9, '#efe3c0'); R(4, 11, 8, 1, '#5a3a24');
        R(7, 3, 2, 6, '#2b1b17'); R(6, 5, 4, 1, '#2b1b17');
    }
}

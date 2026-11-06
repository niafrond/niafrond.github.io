// Détails de sol de la vue d exploration : terre, eau, planches, tapis, dalles, détails propres à chaque région. Extrait de tilePainter.js.
import { SOULS_FLOOR } from './sprites/soulsFloor.js';
import { WINTER_FLOOR } from './sprites/winterFloor.js';
import { cellHash, noise, roundCorner, shade } from './tilePainter.js';

// Détails de sol propres à chaque région (retourne vrai si le biome dessine son propre sol, sinon l'herbe à touffes s'applique).
export function paintTerrainDetail(R, base, x, y, biomeId) {
    const h = (salt) => cellHash(x, y, salt);
    const at = (salt, span) => Math.floor(h(salt) * span);
    switch (biomeId) {
        case 'tides': case 'tides_calm': {                                  // planches de ponton : lames sombres, clous, nœuds du bois
            for (let i = 0; i < 4; i++) R(0, 1 + i * 4, 16, 1, shade(base, -34));
            for (let i = 0; i < 4; i++) { const nx = 1 + at(360 + i, 12); R(nx, 2 + i * 4, 1, 1, shade(base, 26)); if (h(365 + i) < 0.35) R(nx + 3, 3 + i * 4, 2, 1, shade(base, -20)); }
            R(1, 2, 1, 1, '#2a1c10'); R(14, 2, 1, 1, '#2a1c10'); R(1, 10, 1, 1, '#2a1c10'); R(14, 10, 1, 1, '#2a1c10');
            return true;
        }
        case 'gobi': case 'coast': case 'savanna': {       // sable : rides en arcs, cailloux, brins secs ; nappes de gravier (gobi), de galets (côte), de terre battue (savane)
            if (noise(x / 3, y / 3, 600) > 0.68) {
                for (let i = 0; i < 7; i++) { const gx = 1 + at(610 + i, 13), gy = 2 + at(620 + i, 12); R(gx, gy, 2, 1, shade(base, i % 2 ? -30 : 20)); if (biomeId === 'coast') R(gx, gy - 1, 1, 1, shade(base, 36)); }
                return true;
            }
            for (let i = 0; i < 2; i++) {
                const rx = 1 + at(200 + i, 8), ry = 3 + at(210 + i, 9) + i * 2;
                R(rx, ry, 5, 1, shade(base, -22)); R(rx + 1, ry + 1, 3, 1, shade(base, 18)); R(rx - 1, ry, 1, 1, shade(base, -22));
            }
            if (h(220) < 0.2) { const px_ = 2 + at(221, 11), py_ = 3 + at(222, 10); R(px_, py_, 2, 1, shade(base, -40)); R(px_, py_ - 1, 1, 1, shade(base, 26)); }
            if (biomeId === 'savanna' && h(223) < 0.5) { const tx = 2 + at(224, 11); R(tx, 8, 1, 3, '#8a7230'); R(tx + 1, 9, 1, 2, '#a88a3a'); R(tx - 1, 9, 1, 2, '#a88a3a'); }
            if (biomeId === 'coast' && h(225) < 0.12) { const sx = 3 + at(226, 9); R(sx, 11, 3, 1, '#f4ead6'); R(sx + 1, 10, 1, 1, '#f08a7a'); }
            return true;
        }
        case 'riverbed': {                                                  // vase humide : sillons sombres, flaques luisantes, galets mouillés ; argile craquelée par nappes
            if (noise(x / 3, y / 3, 630) > 0.66) {
                let cx = 1 + at(640, 12), cy = 1 + at(641, 5);
                for (let s = 0; s < 7; s++) { R(cx, cy, 2, 1, shade(base, -40)); R(cx, cy + 1, 1, 1, shade(base, 16)); cx += h(650 + s) < 0.5 ? 2 : 1; cy += h(660 + s) < 0.5 ? 1 : 2; if (cx > 14 || cy > 14) break; }
                return true;
            }
            for (let i = 0; i < 2; i++) {
                const rx = 1 + at(200 + i, 8), ry = 3 + at(210 + i, 9) + i * 2;
                R(rx, ry, 5, 1, shade(base, -20)); R(rx + 1, ry + 1, 3, 1, shade(base, 10));
            }
            if (h(220) < 0.3) { const fx = 2 + at(221, 9), fy = 4 + at(222, 8); R(fx, fy, 4, 2, shade(base, -34)); R(fx + 1, fy, 2, 1, shade(base, 22)); }
            if (h(223) < 0.15) { const px_ = 2 + at(224, 11), py_ = 3 + at(225, 10); R(px_, py_, 2, 1, shade(base, -44)); R(px_, py_ - 1, 1, 1, shade(base, 18)); }
            return true;
        }
        case 'paddy': {                                                     // rizière asséchée : terre sèche, terre craquelée, boue durcie, paille (par nappes)
            const n = noise(x / 3.5, y / 3.5, 400), kind = n < 0.3 ? 'crack' : n < 0.55 ? 'dry' : n < 0.8 ? 'mud' : 'straw';
            if (kind === 'dry') {
                for (let i = 0; i < 4; i++) R(1 + at(410 + i, 13), 2 + at(420 + i, 12), 2, 1, shade(base, i % 2 ? 14 : -12));
            } else if (kind === 'crack') {                                  // plaques de terre fendillée : lignes brisées sombres, lèvres claires
                const crack = shade(base, -46), lip = shade(base, 18);
                for (let k = 0; k < 2; k++) {
                    let cx = 1 + at(430 + k, 14), cy = 1 + at(435 + k, 4) + k * 6;
                    for (let s = 0; s < 6; s++) { R(cx, cy, 2, 1, crack); R(cx, cy + 1, 1, 1, lip); cx += h(440 + k * 7 + s) < 0.5 ? 2 : 1; cy += h(450 + k * 7 + s) < 0.5 ? 1 : 2; if (cx > 14 || cy > 14) break; }
                }
            } else if (kind === 'mud') {                                    // boue durcie : croûte plus sombre, sillons séchés, éclats clairs
                R(1, 3, 14, 10, shade(base, -14));
                for (let i = 0; i < 3; i++) { const ry = 4 + i * 3 + at(460 + i, 2), rx = 2 + at(465 + i, 4); R(rx, ry, 8, 1, shade(base, -32)); R(rx + 1, ry + 1, 6, 1, shade(base, 6)); }
                R(2 + at(470, 11), 3 + at(471, 9), 2, 1, shade(base, 28));
            } else {                                                        // paille : brins couchés dorés
                for (let i = 0; i < 5; i++) { const sx = 1 + at(480 + i, 11), sy = 2 + at(490 + i, 12); R(sx, sy, 4, 1, i % 2 ? '#d8b860' : '#b8963f'); R(sx + 3, sy - 1, 1, 1, '#e8cc78'); }
            }
            return true;
        }
        case 'volcano': {                                                   // cendres : éclats sombres, roche cendrée, sol fissuré, fissures de braise
            const kind = noise(x / 3, y / 3, 500) > 0.62 ? 'ash' : noise(x / 3, y / 3, 510) > 0.66 ? 'cracked' : 'plain';
            if (kind === 'ash') {                                           // roche cendrée : plaques grises poudreuses
                for (let i = 0; i < 5; i++) { const ax = 1 + at(520 + i, 12), ay = 2 + at(530 + i, 12); R(ax, ay, 3, 1, shade(base, 34)); R(ax + 1, ay + 1, 2, 1, shade(base, 18)); }
                return true;
            }
            if (kind === 'cracked') {                                       // sol fissuré : fentes sombres sans braise
                let cx = 1 + at(540, 4), cy = 2 + at(541, 8);
                for (let s = 0; s < 7; s++) { R(cx, cy, 2, 1, shade(base, -36)); R(cx, cy + 1, 1, 1, shade(base, 14)); cx += h(550 + s) < 0.5 ? 2 : 1; cy += h(560 + s) < 0.5 ? 1 : 0; if (cx > 14) break; }
                return true;
            }
            for (let i = 0; i < 3; i++) R(1 + at(230 + i, 12), 2 + at(240 + i, 12), 2, 1, shade(base, i ? 18 : -14));
            if (h(250) < 0.3) {
                const cx = 2 + at(251, 8), cy = 3 + at(252, 8);
                R(cx, cy, 2, 1, '#ff5a1f'); R(cx + 1, cy + 1, 2, 1, '#ff8a2e'); R(cx + 3, cy + 2, 2, 1, '#ff5a1f'); R(cx + 2, cy + 3, 1, 1, '#ffd24a');
            }
            return true;
        }
        case 'wandering_souls': {                                           // Royaume des âmes errantes : joints de dalles, fentes, rares lueurs de flamme spectrale
            // dalle de pierre générée (tools/gen-souls-floor.mjs, sprites/soulsFloor.js) : 16×16, une des variantes au hasard stable selon la case
            SOULS_FLOOR.tiles[at(300, SOULS_FLOOR.tiles.length)].forEach((row, ry) => {
                for (let rx = 0, end; rx < 16; rx = end) { end = rx + 1; while (end < 16 && row[end] === row[rx]) end++; R(rx, ry, end - rx, 1, SOULS_FLOOR.palette[parseInt(row[rx], 16)]); }
            });
            if (h(350) < 0.12) { const gx = 3 + at(351, 9), gy = 3 + at(352, 9); R(gx, gy, 2, 2, '#315f54'); R(gx, gy, 1, 1, '#78b8a0'); }
            return true;
        }
        case 'storm': {                                                     // roche de tempête : plaques, flaques sombres, mousse grise
            for (let i = 0; i < 3; i++) { const sx = 1 + at(260 + i, 10), sy = 2 + at(270 + i, 11); R(sx, sy, 4, 1, shade(base, 16)); R(sx, sy + 1, 4, 1, shade(base, -22)); }
            if (h(280) < 0.18) { const fx = 3 + at(281, 8), fy = 5 + at(282, 7); R(fx, fy, 5, 2, '#3f4478'); R(fx + 1, fy, 2, 1, '#6a70b0'); }
            return true;
        }
        case 'winter_lantern_mountain': {                                   // Montagne des lanternes enneigées : dalle de neige générée (tools/gen-winter-floor.mjs, sprites/winterFloor.js)
            WINTER_FLOOR.tiles[at(700, WINTER_FLOOR.tiles.length)].forEach((row, ry) => {
                for (let rx = 0, end; rx < 16; rx = end) { end = rx + 1; while (end < 16 && row[end] === row[rx]) end++; R(rx, ry, end - rx, 1, WINTER_FLOOR.palette[parseInt(row[rx], 16)]); }
            });
            return true;
        }
        case 'moon': {                                                      // poussière lunaire : cratères, éclats stellaires ; dalles de pierre de jade par nappes
            if (noise(x / 3, y / 3, 670) > 0.7) {
                R(1, 1, 14, 14, '#9ac8b4'); R(1, 1, 14, 1, '#c4e6d6'); R(1, 14, 14, 1, '#6a9a86'); R(7, 1, 1, 14, '#6a9a86'); R(2 + at(671, 10), 3 + at(672, 9), 3, 1, '#e4f6ee');
                return true;
            }
            if (h(290) < 0.3) { const cx = 3 + at(291, 8), cy = 4 + at(292, 7); R(cx, cy, 5, 1, shade(base, -26)); R(cx - 1, cy + 1, 7, 2, shade(base, -14)); R(cx, cy + 3, 5, 1, shade(base, 24)); }
            if (h(293) < 0.35) { const sx = 2 + at(294, 12), sy = 2 + at(295, 12); R(sx, sy, 1, 1, '#ffffff'); R(sx - 1, sy, 3, 1, 'rgba(255,255,255,0.55)'); R(sx, sy - 1, 1, 3, 'rgba(255,255,255,0.55)'); }
            return true;
        }
        case 'fusang': {                                                    // sol doré : pétales tombés, herbe sèche, mousse lumineuse et feuilles écarlates
            if (noise(x / 3, y / 3, 680) > 0.7) for (let i = 0; i < 4; i++) { const mx = 1 + at(690 + i, 13), my = 2 + at(700 + i, 12); R(mx, my, 2, 1, '#b8f0a0'); R(mx, my + 1, 1, 1, '#7acb78'); }
            else if (noise(x / 3, y / 3, 710) > 0.72) for (let i = 0; i < 3; i++) { const lx = 1 + at(720 + i, 12), ly = 2 + at(730 + i, 12); R(lx, ly, 3, 1, '#d8301e'); R(lx + 1, ly + 1, 1, 1, '#a8201a'); }
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
export function paintDirt(R, biome, x, y, isPath, grass) {
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
export function paintWater(R, biome, x, y, isLiquid, biomeId = '') {
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
    if (biomeId === 'tides' || biomeId === 'tides_calm') {   // mer de nuit : reflets de lune ; en zone de combat, des algues dressées comme de hautes herbes
        for (let i = 0; i < 2; i++) R(Math.floor(cellHash(x, y, 170 + i) * 12), 1 + Math.floor(cellHash(x, y, 175 + i) * 13), 3, 1, 'rgba(255,236,180,0.34)');
        if (biomeId === 'tides') for (let i = 0; i < 4; i++) {
            const bx = 1 + Math.floor(cellHash(x, y, 180 + i) * 13), by = 6 + Math.floor(cellHash(x, y, 185 + i) * 6);
            R(bx, by + 2, 1, 4, '#0b6a63'); R(bx + (i % 2 ? 1 : -1), by, 1, 3, '#1f9a86'); R(bx, by - 1, 1, 1, '#6fe0c0');
        }
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

// Parquet de maison : lattes de bois horizontales, joints décalés d'une rangée à l'autre, nœuds et veines discrets.
export function paintPlanks(R, biome, x, y) {
    const base = shade(biome.a, (cellHash(x, y, 81) - 0.5) * 10);
    R(0, 0, 16, 16, base);
    for (let i = 0; i < 16; i += 8) {
        R(0, i, 16, 1, shade(base, -34));
        R(0, i + 1, 16, 1, shade(base, 14));
        const j = Math.floor(cellHash(x, y + i, 82) * 12) + 2;   // joint vertical décalé
        R(j, i, 1, 8, shade(base, -30));
        if (cellHash(x, y + i, 83) < 0.5) R(3 + Math.floor(cellHash(y, x + i, 84) * 8), i + 4, 4, 1, shade(base, -14));
    }
}

// Tapis tissé : fond rouge, liseré doré sur le pourtour, losange doré en damier au centre, franges aux deux extrémités.
export function paintRug(R, rug, x, y) {
    const cx = x - rug.x, cy = y - rug.y;
    if (cx < 0 || cy < 0 || cx >= rug.w || cy >= rug.h) return;
    const west = cx === 0, east = cx === rug.w - 1, north = cy === 0, south = cy === rug.h - 1;
    R(0, 0, 16, 16, (x + y) % 2 ? '#a83a32' : '#9c3530');
    if (north) { R(0, 0, 16, 2, '#f0c860'); R(0, 2, 16, 1, '#6a2420'); }
    if (south) { R(0, 14, 16, 2, '#f0c860'); R(0, 13, 16, 1, '#6a2420'); }
    if (west) { R(0, 0, 2, 16, '#f0c860'); R(2, 0, 1, 16, '#6a2420'); }
    if (east) { R(14, 0, 2, 16, '#f0c860'); R(13, 0, 1, 16, '#6a2420'); }
    if (west) for (let i = 1; i < 16; i += 3) R(0, i, 1, 1, '#f4ecd8');
    if (east) for (let i = 1; i < 16; i += 3) R(15, i, 1, 1, '#f4ecd8');
    if ((cx + cy) % 2 === 0) { R(7, 4, 2, 8, '#f0c860'); R(4, 7, 8, 2, '#f0c860'); R(6, 6, 4, 4, '#2f6f73'); R(7, 7, 2, 2, '#f4ecd8'); }
}

// Dalle de salle : teinte propre à chaque dalle, biseau, veines, joints foncés.
export function paintFlagstone(R, biome, x, y) {
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

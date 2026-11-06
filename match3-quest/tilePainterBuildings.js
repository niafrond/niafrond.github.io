// Bâtiments de la vue d exploration (maisons, toits, portes). Extrait de tilePainter.js.
import { OUTLINE, TILE_GRID, cellHash, shade, softShadow } from './tilePainter.js';

// ── Bâtiments ──────────────────────────────────────────────────────────────

// Habitation de la Chine mythique (aucun élément anachronique : ni verre, ni volets, ni cheminée, ni tuiles à l'européenne) :
// murs en terre damée sur soubassement de pierre, poteaux et poutre de bois, fenêtre à barreaux de bois sur fond d'ombre,
// porte à deux vantaux de planches cloutés de bronze sous un linteau, grand toit de chaume aux avant-toits relevés.
// `thatch` : couleur de base du toit (paille, chaume sombre ou ardoise). (px, py) : coin haut-gauche de l'emprise,
// w × h en pixels, door : { dx, dy } en pixels depuis ce coin.
export function drawHouse(g, px, py, w, h, tile, thatch, door, stilts = false) {
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
    if (stilts) {   // pilotis : plancher débordant, poteaux de bois enfoncés dans l'eau, reflet sombre entre eux
        const baseY = py + h - Math.round(u * 5);
        fill(px + u, baseY, w - 2 * u, Math.round(u * 2), woodLight);
        fill(px + u, baseY + Math.round(u * 2), w - 2 * u, Math.round(u * 3), '#0b2a3d');
        const n = Math.max(3, Math.floor(w / (u * 6)));
        for (let k = 0; k < n; k++) fill(px + u * 2 + (w - u * 6) * k / (n - 1), baseY + Math.round(u * 2), Math.round(u * 2), Math.round(u * 3.5), woodDark);
    }
    g.restore();
    return { roofH };
}

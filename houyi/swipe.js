// Glisser pour échanger des tuiles : module pur (aucun DOM), branché sur le plateau par board.js.
// Un doigt (ou la souris) posé sur une tuile et glissé vers une voisine échange les deux, comme deux appuis successifs.

/** Distance minimale (px) avant qu'un mouvement compte comme un glisser : un quart de tuile, jamais moins de 10 px. */
export const swipeThreshold = tileSize => Math.max(10, Math.round((tileSize || 0) * 0.25));

/**
 * Tuile voisine visée par un glisser parti de `index` (plateau carré de `size` cases), ou `null` : mouvement trop court, ou sortie du plateau.
 * L'axe dominant décide (en diagonale, le plus grand des deux déplacements).
 */
export function swipeTarget(index, size, dx, dy, threshold) {
    if (!Number.isInteger(index) || !(size > 0)) return null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
    const row = Math.floor(index / size), col = index % size;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const r = row + (horizontal ? 0 : Math.sign(dy));
    const c = col + (horizontal ? Math.sign(dx) : 0);
    if (r < 0 || c < 0 || r >= size || c >= size) return null;
    return r * size + c;
}

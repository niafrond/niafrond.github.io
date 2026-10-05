// Points de préparation du terrain (voir terrain.js) posés sur les zones sauvages qui abritent des ennemis :
//  - `trap` / `tallGrass` sur des points de passage des patrouilleurs (l'ennemi qui s'y trouve au contact commence altéré) ;
//  - `outlook` (belvédère) un peu plus loin : un combat lancé de là démarre avec un plateau favorable.
// Déterministe (aucun hasard) : les mêmes cartes donnent toujours les mêmes spots.

const inRect = (rects, x, y) => (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function addPrepSpots(screen) {
    screen.spots = [];
    if (!screen.id.endsWith('_wild')) return;
    const enemies = (screen.enemies || []).filter(e => !e.boss && !e.illusion && !e.shieldedBy && !e.arena);
    if (!enemies.length) return;
    const taken = new Set([
        ...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || []), ...(screen.exits || [])
    ].map(e => `${e.x},${e.y}`));
    const free = (x, y) => x >= 1 && y >= 1 && x < screen.w - 1 && y < screen.h - 1
        && !inRect(screen.obstacles, x, y) && !inRect(screen.liquids, x, y) && !taken.has(`${x},${y}`);
    const place = (kind, x, y) => { screen.spots.push({ kind, x, y }); taken.add(`${x},${y}`); };

    // pièges et hautes herbes sur les trajets de patrouille
    let n = 0;
    enemies.filter(e => e.kind === 'patrol' && e.patrol).forEach(e => {
        const wp = e.patrol.slice(1).find(p => free(p.x, p.y)) || null;
        if (wp) place(n++ % 2 === 0 ? 'trap' : 'tallGrass', wp.x, wp.y);
    });

    // belvédère : case libre à la bonne distance du premier ennemi
    const first = enemies[0];
    const aggro = Number.isInteger(first.aggro) && first.aggro >= 1 ? first.aggro : 2;
    const find = (min, max) => {
        for (let d = min; d <= max; d++) {
            for (let dy = -d; dy <= d; dy++) {
                for (let dx = -d; dx <= d; dx++) {
                    const x = first.x + dx, y = first.y + dy;
                    if (cheb({ x, y }, first) === d && free(x, y) && enemies.every(e => cheb({ x, y }, e) > (e.aggro || 2))) return { x, y };
                }
            }
        }
        return null;
    };
    const outlook = find(aggro + 3, aggro + 7);
    if (outlook) place('outlook', outlook.x, outlook.y);
}

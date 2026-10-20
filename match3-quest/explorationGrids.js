// Grilles de cases (obstacles, liquides) et liste des décors fixes d'un écran, mises en cache : `inRects` parcourait tous les rectangles
// pour chacune des ~1 000 cases de chaque image. Logique pure (sans DOM). Le cache est invalidé si l'un des tableaux de l'écran est
// remplacé (world/barriers.js les réaffecte) ; ils ne sont jamais modifiés en place une fois le monde assemblé.
const gridCache = new WeakMap();

export function rectGrid(screen, rects) {
    const grid = new Uint8Array(screen.w * screen.h);
    (rects || []).forEach(([rx, ry, rw, rh]) => {
        for (let y = Math.max(0, ry); y < Math.min(screen.h, ry + rh); y++) for (let x = Math.max(0, rx); x < Math.min(screen.w, rx + rw); x++) grid[y * screen.w + x] = 1;
    });
    return grid;
}

/** @returns {{ obst: Uint8Array, liq: Uint8Array, path: Uint8Array, blocks: Array<{depth:number, kind:'pillar'|'block', x:number, y:number}> }} */
export function gridsOf(screen) {
    let g = gridCache.get(screen);
    if (!g || g.obstacles !== screen.obstacles || g.liquids !== screen.liquids || g.paths !== screen.paths || g.pillars !== screen.pillars || g.buildings !== screen.buildings) {
        const obst = rectGrid(screen, screen.obstacles), liq = rectGrid(screen, screen.liquids), path = rectGrid(screen, screen.paths);
        const inBuilding = (x, y) => (screen.buildings || []).some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
        const pillarCells = new Set((screen.pillars || []).map(([px, py]) => `${px},${py}`));
        const blocks = [];   // décors fixes (piliers, rochers) dans l'ordre colonne puis ligne, à trier par profondeur au dessin
        for (let x = 0; x < screen.w; x++) {
            for (let y = 0; y < screen.h; y++) {
                if (pillarCells.has(`${x},${y}`)) { blocks.push({ depth: y, kind: 'pillar', x, y }); continue; }
                if (obst[y * screen.w + x] === 1 && !inBuilding(x, y)) blocks.push({ depth: y, kind: 'block', x, y });
            }
        }
        g = { obstacles: screen.obstacles, liquids: screen.liquids, paths: screen.paths, pillars: screen.pillars, buildings: screen.buildings, obst, liq, path, blocks };
        gridCache.set(screen, g);
    }
    return g;
}

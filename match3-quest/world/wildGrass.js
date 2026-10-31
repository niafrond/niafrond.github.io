// Zones sauvages : moins d'obstacles décoratifs, plus de hautes herbes. Logique pure, appliquée par `assembleWorld` en toute fin
// (après les barrières, les structures et l'élagage des herbes), pour ne rien changer au placement des gardiens, piliers et structures.
//  - Les petits amas d'obstacles (≤ 8 cases : rochers, touffes, bosquets isolés) loin des bords sont en grande partie remplacés
//    par des hautes herbes, qui débordent sur le sol voisin ;
//  - des bandes d'herbe sont semées en plus sur le sol nu.
// Jamais touchés : murs et grandes masses, bordures (couloirs de passage), piliers, rochers scellés, structures, bâtiments, entités,
// sorties, chemins, eau, cartes aquatiques (les hautes herbes y sont l'eau elle-même). Déterministe (tirage stable selon la case).

import { toSet, toRects, buildingCells, entityCells, routeCells } from './expand.js';

const key = (x, y) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MARGIN_X = 6, MARGIN_Y = 4;   // bordure intacte : couloirs et défilés des passages de bord
const MAX_CLUMP = 8;                // au-delà, c'est un mur ou une masse de relief
const KEEP = 0.3;                   // part des amas conservés
const hash = (x, y) => Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;

export const isThickenable = screen =>
    screen.kind === 'wild' && !screen.interior && !screen.arena && !screen.aquatic && Boolean(screen.grass) && !screen.grass.water;

export function thickenGrass(screen) {
    if (!isThickenable(screen)) return screen;
    const { w, h } = screen;
    const obst = toSet(screen.obstacles), liq = toSet(screen.liquids), paths = toSet(screen.paths);
    const grass = toSet(screen.grass.cells);
    const prot = new Set([...buildingCells(screen), ...entityCells(screen), key(screen.spawn.x, screen.spawn.y)]);
    (screen.exits || []).forEach(e => prot.add(key(e.x, e.y)));
    (screen.pillars || []).concat(screen.sealed || []).forEach(([x, y]) => prot.add(key(x, y)));
    (screen.spots || []).forEach(sp => prot.add(key(sp.x, sp.y)));
    (screen.enemies || []).forEach(e => { (e.wall || []).forEach(([x, y]) => prot.add(key(x, y))); if (e.patrol) routeCells(e.patrol).forEach(c => prot.add(key(c.x, c.y))); });
    if (screen.waypoint) prot.add(key(screen.waypoint.x, screen.waypoint.y));
    (screen.structures || []).forEach(s => { for (let i = -1; i <= s.w; i++) for (let j = -1; j <= s.h; j++) prot.add(key(s.x + i, s.y + j)); });
    const near = (x, y, set) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (set.has(key(x + dx, y + dy))) return true; return false; };
    const edge = (x, y) => x < MARGIN_X || y < MARGIN_Y || x >= w - MARGIN_X || y >= h - MARGIN_Y;

    const seen = new Set(), converted = [];
    for (const k of [...obst]) {
        if (seen.has(k)) continue;
        const comp = [], stack = [k];
        seen.add(k);
        while (stack.length) {
            const [cx, cy] = stack.pop().split(',').map(Number);
            comp.push([cx, cy]);
            STEPS.forEach(([dx, dy]) => { const nk = key(cx + dx, cy + dy); if (obst.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); } });
        }
        if (comp.length > MAX_CLUMP) continue;
        if (comp.some(([x, y]) => edge(x, y) || near(x, y, prot) || paths.has(key(x, y)))) continue;
        const [ax, ay] = comp[0];
        if (hash(ax, ay) < KEEP) continue;
        comp.forEach(([x, y]) => { obst.delete(key(x, y)); grass.add(key(x, y)); converted.push([x, y]); });
    }
    const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !obst.has(key(x, y)) && !liq.has(key(x, y)) && !paths.has(key(x, y)) && !prot.has(key(x, y)) && !edge(x, y);
    converted.forEach(([cx, cy]) => {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            if (free(cx + dx, cy + dy) && hash(cx + dx + 5, cy + dy + 9) < 0.7) grass.add(key(cx + dx, cy + dy));
        }
    });
    for (let by = MARGIN_Y; by + 3 <= h - MARGIN_Y; by += 3) for (let bx = MARGIN_X; bx + 4 <= w - MARGIN_X; bx += 4) {
        if (hash(bx * 3 + 1, by * 5 + 2) >= 0.25) continue;
        for (let y = by; y < by + 3; y++) for (let x = bx; x < bx + 4; x++) {
            if (free(x, y) && hash(x + 17, y + 3) < 0.85) grass.add(key(x, y));
        }
    }
    screen.obstacles = toRects(obst);
    screen.grass = { ...screen.grass, cells: toRects(grass) };
    return screen;
}

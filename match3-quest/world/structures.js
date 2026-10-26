// Structures de décor des zones sauvages : bâtiments, tours, sanctuaires, ponts et escaliers du biome (sprites/biomeArchi.js en pixel art,
// sprites/biomeSvg.js en SVG), posés à leur échelle (jamais sur une seule case : `w` × `h` cases). Logique pure, appliquée par
// `assembleWorld` après les barrières de bordure.
//  - Une structure pleine occupe son rectangle (devenu obstacle) ; elle n'est posée que si elle ne coupe aucun chemin : toutes les cases,
//    entités et sorties atteignables à pied avant restent atteignables après.
//  - Un pont (`cross`) enjambe deux cases d'eau côte à côte entre deux rives praticables : ces cases cessent d'être de l'eau.
//  - Ni sur la bordure (2 cases de marge), ni sur un chemin, un couloir de passage, un personnage, une sortie, un bâtiment ou près de l'apparition.

import { toSet, toRects, buildingCells, entityCells, routeCells } from './expand.js';
import { openRim } from './barriers.js';

// id → dimensions en cases (identiques à celles du sprite : testé dans tests/unit/structures.test.js)
export const STRUCTURES = {
    paddy_hut: { w: 2, h: 2 }, paddy_barn: { w: 2, h: 2 }, paddy_mill: { w: 2, h: 2 }, paddy_bridge: { w: 2, h: 1, cross: true }, stone_bridge: { w: 2, h: 1, cross: true },
    riverbed_marker: { w: 1, h: 2 }, riverbed_dyke: { w: 2, h: 1 }, riverbed_bridge: { w: 2, h: 1, cross: true },
    bamboo_pavilion: { w: 2, h: 2 }, bamboo_shrine: { w: 2, h: 2 }, bamboo_gate: { w: 2, h: 2 },
    gobi_tower: { w: 1, h: 2 }, gobi_well: { w: 1, h: 1 }, gobi_camp: { w: 2, h: 2 },
    storm_pavilion: { w: 2, h: 2 }, storm_rod: { w: 1, h: 2 },
    volcano_ruin: { w: 2, h: 2 }, volcano_gate: { w: 2, h: 2 }, volcano_temple: { w: 2, h: 2 },
    savanna_camp: { w: 2, h: 2 }, savanna_hut: { w: 1, h: 1 }, savanna_palisade: { w: 2, h: 1 }, savanna_watch: { w: 1, h: 2 },
    coast_hut: { w: 2, h: 2 }, coast_lighthouse: { w: 1, h: 2 }, coast_pier: { w: 2, h: 1, cross: true }, coast_shrine: { w: 1, h: 1 },
    tides_marker: { w: 1, h: 2 }, tides_shrine: { w: 1, h: 1 }, tides_stairs: { w: 2, h: 1 },
    fusang_shrine: { w: 2, h: 2 }, fusang_arch: { w: 2, h: 2 }, fusang_altar: { w: 1, h: 1 }, fusang_stairs: { w: 2, h: 1 },
    moon_palace: { w: 2, h: 2 }, moon_pavilion: { w: 2, h: 2 }, moon_bridge: { w: 2, h: 1, cross: true }, moon_stairs: { w: 2, h: 1 }
};

export const BIOME_STRUCTURES = {
    paddy: ['paddy_hut', 'paddy_barn', 'paddy_mill', 'paddy_bridge', 'stone_bridge'],
    riverbed: ['riverbed_marker', 'riverbed_dyke', 'riverbed_bridge', 'stone_bridge'],
    bamboo: ['bamboo_pavilion', 'bamboo_shrine', 'bamboo_gate'],
    gobi: ['gobi_tower', 'gobi_well', 'gobi_camp'],
    storm: ['storm_pavilion', 'storm_rod'],
    volcano: ['volcano_ruin', 'volcano_gate', 'volcano_temple'],
    savanna: ['savanna_camp', 'savanna_hut', 'savanna_palisade', 'savanna_watch'],
    coast: ['coast_hut', 'coast_lighthouse', 'coast_pier', 'coast_shrine'],
    tides: ['tides_marker', 'tides_shrine', 'tides_stairs'],
    fusang: ['fusang_shrine', 'fusang_arch', 'fusang_altar', 'fusang_stairs'],
    moon: ['moon_palace', 'moon_pavilion', 'moon_bridge', 'moon_stairs']
};

const key = (x, y) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MARGIN = 2;        // cases libres le long de la bordure
const SPAWN_GAP = 3;     // distance minimale à l'apparition (cases)
const hash = (a, b, s = 0) => Math.abs(Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453) % 1;
const seedOf = id => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7);

export const isStructureScreen = screen => screen.kind === 'wild' && !screen.interior && !screen.arena && !screen.aquatic && Boolean(BIOME_STRUCTURES[screen.biome]);

export function addStructures(screens) {
    for (const screen of Object.values(screens)) {
        if (!isStructureScreen(screen) || screen.structures) continue;
        const { w, h } = screen, seed = seedOf(screen.id);
        const obst = toSet(screen.obstacles), liq = toSet(screen.liquids);
        const taken = new Set([...buildingCells(screen), ...entityCells(screen), key(screen.spawn.x, screen.spawn.y)]);
        (screen.exits || []).forEach(e => taken.add(key(e.x, e.y)));
        (screen.enemies || []).filter(e => e.patrol).forEach(e => routeCells(e.patrol).forEach(c => taken.add(key(c.x, c.y))));
        (screen.pillars || []).concat(screen.sealed || []).forEach(([px, py]) => taken.add(key(px, py)));
        (screen.spots || []).forEach(sp => taken.add(key(sp.x, sp.y)));
        if (screen.waypoint) taken.add(key(screen.waypoint.x, screen.waypoint.y));
        (screen.enemies || []).forEach(e => (e.wall || []).forEach(([wx, wy]) => taken.add(key(wx, wy))));   // lignes de piliers d'un boss (eau comprise)
        openRim(screens, screen, 4).forEach(k => taken.add(k));
        const paths = toSet(screen.paths);
        (screen.grass ? toSet(screen.grass.cells) : new Set()).forEach(k => paths.add(k));   // hautes herbes : on ne les recouvre pas (comme les chemins)
        const solid = new Set([...entityCells(screen), ...(screen.exits || []).map(e => key(e.x, e.y))]);
        solid.delete(key(screen.spawn.x, screen.spawn.y));

        const flood = () => {
            const seen = new Set([key(screen.spawn.x, screen.spawn.y)]);
            const queue = [screen.spawn];
            while (queue.length) {
                const p = queue.shift();
                for (const [dx, dy] of STEPS) {
                    const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(k) || obst.has(k) || liq.has(k) || solid.has(k)) continue;
                    seen.add(k); queue.push({ x: nx, y: ny });
                }
            }
            return seen;
        };
        const touches = (set, k) => { const [x, y] = k.split(',').map(Number); return STEPS.some(([dx, dy]) => set.has(key(x + dx, y + dy))); };
        const before = flood();
        const reachableSolids = [...solid].filter(k => touches(before, k));
        const stillConnected = () => {
            const after = flood();
            return [...before].every(k => after.has(k) || occupied.has(k)) && reachableSolids.every(k => touches(after, k));
        };

        const placed = [], occupied = new Set();
        const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !obst.has(key(x, y)) && !liq.has(key(x, y)) && !taken.has(key(x, y)) && !paths.has(key(x, y)) && !occupied.has(key(x, y));
        const walkable = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !obst.has(key(x, y)) && !liq.has(key(x, y)) && !solid.has(key(x, y)) && !occupied.has(key(x, y));
        const far = (x, y, sw, sh) => x + sw - 1 >= screen.spawn.x - SPAWN_GAP && x <= screen.spawn.x + SPAWN_GAP && y + sh - 1 >= screen.spawn.y - SPAWN_GAP && y <= screen.spawn.y + SPAWN_GAP ? false : true;

        const target = Math.max(3, Math.min(6, Math.round(w * h / 180)));
        const ids = BIOME_STRUCTURES[screen.biome].slice().sort((a, b) => hash(seedOf(a), seed) - hash(seedOf(b), seed));
        const cells = [];
        for (let x = MARGIN; x < w - MARGIN; x++) for (let y = MARGIN; y < h - MARGIN; y++) cells.push([x, y]);
        cells.sort((a, b) => hash(a[0], a[1], seed) - hash(b[0], b[1], seed));

        const tryPlace = id => {
            const def = STRUCTURES[id];
            for (const [x, y] of cells) {
                if (x + def.w > w - MARGIN || y + def.h > h - MARGIN) continue;
                const rect = [];
                for (let i = 0; i < def.w; i++) for (let j = 0; j < def.h; j++) rect.push(key(x + i, y + j));
                if (def.cross) {
                    // pont : deux cases d'eau côte à côte, rives praticables de part et d'autre
                    if (!rect.every(k => liq.has(k) && !taken.has(k)) || !walkable(x - 1, y) || !walkable(x + def.w, y) || !(before.has(key(x - 1, y)) || before.has(key(x + def.w, y)))) continue;
                    rect.forEach(k => liq.delete(k));
                } else {
                    if (!rect.every(k => { const [cx, cy] = k.split(',').map(Number); return free(cx, cy); }) || !far(x, y, def.w, def.h)) continue;
                    // une case de marge autour (pas contre un obstacle voisin ni une autre structure)
                    let crowded = false;
                    for (let i = -1; i <= def.w && !crowded; i++) for (let j = -1; j <= def.h && !crowded; j++) {
                        if (i >= 0 && i < def.w && j >= 0 && j < def.h) continue;
                        if (occupied.has(key(x + i, y + j))) crowded = true;
                    }
                    if (crowded) continue;
                    rect.forEach(k => obst.add(k)); rect.forEach(k => occupied.add(k));
                    if (!stillConnected()) { rect.forEach(k => { obst.delete(k); occupied.delete(k); }); continue; }
                    placed.push({ id, x, y, w: def.w, h: def.h });
                    return true;
                }
                rect.forEach(k => occupied.add(k));   // le pont occupe ses cases (pas d'autre structure dessus)
                placed.push({ id, x, y, w: def.w, h: def.h, cross: true });
                return true;
            }
            return false;
        };

        // d'abord un exemplaire de chaque type (dans l'ordre mélangé), puis on complète
        let guard = 0;
        while (placed.length < target && guard < ids.length * 3) {
            const id = ids[guard % ids.length];
            guard++;
            if (STRUCTURES[id].cross && placed.some(p => p.cross)) continue;   // un seul pont par carte
            if (placed.filter(p => p.id === id).length >= (guard <= ids.length ? 1 : 2)) continue;
            tryPlace(id);
        }
        if (placed.length) {
            screen.structures = placed;
            screen.obstacles = toRects(obst);
            screen.liquids = toRects(liq);
        }
    }
}

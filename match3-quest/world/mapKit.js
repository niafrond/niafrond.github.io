// Outils de construction des zones du « Grand Monde » (voir world/FORMAT.md). Logique pure, sans DOM.
//
//  - parseGrid(rows)            : carte ASCII → dimensions, obstacles, liquides, chemins, bâtiments, ancres ;
//  - buildZone(spec, helpers)   : carte + entités (PNJ, coffres, ennemis, sorties) → écran compatible avec SCREENS ;
//  - arrivalFor(exit, target)   : tuile d'arrivée symétrique d'une sortie ;
//  - freeNeighbor(screen, x, y) : première tuile libre autour d'une tuile (point d'apparition devant une pierre de voyage).

const BUILDING_LETTERS = 'ABCDEFGH';
const ANCHOR_CHARS = '0123456789<>^viIjklmnopqrstuwxyz'.replace('I', '');   // chiffres, bords (< > ^ v) et lettres i-z (sauf v déjà pris) : 10 + 4 + 16 ancres
const KNOWN = new Set(['.', '#', '~', '=', 'S', 'W', ...BUILDING_LETTERS, ...BUILDING_LETTERS.toLowerCase(), ...ANCHOR_CHARS]);

// Rectangles [x, y, w, h] à partir d'un ensemble de tuiles : fusion en bandes horizontales puis verticales.
export function cellsToRects(cells) {
    const byRow = new Map();
    cells.forEach(([x, y]) => { if (!byRow.has(y)) byRow.set(y, []); byRow.get(y).push(x); });
    const runs = [];
    [...byRow.keys()].sort((a, b) => a - b).forEach(y => {
        const xs = byRow.get(y).sort((a, b) => a - b);
        let start = xs[0];
        let prev = xs[0];
        for (let i = 1; i <= xs.length; i++) {
            if (xs[i] === prev + 1) { prev = xs[i]; continue; }
            runs.push({ x: start, y, w: prev - start + 1, h: 1 });
            start = xs[i];
            prev = xs[i];
        }
    });
    const rects = [];
    runs.forEach(run => {
        const above = rects.find(r => r.x === run.x && r.w === run.w && r.y + r.h === run.y);
        if (above) above.h += 1; else rects.push({ ...run });
    });
    return rects.map(r => [r.x, r.y, r.w, r.h]);
}

export function parseGrid(rows, label = 'grille') {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${label} : grille vide`);
    const w = rows[0].length;
    const h = rows.length;
    const walls = [];
    const liquids = [];
    const paths = [];
    const anchors = {};
    const letters = {};
    let spawn = null;
    let waypoint = null;
    rows.forEach((row, y) => {
        if (row.length !== w) throw new Error(`${label} : ligne ${y} de longueur ${row.length} (attendu ${w})`);
        for (let x = 0; x < w; x++) {
            const ch = row[x];
            if (!KNOWN.has(ch)) throw new Error(`${label} : caractère inconnu « ${ch} » en (${x}, ${y})`);
            if (ch === '#') walls.push([x, y]);
            else if (ch === '~') liquids.push([x, y]);
            else if (ch === '=') paths.push([x, y]);
            else if (ch === 'S') spawn = { x, y };
            else if (ch === 'W') waypoint = { x, y };
            else if (ANCHOR_CHARS.includes(ch)) {
                if (anchors[ch]) throw new Error(`${label} : ancre « ${ch} » en double`);
                anchors[ch] = { x, y };
            } else if (BUILDING_LETTERS.includes(ch) || BUILDING_LETTERS.toLowerCase().includes(ch)) {
                const key = ch.toUpperCase();
                (letters[key] ||= { cells: [], door: null });
                if (ch === ch.toLowerCase()) {
                    if (letters[key].door) throw new Error(`${label} : porte « ${ch} » en double`);
                    letters[key].door = { x, y };
                }
                letters[key].cells.push([x, y]);
            }
        }
    });
    const buildings = Object.entries(letters).map(([id, b]) => {
        const xs = b.cells.map(c => c[0]);
        const ys = b.cells.map(c => c[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        const bw = Math.max(...xs) - x + 1, bh = Math.max(...ys) - y + 1;
        if (b.cells.length !== bw * bh) throw new Error(`${label} : le bâtiment ${id} n'est pas un rectangle plein`);
        if (!b.door) throw new Error(`${label} : le bâtiment ${id} n'a pas de porte (« ${id.toLowerCase()} »)`);
        if (b.door.y !== y + bh - 1) throw new Error(`${label} : la porte du bâtiment ${id} doit être sur sa rangée du bas`);
        return { id, x, y, w: bw, h: bh, door: b.door };
    });
    const doors = new Set(buildings.map(b => `${b.door.x},${b.door.y}`));
    const blocked = [...walls, ...buildings.flatMap(b => b.cells || [])];
    buildings.forEach(b => {
        for (let yy = b.y; yy < b.y + b.h; yy++) {
            for (let xx = b.x; xx < b.x + b.w; xx++) {
                if (!doors.has(`${xx},${yy}`)) blocked.push([xx, yy]);
            }
        }
    });
    return {
        w, h, spawn, waypoint, anchors, buildings,
        obstacles: cellsToRects(blocked),
        liquids: cellsToRects(liquids),
        paths: cellsToRects(paths)
    };
}

const inRects = (rects, x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
const terrainBlocked = (screen, x, y) =>
    x < 0 || y < 0 || x >= screen.w || y >= screen.h || inRects(screen.obstacles, x, y) || inRects(screen.liquids, x, y);

// Première tuile libre (sans terrain bloquant ni entité) autour de (x, y), dans l'ordre sud, est, ouest, nord.
export function freeNeighbor(screen, x, y) {
    const taken = new Set([
        ...screen.npcs.map(n => `${n.x},${n.y}`),
        ...screen.chests.map(c => `${c.x},${c.y}`),
        ...screen.enemies.map(e => `${e.x},${e.y}`),
        ...(screen.waypoint ? [`${screen.waypoint.x},${screen.waypoint.y}`] : [])
    ]);
    const exits = new Set(screen.exits.map(e => `${e.x},${e.y}`));
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        const k = `${nx},${ny}`;
        if (!terrainBlocked(screen, nx, ny) && !taken.has(k) && !exits.has(k)) return { x: nx, y: ny };
    }
    return null;
}

// Tuile d'arrivée quand on franchit `exit` (située dans la zone `fromId`) vers `target` :
// devant la porte appariée (côté sud) ou un pas à l'intérieur de la sortie appariée.
export function arrivalFor(fromId, target) {
    const pair = target.exits.find(e => e.to === fromId);
    if (!pair) return null;
    if (pair.door) return { x: pair.x, y: pair.y + 1 };
    if (pair.x === 0) return { x: 1, y: pair.y };
    if (pair.x === target.w - 1) return { x: target.w - 2, y: pair.y };
    if (pair.y === 0) return { x: pair.x, y: 1 };
    if (pair.y === target.h - 1) return { x: pair.x, y: target.h - 2 };
    return { x: pair.x, y: pair.y + 1 };
}

/**
 * Construit un écran à partir d'une spécification de carte.
 * spec : { id, region, biome, grid, npcs, chests, enemies, exits, kind }
 * helpers : { npcDef(id), chestDef(id), screenText(id) }
 */
export function buildZone(spec, helpers) {
    const g = parseGrid(spec.grid, spec.id);
    const anchor = ch => {
        const a = g.anchors[ch];
        if (!a) throw new Error(`${spec.id} : ancre « ${ch} » introuvable dans la grille`);
        return a;
    };
    const text = helpers.screenText?.(spec.id) || {};
    // Sans « S », on apparaît un pas à l'intérieur de l'entrée « < » (jamais sur la tuile de sortie).
    const entry = g.anchors['<'];
    const spawn = g.spawn || (entry && { x: entry.x === 0 ? 1 : entry.x, y: entry.y });
    if (!spawn) throw new Error(`${spec.id} : ni « S » ni « < » pour l'apparition`);
    const screen = {
        id: spec.id, region: spec.region, name: text.name || spec.id, biome: spec.biome || 'paddy',
        kind: spec.kind || 'wild', safe: spec.kind !== 'wild',
        w: g.w, h: g.h, spawn,
        obstacles: g.obstacles, liquids: g.liquids, paths: g.paths, buildings: g.buildings.map(b => ({ ...b })),
        exits: [], npcs: [], enemies: [], chests: []
    };
    if (spec.interior) screen.interior = true;
    if (text.arrival?.length && !spec.interior) screen.arrival = text.arrival;   // pas de texte du Narrateur dans les maisons
    if (g.waypoint) screen.waypoint = { ...g.waypoint, name: text.waypointName || `Pierre de voyage — ${screen.name}` };

    (spec.npcs || []).forEach(n => {
        const { at, ...rest } = n;
        const p = anchor(at);
        screen.npcs.push({ ...helpers.npcDef(n.id), ...rest, x: p.x, y: p.y });
    });
    (spec.chests || []).forEach(c => {
        const { at, ...rest } = c;
        const p = anchor(at);
        screen.chests.push({ ...helpers.chestDef(c.id), ...rest, x: p.x, y: p.y });
    });
    (spec.enemies || []).forEach(e => {
        const { at, patrol, ...rest } = e;
        const p = anchor(at);
        const def = { kind: 'sentinel', ...rest, x: p.x, y: p.y };
        if (patrol) def.patrol = patrol.map(ch => { const a = anchor(ch); return [a.x, a.y]; });
        screen.enemies.push(def);
    });
    (spec.exits || []).forEach(e => {
        const { at, ...rest } = e;
        const p = anchor(at);
        screen.exits.push({ ...rest, x: p.x, y: p.y });
    });
    // Portes des bâtiments : l'entrée de la maison (`to` = identifiant d'intérieur de spec.houses[lettre]).
    screen.buildings.forEach(b => {
        const house = spec.houses?.[b.id];
        if (!house) return;
        b.name = house.name || house.to;
        screen.exits.push({ x: b.door.x, y: b.door.y, to: house.to, door: true, label: b.name });
    });
    return screen;
}

// Grandes cartes reliées par leurs bords (« vision large » à la Pokémon). Logique pure, sans DOM.
//
//  - scaleScreen(screen, W, H)  : agrandit une zone en étirant toute sa carte (au plus proche voisin) : ennemis, PNJ, coffres, pierre
//    de voyage, maisons et décors sont REDISPOSÉS sur toute la surface, la topologie (chemins, goulets, ordre des rencontres) est conservée ;
//  - widenGates(screen)         : élargit en passages de 3 cases les sorties posées sur un bord (villages…) ;
//  - linkGates(screens)         : transforme chaque passage en une rangée de sorties (`edge`, `span` -1/0/1) et calcule la case
//    d'arrivée alignée de l'autre côté (on ressort en face, comme aux jonctions des routes Pokémon) ;
//  - openPerimeter / addWaterBorder : plus de mur d'enceinte factice, une couronne d'eau (franchissable avec le Pas de Yu) à la place.

import { cellsToRects } from './mapKit.js';

// Tailles des cartes agrandies (colonnes × lignes) : zones sauvages, sanctuaires, hameaux.
export const EXPANDED_SIZES = { wild: [28, 22], sanctuary: [26, 20], hamlet: [26, 20] };

const key = (x, y) => `${x},${y}`;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
function mulberry32(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const toSet = rects => {
    const s = new Set();
    (rects || []).forEach(([rx, ry, rw, rh]) => { for (let x = rx; x < rx + rw; x++) for (let y = ry; y < ry + rh; y++) s.add(key(x, y)); });
    return s;
};
const toRects = set => cellsToRects([...set].map(k => k.split(',').map(Number)));

// Case la plus proche du bord `edge`, au rang `along` (position le long du bord) et à `depth` pas vers l'intérieur.
function edgeCell(edge, along, depth, w, h) {
    if (edge === 'west') return { x: depth, y: along };
    if (edge === 'east') return { x: w - 1 - depth, y: along };
    if (edge === 'north') return { x: along, y: depth };
    return { x: along, y: h - 1 - depth };
}
const alongOf = (edge, p) => (edge === 'west' || edge === 'east' ? p.y : p.x);
function edgeOf(p, w, h) {
    if (p.x === 0) return 'west';
    if (p.x === w - 1) return 'east';
    if (p.y === 0) return 'north';
    if (p.y === h - 1) return 'south';
    return null;
}
const OPPOSITE = { west: 'east', east: 'west', north: 'south', south: 'north' };

// Sorties posées sur un bord (hors portes de bâtiment) : ce sont elles qui deviennent des passages.
function borderExits(screen) {
    return screen.exits.filter(e => !e.door && !e.leaveArena && edgeOf(e, screen.w, screen.h));
}

// Les cases de bâtiment ne se touchent jamais.
const buildingCells = screen => {
    const s = new Set();
    (screen.buildings || []).forEach(b => { for (let x = b.x; x < b.x + b.w; x++) for (let y = b.y; y < b.y + b.h; y++) s.add(key(x, y)); });
    return s;
};

function addGate(screen, edge, center, exit) {
    const { x, y, arrive, edge: _e, span, ...attrs } = exit;
    (screen.gates ||= []).push({ edge, center, attrs });
}

// Libère les cases du passage (3 cases le long du bord, 2 en profondeur) quand rien ne les occupe.
function clearMouth(screen, gate, obst, liq, protectedCells, taken) {
    const { w, h } = screen;
    const along0 = alongOf(gate.edge, gate.center);
    let kmin = 0, kmax = 0;
    for (const k of [-1, 1]) {
        let ok = true;
        const cells = [0, 1].map(d => edgeCell(gate.edge, along0 + k, d, w, h));
        cells.forEach(c => {
            if (c.x < 0 || c.y < 0 || c.x >= w || c.y >= h || protectedCells.has(key(c.x, c.y)) || taken.has(key(c.x, c.y))) ok = false;
        });
        if (ok) { if (k < 0) kmin = k; else kmax = k; }
    }
    for (let k = kmin; k <= kmax; k++) {
        for (const d of [0, 1]) {
            const c = edgeCell(gate.edge, along0 + k, d, w, h);
            obst.delete(key(c.x, c.y));
            liq.delete(key(c.x, c.y));
        }
    }
    gate.kmin = kmin;
    gate.kmax = kmax;
}

const entityCells = screen => new Set([
    ...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || []),
    ...(screen.waypoint ? [screen.waypoint] : []), ...(screen.spawn ? [screen.spawn] : [])
].map(e => key(e.x, e.y)));

// Élargit en passages de 3 cases les sorties posées sur un bord (zone non agrandie).
export function widenGates(screen) {
    const obst = toSet(screen.obstacles);
    const liq = toSet(screen.liquids);
    const prot = buildingCells(screen);
    const taken = entityCells(screen);
    const keep = [];
    screen.gates = [];
    screen.exits.forEach(e => {
        const edge = !e.door && !e.leaveArena ? edgeOf(e, screen.w, screen.h) : null;
        if (!edge) { keep.push(e); return; }
        const center = { x: e.x, y: e.y };
        addGate(screen, edge, center, e);
        const gate = screen.gates[screen.gates.length - 1];
        // la case de l'exit elle-même ne compte pas comme « occupée »
        const t = new Set(taken); t.delete(key(e.x, e.y));
        clearMouth(screen, gate, obst, liq, prot, t);
    });
    screen.exits = keep;
    screen.obstacles = toRects(obst);
    screen.liquids = toRects(liq);
    return screen;
}

// Agrandit `screen` à W × H en REDISPOSANT tout son contenu : la carte entière est étirée (chaque case d'origine devient un bloc de
// cases, au plus proche voisin), de sorte que ennemis, PNJ, coffres, pierre de voyage, maisons et décors se répartissent sur toute la
// surface au lieu de rester entassés dans un coin. La topologie est conservée (chemins, goulets, passages, ordre des rencontres) ; les
// positions des entités sont celles du centre de leur bloc, les bâtiments gardent leur taille (ils sont recentrés dans leur
// emplacement étiré, porte vers le bas), les passages de bord restent sur les bords. Les ennemis voient leur zone de vigilance
// agrandie (`aggro` 2) comme le reste de la carte, pour que les goulets qu'ils gardaient restent fermés.
export function scaleScreen(screen, W, H) {
    const w0 = screen.w, h0 = screen.h;
    if (W <= w0 && H <= h0) return widenGates(screen);
    W = Math.max(W, w0); H = Math.max(H, h0);
    const sx = W / w0, sy = H / h0;
    const EPS = 1e-9;
    const lo = (i, sc) => Math.ceil(i * sc - EPS);
    const hi = (i, sc) => Math.ceil((i + 1) * sc - EPS) - 1;
    const cx = x => Math.floor((lo(x, sx) + hi(x, sx)) / 2);
    const cy = y => Math.floor((lo(y, sy) + hi(y, sy)) / 2);
    const srcX = X => Math.min(w0 - 1, Math.floor(X / sx + EPS));
    const srcY = Y => Math.min(h0 - 1, Math.floor(Y / sy + EPS));

    // 1. Terrain : sans les cases de bâtiment (re-posées plus bas), puis étirement au plus proche voisin.
    const obst0 = toSet(screen.obstacles);
    const liq0 = toSet(screen.liquids);
    const paths0 = toSet(screen.paths);
    const bcells = buildingCells(screen);
    bcells.forEach(k => obst0.delete(k));
    const obst = new Set(), liq = new Set(), paths = new Set();
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        const k = key(srcX(X), srcY(Y)), dk = key(X, Y);
        if (obst0.has(k)) obst.add(dk);
        else if (liq0.has(k)) liq.add(dk);
        if (paths0.has(k)) paths.add(dk);
    }

    // 2. Bâtiments : même taille, recentrés dans leur emplacement étiré, bas du bâtiment collé au bas de l'emplacement.
    const doorMap = new Map();
    screen.buildings = (screen.buildings || []).map(b => {
        const X0 = Math.min(W - b.w, Math.max(0, Math.floor(lo(b.x, sx) + (b.w * sx - b.w) / 2)));
        const Y0 = Math.min(H - b.h, Math.max(0, lo(b.y + b.h, sy) - b.h));
        const door = { x: X0 + (b.door.x - b.x), y: Y0 + b.h - 1 };
        doorMap.set(key(b.door.x, b.door.y), door);
        for (let X = X0; X < X0 + b.w; X++) for (let Y = Y0; Y < Y0 + b.h; Y++) {
            liq.delete(key(X, Y)); paths.delete(key(X, Y));
            if (!(X === door.x && Y === door.y)) obst.add(key(X, Y)); else obst.delete(key(X, Y));
        }
        // la case devant la porte reste praticable (et une ruelle y mène)
        const front = key(door.x, Math.min(H - 1, door.y + 1));
        obst.delete(front); liq.delete(front); paths.add(front);
        return { ...b, x: X0, y: Y0, door };
    });

    // 3. Entités et points remarquables.
    const at = p => ({ x: cx(p.x), y: cy(p.y) });
    ['npcs', 'chests'].forEach(list => { screen[list] = (screen[list] || []).map(e => ({ ...e, ...at(e) })); });
    screen.enemies = (screen.enemies || []).map(e => ({
        ...e, ...at(e),
        ...(e.patrol ? { patrol: e.patrol.map(([x, y]) => [cx(x), cy(y)]) } : {})
    }));
    if (screen.waypoint) screen.waypoint = { ...screen.waypoint, ...at(screen.waypoint) };
    const spawn0 = screen.spawn;
    screen.spawn = at(spawn0);

    // 4. Sorties : portes de bâtiment suivent leur bâtiment, passages de bord restent sur le bord.
    screen.gates = [];
    const keep = [];
    screen.exits.forEach(e => {
        if (e.door) {
            const d = doorMap.get(key(e.x, e.y));
            keep.push(d ? { ...e, x: d.x, y: d.y } : e);
            return;
        }
        const edge = edgeOf(e, w0, h0);
        const X = e.x === 0 ? 0 : e.x === w0 - 1 ? W - 1 : cx(e.x);
        const Y = e.y === 0 ? 0 : e.y === h0 - 1 ? H - 1 : cy(e.y);
        if (edge) {
            addGate(screen, edge, { x: X, y: Y }, e);
            // l'apparition d'origine était la case d'entrée juste derrière ce passage : on la garde alignée avec lui
            const back = edgeCell(edge, alongOf(edge, e), 1, w0, h0);
            if (back.x === spawn0.x && back.y === spawn0.y) screen.spawn = edgeCell(edge, alongOf(edge, { x: X, y: Y }), 1, W, H);
        }
        else keep.push({ ...e, x: X, y: Y });
    });
    screen.exits = keep;
    screen.w = W; screen.h = H;
    screen.obstacles = toRects(obst);
    screen.liquids = toRects(liq);
    screen.paths = toRects(paths);

    // 5. Bouches des passages de bord (3 cases de large, 2 de profondeur), comme pour les cartes non agrandies.
    const prot = buildingCells(screen);
    const taken = entityCells(screen);
    const obst2 = toSet(screen.obstacles), liq2 = toSet(screen.liquids);
    screen.gates.forEach(g => {
        const t = new Set(taken); t.delete(key(g.center.x, g.center.y));
        clearMouth(screen, g, obst2, liq2, prot, t);
    });
    screen.obstacles = toRects(obst2);
    screen.liquids = toRects(liq2);
    return screen;
}

// Transforme les passages de toutes les zones en rangées de sorties et calcule les arrivées alignées.
export function linkGates(screens) {
    const list = Object.values(screens);
    list.forEach(s => {
        if (!s.gates) return;
        const generated = [];
        s.gates.forEach(g => {
            const along0 = alongOf(g.edge, g.center);
            // la case centrale d'abord (c'est elle que les repères du jeu — étiquette, apparition — désignent)
            const spans = [0, ...[-1, 1].filter(k => k >= (g.kmin ?? 0) && k <= (g.kmax ?? 0))];
            spans.forEach(k => {
                const c = edgeCell(g.edge, along0 + k, 0, s.w, s.h);
                generated.push({ ...g.attrs, x: c.x, y: c.y, edge: g.edge, span: k });
            });
        });
        s.exits = [...s.exits, ...generated];
    });
    list.forEach(s => {
        s.exits.forEach(e => {
            if (e.edge === undefined || e.arrive) return;
            const target = screens[e.to];
            const partner = target?.gates?.find(g => g.attrs.to === s.id);
            if (!partner) return;
            const k = Math.max(partner.kmin ?? 0, Math.min(partner.kmax ?? 0, e.span));
            const c = edgeCell(partner.edge, alongOf(partner.edge, partner.center) + k, 1, target.w, target.h);
            e.arrive = { x: c.x, y: c.y };
        });
    });
    return screens;
}

// Retire la « délimitation factice » (roseaux, lampions, rochers…) du mur d'enceinte d'une carte de plein air : les terrains sont
// reliés entre eux, la limite de la carte suffit (on ne la franchit que par les passages, ou sur l'eau avec le Pas de Yu).
// Seuls les côtés réellement murés sont ouverts (≥ 60 % d'obstacles sur la couronne extérieure) et sur 2 cases d'épaisseur (le mur
// d'une carte agrandie est étiré) : un bloc de décor qui touche le bord (goulet d'un sanctuaire, par exemple) reste en place.
// Les cases de bâtiment et les intérieurs (maisons, arène) ne sont jamais touchés.
export function openPerimeter(screen) {
    if (screen.interior || screen.arena || screen.kind === 'house') return screen;
    const obst = toSet(screen.obstacles);
    const prot = buildingCells(screen);
    const { w, h } = screen;
    const edges = [
        Array.from({ length: w }, (_, x) => [x, 0, 1, 0]),
        Array.from({ length: w }, (_, x) => [x, h - 1, 1, 0]),
        Array.from({ length: h }, (_, y) => [0, y, 0, 1]),
        Array.from({ length: h }, (_, y) => [w - 1, y, 0, 1])
    ];
    const inward = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    edges.forEach((cells, i) => {
        const walled = cells.filter(([x, y]) => obst.has(key(x, y))).length / cells.length >= 0.6;
        if (!walled) return;
        cells.forEach(([x, y]) => {
            for (let d = 0; d < 2; d++) {
                const cx = x + inward[i][0] * d, cy = y + inward[i][1] * d;
                if (!prot.has(key(cx, cy))) obst.delete(key(cx, cy));
            }
        });
    });
    screen.obstacles = toRects(obst);
    return screen;
}

// Trajet d'un patrouilleur : segments axe par axe entre les points de passage (même tracé que exploration.js `buildRoute`).
function routeCells(waypoints) {
    const route = [];
    for (let i = 0; i < waypoints.length; i++) {
        const [tx, ty] = waypoints[i];
        if (i === 0) { route.push({ x: tx, y: ty }); continue; }
        let { x, y } = route[route.length - 1];
        while (x !== tx) { x += Math.sign(tx - x); route.push({ x, y }); }
        while (y !== ty) { y += Math.sign(ty - y); route.push({ x, y }); }
    }
    return route;
}

// Couronne d'eau : les terrains sont entourés d'eau (2 cases, la 2e en bordure irrégulière) pour la cohérence avec les cartes de mer.
// Elle bloque le passage sauf avec le Pas de Yu (exploration.js : `canWalkOnWater`) et laisse intacts les passages de bord (chaussée de
// 5 cases de large, 3 de profondeur), les entités, les bâtiments et tout ce qui était atteignable à pied : une case d'eau qui couperait
// un chemin existant reste de la terre.
export function addWaterBorder(screen) {
    if (screen.interior || screen.arena || screen.aquatic || screen.kind === 'house') return screen;
    const { w, h } = screen;
    const rng = mulberry32(hashSeed(`${screen.id}|water`));
    const obst = toSet(screen.obstacles);
    const liq = toSet(screen.liquids);
    const keep = new Set([...buildingCells(screen), ...entityCells(screen)]);
    (screen.exits || []).forEach(e => keep.add(key(e.x, e.y)));
    // les trajets des patrouilleurs restent de la terre
    (screen.enemies || []).filter(e => e.patrol).forEach(e => routeCells(e.patrol).forEach(c => keep.add(key(c.x, c.y))));
    // chaussées devant les passages de bord
    (screen.gates || []).forEach(g => {
        const along0 = alongOf(g.edge, g.center);
        for (let k = -2; k <= 2; k++) for (let d = 0; d <= 2; d++) {
            const c = edgeCell(g.edge, along0 + k, d, w, h);
            keep.add(key(c.x, c.y));
        }
    });
    // les entités et les sorties sont des obstacles pour le passage (on les atteint depuis une case voisine)
    const solid = new Set([...entityCells(screen), ...(screen.exits || []).map(e => key(e.x, e.y))]);
    solid.delete(key(screen.spawn.x, screen.spawn.y));
    const blocked = (x, y) => obst.has(key(x, y)) || liq.has(key(x, y)) || solid.has(key(x, y));
    const flood = () => {
        const seen = new Set([key(screen.spawn.x, screen.spawn.y)]);
        const queue = [screen.spawn];
        while (queue.length) {
            const p = queue.shift();
            DIRS.forEach(([dx, dy]) => {
                const nx = p.x + dx, ny = p.y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(key(nx, ny)) || blocked(nx, ny)) return;
                seen.add(key(nx, ny));
                queue.push({ x: nx, y: ny });
            });
        }
        return seen;
    };
    const before = flood();
    // chaque entité / sortie atteignable à pied doit le rester (une case voisine libre et accessible)
    const touches = (set, k) => { const [x, y] = k.split(',').map(Number); return DIRS.some(([dx, dy]) => set.has(key(x + dx, y + dy))); };
    const reachableSolids = [...solid].filter(k => touches(before, k));
    const candidates = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
        const depth = Math.min(x, y, w - 1 - x, h - 1 - y);
        if (depth > 1 || keep.has(key(x, y))) continue;
        if (depth === 1 && rng() < 0.45) continue;   // 2e rangée irrégulière
        candidates.push([x, y]);
    }
    const converted = new Set();
    candidates.forEach(([x, y]) => {
        const k = key(x, y);
        if (liq.has(k)) return;   // déjà de l'eau
        const wasObstacle = obst.delete(k);
        liq.add(k);
        // une case d'eau ne doit rien rendre inaccessible (hors cases déjà converties)
        const after = flood();
        let ok = true;
        for (const c of before) if (c !== k && !converted.has(c) && !after.has(c)) { ok = false; break; }
        if (ok) ok = reachableSolids.every(sk => touches(after, sk));
        if (ok) converted.add(k);
        else { liq.delete(k); if (wasObstacle) obst.add(k); }
    });
    screen.obstacles = toRects(obst);
    screen.liquids = toRects(liq);
    return screen;
}

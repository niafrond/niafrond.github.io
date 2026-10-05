// Grandes cartes reliées par leurs bords (« vision large » à la Pokémon). Logique pure, sans DOM.
//
//  - expandScreen(screen, W, H) : agrandit une zone vers l'est et le sud (les coordonnées existantes ne changent jamais :
//    sauvegardes, quêtes et entités restent valides). Les murs d'enceinte est/sud s'ouvrent sur un grand terrain
//    généré (bosquets, étang, chemins), cerné d'une bordure ; les anciennes sorties est/sud deviennent des passages
//    sur les nouveaux bords ;
//  - widenGates(screen)         : élargit en passages de 3 cases les sorties posées sur un bord (villages, hameaux…) ;
//  - linkGates(screens)         : transforme chaque passage en une rangée de sorties (`edge`, `span` -1/0/1) et calcule la case
//    d'arrivée alignée de l'autre côté (on ressort en face, comme aux jonctions des routes Pokémon).

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

// Agrandit `screen` à W × H (vers l'est et le sud). La zone d'origine garde exactement sa forme et ses coordonnées (ses goulets, ses
// ennemis et ses auras ne changent pas) : elle reste une « salle » fermée, prolongée par un grand terrain en L qu'on rejoint par
// des passages de 3 cases, là où se trouvaient ses anciennes sorties est / sud. Les liaisons avec les zones voisines se font alors
// sur les nouveaux bords (passages est / sud) ou sur les bords d'origine (ouest / nord, conservés).
export function expandScreen(screen, W, H) {
    const w0 = screen.w, h0 = screen.h;
    if (W <= w0 && H <= h0) return widenGates(screen);
    W = Math.max(W, w0); H = Math.max(H, h0);
    const rng = mulberry32(hashSeed(screen.id));
    const obst = toSet(screen.obstacles);
    const liq = toSet(screen.liquids);
    const paths = toSet(screen.paths);
    const prot = buildingCells(screen);
    const taken = entityCells(screen);

    const share = cells => cells.filter(c => obst.has(key(c.x, c.y))).length / cells.length;
    const eastWalled = share(Array.from({ length: h0 }, (_, y) => ({ x: w0 - 1, y }))) >= 0.5;
    const southWalled = share(Array.from({ length: w0 }, (_, x) => ({ x, y: h0 - 1 }))) >= 0.5;
    const northWalled = share(Array.from({ length: w0 }, (_, x) => ({ x, y: 0 }))) >= 0.5;
    const westWalled = share(Array.from({ length: h0 }, (_, y) => ({ x: 0, y }))) >= 0.5;

    // 1. Cloison entre la salle d'origine et le nouveau terrain : son propre mur d'enceinte s'il existe, sinon une colonne / rangée neuve.
    const eastBarrierX = eastWalled ? w0 - 1 : w0;
    const southBarrierY = southWalled ? h0 - 1 : h0;
    if (W > w0 && !eastWalled) for (let y = 0; y <= (H > h0 ? h0 : h0 - 1); y++) obst.add(key(w0, y));
    if (H > h0 && !southWalled) for (let x = 0; x <= (W > w0 ? w0 : w0 - 1); x++) obst.add(key(x, h0));

    // 2. Bordure extérieure du nouveau terrain.
    for (let x = w0; x < W; x++) obst.add(key(x, 0));
    for (let y = 0; y < H; y++) obst.add(key(W - 1, y));
    for (let x = 0; x < W; x++) obst.add(key(x, H - 1));
    for (let y = h0; y < H; y++) obst.add(key(0, y));

    // 3. Passages : les anciennes sorties est / sud deviennent des ouvertures de la cloison + un passage sur le nouveau bord.
    const exitsKept = [];
    screen.gates = [];
    const east = [], south = [];
    screen.exits.forEach(e => {
        const edge = !e.door && !e.leaveArena ? edgeOf(e, w0, h0) : null;
        if (edge === 'east' && W > w0) east.push(e);
        else if (edge === 'south' && H > h0) south.push(e);
        else if (edge) addGate(screen, edge, { x: e.x, y: e.y }, e);
        else exitsKept.push(e);
    });
    const openings = [];   // { cells: [[x, y]...], inside: tuile côté salle, outside: tuile côté terrain }
    const makeOpening = (e, edge) => {
        const cells = [];
        for (const k of [0, -1, 1]) {
            const c = edge === 'east' ? { x: eastBarrierX, y: e.y + k } : { x: e.x + k, y: southBarrierY };
            const inner = edge === 'east' ? { x: c.x - 1, y: c.y } : { x: c.x, y: c.y - 1 };
            if (c.x < 1 || c.y < 1 || c.x >= W - 1 || c.y >= H - 1) continue;
            if (k !== 0 && (prot.has(key(c.x, c.y)) || taken.has(key(c.x, c.y)) || taken.has(key(inner.x, inner.y)))) continue;
            cells.push([c.x, c.y]);
        }
        cells.forEach(([x, y]) => { obst.delete(key(x, y)); liq.delete(key(x, y)); });
        openings.push({ edge, cells });
    };
    east.forEach(e => makeOpening(e, 'east'));
    south.forEach(e => makeOpening(e, 'south'));
    // Zone sans ancienne sortie est / sud (hameau) : une porte au milieu de la cloison pour entrer dans le nouveau terrain.
    if (!east.length && !south.length) {
        const midY = Math.round(h0 / 2);
        for (let d = 0; d < h0; d++) {
            const y = midY + (d % 2 ? -(d + 1) / 2 : d / 2);
            const ok = [-1, 0, 1].every(k => {
                const yy = y + k;
                return yy >= 1 && yy < h0 - 1 && !prot.has(key(eastBarrierX, yy)) && !taken.has(key(eastBarrierX, yy))
                    && !obst.has(key(eastBarrierX - 1, yy)) && !liq.has(key(eastBarrierX - 1, yy)) && !taken.has(key(eastBarrierX - 1, yy));
            });
            if (ok) { makeOpening({ y }, 'east'); break; }
        }
    }
    east.forEach((e, i) => addGate(screen, 'east', { x: W - 1, y: Math.round(H * (i + 1) / (east.length + 1)) }, e));
    south.forEach((e, i) => addGate(screen, 'south', { x: Math.round(W * (i + 1) / (south.length + 1)), y: H - 1 }, e));
    screen.w = W; screen.h = H;
    screen.gates.forEach(g => {
        if (g.edge !== 'east' && g.edge !== 'south') {
            const t = new Set(taken); t.delete(key(g.center.x, g.center.y));
            clearMouth(screen, g, obst, liq, prot, t);
        }
    });
    screen.gates.filter(g => g.edge === 'east' && g.center.x === W - 1 || g.edge === 'south' && g.center.y === H - 1)
        .forEach(g => clearMouth(screen, g, obst, liq, new Set(), new Set()));

    // 4. Terrain du nouveau secteur : bosquets et étang, hors corridors des passages et des ouvertures.
    const reserved = new Set();
    const reserve = (x, y, rx, ry) => { for (let i = x - rx; i <= x + rx; i++) for (let j = y - ry; j <= y + ry; j++) reserved.add(key(i, j)); };
    openings.forEach(o => o.cells.forEach(([x, y]) => reserve(x, y, o.edge === 'east' ? 3 : 1, o.edge === 'east' ? 1 : 3)));
    screen.gates.forEach(g => {
        const a = g.center;
        for (let d = 0; d <= 3; d++) {
            const c = edgeCell(g.edge, alongOf(g.edge, a), d, W, H);
            reserve(c.x, c.y, g.edge === 'west' || g.edge === 'east' ? 0 : 1, g.edge === 'west' || g.edge === 'east' ? 1 : 0);
        }
    });
    const inLand = (x, y) => (x > eastBarrierX && W > w0) || (y > southBarrierY && H > h0);
    const landCells = [];
    for (let x = 1; x < W - 1; x++) for (let y = 1; y < H - 1; y++) if (inLand(x, y) && !obst.has(key(x, y))) landCells.push([x, y]);
    const placeRect = (x, y, rw, rh, set) => {
        const cells = [];
        for (let i = x; i < x + rw; i++) for (let j = y; j < y + rh; j++) {
            if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1 || !inLand(i, j) || reserved.has(key(i, j)) || obst.has(key(i, j))) return false;
            cells.push(key(i, j));
        }
        cells.forEach(c => set.add(c));
        return true;
    };
    placeRect(2 + Math.floor(rng() * Math.max(1, W - 8)), 2 + Math.floor(rng() * Math.max(1, H - 7)), 4, 3, liq);
    const target = Math.round(landCells.length * 0.14);
    let placed = 0, guard = 0;
    while (placed < target && guard++ < 800) {
        const [x, y] = landCells[Math.floor(rng() * landCells.length)];
        const rw = 1 + Math.floor(rng() * 3), rh = 1 + Math.floor(rng() * 2);
        if (placeRect(x, y, rw, rh, obst)) placed += rw * rh;
    }
    // chemin décoratif du passage de bord jusqu'à la salle
    screen.gates.forEach(g => {
        if (g.edge === 'east' && W > w0) { for (let x = eastBarrierX + 1; x < W - 1; x++) paths.add(key(x, g.center.y)); }
        if (g.edge === 'south' && H > h0) { for (let y = southBarrierY + 1; y < H - 1; y++) paths.add(key(g.center.x, y)); }
    });

    // 5. Connexité : tout le terrain libre doit être atteignable depuis les ouvertures ; on creuse jusqu'aux passages isolés
    //    puis on rebouche les poches inaccessibles (la salle d'origine n'est jamais modifiée).
    const blocked = (x, y) => obst.has(key(x, y)) || liq.has(key(x, y));
    const flood = froms => {
        const seen = new Set(froms.map(p => key(p.x, p.y)));
        const queue = [...froms];
        while (queue.length) {
            const p = queue.shift();
            DIRS.forEach(([dx, dy]) => {
                const nx = p.x + dx, ny = p.y + dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(key(nx, ny)) || blocked(nx, ny)) return;
                seen.add(key(nx, ny));
                queue.push({ x: nx, y: ny });
            });
        }
        return seen;
    };
    const seeds = openings.flatMap(o => o.cells.map(([x, y]) => ({ x, y })));
    if (seeds.length) {
        let reach = flood(seeds);
        screen.gates.filter(g => g.edge === 'east' || g.edge === 'south').forEach(g => {
            const a = edgeCell(g.edge, alongOf(g.edge, g.center), 1, W, H);
            if (reach.has(key(a.x, a.y)) || a.x <= eastBarrierX && W > w0 && a.y < h0) return;
            let { x, y } = a;
            const to = seeds[0];
            const dig = () => { obst.delete(key(x, y)); liq.delete(key(x, y)); };
            dig();
            while (x !== to.x) { x += Math.sign(to.x - x); if (x === eastBarrierX || x === to.x) { /* on s'arrête devant la cloison */ } dig(); }
            while (y !== to.y) { y += Math.sign(to.y - y); dig(); }
            reach = flood(seeds);
        });
        for (let x = 1; x < W - 1; x++) for (let y = 1; y < H - 1; y++) {
            if (inLand(x, y) && !blocked(x, y) && !reach.has(key(x, y))) obst.add(key(x, y));
        }
    }

    screen.exits = exitsKept;
    screen.obstacles = toRects(obst);
    screen.liquids = toRects(liq);
    screen.paths = toRects(paths);
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

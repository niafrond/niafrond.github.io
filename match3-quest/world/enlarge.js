// Cartes plus vastes et moins rectangulaires : agrandit les routes d'accès (`<R>_road`) et les routes principales (`<R>_wild`) natives.
// Logique pure, appliquée par `assembleWorld` avant `widenGates` (les passages de bord sont donc recalculés sur la nouvelle taille).
//
//  1. COUPE ÉLARGIE : à un endroit sans entité ni patrouille, la carte est coupée en deux et un bloc de colonnes neuves (jusqu'à 64 de large
//     en tout) est inséré : les couloirs qui traversaient la coupe se prolongent en méandres (route comprise), le reste du bloc est un terrain
//     neuf (bosquets, herbes). Tout ce qui est à droite de la coupe est décalé : personnages, ennemis, patrouilles, coffres, pierre de voyage.
//  2. EXCROISSANCES : en haut et en bas, des presqu'îles de terrain praticable (1 ou 2 de chaque côté, de 14 à 26 cases de large), tantôt en
//     bosse arrondie, tantôt en rectangle collé à l'ancien rectangle, rattachées à lui par des ouvertures dans l'ancienne bordure ; entre elles, les lignes neuves sont de la matière de
//     bordure (eau, ou arbres/rochers pour les régions bordées d'arbres) : le contour n'est plus un rectangle.
//  3. COINS : les quatre coins de l'ancien rectangle sont rognés, tantôt en demi-ellipse, tantôt en encoche en escalier (deux rectangles emboîtés),
//     sans toucher personne ni rien couper. Le style est tiré au sort à chaque bosse et à chaque coin : le contour est un mélange.
// Garde-fou : si un seul point qui était atteignable à pied ne l'est plus, la carte garde sa taille d'origine.
// Déterministe (tirage stable selon l'identifiant de la carte).

import { toSet as toStringSet, toRects as toStringRects, buildingCells, routeCells } from './expand.js';

export const ENLARGED_LIMITS = { maxSide: 64, maxCells: 2048 };
export const WING_ROWS = 4;               // lignes neuves en haut et en bas
const SIDE = 64;                          // largeur visée (plafond du côté)
const ATTEMPTS = 6;                       // variantes de contour essayées avant d'y renoncer
const MIN_BLOCK = 8;                      // une coupe élargie d'au moins 8 colonnes, sinon pas d'insertion

const key = (x, y) => y * 512 + x;
const unkey = k => [k & 511, k >> 9];
const toSet = rects => { const out = new Set(); toStringSet(rects).forEach(k => { const [x, y] = k.split(',').map(Number); out.add(key(x, y)); }); return out; };
const toRects = set => toStringRects(new Set([...set].map(k => { const [x, y] = unkey(k); return `${x},${y}`; })));
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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
// Bruit de valeurs lissé (0..1) : taches continues d'un bout à l'autre du terrain neuf.
const lattice = (ix, iy, seed) => Math.abs(Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453) % 1;
function noise(x, y, scale, seed) {
    const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = lattice(ix, iy, seed), b = lattice(ix + 1, iy, seed), c = lattice(ix, iy + 1, seed), d = lattice(ix + 1, iy + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

export const isEnlargeable = screen =>
    Boolean(screen.native) && screen.kind === 'wild' && /_(wild|road)$/.test(screen.id) && !screen.interior && !screen.arena && !screen.aquatic &&
    screen.biome !== 'tides' && !(screen.buildings || []).length && !screen.enlarged && screen.w >= 36 && screen.h >= 14 && SIDE - screen.w >= MIN_BLOCK &&
    (SIDE) * (screen.h + 2 * WING_ROWS) <= ENLARGED_LIMITS.maxCells;

// Cases atteignables à pied depuis `spawn` (obstacles et eau ferment ; personnages, coffres, ennemis et sorties sont pleins).
function reachable(w, h, obst, liq, solid, spawn) {
    const seen = new Set([key(spawn.x, spawn.y)]);
    const queue = [spawn.x, spawn.y];
    for (let head = 0; head < queue.length; head += 2) {
        for (const [dx, dy] of STEPS) {
            const nx = queue[head] + dx, ny = queue[head + 1] + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const k = key(nx, ny);
            if (seen.has(k) || obst.has(k) || liq.has(k) || solid.has(k)) continue;
            seen.add(k); queue.push(nx, ny);
        }
    }
    return seen;
}

/**
 * Agrandit `screen` (voir en-tête). Retourne la même carte, modifiée, ou inchangée si elle n'est pas éligible ou si le garde-fou refuse.
 * `treeBorder` : la région est bordée d'arbres plutôt que de mer (world/index.js TREE_BORDER_REGIONS) : la matière de bordure est alors un obstacle.
 * `moves` : [{ to, edge: 'north' | 'south' }] déplace le passage qui mène à `to` du bord ouest / est vers le bord haut / bas (chaussée de 3 cases
 * jusqu'au couloir d'origine, ancien passage muré) : l'entrée ou la sortie de la carte n'est plus toujours à gauche ou à droite. Échec = carte inchangée.
 */
export function enlargeScreen(screen, options = {}) {
    // Plusieurs variantes de contour (tirage différent) : la première qui ne coupe rien est retenue, sinon la carte garde sa taille.
    for (let attempt = 0; attempt < ATTEMPTS && isEnlargeable(screen); attempt++) enlargeOnce(screen, options, attempt);
    return screen;
}

function enlargeOnce(screen, { treeBorder = false, moves = [] } = {}, attempt = 0) {
    if (!isEnlargeable(screen)) return screen;
    const rng = mulberry32(hashSeed(screen.id) + attempt * 7919);
    const seed = (hashSeed(screen.id) + attempt * 131) % 9973;
    const w0 = screen.w, h0 = screen.h;
    const T = WING_ROWS, B = WING_ROWS;
    const N = SIDE - w0, W = SIDE, H = h0 + T + B;

    const obst0 = toSet(screen.obstacles), liq0 = toSet(screen.liquids), paths0 = toSet(screen.paths), grass0 = toSet(screen.grass?.cells);
    const free0 = (x, y) => x >= 0 && y >= 0 && x < w0 && y < h0 && !obst0.has(key(x, y)) && !liq0.has(key(x, y));

    // Cases à ne jamais déplacer d'un côté à l'autre de la coupe : personnages, coffres, ennemis (et leurs patrouilles, remparts), sorties, apparition.
    const hard = new Set();
    const addHard = (x, y) => hard.add(key(x, y));
    [...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || []), ...(screen.exits || []), ...(screen.waypoint ? [screen.waypoint] : []), screen.spawn]
        .forEach(e => addHard(e.x, e.y));
    (screen.enemies || []).forEach(e => {
        if (e.patrol) routeCells(e.patrol).forEach(c => addHard(c.x, c.y));
        (e.wall || []).forEach(([x, y]) => addHard(x, y));
    });
    (screen.pillars || []).concat(screen.sealed || []).forEach(([x, y]) => addHard(x, y));
    const solid0 = new Set([...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || []).filter(e => !e.guardsDoor), ...(screen.exits || []), ...(screen.waypoint ? [screen.waypoint] : [])].map(e => key(e.x, e.y)));
    solid0.delete(key(screen.spawn.x, screen.spawn.y));
    (screen.enemies || []).forEach(e => (e.wall || []).forEach(([x, y]) => solid0.add(key(x, y))));
    const base = reachable(w0, h0, obst0, liq0, solid0, screen.spawn);

    // 1. Choix de la coupe : au milieu, loin de tout, avec au moins deux lignes de passage.
    let seam = -1, openRows = [];
    const order = Array.from({ length: w0 - 2 * 9 }, (_, i) => 9 + i).sort((a, b) => Math.abs(a - w0 / 2) - Math.abs(b - w0 / 2));
    // une patrouille ou un rempart de boss ne doit pas enjamber la coupe (ils seraient étirés) : plages de colonnes à éviter
    const spans = [];
    (screen.enemies || []).forEach(e => {
        const xs = [];
        if (e.patrol) routeCells(e.patrol).forEach(c => xs.push(c.x));
        (e.wall || []).forEach(([x]) => xs.push(x));
        if (xs.length > 1) spans.push([Math.min(...xs), Math.max(...xs)]);
    });
    for (const s of order) {
        if (spans.some(([lo, hi]) => lo < s && s <= hi)) continue;
        const rows = [];
        for (let y = 2; y < h0 - 2; y++) if (free0(s - 1, y) && free0(s, y) && base.has(key(s - 1, y)) && base.has(key(s, y))) rows.push(y);
        if (rows.length >= 2) { seam = s; openRows = rows; break; }
    }
    if (seam < 0) { return screen; }

    const mx = x => (x < seam ? x : x + N), my = y => y + T;
    const obst = new Set(), liq = new Set(), paths = new Set(), grass = new Set();
    const fillSet = new Set();   // cases de matière de bordure (hors terrain jouable) : dessinées comme une forêt serrée, pas comme du décor isolé
    const fillMaterial = k => { if (treeBorder) obst.add(k); else liq.add(k); fillSet.add(k); };

    // 2. Fond : toute la nouvelle grille est de la matière de bordure, puis l'ancienne carte (décalée) et le bloc neuf la remplacent.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fillMaterial(key(x, y));
    const clearCell = k => { obst.delete(k); liq.delete(k); fillSet.delete(k); };
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
        const k = key(x, y), nk = key(mx(x), my(y));
        clearCell(nk);
        if (obst0.has(k)) obst.add(nk); else if (liq0.has(k)) liq.add(nk);
        if (paths0.has(k)) paths.add(nk);
        if (grass0.has(k)) grass.add(nk);
    }

    // 3. Bloc neuf (colonnes seam .. seam + N - 1, lignes de l'ancienne carte) : terrain à bosquets et herbes, bordure haute et basse conservée.
    const hasGrass = Boolean(screen.grass);
    for (let c = 0; c < N; c++) for (let y = 0; y < h0; y++) {
        const x = seam + c, k = key(x, my(y));
        if (y < 2 || y >= h0 - 2) { // bordure : même matière que la colonne voisine
            clearCell(k);
            const nb = key(seam - 1, my(y));
            if (liq.has(nb)) liq.add(k); else obst.add(k);
            continue;
        }
        clearCell(k);
        const n = noise(x, y, 4.5, seed), g = noise(x + 40, y + 17, 6, seed + 3);
        if (n > 0.64) obst.add(k);
        else if (hasGrass && g > 0.56) grass.add(k);
    }
    // Couloirs : chaque groupe de lignes qui traversait la coupe se prolonge en méandre (route comprise s'il y en avait une).
    const runs = [];
    openRows.forEach(y => { const last = runs[runs.length - 1]; if (last && last.b === y - 1) last.b = y; else runs.push({ a: y, b: y }); });
    runs.forEach(run => {
        const road = (() => { for (let y = run.a; y <= run.b; y++) if (paths0.has(key(seam - 1, y)) && paths0.has(key(seam, y))) return true; return false; })();
        const mid = Math.floor((run.a + run.b) / 2);
        const clampRow = y => Math.max(2, Math.min(h0 - 3, y));
        let off = 0;
        for (let c = 0; c < N; c++) {
            const prev = off;
            if (c > 1 && c < N - 3 && rng() < 0.35) off += rng() < 0.5 ? -1 : 1;
            if (c >= N - 3) off += off > 0 ? -1 : off < 0 ? 1 : 0;   // retour à la hauteur d'arrivée
            off = c === N - 1 ? 0 : Math.max(-4, Math.min(4, off));
            // bande du couloir, plus la jonction verticale avec la colonne précédente (le méandre reste d'un seul tenant)
            for (let y = Math.min(run.a + prev, run.a + off); y <= Math.max(run.b + prev, run.b + off); y++) {
                const k = key(seam + c, my(clampRow(y)));
                clearCell(k); grass.delete(k);
            }
            if (road) paths.add(key(seam + c, my(clampRow(mid + off))));
        }
    });

    // 4. Excroissances : presqu'îles de terrain en haut et en bas.
    const wings = [];
    // cases de l'ancienne carte atteignables à pied, dans le nouveau repère : une ouverture de bordure ne s'appuie que sur l'une d'elles
    const baseNew = new Set([...base].map(k => { const [x, y] = unkey(k); return key(mx(x), my(y)); }));
    const hardNew = new Set([...hard].map(k => { const [x, y] = unkey(k); return key(mx(x), my(y)); }));
    const bulge = (top, x0, width, round) => {
        // la bordure ancienne (2 lignes) n'est ouverte qu'au-dessus d'une case libre de la première ligne praticable
        const probeY = top ? T + 2 : T + h0 - 3;
        const openAt = x => !obst.has(key(x, probeY)) && !liq.has(key(x, probeY)) && baseNew.has(key(x, probeY)) && !hardNew.has(key(x, probeY));
        let links = 0;
        for (let x = x0; x < x0 + width; x++) if (openAt(x)) links++;
        if (links < 3) return;   // aucun accès : pas d'excroissance
        for (let x = x0; x < x0 + width; x++) {
            // « arrondi » : bosse en demi-sinus ; « rectangle » : profondeur constante, bordure ancienne ouverte sur toute la largeur
            const t = (x - x0 + 0.5) / width, shape = Math.pow(Math.sin(Math.PI * t), 0.6);
            const d = round ? Math.max(3, Math.min(T, Math.round(T * shape * (0.85 + 0.3 * noise(x, top ? 3 : 90, 3, seed + 5)) + 1))) : T;
            for (let i = 0; i < d; i++) {
                const yy = top ? T + 1 - i : T + h0 - 2 + i;
                if (yy < 2 || yy >= H - 2) continue;   // les deux lignes de bord restent de la matière de bordure (couronne d'eau, world/expand.js)
                const border = top ? yy >= T : yy <= T + h0 - 1 && i < 2;
                if (round && border && !openAt(x)) continue;
                const k = key(x, yy);
                clearCell(k);
                const n = noise(x, yy, 3.5, seed + 9), g = noise(x + 11, yy + 5, 5, seed + 4);
                if (!border && i > 1 && n > 0.72) obst.add(k);
                else if (hasGrass && g > 0.5) grass.add(k);
            }
        }
        wings.push({ top, x0, width, round });
    };
    [true, false].forEach(top => {
        const count = rng() < 0.5 ? 2 : 1;
        let from = 6;
        for (let i = 0; i < count; i++) {
            const width = 14 + Math.floor(rng() * 13);
            const room = W - 6 - width - from;
            if (room < 0) break;
            const x0 = from + Math.floor(rng() * Math.max(1, Math.min(room, count === 2 ? 14 : room)));
            bulge(top, x0, width, rng() < 0.5);
            from = x0 + width + 4;
        }
    });

    // 5. Passages de bord haut et bas (ex. `v` vers le hameau) : ils restent sur le nouveau bord, reliés par une chaussée de 3 cases.
    const exits = (screen.exits || []).map(e => {
        const edge = e.door ? null : e.x === 0 ? 'west' : e.x === w0 - 1 ? 'east' : e.y === 0 ? 'north' : e.y === h0 - 1 ? 'south' : null;
        if (edge === 'north' || edge === 'south') {
            const x = mx(e.x), top = edge === 'north';
            for (let y = top ? 0 : T + h0 - 3; y <= (top ? T + 2 : H - 1); y++) for (let dx = -1; dx <= 1; dx++) { const k = key(x + dx, y); clearCell(k); grass.delete(k); }
            return { ...e, x, y: top ? 0 : H - 1 };
        }
        return { ...e, x: edge === 'east' ? W - 1 : mx(e.x), y: my(e.y) };
    });

    // 5 bis. Passages déplacés vers le haut ou le bas (variété du parcours).
    const eroded = new Set();
    const moved = [];
    const lanes = new Set();   // chaussées des passages déplacés : les coins arrondis n'y touchent pas
    let spawn = { x: mx(screen.spawn.x), y: my(screen.spawn.y) };
    for (const mv of moves) {
        const i = exits.findIndex(e => e.to === mv.to && !e.door && (e.x === 0 || e.x === W - 1));
        if (i < 0 || (mv.edge !== 'north' && mv.edge !== 'south')) { return screen; }
        const e = exits[i], west = e.x === 0, north = mv.edge === 'north', yg = e.y;
        const candidates = Array.from({ length: 34 }, (_, j) => (west ? 4 + j : W - 5 - j)).sort(() => rng() - 0.5);
        let done = false;
        for (const x of candidates) {
            const shaft = [], cells = [];
            for (let y = north ? 0 : yg; y <= (north ? yg : H - 1); y++) for (let dx = -1; dx <= 1; dx++) shaft.push([x + dx, y]);
            for (let xx = west ? 2 : x; xx <= (west ? x : W - 3); xx++) for (let dy = -1; dy <= 1; dy++) cells.push([xx, yg + dy]);
            // seule la chaussée verticale doit éviter les personnages ; le couloir d'origine peut les frôler (ils restent en place)
            const blocked = shaft.some(([cx, cy]) => cx < 1 || cx >= W - 1 || cy < 0 || cy >= H
                || (hardNew.has(key(cx, cy)) && !(cx === spawn.x && cy === spawn.y) && !(cx === e.x && cy === e.y)));
            cells.push(...shaft);
            if (blocked) continue;
            cells.forEach(([cx, cy]) => { const k = key(cx, cy); clearCell(k); grass.delete(k); lanes.add(k); });
            for (let y = north ? 0 : yg; y <= (north ? yg : H - 1); y++) paths.add(key(x, y));
            for (let xx = west ? 2 : x; xx <= (west ? x : W - 3); xx++) paths.add(key(xx, yg));
            // ancien passage muré (matière de bordure) : les deux colonnes du bord, trois lignes
            for (let dy = -1; dy <= 1; dy++) for (const xx of west ? [0, 1] : [W - 1, W - 2]) {
                const k = key(xx, yg + dy);
                if (xx === spawn.x && yg + dy === spawn.y) continue;
                clearCell(k); grass.delete(k); paths.delete(k); fillMaterial(k); eroded.add(k);
            }
            for (let dy = -2; dy <= 2; dy++) for (const xx of west ? [0, 1, 2] : [W - 1, W - 2, W - 3]) { const k = key(xx, yg + dy); if (xx <= 1 || xx >= W - 2) paths.delete(k); }
            exits[i] = { ...e, x, y: north ? 0 : H - 1 };
            if (Math.abs(spawn.y - yg) <= 1 && (west ? spawn.x <= 2 : spawn.x >= W - 3)) { const k = key(spawn.x, spawn.y); clearCell(k); eroded.add(k); spawn = { x, y: north ? 1 : H - 2 }; }
            moved.push(mv.to);
            done = true;
            break;
        }
        if (!done) { return screen; }
    }

    // 6. Coins arrondis : demi-ellipses de bordure sur les quatre coins de l'ancien rectangle (jamais sur une case à ne pas toucher).
    const keepCell = new Set();
    hard.forEach(k => { const [x, y] = unkey(k); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keepCell.add(key(mx(x) + dx, my(y) + dy)); });   // et leurs voisines : on doit pouvoir les atteindre
    exits.forEach(e => { for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) keepCell.add(key(e.x + dx, e.y + dy)); });
    lanes.forEach(k => keepCell.add(k));
    const erode = (cx0, cy0, sx, sy) => {
        const round = rng() < 0.5;   // mélange : coin arrondi (demi-ellipse) ou encoche en escalier (deux rectangles emboîtés)
        const rx = round ? 7 + Math.floor(rng() * 5) : 6 + Math.floor(rng() * 4), ry = round ? 4 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2);
        const rx2 = 3 + Math.floor(rng() * 2), ry2 = ry + 3;
        for (let dy = 0; dy < (round ? ry : ry2); dy++) for (let dx = 0; dx < rx; dx++) {
            if (round) {
                const wob = noise(dx + cx0, dy + cy0, 2.5, seed + 13) * 0.35;
                if (((rx - dx) / rx) ** 2 + ((ry - dy) / ry) ** 2 <= 1 + wob - 0.25) continue;   // à l'intérieur de l'ellipse conservée
            } else if (!((dx < rx && dy < ry) || (dx < rx2 && dy < ry2))) continue;
            const x = cx0 + sx * dx, y = cy0 + sy * dy, k = key(x, y);
            if (x < 0 || y < 0 || x >= W || y >= H || keepCell.has(k)) continue;
            clearCell(k); grass.delete(k); paths.delete(k); fillMaterial(k); eroded.add(k);
        }
    };
    erode(0, T, 1, 1); erode(W - 1, T, -1, 1); erode(0, T + h0 - 1, 1, -1); erode(W - 1, T + h0 - 1, -1, -1);

    // 7. Garde-fou : tout ce qui était atteignable à pied l'est encore.
    const solid1 = new Set([...solid0].map(k => { const [x, y] = unkey(k); return key(mx(x), my(y)); }));
    exits.forEach(e => solid1.add(key(e.x, e.y)));
    solid1.delete(key(spawn.x, spawn.y));
    const now = reachable(W, H, obst, liq, solid1, spawn);
    for (const e of exits.filter(x => moved.includes(x.to))) { if (!STEPS.some(([dx, dy]) => now.has(key(e.x + dx, e.y + dy)) || (e.x + dx === spawn.x && e.y + dy === spawn.y))) { return screen; } }
    for (const k of base) { const [x, y] = unkey(k); const nk = key(mx(x), my(y)); if (!eroded.has(nk) && !now.has(nk)) { return screen; } }

    // Application : coordonnées de tous les objets décalés, grille agrandie.
    const at = p => ({ ...p, x: mx(p.x), y: my(p.y) });
    screen.npcs = (screen.npcs || []).map(at);
    screen.chests = (screen.chests || []).map(at);
    screen.enemies = (screen.enemies || []).map(e => ({
        ...at(e),
        ...(e.patrol ? { patrol: e.patrol.map(([x, y]) => [mx(x), my(y)]) } : {}),
        ...(e.wall ? { wall: e.wall.map(([x, y]) => [mx(x), my(y)]) } : {})
    }));
    if (screen.waypoint) screen.waypoint = at(screen.waypoint);
    screen.spawn = spawn;
    screen.exits = exits;
    if (screen.pillars) screen.pillars = screen.pillars.map(([x, y]) => [mx(x), my(y)]);
    if (screen.sealed) screen.sealed = screen.sealed.map(([x, y]) => [mx(x), my(y)]);
    screen.w = W; screen.h = H;
    screen.obstacles = toRects(obst);
    screen.liquids = toRects(liq);
    screen.paths = toRects(paths);
    if (screen.grass) {
        obst.forEach(k => grass.delete(k)); liq.forEach(k => grass.delete(k));
        if (grass.size) screen.grass = { ...screen.grass, cells: toRects(grass) };
        else delete screen.grass;
    }
    screen.decorMap = { seam, block: N, top: T };   // le décor (tirage d'après les coordonnées) reste celui de la carte d'origine : voir decor.js decorCell
    // Régions bordées d'arbres : l'étendue hors terrain (obstacles) est dessinée en arbres de bordure serrés (explorationView.js), pas en décor isolé
    if (treeBorder) { const rim = new Set([...fillSet].filter(k => obst.has(k))); if (rim.size) screen.rimTrees = toRects(rim); }
    screen.enlarged = { seam, block: N, top: T, bottom: B, wings, moved };
    return screen;
}

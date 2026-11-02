// Level design « à la Pokémon GBA » des routes et zones sauvages (voir agents/level-design.md, section « Contraintes de level design »).
// Logique pure, appliquée par `assembleWorld` en toute fin de génération des cartes (après les herbes épaissies), sur les cartes dessinées
// à la main : elle ajoute des contraintes de parcours sans jamais fermer un chemin ni toucher aux entités.
//
//  1. CORNICHES (`screen.ledges` = [[x, y, dx, dy]…]) : un rebord que l'on franchit d'un saut, dans un seul sens (comme les rebords de
//     Pokémon). Le saut est un raccourci : le retour oblige à faire le tour (détour d'au moins MIN_DETOUR pas). Jamais de sens unique
//     qui enferme : toute case atteignable avant l'ajout reste atteignable SANS sauter.
//  2. DÉFILÉS D'HERBES : là où la carte se resserre naturellement (un mur de relief percé d'un passage de 1 à 5 cases), le passage et ses
//     abords sont plantés de hautes herbes, pour obliger à les traverser (rencontres). Un passage déjà tracé en chemin reste sûr.
//  3. MOTIFS D'OBSTACLES : chevrons, vergers en quinconce, slaloms, clairières d'herbes cernées, losanges à entrée, peignes d'alcôves,
//     posés en terrain dégagé pour casser la monotonie. Leurs couloirs font 2 cases au moins.
// Jamais touchés : bordures, bâtiments, structures, entités (et leur voisinage), sorties, apparition, pierres de voyage, chemins, eau.
// Déterministe (tirage stable selon l'identifiant de la carte).

import { toSet, toRects, buildingCells, routeCells } from './expand.js';

const key = (x, y) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MARGIN_X = 6, MARGIN_Y = 4;     // bordure intacte : couloirs et défilés des passages de bord
export const MIN_DETOUR = 7;         // pas de détour minimal pour revenir d'une corniche
export const LEDGE_MIN = 5, LEDGE_MAX = 10;   // longueur d'une corniche
const RING_WALLS = 1;                 // part de relief tolérée autour d'un motif
const MAX_LEDGES = 2, MAX_MOTIFS = 2, MAX_DEFILES = 2;
const TRIES = 400;                     // positions testées au plus par élément

const hash = (a, b, c = 0) => Math.abs(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453) % 1;
const seedOf = id => [...id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 9973, 7);

// Seules les routes et les zones sauvages de plein air « classiques » sont retouchées.
export const isDesignable = screen =>
    screen.kind === 'wild' && !screen.interior && !screen.arena && !screen.aquatic && Boolean(screen.grass) && !screen.grass.water &&
    screen.biome !== 'tides' && /_(wild|road)$/.test(screen.id) && screen.w >= 36 && screen.h >= 14;

// ── Motifs d'obstacles ───────────────────────────────────────────────
// # obstacle · g haute herbe · . case laissée telle quelle (doit rester libre : couloir) · espace : ignoré.
export const MOTIFS = {
    chevron: ['#....', '.#...', '..#..', '.#...', '#....'],
    verger: ['##..##..##', '##..##..##', '..........', '..........', '..##..##..', '..##..##..'],
    slalom: ['#.....#...', '#..#..#..#', '#..#..#..#', '#..#..#..#', '#..#..#..#', '...#.....#'],
    clairiere: ['#########', '#ggggggg#', '#ggggggg#', '#ggggggg#', '###...###'],
    losange: ['...#...', '..#g#..', '.#ggg#.', '..#g#..', '...g...'],
    peigne: ['#########', '#g#g#g#g#', '.........'],
    diagonale: ['#.....', '.#....', '..#...', '...#..', '....#.'],
    escalier: ['##....', '.##...', '..##..', '...##.'],
    haie: ['.......', '#######', '.......'],
    ilot: ['.##.', '####', '.##.']
};

const mirrorX = rows => rows.map(r => [...r].reverse().join(''));
const mirrorY = rows => [...rows].reverse();

// ── Contexte d'une carte ─────────────────────────────────────────────
function makeContext(screen) {
    const { w, h } = screen;
    const prot = new Set();
    const mark = (x, y, r) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) prot.add(key(x + dx, y + dy)); };
    [...buildingCells(screen)].forEach(k => { const [x, y] = k.split(',').map(Number); mark(x, y, 1); });
    (screen.npcs || []).forEach(e => mark(e.x, e.y, 1));
    (screen.chests || []).forEach(e => mark(e.x, e.y, 1));
    (screen.enemies || []).forEach(e => {
        mark(e.x, e.y, 2);
        if (e.patrol) routeCells(e.patrol).forEach(c => mark(c.x, c.y, 1));
        (e.wall || []).forEach(([x, y]) => mark(x, y, 1));
    });
    if (screen.spawn) mark(screen.spawn.x, screen.spawn.y, 3);
    (screen.exits || []).forEach(e => mark(e.x, e.y, 3));
    if (screen.waypoint) mark(screen.waypoint.x, screen.waypoint.y, 2);
    (screen.spots || []).forEach(sp => mark(sp.x, sp.y, 1));
    (screen.pillars || []).concat(screen.sealed || []).forEach(([x, y]) => mark(x, y, 2));
    (screen.structures || []).forEach(s => { for (let i = -2; i <= s.w + 1; i++) for (let j = -2; j <= s.h + 1; j++) prot.add(key(s.x + i, s.y + j)); });
    const solid = new Set([...(screen.npcs || []), ...(screen.chests || []), ...(screen.waypoint ? [screen.waypoint] : [])].map(e => key(e.x, e.y)));
    return {
        w, h, spawn: screen.spawn, prot, solid,
        obst: toSet(screen.obstacles), liq: toSet(screen.liquids), paths: toSet(screen.paths), grass: toSet(screen.grass.cells),
        ledges: new Map()
    };
}

const inB = (c, x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h;
const isWall = (c, x, y) => !inB(c, x, y) || c.obst.has(key(x, y)) || c.liq.has(key(x, y)) || c.ledges.has(key(x, y));
const isOpen = (c, x, y) => !isWall(c, x, y);
const isFree = (c, x, y) => isOpen(c, x, y) && !c.prot.has(key(x, y)) && !c.paths.has(key(x, y));
// case de corniche possible : ouverte, hors voisinage d'entité (un chemin peut être coupé par un rebord)
const isRoom = (c, x, y) => isOpen(c, x, y) && !c.prot.has(key(x, y)) && !c.grass.has(key(x, y));
const inMargin = (c, x, y) => x >= MARGIN_X && y >= MARGIN_Y && x < c.w - MARGIN_X && y < c.h - MARGIN_Y;

// Cases atteignables à pied depuis l'apparition (corniches fermées, personnages et coffres pleins).
function reach(c) {
    const seen = new Set([key(c.spawn.x, c.spawn.y)]);
    const queue = [c.spawn];
    while (queue.length) {
        const p = queue.shift();
        for (const [dx, dy] of STEPS) {
            const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
            if (seen.has(k) || isWall(c, nx, ny) || c.solid.has(k)) continue;
            seen.add(k); queue.push({ x: nx, y: ny });
        }
    }
    return seen;
}

// Distance à pied (en pas) entre deux cases, ou Infinity.
function distance(c, from, to) {
    const seen = new Set([key(from.x, from.y)]);
    let frontier = [from], d = 0;
    while (frontier.length) {
        const next = [];
        for (const p of frontier) {
            if (p.x === to.x && p.y === to.y) return d;
            for (const [dx, dy] of STEPS) {
                const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
                if (seen.has(k) || isWall(c, nx, ny) || c.solid.has(k)) continue;
                seen.add(k); next.push({ x: nx, y: ny });
            }
        }
        frontier = next; d++;
    }
    return Infinity;
}

// Toute case atteignable avant la modification (hors cases modifiées) l'est encore après.
const stillConnected = (c, base, changed) => {
    const now = reach(c);
    for (const k of base) if (!changed.has(k) && !now.has(k)) return false;
    return true;
};

const shuffled = (list, seed, salt) => list.map(p => [hash(p[0] + seed, p[1] + salt, seed), p]).sort((a, b) => a[0] - b[0]).map(e => e[1]);

// ── 1. Corniches ─────────────────────────────────────────────────────
// Une corniche est une ligne de LEDGE_MIN à LEDGE_MAX cases dont les deux bouts sont des murs (relief existant, sinon deux poteaux
// d'obstacle posés pour l'occasion), avec de part et d'autre une bande libre (départ du saut, atterrissage).
function ledgeCandidates(c, seed) {
    const out = [];
    for (let x = MARGIN_X; x < c.w - MARGIN_X; x++) for (let y = MARGIN_Y; y < c.h - MARGIN_Y; y++) {
        for (const o of ['v', 'h']) {
            const [sx, sy] = o === 'v' ? [0, 1] : [1, 0];
            if (!isRoom(c, x, y)) continue;
            if (isRoom(c, x - sx, y - sy)) continue;   // départ du plus long segment libre
            let len = 0;
            while (len < LEDGE_MAX && isRoom(c, x + sx * len, y + sy * len) && inMargin(c, x + sx * len, y + sy * len)) len++;
            if (len < LEDGE_MIN) continue;
            out.push([x, y, len, o, sx, sy]);
        }
    }
    return shuffled(out, seed, 11);
}

function tryLedge(c, base, cand, seed) {
    const [x, y, len, o, sx, sy] = cand;
    // vers l'est (raccourci vers l'avant) le plus souvent ; vers le sud pour les segments horizontaux
    const dirs = o === 'v' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    const dir = hash(x, y, seed) < 0.7 ? dirs[0] : dirs[1];
    const cells = [];
    for (let i = 0; i < len; i++) cells.push([x + sx * i, y + sy * i]);
    if (!cells.every(([cx, cy]) => isRoom(c, cx, cy) && inMargin(c, cx, cy))) return null;
    const posts = [[x - sx, y - sy], [x + sx * len, y + sy * len]].filter(([px, py]) => !isWall(c, px, py));
    if (!posts.every(([px, py]) => isFree(c, px, py))) return null;
    for (const [cx, cy] of cells) {
        const pre = [cx - dir[0], cy - dir[1]], land = [cx + dir[0], cy + dir[1]];
        if (!isOpen(c, pre[0], pre[1]) || !isOpen(c, land[0], land[1])) return null;
        if (c.prot.has(key(pre[0], pre[1])) || c.prot.has(key(land[0], land[1]))) return null;
    }
    // pas deux corniches collées
    for (const k of c.ledges.keys()) {
        const [lx, ly] = k.split(',').map(Number);
        if (cells.some(([cx, cy]) => Math.abs(cx - lx) + Math.abs(cy - ly) < 8)) return null;
    }
    cells.forEach(([cx, cy]) => { c.ledges.set(key(cx, cy), dir); c.grass.delete(key(cx, cy)); });
    posts.forEach(([px, py]) => { c.obst.add(key(px, py)); c.grass.delete(key(px, py)); });
    const changed = new Set([...cells, ...posts].map(([cx, cy]) => key(cx, cy)));
    const mid = cells[Math.floor(cells.length / 2)];
    const pre = { x: mid[0] - dir[0], y: mid[1] - dir[1] }, land = { x: mid[0] + dir[0], y: mid[1] + dir[1] };
    if (stillConnected(c, base, changed) && distance(c, pre, land) >= MIN_DETOUR) return cells;
    cells.forEach(([cx, cy]) => c.ledges.delete(key(cx, cy)));
    posts.forEach(([px, py]) => c.obst.delete(key(px, py)));
    return null;
}

// ── 2. Défilés d'herbes ──────────────────────────────────────────────
// Une haie (obstacles du biome) coupe la carte de haut en bas ou de gauche à droite ; elle n'est percée que d'un seul passage de
// GAP_MIN à GAP_MAX cases (là où un chemin, une entité ou un obstacle déjà posé l'impose, ou au tirage), planté de hautes herbes
// sur trois colonnes de profondeur : impossible d'avancer sans les traverser.
const GAP_MIN = 2, GAP_MAX = 5;

function defileCandidates(c, seed) {
    const out = [];
    for (let x = MARGIN_X + 2; x < c.w - MARGIN_X - 2; x++) out.push({ axis: 'col', at: x });
    for (let y = MARGIN_Y + 1; y < c.h - MARGIN_Y - 1; y++) out.push({ axis: 'row', at: y });
    return shuffled(out.map(d => [d.at, d.axis === 'col' ? 0 : 1, d]), seed, 23).map(e => e[2]);
}

function tryDefile(c, base, d, taken) {
    if (taken.some(t => t.axis === d.axis && Math.abs(t.at - d.at) < 12)) return null;
    const span = d.axis === 'col' ? c.h : c.w;
    const cellAt = a => (d.axis === 'col' ? [d.at, a] : [a, d.at]);
    const open = [];
    for (let a = 0; a < span; a++) { const [x, y] = cellAt(a); if (isOpen(c, x, y)) open.push(a); }
    if (open.length < 6) return null;
    // les cases à ne pas fermer (chemins, voisinage d'entités) forment le passage ; sinon on le tire
    const forced = open.filter(a => { const [x, y] = cellAt(a); return c.paths.has(key(x, y)) || c.prot.has(key(x, y)); });
    let gap;
    if (forced.length) {
        const lo = Math.min(...forced), hi = Math.max(...forced);
        if (hi - lo + 1 > GAP_MAX) return null;
        gap = []; for (let a = lo; a <= hi; a++) gap.push(a);
    } else {
        const len = GAP_MIN + Math.floor(hash(d.at, span, 3) * (GAP_MAX - GAP_MIN));
        const start = open[Math.floor(hash(d.at, 9, 4) * Math.max(1, open.length - len))];
        gap = []; for (let a = start; a < start + len; a++) gap.push(a);
    }
    while (gap.length < GAP_MIN) gap.push(gap[gap.length - 1] + 1);
    // le passage est un tenant de cases ouvertes
    if (!gap.every(a => { const [x, y] = cellAt(a); return isOpen(c, x, y); })) return null;
    const wall = open.filter(a => !gap.includes(a)).map(cellAt);
    if (wall.some(([x, y]) => c.grass.has(key(x, y)))) return null;   // une haie ne coupe pas une nappe d'herbe
    if (wall.length < 4) return null;
    wall.forEach(([x, y]) => { c.obst.add(key(x, y)); c.grass.delete(key(x, y)); });
    const changed = new Set(wall.map(([x, y]) => key(x, y)));
    const ok = stillConnected(c, base, changed);
    if (!ok) { wall.forEach(([x, y]) => c.obst.delete(key(x, y))); return null; }
    // herbes : le passage et une colonne (ou rangée) de chaque côté, hors voisinage des entités
    const cells = [];
    for (let k = -1; k <= 1; k++) for (const a of gap) {
        const [gx, gy] = d.axis === 'col' ? [d.at + k, a] : [a, d.at + k];
        if (isOpen(c, gx, gy) && !c.grass.has(key(gx, gy)) && (!c.prot.has(key(gx, gy)) || c.paths.has(key(gx, gy)))) cells.push([gx, gy]);
    }
    return { cells, wall: wall.length };
}

// ── 3. Motifs ────────────────────────────────────────────────────────
function motifPositions(c, rows, seed) {
    const mh = rows.length, mw = rows[0].length;
    const out = [];
    for (let x = MARGIN_X - 2; x + mw < c.w - MARGIN_X + 2; x += 1) for (let y = MARGIN_Y - 1; y + mh < c.h - MARGIN_Y + 1; y += 1) out.push([x, y]);
    return shuffled(out, seed, 31);
}

function tryMotif(c, base, rows, x0, y0) {
    const mh = rows.length, mw = rows[0].length;
    const cells = [];
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
        const ch = rows[j][i], x = x0 + i, y = y0 + j;
        if (ch === '#' && c.obst.has(key(x, y)) && !c.prot.has(key(x, y))) cells.push([x, y, ch]);
        else if (ch === '#' || ch === 'g') { if (!isFree(c, x, y) || (ch === '#' && c.grass.has(key(x, y)))) return null; cells.push([x, y, ch]); }
        else if (ch === '.' && !isOpen(c, x, y)) return null;
    }
    // terrain dégagé autour : aucune masse de relief collée au motif
    let ring = 0, walls = 0;
    for (let j = -1; j <= mh; j++) for (let i = -1; i <= mw; i++) {
        if (j >= 0 && j < mh && i >= 0 && i < mw) continue;
        ring++;
        if (isWall(c, x0 + i, y0 + j)) walls++;
    }
    if (walls > ring * RING_WALLS) return null;
    const saved = cells.map(([x, y, ch]) => [x, y, ch, c.grass.has(key(x, y))]);
    cells.forEach(([x, y, ch]) => { if (ch === '#') { c.obst.add(key(x, y)); c.grass.delete(key(x, y)); } else c.grass.add(key(x, y)); });
    const changed = new Set(cells.filter(e => e[2] === '#').map(([x, y]) => key(x, y)));
    if (stillConnected(c, base, changed)) return cells;
    saved.forEach(([x, y, ch, had]) => { if (ch === '#') c.obst.delete(key(x, y)); if (had) c.grass.add(key(x, y)); else c.grass.delete(key(x, y)); });
    return null;
}

const PATCH_MIN = 12;
function largestPatch(cells) {
    const seen = new Set();
    let best = 0;
    for (const k of cells) {
        if (seen.has(k)) continue;
        let size = 0;
        const stack = [k];
        seen.add(k);
        while (stack.length) {
            const [x, y] = stack.pop().split(',').map(Number);
            size++;
            for (const [dx, dy] of STEPS) { const nk = key(x + dx, y + dy); if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); } }
        }
        best = Math.max(best, size);
    }
    return best;
}

// ── Application ──────────────────────────────────────────────────────
// ── 4. Caches invisibles et coffres mimiques ─────────────────────────
// Par carte : une cache invisible (`hidden`, nichée contre le relief, repérable à l'aura) et un coffre-piège (`mimic`, posé près
// d'un chemin comme un vrai coffre, au butin maigre). Récompenses proportionnelles à la région (15 · rang · palier, cf. FORMAT.md).
function placeChests(c, screen, base, rank, seed, report) {
    const reached = reach(c);
    const wallsAround = (x, y) => STEPS.filter(([dx, dy]) => isWall(c, x + dx, y + dy)).length;
    const cands = [];
    for (let x = MARGIN_X; x < c.w - MARGIN_X; x++) for (let y = MARGIN_Y; y < c.h - MARGIN_Y; y++) {
        const k = key(x, y);
        if (!reached.has(k) || c.prot.has(k) || c.paths.has(k) || c.grass.has(k) || c.solid.has(k)) continue;
        if (Math.abs(x - c.spawn.x) + Math.abs(y - c.spawn.y) < 10) continue;
        cands.push([x, y]);
    }
    const nearPath = (x, y) => STEPS.some(([dx, dy]) => c.paths.has(key(x + dx, y + dy)));
    const kinds = [
        { kind: 'hidden', pick: list => list.filter(([x, y]) => wallsAround(x, y) >= 2) },
        { kind: 'mimic', pick: list => { const open = list.filter(([x, y]) => wallsAround(x, y) <= 1); const tempting = open.filter(([x, y]) => nearPath(x, y)); return tempting.length ? tempting : open; } }
    ];
    kinds.forEach(({ kind, pick }) => {
        for (const [x, y] of shuffled(pick(cands), seed, kind === 'hidden' ? 41 : 43).slice(0, 60)) {
            if (c.prot.has(key(x, y)) || c.solid.has(key(x, y))) continue;
            c.solid.add(key(x, y));
            if (!stillConnected(c, base, c.solid)) { c.solid.delete(key(x, y)); continue; }
            const id = `${screen.id}_${kind === 'hidden' ? 'cache' : 'mimic'}`;
            const chest = kind === 'hidden'
                ? { id, x, y, gold: 30 * rank, tier: 2, hidden: true, label: 'Cache oubliée', openText: 'En butant contre une pierre creuse, tu découvres une cache oubliée.' }
                : { id, x, y, gold: 30 * rank, tier: 2, mimic: true, mimicGold: 4 * rank, label: 'Coffre suspect', openText: 'Un coffre posé là, comme si on t\'attendait…' };
            (screen.chests ||= []).push(chest);
            for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) c.prot.add(key(x + dx, y + dy));
            report[kind] = (report[kind] || 0) + 1;
            return;
        }
    });
}

export function designLevel(screen, options = {}) {
    if (!isDesignable(screen)) return screen;
    const c = makeContext(screen);
    const seed = seedOf(screen.id);
    const report = { motifs: [], ledges: 0, defiles: 0, hidden: 0, mimic: 0 };

    // motifs d'abord (ils posent des obstacles), puis corniches, puis défilés
    const names = Object.keys(MOTIFS).sort((a, b) => hash(seedOf(a), seed) - hash(seedOf(b), seed));
    for (const name of names) {
        if (report.motifs.length >= MAX_MOTIFS) break;
        let rows = MOTIFS[name];
        if (hash(seed, seedOf(name), 5) < 0.5) rows = mirrorX(rows);
        if (hash(seed, seedOf(name), 6) < 0.3) rows = mirrorY(rows);
        const base = reach(c);
        let tries = 0;
        for (const [x, y] of motifPositions(c, rows, seed + seedOf(name))) {
            if (tries++ >= TRIES) break;
            if (report.motifs.some(m => Math.abs(m.x - x) < 14 && Math.abs(m.y - y) < 8)) continue;
            if (tryMotif(c, base, rows, x, y)) { report.motifs.push({ name, x, y }); break; }
        }
    }

    const base = reach(c);
    let tries = 0;
    for (const cand of ledgeCandidates(c, seed)) {
        if (report.ledges >= MAX_LEDGES || tries++ >= TRIES) break;
        if (tryLedge(c, base, cand, seed)) report.ledges++;
    }

    const takenDefiles = [];
    tries = 0;
    for (const d of defileCandidates(c, seed)) {
        if (takenDefiles.length >= MAX_DEFILES || tries++ >= TRIES) break;
        const res = tryDefile(c, reach(c), d, takenDefiles);
        if (!res) continue;
        res.cells.forEach(([x, y]) => c.grass.add(key(x, y)));
        takenDefiles.push(d);
        report.defiles++;
    }

    // Une grande nappe d'herbe (≥ PATCH_MIN cases) existante doit survivre : sinon la carte garde son dessin d'origine.
    if (largestPatch(toSet(screen.grass.cells)) >= PATCH_MIN && largestPatch(c.grass) < PATCH_MIN) {
        screen.design = { motifs: [], ledges: 0, defiles: 0, keep: [] };
        return screen;
    }
    const before = toSet(screen.obstacles);
    report.keep = [...c.obst].filter(k => !before.has(k)).map(k => k.split(',').map(Number)).concat([...c.ledges.keys()].map(k => k.split(',').map(Number)));
    screen.obstacles = toRects(c.obst);
    screen.grass = { ...screen.grass, cells: toRects(c.grass) };
    placeChests(c, screen, reach(c), Math.max(1, options.rank || 1), seed, report);
    if (c.ledges.size) screen.ledges = [...c.ledges].map(([k, dir]) => [...k.split(',').map(Number), dir[0], dir[1]]);
    screen.design = report;
    return screen;
}

export const applyLevelDesign = screens => { Object.values(screens).forEach(designLevel); return screens; };

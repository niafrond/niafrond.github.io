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

import { toSet as toStringSet, toRects as toStringRects, buildingCells, routeCells } from './expand.js';
import { isLowCell } from '../decor.js';

// Clés de case numériques (bien plus rapides que des chaînes dans les parcours de graphe) : x < 512 ; hors carte, jamais confondues avec une case.
const key = (x, y) => y * 512 + x;
const unkey = k => [k & 511, k >> 9];
const toSet = rects => { const out = new Set(); toStringSet(rects).forEach(k => { const [x, y] = k.split(',').map(Number); out.add(key(x, y)); }); return out; };
const toRects = set => toStringRects(new Set([...set].map(k => { const [x, y] = unkey(k); return `${x},${y}`; })));
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MARGIN_X = 6, MARGIN_Y = 4;
const RIM = 4;                        // couloirs de 3 cases devant les passages de bord (world/barriers.js) : jamais touchés     // bordure intacte : couloirs et défilés des passages de bord
export const MIN_DETOUR = 20;         // pas de détour minimal pour revenir d'une corniche
export const LEDGE_MIN = 5, LEDGE_MAX = 10;   // longueur d'une corniche
const RING_WALLS = 1;                 // part de relief tolérée autour d'un motif
const MAX_LEDGES = 1, LEDGE_TRIES = 60, MAX_MOTIFS = 2, MAX_DEFILES = 2;
const TRIES = 25; 
const MOTIF_TRIES = 200;              // les motifs se rejettent d'abord sur leur seule géométrie (peu coûteux)                     // positions testées au plus par élément

const hash = (a, b, c = 0) => Math.abs(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453) % 1;
const seedOf = id => [...id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 9973, 7);

// Seules les routes et les zones sauvages de plein air « classiques » sont retouchées.
export const isDesignable = screen =>
    screen.kind === 'wild' && !screen.interior && !screen.arena && !screen.aquatic && !screen.grass?.water &&
    screen.biome !== 'tides' &&
    (screen.event
        // cartes de plein air des événements (village enneigé, col, sanctuaire, royaume des âmes) : mêmes contraintes, même sans table de hautes herbes
        ? screen.w >= 22 && screen.h >= 12
        : Boolean(screen.grass) && /_(wild|road)$/.test(screen.id) && screen.w >= 36 && screen.h >= 14);

// Cartes de plein air d'une région (village, hameau, zone sauvage, route, sanctuaire) : elles reçoivent au moins les coffres-pièges.
export const isPopulable = screen =>
    Boolean(screen.region) && !screen.interior && !screen.arena && !screen.aquatic && screen.kind !== 'house' && screen.biome !== 'tides' &&
    /^[a-z]+(_(village|hamlet|wild|road))?$/.test(screen.id) && screen.id.split('_')[0] === screen.region && screen.w >= 20 && screen.h >= 12;

export const CACHES_PER_MAP = 8;     // caches invisibles par route / zone sauvage
export const MIMICS_PER_MAP = 3;     // coffres-pièges par carte de plein air

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
    const prot = new Set(), core = new Set();   // core : voisinage strict des entités (un mur de falaise peut frôler le reste de `prot`)
    const mark = (x, y, r) => {
        const rc = r >= 2 ? r - 1 : r;
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
            prot.add(key(x + dx, y + dy));
            if (Math.abs(dx) <= rc && Math.abs(dy) <= rc) core.add(key(x + dx, y + dy));
        }
    };
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
    (screen.structures || []).forEach(s => { for (let i = -2; i <= s.w + 1; i++) for (let j = -2; j <= s.h + 1; j++) { prot.add(key(s.x + i, s.y + j)); if (i >= -1 && j >= -1 && i <= s.w && j <= s.h) core.add(key(s.x + i, s.y + j)); } });
    // cases exactes à ne jamais murer : entités, sorties, apparition, patrouilles, bâtiments, structures
    const hard = new Set([...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || []), ...(screen.exits || []), ...(screen.waypoint ? [screen.waypoint] : []), ...(screen.spawn ? [screen.spawn] : [])].map(e => key(e.x, e.y)));
    (screen.enemies || []).forEach(e => { if (e.patrol) routeCells(e.patrol).forEach(q => hard.add(key(q.x, q.y))); });
    buildingCells(screen).forEach(k => { const [bx, by] = k.split(',').map(Number); hard.add(key(bx, by)); });
    (screen.structures || []).forEach(st => { for (let i = 0; i < st.w; i++) for (let j = 0; j < st.h; j++) hard.add(key(st.x + i, st.y + j)); });
    const solid = new Set([...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || []).filter(e => !e.guardsDoor), ...(screen.exits || []), ...(screen.waypoint ? [screen.waypoint] : [])].map(e => key(e.x, e.y)));   // le gardien d'une porte se contourne ou se bat : il ne ferme pas le passage
    // murs de boss (pilier ou rempart qui barre un couloir jusqu'à la défaite du gardien) : fermés tant qu'on les compte
    (screen.enemies || []).forEach(e => (e.wall || []).forEach(([wx, wy]) => { solid.add(key(wx, wy)); hard.add(key(wx, wy)); }));
    solid.delete(key(screen.spawn.x, screen.spawn.y));
    const solidLight = new Set([...(screen.npcs || []), ...(screen.chests || []), ...(screen.waypoint ? [screen.waypoint] : [])].map(e => key(e.x, e.y)));   // détours : les seuls obstacles que tout le monde voit
    return {
        w, h, spawn: screen.spawn, prot, core, hard, solid, solidLight, screen, lowMemo: new Uint8Array(w * h), origGrass: toSet(screen.grass?.cells),
        obst: toSet(screen.obstacles), liq: toSet(screen.liquids), paths: toSet(screen.paths), grass: toSet(screen.grass?.cells),
        ledges: new Map()
    };
}

const inB = (c, x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h;
// Un décor bas (roseaux, riz, herbes sèches : decor.js) se traverse comme dans le jeu, il ne ferme rien.
// `strict` : tout obstacle ferme (pour la connexité, plus prudente que le jeu) ; sinon comme dans le jeu (pour mesurer les détours).
// Mémoïsé par case : `isLowCell` tire un décor au hasard, trop coûteux à rejouer à chaque parcours.
const lowAt = (c, x, y) => {
    const i = y * c.w + x;
    return (c.lowMemo[i] ||= isLowCell(c.screen, x, y) ? 1 : 2) === 1;
};
const isWall = (c, x, y, strict = false) => !inB(c, x, y) || (c.obst.has(key(x, y)) && (strict || !lowAt(c, x, y))) || c.liq.has(key(x, y)) || c.ledges.has(key(x, y));
const isOpen = (c, x, y) => !isWall(c, x, y);
const isFree = (c, x, y) => isOpen(c, x, y) && !c.prot.has(key(x, y)) && !c.paths.has(key(x, y));
// case de corniche possible : ouverte, hors voisinage d'entité (un chemin peut être coupé par un rebord)
const isRoom = (c, x, y) => isOpen(c, x, y) && !c.prot.has(key(x, y)) && !c.grass.has(key(x, y));
const inMargin = (c, x, y) => x >= MARGIN_X && y >= MARGIN_Y && x < c.w - MARGIN_X && y < c.h - MARGIN_Y;

// Cases atteignables à pied depuis l'apparition (corniches fermées, personnages et coffres pleins).
// Grille des cases fermées (obstacles, eau, corniches, + `extra` : cases pleines) : un parcours de graphe sur tableau est bien plus rapide que sur
// des ensembles de clés. `strict` : tout obstacle ferme ; sinon les décors bas se traversent comme dans le jeu.
function blockedMask(c, strict, extra) {
    const { w, h } = c;
    const m = new Uint8Array(w * h);
    for (const k of c.obst) { const x = k & 511, y = k >> 9; if (x < w && y < h && (strict || !lowAt(c, x, y))) m[y * w + x] = 1; }
    for (const k of c.liq) { const x = k & 511, y = k >> 9; if (x < w && y < h) m[y * w + x] = 1; }
    for (const k of c.ledges.keys()) { const x = k & 511, y = k >> 9; if (x < w && y < h) m[y * w + x] = 1; }
    for (const k of extra) { const x = k & 511, y = k >> 9; if (x < w && y < h) m[y * w + x] = 1; }
    return m;
}
function reach(c, strict = true) {
    const { w, h } = c;
    const m = blockedMask(c, strict, c.solid);
    const start = c.spawn.y * w + c.spawn.x;
    const seen = new Uint8Array(w * h);
    seen[start] = 1;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const i = queue[head], x = i % w, y = (i - x) / w;
        if (x + 1 < w && !seen[i + 1] && !m[i + 1]) { seen[i + 1] = 1; queue.push(i + 1); }
        if (x > 0 && !seen[i - 1] && !m[i - 1]) { seen[i - 1] = 1; queue.push(i - 1); }
        if (y + 1 < h && !seen[i + w] && !m[i + w]) { seen[i + w] = 1; queue.push(i + w); }
        if (y > 0 && !seen[i - w] && !m[i - w]) { seen[i - w] = 1; queue.push(i - w); }
    }
    return Object.assign(new Set(queue.map(i => (i - (i % w)) / w * 512 + (i % w))), {});
}
const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];

// Distance à pied (en pas) entre deux cases, ou Infinity.
function distance(c, from, to) {
    const { w, h } = c;
    const m = blockedMask(c, false, c.solidLight);
    if (from.x < 0 || from.y < 0 || from.x >= w || from.y >= h || to.x < 0 || to.y < 0 || to.x >= w || to.y >= h) return Infinity;
    const start = from.y * w + from.x, goal = to.y * w + to.x;
    if (start === goal) return 0;
    const seen = new Uint8Array(w * h);
    seen[start] = 1;
    let frontier = [start], d = 0;
    while (frontier.length) {
        const next = [];
        d++;
        for (const i of frontier) {
            const x = i % w, y = (i - x) / w;
            const around = [x + 1 < w ? i + 1 : -1, x > 0 ? i - 1 : -1, y + 1 < h ? i + w : -1, y > 0 ? i - w : -1];
            for (const j of around) {
                if (j < 0 || seen[j] || m[j]) continue;
                if (j === goal) return d;
                seen[j] = 1; next.push(j);
            }
        }
        frontier = next;
    }
    return Infinity;
}

// Toute case atteignable avant la modification (hors cases modifiées) l'est encore après.
const stillConnected = (c, base, changed) => {
    const now = reach(c);
    for (const k of base) if (!changed.has(k) && !now.has(k)) return false;
    // chaque personnage, coffre ou pierre de voyage garde une case d'accès atteignable
    const reachable = set => k => { const [x, y] = unkey(k); return STEPS.some(([dx, dy]) => set.has(key(x + dx, y + dy))); };
    const access = reachable(base), accessNow = reachable(now);
    for (const k of c.solid) if (access(k) && !accessNow(k)) return false;
    return true;
};

const shuffled = (list, seed, salt) => list.map(p => [hash(p[0] + seed, p[1] + salt, seed), p]).sort((a, b) => a[0] - b[0]).map(e => e[1]);

// Détour du retour d'une corniche (au plus court des deux bouts) : fini, atteignable depuis l'apparition des deux côtés, et d'au moins MIN_DETOUR.
function detourOk(c, base, cells, dir) {
    const now = reach(c);
    const ends = [cells[0], cells[cells.length - 1], cells[Math.floor(cells.length / 2)]];
    let best = Infinity;
    for (const [ex, ey] of ends) {
        const pre = { x: ex - dir[0], y: ey - dir[1] }, land = { x: ex + dir[0], y: ey + dir[1] };
        if (!now.has(key(pre.x, pre.y)) || !now.has(key(land.x, land.y))) return false;   // les deux rives doivent être jouables sans sauter
        best = Math.min(best, distance(c, pre, land));
    }
    return best >= MIN_DETOUR && best < Infinity;
}

// Les cases déblayées (obstacles retirés) restent atteignables sans sauter : pas de poche créée au-delà d'une corniche.
function clearedReachable(c, cells) {
    if (!cells.length) return true;
    const now = reach(c);
    return cells.every(([x, y]) => c.ledges.has(key(x, y)) || c.obst.has(key(x, y)) || now.has(key(x, y)));
}

// Départ et atterrissage d'une corniche : réservés (ni mur, ni motif, ni coffre ne doivent les boucher).
function reserveLanes(c, cells, dir) {
    cells.forEach(([x, y]) => [[x - dir[0], y - dir[1]], [x + dir[0], y + dir[1]]].forEach(([lx, ly]) => {
        const k = key(lx, ly);
        c.prot.add(k); c.core.add(k); c.hard.add(k);
    }));
}

// ── 1. Corniches ─────────────────────────────────────────────────────
// Une corniche est le maillon d'une falaise : LEDGE_MIN à LEDGE_MAX cases franchissables d'un saut, prolongées de chaque côté par un mur
// d'obstacles (jusqu'à EXT_MAX cases, ou jusqu'au relief existant) pour que le retour fasse un grand tour (MIN_DETOUR pas au moins).
// De part et d'autre : une bande libre (départ du saut, atterrissage).
const EXT_MIN = 10, EXT_MAX = 16;

function ledgeCandidates(c, seed) {
    const out = [];
    for (let x = RIM; x < c.w - RIM; x++) for (let y = RIM; y < c.h - RIM; y++) {
        for (const o of ['v', 'h']) {
            const [sx, sy] = o === 'v' ? [0, 1] : [1, 0];
            if (!isRoom(c, x, y)) continue;
            let len = 0;
            while (len < LEDGE_MAX && isRoom(c, x + sx * len, y + sy * len)) len++;
            if (len < LEDGE_MIN) continue;
            out.push([x, y, len, o, sx, sy]);
        }
    }
    return shuffled(out, seed, 11);
}

// Mur prolongeant la corniche depuis (x, y) dans le sens (dx, dy) : cases libres jusqu'au relief existant ou à `max` cases.
function wallRun(c, x, y, dx, dy, max) {
    const run = [];
    for (let i = 1; i <= max; i++) {
        const px = x + dx * i, py = y + dy * i;
        if (isWall(c, px, py)) break;                  // relief existant : ancrage
        if (px < RIM || py < RIM || px >= c.w - RIM || py >= c.h - RIM) break;
        if (!isOpen(c, px, py) || c.core.has(key(px, py)) || c.paths.has(key(px, py))) break;   // chemin, entité : le mur s'arrête (l'herbe, elle, est coupée)
        run.push([px, py]);
    }
    return run;
}

function tryLedge(c, base, cand, seed) {
    const [x, y, len0, o, sx, sy] = cand;
    // vers l'est (raccourci vers l'avant) le plus souvent ; vers le sud pour les segments horizontaux
    const dirs = o === 'v' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    if (hash(x, y, seed) >= 0.7) dirs.reverse();
    const len = Math.min(len0, LEDGE_MIN + Math.floor(hash(y, x, seed) * (LEDGE_MAX - LEDGE_MIN + 1)));
    for (const dir of dirs) {
        const done = tryLedgeDir(c, base, x, y, len, sx, sy, dir, seed);
        if (done) return done;
    }
    return null;
}

function tryLedgeDir(c, base, x, y, len, sx, sy, dir, seed) {
    const cells = [];
    for (let i = 0; i < len; i++) cells.push([x + sx * i, y + sy * i]);
    for (const [cx, cy] of cells) {
        const pre = [cx - dir[0], cy - dir[1]], land = [cx + dir[0], cy + dir[1]];
        if (!isOpen(c, pre[0], pre[1]) || !isOpen(c, land[0], land[1])) return null;
        if (c.prot.has(key(pre[0], pre[1])) || c.prot.has(key(land[0], land[1]))) return null;
    }
    // pas deux corniches collées
    for (const k of c.ledges.keys()) {
        const [lx, ly] = unkey(k);
        if (cells.some(([cx, cy]) => Math.abs(cx - lx) + Math.abs(cy - ly) < 8)) return null;
    }
    const extA = EXT_MIN + Math.floor(hash(x, y, seed + 1) * (EXT_MAX - EXT_MIN + 1));
    const extB = EXT_MIN + Math.floor(hash(y, x, seed + 2) * (EXT_MAX - EXT_MIN + 1));
    const first = cells[0], last = cells[cells.length - 1];
    const walls = [...wallRun(c, first[0], first[1], -sx, -sy, extA), ...wallRun(c, last[0], last[1], sx, sy, extB)];
    const lowBefore = cells.filter(([cx, cy]) => c.obst.has(key(cx, cy)));
    cells.forEach(([cx, cy]) => { c.ledges.set(key(cx, cy), dir); c.grass.delete(key(cx, cy)); c.obst.delete(key(cx, cy)); });
    const grassBefore = new Set(c.grass);
    walls.forEach(([px, py]) => { c.obst.add(key(px, py)); c.grass.delete(key(px, py)); });
    const changed = new Set([...cells, ...walls].map(([cx, cy]) => key(cx, cy)));
    const patchBroken = patchLost(c);
    if (!patchBroken && stillConnected(c, base, changed) && detourOk(c, base, cells, dir)) { reserveLanes(c, cells, dir); return cells; }
    cells.forEach(([cx, cy]) => c.ledges.delete(key(cx, cy)));
    walls.forEach(([px, py]) => c.obst.delete(key(px, py)));
    lowBefore.forEach(([cx, cy]) => c.obst.add(key(cx, cy)));
    c.grass = grassBefore;
    return null;
}

// ── 2. Défilés d'herbes ──────────────────────────────────────────────
// Une haie (obstacles du biome) coupe la carte de haut en bas ou de gauche à droite ; elle n'est percée que d'un seul passage de
// GAP_MIN à GAP_MAX cases (là où un chemin, une entité ou un obstacle déjà posé l'impose, ou au tirage), planté de hautes herbes
// sur trois colonnes de profondeur : impossible d'avancer sans les traverser.
const GAP_MIN = 2, GAP_MAX = 5;

function defileCandidates(c, seed) {
    const out = [];
    for (let x = 5; x < c.w - 5; x++) out.push({ axis: 'col', at: x });
    for (let y = 4; y < c.h - 4; y++) out.push({ axis: 'row', at: y });
    return shuffled(out.map(d => [d.at, d.axis === 'col' ? 0 : 1, d]), seed, 23).map(e => e[2]);
}

const LEDGE_GAP = 10;   // une corniche s'ouvre à au moins 10 cases du passage le plus proche (donc un retour d'au moins 20 pas)

// `wantLedge` : la haie devient une falaise ; un tronçon de LEDGE_MIN à LEDGE_MAX cases devient une corniche franchissable d'un saut,
// à l'opposé du passage d'herbes.
function tryDefile(c, base, d, taken, wantLedge = false, seed = 0) {
    if (taken.some(t => t.axis === d.axis && Math.abs(t.at - d.at) < 12)) return null;
    const span = d.axis === 'col' ? c.h : c.w;
    const cellAt = a => (d.axis === 'col' ? [d.at, a] : [a, d.at]);
    const open = [];
    for (let a = 0; a < span; a++) { const [x, y] = cellAt(a); if (isOpen(c, x, y)) open.push(a); }
    if (open.length < 8) return null;
    // les cases à ne pas fermer (voisinage d'entités) forment des passages obligés ; sans elles, le passage d'herbes est tiré
    // (à l'opposé de la corniche s'il y en a une)
    const gapSet = new Set(open.filter(a => { const [x, y] = cellAt(a); return c.core.has(key(x, y)); }));   // une route coupée par la falaise perd les cases murées
    if (gapSet.size > 12) return null;
    const forcedGaps = gapSet.size > 0;
    let ledgeIdx = [];
    let dir = null;
    let clearCells = [];
    if (wantLedge) {
        const L = LEDGE_MIN + Math.floor(hash(d.at, span, seed + 7) * 3);
        // tronçon de corniche : cases libres ou obstacles déblayés (hors voisinage d'entité et hors rive)
        const ledgeable = a => {
            const [x, y] = cellAt(a);
            if (gapSet.has(a) || c.core.has(key(x, y)) || x < RIM || y < RIM || x >= c.w - RIM || y >= c.h - RIM) return false;
            return isOpen(c, x, y) || (c.obst.has(key(x, y)) && !c.liq.has(key(x, y)));
        };
        const starts = shuffled(Array.from({ length: span }, (_, a) => [a, 0]).filter(([a]) => ledgeable(a)), seed, 53).map(e => e[0]);
        const dirs = d.axis === 'col' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
        if (hash(d.at, 5, seed) >= 0.7) dirs.reverse();
        for (const a0 of starts) {
            const run = Array.from({ length: L }, (_, i) => a0 + i);
            if (!run.every(ledgeable)) continue;
            if (forcedGaps && [...gapSet].some(g => Math.min(Math.abs(g - run[0]), Math.abs(g - run[L - 1])) < LEDGE_GAP)) continue;
            // un passage d'herbes tirable à l'opposé
            if (!forcedGaps && !open.some(a => Math.min(Math.abs(a - run[0]), Math.abs(a - run[L - 1])) >= LEDGE_GAP)) continue;
            // départ et atterrissage : cases libres, ou obstacles déblayés (un rebord ouvre une trouée dans le décor)
            const lanes = dv => run.flatMap(a => { const [x, y] = cellAt(a); return [[x - dv[0], y - dv[1]], [x + dv[0], y + dv[1]]]; });
            const fits = dv => lanes(dv).every(([x, y]) => !c.core.has(key(x, y)) && (isOpen(c, x, y) || (c.obst.has(key(x, y)) && x >= RIM && y >= RIM && x < c.w - RIM && y < c.h - RIM)));
            const good = dirs.find(fits);
            if (good) { ledgeIdx = run; dir = good; clearCells = [...lanes(good), ...run.map(cellAt)].filter(([x, y]) => c.obst.has(key(x, y))); break; }
        }
        if (!dir) return null;
    }
    if (!forcedGaps) {
        const far = a => !ledgeIdx.length || Math.min(...ledgeIdx.map(l => Math.abs(l - a))) >= LEDGE_GAP;
        const len = GAP_MIN + Math.floor(hash(d.at, span, 3) * (GAP_MAX - GAP_MIN));
        const spots = shuffled(open.filter(far).map(a => [a, 0]), seed, 59).map(e => e[0]);
        const start = spots.find(a => Array.from({ length: len }, (_, i) => a + i).every(v => open.includes(v) && far(v)));
        if (start === undefined) return null;
        for (let a = start; a < start + len; a++) gapSet.add(a);
    }
    const gaps = [...gapSet];
    const wallIdx = open.filter(a => !gapSet.has(a));
    if (wallIdx.length < 4) return null;
    const ledgeSet = new Set(ledgeIdx);
    const inRim = ([x, y]) => x < RIM || y < RIM || x >= c.w - RIM || y >= c.h - RIM;
    const wall = wallIdx.filter(a => !ledgeSet.has(a)).map(cellAt).filter(cell => !inRim(cell));   // le couloir de bord reste ouvert
    const ledge = ledgeIdx.map(cellAt);
    const grassBefore = new Set(c.grass), pathsBefore = new Set(c.paths);
    clearCells.forEach(([x, y]) => c.obst.delete(key(x, y)));
    wall.forEach(([x, y]) => { c.obst.add(key(x, y)); c.grass.delete(key(x, y)); c.paths.delete(key(x, y)); });
    ledge.forEach(([x, y]) => { c.ledges.set(key(x, y), dir); c.grass.delete(key(x, y)); });
    const undo = () => { clearCells.forEach(([x, y]) => c.obst.add(key(x, y))); wall.forEach(([x, y]) => c.obst.delete(key(x, y))); ledge.forEach(([x, y]) => c.ledges.delete(key(x, y))); c.grass = grassBefore; c.paths = pathsBefore; };
    const changed = new Set([...wall, ...ledge].map(([x, y]) => key(x, y)));
    if (patchLost(c)) { undo(); return null; }
    if (!stillConnected(c, base, changed) || !clearedReachable(c, clearCells)) { undo(); return null; }
    if (wantLedge) {
        if (!detourOk(c, base, ledge, dir)) { undo(); return null; }
    }
    if (wantLedge) reserveLanes(c, ledge, dir);
    // herbes : les passages et une colonne (ou rangée) de chaque côté, hors voisinage des entités
    const cells = [];
    for (let k = -1; k <= 1; k++) for (const a of gaps) {
        const [gx, gy] = d.axis === 'col' ? [d.at + k, a] : [a, d.at + k];
        if (isOpen(c, gx, gy) && !c.grass.has(key(gx, gy)) && !c.core.has(key(gx, gy))) cells.push([gx, gy]);
    }
    return { cells, wall: wall.length, ledge: ledge.length };
}

// Falaise sculptée : quand le décor est trop dense pour y trouver une falaise naturelle, un module est taillé dans une zone sans entité ni
// rive : un mur de FALAISE_LEN cases, une corniche au centre, une bande dégagée de chaque côté (le décor gênant y est déblayé).
// Les deux extrémités du mur restent libres : c'est le détour du retour (au moins MIN_DETOUR pas).
const FALAISE_EXT = 20;   // longueur maximale du mur de chaque côté de la corniche

function carveFalaise(c, base, seed) {
    // orientation 'h' : falaise horizontale (corniche franchie vers le sud ou le nord) ; 'v' : verticale (vers l'est ou l'ouest)
    const spots = [];
    for (const o of ['h', 'v']) {
        const [alongMax, perpMax] = o === 'h' ? [c.w, c.h] : [c.h, c.w];
        for (let along = RIM; along < alongMax - 11; along++) for (let perp = RIM; perp <= perpMax - RIM - 1; perp++) spots.push([o, along, perp]);
    }
    const at = (o, along, perp) => (o === 'h' ? [along, perp] : [perp, along]);
    let tries = 0;
    for (const [o, along, perp] of shuffled(spots.map(sp => [sp[1], sp[2], sp]), seed, 61).map(e => e[2])) {
        if (tries >= (c.screen.event ? 260 : 40)) break;
        const L = 5 + Math.floor(hash(along, perp, seed) * 2);
        const dir = o === 'h' ? (hash(perp, along, seed) < 0.6 ? [0, 1] : [0, -1]) : (hash(perp, along, seed) < 0.6 ? [1, 0] : [-1, 0]);
        const ledge = [];
        for (let i = 0; i < L; i++) ledge.push(at(o, along + i, perp));
        // seuls la corniche et ses deux bandes (départ, atterrissage) doivent être sans entité ni eau
        const lanes = ledge.flatMap(([x, y]) => [[x - dir[0], y - dir[1]], [x + dir[0], y + dir[1]]]);
        if ([...ledge, ...lanes].some(([x, y]) => !inB(c, x, y) || x < RIM || y < RIM || x >= c.w - RIM || y >= c.h - RIM || c.hard.has(key(x, y)) || c.liq.has(key(x, y)) || c.solid.has(key(x, y)) || c.ledges.has(key(x, y)))) continue;
        // le mur prolonge la corniche de chaque côté jusqu'à ce qu'il rencontre une case à ne pas murer (ou FALAISE_EXT cases)
        const blockedAt = (x, y) => x < RIM || y < RIM || x >= c.w - RIM || y >= c.h - RIM || c.hard.has(key(x, y)) || c.ledges.has(key(x, y)) || ledge.some(([lx, ly]) => lx === x && ly === y);
        // mur droit d'abord ; sinon en escalier (la diagonale ferme le passage) pour contourner une case à ne pas murer
        for (const jog of [false, true]) {
            const wall = [];
            for (const sgn of [-1, 1]) {
                let p = perp;
                for (let i = 1; i <= FALAISE_EXT; i++) {
                    const a = sgn < 0 ? along - i : along + L - 1 + i;
                    const step = (jog ? [p, p + 1, p - 1] : [p]).find(q => { const [x, y] = at(o, a, q); return !blockedAt(x, y); });
                    if (step === undefined) break;
                    p = step;
                    const [x, y] = at(o, a, p);
                    if (c.liq.has(key(x, y))) break;   // rive : le mur s'ancre à l'eau
                    wall.push([x, y]);
                }
            }
            tries++;
            const obstBefore = new Set(c.obst), grassBefore = new Set(c.grass), pathsBefore = new Set(c.paths);
            lanes.forEach(([x, y]) => c.obst.delete(key(x, y)));
            ledge.forEach(([x, y]) => { c.obst.delete(key(x, y)); c.grass.delete(key(x, y)); c.ledges.set(key(x, y), dir); });
            wall.forEach(([x, y]) => { c.obst.add(key(x, y)); c.grass.delete(key(x, y)); c.paths.delete(key(x, y)); });
            const undo = () => { c.obst = obstBefore; c.grass = grassBefore; c.paths = pathsBefore; ledge.forEach(([x, y]) => c.ledges.delete(key(x, y))); };
            const changed = new Set([...ledge, ...wall].map(([x, y]) => key(x, y)));
            const patchBroken = patchLost(c);
            if (!patchBroken && stillConnected(c, base, changed) && clearedReachable(c, lanes.filter(([x, y]) => obstBefore.has(key(x, y)))) && detourOk(c, base, ledge, dir)) { reserveLanes(c, ledge, dir); return ledge; }
            undo();
        }
    }
    return null;
}

// Dernier recours dans une carte très serrée : corniche posée sans mur, puis le retour est rallongé en murant, un à un, des maillons du
// chemin le plus court (le plus loin possible de la corniche) tant que tout reste atteignable, jusqu'à MIN_DETOUR pas.
function shortestPath(c, from, to) {
    const prev = new Map([[key(from.x, from.y), null]]);
    let frontier = [from];
    while (frontier.length) {
        const next = [];
        for (const p of frontier) {
            if (p.x === to.x && p.y === to.y) {
                const path = [];
                for (let k = key(p.x, p.y); k !== null && k !== undefined; k = prev.get(k)) path.push(unkey(k));
                return path.reverse();
            }
            for (const [dx, dy] of STEPS) {
                const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
                if (prev.has(k) || isWall(c, nx, ny) || c.solidLight.has(k)) continue;
                prev.set(k, key(p.x, p.y)); next.push({ x: nx, y: ny });
            }
        }
        frontier = next;
    }
    return null;
}

function carveLengthened(c, base, seed) {
    const spots = [];
    for (const o of ['h', 'v']) for (let a = RIM; a < (o === 'h' ? c.w : c.h) - 10; a++) for (let b = RIM; b < (o === 'h' ? c.h : c.w) - RIM; b++) spots.push([o, a, b]);
    let tries = 0;
    for (const [o, a, b] of shuffled(spots.map(sp => [sp[1], sp[2], sp]), seed, 67).map(e => e[2])) {
        if (tries >= 40) break;
        const dir = o === 'h' ? [0, 1] : [1, 0];
        const ledge = Array.from({ length: 5 }, (_, i) => (o === 'h' ? [a + i, b] : [b, a + i]));
        const lanes = ledge.flatMap(([x, y]) => [[x - dir[0], y - dir[1]], [x + dir[0], y + dir[1]]]);
        if ([...ledge, ...lanes].some(([x, y]) => !inB(c, x, y) || x < RIM || y < RIM || x >= c.w - RIM || y >= c.h - RIM || c.hard.has(key(x, y)) || c.liq.has(key(x, y)) || c.solid.has(key(x, y)) || c.ledges.has(key(x, y)))) continue;
        tries++;
        const obstBefore = new Set(c.obst), grassBefore = new Set(c.grass), pathsBefore = new Set(c.paths);
        lanes.forEach(([x, y]) => c.obst.delete(key(x, y)));
        ledge.forEach(([x, y]) => { c.obst.delete(key(x, y)); c.grass.delete(key(x, y)); c.ledges.set(key(x, y), dir); });
        const added = new Set();
        const mid = ledge[2];
        const pre = { x: mid[0] - dir[0], y: mid[1] - dir[1] }, land = { x: mid[0] + dir[0], y: mid[1] + dir[1] };
        const keepLanes = new Set(lanes.map(([x, y]) => key(x, y)));
        for (let it = 0; it < 120; it++) {
            const path = shortestPath(c, pre, land);
            if (!path) break;
            if (path.length - 1 >= MIN_DETOUR) break;
            // maillon à murer : du plus loin des deux rives au plus proche
            const order = path.slice(2, -2).map((p, i) => [Math.min(i + 2, path.length - 3 - i), p]).sort((x, y) => y[0] - x[0]);
            let done = false;
            for (const [, [x, y]] of order) {
                const k = key(x, y);
                if (c.hard.has(k) || keepLanes.has(k) || c.paths.has(k) && false) continue;
                const hadObst = c.obst.has(k);
                c.obst.add(k);
                if (!isWall(c, x, y)) { if (!hadObst) c.obst.delete(k); continue; }   // décor bas : ne ferme rien
                if (stillConnected(c, base, new Set([...added, ...ledge.map(([lx, ly]) => key(lx, ly)), k]))) { added.add(k); done = true; break; }
                if (!hadObst) c.obst.delete(k);
            }
            if (!done) break;
        }
        const changed = new Set([...added, ...ledge.map(([x, y]) => key(x, y))]);
        const patchBroken = patchLost(c);
        if (!patchBroken && stillConnected(c, base, changed) && clearedReachable(c, lanes.filter(([x, y]) => obstBefore.has(key(x, y)))) && detourOk(c, base, ledge, dir)) {
            added.forEach(k => { c.grass.delete(k); c.paths.delete(k); });
            reserveLanes(c, ledge, dir);
            return ledge;
        }
        c.obst = obstBefore; c.grass = grassBefore; c.paths = pathsBefore; ledge.forEach(([x, y]) => c.ledges.delete(key(x, y)));
    }
    return null;
}

// ── 3. Motifs ────────────────────────────────────────────────────────
function motifPositions(c, rows, seed) {
    const mh = rows.length, mw = rows[0].length;
    const out = [];
    for (let x = RIM; x + mw <= c.w - RIM; x += 1) for (let y = RIM; y + mh <= c.h - RIM; y += 1) out.push([x, y]);
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
// La nappe d'herbe d'origine (≥ PATCH_MIN cases) a-t-elle été coupée ? (mesure de l'original mise en cache dans le contexte)
const patchLost = c => (c.hadPatch ??= largestPatch(c.origGrass) >= PATCH_MIN) && largestPatch(c.grass) < PATCH_MIN;
function largestPatch(cells) {
    const seen = new Set();
    let best = 0;
    for (const k of cells) {
        if (seen.has(k)) continue;
        let size = 0;
        const stack = [k];
        seen.add(k);
        while (stack.length) {
            const [x, y] = unkey(stack.pop());
            size++;
            for (const [dx, dy] of STEPS) { const nk = key(x + dx, y + dy); if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); } }
        }
        best = Math.max(best, size);
    }
    return best;
}

// ── Application ──────────────────────────────────────────────────────
// ── 4. Caches invisibles et coffres mimiques ─────────────────────────
// Par carte de plein air : MIMICS_PER_MAP coffres-pièges (`mimic`, posés près d'un chemin comme de vrais coffres, butin maigre) et, sur
// les routes et zones sauvages, CACHES_PER_MAP caches invisibles (`hidden`, nichées contre le relief, repérables à l'aura).
// Récompenses proportionnelles à la région (rang 1 à 11) ; une cache vaut bien plus qu'une dépouille de mimique.
function placeChests(c, screen, rank, seed, report, { hidden, mimic }) {
    const base = reach(c);
    const wallsAround = (x, y) => STEPS.filter(([dx, dy]) => isWall(c, x + dx, y + dy)).length;
    const nearPath = (x, y) => STEPS.some(([dx, dy]) => c.paths.has(key(x + dx, y + dy)));
    const placed = [];
    const candidates = (mx, my, near = 8) => {
        const out = [];
        for (let x = mx; x < c.w - mx; x++) for (let y = my; y < c.h - my; y++) {
            const k = key(x, y);
            if (!base.has(k) || c.prot.has(k) || c.paths.has(k) || c.grass.has(k) || c.solid.has(k) || c.obst.has(k) || !isOpen(c, x, y)) continue;
            if (Math.abs(x - c.spawn.x) + Math.abs(y - c.spawn.y) < near) continue;
            out.push([x, y]);
        }
        return out;
    };
    const put = (kind, n, x, y) => {
        const id = `${screen.id}_${kind === 'hidden' ? 'cache' : 'mimic'}_${n}`;
        const chest = kind === 'hidden'
            ? { id, x, y, gold: 10 * rank, tier: 1, hidden: true, label: 'Cache oubliée', openText: 'En butant contre une pierre creuse, tu découvres une cache oubliée.' }
            : { id, x, y, gold: 30 * rank, tier: 2, mimic: true, mimicGold: 4 * rank, label: 'Coffre suspect', openText: 'Un coffre posé là, comme si on t\'attendait…' };
        (screen.chests ||= []).push(chest);
        c.solid.add(key(x, y));
        placed.push([x, y]);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) c.prot.add(key(x + dx, y + dy));
        report[kind] = (report[kind] || 0) + 1;
    };
    // passes de plus en plus souples : critère de site, bordure, espacement
    const passes = [
        { mx: MARGIN_X, my: MARGIN_Y, gap: 6, fit: (kind, x, y) => (kind === 'hidden' ? wallsAround(x, y) >= 2 : wallsAround(x, y) <= 1 && nearPath(x, y)) },
        { mx: MARGIN_X, my: MARGIN_Y, gap: 5, fit: (kind, x, y) => (kind === 'hidden' ? wallsAround(x, y) >= 1 : wallsAround(x, y) <= 1) },
        { mx: RIM, my: RIM, gap: 4, fit: () => true },
        { mx: RIM, my: RIM, gap: 2, fit: () => true },
        // petites salles (événements) : dernier recours, plus près de l'arrivée et du bord
        { mx: 2, my: 2, gap: 2, near: 4, fit: () => true }
    ];
    [['mimic', mimic], ['hidden', hidden]].forEach(([kind, wanted]) => {
        let n = 0;
        for (const pass of passes) {
            if (n >= wanted) break;
            for (const [x, y] of shuffled(candidates(pass.mx, pass.my, pass.near), seed, kind === 'hidden' ? 41 : 43)) {
                if (n >= wanted) break;
                if (c.prot.has(key(x, y)) || c.solid.has(key(x, y)) || !pass.fit(kind, x, y)) continue;
                if (placed.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) < pass.gap)) continue;
                c.solid.add(key(x, y));
                const ok = stillConnected(c, base, c.solid);
                c.solid.delete(key(x, y));
                if (!ok) continue;
                put(kind, ++n, x, y);
            }
        }
    });
}

// Poches nées d'un saut : toute case atteignable seulement en traversant une corniche est comblée (décor), pour qu'aucune zone ne soit
// réservée au saut. Renvoie false si une entité s'y trouve (la corniche fautive est alors abandonnée par l'appelant).
function sealPockets(c) {
    if (!c.ledges.size) return true;
    const closed = reach(c, false);
    const seen = new Set([key(c.spawn.x, c.spawn.y)]);
    const queue = [c.spawn];
    while (queue.length) {
        const p = queue.shift();
        for (const [dx, dy] of STEPS) {
            const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
            const wall = !inB(c, nx, ny) || (c.obst.has(k) && !lowAt(c, nx, ny)) || c.liq.has(k);
            if (seen.has(k) || wall || c.solid.has(k)) continue;
            seen.add(k); queue.push({ x: nx, y: ny });
        }
    }
    const pockets = [...seen].filter(k => !closed.has(k) && !c.ledges.has(k));
    if (pockets.some(k => c.hard.has(k) || c.solid.has(k))) return false;
    // un décor bas se traverse : la poche devient alors une mare (une case d'eau qui ne se franchit pas à pied)
    pockets.forEach(k => { const [px, py] = unkey(k); if (isLowCell(c.screen, px, py)) { c.obst.delete(k); c.liq.add(k); } else c.obst.add(k); c.grass.delete(k); c.paths.delete(k); });
    return true;
}

// ── Contour irrégulier des cartes d'événement ────────────────────────
// Les cartes d'événement sont dessinées à la main en rectangles : chaque coin est « rogné » par un arrondi (quart de disque) ou par un
// rectangle collé, en alternance, comme pour les routes agrandies (world/enlarge.js). Les cases rognées deviennent du relief ; une coupe est
// abandonnée si elle toucherait une entité, une sortie ou l'arrivée, ou si elle isolait une case jusque-là atteignable.
function carveContour(c, seed) {
    let bitten = 0;
    const corners = [[0, 0, 1, 1], [c.w - 1, 0, -1, 1], [0, c.h - 1, 1, -1], [c.w - 1, c.h - 1, -1, -1]];
    corners.forEach(([cx, cy, sx, sy], i) => {
        const round = hash(seed, i, 17) < 0.5;
        const size = 4 + Math.floor(hash(seed, i, 19) * Math.max(1, Math.min(7, c.w / 4 - 3, c.h / 4 - 3)));
        const cells = [];
        if (round) {
            for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) if ((size - 1 - dx) ** 2 + (size - 1 - dy) ** 2 > (size - 1) ** 2 + 1) cells.push([cx + sx * dx, cy + sy * dy]);
        } else {
            const w = size, h = Math.max(3, Math.round(size * (0.6 + hash(seed, i, 23) * 0.8)));
            for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) cells.push([cx + sx * dx, cy + sy * dy]);
        }
        const fresh = cells.filter(([x, y]) => inB(c, x, y) && !c.obst.has(key(x, y)));
        if (!fresh.length) { return; }
        const near = ([x, y]) => [[0, 0], ...STEPS].some(([dx, dy]) => c.hard.has(key(x + dx, y + dy)) || c.solid.has(key(x + dx, y + dy)) || (x + dx === c.spawn.x && y + dy === c.spawn.y));
        if (fresh.some(near)) { return; }
        const base = reach(c);
        fresh.forEach(([x, y]) => { c.obst.add(key(x, y)); c.grass.delete(key(x, y)); c.paths.delete(key(x, y)); });
        const now = reach(c);
        const ok = [...base].every(k => now.has(k) || fresh.some(([x, y]) => key(x, y) === k));
        if (!ok) { fresh.forEach(([x, y]) => c.obst.delete(key(x, y))); return; }
        bitten++;
    });
    return bitten;
}

export function designLevel(screen, options = {}) {
    const rank = Math.max(1, options.rank || 1);
    if (!isDesignable(screen)) {
        // villages, hameaux, sanctuaires : pas de relief retouché, mais des coffres-pièges eux aussi
        if (isPopulable(screen)) {
            const c = makeContext(screen);
            const report = { motifs: [], ledges: 0, defiles: 0, hidden: 0, mimic: 0 };
            placeChests(c, screen, rank, seedOf(screen.id), report, { hidden: 0, mimic: MIMICS_PER_MAP });
            screen.design = report;
        }
        return screen;
    }
    // carte d'événement sans hautes herbes : une table vide sert le temps du dessin (passages, défilés) puis disparaît (aucune rencontre)
    const syntheticGrass = !screen.grass;
    if (syntheticGrass) screen.grass = { cells: [], rate: 0, safeSteps: 3, table: [] };
    const c = makeContext(screen);
    const seed = seedOf(screen.id);
    const report = { motifs: [], ledges: 0, defiles: 0, hidden: 0, mimic: 0, corners: 0 };
    if (screen.event) report.corners = carveContour(c, seed);

    // falaises d'abord (haie percée d'un passage d'herbes et d'une corniche, elles exigent de la place), puis corniches isolées, motifs, défilés
    const takenDefiles = [];
    let base = reach(c);
    let tries = 0;
    for (const d of defileCandidates(c, seed)) {
        if (report.ledges >= 1 || tries++ >= 20) break;
        const res = tryDefile(c, reach(c), d, takenDefiles, true, seed);
        if (!res) continue;
        res.cells.forEach(([x, y]) => c.grass.add(key(x, y)));
        takenDefiles.push(d);
        report.defiles++; report.ledges++;
    }
    if (!report.ledges && carveFalaise(c, reach(c), seed)) report.ledges++;
    if (!report.ledges && carveLengthened(c, reach(c), seed)) report.ledges++;
    tries = 0;
    for (const cand of report.ledges < MAX_LEDGES ? ledgeCandidates(c, seed) : []) {
        if (report.ledges >= MAX_LEDGES || tries++ >= (screen.event ? 400 : LEDGE_TRIES)) break;
        if (tryLedge(c, base, cand, seed)) report.ledges++;
    }

    const obstSnap = new Set(c.obst), grassSnap = new Set(c.grass);
    const names = Object.keys(MOTIFS).sort((a, b) => hash(seedOf(a), seed) - hash(seedOf(b), seed));
    for (const name of names) {
        if (report.motifs.length >= MAX_MOTIFS) break;
        let rows = MOTIFS[name];
        if (hash(seed, seedOf(name), 5) < 0.5) rows = mirrorX(rows);
        if (hash(seed, seedOf(name), 6) < 0.3) rows = mirrorY(rows);
        base = reach(c);
        tries = 0;
        for (const [x, y] of motifPositions(c, rows, seed + seedOf(name))) {
            if (tries++ >= MOTIF_TRIES) break;
            if (report.motifs.some(m => Math.abs(m.x - x) < 14 && Math.abs(m.y - y) < 8)) continue;
            if (tryMotif(c, base, rows, x, y)) { report.motifs.push({ name, x, y }); break; }
        }
    }

    tries = 0;
    for (const d of defileCandidates(c, seed)) {
        if (takenDefiles.length >= MAX_DEFILES || tries++ >= TRIES) break;
        const res = tryDefile(c, reach(c), d, takenDefiles);
        if (!res) continue;
        res.cells.forEach(([x, y]) => c.grass.add(key(x, y)));
        takenDefiles.push(d);
        report.defiles++;
    }

    // Une grande nappe d'herbe (≥ PATCH_MIN cases) existante doit survivre : sinon on retire les motifs et défilés (les corniches restent).
    const patchOk = largestPatch(toSet(screen.grass.cells)) < PATCH_MIN || largestPatch(c.grass) >= PATCH_MIN;
    if (!patchOk) { c.obst = obstSnap; c.grass = grassSnap; report.motifs = []; report.defiles = 0; }
    placeChests(c, screen, rank, seed, report, { hidden: CACHES_PER_MAP, mimic: MIMICS_PER_MAP });
    if (!sealPockets(c)) { c.ledges.clear(); report.ledges = 0; }
    screen.obstacles = toRects(c.obst);
    screen.liquids = toRects(c.liq);
    screen.paths = toRects(c.paths);
    screen.grass = { ...screen.grass, cells: toRects(c.grass) };
    if (syntheticGrass) delete screen.grass;
    if (c.ledges.size) screen.ledges = [...c.ledges].map(([k, dir]) => [...unkey(k), dir[0], dir[1]]);
    screen.design = report;
    return screen;
}

export const applyLevelDesign = screens => { Object.values(screens).forEach(designLevel); return screens; };

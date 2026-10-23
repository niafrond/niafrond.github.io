// Outils de construction des zones du « Grand Monde » (voir world/FORMAT.md). Logique pure, sans DOM.
//
//  - parseGrid(rows)            : carte ASCII → dimensions, obstacles, liquides, chemins, hautes herbes, bâtiments, ancres ;
//  - buildZone(spec, helpers)   : carte + entités (PNJ, coffres, ennemis, sorties) → écran compatible avec SCREENS ;
//  - applyNativeSanctuary(...)  : grille ASCII d'un sanctuaire + `places` (repositionne les entités de story.js) ;
//  - arrivalFor(exit, target)   : tuile d'arrivée symétrique d'une sortie ;
//  - freeNeighbor(screen, x, y) : première tuile libre autour d'une tuile (point d'apparition devant une pierre de voyage).
//
// Format v2 (world/DESIGN-V2.md, world/FORMAT.md §9) : `native: true` (carte jamais étirée), `"` = hautes herbes
// (`screen.grass`), entités posées par `x`/`y` en plus de `at`, patrouilles en `[x, y]`.

const BUILDING_LETTERS = 'ABCDEFGH';
const ANCHOR_CHARS = '0123456789<>^viIjklmnopqrstuwxyz'.replace('I', '');   // chiffres, bords (< > ^ v) et lettres i-z (sauf v déjà pris) : 10 + 4 + 16 ancres
const KNOWN = new Set(['.', '#', '~', '=', '"', 'S', 'W', ...BUILDING_LETTERS, ...BUILDING_LETTERS.toLowerCase(), ...ANCHOR_CHARS]);

// Cartes natives (jamais étirées par world/expand.js) : calque de sol mis en cache ≤ 16 Mpx.
export const NATIVE_LIMITS = { maxSide: 64, maxCells: 1500 };
// Hautes herbes : valeurs par défaut de `spec.grass` (DESIGN-V2 §5).
export const GRASS_DEFAULTS = { rate: 0.12, safeSteps: 3 };

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
    const grass = [];
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
            else if (ch === '"') grass.push([x, y]);
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
        paths: cellsToRects(paths),
        grass: cellsToRects(grass)
    };
}

// Une carte native ne dépasse jamais 64 cases de côté ni 1500 cases au total.
export function assertNativeSize(g, label) {
    if (g.w > NATIVE_LIMITS.maxSide || g.h > NATIVE_LIMITS.maxSide || g.w * g.h > NATIVE_LIMITS.maxCells) {
        throw new Error(`${label} : carte native trop grande (${g.w}×${g.h} = ${g.w * g.h} cases ; au plus ${NATIVE_LIMITS.maxSide}×${NATIVE_LIMITS.maxSide} et ${NATIVE_LIMITS.maxCells} cases)`);
    }
}

// Validation de `spec.grass` : { rate?, safeSteps?, table: [{ templateId, name?, weight, offset? }, …] }.
export function validateGrass(config, label) {
    if (!config || typeof config !== 'object') throw new Error(`${label} : « grass » doit être un objet`);
    if (!Array.isArray(config.table) || config.table.length === 0) throw new Error(`${label} : table de hautes herbes vide`);
    config.table.forEach((entry, i) => {
        if (!entry || typeof entry.templateId !== 'string' || !entry.templateId) throw new Error(`${label} : hautes herbes, entrée ${i} sans templateId`);
        if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight) || entry.weight <= 0) {
            throw new Error(`${label} : hautes herbes, poids invalide pour ${entry.templateId} (${entry.weight}) : un poids doit être > 0`);
        }
        if (entry.offset !== undefined && !Number.isInteger(entry.offset)) throw new Error(`${label} : hautes herbes, offset non entier pour ${entry.templateId}`);
    });
    if (config.rate !== undefined && !(typeof config.rate === 'number' && config.rate > 0 && config.rate <= 1)) {
        throw new Error(`${label} : hautes herbes, « rate » doit être dans ]0, 1]`);
    }
    if (config.safeSteps !== undefined && !(Number.isInteger(config.safeSteps) && config.safeSteps >= 0)) {
        throw new Error(`${label} : hautes herbes, « safeSteps » doit être un entier ≥ 0`);
    }
}

/**
 * Hautes herbes d'une carte : `{ cells: [[x, y, w, h], …], rate, safeSteps, table }`, ou null si la grille n'a aucune case « " ».
 * `forbidden` : village, hameau, intérieur, arène (erreur si la grille contient des « " »).
 */
export function buildGrass(g, config, label, forbidden = false) {
    if (config !== undefined && config !== null) validateGrass(config, label);
    if (!g.grass.length && !config?.water) return null;
    if (forbidden) throw new Error(`${label} : hautes herbes (« " ») interdites dans un village, un hameau, un intérieur ou une arène`);
    if (!config) throw new Error(`${label} : cases de hautes herbes (« " ») sans table : ajouter « grass: { table: [...] } »`);
    return {
        cells: g.grass.map(r => [...r]),
        rate: config.rate ?? GRASS_DEFAULTS.rate,
        safeSteps: config.safeSteps ?? GRASS_DEFAULTS.safeSteps,
        table: config.table.map(e => ({ ...e })),
        ...(config.water ? { water: true } : {})
    };
}

const inGrid = (g, p) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < g.w && p.y < g.h;

// Point d'une carte : ancre (« 5 »), couple [x, y] ou objet { x, y } → { x, y } (dans la grille, sinon erreur).
function pointOf(value, g, label) {
    if (typeof value === 'string') {
        const a = g.anchors[value];
        if (!a) throw new Error(`${label} : ancre « ${value} » introuvable dans la grille`);
        return { x: a.x, y: a.y };
    }
    const p = Array.isArray(value) && value.length === 2 ? { x: value[0], y: value[1] } : (value && typeof value === 'object' ? { x: value.x, y: value.y } : null);
    if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) throw new Error(`${label} : position invalide (${JSON.stringify(value)}) : attendu une ancre, [x, y] ou { x, y }`);
    if (!inGrid(g, p)) throw new Error(`${label} : position (${p.x}, ${p.y}) hors de la grille (${g.w}×${g.h})`);
    return p;
}

// Position d'une entité de spec : ancre (`at`) ou coordonnées explicites (`x`, `y`), jamais les deux.
function positionOf(entry, g, label) {
    const explicit = entry.x !== undefined || entry.y !== undefined;
    if (explicit && entry.at !== undefined) throw new Error(`${label} : « at » et « x/y » sont exclusifs`);
    if (explicit) {
        if (!Number.isInteger(entry.x) || !Number.isInteger(entry.y)) throw new Error(`${label} : x et y doivent être des entiers (reçu x=${entry.x}, y=${entry.y})`);
        return pointOf([entry.x, entry.y], g, label);
    }
    if (entry.at === undefined) throw new Error(`${label} : ni « at » ni « x/y »`);
    return pointOf(String(entry.at), g, label);
}

// Portes des bâtiments : l'entrée de la maison (`to` = identifiant d'intérieur de houses[lettre]).
function addDoorExits(screen, houses) {
    screen.buildings.forEach(b => {
        const house = houses?.[b.id];
        if (!house) return;
        b.name = house.name || house.to;
        screen.exits.push({ x: b.door.x, y: b.door.y, to: house.to, door: true, label: b.name });
    });
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
 * spec : { id, region, biome, grid, npcs, chests, enemies, exits, kind, native?, grass? }
 *  - entités (npcs, chests, enemies, exits) : `at: 'ancre'` ou `x`, `y` explicites ; patrouille : ancres ou `[x, y]` ;
 *  - native : carte jamais étirée par world/expand.js (`screen.native`), au plus 64×64 et 1500 cases ;
 *  - grass : { rate?, safeSteps?, table } pour les cases « " » de la grille (`screen.grass`).
 * helpers : { npcDef(id), chestDef(id), screenText(id) }
 */
export function buildZone(spec, helpers) {
    const g = parseGrid(spec.grid, spec.id);
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
    if (spec.native) {
        assertNativeSize(g, spec.id);
        screen.native = true;
    }
    const grass = buildGrass(g, spec.grass, spec.id, spec.kind === 'village' || spec.kind === 'house' || Boolean(spec.interior || spec.arena));
    if (grass) screen.grass = grass;
    if (text.arrival?.length && !spec.interior) screen.arrival = text.arrival;   // pas de texte du Narrateur dans les maisons
    if (g.waypoint) screen.waypoint = { ...g.waypoint, name: text.waypointName || `Pierre de voyage — ${screen.name}` };

    (spec.npcs || []).forEach(n => {
        const { at, x: _x, y: _y, ...rest } = n;
        const p = positionOf(n, g, `${spec.id} : PNJ ${n.id}`);
        screen.npcs.push({ ...helpers.npcDef(n.id), ...rest, x: p.x, y: p.y });
    });
    (spec.chests || []).forEach(c => {
        const { at, x: _x, y: _y, ...rest } = c;
        const p = positionOf(c, g, `${spec.id} : coffre ${c.id}`);
        screen.chests.push({ ...helpers.chestDef(c.id), ...rest, x: p.x, y: p.y });
    });
    (spec.enemies || []).forEach(e => {
        const { at, x: _x, y: _y, patrol, ...rest } = e;
        const label = `${spec.id} : ennemi ${e.id}`;
        const p = positionOf(e, g, label);
        const def = { kind: 'sentinel', ...rest, x: p.x, y: p.y };
        if (patrol) def.patrol = patrol.map(pt => { const a = pointOf(pt, g, `${label} (patrouille)`); return [a.x, a.y]; });
        screen.enemies.push(def);
    });
    (spec.exits || []).forEach(e => {
        const { at, x: _x, y: _y, ...rest } = e;
        const p = positionOf(e, g, `${spec.id} : sortie vers ${e.to}`);
        screen.exits.push({ ...rest, x: p.x, y: p.y });
    });
    addDoorExits(screen, spec.houses);
    return screen;
}

// Trajet d'un patrouilleur, case par case (même tracé que exploration.js `buildRoute`).
function routeOf(points) {
    const route = [];
    points.forEach(([tx, ty], i) => {
        if (i === 0) { route.push({ x: tx, y: ty }); return; }
        let { x, y } = route[route.length - 1];
        while (x !== tx) { x += Math.sign(tx - x); route.push({ x, y }); }
        while (y !== ty) { y += Math.sign(ty - y); route.push({ x, y }); }
    });
    return route;
}

/**
 * Sanctuaire en grille ASCII (`sanctuary: { grid, native?, places, grass?, houses? }`). La géométrie (obstacles, liquides, chemins,
 * bâtiments, hautes herbes) vient de la grille ; les entités de l'écran `screen` (PNJ, coffres, ennemis, apparition, pierre de voyage,
 * sorties) sont CONSERVÉES avec tous leurs champs mais repositionnées par `spec.places` :
 *   { <idEntité>: 'ancre' | [x, y] | { at | x, y, patrol?: [ancre | [x, y], …] },
 *     spawn, waypoint, 'exit:<to>': … }
 * Un ennemi qui patrouille se place par `{ at, patrol: [...] }`. Sans place explicite : `spawn` = `S` de la grille (sinon un pas à
 * l'intérieur de `<`), `waypoint` = `W` de la grille, sortie vers `<id>_wild` = ancre `<`, autre sortie = ancre `>`.
 * options.skip : ids de PNJ déjà relogés ailleurs (ignorés). Toute entité sans place, ou place inconnue : erreur explicite.
 */
export function applyNativeSanctuary(screen, spec, options = {}) {
    const label = `sanctuaire ${screen.id}`;
    const g = parseGrid(spec.grid, label);
    if (spec.native) assertNativeSize(g, label);
    const places = spec.places || {};
    const skip = options.skip || new Set();

    const blocked = (x, y) => [g.obstacles, g.liquids].some(rects => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh));
    const used = new Map();   // case → libellé de l'entité qui l'occupe
    const claim = (p, what) => {
        if (blocked(p.x, p.y)) throw new Error(`${label} : ${what} posé sur un obstacle ou un liquide en (${p.x}, ${p.y})`);
        const k = `${p.x},${p.y}`;
        if (used.has(k)) throw new Error(`${label} : ${what} et ${used.get(k)} sur la même case (${p.x}, ${p.y})`);
        used.set(k, what);
    };

    // Géométrie
    screen.w = g.w; screen.h = g.h;
    screen.obstacles = g.obstacles; screen.liquids = g.liquids; screen.paths = g.paths;
    screen.buildings = g.buildings.map(b => ({ ...b }));
    screen.exits = screen.exits.filter(e => !e.door);
    addDoorExits(screen, spec.houses);
    if (spec.native) screen.native = true; else delete screen.native;
    const grass = buildGrass(g, spec.grass, label);
    if (grass) screen.grass = grass; else delete screen.grass;

    // Clés de `places` : toutes doivent désigner une entité (faute de frappe = erreur)
    const consumed = new Set();
    const lookup = key => { if (places[key] === undefined) return undefined; consumed.add(key); return places[key]; };
    const resolve = (value, what, withPatrol = false) => {
        const obj = value && typeof value === 'object' && !Array.isArray(value) && (value.at !== undefined || value.patrol !== undefined || value.x !== undefined) ? value : null;
        const p = obj ? positionOf(obj, g, `${label} : ${what}`) : pointOf(value, g, `${label} : ${what}`);
        const patrol = obj?.patrol ? obj.patrol.map(pt => { const a = pointOf(pt, g, `${label} : ${what} (patrouille)`); return [a.x, a.y]; }) : null;
        if (patrol && !withPatrol) throw new Error(`${label} : ${what} : « patrol » n'a de sens que pour un ennemi`);
        return { p, patrol };
    };

    const missing = [];
    screen.npcs = screen.npcs.filter(n => !skip.has(n.id));
    [['npcs', 'PNJ'], ['chests', 'coffre'], ['enemies', 'ennemi']].forEach(([list, kind]) => {
        screen[list].forEach(e => {
            const what = `${kind} ${e.id}`;
            const value = lookup(e.id);
            if (value === undefined) { missing.push(e.id); return; }
            const { p, patrol } = resolve(value, what, list === 'enemies');
            e.x = p.x; e.y = p.y;
            if (list === 'enemies') {
                if (e.patrol && !patrol) throw new Error(`${label} : ${what} patrouille : donner « { at, patrol: [...] } » dans places`);
                if (patrol) {
                    e.patrol = patrol;
                    routeOf(patrol).forEach(c => { if (blocked(c.x, c.y)) throw new Error(`${label} : trajet de ${what} bloqué en (${c.x}, ${c.y})`); });
                } else delete e.patrol;
            }
            claim(p, what);
        });
    });
    if (missing.length) throw new Error(`${label} : entités sans place (ajouter à « places ») : ${missing.join(', ')}`);

    // Pierre de voyage : `places.waypoint`, sinon `W` de la grille ; une pierre déclarée sans position est une erreur.
    const wpValue = lookup('waypoint');
    if (wpValue !== undefined || g.waypoint || screen.waypoint) {
        const p = wpValue !== undefined ? resolve(wpValue, 'pierre de voyage').p : g.waypoint;
        if (!p) throw new Error(`${label} : pierre de voyage sans place (« W » dans la grille ou places.waypoint)`);
        screen.waypoint = { ...(screen.waypoint || {}), x: p.x, y: p.y };
        claim(p, 'pierre de voyage');
    }

    // Sorties : place explicite `exit:<to>` (ou `exit:<région>` pour `<région>_road` / `<région>_village`), sinon `<` / `>`.
    screen.exits.filter(e => !e.door).forEach(e => {
        const alias = e.to.replace(/_(road|village)$/, '');
        const key = [`exit:${e.to}`, `exit:${alias}`].find(k => places[k] !== undefined);
        let p;
        if (key) p = resolve(lookup(key), `sortie vers ${e.to}`).p;
        else {
            const ch = e.to === `${screen.id}_wild` ? '<' : '>';
            p = g.anchors[ch];
            if (!p) throw new Error(`${label} : sortie vers ${e.to} sans place (ancre « ${ch} » absente et pas de places['exit:${e.to}'])`);
        }
        e.x = p.x; e.y = p.y;
        claim(p, `sortie vers ${e.to}`);
    });

    // Apparition : places.spawn, sinon `S`, sinon un pas à l'intérieur de `<`.
    const spawnValue = lookup('spawn');
    const entry = g.anchors['<'];
    const spawn = spawnValue !== undefined ? resolve(spawnValue, 'apparition').p
        : g.spawn || (entry && { x: entry.x === 0 ? 1 : entry.x, y: entry.y });
    if (!spawn) throw new Error(`${label} : apparition sans place (« S » ou « < » dans la grille, ou places.spawn)`);
    claim(spawn, 'apparition');
    screen.spawn = { x: spawn.x, y: spawn.y };

    const unknown = Object.keys(places).filter(k => !consumed.has(k));
    if (unknown.length) throw new Error(`${label} : places inconnues (aucune entité ni sortie de ce nom) : ${unknown.join(', ')}`);
    return screen;
}

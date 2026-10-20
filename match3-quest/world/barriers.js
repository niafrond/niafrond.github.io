// Barrières de bordure : sur chaque côté d'une carte de plein air qui n'est PAS prévu pour être traversé (aucune connexion, ou hors
// de la portion de bordure ouverte d'une connexion), la rangée de bord est fermée par un élément du biome, pour que le joueur voie
// qu'on ne passe pas : eau (côte, lit de fleuve, rizières), sinon obstacle décoré par le biome (cactus, pics, arbres, cristaux, stalagmites…
// voir `BIOMES.decor` de explorationView.js). Logique pure, appliquée par `assembleWorld` après `applyConnections`.
// Une case n'est fermée que si cela ne rend inaccessible aucune case, entité ou sortie jusque-là atteignable à pied.

import { toSet, toRects, buildingCells, entityCells, routeCells } from './expand.js';
import { overlapOf } from '../mapConnections.js';

// Poche coupée du reste par une fermeture : comblée si elle est vide et petite (par fermeture / au total sur la carte : niches de bord).
const POCKET_MAX = 12;
const FILL_MAX = 40;

export const WATER_BIOMES = new Set(['coast', 'riverbed', 'paddy']);   // barrière d'eau ; ailleurs : obstacle du biome

const key = (x, y) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Cases de la bordure restées ouvertes par les connexions de la carte.
export function openRim(screens, screen, depth = 1) {
    const open = new Set();
    for (const [dir, c] of Object.entries(screen.connections || {})) {
        const to = screens[c.to];
        const range = to && overlapOf(c, screen, to);
        if (!range) continue;
        for (let a = range[0]; a <= range[1]; a++) for (let d = 0; d < depth; d++) {
            open.add(dir === 'north' ? key(a, d) : dir === 'south' ? key(a, screen.h - 1 - d) : dir === 'west' ? key(d, a) : key(screen.w - 1 - d, a));
        }
    }
    return open;
}

// Devant chaque passage : couloir de LANE_DEPTH cases de profondeur, libre d'obstacles, d'eau et de personnages (on arrive là sans gêne).
const LANE_DEPTH = 3;

// Déplace vers l'intérieur les personnages et coffres (hors gardiens, boss, patrouilleurs) posés sur la bordure fermée ou dans un couloir de passage.
function relocateEntities(screen, lane, open, obst, liq) {
    const { w, h } = screen;
    // un gardien de passage est flanqué de piliers : il reste en place
    const nearPillar = e => (screen.pillars || []).some(([px, py]) => Math.abs(px - e.x) <= 2 && Math.abs(py - e.y) <= 2);
    const rimCell = (x, y) => x === 0 || y === 0 || x === w - 1 || y === h - 1;
    const bad = (x, y) => (rimCell(x, y) && !open.has(key(x, y))) || lane.has(key(x, y));
    const list = [...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || [])]
        .filter(e => !e.guardsDoor && !e.boss && !e.patrol && bad(e.x, e.y) && !nearPillar(e));
    if (!list.length) return;
    const taken = new Set([...entityCells(screen), ...buildingCells(screen), ...(screen.exits || []).map(e => key(e.x, e.y))]);
    const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !obst.has(key(x, y)) && !liq.has(key(x, y)) && !taken.has(key(x, y));
    // cases atteignables à pied depuis l'apparition (terrain seul)
    const seen = new Set([key(screen.spawn.x, screen.spawn.y)]);
    const queue = [screen.spawn];
    while (queue.length) {
        const p = queue.shift();
        for (const [dx, dy] of STEPS) {
            const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(k) || obst.has(k) || liq.has(k)) continue;
            seen.add(k); queue.push({ x: nx, y: ny });
        }
    }
    for (const e of list) {
        let best = null, bestD = Infinity;
        for (let x = 1; x < w - 1; x++) for (let y = 1; y < h - 1; y++) {
            if (bad(x, y) || !seen.has(key(x, y)) || !free(x, y)) continue;
            const d = (x - e.x) ** 2 + (y - e.y) ** 2;
            if (d < bestD) { bestD = d; best = { x, y }; }
        }
        if (!best) continue;
        taken.delete(key(e.x, e.y)); taken.add(key(best.x, best.y));
        e.x = best.x; e.y = best.y;
    }
}

// Carte de mer : les eaux se parcourent (Pas de Yu), donc fermer la bordure ne coupe rien : les îlots de bord hors passage deviennent de l'eau.
function closeAquaticRim(screen, open) {
    const { w, h } = screen;
    const liq = toSet(screen.liquids);
    const obst = toSet(screen.obstacles);
    const keep = new Set([...entityCells(screen), ...buildingCells(screen), ...(screen.exits || []).map(e => key(e.x, e.y))]);
    let changed = false;
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
        const k = key(x, y);
        if ((x && y && x < w - 1 && y < h - 1) || open.has(k) || keep.has(k) || liq.has(k) || obst.has(k)) continue;
        liq.add(k); changed = true;
    }
    if (changed) screen.liquids = toRects(liq);
}

export function addBorderBarriers(screens) {
    for (const screen of Object.values(screens)) {
        if (screen.interior || screen.arena || screen.kind === 'house') continue;
        const { w, h } = screen;
        const open = openRim(screens, screen);
        if (screen.aquatic) { closeAquaticRim(screen, open); continue; }
        const water = WATER_BIOMES.has(screen.biome);
        const obst = toSet(screen.obstacles);
        const liq = toSet(screen.liquids);
        // couloirs devant les passages : on retire décor et eau (hors bâtiments), puis on dégage les personnages
        const lane = openRim(screens, screen, LANE_DEPTH);
        const built = buildingCells(screen);
        let cleared = false;
        const pillars = new Set([...(screen.pillars || []), ...(screen.sealed || [])].map(([px, py]) => key(px, py)));   // piliers d'un gardien de passage et rochers qui ferment sa rangée : intentionnels
        lane.forEach(k => { if (!built.has(k) && !pillars.has(k) && (obst.delete(k) || liq.delete(k))) cleared = true; });
        relocateEntities(screen, lane, open, obst, liq);
        if (cleared) { screen.obstacles = toRects(obst); screen.liquids = toRects(liq); }
        const keep = new Set([...buildingCells(screen), ...entityCells(screen), key(screen.spawn.x, screen.spawn.y)]);
        (screen.exits || []).forEach(e => keep.add(key(e.x, e.y)));
        (screen.enemies || []).filter(e => e.patrol).forEach(e => routeCells(e.patrol).forEach(c => keep.add(key(c.x, c.y))));
        const solid = new Set([...entityCells(screen), ...(screen.exits || []).map(e => key(e.x, e.y))]);
        solid.delete(key(screen.spawn.x, screen.spawn.y));
        const blocked = k => obst.has(k) || liq.has(k) || solid.has(k);
        const flood = () => {
            const seen = new Set([key(screen.spawn.x, screen.spawn.y)]);
            const queue = [screen.spawn];
            while (queue.length) {
                const p = queue.shift();
                for (const [dx, dy] of STEPS) {
                    const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(k) || blocked(k)) continue;
                    seen.add(k);
                    queue.push({ x: nx, y: ny });
                }
            }
            return seen;
        };
        const before = flood();
        const touches = (set, k) => { const [x, y] = k.split(',').map(Number); return STEPS.some(([dx, dy]) => set.has(key(x + dx, y + dy))); };
        const reachableSolids = [...solid].filter(k => touches(before, k));
        const closed = [];
        // cases de bordure à fermer (celles qui deviendraient des culs-de-sac isolés ne comptent pas comme perte)
        const rim = new Set();
        for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
            const k = key(x, y);
            if (!(x && y && x < w - 1 && y < h - 1) && !open.has(k) && !keep.has(k) && !obst.has(k) && !liq.has(k)) rim.add(k);
        }
        const set = water ? liq : obst;
        const filled = new Set();   // cases (bordure ou petites poches coupées du reste) transformées en barrière
        let pockets = 0;            // cases de poche comblées (plafonnées par FILL_MAX)
        for (const k of rim) {
            set.add(k);
            const after = flood();
            // cases atteignables à pied que cette fermeture coupe du reste de la carte : une petite poche vide est comblée
            // (même barrière), au-delà de POCKET_MAX cases ou si elle porte une entité, un bâtiment, une sortie, un trajet : refus
            const lost = [...before].filter(c => !rim.has(c) && !filled.has(c) && !after.has(c));
            let ok = lost.length <= POCKET_MAX && lost.every(c => !keep.has(c)) && pockets + lost.length <= FILL_MAX;
            if (ok) ok = reachableSolids.every(sk => touches(after, sk));
            if (ok) { filled.add(k); closed.push(k); lost.forEach(c => { set.add(c); filled.add(c); closed.push(c); }); pockets += lost.length; } else set.delete(k);
        }
        if (closed.length) { screen.obstacles = toRects(obst); screen.liquids = toRects(liq); }
    }
    return screens;
}

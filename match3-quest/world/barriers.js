// Barrières de bordure : sur chaque côté d'une carte de plein air qui n'est PAS prévu pour être traversé (aucune connexion, ou hors
// de la portion de bordure ouverte d'une connexion), la rangée de bord est fermée par un élément du biome, pour que le joueur voie
// qu'on ne passe pas : eau (côte, lit de fleuve, rizières), sinon obstacle décoré par le biome (cactus, pics, arbres, cristaux, stalagmites…
// voir `BIOMES.decor` de explorationView.js). Logique pure, appliquée par `assembleWorld` après `applyConnections`.
// Une case n'est fermée que si cela ne rend inaccessible aucune case, entité ou sortie jusque-là atteignable à pied.

import { toSet, toRects, buildingCells, entityCells, routeCells } from './expand.js';
import { overlapOf } from '../mapConnections.js';

export const WATER_BIOMES = new Set(['coast', 'riverbed', 'paddy']);   // barrière d'eau ; ailleurs : obstacle du biome

const key = (x, y) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Cases de la bordure restées ouvertes par les connexions de la carte.
export function openRim(screens, screen) {
    const open = new Set();
    for (const [dir, c] of Object.entries(screen.connections || {})) {
        const to = screens[c.to];
        const range = to && overlapOf(c, screen, to);
        if (!range) continue;
        for (let a = range[0]; a <= range[1]; a++) {
            open.add(dir === 'north' ? key(a, 0) : dir === 'south' ? key(a, screen.h - 1) : dir === 'west' ? key(0, a) : key(screen.w - 1, a));
        }
    }
    return open;
}

export function addBorderBarriers(screens) {
    for (const screen of Object.values(screens)) {
        if (screen.interior || screen.arena || screen.aquatic || screen.kind === 'house') continue;
        const { w, h } = screen;
        const open = openRim(screens, screen);
        const water = WATER_BIOMES.has(screen.biome);
        const obst = toSet(screen.obstacles);
        const liq = toSet(screen.liquids);
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
        for (const k of rim) {
            const set = water ? liq : obst;
            set.add(k);
            const after = flood();
            let ok = [...before].every(c => rim.has(c) || after.has(c));
            if (ok) ok = reachableSolids.every(sk => touches(after, sk));
            if (ok) closed.push(k); else set.delete(k);
        }
        if (closed.length) { screen.obstacles = toRects(obst); screen.liquids = toRects(liq); }
    }
    return screens;
}

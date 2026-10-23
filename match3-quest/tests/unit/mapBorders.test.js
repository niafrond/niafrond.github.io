// Audit de chaque carte de plein air et de chaque bordure : fermeture hors passages, connexions symétriques, arrivées dégagées,
// passages atteignables à pied (voir agents/terrain.md, world/barriers.js).
import './fixtures/playerForge.js';   // installe le stub XHR avant le chargement de story.js
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { isTerrainBlocked as terrainBlocked } from '../../exploration.js';
// Hautes-Eaux (world/PLAN-MAREES.md) : toute l'eau se franchit avec le Pas de Yu, comme dans un écran aquatique.
const isTerrainBlocked = (s, x, y, swim) => terrainBlocked(s, x, y, swim ?? (s.aquatic || s.region === 'marees'));
import { overlapOf, offsetOf, DIRS } from '../../mapConnections.js';
import { openRim } from '../../world/barriers.js';
import { routeCells } from '../../world/expand.js';

const outdoors = Object.values(SCREENS).filter(s => !s.interior && !s.arena && s.kind !== 'house' && s.connections);
const key = (x, y) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const rimOf = s => { const r = []; for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) if (!(x && y && x < s.w - 1 && y < s.h - 1)) r.push([x, y]); return r; };
const patrolCells = s => new Set(s.enemies.filter(e => e.patrol).flatMap(e => routeCells(e.patrol).map(c => key(c.x, c.y))));
const inRects = (rects, x, y) => (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
// case fermée : obstacle ou eau (même sur une carte de mer, où l'eau se traverse à l'intérieur mais pas en sortant de la carte)
const shut = (s, x, y) => inRects(s.obstacles, x, y) || inRects(s.liquids, x, y);
const solids = s => new Set([...s.npcs, ...s.chests, ...s.exits, ...(s.waypoint ? [s.waypoint] : [])].map(e => key(e.x, e.y)));

function reach(s, from) {
    const solid = solids(s);
    const seen = new Set([key(from.x, from.y)]);
    const q = [from];
    while (q.length) {
        const p = q.shift();
        for (const [dx, dy] of STEPS) {
            const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
            if (seen.has(k) || isTerrainBlocked(s, nx, ny) || solid.has(k)) continue;
            seen.add(k); q.push({ x: nx, y: ny });
        }
    }
    return seen;
}
const cellOnSide = (s, dir, a, d = 0) => (dir === 'north' ? { x: a, y: d } : dir === 'south' ? { x: a, y: s.h - 1 - d } : dir === 'west' ? { x: d, y: a } : { x: s.w - 1 - d, y: a });

describe('bordures de toutes les cartes de plein air', () => {
    test.each(outdoors.map(s => [s.id, s]))('%s : bordure fermée hors passages, rien sur la bordure fermée', (_id, s) => {
        const open = openRim(SCREENS, s);
        const patrol = patrolCells(s);
        const entities = [...s.npcs, ...s.chests, ...s.enemies.filter(e => !e.patrol)];
        const bad = rimOf(s).filter(([x, y]) => {
            const k = key(x, y);
            if (open.has(k) || patrol.has(k) || s.exits.some(e => e.x === x && e.y === y)) return false;   // porte d'entrée d'un souterrain : voulue
            return !shut(s, x, y) || entities.some(e => e.x === x && e.y === y);
        }).map(([x, y]) => `${x},${y}`);
        expect({ id: s.id, ouvertes: bad }).toEqual({ id: s.id, ouvertes: [] });
    });

    test.each(outdoors.map(s => [s.id, s]))('%s : chaque passage a son inverse, des cases alignées et atteignables, une arrivée dégagée', (_id, s) => {
        for (const [dir, c] of Object.entries(s.connections)) {
            const to = SCREENS[c.to];
            const back = to.connections[DIRS[dir].opposite];
            expect({ at: `${s.id}.${dir}`, back: back && back.to }).toEqual({ at: `${s.id}.${dir}`, back: s.id });
            expect(offsetOf(back, to, s) + offsetOf(c, s, to) === 0).toBe(true);   // décalages opposés
            const [min, max] = overlapOf(c, s, to);
            const [bmin, bmax] = overlapOf(back, to, s);
            expect(max - min).toBe(bmax - bmin);
            expect(max - min + 1).toBe(3);   // passages de 3 cases
            const mine = reach(s, s.spawn);
            const theirs = reach(to, to.spawn);
            for (let a = min; a <= max; a++) {
                const o = cellOnSide(s, dir, a);
                expect({ at: `${s.id}:${o.x},${o.y}`, libre: !isTerrainBlocked(s, o.x, o.y) }).toEqual({ at: `${s.id}:${o.x},${o.y}`, libre: true });
                expect({ at: `${s.id}:${o.x},${o.y}`, atteignable: mine.has(key(o.x, o.y)) }).toEqual({ at: `${s.id}:${o.x},${o.y}`, atteignable: true });
                // arrivée : un pas à l'intérieur de la voisine, rangée alignée, libre, atteignable ; couloir de 3 cases sans décor ni eau
                const along = a - offsetOf(c, s, to);
                const arr = cellOnSide(to, DIRS[dir].opposite, along, 1);
                expect({ at: `${to.id}:${arr.x},${arr.y}`, libre: !isTerrainBlocked(to, arr.x, arr.y), atteignable: theirs.has(key(arr.x, arr.y)) })
                    .toEqual({ at: `${to.id}:${arr.x},${arr.y}`, libre: true, atteignable: true });
                const taken = new Set([...to.npcs, ...to.chests, ...to.enemies, ...to.exits].map(e => key(e.x, e.y)));
                expect({ at: `${to.id}:${arr.x},${arr.y}`, occupee: taken.has(key(arr.x, arr.y)) }).toEqual({ at: `${to.id}:${arr.x},${arr.y}`, occupee: false });
            }
        }
    });

    test.each(outdoors.map(s => [s.id, s]))('%s : le couloir de 3 cases devant chaque passage est dégagé (décor, eau, personnages)', (_id, s) => {
        const pillars = new Set((s.pillars || []).map(([x, y]) => key(x, y)));
        const lane = openRim(SCREENS, s, 3);
        const built = new Set((s.buildings || []).flatMap(b => { const r = []; for (let x = b.x; x < b.x + b.w; x++) for (let y = b.y; y < b.y + b.h; y++) r.push(key(x, y)); return r; }));
        const nearPillar = e => [...pillars].some(p => { const [px, py] = p.split(',').map(Number); return Math.abs(px - e.x) <= 2 && Math.abs(py - e.y) <= 2; });
        const blocked = [...lane].filter(k => { const [x, y] = k.split(',').map(Number); return isTerrainBlocked(s, x, y) && !pillars.has(k) && !built.has(k); });
        expect({ id: s.id, murs: blocked }).toEqual({ id: s.id, murs: [] });
        const inLane = [...s.npcs, ...s.chests, ...s.enemies].filter(e => lane.has(key(e.x, e.y)) && !e.guardsDoor && !e.boss && !e.patrol && !nearPillar(e));
        expect({ id: s.id, gens: inLane.map(e => e.id) }).toEqual({ id: s.id, gens: [] });
    });
});

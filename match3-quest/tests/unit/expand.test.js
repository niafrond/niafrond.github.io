// Grandes cartes reliées par leurs bords (world/expand.js) : toute carte extérieure est grande, et on passe de l'une à
// l'autre en sortant par un bord, comme aux jonctions des routes Pokémon.
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { isTerrainBlocked, aggroOf } from '../../exploration.js';
import { scaleScreen, widenGates, linkGates, EXPANDED_SIZES } from '../../world/expand.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const outdoors = Object.values(SCREENS).filter(s => !s.interior && !s.arena && s.kind !== 'house');
const reach = (screen, from) => {
    const seen = new Set([`${from.x},${from.y}`]);
    const queue = [from];
    while (queue.length) {
        const { x, y } = queue.shift();
        DIRS.forEach(([dx, dy]) => {
            const k = `${x + dx},${y + dy}`;
            if (seen.has(k) || isTerrainBlocked(screen, x + dx, y + dy)) return;
            seen.add(k);
            queue.push({ x: x + dx, y: y + dy });
        });
    }
    return seen;
};
const edgeOf = (s, p) => (p.x === 0 ? 'west' : p.x === s.w - 1 ? 'east' : p.y === 0 ? 'north' : p.y === s.h - 1 ? 'south' : null);
const OPPOSITE = { west: 'east', east: 'west', north: 'south', south: 'north' };

describe('cartes extérieures : grandes et reliées', () => {
    test('toutes les cartes extérieures sont grandes (≥ 350 cases) ; seuls les intérieurs restent petits', () => {
        expect(outdoors.length).toBe(41);   // 10 sanctuaires + 10 zones sauvages + 9 hameaux + 10 villages + 2 cartes de mer
        outdoors.forEach(s => expect({ id: s.id, area: s.w * s.h >= 350 }).toEqual({ id: s.id, area: true }));
        Object.values(SCREENS).filter(s => s.interior || s.kind === 'house').forEach(s => expect(s.w * s.h).toBeLessThan(120));
    });

    test('sanctuaires, zones sauvages et hameaux ont la taille agrandie', () => {
        outdoors.filter(s => !s.aquatic).forEach(s => {
            const kind = s.id.endsWith('_wild') ? 'wild' : s.id.endsWith('_hamlet') ? 'hamlet' : s.kind === undefined ? 'sanctuary' : null;
            if (kind) expect([s.w, s.h]).toEqual(EXPANDED_SIZES[kind]);
        });
    });

    test.each(outdoors.map(s => [s.id, s]))('%s : passages de bord = 3 cases alignées, arrivée en face et libre', (_id, s) => {
        const edgeExits = s.exits.filter(e => e.edge);
        edgeExits.forEach(e => {
            expect(edgeOf(s, e)).toBe(e.edge);
            expect(isTerrainBlocked(s, e.x, e.y)).toBe(false);
            expect([-1, 0, 1]).toContain(e.span);
            const target = SCREENS[e.to];
            expect(isTerrainBlocked(target, e.arrive.x, e.arrive.y)).toBe(false);
            // on arrive juste à l'intérieur du bord opposé, sur la rangée alignée
            const back = target.exits.filter(b => b.to === s.id && b.edge === OPPOSITE[e.edge]);
            expect(back.length).toBeGreaterThan(0);
            expect(back.some(b => Math.abs(b.x - e.arrive.x) + Math.abs(b.y - e.arrive.y) === 1)).toBe(true);
        });
        // chaque passage a une case centrale
        const centers = edgeExits.filter(e => e.span === 0);
        expect(centers.length).toBeGreaterThan(0);
    });

    test.each(outdoors.map(s => [s.id, s]))('%s : tout le terrain libre est atteignable depuis l\'apparition', (_id, s) => {
        const seen = reach(s, s.spawn);
        s.exits.filter(e => !e.door).forEach(e => expect(seen.has(`${e.x},${e.y}`)).toBe(true));
        // pas de grande poche inaccessible (les anciennes salles peuvent garder leurs recoins d'origine)
        let free = 0;
        for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) if (!isTerrainBlocked(s, x, y)) free++;
        expect(seen.size / free).toBeGreaterThan(0.9);
    });

    test('le monde reste connexe en suivant uniquement les passages de bord et les portes', () => {
        const start = 'rizieres_village';
        const seen = new Set([start]);
        const queue = [start];
        while (queue.length) SCREENS[queue.shift()].exits.forEach(e => { if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); } });
        outdoors.forEach(s => expect(seen.has(s.id)).toBe(true));
    });
});

describe('plus de délimitation factice, de l\'eau en bordure (openPerimeter, addWaterBorder)', () => {
    const inRects = (rects, x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
    const ring = s => {
        const cells = [];
        for (let x = 0; x < s.w; x++) cells.push([x, 0], [x, s.h - 1]);
        for (let y = 1; y < s.h - 1; y++) cells.push([0, y], [s.w - 1, y]);
        return cells;
    };

    test('villages, zones sauvages, hameaux : couronne sans mur factice, faite d\'eau (hors passages de bord)', () => {
        outdoors.filter(s => !s.aquatic).forEach(s => {
            const cells = ring(s);
            const rocks = cells.filter(([x, y]) => inRects(s.obstacles, x, y));
            // seuls des blocs de décor posés au bord d'un sanctuaire (goulets) peuvent subsister
            if (s.kind !== undefined) expect({ id: s.id, rocks: rocks.length }).toEqual({ id: s.id, rocks: 0 });
            const water = cells.filter(([x, y]) => inRects(s.liquids, x, y)).length;
            expect(water / cells.length).toBeGreaterThan(0.4);
            s.exits.filter(e => e.edge).forEach(e => expect(inRects(s.liquids, e.x, e.y)).toBe(false));   // les passages restent de la terre
        });
    });

    test('l\'eau de bordure se traverse avec le Pas de Yu, jamais sans', () => {
        const v = SCREENS.rizieres_village;
        const [x, y] = ring(v).find(([cx, cy]) => inRects(v.liquids, cx, cy));
        expect(isTerrainBlocked(v, x, y)).toBe(true);
        expect(isTerrainBlocked(v, x, y, true)).toBe(false);
    });

    test('les maisons gardent leurs murs, et un bloc de décor posé au bord d\'un sanctuaire (goulet) reste en place', () => {
        const house = Object.values(SCREENS).find(s => s.interior);
        expect(isTerrainBlocked(house, 0, 0)).toBe(true);
        expect(isTerrainBlocked(SCREENS.rizieres, 12, 0)).toBe(true);   // bloc d'origine [6,0,2,3] étiré : il forme le goulet de Fengmeng
    });
});

describe('redisposition : le contenu des cartes agrandies occupe toute la surface', () => {
    const scaled = outdoors.filter(s => !s.aquatic && (s.id.endsWith('_wild') || s.id.endsWith('_hamlet') || s.kind === undefined));
    const points = s => [...s.npcs, ...s.chests, ...s.enemies, ...(s.buildings || []).map(b => ({ x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) }))];

    test.each(scaled.map(s => [s.id, s]))('%s : entités et maisons réparties sur toute la carte (pas entassées dans un coin)', (_id, s) => {
        const pts = points(s);
        if (pts.length < 4) return;
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        expect((Math.max(...xs) - Math.min(...xs)) / s.w).toBeGreaterThanOrEqual(0.4);
        expect((Math.max(...ys) - Math.min(...ys)) / s.h).toBeGreaterThanOrEqual(0.2);
    });

    test('plus rien n\'est entassé dans un coin : aucune carte n\'a tout son contenu dans son quart nord-ouest', () => {
        scaled.forEach(s => {
            const pts = points(s);
            if (pts.length < 4) return;
            const inCorner = pts.filter(p => p.x < s.w / 2 && p.y < s.h / 2).length;
            expect({ id: s.id, share: inCorner / pts.length < 0.8 }).toEqual({ id: s.id, share: true });
        });
    });

    test('les maisons du hameau gardent leur taille, une porte praticable et une ruelle devant', () => {
        Object.values(SCREENS).filter(s => s.id.endsWith('_hamlet')).forEach(h => {
            expect((h.buildings || []).length).toBeGreaterThan(0);
            h.buildings.forEach(b => {
                expect(b.w).toBeLessThanOrEqual(6);
                expect(isTerrainBlocked(h, b.door.x, b.door.y)).toBe(false);
                expect(isTerrainBlocked(h, b.door.x, b.door.y + 1)).toBe(false);
                const exit = h.exits.find(e => e.door && e.x === b.door.x && e.y === b.door.y);
                expect({ id: h.id, door: Boolean(exit) }).toEqual({ id: h.id, door: true });
            });
        });
    });

    test('la zone de vigilance reste de 1 case (0 pour un boss), même sur les cartes agrandies', () => {
        scaled.forEach(s => s.enemies.forEach(e => expect([e.id, aggroOf(e)]).toEqual([e.id, e.boss || e.guardsDoor ? 0 : 1])));
    });
});

describe('scaleScreen / widenGates (écran synthétique)', () => {
    const make = () => ({
        id: 'test_zone', w: 8, h: 6, spawn: { x: 1, y: 2 },
        obstacles: [[0, 0, 8, 1], [0, 5, 8, 1], [0, 1, 1, 4], [7, 1, 1, 4], [3, 2, 2, 1]],
        liquids: [], paths: [], buildings: [{ id: 'A', x: 2, y: 3, w: 2, h: 2, door: { x: 2, y: 4 } }],
        npcs: [{ id: 'n', x: 5, y: 2 }], chests: [{ id: 'c', x: 6, y: 4 }],
        enemies: [{ id: 'e', x: 4, y: 3, kind: 'sentinel' }, { id: 'p', x: 1, y: 1, kind: 'patrol', patrol: [[1, 1], [5, 1]] }],
        exits: [{ x: 0, y: 2, to: 'a', label: 'A' }, { x: 7, y: 3, to: 'b', label: 'B', requires: 'x' }, { x: 2, y: 4, to: 'maison', door: true, label: 'Maison' }]
    });

    test('la carte entière est étirée : taille cible, contenu réparti, passages sur les bords', () => {
        const s = scaleScreen(make(), 16, 12);
        expect([s.w, s.h]).toEqual([16, 12]);
        const blocked = (x, y) => isTerrainBlocked(s, x, y);
        expect(s.gates.find(g => g.attrs.to === 'b')).toMatchObject({ edge: 'east', center: { x: 15 } });
        expect(s.gates.find(g => g.attrs.to === 'a')).toMatchObject({ edge: 'west', center: { x: 0 } });
        // les entités se répartissent à l'échelle (≈ ×2), loin de leur position d'origine
        expect(s.npcs[0].x).toBeGreaterThan(8);
        expect(s.chests[0]).toMatchObject({ x: expect.any(Number) });
        expect(s.chests[0].x).toBeGreaterThan(10);
        expect(aggroOf(s.enemies.find(e => e.id === 'e'))).toBe(1);
        s.enemies.concat(s.npcs, s.chests).forEach(e => expect(blocked(e.x, e.y)).toBe(false));
        // le bloc de décor d'origine est étiré mais conserve sa forme générale (un obstacle isolé, pas un mur)
        expect(blocked(7, 5)).toBe(true);
        expect(blocked(7, 8)).toBe(false);
    });

    test('la patrouille garde un trajet libre et la maison garde sa taille, sa porte et sa sortie', () => {
        const s = scaleScreen(make(), 16, 12);
        const p = s.enemies.find(e => e.id === 'p');
        const xs = p.patrol.map(q => q[0]), ys = p.patrol.map(q => q[1]);
        for (let x = Math.min(...xs); x <= Math.max(...xs); x++) expect(isTerrainBlocked(s, x, ys[0])).toBe(false);
        const b = s.buildings[0];
        expect([b.w, b.h]).toEqual([2, 2]);
        expect(b.door).toEqual({ x: b.x + 0, y: b.y + 1 });
        expect(isTerrainBlocked(s, b.door.x, b.door.y)).toBe(false);
        expect(isTerrainBlocked(s, b.door.x, b.door.y + 1)).toBe(false);   // la ruelle devant la porte
        expect(s.exits.find(e => e.door)).toMatchObject({ x: b.door.x, y: b.door.y, to: 'maison' });
        expect(isTerrainBlocked(s, b.x + 1, b.y)).toBe(true);              // le reste du bâtiment bloque
    });

    test('linkGates : arrivée alignée, verrou recopié sur toutes les cases du passage', () => {
        const a = scaleScreen(make(), 16, 12);
        const b = { id: 'b', w: 10, h: 8, spawn: { x: 2, y: 4 }, obstacles: [[0, 0, 10, 1], [0, 7, 10, 1], [0, 1, 1, 6], [9, 1, 1, 6]], liquids: [], paths: [], buildings: [], npcs: [], chests: [], enemies: [],
            exits: [{ x: 0, y: 4, to: 'test_zone' }] };
        widenGates(b);
        linkGates({ test_zone: a, b });
        const ex = a.exits.filter(e => e.to === 'b');
        expect(ex.map(e => e.span).sort()).toEqual([-1, 0, 1]);
        ex.forEach(e => expect(e.requires).toBe('x'));
        const center = ex.find(e => e.span === 0);
        expect(center.arrive).toEqual({ x: 1, y: 4 });
        expect(ex.find(e => e.span === 1).arrive).toEqual({ x: 1, y: 5 });
    });

    test('même carte, même résultat (déterministe)', () => {
        expect(JSON.stringify(scaleScreen(make(), 16, 12))).toBe(JSON.stringify(scaleScreen(make(), 16, 12)));
    });
});

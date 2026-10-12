// Cartes natives, routes d'accès, sanctuaire en grille, positions explicites et hautes herbes (format v2 : world/DESIGN-V2.md,
// world/FORMAT.md §9). Le monde est assemblé à partir de mini-cartes de fixture passées à `assembleWorld`.
import './fixtures/playerForge.js';   // installe le stub XHR avant le chargement des modules du jeu
import { describe, test, expect } from '@jest/globals';
import { assembleWorld } from '../../world/index.js';
import { parseGrid, buildZone, applyNativeSanctuary, NATIVE_LIMITS, GRASS_DEFAULTS } from '../../world/mapKit.js';
import { scaleScreen, widenGates, pruneGrass, EXPANDED_SIZES } from '../../world/expand.js';
import { connectionRows } from '../../mapConnections.js';
import { buildAquaticWorld, YUBU_QUEST_ID, ARCHIPEL_ID } from '../../world/aquatic.js';

const clone = v => JSON.parse(JSON.stringify(v));
const row = (w, fill = '.') => `#${fill.repeat(w - 2)}#`;

// ── Fixtures : deux régions (rizieres sans route, fleuve avec route native et sanctuaire en grille) ───────────────────────
const sanctuaryBase = (id, region, extra) => ({
    id, region, name: `Sanctuaire ${id}`, biome: 'paddy', w: 14, h: 10, spawn: { x: 1, y: 4 },
    obstacles: [[6, 0, 1, 3]], liquids: [], paths: [[0, 4, 14, 1]], npcs: [], enemies: [], chests: [], exits: [], ...extra
});
const BASE_SCREENS = {
    rizieres: sanctuaryBase('rizieres', 'rizieres', {
        exits: [{ x: 13, y: 4, to: 'fleuve', arrive: { x: 1, y: 4 }, label: 'Fleuve', requires: 'sun_a' }],
        enemies: [{ id: 'sun_a', templateId: 'goblin_saboteur', name: 'Soleil A', kind: 'sentinel', x: 11, y: 4, permanent: true, boss: { name: 'Soleil A', level: 5 } }],
        chests: [{ id: 'chest_r', x: 3, y: 8, gold: 25, label: 'Jarre' }]
    }),
    fleuve: sanctuaryBase('fleuve', 'fleuve', {
        biome: 'riverbed',
        exits: [{ x: 0, y: 4, to: 'rizieres', arrive: { x: 12, y: 4 }, label: 'Rizières' }],
        npcs: [
            { id: 'weaver', x: 2, y: 2, name: 'Mei', idle: ['Je tisse.'] },
            { id: 'monk_f', x: 3, y: 1, name: 'Zhen', idle: ['Paix.'], showWhen: 'sun_a', talk: [{ whenDone: 'sun_f', lines: ['Merci.'] }] }
        ],
        chests: [{ id: 'chest_f', x: 12, y: 3, gold: 60, label: 'Coffre', openText: 'Du bronze.' }],
        enemies: [
            { id: 'guard_f', templateId: 'goblin_saboteur', name: 'Garde', kind: 'sentinel', x: 8, y: 8, offset: 1, permanent: true },
            { id: 'patrol_f', templateId: 'fungal_horror', name: 'Rôdeur', kind: 'patrol', x: 8, y: 9, patrol: [[8, 9], [12, 9]], offset: 0 },
            { id: 'sun_f', templateId: 'iron_gladiator', name: 'Soleil F', kind: 'sentinel', x: 11, y: 8, permanent: true,
              boss: { name: 'Soleil F', level: 9 }, weakenedBy: ['chest_f'], afterScenes: [{ speaker: { name: 'Hou Yi' }, lines: ['Un de moins.'] }] }
        ]
    })
};
const GRASS = { table: [{ templateId: 'goblin_saboteur', name: 'Voleur d\'eau', weight: 3, offset: 0 }, { templateId: 'forest_guardian', name: 'Esprit', weight: 1, offset: 1 }] };

const VILLAGE_R = [row(14, '#'), row(14), row(14), '#.S..........>', row(14), row(14), row(14), row(14, '#')];
const WILD_R = [
    row(18, '#'), row(18), '#.1..............#', row(18), '#.....##.........#', '<.....##....2....>',
    row(18), '#...3............#', row(18), row(18, '#')
];
const VILLAGE_F = [row(16, '#'), row(16), row(16), row(16), '<..S...1.......>', row(16), row(16), row(16), row(16), row(16, '#')];
const ROAD_F = [
    row(24, '#'),
    row(24),
    '#..""""......###.......#',
    '#..""""....1...........#',
    '<.....=======..........>',
    '#......""""....2.......#',
    '#......"""".......3....#',
    row(24),
    row(24, '#')
];
const WILD_F = [
    row(18, '#'), row(18), '#.1..............#', row(18), '#.....##.........#', '<.....##....2....>',
    row(18), '#...3............#', row(18), row(18, '#')
];
const SANCTUARY_F = [
    row(20, '#'),
    row(20),
    '#..1...........2...#',
    row(20),
    '#...~~~........3...#',
    '<...~~~............>',
    row(20),
    '#..4....S.....5....#',
    '#..""""............#',
    '#..W...............#',
    row(20, '#')
];
const PLACES_F = { monk_f: '1', chest_f: '2', guard_f: '3', patrol_f: { at: '4', patrol: ['4', [6, 7]] }, sun_f: '5' };

const mapsFixture = () => ({
    rizieres: {
        village: { id: 'rizieres_village', biome: 'paddy', grid: VILLAGE_R, npcs: [{ id: 'elder', x: 3, y: 5 }] },
        wild: {
            id: 'rizieres_wild', biome: 'paddy', grid: WILD_R,
            enemies: [
                { id: 'warden_r', at: '2', templateId: 'forest_guardian', name: 'Gardien', kind: 'sentinel', offset: 1, permanent: true },
                { id: 'rr_patrol', at: '3', templateId: 'fungal_horror', name: 'Rôdeur', kind: 'patrol', patrol: ['3', [10, 7]], offset: 0 }
            ],
            chests: [{ id: 'wild_chest_r', at: '1', gold: 15 }],
            gate: { requires: 'warden_r', lockedMessage: 'Fermé.' }
        },
        sanctuary: { id: 'rizieres', waypoint: { x: 2, y: 5 } }
    },
    fleuve: {
        village: { id: 'fleuve_village', biome: 'riverbed', grid: VILLAGE_F, npcs: [{ id: 'weaver', at: '1' }] },
        road: {
            id: 'fleuve_road', biome: 'riverbed', native: true, grid: ROAD_F, grass: GRASS,
            npcs: [{ id: 'road_npc', at: '1' }],
            chests: [{ id: 'road_chest', x: 20, y: 7, gold: 10 }],
            enemies: [
                { id: 'road_a', at: '2', templateId: 'goblin_saboteur', name: 'Voleur', kind: 'sentinel', offset: 0 },
                { id: 'road_patrol', x: 10, y: 6, templateId: 'fungal_horror', name: 'Rôdeur', kind: 'patrol', patrol: [[10, 6], [14, 6]], offset: 0 },
                { id: 'road_b', x: 18, y: 6, templateId: 'forest_guardian', name: 'Sentinelle', kind: 'sentinel', offset: 0 }
            ]
        },
        wild: {
            id: 'fleuve_wild', biome: 'riverbed', grid: WILD_F,
            enemies: [{ id: 'warden_f', at: '2', templateId: 'forest_guardian', name: 'Gardien', kind: 'sentinel', offset: 1, permanent: true }],
            gate: { requires: 'warden_f', lockedMessage: 'Fermé.' }
        },
        sanctuary: { id: 'fleuve', waypoint: { x: 2, y: 5 }, grid: SANCTUARY_F, native: true, places: clone(PLACES_F), grass: GRASS }
    }
});
const textsFixture = () => ({
    rizieres: {
        screens: { rizieres_village: { name: 'Village R' }, rizieres_wild: { name: 'Marais R' } },
        npcs: { elder: { name: 'Wen', idle: ['Bonjour.'] } },
        chests: { wild_chest_r: { label: 'Jarre du marais' } }
    },
    fleuve: {
        screens: { fleuve_village: { name: 'Port F' }, fleuve_road: { name: 'Route des Méandres' }, fleuve_wild: { name: 'Lit F' } },
        npcs: { road_npc: { name: 'Passant', idle: ['Salut.'] } },
        chests: { road_chest: { label: 'Besace' } }
    }
});
const assemble = mutate => {
    const m = mapsFixture();
    if (mutate) mutate(m);
    return assembleWorld(clone(BASE_SCREENS), [], m, textsFixture(), { connections: [] });
};

const rowsOf = (screens, id) => connectionRows(screens, screens[id]);
const connectionTo = (screens, id, dir) => screens[id].connections[dir]?.to;
const entityAt = (s, x, y) => [...s.npcs, ...s.chests, ...s.enemies].find(e => e.x === x && e.y === y);

describe('route d\'accès (road) : chaînage', () => {
    const { screens } = assemble();

    test('sanctuaire précédent ──E──► road ──E──► village ──E──► wild ──E──► sanctuaire', () => {
        expect(screens.fleuve_road).toBeTruthy();
        expect(connectionTo(screens, 'rizieres', 'east')).toBe('fleuve_road');
        expect(connectionTo(screens, 'fleuve_road', 'west')).toBe('rizieres');
        expect(connectionTo(screens, 'fleuve_road', 'east')).toBe('fleuve_village');
        expect(connectionTo(screens, 'fleuve_village', 'west')).toBe('fleuve_road');
        expect(connectionTo(screens, 'fleuve_village', 'east')).toBe('fleuve_wild');
        expect(connectionTo(screens, 'fleuve_wild', 'west')).toBe('fleuve_village');
        expect(connectionTo(screens, 'fleuve_wild', 'east')).toBe('fleuve');
        expect(connectionTo(screens, 'fleuve', 'west')).toBe('fleuve_wild');
    });

    test('sans road, le village reste collé au sanctuaire précédent', () => {
        expect(screens.rizieres_road).toBeUndefined();
        expect(connectionTo(screens, 'rizieres_village', 'east')).toBe('rizieres_wild');
        expect(screens.fleuve_village.exits.every(e => e.to !== 'rizieres')).toBe(true);
    });

    test('la route est une zone sauvage (kind wild, non sûre), avec ses textes, ses PNJ et son verrou de région', () => {
        const road = screens.fleuve_road;
        expect(road.kind).toBe('wild');
        expect(road.safe).toBe(false);
        expect(road.region).toBe('fleuve');
        expect(road.name).toBe('Route des Méandres');
        expect(road.npcs.map(n => n.id)).toEqual(['road_npc']);
        // arrivée alignée de part et d'autre du passage
        const west = rowsOf(screens, 'fleuve_road').find(r => r.edge === 'west' && r.span === 0);
        expect(west).toMatchObject({ x: 0, y: 4, to: 'rizieres' });
        expect(west.label).toBe('Sanctuaire rizieres');
    });

    test('le PNJ relogé dans la route ou le village n\'est plus au sanctuaire ; garde de frontière devant la route', () => {
        expect(screens.fleuve.npcs.map(n => n.id)).not.toContain('weaver');
        expect(screens.fleuve_village.npcs.map(n => n.id)).toContain('weaver');
        const guard = screens.rizieres.npcs.find(n => n.id === 'level_guard_rizieres');
        expect(guard).toBeTruthy();
        expect(guard.title).toContain('Route des Méandres');
    });

    test('route : points de préparation du terrain (addPrepSpots traite aussi _road)', () => {
        const kinds = screens.fleuve_road.spots.map(s => s.kind);
        expect(kinds).toContain('trap');
    });

    test('identifiant ou ancre invalide : erreur explicite', () => {
        expect(() => assemble(m => { m.fleuve.road.id = 'fleuve_chemin'; })).toThrow(/fleuve_road/);
        expect(() => assemble(m => { m.fleuve.road.grid = ROAD_F.map(r => r.replace('>', '#')); })).toThrow(/ancre « > »/);
        expect(() => assemble(m => { m.fleuve.road.grid = ROAD_F.map(r => r.replace('<', '#')); })).toThrow(/ancre « < »/);
    });
});

describe('cartes natives : jamais étirées', () => {
    const { screens } = assemble();

    test('la route et le sanctuaire natifs gardent la taille de leur grille ; les cartes non natives gardent le minimum', () => {
        expect([screens.fleuve_road.w, screens.fleuve_road.h]).toEqual([24, 9]);
        expect(screens.fleuve_road.native).toBe(true);
        expect([screens.fleuve.w, screens.fleuve.h]).toEqual([20, 11]);
        expect(screens.fleuve.native).toBe(true);
        expect([screens.fleuve_wild.w, screens.fleuve_wild.h]).toEqual(EXPANDED_SIZES.wild);
        expect(screens.fleuve_wild.native).toBeUndefined();
        expect([screens.rizieres.w, screens.rizieres.h]).toEqual(EXPANDED_SIZES.sanctuary);
        expect(screens.rizieres.native).toBeUndefined();
    });

    test('une route non native est étirée à la taille d\'une zone sauvage', () => {
        const { screens: s } = assemble(m => { delete m.fleuve.road.native; m.fleuve.road.grid = ROAD_F.map(r => r); });
        expect([s.fleuve_road.w, s.fleuve_road.h]).toEqual(EXPANDED_SIZES.wild);
        expect(s.fleuve_road.native).toBeUndefined();
    });

    test('les passages de bord sont élargis à 3 cases, alignés avec la carte voisine', () => {
        const rows = rowsOf(screens, 'fleuve_road').filter(r => r.edge === 'east');
        expect(rows.map(r => r.span).sort()).toEqual([-1, 0, 1]);
        expect(rows.find(r => r.span === 0)).toMatchObject({ x: 23, y: 4, to: 'fleuve_village' });
    });

    test('garde-fous : w·h ≤ 1500 et w, h ≤ 64', () => {
        const big = (w, h) => Array.from({ length: h }, (_, y) => (y === 0 || y === h - 1 ? '#'.repeat(w) : `#${'.'.repeat(w - 2)}#`));
        const withGrid = grid => assemble(m => {
            const g = grid.map(r => r);
            g[4] = `<${g[4].slice(1, -1)}>`;
            m.fleuve.road.grid = g; m.fleuve.road.native = true; delete m.fleuve.road.grass;
            m.fleuve.road.npcs = []; m.fleuve.road.chests = []; m.fleuve.road.enemies = [];
        });
        expect(NATIVE_LIMITS).toEqual({ maxSide: 64, maxCells: 1500 });
        expect(() => withGrid(big(40, 38))).toThrow(/trop grande/);    // 1520 cases
        expect(() => withGrid(big(65, 10))).toThrow(/trop grande/);    // côté > 64
        expect(() => withGrid(big(10, 65))).toThrow(/trop grande/);
        expect(() => withGrid(big(60, 25))).not.toThrow();             // 1500 cases pile
        expect(() => buildZone({ id: 't', kind: 'wild', native: true, grid: big(40, 38).map((r, i) => (i === 4 ? `<${r.slice(1, -1)}>` : r)) },
            { screenText: () => ({}) })).toThrow(/t : carte native trop grande/);
    });
});

describe('sanctuaire en grille native (places)', () => {
    const { screens } = assemble();
    const s = screens.fleuve;
    const base = BASE_SCREENS.fleuve;

    test('la géométrie vient de la grille : obstacles, liquides, pierre de voyage, apparition', () => {
        const parsed = parseGrid(SANCTUARY_F);
        expect(s.liquids).toEqual(expect.arrayContaining([[4, 4, 3, 2]]));
        expect(parsed.waypoint).toEqual({ x: 3, y: 9 });
        expect(s.waypoint).toMatchObject({ x: 3, y: 9 });
        expect(s.waypoint.name).toBeTruthy();
        expect(s.waypoint.spot).toBeTruthy();
        expect(s.spawn).toEqual({ x: 8, y: 7 });
    });

    test('les entités de story.js sont conservées avec tous leurs champs, repositionnées sur les ancres', () => {
        const at = id => { const e = [...s.npcs, ...s.chests, ...s.enemies].find(x => x.id === id); return e && { x: e.x, y: e.y }; };
        expect(at('monk_f')).toEqual({ x: 3, y: 2 });
        expect(at('chest_f')).toEqual({ x: 15, y: 2 });
        expect(at('guard_f')).toEqual({ x: 15, y: 4 });
        expect(at('sun_f')).toEqual({ x: 14, y: 7 });
        const patrol = s.enemies.find(e => e.id === 'patrol_f');
        expect(patrol).toMatchObject({ x: 3, y: 7, kind: 'patrol', patrol: [[3, 7], [6, 7]] });
        const strip = e => { const { x, y, patrol: _p, ...rest } = e; return rest; };
        ['guard_f', 'sun_f', 'patrol_f'].forEach(id => {
            expect(strip(s.enemies.find(e => e.id === id))).toEqual(strip(base.enemies.find(e => e.id === id)));
        });
        expect(strip(s.npcs.find(n => n.id === 'monk_f'))).toEqual(strip(base.npcs.find(n => n.id === 'monk_f')));
        expect(strip(s.chests.find(c => c.id === 'chest_f'))).toEqual(strip(base.chests.find(c => c.id === 'chest_f')));
    });

    test('la sortie ouest (vers la wild) se place sur l\'ancre <, le passage fait 3 cases', () => {
        const rows = rowsOf(screens, 'fleuve').filter(r => r.edge === 'west');
        expect(rows.map(r => r.span).sort()).toEqual([-1, 0, 1]);
        expect(rows.find(r => r.span === 0)).toMatchObject({ x: 0, y: 5, to: 'fleuve_wild' });
    });

    test('applyNativeSanctuary : sorties sur < (vers la wild) et > (région suivante), alias exit:<région>', () => {
        const make = () => {
            const screen = clone(BASE_SCREENS.fleuve);
            screen.npcs = []; screen.chests = []; screen.enemies = [];
            screen.exits = [{ x: 0, y: 4, to: 'fleuve_wild', label: 'Lit F' }, { x: 13, y: 5, to: 'bambous_road', label: 'Route', requires: 'sun_f', lockedMessage: 'Fermé.' }];
            return screen;
        };
        const grid = [row(10, '#'), row(10), '<S.......>', row(10), '..........', row(10, '#')];
        const a = applyNativeSanctuary(make(), { grid, native: true, places: {} });
        expect(a.exits.find(e => e.to === 'fleuve_wild')).toMatchObject({ x: 0, y: 2 });
        expect(a.exits.find(e => e.to === 'bambous_road')).toMatchObject({ x: 9, y: 2, requires: 'sun_f', lockedMessage: 'Fermé.' });
        // place explicite par la destination ou par la région (alias), sur des cases libres de bord
        const b = applyNativeSanctuary(make(), { grid, native: true, places: { 'exit:bambous': [9, 4], 'exit:fleuve_wild': [0, 4], spawn: [4, 2], waypoint: [4, 3] } });
        expect(b.exits.find(e => e.to === 'bambous_road')).toMatchObject({ x: 9, y: 4 });
        expect(b.exits.find(e => e.to === 'fleuve_wild')).toMatchObject({ x: 0, y: 4 });
        expect(b.spawn).toEqual({ x: 4, y: 2 });
        expect(b.waypoint).toMatchObject({ x: 4, y: 3 });
        expect(b.native).toBe(true);
        expect([b.w, b.h]).toEqual([10, 6]);
    });

    test('toute entité doit avoir une place : erreur explicite sinon', () => {
        expect(() => assemble(m => { delete m.fleuve.sanctuary.places.chest_f; })).toThrow(/sanctuaire fleuve : entités sans place.*chest_f/);
        expect(() => assemble(m => { m.fleuve.sanctuary.places.fantome = '1'; })).toThrow(/places inconnues.*fantome/);
        expect(() => assemble(m => { m.fleuve.sanctuary.places.chest_f = '9'; })).toThrow(/ancre « 9 »/);
        expect(() => assemble(m => { m.fleuve.sanctuary.places.chest_f = [0, 0]; })).toThrow(/obstacle/);
        expect(() => assemble(m => { m.fleuve.sanctuary.places.chest_f = '1'; })).toThrow(/même case/);
        expect(() => assemble(m => { m.fleuve.sanctuary.places.patrol_f = '4'; })).toThrow(/patrouille/);
    });

    test('clés spéciales spawn et waypoint ; PNJ relogés ignorés', () => {
        const { screens: t } = assemble(m => { Object.assign(m.fleuve.sanctuary.places, { spawn: [10, 8], waypoint: [10, 9] }); });
        expect(t.fleuve.spawn).toEqual({ x: 10, y: 8 });
        expect(t.fleuve.waypoint).toMatchObject({ x: 10, y: 9 });
        expect(t.fleuve.npcs.map(n => n.id)).not.toContain('weaver');
    });

    test('applyNativeSanctuary : sans ancre « > » ni place d\'exit, la sortie est refusée', () => {
        const screen = clone(BASE_SCREENS.fleuve);
        screen.npcs = []; screen.chests = []; screen.enemies = [];
        screen.exits = [{ x: 13, y: 5, to: 'bambous_road' }];
        const grid = [row(8, '#'), row(8), '<S.....#', row(8), row(8, '#')];
        expect(() => applyNativeSanctuary(screen, { grid, native: true, places: {} })).toThrow(/ancre « > »/);
    });
});

describe('cartes natives dans la chaîne complète (couronne d\'eau, barrières, jonctions)', () => {
    const { screens } = assemble();
    const inRects = (rects, x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

    test.each(['fleuve_road', 'fleuve'])('%s : entités, sorties et passages atteignables à pied depuis l\'apparition', id => {
        const s = screens[id];
        const blocked = (x, y) => x < 0 || y < 0 || x >= s.w || y >= s.h || inRects(s.obstacles, x, y) || inRects(s.liquids, x, y);
        const entities = [...s.npcs, ...s.chests, ...s.enemies.filter(e => !e.guardsDoor), ...(s.waypoint ? [s.waypoint] : [])];
        const solid = new Set([...entities, ...s.exits].map(e => `${e.x},${e.y}`));
        const seen = new Set([`${s.spawn.x},${s.spawn.y}`]);
        const queue = [s.spawn];
        while (queue.length) {
            const p = queue.shift();
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                const nx = p.x + dx, ny = p.y + dy, k = `${nx},${ny}`;
                if (seen.has(k) || blocked(nx, ny) || solid.has(k)) return;
                seen.add(k); queue.push({ x: nx, y: ny });
            });
        }
        const touches = e => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${e.x + dx},${e.y + dy}`));
        [...entities, ...s.exits].forEach(e => expect({ id, e: e.id || e.to, ok: touches(e) }).toEqual({ id, e: e.id || e.to, ok: true }));
        rowsOf(screens, id).forEach(r => expect({ id, edge: r.edge, free: !blocked(r.x, r.y) && seen.has(`${r.x},${r.y}`) }).toEqual({ id, edge: r.edge, free: true }));
    });

    test('la couronne extérieure est refermée (eau ou décor) hors passages, comme pour les autres cartes', () => {
        const s = screens.fleuve_road;
        const open = new Set(rowsOf(screens, 'fleuve_road').map(r => `${r.x},${r.y}`));
        let shut = 0, rim = 0;
        for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) {
            if (x && y && x < s.w - 1 && y < s.h - 1) continue;
            if (open.has(`${x},${y}`)) continue;
            rim++;
            if (inRects(s.obstacles, x, y) || inRects(s.liquids, x, y)) shut++;
        }
        expect(shut / rim).toBeGreaterThan(0.85);
    });
});

describe('positions explicites (x/y) et patrouilles [x, y]', () => {
    const { screens } = assemble();

    test('coffre, ennemis et patrouille posés par x/y', () => {
        const road = screens.fleuve_road;
        expect(road.chests.find(c => c.id === 'road_chest')).toMatchObject({ x: 20, y: 7, gold: 10, label: 'Besace' });
        expect(road.enemies.find(e => e.id === 'road_b')).toMatchObject({ x: 18, y: 6, kind: 'sentinel' });
        expect(road.enemies.find(e => e.id === 'road_patrol')).toMatchObject({ x: 10, y: 6, kind: 'patrol', patrol: [[10, 6], [14, 6]] });
        expect(screens.rizieres_village.npcs.find(n => n.id === 'elder')).toMatchObject({ x: 3, y: 5 });
        expect(screens.rizieres_wild.enemies.find(e => e.id === 'rr_patrol').patrol.length).toBe(2);
    });

    test('mélange ancre et [x, y] dans une patrouille ; at et x/y exclusifs ; hors grille refusé', () => {
        const grid = [row(8, '#'), '#1.....#', row(8), row(8), '<S.....>', row(8, '#')];
        const helpers = { npcDef: id => ({ id }), chestDef: id => ({ id }), screenText: () => ({}) };
        const z = buildZone({ id: 'z', kind: 'wild', grid, enemies: [{ id: 'e', at: '1', patrol: ['1', [5, 1]], templateId: 'x' }] }, helpers);
        expect(z.enemies[0].patrol).toEqual([[1, 1], [5, 1]]);
        expect(() => buildZone({ id: 'z', kind: 'wild', grid, chests: [{ id: 'c', at: '1', x: 2, y: 2 }] }, helpers)).toThrow(/exclusifs/);
        expect(() => buildZone({ id: 'z', kind: 'wild', grid, chests: [{ id: 'c', x: 9, y: 2 }] }, helpers)).toThrow(/hors de la grille/);
        expect(() => buildZone({ id: 'z', kind: 'wild', grid, chests: [{ id: 'c', x: 2 }] }, helpers)).toThrow(/entiers/);
        expect(() => buildZone({ id: 'z', kind: 'wild', grid, enemies: [{ id: 'e', at: '1', patrol: ['1', [5, 99]] }] }, helpers)).toThrow(/hors de la grille/);
    });

    test('une sortie déclarée par x/y remplace la sortie automatique de même destination', () => {
        const { screens: s } = assemble(m => { m.fleuve.village.exits = [{ x: 15, y: 4, to: 'fleuve_wild', label: 'Pont' }]; });
        expect(s.fleuve_village.connections.east).toMatchObject({ to: 'fleuve_wild', label: 'Pont' });
        expect(connectionRows(s, s.fleuve_village).filter(r => r.edge === 'east')).toHaveLength(3);
    });
});

describe('hautes herbes (« " ») : screen.grass', () => {
    const { screens } = assemble();
    const cellsOf = grass => { const c = new Set(); grass.cells.forEach(([x, y, w, h]) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) c.add(`${x + i},${y + j}`); }); return c; };

    test('parseGrid : « " » est franchissable, ni obstacle ni liquide', () => {
        const g = parseGrid(['#####', '#"".#', '#"~.#', '#####']);
        expect(g.grass).toEqual([[1, 1, 2, 1], [1, 2, 1, 1]]);
        expect(g.obstacles).toEqual([[0, 0, 5, 1], [0, 1, 1, 2], [4, 1, 1, 2], [0, 3, 5, 1]]);
        expect(g.liquids).toEqual([[2, 2, 1, 1]]);
        expect(parseGrid(['..']).grass).toEqual([]);
    });

    test('road : cells + défauts fusionnés (rate 0.12, safeSteps 3) + table de la spec', () => {
        const grass = screens.fleuve_road.grass;
        expect(GRASS_DEFAULTS).toEqual({ rate: 0.12, safeSteps: 3 });
        expect(grass).toMatchObject({ rate: 0.12, safeSteps: 3, table: GRASS.table });
        expect(cellsOf(grass).size).toBe(8 + 8);   // deux nappes de 2 × 4 cases
        expect(cellsOf(grass).has('3,2')).toBe(true);
        expect(cellsOf(grass).has('7,5')).toBe(true);
        expect(grass.cells.every(r => r.length === 4 && r.every(Number.isInteger))).toBe(true);
    });

    test('la spec peut surcharger rate et safeSteps ; sans « " », pas de screen.grass', () => {
        const { screens: s } = assemble(m => { m.fleuve.road.grass = { ...GRASS, rate: 0.3, safeSteps: 5 }; });
        expect(s.fleuve_road.grass).toMatchObject({ rate: 0.3, safeSteps: 5 });
        expect(screens.fleuve_wild.grass).toBeUndefined();
        expect(screens.fleuve_village.grass).toBeUndefined();
        expect(screens.rizieres_wild.grass).toBeUndefined();
    });

    test('le sanctuaire natif porte ses hautes herbes', () => {
        expect(cellsOf(screens.fleuve.grass).size).toBe(4);
        expect(screens.fleuve.grass.table).toHaveLength(2);
    });

    test('les hautes herbes ne sont jamais sous un obstacle ou un liquide, ni perdues par widenGates / scaleScreen', () => {
        ['fleuve_road', 'fleuve'].forEach(id => {
            const s = screens[id];
            const blocked = (x, y) => [...s.obstacles, ...s.liquids].some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
            cellsOf(s.grass).forEach(k => { const [x, y] = k.split(',').map(Number); expect(blocked(x, y)).toBe(false); });
        });
        const make = () => ({
            id: 'z_wild', w: 6, h: 4, spawn: { x: 1, y: 1 }, obstacles: [[0, 0, 6, 1], [0, 3, 6, 1]], liquids: [], paths: [], buildings: [],
            npcs: [], chests: [], enemies: [], exits: [{ x: 0, y: 1, to: 'a' }],
            grass: { cells: [[2, 1, 2, 2]], rate: 0.12, safeSteps: 3, table: GRASS.table }
        });
        expect(widenGates(make()).grass.cells).toEqual([[2, 1, 2, 2]]);
        const big = scaleScreen(make(), 12, 8);
        expect(big.grass.rate).toBe(0.12);
        expect(big.grass.table).toEqual(GRASS.table);
        expect(cellsOf(big.grass).size).toBe(16);   // 2×2 étiré ×2 sur chaque axe
        expect(cellsOf(big.grass).has('4,2')).toBe(true);
        // les cases devenues obstacles disparaissent, la dernière efface `grass`
        const walled = make(); walled.obstacles.push([2, 1, 2, 2]);
        expect(pruneGrass(walled).grass).toBeUndefined();
    });

    test('erreurs : « " » en village, hameau ou intérieur ; table vide ; poids ≤ 0 ; table absente', () => {
        const helpers = { npcDef: id => ({ id }), chestDef: id => ({ id }), screenText: () => ({}) };
        const grid = [row(8, '#'), '#"....S#', '<......>', row(8, '#')];
        expect(() => buildZone({ id: 'v', kind: 'village', grid }, helpers)).toThrow(/hautes herbes.*interdites/);
        expect(() => buildZone({ id: 'h', kind: 'village', grid, grass: GRASS }, helpers)).toThrow(/interdites/);
        expect(() => buildZone({ id: 'i', kind: 'house', interior: true, grid }, helpers)).toThrow(/interdites/);
        expect(() => buildZone({ id: 'w', kind: 'wild', grid, grass: { table: [] } }, helpers)).toThrow(/table de hautes herbes vide/);
        expect(() => buildZone({ id: 'w', kind: 'wild', grid, grass: { table: [{ templateId: 'a', weight: 0 }] } }, helpers)).toThrow(/poids/);
        expect(() => buildZone({ id: 'w', kind: 'wild', grid, grass: { table: [{ templateId: 'a', weight: -2 }] } }, helpers)).toThrow(/poids/);
        expect(() => buildZone({ id: 'w', kind: 'wild', grid }, helpers)).toThrow(/sans table/);
        expect(() => buildZone({ id: 'w', kind: 'wild', grid, grass: { rate: 2, table: GRASS.table } }, helpers)).toThrow(/rate/);
        expect(() => buildZone({ id: 'w', kind: 'wild', grid, grass: GRASS }, helpers)).not.toThrow();
        // un village sans « " » ne porte pas de grass, même si la spec en déclare une
        expect(buildZone({ id: 'v', kind: 'village', grid: grid.map(r => r.replace('"', '.')) }, helpers).grass).toBeUndefined();
    });
});

describe('hameau natif de la mer : sortie vers la mer déclarée par la carte', () => {
    const hamlet = exits => ({ id: 'mer_hamlet', w: 30, h: 24, spawn: { x: 3, y: 3 }, obstacles: [], liquids: [], paths: [], buildings: [], npcs: [], chests: [], enemies: [], exits });

    test('la sortie déclarée est complétée (verrou du Pas de Yu, libellé), pas dupliquée', () => {
        const screens = { mer_hamlet: hamlet([{ x: 29, y: 14, to: ARCHIPEL_ID }]) };
        buildAquaticWorld(screens);
        const sea = screens.mer_hamlet.exits.filter(e => e.to === ARCHIPEL_ID);
        expect(sea).toHaveLength(1);
        expect(sea[0]).toMatchObject({ x: 29, y: 14, requires: YUBU_QUEST_ID, label: 'Mer des Mille Îlots' });
        expect(sea[0].lockedMessage).toBeTruthy();
    });

    test('sans déclaration, la sortie historique (bord est, rangée 2) est posée comme avant', () => {
        const screens = { mer_hamlet: hamlet([]) };
        buildAquaticWorld(screens);
        expect(screens.mer_hamlet.exits).toEqual([expect.objectContaining({ x: 29, y: 2, to: ARCHIPEL_ID, requires: YUBU_QUEST_ID })]);
    });
});

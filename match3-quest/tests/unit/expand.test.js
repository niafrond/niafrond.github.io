// Grandes cartes reliées par leurs bords (world/expand.js) : toute carte extérieure est grande, et on passe de l'une à
// l'autre en sortant par un bord, comme aux jonctions des routes Pokémon.
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { isTerrainBlocked } from '../../exploration.js';
import { expandScreen, widenGates, linkGates, EXPANDED_SIZES } from '../../world/expand.js';

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

describe('plus de délimitation factice (openPerimeter)', () => {
    test('aucune carte de plein air n\'a de mur d\'enceinte : couronne extérieure libre, hors blocs de décor et cloisons', () => {
        const village = SCREENS.rizieres_village;
        for (let x = 0; x < village.w; x++) {
            expect(isTerrainBlocked(village, x, 0)).toBe(false);
            expect(isTerrainBlocked(village, x, village.h - 1)).toBe(false);
        }
        const wild = SCREENS.rizieres_wild;
        for (let x = 0; x < wild.w; x++) {
            expect(isTerrainBlocked(wild, x, wild.h - 1)).toBe(false);
            if (x !== wild.barrier.eastX) expect(isTerrainBlocked(wild, x, 0)).toBe(false);   // seule la cloison salle / terrain touche la couronne
        }
        const arch = SCREENS.mer_archipel;
        expect(isTerrainBlocked(arch, 0, 0)).toBe(false);
    });

    test('les maisons gardent leurs murs, et un bloc de décor posé au bord d\'un sanctuaire (goulet) reste en place', () => {
        const house = Object.values(SCREENS).find(s => s.interior);
        expect(isTerrainBlocked(house, 0, 0)).toBe(true);
        expect(isTerrainBlocked(SCREENS.rizieres, 6, 0)).toBe(true);   // bloc [6,0,2,3] : il forme le goulet de Fengmeng
    });

    test('la cloison entre salle d\'origine et terrain agrandi reste fermée sur toute la hauteur, hors ouvertures', () => {
        const s = SCREENS.rizieres;
        const x = s.barrier.eastX;
        const open = [];
        for (let y = 0; y <= s.core.h; y++) if (!isTerrainBlocked(s, x, y)) open.push(y);
        expect(open.length).toBeGreaterThanOrEqual(3);   // l'ouverture de 3 cases (ancienne sortie est)
        expect(open.length).toBeLessThanOrEqual(3);
    });
});

describe('expandScreen / widenGates (écran synthétique)', () => {
    const make = () => ({
        id: 'test_zone', w: 8, h: 6, spawn: { x: 1, y: 2 },
        obstacles: [[0, 0, 8, 1], [0, 5, 8, 1], [0, 1, 1, 4], [7, 1, 1, 4]],
        liquids: [], paths: [], buildings: [], npcs: [], chests: [], enemies: [],
        exits: [{ x: 0, y: 2, to: 'a', label: 'A' }, { x: 7, y: 3, to: 'b', label: 'B', requires: 'x' }]
    });

    test('la salle d\'origine garde sa forme ; la cloison s\'ouvre en 3 cases ; bordure et passage est créés', () => {
        const s = expandScreen(make(), 16, 12);
        expect([s.w, s.h]).toEqual([16, 12]);
        const blocked = (x, y) => isTerrainBlocked(s, x, y);
        expect(blocked(7, 3)).toBe(false);        // ancienne sortie est = ouverture
        expect(blocked(7, 2) || blocked(7, 4)).toBe(false);
        expect(blocked(7, 1)).toBe(true);         // le reste du mur demeure
        expect(blocked(15, 0)).toBe(false);       // pas de bordure factice sur le nouveau terrain
        expect(blocked(8, 0)).toBe(false);
        expect(blocked(7, 0)).toBe(true);         // la cloison salle / terrain (x = 7) ne s'ouvre qu'aux passages
        const east = s.exits.filter(e => e.to === 'b');
        expect(east).toHaveLength(0);             // les sorties sont créées par linkGates
        expect(s.gates.find(g => g.attrs.to === 'b')).toMatchObject({ edge: 'east', center: { x: 15 } });
        expect(s.gates.find(g => g.attrs.to === 'a')).toMatchObject({ edge: 'west', center: { x: 0, y: 2 } });
    });

    test('linkGates : arrivée alignée, verrou recopié sur toutes les cases du passage', () => {
        const a = expandScreen(make(), 16, 12);
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

    test('même graine, même carte (génération déterministe)', () => {
        expect(JSON.stringify(expandScreen(make(), 16, 12))).toBe(JSON.stringify(expandScreen(make(), 16, 12)));
    });
});

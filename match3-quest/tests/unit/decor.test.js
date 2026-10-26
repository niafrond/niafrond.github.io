// Obstacles bas (roseaux, decor.js) : franchissables comme des hautes herbes, avec rencontres aléatoires.
import { SCREENS } from '../../story.js';
import { isLowObstacle, BIOME_DECOR, pickDecor, LOW_DECOR, houseDecor, houseRug } from '../../decor.js';
import { createSession, tryMove, isTerrainBlocked, isEncounterCell, encounterOf, findPath } from '../../exploration.js';

const cellsOf = screen => {
    const out = [];
    screen.obstacles.forEach(([rx, ry, rw, rh]) => { for (let i = 0; i < rw; i++) for (let j = 0; j < rh; j++) out.push([rx + i, ry + j]); });
    return out;
};
const screen = SCREENS.rizieres_wild;
const low = cellsOf(screen).filter(([x, y]) => isLowObstacle(screen, x, y));
const solid = cellsOf(screen).filter(([x, y]) => !isLowObstacle(screen, x, y));

describe('obstacles bas', () => {
    test('les biomes à roseaux ont des décors bas, les autres non', () => {
        const hasLow = id => BIOME_DECOR[id].some(d => LOW_DECOR.has(d));
        expect(['paddy', 'riverbed', 'savanna'].every(hasLow)).toBe(true);
        expect(['bamboo', 'volcano', 'cave', 'house'].some(hasLow)).toBe(false);
    });

    test('une carte de rizières a des roseaux franchissables ET des obstacles pleins', () => {
        expect(low.length).toBeGreaterThan(10);
        expect(solid.length).toBeGreaterThan(10);
    });

    test('le décor d\'un roseau est bien du jonc, jamais la bordure de la carte', () => {
        low.forEach(([x, y]) => {
            expect(LOW_DECOR.has(pickDecor(BIOME_DECOR[screen.biome], x, y))).toBe(true);
            expect(x > 0 && y > 0 && x < screen.w - 1 && y < screen.h - 1).toBe(true);
        });
    });

    test('roseaux : non bloquants et déclencheurs de rencontres ; obstacles pleins : bloquants', () => {
        low.forEach(([x, y]) => { expect(isTerrainBlocked(screen, x, y)).toBe(false); expect(isEncounterCell(screen, x, y)).toBe(true); });
        solid.forEach(([x, y]) => expect(isTerrainBlocked(screen, x, y)).toBe(true));
        expect(encounterOf(screen).table.length).toBeGreaterThan(0);
    });

    test('on marche dans les roseaux, et un tirage favorable y lance un combat aléatoire', () => {
        const [lx, ly] = low.find(([x, y]) => !isTerrainBlocked(screen, x - 1, y) && !cellsOf(screen).some(([ox, oy]) => ox === x - 1 && oy === y && !isLowObstacle(screen, ox, oy)));
        const s = createSession({ screenId: screen.id, x: lx - 1, y: ly });
        s.rt.grace = 0;
        s.rt.grassSteps = 99;
        const res = tryMove(s, 1, 0, { playerLevel: 5, random: () => 0 });
        expect([s.data.x, s.data.y]).toEqual([lx, ly]);
        expect(res.type).toBe('combat');
        expect(res.wild).toBe(true);
        expect(findPath(s, lx, ly)).not.toBeNull();
    });

    test('intérieurs, arènes, cartes aquatiques et bordures : aucun obstacle bas', () => {
        const fake = extra => ({ biome: 'paddy', w: 10, h: 10, obstacles: [[0, 0, 10, 10]], ...extra });
        for (const extra of [{ interior: true }, { aquatic: true }, { kind: 'arena' }, { arena: {} }]) {
            expect(cellsOf(fake(extra)).some(([x, y]) => isLowObstacle(fake(extra), x, y))).toBe(false);
        }
        const bld = fake({ buildings: [{ x: 1, y: 1, w: 8, h: 8 }] });
        expect(cellsOf(bld).some(([x, y]) => isLowObstacle(bld, x, y))).toBe(false);
        expect(isLowObstacle(fake(), 0, 5)).toBe(false);
    });
});

describe('mobilier des maisons', () => {
    
    const house = SCREENS.rizieres_h_wen;
    const obst = new Set(cellsOf(house).map(([x, y]) => `${x},${y}`));
    const isObst = (x, y) => obst.has(`${x},${y}`);

    test('plus de lanterne ni de théière posées par terre ; étagères et lits contre le mur du fond', () => {
        const names = cellsOf(house).map(([x, y]) => houseDecor(isObst, x, y));
        expect(names.some(n => ['lantern', 'teapot', 'books', 'chair'].includes(n))).toBe(false);
        cellsOf(house).filter(([, y]) => y === 1).forEach(([x, y]) => expect(['shelf', 'cabinet', 'bed']).toContain(houseDecor(isObst, x, y)));
    });

    test('deux obstacles contigus au milieu de la pièce forment une table, un obstacle isolé un objet domestique', () => {
        const pair = (x, y) => (x === 4 && y === 3) || (x === 5 && y === 3);
        expect(houseDecor(pair, 4, 3)).toBe('table');
        expect(['jar', 'basket', 'plant', 'cushion']).toContain(houseDecor((x, y) => x === 4 && y === 3, 4, 3));
    });

    test('le tapis tient sur des cases libres, hors rangée de la porte', () => {
        const rug = houseRug(isObst, house.w, house.h);
        expect(rug).not.toBeNull();
        expect(rug.w * rug.h).toBeGreaterThanOrEqual(4);
        for (let i = 0; i < rug.w; i++) for (let j = 0; j < rug.h; j++) expect(isObst(rug.x + i, rug.y + j)).toBe(false);
        expect(rug.y + rug.h).toBeLessThanOrEqual(house.h - 2);
        expect(houseRug(() => true, 10, 7)).toBeNull();
    });
});

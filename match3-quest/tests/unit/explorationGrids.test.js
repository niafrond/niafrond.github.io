import { SCREENS } from '../../story.js';
import { gridsOf, rectGrid } from '../../explorationGrids.js';

// Les grilles en cache doivent donner exactement les mêmes réponses que le parcours des rectangles qu'elles remplacent.
const inRects = (rects, x, y) => (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
const inBuilding = (s, x, y) => (s.buildings || []).some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
const screens = Object.values(SCREENS);

describe('explorationGrids', () => {
    test('liquides, obstacles et chemins : identiques à inRects sur toutes les cases de tous les écrans', () => {
        expect(screens.length).toBeGreaterThan(100);
        let cells = 0;
        screens.forEach(s => {
            const g = gridsOf(s);
            for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) {
                cells++;
                if (g.liq[y * s.w + x] !== (inRects(s.liquids, x, y) ? 1 : 0)) throw new Error(`liquide ${s.id} ${x},${y}`);
                if (g.obst[y * s.w + x] !== (inRects(s.obstacles, x, y) ? 1 : 0)) throw new Error(`obstacle ${s.id} ${x},${y}`);
                if (g.path[y * s.w + x] !== (inRects(s.paths, x, y) ? 1 : 0)) throw new Error(`chemin ${s.id} ${x},${y}`);
            }
        });
        expect(cells).toBeGreaterThan(40000);
    });

    test('décors fixes : mêmes piliers et rochers, dans le même ordre qu\'avant', () => {
        screens.forEach(s => {
            const pillars = new Set((s.pillars || []).map(([px, py]) => `${px},${py}`));
            const expected = [];
            for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) {
                if (pillars.has(`${x},${y}`)) { expected.push({ depth: y, kind: 'pillar', x, y }); continue; }
                if (inRects(s.obstacles, x, y) && !inBuilding(s, x, y)) expected.push({ depth: y, kind: 'block', x, y });
            }
            expect(gridsOf(s).blocks).toEqual(expected);
        });
    });

    test('cache : même objet tant que l\'écran ne change pas, reconstruit si un tableau est remplacé', () => {
        const s = { w: 4, h: 3, obstacles: [[1, 1, 1, 1]], liquids: [[0, 0, 2, 1]], pillars: [], buildings: [] };
        const a = gridsOf(s);
        expect(gridsOf(s)).toBe(a);
        expect(a.obst[1 * 4 + 1]).toBe(1);
        s.obstacles = [[2, 2, 1, 1]];
        const b = gridsOf(s);
        expect(b).not.toBe(a);
        expect(b.obst[1 * 4 + 1]).toBe(0);
        expect(b.obst[2 * 4 + 2]).toBe(1);
    });

    test('rectGrid : les rectangles débordant de la carte sont tronqués', () => {
        const grid = rectGrid({ w: 3, h: 2 }, [[-1, -1, 3, 2], [2, 1, 5, 5]]);
        expect(Array.from(grid)).toEqual([1, 1, 0, 0, 0, 1]);
    });
});

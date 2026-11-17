// Zones sauvages : moins d'amas d'obstacles décoratifs, plus de hautes herbes (world/wildGrass.js).
import { SCREENS } from '../../story.js';
import { thickenGrass, isThickenable } from '../../world/wildGrass.js';
import { LOW_DECOR } from '../../decor.js';

const count = rects => (rects || []).reduce((n, [, , w, h]) => n + w * h, 0);

describe('hautes herbes épaissies', () => {
    test('les zones sauvages ont des herbes en nombre, et l\'opération est idempotente', () => {
        const wilds = Object.values(SCREENS).filter(isThickenable);
        expect(wilds.length).toBeGreaterThan(5);
        wilds.forEach(s => {
            const before = JSON.stringify([s.obstacles, s.grass.cells]);
            thickenGrass(s);
            expect(count(s.grass.cells)).toBeGreaterThan(0);
            expect(JSON.stringify([s.obstacles, s.grass.cells])).toBe(before);
        });
    });

    test('un amas isolé disparaît au profit de l\'herbe, un mur de bordure reste', () => {
        const s = { kind: 'wild', w: 30, h: 24, biome: 'paddy', spawn: { x: 3, y: 3 }, npcs: [], chests: [], enemies: [], exits: [],
            obstacles: [[0, 0, 30, 1], [12, 10, 1, 1], [12, 11, 1, 1], [20, 14, 1, 1], [8, 16, 1, 1], [16, 8, 1, 1], [22, 18, 1, 1]], liquids: [], paths: [],
            grass: { cells: [[5, 5, 1, 1]], rate: 0.1, safeSteps: 3, table: [] } };
        thickenGrass(s);
        expect(count(s.obstacles)).toBeLessThan(30 + 6);
        expect(s.obstacles.some(([x, y, w]) => y === 0 && w === 30)).toBe(true);
        expect(count(s.grass.cells)).toBeGreaterThan(1);
    });

    test('l\'herbe sèche et les algues sont des décors bas franchissables', () => {
        ['drygrass', 'deadreed', 'seaweed', 'kelp'].forEach(d => expect(LOW_DECOR.has(d)).toBe(true));
    });
});

import { SCREENS } from '../../story.js';
import { STRUCTURES, BIOME_STRUCTURES, isStructureScreen } from '../../world/structures.js';
import { BIOME_ARCHI } from '../../sprites/biomeArchi.js';
import { BIOME_SVG } from '../../sprites/biomeSvg.js';
import { rectGrid } from '../../explorationGrids.js';

const key = (x, y) => `${x},${y}`;
const wild = Object.values(SCREENS).filter(isStructureScreen);
const withStructures = wild.filter(s => s.structures);

describe('structures de décor', () => {
    test('chaque structure a un sprite aux dimensions déclarées (jamais une seule case par défaut)', () => {
        Object.entries(STRUCTURES).forEach(([id, def]) => {
            if (BIOME_ARCHI[id]) expect([BIOME_ARCHI[id].w, BIOME_ARCHI[id].h]).toEqual([def.w, def.h]);
            else { expect(BIOME_SVG[id]).toBeTruthy(); expect([def.w, def.h]).toEqual([2, 1]); }
        });
    });

    test('chaque biome ne référence que des structures connues', () => {
        Object.values(BIOME_STRUCTURES).flat().forEach(id => expect(STRUCTURES[id]).toBeTruthy());
    });

    test('les zones sauvages des biomes reçoivent des structures', () => {
        expect(wild.length).toBeGreaterThan(15);
        expect(withStructures.length).toBeGreaterThan(wild.length * 0.8);
    });

    test('une structure reste dans la carte, hors bordure, sans en chevaucher une autre', () => {
        withStructures.forEach(s => {
            const seen = new Set();
            s.structures.forEach(st => {
                expect(st.x).toBeGreaterThanOrEqual(2); expect(st.y).toBeGreaterThanOrEqual(2);
                expect(st.x + st.w).toBeLessThanOrEqual(s.w - 2); expect(st.y + st.h).toBeLessThanOrEqual(s.h - 2);
                expect(BIOME_STRUCTURES[s.biome]).toContain(st.id);
                for (let i = 0; i < st.w; i++) for (let j = 0; j < st.h; j++) { const k = key(st.x + i, st.y + j); expect(seen.has(k)).toBe(false); seen.add(k); }
            });
        });
    });

    test('une structure pleine est un obstacle, un pont enjambe des cases praticables', () => {
        withStructures.forEach(s => {
            const obst = rectGrid(s, s.obstacles), liq = rectGrid(s, s.liquids);
            s.structures.forEach(st => {
                for (let i = 0; i < st.w; i++) for (let j = 0; j < st.h; j++) {
                    const c = (st.y + j) * s.w + st.x + i;
                    if (st.cross) { expect(liq[c]).toBe(0); expect(obst[c]).toBe(0); } else expect(obst[c]).toBe(1);
                }
            });
        });
    });

    test('aucune structure ne coupe la carte : tout ce qui était atteignable à pied sans elles le reste avec', () => {
        const reach = (s, withStructures) => {
            const obst = rectGrid(s, s.obstacles), liq = rectGrid(s, s.liquids);
            if (!withStructures) s.structures.forEach(st => {
                for (let i = 0; i < st.w; i++) for (let j = 0; j < st.h; j++) { const c = (st.y + j) * s.w + st.x + i; if (st.cross) liq[c] = 1; else obst[c] = 0; }
            });
            const solid = new Set([...(s.npcs || []), ...(s.chests || []), ...(s.enemies || []), ...(s.exits || [])].map(e => key(e.x, e.y)));
            const seen = new Set([key(s.spawn.x, s.spawn.y)]), queue = [s.spawn];
            while (queue.length) {
                const p = queue.shift();
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const x = p.x + dx, y = p.y + dy, k = key(x, y);
                    if (x < 0 || y < 0 || x >= s.w || y >= s.h || seen.has(k) || obst[y * s.w + x] || liq[y * s.w + x]) continue;
                    seen.add(k);
                    if (!solid.has(k)) queue.push({ x, y });
                }
            }
            return seen;
        };
        withStructures.forEach(s => {
            const base = reach(s, false), now = reach(s, true);
            const inStructure = k => s.structures.some(st => { const [x, y] = k.split(',').map(Number); return x >= st.x && x < st.x + st.w && y >= st.y && y < st.y + st.h; });
            const lost = [...base].filter(k => !now.has(k) && !inStructure(k));
            expect([s.id, lost]).toEqual([s.id, []]);
        });
    });
});

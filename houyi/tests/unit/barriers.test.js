import './fixtures/playerForge.js';   // installe le stub XHR avant le chargement de story.js
import { describe, test, expect } from '@jest/globals';
import { addBorderBarriers, openRim, WATER_BIOMES } from '../../world/barriers.js';
import { applyConnections } from '../../mapConnections.js';
import { isTerrainBlocked } from '../../exploration.js';

const mk = (id, biome, extra = {}) => ({
    id, biome, w: 10, h: 8, obstacles: [], liquids: [], npcs: [], chests: [], enemies: [], exits: [], spawn: { x: 5, y: 4 }, ...extra
});
const run = (screens, list) => addBorderBarriers(applyConnections(screens, list));

describe('barrières de bordure', () => {
    test('côtés sans connexion fermés ; passage ouvert gardé libre', () => {
        const screens = { a: mk('a', 'gobi'), b: mk('b', 'gobi') };
        run(screens, [{ from: 'a', dir: 'east', to: 'b', range: [3, 5] }]);
        const a = screens.a;
        for (let x = 0; x < 10; x++) { expect(isTerrainBlocked(a, x, 0)).toBe(true); expect(isTerrainBlocked(a, x, 7)).toBe(true); }
        for (let y = 0; y < 8; y++) expect(isTerrainBlocked(a, 0, y)).toBe(true);
        [3, 4, 5].forEach(y => expect(isTerrainBlocked(a, 9, y)).toBe(false));
        [1, 2, 6, 7].forEach(y => expect(isTerrainBlocked(a, 9, y)).toBe(true));
        expect(a.liquids).toEqual([]);   // désert : obstacle, pas d'eau
    });

    test('biome d\'eau : eau (franchissable seulement avec le Pas de Yu)', () => {
        const screens = { a: mk('a', 'coast'), b: mk('b', 'coast') };
        run(screens, [{ from: 'a', dir: 'east', to: 'b' }]);
        expect(WATER_BIOMES.has('coast')).toBe(true);
        expect(isTerrainBlocked(screens.a, 0, 3)).toBe(true);
        expect(isTerrainBlocked(screens.a, 0, 3, true)).toBe(false);
    });

    test('jamais sur une entité, l\'apparition ni au prix d\'une case devenue inaccessible', () => {
        const screens = { a: mk('a', 'gobi', { spawn: { x: 0, y: 4 }, chests: [{ id: 'c', x: 0, y: 2 }], obstacles: [[1, 0, 9, 8]] }), b: mk('b', 'gobi') };
        run(screens, []);
        expect(isTerrainBlocked(screens.a, 0, 2)).toBe(false);   // coffre de bord conservé
        expect(isTerrainBlocked(screens.a, 0, 4)).toBe(false);   // apparition conservée
        expect(isTerrainBlocked(screens.a, 0, 3)).toBe(false);   // fermer cette case couperait l'accès au coffre
    });

    test('intérieurs ignorés ; carte de mer : bordure rendue à l\'eau hors passage', () => {
        const screens = { h: mk('h', 'gobi', { interior: true }), m: mk('m', 'coast', { aquatic: true }), n: mk('n', 'coast', { aquatic: true }) };
        applyConnections(screens, [{ from: 'm', dir: 'east', to: 'n', range: [3, 5] }]);
        addBorderBarriers(screens);
        expect(screens.h.obstacles).toEqual([]);
        const inL = (m, x, y) => m.liquids.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
        expect(inL(screens.m, 0, 3)).toBe(true);     // bordure fermée par l'eau
        expect(inL(screens.m, 9, 4)).toBe(false);    // passage ouvert
        expect(inL(screens.m, 9, 1)).toBe(true);
    });

    test('openRim : cases ouvertes des deux côtés d\'une connexion', () => {
        const screens = { a: mk('a', 'gobi'), b: mk('b', 'gobi') };
        applyConnections(screens, [{ from: 'a', dir: 'east', to: 'b', range: [3, 5] }]);
        expect([...openRim(screens, screens.a)].sort()).toEqual(['9,3', '9,4', '9,5']);
        expect([...openRim(screens, screens.b)].sort()).toEqual(['0,3', '0,4', '0,5']);
    });

    test('le monde réel : toute carte de plein air a une bordure fermée hors passages', async () => {
        const { SCREENS } = await import('../../story.js');
        Object.values(SCREENS).filter(s => !s.interior && !s.arena && !s.aquatic && s.kind !== 'house' && s.connections).forEach(s => {
            const open = openRim(SCREENS, s);
            let rim = 0, shut = 0;
            for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) {
                if (x && y && x < s.w - 1 && y < s.h - 1) continue;
                if (open.has(`${x},${y}`)) continue;
                rim++; if (isTerrainBlocked(s, x, y)) shut++;
            }
            if (rim) expect({ id: s.id, ok: shut / rim > 0.8 }).toEqual({ id: s.id, ok: true });
        });
    });
});

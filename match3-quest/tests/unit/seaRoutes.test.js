// Bordures de mer (world/connections.js) : le bord d'une carte mène au bord de la carte voisine sur la carte du monde. Ces bords sont de
// l'eau : on n'y passe qu'en marchant sur l'eau, avec le Pas de Yu, et une fois vaincu le gardien de la région la plus avancée.
import './fixtures/xhrFromDisk.js';
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { CONNECTIONS } from '../../world/connections.js';
import { createSession, teleportToScreen, tryMove, isTerrainBlocked, markEnemyDefeated } from '../../exploration.js';
import { overlapOf } from '../../mapConnections.js';

const seaEdges = CONNECTIONS.filter(c => c.sea);
const northward = seaEdges.filter(c => c.dir === 'north');
const regionOf = id => SCREENS[id].region;
const cols = s => [...Array(s.w).keys()];

describe('bordures de mer', () => {
    test("chaque carte des régions voisines fait face à une carte de l'autre région, dans les deux sens, sur toute la largeur commune", () => {
        expect(northward).toHaveLength(16);   // 4 paires de cartes x 4 liaisons
        expect(seaEdges).toHaveLength(32);
        northward.forEach(c => {
            const a = SCREENS[c.from], b = SCREENS[c.to];
            expect(regionOf(c.from)).not.toBe(regionOf(c.to));
            expect(a.connections.north).toMatchObject({ to: c.to, sea: true });
            expect(b.connections.south).toMatchObject({ to: c.from, sea: true });
            const [min, max] = overlapOf(a.connections.north, a, b);
            expect(max - min + 1).toBe(Math.min(a.w, b.w));
            expect(Object.values(SCREENS).some(sc => sc.enemies.some(e => e.id === c.requires))).toBe(true);   // gardien de la région la plus avancée
        });
    });

    test('Mer Orientale et Fusang : chaque carte de la Mer Orientale mène au Fusang, et chaque carte du Fusang à la Mer Orientale', () => {
        ['mer_road', 'mer_village', 'mer_wild', 'mer'].forEach(id => expect(regionOf(SCREENS[id].connections.north.to)).toBe('fusang'));
        ['fusang_road', 'fusang_village', 'fusang_hamlet', 'fusang'].forEach(id => expect(regionOf(SCREENS[id].connections.south.to)).toBe('mer'));
    });

    test("les Rizières n'ont pas de mer autour : une couronne d'arbres, et aucune bordure de mer (le Volcan non plus)", () => {
        Object.values(SCREENS).filter(s => s.region === 'rizieres' && !s.event && !s.interior && s.kind !== 'house' && s.connections && !/_(cave|crypt)$/.test(s.id)).forEach(s => {
            expect(s.treeBorder).toBe(true);
            for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) {
                if (Math.min(x, y, s.w - 1 - x, s.h - 1 - y) > 1) continue;
                expect({ id: s.id, x, y, eau: isTerrainBlocked(s, x, y) && !isTerrainBlocked(s, x, y, true) }).toEqual({ id: s.id, x, y, eau: false });
            }
        });
    });

    test("sept régions sont reliées par la mer ; jamais la Lune (seulement par Changxi), les Hautes-Eaux, les Rizières ni le Volcan", () => {
        const linked = new Set(seaEdges.flatMap(c => [regionOf(c.from), regionOf(c.to)]));
        ['gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang'].forEach(r => expect(linked.has(r)).toBe(true));
        ['lune', 'marees', 'rizieres', 'volcan'].forEach(r => expect(linked.has(r)).toBe(false));
    });

    test("les deux bords reliés sont de l'eau : infranchissables à pied, praticables avec le Pas de Yu (aucun couloir creusé)", () => {
        northward.forEach(c => {
            const a = SCREENS[c.from], b = SCREENS[c.to];
            expect(cols(a).filter(x => !isTerrainBlocked(a, x, 0))).toEqual([]);
            expect(cols(b).filter(x => !isTerrainBlocked(b, x, b.h - 1))).toEqual([]);
            expect(cols(a).filter(x => !isTerrainBlocked(a, x, 0, true)).length).toBeGreaterThan(a.w / 2);
            expect(cols(b).filter(x => !isTerrainBlocked(b, x, b.h - 1, true)).length).toBeGreaterThan(b.w / 2);
        });
    });

    test("avec le Pas de Yu, fermé tant que le gardien n'est pas vaincu, puis le bord nord mène au bord sud de la carte voisine, et inversement", () => {
        const s = createSession({});
        s.data.quests.sq_pas_de_yu = 'done';
        teleportToScreen(s, 'gobi_road');
        const b = SCREENS.fauves_road;
        s.data.x = 22; s.data.y = 0;
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'exitBlocked', reason: 'quest' });   // la Plaine des Fauves s'ouvre avec la défaite du soleil des Monts du Tonnerre
        expect(SCREENS.gobi_road.connections.north.requires).toBe('sun_5');
        markEnemyDefeated(s, 'sun_5');
        s.data.x = 22; s.data.y = 0;
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'transition', to: 'fauves_road' });
        expect(s.data.y).toBeGreaterThan(b.h - 5);
        s.data.y = b.h - 1;
        expect(tryMove(s, 0, 1)).toMatchObject({ type: 'transition', to: 'gobi_road' });
        expect(s.data.y).toBeLessThan(4);
    });
});

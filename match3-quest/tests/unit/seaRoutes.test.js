// Bordures de mer (world/connections.js) : le bord d'une carte mène au bord de la carte voisine sur la carte du monde. Ces bords sont de
// l'eau : on n'y passe qu'en marchant sur l'eau, avec le Pas de Yu.
import './fixtures/xhrFromDisk.js';
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { CONNECTIONS } from '../../world/connections.js';
import { createSession, teleportToScreen, tryMove, isTerrainBlocked, markEnemyDefeated } from '../../exploration.js';
import { overlapOf } from '../../mapConnections.js';

const seaEdges = CONNECTIONS.filter(c => c.sea);
const regionOf = id => SCREENS[id].region;
const cols = s => [...Array(s.w).keys()];

describe('bordures de mer', () => {
    test('cinq liaisons nord-sud entre régions différentes, dans les deux sens, sur toute la largeur commune', () => {
        expect(seaEdges).toHaveLength(10);   // une connexion explicite par sens
        seaEdges.filter(c => c.dir === 'north').forEach(c => {
            const a = SCREENS[c.from], b = SCREENS[c.to];
            expect(regionOf(c.from)).not.toBe(regionOf(c.to));
            expect(a.connections.north).toMatchObject({ to: c.to, sea: true });
            expect(b.connections.south).toMatchObject({ to: c.from, sea: true });
            const [min, max] = overlapOf(a.connections.north, a, b);
            expect(max - min + 1).toBe(Math.min(a.w, b.w));
            expect(Object.values(SCREENS).some(sc => sc.enemies.some(e => e.id === c.requires))).toBe(true);   // gardien de la région la plus avancée
        });
    });

    test("neuf régions sur onze sont reliées par la mer ; la Lune et les Hautes-Eaux jamais (la Lune ne s'atteint que par Changxi)", () => {
        const linked = new Set(seaEdges.flatMap(c => [regionOf(c.from), regionOf(c.to)]));
        ['rizieres', 'volcan', 'gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang'].forEach(r => expect(linked.has(r)).toBe(true));
        ['lune', 'marees'].forEach(r => expect(linked.has(r)).toBe(false));
    });

    test("les deux bords reliés sont de l'eau : infranchissables à pied, praticables avec le Pas de Yu (aucun couloir creusé)", () => {
        seaEdges.filter(c => c.dir === 'north').forEach(c => {   // bord nord de la carte du sud, bord sud de la carte du nord
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
        teleportToScreen(s, 'volcan_road');
        const b = SCREENS.mer_road;
        s.data.x = 22; s.data.y = 0;
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'exitBlocked', reason: 'quest' });   // la Mer Orientale s'ouvre avec la défaite du Soleil de la Plaine des Fauves
        expect(SCREENS.volcan_road.connections.north.requires).toBe('sun_7');
        markEnemyDefeated(s, 'sun_7');
        s.data.x = 22; s.data.y = 0;
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'transition', to: 'mer_road' });
        expect(s.data.y).toBeGreaterThan(b.h - 5);
        s.data.y = b.h - 1;
        expect(tryMove(s, 0, 1)).toMatchObject({ type: 'transition', to: 'volcan_road' });
        expect(s.data.y).toBeLessThan(4);
    });
});

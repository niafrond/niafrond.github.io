// Bordures de mer (world/connections.js) : le bord d'une carte mène au bord de la carte voisine sur la carte du monde. Ces bords sont de
// l'eau : on n'y passe qu'en marchant sur l'eau, avec le Pas de Yu.
import './fixtures/xhrFromDisk.js';
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { CONNECTIONS } from '../../world/connections.js';
import { createSession, teleportToScreen, tryMove, isTerrainBlocked } from '../../exploration.js';
import { overlapOf } from '../../mapConnections.js';

const seaEdges = CONNECTIONS.filter(c => c.sea);
const regionOf = id => SCREENS[id].region;

describe('bordures de mer', () => {
    test('six liaisons nord-sud entre régions différentes, dans les deux sens, sur toute la largeur commune', () => {
        expect(seaEdges).toHaveLength(6);
        seaEdges.forEach(c => {
            const a = SCREENS[c.from], b = SCREENS[c.to];
            expect(regionOf(c.from)).not.toBe(regionOf(c.to));
            expect(a.connections.north).toMatchObject({ to: c.to, sea: true });
            expect(b.connections.south).toMatchObject({ to: c.from, sea: true });
            const [min, max] = overlapOf(a.connections.north, a, b);
            expect(max - min + 1).toBe(Math.min(a.w, b.w));
            expect(c.requires).toBeUndefined();   // pas de passage aménagé : seule l'eau (le Pas de Yu) décide
        });
    });

    test('dix régions sur onze sont reliées par la mer à une région non voisine dans la chaîne', () => {
        const linked = new Set(seaEdges.flatMap(c => [regionOf(c.from), regionOf(c.to)]));
        ['rizieres', 'volcan', 'gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang', 'lune'].forEach(r => expect(linked.has(r)).toBe(true));
    });

    test('le bord reste de l\'eau : aucun couloir creusé', () => {
        seaEdges.forEach(c => {
            const a = SCREENS[c.from];
            const water = [...Array(a.w).keys()].filter(x => isTerrainBlocked(a, x, 0) && !isTerrainBlocked(a, x, 0, true));
            expect(water.length).toBeGreaterThan(a.w / 2);
        });
    });

    test('sans le Pas de Yu on ne passe pas ; avec, le bord nord mène au bord sud de la carte voisine, et inversement', () => {
        const s = createSession({});
        teleportToScreen(s, 'volcan_road');
        const a = SCREENS.volcan_road;
        const x = [...Array(a.w).keys()].find(x => !isTerrainBlocked(a, x, 0, true) && x > 2 && x < a.w - 3);
        s.data.x = x; s.data.y = 0;
        expect(tryMove(s, 0, -1).type).not.toBe('transition');   // l'arrivée est de l'eau : sans le Pas de Yu, impossible
        s.data.quests.sq_pas_de_yu = 'done';
        s.data.x = x; s.data.y = 0;
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'transition', to: 'mer_road' });
        const b = SCREENS.mer_road;
        expect(s.data.y).toBeGreaterThan(b.h - 5);
        s.data.y = b.h - 1;
        expect(tryMove(s, 0, 1)).toMatchObject({ type: 'transition', to: 'volcan_road' });
    });
});

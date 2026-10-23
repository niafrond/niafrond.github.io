// Routes maritimes (world/connections.js) : les régions voisines sur la carte du monde sont reliées par leurs bordures nord / sud ;
// on y passe avec le Pas de Yu, une fois ouverte la route officielle vers la région la plus avancée.
import './fixtures/xhrFromDisk.js';
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { CONNECTIONS } from '../../world/connections.js';
import { createSession, teleportToScreen, tryMove, markEnemyDefeated, isExitLocked } from '../../exploration.js';
import { connectionRows } from '../../mapConnections.js';

const seaRoutes = CONNECTIONS.filter(c => c.sea);
const regionOf = id => SCREENS[id].region;

describe('routes maritimes', () => {
    test('six routes, chacune dans les deux sens, passage de 3 cases entre deux cartes de régions différentes', () => {
        expect(seaRoutes).toHaveLength(12);
        seaRoutes.forEach(c => {
            expect(regionOf(c.from)).not.toBe(regionOf(c.to));
            expect(c.range[1] - c.range[0]).toBe(2);
            expect(seaRoutes.some(r => r.from === c.to && r.to === c.from)).toBe(true);
            expect(SCREENS[c.from].connections[c.dir]).toMatchObject({ to: c.to, sea: true });
        });
    });

    test('elles exigent le Pas de Yu et le gardien qui ouvre la route officielle vers la région la plus avancée', () => {
        seaRoutes.forEach(c => {
            expect(c.requires[0]).toBe('sq_pas_de_yu');
            expect(Object.values(SCREENS).some(s => s.enemies.some(e => e.id === c.requires[1]))).toBe(true);
            expect(c.lockedMessage).toContain('Pas de Yu');
        });
    });

    test('presque toutes les régions sont reliées à une région non voisine dans la chaîne (hors Hautes-Eaux, verrouillées par l\'eau)', () => {
        const linked = new Set(seaRoutes.flatMap(c => [regionOf(c.from), regionOf(c.to)]));
        ['rizieres', 'volcan', 'gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang', 'lune'].forEach(r => expect(linked.has(r)).toBe(true));
    });

    test('le passage reste fermé sans le Pas de Yu, puis sans le gardien, puis s\'ouvre dans les deux sens', () => {
        const s = createSession({});
        teleportToScreen(s, 'volcan_road');
        const exit = connectionRows(SCREENS, SCREENS.volcan_road).find(r => r.sea && r.span === 0);
        const stand = () => { s.data.x = exit.x; s.data.y = exit.y; };   // sur la case de bordure du passage : le pas suivant sort de la carte
        stand();
        expect(isExitLocked(s, exit)).toBe(true);
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'exitBlocked', reason: 'quest' });
        s.data.quests.sq_pas_de_yu = 'done';
        stand();
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'exitBlocked' });      // la route vers la Mer Orientale n'est pas encore ouverte
        markEnemyDefeated(s, 'sun_7');
        stand();
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'transition', to: 'mer_road' });
        const back = connectionRows(SCREENS, SCREENS.mer_road).find(r => r.sea && r.span === 0);
        s.data.x = back.x; s.data.y = back.y;
        expect(tryMove(s, 0, 1)).toMatchObject({ type: 'transition', to: 'volcan_road' });
    });
});

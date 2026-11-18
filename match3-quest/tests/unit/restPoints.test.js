import { createSession, tryMove, entityAt } from '../../exploration.js';
import { INN_HOUSES, restKindOf, REST_KINDS } from '../../explorationRest.js';

const session = createSession(null);

describe('points de récupération des PV', () => {
    test('au plus un point de repos par zone (pierre OU auberge OU fontaine)', () => {
        Object.values(session.screens).forEach(s => {
            const count = (s.waypoint ? 1 : 0) + (session.rest[s.id] ? 1 : 0);
            expect(count).toBeLessThanOrEqual(1);
        });
    });
    test('chaque région a une auberge, chaque route une fontaine', () => {
        Object.values(INN_HOUSES).forEach(id => { expect(session.rest[id]?.kind).toBe('inn'); });
        Object.values(session.screens).filter(s => s.kind === 'wild' && /_road$/.test(s.id)).forEach(s => {
            expect(session.rest[s.id]?.kind).toBe('fountain');
        });
    });
    test('le point est sur une case libre et franchissable alentour (jamais sur un obstacle ou une sortie)', () => {
        Object.entries(session.rest).forEach(([id, r]) => {
            const s = session.screens[id];
            expect(s.exits.some(e => e.x === r.x && e.y === r.y)).toBe(false);
            expect(s.npcs.some(n => n.x === r.x && n.y === r.y)).toBe(false);
            expect(s.chests.some(c => c.x === r.x && c.y === r.y)).toBe(false);
        });
    });
    test('le toucher renvoie un événement de repos', () => {
        const id = Object.keys(session.rest)[0];
        const r = session.rest[id];
        session.data.screenId = id;
        expect(entityAt(session, r.x, r.y)).toEqual({ type: 'rest', rest: r });
        expect(REST_KINDS[r.kind].message).toMatch(/PV/);
        expect(restKindOf({ id: 'x', waypoint: { x: 1, y: 1 } })).toBe('teleport');
    });
});

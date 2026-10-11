import { applyConnections, validateConnections, offsetOf, overlapOf, crossBorder, warpOf } from '../../mapConnections.js';
import { createSession, tryMove, currentScreen } from '../../exploration.js';
import { SCREENS } from '../../story.js';
import { CONNECTIONS } from '../../world/connections.js';

const mk = (id, w, h, extra = {}) => ({
    id, name: id, region: 'rizieres', w, h, obstacles: [], liquids: [], npcs: [], chests: [], enemies: [], exits: [], spawn: { x: 1, y: 1 }, ...extra
});
const world = () => ({ a: mk('a', 10, 8), b: mk('b', 6, 12), c: mk('c', 10, 8) });
const session = (screens, x, y, id = 'a') => {
    const s = createSession({ screenId: id, x, y }, screens, []);
    s.data.x = x; s.data.y = y;
    return s;
};

describe('connexions de bordure', () => {
    test('arrivée alignée avec décalage, direction et position relative conservées', () => {
        const screens = world();
        applyConnections(screens, [{ from: 'a', dir: 'east', to: 'b', offset: 2 }]);
        const s = session(screens, 9, 5);
        const res = tryMove(s, 1, 0);
        expect(res).toMatchObject({ type: 'transition', to: 'b', border: true, dir: 'east' });
        expect(s.data).toMatchObject({ screenId: 'b', x: 0, y: 3 });
        expect(s.rt.facing).toEqual({ dx: 1, dy: 0 });
    });

    test('connexion inverse déduite, aller-retour sans dérive et sans boucle', () => {
        const screens = world();
        applyConnections(screens, [{ from: 'a', dir: 'east', to: 'b', offset: 2 }]);
        const s = session(screens, 9, 5);
        tryMove(s, 1, 0);
        expect(tryMove(s, -1, 0)).toMatchObject({ type: 'transition', to: 'a', dir: 'west' });
        expect(s.data).toMatchObject({ screenId: 'a', x: 9, y: 5 });
        // Sur la bordure, un pas vers l'intérieur ne déclenche rien.
        expect(tryMove(s, 0, 1).type).toBe('moved');
    });

    test('sans connexion ou hors recouvrement : on ne sort pas', () => {
        const screens = world();
        applyConnections(screens, [{ from: 'a', dir: 'east', to: 'b', offset: 2 }]);
        expect(tryMove(session(screens, 0, 3), -1, 0).type).toBe('blocked');   // ouest : aucune connexion
        expect(tryMove(session(screens, 9, 1), 1, 0).type).toBe('blocked');    // y = 1 < décalage 2
        const s = session(screens, 9, 7);
        tryMove(s, 1, 0);
        expect(s.data).toMatchObject({ screenId: 'b', y: 5 });
    });

    test('alignement centré, nord / sud', () => {
        const screens = world();
        applyConnections(screens, [{ from: 'a', dir: 'north', to: 'c', align: 'center' }, { from: 'a', dir: 'south', to: 'b', align: 'center' }]);
        expect(offsetOf(screens.a.connections.south, screens.a, screens.b)).toBe(2);
        const s = session(screens, 4, 0);
        tryMove(s, 0, -1);
        expect(s.data).toMatchObject({ screenId: 'c', x: 4, y: 7 });
        const t = session(screens, 4, 7);
        tryMove(t, 0, 1);
        expect(t.data).toMatchObject({ screenId: 'b', x: 2, y: 0 });
    });

    test('case d\'arrivée bloquée : la plus proche case libre de la bordure', () => {
        const screens = world();
        screens.b.obstacles = [[0, 3, 1, 1]];
        screens.b.npcs = [{ id: 'n', x: 0, y: 4 }];
        applyConnections(screens, [{ from: 'a', dir: 'east', to: 'b', offset: 2 }]);
        const s = session(screens, 9, 5);   // arriverait en (0, 3) : mur ; (0, 4) occupé
        tryMove(s, 1, 0);
        expect(s.data).toMatchObject({ screenId: 'b', x: 0, y: 2 });
    });

    test('bordure d\'arrivée entièrement murée : repli vers l\'intérieur, sinon refus', () => {
        const screens = world();
        screens.b.obstacles = [[0, 0, 1, 12]];
        applyConnections(screens, [{ from: 'a', dir: 'east', to: 'b', offset: 2 }]);
        const s = session(screens, 9, 5);
        tryMove(s, 1, 0);
        expect(s.data).toMatchObject({ screenId: 'b', x: 1 });
        screens.b.obstacles = [[0, 0, 3, 12]];
        const t = session(screens, 9, 5);
        expect(tryMove(t, 1, 0).type).toBe('blocked');
        expect(t.data.screenId).toBe('a');
    });

    test('connexion verrouillée (requires) et sens unique', () => {
        const screens = world();
        applyConnections(screens, [{ from: 'a', dir: 'east', to: 'b', offset: 0, requires: { quest: 'x' }, lockedMessage: 'Fermé', oneWay: true }]);
        const s = session(screens, 9, 3);
        expect(tryMove(s, 1, 0)).toMatchObject({ type: 'exitBlocked', message: 'Fermé' });
        expect(screens.b.connections.west).toBeUndefined();
    });

    test('validation : carte inconnue, direction, recouvrement, doublons', () => {
        const screens = world();
        const bad = [
            { from: 'a', dir: 'east', to: 'zz' }, { from: 'a', dir: 'up', to: 'b' },
            { from: 'a', dir: 'east', to: 'b', offset: 20 }, { from: 'a', dir: 'east', to: 'c' }, { from: 'a', dir: 'east', to: 'b' }
        ];
        expect(validateConnections(screens, bad)).toHaveLength(5);
        expect(() => applyConnections(screens, bad)).toThrow();
        expect(overlapOf({ dir: 'east', offset: 2 }, screens.a, screens.b)).toEqual([2, 7]);
    });

    test('crossBorder pur et WarpTrigger', () => {
        const screens = world();
        applyConnections(screens, [{ from: 'a', dir: 'east', to: 'b' }]);
        expect(crossBorder(screens, screens.a, 9, 3, 1, 0, () => false)).toMatchObject({ to: 'b', x: 0, y: 3 });
        expect(crossBorder(screens, screens.a, 5, 3, 1, 0, () => false)).toMatchObject({ to: 'b' });
        expect(warpOf({ to: 'h', arrive: { x: 2, y: 3 }, door: true })).toEqual({ to: 'h', x: 2, y: 3, door: true });
        expect(warpOf({})).toBeNull();
    });

    test('les portes (exits) restent un système distinct', () => {
        const screens = world();
        screens.a.exits = [{ x: 5, y: 3, to: 'b', arrive: { x: 2, y: 2 }, door: true }];
        applyConnections(screens, []);
        const s = session(screens, 5, 4);
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'transition', door: true });
        expect(s.data).toMatchObject({ screenId: 'b', x: 2, y: 2 });
    });

    test('monde réel : connexions déclarées valides et posées sur chaque carte', () => {
        expect(validateConnections(SCREENS, CONNECTIONS)).toEqual([]);
        Object.values(SCREENS).filter(sc => !sc.arena).forEach(sc => expect(sc.connections).toBeDefined());
        expect(currentScreen(createSession(null)).connections).toBeDefined();
    });
});

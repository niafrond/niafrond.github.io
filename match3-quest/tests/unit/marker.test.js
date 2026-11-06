// Repère posé sur la carte plein écran (exploration.js setMarker / markerOf / clearMarker) : temporaire, par carte, effacé à l'arrivée.
import './fixtures/playerForge.js';
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { createSession, setMarker, clearMarker, markerOf, tryMove, isTerrainBlocked, teleportToScreen } from '../../exploration.js';

const s = SCREENS.fauves_wild;
const make = () => { const se = createSession({ screenId: s.id, x: s.spawn.x, y: s.spawn.y }, { [s.id]: s, rizieres_village: SCREENS.rizieres_village }, []); se.rt.grace = 99; return se; };
const free = (se, from) => { for (let d = 3; d < 20; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const x = from.x + dx, y = from.y + dy; if (!isTerrainBlocked(s, x, y)) return { x, y }; } };

describe('repère de la carte plein écran', () => {
    test('se pose sur une case libre, jamais sur un obstacle ni sous le héros, et se retire', () => {
        const se = make();
        expect(markerOf(se)).toBeNull();
        const spot = free(se, se.data);
        expect(setMarker(se, spot.x, spot.y)).toBe(true);
        expect(markerOf(se)).toMatchObject(spot);
        expect(setMarker(se, 0, 0)).toBe(false);                          // la bordure est fermée
        expect(setMarker(se, se.data.x, se.data.y)).toBe(false);          // sous les pieds du héros
        expect(markerOf(se)).toMatchObject(spot);                          // le précédent reste
        clearMarker(se);
        expect(markerOf(se)).toBeNull();
    });

    test('il disparaît à l\'arrivée dessus, et le pas qui l\'atteint le signale', () => {
        const se = make();
        const { x, y } = se.data;
        let target = null;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!isTerrainBlocked(s, x + dx, y + dy)) { target = { dx, dy }; break; }
        expect(setMarker(se, x + target.dx, y + target.dy)).toBe(true);
        const res = tryMove(se, target.dx, target.dy, { random: () => 0.999 });
        expect(res.type).toBe('moved');
        expect(res.markerReached).toBe(true);
        expect(markerOf(se)).toBeNull();
    });

    test('il appartient à sa carte : invisible ailleurs, retrouvé au retour, jamais sauvegardé', () => {
        const se = make();
        const spot = free(se, se.data);
        setMarker(se, spot.x, spot.y);
        teleportToScreen(se, 'rizieres_village');
        expect(markerOf(se)).toBeNull();
        teleportToScreen(se, s.id);
        expect(markerOf(se)).toMatchObject(spot);
        expect(JSON.stringify(se.data)).not.toContain('marker');
    });
});

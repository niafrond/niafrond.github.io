import { SCREENS } from '../../story.js';
import { createSession, visibleNpcs, enterScreen } from '../../exploration.js';
import { stepVillageLife } from '../../villageLife.js';

const village = Object.values(SCREENS).find(s => s.kind === 'village' && s.npcs.some(n => !n.merchant && !n.span));

describe('vie des villages', () => {
    test('les PNJ se promènent près de chez eux sans modifier la carte', () => {
        const session = createSession({ screenId: village.id, x: village.spawn.x, y: village.spawn.y });
        const before = village.npcs.map(n => [n.id, n.x, n.y]);
        const start = new Map(visibleNpcs(session).map(n => [n.id, `${n.x},${n.y}`]));
        let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 400; i++) stepVillageLife(session, 1000, rng);
        const after = visibleNpcs(session);
        expect(after.some(n => start.get(n.id) !== `${n.x},${n.y}`)).toBe(true);
        expect(village.npcs.map(n => [n.id, n.x, n.y])).toEqual(before);
        const pos = new Set();
        after.forEach(n => { const k = `${n.x},${n.y}`; expect(pos.has(k)).toBe(false); pos.add(k); expect(`${n.x},${n.y}` === `${session.data.x},${session.data.y}`).toBe(false); });
        after.filter(n => n.wanders).forEach(n => expect(Math.hypot(n.x - n.hx, n.y - n.hy)).toBeLessThanOrEqual(3));
    });
    test('les marchands restent à leur poste', () => {
        const session = createSession({ screenId: village.id, x: village.spawn.x, y: village.spawn.y });
        stepVillageLife(session, 5000);
        visibleNpcs(session).filter(n => n.merchant).forEach(n => expect(n.wanders).toBeFalsy());
    });
});

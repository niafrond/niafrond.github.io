import { buildLegacyWorld } from '../../story.js';
import { createSession, tryMove, setStealth, aliveEnemies, isTerrainBlocked } from '../../exploration.js';
import { allStuff, hasStealth, equipStuff, grantStuff, describeStuff, lootableStuff } from '../../stuff.js';
import { REGION_ORDER } from '../../world/index.js';
import { QUESTS } from '../../story.js';

const LEGACY = buildLegacyWorld();

// Un ennemi normal (ni boss) et une case libre voisine de sa zone de vigilance, à un pas de l'aura.
function setup() {
    for (const screen of Object.values(LEGACY.screens)) {
        for (const def of screen.enemies || []) {
            if (def.boss || def.guardsDoor || def.kind === 'patrol') continue;
            const probe = createSession({ screenId: screen.id, x: 0, y: 0 }, LEGACY.screens, LEGACY.quests);
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                const ax = def.x + dx, ay = def.y + dy;      // case d'aura, collée à l'ennemi
                const sx = def.x + 2 * dx, sy = def.y + 2 * dy;   // case de départ, hors aura
                if ([[ax, ay], [sx, sy]].some(([x, y]) => x < 0 || y < 0 || x >= screen.w || y >= screen.h || isTerrainBlocked(screen, x, y))) continue;
                if (aliveEnemies(probe).some(e => e.def.id !== def.id && Math.abs(e.x - ax) <= 2 && Math.abs(e.y - ay) <= 2)) continue;
                const s2 = createSession({ screenId: screen.id, x: sx, y: sy }, LEGACY.screens, LEGACY.quests);
                s2.rt.grace = 0;
                const res = tryMove(s2, -dx, -dy);
                if (res.type === 'combat' && res.enemyId === def.id) return { screen, def, from: { x: sx, y: sy }, step: { dx: -dx, dy: -dy } };
            }
        }
    }
    throw new Error('aucune case de test');
}

describe("collier d'ombre : indétectable, évite les combats (sauf boss)", () => {
    const t = setup();
    const walk = stealth => {
        const s = createSession({ screenId: t.screen.id, x: t.from.x, y: t.from.y }, LEGACY.screens, LEGACY.quests);
        s.rt.grace = 0;
        setStealth(s, stealth);
        return tryMove(s, t.step.dx, t.step.dy);
    };
    test("sans collier, entrer dans l'aura déclenche le combat", () => {
        expect(walk(false)).toEqual({ type: 'combat', enemyId: t.def.id });
    });
    test("avec le collier, l'ennemi ne détecte pas le héros", () => {
        expect(walk(true)).toEqual({ type: 'moved' });
    });
    test("le collier se gagne à l'avant-dernier biome (Fusang), n'est ni en vente ni en butin, et s'équipe", () => {
        const collar = allStuff.find(s => s.stealth);
        expect(collar.slot).toBe('neck');
        expect(collar.quest).toBe(true);
        expect(lootableStuff()).not.toContain(collar);
        expect(REGION_ORDER[REGION_ORDER.length - 2]).toBe('fusang');
        const quest = QUESTS.sq_collar_fusang || (Array.isArray(QUESTS) ? QUESTS.find(q => q.id === 'sq_collar_fusang') : null);
        expect(quest.reward.stuff).toBe(collar.id);
        const hero = { stuff: null, stuffOwned: [], maxHp: 50, hp: 50, level: 40 };
        expect(hasStealth(hero)).toBe(false);
        grantStuff(hero, collar.id);
        expect(equipStuff(hero, collar.id).ok).toBe(true);
        expect(hasStealth(hero)).toBe(true);
        expect(describeStuff(collar)).toContain('Indétectable');
    });
});

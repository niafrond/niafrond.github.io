import { buildLegacyWorld } from '../../story.js';
import { createSession, tryMove, setStealth, aliveEnemies, isTerrainBlocked } from '../../exploration.js';
import { allStuff, hasStealth } from '../../stuff.js';
import { allItems, lootableItems, SHADOW_RELIC_ID, equipRelic, unequipRelic, migrateShadowCollar } from '../../items.js';
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
    test("le voile d'ombre est une relique de quête (Fusang), ni en vente ni en butin, qui rend indétectable une fois portée", () => {
        const relic = allItems.find(i => i.id === SHADOW_RELIC_ID);
        expect(relic).toMatchObject({ type: 'artifact', quest: true });
        expect(lootableItems).not.toContain(relic);
        expect(allStuff.some(s => s.stealth)).toBe(false);   // plus de collier
        expect(REGION_ORDER[REGION_ORDER.length - 3]).toBe('fusang');   // les Hautes-Eaux s'intercalent avant la Lune
        const quest = QUESTS.sq_collar_fusang || (Array.isArray(QUESTS) ? QUESTS.find(q => q.id === 'sq_collar_fusang') : null);
        expect(quest.reward.relic).toBe(relic.id);
        expect(quest.reward.stuff).toBeUndefined();
        const hero = { level: 40, maxHp: 100, hp: 100, attack: 5, defense: 0, maxMana: 10, inventory: [{ ...relic, applied: false }] };
        expect(hasStealth(hero)).toBe(false);          // dans le sac, pas portée
        expect(equipRelic(hero, hero.inventory[0]).ok).toBe(true);
        expect(hasStealth(hero)).toBe(true);
        expect(hero.maxHp).toBe(130);
        unequipRelic(hero, hero.inventory[0]);
        expect(hasStealth(hero)).toBe(false);
        expect(hero.maxHp).toBe(100);
    });
});

describe("sauvegarde ancienne : le collier du voile d'ombre devient la relique", () => {
    test('collier porté : retiré avec ses PV max, relique rendue ; sans collier : rien', () => {
        const hero = { maxHp: 130, hp: 130, stuffOwned: ['collier_voile_d_ombre', 'collier_obsidienne'], stuff: { neck: 'collier_voile_d_ombre' }, inventory: [] };
        expect(migrateShadowCollar(hero)).toBe(true);
        expect(hero.stuffOwned).toEqual(['collier_obsidienne']);
        expect(hero.stuff.neck).toBeNull();
        expect(hero.maxHp).toBe(100);
        expect(hero.inventory.map(i => i.id)).toEqual([SHADOW_RELIC_ID]);
        expect(migrateShadowCollar(hero)).toBe(false);   // une seule fois
        expect(migrateShadowCollar({ stuffOwned: [], inventory: [] })).toBe(false);
    });
});

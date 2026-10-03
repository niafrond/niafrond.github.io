// Grand Monde : villages, zones sauvages, maisons, pierres de voyage, quêtes annexes (world/ + exploration.js).
import { readFileSync } from 'fs';
import { SCREENS, QUESTS, REGION_ENTRY_SCREEN } from '../../story.js';
import { REGION_ORDER } from '../../world/index.js';
import { MAPS } from '../../world/maps/index.js';
import { TEXTS } from '../../world/text/index.js';
import { MANIFEST } from '../../world/manifest.js';
import { parseGrid, cellsToRects } from '../../world/mapKit.js';
import { npcSprite } from '../../sprites/index.js';
import { villagerSprite } from '../../sprites/villagers.js';
import {
    createSession, tryMove, enterScreen, isTerrainBlocked, findPath, talkToNpc, openChest, markEnemyDefeated,
    questStatus, checkAutoQuests, activateWaypoint, waypointList, fastTravel, setTrackedQuest, trackedQuest,
    trackedMarkers, currentObjectiveText, journalEntries, regionProgress, npcMarker, progressReached, aliveEnemies
} from '../../exploration.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
const screens = Object.values(SCREENS);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function reach(screen, from, blocked = () => false) {
    const seen = new Set([`${from.x},${from.y}`]);
    const queue = [from];
    while (queue.length) {
        const { x, y } = queue.shift();
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
            if (seen.has(key) || isTerrainBlocked(screen, nx, ny) || blocked(nx, ny)) continue;
            seen.add(key);
            queue.push({ x: nx, y: ny });
        }
    }
    return seen;
}
const entitiesOf = s => [
    ...s.npcs.map(e => ({ kind: 'npc', id: e.id, x: e.x, y: e.y })),
    ...s.chests.map(e => ({ kind: 'chest', id: e.id, x: e.x, y: e.y })),
    ...s.enemies.map(e => ({ kind: 'enemy', id: e.id, x: e.x, y: e.y })),
    ...(s.waypoint ? [{ kind: 'waypoint', id: s.id, x: s.waypoint.x, y: s.waypoint.y }] : [])
];
// Une entité (PNJ, coffre, ennemi, pierre) bloque le passage : on l'atteint depuis une tuile voisine libre.
const adjacentReached = (seen, e) => DIRS.some(([dx, dy]) => seen.has(`${e.x + dx},${e.y + dy}`));
const exitPos = s => new Set(s.exits.map(e => `${e.x},${e.y}`));

describe('mapKit', () => {
    test('parseGrid : obstacles, liquides, chemins, ancres, bâtiments', () => {
        const g = parseGrid([
            '#####',
            '#S.1#',
            '#AAA#',
            '#AaA#',
            '#~=.#'
        ]);
        expect(g.w).toBe(5);
        expect(g.h).toBe(5);
        expect(g.spawn).toEqual({ x: 1, y: 1 });
        expect(g.anchors['1']).toEqual({ x: 3, y: 1 });
        expect(g.buildings).toEqual([{ id: 'A', x: 1, y: 2, w: 3, h: 2, door: { x: 2, y: 3 } }]);
        const blocked = (x, y) => g.obstacles.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
        expect(blocked(2, 3)).toBe(false);  // la porte est franchissable
        expect(blocked(1, 3)).toBe(true);
        expect(g.liquids).toEqual([[1, 4, 1, 1]]);
        expect(g.paths).toEqual([[2, 4, 1, 1]]);
    });

    test('parseGrid rejette les grilles invalides', () => {
        expect(() => parseGrid(['##', '#'])).toThrow(/longueur/);
        expect(() => parseGrid(['#?'])).toThrow(/inconnu/);
        expect(() => parseGrid(['AA', 'AA'])).toThrow(/porte/);
        expect(() => parseGrid(['A.', 'Aa'])).toThrow(/rectangle/);
    });

    test('cellsToRects fusionne les cases en rectangles', () => {
        expect(cellsToRects([[0, 0], [1, 0], [0, 1], [1, 1], [3, 0]])).toEqual([[0, 0, 2, 2], [3, 0, 1, 1]]);
    });
});

describe('villageois générés', () => {
    test('déterministes, bien formés et distincts', () => {
        const a = villagerSprite('ping');
        expect(villagerSprite('ping')).toBe(a);
        expect(a.startsWith('<svg')).toBe(true);
        expect(a.endsWith('</svg>')).toBe(true);
        expect(a).not.toMatch(/<text|<image|<script|href=/);
        expect(a.length).toBeLessThan(9000);
        const set = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => villagerSprite(id)));
        expect(set.size).toBeGreaterThan(5);
        expect(villagerSprite('x', '👴')).not.toBe(villagerSprite('x', ''));
    });
    test('npcSprite retombe sur un villageois pour un PNJ inconnu', () => {
        expect(npcSprite('inconnu_pnj')).toBeTruthy();
    });
});

describe('Grand Monde : cartes', () => {
    test('chaque région a un village, une zone sauvage et des maisons ; un hameau sauf lune', () => {
        REGION_ORDER.forEach(region => {
            expect(Boolean(SCREENS[`${region}_hamlet`])).toBe(region !== 'lune');
            expect(SCREENS[`${region}_village`]).toBeTruthy();
            expect(SCREENS[`${region}_wild`]).toBeTruthy();
            expect(screens.filter(s => s.region === region && s.interior).length).toBeGreaterThanOrEqual(region === 'lune' ? 3 : 6);
            expect(REGION_ENTRY_SCREEN[region]).toBe(`${region}_village`);
        });
    });

    test('villages plein écran (20x13, lune 16x11), wild 18x12, intérieurs petits', () => {
        screens.forEach(s => {
            if (s.kind === 'village') expect([s.w, s.h]).toEqual(s.id.endsWith('_hamlet') || s.region === 'lune' ? [16, 11] : [20, 13]);
            if (s.kind === 'wild') expect([s.w, s.h]).toEqual([18, 12]);
            if (s.id.endsWith('_hamlet')) expect(s.exits.some(e => e.to === `${s.region}_wild`)).toBe(true);
            if (s.interior) { expect(s.w).toBeLessThanOrEqual(12); expect(s.h).toBeLessThanOrEqual(8); }
        });
    });

    test('entités sur des tuiles libres et distinctes', () => {
        screens.forEach(s => {
            const seen = new Set();
            [...entitiesOf(s), ...s.exits.map(e => ({ kind: 'exit', id: e.to, x: e.x, y: e.y }))].forEach(e => {
                const key = `${e.x},${e.y}`;
                expect(`${s.id} ${e.kind}:${e.id} ${isTerrainBlocked(s, e.x, e.y)}`).toBe(`${s.id} ${e.kind}:${e.id} false`);
                expect(`${s.id} ${key} ${seen.has(key)}`).toBe(`${s.id} ${key} false`);
                seen.add(key);
            });
        });
    });

    test('tout est atteignable depuis l\'apparition (entités, sorties, pierre de voyage)', () => {
        screens.filter(s => s.kind).forEach(s => {
            const solid = new Set(entitiesOf(s).map(e => `${e.x},${e.y}`));
            const seen = reach(s, s.spawn, (x, y) => solid.has(`${x},${y}`) || exitPos(s).has(`${x},${y}`));
            entitiesOf(s).forEach(e => expect(`${s.id} ${e.kind}:${e.id} ${adjacentReached(seen, e)}`).toBe(`${s.id} ${e.kind}:${e.id} true`));
            s.exits.forEach(e => expect(`${s.id} exit:${e.to} ${adjacentReached(seen, e)}`).toBe(`${s.id} exit:${e.to} true`));
        });
    });

    test('sorties appariées et tuiles d\'arrivée libres', () => {
        screens.forEach(s => s.exits.forEach(e => {
            const target = SCREENS[e.to];
            expect(target).toBeTruthy();
            expect(target.exits.some(back => back.to === s.id)).toBe(true);
            expect(e.arrive).toBeTruthy();
            expect(isTerrainBlocked(target, e.arrive.x, e.arrive.y)).toBe(false);
            expect(entitiesOf(target).some(ent => ent.x === e.arrive.x && ent.y === e.arrive.y)).toBe(false);
            expect(target.exits.some(ex => ex.x === e.arrive.x && ex.y === e.arrive.y)).toBe(false);
        }));
    });

    test('chaîne du monde : sanctuaire précédent → village → wild → sanctuaire', () => {
        REGION_ORDER.forEach((region, i) => {
            const village = SCREENS[`${region}_village`], wild = SCREENS[`${region}_wild`], sanct = SCREENS[region];
            expect(village.exits.some(e => e.to === wild.id)).toBe(true);
            expect(wild.exits.some(e => e.to === village.id)).toBe(true);
            expect(wild.exits.some(e => e.to === region)).toBe(true);
            expect(sanct.exits.some(e => e.to === wild.id)).toBe(true);
            if (i > 0) {
                expect(village.exits.some(e => e.to === REGION_ORDER[i - 1])).toBe(true);
                expect(SCREENS[REGION_ORDER[i - 1]].exits.some(e => e.to === village.id)).toBe(true);
            }
            // pas d'ennemi dans les villages et maisons
            screens.filter(s => s.region === region && (s.kind === 'village' || s.interior)).forEach(s => expect(s.enemies).toHaveLength(0));
        });
    });

    test('wild : 5 à 9 ennemis (≥ 2 patrouilleurs), gabarits connus, pas près de l\'entrée', () => {
        REGION_ORDER.forEach(region => {
            const wild = SCREENS[`${region}_wild`];
            expect(wild.enemies.length).toBeGreaterThanOrEqual(5);
            expect(wild.enemies.length).toBeLessThanOrEqual(10);
            expect(wild.enemies.filter(e => e.kind === 'patrol').length).toBeGreaterThanOrEqual(2);
            wild.enemies.forEach(e => {
                expect(templateIds.has(e.templateId)).toBe(true);
                const near = wild.exits.some(x => Math.max(Math.abs(x.x - e.x), Math.abs(x.y - e.y)) < 3) || Math.max(Math.abs(wild.spawn.x - e.x), Math.abs(wild.spawn.y - e.y)) < 3;
                expect(`${e.id} ${near}`).toBe(`${e.id} false`);
            });
        });
    });

    test('le gate de la wild est franchissable avant le sanctuaire', () => {
        REGION_ORDER.forEach(region => {
            const wild = SCREENS[`${region}_wild`];
            const exit = wild.exits.find(e => e.to === region);
            expect(exit.requires).toBeTruthy();
            const id = exit.requires;
            const isEnemy = screens.some(s => s.enemies.some(e => e.id === id));
            const isChest = screens.some(s => s.chests.some(c => c.id === id));
            const quest = QUESTS.find(q => q.id === id);
            expect(isEnemy || isChest || quest).toBeTruthy();
            const where = isEnemy ? screens.find(s => s.enemies.some(e => e.id === id)) : isChest ? screens.find(s => s.chests.some(c => c.id === id)) : null;
            if (where) expect(where.region === region && where.id !== region).toBe(true);
        });
    });
});

describe('Grand Monde : textes et quêtes', () => {
    const questIds = new Set(QUESTS.map(q => q.id));
    const npcIds = new Set(screens.flatMap(s => s.npcs.map(n => n.id)));
    const chestIds = new Set(screens.flatMap(s => s.chests.map(c => c.id)));
    const enemyIds = new Set(screens.flatMap(s => s.enemies.map(e => e.id)));
    const groups = new Set(screens.flatMap(s => s.enemies.map(e => e.group).filter(Boolean)));

    test('les PNJ ont un nom, un emoji et des répliques ; les coffres un libellé', () => {
        screens.forEach(s => {
            s.npcs.forEach(n => {
                expect(`${n.id} ${Boolean(n.name)}`).toBe(`${n.id} true`);
                expect(n.emoji).toBeTruthy();
                expect(n.idle?.length).toBeGreaterThan(0);
            });
            s.chests.forEach(c => expect(typeof c.gold === 'number' || c.gold === undefined).toBe(true));
            expect(s.name).not.toBe(s.id);
        });
    });

    test('ids uniques dans tout le jeu', () => {
        const all = screens.flatMap(s => [...s.npcs.map(n => n.id), ...s.chests.map(c => c.id), ...s.enemies.map(e => e.id)]);
        expect(new Set(all).size).toBe(all.length);
        expect(questIds.size).toBe(QUESTS.length);
    });

    test('toutes les quêtes sont complètes et leurs cibles existent', () => {
        QUESTS.forEach(q => {
            expect(q.title).toBeTruthy();
            expect(q.offer?.length).toBeGreaterThan(0);
            expect(q.complete?.length).toBeGreaterThan(0);
            expect(npcIds.has(q.giver)).toBe(true);
            if (q.turnIn) expect(npcIds.has(q.turnIn)).toBe(true);
            (q.requires || []).forEach(r => expect(questIds.has(r)).toBe(true));
            expect(q.objectives.length).toBeGreaterThan(0);
            q.objectives.forEach(o => {
                expect(o.text).toBeTruthy();
                if (o.type === 'kill') expect(enemyIds.has(o.target)).toBe(true);
                else if (o.type === 'killGroup') expect(groups.has(o.target)).toBe(true);
                else if (o.type === 'chest') expect(chestIds.has(o.target)).toBe(true);
                else if (o.type === 'talk') { expect(npcIds.has(o.target)).toBe(true); expect(o.lines?.length).toBeGreaterThan(0); }
                else if (o.type === 'visit') expect(SCREENS[o.target]).toBeTruthy();
                else throw new Error(`type d'objectif inconnu : ${o.type}`);
            });
        });
    });

    test('le manifeste est entièrement réalisé (PNJ, coffres, maisons, quêtes)', () => {
        Object.entries(MANIFEST).forEach(([region, m]) => {
            expect(SCREENS[m.village.id]).toBeTruthy();
            expect(SCREENS[m.wild.id]).toBeTruthy();
            m.houses.forEach(h => expect(`${h.id} ${Boolean(SCREENS[h.id])}`).toBe(`${h.id} true`));
            m.npcs.forEach(n => expect(`${n.id} ${npcIds.has(n.id)}`).toBe(`${n.id} true`));
            m.chests.forEach(c => expect(`${c.id} ${chestIds.has(c.id)}`).toBe(`${c.id} true`));
            m.enemies.forEach(e => expect(`${e.id} ${enemyIds.has(e.id)}`).toBe(`${e.id} true`));
            m.quests.forEach(q => expect(`${q.id} ${questIds.has(q.id)}`).toBe(`${q.id} true`));
        });
    });

    test('chaque quête rapporte de l\'XP (principale > annexe à région égale)', () => {
        QUESTS.forEach(q => expect(`${q.id} ${q.reward?.xp > 0}`).toBe(`${q.id} true`));
        const main = QUESTS.find(q => q.id === 'q_sun_1').reward.xp;
        const side = QUESTS.find(q => q.id === 'sq_rice_thief').reward.xp;
        expect(main).toBeGreaterThan(side);
    });

    test('nombre de quêtes annexes : au moins 125 (3 fois plus qu\'avant)', () => {
        expect(QUESTS.filter(q => q.side).length).toBeGreaterThanOrEqual(125);
        expect(screens.flatMap(s => s.chests).length).toBeGreaterThan(80);
    });

    test('aucune quête principale n\'exige une quête annexe', () => {
        QUESTS.filter(q => !q.side).forEach(q => (q.requires || []).forEach(r => expect(QUESTS.find(x => x.id === r).side).toBeFalsy()));
    });
});

describe('Grand Monde : jeu', () => {
    const fresh = () => createSession(null);

    test('la partie démarre dans le village de Hou Yi, pierre de voyage découverte', () => {
        const session = fresh();
        expect(session.data.screenId).toBe('rizieres_village');
        expect(session.data.waypoints).toContain('rizieres_village');
        expect(aliveEnemies(session)).toHaveLength(0);
    });

    test('anciennes sauvegardes : écran de sanctuaire toujours valide', () => {
        const session = createSession({ screenId: 'rizieres', x: SCREENS.rizieres.spawn.x, y: SCREENS.rizieres.spawn.y, quests: { q_sun_1: 'active' } });
        expect(session.data.screenId).toBe('rizieres');
        expect(session.data.waypoints).toEqual([]);
    });

    test('pierres de voyage : activation, liste, voyage rapide', () => {
        const session = fresh();
        expect(fastTravel(session, 'fleuve_village')).toBe(false);
        const stone = SCREENS.rizieres_wild.waypoint;
        expect(stone).toBeTruthy();
        expect(activateWaypoint(session, 'rizieres_wild')).toMatchObject({ isNew: true });
        expect(activateWaypoint(session, 'rizieres_wild')).toMatchObject({ isNew: false });
        expect(waypointList(session).map(w => w.screenId)).toEqual(['rizieres_village', 'rizieres_wild']);
        expect(fastTravel(session, 'rizieres_wild')).toBe(true);
        expect(session.data.screenId).toBe('rizieres_wild');
        expect(isTerrainBlocked(SCREENS.rizieres_wild, session.data.x, session.data.y)).toBe(false);
        expect(fastTravel(session, 'rizieres_village')).toBe(true);
    });

    test('toucher la pierre l\'active et ne la traverse pas', () => {
        const session = fresh();
        enterScreen(session, 'rizieres_wild', SCREENS.rizieres_wild.spawn);
        const stone = SCREENS.rizieres_wild.waypoint;
        const path = findPath(session, stone.x, stone.y);
        expect(path?.length).toBeGreaterThan(0);
        let res;
        session.rt.grace = 99;
        for (const step of path) res = tryMove(session, step.x - session.data.x, step.y - session.data.y);
        expect(res.type).toBe('waypoint');
        expect(session.data.waypoints).toContain('rizieres_wild');
    });

    test('entrer dans une maison par sa porte et en ressortir', () => {
        const session = fresh();
        const village = SCREENS.rizieres_village;
        const door = village.exits.find(e => e.door);
        expect(door).toBeTruthy();
        const house = SCREENS[door.to];
        expect(house.interior).toBe(true);
        enterScreen(session, village.id, door.arrive);
        const path = findPath(session, door.x, door.y);
        expect(path).not.toBeNull();
        let res;
        for (const step of path) res = tryMove(session, step.x - session.data.x, step.y - session.data.y);
        expect(res.type).toBe('transition');
        expect(res.door).toBe(true);
        expect(session.data.screenId).toBe(house.id);
        const out = house.exits[0];
        const back = findPath(session, out.x, out.y);
        for (const step of back) res = tryMove(session, step.x - session.data.x, step.y - session.data.y);
        expect(session.data.screenId).toBe(village.id);
        expect(session.data.y).toBe(door.y + 1);
    });

    test('quête de type « parler » : la réplique de la cible valide l\'objectif', () => {
        const quest = QUESTS.find(q => q.side && q.objectives.some(o => o.type === 'talk') && (q.requires || []).length === 0);
        expect(quest).toBeTruthy();
        const session = fresh();
        session.data.quests[quest.id] = 'active';
        const target = quest.objectives.find(o => o.type === 'talk').target;
        const scr = screens.find(s => s.npcs.some(n => n.id === target));
        enterScreen(session, scr.id, scr.spawn);
        expect(npcMarker(session, target)).toBe('❓');
        const res = talkToNpc(session, target);
        expect(res.lines).toEqual(expect.arrayContaining(quest.objectives.find(o => o.type === 'talk').lines));
        expect(session.data.talked).toContain(target);
        expect(res.events.some(e => e.type === 'objective')).toBe(true);
    });

    test('quête suivie : objectif du HUD, anneaux sur la carte, journal', () => {
        const session = fresh();
        const quest = QUESTS.find(q => q.side && (q.requires || []).length === 0 && q.objectives[0].type === 'kill' || q.objectives[0].type === 'chest');
        session.data.quests[quest.id] = 'active';
        expect(setTrackedQuest(session, quest.id)).toBe(quest.id);
        expect(trackedQuest(session).id).toBe(quest.id);
        expect(currentObjectiveText(session)).toContain(quest.title);
        const entry = journalEntries(session).find(e => e.quest.id === quest.id);
        expect(entry.tracked).toBe(true);
        expect(entry.where).toBeTruthy();
        expect(setTrackedQuest(session, 'n_importe_quoi')).toBeNull();
    });

    test('progression par région', () => {
        const session = fresh();
        const rows = regionProgress(session);
        expect(rows).toHaveLength(10);
        expect(rows[0]).toMatchObject({ region: 'rizieres', visited: true, stonesFound: 1 });
        expect(rows[0].chestsTotal).toBeGreaterThan(3);
    });
});

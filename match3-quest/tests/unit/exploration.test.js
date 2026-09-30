import { readFileSync } from 'fs';
import { SCREENS, QUESTS, REGION_UNLOCK_LEVEL, REGION_ENTRY_SCREEN } from '../../story.js';
import {
    createSession, tryMove, tick, isTerrainBlocked, buildRoute, aliveEnemies, entityAt, getAuraTiles,
    markEnemyDefeated, talkToNpc, npcAmbientLines, progressReached, openChest, questStatus, checkAutoQuests, currentObjectiveText,
    encounterFor, enemyLevel, enterScreen, teleportToScreen, resetAfterDefeat,
    AGGRO_RADIUS, PATROL_STEP_MS, GRACE_MOVES, START_SCREEN, findPath
} from '../../exploration.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
const screens = Object.values(SCREENS);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Tuiles où l'on ARRIVE sur cet écran (définies par la sortie de retour de chaque voisin).
const arrivals = s => Object.values(SCREENS).flatMap(o => o.exits.filter(e => e.to === s.id).map(e => e.arrive));

// Parcours en largeur sur les tuiles libres (terrain seul, ou en évitant `forbidden`).
function reachable(screen, from, forbidden = new Set()) {
    const seen = new Set([`${from.x},${from.y}`]);
    const queue = [from];
    while (queue.length) {
        const { x, y } = queue.shift();
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
            if (seen.has(key) || isTerrainBlocked(screen, nx, ny) || forbidden.has(key)) continue;
            seen.add(key);
            queue.push({ x: nx, y: ny });
        }
    }
    return seen;
}

function auraOfAll(screen) {
    const forbidden = new Set();
    const mark = (px, py) => {
        for (let dy = -AGGRO_RADIUS; dy <= AGGRO_RADIUS; dy++) {
            for (let dx = -AGGRO_RADIUS; dx <= AGGRO_RADIUS; dx++) forbidden.add(`${px + dx},${py + dy}`);
        }
    };
    screen.enemies.forEach(e => {
        if (e.kind === 'patrol') buildRoute(e.patrol).forEach(p => mark(p.x, p.y));
        else mark(e.x, e.y);
    });
    // marcher sur une sortie change d'écran avant tout contrôle de vigilance
    screen.exits.forEach(e => forbidden.delete(`${e.x},${e.y}`));
    screen.npcs.forEach(n => forbidden.add(`${n.x},${n.y}`));
    screen.chests.forEach(c => forbidden.add(`${c.x},${c.y}`));
    return forbidden;
}

describe('cartes (story.js)', () => {
    test.each(screens.map(s => [s.id, s]))('%s : dimensions, entités et sorties valides', (_id, s) => {
        expect(isTerrainBlocked(s, s.spawn.x, s.spawn.y)).toBe(false);
        const seenPos = new Set();
        const place = (kind, x, y) => {
            expect(isTerrainBlocked(s, x, y)).toBe(false);
            const key = `${x},${y}`;
            expect(seenPos.has(key)).toBe(false); // pas deux entités au même endroit
            seenPos.add(key);
        };
        s.npcs.forEach(n => place('npc', n.x, n.y));
        s.chests.forEach(c => place('chest', c.x, c.y));
        s.enemies.forEach(e => {
            place('enemy', e.x, e.y);
            expect(templateIds.has(e.templateId)).toBe(true);
            if (e.kind === 'patrol') {
                const route = buildRoute(e.patrol);
                expect(route[0]).toEqual({ x: e.x, y: e.y });
                route.forEach(p => expect(isTerrainBlocked(s, p.x, p.y)).toBe(false));
            }
        });
        s.exits.forEach(ex => {
            expect(isTerrainBlocked(s, ex.x, ex.y)).toBe(false);
            const onEdge = ex.x === 0 || ex.y === 0 || ex.x === s.w - 1 || ex.y === s.h - 1;
            expect(onEdge).toBe(true);
            const target = SCREENS[ex.to];
            expect(target).toBeDefined();
            expect(isTerrainBlocked(target, ex.arrive.x, ex.arrive.y)).toBe(false);
            // sortie de retour symétrique, et on n'arrive pas SUR la tuile de sortie (pas de ping-pong)
            const back = target.exits.find(e => e.to === s.id);
            expect(back).toBeDefined();
            expect(target.exits.some(e => e.x === ex.arrive.x && e.y === ex.arrive.y)).toBe(false);
        });
    });

    test.each(screens.map(s => [s.id, s]))('%s : toutes les entités et sorties sont atteignables à pied', (_id, s) => {
        const free = reachable(s, s.spawn);
        s.exits.forEach(ex => expect(free.has(`${ex.x},${ex.y}`)).toBe(true));
        arrivals(s).forEach(a => expect(free.has(`${a.x},${a.y}`)).toBe(true));
        const adjacentReachable = (x, y) => DIRS.some(([dx, dy]) => free.has(`${x + dx},${y + dy}`));
        s.npcs.forEach(n => expect(adjacentReachable(n.x, n.y)).toBe(true));
        s.chests.forEach(c => expect(adjacentReachable(c.x, c.y)).toBe(true));
    });

    test('le monde est connexe depuis le village', () => {
        const seen = new Set([START_SCREEN]);
        const queue = [START_SCREEN];
        while (queue.length) SCREENS[queue.shift()].exits.forEach(e => { if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); } });
        expect(seen.size).toBe(screens.length);
    });

    test('chaque région a un écran d\'entrée et un niveau requis', () => {
        Object.entries(REGION_ENTRY_SCREEN).forEach(([region, id]) => {
            expect(SCREENS[id].region).toBe(region);
            expect(REGION_UNLOCK_LEVEL[region]).toBeGreaterThanOrEqual(1);
        });
        screens.forEach(s => expect(REGION_UNLOCK_LEVEL[s.region]).toBeDefined());
    });

    // « On peut éviter un ennemi en faisant le tour » : entre les sorties d'un écran de passage,
    // il existe un chemin qui reste hors de toute zone de vigilance (patrouilles incluses).
    test.each(['forest', 'ruins', 'warcamp', 'desert', 'frozen'])('%s : on peut traverser sans croiser d\'ennemi', id => {
        const s = SCREENS[id];
        const forbidden = auraOfAll(s);
        const points = [...arrivals(s), ...s.exits.map(e => ({ x: e.x, y: e.y }))];
        points.forEach(from => {
            forbidden.delete(`${from.x},${from.y}`);
            const free = reachable(s, from, forbidden);
            s.exits.forEach(ex => expect(free.has(`${ex.x},${ex.y}`)).toBe(true));
        });
    });

    test('le coffre du désert est accessible en discrétion, sans combattre Solarion', () => {
        const s = SCREENS.desert;
        const chest = s.chests.find(c => c.id === 'sun_chest');
        const forbidden = auraOfAll(s);
        const approach = DIRS.map(([dx, dy]) => ({ x: chest.x + dx, y: chest.y + dy }))
            .filter(p => !isTerrainBlocked(s, p.x, p.y) && !forbidden.has(`${p.x},${p.y}`));
        expect(approach.length).toBeGreaterThan(0);
        const start = arrivals(s)[0];
        forbidden.delete(`${start.x},${start.y}`);
        const free = reachable(s, start, forbidden);
        expect(approach.some(p => free.has(`${p.x},${p.y}`))).toBe(true);
    });

    test('Aldric est bel et bien encerclé : impossible de l\'atteindre sans tuer les gardes', () => {
        const s = SCREENS.ruins;
        const aldric = s.npcs.find(n => n.id === 'aldric');
        const guards = s.enemies.filter(e => e.group === 'aldric_guards');
        expect(guards).toHaveLength(4);
        const blocked = new Set(guards.map(g => `${g.x},${g.y}`));
        const free = reachable(s, s.spawn, blocked);
        expect(DIRS.some(([dx, dy]) => free.has(`${aldric.x + dx},${aldric.y + dy}`))).toBe(false);
    });
});

describe('quêtes (story.js)', () => {
    const npcIds = new Set(screens.flatMap(s => s.npcs.map(n => n.id)));
    const enemyIds = new Set(screens.flatMap(s => s.enemies.map(e => e.id)));
    const groups = new Set(screens.flatMap(s => s.enemies.filter(e => e.group).map(e => e.group)));
    const chestIds = new Set(screens.flatMap(s => s.chests.map(c => c.id)));
    const questIds = new Set(QUESTS.map(q => q.id));

    test.each(QUESTS.map(q => [q.id, q]))('%s : références valides', (_id, q) => {
        if (q.giver) expect(npcIds.has(q.giver)).toBe(true);
        if (q.turnIn) expect(npcIds.has(q.turnIn)).toBe(true);
        if (!q.giver) expect(q.autoStart).toBe(true);
        q.requires.forEach(r => expect(questIds.has(r)).toBe(true));
        q.objectives.forEach(o => {
            const pool = o.type === 'kill' ? enemyIds : o.type === 'killGroup' ? groups : chestIds;
            expect(pool.has(o.target)).toBe(true);
        });
        // les objectifs de kill visent des ennemis d'histoire qui ne réapparaissent pas
        q.objectives.filter(o => o.type === 'kill').forEach(o => {
            const def = screens.flatMap(s => s.enemies).find(e => e.id === o.target);
            expect(def.permanent).toBe(true);
        });
    });
});

describe('déplacement et zones de vigilance', () => {
    const fresh = (patch = {}) => createSession({ ...patch });

    test('un nouveau joueur démarre au village', () => {
        const s = fresh();
        expect(s.data.screenId).toBe('village');
        expect(s.data.x).toBe(SCREENS.village.spawn.x);
    });

    test('un obstacle et le bord de la carte bloquent', () => {
        const s = fresh({ screenId: 'village', x: 2, y: 3 });
        expect(tryMove(s, 0, -1).type).toBe('blocked'); // maison en (2,2)
        const edge = fresh({ screenId: 'village', x: 0, y: 4 });
        expect(tryMove(edge, -1, 0).type).toBe('blocked');
    });

    test('marcher dans un PNJ ouvre le dialogue', () => {
        const s = fresh({ screenId: 'village', x: 5, y: 3 });
        expect(tryMove(s, 1, 0)).toEqual({ type: 'talk', npcId: 'maelle' });
        expect(s.data.x).toBe(5);
    });

    test('distance 1 = combat, distance 2 = pas de combat', () => {
        const s = fresh({ screenId: 'forest', x: 3, y: 4 });
        s.rt.grace = 0;
        // gobelin en (5,3) : (4,4) est à distance 1
        expect(tryMove(s, 1, 0)).toEqual({ type: 'combat', enemyId: 'forest_gob' });
        const far = fresh({ screenId: 'forest', x: 2, y: 4 });
        far.rt.grace = 0;
        expect(tryMove(far, 1, 0)).toEqual({ type: 'moved' }); // (3,4) : distance 2
    });

    test('percuter un ennemi lance le combat même en période de grâce', () => {
        const s = fresh({ screenId: 'forest', x: 4, y: 3 });
        s.rt.grace = 5;
        expect(tryMove(s, 1, 0)).toEqual({ type: 'combat', enemyId: 'forest_gob' });
    });

    test('la période de grâce ignore les zones de vigilance puis expire', () => {
        const s = fresh({ screenId: 'forest', x: 3, y: 4 });
        s.rt.grace = GRACE_MOVES;
        expect(tryMove(s, 1, 0)).toEqual({ type: 'moved' });
        expect(s.rt.grace).toBe(GRACE_MOVES - 1);
    });

    test('un ennemi vaincu disparaît, et les ennemis normaux reviennent à la ré-entrée mais pas les permanents', () => {
        const s = fresh({ screenId: 'forest', x: 1, y: 4 });
        markEnemyDefeated(s, 'forest_gob');
        expect(aliveEnemies(s).some(e => e.def.id === 'forest_gob')).toBe(false);
        enterScreen(s, 'village', { x: 12, y: 4 });
        enterScreen(s, 'forest', { x: 1, y: 4 });
        expect(aliveEnemies(s).some(e => e.def.id === 'forest_gob')).toBe(true);

        markEnemyDefeated(s, 'goblin_king');
        enterScreen(s, 'goblin_den', { x: 6, y: 8 });
        enterScreen(s, 'forest', { x: 6, y: 1 });
        enterScreen(s, 'goblin_den', { x: 6, y: 8 });
        expect(aliveEnemies(s).some(e => e.def.id === 'goblin_king')).toBe(false);
    });

    test('une sortie change d\'écran et arrive à la tuile prévue', () => {
        const s = fresh({ screenId: 'village', x: 12, y: 4 });
        expect(tryMove(s, 1, 0, { playerLevel: 1 })).toMatchObject({ type: 'transition', from: 'village', to: 'forest', firstVisit: true });
        expect(s.data.screenId).toBe('forest');
        expect([s.data.x, s.data.y]).toEqual([1, 4]);
    });

    test('une région est fermée tant que le niveau est insuffisant', () => {
        const s = fresh({ screenId: 'ruins', x: 12, y: 4 });
        const res = tryMove(s, 1, 0, { playerLevel: 3 });
        expect(res).toMatchObject({ type: 'exitBlocked', minLevel: 4 });
        expect(s.data.screenId).toBe('ruins');
        expect(tryMove(s, 1, 0, { playerLevel: 4 }).type).toBe('transition');
    });

    test('les patrouilleurs avancent le long de leur route et font demi-tour', () => {
        const s = fresh({ screenId: 'forest', x: 1, y: 4 });
        const def = SCREENS.forest.enemies.find(e => e.id === 'forest_priestess');
        const route = buildRoute(def.patrol);
        expect(route.length).toBe(10);
        tick(s, PATROL_STEP_MS);
        expect(s.rt.enemies.forest_priestess).toMatchObject({ x: 4, y: 9 });
        for (let i = 0; i < 20; i++) tick(s, PATROL_STEP_MS);
        const st = s.rt.enemies.forest_priestess;
        expect(st.x).toBeGreaterThanOrEqual(3);
        expect(st.x).toBeLessThanOrEqual(12);
    });

    test('un patrouilleur qui arrive au contact du joueur lance le combat', () => {
        const s = fresh({ screenId: 'forest', x: 5, y: 8 });
        s.rt.grace = 0;
        const events = tick(s, PATROL_STEP_MS * 3);
        expect(events.some(e => e.type === 'combat' && e.enemyId === 'forest_priestess')).toBe(true);
    });

    test('après une défaite, retour au point d\'entrée de l\'écran avec une période de grâce', () => {
        const s = fresh({ screenId: 'forest', x: 6, y: 3 });
        resetAfterDefeat(s);
        expect([s.data.x, s.data.y]).toEqual([1, 4]);
        expect(s.rt.grace).toBeGreaterThan(0);
    });

    test('teleportToScreen arrive au point d\'apparition', () => {
        const s = fresh();
        teleportToScreen(s, 'warcamp');
        expect([s.data.screenId, s.data.x, s.data.y]).toEqual(['warcamp', 1, 4]);
    });

    test('les zones de vigilance sont exposées pour l\'affichage', () => {
        const s = fresh({ screenId: 'forest', x: 1, y: 4 });
        const aura = getAuraTiles(s);
        expect(aura.has('5,3')).toBe(true);
        expect(aura.has('6,4')).toBe(true);
        expect(aura.has('7,3')).toBe(false);
    });

    test('la progression est sérialisable en JSON et se recharge', () => {
        const s = fresh({ screenId: 'forest', x: 1, y: 4 });
        markEnemyDefeated(s, 'goblin_king');
        const copy = createSession(JSON.parse(JSON.stringify(s.data)));
        expect(copy.data.defeated).toContain('goblin_king');
        expect(copy.data.screenId).toBe('forest');
    });

    test('une sauvegarde corrompue retombe sur le village', () => {
        const s = createSession({ screenId: 'nulle-part', x: 99, y: 99 });
        expect(s.data.screenId).toBe('village');
        const inWall = createSession({ screenId: 'village', x: 2, y: 2 });
        expect(inWall.data.screenId).toBe('village');
        expect(isTerrainBlocked(SCREENS.village, inWall.data.x, inWall.data.y)).toBe(false);
    });
});

describe('rencontres', () => {
    test('niveau des ennemis normaux : niveau du joueur -1 / 0 (jamais plus de +1), boss ≥ niveau du joueur', () => {
        const s = createSession({});
        const normal = { id: 'x', offset: 0 };
        const weak = { id: 'y', offset: -1 };
        expect(enemyLevel(normal, 5)).toBe(5);
        expect(enemyLevel(weak, 5)).toBe(4);
        expect(enemyLevel(weak, 1)).toBe(1);
        const gob = encounterFor(s, 'goblin_king', 1);
        expect(gob.boss.level).toBe(3);
        expect(encounterFor(s, 'goblin_king', 8).boss.level).toBe(8);
        expect(encounterFor(s, 'inconnu', 1)).toBeNull();
    });
});

describe('histoire complète', () => {
    test('déroulé de la quête principale du prologue à la fin', () => {
        const s = createSession({});
        expect(currentObjectiveText(s)).toContain('Maëlle');

        // Prologue : Maëlle propose la quête du Roi Gobelin
        let talk = talkToNpc(s, 'maelle');
        expect(talk.events[0]).toMatchObject({ type: 'questStarted' });
        expect(s.data.quests.goblin_king).toBe('active');
        // pas de suite tant que le roi n'est pas mort
        expect(talkToNpc(s, 'maelle').lines).toEqual(QUESTS[0].hint);

        markEnemyDefeated(s, 'goblin_king');
        expect(questStatus(s, QUESTS[0])).toBe('ready');
        expect(currentObjectiveText(s)).toContain('retournez voir Maëlle');
        talk = talkToNpc(s, 'maelle');
        expect(talk.events[0]).toMatchObject({ type: 'questCompleted', gold: 80 });
        expect(s.data.quests.goblin_king).toBe('done');

        // Chapitre II : sauver le sage encerclé
        talk = talkToNpc(s, 'maelle');
        expect(s.data.quests.sage_rescue).toBe('active');
        ['aldric_guard_n', 'aldric_guard_s', 'aldric_guard_w'].forEach(id => markEnemyDefeated(s, id));
        expect(questStatus(s, QUESTS[1])).toBe('active'); // il en reste un
        markEnemyDefeated(s, 'aldric_guard_e');
        expect(questStatus(s, QUESTS[1])).toBe('ready');
        s.data.screenId = 'ruins'; // Aldric se trouve dans les ruines
        talk = talkToNpc(s, 'aldric');
        expect(talk.events.map(e => e.type)).toEqual(['questCompleted', 'questStarted']); // le Chef de Guerre démarre tout seul
        expect(s.data.quests.warmaster).toBe('active');

        // Chapitre III : validation automatique à la mort du boss
        let events = markEnemyDefeated(s, 'gorm_kar');
        expect(events[0]).toMatchObject({ type: 'questCompleted', gold: 150 });

        // Chapitre IV : le coffre peut être ouvert sans combattre le gardien
        s.data.screenId = 'desert';
        talk = talkToNpc(s, 'tariq');
        expect(s.data.quests.sun_relic).toBe('active');
        const chest = openChest(s, 'sun_chest');
        expect(chest.gold).toBe(100);
        expect(chest.events.map(e => e.type)).toEqual(['chestOpened', 'questCompleted']);
        expect(openChest(s, 'sun_chest')).toBeNull();

        // Chapitre V : le dragon
        s.data.screenId = 'frozen';
        talkToNpc(s, 'ylva');
        markEnemyDefeated(s, 'frost_dragon');
        talk = talkToNpc(s, 'ylva');
        expect(talk.events.map(e => e.type)).toEqual(['questCompleted', 'questStarted']);

        // Chapitre VI : final
        expect(s.data.ended).toBe(false);
        events = markEnemyDefeated(s, 'void_lord');
        expect(events[0]).toMatchObject({ type: 'questCompleted' });
        expect(s.data.ended).toBe(true);
        expect(QUESTS.filter(q => !q.side).every(q => s.data.quests[q.id] === 'done')).toBe(true);
        expect(checkAutoQuests(s)).toEqual([]);
    });

    test('tuer le roi gobelin avant de parler à Maëlle valide quand même la quête à la remise', () => {
        const s = createSession({});
        markEnemyDefeated(s, 'goblin_king');
        talkToNpc(s, 'maelle'); // démarre la quête
        expect(questStatus(s, QUESTS[0])).toBe('ready');
        talkToNpc(s, 'maelle');
        expect(s.data.quests.goblin_king).toBe('done');
    });

    test('un PNJ sans quête raconte son dialogue habituel', () => {
        const s = createSession({ screenId: 'ruins' });
        const talk = talkToNpc(s, 'aldric'); // sa quête n'est pas encore active
        expect(talk.lines).toEqual(SCREENS.ruins.npcs.find(n => n.id === 'aldric').idle);
        expect(talk.events).toEqual([]);
    });
});

describe('quêtes secondaires', () => {
    const side = QUESTS.filter(q => q.side);
    const main = QUESTS.filter(q => !q.side);
    const allEnemies = screens.flatMap(s => s.enemies);
    const goto = (s, id) => { s.data.screenId = id; };

    test('4 à 6 quêtes secondaires, récompenses en or raisonnables, jamais requises par l\'histoire', () => {
        expect(side.length).toBeGreaterThanOrEqual(4);
        expect(side.length).toBeLessThanOrEqual(6);
        side.forEach(q => {
            expect(q.reward.gold).toBeGreaterThanOrEqual(30);
            expect(q.reward.gold).toBeLessThanOrEqual(120);
            expect(q.giver && q.turnIn).toBeTruthy();
            expect(q.offer.length).toBeGreaterThanOrEqual(2);
            expect(q.complete.length).toBeGreaterThanOrEqual(2);
            expect(q.hint.length).toBeGreaterThan(0);
        });
        main.forEach(q => q.requires.forEach(r => expect(side.some(x => x.id === r)).toBe(false)));
    });

    test('les quêtes secondaires ne dépendent que de l\'histoire principale', () => {
        side.forEach(q => q.requires.forEach(r => expect(main.some(x => x.id === r)).toBe(true)));
    });

    test('les ennemis nommés des quêtes secondaires sont permanents et ont un emoji', () => {
        side.flatMap(q => q.objectives).filter(o => o.type !== 'chest').forEach(o => {
            const targets = allEnemies.filter(e => o.type === 'kill' ? e.id === o.target : e.group === o.target);
            expect(targets.length).toBeGreaterThan(0);
            targets.forEach(e => { expect(e.permanent).toBe(true); expect(e.emoji).toBeTruthy(); });
        });
    });

    test('les coffres-objectifs secondaires sont atteignables en discrétion depuis l\'arrivée de l\'écran', () => {
        side.flatMap(q => q.objectives).filter(o => o.type === 'chest').forEach(o => {
            const s = screens.find(sc => sc.chests.some(c => c.id === o.target));
            const chest = s.chests.find(c => c.id === o.target);
            const forbidden = auraOfAll(s);
            const approach = DIRS.map(([dx, dy]) => ({ x: chest.x + dx, y: chest.y + dy }))
                .filter(p => !isTerrainBlocked(s, p.x, p.y) && !forbidden.has(`${p.x},${p.y}`));
            expect(approach.length).toBeGreaterThan(0);
            arrivals(s).forEach(a => {
                forbidden.delete(`${a.x},${a.y}`);
                expect(approach.some(p => reachable(s, a, forbidden).has(`${p.x},${p.y}`))).toBe(true);
            });
        });
    });

    test('un donneur secondaire est atteignable à pied sans entrer dans une zone de vigilance depuis l\'arrivée', () => {
        side.forEach(q => {
            const s = screens.find(sc => sc.npcs.some(n => n.id === q.giver));
            const npc = s.npcs.find(n => n.id === q.giver);
            const forbidden = auraOfAll(s);
            const a = arrivals(s)[0] || s.spawn;
            forbidden.delete(`${a.x},${a.y}`);
            const free = reachable(s, a, forbidden);
            expect(DIRS.some(([dx, dy]) => free.has(`${npc.x + dx},${npc.y + dy}`))).toBe(true);
        });
    });

    test('déroulé d\'une quête secondaire de bout en bout : Vieux Groin', () => {
        const s = createSession({});
        goto(s, 'village');
        expect(questStatus(s, side.find(q => q.id === 'boar_hunt'))).toBe('available');
        const offer = talkToNpc(s, 'odile');
        expect(offer.events[0]).toMatchObject({ type: 'questStarted' });
        expect(offer.events[0].quest.side).toBe(true);
        expect(talkToNpc(s, 'odile').lines).toEqual(side.find(q => q.id === 'boar_hunt').hint);
        expect(markEnemyDefeated(s, 'old_tusk')).toEqual([]); // pas de PNJ de remise : pas de validation automatique
        expect(questStatus(s, side.find(q => q.id === 'boar_hunt'))).toBe('ready');
        const done = talkToNpc(s, 'odile');
        expect(done.events[0]).toMatchObject({ type: 'questCompleted', gold: 50 });
        expect(s.data.quests.boar_hunt).toBe('done');
        // ensuite : réplique d'ambiance spécifique
        expect(talkToNpc(s, 'odile').lines).toEqual(SCREENS.village.npcs.find(n => n.id === 'odile').talk[0].lines);
    });

    test('quête de coffre secondaire : le marteau de Bran', () => {
        const s = createSession({});
        talkToNpc(s, 'bran');
        expect(s.data.quests.bran_hammer).toBe('active');
        goto(s, 'goblin_den');
        const res = openChest(s, 'bran_hammer');
        expect(res.gold).toBe(15);
        goto(s, 'village');
        const done = talkToNpc(s, 'bran');
        expect(done.events[0]).toMatchObject({ type: 'questCompleted', gold: 40 });
    });

    test('quête de groupe secondaire : le nid de la crypte', () => {
        const s = createSession({});
        markEnemyDefeated(s, 'goblin_king');
        s.data.quests.goblin_king = 'done';
        goto(s, 'ruins');
        expect(talkToNpc(s, 'nessa').events[0]).toMatchObject({ type: 'questStarted' });
        markEnemyDefeated(s, 'nest_reaver_a');
        markEnemyDefeated(s, 'nest_reaver_b');
        expect(s.data.quests.nessa_nest).toBe('active');
        markEnemyDefeated(s, 'nest_lich');
        expect(talkToNpc(s, 'nessa').events[0]).toMatchObject({ type: 'questCompleted', gold: 70 });
    });

    test('une quête secondaire verrouillée n\'est pas proposée', () => {
        const s = createSession({ screenId: 'ruins', x: 2, y: 5 });
        const talk = talkToNpc(s, 'nessa');
        expect(talk.events).toEqual([]);
        expect(s.data.quests.nessa_nest).toBeUndefined();
        expect(talk.lines).toEqual(SCREENS.ruins.npcs.find(n => n.id === 'nessa').idle);
    });

    test('la quête principale est faisable de bout en bout sans aucune quête secondaire', () => {
        const s = createSession({});
        talkToNpc(s, 'maelle');
        markEnemyDefeated(s, 'goblin_king');
        talkToNpc(s, 'maelle');
        talkToNpc(s, 'maelle');
        ['aldric_guard_n', 'aldric_guard_s', 'aldric_guard_w', 'aldric_guard_e'].forEach(id => markEnemyDefeated(s, id));
        goto(s, 'ruins');
        talkToNpc(s, 'aldric');
        markEnemyDefeated(s, 'gorm_kar');
        goto(s, 'desert');
        talkToNpc(s, 'tariq');
        openChest(s, 'sun_chest');
        goto(s, 'frozen');
        talkToNpc(s, 'ylva');
        markEnemyDefeated(s, 'frost_dragon');
        talkToNpc(s, 'ylva');
        markEnemyDefeated(s, 'void_lord');
        expect(s.data.ended).toBe(true);
        expect(main.every(q => s.data.quests[q.id] === 'done')).toBe(true);
        side.forEach(q => expect(s.data.quests[q.id]).not.toBe('done'));
    });

    test('le journal et le HUD restent cohérents avec une quête secondaire disponible', () => {
        const s = createSession({});
        expect(currentObjectiveText(s)).toContain('Maëlle'); // l'histoire passe avant
    });
});

describe('dialogues d\'ambiance conditionnels', () => {
    const npc = {
        idle: ['défaut'],
        talk: [
            { whenDone: 'goblin_king', lines: ['roi mort'] },
            { whenDone: 'nest_lich', lines: ['liche morte'] },
            { whenDone: ['sun_chest', 'gorm_kar'], lines: ['coffre ET orc'] },
            { whenDone: 'inconnu', lines: ['jamais'] },
            { whenDone: 'goblin_king', lines: [] }
        ]
    };

    test('sans condition remplie : idle', () => {
        expect(npcAmbientLines(createSession({}), npc)).toEqual(['défaut']);
    });

    test('la dernière condition remplie l\'emporte', () => {
        const s = createSession({});
        markEnemyDefeated(s, 'goblin_king');
        expect(npcAmbientLines(s, npc)).toEqual(['roi mort']);
        markEnemyDefeated(s, 'nest_lich');
        expect(npcAmbientLines(s, npc)).toEqual(['liche morte']);
    });

    test('progressReached : quête terminée, ennemi vaincu, coffre ouvert, tableau = toutes', () => {
        const s = createSession({});
        expect(progressReached(s, 'goblin_king')).toBe(false);
        s.data.quests.sage_rescue = 'done';
        expect(progressReached(s, 'sage_rescue')).toBe(true);
        s.data.openedChests.push('sun_chest');
        expect(progressReached(s, ['sun_chest', 'gorm_kar'])).toBe(false);
        markEnemyDefeated(s, 'gorm_kar');
        expect(progressReached(s, ['sun_chest', 'gorm_kar'])).toBe(true);
        expect(npcAmbientLines(s, npc)).toEqual(['coffre ET orc']);
        expect(progressReached(s, undefined)).toBe(false);
        expect(progressReached(s, [])).toBe(false);
    });

    test('talkToNpc utilise la réplique conditionnelle, mais la quête garde la priorité', () => {
        const s = createSession({ screenId: 'village' });
        talkToNpc(s, 'bran'); // la quête du marteau démarre
        s.data.quests.bran_hammer = 'active';
        expect(talkToNpc(s, 'bran').lines).toEqual(QUESTS.find(q => q.id === 'bran_hammer').hint);
        s.data.quests.bran_hammer = 'done';
        markEnemyDefeated(s, 'goblin_king');
        // l'entrée « bran_hammer » vient avant « goblin_king » dans `talk` : celle-ci l'emporte
        expect(talkToNpc(s, 'bran').lines).toEqual(SCREENS.village.npcs.find(n => n.id === 'bran').talk.find(t => t.whenDone === 'goblin_king').lines);
    });

    test('tous les PNJ ont des répliques valides et des conditions qui existent', () => {
        const known = new Set([
            ...QUESTS.map(q => q.id),
            ...screens.flatMap(s => s.enemies.map(e => e.id)),
            ...screens.flatMap(s => s.chests.map(c => c.id))
        ]);
        screens.flatMap(s => s.npcs).forEach(n => {
            expect(n.idle.length).toBeGreaterThan(0);
            (n.talk || []).forEach(t => {
                expect(t.lines.length).toBeGreaterThan(0);
                [].concat(t.whenDone).forEach(id => expect(known.has(id)).toBe(true));
            });
        });
    });
});

describe('texte d\'arrivée', () => {
    test('renvoyé une seule fois, à la première visite de l\'écran', () => {
        const s = createSession({ screenId: 'village', x: 12, y: 4 });
        const first = tryMove(s, 1, 0, { playerLevel: 1 });
        expect(first).toMatchObject({ type: 'transition', to: 'forest', firstVisit: true });
        expect(first.arrival).toEqual(SCREENS.forest.arrival);
        // retour au village puis nouvelle entrée en forêt : plus de texte
        enterScreen(s, 'village', { x: 12, y: 4 });
        const again = tryMove(s, 1, 0, { playerLevel: 1 });
        expect(again).toMatchObject({ type: 'transition', to: 'forest', firstVisit: false });
        expect(again.arrival).toBeUndefined();
    });

    test('une sauvegarde qui a déjà visité l\'écran ne rejoue pas le texte', () => {
        const s = createSession({ screenId: 'village', x: 12, y: 4, visitedScreens: ['village', 'forest'] });
        expect(tryMove(s, 1, 0, { playerLevel: 1 }).arrival).toBeUndefined();
    });

    test('un écran sans texte d\'arrivée ne renvoie pas `arrival`', () => {
        const s = createSession({ screenId: 'forest', x: 1, y: 4 });
        s.rt.grace = 0;
        const res = tryMove(s, -1, 0, { playerLevel: 1 });
        expect(res).toMatchObject({ type: 'transition', to: 'village', firstVisit: true }); // 1re visite, mais le village n'a pas de texte d'arrivée
        expect(res.arrival).toBeUndefined();
    });

    test('les écrans d\'exploration (hors village) ont un texte d\'arrivée non vide', () => {
        screens.filter(s => s.id !== START_SCREEN).forEach(s => expect(s.arrival.length).toBeGreaterThan(0));
    });
});

describe('déplacement au clic (findPath)', () => {
    const at = (screenId, x, y) => { const s = createSession({ screenId, x, y }); s.rt.grace = 0; return s; };

    // Rejoue un chemin avec tryMove, comme le fait la vue, et retourne le dernier résultat.
    function walk(s, path) {
        let last = null;
        for (const step of path) {
            last = tryMove(s, step.x - s.data.x, step.y - s.data.y, { playerLevel: 20 });
            if (last.type !== 'moved') break;
        }
        return last;
    }

    test('destination = position : chemin vide', () => {
        expect(findPath(at('village', 2, 4), 2, 4)).toEqual([]);
    });

    test('chemin le plus court en ligne droite, sans diagonale', () => {
        const path = findPath(at('village', 2, 4), 5, 4);
        expect(path).toEqual([{ x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }]);
        const s = at('village', 2, 4);
        expect(walk(s, findPath(s, 5, 4))).toEqual({ type: 'moved' });
        expect([s.data.x, s.data.y]).toEqual([5, 4]);
    });

    test('contourne les obstacles', () => {
        // maison en (2..4, 1..2) : de (1,1) à (5,1), il faut passer par-dessus ou par-dessous
        const s = at('village', 1, 1);
        const path = findPath(s, 5, 1);
        expect(path).not.toBeNull();
        expect(path.length).toBeGreaterThan(4);
        path.forEach(p => expect(isTerrainBlocked(SCREENS.village, p.x, p.y)).toBe(false));
        expect(walk(s, path)).toEqual({ type: 'moved' });
        expect([s.data.x, s.data.y]).toEqual([5, 1]);
    });

    test('destination invalide : obstacle, hors carte ou non entière', () => {
        const s = at('village', 2, 4);
        expect(findPath(s, 2, 2)).toBeNull();   // maison
        expect(findPath(s, -1, 4)).toBeNull();
        expect(findPath(s, 14, 4)).toBeNull();
        expect(findPath(s, 3.5, 4)).toBeNull();
    });

    test('destination isolée : null', () => {
        // Aldric est encerclé : sa tuile est atteignable mais celles qui l\'entourent sont occupées
        const s = at('ruins', 1, 7);
        s.rt.grace = 0;
        expect(findPath(s, 7, 4)).toBeNull();
    });

    test('vers un PNJ : le chemin finit sur sa tuile et la dernière étape ouvre le dialogue', () => {
        const s = at('village', 2, 4);
        const path = findPath(s, 6, 3);
        expect(path[path.length - 1]).toEqual({ x: 6, y: 3 });
        expect(walk(s, path)).toEqual({ type: 'talk', npcId: 'maelle' });
        expect([s.data.x, s.data.y]).not.toEqual([6, 3]);
    });

    test('vers un coffre : la dernière étape l\'ouvre', () => {
        const s = at('desert', 12, 3); // hors de la zone de vigilance de Solarion (10,3)
        s.rt.grace = 0;
        const path = findPath(s, 12, 1);
        expect(path).not.toBeNull();
        expect(walk(s, path)).toEqual({ type: 'chest', chestId: 'sun_chest' });
    });

    test('un PNJ ou un coffre n\'est jamais un point de passage', () => {
        const s = at('village', 5, 3);
        // Maëlle est en (6,3) : aller de (5,3) à (7,3) impose de la contourner
        const path = findPath(s, 7, 3);
        expect(path.some(p => p.x === 6 && p.y === 3)).toBe(false);
        expect(path.length).toBe(4);
    });

    test('vers un ennemi : la dernière étape lance le combat', () => {
        const s = at('forest', 1, 4);
        const path = findPath(s, 5, 3);
        expect(path[path.length - 1]).toEqual({ x: 5, y: 3 });
        expect(walk(s, path)).toMatchObject({ type: 'combat', enemyId: 'forest_gob' });
    });

    test('un ennemi n\'est jamais traversé', () => {
        const s = at('forest', 1, 4);
        const path = findPath(s, 12, 4);
        s.rt.enemies && aliveEnemies(s).forEach(e => expect(path.some(p => p.x === e.x && p.y === e.y)).toBe(false));
    });

    test('prend toujours le plus court chemin, même à travers la zone de vigilance d\'un ennemi', () => {
        const screens = {
            t: {
                id: 't', region: 'forest', name: 'T', biome: 'forest', w: 7, h: 5, spawn: { x: 0, y: 2 },
                obstacles: [], liquids: [], paths: [], exits: [], npcs: [], chests: [],
                enemies: [{ id: 'g', templateId: 'goblin_saboteur', emoji: 'g', name: 'g', kind: 'sentinel', x: 3, y: 1, offset: 0 }]
            }
        };
        const s = createSession({ screenId: 't', x: 0, y: 2 }, screens, []);
        s.rt.grace = 0;
        const path = findPath(s, 6, 2);
        // ligne droite (6 pas) alors qu'un détour existerait : le trajet ne cherche pas à éviter l'ennemi
        expect(path).toHaveLength(6);
        expect(path.every(p => p.y === 2)).toBe(true);
        // et le parcours réveille bien l'ennemi (zone de vigilance atteinte)
        expect(walk(s, path)).toEqual({ type: 'combat', enemyId: 'g' });
    });

    test('la longueur du chemin est minimale (Manhattan quand la voie est libre)', () => {
        const s = at('village', 1, 5);
        const path = findPath(s, 12, 3);
        expect(path).toHaveLength(Math.abs(12 - 1) + Math.abs(3 - 5));
    });

    test('une sortie n\'est franchie que si c\'est la destination', () => {
        const s = at('village', 12, 3);
        const toExit = findPath(s, 13, 4);
        expect(toExit[toExit.length - 1]).toEqual({ x: 13, y: 4 });
        expect(walk(s, toExit)).toMatchObject({ type: 'transition', to: 'forest' });
        // aller à côté de la sortie ne fait pas changer d\'écran
        const s2 = at('village', 12, 3);
        walk(s2, findPath(s2, 12, 5));
        expect(s2.data.screenId).toBe('village');
    });

    test('la sortie bloquée par le niveau ne fait pas changer d\'écran', () => {
        const s = at('ruins', 12, 4);
        const path = findPath(s, 13, 4);
        expect(tryMove(s, 1, 0, { playerLevel: 1 }).type).toBe('exitBlocked');
        expect(path).toEqual([{ x: 13, y: 4 }]);
    });
});

// Événements temporaires (events/) : moteur générique, activation par configuration, et « La Nuit des âmes errantes ».
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import './fixtures/xhrFromDisk.js';
import { SCREENS, QUESTS, buildWorld } from '../../story.js';
import { createSession, teleportToScreen, talkToNpc, openChest, markEnemyDefeated, questStatus, isExitLocked, isTerrainBlocked, enterScreen, tryMove, solvePuzzle, isShielded, visibleNpcs, visibleChests, aliveEnemies, bossEase } from '../../exploration.js';
import { EVENTS, isEventEnabled } from '../../events/config.js';
import { applyEvents, activeModules, eventScreens } from '../../events/engine.js';
import { EVENT_MODULES } from '../../events/registry.js';
import * as D from '../../events/wanderingSouls/data.js';
import '../../puzzle/modes.js';   // enregistre les modes d'énigme (push, mirror…)
import { PUZZLES, puzzleDef } from '../../puzzle/levels.js';
import { createPuzzle, solve } from '../../puzzle/engine.js';
import { trackCandidates, EVENT_TRACKS } from '../../musicTracks.js';
import { BIOME_DECOR } from '../../decor.js';
import { SOULS_FLOOR } from '../../sprites/soulsFloor.js';
import { borderKindOf, paintGroundTile } from '../../tilePainter.js';
import { decorSprite, DECOR_NAMES } from '../../sprites/decor.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
const OFF = { wanderingSouls: { enabled: false } };
const questOf = id => QUESTS.find(q => q.id === id);

describe('configuration des événements', () => {
    test('un événement n\'est actif que si enabled vaut exactement true', () => {
        expect(isEventEnabled('wanderingSouls', { wanderingSouls: { enabled: true } })).toBe(true);
        expect(isEventEnabled('wanderingSouls', { wanderingSouls: { enabled: false } })).toBe(false);
        expect(isEventEnabled('wanderingSouls', { wanderingSouls: { enabled: 'true' } })).toBe(false);
        expect(isEventEnabled('wanderingSouls', {})).toBe(false);
        expect(isEventEnabled('inconnu', EVENTS)).toBe(false);
    });

    test('chaque module du registre a une entrée dans la configuration, et aucun événement n\'est activé par la date', () => {
        EVENT_MODULES.forEach(m => expect(EVENTS[m.id]).toBeDefined());
        Object.values(EVENTS).forEach(cfg => expect(Object.keys(cfg)).toEqual(['enabled']));
    });
});

describe('moteur événementiel générique', () => {
    const fake = (id, apply) => ({ id, apply });

    test('n\'appelle que les modules activés et marque ce qu\'ils créent', () => {
        const screens = { base: { id: 'base' } }, quests = [{ id: 'q0' }];
        const on = fake('a', (s, q) => { s.a1 = { id: 'a1' }; q.push({ id: 'qa' }); });
        const off = fake('b', s => { s.b1 = { id: 'b1' }; });
        const applied = applyEvents(screens, quests, { modules: [on, off], events: { a: { enabled: true }, b: { enabled: false } } });
        expect(applied).toEqual(['a']);
        expect(Object.keys(screens)).toEqual(['base', 'a1']);
        expect(screens.a1.event).toBe('a');
        expect(screens.base.event).toBeUndefined();
        expect(quests.map(q => [q.id, q.event])).toEqual([['q0', undefined], ['qa', 'a']]);
        expect(eventScreens(screens, 'a')).toEqual([screens.a1]);
        expect(activeModules([on, off], { a: { enabled: true } })).toEqual([on]);
    });

    test('un module qui s\'abstient (retourne false) n\'est pas compté comme appliqué', () => {
        const screens = {}, quests = [];
        expect(applyEvents(screens, quests, { modules: [fake('a', () => false)], events: { a: { enabled: true } } })).toEqual([]);
    });

    test('deux événements coexistent sans dupliquer la logique du moteur', () => {
        const screens = {}, quests = [];
        const applied = applyEvents(screens, quests, {
            modules: [fake('a', s => { s.x = { id: 'x' }; }), fake('b', s => { s.y = { id: 'y' }; })],
            events: { a: { enabled: true }, b: { enabled: true } }
        });
        expect(applied).toEqual(['a', 'b']);
        expect([screens.x.event, screens.y.event]).toEqual(['a', 'b']);
    });
});

describe('La Nuit des âmes errantes : événement désactivé', () => {
    const off = buildWorld({ events: OFF });

    test('le royaume, son entrée, le talisman, la gardienne et les quêtes n\'existent pas', () => {
        expect(off.screens[D.REALM_ID]).toBeUndefined();
        expect(off.screens[D.HOST.wild].exits.some(e => e.to === D.REALM_ID)).toBe(false);
        expect(off.screens[D.HOST.wild].chests.some(c => c.id === D.TALISMAN.chest.id)).toBe(false);
        expect(off.screens[D.HOST.village].npcs.some(n => n.id === D.GIVER.id)).toBe(false);
        expect(off.quests.some(q => q.event === D.ID || String(q.id).startsWith('sq_ws_'))).toBe(false);
        expect(eventScreens(off.screens)).toEqual([]);
    });

    test('le reste du monde est identique à celui de l\'événement activé (hors contenu de l\'événement)', () => {
        const ids = o => Object.keys(o).filter(id => id !== D.REALM_ID).sort();
        expect(ids(off.screens)).toEqual(ids(SCREENS).filter(id => !SCREENS[id].arena));
        expect(off.quests.length).toBe(QUESTS.length - Object.keys(D.QUEST_IDS).length);
    });

    test('une sauvegarde qui se trouve dans le royaume revient à l\'écran de départ, sans erreur ni perte de progression', () => {
        const saved = {
            screenId: D.REALM_ID, x: 5, y: 5, quests: { [D.QUEST_IDS.talisman]: 'done', [D.QUEST_IDS.lanternes]: 'active' },
            openedChests: [D.TALISMAN.chest.id, 'ws_lanterne_1'], questItems: [{ id: D.TALISMAN.item.id, name: 'Talisman du sanctuaire' }]
        };
        const session = createSession(saved, off.screens, off.quests);
        expect(session.data.screenId).not.toBe(D.REALM_ID);
        expect(off.screens[session.data.screenId]).toBeDefined();
        expect(session.data.quests[D.QUEST_IDS.talisman]).toBe('done');   // la progression de l'événement est conservée pour sa réactivation
        expect(session.data.openedChests).toContain('ws_lanterne_1');
    });
});

describe('La Nuit des âmes errantes : événement activé', () => {
    const realm = SCREENS[D.REALM_ID];
    const wild = SCREENS[D.HOST.wild];

    test('le royaume est un écran hors carte marqué comme appartenant à l\'événement', () => {
        expect(realm).toMatchObject({ event: D.ID, underground: true, region: D.HOST.region, biome: D.BIOME, name: D.REALM.name });
        expect(eventScreens(SCREENS, D.ID).map(s => s.id)).toEqual([D.REALM_ID]);
        QUESTS.filter(q => q.event === D.ID).forEach(q => expect(Object.values(D.QUEST_IDS)).toContain(q.id));
    });

    const hosts = () => Object.values(SCREENS).filter(s => s.exits.some(e => e.to === D.REALM_ID));

    test('le royaume est accessible depuis la zone sauvage de chaque région, sans condition', () => {
        const regions = new Set(hosts().map(h => h.region));
        ['rizieres', 'volcan', 'gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang', 'lune'].forEach(r => expect(regions.has(r)).toBe(true));
        hosts().forEach(h => {
            expect(h.id).toMatch(/_wild$/);
            const door = h.exits.find(e => e.to === D.REALM_ID);
            expect(door.requires).toBeUndefined();
            expect(door.rememberReturn).toBeDefined();
            expect(isTerrainBlocked(h, door.x, door.y)).toBe(false);
            expect(isTerrainBlocked(h, door.rememberReturn.x, door.rememberReturn.y)).toBe(false);
            expect(isTerrainBlocked(realm, door.arrive.x, door.arrive.y)).toBe(false);
            expect(Math.max(Math.abs(door.x - door.rememberReturn.x), Math.abs(door.y - door.rememberReturn.y))).toBe(1);
        });
        expect(wild.exits.some(e => e.to === D.REALM_ID)).toBe(true);
    });

    test('la sortie du royaume ramène à l\'entrée empruntée, quelle que soit la région', () => {
        const back = realm.exits.find(e => e.to === D.HOST.wild);
        expect(back).toMatchObject({ returnToSaved: true, x: 0 });
        expect(isTerrainBlocked(wild, back.arrive.x, back.arrive.y)).toBe(false);
        hosts().forEach(h => {
            const door = h.exits.find(e => e.to === D.REALM_ID);
            const session = createSession(null);
            enterScreen(session, h.id, door.rememberReturn);
            const step = tryMove(session, door.x - door.rememberReturn.x, door.y - door.rememberReturn.y);
            expect({ host: h.id, to: step.to }).toEqual({ host: h.id, to: D.REALM_ID });
            // retour : un pas vers l'ouest depuis l'apparition
            const out = tryMove(session, -1, 0);
            expect({ host: h.id, to: out.to }).toEqual({ host: h.id, to: h.id });
            expect({ x: session.data.x, y: session.data.y }).toEqual(door.rememberReturn);
        });
    });

    test('l\'annonce de la fête (Halloween / Toussaint) ne s\'affiche qu\'une fois, à la première arrivée', () => {
        expect(realm.eventNotice).toEqual(D.REALM.notice);
        const text = D.REALM.notice.lines.join(' ');
        expect(text).toMatch(/Halloween/);
        expect(text).toMatch(/Toussaint/);
        const door = wild.exits.find(e => e.to === D.REALM_ID);
        const session = createSession(null);
        enterScreen(session, wild.id, door.rememberReturn);
        const first = tryMove(session, door.x - door.rememberReturn.x, door.y - door.rememberReturn.y);
        expect(first.notice).toEqual(D.REALM.notice);
        expect(session.data.eventNotices).toEqual([D.REALM.notice.id]);
        tryMove(session, -1, 0);   // retour
        enterScreen(session, wild.id, door.rememberReturn);
        const second = tryMove(session, door.x - door.rememberReturn.x, door.y - door.rememberReturn.y);
        expect(second.notice).toBeUndefined();
        // l'annonce lue survit à une sauvegarde
        const reloaded = createSession(JSON.parse(JSON.stringify(session.data)));
        expect(reloaded.data.eventNotices).toEqual([D.REALM.notice.id]);
    });

    test('les ennemis sont des modèles connus, le gardien est un boss permanent', () => {
        expect(realm.enemies.map(e => e.id)).toEqual(D.ENEMIES.map(e => e[0]));
        realm.enemies.forEach(e => { expect(templateIds.has(e.templateId)).toBe(true); expect(e.permanent).toBe(true); });
        expect(realm.enemies.find(e => e.id === 'ws_gardien_jugement').boss).toMatchObject({ level: D.HOST.level + 2 });
        expect(realm.enemies.some(e => e.templateId === 'jiangshi')).toBe(true);
    });

    test('aucune entité ne partage une case ni ne se trouve sur un obstacle', () => {
        const ents = [...realm.npcs, ...realm.chests, ...realm.enemies, ...realm.exits];
        expect(new Set(ents.map(e => `${e.x},${e.y}`)).size).toBe(ents.length);
        [...realm.npcs, ...realm.chests, ...realm.enemies].forEach(e => expect(isTerrainBlocked(realm, e.x, e.y)).toBe(false));
        const cells = [...wild.chests, ...wild.enemies, ...wild.npcs, ...wild.exits].map(e => `${e.x},${e.y}`);
        expect(new Set(cells).size).toBe(cells.length);
    });

    test('la chaîne de quêtes est facultative, en trois étapes, avec des objectifs qui pointent sur des entités existantes', () => {
        const ids = Object.values(D.QUEST_IDS);
        expect(ids.map(id => questOf(id).requires)).toEqual([[], [ids[0]], [ids[1]]]);
        const everything = new Set([
            ...Object.values(SCREENS).flatMap(s => [...s.npcs, ...s.chests, ...s.enemies].map(e => e.id)),
            ...Object.values(SCREENS).flatMap(s => s.chests.map(c => c.questItem?.id).filter(Boolean))
        ]);
        ids.forEach(id => {
            const q = questOf(id);
            expect(q.side).toBe(true);
            expect(everything.has(q.giver) && everything.has(q.turnIn)).toBe(true);
            q.objectives.forEach(o => expect({ id: o.target, found: everything.has(o.target) }).toEqual({ id: o.target, found: true }));
            expect(q.offer.length && q.hint.length && q.complete.length).toBeTruthy();
            expect(q.reward.xp).toBeGreaterThan(0);
        });
    });

    test('le Gardien est protégé par les Jiangshi : bouclier levé par leur défaite ou par le rite des lanternes', () => {
        const boss = () => realm.enemies.find(e => e.id === 'ws_gardien_jugement');
        expect(boss()).toMatchObject({ shieldedBy: D.SHIELD_GROUP, unsealedBy: [D.QUEST_IDS.lanternes] });
        expect(realm.enemies.filter(e => e.group === D.SHIELD_GROUP).map(e => e.templateId)).toEqual(['jiangshi', 'jiangshi']);

        const fresh = createSession(null);
        teleportToScreen(fresh, D.REALM_ID);
        expect(isShielded(fresh, boss())).toBe(true);
        realm.enemies.filter(e => e.group === D.SHIELD_GROUP).forEach(e => markEnemyDefeated(fresh, e.id));
        expect(isShielded(fresh, boss())).toBe(false);

        const rite = createSession({ quests: { [D.QUEST_IDS.lanternes]: 'done' } });
        teleportToScreen(rite, D.REALM_ID);
        expect(isShielded(rite, boss())).toBe(false);
    });

    test('la renarde laisse un faux passage : un mirage qui ne déclenche pas de combat', () => {
        expect(realm.enemies.find(e => e.id === 'ws_faux_passage')).toMatchObject({ illusion: true, permanent: true });
        expect(realm.enemies.find(e => e.id === 'ws_huli_jing').illusion).toBeUndefined();
    });

    test('Lanterne de l\'au-delà : l\'âme guide et l\'offrande n\'existent qu\'une fois la première lanterne allumée', () => {
        const session = createSession(null);
        teleportToScreen(session, D.REALM_ID);
        const visible = () => [...visibleNpcs(session).map(n => n.id), ...visibleChests(session).map(c => c.id)];
        expect(visible()).not.toContain(D.GUIDE.id);
        expect(visible()).not.toContain(D.OFFERING.id);
        openChest(session, D.LANTERNS[0].id);
        expect(visible()).toEqual(expect.arrayContaining([D.GUIDE.id, D.OFFERING.id]));
        expect(session.data.questItems.map(i => i.id)).toContain(D.LANTERN_ITEM.id);
        expect(talkToNpc(session, D.GUIDE.id).lines.length).toBeGreaterThan(0);
    });

    test('Sceau des esprits et âme apaisée : chacun retire un niveau au Gardien du jugement', () => {
        const boss = realm.enemies.find(e => e.id === 'ws_gardien_jugement');
        const session = createSession(null);
        teleportToScreen(session, D.REALM_ID);
        const base = bossEase(session, boss);
        expect(base).toBe(0);
        openChest(session, D.SEAL.chest.id);
        expect(bossEase(session, boss)).toBe(1);
        session.data.talked.push(D.HUNGRY_GHOST.id);
        expect(bossEase(session, boss)).toBe(2);
        expect(session.data.questItems.map(i => i.id)).toContain(D.SEAL.item.id);
    });

    test('Cloche d\'exorcisme : le faux passage de la renarde disparaît pour de bon', () => {
        const session = createSession(null);
        teleportToScreen(session, D.REALM_ID);
        const mirage = () => aliveEnemies(session).some(e => e.def.id === 'ws_faux_passage');
        expect(mirage()).toBe(true);
        openChest(session, D.BELL.chest.id);
        expect(mirage()).toBe(false);
        expect(session.data.questItems.map(i => i.id)).toContain(D.BELL.item.id);
    });

    test('énigme des miroirs rituels : faisable en 3 coups, sans armure antique, et le coffre ne s\'ouvre qu\'une fois résolue', () => {
        expect(PUZZLES[D.PUZZLE.id]).toBe(D.PUZZLE.def);
        expect(PUZZLES[D.PUZZLE.id].set).toBeUndefined();
        expect(solve(puzzleDef(D.PUZZLE.id))).toBe(3);
        expect(createPuzzle(puzzleDef(D.PUZZLE.id)).won).toBe(false);

        const session = createSession(null);
        teleportToScreen(session, D.REALM_ID);
        const locked = openChest(session, D.PUZZLE.chest.id);
        expect(locked).toMatchObject({ type: 'puzzle', puzzleId: D.PUZZLE.id });
        expect(session.data.openedChests).not.toContain(D.PUZZLE.chest.id);
        expect(solvePuzzle(session, D.PUZZLE.id)).toBeNull();   // pas de famille d'armure : aucune pièce offerte
        expect(openChest(session, D.PUZZLE.chest.id).events.some(e => e.type === 'chestOpened')).toBe(true);
        expect(session.data.questItems.map(i => i.id)).toContain(D.PUZZLE.item.id);
    });

    test('énigme des urnes : faisable en 13 coups, verrouille son coffre', () => {
        const P = D.PUZZLE_BLOCKS;
        expect(PUZZLES[P.id]).toBe(P.def);
        expect(D.PUZZLE_LIST.map(p => p.id)).toEqual(['ws_miroirs', 'ws_urnes']);
        expect(solve(puzzleDef(P.id))).toBe(13);
        expect(createPuzzle(puzzleDef(P.id)).won).toBe(false);
        const session = createSession(null);
        teleportToScreen(session, D.REALM_ID);
        expect(openChest(session, P.chest.id)).toMatchObject({ type: 'puzzle', puzzleId: P.id });
        solvePuzzle(session, P.id);
        expect(openChest(session, P.chest.id).events.some(e => e.type === 'chestOpened')).toBe(true);
        expect(session.data.questItems.map(i => i.id)).toContain(P.item.id);
    });

    test('les lanternes s\'allument dans l\'ordre : chacune n\'apparaît qu\'après la précédente', () => {
        const session = createSession(null);
        teleportToScreen(session, D.REALM_ID);
        const lit = () => visibleChests(session).map(c => c.id).filter(id => id.startsWith('ws_lanterne_'));
        expect(lit()).toEqual(['ws_lanterne_1']);
        openChest(session, 'ws_lanterne_1');
        expect(lit()).toEqual(['ws_lanterne_1', 'ws_lanterne_2']);
        expect(openChest(session, 'ws_lanterne_3')).toBeNull();   // la dernière lanterne est encore invisible
        openChest(session, 'ws_lanterne_2');
        expect(lit()).toEqual(['ws_lanterne_1', 'ws_lanterne_2', 'ws_lanterne_3']);
    });

    test('à la fin de la chaîne, le passage se referme : plus d\'entrée, mais la sortie reste libre', () => {
        const door = wild.exits.find(e => e.to === D.REALM_ID);
        const back = realm.exits.find(e => e.to === D.HOST.wild);
        expect(door.closedWhen).toBe(D.QUEST_IDS.sceaux);
        expect(back.closedWhen).toBeUndefined();
        const session = createSession({ openedChests: [D.TALISMAN.chest.id], questItems: [{ id: D.TALISMAN.item.id, name: D.TALISMAN.item.name }] });
        expect(isExitLocked(session, door)).toBe(false);
        session.data.quests[D.QUEST_IDS.sceaux] = 'done';
        expect(isExitLocked(session, door)).toBe(true);
        teleportToScreen(session, D.REALM_ID);
        expect(isExitLocked(session, back)).toBe(false);
    });

    test('musique : le royaume a sa piste, avec repli sur la musique sauvage des Bambous ; le Gardien a son thème', () => {
        expect(trackCandidates('wild', { biome: D.BIOME })).toEqual([EVENT_TRACKS[D.BIOME], 'wild-bamboo']);
        expect(trackCandidates('wild', { biome: 'bamboo' })).toEqual(['wild-bamboo']);   // les autres biomes ne changent pas
        expect(trackCandidates('boss', { boss: 'Gardien du jugement' })[0]).toBe('boss-gardien-du-jugement');
    });

    test('décors du biome : huit sprites pixel art 32×32 propres au royaume, tous dessinables', () => {
        const names = ['red_lantern', 'stone_stele', 'guardian_lion', 'soul_urn', 'incense_burner', 'spirit_mirror', 'pale_flowers', 'offering_bowl'];
        expect(BIOME_DECOR[D.BIOME]).toEqual(names);
        names.forEach(n => {
            expect(DECOR_NAMES).toContain(n);
            const uri = decorSprite(n);
            expect(uri.startsWith('data:image/png;base64,')).toBe(true);
            const png = Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64');
            expect([png.readUInt32BE(16), png.readUInt32BE(20), png.readUInt8(25)]).toEqual([32, 32, 6]);   // 32×32, RGBA (fond transparent)
        });
    });

    test('sol et bordure du biome : trois dalles 16×16 sur la palette du biome, bordure en racines noires', () => {
        expect(SOULS_FLOOR.tiles).toHaveLength(3);
        SOULS_FLOOR.tiles.forEach(rows => {
            expect(rows).toHaveLength(16);
            rows.forEach(r => expect(r).toMatch(/^[0-9a-f]{16}$/));
            rows.forEach(r => [...r].forEach(ch => expect(parseInt(ch, 16)).toBeLessThan(SOULS_FLOOR.palette.length)));
        });
        SOULS_FLOOR.palette.forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/));
        expect(borderKindOf(D.BIOME)).toBe('souls');
        // la dalle se dessine sans erreur et couvre tout le carré de 16×16 (une case = au moins 16 rangées de rectangles)
        const rects = [];
        const g = { fillStyle: '', fillRect: (x, y, w, h) => rects.push([x, y, w, h, g.fillStyle]) };
        paintGroundTile(g, { a: '#686a70', b: '#5f6167', path: '#8c7b55' }, 16, 0, 0, 3, 4, { isPath: () => false, isLiquid: () => false, biomeId: D.BIOME });
        expect(rects.length).toBeGreaterThanOrEqual(16);
        expect(rects.every(([x, y, w, h]) => x >= 0 && y >= 0 && x + w <= 16 && y + h <= 16)).toBe(true);
        const drawn = new Set(); rects.forEach(([x, y, w, h]) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) drawn.add(`${i},${j}`); });
        expect(drawn.size).toBe(256);
    });

    test('aucune pénalité ni pression : pas de compte à rebours, pas de limite de temps dans les quêtes', () => {
        Object.values(D.QUEST_IDS).forEach(id => expect(JSON.stringify(questOf(id))).not.toMatch(/timer|deadline|expire|daily|countdown/i));
    });

    test('parcours complet : talisman, lanternes, apaisement du fantôme, gardien, jade', () => {
        const session = createSession(null);
        const q1 = questOf(D.QUEST_IDS.talisman), q2 = questOf(D.QUEST_IDS.lanternes), q3 = questOf(D.QUEST_IDS.sceaux);
        const door = () => wild.exits.find(e => e.to === D.REALM_ID);   // ouverte sans condition (le talisman ne sert qu'à Zhong Kui)

        teleportToScreen(session, D.HOST.village);
        expect(talkToNpc(session, D.GIVER.id).events.some(e => e.type === 'questStarted' && e.quest.id === q1.id)).toBe(true);
        teleportToScreen(session, D.HOST.wild);
        expect(isExitLocked(session, door())).toBe(false);
        expect(openChest(session, D.TALISMAN.chest.id).events.some(e => e.type === 'chestOpened')).toBe(true);
        expect(isExitLocked(session, door())).toBe(false);
        expect(questStatus(session, q1)).toBe('ready');
        teleportToScreen(session, D.HOST.village);
        expect(talkToNpc(session, D.GIVER.id).events.some(e => e.type === 'questCompleted' && e.quest.id === q1.id)).toBe(true);

        teleportToScreen(session, D.REALM_ID);
        expect(questStatus(session, q2)).toBe('available');
        expect(talkToNpc(session, D.ZHONG_KUI.id).events.some(e => e.type === 'questStarted' && e.quest.id === q2.id)).toBe(true);
        D.LANTERNS.forEach(l => openChest(session, l.id));
        expect(questStatus(session, q2)).toBe('active');   // le fantôme affamé n'a pas encore été écouté
        talkToNpc(session, D.HUNGRY_GHOST.id);
        expect(questStatus(session, q2)).toBe('ready');
        expect(talkToNpc(session, D.ZHONG_KUI.id).events.some(e => e.type === 'questCompleted' && e.quest.id === q2.id)).toBe(true);

        expect(talkToNpc(session, D.ZHONG_KUI.id).events.some(e => e.type === 'questStarted' && e.quest.id === q3.id)).toBe(true);
        markEnemyDefeated(session, 'ws_gardien_jugement');
        expect(questStatus(session, q3)).toBe('active');   // le jade n'a pas encore été récupéré
        openChest(session, D.JADE.chest.id);
        expect(questStatus(session, q3)).toBe('ready');
        expect(talkToNpc(session, D.ZHONG_KUI.id).events.some(e => e.type === 'questCompleted' && e.quest.id === q3.id)).toBe(true);
        expect(questStatus(session, q3)).toBe('done');
    });

    test('la deuxième quête ne démarre pas avant la première', () => {
        const session = createSession(null);
        teleportToScreen(session, D.REALM_ID);
        expect(questStatus(session, questOf(D.QUEST_IDS.lanternes))).not.toBe('active');
        const events = talkToNpc(session, D.ZHONG_KUI.id).events || [];
        expect(events.some(e => e.type === 'questStarted')).toBe(false);
    });
});

// Événement « La Fête des lanternes d'hiver » (events/winterLanternFestival/) : préparé mais désactivé par défaut.
// Le monde « activé » est construit avec une configuration injectée (buildWorld) : le fichier events/config.js reste à false.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { readFileSync } from 'fs';
import { QUESTS as LIVE_QUESTS, buildWorld } from '../../story.js';
import { createSession, teleportToScreen, talkToNpc, openChest, markEnemyDefeated, questStatus, isExitLocked, isTerrainBlocked, solvePuzzle, isShielded, visibleNpcs, visibleChests, bossEase } from '../../exploration.js';
import { EVENTS, isEventEnabled } from '../../events/config.js';
import { eventScreens } from '../../events/engine.js';
import { EVENT_MODULES } from '../../events/registry.js';
import * as D from '../../events/winterLanternFestival/data.js';
import * as T from '../../events/winterLanternFestival/terrains.js';
import '../../puzzle/modes.js';
import { puzzleDef } from '../../puzzle/levels.js';
import { createPuzzle, solve } from '../../puzzle/engine.js';
import { BIOME_DECOR } from '../../decor.js';
import { EVENT_TRACKS, trackCandidates } from '../../musicTracks.js';
import { decorSprite } from '../../sprites/decor.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
const ON = { winterLanternFestival: { enabled: true } };
const OFF = { winterLanternFestival: { enabled: false } };

describe('La Fête des lanternes d\'hiver : configuration', () => {
    test('l\'événement est enregistré, activé par la configuration versionnée, et seul le commit de la configuration le change', () => {
        expect(EVENT_MODULES.map(m => m.id)).toContain(D.ID);
        expect(EVENTS[D.ID]).toEqual({ enabled: true });
        expect(isEventEnabled(D.ID)).toBe(true);
        expect(isEventEnabled(D.ID, OFF)).toBe(false);
    });

    test('le monde réel (configuration par défaut) contient le village, ses quêtes et la maison', () => {
        expect(LIVE_QUESTS.some(q => Object.values(D.QUEST_IDS).includes(q.id))).toBe(true);
        const screens = eventScreens(buildWorld().screens, D.ID);
        expect(screens.length).toBeGreaterThan(0);
        expect(buildWorld().screens[D.MAISON.id].interior).toBe(true);
    });
});

describe('La Fête des lanternes d\'hiver : événement désactivé', () => {
    const off = buildWorld({ events: OFF });

    test('ni village, ni entrée, ni quêtes', () => {
        expect(off.screens[D.REALM_ID]).toBeUndefined();
        expect(off.screens[T.COL]).toBeUndefined();
        expect(off.screens[D.HOST.wild].exits.some(e => e.to === D.REALM_ID)).toBe(false);
        expect(off.quests.some(q => q.event === D.ID)).toBe(false);
    });

    test('une sauvegarde dans le village revient à l\'écran de départ en gardant sa progression', () => {
        const session = createSession({
            screenId: D.REALM_ID, x: 5, y: 5, quests: { [D.QUEST_IDS.solstice]: 'done', [D.QUEST_IDS.lanternes]: 'active' },
            openedChests: ['wlm_lanterne_1'], questItems: [{ id: D.LANTERN_ITEM.id, name: D.LANTERN_ITEM.name }]
        }, off.screens, off.quests);
        expect(session.data.screenId).not.toBe(D.REALM_ID);
        expect(off.screens[session.data.screenId]).toBeDefined();
        expect(session.data.quests[D.QUEST_IDS.solstice]).toBe('done');
        expect(session.data.openedChests).toContain('wlm_lanterne_1');
        expect(session.data.questItems.map(i => i.id)).toContain(D.LANTERN_ITEM.id);
    });

    test('une sauvegarde dans le sanctuaire revient aussi à l\'écran de départ', () => {
        const session = createSession({ screenId: T.SANCTUAIRE, x: 3, y: 8 }, off.screens, off.quests);
        expect(off.screens[session.data.screenId]).toBeDefined();
        expect(session.data.screenId).not.toBe(T.SANCTUAIRE);
    });
});

describe('La Fête des lanternes d\'hiver : événement activé', () => {
    const world = buildWorld({ events: ON });
    const { screens, quests } = world;
    const village = screens[D.REALM_ID], col = screens[T.COL], sanct = screens[T.SANCTUAIRE], wild = screens[D.HOST.wild];
    const all = [village, col, sanct];
    const questOf = id => quests.find(q => q.id === id);
    const session = (saved = null) => createSession(saved, screens, quests);
    const go = (s, id) => teleportToScreen(s, id);

    test('trois écrans hors carte (et la maison) marqués comme appartenant à l\'événement, avec le biome dédié', () => {
        all.forEach(s => expect(s).toMatchObject({ event: D.ID, underground: true, region: D.HOST.region, biome: D.BIOME }));
        expect(eventScreens(screens, D.ID).map(s => s.id).sort()).toEqual([D.REALM_ID, D.MAISON.id, T.COL, T.SANCTUAIRE].sort());
        expect(quests.filter(q => q.event === D.ID).map(q => q.id)).toEqual(Object.values(D.QUEST_IDS));
    });

    test('l\'entrée est dans la zone sauvage des Rizières, libre d\'accès, et la sortie ramène à l\'entrée empruntée', () => {
        const door = wild.exits.find(e => e.to === D.REALM_ID);
        expect(door).toBeDefined();
        expect(door.requires).toBeUndefined();
        expect(door.closedWhen).toBeUndefined();
        expect(isTerrainBlocked(wild, door.x, door.y)).toBe(false);
        expect(isTerrainBlocked(wild, door.rememberReturn.x, door.rememberReturn.y)).toBe(false);
        expect(isTerrainBlocked(village, door.arrive.x, door.arrive.y)).toBe(false);
        expect(isExitLocked(session(), door)).toBe(false);
        expect(village.exits.find(e => e.returnToSaved)).toMatchObject({ to: wild.id });
        expect(decorSprite(D.GATE_SPRITE)).toBeDefined();
    });

    test('portes symétriques entre écrans ; la porte du sanctuaire est gelée tant que la source chaude n\'est pas libérée', () => {
        all.forEach(s => s.exits.filter(e => !e.door && screens[e.to]?.event === D.ID).forEach(e => {
            const t = screens[e.to];
            expect(isTerrainBlocked(s, e.x, e.y)).toBe(false);
            expect(isTerrainBlocked(t, e.arrive.x, e.arrive.y)).toBe(false);
            const back = t.exits.find(b => b.to === s.id);
            expect(back).toBeDefined();
            expect(Math.abs(back.x - e.arrive.x) + Math.abs(back.y - e.arrive.y)).toBe(1);
        }));
        const frozen = col.exits.find(e => e.to === T.SANCTUAIRE);
        expect(frozen.requires).toEqual([D.SOURCE_CHAUDE.chest.id]);
        const s = session();
        go(s, T.COL);
        expect(isExitLocked(s, frozen)).toBe(true);
        openChest(s, D.SOURCE_CHAUDE.chest.id);
        expect(isExitLocked(s, frozen)).toBe(false);
    });

    test('la maison du village : porte du bâtiment, intérieur meublé pour l\'hiver, sortie de retour', () => {
        const house = screens[D.MAISON.id], door = village.exits.find(e => e.to === D.MAISON.id);
        expect(door).toMatchObject({ door: true });
        expect(village.buildings.some(b => b.door.x === door.x && b.door.y === door.y)).toBe(true);
        expect(house).toMatchObject({ interior: true, event: D.ID, furnishing: 'winter' });
        expect(house.exits.find(e => e.to === D.REALM_ID)).toBeDefined();
        ['kang', 'brazier', 'tea_shelf', 'calligraphy_scroll', 'lacquer_chest', 'indoor_lantern', 'firewood_basket'].forEach(n => expect(decorSprite(n)).toBeDefined());
    });

    test('tout est atteignable à pied : PNJ, coffres, ennemis, patrouilles et portes', () => {
        all.forEach(s => {
            const key = (x, y) => `${x},${y}`;
            const seen = new Set([key(s.spawn.x, s.spawn.y)]), queue = [[s.spawn.x, s.spawn.y]];
            while (queue.length) {
                const [x, y] = queue.shift();
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                    const nx = x + dx, ny = y + dy;
                    if (!seen.has(key(nx, ny)) && !isTerrainBlocked(s, nx, ny)) { seen.add(key(nx, ny)); queue.push([nx, ny]); }
                });
            }
            const adjacent = e => [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].some(([dx, dy]) => seen.has(key(e.x + dx, e.y + dy)));
            [...s.npcs, ...s.chests, ...s.enemies, ...s.exits].forEach(e => expect({ screen: s.id, id: e.id || e.to, ok: adjacent(e) }).toEqual({ screen: s.id, id: e.id || e.to, ok: true }));
            (s.enemies.flatMap(e => e.patrol || [])).forEach(([px, py]) => expect(seen.has(key(px, py))).toBe(true));
        });
    });

    test('aucune entité ne partage une case ni ne se trouve sur un obstacle', () => {
        all.forEach(s => {
            const ents = [...s.npcs, ...s.chests, ...s.enemies, ...s.exits];
            expect(new Set(ents.map(e => `${e.x},${e.y}`)).size).toBe(ents.length);
            [...s.npcs, ...s.chests, ...s.enemies].forEach(e => expect(isTerrainBlocked(s, e.x, e.y)).toBe(false));
        });
        const cells = [...wild.chests, ...wild.enemies, ...wild.npcs, ...wild.exits].map(e => `${e.x},${e.y}`);
        expect(new Set(cells).size).toBe(cells.length);
    });

    test('ambiance chaleureuse : le village est sans ennemi, les ennemis sont des modèles connus, un seul boss', () => {
        expect(village.enemies).toHaveLength(0);
        const enemies = [...col.enemies, ...sanct.enemies];
        enemies.forEach(e => expect(templateIds.has(e.templateId)).toBe(true));
        expect(enemies.filter(e => e.boss)).toHaveLength(1);
        expect(sanct.enemies.find(e => e.id === D.BOSS.id).boss.name).toBe(D.BOSS.name);
        expect(col.enemies.length).toBeLessThanOrEqual(6);   // col de 64 × 28 : contemplatif, mais assez grand pour six créatures
    });

    test('la chaîne de six quêtes est facultative et ordonnée, et chaque objectif pointe sur une entité existante', () => {
        const ids = Object.values(D.QUEST_IDS);
        const [solstice, lanternes, tangyuan, flamme, chaleur, celebration] = ids;
        expect(ids.map(id => questOf(id).requires)).toEqual([[], [solstice], [solstice], [lanternes, tangyuan], [flamme], [chaleur]]);
        const everything = new Set([
            ...Object.values(screens).flatMap(s => [...s.npcs, ...s.chests, ...s.enemies].map(e => e.id)),
            ...Object.values(screens).flatMap(s => s.chests.map(c => c.questItem?.id).filter(Boolean))
        ]);
        ids.forEach(id => {
            const q = questOf(id);
            expect(q.side).toBe(true);
            expect(everything.has(q.giver) && everything.has(q.turnIn)).toBe(true);
            q.objectives.forEach(o => expect({ id: o.target, found: everything.has(o.target) }).toEqual({ id: o.target, found: true }));
            expect(q.offer.length && q.hint.length && q.complete.length && q.reward.xp > 0).toBeTruthy();
            expect(JSON.stringify(q)).not.toMatch(/timer|deadline|expire|daily|countdown/i);
        });
        // les objectifs « parler à » ne se recoupent pas d'une quête à l'autre (un PNJ déjà écouté validerait une autre quête)
        const talks = ids.flatMap(id => questOf(id).objectives.filter(o => o.type === 'talk').map(o => o.target));
        expect(new Set(talks).size).toBe(talks.length);
        expect(celebration).toBe(D.QUEST_IDS.celebration);
    });

    test('Lanterne céleste : le renard des neiges et le sésame enfoui n\'existent qu\'une fois la première lanterne allumée', () => {
        const s = session();
        go(s, D.REALM_ID);
        const visible = () => [...visibleNpcs(s).map(n => n.id), ...visibleChests(s).map(c => c.id)];
        expect(visible()).not.toContain(D.RENARD.id);
        expect(visible()).not.toContain(D.SESAME.chest.id);
        openChest(s, D.LANTERNS[0].id);
        expect(visible()).toEqual(expect.arrayContaining([D.RENARD.id, D.SESAME.chest.id]));
        expect(s.data.questItems.map(i => i.id)).toContain(D.LANTERN_ITEM.id);
    });

    test('les lanternes s\'allument dans l\'ordre', () => {
        const s = session();
        go(s, D.REALM_ID);
        const visible = () => visibleChests(s).map(c => c.id);
        expect(visible()).toContain('wlm_lanterne_1');
        expect(visible()).not.toContain('wlm_lanterne_2');
        openChest(s, 'wlm_lanterne_1');
        expect(visible()).toContain('wlm_lanterne_2');
        expect(visible()).not.toContain('wlm_lanterne_3');
        openChest(s, 'wlm_lanterne_2');
        expect(visible()).toContain('wlm_lanterne_3');
    });

    test('le Gardien est protégé par les gardiens de glace ; les lanternes ou leur défaite lèvent le voile ; source chaude et tangyuan l\'affaiblissent', () => {
        const boss = () => sanct.enemies.find(e => e.id === D.BOSS.id);
        const guards = sanct.enemies.filter(e => e.group === D.GUARDS_GROUP);
        expect(guards).toHaveLength(2);
        const fresh = session();
        go(fresh, T.SANCTUAIRE);
        expect(isShielded(fresh, boss())).toBe(true);
        guards.forEach(g => markEnemyDefeated(fresh, g.id));
        expect(isShielded(fresh, boss())).toBe(false);

        const rite = session({ quests: { [D.QUEST_IDS.lanternes]: 'done', [D.QUEST_IDS.tangyuan]: 'done' } });
        go(rite, T.SANCTUAIRE);
        expect(isShielded(rite, boss())).toBe(false);
        expect(bossEase(rite, boss())).toBe(1);   // tangyuan seul : un niveau en moins
        go(rite, T.COL);
        openChest(rite, D.SOURCE_CHAUDE.chest.id);
        expect(bossEase(rite, boss())).toBe(2);
    });

    test('énigmes : miroirs de lumière et blocs de glace sont solubles, déclarées seulement quand l\'événement est actif, sans armure', () => {
        D.PUZZLE_LIST.forEach(p => {
            expect(createPuzzle(puzzleDef(p.id)).won).toBe(false);
            expect(solve(puzzleDef(p.id))).toBeGreaterThan(0);
            expect(puzzleDef(p.id).set).toBeUndefined();
        });
        const hubChest = village.chests.find(c => c.id === D.PUZZLE_MIROIR.chest.id);
        const colChest = col.chests.find(c => c.id === D.PUZZLE_GLACE.chest.id);
        expect(hubChest.puzzle).toBe(D.PUZZLE_MIROIR.id);
        expect(colChest.puzzle).toBe(D.PUZZLE_GLACE.id);
        const s = session();
        go(s, D.REALM_ID);
        expect(openChest(s, hubChest.id)).toMatchObject({ type: 'puzzle', puzzleId: D.PUZZLE_MIROIR.id });
        solvePuzzle(s, D.PUZZLE_MIROIR.id);
        expect(openChest(s, hubChest.id).events.some(e => e.type === 'chestOpened')).toBe(true);
        expect(s.data.questItems.map(i => i.id)).toContain(D.FRAGMENTS[0].id);
    });

    test('biome : palette, décors existants dessinables, musique avec repli', () => {
        expect(BIOME_DECOR[D.BIOME].length).toBeGreaterThanOrEqual(6);
        BIOME_DECOR[D.BIOME].forEach(name => expect(decorSprite(name)).toBeDefined());
        expect(EVENT_TRACKS[D.BIOME]).toBe('event-winter-lantern');
        expect(trackCandidates('wild', { biome: D.BIOME })[0]).toBe('event-winter-lantern');
    });

    test('annonce et animation de découverte à la première arrivée', () => {
        expect(village.eventNotice).toMatchObject({ id: D.ID });
        expect(village.eventNotice.lines.length).toBeGreaterThan(0);
        expect(village.biomeIntro).toMatchObject({ id: D.BIOME });
    });

    test('parcours complet : de la préparation du solstice à la table de fête', () => {
        const s = session();
        const started = (npc, q) => talkToNpc(s, npc).events.some(e => e.type === 'questStarted' && e.quest.id === q);
        const completed = (npc, q) => talkToNpc(s, npc).events.some(e => e.type === 'questCompleted' && e.quest.id === q);
        const I = D.QUEST_IDS, st = id => questStatus(s, questOf(id));

        go(s, D.REALM_ID);
        expect(started(D.ANCIEN.id, I.solstice)).toBe(true);
        talkToNpc(s, D.CUISINIER.id); talkToNpc(s, D.ARTISAN.id);
        expect(st(I.solstice)).toBe('ready');
        expect(completed(D.ANCIEN.id, I.solstice)).toBe(true);

        expect(started(D.ARTISAN.id, I.lanternes)).toBe(true);
        D.LANTERNS.forEach(l => openChest(s, l.id));
        expect(completed(D.ARTISAN.id, I.lanternes)).toBe(true);

        expect(started(D.CUISINIER.id, I.tangyuan)).toBe(true);
        openChest(s, D.RIZ.chest.id); openChest(s, D.SESAME.chest.id);
        expect(st(I.tangyuan)).toBe('active');   // la clochette est dans le col
        go(s, T.COL);
        openChest(s, D.CLOCHETTE.id);
        go(s, D.REALM_ID);
        expect(completed(D.CUISINIER.id, I.tangyuan)).toBe(true);

        expect(started(D.GARDIEN.id, I.flamme)).toBe(true);
        solvePuzzle(s, D.PUZZLE_MIROIR.id); openChest(s, D.PUZZLE_MIROIR.chest.id);
        go(s, T.COL);
        openChest(s, D.SOURCE_CHAUDE.chest.id);
        solvePuzzle(s, D.PUZZLE_GLACE.id); openChest(s, D.PUZZLE_GLACE.chest.id);
        go(s, T.SANCTUAIRE);
        openChest(s, D.SANCTUAIRE_CHEST_3.id);
        go(s, D.REALM_ID);
        expect(completed(D.GARDIEN.id, I.flamme)).toBe(true);

        expect(started(D.GARDIEN.id, I.chaleur)).toBe(true);
        go(s, T.SANCTUAIRE);
        markEnemyDefeated(s, D.BOSS.id);
        openChest(s, D.JADE.chest.id);
        go(s, D.REALM_ID);
        expect(completed(D.GARDIEN.id, I.chaleur)).toBe(true);

        expect(started(D.ANCIEN.id, I.celebration)).toBe(true);
        [D.FAMILLE.id, D.ENFANTS.id, D.ESPRIT_VILLAGE.id].forEach(id => talkToNpc(s, id));
        expect(completed(D.ANCIEN.id, I.celebration)).toBe(true);
        expect(st(I.celebration)).toBe('done');
    });
});

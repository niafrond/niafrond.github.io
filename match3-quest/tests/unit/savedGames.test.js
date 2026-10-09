// Parties sauvegardées FORGÉES à des moments précis de l'histoire (voir fixtures/savesForge.js) : le jeu doit les charger,
// proposer le bon objectif, ouvrir ou fermer les bonnes portes, enchaîner les bonnes quêtes et appliquer les mécaniques
// d'exploration récentes (terrain, observation, arène, Nouvelle Partie +). Les mécaniques de combat sont dans savedGameMechanics.test.js.
import { describe, it, expect } from '@jest/globals';
import { SCREENS, QUESTS, STORY_ENDING, REGION_ENTRY_SCREEN, REGION_UNLOCK_LEVEL } from '../../story.js';
import * as X from '../../exploration.js';
import { OBSERVE_MS, OBSERVE_RANGE } from '../../terrain.js';
import { forge, damagedSaves, REGIONS, REGION_BOSSES, REGION_QUEST, regionIndex } from './fixtures/savesForge.js';

const load = save => X.createSession(JSON.parse(JSON.stringify(save)));   // comme après un rechargement : sérialisé puis relu
const questOf = id => QUESTS.find(q => q.id === id);
const mainQuestOf = region => REGION_QUEST[region];
// Sortie du sanctuaire / de la zone de la région `region` qui mène à la région suivante.
const exitToNext = region => {
    const target = REGION_ENTRY_SCREEN[REGIONS[regionIndex(region) + 1]];
    return Object.values(SCREENS).flatMap(s => s.exits.map(e => ({ screen: s, exit: e }))).find(({ exit }) => exit.to === target && exit.requires);
};

const MOMENTS = [
    ['partie neuve', () => forge.newGame()],
    ['début de partie, prologue vu', () => forge.freshStart()],
    ...REGIONS.flatMap(r => [
        [`arrivée à ${r}`, () => forge.arrival(r)],
        [`devant le boss de ${r}`, () => forge.beforeBoss(r)],
        [`après le boss de ${r}`, () => forge.afterBoss(r)]
    ]),
    ['épilogue joué', () => forge.ended()],
    ['Nouvelle Partie +', () => forge.newGamePlus(2)],
    ['dans l\'arène, cercle 1 terminé', () => forge.inArena([1])]
];

describe('chargement d\'une sauvegarde forgée à chaque moment du jeu', () => {
    it.each(MOMENTS)('%s : écran valide, héros sur une case libre, objectif lisible', (_name, make) => {
        const s = load(make());
        const screen = X.currentScreen(s);
        expect(screen).toBeTruthy();
        expect(X.isTerrainBlocked(screen, s.data.x, s.data.y, X.canWalkOnWater(s))).toBe(false);
        expect(s.data.visitedScreens).toContain(s.data.screenId);
        expect(typeof X.currentObjectiveText(s)).toBe('string');
        expect(X.currentObjectiveText(s).length).toBeGreaterThan(5);
        expect(Array.isArray(X.journalEntries(s))).toBe(true);
        expect(Array.isArray(X.regionProgress(s))).toBe(true);
    });

    it.each(MOMENTS)('%s : aucune quête commencée ou terminée dont une prérequise manque', (_name, make) => {
        const s = load(make());
        Object.entries(s.data.quests).forEach(([id, state]) => {
            if (state !== 'done' && state !== 'active') return;
            (questOf(id)?.requires || []).forEach(req => expect(s.data.quests[req]).toBe('done'));
        });
    });

    it.each(MOMENTS)('%s : un aller-retour sauvegarde → rechargement ne change rien', (_name, make) => {
        const once = load(make());
        const twice = load(once.data);
        expect(twice.data).toEqual(once.data);
    });

    it('chaque sauvegarde forgée a ses ennemis, coffres et quêtes cohérents avec le monde (aucun identifiant fantôme)', () => {
        const enemies = new Set(Object.values(SCREENS).flatMap(sc => sc.enemies.map(e => e.id)));
        const chests = new Set(Object.values(SCREENS).flatMap(sc => sc.chests.map(c => c.id)));
        const quests = new Set(QUESTS.map(q => q.id));
        MOMENTS.forEach(([, make]) => {
            const save = make();
            if (!save) return;
            save.defeated.filter(id => !id.startsWith('arena_')).forEach(id => expect(enemies.has(id)).toBe(true));
            save.openedChests.forEach(id => expect(chests.has(id)).toBe(true));
            Object.keys(save.quests).forEach(id => expect(quests.has(id)).toBe(true));
        });
    });
});

describe('sauvegardes abîmées ou anciennes', () => {
    it.each(Object.entries(damagedSaves))('%s : le jeu retombe sur un état jouable', (_name, make) => {
        const s = X.createSession(make());
        const screen = X.currentScreen(s);
        expect(screen).toBeTruthy();
        expect(X.isTerrainBlocked(screen, s.data.x, s.data.y)).toBe(false);
        ['defeated', 'openedChests', 'visitedScreens', 'talked', 'waypoints'].forEach(k => expect(Array.isArray(s.data[k])).toBe(true));
        expect(s.data.arena.cleared).toEqual(expect.any(Array));
        expect(s.data.ngPlus).toBeGreaterThanOrEqual(0);
    });
    it('une position inconnue replace le héros au village de départ', () => {
        const s = X.createSession(damagedSaves.unknownScreen());
        expect(s.data.screenId).toBe(X.START_SCREEN);
    });
    it('une sauvegarde importée sans position replace le héros près de la pierre de voyage ou de l\'entrée', () => {
        const s = X.createSession(damagedSaves.legacyNoPosition());
        const sc = SCREENS.fleuve;
        const spot = sc.waypoint?.spot || sc.spawn;
        expect([s.data.x, s.data.y]).toEqual([spot.x, spot.y]);
    });
});

describe('histoire : portes, boss et enchaînement des régions', () => {
    it('chaque région a un boss vivant à la veille du combat final et son objectif cite sa quête principale', () => {
        REGIONS.forEach(region => {
            const s = load(forge.beforeBoss(region));
            REGION_BOSSES[region].forEach(id => expect(X.isEnemyAlive(s, id)).toBe(true));
            expect(s.data.quests[mainQuestOf(region)]).toBe('active');
            expect(X.currentObjectiveText(s)).toContain(questOf(mainQuestOf(region)).title);
        });
    });

    it('à l\'arrivée dans une région, la porte qui y mène est ouverte ; devant le boss précédent elle est fermée', () => {
        REGIONS.slice(0, -1).forEach(region => {
            const door = exitToNext(region);
            expect(door).toBeTruthy();
            expect(X.isExitLocked(load(forge.beforeBoss(region)), door.exit)).toBe(true);
            expect(X.isExitLocked(load(forge.afterBoss(region)), door.exit)).toBe(false);
            expect(X.isExitLocked(load(forge.arrival(REGIONS[regionIndex(region) + 1])), door.exit)).toBe(false);
        });
    });

    it.each(REGIONS.slice(0, -1))('%s : abattre le boss depuis la sauvegarde termine la quête, récompense et ouvre la suite', region => {
        const s = load(forge.beforeBoss(region));
        const door = exitToNext(region);
        let events = [];
        REGION_BOSSES[region].forEach(id => { events = events.concat(X.markEnemyDefeated(s, id)); });
        const done = events.filter(e => e.type === 'questCompleted').find(e => e.quest.id === mainQuestOf(region));
        expect(done).toBeTruthy();
        expect(done.xp + done.gold).toBeGreaterThan(0);
        expect(s.data.quests[mainQuestOf(region)]).toBe('done');
        expect(X.isExitLocked(s, door.exit)).toBe(false);
        expect(s.data.ended).toBe(false);
    });

    it('lune : battre les deux phases de Fengmeng termine la légende', () => {
        const s = load(forge.beforeBoss('lune'));
        expect(s.data.ended).toBe(false);
        const events = REGION_BOSSES.lune.flatMap(id => X.markEnemyDefeated(s, id));
        expect(events.some(e => e.type === 'questCompleted' && e.ended)).toBe(true);
        expect(s.data.ended).toBe(true);
        expect(X.currentObjectiveText(s)).toMatch(/achevée|Nouvelle Partie/);
        expect(STORY_ENDING.length).toBeGreaterThan(2);
    });

    it('le niveau des ennemis suit la région : ils ne passent jamais sous le niveau d\'accès de leur région', () => {
        REGIONS.forEach(region => {
            const s = load(forge.arrival(region));
            const entry = Object.values(s.rt.enemyIndex).find(e => s.screens[e.screenId].region === region && !e.def.boss);
            if (!entry) return;
            const enc = X.encounterFor(s, entry.def.id, 99);
            expect(enc.level).toBeGreaterThanOrEqual(1);
            expect(REGION_UNLOCK_LEVEL[region]).toBeGreaterThanOrEqual(1);
        });
    });

    it('les boss gagnent 3 niveaux par Nouvelle Partie +', () => {
        const base = load(forge.beforeBoss('bambous'));
        const plus = load({ ...forge.beforeBoss('bambous'), ngPlus: 2 });
        const a = X.encounterFor(base, 'sun_3', 99), b = X.encounterFor(plus, 'sun_3', 99);
        expect(b.level - a.level).toBe(6);
        expect(b.boss.level).toBe(b.level);
    });
});

describe('Nouvelle Partie + depuis l\'épilogue', () => {
    it('refusée tant que l\'histoire n\'est pas terminée', () => {
        const s = load(forge.afterBoss('mer'));
        expect(X.startNewGamePlus(s)).toBe(false);
        expect(s.data.ngPlus).toBe(0);
    });
    it('remet l\'histoire à zéro, garde le prologue vu et augmente la difficulté', () => {
        const s = load(forge.ended());
        expect(X.startNewGamePlus(s)).toBe(true);
        expect(s.data.ngPlus).toBe(1);
        expect(s.data.ended).toBe(false);
        expect(s.data.defeated).toEqual([]);
        expect(s.data.openedChests).toEqual([]);
        expect(s.data.quests).toEqual({});
        expect(s.data.introSeen).toBe(true);
        expect(s.data.screenId).toBe(X.START_SCREEN);
        X.currentScreen(s).enemies.forEach(e => expect(X.isEnemyAlive(s, e.id)).toBe(true));
    });
    it('on peut enchaîner une deuxième Nouvelle Partie + après un nouvel épilogue', () => {
        const s = load(forge.ended());
        X.startNewGamePlus(s);
        s.data.ended = true;
        expect(X.startNewGamePlus(s)).toBe(true);
        expect(s.data.ngPlus).toBe(2);
    });
});

describe('préparation du terrain sur une sauvegarde (terrain.js)', () => {
    // Écran à pièges / hautes herbes / belvédère avec un ennemi ordinaire, héros posé sur une case libre.
    const screenWith = kind => Object.values(SCREENS).find(sc => !sc.arena && (sc.spots || []).some(p => p.kind === kind) && sc.enemies.some(e => !e.boss && !e.duel && !e.illusion));
    const setup = kind => {
        const sc = screenWith(kind);
        const s = load({ ...forge.freshStart(), screenId: sc.id, x: sc.spawn.x, y: sc.spawn.y });
        const def = sc.enemies.find(e => !e.boss && !e.duel && !e.illusion);
        return { s, sc, def, st: s.rt.enemies[def.id] };
    };

    it('le monde contient réellement des pièges, des hautes herbes et des belvédères sur ses zones sauvages (régression : les points de patrouille sont des paires [x, y])', () => {
        const kinds = new Set(Object.values(SCREENS).flatMap(sc => (sc.spots || []).map(p => p.kind)));
        expect([...kinds].sort()).toEqual(['outlook', 'tallGrass', 'trap']);
        Object.values(SCREENS).filter(sc => sc.id.endsWith('_wild')).forEach(sc => expect(sc.spots.length).toBeGreaterThan(0));
    });
    it('un ennemi sur un piège commence empoisonné', () => {
        const { s, sc, def, st } = setup('trap');
        const spot = sc.spots.find(p => p.kind === 'trap');
        st.x = spot.x; st.y = spot.y;
        const prep = X.prepFor(s, def);
        expect(prep.enemyStatus).toEqual({ poisoned: 3 });
        expect(prep.tags).toContain('trap');
    });
    it('un ennemi dans les hautes herbes commence désorienté', () => {
        const { s, sc, def, st } = setup('tallGrass');
        const spot = sc.spots.find(p => p.kind === 'tallGrass');
        st.x = spot.x; st.y = spot.y;
        const prep = X.prepFor(s, def);
        expect(prep.enemyStatus).toEqual({ confused: 2 });
    });
    it('depuis un belvédère, le plateau démarre avec des tuiles de la couleur faible', () => {
        const { s, sc, def } = setup('outlook');
        const spot = sc.spots.find(p => p.kind === 'outlook');
        s.data.x = spot.x; s.data.y = spot.y;
        expect(X.prepFor(s, def).boardBoost?.count).toBeGreaterThan(0);
    });
    it('attaquer par derrière donne l\'embuscade (+1 PA, joueur en premier)', () => {
        const { s, def, st } = setup('trap');
        st.face = { dx: 0, dy: 1 };                    // l'ennemi regarde vers le bas
        const behind = { x: st.x, y: st.y - 1 };      // le héros est derrière lui
        s.data.x = behind.x; s.data.y = behind.y;
        const prep = X.prepFor(s, def);
        expect(prep.tags).toContain('ambush');
        expect(prep.playerFirst).toBe(true);
        expect(prep.playerBonusPA).toBe(1);
    });
    it('un boss ne reçoit aucune préparation du terrain', () => {
        const s = load(forge.beforeBoss('rizieres'));
        const def = s.rt.enemyIndex.sun_1.def;
        expect(X.prepFor(s, def).tags).toEqual([]);
    });

    it('observation : 3 s immobile À UNE CASE de l\'ennemi perce sa faiblesse, mémorisée dans la sauvegarde', () => {
        const { s, def, st } = setup('trap');
        // on se place exactement à une case (distance de Chebyshev 1)
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: st.x + dx, y: st.y + dy })).find(p => !X.isTerrainBlocked(X.currentScreen(s), p.x, p.y));
        s.data.x = near.x; s.data.y = near.y;
        s.rt.grace = 0;
        expect(X.tick(s, OBSERVE_MS - 200).some(e => e.type === 'observed')).toBe(false);
        const ev = X.tick(s, 400).find(e => e.type === 'observed');
        expect(ev?.enemyId).toBe(def.id);
        const reloaded = load(s.data);
        expect(reloaded.data.observed[def.id]).toBe(true);
        reloaded.rt.enemies[def.id].x = st.x; reloaded.rt.enemies[def.id].y = st.y;
        expect(X.prepFor(reloaded, def).tags).toContain('observed');
    });
    it('observation : à deux cases ou plus de l\'ennemi, rien ne se passe', () => {
        expect(OBSERVE_RANGE).toBe(1);
        const { s, def, st } = setup('trap');
        const far = [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([dx, dy]) => ({ x: st.x + dx, y: st.y + dy })).find(p => !X.isTerrainBlocked(X.currentScreen(s), p.x, p.y));
        s.data.x = far.x; s.data.y = far.y;
        s.rt.grace = 0;
        expect(X.tick(s, OBSERVE_MS + 500).some(e => e.type === 'observed' && e.enemyId === def.id)).toBe(false);
        expect(s.data.observed[def.id]).toBeUndefined();
    });
});

describe('arène des Mille Flèches sur une sauvegarde', () => {
    const arena = (cleared = []) => load(forge.inArena(cleared));

    it('on charge au parvis avec le bon point de retour ; « Sortir » ramène d\'où l\'on vient', () => {
        const s = arena([1]);
        expect(X.inArena(s)).toBe(true);
        expect(s.data.screenId).toBe('arena_hall');
        const back = { ...s.data.arena.returnTo };
        expect(X.leaveArena(s)).toBe(true);
        expect(X.inArena(s)).toBe(false);
        expect([s.data.screenId, s.data.x, s.data.y]).toEqual([back.screenId, back.x, back.y]);
        expect(s.data.arena.returnTo).toBeNull();
    });
    it('la porte du cercle N est fermée tant que le cercle N-1 n\'est pas terminé', () => {
        const hall = SCREENS.arena_hall;
        const gate = n => hall.exits.find(e => e.to === `arena_c${n}`);
        const closed = arena([]), open = arena([1, 2]);
        expect(X.isExitLocked(closed, gate(1))).toBe(false);
        expect(X.isExitLocked(closed, gate(2))).toBe(true);
        expect(X.isExitLocked(open, gate(2))).toBe(false);
        expect(X.isExitLocked(open, gate(3))).toBe(false);
        expect(X.isExitLocked(open, gate(4))).toBe(true);
    });
    it('le maître est protégé tant que tous les gardiens ne sont pas vaincus ; vaincre le maître termine le cercle', () => {
        const s = arena([]);
        X.teleportToScreen(s, 'arena_c1');
        const guards = X.currentScreen(s).enemies.filter(e => !e.arena.master);
        const master = X.currentScreen(s).enemies.find(e => e.arena.master);
        expect(guards.length).toBeGreaterThan(0);
        expect(X.isShielded(s, master)).toBe(true);
        guards.slice(0, -1).forEach(g => X.markEnemyDefeated(s, g.id));
        expect(X.isShielded(s, master)).toBe(true);
        X.markEnemyDefeated(s, guards.at(-1).id);
        expect(X.isShielded(s, master)).toBe(false);
        const events = X.markEnemyDefeated(s, master.id);
        expect(events.find(e => e.type === 'arenaCleared')).toMatchObject({ tier: 1, firstClear: true });
        expect(s.data.arena.cleared).toContain(1);
        expect(s.data.arena.wins).toBeGreaterThan(0);
    });
    it('refaire un cercle déjà terminé ne donne pas de premier passage', () => {
        const s = arena([1]);
        X.teleportToScreen(s, 'arena_c1');
        const master = X.currentScreen(s).enemies.find(e => e.arena.master);
        X.currentScreen(s).enemies.filter(e => !e.arena.master).forEach(g => X.markEnemyDefeated(s, g.id));
        const events = X.markEnemyDefeated(s, master.id);
        expect(events.find(e => e.type === 'arenaCleared').firstClear).toBe(false);
        expect(s.data.arena.cleared.filter(n => n === 1)).toHaveLength(1);
    });
    it('revenir au parvis remet gardiens et maîtres en place (chaque cercle se refait)', () => {
        const s = arena([1]);
        X.teleportToScreen(s, 'arena_c1');
        const guard = X.currentScreen(s).enemies.find(e => !e.arena.master);
        X.markEnemyDefeated(s, guard.id);
        expect(X.isEnemyAlive(s, guard.id)).toBe(false);
        X.enterScreen(s, 'arena_hall', SCREENS.arena_hall.spawn);
        expect(X.isEnemyAlive(s, guard.id)).toBe(true);
    });
    it('une défaite dans l\'arène expulse le héros vers son point d\'entrée', () => {
        const s = arena([1]);
        X.teleportToScreen(s, 'arena_c1');
        const back = { ...s.data.arena.returnTo };
        X.resetAfterDefeat(s);
        expect(X.inArena(s)).toBe(false);
        expect(s.data.screenId).toBe(back.screenId);
    });
    it('un cercle terminé reste terminé après rechargement', () => {
        const s = arena([1, 2, 3]);
        expect(load(s.data).data.arena.cleared).toEqual([1, 2, 3]);
    });
});

describe('déplacements et voyage sur une sauvegarde avancée', () => {
    it('les pierres de voyage activées sont listées dans l\'ordre du monde et permettent de voyager', () => {
        const s = load(forge.afterBoss('gobi'));
        const list = X.waypointList(s);
        expect(list.length).toBeGreaterThan(3);
        const regionRank = r => REGIONS.indexOf(r);
        for (let i = 1; i < list.length; i++) expect(regionRank(list[i].region)).toBeGreaterThanOrEqual(regionRank(list[i - 1].region));
        const first = list[0];
        expect(X.fastTravel(s, first.screenId)).toBe(true);
        expect(s.data.screenId).toBe(first.screenId);
    });
    it('le voyage rapide vers une pierre non activée est refusé', () => {
        const s = load(forge.arrival('fleuve'));
        expect(X.fastTravel(s, 'lune')).toBe(false);
    });
    it('marcher sur l\'eau n\'est possible qu\'après la quête du Pas de Yu', () => {
        const before = load(forge.freshStart());
        expect(X.canWalkOnWater(before)).toBe(false);
        expect(X.canWalkOnWater(load(forge.arrival('bambous')))).toBe(X.canWalkOnWater(load(forge.afterBoss('fleuve'))));
        before.data.quests[X.YUBU_QUEST] = 'done';
        expect(X.canWalkOnWater(before)).toBe(true);
    });
    it('un écran déjà terminé garde ses ennemis permanents vaincus, les ordinaires réapparaissent en revenant', () => {
        const s = load(forge.afterBoss('rizieres'));
        const sc = Object.values(SCREENS).find(c => c.region === 'rizieres' && !c.interior && c.enemies.some(e => X.respawns(c, e)));
        const regular = sc.enemies.find(e => X.respawns(sc, e));
        X.enterScreen(s, sc.id, sc.spawn);
        expect(X.isEnemyAlive(s, regular.id)).toBe(true);
        expect(X.isEnemyAlive(s, 'sun_1')).toBe(false);
    });
});

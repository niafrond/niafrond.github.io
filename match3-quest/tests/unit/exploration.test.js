import { readFileSync } from 'fs';
import { SCREENS, QUESTS, REGION_UNLOCK_LEVEL, REGION_ENTRY_SCREEN, STORY_ENDING, STORY_INTRO, STORY_TITLE } from '../../story.js';
import {
    createSession, tryMove, tick, isTerrainBlocked, buildRoute, aliveEnemies, entityAt, getAuraTiles,
    markEnemyDefeated, talkToNpc, npcAmbientLines, progressReached, openChest, questStatus, checkAutoQuests, currentObjectiveText,
    encounterFor, enemyLevel, enterScreen, teleportToScreen, resetAfterDefeat, startNewGamePlus,
    isEntityVisible, visibleNpcs, visibleChests, isShielded, isExitLocked, journalEntries,
    AGGRO_RADIUS, PATROL_STEP_MS, GRACE_MOVES, START_SCREEN, findPath
} from '../../exploration.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
const screens = Object.values(SCREENS);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Ordre linéaire du monde : chaque écran est relié au précédent (ouest) et au suivant (est).
const ORDER = ['rizieres', 'fleuve', 'bambous', 'gobi', 'tonnerre', 'volcan', 'fauves', 'mer', 'fusang', 'lune'];
// Écrans où Fengmeng barre un défilé de 3 tuiles (duel obligatoire) : pas de chemin hors vigilance.
const FORCED = ['rizieres', 'volcan'];
const BIOME_OF = {
    rizieres: 'paddy', fleuve: 'riverbed', bambous: 'bamboo', gobi: 'gobi', tonnerre: 'storm',
    volcan: 'volcano', fauves: 'savanna', mer: 'coast', fusang: 'fusang', lune: 'moon'
};
const SUN_LEVELS = [3, 4, 5, 7, 9, 11, 13, 15, 17];

// Tuiles où l'on ARRIVE sur cet écran (définies par la sortie de retour de chaque voisin).
const arrivals = s => Object.values(SCREENS).flatMap(o => o.exits.filter(e => e.to === s.id).map(e => e.arrive));
// Points de départ « côté village » : sur les écrans à défilé obligatoire, seule l'apparition est de ce côté.
const starts = s => (FORCED.includes(s.id) ? [s.spawn] : [s.spawn, ...arrivals(s)]);

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

// Petite carte de test sur mesure (7 x 5), avec les entités passées en paramètre.
const synth = (extra = {}) => ({
    t: {
        id: 't', region: 'rizieres', name: 'T', biome: 'paddy', w: 7, h: 5, spawn: { x: 0, y: 2 },
        obstacles: [], liquids: [], paths: [], exits: [], npcs: [], chests: [], enemies: [], ...extra
    }
});
const enemyDef = (id, x, y, extra = {}) => ({ id, templateId: 'goblin_saboteur', emoji: 'g', name: id, kind: 'sentinel', x, y, offset: 0, ...extra });
const synthSession = (extra, at = { x: 0, y: 2 }, quests = []) => {
    const s = createSession({ screenId: 't', ...at }, synth(extra), quests);
    s.rt.grace = 0;
    return s;
};

// Session positionnée sur un écran réel (sans période de grâce).
const at = (screenId, x, y, patch = {}) => {
    const s = createSession({ screenId, x, y, ...patch });
    s.rt.grace = 0;
    return s;
};
const goto = (s, id) => { s.data.screenId = id; };
const quest = id => QUESTS.find(q => q.id === id);

describe('cartes (story.js)', () => {
    test.each(screens.map(s => [s.id, s]))('%s : dimensions, entités et sorties valides', (_id, s) => {
        expect([s.w, s.h]).toEqual([14, 10]);
        expect(s.region).toBe(s.id);
        expect(s.biome).toBe(BIOME_OF[s.id]);
        expect(isTerrainBlocked(s, s.spawn.x, s.spawn.y)).toBe(false);
        const seenPos = new Set();
        const place = (kind, x, y) => {
            expect(isTerrainBlocked(s, x, y)).toBe(false);
            const key = `${x},${y}`;
            expect(seenPos.has(key)).toBe(false); // pas deux entités au même endroit
            seenPos.add(key);
        };
        s.npcs.forEach(n => { place('npc', n.x, n.y); expect(n.emoji).toBeTruthy(); expect(n.name).toBeTruthy(); expect(n.title).toBeTruthy(); });
        s.chests.forEach(c => place('chest', c.x, c.y));
        s.enemies.forEach(e => {
            place('enemy', e.x, e.y);
            expect(templateIds.has(e.templateId)).toBe(true);
            expect(e.emoji).toBeTruthy();
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
            // sortie de retour symétrique, adjacente à l'arrivée, et on n'arrive pas SUR la tuile de sortie (pas de ping-pong)
            const back = target.exits.find(e => e.to === s.id);
            expect(back).toBeDefined();
            expect(Math.abs(back.x - ex.arrive.x) + Math.abs(back.y - ex.arrive.y)).toBe(1);
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

    test('le monde est une chaîne linéaire de 10 écrans : ouest = précédent (x=0), est = suivant (x=13)', () => {
        expect(Object.keys(SCREENS)).toEqual(ORDER);
        expect(START_SCREEN).toBe('rizieres');
        ORDER.forEach((id, i) => {
            const s = SCREENS[id];
            const west = s.exits.find(e => e.x === 0);
            const east = s.exits.find(e => e.x === s.w - 1);
            if (i === 0) expect(west).toBeUndefined(); else expect(west.to).toBe(ORDER[i - 1]);
            if (i === ORDER.length - 1) expect(east).toBeUndefined(); else expect(east.to).toBe(ORDER[i + 1]);
            expect(s.exits).toHaveLength((west ? 1 : 0) + (east ? 1 : 0));
            if (west) expect(west.arrive.x).toBe(SCREENS[west.to].w - 2);   // arrivée à côté de la sortie est du précédent
            if (east) expect(east.arrive.x).toBe(1);                         // arrivée à côté de la sortie ouest du suivant
            // le spawn est l'arrivée venant de l'ouest (sauf le premier écran, au village de départ)
            if (i > 0) expect(s.spawn).toEqual(SCREENS[ORDER[i - 1]].exits.find(e => e.x === 13).arrive);
        });
    });

    test('le monde est connexe depuis l\'écran de départ', () => {
        const seen = new Set([START_SCREEN]);
        const queue = [START_SCREEN];
        while (queue.length) SCREENS[queue.shift()].exits.forEach(e => { if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); } });
        expect(seen.size).toBe(screens.length);
    });

    test('chaque région a un écran d\'entrée du même nom et le niveau requis prévu', () => {
        expect(REGION_ENTRY_SCREEN).toEqual(Object.fromEntries(ORDER.map(id => [id, id])));
        expect(REGION_UNLOCK_LEVEL).toEqual({
            rizieres: 1, fleuve: 2, bambous: 3, gobi: 5, tonnerre: 7, volcan: 9, fauves: 11, mer: 13, fusang: 15, lune: 16
        });
        Object.entries(REGION_ENTRY_SCREEN).forEach(([region, id]) => expect(SCREENS[id].region).toBe(region));
        screens.forEach(s => expect(REGION_UNLOCK_LEVEL[s.region]).toBeDefined());
    });

    // « On peut éviter un ennemi en faisant le tour » : entre les sorties d'un écran de passage,
    // il existe un chemin qui reste hors de toute zone de vigilance (patrouilles, mirages et meute inclus).
    test.each(ORDER.filter(id => !FORCED.includes(id)))('%s : on peut traverser sans croiser d\'ennemi', id => {
        const s = SCREENS[id];
        const forbidden = auraOfAll(s);
        const points = [...arrivals(s), ...s.exits.map(e => ({ x: e.x, y: e.y }))];
        points.forEach(from => {
            forbidden.delete(`${from.x},${from.y}`);
            const free = reachable(s, from, forbidden);
            s.exits.forEach(ex => expect(free.has(`${ex.x},${ex.y}`)).toBe(true));
        });
    });

    test.each(FORCED)('%s : Fengmeng barre le défilé, mais sans bloquer physiquement la route vers l\'est', id => {
        const s = SCREENS[id];
        const east = s.exits.find(e => e.x === s.w - 1);
        // impossible de passer hors de sa vigilance depuis le village...
        const forbidden = auraOfAll(s);
        forbidden.delete(`${s.spawn.x},${s.spawn.y}`);
        expect(reachable(s, s.spawn, forbidden).has(`${east.x},${east.y}`)).toBe(false);
        // ... mais sa tuile ne ferme pas à elle seule le passage
        const fengmeng = s.enemies.find(e => e.id.startsWith('fengmeng_'));
        expect(fengmeng).toBeDefined();
        expect(reachable(s, s.spawn, new Set([`${fengmeng.x},${fengmeng.y}`])).has(`${east.x},${east.y}`)).toBe(true);
    });

    test('le sanctuaire d\'un boss ne barre jamais le passage vers la sortie est', () => {
        ORDER.slice(0, -1).forEach(id => {
            const s = SCREENS[id];
            const east = s.exits.find(e => e.x === s.w - 1);
            const bodies = new Set(s.enemies.map(e => `${e.x},${e.y}`));
            s.enemies.filter(e => e.kind === 'patrol').forEach(e => buildRoute(e.patrol).forEach(p => bodies.add(`${p.x},${p.y}`)));
            bodies.delete(`${s.spawn.x},${s.spawn.y}`);
            expect(reachable(s, s.spawn, bodies).has(`${east.x},${east.y}`)).toBe(true);
        });
    });

    test('chaque écran a son coin village à l\'ouest (PNJ) et son sanctuaire à l\'est (soleil-boss)', () => {
        screens.forEach(s => {
            s.npcs.filter(n => n.id !== 'sun_ten').forEach(n => expect(n.x).toBeLessThanOrEqual(5));
            expect(s.npcs.length).toBeGreaterThan(0);
        });
        for (let i = 0; i < 9; i++) {
            const sun = SCREENS[ORDER[i]].enemies.find(e => e.id === `sun_${i + 1}`);
            expect(sun).toBeDefined();
            expect(sun.x).toBeGreaterThanOrEqual(8);
            expect(sun.boss.level).toBe(SUN_LEVELS[i]);
            expect(sun.permanent).toBe(true);
            expect(sun.emoji).toBeTruthy();
        }
        expect(SCREENS.lune.enemies.filter(e => e.boss).map(e => e.id)).toEqual(['fengmeng_3a', 'fengmeng_3b']);
    });

    test('la sortie est de chaque région est fermée par son soleil ; le niveau de la région suivante reste en vigueur', () => {
        ORDER.slice(0, -1).forEach((id, i) => {
            const east = SCREENS[id].exits.find(e => e.x === 13);
            expect(east.requires).toBe(`sun_${i + 1}`);
            expect(east.lockedMessage.length).toBeGreaterThan(10);
            expect(SCREENS[id].enemies.some(e => e.id === east.requires)).toBe(true);
            expect(SCREENS[id].exits.filter(e => e.requires)).toHaveLength(1);
        });
        expect(SCREENS.lune.exits.some(e => e.requires)).toBe(false);
    });

    test('les ids de PNJ, de soleils et de Fengmeng sont ceux de UNIVERS.md', () => {
        const npcIds = screens.flatMap(s => s.npcs.map(n => n.id)).sort();
        expect(npcIds).toEqual([
            'change', 'elder_wen', 'farmer_lin', 'ferryman_gu', 'weaver_mei', 'monk_zhen', 'herbalist_xu',
            'merchant_ma', 'guide_dawa', 'smith_tie', 'hermit_lei', 'miner_shan', 'priestess_yan',
            'hunter_wu', 'shepherd_zi', 'fisher_hai', 'envoy_longwang', 'crane_envoy', 'sun_ten', 'change_moon'
        ].sort());
        const where = id => screens.find(s => s.enemies.some(e => e.id === id))?.id;
        expect(where('fengmeng_1')).toBe('rizieres');
        expect(where('fengmeng_2')).toBe('volcan');
        expect(where('fengmeng_3a')).toBe('lune');
        expect(where('fengmeng_3b')).toBe('lune');
        ['change', 'elder_wen', 'farmer_lin'].forEach(id => expect(SCREENS.rizieres.npcs.some(n => n.id === id)).toBe(true));
        expect(SCREENS.fusang.npcs.map(n => n.id).sort()).toEqual(['crane_envoy', 'sun_ten']);
        expect(SCREENS.lune.npcs.map(n => n.id)).toEqual(['change_moon']);
    });

    test('les gabarits des bêtes de la plaine des fauves et la répartition par région existent au catalogue', () => {
        const normalTemplates = id => new Set(SCREENS[id].enemies.filter(e => !e.boss && !e.permanent).map(e => e.templateId));
        expect([...normalTemplates('fauves')].every(t => ['fire_tiger', 'flame_boar', 'ember_wolf', 'war_troll'].includes(t))).toBe(true);
        const pack = SCREENS.fauves.enemies.filter(e => e.group === 'beast_pack');
        expect(pack.map(e => e.templateId).sort()).toEqual(['ember_wolf', 'ember_wolf', 'fire_tiger', 'flame_boar']);
        screens.forEach(s => s.enemies.forEach(e => expect(templateIds.has(e.templateId)).toBe(true)));
    });

    test('les ennemis d\'histoire sont permanents, les ennemis normaux réapparaissent', () => {
        screens.forEach(s => s.enemies.forEach(e => {
            if (e.boss || e.group || e.illusion || e.shieldedBy || e.defeatScene) expect(e.permanent).toBe(true);
        }));
        expect(SCREENS.gobi.enemies.find(e => e.id === 'gobi_colossus').permanent).toBeUndefined();
    });
});

describe('quêtes (story.js)', () => {
    const npcIds = new Set(screens.flatMap(s => s.npcs.map(n => n.id)));
    const enemyIds = new Set(screens.flatMap(s => s.enemies.map(e => e.id)));
    const groups = new Set(screens.flatMap(s => s.enemies.filter(e => e.group).map(e => e.group)));
    const chestIds = new Set(screens.flatMap(s => s.chests.map(c => c.id)));
    const questIds = new Set(QUESTS.map(q => q.id));
    const progressIds = new Set([...questIds, ...enemyIds, ...chestIds]);

    test.each(QUESTS.map(q => [q.id, q]))('%s : références valides', (_id, q) => {
        if (q.giver) expect(npcIds.has(q.giver)).toBe(true);
        if (q.turnIn) expect(npcIds.has(q.turnIn)).toBe(true);
        if (!q.giver) expect(q.autoStart).toBe(true);
        q.requires.forEach(r => expect(questIds.has(r)).toBe(true));
        expect(q.objectives.length).toBeGreaterThan(0);
        q.objectives.forEach(o => {
            const pool = o.type === 'kill' ? enemyIds : o.type === 'killGroup' ? groups : chestIds;
            expect(pool.has(o.target)).toBe(true);
            expect(o.text.length).toBeGreaterThan(10);
        });
        // les objectifs de kill visent des ennemis d'histoire qui ne réapparaissent pas
        q.objectives.filter(o => o.type === 'kill').forEach(o => {
            const def = screens.flatMap(s => s.enemies).find(e => e.id === o.target);
            expect(def.permanent).toBe(true);
        });
        expect(q.offer.length).toBeGreaterThanOrEqual(2);
        expect(q.complete.length).toBeGreaterThanOrEqual(2);
        expect(q.reward.gold).toBeGreaterThan(0);
        expect(q.reward.fragment).toBeTruthy();
    });

    test('l\'histoire principale : 9 soleils, Fengmeng, épilogue ; la dernière quête est la seule finale', () => {
        const main = QUESTS.filter(q => !q.side);
        expect(main.map(q => q.id)).toEqual([
            'q_sun_1', 'q_sun_2', 'q_sun_3', 'q_sun_4', 'q_sun_5', 'q_sun_6', 'q_sun_7', 'q_sun_8', 'q_sun_9', 'q_fengmeng', 'q_epilogue'
        ]);
        for (let i = 1; i <= 9; i++) {
            expect(quest(`q_sun_${i}`).objectives).toEqual([expect.objectContaining({ type: 'kill', target: `sun_${i}` })]);
            if (i > 1) expect(quest(`q_sun_${i}`).requires).toEqual([`q_sun_${i - 1}`]);
        }
        expect(quest('q_fengmeng').requires).toEqual(['q_sun_9']);
        expect(quest('q_fengmeng').objectives[0]).toMatchObject({ type: 'kill', target: 'fengmeng_3b' });
        expect(quest('q_epilogue').requires).toEqual(['q_fengmeng']);
        expect(quest('q_epilogue').objectives[0]).toMatchObject({ type: 'chest', target: 'moon_altar' });
        expect(main.filter(q => q.final).map(q => q.id)).toEqual(['q_epilogue']);
        expect(quest('q_epilogue').complete).toBe(STORY_ENDING);
        // récompenses d'or croissantes
        const golds = main.map(q => q.reward.gold);
        expect([...golds].sort((a, b) => a - b)).toEqual(golds);
    });

    test('titre, prologue et épilogue', () => {
        expect(STORY_TITLE).toBe('La Légende de Hou Yi');
        expect(STORY_INTRO.length).toBeGreaterThanOrEqual(4);
        expect(STORY_INTRO.join(' ')).toMatch(/dix soleils/);
        expect(STORY_INTRO.join(' ')).toMatch(/Chang'e/);
        expect(STORY_INTRO.join(' ')).toMatch(/Fengmeng/);
        expect(STORY_ENDING.join(' ')).toMatch(/gâteaux de lune/);
        expect(STORY_ENDING.join(' ')).toMatch(/Nouvelle Partie/);
    });

    test('les références des entités et des sorties (showWhen, hideWhen, requires, shieldedBy, defeatScene) sont valides', () => {
        screens.forEach(s => {
            [...s.enemies, ...s.npcs, ...s.chests].forEach(def => {
                [def.showWhen, def.hideWhen].filter(Boolean).forEach(c => [].concat(c).forEach(id => expect(progressIds.has(id)).toBe(true)));
            });
            s.exits.filter(e => e.requires).forEach(e => [].concat(e.requires).forEach(id => expect(progressIds.has(id)).toBe(true)));
            s.enemies.filter(e => e.shieldedBy).forEach(e => {
                expect(groups.has(e.shieldedBy)).toBe(true);
                expect(e.shieldLines.length).toBeGreaterThanOrEqual(2);
            });
            s.enemies.filter(e => e.illusion).forEach(e => {
                expect(e.illusionLines.length).toBeGreaterThan(0);
                expect(e.spriteKey).toBeTruthy();
                expect(e.boss).toBeUndefined();
            });
            s.enemies.filter(e => e.defeatScene).forEach(e => {
                expect(e.defeatScene.lines.length).toBeGreaterThanOrEqual(2);
                const sp = e.defeatScene.speaker;
                expect(sp.name).toBeTruthy();
                if (sp.npc) expect(npcIds.has(sp.npc)).toBe(true);
                if (sp.enemy) expect(enemyIds.has(sp.enemy)).toBe(true);
            });
        });
        // un ennemi qui n'apparaît qu'après un autre, et l'autel
        expect(SCREENS.lune.enemies.find(e => e.id === 'fengmeng_3b').showWhen).toBe('fengmeng_3a');
        expect(SCREENS.lune.chests.find(c => c.id === 'moon_altar').showWhen).toBe('fengmeng_3b');
    });

    test('Fengmeng : trois rencontres, scènes de fin de duel', () => {
        const fm = screens.flatMap(s => s.enemies).filter(e => e.id.startsWith('fengmeng_'));
        expect(fm.map(e => e.id)).toEqual(['fengmeng_1', 'fengmeng_2', 'fengmeng_3a', 'fengmeng_3b']);
        fm.forEach(e => { expect(e.boss).toBeDefined(); expect(e.defeatScene.lines.length).toBeGreaterThanOrEqual(3); });
        const levels = fm.map(e => e.boss.level);
        expect([...levels].sort((a, b) => a - b)).toEqual(levels);
        // la scène de 3a est jouée par le Narrateur et décrit l'envol de Chang'e
        expect(SCREENS.lune.enemies.find(e => e.id === 'fengmeng_3a').defeatScene.lines.join(' ')).toMatch(/élixir/);
    });

    test('le Soleil des Mirages a des doubles qui réutilisent son sprite', () => {
        const mirages = SCREENS.gobi.enemies.filter(e => e.illusion);
        expect(mirages.length).toBeGreaterThanOrEqual(3);
        mirages.forEach(m => expect(m.spriteKey).toBe('sun_4'));
        expect(SCREENS.gobi.enemies.find(e => e.id === 'sun_4').illusion).toBeUndefined();
    });
});

describe('déplacement et zones de vigilance', () => {
    const fresh = (patch = {}) => createSession({ ...patch });

    test('un nouveau joueur démarre à la maison de Hou Yi, aux Rizières Desséchées', () => {
        const s = fresh();
        expect(s.data.screenId).toBe('rizieres');
        expect(s.data.x).toBe(SCREENS.rizieres.spawn.x);
        expect(s.data.ngPlus).toBe(0);
        expect(s.data.ended).toBe(false);
    });

    test('un obstacle et le bord de la carte bloquent', () => {
        const s = fresh({ screenId: 'rizieres', x: 1, y: 3 });
        expect(tryMove(s, 0, -1).type).toBe('blocked'); // maison en (1,2)
        const edge = fresh({ screenId: 'rizieres', x: 0, y: 4 });
        expect(tryMove(edge, -1, 0).type).toBe('blocked');
    });

    test('marcher dans un PNJ ouvre le dialogue', () => {
        const s = fresh({ screenId: 'rizieres', x: 2, y: 4 });
        expect(tryMove(s, 0, -1)).toEqual({ type: 'talk', npcId: 'change' });
        expect(s.data.y).toBe(4);
    });

    test('distance 1 = combat, distance 2 = pas de combat', () => {
        // Golem de sable en (6,1)
        const s = at('gobi', 6, 4);
        expect(tryMove(s, 0, -1)).toEqual({ type: 'moved' });                              // (6,3) : distance 2
        expect(tryMove(s, 0, -1)).toEqual({ type: 'combat', enemyId: 'gobi_colossus' });   // (6,2) : distance 1
    });

    test('percuter un ennemi lance le combat même en période de grâce', () => {
        const s = at('gobi', 6, 2);
        s.rt.grace = 5;
        expect(tryMove(s, 0, -1)).toEqual({ type: 'combat', enemyId: 'gobi_colossus' });
    });

    test('la période de grâce ignore les zones de vigilance puis expire', () => {
        const s = at('gobi', 6, 3);
        s.rt.grace = GRACE_MOVES;
        expect(tryMove(s, 0, -1)).toEqual({ type: 'moved' });  // (6,2) est dans l'aura, mais la grâce court
        expect(s.rt.grace).toBe(GRACE_MOVES - 1);
    });

    test('un ennemi vaincu disparaît ; les ennemis normaux reviennent à la ré-entrée, pas les permanents', () => {
        const s = at('gobi', 1, 4);
        markEnemyDefeated(s, 'gobi_colossus');
        expect(aliveEnemies(s).some(e => e.def.id === 'gobi_colossus')).toBe(false);
        enterScreen(s, 'bambous', { x: 12, y: 4 });
        enterScreen(s, 'gobi', { x: 1, y: 4 });
        expect(aliveEnemies(s).some(e => e.def.id === 'gobi_colossus')).toBe(true);

        markEnemyDefeated(s, 'sun_4');
        enterScreen(s, 'tonnerre', { x: 1, y: 5 });
        enterScreen(s, 'gobi', { x: 12, y: 5 });
        expect(aliveEnemies(s).some(e => e.def.id === 'sun_4')).toBe(false);
    });

    test('une sortie change d\'écran et arrive à la tuile prévue (quand son soleil est abattu)', () => {
        const s = at('rizieres', 12, 4);
        markEnemyDefeated(s, 'sun_1');
        expect(tryMove(s, 1, 0, { playerLevel: 2 })).toMatchObject({ type: 'transition', from: 'rizieres', to: 'fleuve', firstVisit: true });
        expect(s.data.screenId).toBe('fleuve');
        expect([s.data.x, s.data.y]).toEqual([1, 4]);
        // retour à l'ouest : arrivée à côté de la sortie est des rizières
        const s2 = at('fleuve', 1, 4);
        expect(tryMove(s2, -1, 0, { playerLevel: 1 })).toMatchObject({ type: 'transition', to: 'rizieres' });
        expect([s2.data.x, s2.data.y]).toEqual([12, 4]);
    });

    test('une région est fermée tant que le niveau est insuffisant', () => {
        const s = at('fleuve', 12, 5);
        markEnemyDefeated(s, 'sun_2');
        const res = tryMove(s, 1, 0, { playerLevel: 2 });
        expect(res).toMatchObject({ type: 'exitBlocked', reason: 'level', minLevel: 3, regionName: 'Forêt de Bambous Calcinée' });
        expect(s.data.screenId).toBe('fleuve');
        expect(tryMove(s, 1, 0, { playerLevel: 3 }).type).toBe('transition');
    });

    test('les patrouilleurs avancent le long de leur route et font demi-tour', () => {
        const s = fresh({ screenId: 'rizieres', x: 3, y: 4 });
        const def = SCREENS.rizieres.enemies.find(e => e.id === 'rizieres_guardian');
        const route = buildRoute(def.patrol);
        expect(route.length).toBe(5);
        tick(s, PATROL_STEP_MS);
        expect(s.rt.enemies.rizieres_guardian).toMatchObject({ x: 9, y: 9 });
        for (let i = 0; i < 20; i++) tick(s, PATROL_STEP_MS);
        const st = s.rt.enemies.rizieres_guardian;
        expect(st.x).toBeGreaterThanOrEqual(8);
        expect(st.x).toBeLessThanOrEqual(12);
        expect(st.y).toBe(9);
    });

    test('un patrouilleur qui arrive au contact du joueur lance le combat', () => {
        const s = at('rizieres', 11, 8);
        const events = tick(s, PATROL_STEP_MS * 3);
        expect(events.some(e => e.type === 'combat' && e.enemyId === 'rizieres_guardian')).toBe(true);
    });

    test('après une défaite, retour au point d\'entrée de l\'écran avec une période de grâce', () => {
        const s = fresh({ screenId: 'fleuve', x: 6, y: 4 });
        resetAfterDefeat(s);
        expect([s.data.x, s.data.y]).toEqual([1, 4]);
        expect(s.rt.grace).toBeGreaterThan(0);
    });

    test('teleportToScreen arrive au point d\'apparition', () => {
        const s = fresh();
        teleportToScreen(s, 'volcan');
        expect([s.data.screenId, s.data.x, s.data.y]).toEqual(['volcan', 1, 3]);
        expect(teleportToScreen(s, 'nulle-part')).toBe(false);
    });

    test('les zones de vigilance sont exposées pour l\'affichage', () => {
        const s = fresh({ screenId: 'rizieres', x: 3, y: 4 });
        const aura = getAuraTiles(s);
        expect(aura.has('5,3')).toBe(true);   // Fengmeng en (6,4)
        expect(aura.has('7,5')).toBe(true);
        expect(aura.has('8,4')).toBe(false);
    });

    test('la progression est sérialisable en JSON et se recharge', () => {
        const s = fresh({ screenId: 'rizieres', x: 3, y: 4 });
        markEnemyDefeated(s, 'sun_1');
        s.data.ngPlus = 2;
        const copy = createSession(JSON.parse(JSON.stringify(s.data)));
        expect(copy.data.defeated).toContain('sun_1');
        expect(copy.data.screenId).toBe('rizieres');
        expect(copy.data.ngPlus).toBe(2);
    });

    test('une ancienne sauvegarde sans ngPlus, ou corrompue, retombe sur la maison', () => {
        expect(createSession({ screenId: 'rizieres', x: 3, y: 4 }).data.ngPlus).toBe(0);
        expect(createSession({ ngPlus: -3 }).data.ngPlus).toBe(0);
        expect(createSession({ ngPlus: 'beaucoup' }).data.ngPlus).toBe(0);
        const s = createSession({ screenId: 'nulle-part', x: 99, y: 99 });
        expect(s.data.screenId).toBe('rizieres');
        const inWall = createSession({ screenId: 'village', x: 2, y: 2 });   // ancien écran de « La Couronne Brisée »
        expect(inWall.data.screenId).toBe('rizieres');
        const inHouse = createSession({ screenId: 'rizieres', x: 1, y: 1 });
        expect(isTerrainBlocked(SCREENS.rizieres, inHouse.data.x, inHouse.data.y)).toBe(false);
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
        expect(enemyLevel({ id: 'z', offset: 3 }, 5)).toBe(6);
        const sun = encounterFor(s, 'sun_1', 1);
        expect(sun.boss.level).toBe(3);
        expect(encounterFor(s, 'sun_1', 8).boss.level).toBe(8);
        expect(encounterFor(s, 'inconnu', 1)).toBeNull();
    });

    test('la rencontre expose la clé de sprite (le mirage réutilise le soleil des mirages)', () => {
        const s = createSession({});
        expect(encounterFor(s, 'sun_1', 1)).toMatchObject({ enemyId: 'sun_1', spriteKey: 'sun_1', templateId: 'goblin_saboteur', name: 'Soleil Ardent' });
        expect(encounterFor(s, 'mirage_1', 7)).toMatchObject({ enemyId: 'mirage_1', spriteKey: 'sun_4' });
        expect(encounterFor(s, 'rizieres_goblin', 3).spriteKey).toBe('rizieres_goblin');
        expect(encounterFor(s, 'fengmeng_3b', 1).boss).toMatchObject({ name: 'Fengmeng, Rage et Désespoir', level: 19 });
    });

    test('Nouvelle Partie + : +3 niveaux pour les soleils et boss, +1 pour les ennemis normaux', () => {
        expect(enemyLevel({ id: 'b', boss: { level: 10 } }, 5, 0)).toBe(10);
        expect(enemyLevel({ id: 'b', boss: { level: 10 } }, 5, 2)).toBe(16);
        expect(enemyLevel({ id: 'b', boss: { level: 10 } }, 30, 2)).toBe(30);
        expect(enemyLevel({ id: 'x', offset: 0 }, 5, 1)).toBe(6);
        expect(enemyLevel({ id: 'x', offset: -1 }, 5, 2)).toBe(6);
        const s = createSession({ ngPlus: 2 });
        expect(encounterFor(s, 'sun_1', 1).level).toBe(3 + 6);
        expect(encounterFor(s, 'sun_1', 1).boss.level).toBe(9);
        expect(encounterFor(s, 'rizieres_shroom', 4).level).toBe(4 + 2);
    });
});

describe('histoire complète', () => {
    test('déroulé de la quête principale du premier soleil jusqu\'à l\'épilogue', () => {
        const s = createSession({});
        expect(currentObjectiveText(s)).toContain('Doyen Wen');

        // Prologue : le doyen Wen transmet le décret de l'empereur
        let talk = talkToNpc(s, 'elder_wen');
        expect(talk.events[0]).toMatchObject({ type: 'questStarted' });
        expect(talk.lines).toEqual(quest('q_sun_1').offer);
        expect(s.data.quests.q_sun_1).toBe('active');
        expect(talkToNpc(s, 'elder_wen').lines).toEqual(quest('q_sun_1').hint);   // pas de suite tant que le soleil vit
        expect(currentObjectiveText(s)).toContain('Soleil Ardent');

        // Duel d'entraînement : scène de Fengmeng, puis le premier soleil
        let events = markEnemyDefeated(s, 'fengmeng_1');
        expect(events.map(e => e.type)).toEqual(['scene']);
        events = markEnemyDefeated(s, 'sun_1');
        expect(events.map(e => e.type)).toEqual(['questCompleted', 'questStarted']);
        expect(events[0]).toMatchObject({ gold: 80, ended: false });
        expect(events[1].quest.id).toBe('q_sun_2');

        const golds = [80];
        for (let n = 2; n <= 9; n++) {
            if (n === 6) {
                const scene = markEnemyDefeated(s, 'fengmeng_2');
                expect(scene.map(e => e.type)).toEqual(['scene']);
            }
            expect(s.data.quests[`q_sun_${n}`]).toBe('active');
            expect(currentObjectiveText(s)).toContain(quest(`q_sun_${n}`).title);
            events = markEnemyDefeated(s, `sun_${n}`);
            expect(events[0]).toMatchObject({ type: 'questCompleted' });
            expect(events[0].quest.id).toBe(`q_sun_${n}`);
            golds.push(events[0].gold);
            expect(events[1]).toMatchObject({ type: 'questStarted' });
            expect(events[1].quest.id).toBe(n < 9 ? `q_sun_${n + 1}` : 'q_fengmeng');
        }
        expect([...golds].sort((a, b) => a - b)).toEqual(golds);

        // Finale : phase 1 (scène de l'envol de Chang'e), phase 2 (n'existe qu'après), autel
        expect(s.data.ended).toBe(false);
        events = markEnemyDefeated(s, 'fengmeng_3a');
        expect(events.map(e => e.type)).toEqual(['scene']);
        expect(s.data.quests.q_fengmeng).toBe('active');
        events = markEnemyDefeated(s, 'fengmeng_3b');
        expect(events.map(e => e.type)).toEqual(['scene', 'questCompleted', 'questStarted']);
        expect(events[1].quest.id).toBe('q_fengmeng');
        expect(events[2].quest.id).toBe('q_epilogue');
        expect(s.data.ended).toBe(false);

        goto(s, 'lune');
        const altar = openChest(s, 'moon_altar');
        expect(altar.events.map(e => e.type)).toEqual(['chestOpened', 'questCompleted']);
        expect(altar.events[1]).toMatchObject({ ended: true, lines: STORY_ENDING });
        expect(s.data.ended).toBe(true);
        expect(QUESTS.filter(q => !q.side).every(q => s.data.quests[q.id] === 'done')).toBe(true);
        expect(checkAutoQuests(s)).toEqual([]);
        expect(currentObjectiveText(s)).toContain('Nouvelle Partie +');
        expect(openChest(s, 'moon_altar')).toBeNull();
    });

    test('tuer un soleil avant d\'avoir parlé au doyen valide quand même la quête à la remise', () => {
        const s = createSession({});
        markEnemyDefeated(s, 'sun_1');
        expect(questStatus(s, quest('q_sun_1'))).toBe('available');
        const talk = talkToNpc(s, 'elder_wen');
        expect(talk.events.map(e => e.type)).toEqual(['questStarted', 'questCompleted', 'questStarted']);
        expect(s.data.quests.q_sun_1).toBe('done');
        expect(s.data.quests.q_sun_2).toBe('active');
    });

    test('un PNJ sans quête raconte son dialogue habituel', () => {
        const s = createSession({});
        const talk = talkToNpc(s, 'change');
        expect(talk.lines).toEqual(SCREENS.rizieres.npcs.find(n => n.id === 'change').idle);
        expect(talk.events).toEqual([]);
        expect(talkToNpc(s, 'inconnu')).toBeNull();
    });

    test('le doyen sert de guide du tutoriel : le marqueur de quête et l\'objectif pointent vers lui', () => {
        const s = createSession({});
        expect(journalEntries(s).map(e => e.quest.id)).toContain('q_sun_1');
        expect(journalEntries(s).find(e => e.quest.id === 'q_sun_1').status).toBe('available');
        expect(journalEntries(s).some(e => e.quest.id === 'q_sun_2')).toBe(false);   // verrouillée
    });

    test('Chang\'e quitte la maison une fois le neuvième soleil abattu (hideWhen)', () => {
        const s = createSession({});
        expect(talkToNpc(s, 'change')).not.toBeNull();
        markEnemyDefeated(s, 'sun_9');
        expect(talkToNpc(s, 'change')).toBeNull();
        expect(visibleNpcs(s).map(n => n.id)).not.toContain('change');
        expect(entityAt(s, 2, 3)).toBeNull();
        expect(findPath(at('rizieres', 2, 5), 2, 3)).not.toBeNull();   // la tuile est libre : plus de PNJ
    });
});

describe('quêtes secondaires', () => {
    const side = QUESTS.filter(q => q.side);
    const main = QUESTS.filter(q => !q.side);
    const allEnemies = screens.flatMap(s => s.enemies);
    const regionOf = q => screens.find(sc => sc.npcs.some(n => n.id === q.giver)).id;

    test('1 à 2 quêtes secondaires par région (sauf le Pic de la Lune), récompenses raisonnables, jamais requises par l\'histoire', () => {
        ORDER.slice(0, 9).forEach(id => {
            const n = side.filter(q => regionOf(q) === id).length;
            expect(n).toBeGreaterThanOrEqual(1);
            expect(n).toBeLessThanOrEqual(2);
        });
        side.forEach(q => {
            expect(q.reward.gold).toBeGreaterThanOrEqual(30);
            expect(q.reward.gold).toBeLessThanOrEqual(160);
            expect(q.reward.fragment.length).toBeGreaterThan(3);
            expect(q.giver && q.turnIn).toBeTruthy();
            expect(q.offer.length).toBeGreaterThanOrEqual(2);
            expect(q.complete.length).toBeGreaterThanOrEqual(2);
            expect(q.hint.length).toBeGreaterThan(0);
            expect(q.chapter).toMatch(/secondaire/);
        });
        main.forEach(q => q.requires.forEach(r => expect(side.some(x => x.id === r)).toBe(false)));
        // composants de flèche de la liste du cahier des charges
        const fragments = side.map(q => q.reward.fragment);
        ['Eau sacrée', 'Vent céleste', 'Pierre de glace', 'Plume de grue', 'Écaille de dragon', 'Cendre de phénix']
            .forEach(f => expect(fragments).toContain(f));
        expect(new Set(fragments).size).toBe(fragments.length);
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

    test('les coffres-objectifs secondaires sont atteignables en discrétion depuis l\'entrée côté village', () => {
        side.flatMap(q => q.objectives).filter(o => o.type === 'chest').forEach(o => {
            const s = screens.find(sc => sc.chests.some(c => c.id === o.target));
            const chest = s.chests.find(c => c.id === o.target);
            const forbidden = auraOfAll(s);
            const approach = DIRS.map(([dx, dy]) => ({ x: chest.x + dx, y: chest.y + dy }))
                .filter(p => !isTerrainBlocked(s, p.x, p.y) && !forbidden.has(`${p.x},${p.y}`));
            expect(approach.length).toBeGreaterThan(0);
            starts(s).forEach(a => {
                forbidden.delete(`${a.x},${a.y}`);
                expect([o.target, a, approach.some(p => reachable(s, a, forbidden).has(`${p.x},${p.y}`))]).toEqual([o.target, a, true]);
            });
        });
    });

    test('un donneur est atteignable à pied sans entrer dans une zone de vigilance', () => {
        [...main.filter(q => q.giver), ...side].forEach(q => {
            const s = screens.find(sc => sc.npcs.some(n => n.id === q.giver));
            const npc = s.npcs.find(n => n.id === q.giver);
            starts(s).forEach(a => {
                const forbidden = auraOfAll(s);
                forbidden.delete(`${a.x},${a.y}`);
                const free = reachable(s, a, forbidden);
                expect(DIRS.some(([dx, dy]) => free.has(`${npc.x + dx},${npc.y + dy}`))).toBe(true);
            });
        });
    });

    test('quête secondaire de bout en bout : le chapardeur des rizières', () => {
        const s = createSession({});
        const q = quest('sq_rice_thief');
        expect(questStatus(s, q)).toBe('available');
        const offer = talkToNpc(s, 'farmer_lin');
        expect(offer.events[0]).toMatchObject({ type: 'questStarted' });
        expect(offer.events[0].quest.side).toBe(true);
        expect(talkToNpc(s, 'farmer_lin').lines).toEqual(q.hint);
        expect(markEnemyDefeated(s, 'rice_thief')).toEqual([]);  // pas de PNJ de remise : pas de validation automatique
        expect(questStatus(s, q)).toBe('ready');
        expect(currentObjectiveText(s)).toContain('Doyen Wen');   // l'histoire passe avant : le doyen a une quête à donner
        const done = talkToNpc(s, 'farmer_lin');
        expect(done.events[0]).toMatchObject({ type: 'questCompleted', gold: 40 });
        expect(done.events[0].reward.fragment).toBe('Eau sacrée');
        expect(s.data.quests.sq_rice_thief).toBe('done');
        // ensuite : réplique d'ambiance spécifique
        expect(talkToNpc(s, 'farmer_lin').lines).toEqual(SCREENS.rizieres.npcs.find(n => n.id === 'farmer_lin').talk[0].lines);
    });

    test('une quête secondaire n\'est proposée qu\'une fois la région atteinte dans l\'histoire', () => {
        const s = createSession({ screenId: 'fleuve', x: 1, y: 4 });
        const talk = talkToNpc(s, 'weaver_mei');
        expect(talk.events).toEqual([]);
        expect(s.data.quests.sq_drowned).toBeUndefined();
        expect(talk.lines).toEqual(SCREENS.fleuve.npcs.find(n => n.id === 'weaver_mei').idle);
        s.data.quests.q_sun_1 = 'done';
        expect(talkToNpc(s, 'weaver_mei').events[0]).toMatchObject({ type: 'questStarted' });
    });

    test('quête de groupe secondaire : les noyés de Mei', () => {
        const s = createSession({ screenId: 'fleuve', x: 1, y: 4 });
        s.data.quests.q_sun_1 = 'done';
        expect(talkToNpc(s, 'weaver_mei').events[0]).toMatchObject({ type: 'questStarted' });
        markEnemyDefeated(s, 'drowned_a');
        expect(s.data.quests.sq_drowned).toBe('active');
        markEnemyDefeated(s, 'drowned_b');
        expect(questStatus(s, quest('sq_drowned'))).toBe('ready');
        expect(talkToNpc(s, 'weaver_mei').events[0]).toMatchObject({ type: 'questCompleted', gold: 60 });
    });

    test('quête de coffre secondaire : la cloche du temple', () => {
        const s = createSession({ screenId: 'bambous', x: 1, y: 5 });
        s.data.quests.q_sun_2 = 'done';
        talkToNpc(s, 'monk_zhen');
        expect(s.data.quests.sq_bell).toBe('active');
        const res = openChest(s, 'temple_bell');
        expect(res.gold).toBe(10);
        const done = talkToNpc(s, 'monk_zhen');
        expect(done.events[0]).toMatchObject({ type: 'questCompleted', gold: 50 });
    });

    test('la quête principale est faisable de bout en bout sans aucune quête secondaire', () => {
        const s = createSession({});
        talkToNpc(s, 'elder_wen');
        ORDER.slice(0, 9).forEach((id, i) => { goto(s, id); markEnemyDefeated(s, `sun_${i + 1}`); });
        markEnemyDefeated(s, 'fengmeng_3a');
        markEnemyDefeated(s, 'fengmeng_3b');
        goto(s, 'lune');
        openChest(s, 'moon_altar');
        expect(s.data.ended).toBe(true);
        expect(main.every(q => s.data.quests[q.id] === 'done')).toBe(true);
        side.forEach(q => expect(s.data.quests[q.id]).not.toBe('done'));
    });

    test('les quêtes secondaires disponibles ne masquent pas l\'objectif de l\'histoire dans le HUD', () => {
        const s = createSession({});
        expect(currentObjectiveText(s)).toContain('Doyen Wen');
        s.data.ended = true;
        s.data.quests = Object.fromEntries(main.map(q => [q.id, 'done']));
        expect(currentObjectiveText(s)).toContain('Nouvelle Partie +');   // pas de quête secondaire non commencée dans le HUD
    });
});

describe('dialogues d\'ambiance conditionnels', () => {
    const npc = {
        idle: ['défaut'],
        talk: [
            { whenDone: 'sun_1', lines: ['soleil 1 abattu'] },
            { whenDone: 'rice_thief', lines: ['chapardeur chassé'] },
            { whenDone: ['lotus_cache', 'sun_2'], lines: ['coffre ET soleil'] },
            { whenDone: 'inconnu', lines: ['jamais'] },
            { whenDone: 'sun_1', lines: [] }
        ]
    };

    test('sans condition remplie : idle', () => {
        expect(npcAmbientLines(createSession({}), npc)).toEqual(['défaut']);
    });

    test('la dernière condition remplie l\'emporte', () => {
        const s = createSession({});
        markEnemyDefeated(s, 'sun_1');
        expect(npcAmbientLines(s, npc)).toEqual(['soleil 1 abattu']);
        markEnemyDefeated(s, 'rice_thief');
        expect(npcAmbientLines(s, npc)).toEqual(['chapardeur chassé']);
    });

    test('progressReached : quête terminée, ennemi vaincu, coffre ouvert, tableau = toutes', () => {
        const s = createSession({});
        expect(progressReached(s, 'sun_1')).toBe(false);
        s.data.quests.q_sun_2 = 'done';
        expect(progressReached(s, 'q_sun_2')).toBe(true);
        s.data.openedChests.push('lotus_cache');
        expect(progressReached(s, ['lotus_cache', 'sun_2'])).toBe(false);
        markEnemyDefeated(s, 'sun_2');
        expect(progressReached(s, ['lotus_cache', 'sun_2'])).toBe(true);
        expect(npcAmbientLines(s, npc)).toEqual(['coffre ET soleil']);
        expect(progressReached(s, undefined)).toBe(false);
        expect(progressReached(s, [])).toBe(false);
    });

    test('talkToNpc utilise la réplique conditionnelle, mais la quête garde la priorité', () => {
        const s = createSession({ screenId: 'rizieres' });
        const lin = SCREENS.rizieres.npcs.find(n => n.id === 'farmer_lin');
        talkToNpc(s, 'farmer_lin');   // la quête du chapardeur démarre
        expect(talkToNpc(s, 'farmer_lin').lines).toEqual(quest('sq_rice_thief').hint);
        s.data.quests.sq_rice_thief = 'done';
        markEnemyDefeated(s, 'sun_1');
        // l'entrée « sun_1 » vient après « sq_rice_thief » dans `talk` : celle-ci l'emporte
        expect(talkToNpc(s, 'farmer_lin').lines).toEqual(lin.talk.find(t => t.whenDone === 'sun_1').lines);
    });

    test('les PNJ évoquent l\'avancement : Chang\'e change de discours au fil des soleils', () => {
        const s = createSession({});
        const change = SCREENS.rizieres.npcs.find(n => n.id === 'change');
        expect(npcAmbientLines(s, change)).toEqual(change.idle);
        markEnemyDefeated(s, 'fengmeng_1');
        const afterDuel = npcAmbientLines(s, change);
        expect(afterDuel).not.toEqual(change.idle);
        markEnemyDefeated(s, 'sun_1');
        expect(npcAmbientLines(s, change)).not.toEqual(afterDuel);
        markEnemyDefeated(s, 'sun_3');
        expect(npcAmbientLines(s, change).join(' ')).toMatch(/élixir/);
        markEnemyDefeated(s, 'fengmeng_2');
        expect(npcAmbientLines(s, change).join(' ')).toMatch(/sourire|souri/);
    });

    test('Chang\'e à la Lune garde le reflet de son envol, puis celui de l\'épilogue', () => {
        const s = createSession({ screenId: 'lune', x: 1, y: 4 });
        const moon = SCREENS.lune.npcs.find(n => n.id === 'change_moon');
        expect(talkToNpc(s, 'change_moon').lines).toEqual(moon.idle);
        markEnemyDefeated(s, 'fengmeng_3a');
        expect(talkToNpc(s, 'change_moon').lines).toEqual(moon.talk.find(t => t.whenDone === 'fengmeng_3a').lines);
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

    test('l\'indice des mirages est cohérent avec le rendu : le vrai soleil a une ombre et un niveau, les mirages non', () => {
        const dawa = SCREENS.gobi.npcs.find(n => n.id === 'guide_dawa');
        const text = [...dawa.idle, ...quest('q_sun_4').hint, ...quest('sq_oasis').offer].join(' ');
        expect(text).toMatch(/ombre/);
        expect(text).toMatch(/scintill/);
        // la maxime « le vrai soleil ne projette pas d'ombre » est explicitement corrigée
        expect(dawa.idle.join(' ')).toMatch(/ne projette pas d'ombre/);
        expect(dawa.idle.join(' ')).toMatch(/se trompent|c'est l'inverse/);
    });
});

describe('showWhen / hideWhen : entités conditionnelles', () => {
    test('Fengmeng phase 2 n\'existe qu\'après la phase 1 : ennemis, aura, entités', () => {
        const s = at('lune', 8, 4);
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('fengmeng_3b');
        expect(entityAt(s, 11, 3)).toBeNull();
        expect(getAuraTiles(s).has('12,2')).toBe(false);     // aura de 3b seule
        expect(isEntityVisible(s, SCREENS.lune.enemies.find(e => e.id === 'fengmeng_3b'))).toBe(false);

        markEnemyDefeated(s, 'fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_3b');
        expect(entityAt(s, 11, 3)).toMatchObject({ type: 'enemy' });
        expect(getAuraTiles(s).has('12,2')).toBe(true);
    });

    test('la phase 2 se déclenche aussitôt après la scène, si le joueur est resté à côté', () => {
        const s = at('lune', 10, 4);
        s.rt.grace = 0;
        expect(tryMove(s, 0, -1).type).toBe('combat');        // (10,3) : dans l'aura de la phase 1
        markEnemyDefeated(s, 'fengmeng_3a');
        const events = tick(s, PATROL_STEP_MS);
        expect(events).toEqual([{ type: 'combat', enemyId: 'fengmeng_3b' }]);
    });

    test('l\'autel n\'existe qu\'après la victoire sur Fengmeng : entityAt, openChest, findPath, rendu', () => {
        const s = at('lune', 8, 4);
        expect(entityAt(s, 12, 4)).toBeNull();
        expect(openChest(s, 'moon_altar')).toBeNull();
        expect(visibleChests(s).map(c => c.id)).not.toContain('moon_altar');
        expect(findPath(s, 12, 4)).not.toBeNull();            // tuile libre tant que l'autel est caché
        markEnemyDefeated(s, 'fengmeng_3a');
        markEnemyDefeated(s, 'fengmeng_3b');
        expect(visibleChests(s).map(c => c.id)).toContain('moon_altar');
        expect(entityAt(s, 12, 4)).toMatchObject({ type: 'chest', opened: false });
        const path = findPath(s, 12, 4);
        expect(path[path.length - 1]).toEqual({ x: 12, y: 4 });
        expect(path.slice(0, -1).some(p => p.x === 12 && p.y === 4)).toBe(false);
        // la dernière étape ouvre l'autel
        s.data.x = 11; s.data.y = 5;
        expect(tryMove(s, 1, 0)).toEqual({ type: 'moved' });
        expect(tryMove(s, 0, -1)).toEqual({ type: 'chest', chestId: 'moon_altar' });
    });

    test('un PNJ avec showWhen n\'existe qu\'une fois la condition remplie (dialogue, entityAt, chemin)', () => {
        const extra = {
            npcs: [{ id: 'ghost', x: 3, y: 2, name: 'G', title: 'T', emoji: 'g', idle: ['boo'], showWhen: 'k' }],
            enemies: [enemyDef('k', 6, 0)]
        };
        const s = synthSession(extra);
        expect(talkToNpc(s, 'ghost')).toBeNull();
        expect(entityAt(s, 3, 2)).toBeNull();
        expect(tryMove(s, 1, 0).type).toBe('moved');
        expect(findPath(s, 4, 2)).toHaveLength(3);            // passe par la tuile du PNJ caché
        markEnemyDefeated(s, 'k');
        expect(talkToNpc(s, 'ghost').lines).toEqual(['boo']);
        expect(entityAt(s, 3, 2)).toMatchObject({ type: 'npc' });
        expect(findPath(s, 4, 2).length).toBeGreaterThan(3);   // contourne désormais le PNJ
    });

    test('hideWhen : le PNJ disparaît une fois la condition remplie', () => {
        const s = synthSession({
            npcs: [{ id: 'leaver', x: 3, y: 2, name: 'L', title: 'T', emoji: 'l', idle: ['salut'], hideWhen: 'k' }],
            enemies: [enemyDef('k', 6, 0)]
        });
        expect(talkToNpc(s, 'leaver').lines).toEqual(['salut']);
        markEnemyDefeated(s, 'k');
        expect(talkToNpc(s, 'leaver')).toBeNull();
        expect(visibleNpcs(s)).toHaveLength(0);
    });

    test('un patrouilleur caché ne bouge pas, ne bloque pas et n\'a pas d\'aura ; il apparaît ensuite', () => {
        const s = synthSession({
            enemies: [
                enemyDef('k', 6, 4),
                enemyDef('p', 2, 0, { kind: 'patrol', patrol: [[2, 0], [5, 0]], showWhen: 'k' })
            ]
        }, { x: 0, y: 4 });
        expect(aliveEnemies(s).map(e => e.def.id)).toEqual(['k']);
        expect(getAuraTiles(s).has('2,1')).toBe(false);
        const before = { ...s.rt.enemies.p };
        expect(tick(s, PATROL_STEP_MS * 3)).toEqual([]);
        expect(s.rt.enemies.p).toMatchObject({ x: before.x, y: before.y });
        markEnemyDefeated(s, 'k');
        expect(aliveEnemies(s).map(e => e.def.id)).toEqual(['p']);
        expect(getAuraTiles(s).has('2,1')).toBe(true);
        tick(s, PATROL_STEP_MS);
        expect(s.rt.enemies.p.x).toBe(3);
    });
});

describe('mirages (illusion)', () => {
    test('entrer dans l\'aura d\'un mirage : pas de combat, il se dissipe', () => {
        const s = at('gobi', 10, 3);
        const res = tryMove(s, 0, -1);   // (10,2), à distance 1 de mirage_1 (9,1)
        const def = SCREENS.gobi.enemies.find(e => e.id === 'mirage_1');
        expect(res).toEqual({ type: 'illusion', enemyId: 'mirage_1', lines: def.illusionLines });
        expect(s.data.defeated).toContain('mirage_1');
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('mirage_1');
        expect(tryMove(s, 0, 1).type).toBe('moved');
    });

    test('toucher un mirage : événement illusion, sans déplacement', () => {
        const s = at('gobi', 9, 2);
        s.rt.grace = 5;   // même en période de grâce
        const res = tryMove(s, 0, -1);
        expect(res).toMatchObject({ type: 'illusion', enemyId: 'mirage_1' });
        expect(res.lines.length).toBeGreaterThan(0);
        expect([s.data.x, s.data.y]).toEqual([9, 2]);
        expect(markEnemyDefeated(s, 'mirage_2')).toEqual([]);
    });

    test('un patrouilleur-illusion se dissipe au contact (tick)', () => {
        const s = synthSession({
            enemies: [enemyDef('m', 0, 0, { kind: 'patrol', patrol: [[0, 0], [4, 0]], illusion: true, permanent: true })]
        }, { x: 2, y: 1 });
        const events = tick(s, PATROL_STEP_MS * 2);
        expect(events).toEqual([expect.objectContaining({ type: 'illusion', enemyId: 'm' })]);
        expect(isEnemyIllusionGone(s, 'm')).toBe(true);
        expect(tick(s, PATROL_STEP_MS * 4)).toEqual([]);
    });
    const isEnemyIllusionGone = (s, id) => !aliveEnemies(s).some(e => e.def.id === id);

    test('le vrai soleil des mirages n\'est pas une illusion : le contact lance le combat', () => {
        const s = at('gobi', 11, 7);
        expect(tryMove(s, 0, 1)).toEqual({ type: 'combat', enemyId: 'sun_4' });
        const aura = at('gobi', 11, 6);
        expect(tryMove(aura, 0, 1)).toEqual({ type: 'combat', enemyId: 'sun_4' });   // (11,7) est dans son aura
    });

    test('la rencontre d\'un mirage a la même apparence que le vrai soleil, mais pas son niveau de boss', () => {
        const s = createSession({});
        const enc = encounterFor(s, 'mirage_2', 7);
        expect(enc.spriteKey).toBe('sun_4');
        expect(enc.boss).toBeNull();
    });

    test('un vrai combat l\'emporte sur un mirage quand les deux sont à portée', () => {
        const s = synthSession({
            enemies: [enemyDef('m', 2, 1, { illusion: true, permanent: true }), enemyDef('r', 4, 1)]
        }, { x: 3, y: 3 });
        expect(tryMove(s, 0, -1)).toEqual({ type: 'combat', enemyId: 'r' });  // (3,2) touche les deux
        expect(s.data.defeated).not.toContain('m');
    });
});

describe('soleil protégé (shieldedBy)', () => {
    const pack = ['pack_wolf_a', 'pack_boar', 'pack_tiger', 'pack_wolf_b'];

    test('tant que la meute vit : ni aura ni combat, le contact renvoie les lignes d\'explication', () => {
        const s = at('fauves', 11, 7);
        const def = SCREENS.fauves.enemies.find(e => e.id === 'sun_7');
        expect(isShielded(s, def)).toBe(true);
        expect(getAuraTiles(s).has('11,7')).toBe(false);
        expect(tick(s, PATROL_STEP_MS)).toEqual([]);
        expect(tryMove(s, 0, 1)).toEqual({ type: 'shielded', enemyId: 'sun_7', lines: def.shieldLines });
        expect([s.data.x, s.data.y]).toEqual([11, 7]);
        // la période de grâce n'y change rien
        s.rt.grace = 3;
        expect(tryMove(s, 0, 1).type).toBe('shielded');
    });

    test('la meute elle-même combat normalement', () => {
        const s = at('fauves', 10, 5);
        expect(getAuraTiles(s).has('10,6')).toBe(true);           // aura du loup (9,7)
        expect(tryMove(s, 0, 1)).toEqual({ type: 'combat', enemyId: 'pack_wolf_a' });
    });

    test('le bouclier tombe quand tout le groupe est vaincu', () => {
        const s = at('fauves', 11, 7);
        const def = SCREENS.fauves.enemies.find(e => e.id === 'sun_7');
        pack.slice(0, 3).forEach(id => markEnemyDefeated(s, id));
        expect(isShielded(s, def)).toBe(true);
        expect(tryMove(s, 0, 1).type).toBe('shielded');
        markEnemyDefeated(s, pack[3]);
        expect(isShielded(s, def)).toBe(false);
        expect(getAuraTiles(s).has('11,7')).toBe(true);
        expect(tryMove(s, 0, 1)).toEqual({ type: 'combat', enemyId: 'sun_7' });
    });

    test('le bouclier est persistant : la meute ne revient pas, le soleil non plus quand il est vaincu', () => {
        const s = at('fauves', 1, 5);
        pack.forEach(id => markEnemyDefeated(s, id));
        enterScreen(s, 'volcan', { x: 12, y: 5 });
        enterScreen(s, 'fauves', { x: 1, y: 5 });
        expect(aliveEnemies(s).filter(e => e.def.group === 'beast_pack')).toHaveLength(0);
        expect(isShielded(s, SCREENS.fauves.enemies.find(e => e.id === 'sun_7'))).toBe(false);
    });

    test('un groupe inexistant ne protège pas (donnée incohérente tolérée)', () => {
        const s = synthSession({ enemies: [enemyDef('boss', 3, 2, { shieldedBy: 'rien' })] });
        expect(isShielded(s, s.screens.t.enemies[0])).toBe(false);
    });
});

describe('scènes de fin de duel (defeatScene)', () => {
    test('markEnemyDefeated renvoie l\'événement scene, une seule fois, avant les quêtes', () => {
        const s = createSession({});
        talkToNpc(s, 'elder_wen');
        const def = SCREENS.rizieres.enemies.find(e => e.id === 'fengmeng_1');
        const events = markEnemyDefeated(s, 'fengmeng_1');
        expect(events).toEqual([{ type: 'scene', speaker: def.defeatScene.speaker, lines: def.defeatScene.lines }]);
        expect(events[0].speaker).toMatchObject({ name: 'Fengmeng', enemy: 'fengmeng_1' });
        expect(markEnemyDefeated(s, 'fengmeng_1')).toEqual([]);          // pas de doublon
        expect(markEnemyDefeated(s, 'rizieres_goblin')).toEqual([]);     // pas de scène pour un ennemi normal
    });

    test('la scène précède l\'événement de quête dans le même lot', () => {
        const s = createSession({});
        talkToNpc(s, 'elder_wen');
        s.screens.rizieres.enemies.find(e => e.id === 'sun_1').defeatScene = { speaker: { name: 'X' }, lines: ['a', 'b'] };
        const events = markEnemyDefeated(s, 'sun_1');
        delete s.screens.rizieres.enemies.find(e => e.id === 'sun_1').defeatScene;
        expect(events.map(e => e.type)).toEqual(['scene', 'questCompleted', 'questStarted']);
    });

    test('Chang\'e boit l\'élixir : scène de la phase 1, puis Fengmeng entre en fureur', () => {
        const s = at('lune', 8, 4);
        const events = markEnemyDefeated(s, 'fengmeng_3a');
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('scene');
        const text = events[0].lines.join(' ');
        expect(text).toMatch(/élixir/);
        expect(text).toMatch(/lune/);
        expect(text).toMatch(/Fengmeng hurle/);
    });
});

describe('sorties verrouillées (exit.requires)', () => {
    test('une sortie reste fermée tant que le soleil de la région n\'est pas abattu', () => {
        const s = at('rizieres', 12, 4);
        const exit = SCREENS.rizieres.exits[0];
        expect(isExitLocked(s, exit)).toBe(true);
        const res = tryMove(s, 1, 0, { playerLevel: 50 });
        expect(res).toEqual({
            type: 'exitBlocked', reason: 'quest', label: 'Lit du Fleuve Jaune', regionName: 'Lit du Fleuve Jaune', message: exit.lockedMessage
        });
        expect([s.data.screenId, s.data.x, s.data.y]).toEqual(['rizieres', 12, 4]);
        markEnemyDefeated(s, 'sun_1');
        expect(isExitLocked(s, exit)).toBe(false);
        expect(tryMove(s, 1, 0, { playerLevel: 50 }).type).toBe('transition');
    });

    test('la condition de quête passe avant le niveau, la sortie ouest reste toujours libre', () => {
        const s = at('fleuve', 12, 5);
        expect(tryMove(s, 1, 0, { playerLevel: 1 })).toMatchObject({ type: 'exitBlocked', reason: 'quest' });
        const back = at('fleuve', 1, 4);
        expect(tryMove(back, -1, 0, { playerLevel: 1 }).type).toBe('transition');
    });

    test('une sortie sans `requires` n\'est jamais verrouillée, un tableau exige toutes les conditions', () => {
        const s = createSession({});
        expect(isExitLocked(s, { x: 0, y: 0 })).toBe(false);
        const exit = { requires: ['sun_1', 'sun_2'] };
        markEnemyDefeated(s, 'sun_1');
        expect(isExitLocked(s, exit)).toBe(true);
        markEnemyDefeated(s, 'sun_2');
        expect(isExitLocked(s, exit)).toBe(false);
    });

    test('toutes les sorties est se rouvrent dans l\'ordre de l\'histoire', () => {
        const s = createSession({});
        ORDER.slice(0, 9).forEach((id, i) => {
            const east = SCREENS[id].exits.find(e => e.x === 13);
            expect(isExitLocked(s, east)).toBe(true);
            markEnemyDefeated(s, `sun_${i + 1}`);
            expect(isExitLocked(s, east)).toBe(false);
        });
    });
});

describe('Nouvelle Partie +', () => {
    const endedSession = () => {
        const s = createSession({ introSeen: true });
        talkToNpc(s, 'elder_wen');
        ORDER.slice(0, 9).forEach((id, i) => markEnemyDefeated(s, `sun_${i + 1}`));
        markEnemyDefeated(s, 'fengmeng_3a');
        markEnemyDefeated(s, 'fengmeng_3b');
        goto(s, 'lune');
        openChest(s, 'moon_altar');
        s.data.visitedScreens = [...ORDER];
        return s;
    };

    test('n\'est possible qu\'une fois l\'épilogue joué', () => {
        const s = createSession({});
        const before = JSON.stringify(s.data);
        expect(startNewGamePlus(s)).toBe(false);
        expect(JSON.stringify(s.data)).toBe(before);
        expect(s.data.ngPlus).toBe(0);
    });

    test('remet l\'histoire à zéro, replace le héros au départ, garde introSeen et incrémente ngPlus', () => {
        const s = endedSession();
        expect(s.data.ended).toBe(true);
        expect(startNewGamePlus(s)).toBe(true);
        expect(s.data).toMatchObject({
            screenId: 'rizieres', x: SCREENS.rizieres.spawn.x, y: SCREENS.rizieres.spawn.y,
            quests: {}, defeated: [], openedChests: [], visitedScreens: ['rizieres'],
            ended: false, introSeen: true, ngPlus: 1
        });
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_1');
        expect(s.rt.grace).toBeGreaterThan(0);
        expect(questStatus(s, quest('q_sun_1'))).toBe('available');
        expect(currentObjectiveText(s)).toContain('Doyen Wen');
        // les verrous de l'histoire sont revenus
        expect(isExitLocked(s, SCREENS.rizieres.exits[0])).toBe(true);
        // et l'autel est de nouveau caché
        goto(s, 'lune');
        expect(visibleChests(s).map(c => c.id)).not.toContain('moon_altar');
    });

    test('la première visite des écrans redéclenche les textes d\'arrivée', () => {
        const s = endedSession();
        startNewGamePlus(s);
        markEnemyDefeated(s, 'sun_1');
        s.data.x = 12; s.data.y = 4;
        const res = tryMove(s, 1, 0, { playerLevel: 5 });
        expect(res).toMatchObject({ type: 'transition', to: 'fleuve', firstVisit: true });
        expect(res.arrival).toEqual(SCREENS.fleuve.arrival);
    });

    test('les cycles se cumulent, chacun demande de terminer l\'histoire', () => {
        const s = endedSession();
        startNewGamePlus(s);
        expect(startNewGamePlus(s)).toBe(false);   // `ended` est retombé à false
        ORDER.slice(0, 9).forEach((id, i) => markEnemyDefeated(s, `sun_${i + 1}`));
        markEnemyDefeated(s, 'fengmeng_3a');
        markEnemyDefeated(s, 'fengmeng_3b');
        goto(s, 'lune');
        talkToNpc(s, 'elder_wen');   // sans effet hors de l'écran
        s.data.quests.q_epilogue = 'active';
        openChest(s, 'moon_altar');
        expect(s.data.ended).toBe(true);
        expect(startNewGamePlus(s)).toBe(true);
        expect(s.data.ngPlus).toBe(2);
    });

    test('les ennemis sont plus puissants en Nouvelle Partie +', () => {
        const s = endedSession();
        startNewGamePlus(s);
        expect(encounterFor(s, 'sun_1', 20).level).toBe(20);               // le niveau du joueur reste le plancher
        expect(encounterFor(s, 'sun_9', 1).boss.level).toBe(17 + 3);
        expect(encounterFor(s, 'fengmeng_3a', 1).boss.level).toBe(18 + 3);
        expect(encounterFor(s, 'rizieres_shroom', 5).level).toBe(5 + 1);
    });

    test('le journal est vide au départ d\'une Nouvelle Partie +, la progression reste sérialisable', () => {
        const s = endedSession();
        startNewGamePlus(s);
        expect(journalEntries(s).map(e => e.quest.id).filter(id => !id.startsWith('sq_'))).toEqual(['q_sun_1']);
        const copy = createSession(JSON.parse(JSON.stringify(s.data)));
        expect(copy.data.ngPlus).toBe(1);
        expect(copy.data.defeated).toEqual([]);
    });
});

describe('texte d\'arrivée', () => {
    test('renvoyé une seule fois, à la première visite de l\'écran', () => {
        const s = at('rizieres', 12, 4);
        markEnemyDefeated(s, 'sun_1');
        const first = tryMove(s, 1, 0, { playerLevel: 5 });
        expect(first).toMatchObject({ type: 'transition', to: 'fleuve', firstVisit: true });
        expect(first.arrival).toEqual(SCREENS.fleuve.arrival);
        // retour aux rizières puis nouvelle entrée au lit du fleuve : plus de texte
        enterScreen(s, 'rizieres', { x: 12, y: 4 });
        const again = tryMove(s, 1, 0, { playerLevel: 5 });
        expect(again).toMatchObject({ type: 'transition', to: 'fleuve', firstVisit: false });
        expect(again.arrival).toBeUndefined();
    });

    test('une sauvegarde qui a déjà visité l\'écran ne rejoue pas le texte', () => {
        const s = createSession({ screenId: 'rizieres', x: 12, y: 4, visitedScreens: ['rizieres', 'fleuve'], defeated: ['sun_1'] });
        expect(tryMove(s, 1, 0, { playerLevel: 5 }).arrival).toBeUndefined();
    });

    test('l\'écran de départ (couvert par le prologue) n\'a pas de texte d\'arrivée', () => {
        const s = createSession({ screenId: 'fleuve', x: 1, y: 4, visitedScreens: ['fleuve'] });
        s.rt.grace = 0;
        const res = tryMove(s, -1, 0, { playerLevel: 1 });
        expect(res).toMatchObject({ type: 'transition', to: 'rizieres', firstVisit: true });   // 1re visite, mais pas de texte
        expect(res.arrival).toBeUndefined();
    });

    test('les écrans d\'exploration (hors départ) ont un texte d\'arrivée non vide', () => {
        screens.filter(s => s.id !== START_SCREEN).forEach(s => expect(s.arrival.length).toBeGreaterThan(0));
        expect(SCREENS.volcan.arrival.join(' ')).toMatch(/Fengmeng/);
        expect(SCREENS.fusang.arrival.join(' ')).toMatch(/Dixième|dixième/);
    });
});

describe('déplacement au clic (findPath)', () => {
    const atClick = (screenId, x, y) => at(screenId, x, y);

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
        expect(findPath(atClick('rizieres', 3, 4), 3, 4)).toEqual([]);
    });

    test('chemin le plus court en ligne droite, sans diagonale', () => {
        const path = findPath(atClick('rizieres', 3, 4), 5, 4);
        expect(path).toEqual([{ x: 4, y: 4 }, { x: 5, y: 4 }]);
        const s = atClick('rizieres', 3, 4);
        expect(walk(s, findPath(s, 5, 4))).toBeTruthy();
    });

    test('contourne les obstacles', () => {
        // maison en (1..3, 1..2) : de (0,1) à (4,1), il faut passer par-dessous
        const s = atClick('rizieres', 0, 1);
        const path = findPath(s, 4, 1);
        expect(path).not.toBeNull();
        expect(path.length).toBeGreaterThan(4);
        path.forEach(p => expect(isTerrainBlocked(SCREENS.rizieres, p.x, p.y)).toBe(false));
        expect(walk(s, path)).toEqual({ type: 'moved' });
        expect([s.data.x, s.data.y]).toEqual([4, 1]);
    });

    test('destination invalide : obstacle, liquide, hors carte ou non entière', () => {
        const s = atClick('rizieres', 3, 4);
        expect(findPath(s, 2, 2)).toBeNull();   // maison
        expect(findPath(s, 1, 8)).toBeNull();   // mare
        expect(findPath(s, -1, 4)).toBeNull();
        expect(findPath(s, 14, 4)).toBeNull();
        expect(findPath(s, 3.5, 4)).toBeNull();
    });

    test('destination isolée : null', () => {
        // PNJ muré par quatre obstacles : sa tuile est valide mais aucune case voisine n'est accessible
        const s = synthSession({
            obstacles: [[3, 1, 1, 1], [3, 3, 1, 1], [2, 2, 1, 1], [4, 2, 1, 1]],
            npcs: [{ id: 'n', x: 3, y: 2, name: 'N', title: 'T', emoji: 'n', idle: ['…'] }]
        });
        expect(findPath(s, 3, 2)).toBeNull();
    });

    test('vers un PNJ : le chemin finit sur sa tuile et la dernière étape ouvre le dialogue', () => {
        const s = atClick('rizieres', 3, 4);
        const path = findPath(s, 2, 3);
        expect(path[path.length - 1]).toEqual({ x: 2, y: 3 });
        expect(walk(s, path)).toEqual({ type: 'talk', npcId: 'change' });
        expect([s.data.x, s.data.y]).not.toEqual([2, 3]);
    });

    test('vers un coffre : la dernière étape l\'ouvre', () => {
        const s = atClick('rizieres', 3, 7);
        const path = findPath(s, 3, 9);
        expect(path).not.toBeNull();
        expect(walk(s, path)).toEqual({ type: 'chest', chestId: 'lotus_cache' });
    });

    test('un PNJ ou un coffre n\'est jamais un point de passage', () => {
        const s = atClick('rizieres', 1, 3);
        // Chang'e est en (2,3) : aller de (1,3) à (3,3) impose de la contourner
        const path = findPath(s, 3, 3);
        expect(path.some(p => p.x === 2 && p.y === 3)).toBe(false);
        expect(path.length).toBe(4);
    });

    test('vers un ennemi : la dernière étape lance le combat', () => {
        const s = atClick('rizieres', 3, 4);
        const path = findPath(s, 6, 4);
        expect(path[path.length - 1]).toEqual({ x: 6, y: 4 });
        expect(walk(s, path)).toMatchObject({ type: 'combat', enemyId: 'fengmeng_1' });
    });

    test('un ennemi n\'est jamais traversé', () => {
        const s = atClick('fleuve', 1, 4);
        const path = findPath(s, 12, 4);
        aliveEnemies(s).forEach(e => expect(path.some(p => p.x === e.x && p.y === e.y)).toBe(false));
    });

    test('un mirage ou un boss protégé reste une destination valide (dialogue au lieu du combat)', () => {
        const g = atClick('gobi', 9, 2);
        g.rt.grace = 0;
        expect(findPath(g, 9, 1)).toEqual([{ x: 9, y: 1 }]);
        expect(walk(g, findPath(g, 9, 1))).toMatchObject({ type: 'illusion', enemyId: 'mirage_1' });
        const f = atClick('fauves', 11, 7);
        expect(walk(f, findPath(f, 11, 8))).toMatchObject({ type: 'shielded', enemyId: 'sun_7' });
    });

    test('prend toujours le plus court chemin, même à travers la zone de vigilance d\'un ennemi', () => {
        const s = synthSession({ enemies: [enemyDef('g', 3, 1)] });
        const path = findPath(s, 6, 2);
        // ligne droite (6 pas) alors qu'un détour existerait : le trajet ne cherche pas à éviter l'ennemi
        expect(path).toHaveLength(6);
        expect(path.every(p => p.y === 2)).toBe(true);
        // et le parcours réveille bien l'ennemi (zone de vigilance atteinte)
        expect(walk(s, path)).toEqual({ type: 'combat', enemyId: 'g' });
    });

    test('la longueur du chemin est minimale (Manhattan quand la voie est libre)', () => {
        const s = atClick('rizieres', 0, 5);
        const path = findPath(s, 5, 5);
        expect(path).toHaveLength(5);
    });

    test('une sortie n\'est franchie que si c\'est la destination', () => {
        const s = atClick('rizieres', 12, 3);
        markEnemyDefeated(s, 'sun_1');
        const toExit = findPath(s, 13, 4);
        expect(toExit[toExit.length - 1]).toEqual({ x: 13, y: 4 });
        expect(walk(s, toExit)).toMatchObject({ type: 'transition', to: 'fleuve' });
        // aller à côté de la sortie ne fait pas changer d'écran
        const s2 = atClick('rizieres', 12, 3);
        walk(s2, findPath(s2, 12, 5));
        expect(s2.data.screenId).toBe('rizieres');
    });

    test('la sortie bloquée (niveau ou soleil vivant) ne fait pas changer d\'écran', () => {
        const s = atClick('rizieres', 12, 4);
        const path = findPath(s, 13, 4);
        expect(path).toEqual([{ x: 13, y: 4 }]);
        expect(tryMove(s, 1, 0, { playerLevel: 20 })).toMatchObject({ type: 'exitBlocked', reason: 'quest' });
        markEnemyDefeated(s, 'sun_1');
        expect(tryMove(s, 1, 0, { playerLevel: 1 })).toMatchObject({ type: 'exitBlocked', reason: 'level', minLevel: 2 });
        expect(s.data.screenId).toBe('rizieres');
        expect(tryMove(s, 1, 0, { playerLevel: 2 }).type).toBe('transition');
    });
});

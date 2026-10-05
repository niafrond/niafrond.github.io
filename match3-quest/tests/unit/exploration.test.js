import { readFileSync } from 'fs';
import { JUNCTIONS } from '../../world/junctions.js';
import { buildLegacyWorld, SCREENS, QUESTS, REGION_UNLOCK_LEVEL, REGION_ENTRY_SCREEN, STORY_ENDING, STORY_INTRO, STORY_TITLE } from '../../story.js';
import {
    createSession, tryMove, tick, isTerrainBlocked, buildRoute, aliveEnemies, entityAt, getAuraTiles,
    markEnemyDefeated, talkToNpc, npcAmbientLines, progressReached, openChest, questStatus, checkAutoQuests, currentObjectiveText,
    encounterFor, enemyLevel, enterScreen, respawns, blocksPath, teleportToScreen, resetAfterDefeat, startNewGamePlus,
    isEntityVisible, visibleNpcs, visibleChests, isShielded, isExitLocked, journalEntries, npcMarker, activateWaypoint, fastTravel, waypointList,
    houseMarkers, screenQuestMarker, questDirection, setTrackedQuest,
    AGGRO_RADIUS, aggroOf, PATROL_STEP_MS, GRACE_MOVES, START_SCREEN, findPath
} from '../../exploration.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
// Les tests de structure historiques portent sur les 10 sanctuaires (14x10) ; le Grand Monde a ses tests dans world.test.js.
const ORDER_IDS = ['rizieres', 'fleuve', 'bambous', 'gobi', 'tonnerre', 'volcan', 'fauves', 'mer', 'fusang', 'lune'];
// Le monde de la légende (l'Arène des Mille Flèches, hors chaîne des régions, a ses propres tests : arena.test.js).
const screens = Object.values(SCREENS).filter(s => !s.arena);
const sanctuaries = ORDER_IDS.map(id => SCREENS[id]);
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
// Dans une zone sauvage, seule l'entrée côté village compte (l'autre côté n'est accessible qu'après le gate).
// Un boss qui garde une porte (guardsDoor) ne protège pas l'arrivée côté porte : la porte n'est franchissable qu'après sa mort.
const doorGuards = s => s.enemies.filter(e => e.guardsDoor);
const starts = s => {
    if (s.kind === 'wild') return wildEntries(s);
    const behindGuard = a => doorGuards(s).some(g => Math.max(Math.abs(g.x - a.x), Math.abs(g.y - a.y)) <= (g.aggro || 1) + 1);
    return FORCED.includes(s.id) ? [s.spawn] : [s.spawn, ...arrivals(s).filter(a => !behindGuard(a))];
};
// Tuiles d'arrivée dans la zone sauvage venant du village ou du hameau de la région.
const wildEntries = s => Object.values(SCREENS).filter(o => o.region === s.region && o.kind === 'village')
    .flatMap(o => o.exits.filter(e => e.to === s.id).map(e => e.arrive));
// Dans la nature, les sentinelles gardent les passages (le gate lui-même est un combat) : on exige seulement une voie
// à pied, combats compris ; ailleurs (sanctuaires, villages, maisons) la voie doit rester hors de toute vigilance.
const approachBlockers = s => (s.kind === 'wild' ? entityTiles(s) : auraOfAll(s));
const entityTiles = s => new Set([...s.npcs, ...s.chests].map(e => `${e.x},${e.y}`));

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
    const mark = (px, py, r) => {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) forbidden.add(`${px + dx},${py + dy}`);
        }
    };
    screen.enemies.forEach(e => {
        const r = aggroOf(e);   // 2 sur les cartes agrandies
        if (e.kind === 'patrol') buildRoute(e.patrol).forEach(p => mark(p.x, p.y, r));
        else mark(e.x, e.y, r);
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
const enemyDef = (id, x, y, extra = {}) => ({ id, templateId: 'goblin_saboteur', name: id, kind: 'sentinel', x, y, offset: 0, ...extra });
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
// Monde « à l'ancienne » (cartes à leur taille d'origine, aura de 1 case) : les tests de mécanique du moteur s'appuient sur les
// coordonnées historiques des sanctuaires ; les cartes agrandies ont leurs propres tests (expand / junctions / aquatic).
const LEGACY = buildLegacyWorld();
const atL = (screenId, x, y, patch = {}) => {
    const s = createSession({ screenId, x, y, ...patch }, LEGACY.screens, LEGACY.quests);
    s.rt.grace = 0;
    return s;
};
// Passage de bord (world/expand.js) : sortie centrale de `id` vers `to`, case juste avant elle et direction pour la franchir.
const gateOf = (id, to) => SCREENS[id].exits.find(e => e.to === to && !e.door && (e.span ?? 0) === 0);
const beforeGate = (id, to) => {
    const sc = SCREENS[id], ex = gateOf(id, to);
    const dx = ex.x === 0 ? -1 : ex.x === sc.w - 1 ? 1 : 0;
    const dy = ex.y === 0 ? -1 : ex.y === sc.h - 1 ? 1 : 0;
    return { ex, dx, dy, x: ex.x - dx, y: ex.y - dy };
};
const atGate = (id, to, patch) => { const g = beforeGate(id, to); return { ...g, s: at(id, g.x, g.y, patch) }; };
const quest = id => QUESTS.find(q => q.id === id);

// ── Helpers de parcours : le héros traverse réellement le Grand Monde ─────────────────────────
// village → zone sauvage → (gate) → sanctuaire. Les combats rencontrés sont gagnés d'office
// (markEnemyDefeated) ; tout le reste passe par findPath / tryMove / talkToNpc / openChest.
const WORLD_LEVEL = 30;   // niveau du héros pendant les parcours : on ne teste pas l'avertissement de niveau ici
const guard = new WeakMap();   // pile de quêtes/portes en cours de résolution (détecte les dépendances circulaires)
const enter = (s, key) => {
    const stack = guard.get(s) || new Set();
    if (stack.has(key)) throw new Error(`dépendance circulaire sur ${key} : [${[...stack].join(' > ')}]`);
    stack.add(key);
    guard.set(s, stack);
    return () => stack.delete(key);
};

// Marche jusqu'à (x, y) avec findPath + tryMove ; un combat rencontré est gagné puis le trajet est recalculé.
// Retourne le dernier résultat de tryMove (+ `fights` : événements des combats gagnés en chemin).
function walkTo(s, x, y) {
    const fights = [];
    for (let attempt = 0; attempt < 30; attempt++) {
        const path = findPath(s, x, y);
        if (!path) throw new Error(`aucun chemin vers (${x},${y}) sur ${s.data.screenId} depuis (${s.data.x},${s.data.y})`);
        let last = { type: 'moved' };
        let interrupted = false;
        for (const step of path) {
            last = tryMove(s, step.x - s.data.x, step.y - s.data.y, { playerLevel: WORLD_LEVEL });
            if (last.type === 'combat') { fights.push(...markEnemyDefeated(s, last.enemyId)); interrupted = true; break; }
            if (last.type === 'illusion') { interrupted = true; break; }
            if (last.type !== 'moved') break;
        }
        if (!interrupted) return { ...last, fights };
        if (s.data.x === x && s.data.y === y) return { type: 'moved', fights };
    }
    throw new Error(`trajet interrompu trop souvent vers (${x},${y}) sur ${s.data.screenId}`);
}

// Première sortie à prendre pour aller de `from` à `to` (plus court chemin en nombre d'écrans).
function nextExit(s, from, to) {
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length && !prev.has(to)) {
        const id = queue.shift();
        s.screens[id].exits.forEach(e => { if (!prev.has(e.to)) { prev.set(e.to, { id, exit: e }); queue.push(e.to); } });
    }
    if (!prev.has(to)) throw new Error(`aucune route de ${from} vers ${to}`);
    let node = to;
    while (prev.get(node).id !== from) node = prev.get(node).id;
    return prev.get(node).exit;
}

// Traverse le monde jusqu'à l'écran voulu, en remplissant les conditions des sorties verrouillées.
// Retourne { transitions, events } (résultats de tryMove des franchissements, événements de quêtes/combats).
function travel(s, target) {
    const transitions = [];
    const events = [];
    for (let hops = 0; hops < 200 && s.data.screenId !== target; hops++) {
        const exit = nextExit(s, s.data.screenId, target);
        if (isExitLocked(s, exit)) { satisfy(s, exit.requires); continue; }
        const res = walkTo(s, exit.x, exit.y);
        events.push(...res.fights);
        if (res.type !== 'transition') throw new Error(`sortie ${s.data.screenId} -> ${exit.to} non franchie : ${JSON.stringify(res)}`);
        transitions.push(res);
        events.push(...res.events);
    }
    if (s.data.screenId !== target) throw new Error(`écran ${target} non atteint (bloqué sur ${s.data.screenId})`);
    return { transitions, events };
}

// Remplit une condition d'avancement (gate) en jouant : quête, ennemi à vaincre ou coffre à ouvrir.
function satisfy(s, cond) {
    if (Array.isArray(cond)) return cond.forEach(c => satisfy(s, c));
    if (progressReached(s, cond)) return;
    if (s.quests.some(q => q.id === cond)) return playQuest(s, cond);
    if (s.rt.enemyIndex[cond]) return defeat(s, cond);
    if (Object.values(s.screens).some(sc => sc.chests.some(c => c.id === cond))) return openChestAt(s, cond);
    throw new Error(`condition inconnue : ${cond}`);
}

// Va jusqu'à l'ennemi et le bat (marche jusqu'à lui quand il est fixe). Retourne tous les événements produits.
function defeat(s, id) {
    const done = enter(s, `kill:${id}`);
    try {
        const { def, screenId } = s.rt.enemyIndex[id];
        const events = travel(s, screenId).events;
        if (!s.data.defeated.includes(id)) {
            if (def.kind !== 'patrol' && !def.illusion && !def.shieldedBy && isEntityVisible(s, def)) events.push(...walkTo(s, def.x, def.y).fights);
            events.push(...markEnemyDefeated(s, id));
        }
        return events;
    } finally { done(); }
}

function openChestAt(s, id) {
    const done = enter(s, `chest:${id}`);
    try {
        const screen = Object.values(s.screens).find(sc => sc.chests.some(c => c.id === id));
        const chest = screen.chests.find(c => c.id === id);
        travel(s, screen.id);
        if (s.data.openedChests.includes(id)) return null;
        const res = walkTo(s, chest.x, chest.y);
        if (res.type !== 'chest' || res.chestId !== id) throw new Error(`coffre ${id} non atteint : ${JSON.stringify(res)}`);
        return openChest(s, id);
    } finally { done(); }
}

// Va parler à un PNJ (marche jusqu'à sa tuile, puis talkToNpc) ; retourne le résultat de talkToNpc.
function talkTo(s, npcId) {
    const screen = Object.values(s.screens).find(sc => sc.npcs.some(n => n.id === npcId));
    if (!screen) throw new Error(`PNJ introuvable : ${npcId}`);
    travel(s, screen.id);
    const npc = screen.npcs.find(n => n.id === npcId);
    const res = walkTo(s, npc.x, npc.y);
    if (res.type !== 'talk' || res.npcId !== npcId) throw new Error(`PNJ ${npcId} non abordé : ${JSON.stringify(res)}`);
    return talkToNpc(s, npcId);
}

// Joue une quête de bout en bout (prérequis compris) : offre, objectifs, remise.
function playQuest(s, id) {
    if (s.data.quests[id] === 'done') return;
    const done = enter(s, `quest:${id}`);
    try {
        const q = s.quests.find(x => x.id === id);
        q.requires.forEach(r => playQuest(s, r));
        for (let i = 0; i < 8 && q.giver && !s.data.quests[id]; i++) talkTo(s, q.giver);   // un PNJ peut proposer une autre quête d'abord
        if (q.autoStart) checkAutoQuests(s);
        for (const o of q.objectives) {
            if (o.type === 'kill') defeat(s, o.target);
            else if (o.type === 'killGroup') Object.values(s.rt.enemyIndex).filter(e => e.def.group === o.target).forEach(e => defeat(s, e.def.id));
            else if (o.type === 'chest') openChestAt(s, o.target);
            else if (o.type === 'talk') talkTo(s, o.target);
            else if (o.type === 'visit') travel(s, o.target);
        }
        if (s.data.quests[id] !== 'done' && q.turnIn) talkTo(s, q.turnIn);
        if (s.data.quests[id] !== 'done') throw new Error(`quête ${id} non terminée (état : ${s.data.quests[id]})`);
    } finally { done(); }
}

// Joue toute l'histoire principale (9 soleils, Fengmeng, épilogue) à travers le monde, sans aucune quête optionnelle
// (hors celles qui ferment une sortie). Retourne la session.
function completeStory(s) {
    QUESTS.filter(q => !q.side).forEach(q => playQuest(s, q.id));
    return s;
}

describe('cartes (story.js)', () => {
    test.each(sanctuaries.map(s => [s.id, s]))('%s : dimensions, entités et sorties valides', (_id, s) => {
        expect([s.w, s.h]).toEqual([26, 20]);   // grande carte (world/expand.js)
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
        s.npcs.forEach(n => { place('npc', n.x, n.y); expect(n.emoji).toBeUndefined(); expect(n.name).toBeTruthy(); expect(n.title).toBeTruthy(); });
        s.chests.forEach(c => place('chest', c.x, c.y));
        s.enemies.forEach(e => {
            place('enemy', e.x, e.y);
            expect(templateIds.has(e.templateId)).toBe(true);
            expect(e.emoji).toBeUndefined();
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
            const back = target.exits.find(e => e.to === s.id && Math.abs(e.x - ex.arrive.x) + Math.abs(e.y - ex.arrive.y) === 1);
            expect(back).toBeDefined();
            expect(target.exits.some(e => e.x === ex.arrive.x && e.y === ex.arrive.y)).toBe(false);
        });
    });

    test.each(sanctuaries.map(s => [s.id, s]))('%s : toutes les entités et sorties sont atteignables à pied', (_id, s) => {
        const free = reachable(s, s.spawn);
        s.exits.forEach(ex => expect(free.has(`${ex.x},${ex.y}`)).toBe(true));
        arrivals(s).forEach(a => expect(free.has(`${a.x},${a.y}`)).toBe(true));
        const adjacentReachable = (x, y) => DIRS.some(([dx, dy]) => free.has(`${x + dx},${y + dy}`));
        s.npcs.forEach(n => expect(adjacentReachable(n.x, n.y)).toBe(true));
        s.chests.forEach(c => expect(adjacentReachable(c.x, c.y)).toBe(true));
    });

    test('le monde est une chaîne : sanctuaire précédent → village → zone sauvage → sanctuaire, sorties symétriques', () => {
        expect(Object.keys(SCREENS).slice(0, 10)).toEqual(ORDER);   // les sanctuaires gardent leur ordre d'origine
        expect(START_SCREEN).toBe('rizieres_village');
        ORDER.forEach((id, i) => {
            const sanctuary = SCREENS[id];
            const village = SCREENS[`${id}_village`];
            const wild = SCREENS[`${id}_wild`];
            [village, wild].forEach(z => { expect(z).toBeDefined(); expect(z.region).toBe(id); });
            expect(village.kind).toBe('village');
            expect(wild.kind).toBe('wild');
            const exitTo = (screen, to) => screen.exits.find(e => e.to === to);

            // village : ouest = sanctuaire précédent (sauf au départ), est = zone sauvage
            if (i === 0) expect(village.exits.some(e => e.x === 0 && !e.door)).toBe(false);
            else expect(exitTo(village, ORDER[i - 1])).toMatchObject({ x: 0 });
            expect(exitTo(village, wild.id)).toMatchObject({ x: village.w - 1 });
            // zone sauvage : ouest = village, est = sanctuaire (fermée par un gate)
            expect(exitTo(wild, village.id)).toMatchObject({ x: 0 });
            expect(exitTo(wild, id)).toMatchObject({ x: wild.w - 1 });
            // sanctuaire : ouest = zone sauvage, est = village de la région suivante (fermée par le soleil)
            const west = sanctuary.exits.find(e => e.x === 0);
            const east = sanctuary.exits.find(e => e.x === sanctuary.w - 1);
            expect(west.to).toBe(wild.id);
            if (i === ORDER.length - 1) expect(east).toBeUndefined(); else expect(east.to).toBe(`${ORDER[i + 1]}_village`);
            expect(new Set(sanctuary.exits.map(e => e.to)).size).toBe(east ? 2 : 1);   // chaque passage = 3 sorties alignées
            // le sanctuaire ne mène plus directement à un autre sanctuaire
            sanctuary.exits.forEach(e => expect(ORDER.includes(e.to)).toBe(false));

            // arrivées : à côté de la sortie voisine ; le spawn d'un sanctuaire est l'arrivée venant de la zone sauvage
            expect(west.arrive.x).toBe(wild.w - 2);
            if (east) expect(east.arrive.x).toBe(1);
            if (i > 0) expect(sanctuary.spawn).toEqual(exitTo(wild, id).arrive);
        });
        // toutes les sorties de tous les écrans (portes comprises) ont une sortie de retour adjacente à leur arrivée
        screens.forEach(s => s.exits.forEach(e => {
            const target = SCREENS[e.to];
            expect([s.id, e.to, Boolean(target)]).toEqual([s.id, e.to, true]);
            expect(isTerrainBlocked(target, e.arrive.x, e.arrive.y)).toBe(false);
            const back = target.exits.filter(x => x.to === s.id);
            expect(back.some(x => Math.abs(x.x - e.arrive.x) + Math.abs(x.y - e.arrive.y) === 1)).toBe(true);
            expect(target.exits.some(x => x.x === e.arrive.x && x.y === e.arrive.y)).toBe(false);
        }));
    });

    test('villages, maisons et zones sauvages : zones sûres au village, ennemis dans la nature, gate vers le sanctuaire', () => {
        ORDER.forEach(id => {
            const village = SCREENS[`${id}_village`];
            const wild = SCREENS[`${id}_wild`];
            expect(village.enemies).toEqual([]);
            expect(village.npcs.length).toBeGreaterThanOrEqual(1);
            expect(village.waypoint).toBeDefined();
            expect(wild.enemies.length).toBeGreaterThanOrEqual(3);
            // le village n'est fermé que par une jonction gardée vers sa zone sauvage (world/junctions.js) ; le sanctuaire précédent l'est par son soleil
            village.exits.filter(e => e.requires).forEach(e => {
                expect(e.to).toBe(wild.id);
                expect(JUNCTIONS.some(j => j.from === village.id && (j.quest?.id === e.requires))).toBe(true);
            });
            // la sortie de la zone sauvage vers le sanctuaire est fermée par un gate, avec un message
            const gate = wild.exits.find(e => e.to === id);
            expect(gate.requires).toBeTruthy();
            expect(gate.lockedMessage.length).toBeGreaterThan(10);
            // les maisons sont des zones sûres reliées au village (ou au hameau) par une porte
            screens.filter(h => h.kind === 'house' && h.region === id).forEach(h => {
                expect(h.enemies).toEqual([]);
                const out = h.exits.find(e => e.door === false);
                expect(SCREENS[out.to].exits.some(e => e.to === h.id && e.door === true)).toBe(true);
            });
        });
    });

    test.each(ORDER)('%s : le gate de la zone sauvage est un ennemi, un coffre ou une quête qui existent', id => {
        const gate = SCREENS[`${id}_wild`].exits.find(e => e.to === id).requires;
        const known = screens.some(sc => [...sc.enemies, ...sc.chests].some(x => x.id === gate)) || QUESTS.some(q => q.id === gate);
        expect(known).toBe(true);
    });

    test.each(ORDER)('%s : le héros franchit village → zone sauvage → sanctuaire en jouant le gate', id => {
        const s = createSession({ screenId: `${id}_village`, x: SCREENS[`${id}_village`].spawn.x, y: SCREENS[`${id}_village`].spawn.y });
        const gate = SCREENS[`${id}_wild`].exits.find(e => e.to === id);
        // fermé tant que le gate n'est pas rempli
        travel(s, `${id}_wild`);
        const wildArrive = SCREENS[`${id}_village`].exits.find(e => e.to === `${id}_wild`).arrive;
        expect([s.data.screenId, s.data.x, s.data.y]).toEqual([`${id}_wild`, wildArrive.x, wildArrive.y]);
        expect(isExitLocked(s, gate)).toBe(true);
        // juste devant la sortie (grâce de 2 pas : aucun combat), elle refuse le passage
        enterScreen(s, `${id}_wild`, { x: gate.x - 1, y: gate.y });
        expect(tryMove(s, 1, 0, { playerLevel: WORLD_LEVEL })).toMatchObject({ type: 'exitBlocked', reason: 'quest', message: gate.lockedMessage });
        expect(s.data.screenId).toBe(`${id}_wild`);
        // on joue le gate (tuer / ouvrir / terminer la quête), puis la sortie s'ouvre
        satisfy(s, gate.requires);
        expect(isExitLocked(s, gate)).toBe(false);
        const { transitions } = travel(s, id);
        expect(transitions.at(-1)).toMatchObject({ type: 'transition', from: `${id}_wild`, to: id });
        expect([s.data.screenId, s.data.x, s.data.y]).toEqual([id, gate.arrive.x, gate.arrive.y]);
    });

    test('le héros traverse tout le monde, de la première maison au Pic de la Lune, soleil après soleil', () => {
        const s = createSession({});
        ORDER.forEach((id, i) => {
            travel(s, id);
            expect(s.data.screenId).toBe(id);
            if (i < 9) {
                const east = SCREENS[id].exits.find(e => e.x === SCREENS[id].w - 1);
                expect(isExitLocked(s, east)).toBe(true);        // le soleil de la région ferme toujours la sortie est
                markEnemyDefeated(s, `sun_${i + 1}`);
            }
        });
        ORDER.forEach(id => {
            [id, `${id}_village`, `${id}_wild`].forEach(sid => expect(s.data.visitedScreens).toContain(sid));
        });
    });

    test('le monde est connexe depuis l\'écran de départ', () => {
        const seen = new Set([START_SCREEN]);
        const queue = [START_SCREEN];
        while (queue.length) SCREENS[queue.shift()].exits.forEach(e => { if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); } });
        expect(seen.size).toBe(screens.length);
    });

    test('chaque région a un village pour écran d\'entrée et le niveau requis prévu', () => {
        expect(REGION_ENTRY_SCREEN).toEqual(Object.fromEntries(ORDER.map(id => [id, `${id}_village`])));
        expect(REGION_UNLOCK_LEVEL).toEqual({
            rizieres: 1, fleuve: 2, bambous: 3, gobi: 5, tonnerre: 7, volcan: 9, fauves: 11, mer: 13, fusang: 15, lune: 16
        });
        Object.entries(REGION_ENTRY_SCREEN).forEach(([region, id]) => { expect(SCREENS[id].region).toBe(region); expect(SCREENS[id].kind).toBe('village'); });
        screens.forEach(s => expect(REGION_UNLOCK_LEVEL[s.region]).toBeDefined());
    });

    // « On peut éviter un ennemi en faisant le tour » : entre les sorties d'un écran de passage,
    // il existe un chemin qui reste hors de toute zone de vigilance (patrouilles, mirages et meute inclus).
    test.each(ORDER.filter(id => !FORCED.includes(id)))('%s : on peut traverser sans croiser d\'ennemi', id => {
        const s = SCREENS[id];
        const forbidden = auraOfAll(s);
        const guarded = s.exits.filter(ex => doorGuards(s).some(g => g.id === ex.requires));
        const points = [...starts(s), ...s.exits.filter(ex => !guarded.includes(ex)).map(e => ({ x: e.x, y: e.y }))];
        points.forEach(from => {
            forbidden.delete(`${from.x},${from.y}`);
            const free = reachable(s, from, forbidden);
            // une porte fermée par un boss qui la garde ne se contourne pas : il faut le vaincre
            s.exits.filter(ex => !doorGuards(s).some(g => g.id === ex.requires)).forEach(ex => expect(free.has(`${ex.x},${ex.y}`)).toBe(true));
        });
    });

    test.each(FORCED)('%s : Fengmeng barre le défilé, mais sans bloquer physiquement la route vers l\'est', id => {
        const s = SCREENS[id];
        const east = s.exits.find(e => e.x === s.w - 1);
        // c'est un boss : aucune zone de vigilance, il faut aller le chercher...
        const fengmeng = s.enemies.find(e => e.id.startsWith('fengmeng_'));
        expect(fengmeng).toBeDefined();
        expect(aggroOf(fengmeng)).toBe(0);
        // ... et sa tuile ne ferme pas à elle seule le passage
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

    test('les PNJ vivent au village et dans les maisons, les sanctuaires abritent les soleils-boss', () => {
        // les sanctuaires n'ont plus de PNJ de village : seulement le Dixième Soleil et Chang'e à la Lune
        sanctuaries.forEach(s => s.npcs.forEach(n => expect(['sun_ten', 'change_moon']).toContain(n.id)));
        ORDER.forEach(id => {
            const villagers = screens.filter(s => s.region === id && s.kind !== undefined && s.id !== id).flatMap(s => s.npcs);
            expect(villagers.length).toBeGreaterThan(0);
            villagers.forEach(n => { expect(n.emoji).toBeUndefined(); expect(n.name).toBeTruthy(); expect(n.title).toBeTruthy(); });
        });
        for (let i = 0; i < 9; i++) {
            const sun = SCREENS[ORDER[i]].enemies.find(e => e.id === `sun_${i + 1}`);
            expect(sun).toBeDefined();
            expect(sun.x).toBeGreaterThanOrEqual(8);
            expect(sun.boss.level).toBe(SUN_LEVELS[i]);
            expect(sun.permanent).toBe(true);
            expect(sun.emoji).toBeUndefined();
        }
        expect(SCREENS.lune.enemies.filter(e => e.boss).map(e => e.id)).toEqual(['fengmeng_3a', 'fengmeng_3b']);
    });

    test('la sortie est de chaque sanctuaire est fermée par son soleil (le niveau de la région suivante n\'ouvre ni ne ferme rien)', () => {
        ORDER.slice(0, -1).forEach((id, i) => {
            const east = gateOf(id, `${ORDER[i + 1]}_village`);
            expect(east.requires).toBe(`sun_${i + 1}`);
            expect(east.lockedMessage.length).toBeGreaterThan(10);
            expect(SCREENS[id].enemies.some(e => e.id === east.requires)).toBe(true);
            // toutes les cases du passage portent le même verrou ; aucun autre passage n'est verrouillé
            expect(new Set(SCREENS[id].exits.filter(e => e.requires).map(e => e.to))).toEqual(new Set([east.to]));
        });
        expect(SCREENS.lune.exits.some(e => e.requires)).toBe(false);
    });

    test('les ids de PNJ d\'histoire, de soleils et de Fengmeng sont ceux de UNIVERS.md, relogés au village / en maison', () => {
        const npcIds = screens.flatMap(s => s.npcs.map(n => n.id));
        expect(new Set(npcIds).size).toBe(npcIds.length);   // un PNJ n'existe qu'une fois dans tout le monde
        const legacy = [
            'change', 'elder_wen', 'farmer_lin', 'ferryman_gu', 'weaver_mei', 'monk_zhen', 'herbalist_xu',
            'merchant_ma', 'guide_dawa', 'smith_tie', 'hermit_lei', 'miner_shan', 'priestess_yan',
            'hunter_wu', 'shepherd_zi', 'fisher_hai', 'envoy_longwang', 'crane_envoy', 'sun_ten', 'change_moon'
        ];
        legacy.forEach(id => expect(npcIds).toContain(id));
        const where = id => screens.find(s => s.npcs.some(n => n.id === id)).region;
        const REGION_OF = {
            change: 'rizieres', elder_wen: 'rizieres', farmer_lin: 'rizieres', ferryman_gu: 'fleuve', weaver_mei: 'fleuve',
            monk_zhen: 'bambous', herbalist_xu: 'bambous', merchant_ma: 'gobi', guide_dawa: 'gobi', smith_tie: 'tonnerre',
            hermit_lei: 'tonnerre', miner_shan: 'volcan', priestess_yan: 'volcan', hunter_wu: 'fauves', shepherd_zi: 'fauves',
            fisher_hai: 'mer', envoy_longwang: 'mer', crane_envoy: 'fusang', sun_ten: 'fusang', change_moon: 'lune'
        };
        Object.entries(REGION_OF).forEach(([id, region]) => expect([id, where(id)]).toEqual([id, region]));
        // seuls sun_ten et change_moon sont restés au sanctuaire
        expect(SCREENS.fusang.npcs.map(n => n.id)).toEqual(['sun_ten']);
        expect(SCREENS.lune.npcs.map(n => n.id)).toEqual(['change_moon']);
        expect(SCREENS.rizieres_h_houyi.npcs.map(n => n.id)).toContain('change');
        expect(SCREENS.rizieres_h_wen.npcs.map(n => n.id)).toContain('elder_wen');
        const enemyWhere = id => screens.find(s => s.enemies.some(e => e.id === id))?.id;
        expect(enemyWhere('fengmeng_1')).toBe('rizieres');
        expect(enemyWhere('fengmeng_2')).toBe('volcan');
        expect(enemyWhere('fengmeng_3a')).toBe('lune');
        expect(enemyWhere('fengmeng_3b')).toBe('lune');
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
    const ORIGINAL_SIDE = new Set(['sq_rice_thief', 'sq_river_serpent', 'sq_drowned', 'sq_bell', 'sq_old_pine', 'sq_oasis', 'sq_bandits',
        'sq_thunder_wyrm', 'sq_lei_drum', 'sq_ore', 'sq_ember', 'sq_scarred_tiger', 'sq_zi_bell', 'sq_nets', 'sq_pearl', 'sq_crane']);
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
            const pool = { kill: enemyIds, killGroup: groups, chest: chestIds, talk: npcIds, visit: new Set(Object.keys(SCREENS)) }[o.type];
            expect([q.id, o.type, Boolean(pool)]).toEqual([q.id, o.type, true]);
            expect([q.id, o.target, pool.has(o.target)]).toEqual([q.id, o.target, true]);
            if (o.type === 'talk') expect(o.lines?.length).toBeGreaterThan(0);   // la cible a une réplique à dire
            expect(o.text.length).toBeGreaterThan(10);
        });
        // les objectifs de kill visent des ennemis d'histoire qui ne réapparaissent pas
        q.objectives.filter(o => o.type === 'kill').forEach(o => {
            const def = screens.flatMap(s => s.enemies).find(e => e.id === o.target);
            expect(def.permanent).toBe(true);
        });
        // l'histoire principale et les 15 quêtes d'origine ont de vrais dialogues (2 répliques) ; les annexes du Grand Monde au moins 1
        const minLines = q.side && !ORIGINAL_SIDE.has(q.id) ? 1 : 2;
        expect(q.offer.length).toBeGreaterThanOrEqual(minLines);
        expect(q.complete.length).toBeGreaterThanOrEqual(minLines);
        expect(q.reward.gold).toBeGreaterThan(0);
        expect(q.reward.xp).toBeGreaterThan(0);
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
        screens.forEach(s => s.enemies.filter(e => e.afterScenes).forEach(e => {
            expect(e.permanent).toBe(true);
            e.afterScenes.forEach(sc => {
                expect(sc.lines.length).toBeGreaterThan(0);
                expect(sc.speaker.name).toBeTruthy();
                if (sc.speaker.npc) expect(npcIds.has(sc.speaker.npc)).toBe(true);
                if (sc.speaker.enemy) expect(enemyIds.has(sc.speaker.enemy)).toBe(true);
            });
        }));
        // un ennemi qui n'apparaît qu'après un autre, et l'autel
        expect(SCREENS.lune.enemies.find(e => e.id === 'fengmeng_3b').showWhen).toBe('fengmeng_3a');
        expect(SCREENS.lune.chests.find(c => c.id === 'moon_altar').showWhen).toBe('fengmeng_3b');
    });

    test('le miroir brisé : après chaque soleil, Hou Yi et Chang\'e se parlent ; après le neuvième, le bronze se tait', () => {
        const suns = screens.flatMap(s => s.enemies).filter(e => /^sun_\d$/.test(e.id));
        expect(suns).toHaveLength(9);
        suns.forEach(sun => {
            const scenes = sun.afterScenes;
            expect(scenes.length).toBeGreaterThanOrEqual(3);
            scenes.flatMap(sc => sc.lines).forEach(line => expect(line.length).toBeLessThanOrEqual(260));
            expect(scenes.some(sc => sc.speaker.hero)).toBe(true);
            const changeSpeaks = scenes.some(sc => sc.speaker.npc === 'change');
            expect(changeSpeaks).toBe(sun.id !== 'sun_9');
        });
        const all = suns.flatMap(sun => sun.afterScenes.flatMap(sc => sc.lines)).join(' ');
        expect(all).toMatch(/miroir/);
        expect(all).toMatch(/Je t'aime/);
        expect(STORY_INTRO.join(' ')).toMatch(/c'est pour elle/);
        expect(STORY_INTRO.join(' ')).toMatch(/miroir/);
        expect(STORY_ENDING.join(' ')).toMatch(/miroir/);
        // à la maison, Chang'e a une réplique après chaque soleil (sauf le neuvième : elle a fui)
        const change = screens.flatMap(s => s.npcs).find(n => n.id === 'change');
        const conds = change.talk.map(t => t.whenDone);
        for (let n = 1; n <= 8; n++) expect(conds).toContain(`sun_${n}`);
        expect(change.hideWhen).toBe('sun_9');
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
    const fresh = (patch = {}) => createSession({ ...patch }, LEGACY.screens, LEGACY.quests);

    test('un nouveau joueur démarre au village de Dongqiao, devant la maison de Hou Yi', () => {
        const s = fresh();
        expect(s.data.screenId).toBe('rizieres_village');
        expect([s.data.x, s.data.y]).toEqual([SCREENS.rizieres_village.spawn.x, SCREENS.rizieres_village.spawn.y]);
        expect(s.data.visitedScreens).toEqual(['rizieres_village']);
        expect(s.data.waypoints).toEqual(['rizieres_village']);   // la pierre d'un village est découverte dès l'arrivée
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
        const s = fresh({ screenId: 'rizieres_h_houyi', x: 7, y: 2 });
        expect(tryMove(s, 0, -1)).toEqual({ type: 'talk', npcId: 'change' });
        expect(s.data.y).toBe(2);
        const village = fresh({ screenId: 'rizieres_village', x: 13, y: 6 });
        expect(tryMove(village, -1, 0)).toEqual({ type: 'talk', npcId: 'xiaobao' });
    });

    test('distance 1 = combat, distance 2 = pas de combat', () => {
        // Golem de sable en (6,1)
        const s = atL('gobi', 6, 4);
        expect(tryMove(s, 0, -1)).toEqual({ type: 'moved' });                              // (6,3) : distance 2
        expect(tryMove(s, 0, -1)).toEqual({ type: 'combat', enemyId: 'gobi_colossus' });   // (6,2) : distance 1
    });

    test('percuter un ennemi lance le combat même en période de grâce', () => {
        const s = atL('gobi', 6, 2);
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

    test('réapparition : seulement les ennemis libres (ni histoire, ni quête, ni boss, ni barrage de chemin)', () => {
        const all = Object.values(SCREENS).filter(sc => !sc.arena).flatMap(sc => sc.enemies.map(e => [sc, e]));
        all.forEach(([sc, e]) => {
            if (e.permanent || e.boss || e.group || e.illusion || e.shieldedBy || e.defeatScene) expect(respawns(sc, e)).toBe(false);
        });
        const respawning = all.filter(([sc, e]) => respawns(sc, e));
        const blocking = all.filter(([sc, e]) => !e.permanent && blocksPath(sc, e));
        expect(respawning.length).toBeGreaterThan(30);
        expect(blocking.length).toBeGreaterThan(0);          // certains ennemis normaux barrent un passage : ils ne reviennent pas
        blocking.forEach(([sc, e]) => expect(respawns(sc, e)).toBe(false));
    });

    test('un ennemi qui barre un chemin ne revient pas ; un ennemi libre revient', () => {
        const sc = Object.values(SCREENS).find(c => c.enemies.some(e => !e.permanent && blocksPath(c, e)) && c.enemies.some(e => respawns(c, e)));
        const crab = sc.enemies.find(e => !e.permanent && blocksPath(sc, e));
        const cutter = sc.enemies.find(e => respawns(sc, e));
        const s = at(sc.id, sc.spawn.x, sc.spawn.y);
        markEnemyDefeated(s, crab.id);
        markEnemyDefeated(s, cutter.id);
        const exit = sc.exits[0];
        enterScreen(s, exit.to, exit.arrive);
        enterScreen(s, sc.id, { x: sc.spawn.x, y: sc.spawn.y });
        const alive = aliveEnemies(s).map(e => e.def.id);
        expect(alive).not.toContain(crab.id);             // un ennemi qui barre un chemin ne revient pas
        expect(alive).toContain(cutter.id);
    });

    test('une sortie change d\'écran et arrive à la tuile prévue (quand son soleil est abattu)', () => {
        const { s, dx, dy, ex } = atGate('rizieres', 'fleuve_village');
        markEnemyDefeated(s, 'sun_1');
        expect(tryMove(s, dx, dy, { playerLevel: 2 })).toMatchObject({ type: 'transition', from: 'rizieres', to: 'fleuve_village', firstVisit: true, door: false });
        expect(s.data.screenId).toBe('fleuve_village');
        expect([s.data.x, s.data.y]).toEqual([ex.arrive.x, ex.arrive.y]);
        expect([s.data.x, s.data.y]).toEqual([1, 6]);
        // retour à l'ouest : on ressort en face, sur la case alignée avec le passage est des rizières
        const back = atGate('fleuve_village', 'rizieres');
        expect(tryMove(back.s, back.dx, back.dy, { playerLevel: 1 })).toMatchObject({ type: 'transition', to: 'rizieres' });
        expect([back.s.data.x, back.s.data.y]).toEqual([back.ex.arrive.x, back.ex.arrive.y]);
        expect(back.s.data.x).toBe(SCREENS.rizieres.w - 2);
        // village → zone sauvage → sanctuaire (gate rempli)
        const vg = atGate('rizieres_village', 'rizieres_wild');
        const v = vg.s;
        expect(tryMove(v, vg.dx, vg.dy, { playerLevel: 1 })).toMatchObject({ type: 'transition', from: 'rizieres_village', to: 'rizieres_wild', firstVisit: true });
        expect([v.data.x, v.data.y]).toEqual([vg.ex.arrive.x, vg.ex.arrive.y]);
        const wg = atGate('rizieres_wild', 'rizieres');
        markEnemyDefeated(wg.s, 'rizieres_warden');
        expect(tryMove(wg.s, wg.dx, wg.dy, { playerLevel: 1 })).toMatchObject({ type: 'transition', from: 'rizieres_wild', to: 'rizieres' });
        expect([wg.s.data.x, wg.s.data.y]).toEqual([wg.ex.arrive.x, wg.ex.arrive.y]);
    });

    test('une porte de maison est signalée (door) et la transition renvoie les événements de quêtes automatiques', () => {
        const s = at('rizieres_village', 3, 4);
        const res = tryMove(s, 0, -1, { playerLevel: 1 });
        expect(res).toMatchObject({ type: 'transition', from: 'rizieres_village', to: 'rizieres_h_houyi', door: true, firstVisit: true });
        expect(Array.isArray(res.events)).toBe(true);
        const out = tryMove(s, 0, 1, { playerLevel: 1 });   // (5,5) -> (5,6) : la sortie de la maison
        expect(out).toMatchObject({ type: 'transition', to: 'rizieres_village', door: false, firstVisit: false });
        expect([s.data.x, s.data.y]).toEqual([3, 4]);
        // une quête automatique (sans PNJ, objectif `visit`) se valide à l'arrivée sur l'écran visé
        const synthQuest = { id: 'q_visit', side: true, requires: [], objectives: [{ type: 'visit', target: 'rizieres_wild', text: 'Atteindre la digue' }], reward: {} };
        const v = createSession({ screenId: 'rizieres_village', x: 18, y: 6 }, SCREENS, [synthQuest]);
        v.data.quests.q_visit = 'active';
        const into = tryMove(v, 1, 0, { playerLevel: 1 });
        expect(into.events).toEqual([expect.objectContaining({ type: 'questCompleted' })]);
        expect(v.data.quests.q_visit).toBe('done');
    });

    test('le niveau ne bloque jamais une sortie : il déclenche seulement un avertissement', () => {
        const { s, dx, dy } = atGate('fleuve', 'bambous_village');
        markEnemyDefeated(s, 'sun_2');
        const res = tryMove(s, dx, dy, { playerLevel: 2 });
        expect(res).toMatchObject({ type: 'transition', to: 'bambous_village', warning: { minLevel: 3, regionName: SCREENS.bambous_village.name } });
        expect(res.type).not.toBe('exitBlocked');
        expect(s.data.screenId).toBe('bambous_village');   // le héros est bien passé
        // niveau suffisant : pas d'avertissement
        const ok = atGate('fleuve', 'bambous_village');
        markEnemyDefeated(ok.s, 'sun_2');
        expect(tryMove(ok.s, ok.dx, ok.dy, { playerLevel: 3 }).warning).toBeUndefined();
        // à l'intérieur d'une région, jamais d'avertissement (même niveau 1 dans une zone de niveau supérieur)
        const inside = at('bambous_village', 18, 6);
        expect(tryMove(inside, 1, 0, { playerLevel: 1 }).warning).toBeUndefined();
        // le niveau recommandé est celui de la région d'arrivée : revenir au Lit du Fleuve (niveau 2) à 3 est sans avertissement
        const back = at('bambous_village', 1, 6);
        expect(tryMove(back, -1, 0, { playerLevel: 3 }).warning).toBeUndefined();
    });

    test('la pierre de voyage bloque le passage et s\'active au contact', () => {
        const wp = SCREENS.rizieres_village.waypoint;
        const s = at('rizieres_village', wp.x, wp.y + 1);
        expect(entityAt(s, wp.x, wp.y)).toMatchObject({ type: 'waypoint' });
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'waypoint', screenId: 'rizieres_village', isNew: false });   // déjà découverte au village
        expect([s.data.x, s.data.y]).toEqual([wp.x, wp.y + 1]);
        expect(findPath(s, wp.x, wp.y - 1).some(p => p.x === wp.x && p.y === wp.y)).toBe(false);
        // la pierre d'un sanctuaire se découvre au contact, puis autorise le voyage rapide
        const sw = SCREENS.rizieres.waypoint;
        const t = at('rizieres', sw.x, sw.y + 1);
        expect(t.data.waypoints).not.toContain('rizieres');
        expect(tryMove(t, 0, -1)).toMatchObject({ type: 'waypoint', screenId: 'rizieres', isNew: true });
        expect(waypointList(t).map(w => w.screenId)).toEqual(['rizieres']);
        enterScreen(t, 'rizieres_village', SCREENS.rizieres_village.spawn);   // entrer dans un village découvre sa pierre
        expect(waypointList(t).map(w => w.screenId)).toEqual(['rizieres_village', 'rizieres']);
        expect(fastTravel(t, 'rizieres')).toBe(true);
        expect(t.data.screenId).toBe('rizieres');
        expect(fastTravel(t, 'fleuve_wild')).toBe(false);   // pierre non découverte
    });

    test('les patrouilleurs avancent le long de leur route et font demi-tour', () => {
        const s = fresh({ screenId: 'rizieres', x: 3, y: 4 });
        const def = LEGACY.screens.rizieres.enemies.find(e => e.id === 'rizieres_guardian');
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
        const s = atL('rizieres', 12, 9);   // dans l'axe de la ronde : le gardien arrive face à lui
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
        expect(aura.has('6,4')).toBe(true);   // Fengmeng en (6,4) : boss, sa seule case
        expect(aura.has('5,3')).toBe(false);
        expect(aura.has('7,5')).toBe(false);
    });

    test('la progression est sérialisable en JSON et se recharge', () => {
        const s = fresh({ screenId: 'rizieres', x: 3, y: 4 });
        markEnemyDefeated(s, 'sun_1');
        s.data.ngPlus = 2;
        const copy = createSession(JSON.parse(JSON.stringify(s.data)), LEGACY.screens, LEGACY.quests);
        expect(copy.data.defeated).toContain('sun_1');
        expect(copy.data.screenId).toBe('rizieres');
        expect(copy.data.ngPlus).toBe(2);
    });

    test('une ancienne sauvegarde sans ngPlus, ou corrompue, retombe sur la maison', () => {
        expect(createSession({ screenId: 'rizieres', x: 3, y: 4 }).data.ngPlus).toBe(0);
        expect(createSession({ ngPlus: -3 }).data.ngPlus).toBe(0);
        expect(createSession({ ngPlus: 'beaucoup' }).data.ngPlus).toBe(0);
        const s = createSession({ screenId: 'nulle-part', x: 99, y: 99 });
        expect(s.data.screenId).toBe(START_SCREEN);
        const inWall = createSession({ screenId: 'village', x: 2, y: 2 });   // ancien écran de « La Couronne Brisée »
        expect(inWall.data.screenId).toBe(START_SCREEN);
        const wallCell = SCREENS.rizieres_village.buildings[0];   // un mur de maison (plus de mur d'enceinte : la limite de la carte suffit)
        const inVillageWall = createSession({ screenId: 'rizieres_village', x: wallCell.x, y: wallCell.y });
        expect(inVillageWall.data.screenId).toBe(START_SCREEN);
        expect([inVillageWall.data.x, inVillageWall.data.y]).toEqual([SCREENS[START_SCREEN].spawn.x, SCREENS[START_SCREEN].spawn.y]);
        const inHouse = createSession({ screenId: 'rizieres', x: 1, y: 1 });
        expect(isTerrainBlocked(SCREENS.rizieres, inHouse.data.x, inHouse.data.y)).toBe(false);
    });
});

describe('rencontres', () => {
    test('niveau des ennemis : fixe (région + écart, boss = boss.level), indépendant du niveau du héros', () => {
        const s = createSession({});
        expect(enemyLevel({ id: 'x', offset: 0 }, 5)).toBe(5);
        expect(enemyLevel({ id: 'y', offset: -1 }, 5)).toBe(4);
        expect(enemyLevel({ id: 'y', offset: -1 }, 1)).toBe(1);
        expect(enemyLevel({ id: 'z', offset: 3 }, 5)).toBe(8);
        const sun = encounterFor(s, 'sun_1', 1);
        expect(sun.boss.level).toBe(3);
        expect(encounterFor(s, 'sun_1', 8).boss.level).toBe(3);
        expect(encounterFor(s, 'sun_1', 40).boss.level).toBe(3);
        expect(encounterFor(s, 'rizieres_shroom', 1).level).toBe(encounterFor(s, 'rizieres_shroom', 30).level);
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
        expect(enemyLevel({ id: 'b', boss: { level: 10 } }, 30, 2)).toBe(16);
        expect(enemyLevel({ id: 'x', offset: 0 }, 5, 1)).toBe(6);
        expect(enemyLevel({ id: 'x', offset: -1 }, 5, 2)).toBe(6);
        const s = createSession({ ngPlus: 2 });
        expect(encounterFor(s, 'sun_1', 1).level).toBe(3 + 6);
        expect(encounterFor(s, 'sun_1', 1).boss.level).toBe(9);
        expect(encounterFor(s, 'rizieres_shroom', 4).level).toBe(encounterFor(createSession({}), 'rizieres_shroom', 4).level + 2);
    });
});

describe('histoire complète', () => {
    test('déroulé de la quête principale du premier soleil jusqu\'à l\'épilogue', () => {
        const s = createSession({});
        expect(currentObjectiveText(s)).toContain('Doyen Wen');

        // Prologue : le doyen Wen transmet le décret de l'empereur
        let talk = talkTo(s, 'elder_wen');   // le héros marche jusqu'à la maison du doyen
        expect(s.data.screenId).toBe('rizieres_h_wen');
        expect(talk.events[0]).toMatchObject({ type: 'questStarted' });
        expect(talk.lines).toEqual(quest('q_sun_1').offer);
        expect(s.data.quests.q_sun_1).toBe('active');
        expect(talkToNpc(s, 'elder_wen').lines).toEqual(quest('q_sun_1').hint);   // pas de suite tant que le soleil vit
        expect(currentObjectiveText(s)).toContain('Soleil Ardent');

        // Traversée du village, de la zone sauvage (gate : le gardien de la digue) puis duel d'entraînement : scène de Fengmeng, puis le premier soleil
        travel(s, 'rizieres');
        expect(s.data.defeated).toContain('rizieres_warden');
        let events = markEnemyDefeated(s, 'fengmeng_1');
        expect(events.map(e => e.type)).toEqual(['scene']);
        events = markEnemyDefeated(s, 'sun_1');
        // victoire, interlude avec Chang'e (scènes), puis la quête suivante
        expect(events.filter(e => e.type !== 'scene').map(e => e.type)).toEqual(['questCompleted', 'questStarted']);
        expect(events.map(e => e.type).slice(1, -1).every(t => t === 'scene')).toBe(true);
        expect(events[0]).toMatchObject({ gold: 80, ended: false });
        expect(events[0].xp).toBe(quest('q_sun_1').reward.xp);
        expect(events[0].xp).toBeGreaterThan(0);
        expect(events[events.length - 1].quest.id).toBe('q_sun_2');

        const golds = [80];
        for (let n = 2; n <= 9; n++) {
            travel(s, ORDER[n - 1]);   // village, zone sauvage (gate rempli au passage) puis sanctuaire de la région
            expect(s.data.screenId).toBe(ORDER[n - 1]);
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
            const started = events.find(e => e.type === 'questStarted');
            expect(events.indexOf(started)).toBe(events.length - 1);   // après l'interlude avec Chang'e
            expect(started.quest.id).toBe(n < 9 ? `q_sun_${n + 1}` : 'q_fengmeng');
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

        travel(s, 'lune');
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
        const talk = talkTo(s, 'elder_wen');
        expect(talk.events.map(e => e.type)).toEqual(['questStarted', 'questCompleted', 'questStarted']);
        expect(s.data.quests.q_sun_1).toBe('done');
        expect(s.data.quests.q_sun_2).toBe('active');
    });

    test('un PNJ sans quête raconte son dialogue habituel', () => {
        const s = createSession({});
        const talk = talkTo(s, 'change');
        expect(s.data.screenId).toBe('rizieres_h_houyi');
        expect(talk.lines).toEqual(SCREENS.rizieres_h_houyi.npcs.find(n => n.id === 'change').idle);
        expect(talk.events).toEqual([]);
        expect(talkToNpc(s, 'inconnu')).toBeNull();
        expect(talkToNpc(s, 'elder_wen')).toBeNull();   // il est dans une autre maison
    });

    test('le doyen sert de guide du tutoriel : le marqueur de quête et l\'objectif pointent vers lui', () => {
        const s = createSession({});
        // une quête non activée (pas encore parlé à son donneur) est masquée du journal
        expect(journalEntries(s).some(e => e.quest.id === 'q_sun_1')).toBe(false);
        expect(questStatus(s, s.quests.find(q => q.id === 'q_sun_1'))).toBe('available');
        expect(journalEntries(s).some(e => e.quest.id === 'q_sun_2')).toBe(false);   // verrouillée
    });

    test('Chang\'e quitte la maison une fois le neuvième soleil abattu (hideWhen)', () => {
        const house = SCREENS.rizieres_h_houyi;
        const change = house.npcs.find(n => n.id === 'change');
        const s = createSession({ screenId: house.id, x: house.spawn.x, y: house.spawn.y });
        expect(talkToNpc(s, 'change')).not.toBeNull();
        markEnemyDefeated(s, 'sun_9');
        expect(talkToNpc(s, 'change')).toBeNull();
        expect(visibleNpcs(s).map(n => n.id)).not.toContain('change');
        expect(entityAt(s, change.x, change.y)).toBeNull();
        expect(findPath(s, change.x, change.y)).not.toBeNull();
        expect(findPath(s, change.x, change.y).at(-1)).toEqual({ x: change.x, y: change.y });
        expect(tryMove(at(house.id, change.x, change.y + 1), 0, -1)).toEqual({ type: 'talk', npcId: 'change' });   // tant qu'elle est là
    });
});

describe('quêtes secondaires', () => {
    const side = QUESTS.filter(q => q.side);
    const main = QUESTS.filter(q => !q.side);
    const allEnemies = screens.flatMap(s => s.enemies);
    const regionOf = q => screens.find(sc => sc.npcs.some(n => n.id === q.giver)).region;
    // quêtes annexes qui ferment une sortie (gate de zone sauvage) : elles font partie du chemin de l'histoire
    const gateQuests = new Set([
        ...ORDER.map(id => SCREENS[`${id}_wild`].exits.find(e => e.to === id).requires),
        ...JUNCTIONS.filter(j => j.type === 'item').map(j => j.quest.id)   // jonctions gardées : objet à rapporter à un garde
    ].filter(r => QUESTS.some(q => q.id === r)));

    test('au moins 2 quêtes secondaires par région, récompenses raisonnables, jamais requises par l\'histoire', () => {
        ORDER.forEach(id => {
            const n = side.filter(q => regionOf(q) === id).length;
            expect([id, n >= 2]).toEqual([id, true]);
        });
        side.forEach(q => {
            expect(q.reward.gold).toBeGreaterThanOrEqual(30);
            expect(q.reward.gold).toBeLessThanOrEqual(200);
            expect(q.reward.xp).toBeGreaterThan(0);
            expect(q.reward.fragment.length).toBeGreaterThan(3);
            expect(q.giver && q.turnIn).toBeTruthy();
            expect(q.offer.length).toBeGreaterThanOrEqual(1);
            expect(q.complete.length).toBeGreaterThanOrEqual(1);
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

    test('les récompenses (or et XP) des quêtes secondaires croissent avec la région', () => {
        const rank = q => ORDER.indexOf(regionOf(q));
        const byRegion = ORDER.map((_, i) => side.filter(q => rank(q) === i));
        for (let i = 1; i < ORDER.length; i++) {
            expect(Math.max(...byRegion[i].map(q => q.reward.xp))).toBeGreaterThanOrEqual(Math.max(...byRegion[i - 1].map(q => q.reward.xp)));
        }
    });

    test('les quêtes secondaires ne dépendent que de l\'histoire principale ou d\'une autre annexe (sans cycle)', () => {
        const byId = Object.fromEntries(QUESTS.map(q => [q.id, q]));
        side.forEach(q => q.requires.forEach(r => expect(byId[r]).toBeDefined()));
        const reaches = (id, seen = new Set()) => {
            expect(seen.has(id)).toBe(false);   // pas de cycle
            seen.add(id);
            byId[id].requires.forEach(r => reaches(r, new Set(seen)));
        };
        side.forEach(q => reaches(q.id));
    });

    test('les ennemis nommés des quêtes secondaires sont permanents et dessinés d\'après leur gabarit', () => {
        side.flatMap(q => q.objectives).filter(o => o.type === 'kill' || o.type === 'killGroup').forEach(o => {
            const targets = allEnemies.filter(e => o.type === 'kill' ? e.id === o.target : e.group === o.target);
            expect(targets.length).toBeGreaterThan(0);
            targets.forEach(e => { expect(e.permanent).toBe(true); expect(e.templateId).toBeTruthy(); expect(e.emoji).toBeUndefined(); });
        });
    });

    test('les coffres-objectifs secondaires sont atteignables en discrétion depuis l\'entrée côté village', () => {
        side.flatMap(q => q.objectives).filter(o => o.type === 'chest').forEach(o => {
            const s = screens.find(sc => sc.chests.some(c => c.id === o.target));
            const chest = s.chests.find(c => c.id === o.target);
            const forbidden = approachBlockers(s);
            const approach = DIRS.map(([dx, dy]) => ({ x: chest.x + dx, y: chest.y + dy }))
                .filter(p => !isTerrainBlocked(s, p.x, p.y) && !forbidden.has(`${p.x},${p.y}`));
            expect([o.target, approach.length > 0]).toEqual([o.target, true]);
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
                const forbidden = approachBlockers(s);
                forbidden.delete(`${a.x},${a.y}`);
                const free = reachable(s, a, forbidden);
                expect([q.id, a, DIRS.some(([dx, dy]) => free.has(`${npc.x + dx},${npc.y + dy}`))]).toEqual([q.id, a, true]);
            });
        });
    });

    // Chaque quête (principale ou annexe) se joue réellement de bout en bout depuis une partie neuve :
    // offre, objectifs (tuer / coffre / groupe / parler / visiter), remise, avec traversée des gates.
    test.each(QUESTS.map(q => [q.id]))('%s : jouable de bout en bout depuis une nouvelle partie', id => {
        const s = createSession({});
        playQuest(s, id);
        expect(s.data.quests[id]).toBe('done');
        // aucune quête n'est restée coincée « active » sans pouvoir être terminée
        QUESTS.filter(q => s.data.quests[q.id] === 'active').forEach(q => expect(['active', 'ready']).toContain(questStatus(s, q)));
    });

    test('quête secondaire de bout en bout : le chapardeur des rizières', () => {
        const s = createSession({});
        const q = quest('sq_rice_thief');
        expect(questStatus(s, q)).toBe('available');
        const offer = talkTo(s, 'farmer_lin');
        expect(s.data.screenId).toBe('rizieres_h_lin');
        expect(offer.events[0]).toMatchObject({ type: 'questStarted' });
        expect(offer.events[0].quest.side).toBe(true);
        expect(talkToNpc(s, 'farmer_lin').lines).toEqual(q.hint);
        // le voleur est au sanctuaire : on traverse village, zone sauvage (gardien de la digue) et sanctuaire pour le rattraper
        defeat(s, 'rice_thief');
        expect(s.data.defeated).toEqual(expect.arrayContaining(['rizieres_warden', 'rice_thief']));
        expect(questStatus(s, q)).toBe('ready');   // pas de PNJ de remise automatique : on retourne voir Lin
        expect(currentObjectiveText(s)).toContain('Doyen Wen');   // l'histoire passe avant : le doyen a une quête à donner
        const done = talkTo(s, 'farmer_lin');
        expect(done.events[0]).toMatchObject({ type: 'questCompleted', gold: 40, xp: q.reward.xp });
        expect(done.events[0].reward.fragment).toBe('Eau sacrée');
        expect(s.data.quests.sq_rice_thief).toBe('done');
        // ensuite : réplique d'ambiance spécifique
        expect(talkToNpc(s, 'farmer_lin').lines).toEqual(SCREENS.rizieres_h_lin.npcs.find(n => n.id === 'farmer_lin').talk[0].lines);
    });

    test('quête en chaîne avec objectifs « parler » : la lettre de Bao', () => {
        const s = createSession({});
        const q1 = quest('sq_lettre_bao_1');
        const q2 = quest('sq_lettre_bao_2');
        expect(questStatus(s, q2)).toBe('locked');
        for (let i = 0; i < 6 && !s.data.quests.sq_lettre_bao_1; i++) talkTo(s, q1.giver);   // le donneur a d'autres quêtes à proposer
        expect(s.data.quests.sq_lettre_bao_1).toBe('active');
        const target = q1.objectives[0];
        expect(target.type).toBe('talk');
        expect(npcMarker(s, target.target)).toBe('?');   // le destinataire porte un « ? »
        const talk = talkTo(s, target.target);
        expect(talk.events[0]).toMatchObject({ type: 'objective' });
        expect(talk.lines).toEqual(expect.arrayContaining(target.lines));
        expect(s.data.talked).toContain(target.target);
        playQuest(s, 'sq_lettre_bao_1');
        expect(s.data.quests.sq_lettre_bao_1).toBe('done');
        expect(questStatus(s, q2)).toBe('available');
    });

    test('objectif « visiter » : validé à l\'arrivée sur l\'écran visé', () => {
        const q = side.find(x => x.objectives.some(o => o.type === 'visit'));
        const o = q.objectives.find(x => x.type === 'visit');
        const s = createSession({});
        playQuest(s, q.id);
        expect(s.data.visitedScreens).toContain(o.target);
        expect(s.data.quests[q.id]).toBe('done');
    });

    test('une quête secondaire n\'est proposée qu\'une fois la région atteinte dans l\'histoire', () => {
        const house = SCREENS.fleuve_h_mei;
        const s = createSession({ screenId: house.id, x: house.spawn.x, y: house.spawn.y });
        const talk = talkToNpc(s, 'weaver_mei');
        expect(talk.events).toEqual([]);
        expect(s.data.quests.sq_drowned).toBeUndefined();
        expect(talk.lines).toEqual(house.npcs.find(n => n.id === 'weaver_mei').idle);
        s.data.quests.q_sun_1 = 'done';
        expect(talkToNpc(s, 'weaver_mei').events[0]).toMatchObject({ type: 'questStarted' });
    });

    test('quête de groupe secondaire : les noyés de Mei', () => {
        const house = SCREENS.fleuve_h_mei;
        const s = createSession({ screenId: house.id, x: house.spawn.x, y: house.spawn.y });
        s.data.quests.q_sun_1 = 'done';
        expect(talkToNpc(s, 'weaver_mei').events[0]).toMatchObject({ type: 'questStarted' });
        markEnemyDefeated(s, 'drowned_a');
        expect(s.data.quests.sq_drowned).toBe('active');
        markEnemyDefeated(s, 'drowned_b');
        expect(questStatus(s, quest('sq_drowned'))).toBe('ready');
        expect(talkToNpc(s, 'weaver_mei').events[0]).toMatchObject({ type: 'questCompleted', gold: 60 });
    });

    test('quête de coffre secondaire : la cloche du temple', () => {
        const s = createSession({});
        s.data.quests.q_sun_2 = 'done';
        talkTo(s, 'monk_zhen');
        expect(s.data.quests.sq_bell).toBe('active');
        const res = openChestAt(s, 'temple_bell');   // le coffre est au sanctuaire : le héros y marche (gate compris)
        expect(res.gold).toBe(10);
        const done = talkTo(s, 'monk_zhen');
        expect(done.events[0]).toMatchObject({ type: 'questCompleted', gold: 50 });
    });

    test('la quête principale est faisable de bout en bout sans quête secondaire (hors annexes qui ferment une sortie)', () => {
        const s = createSession({});
        completeStory(s);
        expect(s.data.ended).toBe(true);
        expect(s.data.screenId).toBe('lune');
        expect(main.every(q => s.data.quests[q.id] === 'done')).toBe(true);
        const sideDone = side.filter(q => s.data.quests[q.id] === 'done').map(q => q.id);
        sideDone.forEach(id => expect(gateQuests.has(id)).toBe(true));
        // les annexes qui ne ferment aucune sortie ne sont jamais imposées
        side.filter(q => !gateQuests.has(q.id)).forEach(q => expect(s.data.quests[q.id]).not.toBe('done'));
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
        const s = createSession({ screenId: 'rizieres_h_lin', x: SCREENS.rizieres_h_lin.spawn.x, y: SCREENS.rizieres_h_lin.spawn.y });
        const lin = SCREENS.rizieres_h_lin.npcs.find(n => n.id === 'farmer_lin');
        talkToNpc(s, 'farmer_lin');   // la quête du chapardeur démarre
        expect(talkToNpc(s, 'farmer_lin').lines).toEqual(quest('sq_rice_thief').hint);
        s.data.quests.sq_rice_thief = 'done';
        markEnemyDefeated(s, 'sun_1');
        // l'entrée « sun_1 » vient après « sq_rice_thief » dans `talk` : celle-ci l'emporte
        expect(talkToNpc(s, 'farmer_lin').lines).toEqual(lin.talk.find(t => t.whenDone === 'sun_1').lines);
    });

    test('les PNJ évoquent l\'avancement : Chang\'e change de discours au fil des soleils', () => {
        const s = createSession({});
        const change = SCREENS.rizieres_h_houyi.npcs.find(n => n.id === 'change');
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
        const dawa = SCREENS.gobi_h_dawa.npcs.find(n => n.id === 'guide_dawa');
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
        const s = atL('lune', 8, 4);
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('fengmeng_3b');
        expect(entityAt(s, 11, 3)).toBeNull();
        expect(getAuraTiles(s).has('12,2')).toBe(false);     // aura de 3b seule
        expect(isEntityVisible(s, LEGACY.screens.lune.enemies.find(e => e.id === 'fengmeng_3b'))).toBe(false);

        markEnemyDefeated(s, 'fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_3b');
        expect(entityAt(s, 11, 3)).toMatchObject({ type: 'enemy' });
        expect(getAuraTiles(s).has('11,3')).toBe(true);
        expect(getAuraTiles(s).has('12,2')).toBe(false);   // boss : pas de zone autour
    });

    test('la phase 2 ne se déclenche pas d\'elle-même : il faut aller la chercher', () => {
        const s = atL('lune', 10, 4);
        s.rt.grace = 0;
        expect(tryMove(s, 0, -1).type).toBe('moved');         // (10,3) : plus d'aura autour d'un boss
        expect(tryMove(s, 0, 1).type).toBe('moved');
        expect(tryMove(s, 1, 0)).toEqual({ type: 'combat', enemyId: 'fengmeng_3a' });   // (11,4) : on le choisit explicitement
        markEnemyDefeated(s, 'fengmeng_3a');
        const events = tick(s, PATROL_STEP_MS);
        expect(events).toEqual([]);
        expect(tryMove(s, 0, -1).type).toBe('moved');
        expect(tryMove(s, 1, 0)).toEqual({ type: 'combat', enemyId: 'fengmeng_3b' });   // (11,3)
    });

    test('l\'autel n\'existe qu\'après la victoire sur Fengmeng : entityAt, openChest, findPath, rendu', () => {
        const s = atL('lune', 8, 4);
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
            npcs: [{ id: 'ghost', x: 3, y: 2, name: 'G', title: 'T', idle: ['boo'], showWhen: 'k' }],
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
            npcs: [{ id: 'leaver', x: 3, y: 2, name: 'L', title: 'T', idle: ['salut'], hideWhen: 'k' }],
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
        const s = atL('gobi', 10, 3);
        const res = tryMove(s, 0, -1);   // (10,2), à distance 1 de mirage_1 (9,1)
        const def = LEGACY.screens.gobi.enemies.find(e => e.id === 'mirage_1');
        expect(res).toEqual({ type: 'illusion', enemyId: 'mirage_1', lines: def.illusionLines });
        expect(s.data.defeated).toContain('mirage_1');
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('mirage_1');
        expect(tryMove(s, 0, 1).type).toBe('moved');
    });

    test('toucher un mirage : événement illusion, sans déplacement', () => {
        const s = atL('gobi', 9, 2);
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
        }, { x: 3, y: 0 });
        const events = tick(s, PATROL_STEP_MS * 2);
        expect(events).toEqual([expect.objectContaining({ type: 'illusion', enemyId: 'm' })]);
        expect(isEnemyIllusionGone(s, 'm')).toBe(true);
        expect(tick(s, PATROL_STEP_MS * 4)).toEqual([]);
    });
    const isEnemyIllusionGone = (s, id) => !aliveEnemies(s).some(e => e.def.id === id);

    test('le vrai soleil des mirages n\'est pas une illusion : le contact lance le combat', () => {
        const s = atL('gobi', 11, 7);
        expect(tryMove(s, 0, 1)).toEqual({ type: 'combat', enemyId: 'sun_4' });
        const aura = atL('gobi', 11, 6);
        expect(tryMove(aura, 0, 1).type).toBe('moved');   // (11,7) est à côté du soleil : un boss n'a pas d'aura
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
        const s = atL('fauves', 11, 7);
        const def = LEGACY.screens.fauves.enemies.find(e => e.id === 'sun_7');
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
        const s = atL('fauves', 10, 5);
        expect(getAuraTiles(s).has('10,8')).toBe(true);           // aura du loup (9,7) : devant lui seulement
        expect(getAuraTiles(s).has('10,6')).toBe(false);
        expect(tryMove(s, 0, 1)).toEqual({ type: 'moved' });      // (10,6)
        expect(tryMove(s, 0, 1)).toEqual({ type: 'moved' });      // (10,7) : à côté du loup, pas devant
        expect(tryMove(s, 0, 1)).toEqual({ type: 'combat', enemyId: 'pack_wolf_a' });   // (10,8) : devant le loup
    });

    test('le bouclier tombe quand tout le groupe est vaincu', () => {
        const s = atL('fauves', 11, 7);
        const def = LEGACY.screens.fauves.enemies.find(e => e.id === 'sun_7');
        pack.slice(0, 3).forEach(id => markEnemyDefeated(s, id));
        expect(isShielded(s, def)).toBe(true);
        expect(tryMove(s, 0, 1).type).toBe('shielded');
        markEnemyDefeated(s, pack[3]);
        expect(isShielded(s, def)).toBe(false);
        expect(getAuraTiles(s).has('11,8')).toBe(true);
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
        talkTo(s, 'elder_wen');
        const def = SCREENS.rizieres.enemies.find(e => e.id === 'fengmeng_1');
        const events = markEnemyDefeated(s, 'fengmeng_1');
        expect(events).toEqual([{ type: 'scene', speaker: def.defeatScene.speaker, lines: def.defeatScene.lines }]);
        expect(events[0].speaker).toMatchObject({ name: 'Fengmeng', enemy: 'fengmeng_1' });
        expect(markEnemyDefeated(s, 'fengmeng_1')).toEqual([]);          // pas de doublon
        expect(markEnemyDefeated(s, 'rizieres_goblin')).toEqual([]);     // pas de scène pour un ennemi normal
    });

    test('la scène précède l\'événement de quête dans le même lot', () => {
        const s = createSession({});
        talkTo(s, 'elder_wen');
        s.screens.rizieres.enemies.find(e => e.id === 'sun_1').defeatScene = { speaker: { name: 'X' }, lines: ['a', 'b'] };
        const events = markEnemyDefeated(s, 'sun_1');
        delete s.screens.rizieres.enemies.find(e => e.id === 'sun_1').defeatScene;
        expect(events[0]).toMatchObject({ type: 'scene', lines: ['a', 'b'] });
        expect(events[1].type).toBe('questCompleted');
        expect(events[events.length - 1].type).toBe('questStarted');
    });

    test('afterScenes : interlude après le texte de victoire, avant la quête suivante, une seule fois', () => {
        const s = createSession({});
        talkTo(s, 'elder_wen');
        const sun = s.screens.rizieres.enemies.find(e => e.id === 'sun_1');
        const saved = sun.afterScenes;
        sun.afterScenes = [{ speaker: { name: 'A', hero: true }, lines: ['a'] }, { speaker: { name: 'B' }, lines: [] }, { speaker: { name: 'C', npc: 'change' }, lines: ['c'] }];
        const events = markEnemyDefeated(s, 'sun_1');
        sun.afterScenes = saved;
        expect(events.map(e => e.type)).toEqual(['questCompleted', 'scene', 'scene', 'questStarted']);
        expect(events[1]).toEqual({ type: 'scene', speaker: { name: 'A', hero: true }, lines: ['a'] });
        expect(events[2].speaker.npc).toBe('change');
        expect(markEnemyDefeated(s, 'sun_1')).toEqual([]);
    });

    test('afterScenes sans quête validée : l\'interlude suit les autres événements', () => {
        const s = createSession({});
        const gob = s.screens.rizieres.enemies.find(e => e.id === 'rizieres_goblin');
        gob.afterScenes = [{ speaker: { name: 'X' }, lines: ['x'] }];
        const events = markEnemyDefeated(s, 'rizieres_goblin');
        delete gob.afterScenes;
        expect(events.map(e => e.type)).toEqual(['scene']);
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
        const { s, ex: exit, dx, dy, x, y } = atGate('rizieres', 'fleuve_village');
        expect(isExitLocked(s, exit)).toBe(true);
        const res = tryMove(s, dx, dy, { playerLevel: 50 });
        expect(res).toEqual({
            type: 'exitBlocked', reason: 'quest', label: 'Port-à-Sec de Hekou', regionName: SCREENS.fleuve_village.name, message: exit.lockedMessage
        });
        expect([s.data.screenId, s.data.x, s.data.y]).toEqual(['rizieres', x, y]);
        markEnemyDefeated(s, 'sun_1');
        expect(isExitLocked(s, exit)).toBe(false);
        expect(tryMove(s, dx, dy, { playerLevel: 50 }).type).toBe('transition');
    });

    test('la sortie de la zone sauvage reste fermée tant que son gate n\'est pas rempli', () => {
        const { s, ex: exit, dx, dy } = atGate('rizieres_wild', 'rizieres');
        expect(isExitLocked(s, exit)).toBe(true);
        expect(tryMove(s, dx, dy, { playerLevel: 50 })).toMatchObject({ type: 'exitBlocked', reason: 'quest', message: exit.lockedMessage });
        expect(s.data.screenId).toBe('rizieres_wild');
        markEnemyDefeated(s, 'rizieres_warden');
        expect(isExitLocked(s, exit)).toBe(false);
        expect(tryMove(s, dx, dy, { playerLevel: 1 })).toMatchObject({ type: 'transition', to: 'rizieres' });
        // un gate de type coffre ou quête rouvre aussi la sortie
        const f = atGate('fleuve_wild', 'fleuve').s;
        const fexit = SCREENS.fleuve_wild.exits.find(e => e.to === 'fleuve');
        expect(isExitLocked(f, fexit)).toBe(true);
        f.data.openedChests.push(fexit.requires);
        expect(isExitLocked(f, fexit)).toBe(false);
        const b = atGate('bambous_wild', 'bambous').s;
        const bexit = SCREENS.bambous_wild.exits.find(e => e.to === 'bambous');
        expect(isExitLocked(b, bexit)).toBe(true);
        b.data.quests[bexit.requires] = 'done';
        expect(isExitLocked(b, bexit)).toBe(false);
    });

    test('la condition de quête passe avant le niveau, la sortie ouest reste toujours libre', () => {
        const east = atGate('fleuve', 'bambous_village');
        expect(tryMove(east.s, east.dx, east.dy, { playerLevel: 1 })).toMatchObject({ type: 'exitBlocked', reason: 'quest' });   // le niveau n'y est pour rien
        const west = atGate('fleuve', 'fleuve_wild');
        expect(tryMove(west.s, west.dx, west.dy, { playerLevel: 1 }).type).toBe('transition');
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
            const east = gateOf(id, `${ORDER[i + 1]}_village`);
            expect(isExitLocked(s, east)).toBe(true);
            markEnemyDefeated(s, `sun_${i + 1}`);
            expect(isExitLocked(s, east)).toBe(false);
        });
    });
});

describe('Nouvelle Partie +', () => {
    // Histoire jouée en entier à travers le monde (village, zones sauvages, gates, sanctuaires) jusqu'à l'épilogue.
    const endedSession = () => {
        const s = createSession({ introSeen: true });
        completeStory(s);
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
        expect(s.data.visitedScreens.length).toBeGreaterThan(30);
        expect(startNewGamePlus(s)).toBe(true);
        expect(s.data).toMatchObject({
            screenId: START_SCREEN, x: SCREENS[START_SCREEN].spawn.x, y: SCREENS[START_SCREEN].spawn.y,
            quests: {}, defeated: [], openedChests: [], talked: [], visitedScreens: [START_SCREEN],
            ended: false, introSeen: true, ngPlus: 1
        });
        expect(s.rt.grace).toBeGreaterThan(0);
        expect(questStatus(s, quest('q_sun_1'))).toBe('available');
        expect(currentObjectiveText(s)).toContain('Doyen Wen');
        // les verrous de l'histoire sont revenus : sanctuaire (soleil) et zone sauvage (gate)
        expect(isExitLocked(s, gateOf('rizieres', 'fleuve_village'))).toBe(true);
        expect(isExitLocked(s, SCREENS.rizieres_wild.exits.find(e => e.to === 'rizieres'))).toBe(true);
        // les ennemis d'histoire sont de retour, et l'autel est de nouveau caché
        teleportToScreen(s, 'rizieres');
        expect(aliveEnemies(s).map(e => e.def.id)).toEqual(expect.arrayContaining(['fengmeng_1', 'sun_1']));
        teleportToScreen(s, 'lune');
        expect(visibleChests(s).map(c => c.id)).not.toContain('moon_altar');
    });

    test('la première visite des écrans redéclenche les textes d\'arrivée', () => {
        const s = endedSession();
        startNewGamePlus(s);
        // le village de départ est déjà « visité » (prologue) ; les autres écrans rejouent leur texte
        expect(s.data.visitedScreens).toEqual([START_SCREEN]);
        const wild = tryMove(at(START_SCREEN, 18, 6), 1, 0, { playerLevel: 5 });
        expect(wild).toMatchObject({ type: 'transition', to: 'rizieres_wild', firstVisit: true });
        expect(wild.arrival).toEqual(SCREENS.rizieres_wild.arrival);
        const g = beforeGate('rizieres', 'fleuve_village');
        const t = createSession({ ...s.data, screenId: 'rizieres', x: g.x, y: g.y });
        markEnemyDefeated(t, 'sun_1');
        const res = tryMove(t, g.dx, g.dy, { playerLevel: 5 });
        expect(res).toMatchObject({ type: 'transition', to: 'fleuve_village', firstVisit: true });
        expect(res.arrival).toEqual(SCREENS.fleuve_village.arrival);
    });

    test('les cycles se cumulent, chacun demande de terminer l\'histoire', () => {
        const s = endedSession();
        startNewGamePlus(s);
        expect(startNewGamePlus(s)).toBe(false);   // `ended` est retombé à false
        completeStory(s);                           // le héros rejoue toute la traversée du monde
        expect(s.data.ended).toBe(true);
        expect(startNewGamePlus(s)).toBe(true);
        expect(s.data.ngPlus).toBe(2);
    });

    test('les ennemis sont plus puissants en Nouvelle Partie +', () => {
        const s = endedSession();
        startNewGamePlus(s);
        expect(encounterFor(s, 'sun_1', 20).level).toBe(3 + 3);               // le niveau du héros n'intervient pas
        expect(encounterFor(s, 'sun_9', 1).boss.level).toBe(17 + 3);
        expect(encounterFor(s, 'fengmeng_3a', 1).boss.level).toBe(18 + 3);
        expect(encounterFor(s, 'rizieres_shroom', 5).level).toBe(encounterFor(createSession({}), 'rizieres_shroom', 5).level + 1);
    });

    test('le journal est vide au départ d\'une Nouvelle Partie +, la progression reste sérialisable', () => {
        const s = endedSession();
        startNewGamePlus(s);
        expect(journalEntries(s)).toEqual([]);   // rien n'est activé : le journal reste vide tant qu'on n'a parlé à personne
        expect(questStatus(s, s.quests.find(q => q.id === 'q_sun_1'))).toBe('available');
        const copy = createSession(JSON.parse(JSON.stringify(s.data)));
        expect(copy.data.ngPlus).toBe(1);
        expect(copy.data.defeated).toEqual([]);
    });
});

describe('texte d\'arrivée', () => {
    test('renvoyé une seule fois, à la première visite de l\'écran', () => {
        const { s, x, y, dx, dy } = atGate('rizieres', 'fleuve_village');
        markEnemyDefeated(s, 'sun_1');
        const first = tryMove(s, dx, dy, { playerLevel: 5 });
        expect(first).toMatchObject({ type: 'transition', to: 'fleuve_village', firstVisit: true });
        expect(first.arrival).toEqual(SCREENS.fleuve_village.arrival);
        // retour aux rizières puis nouvelle entrée au village du fleuve : plus de texte
        enterScreen(s, 'rizieres', { x, y });
        const again = tryMove(s, dx, dy, { playerLevel: 5 });
        expect(again).toMatchObject({ type: 'transition', to: 'fleuve_village', firstVisit: false });
        expect(again.arrival).toBeUndefined();
    });

    test('chaque zone a son texte à la première visite : village (arrivée de la région), puis zone sauvage', () => {
        const g = atGate('fleuve_village', 'fleuve_wild', { quests: { jq_passerelle_hekou: 'done' } });   // passerelle déjà ouverte
        const res = tryMove(g.s, g.dx, g.dy, { playerLevel: 5 });
        expect(res).toMatchObject({ type: 'transition', to: 'fleuve_wild', firstVisit: true });
        expect(res.arrival).toEqual(SCREENS.fleuve_wild.arrival);
        expect(res.arrival.length).toBeGreaterThan(0);
    });

    test('une sauvegarde qui a déjà visité l\'écran ne rejoue pas le texte', () => {
        const s = createSession({ screenId: 'rizieres', x: 12, y: 4, visitedScreens: ['rizieres', 'fleuve_village'], defeated: ['sun_1'] });
        expect(tryMove(s, 1, 0, { playerLevel: 5 }).arrival).toBeUndefined();
    });

    test('l\'écran de départ (couvert par le prologue) est visité dès la création : pas de texte au retour', () => {
        expect(createSession({}).data.visitedScreens).toEqual([START_SCREEN]);
        const g = atGate('rizieres_wild', 'rizieres_village', { visitedScreens: [START_SCREEN] });
        const res = tryMove(g.s, g.dx, g.dy, { playerLevel: 1 });
        expect(res).toMatchObject({ type: 'transition', to: START_SCREEN, firstVisit: false });
        expect(res.arrival).toBeUndefined();
    });

    test('les villages, zones sauvages et sanctuaires ont un texte d\'arrivée non vide (hors sanctuaire de départ)', () => {
        screens.filter(s => ['village', 'wild'].includes(s.kind)).forEach(s => expect([s.id, s.arrival?.length > 0]).toEqual([s.id, true]));
        sanctuaries.filter(s => s.id !== 'rizieres').forEach(s => expect([s.id, s.arrival?.length > 0]).toEqual([s.id, true]));
        const regionText = id => [`${id}_village`, `${id}_wild`, id].flatMap(sid => SCREENS[sid].arrival || []).join(' ');
        expect(regionText('volcan')).toMatch(/Fengmeng/);
        expect(regionText('fusang')).toMatch(/Dixième|dixième/);
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
        const s = atL('rizieres', 0, 1);
        const path = findPath(s, 4, 1);
        expect(path).not.toBeNull();
        expect(path.length).toBeGreaterThan(4);
        path.forEach(p => expect(isTerrainBlocked(LEGACY.screens.rizieres, p.x, p.y)).toBe(false));
        expect(walk(s, path)).toEqual({ type: 'moved' });
        expect([s.data.x, s.data.y]).toEqual([4, 1]);
    });

    test('destination invalide : obstacle, liquide, hors carte ou non entière', () => {
        const s = atL('rizieres', 3, 4);
        expect(findPath(s, 2, 2)).toBeNull();   // maison
        expect(findPath(s, 1, 8)).toBeNull();   // mare
        expect(findPath(s, -1, 4)).toBeNull();
        expect(findPath(s, 26, 4)).toBeNull();   // hors carte (26 × 20)
        expect(findPath(s, 3, 20)).toBeNull();
        expect(findPath(s, 3.5, 4)).toBeNull();
    });

    test('destination isolée : null', () => {
        // PNJ muré par quatre obstacles : sa tuile est valide mais aucune case voisine n'est accessible
        const s = synthSession({
            obstacles: [[3, 1, 1, 1], [3, 3, 1, 1], [2, 2, 1, 1], [4, 2, 1, 1]],
            npcs: [{ id: 'n', x: 3, y: 2, name: 'N', title: 'T', idle: ['…'] }]
        });
        expect(findPath(s, 3, 2)).toBeNull();
    });

    test('vers un PNJ : le chemin finit sur sa tuile et la dernière étape ouvre le dialogue', () => {
        const s = atClick('rizieres_village', 14, 6);
        const path = findPath(s, 12, 6);
        expect(path[path.length - 1]).toEqual({ x: 12, y: 6 });
        expect(walk(s, path)).toEqual({ type: 'talk', npcId: 'xiaobao' });
        expect([s.data.x, s.data.y]).not.toEqual([12, 6]);
    });

    test('vers un coffre : la dernière étape l\'ouvre', () => {
        const s = atL('rizieres', 3, 7);
        const path = findPath(s, 3, 9);
        expect(path).not.toBeNull();
        expect(walk(s, path)).toEqual({ type: 'chest', chestId: 'lotus_cache' });
    });

    test('un PNJ ou un coffre n\'est jamais un point de passage', () => {
        const s = atClick('rizieres_village', 12, 5);
        // Xiaobao est en (12,6) (mur à l'ouest) : aller de (12,5) à (12,7) impose de la contourner par l'est
        const path = findPath(s, 12, 7);
        expect(path.some(p => p.x === 12 && p.y === 6)).toBe(false);
        expect(path.length).toBe(4);
        // la pierre de voyage est un obstacle comme un PNJ
        const wp = SCREENS.rizieres_village.waypoint;
        const w = atClick('rizieres_village', wp.x - 1, wp.y);
        expect(findPath(w, wp.x + 1, wp.y).some(p => p.x === wp.x && p.y === wp.y)).toBe(false);
    });

    test('vers un ennemi : la dernière étape lance le combat', () => {
        const s = atL('rizieres', 3, 4);
        const path = findPath(s, 6, 4);
        expect(path[path.length - 1]).toEqual({ x: 6, y: 4 });
        expect(walk(s, path)).toMatchObject({ type: 'combat', enemyId: 'fengmeng_1' });
    });

    test('un ennemi n\'est jamais traversé', () => {
        const s = atL('fleuve', 1, 4);
        const path = findPath(s, 12, 4);
        aliveEnemies(s).forEach(e => expect(path.some(p => p.x === e.x && p.y === e.y)).toBe(false));
    });

    test('un mirage ou un boss protégé reste une destination valide (dialogue au lieu du combat)', () => {
        const g = atL('gobi', 9, 2);
        g.rt.grace = 0;
        expect(findPath(g, 9, 1)).toEqual([{ x: 9, y: 1 }]);
        expect(walk(g, findPath(g, 9, 1))).toMatchObject({ type: 'illusion', enemyId: 'mirage_1' });
        const f = atL('fauves', 11, 7);
        expect(walk(f, findPath(f, 11, 8))).toMatchObject({ type: 'shielded', enemyId: 'sun_7' });
    });

    test('contourne la zone de vigilance d\'un ennemi plutôt que de la traverser en ligne droite', () => {
        const s = synthSession({ enemies: [enemyDef('g', 3, 1)] });
        const path = findPath(s, 6, 2);
        expect(path.length).toBeGreaterThan(6);   // détour : la ligne droite traverserait l'aura
        const near = p => Math.max(Math.abs(p.x - 3), Math.abs(p.y - 1)) <= AGGRO_RADIUS;
        expect(path.some(near)).toBe(false);
        expect(walk(s, path)).toEqual({ type: 'moved' });
    });

    test('la longueur du chemin est minimale (Manhattan quand la voie est libre)', () => {
        const s = atClick('rizieres_village', 1, 5);
        const path = findPath(s, 6, 5);
        expect(path).toHaveLength(5);
    });

    test('une sortie n\'est franchie que si c\'est la destination', () => {
        const s = atClick('rizieres_village', 18, 5);
        const toExit = findPath(s, 19, 6);
        expect(toExit[toExit.length - 1]).toEqual({ x: 19, y: 6 });
        expect(walk(s, toExit)).toMatchObject({ type: 'transition', to: 'rizieres_wild' });
        // aller à côté de la sortie ne fait pas changer d'écran
        const s2 = atClick('rizieres_village', 18, 5);
        walk(s2, findPath(s2, 18, 7));
        expect(s2.data.screenId).toBe('rizieres_village');
        // sanctuaire : la sortie est (fermée par le soleil) est franchissable une fois le soleil abattu
        const g3 = beforeGate('rizieres', 'fleuve_village');
        const s3 = atClick('rizieres', g3.x, g3.y - 1);
        markEnemyDefeated(s3, 'sun_1');
        expect(walk(s3, findPath(s3, g3.ex.x, g3.ex.y))).toMatchObject({ type: 'transition', to: 'fleuve_village' });
    });

    test('la sortie fermée (soleil vivant) ne fait pas changer d\'écran ; le niveau, lui, ne bloque jamais', () => {
        const g = beforeGate('rizieres', 'fleuve_village');
        const s = atClick('rizieres', g.x, g.y);
        const path = findPath(s, g.ex.x, g.ex.y);
        expect(path).toEqual([{ x: g.ex.x, y: g.ex.y }]);
        expect(tryMove(s, g.dx, g.dy, { playerLevel: 20 })).toMatchObject({ type: 'exitBlocked', reason: 'quest' });
        markEnemyDefeated(s, 'sun_1');
        expect(tryMove(s, g.dx, g.dy, { playerLevel: 1 })).toMatchObject({ type: 'transition', warning: { minLevel: 2 } });   // prévenu, pas bloqué
        expect(s.data.screenId).toBe('fleuve_village');
    });
});

describe('indicateurs de quête : maisons et direction', () => {
    const houseOf = (s, npcId) => Object.values(s.screens).find(sc => sc.interior && sc.npcs.some(n => n.id === npcId));

    test('une maison dont un PNJ donne une quête porte un « ! », puis un « ? » quand la quête est à rendre', () => {
        const s = createSession({});
        const house = houseOf(s, 'elder_wen');
        expect(house).toBeTruthy();
        expect(screenQuestMarker(s, house.id)).toBe('!');
        // le doyen est dans une maison du village de départ : la porte de cette maison est signalée
        const village = s.screens[START_SCREEN];
        expect(village.exits.some(e => e.door && e.to === house.id)).toBe(true);
        expect(houseMarkers(s).find(h => h.exit.to === house.id)).toMatchObject({ marker: '!' });
        // une maison sans quête n'a pas d'indicateur
        const quiet = village.exits.filter(e => e.door && !houseMarkers(s).some(h => h.exit.to === e.to));
        quiet.forEach(e => expect(screenQuestMarker(s, e.to)).toBe(''));
    });

    test('pas d\'indicateur de direction tant qu\'aucune quête n\'est activée', () => {
        expect(questDirection(createSession({}))).toBeNull();
    });

    test('une fois la quête activée, la direction mène vers la porte de la maison puis jusqu\'à la cible', () => {
        const s = createSession({});
        talkTo(s, 'elder_wen');
        expect(questStatus(s, s.quests.find(q => q.id === 'q_sun_1'))).toBe('active');
        const target = s.screens[s.quests.find(q => q.id === 'q_sun_1').objectives[0] && Object.values(s.screens).find(sc => sc.enemies.some(e => e.id === 'sun_1')).id];
        travel(s, START_SCREEN);
        const dir = questDirection(s);
        expect(dir).toMatchObject({ kind: 'exit' });
        const here = s.screens[s.data.screenId];
        expect(here.exits.some(e => e.x === dir.x && e.y === dir.y)).toBe(true);
        // sur l'écran de la cible, la flèche vise la cible elle-même
        enterScreen(s, target.id, target.spawn);
        expect(questDirection(s)).toMatchObject({ kind: 'target' });
    });

    test('la quête épinglée prime sur la quête principale', () => {
        const s = createSession({});
        talkTo(s, 'elder_wen');
        expect(setTrackedQuest(s, 'q_sun_1')).toBe('q_sun_1');
        expect(questDirection(s)).not.toBeNull();
    });
});

describe('déplacement au clic : évitement des zones de combat', () => {
    // Écran 9×5 sans obstacle : un ennemi fixe au centre, le héros à gauche. Le plus court chemin droit traverse son aura.
    function arena(extra = {}) {
        const base = SCREENS[START_SCREEN];
        const screen = {
            ...base, id: START_SCREEN, w: 9, h: 5, obstacles: [], liquids: [], buildings: [], npcs: [], chests: [], exits: [], waypoint: null,
            spawn: { x: 0, y: 2 },
            enemies: [{ id: 'arena_foe', x: 4, y: 2, name: 'Foe', templateId: 'goblin_saboteur', kind: 'sentinel', facing: { dx: -1, dy: 0 } }],
            ...extra
        };
        const s = createSession({}, { [START_SCREEN]: screen }, []);
        s.data.x = 0; s.data.y = 2;
        return s;
    }
    // L'ennemi regarde vers la gauche : sa zone est la colonne devant lui (x = ex - 1)
    const inAura = (p, ex = 4, ey = 2) => p.x === ex - 1 && Math.abs(p.y - ey) <= AGGRO_RADIUS;

    test('le trajet contourne la zone de vigilance quand c\'est possible', () => {
        const s = arena();
        const path = findPath(s, 8, 2);
        expect(path).not.toBeNull();
        expect(path.some(p => inAura(p))).toBe(false);
    });

    test('viser l\'ennemi (ou une case de son aura) autorise à entrer dans sa zone', () => {
        const s = arena();
        const path = findPath(s, 4, 2);
        expect(path.at(-1)).toEqual({ x: 4, y: 2 });
        expect(findPath(s, 3, 2).some(p => inAura(p))).toBe(true);
    });
});

describe('maisons : aucun texte du Narrateur à l\'entrée', () => {
    test('aucune maison n\'a de texte d\'arrivée', () => {
        const houses = Object.values(SCREENS).filter(sc => sc.interior);
        expect(houses.length).toBeGreaterThan(10);
        houses.forEach(h => expect([h.id, h.arrival]).toEqual([h.id, undefined]));
    });
});


describe('zone de vigilance : uniquement devant l\'ennemi', () => {
    const foeAt = (face, hero) => {
        const s = createSession({}, { [START_SCREEN]: {
            ...SCREENS[START_SCREEN], id: START_SCREEN, w: 9, h: 9, obstacles: [], liquids: [], buildings: [], npcs: [], chests: [], exits: [], waypoint: null,
            spawn: { x: 0, y: 0 },
            enemies: [{ id: 'foe', x: 4, y: 4, name: 'Foe', templateId: 'goblin_saboteur', kind: 'sentinel', facing: face }]
        } }, []);
        s.data.x = hero.x; s.data.y = hero.y;
        return s;
    };
    const cells = s => [...getAuraTiles(s)].filter(k => k !== '4,4').sort();

    test('de face (vers le bas) : les 3 cases devant, rien derrière ni sur les côtés', () => {
        expect(cells(foeAt({ dx: 0, dy: 1 }, { x: 0, y: 0 }))).toEqual(['3,5', '4,5', '5,5']);
    });
    test('de côté (vers la droite) : la zone est sur son côté', () => {
        expect(cells(foeAt({ dx: 1, dy: 0 }, { x: 0, y: 0 }))).toEqual(['5,3', '5,4', '5,5']);
    });
    test('de dos : le héros passe derrière sans déclencher le combat (embuscade possible)', () => {
        const s = foeAt({ dx: 0, dy: 1 }, { x: 4, y: 2 });
        s.rt.grace = 0;
        expect(tryMove(s, 0, 1)).toEqual({ type: 'moved' });          // (4,3) : juste derrière
        expect(tryMove(s, 0, 1)).toEqual({ type: 'combat', enemyId: 'foe' });   // le toucher lance le combat
    });
    test('devant lui, le héros est repéré', () => {
        const s = foeAt({ dx: 0, dy: 1 }, { x: 4, y: 7 });
        s.rt.grace = 0;
        expect(tryMove(s, 0, -1)).toMatchObject({ type: 'moved' });   // (4,6) : hors zone
        expect(tryMove(s, 0, -1)).toEqual({ type: 'combat', enemyId: 'foe' });   // (4,5) : devant lui
    });
});

// Moteur de la phase d'exploration (logique pure, sans DOM).
//
// Le joueur se déplace tuile par tuile sur l'écran courant (SCREENS de story.js).
// Les ennemis sont visibles sur la carte : un combat se déclenche quand on entre dans
// leur zone de vigilance (AGGRO_RADIUS tuile autour d'eux) ou qu'on les percute — on peut
// donc les éviter en faisant le tour. La progression (position, ennemis vaincus, coffres,
// quêtes) est stockée dans `player.exploration` (JSON sérialisable) ; l'état volatil
// (positions des patrouilleurs, période de grâce) vit dans `session.rt`.
//
// Extensions de données (voir story.js) :
//  - showWhen / hideWhen (ennemis, PNJ, coffres) : l'entité n'existe que lorsque la condition
//    d'avancement est remplie (showWhen) / tant qu'elle ne l'est pas (hideWhen) ;
//  - illusion : au contact ou dans l'aura, l'ennemi se dissipe (événement `illusion`), pas de combat ;
//  - shieldedBy : boss protégé tant que le groupe d'ennemis n'est pas vaincu (événement `shielded`) ;
//  - unsealedBy : [conditions] ; chemin « relationnel » : si UNE condition est remplie (parlementer avec un PNJ `parley`, quête annexe…), le bouclier
//                 tombe sans combat (les gardes `hideWhen` la même condition s'écartent) ;
//  - parley     : sur un PNJ, { lines } : la première conversation est un pourparler, il compte comme « parlé » (progressReached) ;
//  - weakenedBy : [conditions] ; chaque condition remplie retire 1 niveau au boss (2 au plus, voir bossEase) ;
//  - defeatScene : scène jouée au retour sur la carte après la victoire (événement `scene`) ;
//  - afterScenes : [{ speaker, lines }] jouées une seule fois après le texte de victoire des quêtes
//    (événements `scene`, insérés après le dernier `questCompleted`) : interludes à plusieurs voix ;
//  - arrival (PNJ) : { hop? } ; avec `showWhen: <id d'un ennemi de l'écran>`, le PNJ ne surgit pas : à la victoire sur cet ennemi, un événement
//    `npcArrival` (après toutes les scènes) le fait rejoindre le héros en sautillant, puis sa conversation s'ouvre d'elle-même ;
//  - bait (PNJ) : { enemy, lines, retry } ; lui parler fait surgir l'ennemi `enemy` (tant qu'il n'est pas vaincu) : les lignes sont
//    dites, puis le combat démarre (résultat `combat` de talkToNpc) ; `retry` remplace `lines` aux conversations suivantes ;
//  - chain (ennemi) : id d'un ennemi attaqué tout de suite après sa victoire (événement `chain`, après les scènes) ;
//    carryHp / chainedFrom (ennemi suivant) : le héros garde ses PV, et une défaite annule la victoire sur `chainedFrom` ;
//  - duel : règles de duel recopiées dans la rencontre (miroir, héros affaibli, tirs rapides, pièges : duel.js) ;
//  - exit.requires : sortie fermée tant que la condition n'est pas remplie ;
//  - exit.closedWhen : sortie refermée dès que la condition est remplie (message : exit.closedMessage) ; sert aux événements (events/) ;
//  - exit.rememberReturn : { x, y } ; en franchissant la sortie, mémorise l'écran d'origine et cette case (data.eventReturn) ;
//    exit.returnToSaved : la sortie ramène à cette case mémorisée (sinon à exit.arrive) : un écran d'événement accessible de partout ;
//  - screen.eventNotice : { id, title, lines } annonce affichée une seule fois à la première arrivée (data.eventNotices) ;
//  - data.ngPlus : compteur de Nouvelle Partie + (niveaux des ennemis augmentés) ;
//  - arène (arena.js) : écrans `kind: 'arena'`, `data.arena` = { cleared, best, wins, returnTo } ; entrée par
//    enterArena (point de retour mémorisé), sortie à tout moment par leaveArena (bouton du HUD, sortie
//    `leaveArena` d'une salle), défaite = expulsion ; revenir au parvis remet les gardiens en place ;
//  - hautes herbes (`screen.grass` = { cells: [[x,y,w,h]…], rate, safeSteps, table: [{ templateId, name, weight, offset }] }) :
//    marcher dessus peut déclencher un combat aléatoire non persistant (ennemi synthétique `wild:<écran>:<n>`, jamais dans
//    `data.defeated` ni dans la sauvegarde ; état volatil dans `session.rt`) ; voir grassOf / tryMove / encounterFor.
//    L'eau et la lave (`screen.liquids`, franchissables avec le Pas de Yu ou en écran aquatique) agissent comme des buissons :
//    mêmes tirages, table des herbes de la carte ou, à défaut, de la carte sauvage de la région (encounterOf / isEncounterCell).

import { PUZZLES, PUZZLE_SETS, isSetComplete, puzzlesOfSet, pieceOfPuzzle } from './puzzle/levels.js';
import { SCREENS, QUESTS, REGION_UNLOCK_LEVEL } from './story.js';
import { REGION_LEVEL } from './world/index.js';
import { weakColorOfTemplate } from './enemies.js';
import { isLowObstacle } from './decor.js';
import { approachOf, FACE_FRONT, faceFromStep, spotAt, buildPrep, observationTarget } from './terrain.js';
import { crossBorder, onSide, dirOfStep, overlapOf } from './mapConnections.js';
import { launchNotices } from './events/engine.js';
import { defaultChangeData, normalizeChangeData } from './change/state.js';
import { EVENT_MODULES } from './events/registry.js';
import { ARENA_HALL, ARENA_TIERS, arenaTier, arenaEncounterInfo, normalizeArenaData } from './arena.js';
import { MIMIC_NAME, MIMIC_SPRITE, clearMarker, isMimicChest, markerOf, reclosePastChests, revealFog } from './explorationSenses.js';
export * from './explorationSenses.js';
import { checkAutoQuests, objectiveDone, progressReached, questById, questStatus } from './explorationQuests.js';
export * from './explorationQuests.js';
export * from './explorationDialogue.js';
export * from './explorationGuide.js';
import { activateWaypoint, discoverVillageWaypoint, recordBestiary } from './explorationTravel.js';
export * from './explorationTravel.js';
export * from './explorationChange.js';

export const AGGRO_RADIUS = 1;
// Rayon de vigilance d'un ennemi : 1 case pour un ennemi normal, 0 pour un boss (ou le gardien d'une porte) : il faut alors
// aller le chercher explicitement (le toucher). Valable sur toutes les cartes, agrandies ou non. Exception : un boss qui déclare
// explicitement `sight` (Fengmeng, qui barre un défilé de 3 cases) a une zone de détection pour qu'on ne puisse pas l'esquiver.
export const aggroOf = def => (def?.guardsDoor ? 0 : (def?.sight ?? (def?.boss ? 0 : AGGRO_RADIUS)));
export const PATROL_STEP_MS = 650;
export const START_SCREEN = SCREENS.rizieres_village ? 'rizieres_village' : 'rizieres';
// Nombre de déplacements pendant lesquels les zones de vigilance sont ignorées après une
// arrivée sur un écran ou un retour de combat (évite de re-combattre immédiatement).
export const GRACE_MOVES = 2;

const inRect = (rects, x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

// ── Hautes herbes : rencontres aléatoires (voir world/DESIGN-V2.md §5) ───────────────────────────
export const GRASS_RATE = 0.12;          // probabilité de rencontre par pas sur l'herbe, une fois les pas de grâce passés
export const MOUNTED_GRASS_FACTOR = 0.4;   // à cheval : 40 % de la probabilité de rencontre (le cheval galope trop vite pour être surpris)
export const GRASS_SAFE_STEPS = 3;       // pas d'herbe sans rencontre après l'arrivée sur la carte ou un combat
export const WILD_PREFIX = 'wild:';      // identifiant synthétique d'une créature d'herbe : wild:<écran>:<n>
export const WILD_INTRO = 'Des créatures se cachent dans les hautes herbes, l\'eau et la lave.';
const WILD_KEEP = 4;                     // définitions synthétiques gardées en mémoire (la rencontre en cours + quelques-unes)
export const isWildId = id => typeof id === 'string' && id.startsWith(WILD_PREFIX);

// Hautes herbes d'une carte, normalisées : { cells, rate, safeSteps, table } ou null (aucune herbe, ou carte sans rencontre :
// zone sûre, intérieur, arène). La table ne garde que les entrées valides (templateId, poids > 0, décalage entier).
export function grassOf(screen) {
    const g = screen?.grass;
    if (!g || screen.safe || screen.interior || screen.arena || screen.kind === 'arena') return null;
    const cells = Array.isArray(g.cells) ? g.cells.filter(r => Array.isArray(r) && r.length >= 4) : [];
    if (cells.length === 0 && !g.water) return null;   // `water` : table propre à la carte, déclenchée par l'eau (world/maps/marees.js)
    const rate = Number.isFinite(g.rate) ? Math.min(1, Math.max(0, g.rate)) : GRASS_RATE;
    const safeSteps = Number.isInteger(g.safeSteps) && g.safeSteps >= 0 ? g.safeSteps : GRASS_SAFE_STEPS;
    const table = (Array.isArray(g.table) ? g.table : [])
        .filter(t => t && typeof t.templateId === 'string' && t.templateId)
        .map(t => ({
            templateId: t.templateId,
            name: typeof t.name === 'string' && t.name ? t.name : t.templateId,
            weight: Number.isFinite(t.weight) && t.weight > 0 ? t.weight : 1,
            offset: Number.isInteger(t.offset) ? t.offset : 0
        }));
    return { cells, rate, safeSteps, table };
}

export { isLowObstacle };

// La carte a-t-elle des obstacles bas franchissables (roseaux) ? Calculé une fois par jeu d'obstacles.
const lowObstacleCache = new WeakMap();
function hasLowObstacles(screen) {
    const key = screen.obstacles;
    if (!Array.isArray(key)) return false;
    if (!lowObstacleCache.has(key)) {
        let found = false;
        for (const [rx, ry, rw, rh] of key) {
            for (let x = rx; x < rx + rw && !found; x++) for (let y = ry; y < ry + rh && !found; y++) found = isLowObstacle(screen, x, y);
            if (found) break;
        }
        lowObstacleCache.set(key, found);
    }
    return lowObstacleCache.get(key);
}

// Rencontres aléatoires d'une carte : les hautes herbes, plus l'eau et la lave (`screen.liquids`, franchissables avec le Pas de Yu
// ou dans un écran aquatique) et les obstacles bas (roseaux, decor.js) qui agissent comme des buissons. Table et taux : ceux des herbes de la carte, à défaut ceux de la
// carte sauvage de la région. Null sur une zone sûre, un intérieur, une arène ou sans table.
export function encounterOf(screen) {
    const own = grassOf(screen);
    if (own) return own;
    if (!screen || screen.safe || screen.interior || screen.arena || screen.kind === 'arena') return null;
    if (!(screen.liquids || []).length && !hasLowObstacles(screen)) return null;
    const wild = grassOf(SCREENS[`${screen.region}_wild`]);
    return wild && wild.table.length ? { cells: [], rate: wild.rate, safeSteps: wild.safeSteps, table: wild.table } : null;
}

// La case (x, y) déclenche-t-elle des rencontres : hautes herbes, eau ou lave ?
export function isEncounterCell(screen, x, y) {
    const g = encounterOf(screen);
    return Boolean(g) && (inRect(g.cells, x, y) || inRect(screen.liquids || [], x, y) || isLowObstacle(screen, x, y));
}

// La case (x, y) de la carte est-elle une case de hautes herbes ?
export function isGrassCell(screen, x, y) {
    const g = grassOf(screen);
    return Boolean(g) && inRect(g.cells, x, y);
}

// Le compteur de pas dans l'herbe repart de zéro (changement de carte, fin de combat).
export function resetGrassSteps(session) {
    session.rt.grassSteps = 0;
}

// Message d'explication, une seule fois par session, à la première rencontre d'herbe (null ensuite).
export function takeWildIntro(session) {
    if (!session.rt.wildIntroPending) return null;
    session.rt.wildIntroPending = false;
    return WILD_INTRO;
}

// Annonces de lancement des événements activés (events/engine.js `launchNotices`) pas encore lues dans cette partie : une seule fois chacune
// (`data.eventNotices`), au premier chargement du jeu ; renvoie [] ensuite.
export function takeLaunchNotices(session) {
    const fresh = launchNotices(session.screens, EVENT_MODULES).filter(n => !session.data.eventNotices.includes(n.id));
    fresh.forEach(n => session.data.eventNotices.push(n.id));
    return fresh;
}

// Quête qui enseigne le « Pas de Yu » (yubu) : une fois terminée, le héros marche sur les eaux.
export const YUBU_QUEST = 'sq_pas_de_yu';
export const canWalkOnWater = session => session?.data?.quests?.[YUBU_QUEST] === 'done';

// Cheval : `owned` = le héros possède une monture. Il est en selle tant qu'il ne l'a pas quittée (`data.mounted === false`) ;
// il descend tout seul sur l'eau (le cheval ne marche pas sur les eaux) et remonte à la demande, sur la terre ferme.
export const isRiding = (session, owned) => Boolean(owned) && session.data.mounted !== false && !session.rt?.changeMode;   // Chang'e va à pied
export function isOnLiquid(session) {
    const screen = session.screens[session.data.screenId];
    return Boolean(screen) && inRect(screen.liquids || [], session.data.x, session.data.y);
}
// À appeler après chaque déplacement : met pied à terre si le héros est sur l'eau. Renvoie true s'il vient de descendre.
export function autoDismount(session, owned) {
    if (!isRiding(session, owned) || !isOnLiquid(session)) return false;
    session.data.mounted = false;
    return true;
}
// Touche « monter / descendre ». Renvoie { type: 'mount' | 'dismount' | 'refused' | 'none', message }.
export function toggleMount(session, owned) {
    if (!owned) return { type: 'none', message: '' };
    if (isRiding(session, owned)) {
        session.data.mounted = false;
        return { type: 'dismount', message: 'Vous descendez de cheval.' };
    }
    if (isOnLiquid(session)) return { type: 'refused', message: 'Impossible de monter en selle sur l\'eau : le cheval ne suit pas.' };
    session.data.mounted = true;
    return { type: 'mount', message: 'Vous montez en selle.' };
}

// Les liquides bloquent, sauf pour qui marche sur l'eau (`onWater`) ; dans un écran aquatique (`screen.aquatic`) on n'entre
// qu'avec le Pas de Yu, ses eaux sont donc toujours franchissables.
// Corniche (rebord à sens unique, world/levelDesign.js) : [dx, dy] du saut permis sur la case (x, y), ou null.
const ledgeCache = new WeakMap();
export function ledgeAt(screen, x, y) {
    const list = screen.ledges;
    if (!Array.isArray(list) || !list.length) return null;
    let map = ledgeCache.get(list);
    if (!map) { map = new Map(list.map(([lx, ly, dx, dy]) => [`${lx},${ly}`, [dx, dy]])); ledgeCache.set(list, map); }
    return map.get(`${x},${y}`) || null;
}

export function isTerrainBlocked(screen, x, y, onWater = false) {
    if (x < 0 || y < 0 || x >= screen.w || y >= screen.h) return true;
    if (screen.ledges && ledgeAt(screen, x, y)) return true;   // une corniche ne se marche pas : on la saute (tryMove)
    if (inRect(screen.obstacles, x, y) && !isLowObstacle(screen, x, y)) return true;   // les roseaux se traversent
    return !(onWater || screen.aquatic) && inRect(screen.liquids || [], x, y);
}

// Trajet complet d'un patrouilleur : segments axe par axe entre les points de passage.
export function buildRoute(waypoints) {
    const route = [];
    for (let i = 0; i < waypoints.length; i++) {
        const [tx, ty] = waypoints[i];
        if (i === 0) { route.push({ x: tx, y: ty }); continue; }
        let { x, y } = route[route.length - 1];
        while (x !== tx) { x += Math.sign(tx - x); route.push({ x, y }); }
        while (y !== ty) { y += Math.sign(ty - y); route.push({ x, y }); }
    }
    return route;
}

const chebyshev = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

// Zone de vigilance d'un ennemi : uniquement DEVANT lui (dans le sens de son regard : en face de lui, ou de son côté s'il
// regarde de côté). Jamais derrière ni sur ses flancs : on peut le prendre de dos pour une embuscade.
export function inFront(st, r, x, y) {
    if (x === st.x && y === st.y) return true;
    if (r <= 0 || chebyshev(st.x, st.y, x, y) > r) return false;
    if (st.def?.allAround) return true;   // gardien d'arène : vigilance à 360°, impossible de l'esquiver par derrière
    return approachOf(st.face, st, { x, y }) === FACE_FRONT;
}

function defaultData() {
    const start = SCREENS[START_SCREEN];
    return {
        screenId: START_SCREEN,
        x: start.spawn.x,
        y: start.spawn.y,
        defeated: [],
        openedChests: [],
        puzzleSetsDone: [],      // familles d'énigmes dont l'armure antique a été remise
        solvedPuzzles: [],       // énigmes à plateau résolues (puzzle/levels.js) : un coffre à énigme ne s'ouvre qu'ensuite
        quests: {},
        visitedScreens: [],
        mimicked: [],            // coffres refermés au retour du joueur : des mimiques tant qu'ils ne sont pas rouverts
        returns: {},             // nombre de retours sur chaque carte (graine du tirage des coffres refermés)
        fog: {},                 // brouillard de guerre de la minimap : écran -> cases vues (hexadécimal, 4 cases par signe)
        introSeen: false,
        eventNotices: [],        // annonces d'événements déjà lues (une seule fois chacune : screen.eventNotice)
        eventReturn: null,       // écran et case d'où le héros est entré dans un écran d'événement (sortie exit.returnToSaved)
        ended: false,
        ngPlus: 0,
        talked: [],
        banterSeen: [],
        activeCompanion: null,   // compagnon qui combat à vos côtés (id, 'none' = aucun, null = le premier recruté)
        waypoints: [],
        tracked: null,
        questItems: [],
        bestiary: [],            // gabarits d'ennemis croisés en combat ou observés (onglet Bestiaire du carnet, conservé en NG+)
        change: defaultChangeData(),   // mode Chang'e (change/) : épisodes terminés, épisode en cours, soins obtenus
        arena: normalizeArenaData(null)
    };
}

export function createSession(saved, screens = SCREENS, quests = QUESTS) {
    const data = { ...defaultData(), ...(saved && typeof saved === 'object' ? saved : {}) };
    data.defeated = Array.isArray(data.defeated) ? data.defeated : [];
    data.openedChests = Array.isArray(data.openedChests) ? data.openedChests : [];
    data.solvedPuzzles = Array.isArray(data.solvedPuzzles) ? data.solvedPuzzles : [];
    data.puzzleSetsDone = Array.isArray(data.puzzleSetsDone) ? data.puzzleSetsDone : [];
    data.visitedScreens = Array.isArray(data.visitedScreens) ? data.visitedScreens : [];
    data.fog = data.fog && typeof data.fog === 'object' && !Array.isArray(data.fog) ? data.fog : {};
    data.mimicked = Array.isArray(data.mimicked) ? data.mimicked.filter(id => typeof id === 'string') : [];
    data.returns = data.returns && typeof data.returns === 'object' && !Array.isArray(data.returns) ? data.returns : {};
    data.change = normalizeChangeData(data.change);
    data.change.return = null;   // le mode n'est jamais restauré à mi-chemin : Hou Yi reprend sa place, l'épisode inachevé se rouvre par le miroir
    data.quests = data.quests && typeof data.quests === 'object' ? data.quests : {};
    data.ngPlus = Number.isInteger(data.ngPlus) && data.ngPlus > 0 ? data.ngPlus : 0;
    data.talked = Array.isArray(data.talked) ? data.talked : [];
    data.banterSeen = Array.isArray(data.banterSeen) ? data.banterSeen : [];
    data.activeCompanion = typeof data.activeCompanion === 'string' ? data.activeCompanion : null;
    data.waypoints = Array.isArray(data.waypoints) ? data.waypoints : [];
    data.tracked = typeof data.tracked === 'string' ? data.tracked : null;
    data.arena = normalizeArenaData(data.arena);
    data.questItems = Array.isArray(data.questItems) ? data.questItems.filter(i => i && typeof i.id === 'string') : [];
    data.eventNotices = Array.isArray(data.eventNotices) ? data.eventNotices.filter(id => typeof id === 'string') : [];
    data.eventReturn = data.eventReturn && typeof data.eventReturn.screenId === 'string' && Number.isInteger(data.eventReturn.x) && Number.isInteger(data.eventReturn.y) ? { screenId: data.eventReturn.screenId, x: data.eventReturn.x, y: data.eventReturn.y } : null;
    data.bestiary = Array.isArray(data.bestiary) ? [...new Set(data.bestiary.filter(id => typeof id === 'string' && id))] : [];
    data.observed = data.observed && typeof data.observed === 'object' && !Array.isArray(data.observed) ? data.observed : {};

    // Anciennes sauvegardes : un coffre d'objet de quête ouvert sans l'objet (ni quête terminée) est refermé pour pouvoir le fouiller.
    Object.values(screens).forEach(screen => screen.chests.forEach(c => {
        const qi = c.questItem;
        if (qi && data.quests[qi.quest] !== 'done' && !data.questItems.some(i => i.id === qi.id)) data.openedChests = data.openedChests.filter(id => id !== c.id);
    }));

    const enemyIndex = {};
    Object.values(screens).forEach(screen => screen.enemies.forEach(def => { enemyIndex[def.id] = { def, screenId: screen.id }; }));
    // Les mirages ne sont plus « vaincus » : ils se déplacent (anciennes sauvegardes : on les remet en jeu).
    data.defeated = data.defeated.filter(id => !enemyIndex[id]?.def.illusion);

    const session = {
        data,
        screens,
        quests,
        // grassSteps / wildSeq / wildDefs / wildIntro* : hautes herbes (volatil, jamais sauvegardé)
        rt: {
            enemies: {}, patrolTimer: 0, grace: GRACE_MOVES, facing: { dx: 0, dy: 1 }, enemyIndex,
            grassSteps: 0, wildSeq: 0, wildDefs: {}, wildIntroDone: false, wildIntroPending: false
        }
    };

    let screen = screens[data.screenId];
    // Sauvegarde importée sans position : le héros apparaît comme après un voyage rapide (pierre du terrain, sinon entrée).
    if (screen && saved && typeof saved === 'object' && saved.screenId && !Number.isInteger(saved.x)) {
        const spot = screen.waypoint?.spot || screen.spawn;
        data.x = spot.x;
        data.y = spot.y;
    }
    if (!screen || isTerrainBlocked(screen, data.x, data.y, canWalkOnWater(session))) {
        data.screenId = START_SCREEN;
        screen = screens[START_SCREEN];
        data.x = screen.spawn.x;
        data.y = screen.spawn.y;
    }
    initScreenRuntime(session);
    if (!data.visitedScreens.includes(data.screenId)) data.visitedScreens.push(data.screenId);
    revealFog(session);
    discoverVillageWaypoint(session);
    return session;
}

export const currentScreen = session => session.screens[session.data.screenId];

export function initScreenRuntime(session) {
    const screen = currentScreen(session);
    session.rt.enemies = {};
    session.rt.patrolTimer = 0;
    session.rt.stillMs = 0;
    resetGrassSteps(session);   // nouvelle carte : les pas d'herbe repartent de zéro
    screen.enemies.forEach(def => {
        const route = def.kind === 'patrol' && def.patrol ? buildRoute(def.patrol) : null;
        const face = def.facing && (def.facing.dx || def.facing.dy) ? { ...def.facing } : { dx: 0, dy: 1 };
        session.rt.enemies[def.id] = { x: def.x, y: def.y, route, idx: 0, dir: 1, face };
    });
}

// Zones de passage d'un ennemi : sa case (ou toutes celles de sa patrouille) + la zone de vigilance autour.
function enemyZoneCells(screen, def) {
    const anchors = def.kind === 'patrol' && def.patrol ? buildRoute(def.patrol) : [{ x: def.x, y: def.y }];
    const cells = new Set();
    const r = aggroOf(def);
    anchors.forEach(a => {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) cells.add((a.y + dy) * screen.w + (a.x + dx));
        }
    });
    return cells;
}

// Grille des cases fermées de l'écran (obstacles pleins, eau, corniches, hors carte), construite une fois : `isTerrainBlocked` parcourt des listes de
// rectangles, bien trop lent pour être rappelé case par case sur une carte de 64 × 32 cases (calcul des ennemis qui barrent un chemin, à chaque arrivée).
const terrainGridCache = new WeakMap();
function terrainGrid(screen) {
    const hit = terrainGridCache.get(screen);
    if (hit && hit.obstacles === screen.obstacles && hit.liquids === screen.liquids && hit.ledges === screen.ledges && hit.w === screen.w && hit.h === screen.h) return hit.grid;
    const grid = new Uint8Array(screen.w * screen.h);
    for (let y = 0; y < screen.h; y++) for (let x = 0; x < screen.w; x++) if (isTerrainBlocked(screen, x, y)) grid[y * screen.w + x] = 1;
    terrainGridCache.set(screen, { obstacles: screen.obstacles, liquids: screen.liquids, ledges: screen.ledges, w: screen.w, h: screen.h, grid });
    return grid;
}

// Composantes connexes de l'écran (terrain libre, hors cases `blocked`) : Map case → numéro de composante.
function componentsOf(screen, blocked) {
    const comp = new Map();
    const closed = terrainGrid(screen);
    let id = 0;
    for (let y = 0; y < screen.h; y++) {
        for (let x = 0; x < screen.w; x++) {
            const k = y * screen.w + x;
            if (comp.has(k) || blocked.has(k) || closed[k]) continue;
            id++;
            const stack = [[x, y]];
            comp.set(k, id);
            while (stack.length) {
                const [cx, cy] = stack.pop();
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = cx + dx, ny = cy + dy, nk = ny * screen.w + nx;
                    if (nx < 0 || ny < 0 || nx >= screen.w || ny >= screen.h || comp.has(nk) || blocked.has(nk) || closed[nk]) continue;
                    comp.set(nk, id);
                    stack.push([nx, ny]);
                }
            }
        }
    }
    return comp;
}

// Composantes de l'écran sans aucun ennemi : identiques pour tous les ennemis de l'écran, calculées une fois.
const freeComponentsCache = new WeakMap();
function freeComponentsOf(screen) {
    let hit = freeComponentsCache.get(screen);
    if (!hit || hit.obstacles !== screen.obstacles || hit.liquids !== screen.liquids) {
        hit = { obstacles: screen.obstacles, liquids: screen.liquids, comp: componentsOf(screen, new Set()) };
        freeComponentsCache.set(screen, hit);
    }
    return hit.comp;
}

const pathBlockCache = new WeakMap();

// Vrai si l'ennemi barre un chemin : sa zone de vigilance coupe l'écran (ou couvre une sortie, le point d'arrivée,
// un PNJ ou un coffre) de façon à séparer deux points qui communiquaient sans lui. Un tel ennemi, une fois vaincu, ne revient pas.
export function blocksPath(screen, def) {
    if (!pathBlockCache.has(screen)) pathBlockCache.set(screen, new Map());
    const cache = pathBlockCache.get(screen);
    if (cache.has(def.id)) return cache.get(def.id);
    const points = [...(screen.exits || []), ...(screen.npcs || []), ...(screen.chests || []), ...(screen.spawn ? [screen.spawn] : [])]
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    const free = freeComponentsOf(screen);
    const zone = enemyZoneCells(screen, def);
    const cut = componentsOf(screen, zone);
    let blocks = false;
    // Les points sont eux-mêmes des cases (sortie, PNJ…) : ils comptent même s'ils sont posés sur un obstacle,
    // alors on les rattache à la composante d'une case voisine libre.
    const compAt = (map, p) => {
        const k = p.y * screen.w + p.x;
        if (map.has(k)) return map.get(k);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = p.x + dx, ny = p.y + dy;
            if (nx >= 0 && ny >= 0 && nx < screen.w && ny < screen.h && map.has(ny * screen.w + nx)) return map.get(ny * screen.w + nx);
        }
        return null;
    };
    for (let i = 0; i < points.length && !blocks; i++) {
        for (let j = i + 1; j < points.length && !blocks; j++) {
            const fa = compAt(free, points[i]), fb = compAt(free, points[j]);
            if (fa === null || fa !== fb) continue;
            const ca = compAt(cut, points[i]), cb = compAt(cut, points[j]);
            if (ca === null || cb === null || ca !== cb) blocks = true;
        }
    }
    cache.set(def.id, blocks);
    return blocks;
}

// Un ennemi réapparaît quand on quitte l'écran puis qu'on y revient s'il n'est lié ni à l'histoire (permanent : boss,
// quêtes, groupes, scènes, mirages) ni à un passage (il ne barre aucun chemin).
export function respawns(screen, def) {
    return !def.permanent && !def.boss && !def.group && !def.illusion && !def.shieldedBy && !def.defeatScene && !blocksPath(screen, def);
}

function respawnRegularEnemies(session) {
    const screen = currentScreen(session);
    const regularIds = new Set(screen.enemies.filter(e => respawns(screen, e)).map(e => e.id));
    session.data.defeated = session.data.defeated.filter(id => !regularIds.has(id));
}

export function enterScreen(session, screenId, pos) {
    const screen = session.screens[screenId];
    if (!screen) return false;
    if (screenId === ARENA_HALL) resetArenaGuards(session);
    session.data.screenId = screenId;
    session.data.x = pos.x;
    session.data.y = pos.y;
    respawnRegularEnemies(session);
    initScreenRuntime(session);
    session.rt.grace = GRACE_MOVES;
    if (session.data.visitedScreens.includes(screenId)) reclosePastChests(session);   // retour sur une carte déjà vue
    else session.data.visitedScreens.push(screenId);
    revealFog(session);
    discoverVillageWaypoint(session);
    return true;
}

// ── Arène des Mille Flèches (arena.js) ─────────────────────────────────────
export const inArena = session => Boolean(currentScreen(session)?.arena);

// Au parvis, tous les gardiens et maîtres reprennent leur place : chaque cercle se refait à volonté.
function resetArenaGuards(session) {
    session.data.defeated = session.data.defeated.filter(id => !id.startsWith('arena_c'));
}

// Entrée dans l'arène (depuis n'importe quel écran hors arène) : mémorise le point de retour.
export function enterArena(session) {
    if (inArena(session) || !session.screens[ARENA_HALL]) return false;
    const { screenId, x, y } = session.data;
    session.data.arena.returnTo = { screenId, x, y };
    return enterScreen(session, ARENA_HALL, session.screens[ARENA_HALL].spawn);
}

// Sortie de l'arène, à tout moment : retour au point d'entrée (sinon au village de départ).
export function leaveArena(session) {
    if (!inArena(session)) return false;
    const back = session.data.arena.returnTo;
    session.data.arena.returnTo = null;
    const target = back && session.screens[back.screenId] && !session.screens[back.screenId].arena ? back : null;
    if (target && !isTerrainBlocked(session.screens[target.screenId], target.x, target.y)) {
        return enterScreen(session, target.screenId, { x: target.x, y: target.y });
    }
    return enterScreen(session, START_SCREEN, session.screens[START_SCREEN].spawn);
}

// Texte d'objectif dans l'arène.
export function arenaObjectiveText(session) {
    const screen = currentScreen(session);
    const a = session.data.arena;
    if (screen.arena.hall) {
        const open = ARENA_TIERS.filter(t => t.id === 1 || a.cleared.includes(t.id - 1)).length;
        return `${a.cleared.length}/${ARENA_TIERS.length} cercles terminés · ${open} porte${open > 1 ? 's' : ''} ouverte${open > 1 ? 's' : ''} · porte sud ou « Sortir » pour quitter l'arène`;
    }
    const tier = arenaTier(screen.arena.tier);
    const master = screen.enemies.find(e => e.arena?.master);
    if (progressReached(session, master?.id)) return `${tier.name} terminé ! Retournez au parvis par la porte sud, ou « Sortir » pour quitter l'arène`;
    const left = screen.enemies.filter(e => !e.arena?.master && !session.data.defeated.includes(e.id)).length;
    return left
        ? `${tier.name} : ${left} gardien${left > 1 ? 's' : ''} à battre avant le maître · « Sortir » pour quitter l'arène`
        : `Affrontez ${tier.master.name}, maître du ${tier.name} · « Sortir » pour quitter l'arène`;
}

// Emporte le héros là où le PNJ de passage `npcId` le mène (écran d'arrivée par défaut : son point d'apparition). Retourne une transition.
export function warpNpc(session, npcId) {
    const npc = visibleNpcs(session).find(n => n.id === npcId);
    const target = npc?.warp && session.screens[npc.warp.to];
    if (!target) return null;
    return transitionTo(session, currentScreen(session), target.id, npc.warp.pos || target.spawn, 99, { warp: true });
}

export function teleportToScreen(session, screenId) {
    const screen = session.screens[screenId];
    if (!screen) return false;
    return enterScreen(session, screenId, screen.spawn);
}

export function isEnemyAlive(session, enemyId) {
    if (session.data.defeated.includes(enemyId)) return false;
    // Un mirage copie un vrai boss (`spriteKey`) : une fois celui-ci vaincu, tous ses mirages disparaissent.
    const def = session.rt?.enemyIndex?.[enemyId]?.def;
    return !(def?.illusion && def.spriteKey && session.data.defeated.includes(def.spriteKey));
}

// Une entité (ennemi, PNJ, coffre) n'existe que si sa condition `showWhen` est remplie et que sa
// condition `hideWhen` ne l'est pas (même sémantique que `progressReached`).
export function isEntityVisible(session, def) {
    if (def.showWhen && !progressReached(session, def.showWhen)) return false;
    if (def.hideWhen && progressReached(session, def.hideWhen)) return false;
    return true;
}

// PNJ en route vers le héros (`arrival`) : cachés tant que la vue n'a pas lancé leur arrivée (état volatil, jamais sauvegardé).
export const beginNpcArrival = (session, npcId) => session.rt.pendingArrivals?.delete(npcId);
export const visibleNpcs = session => session.rt.changeMode ? [...session.rt.changeMode.npcs, ...session.rt.changeMode.ambient] : currentScreen(session).npcs.filter(n => isEntityVisible(session, n) && !session.rt.pendingArrivals?.has(n.id));
export const visibleChests = session => session.rt.changeMode ? [] : currentScreen(session).chests.filter(c => isEntityVisible(session, c));

export function aliveEnemies(session) {
    if (session.rt.changeMode) return [];   // mode Chang'e : aucun ennemi
    const screen = currentScreen(session);
    return screen.enemies
        .filter(def => isEnemyAlive(session, def.id) && isEntityVisible(session, def))
        .map(def => ({ def, ...session.rt.enemies[def.id] }));
}

// Boss protégé (`shieldedBy: groupe`) : tant que tous les membres du groupe ne sont pas vaincus, aucun combat.
export function isShielded(session, def) {
    if (!def.shieldedBy) return false;
    if (Array.isArray(def.unsealedBy) && def.unsealedBy.some(c => progressReached(session, c))) return false;
    const members = Object.values(session.rt.enemyIndex).filter(e => e.def.group === def.shieldedBy);
    return members.length > 0 && !members.every(e => session.data.defeated.includes(e.def.id));
}

// Murs d'un boss (`seal: 'x' | 'y'` dans sa définition) : tant qu'il est en jeu, toute la colonne (`'x'`) ou la rangée (`'y'`) qui passe par lui
// est fermée par des piliers (hors terrain déjà infranchissable, sorties et entités) : on ne peut pas l'esquiver par un détour (roseaux
// franchissables compris), il faut le battre. Les piliers disparaissent avec lui. Calcul mis en cache par définition de boss.
const sealCache = new WeakMap();
export function sealCellsOf(screen, def) {
    if (Array.isArray(def?.wall)) return def.wall;   // piliers d'un boss de porte (world/junctions.js `wallGuard`)
    if (!def?.seal) return [];
    let cells = sealCache.get(def);
    if (!cells) {
        const taken = new Set([...screen.npcs, ...screen.chests, ...screen.enemies, ...screen.exits, screen.spawn, screen.waypoint].filter(Boolean).map(e => `${e.x},${e.y}`));
        cells = [];
        const along = def.seal === 'y' ? screen.w : screen.h;
        for (let t = 0; t < along; t++) {
            const x = def.seal === 'y' ? t : def.x, y = def.seal === 'y' ? def.y : t;
            if (isTerrainBlocked(screen, x, y) || taken.has(`${x},${y}`)) continue;
            cells.push([x, y]);
        }
        sealCache.set(def, cells);
    }
    return cells;
}

// Murs des boss encore en jeu sur l'écran courant : { x, y, def } par case. Les murs d'un Soleil (`sun_N`) sont des flammes (`fire`), les autres des piliers.
export function bossWallsOf(session) {
    const screen = currentScreen(session);
    return screen.enemies
        .filter(def => (def.seal || def.wall) && isEnemyAlive(session, def.id) && isEntityVisible(session, def))
        .flatMap(def => sealCellsOf(screen, def).map(([x, y]) => ({ x, y, def, fire: /^sun_\d+$/.test(def.id) })));
}

// Cases des murs des boss encore en jeu sur l'écran courant.
export const bossWallCells = session => bossWallsOf(session).map(w => [w.x, w.y]);

export function entityAt(session, x, y) {
    if (bossWallCells(session).some(([wx, wy]) => wx === x && wy === y)) return { type: 'wall' };
    const npc = visibleNpcs(session).find(n => n.x === x && n.y === y);
    if (npc) return { type: 'npc', npc };
    const chest = visibleChests(session).find(c => c.x === x && c.y === y);
    if (chest) return { type: 'chest', chest, opened: session.data.openedChests.includes(chest.id) };
    const wp = session.rt.changeMode ? null : currentScreen(session).waypoint;
    if (wp && wp.x === x && wp.y === y) return { type: 'waypoint', screenId: session.data.screenId };
    const enemy = aliveEnemies(session).find(e => e.x === x && e.y === y);
    if (enemy) return { type: 'enemy', enemy };
    return null;
}

// Cases de la zone de vigilance d'un ennemi (devant lui), sa propre case comprise.
export function auraCellsOf(session, e) {
    const screen = currentScreen(session);
    const r = aggroOf(e.def);
    const cells = [];
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const x = e.x + dx;
            const y = e.y + dy;
            if (x >= 0 && y >= 0 && x < screen.w && y < screen.h && inFront(e, r, x, y)) cells.push({ x, y });
        }
    }
    return cells;
}

export function getAuraTiles(session) {
    const tiles = new Set();
    aliveEnemies(session).filter(e => !isShielded(session, e.def))
        .forEach(e => auraCellsOf(session, e).forEach(c => tiles.add(`${c.x},${c.y}`)));
    return tiles;
}

const DEFAULT_ILLUSION_LINES = [
    "Votre main traverse le soleil comme une fumée : ce n'était qu'un mirage, qui se dissipe en poussière de lumière."
];
const DEFAULT_SHIELD_LINES = [
    "Un bouclier de flammes protège le soleil : il faut d'abord venir à bout de ses gardiens."
];

// Un mirage se dissipe (court dialogue du Narrateur) et un autre se forme ailleurs : le mirage est déplacé sur une case libre,
// loin du héros, au lieu d'être marqué vaincu. Le vrai soleil, lui, ne bouge jamais.
const MIRAGE_MIN_DIST = 6;

function relocateMirage(session, def) {
    const screen = currentScreen(session);
    const st = session.rt.enemies[def.id];
    if (!st) return;
    const { x: px, y: py } = session.data;
    const cells = [];
    for (let y = 0; y < screen.h; y++) for (let x = 0; x < screen.w; x++) {
        if (Math.max(Math.abs(x - px), Math.abs(y - py)) < MIRAGE_MIN_DIST) continue;
        if (isTerrainBlocked(screen, x, y) || entityAt(session, x, y)) continue;
        if ((screen.exits || []).some(e => e.x === x && e.y === y)) continue;
        cells.push({ x, y });
    }
    if (!cells.length) return;
    const pos = cells[Math.floor(Math.random() * cells.length)];
    st.x = pos.x;
    st.y = pos.y;
}

function dissipate(session, def) {
    relocateMirage(session, def);
    return { type: 'illusion', enemyId: def.id, lines: def.illusionLines?.length ? def.illusionLines : DEFAULT_ILLUSION_LINES };
}

// Résultat d'un contact direct (marcher dans l'ennemi) : mirage, bouclier ou combat.
function contactEvent(session, def) {
    if (def.illusion) return dissipate(session, def);
    if (isShielded(session, def)) {
        return { type: 'shielded', enemyId: def.id, lines: def.shieldLines?.length ? def.shieldLines : DEFAULT_SHIELD_LINES };
    }
    return { type: 'combat', enemyId: def.id };
}

// Zone de vigilance : un boss protégé n'en a pas ; un vrai combat l'emporte sur un mirage.
// Collier d'ombre (stuff.js : hasStealth), posé par la vue avant chaque pas : aucun ennemi ne détecte le héros (sauf dans l'arène).
export function setStealth(session, on) { session.rt.stealth = Boolean(on); }
const isStealthy = session => Boolean(session.rt.stealth) && !inArena(session);

function checkAura(session) {
    if (session.rt.grace > 0 || isStealthy(session)) return null;
    const { x, y } = session.data;
    const hits = aliveEnemies(session)
        .filter(e => inFront(e, aggroOf(e.def), x, y) && !isShielded(session, e.def));
    const hit = hits.find(e => !e.def.illusion) || hits[0];
    return hit ? contactEvent(session, hit.def) : null;
}

// Une sortie est verrouillée tant que sa condition `requires` n'est pas remplie.
// Une quête `unlockOnReady` ouvre sa porte dès que tous ses objectifs sont remplis, sans devoir retourner voir le PNJ (ex. sceau du Fusang).
const readyUnlocks = (session, id) => {
    const quest = typeof id === 'string' ? questById(session, id) : null;
    if (!quest?.unlockOnReady) return false;
    // Prête, ou jamais acceptée mais déjà accomplie (anciennes parties : éclats trouvés avant de parler au PNJ) : la porte s'ouvre.
    const status = questStatus(session, quest);
    return status === 'ready' || (status === 'available' && quest.objectives.every(o => objectiveDone(session, o)));
};
const isExitClosed = (session, exit) => Boolean(exit.closedWhen) && progressReached(session, exit.closedWhen);
export const isExitLocked = (session, exit) => isExitClosed(session, exit) || (Boolean(exit.requires) && !progressReached(session, exit.requires) && !readyUnlocks(session, exit.requires));

// Transition vers une autre carte (sortie explicite ou connexion de bordure) : alerte de niveau, texte d'arrivée, quêtes.
function transitionTo(session, screen, toId, pos, playerLevel, extra = {}) {
    const target = session.screens[toId];
    const minLevel = REGION_UNLOCK_LEVEL[target.region] || 1;
    // Le niveau recommandé ne bloque jamais : le joueur est seulement prévenu (`warning`).
    const warning = playerLevel < minLevel && target.region !== screen.region
        ? { minLevel, regionName: target.name } : null;
    const from = screen.id;
    const firstVisit = !session.data.visitedScreens.includes(toId);
    enterScreen(session, toId, pos);
    const res = { type: 'transition', from, to: toId, firstVisit, door: false, events: checkAutoQuests(session), ...extra };
    // Texte du Narrateur affiché seulement à la toute première visite de l'écran.
    if (firstVisit && !target.interior && target.arrival?.length) res.arrival = target.arrival;
    if (warning) res.warning = warning;
    // Annonce d'événement : une seule fois par partie (data.eventNotices), à la première arrivée dans l'écran qui la porte.
    const notice = target.eventNotice;
    if (notice && !session.data.eventNotices.includes(notice.id)) {
        session.data.eventNotices.push(notice.id);
        res.notice = notice;
    }
    return res;
}

// Sortie de carte par la bordure : connexion (world/connections.js) ou mur. La direction du regard est conservée
// (`rt.facing`) et la case d'arrivée est toujours libre et dans la carte : aucune boucle de transition possible.
function crossMapBorder(session, screen, dx, dy, playerLevel, from = session.data) {
    const hit = crossBorder(session.screens, screen, from.x, from.y, dx, dy,
        (s, x, y) => isTerrainBlocked(s, x, y, canWalkOnWater(session)));
    if (!hit || hit.x === null) return { type: 'blocked' };
    const target = session.screens[hit.to];
    if (isExitLocked(session, hit.conn)) {
        return {
            type: 'exitBlocked', reason: 'quest', label: hit.conn.label, regionName: target.name,
            message: hit.conn.lockedMessage || `Le chemin vers ${target.name} est fermé pour le moment.`
        };
    }
    return transitionTo(session, screen, hit.to, { x: hit.x, y: hit.y }, playerLevel, { border: true, dir: hit.dir });
}

export function tryMove(session, dx, dy, ctx = {}) {
    const playerLevel = Math.max(1, Math.floor(ctx.playerLevel || 1));
    const screen = currentScreen(session);
    session.rt.facing = { dx, dy };
    let nx = session.data.x + dx;
    let ny = session.data.y + dy;
    const cm = session.rt.changeMode;   // mode Chang'e : on ne quitte pas le village (la vue fait dire au narrateur qu'il reste du monde)
    if (nx < 0 || ny < 0 || nx >= screen.w || ny >= screen.h) return cm ? { type: 'changeStay' } : crossMapBorder(session, screen, dx, dy, playerLevel);

    // Corniche : franchissable d'un saut dans son seul sens, on atterrit sur la case d'après (libre) ; de tout autre côté, c'est un mur.
    let jumped = false;
    const ledge = ledgeAt(screen, nx, ny);
    if (ledge) {
        const lx = nx + dx, ly = ny + dy;
        if (ledge[0] !== dx || ledge[1] !== dy || isTerrainBlocked(screen, lx, ly, canWalkOnWater(session)) || entityAt(session, lx, ly)) {
            return { type: 'blocked', ledge: true };
        }
        nx = lx; ny = ly; jumped = true;
    }

    const ent = entityAt(session, nx, ny);
    if (ent) {
        if (ent.type === 'wall') return { type: 'blocked' };
        if (ent.type === 'npc') return { type: 'talk', npcId: ent.npc.id };
        if (ent.type === 'chest') return ent.opened ? { type: 'blocked' } : { type: 'chest', chestId: ent.chest.id };
        if (ent.type === 'waypoint') return activateWaypoint(session, ent.screenId);
        return contactEvent(session, ent.enemy.def);
    }
    if (isTerrainBlocked(screen, nx, ny, canWalkOnWater(session))) return { type: 'blocked' };

    const exit = screen.exits.find(e => e.x === nx && e.y === ny);
    if (exit && cm) return { type: 'changeStay' };
    if (exit?.leaveArena) {
        if (isExitLocked(session, exit)) return { type: 'exitBlocked', reason: 'quest', label: exit.label, message: exit.lockedMessage };
        const from = screen.id;
        leaveArena(session);
        return { type: 'transition', from, to: session.data.screenId, firstVisit: false, door: false, events: [] };
    }
    if (exit) {
        const target = session.screens[exit.to];
        if (isExitLocked(session, exit)) {
            return {
                type: 'exitBlocked', reason: 'quest', label: exit.label, regionName: target.name,
                message: (isExitClosed(session, exit) ? exit.closedMessage : null) || exit.lockedMessage || `Le chemin vers ${target.name} est fermé pour le moment.`
            };
        }
        // Écran d'événement accessible de partout : on retient d'où l'on vient, et la sortie y ramène (sinon case d'arrivée par défaut).
        if (exit.rememberReturn) session.data.eventReturn = { screenId: screen.id, x: exit.rememberReturn.x, y: exit.rememberReturn.y };
        let arrive = exit.arrive;
        if (exit.returnToSaved) {
            const saved = session.data.eventReturn, back = saved && session.screens[saved.screenId];
            if (back && !back.arena && !isTerrainBlocked(back, saved.x, saved.y)) { arrive = { x: saved.x, y: saved.y }; return transitionTo(session, screen, saved.screenId, arrive, playerLevel, { door: Boolean(exit.door), portal: 'out' }); }
        }
        // `portal` : changement de biome par une porte d'événement, l'écran joue l'animation de passage (cinematics.js playPortalTransition).
        return transitionTo(session, screen, exit.to, arrive, playerLevel, { door: Boolean(exit.door), ...(exit.rememberReturn ? { portal: 'in' } : exit.returnToSaved ? { portal: 'out' } : {}) });
    }

    // Dernière case d'un passage de bord : poser le pied dessus déclenche la transition (pas besoin de sortir de la carte).
    const dir = screen.connections && dirOfStep(dx, dy);
    if (dir && screen.connections[dir] && onSide(screen, dir, nx, ny)) {
        if (cm) return { type: 'changeStay' };
        const res = crossMapBorder(session, screen, dx, dy, playerLevel, { x: nx, y: ny });
        if (res.type !== 'blocked') return res;   // sans case d'arrivée possible, la bordure reste une case ordinaire
    }

    session.data.x = nx;
    session.data.y = ny;
    session.rt.stillMs = 0;
    revealFog(session);
    const mk = markerOf(session);
    const markerReached = Boolean(mk && mk.x === nx && mk.y === ny);
    if (markerReached) clearMarker(session);   // arrivé sur le repère : il disparaît
    if (session.rt.grace > 0) session.rt.grace--;
    // Hautes herbes : le pas compte même si une aura prend le dessus (l'aura d'un ennemi reste prioritaire).
    const onGrass = isEncounterCell(screen, nx, ny);
    if (onGrass) session.rt.grassSteps = (session.rt.grassSteps || 0) + 1;
    const out = cm ? { type: 'moved' } : checkAura(session) || (onGrass && rollWildEncounter(session, ctx)) || { type: 'moved', ...(jumped ? { jumped: true } : {}) };
    if (markerReached) out.markerReached = true;
    return out;
}

// Tirage de rencontre après un pas sur l'herbe : null (rien) ou { type: 'combat', enemyId: 'wild:<écran>:<n>', wild: true }.
// Pas de rencontre pendant la grâce ni dans les `safeSteps` premiers pas ; ensuite probabilité `rate` par pas. Tirage pondéré
// dans la table. Deux appels à `ctx.random` (RNG injectable, défaut Math.random) : succès du pas, puis choix dans la table.
function rollWildEncounter(session, ctx = {}) {
    const screen = currentScreen(session);
    const g = encounterOf(screen);
    if (!g || g.table.length === 0) return null;
    if (session.rt.grace > 0 || isStealthy(session) || session.rt.grassSteps <= g.safeSteps) return null;
    const random = typeof ctx.random === 'function' ? ctx.random : Math.random;
    const rate = ctx.riding ? g.rate * MOUNTED_GRASS_FACTOR : g.rate;   // à cheval : rencontres plus rares
    if (random() >= rate) return null;
    const total = g.table.reduce((sum, t) => sum + t.weight, 0);
    let pick = random() * total;
    const entry = g.table.find(t => (pick -= t.weight) < 0) || g.table[g.table.length - 1];

    const rt = session.rt;
    const id = `${WILD_PREFIX}${screen.id}:${++rt.wildSeq}`;
    // Définition d'ennemi construite à la volée (même forme qu'un ennemi de carte, sans position) : mémorisée dans la session
    // uniquement, jamais dans la sauvegarde ni dans l'index des ennemis de carte.
    rt.wildDefs[id] = {
        screenId: screen.id,
        def: { id, templateId: entry.templateId, name: entry.name, kind: 'wild', offset: entry.offset, wild: true }
    };
    Object.keys(rt.wildDefs).slice(0, -WILD_KEEP).forEach(k => { delete rt.wildDefs[k]; });
    resetGrassSteps(session);
    if (!rt.wildIntroDone) { rt.wildIntroDone = true; rt.wildIntroPending = true; }
    return { type: 'combat', enemyId: id, wild: true };
}

// Avance les patrouilleurs. Retourne la liste des événements (au plus un combat).
export function tick(session, dtMs) {
    const rt = session.rt;
    rt.patrolTimer += dtMs;
    const events = [];
    const seen = observeStep(session, dtMs);
    if (seen) events.push(seen);
    let stepped = false;
    while (rt.patrolTimer >= PATROL_STEP_MS) {
        rt.patrolTimer -= PATROL_STEP_MS;
        stepPatrols(session);
        stepped = true;
    }
    if (stepped) {
        const hit = checkAura(session);
        if (hit) events.push(hit);
    }
    return events;
}

// Observation : immobile quelques secondes à portée d'un ennemi, on perce sa faiblesse (mémorisée dans la sauvegarde).
function observeStep(session, dtMs) {
    session.rt.stillMs = (session.rt.stillMs || 0) + dtMs;
    const list = aliveEnemies(session).map(e => ({
        id: e.def.id, x: e.x, y: e.y, aggro: aggroOf(e.def), shielded: isShielded(session, e.def), illusion: Boolean(e.def.illusion)
    }));
    const id = observationTarget(session.rt.stillMs, { x: session.data.x, y: session.data.y }, list, session.data.observed);
    if (!id) return null;
    session.data.observed[id] = true;
    const def = session.rt.enemyIndex[id].def;
    recordBestiary(session, def.templateId);
    return { type: 'observed', enemyId: id, name: def.name, templateId: def.templateId };
}

function stepPatrols(session) {
    const { x: px, y: py } = session.data;
    aliveEnemies(session).forEach(e => {
        const st = session.rt.enemies[e.def.id];
        if (!st.route || st.route.length < 2) return;
        if (st.idx + st.dir < 0 || st.idx + st.dir >= st.route.length) st.dir = -st.dir;
        const next = st.route[st.idx + st.dir];
        if (next.x === px && next.y === py) return;
        const occupied = entityAt(session, next.x, next.y);
        if (occupied) return;
        st.idx += st.dir;
        st.face = faceFromStep(st, next);
        st.x = next.x;
        st.y = next.y;
    });
}

// ── Déplacement au clic : recherche de chemin ───────────────────────────────

// Plus court chemin (Dijkstra, déplacements en croix) de la position du héros jusqu'à
// (tx, ty). Retourne la liste des tuiles à parcourir (première étape → destination), [] si on y est
// déjà, ou null si la destination est inaccessible.
//  - obstacles, liquides, PNJ, coffres et ennemis vivants bloquent le passage ;
//  - une destination occupée (PNJ, coffre, ennemi) reste valide : la dernière étape déclenche
//    l'interaction (dialogue, ouverture, combat) ;
//  - les sorties ne se traversent pas en route : elles ne sont franchies que si elles sont la destination.
// Le trajet évite les zones de vigilance des ennemis (coût élevé par case) sauf celles qui contiennent la destination :
// on n'entre dans une zone de combat que si on la vise explicitement (ou s'il n'existe aucun autre chemin).
export function findPath(session, tx, ty) {
    const screen = currentScreen(session);
    const start = { x: session.data.x, y: session.data.y };
    if (!Number.isInteger(tx) || !Number.isInteger(ty)) return null;
    if (tx < 0 || ty < 0 || tx >= screen.w || ty >= screen.h) return null;
    const onWater = canWalkOnWater(session);
    if (isTerrainBlocked(screen, tx, ty, onWater)) return null;
    if (tx === start.x && ty === start.y) return [];

    const key = (x, y) => y * screen.w + x;
    const occupied = new Set();
    visibleNpcs(session).forEach(n => occupied.add(key(n.x, n.y)));
    visibleChests(session).forEach(c => occupied.add(key(c.x, c.y)));
    aliveEnemies(session).forEach(e => occupied.add(key(e.x, e.y)));
    bossWallCells(session).forEach(([wx, wy]) => occupied.add(key(wx, wy)));
    if (screen.waypoint) occupied.add(key(screen.waypoint.x, screen.waypoint.y));
    const exits = new Set(screen.exits.map(e => key(e.x, e.y)));
    // Passages de bord (connexions) : y poser le pied dans le sens de sortie déclenche la transition, donc jamais un point de passage
    // (sinon, sur l'eau, le plus court chemin longerait la couronne par une case de passage et changerait de carte en route).
    Object.entries(screen.connections || {}).forEach(([dir, c]) => {
        const to = session.screens[c.to];
        const range = to && overlapOf(c, screen, to);
        if (!range) return;
        for (let a = range[0]; a <= range[1]; a++) {
            const x = dir === 'west' ? 0 : dir === 'east' ? screen.w - 1 : a;
            const y = dir === 'north' ? 0 : dir === 'south' ? screen.h - 1 : a;
            exits.add(key(x, y));
        }
    });
    const startKey = key(start.x, start.y);
    const target = key(tx, ty);

    // Zones de vigilance à éviter : celles des ennemis (non protégés) dont l'aura ne contient pas la destination.
    const avoid = new Set();
    aliveEnemies(session).filter(e => !isShielded(session, e.def) && !isStealthy(session)).forEach(e => {
        const r = aggroOf(e.def);
        if (inFront(e, r, tx, ty)) return;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const x = e.x + dx, y = e.y + dy;
                if (x >= 0 && y >= 0 && x < screen.w && y < screen.h && inFront(e, r, x, y)) avoid.add(key(x, y));
            }
        }
    });
    const AVOID_COST = 1000;

    // Dijkstra sur une petite grille : file triée par coût (les écrans font au plus ~20×13 cases).
    const prev = new Map([[startKey, null]]);
    const dist = new Map([[startKey, 0]]);
    const done = new Set();
    const queue = [{ x: start.x, y: start.y, d: 0 }];
    while (queue.length) {
        queue.sort((a, b) => a.d - b.d);
        const cur = queue.shift();
        const cKey = key(cur.x, cur.y);
        if (done.has(cKey)) continue;
        done.add(cKey);
        if (cKey === target) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cur.x + dx, ny = cur.y + dy;
            if (nx < 0 || ny < 0 || nx >= screen.w || ny >= screen.h || isTerrainBlocked(screen, nx, ny, onWater)) continue;
            const nKey = key(nx, ny);
            if (done.has(nKey)) continue;
            // une case occupée ou une sortie n'est jamais un point de passage (seulement une destination)
            if (nKey !== target && (occupied.has(nKey) || exits.has(nKey))) continue;
            const nd = cur.d + 1 + (avoid.has(nKey) ? AVOID_COST : 0);
            if (nd < (dist.get(nKey) ?? Infinity)) {
                dist.set(nKey, nd);
                prev.set(nKey, cKey);
                queue.push({ x: nx, y: ny, d: nd });
            }
        }
    }
    if (!prev.has(target)) return null;
    const path = [];
    for (let k = target; k !== startKey; k = prev.get(k)) {
        path.push({ x: k % screen.w, y: Math.floor(k / screen.w) });
    }
    return path.reverse();
}

// Niveau d'un ennemi : FIXE, il ne dépend jamais du niveau du héros. Boss : `boss.level` ; ennemi normal :
// niveau de sa région (`regionLevel`, REGION_LEVEL) + `offset`. Nouvelle Partie + : +3 niveaux pour les
// soleils et les boss, +1 pour les ennemis normaux, par cycle.
export function enemyLevel(def, regionLevel = 1, ngPlus = 0) {
    const plus = Math.max(0, Math.floor(ngPlus || 0));
    if (def.boss) return Math.max(1, Math.floor(def.boss.level || 1) + 3 * plus);
    return Math.max(1, Math.floor(regionLevel || 1) + (def.offset || 0)) + plus;
}

// Affaiblissement d'un boss (`weakenedBy: [conditions]`) : chaque condition d'avancement remplie (quête annexe terminée,
// ennemi nommé vaincu, coffre ouvert…) retire 1 niveau au boss, au plus BOSS_EASE_MAX : l'exploration a un effet visible.
export const BOSS_EASE_MAX = 2;
export function bossEase(session, def) {
    if (!def?.boss || !Array.isArray(def.weakenedBy)) return 0;
    return Math.min(BOSS_EASE_MAX, def.weakenedBy.filter(c => progressReached(session, c)).length);
}

// Niveau effectif d'un ennemi de la carte : niveau fixe moins l'affaiblissement du boss (jamais sous 1).
export function levelFor(session, def) {
    const level = enemyLevel(def, enemyRegionLevel(session, def.id), session.data.ngPlus);
    return Math.max(1, level - bossEase(session, def));
}

// Niveau de région de l'écran qui porte l'ennemi `enemyId`.
export function enemyRegionLevel(session, enemyId) {
    const screenId = session.rt.enemyIndex[enemyId]?.screenId ?? session.rt.wildDefs?.[enemyId]?.screenId;
    const screen = session.screens[screenId];
    return screen?.levelBase || REGION_LEVEL[screen?.region] || 1;   // `levelBase` : écran d'événement qui garde son propre niveau (events/winterLanternFestival)
}

// Préparation du terrain : approche, observation, pièges et herbes, belvédère (voir terrain.js).
export function prepFor(session, def) {
    const st = session.rt.enemies[def.id];
    const screen = currentScreen(session);
    if (!st || def.boss || def.duel || def.arena) return buildPrep();
    const { x, y } = session.data;
    return buildPrep({
        approach: approachOf(st.face, st, { x, y }),
        observed: Boolean(session.data.observed?.[def.id]),
        weakColor: weakColorOfTemplate(def.templateId) || undefined,
        enemyOnTrap: Boolean(spotAt(screen.spots, st.x, st.y, 'trap')),
        enemyOnGrass: Boolean(spotAt(screen.spots, st.x, st.y, 'tallGrass')),
        onOutlook: Boolean(spotAt(screen.spots, x, y, 'outlook'))
    });
}

// Rencontre d'herbe : mêmes champs qu'un ennemi normal. Niveau = niveau de la région de la carte + décalage de la table
// (plancher 1) + Nouvelle Partie + (comme enemyLevel) ; jamais de boss ni de duel ; préparation du terrain neutre.
// Le dessin est celui du gabarit (spriteKey = templateId, résolu dans sprites/ comme pour tout ennemi de carte).
function wildEncounter(session, { def, screenId }) {
    const screen = session.screens[screenId];
    const level = levelFor(session, def);
    return {
        prep: buildPrep({ mimic: Boolean(def.mimic), grassAmbush: !def.mimic }),   // mimique démasquée ou créature des hautes herbes : attaque par surprise (terrain.js)
        biome: screen?.biome || null,
        enemyId: def.id,
        spriteKey: def.spriteKey || def.templateId,
        templateId: def.templateId,
        name: def.name,
        level,
        boss: null,
        duel: null,
        carryHp: false,
        wild: true
    };
}

export function encounterFor(session, enemyId, playerLevel) {
    if (isWildId(enemyId)) {
        const wild = session.rt.wildDefs?.[enemyId];
        return wild ? wildEncounter(session, wild) : null;
    }
    const entry = session.rt.enemyIndex[enemyId];
    if (!entry) return null;
    const { def } = entry;
    if (def.arena) {
        const info = arenaEncounterInfo(def, playerLevel, session.data.arena.cleared);
        return {
            enemyId: def.id, spriteKey: def.spriteKey || def.id, templateId: def.templateId, name: def.name,
            level: info.level, boss: def.boss ? { ...def.boss, level: info.level } : null, duel: info.duel, arena: info.arena,
            introLines: def.introLines ? [...def.introLines] : null
        };
    }
    const level = levelFor(session, def);
    const prep = prepFor(session, def);
    return {
        prep,
        biome: currentScreen(session).biome || null,
        enemyId: def.id,
        spriteKey: def.spriteKey || def.id,
        templateId: def.templateId,
        name: def.name,
        level,
        boss: def.boss ? { ...def.boss, level } : null,
        duel: def.duel ? { ...def.duel } : null,
        carryHp: Boolean(def.carryHp)
    };
}

// Objets spéciaux (quêtes à objet) : rangés dans `data.questItems`, jamais dans le sac, donc invendables.
export const questItemsOf = session => session.data.questItems.map(i => ({ ...i }));

// La mimique se démasque : combat d'herbe contre une créature de la carte (un cran plus forte), butin maigre à la victoire.
function unmask(session, chest) {
    const screen = currentScreen(session);
    const rt = session.rt;
    const table = grassOf(screen)?.table || grassOf(session.screens[`${screen.region}_wild`])?.table || [];
    const entry = [...table].sort((a, b) => b.weight - a.weight)[0] || { templateId: 'shu_jing', offset: 0 };
    const id = `${WILD_PREFIX}${screen.id}:${++rt.wildSeq}`;
    rt.wildDefs[id] = {
        screenId: screen.id, bonusGold: chest.mimicGold || Math.max(5, Math.round((chest.gold || 0) * 0.15)), bonusLabel: chest.label,
        def: { id, templateId: entry.templateId, spriteKey: MIMIC_SPRITE, name: MIMIC_NAME, kind: 'wild', offset: Math.min(1, (entry.offset || 0) + 1), wild: true, mimic: true }
    };
    return { type: 'mimic', chest, enemyId: id, events: [] };
}

export function openChest(session, chestId) {
    const chest = visibleChests(session).find(c => c.id === chestId);
    if (!chest || session.data.openedChests.includes(chestId)) return null;
    // Coffre verrouillé par une énigme : la vue ouvre l'énigme, puis rappelle openChest une fois `solvePuzzle` appelé.
    if (chest.puzzle && !session.data.solvedPuzzles.includes(chest.puzzle)) return { type: 'puzzle', puzzleId: chest.puzzle, chest, events: [] };
    const qi = chest.questItem;
    // Le coffre d'un objet de quête s'ouvre à tout moment : avant la quête, le texte et la description de l'objet restent évasifs.
    const early = Boolean(qi) && session.data.quests[qi.quest] !== 'active' && session.data.quests[qi.quest] !== 'done';
    session.data.openedChests.push(chestId);
    if (isMimicChest(session, chest)) return unmask(session, chest);
    if (qi) session.data.questItems.push({ id: qi.id, name: qi.name, description: (early ? qi.earlyDescription : qi.description) || qi.description || '', quest: qi.quest });
    const { region, kind } = currentScreen(session);
    const events = [{ type: 'chestOpened', chest, gold: chest.gold || 0, questItem: qi || null, early, screen: { region, kind } }, ...checkAutoQuests(session)];
    return { type: 'chestOpened', chest, gold: chest.gold || 0, events };
}

/**
 * Marque l'énigme résolue. Renvoie, à la première victoire, { set, label, stuff: [id de la pièce d'armure antique de l'énigme], complete } ;
 * `complete` : la quatrième pièce de l'armure vient d'être obtenue. Renvoie null si l'énigme était déjà résolue.
 */
export function solvePuzzle(session, puzzleId) {
    const d = session.data;
    if (d.solvedPuzzles.includes(puzzleId)) return null;
    d.solvedPuzzles.push(puzzleId);
    const set = PUZZLES[puzzleId]?.set;
    if (!set) return null;
    const complete = isSetComplete(set, d.solvedPuzzles) && !d.puzzleSetsDone.includes(set);
    if (complete) d.puzzleSetsDone.push(set);
    return { set, label: PUZZLE_SETS[set].label, stuff: [pieceOfPuzzle(puzzleId)].filter(Boolean), complete };
}

export const puzzleSet = puzzleId => PUZZLES[puzzleId]?.set || null;

/** Avancement d'une famille : { done, total } (pour les messages « énigme 2/3 »). */
export function puzzleSetProgress(session, puzzleId) {
    const ids = puzzlesOfSet(PUZZLES[puzzleId]?.set);
    return { done: ids.filter(id => session.data.solvedPuzzles.includes(id)).length, total: ids.length };
}

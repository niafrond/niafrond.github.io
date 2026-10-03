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
//  - defeatScene : scène jouée au retour sur la carte après la victoire (événement `scene`) ;
//  - exit.requires : sortie fermée tant que la condition n'est pas remplie ;
//  - data.ngPlus : compteur de Nouvelle Partie + (niveaux des ennemis augmentés).

import { SCREENS, QUESTS, REGION_UNLOCK_LEVEL, STORY_INTRO } from './story.js';
import { REGION_ORDER } from './world/index.js';

export const AGGRO_RADIUS = 1;
export const PATROL_STEP_MS = 650;
export const START_SCREEN = SCREENS.rizieres_village ? 'rizieres_village' : 'rizieres';
// Nombre de déplacements pendant lesquels les zones de vigilance sont ignorées après une
// arrivée sur un écran ou un retour de combat (évite de re-combattre immédiatement).
export const GRACE_MOVES = 2;

const inRect = (rects, x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

export function isTerrainBlocked(screen, x, y) {
    if (x < 0 || y < 0 || x >= screen.w || y >= screen.h) return true;
    return inRect(screen.obstacles, x, y) || inRect(screen.liquids || [], x, y);
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

function defaultData() {
    const start = SCREENS[START_SCREEN];
    return {
        screenId: START_SCREEN,
        x: start.spawn.x,
        y: start.spawn.y,
        defeated: [],
        openedChests: [],
        quests: {},
        visitedScreens: [],
        introSeen: false,
        ended: false,
        ngPlus: 0,
        talked: [],
        waypoints: [],
        tracked: null
    };
}

export function createSession(saved, screens = SCREENS, quests = QUESTS) {
    const data = { ...defaultData(), ...(saved && typeof saved === 'object' ? saved : {}) };
    data.defeated = Array.isArray(data.defeated) ? data.defeated : [];
    data.openedChests = Array.isArray(data.openedChests) ? data.openedChests : [];
    data.visitedScreens = Array.isArray(data.visitedScreens) ? data.visitedScreens : [];
    data.quests = data.quests && typeof data.quests === 'object' ? data.quests : {};
    data.ngPlus = Number.isInteger(data.ngPlus) && data.ngPlus > 0 ? data.ngPlus : 0;
    data.talked = Array.isArray(data.talked) ? data.talked : [];
    data.waypoints = Array.isArray(data.waypoints) ? data.waypoints : [];
    data.tracked = typeof data.tracked === 'string' ? data.tracked : null;

    const enemyIndex = {};
    Object.values(screens).forEach(screen => screen.enemies.forEach(def => { enemyIndex[def.id] = { def, screenId: screen.id }; }));

    const session = {
        data,
        screens,
        quests,
        rt: { enemies: {}, patrolTimer: 0, grace: GRACE_MOVES, facing: { dx: 0, dy: 1 }, enemyIndex }
    };

    let screen = screens[data.screenId];
    if (!screen || isTerrainBlocked(screen, data.x, data.y)) {
        data.screenId = START_SCREEN;
        screen = screens[START_SCREEN];
        data.x = screen.spawn.x;
        data.y = screen.spawn.y;
    }
    initScreenRuntime(session);
    if (!data.visitedScreens.includes(data.screenId)) data.visitedScreens.push(data.screenId);
    discoverVillageWaypoint(session);
    return session;
}

export const currentScreen = session => session.screens[session.data.screenId];

function initScreenRuntime(session) {
    const screen = currentScreen(session);
    session.rt.enemies = {};
    session.rt.patrolTimer = 0;
    screen.enemies.forEach(def => {
        const route = def.kind === 'patrol' && def.patrol ? buildRoute(def.patrol) : null;
        session.rt.enemies[def.id] = { x: def.x, y: def.y, route, idx: 0, dir: 1 };
    });
}

// Ennemis d'histoire (permanent) : jamais de retour ; les autres réapparaissent à chaque entrée.
function respawnRegularEnemies(session) {
    const screen = currentScreen(session);
    const regularIds = new Set(screen.enemies.filter(e => !e.permanent).map(e => e.id));
    session.data.defeated = session.data.defeated.filter(id => !regularIds.has(id));
}

export function enterScreen(session, screenId, pos) {
    const screen = session.screens[screenId];
    if (!screen) return false;
    session.data.screenId = screenId;
    session.data.x = pos.x;
    session.data.y = pos.y;
    respawnRegularEnemies(session);
    initScreenRuntime(session);
    session.rt.grace = GRACE_MOVES;
    if (!session.data.visitedScreens.includes(screenId)) session.data.visitedScreens.push(screenId);
    discoverVillageWaypoint(session);
    return true;
}

export function teleportToScreen(session, screenId) {
    const screen = session.screens[screenId];
    if (!screen) return false;
    return enterScreen(session, screenId, screen.spawn);
}

export function isEnemyAlive(session, enemyId) {
    return !session.data.defeated.includes(enemyId);
}

// Une entité (ennemi, PNJ, coffre) n'existe que si sa condition `showWhen` est remplie et que sa
// condition `hideWhen` ne l'est pas (même sémantique que `progressReached`).
export function isEntityVisible(session, def) {
    if (def.showWhen && !progressReached(session, def.showWhen)) return false;
    if (def.hideWhen && progressReached(session, def.hideWhen)) return false;
    return true;
}

export const visibleNpcs = session => currentScreen(session).npcs.filter(n => isEntityVisible(session, n));
export const visibleChests = session => currentScreen(session).chests.filter(c => isEntityVisible(session, c));

export function aliveEnemies(session) {
    const screen = currentScreen(session);
    return screen.enemies
        .filter(def => isEnemyAlive(session, def.id) && isEntityVisible(session, def))
        .map(def => ({ def, ...session.rt.enemies[def.id] }));
}

// Boss protégé (`shieldedBy: groupe`) : tant que tous les membres du groupe ne sont pas vaincus, aucun combat.
export function isShielded(session, def) {
    if (!def.shieldedBy) return false;
    const members = Object.values(session.rt.enemyIndex).filter(e => e.def.group === def.shieldedBy);
    return members.length > 0 && !members.every(e => session.data.defeated.includes(e.def.id));
}

export function entityAt(session, x, y) {
    const npc = visibleNpcs(session).find(n => n.x === x && n.y === y);
    if (npc) return { type: 'npc', npc };
    const chest = visibleChests(session).find(c => c.x === x && c.y === y);
    if (chest) return { type: 'chest', chest, opened: session.data.openedChests.includes(chest.id) };
    const wp = currentScreen(session).waypoint;
    if (wp && wp.x === x && wp.y === y) return { type: 'waypoint', screenId: session.data.screenId };
    const enemy = aliveEnemies(session).find(e => e.x === x && e.y === y);
    if (enemy) return { type: 'enemy', enemy };
    return null;
}

export function getAuraTiles(session) {
    const screen = currentScreen(session);
    const tiles = new Set();
    aliveEnemies(session).filter(e => !isShielded(session, e.def)).forEach(e => {
        for (let dy = -AGGRO_RADIUS; dy <= AGGRO_RADIUS; dy++) {
            for (let dx = -AGGRO_RADIUS; dx <= AGGRO_RADIUS; dx++) {
                const x = e.x + dx;
                const y = e.y + dy;
                if (x >= 0 && y >= 0 && x < screen.w && y < screen.h) tiles.add(`${x},${y}`);
            }
        }
    });
    return tiles;
}

const DEFAULT_ILLUSION_LINES = [
    "Votre main traverse le soleil comme une fumée : ce n'était qu'un mirage, qui se dissipe en poussière de lumière."
];
const DEFAULT_SHIELD_LINES = [
    "Un bouclier de flammes protège le soleil : il faut d'abord venir à bout de ses gardiens."
];

// Un mirage se dissipe : il est marqué vaincu et la vue joue un court dialogue du Narrateur.
function dissipate(session, def) {
    if (!session.data.defeated.includes(def.id)) session.data.defeated.push(def.id);
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
function checkAura(session) {
    if (session.rt.grace > 0) return null;
    const { x, y } = session.data;
    const hits = aliveEnemies(session)
        .filter(e => chebyshev(e.x, e.y, x, y) <= AGGRO_RADIUS && !isShielded(session, e.def));
    const hit = hits.find(e => !e.def.illusion) || hits[0];
    return hit ? contactEvent(session, hit.def) : null;
}

// Une sortie est verrouillée tant que sa condition `requires` n'est pas remplie.
export const isExitLocked = (session, exit) => Boolean(exit.requires) && !progressReached(session, exit.requires);

export function tryMove(session, dx, dy, ctx = {}) {
    const playerLevel = Math.max(1, Math.floor(ctx.playerLevel || 1));
    const screen = currentScreen(session);
    session.rt.facing = { dx, dy };
    const nx = session.data.x + dx;
    const ny = session.data.y + dy;
    if (nx < 0 || ny < 0 || nx >= screen.w || ny >= screen.h) return { type: 'blocked' };

    const ent = entityAt(session, nx, ny);
    if (ent) {
        if (ent.type === 'npc') return { type: 'talk', npcId: ent.npc.id };
        if (ent.type === 'chest') return ent.opened ? { type: 'blocked' } : { type: 'chest', chestId: ent.chest.id };
        if (ent.type === 'waypoint') return activateWaypoint(session, ent.screenId);
        return contactEvent(session, ent.enemy.def);
    }
    if (isTerrainBlocked(screen, nx, ny)) return { type: 'blocked' };

    const exit = screen.exits.find(e => e.x === nx && e.y === ny);
    if (exit) {
        const target = session.screens[exit.to];
        if (isExitLocked(session, exit)) {
            return {
                type: 'exitBlocked', reason: 'quest', label: exit.label, regionName: target.name,
                message: exit.lockedMessage || `Le chemin vers ${target.name} est fermé pour le moment.`
            };
        }
        const minLevel = REGION_UNLOCK_LEVEL[target.region] || 1;
        // Le niveau recommandé ne bloque jamais : le joueur est seulement prévenu (`warning`).
        const warning = playerLevel < minLevel && target.region !== screen.region
            ? { minLevel, regionName: target.name } : null;
        const from = screen.id;
        const firstVisit = !session.data.visitedScreens.includes(exit.to);
        enterScreen(session, exit.to, exit.arrive);
        const res = { type: 'transition', from, to: exit.to, firstVisit, door: Boolean(exit.door), events: checkAutoQuests(session) };
        // Texte du Narrateur affiché seulement à la toute première visite de l'écran.
        if (firstVisit && target.arrival?.length) res.arrival = target.arrival;
        if (warning) res.warning = warning;
        return res;
    }

    session.data.x = nx;
    session.data.y = ny;
    if (session.rt.grace > 0) session.rt.grace--;
    return checkAura(session) || { type: 'moved' };
}

// Avance les patrouilleurs. Retourne la liste des événements (au plus un combat).
export function tick(session, dtMs) {
    const rt = session.rt;
    rt.patrolTimer += dtMs;
    const events = [];
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
        st.x = next.x;
        st.y = next.y;
    });
}

// ── Déplacement au clic : recherche de chemin ───────────────────────────────

// Plus court chemin (parcours en largeur, déplacements en croix) de la position du héros jusqu'à
// (tx, ty). Retourne la liste des tuiles à parcourir (première étape → destination), [] si on y est
// déjà, ou null si la destination est inaccessible.
//  - obstacles, liquides, PNJ, coffres et ennemis vivants bloquent le passage ;
//  - une destination occupée (PNJ, coffre, ennemi) reste valide : la dernière étape déclenche
//    l'interaction (dialogue, ouverture, combat) ;
//  - les sorties ne se traversent pas en route : elles ne sont franchies que si elles sont la destination.
// Le trajet ne cherche PAS à éviter les zones de vigilance : c'est toujours le plus court.
export function findPath(session, tx, ty) {
    const screen = currentScreen(session);
    const start = { x: session.data.x, y: session.data.y };
    if (!Number.isInteger(tx) || !Number.isInteger(ty)) return null;
    if (tx < 0 || ty < 0 || tx >= screen.w || ty >= screen.h) return null;
    if (isTerrainBlocked(screen, tx, ty)) return null;
    if (tx === start.x && ty === start.y) return [];

    const key = (x, y) => y * screen.w + x;
    const occupied = new Set();
    visibleNpcs(session).forEach(n => occupied.add(key(n.x, n.y)));
    visibleChests(session).forEach(c => occupied.add(key(c.x, c.y)));
    aliveEnemies(session).forEach(e => occupied.add(key(e.x, e.y)));
    if (screen.waypoint) occupied.add(key(screen.waypoint.x, screen.waypoint.y));
    const exits = new Set(screen.exits.map(e => key(e.x, e.y)));
    const startKey = key(start.x, start.y);
    const target = key(tx, ty);

    const prev = new Map([[startKey, null]]);
    const queue = [start];
    while (queue.length && !prev.has(target)) {
        const cur = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cur.x + dx, ny = cur.y + dy;
            if (nx < 0 || ny < 0 || nx >= screen.w || ny >= screen.h || isTerrainBlocked(screen, nx, ny)) continue;
            const nKey = key(nx, ny);
            if (prev.has(nKey)) continue;
            prev.set(nKey, key(cur.x, cur.y));
            // une case occupée ou une sortie n'est jamais un point de passage (seulement une destination)
            if (nKey !== target && (occupied.has(nKey) || exits.has(nKey))) continue;
            queue.push({ x: nx, y: ny });
        }
    }
    if (!prev.has(target)) return null;
    const path = [];
    for (let k = target; k !== startKey; k = prev.get(k)) {
        path.push({ x: k % screen.w, y: Math.floor(k / screen.w) });
    }
    return path.reverse();
}

// Nouvelle Partie + : +3 niveaux pour les soleils et les boss, +1 pour les ennemis normaux, par cycle.
export function enemyLevel(def, playerLevel, ngPlus = 0) {
    const lvl = Math.max(1, Math.floor(playerLevel || 1));
    const plus = Math.max(0, Math.floor(ngPlus || 0));
    if (def.boss) return Math.max(def.boss.level + 3 * plus, lvl);
    return Math.min(lvl + 1, Math.max(1, lvl + (def.offset || 0))) + plus;
}

export function encounterFor(session, enemyId, playerLevel) {
    const entry = session.rt.enemyIndex[enemyId];
    if (!entry) return null;
    const { def } = entry;
    const level = enemyLevel(def, playerLevel, session.data.ngPlus);
    return {
        enemyId: def.id,
        spriteKey: def.spriteKey || def.id,
        templateId: def.templateId,
        name: def.name,
        emoji: def.emoji,
        level,
        boss: def.boss ? { ...def.boss, level } : null
    };
}

// ── Quêtes ─────────────────────────────────────────────────────────────────

const questById = (session, id) => session.quests.find(q => q.id === id) || null;

function objectiveDone(session, obj) {
    if (obj.type === 'kill') return session.data.defeated.includes(obj.target);
    if (obj.type === 'chest') return session.data.openedChests.includes(obj.target);
    if (obj.type === 'talk') return session.data.talked.includes(obj.target);
    if (obj.type === 'visit') return session.data.visitedScreens.includes(obj.target);
    if (obj.type === 'killGroup') {
        const members = Object.values(session.rt.enemyIndex).filter(e => e.def.group === obj.target);
        return members.length > 0 && members.every(e => session.data.defeated.includes(e.def.id));
    }
    return false;
}

export function questStatus(session, quest) {
    const stored = session.data.quests[quest.id];
    if (stored === 'done') return 'done';
    if (stored === 'active') return quest.objectives.every(o => objectiveDone(session, o)) ? 'ready' : 'active';
    const unlocked = (quest.requires || []).every(id => session.data.quests[id] === 'done');
    return unlocked ? 'available' : 'locked';
}

function startQuest(session, quest) {
    session.data.quests[quest.id] = 'active';
    return { type: 'questStarted', quest, lines: quest.offer };
}

function completeQuest(session, quest) {
    session.data.quests[quest.id] = 'done';
    if (quest.final) session.data.ended = true;
    return {
        type: 'questCompleted', quest, lines: quest.complete, reward: quest.reward || {}, gold: quest.reward?.gold || 0,
        xp: quest.reward?.xp || 0,
        ended: Boolean(quest.final)
    };
}

// Démarre / valide automatiquement les quêtes sans PNJ, jusqu'à stabilité.
export function checkAutoQuests(session) {
    const events = [];
    let changed = true;
    while (changed) {
        changed = false;
        for (const quest of session.quests) {
            const status = questStatus(session, quest);
            if (quest.autoStart && status === 'available') {
                events.push(startQuest(session, quest));
                changed = true;
            } else if (!quest.turnIn && status === 'ready') {
                events.push(completeQuest(session, quest));
                changed = true;
            }
        }
    }
    return events;
}

// Victoire sur un ennemi : événement `scene` éventuel (`defeatScene` de la définition), puis quêtes automatiques.
export function markEnemyDefeated(session, enemyId) {
    const events = [];
    if (!session.data.defeated.includes(enemyId)) {
        session.data.defeated.push(enemyId);
        const scene = session.rt.enemyIndex[enemyId]?.def.defeatScene;
        if (scene?.lines?.length) events.push({ type: 'scene', speaker: { ...(scene.speaker || {}) }, lines: [...scene.lines] });
    }
    events.push(...checkAutoQuests(session));
    return events;
}

// Nouvelle Partie + : possible une fois l'épilogue joué. Remet l'histoire à zéro (quêtes, ennemis, coffres,
// écrans visités), replace le héros au point de départ, garde `introSeen` ; `ngPlus` augmente la difficulté.
export function startNewGamePlus(session) {
    const data = session.data;
    if (!data.ended) return false;
    data.ngPlus = (data.ngPlus || 0) + 1;
    data.quests = {};
    data.defeated = [];
    data.openedChests = [];
    data.visitedScreens = [];
    data.talked = [];
    data.tracked = null;
    data.ended = false;
    const start = session.screens[START_SCREEN];
    enterScreen(session, START_SCREEN, start.spawn);
    return true;
}

export function resetAfterDefeat(session) {
    const screen = currentScreen(session);
    session.data.x = screen.spawn.x;
    session.data.y = screen.spawn.y;
    session.rt.grace = GRACE_MOVES + 1;
}

// Une condition d'avancement est remplie si l'id désigne une quête terminée, un ennemi
// vaincu ou un coffre ouvert. Un tableau d'ids exige que toutes soient remplies.
export function progressReached(session, cond) {
    if (Array.isArray(cond)) return cond.length > 0 && cond.every(c => progressReached(session, c));
    if (typeof cond !== 'string' || !cond) return false;
    return session.data.quests[cond] === 'done'
        || session.data.defeated.includes(cond)
        || session.data.openedChests.includes(cond)
        || session.data.talked.includes(cond);
}

// Répliques d'ambiance d'un PNJ : la dernière entrée de `talk` dont la condition `whenDone`
// est remplie l'emporte ; sinon `idle`.
export function npcAmbientLines(session, npc) {
    let lines = npc.idle;
    (Array.isArray(npc.talk) ? npc.talk : []).forEach(entry => {
        if (entry?.lines?.length && progressReached(session, entry.whenDone)) lines = entry.lines;
    });
    return lines;
}

// Objectif « parler » en cours qui vise ce PNJ : { quest, objective } ou null.
function activeTalkObjective(session, npcId) {
    for (const quest of session.quests) {
        if (questStatus(session, quest) !== 'active') continue;
        const objective = quest.objectives.find(o => o.type === 'talk' && o.target === npcId && !objectiveDone(session, o));
        if (objective) return { quest, objective };
    }
    return null;
}

export function talkToNpc(session, npcId) {
    const npc = visibleNpcs(session).find(n => n.id === npcId);
    if (!npc) return null;

    const related = session.quests.filter(q => q.giver === npcId || q.turnIn === npcId);
    const withStatus = related.map(quest => ({ quest, status: questStatus(session, quest) }));

    const ready = withStatus.find(q => q.status === 'ready' && q.quest.turnIn === npcId);
    if (ready) {
        const events = [completeQuest(session, ready.quest), ...checkAutoQuests(session)];
        return { type: 'dialog', npc, lines: ready.quest.complete, events };
    }

    // Objectif « parler à » : la réplique de la cible, puis éventuellement l'offre d'une autre quête.
    const talk = activeTalkObjective(session, npcId);
    let lines = [];
    const events = [];
    if (talk) {
        session.data.talked.push(npcId);
        lines = talk.objective.lines?.length ? [...talk.objective.lines] : [`${npc.name} vous écoute, puis hoche la tête.`];
        events.push({ type: 'objective', quest: talk.quest, objective: talk.objective });
    }
    const available = withStatus.find(q => q.status === 'available' && q.quest.giver === npcId && !q.quest.autoStart);
    if (available) {
        events.push(startQuest(session, available.quest));
        lines = [...lines, ...available.quest.offer];
    }
    if (talk || available) {
        events.push(...checkAutoQuests(session));
        return { type: 'dialog', npc, lines, events };
    }
    const active = withStatus.find(q => (q.status === 'active' || q.status === 'ready') && q.quest.hint?.length);
    if (active) return { type: 'dialog', npc, lines: active.quest.hint, events: [] };
    return { type: 'dialog', npc, lines: npcAmbientLines(session, npc), events: [] };
}

export function openChest(session, chestId) {
    const chest = visibleChests(session).find(c => c.id === chestId);
    if (!chest || session.data.openedChests.includes(chestId)) return null;
    session.data.openedChests.push(chestId);
    const events = [{ type: 'chestOpened', chest, gold: chest.gold || 0 }, ...checkAutoQuests(session)];
    return { type: 'chestOpened', chest, gold: chest.gold || 0, events };
}

function findNpcScreen(session, npcId) {
    return Object.values(session.screens).find(s => s.npcs.some(n => n.id === npcId)) || null;
}

const REGION_NUMBER = id => Math.max(0, REGION_ORDER.indexOf(id));

// Région d'une quête : celle de son donneur (ou, à défaut, de sa première cible).
export function questRegion(session, quest) {
    const npcScreen = quest.giver ? findNpcScreen(session, quest.giver) : null;
    if (npcScreen) return npcScreen.region;
    const target = questTargets(session, quest)[0];
    return target ? session.screens[target.screenId]?.region || null : null;
}

// Écran où se trouve l'entité visée par un objectif (null si inconnue).
function objectiveTarget(session, obj) {
    const screens = Object.values(session.screens);
    if (obj.type === 'talk') {
        const scr = findNpcScreen(session, obj.target);
        return scr ? { screenId: scr.id, kind: 'npc', id: obj.target } : null;
    }
    if (obj.type === 'visit') return session.screens[obj.target] ? { screenId: obj.target, kind: 'screen', id: obj.target } : null;
    if (obj.type === 'chest') {
        const scr = screens.find(sc => sc.chests.some(c => c.id === obj.target));
        return scr ? { screenId: scr.id, kind: 'chest', id: obj.target } : null;
    }
    if (obj.type === 'kill') {
        const entry = session.rt.enemyIndex[obj.target];
        return entry ? { screenId: entry.screenId, kind: 'enemy', id: obj.target } : null;
    }
    if (obj.type === 'killGroup') {
        const member = Object.values(session.rt.enemyIndex).find(e => e.def.group === obj.target && !session.data.defeated.includes(e.def.id));
        return member ? { screenId: member.screenId, kind: 'enemy', id: member.def.id } : null;
    }
    return null;
}

// Lieux à rejoindre pour une quête : PNJ à qui la rendre, ou cibles des objectifs restants.
export function questTargets(session, quest) {
    const status = questStatus(session, quest);
    if (status === 'ready' && quest.turnIn) {
        const scr = findNpcScreen(session, quest.turnIn);
        return scr ? [{ screenId: scr.id, kind: 'npc', id: quest.turnIn }] : [];
    }
    if (status === 'available' && quest.giver) {
        const scr = findNpcScreen(session, quest.giver);
        return scr ? [{ screenId: scr.id, kind: 'npc', id: quest.giver }] : [];
    }
    if (status === 'active') {
        const obj = quest.objectives.find(o => !objectiveDone(session, o));
        const t = obj && objectiveTarget(session, obj);
        return t ? [t] : [];
    }
    return [];
}

export function setTrackedQuest(session, questId) {
    session.data.tracked = questId && session.quests.some(q => q.id === questId) ? questId : null;
    return session.data.tracked;
}

// Quête suivie (épinglée par le joueur) tant qu'elle est en cours ou à rendre.
export function trackedQuest(session) {
    const quest = session.data.tracked && questById(session, session.data.tracked);
    if (!quest) return null;
    const status = questStatus(session, quest);
    return status === 'active' || status === 'ready' ? quest : null;
}

// Cibles de la quête suivie qui se trouvent sur l'écran courant (anneaux sur la carte).
export function trackedMarkers(session) {
    const quest = trackedQuest(session);
    if (!quest) return [];
    return questTargets(session, quest).filter(t => t.screenId === session.data.screenId);
}

function locationHint(session, target) {
    if (!target) return '';
    const scr = session.screens[target.screenId];
    if (!scr) return '';
    return target.screenId === session.data.screenId ? ' · ici' : ` · ${scr.name}`;
}

// Objectif affiché en permanence : prochaine étape de la quête suivie, sinon de la première quête en cours.
export function currentObjectiveText(session) {
    const tracked = trackedQuest(session);
    if (tracked) {
        const status = questStatus(session, tracked);
        const target = questTargets(session, tracked)[0];
        if (status === 'ready' && tracked.turnIn) {
            const scr = findNpcScreen(session, tracked.turnIn);
            const npc = scr?.npcs.find(n => n.id === tracked.turnIn);
            return `⭐ ${tracked.title} : retournez voir ${npc?.name || 'le PNJ'} (${scr?.name || '?'})`;
        }
        const obj = tracked.objectives.find(o => !objectiveDone(session, o));
        return `⭐ ${tracked.title} : ${obj ? obj.text : 'objectif accompli'}${target ? '' : ''}`;
    }
    for (const quest of session.quests) {
        const status = questStatus(session, quest);
        if (status === 'ready' && quest.turnIn) {
            const scr = findNpcScreen(session, quest.turnIn);
            const npc = scr?.npcs.find(n => n.id === quest.turnIn);
            return `🎯 ${quest.title} : retournez voir ${npc?.name || 'le PNJ'} (${scr?.name || '?'})`;
        }
        if (status === 'active' && !quest.side) {
            const obj = quest.objectives.find(o => !objectiveDone(session, o));
            return `🎯 ${quest.title} : ${obj ? obj.text : 'objectif accompli'}`;
        }
        if (status === 'available' && quest.giver && !quest.autoStart && !quest.side) {
            const scr = findNpcScreen(session, quest.giver);
            const npc = scr?.npcs.find(n => n.id === quest.giver);
            if (npc && !isEntityVisible(session, npc)) continue;
            return `💬 Nouvelle quête : parlez à ${npc?.name || 'un PNJ'} (${scr?.name || '?'})`;
        }
    }
    return session.data.ended
        ? '🌕 La légende est achevée ! Ouvrez le journal pour une Nouvelle Partie +.'
        : '🧭 Explorez le monde.';
}

export { locationHint as questLocationHint };

export function journalEntries(session) {
    return session.quests
        .map(quest => ({ quest, status: questStatus(session, quest) }))
        // Une quête n'apparaît au journal qu'une fois activée (en parlant à son donneur) : ni « locked » ni « available ».
        .filter(e => e.status === 'active' || e.status === 'ready' || e.status === 'done')
        .map(e => {
            const target = questTargets(session, e.quest)[0] || null;
            const giverScreen = e.quest.giver ? findNpcScreen(session, e.quest.giver) : null;
            const giverNpc = giverScreen?.npcs.find(n => n.id === e.quest.giver);
            return {
                ...e,
                region: questRegion(session, e.quest),
                tracked: session.data.tracked === e.quest.id,
                giverName: giverNpc?.name || '',
                giverPlace: giverScreen?.name || '',
                where: target ? session.screens[target.screenId]?.name || '' : '',
                objectives: e.quest.objectives.map(o => ({ text: o.text, done: objectiveDone(session, o) }))
            };
        });
}

// Indicateur au-dessus d'un PNJ : « ! » quête disponible, « ? » à rendre ou à qui parler, sinon rien.
export function npcMarker(session, npcId) {
    if (activeTalkObjective(session, npcId)) return '❓';
    for (const quest of session.quests) {
        const status = questStatus(session, quest);
        if (status === 'ready' && quest.turnIn === npcId) return '❓';
        if (status === 'available' && quest.giver === npcId && !quest.autoStart) return '❗';
    }
    return '';
}

// Indicateur de quête d'un écran (maison) : « ❓ » si une quête y est à rendre / une cible de la quête suivie s'y trouve,
// « ❗ » si un PNJ y propose une quête, sinon ''.
export function screenQuestMarker(session, screenId) {
    const screen = session.screens[screenId];
    if (!screen) return '';
    let marker = '';
    for (const npc of screen.npcs) {
        if (!isEntityVisible(session, npc)) continue;
        const m = npcMarker(session, npc.id);
        if (m === '❓') return '❓';
        if (m) marker = m;
    }
    const tracked = trackedQuest(session);
    if (tracked && questTargets(session, tracked).some(t => t.screenId === screenId)) return '❓';
    return marker;
}

// Maisons de l'écran courant (sorties « door ») qui abritent une quête : [{ exit, marker }].
export function houseMarkers(session) {
    return currentScreen(session).exits
        .filter(ex => ex.door)
        .map(exit => ({ exit, marker: screenQuestMarker(session, exit.to) }))
        .filter(h => h.marker);
}

// Position (tuile) d'une cible de quête sur l'écran courant.
function targetPosition(session, target) {
    const screen = currentScreen(session);
    const at = list => list.find(e => e.id === target.id);
    if (target.kind === 'npc') return at(screen.npcs);
    if (target.kind === 'chest') return at(screen.chests);
    if (target.kind === 'enemy') return aliveEnemies(session).map(e => ({ id: e.def.id, x: e.x, y: e.y })).find(e => e.id === target.id);
    return null;
}

// Premier écran à rejoindre (sortie à prendre depuis `fromId`) pour atteindre `toId`, en évitant les sorties verrouillées.
function nextExitToward(session, fromId, toId) {
    const attempt = allowLocked => {
        const seen = new Map([[fromId, null]]);
        const queue = [fromId];
        while (queue.length) {
            const id = queue.shift();
            if (id === toId) break;
            for (const ex of session.screens[id].exits) {
                if (seen.has(ex.to) || !session.screens[ex.to]) continue;
                if (!allowLocked && isExitLocked(session, ex)) continue;
                seen.set(ex.to, { from: id, exit: ex });
                queue.push(ex.to);
            }
        }
        if (!seen.has(toId)) return null;
        let step = seen.get(toId);
        while (step && step.from !== fromId) step = seen.get(step.from);
        return step ? step.exit : null;
    };
    return attempt(false) || attempt(true);
}

// Indicateur de direction de la quête suivie : { x, y, label, kind: 'target' | 'exit' } (tuile de l'écran courant), ou null.
// À défaut de quête épinglée, l'indicateur guide vers la quête principale en cours (ou à rendre).
export function questDirection(session) {
    const quest = trackedQuest(session)
        || session.quests.find(q => !q.side && ['active', 'ready'].includes(questStatus(session, q)));
    if (!quest) return null;
    const target = questTargets(session, quest)[0];
    if (!target) return null;
    const here = session.data.screenId;
    if (target.screenId === here) {
        const pos = targetPosition(session, target);
        return pos ? { x: pos.x, y: pos.y, label: quest.title, kind: 'target' } : null;
    }
    const exit = nextExitToward(session, here, target.screenId);
    if (!exit) return null;
    return { x: exit.x, y: exit.y, label: session.screens[exit.to]?.name || exit.label || quest.title, kind: 'exit' };
}

// ── Pierres de voyage (voyage rapide) ─────────────────────────────────────

// Un village est un lieu de repos : sa pierre est découverte dès qu'on y entre.
function discoverVillageWaypoint(session) {
    const screen = currentScreen(session);
    if (screen.waypoint && screen.kind === 'village' && !session.data.waypoints.includes(screen.id)) {
        session.data.waypoints.push(screen.id);
    }
}

export function activateWaypoint(session, screenId) {
    const screen = session.screens[screenId];
    if (!screen?.waypoint) return null;
    const isNew = !session.data.waypoints.includes(screenId);
    if (isNew) session.data.waypoints.push(screenId);
    return { type: 'waypoint', screenId, name: screen.waypoint.name, isNew };
}

// Pierres activées, dans l'ordre du monde (région, puis village → zone sauvage → sanctuaire).
export function waypointList(session) {
    const kindRank = { village: 0, wild: 1 };
    return session.data.waypoints
        .map(id => session.screens[id])
        .filter(screen => screen?.waypoint)
        .map(screen => ({
            screenId: screen.id, region: screen.region, name: screen.waypoint.name, screenName: screen.name,
            kind: screen.kind || 'sanctuary', current: screen.id === session.data.screenId
        }))
        .sort((a, b) => REGION_NUMBER(a.region) - REGION_NUMBER(b.region)
            || (kindRank[a.kind] ?? 2) - (kindRank[b.kind] ?? 2));
}

// Voyage rapide : impossible vers une pierre non activée ; arrivée à côté de la pierre.
export function fastTravel(session, screenId) {
    const screen = session.screens[screenId];
    if (!screen?.waypoint || !session.data.waypoints.includes(screenId)) return false;
    return enterScreen(session, screenId, screen.waypoint.spot || screen.spawn);
}

// Progression par région : coffres, quêtes annexes, pierres.
export function regionProgress(session) {
    return REGION_ORDER.map(region => {
        const zones = Object.values(session.screens).filter(s => s.region === region);
        const chests = zones.flatMap(s => s.chests).filter(c => c.id !== 'moon_altar');
        const side = session.quests.filter(q => q.side && questRegion(session, q) === region);
        const stones = zones.filter(s => s.waypoint);
        return {
            region,
            visited: zones.some(s => session.data.visitedScreens.includes(s.id)),
            chestsOpened: chests.filter(c => session.data.openedChests.includes(c.id)).length,
            chestsTotal: chests.length,
            sideDone: side.filter(q => session.data.quests[q.id] === 'done').length,
            sideTotal: side.length,
            stonesFound: stones.filter(s => session.data.waypoints.includes(s.id)).length,
            stonesTotal: stones.length
        };
    });
}

export function needsIntro(session) {
    return !session.data.introSeen;
}

export function markIntroSeen(session) {
    session.data.introSeen = true;
    return STORY_INTRO;
}

export { questById };

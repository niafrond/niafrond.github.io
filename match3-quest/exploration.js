// Moteur de la phase d'exploration (logique pure, sans DOM).
//
// Le joueur se déplace tuile par tuile sur l'écran courant (SCREENS de story.js).
// Les ennemis sont visibles sur la carte : un combat se déclenche quand on entre dans
// leur zone de vigilance (AGGRO_RADIUS tuile autour d'eux) ou qu'on les percute — on peut
// donc les éviter en faisant le tour. La progression (position, ennemis vaincus, coffres,
// quêtes) est stockée dans `player.exploration` (JSON sérialisable) ; l'état volatil
// (positions des patrouilleurs, période de grâce) vit dans `session.rt`.

import { SCREENS, QUESTS, REGION_UNLOCK_LEVEL, STORY_INTRO } from './story.js';

export const AGGRO_RADIUS = 1;
export const PATROL_STEP_MS = 650;
export const START_SCREEN = 'village';
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
        ended: false
    };
}

export function createSession(saved, screens = SCREENS, quests = QUESTS) {
    const data = { ...defaultData(), ...(saved && typeof saved === 'object' ? saved : {}) };
    data.defeated = Array.isArray(data.defeated) ? data.defeated : [];
    data.openedChests = Array.isArray(data.openedChests) ? data.openedChests : [];
    data.visitedScreens = Array.isArray(data.visitedScreens) ? data.visitedScreens : [];
    data.quests = data.quests && typeof data.quests === 'object' ? data.quests : {};

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

export function aliveEnemies(session) {
    const screen = currentScreen(session);
    return screen.enemies
        .filter(def => isEnemyAlive(session, def.id))
        .map(def => ({ def, ...session.rt.enemies[def.id] }));
}

export function entityAt(session, x, y) {
    const screen = currentScreen(session);
    const npc = screen.npcs.find(n => n.x === x && n.y === y);
    if (npc) return { type: 'npc', npc };
    const chest = screen.chests.find(c => c.x === x && c.y === y);
    if (chest) return { type: 'chest', chest, opened: session.data.openedChests.includes(chest.id) };
    const enemy = aliveEnemies(session).find(e => e.x === x && e.y === y);
    if (enemy) return { type: 'enemy', enemy };
    return null;
}

export function getAuraTiles(session) {
    const screen = currentScreen(session);
    const tiles = new Set();
    aliveEnemies(session).forEach(e => {
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

function checkAura(session) {
    if (session.rt.grace > 0) return null;
    const { x, y } = session.data;
    const hit = aliveEnemies(session).find(e => chebyshev(e.x, e.y, x, y) <= AGGRO_RADIUS);
    return hit ? { type: 'combat', enemyId: hit.def.id } : null;
}

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
        return { type: 'combat', enemyId: ent.enemy.def.id };
    }
    if (isTerrainBlocked(screen, nx, ny)) return { type: 'blocked' };

    const exit = screen.exits.find(e => e.x === nx && e.y === ny);
    if (exit) {
        const target = session.screens[exit.to];
        const minLevel = REGION_UNLOCK_LEVEL[target.region] || 1;
        if (playerLevel < minLevel) {
            return { type: 'exitBlocked', minLevel, label: exit.label, regionName: target.name };
        }
        const from = screen.id;
        const firstVisit = !session.data.visitedScreens.includes(exit.to);
        enterScreen(session, exit.to, exit.arrive);
        const res = { type: 'transition', from, to: exit.to, firstVisit };
        // Texte du Narrateur affiché seulement à la toute première visite de l'écran.
        if (firstVisit && target.arrival?.length) res.arrival = target.arrival;
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

export function enemyLevel(def, playerLevel) {
    const lvl = Math.max(1, Math.floor(playerLevel || 1));
    if (def.boss) return Math.max(def.boss.level, lvl);
    return Math.min(lvl + 1, Math.max(1, lvl + (def.offset || 0)));
}

export function encounterFor(session, enemyId, playerLevel) {
    const entry = session.rt.enemyIndex[enemyId];
    if (!entry) return null;
    const { def } = entry;
    return {
        enemyId: def.id,
        templateId: def.templateId,
        name: def.name,
        emoji: def.emoji,
        level: enemyLevel(def, playerLevel),
        boss: def.boss ? { ...def.boss, level: enemyLevel(def, playerLevel) } : null
    };
}

// ── Quêtes ─────────────────────────────────────────────────────────────────

const questById = (session, id) => session.quests.find(q => q.id === id) || null;

function objectiveDone(session, obj) {
    if (obj.type === 'kill') return session.data.defeated.includes(obj.target);
    if (obj.type === 'chest') return session.data.openedChests.includes(obj.target);
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
    return { type: 'questCompleted', quest, lines: quest.complete, reward: quest.reward || {}, gold: quest.reward?.gold || 0 };
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

export function markEnemyDefeated(session, enemyId) {
    if (!session.data.defeated.includes(enemyId)) session.data.defeated.push(enemyId);
    return checkAutoQuests(session);
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
        || session.data.openedChests.includes(cond);
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

export function talkToNpc(session, npcId) {
    const screen = currentScreen(session);
    const npc = screen.npcs.find(n => n.id === npcId);
    if (!npc) return null;

    const related = session.quests.filter(q => q.giver === npcId || q.turnIn === npcId);
    const withStatus = related.map(quest => ({ quest, status: questStatus(session, quest) }));

    const ready = withStatus.find(q => q.status === 'ready' && q.quest.turnIn === npcId);
    if (ready) {
        const events = [completeQuest(session, ready.quest), ...checkAutoQuests(session)];
        return { type: 'dialog', npc, lines: ready.quest.complete, events };
    }
    const available = withStatus.find(q => q.status === 'available' && q.quest.giver === npcId && !q.quest.autoStart);
    if (available) {
        const events = [startQuest(session, available.quest), ...checkAutoQuests(session)];
        return { type: 'dialog', npc, lines: available.quest.offer, events };
    }
    const active = withStatus.find(q => (q.status === 'active' || q.status === 'ready') && q.quest.hint?.length);
    if (active) return { type: 'dialog', npc, lines: active.quest.hint, events: [] };
    return { type: 'dialog', npc, lines: npcAmbientLines(session, npc), events: [] };
}

export function openChest(session, chestId) {
    const screen = currentScreen(session);
    const chest = screen.chests.find(c => c.id === chestId);
    if (!chest || session.data.openedChests.includes(chestId)) return null;
    session.data.openedChests.push(chestId);
    const events = [{ type: 'chestOpened', chest, gold: chest.gold || 0 }, ...checkAutoQuests(session)];
    return { type: 'chestOpened', chest, gold: chest.gold || 0, events };
}

function findNpcScreen(session, npcId) {
    return Object.values(session.screens).find(s => s.npcs.some(n => n.id === npcId)) || null;
}

// Objectif affiché en permanence : prochaine étape de la quête en cours (ou du prochain PNJ à voir).
export function currentObjectiveText(session) {
    for (const quest of session.quests) {
        const status = questStatus(session, quest);
        if (status === 'ready' && quest.turnIn) {
            const scr = findNpcScreen(session, quest.turnIn);
            const npc = scr?.npcs.find(n => n.id === quest.turnIn);
            return `🎯 ${quest.title} : retournez voir ${npc?.name || 'le PNJ'} (${scr?.name || '?'})`;
        }
        if (status === 'active') {
            const obj = quest.objectives.find(o => !objectiveDone(session, o));
            return `🎯 ${quest.title} : ${obj ? obj.text : 'objectif accompli'}`;
        }
        if (status === 'available' && quest.giver && !quest.autoStart) {
            const scr = findNpcScreen(session, quest.giver);
            const npc = scr?.npcs.find(n => n.id === quest.giver);
            return `💬 Nouvelle quête : parlez à ${npc?.name || 'un PNJ'} (${scr?.name || '?'})`;
        }
    }
    return session.data.ended
        ? '🏆 La Couronne est reconstituée ! Explorez librement.'
        : '🧭 Explorez le monde.';
}

export function journalEntries(session) {
    return session.quests
        .map(quest => ({ quest, status: questStatus(session, quest) }))
        .filter(e => e.status !== 'locked')
        .map(e => ({
            ...e,
            objectives: e.quest.objectives.map(o => ({ text: o.text, done: objectiveDone(session, o) }))
        }));
}

// Indicateur au-dessus d'un PNJ : « ! » quête disponible, « ? » à rendre, sinon rien.
export function npcMarker(session, npcId) {
    for (const quest of session.quests) {
        const status = questStatus(session, quest);
        if (status === 'ready' && quest.turnIn === npcId) return '❓';
        if (status === 'available' && quest.giver === npcId && !quest.autoStart) return '❗';
    }
    return '';
}

export function needsIntro(session) {
    return !session.data.introSeen;
}

export function markIntroSeen(session) {
    session.data.introSeen = true;
    return STORY_INTRO;
}

export { questById };

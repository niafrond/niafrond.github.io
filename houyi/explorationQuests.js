// Quêtes de l'exploration : statut, objectifs, démarrage, achèvement, victoire sur un ennemi, Nouvelle Partie +, défaite.
// Extrait de exploration.js (ré-exporté par celui-ci).
import { isSetComplete, puzzlesOfSet } from './puzzle/levels.js';
import { SUN_EPISODE } from './change/data.js';
import { defaultChangeData } from './change/state.js';
import { arenaTier } from './arena.js';
import { GRACE_MOVES, START_SCREEN, currentScreen, enterScreen, inArena, isWildId, leaveArena, puzzleSet, resetGrassSteps } from './exploration.js';

// ── Quêtes ─────────────────────────────────────────────────────────────────

export const questById = (session, id) => session.quests.find(q => q.id === id) || null;

export function objectiveDone(session, obj) {
    if (obj.type === 'kill') return session.data.defeated.includes(obj.target);
    if (obj.type === 'chest') return session.data.openedChests.includes(obj.target);
    if (obj.type === 'talk') return session.data.talked.includes(obj.target);
    if (obj.type === 'item') return session.data.questItems.some(i => i.id === obj.target);
    if (obj.type === 'visit') return session.data.visitedScreens.includes(obj.target);
    if (obj.type === 'puzzleSet') return isSetComplete(obj.target, session.data.solvedPuzzles);
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
    // `startWhen.puzzleSet` : la quête n'existe qu'une fois une énigme de la famille résolue (première pièce d'armure antique)
    if (quest.startWhen?.puzzleSet && !puzzlesOfSet(quest.startWhen.puzzleSet).some(id => session.data.solvedPuzzles.includes(id))) return 'locked';
    const unlocked = (quest.requires || []).every(id => session.data.quests[id] === 'done');
    return unlocked ? 'available' : 'locked';
}

// Description « complète » d'un objet de quête (celle du coffre qui le contient), gardée telle quelle s'il n'est plus trouvé.
function questItemDescription(session, item) {
    for (const screen of Object.values(session.screens)) {
        const chest = screen.chests.find(c => c.questItem?.id === item.id);
        if (chest) return chest.questItem.description || item.description;
    }
    return item.description;
}

export function startQuest(session, quest) {
    session.data.quests[quest.id] = 'active';
    // Objet trouvé avant la quête : sa description révèle enfin à quoi il sert.
    session.data.questItems.forEach(i => { if (i.quest === quest.id) i.description = questItemDescription(session, i); });
    return { type: 'questStarted', quest, lines: quest.offer };
}

export function completeQuest(session, quest) {
    session.data.quests[quest.id] = 'done';
    // l'objet spécial est remis au PNJ
    session.data.questItems = session.data.questItems.filter(i => i.quest !== quest.id);
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

// Victoire dans l'arène : record du cercle ; un maître vaincu termine le cercle (et ouvre le suivant la 1re fois).
function arenaVictory(session, def) {
    const a = session.data.arena;
    const tierId = def.arena.tier;
    a.wins += 1;
    a.best[tierId] = Math.max(a.best[tierId] || 0, def.arena.wave);
    if (!def.arena.master) return [];
    const firstClear = !a.cleared.includes(tierId);
    if (firstClear) a.cleared = [...a.cleared, tierId].sort((x, y) => x - y);
    return [{ type: 'arenaCleared', tier: tierId, firstClear, next: firstClear ? arenaTier(tierId + 1) : null }];
}

const sceneEvent = scene => ({ type: 'scene', speaker: { ...(scene.speaker || {}) }, lines: [...scene.lines] });

// Victoire sur un ennemi : événement `scene` éventuel (`defeatScene` de la définition), puis quêtes automatiques,
// puis l'interlude `afterScenes` (juste après le dernier texte de victoire, avant le démarrage des quêtes suivantes).
// Nombre d'écrans (hors intérieurs) déjà visités dans une région.
export function regionVisitCount(session, region) {
    return session.data.visitedScreens.filter(id => { const sc = session.screens[id]; return sc && !sc.interior && sc.region === region; }).length;
}

export function markEnemyDefeated(session, enemyId) {
    resetGrassSteps(session);   // après un combat, les pas d'herbe repartent de zéro
    // Créature d'herbe : combat non persistant (rien dans `defeated`, ni scène, ni quête) ; l'or et l'XP viennent du combat.
    if (isWildId(enemyId)) {
        const wild = session.rt.wildDefs?.[enemyId];
        if (!wild?.bonusGold) return [];
        const { region, kind } = currentScreen(session);
        const chest = { id: `${enemyId}_loot`, label: 'Dépouille de la mimique', openText: 'La mimique rend l\'âme en crachant quelques pièces.' };
        return [{ type: 'chestOpened', chest, gold: wild.bonusGold, questItem: null, early: false, screen: { region, kind } }];
    }
    const events = [];
    let after = [];
    let chain = null;
    const wasDefeated = session.data.defeated.includes(enemyId);
    if (!wasDefeated) {
        session.data.defeated.push(enemyId);
        const def = session.rt.enemyIndex[enemyId]?.def;
        if (def?.chain) chain = { type: 'chain', enemyId: def.chain };
        if (def?.defeatScene?.lines?.length) events.push(sceneEvent(def.defeatScene));
        after = (def?.afterScenes || []).filter(sc => sc?.lines?.length).map(sceneEvent);
        if (def?.arena) events.push(...arenaVictory(session, def));
    }
    const quests = checkAutoQuests(session);
    const lastDone = quests.map(ev => ev.type).lastIndexOf('questCompleted');
    quests.splice(lastDone + 1 || quests.length, 0, ...after);
    events.push(...quests);
    // Mode Chang'e : la mort du soleil des régions 3, 6 et 9 ouvre un épisode (conversation par le miroir, puis transition) avant l'arrivée éventuelle d'un PNJ.
    if (!wasDefeated && SUN_EPISODE[enemyId]) events.push({ type: 'changeEpisode', episode: SUN_EPISODE[enemyId] });
    // PNJ qui rejoint le héros en sautillant (`arrival`) : arrive une fois toutes les scènes dites, juste avant sa conversation.
    if (!wasDefeated) currentScreen(session).npcs
        .filter(n => n.arrival && n.showWhen === enemyId)
        .forEach(n => { (session.rt.pendingArrivals ||= new Set()).add(n.id); events.push({ type: 'npcArrival', npcId: n.id }); });
    if (chain) events.push(chain);   // le combat suivant démarre une fois toutes les scènes dites
    return events;
}

// Nouvelle Partie + : possible une fois l'épilogue joué. Remet toute l'histoire à zéro (quêtes, ennemis, coffres,
// écrans visités, pierres de voyage, compagnons, cinématiques vues, prologue) et replace le héros au point de départ ;
// l'arène et le bestiaire observé sont conservés, `ngPlus` augmente la difficulté.
export function startNewGamePlus(session) {
    const data = session.data;
    if (!data.ended) return false;
    data.ngPlus = (data.ngPlus || 0) + 1;
    data.quests = {};
    data.defeated = [];
    data.openedChests = [];
    data.questItems = [];
    data.visitedScreens = [];
    data.fog = {};
    data.mimicked = [];
    data.returns = {};
    data.change = defaultChangeData();   // les trois épisodes de Chang'e se rejouent avec l'histoire
    data.talked = [];
    data.banterSeen = [];
    data.waypoints = [];
    data.activeCompanion = null;
    data.seenCinematics = {};
    data.introSeen = false;
    data.tracked = null;
    data.ended = false;
    const start = session.screens[START_SCREEN];
    enterScreen(session, START_SCREEN, start.spawn);
    return true;
}

export function resetAfterDefeat(session, enemyId = session.rt.pendingEnemyId) {
    resetGrassSteps(session);
    // Duel en plusieurs phases : battu dans la dernière, le héros doit refaire la première (aucun répit entre les phases).
    const from = session.rt.enemyIndex[enemyId]?.def?.chainedFrom;
    if (from) session.data.defeated = session.data.defeated.filter(id => id !== from && id !== enemyId);
    // Défaite dans l'arène : on en est expulsé (retour au point d'entrée).
    if (inArena(session)) {
        leaveArena(session);
        session.rt.grace = GRACE_MOVES + 1;
        return;
    }
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
    if (cond.startsWith('arena_cleared_')) return session.data.arena.cleared.includes(Number(cond.slice(14)));
    return session.data.quests[cond] === 'done'
        || session.data.defeated.includes(cond)
        || session.data.openedChests.includes(cond)
        || session.data.talked.includes(cond);
}

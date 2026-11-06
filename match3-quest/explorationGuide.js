// Guide du joueur : suivi de quête, cibles, repères, direction à prendre, texte d'objectif et journal.
// Extrait de exploration.js (ré-exporté par celui-ci).
import { puzzlesOfSet } from './puzzle/levels.js';
import { REGION_ORDER } from './world/index.js';
import { connectionMarkers } from './mapConnections.js';
import { objectiveDone, questById, questStatus } from './explorationQuests.js';
import { activeTalkObjective } from './explorationDialogue.js';
import { aliveEnemies, arenaObjectiveText, canWalkOnWater, currentScreen, inArena, isEntityVisible, isExitLocked, puzzleSet } from './exploration.js';

function findNpcScreen(session, npcId) {
    return Object.values(session.screens).find(s => s.npcs.some(n => n.id === npcId)) || null;
}

export const REGION_NUMBER = id => Math.max(0, REGION_ORDER.indexOf(id));

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

// Type d'une quête, pour l'affichage : « main » (histoire principale) ou « side » (annexe).
export function questKind(quest) {
    return quest && quest.side ? 'side' : 'main';
}

// Après l'activation d'une quête : { mode: 'auto' } si aucune autre quête n'est suivie (la nouvelle est alors suivie),
// { mode: 'ask', current } si une autre quête en cours est déjà suivie (le joueur choisit), null si déjà suivie.
export function trackProposal(session, quest) {
    const current = trackedQuest(session);
    if (!current) {
        setTrackedQuest(session, quest.id);
        return { mode: 'auto', quest };
    }
    if (current.id === quest.id) return null;
    return { mode: 'ask', quest, current };
}

export function setTrackedQuest(session, questId) {
    session.data.tracked = questId && session.quests.some(q => q.id === questId) ? questId : null;
    return session.data.tracked;
}

// Quêtes en cours (ou à rendre) avec leur prochain objectif, pour le rappel « Ça fait longtemps ».
export function activeQuestSummaries(session) {
    return session.quests.map(q => ({ q, status: questStatus(session, q) }))
        .filter(({ status }) => status === 'active' || status === 'ready')
        .map(({ q, status }) => {
            const obj = q.objectives.find(o => !objectiveDone(session, o));
            return { title: q.title, objective: status === 'ready' ? 'Objectif accompli, à rendre' : (obj?.text || ''), ready: status === 'ready' };
        });
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
    if (inArena(session)) return arenaObjectiveText(session);
    const tracked = trackedQuest(session);
    if (tracked) {
        const status = questStatus(session, tracked);
        const target = questTargets(session, tracked)[0];
        if (status === 'ready' && tracked.turnIn) {
            const scr = findNpcScreen(session, tracked.turnIn);
            const npc = scr?.npcs.find(n => n.id === tracked.turnIn);
            return `${tracked.title} : retournez voir ${npc?.name || 'le PNJ'} (${scr?.name || '?'})`;
        }
        const obj = tracked.objectives.find(o => !objectiveDone(session, o));
        return `${tracked.title} : ${obj ? obj.text : 'objectif accompli'}${target ? '' : ''}`;
    }
    for (const quest of session.quests) {
        const status = questStatus(session, quest);
        if (status === 'ready' && quest.turnIn) {
            const scr = findNpcScreen(session, quest.turnIn);
            const npc = scr?.npcs.find(n => n.id === quest.turnIn);
            return `${quest.title} : retournez voir ${npc?.name || 'le PNJ'} (${scr?.name || '?'})`;
        }
        if (status === 'active' && !quest.side) {
            const obj = quest.objectives.find(o => !objectiveDone(session, o));
            return `${quest.title} : ${obj ? obj.text : 'objectif accompli'}`;
        }
        if (status === 'available' && quest.giver && !quest.autoStart && !quest.side) {
            const scr = findNpcScreen(session, quest.giver);
            const npc = scr?.npcs.find(n => n.id === quest.giver);
            if (npc && !isEntityVisible(session, npc)) continue;
            return `Nouvelle quête : parlez à ${npc?.name || 'un PNJ'} (${scr?.name || '?'})`;
        }
    }
    return session.data.ended
        ? 'La légende est achevée ! Ouvrez le journal pour une Nouvelle Partie +.'
        : 'Explorez le monde.';
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
                objectives: e.quest.objectives.map(o => ({ text: o.type === 'puzzleSet' ? `${o.text} (${puzzlesOfSet(o.target).filter(id => session.data.solvedPuzzles.includes(id)).length}/${puzzlesOfSet(o.target).length})` : o.text, done: objectiveDone(session, o) }))
            };
        });
}

// Indicateur au-dessus d'un PNJ : « ! » quête disponible, « ? » à rendre ou à qui parler, sinon rien.
export function npcMarker(session, npcId) {
    if (activeTalkObjective(session, npcId)) return '?';
    for (const quest of session.quests) {
        const status = questStatus(session, quest);
        if (status === 'ready' && quest.turnIn === npcId) return '?';
        if (status === 'available' && quest.giver === npcId && !quest.autoStart) return '!';
    }
    return '';
}

// Indicateur de quête d'un écran (maison) : « ? » si une quête y est à rendre / une cible de la quête suivie s'y trouve,
// « ! » si un PNJ y propose une quête, sinon ''.
export function screenQuestMarker(session, screenId) {
    const screen = session.screens[screenId];
    if (!screen) return '';
    let marker = '';
    for (const npc of screen.npcs) {
        if (!isEntityVisible(session, npc)) continue;
        const m = npcMarker(session, npc.id);
        if (m === '?') return '?';
        if (m) marker = m;
    }
    const tracked = trackedQuest(session);
    if (tracked && questTargets(session, tracked).some(t => t.screenId === screenId)) return '?';
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
    const toEvent = session.screens[toId]?.event || null;
    const attempt = (allowLocked, allowSea = canWalkOnWater(session)) => {
        const seen = new Map([[fromId, null]]);
        const queue = [fromId];
        while (queue.length) {
            const id = queue.shift();
            if (id === toId) break;
            // sorties (portes, escaliers) et passages de bord (repère au milieu du passage)
            for (const ex of [...session.screens[id].exits, ...connectionMarkers(session.screens, session.screens[id])]) {
                if (seen.has(ex.to) || !session.screens[ex.to]) continue;
                if (!allowLocked && isExitLocked(session, ex)) continue;
                // Bordure de mer : on ne la franchit qu'avec le Pas de Yu, sinon le guidage prend le passage à pied.
                if (ex.sea && !allowSea) continue;
                // Portails d'événement (royaume des âmes) : jamais un raccourci vers un autre écran ; on n'y entre que si la cible y est,
                // la sortie du royaume n'est donc empruntée que depuis l'intérieur.
                if (ex.rememberReturn && !(toEvent && session.screens[ex.to].event === toEvent)) continue;
                seen.set(ex.to, { from: id, exit: ex });
                queue.push(ex.to);
            }
        }
        if (!seen.has(toId)) return null;
        let step = seen.get(toId);
        while (step && step.from !== fromId) step = seen.get(step.from);
        return step ? step.exit : null;
    };
    return attempt(false) || attempt(true) || attempt(true, true);
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

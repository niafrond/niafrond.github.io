// Compagnons et dialogues contextuels : répliques d'ambiance, conversation avec un PNJ.
// Extrait de exploration.js (ré-exporté par celui-ci).
import { COMPANIONS, BANTER } from './companions.js';
import { checkAutoQuests, completeQuest, objectiveDone, progressReached, questStatus, startQuest } from './explorationQuests.js';
import { visibleNpcs, warpNpc } from './exploration.js';

// ── Compagnons et dialogues contextuels (companions.js) ─────────────────────
// Un compagnon rejoint le groupe quand sa condition `joinWhen` est remplie. Une réplique de groupe (`BANTER`) se joue une seule
// fois (`data.banterSeen`) quand tous ses compagnons ont rejoint, que le héros est sur son `screen` (si précisé) et que sa
// condition `whenDone` (si précisée) est remplie. Retourne des événements `scene` (comme `afterScenes`), au plus `limit` à la fois.
export const companionJoined = (session, comp) => Boolean(comp) && (!comp.joinWhen || progressReached(session, comp.joinWhen));
export const companionsOf = session => COMPANIONS.filter(c => companionJoined(session, c));

// Un seul compagnon est actif à la fois (celui qui combat et suit le héros) : `data.activeCompanion`, ou le premier recruté par défaut.
export function activeCompanionOf(session) {
    if (session.rt.changeMode) return null;   // Chang'e explore seule
    const joined = companionsOf(session);
    const chosen = session.data.activeCompanion;
    if (chosen === 'none') return null;
    return joined.find(c => c.id === chosen) || joined[0] || null;
}
export function setActiveCompanion(session, id) {
    const ok = id === 'none' || companionsOf(session).some(c => c.id === id);
    if (ok) session.data.activeCompanion = id;
    return ok;
}

const asList = v => (v == null ? [] : [].concat(v));

export function collectBanter(session, limit = 2) {
    const here = session.data.screenId;
    const events = [];
    for (const b of BANTER) {
        if (events.length >= limit) break;
        if (session.data.banterSeen.includes(b.id)) continue;
        if (!asList(b.companion).every(id => companionJoined(session, COMPANIONS.find(c => c.id === id)))) continue;
        if (b.screen && !asList(b.screen).includes(here)) continue;
        if (b.whenDone && !progressReached(session, b.whenDone)) continue;
        if (b.unless && progressReached(session, b.unless)) continue;
        session.data.banterSeen.push(b.id);
        (b.scenes || [{ speaker: b.speaker, lines: b.lines }]).forEach(sc => events.push({ type: 'scene', banter: b.id, speaker: sc.speaker, lines: sc.lines }));
    }
    return events;
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
export function activeTalkObjective(session, npcId) {
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

    // PNJ de passage (`warp: { to, lines, label }`) : les lignes sont dites, puis le joueur choisit d'être emporté vers `warp.to` (voir `warpNpc`).
    if (npc.warp) return { type: 'dialog', npc, lines: [...(npc.warp.lines?.length ? npc.warp.lines : npc.idle || ['...'])], events: [], warp: npc.warp };

    // Appât : lui parler attire l'ennemi (`bait.enemy`) ; les lignes sont dites, puis le combat démarre.
    if (npc.bait && !session.data.defeated.includes(npc.bait.enemy)) {
        const first = !session.data.talked.includes(npcId);
        if (first) session.data.talked.push(npcId);
        const lines = first || !npc.bait.retry?.length ? npc.bait.lines : npc.bait.retry;
        return { type: 'dialog', npc, lines: [...lines], events: [], combat: npc.bait.enemy };
    }

    // Objectif « parler à » : la réplique de la cible, puis éventuellement l'offre d'une autre quête.
    const talk = activeTalkObjective(session, npcId);
    let lines = [];
    const events = [];
    // Pourparlers (chemin relationnel) : la première conversation avec un PNJ `parley` lève l'obstacle sans combat.
    if (npc.parley?.lines?.length && !session.data.talked.includes(npcId)) {
        session.data.talked.push(npcId);
        events.push({ type: 'parley', npc }, ...checkAutoQuests(session));
        return { type: 'dialog', npc, lines: [...npc.parley.lines], events };
    }
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
    // Une réplique d'avancement du PNJ (`talk` + `whenDone`) l'emporte sur le simple indice d'une quête annexe en cours.
    const ambient = npcAmbientLines(session, npc);
    const active = withStatus.find(q => (q.status === 'active' || q.status === 'ready') && q.quest.hint?.length);
    if (active && !(active.quest.side && ambient !== npc.idle)) return { type: 'dialog', npc, lines: active.quest.hint, events: [] };
    return { type: 'dialog', npc, lines: ambient, events: [] };
}

// Emplacements (PNJ, ennemis, coffres) liés aux quêtes, partagés par build-soluce.mjs (pages) et build-soluce-shots.mjs (captures).
import { QUESTS, SCREENS } from '../story.js';

// Index des entités : « kind:id » → { kind, screen, ent }
export const ENT = {};
for (const s of Object.values(SCREENS)) {
    for (const [list, kind] of [[s.npcs, 'npc'], [s.enemies, 'enemy'], [s.chests, 'chest']]) {
        for (const e of list || []) if (e.id && !ENT[`${kind}:${e.id}`]) ENT[`${kind}:${e.id}`] = { kind, screen: s, ent: e };
    }
}
export const entOf = (id, kinds = ['npc', 'enemy', 'chest']) => kinds.map(k => ENT[`${k}:${id}`]).find(Boolean) || null;

// Cases à entourer pour une quête : [{ screenId, id, kind, name, role, x, y }] (donneur, lieu de remise, cibles des objectifs).
export function questTargets(q) {
    const out = [];
    const add = (hit, role, label) => {
        if (!hit || !Number.isFinite(hit.ent.x) || !Number.isFinite(hit.ent.y)) return;
        out.push({ screenId: hit.screen.id, id: hit.ent.id, kind: hit.kind, name: label || hit.ent.name || hit.ent.label || hit.ent.id, role, x: hit.ent.x, y: hit.ent.y });
    };
    add(entOf(q.giver, ['npc']), 'giver', null);
    if (q.turnIn !== q.giver) add(entOf(q.turnIn, ['npc']), 'turnIn', null);
    for (const o of q.objectives) {
        if (o.type === 'killGroup') {
            Object.values(SCREENS).forEach(s => (s.enemies || []).filter(e => e.group === o.target).forEach(e => add({ screen: s, ent: e, kind: 'enemy' }, 'target')));
        } else if (o.type === 'kill') add(entOf(o.target, ['enemy']), 'target');
        else if (o.type === 'chest') add(entOf(o.target, ['chest']), 'target');
        else if (o.type === 'talk') add(entOf(o.target, ['npc']), 'target');
        else if (o.type === 'item') add(entOf(o.target, ['chest', 'npc', 'enemy']), 'target');
    }
    return out;
}

// Écrans à photographier : ceux qui portent au moins une case à entourer.
export const shotScreens = () => [...new Set(QUESTS.flatMap(q => questTargets(q).map(t => t.screenId)))];

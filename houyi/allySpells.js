/**
 * allySpells.js — sorts actifs de chaque compagnon. Chaque classe a SON panel de sorts : ce qu'on équipe ou retire pour un compagnon ne concerne que lui.
 * Réserve d'un compagnon : les sorts de sa classe débloqués à son niveau (classes.js). Tant que le joueur n'a rien réglé, ses sorts actifs sont les premiers
 * de la réserve (MAX_ACTIVE_SPELLS, sans les sorts archivés) ; dès le premier réglage, la liste choisie (`hero.allySpells[classId]`, ids) devient la sienne.
 * Module pur (aucun DOM).
 */
import { MAX_ACTIVE_SPELLS } from './constants.js';
import { getClassSpells } from './classes.js';
import { ALLIES } from './allies.js';

/** Sorts de classe d'un compagnon, débloqués au niveau du héros. */
export const allyPool = (hero, classId) => (ALLIES[classId] ? getClassSpells(classId, hero?.level || 1) : []);

/** Ids des sorts actifs d'un compagnon (liste choisie, sinon les premiers de sa réserve). */
export function activeAllySpellIds(hero, classId) {
    const pool = allyPool(hero, classId);
    const known = new Set(pool.map(s => s.id));
    const chosen = hero?.allySpells?.[classId];
    if (Array.isArray(chosen)) return chosen.filter((id, i, a) => known.has(id) && a.indexOf(id) === i).slice(0, MAX_ACTIVE_SPELLS);
    const archived = hero?.archivedSpells || [];
    return pool.filter(s => !archived.includes(s.id)).slice(0, MAX_ACTIVE_SPELLS).map(s => s.id);
}

export function activeAllySpells(hero, classId) {
    const pool = allyPool(hero, classId);
    return activeAllySpellIds(hero, classId).map(id => pool.find(s => s.id === id)).filter(Boolean);
}

/** Sorts de la réserve du compagnon qu'il n'a pas équipés. */
export function availableAllySpells(hero, classId) {
    const active = new Set(activeAllySpellIds(hero, classId));
    return allyPool(hero, classId).filter(s => !active.has(s.id));
}

const store = (hero, classId) => { (hero.allySpells ||= {})[classId] = activeAllySpellIds(hero, classId); return hero.allySpells[classId]; };

/** Équipe un sort pour ce compagnon seulement ; plein : `replaceId` désigne le sort remplacé (sinon { needsReplace: true }). */
export function equipAllySpell(hero, classId, spellId, replaceId = null) {
    const ally = ALLIES[classId];
    const spell = allyPool(hero, classId).find(s => s.id === spellId);
    if (!ally || !spell) return { ok: false, message: 'Sort indisponible pour ce personnage.' };
    const ids = store(hero, classId);
    if (ids.includes(spellId)) return { ok: false, message: `${spell.name} est déjà équipé.` };
    if (ids.length >= MAX_ACTIVE_SPELLS) {
        if (!replaceId) return { ok: false, needsReplace: true, message: '' };
        const at = ids.indexOf(replaceId);
        if (at < 0) return { ok: false, message: 'Sort à remplacer introuvable.' };
        const old = allyPool(hero, classId).find(s => s.id === replaceId);
        ids[at] = spellId;
        return { ok: true, message: `${ally.name} : ${spell.name} équipé à la place de ${old?.name || replaceId}.` };
    }
    ids.push(spellId);
    return { ok: true, message: `${ally.name} : ${spell.name} équipé.` };
}

/** Retire un sort à ce compagnon seulement. */
export function unequipAllySpell(hero, classId, spellId) {
    const ally = ALLIES[classId];
    if (!ally) return { ok: false, message: 'Compagnon inconnu.' };
    const ids = store(hero, classId);
    const at = ids.indexOf(spellId);
    if (at < 0) return { ok: false, message: 'Ce sort n\'est pas équipé.' };
    ids.splice(at, 1);
    const spell = allyPool(hero, classId).find(s => s.id === spellId);
    return { ok: true, message: `${ally.name} : ${spell?.name || spellId} retiré.` };
}

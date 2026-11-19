/**
 * allyWeapons.js — armes équipées par les compagnons. Chaque compagnon porte une arme de son type (`ALLIES[id].weapon`) prise
 * dans le sac du héros (butin, coffres, marchands) ; elle ajoute des dégâts à ses sorts (`allyWeaponBonus`). Hou Yi ne les manie pas.
 * Le choix se règle hors combat, dans l'écran des compétences (équipe de combat).
 */
import { ALLIES } from './allies.js';
import { getWeaponById, isCompanionWeapon, companionWeapons } from './weapons.js';
import { recruitedAllies } from './allies.js';

/** Armes du sac qu'un compagnon peut porter : de son type et de niveau permis. */
export function weaponsFor(hero, classId) {
    const type = ALLIES[classId]?.weapon;
    if (!type) return [];
    return (hero?.weapons || []).filter(w => isCompanionWeapon(w) && w.type === type && (w.minLevel || 1) <= (hero.level || 1))
        .sort((a, b) => (b.damage || 0) - (a.damage || 0));
}

/** Arme actuellement équipée par le compagnon (ou null) ; ignorée si elle a quitté le sac (vendue, fusionnée). */
export function allyEquippedWeapon(hero, classId) {
    const id = hero?.allyWeapons?.[classId];
    if (!id) return null;
    return (hero.weapons || []).find(w => w.id === id) || null;
}

/** Équipe (ou retire avec `weaponId` null) l'arme d'un compagnon. Renvoie { ok, message }. */
export function equipAllyWeapon(hero, classId, weaponId) {
    const ally = ALLIES[classId];
    if (!ally) return { ok: false, message: 'Compagnon inconnu.' };
    if (!hero.allyWeapons) hero.allyWeapons = {};
    if (!weaponId) { delete hero.allyWeapons[classId]; return { ok: true, message: `${ally.name} range son arme.` }; }
    const w = weaponsFor(hero, classId).find(x => x.id === weaponId);
    if (!w) return { ok: false, message: `${ally.name} ne peut pas porter cette arme.` };
    // une arme n'équipe qu'un compagnon à la fois (deux compagnons d'un même type : une arme chacun)
    Object.keys(hero.allyWeapons).forEach(k => { if (hero.allyWeapons[k] === weaponId) delete hero.allyWeapons[k]; });
    hero.allyWeapons[classId] = weaponId;
    return { ok: true, message: `${ally.name} prend ${w.name}.` };
}

/** Arme de départ d'un compagnon : la plus modeste de son type (niveau 1), de façon qu'il ne soit jamais recruté les mains vides. */
export function startingWeaponFor(classId) {
    const type = ALLIES[classId]?.weapon;
    if (!type) return null;
    return companionWeapons.filter(w => w.type === type).sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1))[0] || null;
}

/**
 * Garantit qu'un compagnon a une arme : s'il n'en a aucune de son type dans le sac, il reçoit son arme de départ (ajoutée au sac) ; s'il n'en porte aucune,
 * il équipe la meilleure qu'il peut manier. Renvoie { given, equipped } (armes ajoutées / équipées par cet appel, sinon null).
 */
export function ensureAllyWeapon(hero, classId) {
    const out = { given: null, equipped: null };
    if (!ALLIES[classId] || !hero) return out;
    if (!Array.isArray(hero.weapons)) hero.weapons = [];
    if (!weaponsFor(hero, classId).length && !hero.weapons.some(w => isCompanionWeapon(w) && w.type === ALLIES[classId].weapon)) {
        const start = startingWeaponFor(classId);
        if (start) { hero.weapons.push(start); out.given = start; }
    }
    if (!allyEquippedWeapon(hero, classId)) {
        const best = weaponsFor(hero, classId).find(w => !Object.values(hero.allyWeapons || {}).includes(w.id)) || weaponsFor(hero, classId)[0];
        if (best && equipAllyWeapon(hero, classId, best.id).ok) out.equipped = best;
    }
    return out;
}

/** Applique ensureAllyWeapon à tous les compagnons recrutés (sauvegardes anciennes : un compagnon déjà recruté sans arme en reçoit une). */
export function ensureAllyWeapons(hero) {
    return recruitedAllies(hero).map(id => ({ classId: id, ...ensureAllyWeapon(hero, id) })).filter(r => r.given || r.equipped);
}

export { getWeaponById };

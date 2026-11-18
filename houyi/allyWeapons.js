/**
 * allyWeapons.js — armes équipées par les compagnons. Chaque compagnon porte une arme de son type (`ALLIES[id].weapon`) prise
 * dans le sac du héros (butin, coffres, marchands) ; elle ajoute des dégâts à ses sorts (`allyWeaponBonus`). Hou Yi ne les manie pas.
 * Le choix se règle hors combat, dans l'écran des compétences (équipe de combat).
 */
import { ALLIES } from './allies.js';
import { getWeaponById, isCompanionWeapon } from './weapons.js';

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

export { getWeaponById };

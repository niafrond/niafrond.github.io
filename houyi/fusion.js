// Fusion d'armes chez les forgerons : deux armes que l'on possède, une fois fondues (contre de l'or), donnent une arme plus puissante
// qu'aucun marchand ne vend. Module pur (sans DOM).
//
// Une recette = deux arcs précis (dans n'importe quel ordre) → un arc « de fusion » (champ `fusionOnly` : ni boutique, ni butin).
// Les deux ingrédients sont consommés ; une arme tenue en main ne peut pas être fondue.
import { getWeaponById } from './weapons.js';
import { baseWeaponPrice, getMerchant } from './merchants.js';

export const FUSIONS = [
    { id: 'chasseur_errant', a: 'arc_de_fortune', b: 'arc_de_chasseur', result: 'arc_du_chasseur_errant' },
    { id: 'vents_de_bambou', a: 'arc_leger', b: 'arc_long_de_bambou', result: 'arc_des_vents_de_bambou' },
    { id: 'serpent_d_argent', a: 'arc_de_precision', b: 'arc_venimeux', result: 'arc_du_serpent_d_argent' },
    { id: 'rempart_de_pointes', a: 'arc_lourd', b: 'arc_a_pointes', result: 'arc_du_rempart_de_pointes' },
    { id: 'lune_de_jade', a: 'arc_de_jade', b: 'arc_d_argent', result: 'arc_de_la_lune_de_jade' },
    { id: 'brasier_royal', a: 'arc_de_feu', b: 'arc_de_forge', result: 'arc_du_brasier_royal' },
    { id: 'deux_cieux', a: 'arc_du_juge_celeste', b: 'arc_rouge_celeste', result: 'arc_des_deux_cieux' },
    { id: 'onze_soleils', a: 'arc_des_dix_soleils', b: 'arc_de_lei_gong', result: 'arc_des_onze_soleils' }
];

/** Part du prix de base de l'arme obtenue demandée comme frais de forge. */
export const FUSION_FEE_RATIO = 0.5;

export const getFusion = id => FUSIONS.find(f => f.id === id) || null;

/** Ce marchand est-il un forgeron (propose-t-il la fusion) ? */
export const isForge = merchantId => !!getMerchant(merchantId)?.forge;

export const fusionFee = fusion => {
    const result = getWeaponById(fusion.result);
    return result ? Math.max(1, Math.floor(baseWeaponPrice(result) * FUSION_FEE_RATIO)) : 0;
};

const heldIds = hero => new Set([hero?.equippedWeapon?.id, hero?.equipment?.rightHand?.id, hero?.equipment?.leftHand?.id].filter(Boolean));
const owns = (hero, id) => (hero?.weapons || []).some(w => w.id === id);

/**
 * Toutes les recettes avec leur état pour ce héros : { fusion, a, b, result, fee, owned (les deux armes sont possédées),
 * held (nom d'un ingrédient tenu en main, sinon null), have (déjà possédée : le résultat), ready (fusionnable maintenant), reason }.
 */
export function fusionOffers(hero) {
    const held = heldIds(hero);
    return FUSIONS.map(fusion => {
        const a = getWeaponById(fusion.a), b = getWeaponById(fusion.b), result = getWeaponById(fusion.result);
        const owned = owns(hero, fusion.a) && owns(hero, fusion.b);
        const heldWeapon = [a, b].find(w => held.has(w.id));
        const have = owns(hero, fusion.result);
        const fee = fusionFee(fusion);
        let reason = null;
        if (have) reason = 'Déjà forgée';
        else if (!owned) reason = 'Il vous manque une arme';
        else if (heldWeapon) reason = `${heldWeapon.name} est en main`;
        else if ((hero.level || 1) < result.minLevel) reason = `Niveau ${result.minLevel} requis`;
        else if ((hero.gold || 0) < fee) reason = `Il faut ${fee} pièces d'or`;
        return { fusion, a, b, result, fee, owned, held: heldWeapon?.name || null, have, ready: reason === null, reason };
    });
}

/** Fond les deux armes d'une recette : retire les ingrédients, débite l'or, ajoute l'arme obtenue. Renvoie { ok, message, weapon }. */
export function fuseWeapons(hero, fusionId) {
    const offer = fusionOffers(hero).find(o => o.fusion.id === fusionId);
    if (!offer) return { ok: false, message: 'Recette inconnue.' };
    if (!offer.ready) return { ok: false, message: `${offer.result.name} : ${offer.reason.toLowerCase()}.` };
    hero.weapons = (hero.weapons || []).filter(w => w.id !== offer.a.id && w.id !== offer.b.id);
    hero.weapons.push(offer.result);
    hero.gold -= offer.fee;
    return { ok: true, message: `${offer.a.name} et ${offer.b.name} fondus en ${offer.result.name} pour ${offer.fee} pièces d'or !`, weapon: offer.result, offer };
}

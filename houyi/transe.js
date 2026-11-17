// Xiūxiān : la jauge (ex-« rage ») se remplit quand le héros subit des dégâts. Pleine, la Xiūxiān se DÉCLENCHE AUTOMATIQUEMENT et dure
// TRANSE_TURNS tours du joueur ; la jauge retombe à 0 à la fin. Son effet dépend de la classe choisie pour le tour (une classe par tour) :
//  - sorcier (Mage antique) : l'ultime peut être lancé (seule classe qui le permette) ;
//  - rôdeur : points d'action en plus ; commandant : Défense ; guerrier : Attaque.
// Module pur (sans DOM).

export const TRANSE_TURNS = 3;

export const TRANSE_EFFECTS = {
    sorcerer: { ultimate: true, text: 'l\'ultime peut être lancé' },
    assassin: { actionPoints: 2, text: '+2 points d\'action par tour' },
    templar: { defense: 25, text: 'Défense +25 pendant le tour' },
    barbarian: { attack: 25, text: 'Attaque +25 pendant le tour' }
};

/** La classe du tour permet-elle de lancer l'ultime ? (sorcier uniquement) */
export const classAllowsUltimate = turnClass => turnClass === 'sorcerer';

/** Effet de la Xiūxiān pour la classe choisie ce tour (objet vide pour une classe inconnue ou aucune). */
export const transeEffectFor = turnClass => TRANSE_EFFECTS[turnClass] || {};

export const describeTranse = turnClass => {
    const effect = TRANSE_EFFECTS[turnClass];
    return effect ? `Xiūxiān : ${effect.text}.` : 'Transe : choisissez une classe pour en profiter.';
};

/** La Xiūxiān est-elle en cours ? (menu secret « rage toujours au max » : toujours) */
export const isInTranse = entity => entity?.cheatMaxRage === true || Math.floor(entity?.transe || 0) > 0;

/** Déclenche la Xiūxiān (sans effet si déjà en cours). Renvoie vrai si elle vient de commencer. */
export function startTranse(entity) {
    if (!entity || Math.floor(entity.transe || 0) > 0) return false;
    entity.transe = TRANSE_TURNS;
    return true;
}

export function endTranse(entity) {
    if (entity) entity.transe = 0;
}

/** Fin d'un tour du joueur : décompte. Renvoie vrai quand la Xiūxiān vient de se terminer. */
export function tickTranse(entity) {
    if (!entity || Math.floor(entity.transe || 0) <= 0) return false;
    entity.transe = Math.floor(entity.transe) - 1;
    return entity.transe <= 0;
}

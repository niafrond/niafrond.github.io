// Xiūxiān (ex-« rage ») : UNE JAUGE PAR CLASSE. Subir des dégâts remplit la jauge de la classe choisie pour le tour ; chaque jauge se CONSERVE
// d'un combat à l'autre. Pleine, le joueur déclenche VOLONTAIREMENT la Xiūxiān de cette classe (toucher la jauge, au début de son tour,
// sans perdre le tour) : elle dure TRANSE_TURNS tours du joueur, avec l'effet de SA classe (même si l'on change de classe ensuite), puis la
// jauge de cette classe retombe à 0. Effets : sorcier (Mage antique) = l'ultime peut être lancé (seule classe qui le permette) ; rôdeur :
// points d'action ; commandant : Défense ; guerrier : Attaque ; moine : soin ; alchimiste : qì ; chamane : points d'action et Défense.
// État : `entity.rage` = jauge de la classe courante (`entity.gaugeClass`), les autres sont rangées dans `entity.rages`.
// Module pur (sans DOM).

export const TRANSE_TURNS = 3;

export const TRANSE_EFFECTS = {
    sorcerer: { ultimate: true, text: 'l\'ultime peut être lancé' },
    assassin: { actionPoints: 2, text: '+2 points d\'action par tour' },
    templar: { defense: 25, text: 'Défense +25 pendant le tour' },
    barbarian: { attack: 25, text: 'Attaque +25 pendant le tour' },
    monk: { healPct: 10, text: 'soigne 10 % des PV max à chaque tour' },
    alchemist: { mana: 2, text: '+2 qì de chaque couleur à chaque tour' },
    shaman: { actionPoints: 1, defense: 10, text: '+1 point d\'action et Défense +10 par tour' }
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

/** Déclenche la Xiūxiān de la classe dont la jauge est affichée (sans effet si déjà en cours). Renvoie vrai si elle vient de commencer. */
export function startTranse(entity) {
    if (!entity || Math.floor(entity.transe || 0) > 0) return false;
    entity.transe = TRANSE_TURNS;
    entity.transeClass = entity.gaugeClass || null;
    return true;
}

/** Termine la Xiūxiān et consomme la jauge de sa classe. */
export function endTranse(entity) {
    if (!entity) return;
    const owner = entity.transeClass;
    entity.transe = 0;
    entity.transeClass = null;
    if (owner) {
        entity.rages = { ...(entity.rages || {}), [owner]: 0 };
        if (entity.gaugeClass === owner) entity.rage = 0;
    }
}

/** Fin d'un tour du joueur : décompte. Renvoie vrai quand la Xiūxiān vient de se terminer (la jauge est alors consommée). */
export function tickTranse(entity) {
    if (!entity || Math.floor(entity.transe || 0) <= 0) return false;
    entity.transe = Math.floor(entity.transe) - 1;
    if (entity.transe <= 0) { endTranse(entity); return true; }
    return false;
}

// ── Une jauge par classe ──
const clampGauge = n => Math.max(0, Math.min(100, Math.floor(Number(n) || 0)));

/** Range la jauge courante dans `entity.rages` (avant de sauvegarder ou de changer de classe). */
export function storeGauge(entity) {
    if (!entity?.gaugeClass) return;
    entity.rages = { ...(entity.rages || {}), [entity.gaugeClass]: clampGauge(entity.rage) };
}

/** Affiche la jauge d'une autre classe : range l'ancienne, charge la nouvelle. */
export function switchGauge(entity, cls) {
    if (!entity || !cls) return;
    if (entity.gaugeClass === cls) return;
    storeGauge(entity);
    entity.gaugeClass = cls;
    entity.rage = clampGauge(entity.rages?.[cls]);
}

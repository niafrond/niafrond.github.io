// Chaque compagnon a SA Xiūxiān : sa jauge (`ally.rage`, remplie quand il subit des dégâts, conservée d'un combat à l'autre dans `hero.rages`),
// son déclenchement et sa durée (`ally.transe`) ; Hou Yi n'a que la sienne (Volée des Dix Soleils). Tant qu'elle dure, son effet profite à l'équipe
// (`mergeTranseEffects`). Wukong : Soixante-douze Transformations ; Nezha : Roues de Feu ; Longwang : Colère du Roi Dragon ; Fuxi : Huit Trigrammes ;
// Shennong : Cent Herbes ; Jingwei : Pierre de la Mer.
// Xiūxiān (ex-« rage ») : UNE JAUGE PAR CLASSE. Subir des dégâts remplit la jauge de la classe choisie pour le tour ; chaque jauge se CONSERVE
// d'un combat à l'autre. Pleine, le joueur déclenche VOLONTAIREMENT la Xiūxiān de cette classe (toucher la jauge, au début de son tour,
// sans perdre le tour) : elle dure TRANSE_TURNS tours du joueur, avec l'effet de SA classe (même si l'on change de classe ensuite), puis la
// jauge de cette classe retombe à 0. Effets : sorcier (Mage antique) = l'ultime peut être lancé (seule classe qui le permette) ; rôdeur :
// points d'action ; commandant : Défense ; guerrier : Attaque ; moine : soin ; alchimiste : qì ; chamane : points d'action et Défense.
// État : `entity.rage` = jauge de la classe courante (`entity.gaugeClass`), les autres sont rangées dans `entity.rages`.
// Module pur (sans DOM).

export const TRANSE_TURNS = 3;

export const TRANSE_EFFECTS = {
    // Chasseur : l'archer divin lâche une volée gratuite à chaque tour (techniques spéciales offensives).
    assassin: { name: 'Volée des Dix Soleils', strikePct: 50, actionPoints: 1, text: 'une volée gratuite (la moitié des dégâts de l\'arme) et +1 point d\'action à chaque tour' },
    // Mage : deux sorts par tour (le second ne prend pas le tour) ; seule voie qui permet de lancer l'ultime.
    sorcerer: { name: 'Colère du Roi Dragon', doubleCast: true, ultimate: true, text: 'deux sorts par tour ; l\'ultime peut être lancé' },
    // Alchimiste : le fourneau des huit trigrammes exhale des vapeurs qui rongent l'ennemi et rendent du qì.
    alchemist: { name: 'Cent Herbes', dotPct: 6, mana: 2, text: 'des vapeurs rongent l\'ennemi (6 % de ses PV max) et rendent 2 qì de chaque couleur, à chaque tour' },
    // Guerrier : la force physique doublée (armes et crânes).
    barbarian: { name: 'Soixante-douze Transformations', physMult: 2, text: 'les dégâts de l\'arme et des crânes sont doublés' },
    // Commandant : rempart qui renvoie une partie des coups (équilibre attaque / défense).
    templar: { name: 'Roues de Feu', defense: 25, reflectPct: 30, text: 'Défense +25 et 30 % des dégâts subis sont renvoyés' },
    // Moine : soins renforcés (régénération).
    monk: { name: 'Huit Trigrammes', healPct: 10, text: 'soigne 10 % des PV max à chaque tour' },
    // Chamane : l'offrande aux ancêtres facilite l'apprentissage (PA doublés à la victoire) et protège.
    shaman: { name: 'Pierre de la Mer', actionPoints: 1, defense: 10, paMult: 2, text: '+1 point d\'action et Défense +10 par tour ; les PA gagnés à la victoire sont doublés' }
};

/** La classe du tour permet-elle de lancer l'ultime ? (sorcier uniquement) */
export const classAllowsUltimate = turnClass => turnClass === 'sorcerer';

/** Effet de la Xiūxiān pour la classe choisie ce tour (objet vide pour une classe inconnue ou aucune). */
export const transeEffectFor = turnClass => TRANSE_EFFECTS[turnClass] || {};

export const describeTranse = turnClass => {
    const effect = TRANSE_EFFECTS[turnClass];
    return effect ? `${effect.name} : ${effect.text}.` : 'Xiūxiān : choisissez une classe pour en profiter.';
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

/** Effets de plusieurs Xiūxiān simultanées (une par membre de l'équipe) : multiplicateurs multipliés, valeurs additionnées, drapeaux cumulés. */
export function mergeTranseEffects(classIds) {
    const out = {};
    (classIds || []).forEach(id => {
        const e = TRANSE_EFFECTS[id];
        if (!e) return;
        Object.entries(e).forEach(([k, v]) => {
            if (k === 'name' || k === 'text') return;
            if (typeof v === 'boolean') out[k] = out[k] || v;
            else if (k === 'physMult' || k === 'paMult') out[k] = (out[k] || 1) * v;
            else out[k] = (out[k] || 0) + v;
        });
    });
    return out;
}

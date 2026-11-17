// Styles de jeu de Hou Yi : une manière de tenir l'arc qui se change librement hors combat, sans rien perdre de la progression.
// Module pur (aucun DOM). Un style ne modifie JAMAIS les statistiques enregistrées (PV, attaque, attributs, niveau) :
// ses effets sont des multiplicateurs appliqués à l'exécution (game.js). Changer de style = changer `player.playStyle`.
//  - flamboyant : dégâts infligés élevés, mais les sorts coûtent plus de qì ;
//  - mystique   : qì abondant (gain majoré, bonus sur les alignements de 4+), sorts moins chers et plus puissants, tirs plus faibles ;
//  - gardien    : dégâts subis réduits, mais dégâts infligés moindres.
// `null` (ou id inconnu) = style libre : aucun modificateur (c'est l'état des parties existantes).

export const PLAY_STYLES = Object.freeze({
    flamboyant: Object.freeze({
        id: 'flamboyant',
        name: 'Archer flamboyant',
        summary: 'Dégâts élevés, attaques puissantes, consommation de ressources plus importante.',
        effects: ['+25 % de dégâts infligés', 'Sorts : coût en qì +25 %'],
        damageDealt: 1.25, damageTaken: 1, spellDamage: 1, spellCost: 1.25, manaGain: 1, bigMatchBonus: 0
    }),
    mystic: Object.freeze({
        id: 'mystic',
        name: 'Archer mystique',
        summary: 'Gestion du qì, sorts et combinaisons spéciales.',
        effects: ['+25 % de qì gagné, +2 qì par alignement de 4 ou plus', 'Sorts : coût en qì -15 %, dégâts +15 %', 'Tirs et crânes : dégâts -10 %'],
        damageDealt: 0.9, damageTaken: 1, spellDamage: 1.15 / 0.9, spellCost: 0.85, manaGain: 1.25, bigMatchBonus: 2
    }),
    guardian: Object.freeze({
        id: 'guardian',
        name: 'Archer gardien',
        summary: 'Défense, protection et endurance.',
        effects: ['-25 % de dégâts subis', '-15 % de dégâts infligés'],
        damageDealt: 0.85, damageTaken: 0.75, spellDamage: 1, spellCost: 1, manaGain: 1, bigMatchBonus: 0
    })
});

export const PLAY_STYLE_ORDER = Object.freeze(['flamboyant', 'mystic', 'guardian']);

export const getPlayStyle = entity => PLAY_STYLES[entity?.playStyle] || null;

/** Change le style (null = style libre). Refuse un id inconnu. Ne touche à aucune autre donnée du joueur. */
export function setPlayStyle(entity, id) {
    if (!entity) return false;
    if (id === null || id === '' || id === undefined) { entity.playStyle = null; return true; }
    if (!PLAY_STYLES[id]) return false;
    entity.playStyle = id;
    return true;
}

/** Dégâts infligés par le héros (`isSpell` : provient d'un sort). Au moins 1 si le coup touchait. */
export function styleDamageDealt(entity, damage, isSpell = false) {
    const s = getPlayStyle(entity);
    const d = Math.max(0, Math.floor(damage || 0));
    if (!s || d <= 0) return d;
    return Math.max(1, Math.round(d * s.damageDealt * (isSpell ? s.spellDamage : 1)));
}

/** Dégâts reçus par le héros. Au moins 1 si le coup touchait. */
export function styleDamageTaken(entity, damage) {
    const s = getPlayStyle(entity);
    const d = Math.max(0, Math.floor(damage || 0));
    if (!s || d <= 0) return d;
    return Math.max(1, Math.round(d * s.damageTaken));
}

/** Coût en qì d'une couleur d'un sort (jamais moins de 1 pour un coût non nul). */
export function styleSpellCost(entity, amount) {
    const s = getPlayStyle(entity);
    const a = Math.max(0, Math.floor(amount || 0));
    if (!s || a <= 0 || s.spellCost === 1) return a;
    return Math.max(1, s.spellCost > 1 ? Math.ceil(a * s.spellCost - 1e-9) : Math.floor(a * s.spellCost + 1e-9));
}

/** Qì gagné pour un match : `base` = tuiles alignées, `total` = gain déjà calculé (attributs, multiplicateurs). */
export function styleManaGain(entity, total, matchLength = 3) {
    const s = getPlayStyle(entity);
    const t = Math.max(0, Math.floor(total || 0));
    if (!s || t <= 0) return t;
    return Math.floor(t * s.manaGain + 1e-9) + (matchLength >= 4 ? s.bigMatchBonus : 0);
}

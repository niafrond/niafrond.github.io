// Réutilisabilité des objets : un objet est « à usage unique » (consommé quand on s'en sert) ou « relique réutilisable » (charges
// qui se rechargent). Module pur (aucun accès au DOM).
//
// Critère : ce qui s'avale, se boit, se brûle ou se frotte sur une plaie (élixirs, pilules, vins, thés, infusions, tisanes, baumes, encens, nectar)
// est consommé ; un objet durable qu'on garde et qu'on réactive (talisman, sachet, pierre, plume, flacon, gourde) est une relique réutilisable.
// Les reliques passives (type `artifact`, portées en permanence) sont à part (items.js).
export const REUSE = { SINGLE: 'single', RELIC: 'relic' };

/** Objets durables du catalogue : réutilisables (tous les autres objets utilisables sont à usage unique). */
export const REUSABLE_IDS = new Set([
    'honey_vial',             // Flacon de Miel Magique
    'protective_sachet',      // Sachet d'Encens Protecteur
    'energy_stone',           // Pierre d'Énergie Ravivante
    'power_talisman',         // Talisman de Puissance
    'defensePotion',          // Talisman de Garde
    'jadeSaltTalisman',       // Talisman de Sel de Jade
    'phoenixFeather',         // Plume de Fenghuang
    'golden_phoenix_feather', // Plume de Fenghuang Dorée
    'regenPotion'             // Gourde de Tisane Médicinale
]);

/** Réutilisabilité d'un objet utilisable : `reuse` posé sur l'objet, sinon selon la liste ci-dessus. null pour tout autre type d'objet. */
export function reuseOf(item) {
    if (!item || (item.type !== 'reusable' && item.type !== 'consumable')) return null;
    if (item.reuse === REUSE.SINGLE || item.reuse === REUSE.RELIC) return item.reuse;
    return REUSABLE_IDS.has(item.id) ? REUSE.RELIC : REUSE.SINGLE;
}
export const isSingleUse = item => reuseOf(item) === REUSE.SINGLE;
export const isReusableRelic = item => reuseOf(item) === REUSE.RELIC;

/** Libellé affiché (info-bulle, listes). */
export function reuseLabel(item) {
    const r = reuseOf(item);
    return r === REUSE.RELIC ? 'Relique réutilisable' : r === REUSE.SINGLE ? 'Usage unique' : '';
}

/** Texte de description d'un objet à usage unique : la mention de recharge est remplacée. */
export function singleUseDescription(description) {
    return String(description || '')
        .replace(/\s*\((?:\d+ usages?, puis )?rechargé en \d+ tours?\)/i, ' (usage unique)')
        .replace(/\s*,?\s*sans cumul(?= \(usage unique\))/i, ', sans cumul');
}

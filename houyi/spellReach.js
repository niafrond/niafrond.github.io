// Sorts hors de portée : un sort multimana dont le coût dans une couleur dépasse la réserve maximale de cette couleur ne pourra jamais être lancé
// tant que la réserve n'est pas relevée (points de l'attribut de la couleur, équipement). Module pur (sans DOM), utilisé par la liste des sorts.
import { MANA_LABELS } from './manaGear.js';

/** Couleurs du sort dont le coût dépasse la réserve : [{ color, cost, cap }] (vide si le sort est à portée ou si son coût est un simple nombre). */
export function unreachableCosts(spell, capOf) {
    const cost = spell?.cost;
    if (!cost || typeof cost !== 'object') return [];
    return Object.entries(cost)
        .map(([color, amount]) => ({ color, cost: amount, cap: capOf(color) }))
        .filter(part => part.cost > part.cap);
}

/** Phrase d'aide pour le joueur (vide si le sort est à portée). */
export function unreachableText(parts) {
    if (!parts.length) return '';
    const detail = parts.map(p => `qì ${MANA_LABELS[p.color] || p.color} : ${p.cost} demandés, réserve de ${p.cap}`).join(' · ');
    return `Réserve trop petite (${detail}). Relevez-la avec les points de l'attribut de cette couleur ou de l'équipement.`;
}

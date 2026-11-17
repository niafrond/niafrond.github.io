// Qì max apporté par l'équipement : champ `manaMax` d'une arme, d'un bouclier ou d'un stuff porté, `{ couleur: bonus }`
// (une ou plusieurs couleurs). Module pur (sans DOM), additionné au plafond de qì de chaque couleur (game.js : getManaCapForColor).

import { wornStuff } from './stuff.js';

export const MANA_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
export const MANA_LABELS = { red: 'rouge', blue: 'bleu', green: 'vert', yellow: 'jaune', purple: 'violet' };

const wornPieces = entity => {
    const gear = [entity?.equippedWeapon, entity?.weapon, entity?.equipment?.rightHand, entity?.equipment?.leftHand, entity?.equipment?.item, ...wornStuff(entity)];
    return [...new Set(gear.filter(Boolean))];
};

/** Qì max d'une couleur apporté par tout ce que porte l'entité. */
export const gearManaBonus = (entity, color) =>
    wornPieces(entity).reduce((sum, piece) => sum + Math.max(0, Math.floor(piece.manaMax?.[color] || 0)), 0);

/** « Qì max rouge +10 », « Qì max vert et jaune +12 », « Qì max +5 (toutes les couleurs) » ; vide sans bonus. */
export function describeManaMax(piece) {
    const entries = MANA_COLORS.map(c => [c, Math.floor(piece?.manaMax?.[c] || 0)]).filter(([, n]) => n > 0);
    if (!entries.length) return '';
    if (entries.length === MANA_COLORS.length && entries.every(([, n]) => n === entries[0][1])) return `Qì max +${entries[0][1]} (toutes les couleurs)`;
    const byAmount = new Map();
    entries.forEach(([c, n]) => byAmount.set(n, [...(byAmount.get(n) || []), MANA_LABELS[c]]));
    return [...byAmount].map(([n, colors]) => `Qì max ${colors.join(' et ')} +${n}`).join(' • ');
}

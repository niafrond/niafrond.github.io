// Soin de victoire : gagner un combat rend une part des PV max du héros. Elle grandit avec le niveau et avec les points mis en Stamina
// (le choix de caractéristiques) ; module pur (sans DOM), appliqué par gameTurnFlow.js à la dernière victoire d'un combat.
export const VICTORY_HEAL_BASE = 5;        // % au niveau 1, sans point de Stamina
export const VICTORY_HEAL_PER_LEVEL = 0.15; // % par niveau (+10 % au niveau 70)
export const VICTORY_HEAL_PER_STAMINA = 0.25; // % par point de Stamina (+17 % aux 69 points)
export const VICTORY_HEAL_MAX = 35;

/** Part des PV max (en %, entier) rendue par une victoire. */
export function victoryHealPct(level = 1, stamina = 0) {
    const pct = VICTORY_HEAL_BASE + Math.max(0, level - 1) * VICTORY_HEAL_PER_LEVEL + Math.max(0, stamina) * VICTORY_HEAL_PER_STAMINA;
    return Math.min(VICTORY_HEAL_MAX, Math.round(pct));
}

/** PV rendus au héros (au moins 1). */
export const victoryHealAmount = hero => Math.max(1, Math.round((hero?.maxHp || 0) * victoryHealPct(hero?.level, hero?.attributes?.stamina) / 100));

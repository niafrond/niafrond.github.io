// Potions de soin : à USAGE UNIQUE, achetées chez les marchands, en nombre illimité dans le sac. Les PV ne reviennent plus tout seuls
// après un combat : les potions servent à les rendre. Module pur (sans DOM).
//
// Trois tailles : petite (25 % des PV max, 1 PA), moyenne (50 %, 2 PA), grande (75 %, 3 PA). En combat, boire coûte ces points d'action
// (comme une arme) et prend le tour ; hors combat, c'est gratuit. Stock du héros : `hero.potions = { small, medium, large }`.

export const POTION_SIZES = ['small', 'medium', 'large'];

export const POTIONS = {
    small: { id: 'small', name: 'Petite potion', healPct: 25, actionPoints: 1, basePrice: 30 },
    medium: { id: 'medium', name: 'Potion moyenne', healPct: 50, actionPoints: 2, basePrice: 70 },
    large: { id: 'large', name: 'Grande potion', healPct: 75, actionPoints: 3, basePrice: 140 }
};

export function normalizePotions(hero) {
    if (!hero) return null;
    const raw = hero.potions && typeof hero.potions === 'object' ? hero.potions : {};
    hero.potions = Object.fromEntries(POTION_SIZES.map(s => [s, Math.max(0, Math.floor(Number(raw[s]) || 0))]));
    return hero.potions;
}

export const potionCount = (hero, size) => normalizePotions(hero)[size] || 0;

/** PV rendus par une potion pour ce héros (part des PV max, arrondie, au moins 1). */
export const potionHeal = (hero, size) => Math.max(1, Math.round((hero?.maxHp || 0) * POTIONS[size].healPct / 100));

/** Prix d'une potion chez un marchand dont la région est de niveau `regionLevel` : le barème monte avec la région. */
export const potionPrice = (size, regionLevel = 1) => Math.ceil(POTIONS[size].basePrice * (1 + Math.max(1, regionLevel) / 15));

export function addPotions(hero, size, qty = 1) {
    if (!POTIONS[size]) return 0;
    normalizePotions(hero)[size] += Math.max(0, Math.floor(qty));
    return hero.potions[size];
}

/** Achat : retire l'or, ajoute une potion. Renvoie { ok, message }. */
export function buyPotion(hero, size, regionLevel = 1) {
    const potion = POTIONS[size];
    if (!potion) return { ok: false, message: 'Potion inconnue.' };
    const price = potionPrice(size, regionLevel);
    if ((hero.gold || 0) < price) return { ok: false, message: `Pas assez d'or ! Coût : ${price}, vous avez ${hero.gold || 0}.` };
    hero.gold -= price;
    addPotions(hero, size, 1);
    return { ok: true, price, message: `${potion.name} achetée pour ${price} pièces d'or (vous en avez ${hero.potions[size]}).` };
}

/**
 * Pourquoi on ne peut pas boire (null si on peut). `inCombat` : il faut aussi les points d'action (`hero.combatPoints`).
 */
export function drinkBlockReason(hero, size, inCombat, free = false) {
    const potion = POTIONS[size];
    if (!potion) return 'Potion inconnue.';
    if (potionCount(hero, size) <= 0) return `Aucune ${potion.name.toLowerCase()}.`;
    if ((hero.hp || 0) >= (hero.maxHp || 0)) return 'Vos PV sont déjà au maximum.';
    if (inCombat && !free && (hero.combatPoints || 0) < potion.actionPoints) return `Il faut ${potion.actionPoints} point${potion.actionPoints > 1 ? 's' : ''} d'action.`;
    return null;
}

/** Boit une potion : retire la potion (et les PA en combat), rend les PV (plafonnés). Renvoie { ok, message, healed }. */
export function drinkPotion(hero, size, { inCombat = false, free = false } = {}) {
    const reason = drinkBlockReason(hero, size, inCombat, free);
    if (reason) return { ok: false, message: reason, healed: 0 };
    const potion = POTIONS[size];
    hero.potions[size] -= 1;
    if (inCombat && !free) hero.combatPoints -= potion.actionPoints;
    const before = hero.hp;
    hero.hp = Math.min(hero.maxHp, hero.hp + potionHeal(hero, size));
    const healed = hero.hp - before;
    return { ok: true, healed, message: `${potion.name} : +${healed} PV.` };
}

// Progression au-delà du niveau 18 : les armes et les sorts s'arrêtent au niveau 18 (dégâts ≤ 100 / 150) alors que les ennemis
// continuent de croître jusqu'au niveau 70. Chaque niveau gagné apporte donc, en plus des points d'attribut, une croissance
// innée : de l'attaque après le niveau 18 et plus de PV après le niveau 20. Module pur, sans DOM.

export const INNATE_ATTACK_FROM_LEVEL = 18;   // +2 attaque par niveau à partir du niveau 19
export const INNATE_ATTACK_PER_LEVEL = 2;
export const BONUS_HP_FROM_LEVEL = 20;        // +5 PV max supplémentaires par niveau à partir du niveau 21
export const BONUS_HP_PER_LEVEL = 5;

// Gains supplémentaires pour passer de `fromLevel` à `toLevel` (hors gain de base, +5 PV max et 1 point d'attribut par niveau).
export function growthExtras(fromLevel, toLevel) {
    let attack = 0, maxHp = 0;
    for (let lvl = Math.max(2, Math.floor(fromLevel) + 1); lvl <= Math.floor(toLevel); lvl++) {
        if (lvl > INNATE_ATTACK_FROM_LEVEL) attack += INNATE_ATTACK_PER_LEVEL;
        if (lvl > BONUS_HP_FROM_LEVEL) maxHp += BONUS_HP_PER_LEVEL;
    }
    return { attack, maxHp };
}

// Applique au joueur la croissance innée des niveaux pas encore comptés (`growthLevel`) : à appeler à chaque gain de niveau et au
// chargement d'une sauvegarde (une ancienne partie au niveau 25 reçoit le rattrapage une seule fois). Renvoie les gains.
export function applyGrowth(player) {
    const from = Number.isInteger(player.growthLevel) ? player.growthLevel : 1;
    const to = Math.max(1, Math.floor(player.level) || 1);
    const gains = growthExtras(from, to);
    if (to > from) {
        player.attack = (player.attack || 0) + gains.attack;
        player.maxHp = (player.maxHp || 0) + gains.maxHp;
        player.hp = Math.min(player.maxHp, (player.hp || 0) + gains.maxHp);
        player.growthLevel = to;
    } else if (!Number.isInteger(player.growthLevel)) {
        player.growthLevel = to;
    }
    return gains;
}

// Défense d'un ennemi de niveau `level` : 2 + 2 × niveau jusqu'au niveau 20, puis +0,5 par niveau (sinon les armes du joueur ne
// perceraient plus rien au-delà du niveau 30).
export function enemyDefenseForLevel(level) {
    const L = Math.max(1, Math.floor(level) || 1);
    return L <= 20 ? 2 + 2 * L : Math.floor(42 + 0.5 * (L - 20));
}

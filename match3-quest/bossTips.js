/**
 * bossTips.js — Conseil « anti try-hard » : un joueur qui perd trois fois de suite contre le même boss reçoit une piste
 * pour progresser autrement (monter de niveau sur des ennemis plus faibles, acheter du matériel aux marchands…).
 *
 * Module pur (sans DOM) : game.js tient la série (`player.bossLossStreak`) et affiche le conseil sur l'écran de défaite.
 */

export const BOSS_LOSS_THRESHOLD = 3;

/** Série de défaites après une nouvelle défaite contre `bossId` : +1 si c'est le même boss, sinon on repart à 1. */
export function recordBossLoss(streak, bossId) {
    if (!bossId) return streak || null;
    if (streak && streak.id === bossId) return { id: bossId, count: (streak.count || 0) + 1 };
    return { id: bossId, count: 1 };
}

/** Une victoire (sur n'importe quel ennemi) interrompt la série : le joueur a trouvé autre chose à faire. */
export function recordVictory() {
    return null;
}

export const isStreakTipDue = (streak) => Boolean(streak) && (streak.count || 0) >= BOSS_LOSS_THRESHOLD;

/**
 * Conseils applicables à la situation du joueur, du plus pertinent au plus général.
 * ctx : { playerLevel, bossLevel, gold, unspentPoints, hasConsumables }
 */
export function applicableTips(ctx = {}) {
    const tips = [];
    const level = Number(ctx.playerLevel) || 1;
    const bossLevel = Number(ctx.bossLevel) || 0;
    if (bossLevel > level) {
        tips.push(`Ce boss est de niveau ${bossLevel}, vous n'êtes que niveau ${level} : tentez des ennemis plus faibles pour monter votre niveau avant de revenir.`);
    } else {
        tips.push('Tentez des ennemis plus faibles pour monter votre niveau et gagner de l\'or avant de revenir.');
    }
    if ((Number(ctx.unspentPoints) || 0) > 0) {
        tips.push('Vous avez des points d\'attribut à dépenser : ils améliorent vos statistiques et votre mana.');
    }
    if ((Number(ctx.gold) || 0) >= 100) {
        tips.push('Vous avez de l\'or : achetez d\'autres armes, boucliers ou reliques auprès des marchands des villages.');
    } else {
        tips.push('Gagnez de l\'or en explorant et en battant des ennemis, puis achetez de meilleures armes auprès des marchands.');
    }
    tips.push('Alignez 4 tuiles ou plus pour gagner des tours bonus, et pensez à utiliser vos objets rechargeables.');
    tips.push('Changez d\'arme ou de sorts : un autre équipement peut mieux convenir à ce boss.');
    return tips;
}

/** Conseil à afficher pour la série en cours (il change à chaque nouvelle défaite), ou null si la série est trop courte. */
export function pickBossTip(streak, ctx = {}) {
    if (!isStreakTipDue(streak)) return null;
    const tips = applicableTips(ctx);
    return tips[(streak.count - BOSS_LOSS_THRESHOLD) % tips.length];
}

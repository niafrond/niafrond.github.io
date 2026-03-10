// Système d'expérience et de progression du joueur

export const MAX_LEVEL = 100;
const XP_BASE_PER_LEVEL = 120;
const XP_GROWTH_FACTOR = 1.12;

/**
 * Calcule l'XP nécessaire pour atteindre un niveau donné
 * Formule: XP = baseXP * level^exponant
 * @param {number} level - Le niveau cible
 * @returns {number} - L'XP total nécessaire pour ce niveau
 */
export function getXPRequiredForLevel(level) {
    const clampedLevel = Math.max(1, Math.min(level, MAX_LEVEL));
    if(clampedLevel <= 1) return 0;

    const steps = clampedLevel - 1;
    const totalXP = XP_BASE_PER_LEVEL * ((Math.pow(XP_GROWTH_FACTOR, steps) - 1) / (XP_GROWTH_FACTOR - 1));
    return Math.floor(totalXP);
}

/**
 * Calcule l'XP donnée par un ennemi vaincu
 * Prend en compte la vie, le niveau, l'attaque et la defense de l'ennemi.
 * L'XP rendue est toujours un multiple entier des HP max de l'ennemi.
 * @param {object|number} enemyData - Objet ennemi (ou niveau pour retro-compatibilite)
 * @param {number} playerLevel - Le niveau actuel du joueur
 * @returns {number} - L'XP gagnée
 */
export function calculateXPGain(enemyData, playerLevel) {
    const enemyLevel = Math.max(1, Math.floor(
        typeof enemyData === 'number'
            ? enemyData
            : (enemyData?.level || playerLevel || 1)
    ));
    const enemyMaxHp = Math.max(1, Math.floor(
        typeof enemyData === 'number'
            ? (40 + enemyLevel * 10)
            : (enemyData?.maxHp || enemyData?.hp || (40 + enemyLevel * 10))
    ));
    const enemyAttack = Math.max(0, Math.floor(
        typeof enemyData === 'number'
            ? (5 + enemyLevel * 4)
            : (enemyData?.attack || 0)
    ));
    const enemyDefense = Math.max(0, Math.floor(
        typeof enemyData === 'number'
            ? Math.floor(enemyLevel * 1.5)
            : (enemyData?.defense || 0)
    ));

    const levelDiff = enemyLevel - Math.max(1, Math.floor(playerLevel || 1));
    const statScore = enemyLevel + enemyAttack + enemyDefense;

    // Multiplicateur entier pour garantir une XP multiple des HP max de l'ennemi.
    const baseMultiplier = Math.max(1, Math.floor(statScore / 12));
    const levelAdjustment = levelDiff > 0
        ? levelDiff
        : Math.ceil(levelDiff / 2);
    const finalMultiplier = Math.max(1, baseMultiplier + levelAdjustment);

    return enemyMaxHp * finalMultiplier;
}

/**
 * Ajoute de l'XP au joueur et gère les montées de niveau
 * @param {object} player - L'objet joueur
 * @param {number} xpGain - L'XP à ajouter
 * @returns {object} - { leveledUp: boolean, newLevel: number, levelsGained: number }
 */
export function addXP(player, xpGain) {
    if (!player.xp) player.xp = 0;
    player.level = Math.max(1, Math.min(player.level || 1, MAX_LEVEL));
    if (!player.xpToNextLevel) {
        player.xpToNextLevel = player.level >= MAX_LEVEL ? getXPRequiredForLevel(MAX_LEVEL) : getXPRequiredForLevel(player.level + 1);
    }

    if(player.level >= MAX_LEVEL){
        const capXP = getXPRequiredForLevel(MAX_LEVEL);
        player.xp = Math.min(player.xp, capXP);
        player.xpToNextLevel = capXP;
        return {
            leveledUp: false,
            newLevel: MAX_LEVEL,
            levelsGained: 0
        };
    }
    
    player.xp += xpGain;
    
    let leveledUp = false;
    let levelsGained = 0;
    // Vérifier si le joueur monte de niveau (peut monter de plusieurs niveaux d'un coup)
    while (player.level < MAX_LEVEL && player.xp >= player.xpToNextLevel) {
        player.level++;
        levelsGained++;
        leveledUp = true;
        
        // Calculer l'XP nécessaire pour le prochain niveau
        if(player.level >= MAX_LEVEL){
            player.xpToNextLevel = getXPRequiredForLevel(MAX_LEVEL);
            player.xp = Math.min(player.xp, player.xpToNextLevel);
            break;
        }
        player.xpToNextLevel = getXPRequiredForLevel(player.level + 1);
    }
    
    return {
        leveledUp: leveledUp,
        newLevel: player.level,
        levelsGained: levelsGained
    };
}

/**
 * Calcule le pourcentage de progression vers le niveau suivant
 * @param {object} player - L'objet joueur
 * @returns {number} - Pourcentage entre 0 et 100
 */
export function getXPProgress(player) {
    if(player.level >= MAX_LEVEL) return 100;
    if (!player.xpToNextLevel) return 0;
    
    const previousLevelXP = player.level > 1 ? getXPRequiredForLevel(player.level) : 0;
    const currentXP = player.xp - previousLevelXP;
    const xpForThisLevel = player.xpToNextLevel - previousLevelXP;
    if(xpForThisLevel <= 0) return 100;
    return Math.min(100, Math.floor((currentXP / xpForThisLevel) * 100));
}

/**
 * Obtient le nombre d'XP restants jusqu'au prochain niveau
 * @param {object} player - L'objet joueur
 * @returns {number} - XP restants
 */
export function getXPToNextLevel(player) {
    if(player.level >= MAX_LEVEL) return 0;
    if (!player.xpToNextLevel) return getXPRequiredForLevel(2);
    return Math.max(0, player.xpToNextLevel - player.xp);
}

/**
 * Initialise l'XP d'un nouveau joueur
 * @param {object} player - L'objet joueur
 */
export function initializeXP(player) {
    if (!player.xp) player.xp = 0;
    player.level = Math.max(1, Math.min(player.level || 1, MAX_LEVEL));
    const currentLevelThreshold = getXPRequiredForLevel(player.level);
    if(player.xp < currentLevelThreshold) {
        player.xp = currentLevelThreshold;
    }
    player.xpToNextLevel = player.level >= MAX_LEVEL ? getXPRequiredForLevel(MAX_LEVEL) : getXPRequiredForLevel(player.level + 1);
}

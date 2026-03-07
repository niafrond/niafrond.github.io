// Système d'expérience et de progression du joueur

/**
 * Calcule l'XP nécessaire pour atteindre un niveau donné
 * Formule: XP = baseXP * level^exponant
 * @param {number} level - Le niveau cible
 * @returns {number} - L'XP total nécessaire pour ce niveau
 */
export function getXPRequiredForLevel(level) {
    const baseXP = 100;
    const exponant = 1.5;
    return Math.floor(baseXP * Math.pow(level, exponant));
}

/**
 * Calcule l'XP donnée par un ennemi vaincu
 * Prend en compte le niveau de l'ennemi et du joueur
 * @param {number} enemyLevel - Le niveau de l'ennemi vaincu
 * @param {number} playerLevel - Le niveau actuel du joueur
 * @returns {number} - L'XP gagnée
 */
export function calculateXPGain(enemyLevel, playerLevel) {
    const baseXP = 50;
    const levelDiff = enemyLevel - playerLevel;
    
    // Bonus/malus selon la différence de niveau
    let multiplier = 1.0;
    if (levelDiff > 0) {
        // Ennemi plus fort: bonus de 20% par niveau de différence
        multiplier = 1.0 + (levelDiff * 0.2);
    } else if (levelDiff < 0) {
        // Ennemi plus faible: malus de 10% par niveau de différence (minimum 50%)
        multiplier = Math.max(0.5, 1.0 + (levelDiff * 0.1));
    }
    
    const xpGain = Math.floor(baseXP * enemyLevel * multiplier);
    return Math.max(10, xpGain); // Minimum 10 XP
}

/**
 * Ajoute de l'XP au joueur et gère les montées de niveau
 * @param {object} player - L'objet joueur
 * @param {number} xpGain - L'XP à ajouter
 * @returns {object} - { leveledUp: boolean, newLevel: number, levelsGained: number }
 */
export function addXP(player, xpGain) {
    if (!player.xp) player.xp = 0;
    if (!player.xpToNextLevel) player.xpToNextLevel = getXPRequiredForLevel(player.level + 1);
    
    player.xp += xpGain;
    
    let leveledUp = false;
    let levelsGained = 0;
    const startLevel = player.level;
    
    // Vérifier si le joueur monte de niveau (peut monter de plusieurs niveaux d'un coup)
    while (player.xp >= player.xpToNextLevel) {
        player.level++;
        levelsGained++;
        leveledUp = true;
        
        // Calculer l'XP nécessaire pour le prochain niveau
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
    if (!player.xp || !player.xpToNextLevel) return 0;
    
    const previousLevelXP = player.level > 1 ? getXPRequiredForLevel(player.level) : 0;
    const currentXP = player.xp - previousLevelXP;
    const xpForThisLevel = player.xpToNextLevel - previousLevelXP;
    
    return Math.min(100, Math.floor((currentXP / xpForThisLevel) * 100));
}

/**
 * Obtient le nombre d'XP restants jusqu'au prochain niveau
 * @param {object} player - L'objet joueur
 * @returns {number} - XP restants
 */
export function getXPToNextLevel(player) {
    if (!player.xp || !player.xpToNextLevel) return getXPRequiredForLevel(2);
    return Math.max(0, player.xpToNextLevel - player.xp);
}

/**
 * Initialise l'XP d'un nouveau joueur
 * @param {object} player - L'objet joueur
 */
export function initializeXP(player) {
    if (!player.xp) player.xp = 0;
    if (!player.xpToNextLevel) player.xpToNextLevel = getXPRequiredForLevel(player.level + 1);
}

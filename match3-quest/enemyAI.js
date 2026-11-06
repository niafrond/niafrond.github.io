// Bibliothèque d'intelligence artificielle pour les ennemis
// Gère les décisions stratégiques et le comportement des ennemis en combat

import { player, enemy, canEntityCastSpell } from "./game.js";
import { critChance, blockChance, CRIT_MULTIPLIER } from "./combatStats.js";
import { getOption } from "./gameOptions.js";
import {
    AI_TIERS, resolveDifficulty, tierSettings, thinkingTimeFor,
    PERSONALITIES, assignPersonality, personalityWeight, pickWeighted
} from "./enemyAIProfiles.js";

// Voir enemyAIProfiles.js pour la séparation niveau / personnalité / qualité tactique / difficulté choisie.
export { PERSONALITIES as enemyPersonalities, assignPersonality };
export const aiDifficulty = AI_TIERS;

// Fonction helper mutualisee (joueur/ennemi) importee depuis game.js.
function canAffordSpell(spell) {
    return canEntityCastSpell(enemy, spell);
}

// Difficulté par défaut
let currentDifficulty = aiDifficulty.normal;

// ========================================
// GESTION DE LA DIFFICULTÉ
// ========================================

export function setAIDifficulty(difficulty) {
    if (aiDifficulty[difficulty]) {
        currentDifficulty = aiDifficulty[difficulty];
    }
}

export function getAIDifficulty() {
    return currentDifficulty;
}

/**
 * Règle la difficulté de l'IA au début d'un combat.
 *  - préférence du joueur (Options > Difficulté des ennemis) fixe : appliquée telle quelle ;
 *  - préférence « auto » : adaptation bornée au niveau de l'ennemi (voir resolveDifficulty).
 * Renvoie la clé du palier retenu ('easy' | 'normal' | 'hard' | 'expert').
 */
export function setAIDifficultyByLevel(enemyLevel, playerLevel, enemyProfile = null, preference = getOption('aiDifficulty')) {
    const { tier, special } = resolveDifficulty({ preference, enemyLevel, playerLevel, enemyProfile });
    currentDifficulty = special ? tierSettings(tier, special) : aiDifficulty[tier];
    return tier;
}

// ========================================
// ANALYSE DU CONTEXTE DE COMBAT
// ========================================

export function analyzeBattleContext() {
    const context = {
        enemyHpPercent: enemy.hp / enemy.maxHp,
        playerHpPercent: player.hp / player.maxHp,
        enemyManaAvailable: Object.values(enemy.mana).reduce((sum, val) => sum + val, 0),
        playerManaAvailable: Object.values(player.mana).reduce((sum, val) => sum + val, 0),
        enemyCombatPoints: enemy.combatPoints,
        playerCombatPoints: player.combatPoints,
        isEnemyLowHealth: (enemy.hp / enemy.maxHp) < currentDifficulty.healThreshold,
        isPlayerVulnerable: (player.hp / player.maxHp) < currentDifficulty.aggressiveThreshold,
        hasWeapon: enemy.weapon !== null,
        hasUsableSpells: false,
        hasDamageSpells: false,
        hasHealSpells: false,
        hasBuffSpells: false,
        hasDebuffSpells: false
    };

    // Analyser les sorts disponibles
    if (enemy.spells && enemy.spells.length > 0) {
        for (const spell of enemy.spells) {
            if (canAffordSpell(spell)) {
                context.hasUsableSpells = true;
                if (spell.dmg) context.hasDamageSpells = true;
                if (spell.heal) context.hasHealSpells = true;
                if (spell.buff) context.hasBuffSpells = true;
                if (spell.debuff) context.hasDebuffSpells = true;
            }
        }
    }

    return context;
}

// ========================================
// ÉVALUATION DES SORTS
// ========================================

export function evaluateSpells() {
    const context = analyzeBattleContext();
    // un sort de soin n'a aucun intérêt quand l'ennemi est déjà à pleine vie
    const useableSpells = enemy.spells.filter(s => canAffordSpell(s) && !(s.heal && !s.dmg && enemy.hp >= enemy.maxHp));
    
    if (useableSpells.length === 0) {
        return null;
    }

    // Système de scoring pour chaque sort
    const scoredSpells = useableSpells.map(spell => {
        let score = 0;
        let reason = "";

        // SORTS DE SOIN - Priorité si en danger
        if (spell.heal) {
            if (context.isEnemyLowHealth) {
                score += 100; // Priorité maximale si HP bas
                reason = "soin critique";
            } else if (context.enemyHpPercent < 0.7) {
                score += 50;
                reason = "soin préventif";
            } else {
                score += 10;
                reason = "soin";
            }
        }

        // SORTS DE DÉGÂTS - Priorité si le joueur est vulnérable
        if (spell.dmg) {
            const potentialDamage = spell.dmg * (1 - (player.resistances && player.resistances[spell.color] || 0));
            
            if (context.isPlayerVulnerable) {
                score += 80; // Augmenter les dégâts si le joueur est faible
                reason = "finir le joueur";
            } else {
                score += 40;
                reason = "dégâts standards";
            }

            // Bonus si le sort peut tuer le joueur
            if (potentialDamage >= player.hp) {
                score += 200; // PRIORITÉ ABSOLUE
                reason = "coup fatal";
            }

            // Bonus pour les sorts puissants
            score += Math.floor(potentialDamage / 5);
        }

        // SORTS DE BUFF - Bonus en début de combat
        if (spell.buff) {
            score += 30;
            reason = "amélioration";
        }

        // SORTS DE DEBUFF - Priorité si le joueur est dangereux
        if (spell.debuff) {
            if (context.playerManaAvailable > 20) {
                score += 60; // Le joueur a beaucoup de qì, il faut le ralentir
                reason = "ralentir le joueur";
            } else {
                score += 20;
                reason = "affaiblissement";
            }
        }

        // Tendance de la personnalité (pondération bornée, jamais d'exclusion)
        score *= personalityWeight(enemy.personality, { type: 'spell', data: { spell, reason } }, context);

        // Ajustement aléatoire selon la difficulté
        if (!currentDifficulty.strategicThinking) {
            score = Math.random() * 100; // Choix aléatoire en mode facile
        } else {
            // Ajouter un facteur aléatoire pour éviter la prédictibilité
            score += Math.random() * 20;
        }

        return { spell, score, reason };
    });

    // Trier par score décroissant
    scoredSpells.sort((a, b) => b.score - a.score);

    return scoredSpells[0]; // Retourner le meilleur sort
}

// ========================================
// ÉVALUATION DE L'ARME
// ========================================

export function evaluateWeapon() {
    if (!enemy.weapon || enemy.combatPoints < enemy.weapon.actionPoints) {
        return null;
    }

    const context = analyzeBattleContext();
    let score = 0;
    let reason = "";

    // Dégâts de l'arme
    const weaponDamage = Math.floor((enemy.weapon.damage + (enemy.weaponPower || 0)) * (1 + (critChance(enemy) / 100) * (CRIT_MULTIPLIER - 1)) * (1 - (blockChance(player) / 100) * 0.7));   // dégâts espérés (critique, blocage)

    // Priorité si ça peut tuer le joueur
    if (weaponDamage >= player.hp) {
        score += 200;
        reason = "coup fatal";
    } else if (context.isPlayerVulnerable) {
        score += 70;
        reason = "joueur affaibli";
    } else {
        score += 40;
        reason = "attaque normale";
    }

    // Bonus pour les armes puissantes
    score += Math.floor(weaponDamage / 3);

    // Ajustement selon la difficulté
    if (!currentDifficulty.strategicThinking) {
        score = Math.random() * 100;
    } else {
        score += Math.random() * 15;
    }

    return { weapon: enemy.weapon, score, reason };
}

// ========================================
// ÉVALUATION DU PLATEAU
// ========================================

export function evaluateBoardMove() {
    // Le plateau est toujours une option, mais avec un score variable
    const context = analyzeBattleContext();
    let score = 30; // Score de base
    let reason = "gain de ressources";

    // Augmenter le score si l'ennemi a besoin de ressources
    if (context.enemyManaAvailable < 10) {
        score += 40;
        reason = "besoin de qì";
    }

    if (!context.hasUsableSpells && context.enemyCombatPoints < 5) {
        score += 50;
        reason = "besoin urgent de ressources";
    }

    // Ajustement selon la difficulté
    if (!currentDifficulty.strategicThinking) {
        score += Math.random() * 30;
    }

    return { score, reason };
}

// ========================================
// DÉCISION PRINCIPALE DE L'IA
// ========================================

export function makeDecision(rng = Math.random) {
    const difficulty = currentDifficulty;
    const context = analyzeBattleContext();

    // Temps de réflexion (plus court pour les ennemis de haut niveau)
    const thinkingTime = thinkingTimeFor(difficulty, enemy.level, rng);

    // Évaluer toutes les options disponibles (seules les actions réellement possibles sont proposées)
    const spellEval = evaluateSpells();
    const weaponEval = evaluateWeapon();
    const boardEval = evaluateBoardMove();

    const options = [];
    if (spellEval) options.push({ type: 'spell', data: spellEval, score: spellEval.score, probability: difficulty.spellUseProbability });
    if (weaponEval) options.push({ type: 'weapon', data: weaponEval, score: weaponEval.score, probability: difficulty.weaponUseProbability });
    options.push({ type: 'board', data: boardEval, score: boardEval.score, probability: difficulty.boardMoveProbability });

    let chosenOption;
    let isStupid = false;

    if (difficulty.stupidityChance > 0 && rng() < difficulty.stupidityChance) {
        // Coup stupide : l'IA ignore tout (personnalité comprise) et choisit au hasard parmi les actions valides
        isStupid = true;
        chosenOption = options[Math.floor(rng() * options.length)];
    } else {
        // Poids = probabilité du palier (qualité tactique) x tendance de la personnalité (style).
        // En mode stratégique, la personnalité « tactique » peut aussi suivre le meilleur score.
        const best = difficulty.strategicThinking ? options.reduce((a, b) => (b.score > a.score ? b : a)) : null;
        const ctx = { ...context, bestType: best?.type };
        for (const option of options) {
            option.weight = option.probability * personalityWeight(enemy.personality, option, ctx);
        }
        chosenOption = pickWeighted(options, rng);
    }

    return {
        action: chosenOption.type,
        data: chosenOption.data,
        thinkingTime: thinkingTime,
        reason: chosenOption.data.reason || "action tactique",
        isStupid,
        personality: enemy.personality || null,
        // Un coup stupide sur le plateau doit etre reellement aleatoire,
        // meme pour les difficultes qui restent strategiques.
        randomBoardMove: chosenOption.type === 'board' && (isStupid || difficulty.randomBoardMove)
    };
}

// ========================================
// UTILITAIRES
// ========================================

export function getAIStats() {
    return {
        difficulty: currentDifficulty.name,
        personality: enemy.personality || null,
        context: analyzeBattleContext(),
        availableActions: {
            canUseSpell: evaluateSpells() !== null,
            canUseWeapon: evaluateWeapon() !== null,
            canUseBoard: true
        }
    };
}

// Log détaillé de la décision (pour debug)
export function logDecision(decision) {
    console.log(`IA Décision:`, {
        action: decision.action,
        reason: decision.reason,
        score: decision.data.score,
        thinkingTime: decision.thinkingTime
    });
}

// Bibliothèque d'intelligence artificielle pour les ennemis
// Gère les décisions stratégiques et le comportement des ennemis en combat

import { player, enemy, canEntityCastSpell, getEnemyAttackDamageCap } from "./game.js";

// ========================================
// CONFIGURATION DES NIVEAUX D'IA
// ========================================

// Fonction helper mutualisee (joueur/ennemi) importee depuis game.js.
function canAffordSpell(spell) {
    return canEntityCastSpell(enemy, spell);
}

export const aiDifficulty = {
    easy: {
        name: "Facile",
        thinkingTimeMin: 300,
        thinkingTimeMax: 500,
        spellUseProbability: 0.20,      // 20% de chance d'utiliser un sort
        weaponUseProbability: 0.20,     // 20% de chance d'utiliser une arme
        boardMoveProbability: 0.60,     // 60% de chance de jouer sur le plateau
        strategicThinking: false,       // Ne calcule pas les meilleurs coups
        healThreshold: 0.3,             // Se soigne si HP < 30%
        aggressiveThreshold: 0.7,       // Devient agressif si joueur HP < 70%
        stupidityChance: 0.80,          // 80% de chance de faire un coup stupide
        randomBoardMove: true,          // Joue un swap aléatoire sur le plateau
    },
    normal: {
        name: "Normal",
        thinkingTimeMin: 300,
        thinkingTimeMax: 500,
        spellUseProbability: 0.25,
        weaponUseProbability: 0.25,
        boardMoveProbability: 0.50,
        strategicThinking: true,
        healThreshold: 0.4,
        aggressiveThreshold: 0.6,
        stupidityChance: 0.55,
        randomBoardMove: true,
    },
    hard: {
        name: "Difficile",
        thinkingTimeMin: 300,
        thinkingTimeMax: 500,
        spellUseProbability: 0.30,
        weaponUseProbability: 0.25,
        boardMoveProbability: 0.45,
        strategicThinking: true,
        healThreshold: 0.5,
        aggressiveThreshold: 0.5,
        stupidityChance: 0.35,
        randomBoardMove: true,
    },
    expert: {
        name: "Expert",
        thinkingTimeMin: 300,
        thinkingTimeMax: 500,
        spellUseProbability: 0.35,
        weaponUseProbability: 0.25,
        boardMoveProbability: 0.40,
        strategicThinking: true,
        healThreshold: 0.6,
        aggressiveThreshold: 0.4,
        stupidityChance: 0.20,
        randomBoardMove: true,
    }
};

// Difficulté par défaut
let currentDifficulty = aiDifficulty.normal;

// ========================================
// GESTION DE LA DIFFICULTÉ
// ========================================

export function setAIDifficulty(difficulty) {
    if (aiDifficulty[difficulty]) {
        currentDifficulty = aiDifficulty[difficulty];
        console.log(`🤖 Difficulté de l'IA définie sur: ${currentDifficulty.name}`);
    }
}

export function getAIDifficulty() {
    return currentDifficulty;
}

// Déterminer automatiquement la difficulté en fonction du niveau de l'ennemi
export function setAIDifficultyByLevel(enemyLevel, playerLevel) {
    const levelDifference = enemyLevel - playerLevel;
    
    // Ajuster la difficulté de base selon le niveau de l'ennemi
    let baseDifficulty;
    if (enemyLevel <= 3) {
        baseDifficulty = 'easy';
    } else if (enemyLevel <= 7) {
        baseDifficulty = 'normal';
    } else if (enemyLevel <= 12) {
        baseDifficulty = 'hard';
    } else {
        baseDifficulty = 'expert';
    }
    
    // Augmenter plus doucement la difficulté meme si l'ennemi depasse le joueur.
    // Objectif: conserver une IA imparfaite et plus permissive.
    if (levelDifference >= 3) {
        baseDifficulty = baseDifficulty === 'easy' ? 'normal' : 'hard';
    } else if (levelDifference >= 2) {
        baseDifficulty = baseDifficulty === 'easy' ? 'normal' : 'hard';
    } else if (levelDifference >= 1) {
        if (baseDifficulty === 'easy') baseDifficulty = 'normal';
        else if (baseDifficulty === 'normal') baseDifficulty = 'hard';
    }
    
    setAIDifficulty(baseDifficulty);
    console.log(`🎯 Niveau ennemi: ${enemyLevel}, Niveau joueur: ${playerLevel}, Difficulté IA: ${baseDifficulty}`);
    
    return baseDifficulty;
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
    const useableSpells = enemy.spells.filter(s => canAffordSpell(s));
    
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
            const cappedSpellDamage = Math.min(spell.dmg, getEnemyAttackDamageCap(enemy));
            const potentialDamage = cappedSpellDamage * (1 - (player.resistances && player.resistances[spell.color] || 0));
            
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
                score += 60; // Le joueur a beaucoup de mana, il faut le ralentir
                reason = "ralentir le joueur";
            } else {
                score += 20;
                reason = "affaiblissement";
            }
        }

        // Bonus basé sur le niveau de l'ennemi (plus il est fort, plus il est efficace)
        if (enemy.level >= 10) {
            score *= 1.1; // +10% d'efficacité
        }
        if (enemy.level >= 15) {
            score *= 1.15; // +15% d'efficacité supplémentaire
        }
        
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
    const weaponDamage = Math.min(enemy.weapon.damage + (enemy.attack || 0), getEnemyAttackDamageCap(enemy));

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
        reason = "besoin de mana";
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

export function makeDecision() {
    const difficulty = currentDifficulty;
    const context = analyzeBattleContext();
    
    // Temps de réflexion (réduit si l'ennemi a un niveau élevé)
    let thinkingTime = difficulty.thinkingTimeMin + 
                        Math.random() * (difficulty.thinkingTimeMax - difficulty.thinkingTimeMin);
    
    // Les ennemis de haut niveau réagissent plus vite
    if (enemy.level >= 10) {
        thinkingTime *= 0.7;
    } else if (enemy.level >= 15) {
        thinkingTime *= 0.5;
    }

    // Évaluer toutes les options disponibles
    const spellEval = evaluateSpells();
    const weaponEval = evaluateWeapon();
    const boardEval = evaluateBoardMove();

    const options = [];

    if (spellEval) {
        options.push({ 
            type: 'spell', 
            data: spellEval,
            score: spellEval.score,
            probability: difficulty.spellUseProbability
        });
    }

    if (weaponEval) {
        options.push({ 
            type: 'weapon', 
            data: weaponEval,
            score: weaponEval.score,
            probability: difficulty.weaponUseProbability
        });
    }

    options.push({ 
        type: 'board', 
        data: boardEval,
        score: boardEval.score,
        probability: difficulty.boardMoveProbability
    });

    // Choisir la meilleure option en tenant compte des probabilités
    let chosenOption;
    let isStupid = false;

    // Coup stupide : l'IA ignore la meilleure option et choisit au hasard
    if (difficulty.stupidityChance > 0 && Math.random() < difficulty.stupidityChance) {
        isStupid = true;
        chosenOption = options[Math.floor(Math.random() * options.length)];
    } else if (difficulty.strategicThinking) {
        // Mode stratégique: choisir la meilleure option avec un facteur de probabilité
        options.sort((a, b) => b.score - a.score);
        
        // Appliquer les probabilités comme modificateurs
        const rand = Math.random();
        let cumulative = 0;
        
        for (const option of options) {
            cumulative += option.probability;
            if (rand <= cumulative) {
                chosenOption = option;
                break;
            }
        }
        
        // Si aucune option n'a été choisie (ne devrait pas arriver), prendre la meilleure
        if (!chosenOption) {
            chosenOption = options[0];
        }
    } else {
        // Mode aléatoire (facile): choisir selon les probabilités pures
        const rand = Math.random();
        let cumulative = 0;
        
        for (const option of options) {
            cumulative += option.probability;
            if (rand <= cumulative) {
                chosenOption = option;
                break;
            }
        }
        
        if (!chosenOption) {
            chosenOption = options[options.length - 1];
        }
    }

    return {
        action: chosenOption.type,
        data: chosenOption.data,
        thinkingTime: thinkingTime,
        reason: chosenOption.data.reason || "action tactique",
        isStupid,
        // Un coup stupide sur le plateau doit etre reellement aleatoire,
        // meme pour les difficultes qui restent strategiques.
        randomBoardMove: chosenOption.type === 'board' && (isStupid || difficulty.randomBoardMove)
    };
}

// ========================================
// PERSONNALITÉS D'ENNEMIS
// ========================================

export const enemyPersonalities = {
    aggressive: {
        name: "Agressif",
        modifyDecision: (decision) => {
            // Préfère toujours l'attaque
            if (decision.action === 'board') {
                decision.score *= 0.5;
            }
            return decision;
        }
    },
    defensive: {
        name: "Défensif",
        modifyDecision: (decision) => {
            // Préfère se soigner et utiliser des buffs
            if (decision.action === 'spell' && decision.data.spell.heal) {
                decision.data.score *= 1.5;
            }
            return decision;
        }
    },
    tactical: {
        name: "Tactique",
        modifyDecision: (decision) => {
            // Équilibre entre attaque et défense
            return decision;
        }
    },
    reckless: {
        name: "Téméraire",
        modifyDecision: (decision) => {
            // Utilise ses ressources sans réfléchir
            if (decision.action === 'weapon' || decision.action === 'spell') {
                decision.data.score *= 1.3;
            }
            return decision;
        }
    },
    cunning: {
        name: "Rusé",
        modifyDecision: (decision) => {
            // Préfère les debuffs et les stratégies indirectes
            if (decision.action === 'spell' && decision.data.spell.debuff) {
                decision.data.score *= 1.4;
            }
            return decision;
        }
    }
};

// Assigner une personnalité à un ennemi
export function assignPersonality(enemyType) {
    const personalities = Object.keys(enemyPersonalities);
    const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    return randomPersonality;
}

// ========================================
// UTILITAIRES
// ========================================

export function getAIStats() {
    return {
        difficulty: currentDifficulty.name,
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
    console.log(`🤖 IA Décision:`, {
        action: decision.action,
        reason: decision.reason,
        score: decision.data.score,
        thinkingTime: decision.thinkingTime
    });
}

// Système d'ennemis avec différentes races et classes

// ========================================
// RACES ET CLASSES D'ENNEMIS
// ========================================

export const enemyRaces = {
    gobelin: {
        name: "Gobelin",
        emoji: "👹",
        classes: {
            thief: {
                name: "Voleur",
                statsModifiers: { hpMult: 0.8, atkMult: 1.1, defMult: 0.9 },
                spellTypes: ["red", "yellow"],
                spellPref: ["fireball", "bolt"]
            },
            scout: {
                name: "Éclaireur",
                statsModifiers: { hpMult: 0.85, atkMult: 1.05, defMult: 1.0 },
                spellTypes: ["yellow"],
                spellPref: ["bolt"]
            },
            shaman: {
                name: "Chaman",
                statsModifiers: { hpMult: 1.0, atkMult: 0.8, defMult: 1.1 },
                spellTypes: ["green", "blue"],
                spellPref: ["heal", "ice"]
            }
        }
    },

    orc: {
        name: "Orc",
        emoji: "👹",
        classes: {
            warrior: {
                name: "Guerrier",
                statsModifiers: { hpMult: 1.2, atkMult: 1.3, defMult: 1.0 },
                spellTypes: ["red"],
                spellPref: ["fireball"]
            },
            berserker: {
                name: "Berserker",
                statsModifiers: { hpMult: 1.15, atkMult: 1.4, defMult: 0.8 },
                spellTypes: ["red"],
                spellPref: ["fireball", "flameStrike"]
            },
            shaman: {
                name: "Chaman Orc",
                statsModifiers: { hpMult: 1.1, atkMult: 0.9, defMult: 1.1 },
                spellTypes: ["red", "green"],
                spellPref: ["heal", "fireball"]
            }
        }
    },

    troll: {
        name: "Troll",
        emoji: "👺",
        classes: {
            brute: {
                name: "Brute",
                statsModifiers: { hpMult: 1.4, atkMult: 1.2, defMult: 0.9 },
                spellTypes: ["red"],
                spellPref: []
            },
            regenerator: {
                name: "Régénérateur",
                statsModifiers: { hpMult: 1.5, atkMult: 0.9, defMult: 1.2 },
                spellTypes: ["green"],
                spellPref: ["heal", "greatHeal"]
            },
            mage: {
                name: "Mage Troll",
                statsModifiers: { hpMult: 1.1, atkMult: 0.7, defMult: 1.3 },
                spellTypes: ["blue", "yellow"],
                spellPref: ["ice", "bolt", "blizzard"]
            }
        }
    },

    vampire: {
        name: "Vampire",
        emoji: "🧛",
        classes: {
            aristocrat: {
                name: "Aristocrate",
                statsModifiers: { hpMult: 1.2, atkMult: 1.2, defMult: 1.1 },
                spellTypes: ["red", "blue"],
                spellPref: ["fireball", "ice"]
            },
            nightblade: {
                name: "Lame de Nuit",
                statsModifiers: { hpMult: 1.0, atkMult: 1.35, defMult: 1.0 },
                spellTypes: ["red", "yellow"],
                spellPref: ["bolt", "flameStrike"]
            },
            bloodmagus: {
                name: "Mage du Sang",
                statsModifiers: { hpMult: 1.15, atkMult: 1.1, defMult: 1.1 },
                spellTypes: ["red", "blue", "green"],
                spellPref: ["fireball", "ice", "heal"]
            }
        }
    },

    dragon: {
        name: "Dragon",
        emoji: "🐉",
        classes: {
            youngDrake: {
                name: "Jeune Dragon",
                statsModifiers: { hpMult: 2.0, atkMult: 1.8, defMult: 1.2 },
                spellTypes: ["red", "yellow"],
                spellPref: ["meteor", "lightningStorm"]
            },
            frostDrake: {
                name: "Dragon Glacé",
                statsModifiers: { hpMult: 1.9, atkMult: 1.7, defMult: 1.3 },
                spellTypes: ["blue"],
                spellPref: ["blizzard", "iceAge"]
            },
            ancientDragon: {
                name: "Dragon Ancien",
                statsModifiers: { hpMult: 2.5, atkMult: 2.0, defMult: 1.5 },
                spellTypes: ["red", "blue", "yellow"],
                spellPref: ["meteor", "blizzard", "lightningStorm"]
            }
        }
    },

    skeleton: {
        name: "Squelette",
        emoji: "💀",
        classes: {
            archer: {
                name: "Archer",
                statsModifiers: { hpMult: 0.9, atkMult: 1.15, defMult: 0.8 },
                spellTypes: ["yellow"],
                spellPref: ["bolt"]
            },
            mage: {
                name: "Mage",
                statsModifiers: { hpMult: 0.85, atkMult: 0.7, defMult: 0.9 },
                spellTypes: ["blue", "green"],
                spellPref: ["ice", "heal"]
            },
            knight: {
                name: "Chevalier",
                statsModifiers: { hpMult: 1.2, atkMult: 1.1, defMult: 1.3 },
                spellTypes: ["red"],
                spellPref: ["fireball"]
            }
        }
    },

    demon: {
        name: "Démon",
        emoji: "👿",
        classes: {
            hellknight: {
                name: "Chevalier Infernal",
                statsModifiers: { hpMult: 1.3, atkMult: 1.4, defMult: 1.2 },
                spellTypes: ["red"],
                spellPref: ["fireball", "flameStrike", "inferno"]
            },
            sorcerer: {
                name: "Sorcier",
                statsModifiers: { hpMult: 1.1, atkMult: 1.0, defMult: 1.1 },
                spellTypes: ["red", "blue", "yellow"],
                spellPref: ["meteor", "bolt", "fireball"]
            },
            servant: {
                name: "Serviteur",
                statsModifiers: { hpMult: 0.95, atkMult: 1.1, defMult: 1.0 },
                spellTypes: ["red"],
                spellPref: ["fireball"]
            }
        }
    }
};

// ========================================
// SÉLECTION ALÉATOIRE D'ENNEMI
// ========================================

export function generateRandomEnemy(playerLevel, allSpells) {
    // Sélectionner une race aléatoire
    const races = Object.values(enemyRaces);
    const race = races[Math.floor(Math.random() * races.length)];
    
    // Sélectionner une classe aléatoire de cette race
    const classKeys = Object.keys(race.classes);
    const classKey = classKeys[Math.floor(Math.random() * classKeys.length)];
    const enemyClass = race.classes[classKey];
    
    return createEnemy(race, enemyClass, playerLevel, allSpells);
}

export function createEnemy(race, enemyClass, playerLevel, allSpells) {
    // Calcul des stats de base
    const baseHp = 40 + playerLevel * 10;
    const baseAtk = 5 + playerLevel * 4;
    
    // Appliquer les modificateurs de classe
    const hp = Math.floor(baseHp * enemyClass.statsModifiers.hpMult);
    const atk = Math.floor(baseAtk * enemyClass.statsModifiers.atkMult);
    
    // Générer les résistances
    const colors = ["red", "blue", "green", "yellow"];
    const resistances = {};
    colors.forEach(c => {
        resistances[c] = Math.min(0.3, Math.random() * 0.1 * playerLevel);
    });
    
    // Sélectionner les sorts en fonction de la classe
    const availableSpells = allSpells.filter(sp => playerLevel >= sp.minLevel);
    const selectedSpells = [];
    
    // Ajouter les sorts préférés de la classe (si disponibles)
    enemyClass.spellPref.forEach(spellId => {
        const spell = availableSpells.find(s => s.id === spellId);
        if(spell) {
            selectedSpells.push(spell);
        }
    });
    
    // Remplir avec des sorts du même type de couleur
    while(selectedSpells.length < 2 + Math.floor(playerLevel / 5)) {
        const colorPref = enemyClass.spellTypes[Math.floor(Math.random() * enemyClass.spellTypes.length)];
        const spellsOfColor = availableSpells.filter(s => 
            s.color === colorPref && 
            !selectedSpells.find(ss => ss.id === s.id)
        );
        if(spellsOfColor.length === 0) break;
        selectedSpells.push(spellsOfColor[Math.floor(Math.random() * spellsOfColor.length)]);
    }
    
    // Initialiser le mana de l'ennemi
    const enemyMana = { 
        red: 15 + playerLevel * 2, 
        blue: 15 + playerLevel * 2, 
        green: 15 + playerLevel * 2, 
        yellow: 15 + playerLevel * 2 
    };
    
    // Créer l'objet ennemi
    const enemy = {
        race: race.name,
        raceEmoji: race.emoji,
        class: enemyClass.name,
        name: `${race.name} ${enemyClass.name}`,
        hp: hp,
        maxHp: hp,
        attack: atk,
        resistances: resistances,
        combatPoints: 0,
        mana: enemyMana,
        spells: selectedSpells,
        level: playerLevel
    };
    
    return enemy;
}

// ========================================
// DESCRIPTIONS POUR L'AFFICHAGE
// ========================================

export function getEnemyDescription(enemy) {
    return `${enemy.raceEmoji} ${enemy.name}`;
}

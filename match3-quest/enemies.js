// Système d'ennemis avec différentes races et classes

import { allWeapons } from "./weapons.js";
import { getSpellsByClass, getAllSpells } from "./spells.js";

// ========================================
// RACES ET CLASSES D'ENNEMIS
// ========================================

export const enemyRaces = {
    gobelin: {
        name: "Gobelin",
        emoji: "👹",
        classes: {
            assassin: {
                playerClass: 'assassin',
                name: "Voleur",
                statsModifiers: { hpMult: 0.8, atkMult: 1.1, defMult: 0.9 },
                hasWeapon: true
            },
            assassin2: {
                playerClass: 'assassin',
                name: "Éclaireur",
                statsModifiers: { hpMult: 0.85, atkMult: 1.05, defMult: 1.0 },
                hasWeapon: true
            },
            sorcerer: {
                playerClass: 'sorcerer',
                name: "Chaman",
                statsModifiers: { hpMult: 1.0, atkMult: 0.8, defMult: 1.1 },
                hasWeapon: false
            }
        }
    },

    orc: {
        name: "Orc",
        emoji: "👹",
        classes: {
            barbarian: {
                playerClass: 'barbarian',
                name: "Guerrier",
                statsModifiers: { hpMult: 1.2, atkMult: 1.3, defMult: 1.0 },
                hasWeapon: true
            },
            barbarian2: {
                playerClass: 'barbarian',
                name: "Berserker",
                statsModifiers: { hpMult: 1.15, atkMult: 1.4, defMult: 0.8 },
                hasWeapon: true
            },
            templar: {
                playerClass: 'templar',
                name: "Chaman",
                statsModifiers: { hpMult: 1.1, atkMult: 0.9, defMult: 1.1 },
                hasWeapon: false
            }
        }
    },

    troll: {
        name: "Troll",
        emoji: "👺",
        classes: {
            barbarian: {
                playerClass: 'barbarian',
                name: "Brute",
                statsModifiers: { hpMult: 1.4, atkMult: 1.2, defMult: 0.9 },
                hasWeapon: true
            },
            templar: {
                playerClass: 'templar',
                name: "Régénérateur",
                statsModifiers: { hpMult: 1.5, atkMult: 0.9, defMult: 1.2 },
                hasWeapon: false
            },
            sorcerer: {
                playerClass: 'sorcerer',
                name: "Mage",
                statsModifiers: { hpMult: 1.1, atkMult: 0.7, defMult: 1.3 },
                hasWeapon: false
            }
        }
    },

    vampire: {
        name: "Vampire",
        emoji: "🧛",
        classes: {
            sorcerer: {
                playerClass: 'sorcerer',
                name: "Aristocrate",
                statsModifiers: { hpMult: 1.2, atkMult: 1.2, defMult: 1.1 },
                hasWeapon: false
            },
            assassin: {
                playerClass: 'assassin',
                name: "Lame de Nuit",
                statsModifiers: { hpMult: 1.0, atkMult: 1.35, defMult: 1.0 },
                hasWeapon: true
            },
            sorcerer2: {
                playerClass: 'sorcerer',
                name: "Mage du Sang",
                statsModifiers: { hpMult: 1.15, atkMult: 1.1, defMult: 1.1 },
                hasWeapon: false
            }
        }
    },

    dragon: {
        name: "Dragon",
        emoji: "🐉",
        classes: {
            sorcerer: {
                playerClass: 'sorcerer',
                name: "Jeune",
                statsModifiers: { hpMult: 2.0, atkMult: 1.8, defMult: 1.2 },
                hasWeapon: false
            },
            sorcerer2: {
                playerClass: 'sorcerer',
                name: "Glacé",
                statsModifiers: { hpMult: 1.9, atkMult: 1.7, defMult: 1.3 },
                hasWeapon: false
            },
            sorcerer3: {
                playerClass: 'sorcerer',
                name: "Ancien",
                statsModifiers: { hpMult: 2.5, atkMult: 2.0, defMult: 1.5 },
                hasWeapon: false
            }
        }
    },

    skeleton: {
        name: "Squelette",
        emoji: "💀",
        classes: {
            assassin: {
                playerClass: 'assassin',
                name: "Archer",
                statsModifiers: { hpMult: 0.9, atkMult: 1.15, defMult: 0.8 },
                hasWeapon: true
            },
            sorcerer: {
                playerClass: 'sorcerer',
                name: "Mage",
                statsModifiers: { hpMult: 0.85, atkMult: 0.7, defMult: 0.9 },
                hasWeapon: false
            },
            templar: {
                playerClass: 'templar',
                name: "Chevalier",
                statsModifiers: { hpMult: 1.2, atkMult: 1.1, defMult: 1.3 },
                hasWeapon: true
            }
        }
    },

    demon: {
        name: "Démon",
        emoji: "👿",
        classes: {
            barbarian: {
                playerClass: 'barbarian',
                name: "Chevalier Infernal",
                statsModifiers: { hpMult: 1.3, atkMult: 1.4, defMult: 1.2 },
                hasWeapon: true
            },
            sorcerer: {
                playerClass: 'sorcerer',
                name: "Sorcier",
                statsModifiers: { hpMult: 1.1, atkMult: 1.0, defMult: 1.1 },
                hasWeapon: false
            },
            templar: {
                playerClass: 'templar',
                name: "Serviteur",
                statsModifiers: { hpMult: 0.95, atkMult: 1.1, defMult: 1.0 },
                hasWeapon: true
            }
        }
    }
};

// ========================================
// SÉLECTION ALÉATOIRE D'ENNEMI
// ========================================

export function generateRandomEnemy(playerLevel, allSpells, allWeapons) {
    // Sélectionner une race aléatoire
    const races = Object.values(enemyRaces);
    const race = races[Math.floor(Math.random() * races.length)];
    
    // Sélectionner une classe aléatoire de cette race
    const classKeys = Object.keys(race.classes);
    const classKey = classKeys[Math.floor(Math.random() * classKeys.length)];
    const enemyClass = race.classes[classKey];
    
    // Déterminer le niveau de l'ennemi (égal ou supérieur au joueur)
    // 50% de chance d'avoir le même niveau
    // 30% de chance d'avoir +1 niveau
    // 15% de chance d'avoir +2 niveaux
    // 5% de chance d'avoir +3 niveaux
    const rand = Math.random();
    let enemyLevel = playerLevel;
    if (rand < 0.05) {
        enemyLevel = playerLevel + 3;
    } else if (rand < 0.20) {
        enemyLevel = playerLevel + 2;
    } else if (rand < 0.50) {
        enemyLevel = playerLevel + 1;
    }
    
    return createEnemy(race, enemyClass, enemyLevel, allSpells, allWeapons);
}

export function createEnemy(race, enemyClass, enemyLevel, allSpells, allWeapons) {
    // Calcul des stats de base (basé sur le niveau de l'ennemi)
    const baseHp = 40 + enemyLevel * 10;
    const baseAtk = 5 + enemyLevel * 4;
    
    // Appliquer les modificateurs de classe
    const hp = Math.floor(baseHp * enemyClass.statsModifiers.hpMult);
    const atk = Math.floor(baseAtk * enemyClass.statsModifiers.atkMult);
    
    // Générer les résistances
    const colors = ["red", "blue", "green", "yellow"];
    const resistances = {};
    colors.forEach(c => {
        resistances[c] = Math.min(0.3, Math.random() * 0.1 * enemyLevel);
    });
    
    // Sélectionner une arme en fonction du niveau et de la classe
    let enemyWeapon = null;
    if(enemyClass.hasWeapon !== false) {
        // Par défaut, la classe a une arme (hasWeapon = true ou undefined)
        const availableWeapons = allWeapons.filter(w => w.minLevel <= enemyLevel);
        if(availableWeapons.length > 0) {
            enemyWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        }
    }
    
    // Obtenir les sorts de classe disponibles pour le niveau de l'ennemi
    // Utilise le même système que le joueur via getSpellsByClass
    const playerClass = enemyClass.playerClass;
    const classSpells = getSpellsByClass(playerClass, enemyLevel);
    
    // Également inclure les sorts génériques (ceux disponibles par couleur)
    const genericSpells = getAllSpells().filter(sp => 
        enemyLevel >= sp.minLevel && 
        !sp.class // Sorts qui n'ont pas de classe = sorts génériques
    );
    
    // Combiner les sorts de classe et génériques
    const availableSpells = [...classSpells, ...genericSpells];
    const selectedSpells = [];
    
    // Calculer le nombre de sorts souhaités : au minimum 2, augmente avec le niveau
    // Niveau 1-4: 2-3 sorts, Niveau 5-9: 3-4 sorts, Niveau 10+: 4+ sorts
    const minSpells = 2;
    const targetSpellCount = Math.max(minSpells, 2 + Math.floor(enemyLevel / 3));
    
    // Prioriser les sorts de classe (70% de chance)
    while(selectedSpells.length < targetSpellCount && availableSpells.length > 0) {
        const useClassSpell = Math.random() < 0.7 && classSpells.length > 0;
        const sourceSpells = useClassSpell ? classSpells : availableSpells;
        
        // Filtrer les sorts déjà sélectionnés
        const remainingSpells = sourceSpells.filter(s => 
            !selectedSpells.find(ss => ss.id === s.id)
        );
        
        if(remainingSpells.length === 0) {
            // Si plus de sorts dans cette source, essayer l'autre
            const alternateSpells = availableSpells.filter(s => 
                !selectedSpells.find(ss => ss.id === s.id)
            );
            if(alternateSpells.length === 0) break;
            selectedSpells.push(alternateSpells[Math.floor(Math.random() * alternateSpells.length)]);
        } else {
            selectedSpells.push(remainingSpells[Math.floor(Math.random() * remainingSpells.length)]);
        }
    }
    
    // Garantir au moins 1 sort de classe si possible
    if(selectedSpells.length > 0 && !selectedSpells.some(s => s.class === playerClass) && classSpells.length > 0) {
        // Remplacer un sort aléatoire par un sort de classe
        selectedSpells[Math.floor(Math.random() * selectedSpells.length)] = 
            classSpells[Math.floor(Math.random() * classSpells.length)];
    }
    
    // Initialiser le mana de l'ennemi à 0 (sera ajouté par les aptitudes si besoin)
    const enemyMana = { 
        red: 0, 
        blue: 0, 
        green: 0, 
        yellow: 0,
        purple: 0
    };
    
    // Donner aléatoirement des aptitudes à l'ennemi (20% de chance par aptitude)
    const enemyAbilities = [];
    if(Math.random() < 0.2) enemyAbilities.push('fireAffinity');
    if(Math.random() < 0.2) enemyAbilities.push('iceAffinity');
    if(Math.random() < 0.2) enemyAbilities.push('natureAffinity');
    if(Math.random() < 0.2) enemyAbilities.push('stormAffinity');
    
    // Créer l'objet ennemi
    const enemy = {
        race: race.name,
        raceEmoji: race.emoji,
        class: enemyClass.name,
        playerClass: enemyClass.playerClass, // Classe du joueur (sorcerer, assassin, etc.)
        name: `${race.name} ${enemyClass.name}`,
        hp: hp,
        maxHp: hp,
        attack: atk,
        resistances: resistances,
        combatPoints: 0,
        mana: enemyMana,
        spells: selectedSpells,
        weapon: enemyWeapon,
        level: enemyLevel,
        abilities: enemyAbilities
    };
    
    return enemy;
}

// ========================================
// DESCRIPTIONS POUR L'AFFICHAGE
// ========================================

export function getEnemyDescription(enemy) {
    return `${enemy.raceEmoji} ${enemy.name}`;
}

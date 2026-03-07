// Système de classes de personnages avec sorts spécialisés
import { 
    sorcererSpells, 
    assassinSpells, 
    templarSpells, 
    barbarianSpells,
    allClassSpells 
} from './spells.js';

// Classes disponibles
export const playerClasses = {
    sorcerer: {
        id: 'sorcerer',
        name: 'Sorcier',
        emoji: '🧙',
        description: 'Maître des arcanes, manipule le mana et les éléments',
        startingStats: { intelligence: 2, stamina: 0 }
    },
    assassin: {
        id: 'assassin',
        name: 'Assassin',
        emoji: '🗡️',
        description: 'Expert en attaques furtives et rapides',
        startingStats: { agility: 2, strength: 1 }
    },
    templar: {
        id: 'templar',
        name: 'Templier',
        emoji: '🛡️',
        description: 'Gardien défensif avec une grande résilience',
        startingStats: { stamina: 2, morale: 1 }
    },
    barbarian: {
        id: 'barbarian',
        name: 'Barbare',
        emoji: '🪓',
        description: 'Guerrier brutal avec une force dévastatrice',
        startingStats: { strength: 3 }
    }
};

// Exports des sorts de classe (importés depuis spells.js)
export { 
    sorcererSpells, 
    assassinSpells, 
    templarSpells, 
    barbarianSpells,
    allClassSpells 
};

// Obtenir les sorts disponibles pour une classe donnée
export function getClassSpells(className, playerLevel) {
    return allClassSpells.filter(spell => 
        spell.class === className && playerLevel >= spell.minLevel
    );
}

// Obtenir toutes les classes disponibles
export function getAllClasses() {
    return Object.values(playerClasses);
}

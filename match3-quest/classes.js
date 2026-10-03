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
        name: 'Maître taoïste',
        emoji: '☯️',
        description: 'Hou Yi sur la voie du Tao : talismans, qi et éléments au service de son arc',
        startingStats: { intelligence: 2, stamina: 0 },
        startingWeaponId: 'wooden_staff'
    },
    assassin: {
        id: 'assassin',
        name: 'Archer céleste',
        emoji: '🏹',
        description: 'Hou Yi, l\'archer divin : tirs rapides, flèches précises et coups furtifs',
        startingStats: { agility: 2, strength: 1 },
        startingWeaponId: 'bronze_dagger'
    },
    templar: {
        id: 'templar',
        name: 'Garde impérial',
        emoji: '🛡️',
        description: 'Hou Yi en armure laquée, rempart de l\'empire à la résilience sans faille',
        startingStats: { stamina: 2, morale: 1 },
        startingWeaponId: 'rusty_sword'
    },
    barbarian: {
        id: 'barbarian',
        name: 'Guerrier des steppes',
        emoji: '🪓',
        description: 'Hou Yi en fourrures, guerrier du Nord à la force dévastatrice',
        startingStats: { strength: 3 },
        startingWeaponId: 'wood_axe'
    }
};

// Arme de départ par défaut pour un joueur sans classe ("Sans classe")
export const DEFAULT_STARTING_WEAPON_ID = 'rusty_sword';

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

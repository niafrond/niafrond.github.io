// Bibliothèque complète des armes du jeu

// Types d'armes
export const WeaponType = {
    SWORD: 'sword',
    AXE: 'axe',
    DAGGER: 'dagger',
    MACE: 'mace',
    BOW: 'bow',
    STAFF: 'staff'
};

// Rareté des armes
export const WeaponRarity = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    LEGENDARY: 'legendary'
};

// Définition de toutes les armes disponibles dans le jeu
export const allWeapons = [
    // === SABRES ET ÉPÉES ===
    {
        id: "rusty_sword",
        name: "Sabre Dao Rouillé",
        type: WeaponType.SWORD,
        damage: 10,
        actionPoints: 3,
        minLevel: 1,
        rarity: WeaponRarity.COMMON,
        twoHanded: false,
        description: "Un vieux sabre dao rouillé mais toujours tranchant"
    },
    {
        id: "iron_sword",
        name: "Sabre Dao de Fer",
        type: WeaponType.SWORD,
        damage: 20,
        actionPoints: 4,
        minLevel: 3,
        rarity: WeaponRarity.COMMON,
        twoHanded: false,
        description: "Un sabre dao solide en fer forgé"
    },
    {
        id: "steel_sword",
        name: "Épée Jian d'Acier",
        type: WeaponType.SWORD,
        damage: 35,
        actionPoints: 5,
        minLevel: 7,
        rarity: WeaponRarity.UNCOMMON,
        twoHanded: false,
        description: "Une épée jian d'acier trempé, fine et précise"
    },
    {
        id: "dragon_sword",
        name: "Jian du Dragon-Long",
        type: WeaponType.SWORD,
        damage: 60,
        actionPoints: 6,
        minLevel: 12,
        rarity: WeaponRarity.RARE,
        twoHanded: false,
        description: "Une épée légendaire forgée dans le souffle d'un dragon-long"
    },
    {
        id: "excalibur",
        name: "Épée Xuanyuan",
        type: WeaponType.SWORD,
        damage: 100,
        actionPoints: 7,
        minLevel: 18,
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: false,
        description: "L'épée mythique de l'Empereur Jaune, brillante d'une lumière divine"
    },

    // === HACHES ET HALLEBARDES ===
    {
        id: "wood_axe",
        name: "Hachette de Bûcheron",
        type: WeaponType.AXE,
        damage: 15,
        actionPoints: 4,
        minLevel: 1,
        description: "Une hachette simple utilisée pour couper le bambou... et les ennemis"
    },
    {
        id: "battle_axe",
        name: "Hache des Steppes",
        type: WeaponType.AXE,
        damage: 30,
        actionPoints: 5,
        minLevel: 5,
        twoHanded: true,
        description: "Une lourde hache de bataille à deux mains, prisée des cavaliers du Nord"
    },
    {
        id: "great_axe",
        name: "Guandao de Guerre",
        type: WeaponType.AXE,
        damage: 50,
        actionPoints: 6,
        minLevel: 10,
        twoHanded: true,
        description: "Une hallebarde à large lame courbe qui peut fendre un ennemi en deux"
    },
    {
        id: "executioner_axe",
        name: "Hache du Bourreau Impérial",
        type: WeaponType.AXE,
        damage: 80,
        actionPoints: 7,
        minLevel: 15,
        twoHanded: true,
        description: "Une hache terrifiante qui glace le sang des ennemis"
    },

    // === POIGNARDS ===
    {
        id: "bronze_dagger",
        name: "Poignard de Bronze",
        type: WeaponType.DAGGER,
        damage: 8,
        actionPoints: 2,
        minLevel: 1,
        description: "Un poignard de bronze léger et rapide"
    },
    {
        id: "silver_dagger",
        name: "Poignard d'Argent",
        type: WeaponType.DAGGER,
        damage: 11,
        actionPoints: 2,
        minLevel: 4,
        description: "Un poignard élégant en argent pur"
    },
    {
        id: "poisoned_dagger",
        name: "Poignard Empoisonné",
        type: WeaponType.DAGGER,
        damage: 25,
        actionPoints: 3,
        minLevel: 8,
        description: "Un poignard enduit d'un venin mortel"
    },
    {
        id: "shadow_blade",
        name: "Lame du Voile Noir",
        type: WeaponType.DAGGER,
        damage: 45,
        actionPoints: 4,
        minLevel: 13,
        description: "Un poignard forgé dans les ténèbres, presque invisible"
    },

    // === MASSES ===
    {
        id: "club",
        name: "Gourdin de Bois Dur",
        type: WeaponType.MACE,
        damage: 12,
        actionPoints: 3,
        minLevel: 1,
        description: "Un simple gourdin en bois dur"
    },
    {
        id: "mace",
        name: "Masse à Pointes",
        type: WeaponType.MACE,
        damage: 25,
        actionPoints: 4,
        minLevel: 6,
        description: "Une masse hérissée de pointes acérées"
    },
    {
        id: "war_hammer",
        name: "Marteau de Forge",
        type: WeaponType.MACE,
        damage: 45,
        actionPoints: 5,
        minLevel: 11,
        description: "Un marteau lourd capable de briser les armures"
    },
    {
        id: "thor_hammer",
        name: "Marteau de Lei Gong",
        type: WeaponType.MACE,
        damage: 75,
        actionPoints: 6,
        minLevel: 16,
        description: "Le marteau du Seigneur du Tonnerre, chargé d'énergie électrique"
    },

    // === ARCS ===
    {
        id: "short_bow",
        name: "Arc Court de Pêcher",
        type: WeaponType.BOW,
        damage: 10,
        actionPoints: 2,
        minLevel: 2,
        description: "Un petit arc en bois de pêcher, qui chasse les mauvais esprits"
    },
    {
        id: "long_bow",
        name: "Arc Long de Bambou",
        type: WeaponType.BOW,
        damage: 20,
        actionPoints: 3,
        minLevel: 5,
        twoHanded: true,
        description: "Un arc long de bambou avec une portée impressionnante"
    },
    {
        id: "composite_bow",
        name: "Arc Composite de Corne",
        type: WeaponType.BOW,
        damage: 35,
        actionPoints: 4,
        minLevel: 9,
        twoHanded: true,
        description: "Un arc de corne et de tendon, puissant et précis"
    },
    {
        id: "elven_bow",
        name: "Arc Rouge Céleste",
        type: WeaponType.BOW,
        damage: 52,
        actionPoints: 4,
        minLevel: 14,
        twoHanded: true,
        description: "Le grand arc rouge de l'archer divin, qui ne manque jamais sa cible"
    },

    // === BÂTONS ===
    {
        id: "wooden_staff",
        name: "Bâton de Bambou",
        type: WeaponType.STAFF,
        damage: 8,
        actionPoints: 2,
        minLevel: 1,
        description: "Un simple bâton de bambou"
    },
    {
        id: "magic_staff",
        name: "Bâton à Talisman",
        type: WeaponType.STAFF,
        damage: 18,
        actionPoints: 3,
        minLevel: 4,
        description: "Un bâton orné d'un talisman, imprégné de qi"
    },
    {
        id: "archmage_staff",
        name: "Bâton du Maître Taoïste",
        type: WeaponType.STAFF,
        damage: 40,
        actionPoints: 4,
        minLevel: 10,
        description: "Le bâton d'un grand maître taoïste, pulsant de pouvoir"
    },
    {
        id: "staff_of_power",
        name: "Bâton de l'Immortel",
        type: WeaponType.STAFF,
        damage: 65,
        actionPoints: 5,
        minLevel: 15,
        description: "Un bâton légendaire qui amplifie toute magie"
    }
];

/**
 * Ajoute les attributs par défaut aux armes (pour rétro-compatibilité)
 * @param {Object} weapon - L'arme à normaliser
 * @returns {Object} L'arme avec tous les attributs
 */
export function normalizeWeapon(weapon) {
    if (!weapon) return null;

    return {
        ...weapon,
        rarity: weapon.rarity || WeaponRarity.COMMON,
        twoHanded: weapon.twoHanded !== undefined ? weapon.twoHanded : false
    };
}

// Normaliser toutes les armes au chargement
allWeapons.forEach((weapon, index) => {
    allWeapons[index] = normalizeWeapon(weapon);
});

// Fonction pour obtenir les armes disponibles selon le niveau du joueur
export function getAvailableWeapons(playerLevel) {
    return allWeapons.filter(weapon => weapon.minLevel <= playerLevel);
}

// Fonction pour obtenir une arme par son ID
export function getWeaponById(id) {
    const weapon = allWeapons.find(weapon => weapon.id === id);
    return weapon ? normalizeWeapon(weapon) : null;
}

// Fonction pour obtenir les armes par type
export function getWeaponsByType(type) {
    return allWeapons.filter(weapon => weapon.type === type).map(normalizeWeapon);
}

// Rareté « de boutique » d'une arme : son rang dans sa famille (la plus faible = commune, la 4e et au-delà = légendaire).
const RANK_RARITY = ['common', 'uncommon', 'rare', 'legendary'];
export function weaponRarity(weapon) {
    const family = allWeapons.filter(w => w.type === weapon.type).sort((a, b) => a.minLevel - b.minLevel);
    return RANK_RARITY[Math.min(family.findIndex(w => w.id === weapon.id), RANK_RARITY.length - 1)] || 'common';
}

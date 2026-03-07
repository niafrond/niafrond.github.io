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

// Définition de toutes les armes disponibles dans le jeu
export const allWeapons = [
    // === ÉPÉES ===
    {
        id: "rusty_sword",
        name: "Épée Rouillée",
        type: WeaponType.SWORD,
        damage: 10,
        actionPoints: 3,
        minLevel: 1,
        description: "Une vieille épée rouillée mais toujours fonctionnelle"
    },
    {
        id: "iron_sword",
        name: "Épée de Fer",
        type: WeaponType.SWORD,
        damage: 20,
        actionPoints: 4,
        minLevel: 3,
        description: "Une épée solide en fer forgé"
    },
    {
        id: "steel_sword",
        name: "Épée d'Acier",
        type: WeaponType.SWORD,
        damage: 35,
        actionPoints: 5,
        minLevel: 7,
        description: "Une épée d'acier trempé, aiguisée avec précision"
    },
    {
        id: "dragon_sword",
        name: "Épée du Dragon",
        type: WeaponType.SWORD,
        damage: 60,
        actionPoints: 6,
        minLevel: 12,
        description: "Une épée légendaire forgée dans le souffle d'un dragon"
    },
    {
        id: "excalibur",
        name: "Excalibur",
        type: WeaponType.SWORD,
        damage: 100,
        actionPoints: 7,
        minLevel: 18,
        description: "L'épée mythique des rois, brillante d'une lumière divine"
    },

    // === HACHES ===
    {
        id: "wood_axe",
        name: "Hache de Bois",
        type: WeaponType.AXE,
        damage: 15,
        actionPoints: 4,
        minLevel: 1,
        description: "Une hache simple utilisée pour couper du bois... et des ennemis"
    },
    {
        id: "battle_axe",
        name: "Hache de Guerre",
        type: WeaponType.AXE,
        damage: 30,
        actionPoints: 5,
        minLevel: 5,
        description: "Une lourde hache de bataille à deux mains"
    },
    {
        id: "great_axe",
        name: "Grande Hache",
        type: WeaponType.AXE,
        damage: 50,
        actionPoints: 6,
        minLevel: 10,
        description: "Une hache massive qui peut fendre un ennemi en deux"
    },
    {
        id: "executioner_axe",
        name: "Hache du Bourreau",
        type: WeaponType.AXE,
        damage: 80,
        actionPoints: 7,
        minLevel: 15,
        description: "Une hache terrifiante qui inspire la peur dans le cœur des ennemis"
    },

    // === DAGUES ===
    {
        id: "bronze_dagger",
        name: "Dague de Bronze",
        type: WeaponType.DAGGER,
        damage: 8,
        actionPoints: 2,
        minLevel: 1,
        description: "Une dague légère et rapide"
    },
    {
        id: "silver_dagger",
        name: "Dague d'Argent",
        type: WeaponType.DAGGER,
        damage: 15,
        actionPoints: 2,
        minLevel: 4,
        description: "Une dague élégante en argent pur"
    },
    {
        id: "poisoned_dagger",
        name: "Dague Empoisonnée",
        type: WeaponType.DAGGER,
        damage: 25,
        actionPoints: 3,
        minLevel: 8,
        description: "Une dague enduite d'un poison mortel"
    },
    {
        id: "shadow_blade",
        name: "Lame d'Ombre",
        type: WeaponType.DAGGER,
        damage: 45,
        actionPoints: 3,
        minLevel: 13,
        description: "Une dague forgée dans les ténèbres, presque invisible"
    },

    // === MASSES ===
    {
        id: "club",
        name: "Gourdin",
        type: WeaponType.MACE,
        damage: 12,
        actionPoints: 3,
        minLevel: 1,
        description: "Un simple gourdin en bois dur"
    },
    {
        id: "mace",
        name: "Masse d'Armes",
        type: WeaponType.MACE,
        damage: 25,
        actionPoints: 4,
        minLevel: 6,
        description: "Une masse hérissée de pointes acérées"
    },
    {
        id: "war_hammer",
        name: "Marteau de Guerre",
        type: WeaponType.MACE,
        damage: 45,
        actionPoints: 5,
        minLevel: 11,
        description: "Un marteau lourd capable de briser les armures"
    },
    {
        id: "thor_hammer",
        name: "Mjölnir",
        type: WeaponType.MACE,
        damage: 75,
        actionPoints: 6,
        minLevel: 16,
        description: "Le légendaire marteau de Thor, chargé d'énergie électrique"
    },

    // === ARCS ===
    {
        id: "short_bow",
        name: "Arc Court",
        type: WeaponType.BOW,
        damage: 10,
        actionPoints: 2,
        minLevel: 2,
        description: "Un petit arc pour les débutants"
    },
    {
        id: "long_bow",
        name: "Arc Long",
        type: WeaponType.BOW,
        damage: 20,
        actionPoints: 3,
        minLevel: 5,
        description: "Un arc long avec une portée impressionnante"
    },
    {
        id: "composite_bow",
        name: "Arc Composite",
        type: WeaponType.BOW,
        damage: 35,
        actionPoints: 4,
        minLevel: 9,
        description: "Un arc composite puissant et précis"
    },
    {
        id: "elven_bow",
        name: "Arc Elfique",
        type: WeaponType.BOW,
        damage: 55,
        actionPoints: 4,
        minLevel: 14,
        description: "Un arc elfique magnifique qui ne manque jamais sa cible"
    },

    // === BÂTONS ===
    {
        id: "wooden_staff",
        name: "Bâton de Bois",
        type: WeaponType.STAFF,
        damage: 8,
        actionPoints: 2,
        minLevel: 1,
        description: "Un simple bâton en bois"
    },
    {
        id: "magic_staff",
        name: "Bâton Magique",
        type: WeaponType.STAFF,
        damage: 18,
        actionPoints: 3,
        minLevel: 4,
        description: "Un bâton imprégné d'énergie magique"
    },
    {
        id: "archmage_staff",
        name: "Bâton d'Archimage",
        type: WeaponType.STAFF,
        damage: 40,
        actionPoints: 4,
        minLevel: 10,
        description: "Le bâton d'un archimage, pulsant de pouvoir"
    },
    {
        id: "staff_of_power",
        name: "Bâton de Puissance",
        type: WeaponType.STAFF,
        damage: 65,
        actionPoints: 5,
        minLevel: 15,
        description: "Un bâton légendaire qui amplifie toute magie"
    }
];

// Fonction pour obtenir les armes disponibles selon le niveau du joueur
export function getAvailableWeapons(playerLevel) {
    return allWeapons.filter(weapon => weapon.minLevel <= playerLevel);
}

// Fonction pour obtenir une arme par son ID
export function getWeaponById(id) {
    return allWeapons.find(weapon => weapon.id === id);
}

// Fonction pour obtenir les armes par type
export function getWeaponsByType(type) {
    return allWeapons.filter(weapon => weapon.type === type);
}

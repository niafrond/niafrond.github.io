// Bibliothèque complète des armes du jeu

// Types d'armes
export const WeaponType = {
    BOW: 'bow'
};

// Rareté des armes
export const WeaponRarity = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    LEGENDARY: 'legendary'
};

// Biomes de carte (champ `biome` des cartes/ennemis) → nom affiché.
export const BIOME_LABELS = {
    bamboo: 'Bambous', volcano: 'Volcan', paddy: 'Rizières', riverbed: 'Fleuve', fusang: 'Fusang',
    moon: 'Lune', coast: 'Côte', storm: 'Tonnerre', savanna: 'Fauves', gobi: 'Gobi'
};

// Certains arcs (champ `biome`) infligent +25 % de dégâts (au moins +2) quand le combat a lieu dans leur biome.
export const BIOME_WEAPON_BONUS = 0.25;
export function weaponBiomeBonus(weapon, biome) {
    if (!weapon || !weapon.biome || weapon.biome !== biome) return 0;
    return Math.max(2, Math.round(weapon.damage * BIOME_WEAPON_BONUS));
}

// Définition de toutes les armes disponibles dans le jeu
export const allWeapons = [
    // === ARCS (Hou Yi est archer : toutes les armes sont des arcs) ===
    {
        id: "arc_de_fortune",
        name: "Arc de Fortune",
        type: WeaponType.BOW,
        damage: 10,
        actionPoints: 3,
        minLevel: 1,
        rarity: WeaponRarity.COMMON,
        twoHanded: false,
        description: "Un vieil arc de bois fendillé, mais la corde tient encore"
    },
    {
        id: "arc_leger",
        name: "Arc Léger",
        type: WeaponType.BOW,
        damage: 20,
        actionPoints: 4,
        minLevel: 3,
        biome: "coast",
        rarity: WeaponRarity.UNCOMMON,
        twoHanded: false,
        description: "Un arc souple et vif, idéal pour tirer sans cesse"
    },
    {
        id: "arc_de_precision",
        name: "Arc de Précision",
        type: WeaponType.BOW,
        damage: 35,
        actionPoints: 5,
        minLevel: 7,
        biome: "riverbed",
        rarity: WeaponRarity.RARE,
        twoHanded: false,
        description: "Un arc finement équilibré dont chaque flèche trouve sa cible"
    },
    {
        id: "arc_de_feu",
        name: "Arc de Feu",
        type: WeaponType.BOW,
        damage: 60,
        actionPoints: 6,
        minLevel: 12,
        biome: "volcano",
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: false,
        description: "Un arc laqué de braises : ses flèches s'embrasent en quittant la corde"
    },
    {
        id: "arc_des_dix_soleils",
        name: "Arc des Dix Soleils",
        type: WeaponType.BOW,
        damage: 100,
        actionPoints: 7,
        minLevel: 18,
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: false,
        description: "L'arc mythique qui abattit neuf soleils, brillant d'une lumière divine"
    },

    {
        id: "arc_de_chasseur",
        name: "Arc de Chasseur",
        type: WeaponType.BOW,
        damage: 15,
        actionPoints: 4,
        minLevel: 1,
        biome: "savanna",
        rarity: WeaponRarity.COMMON,
        description: "Un arc simple de chasseur, bon pour le gibier... et les ennemis"
    },
    {
        id: "arc_lourd",
        name: "Arc Lourd",
        type: WeaponType.BOW,
        damage: 30,
        actionPoints: 5,
        minLevel: 5,
        biome: "gobi",
        rarity: WeaponRarity.UNCOMMON,
        twoHanded: true,
        description: "Un arc massif à la corde raide, qui exige deux bras robustes"
    },
    {
        id: "arc_de_jade",
        name: "Arc de Jade",
        type: WeaponType.BOW,
        damage: 50,
        actionPoints: 6,
        minLevel: 10,
        biome: "moon",
        rarity: WeaponRarity.RARE,
        twoHanded: true,
        description: "Un grand arc incrusté de jade, dont la corde chante à chaque tir"
    },
    {
        id: "arc_du_juge_celeste",
        name: "Arc du Juge Céleste",
        type: WeaponType.BOW,
        damage: 80,
        actionPoints: 7,
        minLevel: 15,
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: true,
        description: "Un arc terrifiant dont le sifflement glace le sang des ennemis"
    },

    {
        id: "arc_de_bronze",
        name: "Arc de Bronze",
        type: WeaponType.BOW,
        damage: 8,
        actionPoints: 2,
        minLevel: 1,
        rarity: WeaponRarity.COMMON,
        description: "Un petit arc à renforts de bronze, léger et rapide"
    },
    {
        id: "arc_d_argent",
        name: "Arc d'Argent",
        type: WeaponType.BOW,
        damage: 11,
        actionPoints: 2,
        minLevel: 4,
        biome: "moon",
        rarity: WeaponRarity.UNCOMMON,
        description: "Un arc élégant incrusté d'argent pur"
    },
    {
        id: "arc_venimeux",
        name: "Arc Venimeux",
        type: WeaponType.BOW,
        damage: 25,
        actionPoints: 3,
        minLevel: 8,
        biome: "paddy",
        rarity: WeaponRarity.RARE,
        description: "Un arc dont les flèches sont trempées dans un venin mortel"
    },
    {
        id: "arc_du_voile_noir",
        name: "Arc du Voile Noir",
        type: WeaponType.BOW,
        damage: 45,
        actionPoints: 4,
        minLevel: 13,
        rarity: WeaponRarity.LEGENDARY,
        description: "Un arc forgé dans les ténèbres, presque invisible"
    },

    {
        id: "arc_d_ecorce",
        name: "Arc d'Écorce",
        type: WeaponType.BOW,
        damage: 12,
        actionPoints: 3,
        minLevel: 1,
        biome: "savanna",
        rarity: WeaponRarity.COMMON,
        description: "Un arc rustique taillé dans l'écorce de bois dur"
    },
    {
        id: "arc_a_pointes",
        name: "Arc à Pointes",
        type: WeaponType.BOW,
        damage: 25,
        actionPoints: 4,
        minLevel: 6,
        rarity: WeaponRarity.UNCOMMON,
        description: "Un arc hérissé de pointes, redoutable même au corps à corps"
    },
    {
        id: "arc_de_forge",
        name: "Arc de Forge",
        type: WeaponType.BOW,
        damage: 45,
        actionPoints: 5,
        minLevel: 11,
        biome: "volcano",
        rarity: WeaponRarity.RARE,
        description: "Un arc de métal trempé, capable de percer les armures"
    },
    {
        id: "arc_de_lei_gong",
        name: "Arc de Lei Gong",
        type: WeaponType.BOW,
        damage: 75,
        actionPoints: 6,
        minLevel: 16,
        biome: "storm",
        rarity: WeaponRarity.LEGENDARY,
        description: "L'arc du Seigneur du Tonnerre, chargé d'énergie électrique"
    },

    {
        id: "arc_court_de_pecher",
        name: "Arc Court de Pêcher",
        type: WeaponType.BOW,
        damage: 10,
        actionPoints: 2,
        minLevel: 2,
        biome: "fusang",
        rarity: WeaponRarity.COMMON,
        description: "Un petit arc en bois de pêcher, qui chasse les mauvais esprits"
    },
    {
        id: "arc_long_de_bambou",
        name: "Arc Long de Bambou",
        type: WeaponType.BOW,
        damage: 20,
        actionPoints: 3,
        minLevel: 5,
        biome: "bamboo",
        rarity: WeaponRarity.UNCOMMON,
        twoHanded: true,
        description: "Un arc long de bambou avec une portée impressionnante"
    },
    {
        id: "arc_composite_de_corne",
        name: "Arc Composite de Corne",
        type: WeaponType.BOW,
        damage: 35,
        actionPoints: 4,
        minLevel: 9,
        biome: "gobi",
        rarity: WeaponRarity.RARE,
        twoHanded: true,
        description: "Un arc de corne et de tendon, puissant et précis"
    },
    {
        id: "arc_rouge_celeste",
        name: "Arc Rouge Céleste",
        type: WeaponType.BOW,
        damage: 52,
        actionPoints: 4,
        minLevel: 14,
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: true,
        description: "Le grand arc rouge de l'archer divin, qui ne manque jamais sa cible"
    },

    {
        id: "arc_de_bambou",
        name: "Arc de Bambou",
        type: WeaponType.BOW,
        damage: 8,
        actionPoints: 2,
        minLevel: 1,
        biome: "bamboo",
        rarity: WeaponRarity.COMMON,
        description: "Un simple arc de bambou souple"
    },
    {
        id: "arc_a_talisman",
        name: "Arc à Talisman",
        type: WeaponType.BOW,
        damage: 18,
        actionPoints: 3,
        minLevel: 4,
        rarity: WeaponRarity.UNCOMMON,
        description: "Un arc orné d'un talisman, imprégné de qi"
    },
    {
        id: "arc_du_maitre_taoiste",
        name: "Arc du Maître Taoïste",
        type: WeaponType.BOW,
        damage: 40,
        actionPoints: 4,
        minLevel: 10,
        rarity: WeaponRarity.RARE,
        description: "L'arc d'un grand maître taoïste, pulsant de pouvoir"
    },
    {
        id: "arc_de_l_immortel",
        name: "Arc de l'Immortel",
        type: WeaponType.BOW,
        damage: 65,
        actionPoints: 5,
        minLevel: 15,
        biome: "fusang",
        rarity: WeaponRarity.LEGENDARY,
        description: "Un arc légendaire qui amplifie toute magie"
    }
];

// Anciens ids (sabres, haches, bâtons…) → arc équivalent, pour les sauvegardes antérieures.
export const LEGACY_WEAPON_IDS = {
    rusty_sword: 'arc_de_fortune',
    iron_sword: 'arc_leger',
    steel_sword: 'arc_de_precision',
    dragon_sword: 'arc_de_feu',
    excalibur: 'arc_des_dix_soleils',
    wood_axe: 'arc_de_chasseur',
    battle_axe: 'arc_lourd',
    great_axe: 'arc_de_jade',
    executioner_axe: 'arc_du_juge_celeste',
    bronze_dagger: 'arc_de_bronze',
    silver_dagger: 'arc_d_argent',
    poisoned_dagger: 'arc_venimeux',
    shadow_blade: 'arc_du_voile_noir',
    club: 'arc_d_ecorce',
    mace: 'arc_a_pointes',
    war_hammer: 'arc_de_forge',
    thor_hammer: 'arc_de_lei_gong',
    short_bow: 'arc_court_de_pecher',
    long_bow: 'arc_long_de_bambou',
    composite_bow: 'arc_composite_de_corne',
    elven_bow: 'arc_rouge_celeste',
    wooden_staff: 'arc_de_bambou',
    magic_staff: 'arc_a_talisman',
    archmage_staff: 'arc_du_maitre_taoiste',
    staff_of_power: 'arc_de_l_immortel',
};

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
    const weapon = allWeapons.find(weapon => weapon.id === (LEGACY_WEAPON_IDS[id] || id));
    return weapon ? normalizeWeapon(weapon) : null;
}

// Fonction pour obtenir les armes par type
export function getWeaponsByType(type) {
    return allWeapons.filter(weapon => weapon.type === type).map(normalizeWeapon);
}

// Rareté « de boutique » d'une arme : celle de sa fiche (commune → légendaire).
export function weaponRarity(weapon) {
    return weapon.rarity || 'common';
}

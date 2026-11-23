// Bibliothèque complète des armes du jeu

import { describeManaMax } from './manaGear.js';
import { describeEffects } from './gearEffects.js';

// Types d'armes
export const WeaponType = {
    BOW: 'bow',
    // Armes de compagnon (jamais équipables par Hou Yi, qui ne tire qu'à l'arc)
    SWORD: 'sword', AXE: 'axe', MACE: 'mace', DAGGER: 'dagger', STAFF: 'staff', FAN: 'fan'
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
    moon: 'Lune', coast: 'Côte', tides: 'Hautes-Eaux', storm: 'Tonnerre', savanna: 'Fauves', gobi: 'Gobi'
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
        target: "area",   // volée : touche tous les ennemis (targeting.js)
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

    // === ARCS LOURDS À DEUX MAINS (très puissants, très chers en PA, main gauche occupée ; jamais portés par les ennemis) ===
    {
        id: "arc_du_dragon_de_jade",
        name: "Arc du Dragon de Jade",
        type: WeaponType.BOW,
        damage: 125,
        actionPoints: 8,
        minLevel: 16,
        biome: "moon",
        rarity: WeaponRarity.RARE,
        twoHanded: true,
        playerOnly: true,
        description: "Un arc colossal sculpté dans un dragon de jade : il faut tendre la corde à deux mains et prendre son temps"
    },
    {
        id: "arc_du_mont_tai",
        name: "Arc du Mont Tai",
        type: WeaponType.BOW,
        damage: 140,
        actionPoints: 8,
        minLevel: 22,
        biome: "gobi",
        rarity: WeaponRarity.RARE,
        twoHanded: true,
        playerOnly: true,
        description: "Lourd comme la montagne sacrée, il écrase l'ennemi d'une seule flèche"
    },
    {
        id: "arc_de_la_foudre_celeste",
        name: "Arc de la Foudre Céleste",
        type: WeaponType.BOW,
        damage: 185,
        actionPoints: 9,
        minLevel: 30,
        biome: "storm",
        rarity: WeaponRarity.RARE,
        twoHanded: true,
        playerOnly: true,
        description: "Sa flèche est un éclair que seul un archer à deux mains peut retenir"
    },
    {
        id: "arc_des_marees_de_l_est",
        name: "Arc des Marées de l'Est",
        type: WeaponType.BOW,
        damage: 210,
        actionPoints: 9,
        minLevel: 38,
        biome: "fusang",
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: true,
        playerOnly: true,
        description: "Une corde tendue comme la marée avant la vague géante"
    },
    {
        id: "arc_de_la_forge_de_zhurong",
        name: "Arc de la Forge de Zhurong",
        type: WeaponType.BOW,
        damage: 265,
        actionPoints: 10,
        minLevel: 46,
        biome: "volcano",
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: true,
        playerOnly: true,
        description: "Forgé dans le feu du dieu Zhurong, brûlant à mains nues"
    },
    {
        id: "arc_des_neuf_fleuves",
        name: "Arc des Neuf Fleuves",
        type: WeaponType.BOW,
        damage: 290,
        actionPoints: 10,
        minLevel: 54,
        biome: "riverbed",
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: true,
        playerOnly: true,
        description: "Neuf fleuves coulent dans son bois ; une flèche les libère tous"
    },
    {
        id: "arc_du_grand_leviathan",
        name: "Arc du Grand Léviathan",
        type: WeaponType.BOW,
        damage: 355,
        actionPoints: 11,
        minLevel: 62,
        biome: "coast",
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: true,
        playerOnly: true,
        description: "Taillé dans l'échine d'un monstre marin, il exige tout le corps"
    },
    {
        id: "arc_fendeur_de_ciel",
        name: "Arc Fendeur de Ciel",
        type: WeaponType.BOW,
        damage: 420,
        actionPoints: 12,
        minLevel: 70,
        rarity: WeaponRarity.LEGENDARY,
        twoHanded: true,
        playerOnly: true,
        description: "L'arc qui abattit les neuf soleils : une seule flèche, deux mains, un tour entier"
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
    },

    // Arme à effet de combat (`effects`, gearEffects.js) : plus de dégâts contre un ennemi empoisonné.
    {
        id: "arc_de_la_vipere",
        name: "Arc de la Vipère",
        type: WeaponType.BOW,
        damage: 28,
        actionPoints: 3,
        minLevel: 10,
        rarity: WeaponRarity.RARE,
        effects: { vsStatus: { poisoned: 25 } },
        description: "Un arc de bois noir dont les flèches sont trempées de venin : il achève ce que le poison a commencé"
    },

    // Armes qui augmentent le qì max (`manaMax` : une, deux ou cinq couleurs).
    {
        id: "arc_de_braise_de_qi",
        name: "Arc de Braise de Qi",
        type: WeaponType.BOW,
        damage: 22,
        actionPoints: 3,
        minLevel: 6,
        rarity: WeaponRarity.UNCOMMON,
        manaMax: { red: 1 },
        description: "Un arc de bois de cinabre dont la corde garde la chaleur du feu"
    },
    {
        id: "arc_des_eaux_calmes",
        name: "Arc des Eaux Calmes",
        type: WeaponType.BOW,
        damage: 26,
        actionPoints: 3,
        minLevel: 8,
        rarity: WeaponRarity.UNCOMMON,
        manaMax: { blue: 1 },
        description: "Un arc de roseau laqué, serein comme un étang sans vent"
    },
    {
        id: "arc_des_deux_souffles",
        name: "Arc des Deux Souffles",
        type: WeaponType.BOW,
        damage: 44,
        actionPoints: 4,
        minLevel: 12,
        rarity: WeaponRarity.RARE,
        manaMax: { green: 2, yellow: 2 },
        description: "Un arc où se mêlent la sève et la foudre, de part et d'autre de la poignée"
    },
    {
        id: "arc_des_cinq_vents",
        name: "Arc des Cinq Vents",
        type: WeaponType.BOW,
        damage: 70,
        actionPoints: 5,
        minLevel: 20,
        rarity: WeaponRarity.LEGENDARY,
        manaMax: { red: 1, blue: 1, green: 1, yellow: 1, purple: 1 },
        description: "Cinq vents soufflent dans ses branches, un par élément"
    },
    {
        id: "arc_du_chasseur_errant",
        name: "Arc du Chasseur Errant",
        type: WeaponType.BOW,
        damage: 20,
        actionPoints: 4,
        minLevel: 3,
        rarity: WeaponRarity.UNCOMMON,
        fusionOnly: true,
        description: "Forgé de deux arcs de chasse : léger comme l'un, tendu comme l'autre"
    },
    {
        id: "arc_des_vents_de_bambou",
        name: "Arc des Vents de Bambou",
        type: WeaponType.BOW,
        damage: 29,
        actionPoints: 4,
        minLevel: 7,
        rarity: WeaponRarity.UNCOMMON,
        fusionOnly: true,
        description: "Le bambou et le vent n'ont plus fait qu'un dans cette forge"
    },
    {
        id: "arc_du_serpent_d_argent",
        name: "Arc du Serpent d'Argent",
        type: WeaponType.BOW,
        damage: 58,
        actionPoints: 6,
        minLevel: 12,
        rarity: WeaponRarity.RARE, atkBonus: 2,
        fusionOnly: true,
        description: "Précis comme l'un, venimeux comme l'autre : la lame du serpent d'argent"
    },
    {
        id: "arc_du_rempart_de_pointes",
        name: "Arc du Rempart de Pointes",
        type: WeaponType.BOW,
        damage: 54,
        actionPoints: 6,
        minLevel: 11,
        rarity: WeaponRarity.RARE, defBonus: 3,
        fusionOnly: true,
        description: "Un arc-bouclier hérissé de pointes, qui parent autant qu'ils frappent"
    },
    {
        id: "arc_de_la_lune_de_jade",
        name: "Arc de la Lune de Jade",
        type: WeaponType.BOW,
        damage: 74,
        actionPoints: 6,
        minLevel: 14,
        rarity: WeaponRarity.RARE, atkBonus: 1, defBonus: 2,
        fusionOnly: true,
        description: "Le jade et l'argent lunaire, fondus en un seul arc"
    },
    {
        id: "arc_du_brasier_royal",
        name: "Arc du Brasier Royal",
        type: WeaponType.BOW,
        damage: 98,
        actionPoints: 7,
        minLevel: 18,
        rarity: WeaponRarity.LEGENDARY, atkBonus: 2,
        fusionOnly: true,
        description: "Deux forges de feu ont chauffé ce métal : il ne refroidit jamais"
    },
    {
        id: "arc_des_deux_cieux",
        name: "Arc des Deux Cieux",
        type: WeaponType.BOW,
        damage: 128,
        actionPoints: 8,
        minLevel: 20,
        rarity: WeaponRarity.LEGENDARY, atkBonus: 2, defBonus: 1,
        fusionOnly: true,
        description: "Le juge et le ciel rouge, réunis sur une seule corde"
    },
    {
        id: "arc_des_onze_soleils",
        name: "Arc des Onze Soleils",
        type: WeaponType.BOW,
        damage: 165,
        actionPoints: 9,
        minLevel: 24,
        rarity: WeaponRarity.LEGENDARY, atkBonus: 3,
        fusionOnly: true,
        description: "Un onzième soleil brûle dans cet arc, né de la foudre et des dix autres"
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

// Bonus d'Attaque (atkBonus : % de critique) et de Défense (defBonus : % de blocage) apportés par certaines armes tant qu'elles
// sont en main (voir combatStats.js) ; les boucliers portent les leurs dans items.js.
export const WEAPON_STAT_BONUSES = {
    arc_de_precision: { atkBonus: 1 },
    arc_de_feu: { atkBonus: 1 },
    arc_des_dix_soleils: { atkBonus: 2 },
    arc_lourd: { defBonus: 1 },
    arc_de_jade: { defBonus: 2 },
    arc_du_juge_celeste: { atkBonus: 1, defBonus: 1 },
    arc_du_dragon_de_jade: { atkBonus: 1, defBonus: 1 },
    arc_du_mont_tai: { defBonus: 3 },
    arc_de_la_foudre_celeste: { atkBonus: 2 },
    arc_des_marees_de_l_est: { atkBonus: 1, defBonus: 2 },
    arc_de_la_forge_de_zhurong: { atkBonus: 3 },
    arc_des_neuf_fleuves: { atkBonus: 1, defBonus: 4 },
    arc_du_grand_leviathan: { atkBonus: 2, defBonus: 4 },
    arc_fendeur_de_ciel: { atkBonus: 3, defBonus: 2 },
    arc_venimeux: { atkBonus: 1 },
    arc_du_voile_noir: { atkBonus: 1 },
    arc_a_pointes: { defBonus: 1 },
    arc_de_forge: { defBonus: 1 },
    arc_de_lei_gong: { atkBonus: 1 },
    arc_composite_de_corne: { atkBonus: 1 },
    arc_rouge_celeste: { atkBonus: 1 },
    arc_a_talisman: { defBonus: 1 },
    arc_du_maitre_taoiste: { defBonus: 1 },
    arc_de_l_immortel: { atkBonus: 1, defBonus: 2 }
};

const signed = n => (n > 0 ? `+${n}` : `${n}`);
// Texte court des bonus d'une arme ou d'un bouclier (« Atk +5 • Déf +3 »), vide s'il n'en a pas.
export function describeStatBonuses(piece) {
    return [piece?.atkBonus ? `Atk ${signed(piece.atkBonus)}` : '', piece?.defBonus ? `Déf ${signed(piece.defBonus)}` : '', describeManaMax(piece), ...describeEffects(piece)].filter(Boolean).join(' • ');
}

/**
 * Ajoute les attributs par défaut aux armes (pour rétro-compatibilité)
 * @param {Object} weapon - L'arme à normaliser
 * @returns {Object} L'arme avec tous les attributs
 */
export function normalizeWeapon(weapon) {
    if (!weapon) return null;

    return {
        ...weapon,
        ...(WEAPON_STAT_BONUSES[weapon.id] || {}),
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
    const weapon = allWeapons.find(weapon => weapon.id === (LEGACY_WEAPON_IDS[id] || id)) || companionWeapons.find(weapon => weapon.id === id);
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


// === ARMES DE COMPAGNON ===
// Chaque compagnon porte un type d'arme (voir `ALLIES[...].weapon`) : butin, marchands et coffres en donnent des variantes.
// `damage` est la puissance de l'arme : le compagnon frappe avec (coût en PA, `actionPoints`) et ajoute `allyWeaponBonus(weapon)` aux dégâts de ses sorts.
export const COMPANION_WEAPON_TYPES = ['sword', 'axe', 'mace', 'dagger', 'staff', 'fan'];

// [niveau, rareté, nom, description] ; 8 variantes par type, du village à la Lune.
const COMPANION_WEAPON_TABLE = {
    sword: [
        [1, 'common', 'Jian de Bronze', 'Une lame droite de bronze, bien équilibrée'],
        [8, 'common', 'Épée du Garde Rizicole', 'Forgée pour les gardes des digues'],
        [16, 'uncommon', 'Jian du Pavillon Brisé', 'Sa garde porte l\'ancien sceau d\'un pavillon'],
        [26, 'uncommon', 'Épée de Jade Vert', 'Un fil de jade court le long de la lame'],
        [36, 'rare', 'Lame des Mille Plis', 'Acier replié mille fois, il chante à chaque coup'],
        [46, 'rare', 'Jian du Dragon Dormant', 'Un dragon gravé s\'éveille quand le sang coule'],
        [58, 'legendary', 'Épée des Neuf Soleils', 'Un éclat de soleil abattu est serti dans la garde'],
        [70, 'legendary', 'Lame de la Lune Pâle', 'Elle tranche l\'ombre autant que la chair']
    ],
    axe: [
        [1, 'common', 'Hache de Bûcheron', 'Elle fendait le bambou avant de fendre des crânes'],
        [9, 'common', 'Hache de Basalte', 'Un tranchant de pierre volcanique'],
        [17, 'uncommon', 'Fu des Remparts', 'Lourde hache des gardes des murailles'],
        [27, 'uncommon', 'Hache du Buffle Rouge', 'Ornée de cornes de buffle'],
        [37, 'rare', 'Fendeuse de Tonnerre', 'Elle claque comme l\'orage à chaque impact'],
        [47, 'rare', 'Hache du Mont Brisé', 'Taillée dans un éclat de falaise'],
        [59, 'legendary', 'Fu du Géant Pangu', 'On dit qu\'elle a séparé le ciel de la terre'],
        [71, 'legendary', 'Hache des Quatre Vents', 'Elle tranche tout ce qu\'elle frôle']
    ],
    mace: [
        [1, 'common', 'Masse de Chêne', 'Un gourdin cerclé de fer'],
        [10, 'common', 'Masse du Moine Errant', 'Sa tête est polie par les pèlerinages'],
        [18, 'uncommon', 'Marteau du Temple', 'Frappé aux cloches du temple'],
        [28, 'uncommon', 'Masse de Cendre Sainte', 'Chargée de braises bénies'],
        [38, 'rare', 'Marteau de la Cloche Ardente', 'Chaque coup sonne comme un glas'],
        [48, 'rare', 'Masse du Gardien de Pierre', 'Taillée dans une statue de gardien'],
        [60, 'legendary', 'Marteau du Mont Kunlun', 'Il pèse comme une montagne sacrée'],
        [72, 'legendary', 'Masse du Tonnerre Sourd', 'Chaque impact fait trembler le sol']
    ],
    dagger: [
        [1, 'common', 'Couteau de Cuisine Aiguisé', 'Pas fait pour ça, mais il coupe'],
        [8, 'common', 'Dague des Marais', 'Une lame fine, discrète et sale'],
        [16, 'uncommon', 'Bishou de Cuivre', 'Légère, elle part avant d\'être vue'],
        [25, 'uncommon', 'Dague du Serpent Jaune', 'Sa lame ondule comme un serpent'],
        [35, 'rare', 'Épingle de Poison', 'Un fiel d\'alchimiste enduit la pointe'],
        [45, 'rare', 'Dague de l\'Éclair Noir', 'Elle disparaît dans la main qui frappe'],
        [57, 'legendary', 'Bishou des Mille Fioles', 'Chaque entaille porte un philtre différent'],
        [69, 'legendary', 'Dague du Dernier Soupir', 'On ne sent pas la lame ; on sent le froid']
    ],
    staff: [
        [1, 'common', 'Bâton de Bambou', 'Un bâton de voyage, léger et droit'],
        [9, 'common', 'Bâton de Saule', 'Souple, il plie sans rompre'],
        [17, 'uncommon', 'Bâton du Lettré', 'Les sceaux gravés guident le qì'],
        [27, 'uncommon', 'Gun de Jade', 'Une perle de jade au sommet'],
        [37, 'rare', 'Bâton des Neuf Anneaux', 'Il tinte à chaque mouvement'],
        [47, 'rare', 'Sceptre de l\'Aïeule', 'Orné de plumes et d\'os de grue'],
        [59, 'legendary', 'Bâton du Roi Singe', 'Il grandit ou rétrécit selon l\'envie'],
        [71, 'legendary', 'Sceptre des Cinq Éléments', 'Cinq pierres, cinq forces, un seul geste']
    ],
    fan: [
        [1, 'common', 'Éventail de Papier', 'Léger, mais le vent s\'y plie'],
        [9, 'common', 'Éventail de Bambou', 'Ses baleines claquent comme des lames'],
        [17, 'uncommon', 'Éventail de la Brise', 'Il attire les vents favorables'],
        [27, 'uncommon', 'Shan des Cendres', 'Des plumes noircies par un feu ancien'],
        [37, 'rare', 'Éventail de Plume de Grue', 'Chaque coup lève un tourbillon'],
        [47, 'rare', 'Éventail des Esprits', 'Peint d\'ancêtres qui murmurent'],
        [59, 'legendary', 'Éventail de Feuille de Bananier', 'Il éteint les flammes et attise les tempêtes'],
        [71, 'legendary', 'Éventail du Vent des Morts', 'Les âmes l\'accompagnent en tourbillon']
    ]
};
const COMPANION_WEAPON_SLUG = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Une arme de compagnon coûte des points d'action comme celles de Hou Yi : 3 PA pour un petit coup, jusqu'à 12 PA pour les plus puissantes (mêmes paliers que ses arcs).
const COMPANION_AP_STEPS = [18, 32, 55, 90, 120, 180, 260, 350, 410];
export const companionWeaponAP = damage => 3 + COMPANION_AP_STEPS.filter(t => damage >= t).length;

export const companionWeapons = Object.entries(COMPANION_WEAPON_TABLE).flatMap(([type, rows]) =>
    rows.map(([minLevel, rarity, name, description]) => normalizeWeapon({
        id: `${type}_${COMPANION_WEAPON_SLUG(name)}`, name, type, companion: true,
        damage: Math.round(8 + minLevel * 5 * ({ common: 0.9, uncommon: 1, rare: 1.08, legendary: 1.18 }[rarity] || 1)),
        actionPoints: companionWeaponAP(Math.round(8 + minLevel * 5 * ({ common: 0.9, uncommon: 1, rare: 1.08, legendary: 1.18 }[rarity] || 1))), minLevel, rarity, twoHanded: false, description
    })));

/** Arme de compagnon (butin, marchands) : jamais équipable par Hou Yi. */
export const isCompanionWeapon = w => !!w?.companion;
/** Armes d'une liste que Hou Yi peut manier (sans les armes de compagnon). */
export const heroWeapons = list => (list || []).filter(w => !isCompanionWeapon(w));
/** Bonus de dégâts qu'une arme donne aux sorts de son compagnon. */
export const allyWeaponBonus = w => (w ? Math.round((w.damage || 0) * 0.25) : 0);
/** Toutes les armes pouvant tomber en butin ou se vendre : les arcs de Hou Yi et les armes de compagnon. */
export const lootableWeapons = () => [...allWeapons, ...companionWeapons];

/**
 * Restreint un tirage d'arme (butin) à une moitié équitable : une fois sur deux une arme de compagnon, et dans ce cas d'un type tiré au hasard
 * (chaque compagnon a la même chance d'y trouver son arme), sinon un arc de Hou Yi. Sans candidat d'une moitié, l'autre sert. Consomme 1 ou 2 tirages.
 */
export function balancedWeaponPool(candidates, rng = Math.random) {
    const hero = candidates.filter(w => !isCompanionWeapon(w));
    const allies = candidates.filter(isCompanionWeapon);
    if (!allies.length) return hero;
    if (!hero.length || rng() < 0.5) {
        const types = [...new Set(allies.map(w => w.type))];
        const type = types[Math.floor(rng() * types.length)];
        return allies.filter(w => w.type === type);
    }
    return hero;
}

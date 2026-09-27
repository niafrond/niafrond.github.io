// Carte du monde : zones d'exploration liées au niveau du joueur.
// Chaque zone regroupe un sous-ensemble de gabarits d'ennemis (voir enemies.catalog.json)
// afin de donner une identité thématique à l'exploration. Une zone reste toujours
// accessible une fois débloquée : le joueur peut la quitter (adversaire trop dur,
// simple choix) et y revenir plus tard, par exemple une fois monté en niveau.
export const worldZones = [
    {
        id: 'forest',
        name: 'Forêt Sylvestre',
        emoji: '🌲',
        unlockLevel: 1,
        description: "Une forêt paisible où rôdent gobelins et esprits gardiens. Idéale pour s'entraîner.",
        templateIds: ['forest_guardian', 'fungal_horror', 'goblin_saboteur', 'moon_priestess']
    },
    {
        id: 'ruins',
        name: 'Ruines Antiques',
        emoji: '🏛️',
        unlockLevel: 1,
        description: "Les vestiges d'une civilisation oubliée, gardés par des érudits et des mort-vivants.",
        templateIds: ['temple_warden', 'arcane_scholar', 'iron_gladiator', 'crypt_lich', 'bone_reaver']
    },
    {
        id: 'warcamp',
        name: 'Camp de Guerre',
        emoji: '🪓',
        unlockLevel: 4,
        description: "Le repaire des hordes orques et de leurs alliés les plus retors.",
        templateIds: ['orc_warmaster', 'shadow_assassin', 'plague_doctor', 'storm_knight']
    },
    {
        id: 'desert',
        name: 'Désert Ardent',
        emoji: '🏜️',
        unlockLevel: 7,
        description: "Une mer de sable brûlante gardée par des colosses et des créatures de lave.",
        templateIds: ['sand_colossus', 'lava_behemoth', 'ember_dragon', 'sun_paladin']
    },
    {
        id: 'frozen',
        name: 'Terres Gelées',
        emoji: '❄️',
        unlockLevel: 10,
        description: "Des étendues glacées hantées par des géants et des dragons de givre.",
        templateIds: ['frost_dragon', 'ice_witch', 'storm_wyrm', 'war_troll']
    },
    {
        id: 'abyss',
        name: 'Abysses Interdites',
        emoji: '🌊',
        unlockLevel: 13,
        description: "Les profondeurs oubliées, domaine des créatures les plus dangereuses.",
        templateIds: ['deep_sea_serpent', 'void_vampire', 'crystal_sage']
    }
];

export function getZoneById(zoneId) {
    return worldZones.find(zone => zone.id === zoneId) || null;
}

export function isZoneUnlocked(zoneId, playerLevel) {
    const zone = getZoneById(zoneId);
    if (!zone) return false;
    return Math.max(1, Math.floor(playerLevel || 1)) >= zone.unlockLevel;
}

export function getUnlockedZones(playerLevel) {
    const level = Math.max(1, Math.floor(playerLevel || 1));
    return worldZones.filter(zone => level >= zone.unlockLevel);
}

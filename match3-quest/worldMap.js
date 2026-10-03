// Régions du monde de « Hou Yi et les Dix Soleils » (voir UNIVERS.md). Chaque région correspond à un écran
// d'exploration du même identifiant (story.js) et à un Soleil-Boss. `unlockLevel` reste aligné sur
// REGION_UNLOCK_LEVEL (story.js). Cette liste alimente la carte du monde illustrée (worldMapView.js), vue
// d'ensemble depuis laquelle on peut rejoindre les régions déjà découvertes.
// `map` = position du noeud (viewBox 820x600) ; l'ordre du tableau est celui du chemin qui relie les régions.
// `shortName` = libellé court des étiquettes de la carte.
export const worldZones = [
    {
        id: 'rizieres',
        map: { x: 100, y: 490 },
        name: 'Rizières Desséchées',
        shortName: 'Rizières',
        emoji: '🌾',
        unlockLevel: 1,
        description: "Chez Hou Yi : les rizières brûlent sous le Soleil Ardent. C'est ici que l'aventure commence."
    },
    {
        id: 'fleuve',
        map: { x: 260, y: 505 },
        name: 'Lit du Fleuve Jaune',
        shortName: 'Fleuve Jaune',
        emoji: '💧',
        unlockLevel: 2,
        description: "Le grand fleuve s'est tari : le Soleil des Eaux Taries a laissé un lit de boue craquelée."
    },
    {
        id: 'bambous',
        map: { x: 420, y: 490 },
        name: 'Forêt de Bambous Calcinée',
        shortName: 'Bambous',
        emoji: '🎋',
        unlockLevel: 3,
        description: "Les bambous sont en cendres. Le Soleil de Cendres règne sur les ruines du temple."
    },
    {
        id: 'gobi',
        map: { x: 580, y: 505 },
        name: 'Désert de Gobi',
        shortName: 'Gobi',
        emoji: '🏜️',
        unlockLevel: 5,
        description: "Mirages et dunes : le Soleil des Mirages se cache parmi ses doubles."
    },
    {
        id: 'tonnerre',
        map: { x: 725, y: 395 },
        name: 'Monts du Tonnerre',
        shortName: 'Tonnerre',
        emoji: '⛈️',
        unlockLevel: 7,
        description: "Des pics noirs que les orages fouettent sans cesse, domaine du Soleil des Orages."
    },
    {
        id: 'volcan',
        map: { x: 585, y: 290 },
        name: 'Gorges du Volcan',
        shortName: 'Volcan',
        emoji: '🌋',
        unlockLevel: 9,
        description: "La roche fond dans les gorges du Soleil de Magma. Fengmeng vous y attend peut-être."
    },
    {
        id: 'fauves',
        map: { x: 430, y: 300 },
        name: 'Plaine des Fauves',
        shortName: 'Fauves',
        emoji: '🐅',
        unlockLevel: 11,
        description: "Les bêtes sont devenues folles sous le Soleil des Bêtes Folles : des meutes embrasées."
    },
    {
        id: 'mer',
        map: { x: 275, y: 290 },
        name: 'Rivage de la Mer Orientale',
        shortName: "Mer d'Orient",
        emoji: '🌊',
        unlockLevel: 13,
        description: "La mer fume et se retire devant le Soleil des Marées. Le Roi-Dragon implore de l'aide."
    },
    {
        id: 'fusang',
        map: { x: 160, y: 175 },
        name: 'Cime du Fusang',
        shortName: 'Fusang',
        emoji: '🌳',
        unlockLevel: 15,
        description: "Le sommet de l'arbre où les soleils reposent : le Soleil Lâche s'y cache derrière le dernier soleil."
    },
    {
        id: 'lune',
        map: { x: 335, y: 85 },
        name: 'Pic de la Lune',
        shortName: 'Lune',
        emoji: '🌕',
        unlockLevel: 16,
        description: "Là où Chang'e s'envole sous la pleine lune. Le dernier combat, puis l'offrande."
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

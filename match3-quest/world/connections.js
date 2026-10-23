// Connexions de bordure entre cartes (données configurables, voir ../mapConnections.js).
//
// Chaque entrée : { from, dir: 'north' | 'south' | 'east' | 'west', to, offset?, align?, range?, requires?, lockedMessage?, label?, oneWay?, sea? }
//  - offset : décalage (tuiles) de l'origine de `to` dans le repère de `from`, le long de la bordure ;
//  - align  : 'start' | 'center' | 'end' (calcule le décalage à partir des tailles ; `offset` s'y ajoute) ;
//  - range  : [min, max] (repère de `from`) : passage restreint à une portion de la bordure ;
//  - requires / lockedMessage : passage fermé tant que la condition de progression n'est pas remplie (comme `exit.requires`) ;
//  - oneWay : pas de connexion inverse automatique ;
//  - sea    : bordure de mer (voir plus bas) : aucun couloir n'y est creusé, la bordure reste de l'eau.
// Le sens inverse est déduit automatiquement. Une carte sans entrée garde ses bords infranchissables ;
// portes, escaliers et grottes restent des `exits` (WarpTrigger), pas des connexions.
//
// Les connexions est-ouest de la chaîne des régions sont déduites des sorties (migrateEdgeExits). Les bordures de mer ci-dessous relient
// les cartes de régions voisines sur la carte du monde (worldMap.js) par leurs bords nord / sud : chaque carte est entourée de mer, et
// le bord de l'une mène simplement au bord de l'autre. Aucun passage aménagé : ces bords sont de l'eau, on ne les atteint (et on
// n'arrive de l'autre côté) qu'en marchant sur l'eau, avec le Pas de Yu (`sq_pas_de_yu`, exploration.js `canWalkOnWater`).

// Bord nord de `south` (carte du sud) ↔ bord sud de `north` (carte du nord), recouvrement centré sur toute la largeur commune.
const seaEdge = (south, north) => ({ from: south, dir: 'north', to: north, align: 'center', sea: true });

export const CONNECTIONS = [
    seaEdge('volcan_road', 'mer_road'),          // Volcan ↕ Mer Orientale
    seaEdge('gobi_road', 'fauves_road'),         // Gobi ↕ Plaine des Fauves
    seaEdge('fleuve_road', 'bambous_road'),      // Lit du Fleuve Jaune ↕ Bambous
    seaEdge('bambous_road', 'tonnerre_road'),    // Bambous ↕ Monts du Tonnerre
    seaEdge('fauves_road', 'lune_road'),         // Plaine des Fauves ↕ Lune
    seaEdge('rizieres_wild', 'fusang_road')      // Rizières ↕ Fusang
];

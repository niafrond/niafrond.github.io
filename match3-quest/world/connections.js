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
// n'arrive de l'autre côté) qu'en marchant sur l'eau, avec le Pas de Yu (`sq_pas_de_yu`, exploration.js `canWalkOnWater`), et seulement
// une fois vaincu le gardien qui ouvre la route officielle vers la plus avancée des deux régions.

// Ordre de progression (world/index.js REGION_ORDER) et boss dont la défaite ouvre la route officielle vers la région suivante (story.js).
const PROGRESSION = ['rizieres', 'volcan', 'gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang', 'marees', 'lune'];
const GATE_BOSS = ['sun_1', 'sun_6', 'sun_4', 'sun_2', 'sun_3', 'sun_5', 'sun_7', 'sun_8', 'sun_9', 'changxi'];   // GATE_BOSS[i] ouvre PROGRESSION[i + 1]
const NAMES = {
    rizieres: 'les Rizières', volcan: 'le Volcan', gobi: 'le Gobi', fleuve: 'le Lit du Fleuve Jaune', bambous: 'les Bambous',
    tonnerre: 'les Monts du Tonnerre', fauves: 'la Plaine des Fauves', mer: 'la Mer Orientale', fusang: 'le Fusang', lune: 'la Lune'
};
const regionOfMap = id => id.replace(/_(road|wild|village|hamlet)$/, '');

// Bord nord de `south` (carte du sud) <-> bord sud de `north` (carte du nord), recouvrement centré sur toute la largeur commune.
// Fermé dans les deux sens tant que le gardien qui ouvre la route officielle vers la plus avancée des deux régions n'est pas vaincu :
// le Pas de Yu ne fait pas sauter l'histoire. Une connexion explicite par sens, pour que le message parle de la bonne destination.
function seaEdge(south, north) {
    const rs = regionOfMap(south), rn = regionOfMap(north);
    const far = PROGRESSION.indexOf(rs) > PROGRESSION.indexOf(rn) ? rs : rn;
    const requires = GATE_BOSS[PROGRESSION.indexOf(far) - 1];
    const lockedMessage = dest => `La mer s'étend vers ${NAMES[dest]}, et vos pas pourraient la fouler. Mais un courant contraire vous repousse : tant que le gardien de la route vers ${NAMES[far]} n'est pas vaincu, ces eaux ne vous laissent pas passer.`;
    return [
        { from: south, dir: 'north', to: north, align: 'center', sea: true, requires, lockedMessage: lockedMessage(rn) },
        { from: north, dir: 'south', to: south, align: 'center', sea: true, requires, lockedMessage: lockedMessage(rs) }
    ];
}

// Régions voisines sur la carte du monde (worldMap.js) : [région du sud, région du nord]. La Lune n'a aucune bordure de mer : on n'y monte
// que depuis les Hautes-Eaux, par Changxi (story.js, autel de Mazu) ; les Hautes-Eaux, elles, sont déjà verrouillées par leur propre eau.
const SEA_NEIGHBOURS = [['volcan', 'mer'], ['gobi', 'fauves'], ['fleuve', 'bambous'], ['bambous', 'tonnerre'], ['rizieres', 'fusang']];

// Chaque carte de la région du sud est mise en face d'une carte de la région du nord, dans l'ordre de la chaîne (route, village, zone
// sauvage / hameau, sanctuaire) : le bord nord de l'une mène au bord sud de l'autre, et inversement. La zone sauvage du sud (son bord nord
// est libre) fait face au hameau du nord (son bord sud est libre). Une carte sans vis-à-vis (la route du Fusang : les Rizières n'en ont
// pas) garde un bord de mer sans issue.
const SOUTH_SIDE = r => [`${r}_road`, `${r}_village`, `${r}_wild`, r];
const NORTH_SIDE = r => [`${r}_road`, `${r}_village`, `${r}_hamlet`, r];
const NO_MAP = new Set(['rizieres_road']);   // la première région n'a pas de route d'accès (le jeu démarre au village)

export const CONNECTIONS = SEA_NEIGHBOURS.flatMap(([south, north]) =>
    SOUTH_SIDE(south).map((id, i) => [id, NORTH_SIDE(north)[i]]).filter(([s]) => !NO_MAP.has(s)).map(([s, n]) => seaEdge(s, n))
).flat();

// Connexions de bordure entre cartes (données configurables, voir ../mapConnections.js).
//
// Chaque entrée : { from, dir: 'north' | 'south' | 'east' | 'west', to, offset?, align?, range?, requires?, lockedMessage?, label?, oneWay? }
//  - offset : décalage (tuiles) de l'origine de `to` dans le repère de `from`, le long de la bordure ;
//  - align  : 'start' | 'center' | 'end' (calcule le décalage à partir des tailles ; `offset` s'y ajoute) ;
//  - range  : [min, max] (repère de `from`) : passage de 3 cases au milieu de la bordure ;
//  - requires / lockedMessage : passage fermé tant que la condition de progression n'est pas remplie (comme `exit.requires`) ;
//  - oneWay : pas de connexion inverse automatique.
// Le sens inverse est déduit automatiquement. Une carte sans entrée garde ses bords infranchissables ;
// portes, escaliers et grottes restent des `exits` (WarpTrigger), pas des connexions.
//
// Les connexions est-ouest de la chaîne des régions sont déduites des sorties (migrateEdgeExits). Les routes maritimes ci-dessous relient
// des régions voisines sur la carte du monde (worldMap.js) par leurs bordures nord / sud : le héros y quitte la terre par un ponton et
// traverse la mer. Elles exigent le Pas de Yu (`sq_pas_de_yu`) ET que la route officielle vers la région la plus avancée soit ouverte
// (le gardien de la région précédente vaincu) : on peut passer d'un biome à l'autre sans jamais sauter l'histoire.

// Ordre de progression (world/index.js REGION_ORDER) et boss dont la défaite ouvre la route vers chaque région (story.js).
const PROGRESSION = ['rizieres', 'volcan', 'gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang', 'marees', 'lune'];
const GATE_BOSS = ['sun_1', 'sun_6', 'sun_4', 'sun_2', 'sun_3', 'sun_5', 'sun_7', 'sun_8', 'sun_9', 'changxi'];   // boss de PROGRESSION[i] (ouvre la région i + 1)
const NAMES = {
    rizieres: 'les Rizières', volcan: 'le Volcan', gobi: 'le Gobi', fleuve: 'le Lit du Fleuve Jaune', bambous: 'les Bambous',
    tonnerre: 'les Monts du Tonnerre', fauves: 'la Plaine des Fauves', mer: 'la Mer Orientale', fusang: 'le Fusang', lune: 'la Lune'
};

// Route maritime : `a` (carte du sud, son bord nord) ↔ `b` (carte du nord, son bord sud). `regionA` / `regionB` : régions des deux cartes.
// Deux connexions explicites (une par sens) pour que le libellé et le message de verrou parlent de la bonne destination.
function seaRoute(a, regionA, b, regionB, offset, range) {
    const far = PROGRESSION.indexOf(regionA) > PROGRESSION.indexOf(regionB) ? regionA : regionB;
    const gate = GATE_BOSS[PROGRESSION.indexOf(far) - 1];
    const way = (from, dir, to, regionTo, off, rng) => ({
        from, dir, to, offset: off, range: rng, sea: true,
        label: `Route maritime vers ${NAMES[regionTo]}`,
        requires: ['sq_pas_de_yu', gate],
        lockedMessage: `Un ponton s'avance dans la mer, vers ${NAMES[regionTo]}. Nulle barque n'y va : seul celui qui connaît le Pas de Yu peut marcher sur ces eaux (Gui la tortue noire, à Port-à-Sec de Hekou, en connaît l'histoire) — et la route vers ${NAMES[far]} doit être ouverte : son gardien doit être vaincu.`
    });
    return [way(a, 'north', b, regionB, offset, range), way(b, 'south', a, regionA, -offset, [range[0] - offset, range[1] - offset])];
}

export const CONNECTIONS = [
    seaRoute('volcan_road', 'volcan', 'mer_road', 'mer', 0, [25, 27]),
    seaRoute('gobi_road', 'gobi', 'fauves_road', 'fauves', 0, [18, 20]),
    seaRoute('fleuve_road', 'fleuve', 'bambous_road', 'bambous', -12, [24, 26]),
    seaRoute('bambous_road', 'bambous', 'tonnerre_road', 'tonnerre', 0, [13, 15]),
    seaRoute('fauves_road', 'fauves', 'lune_road', 'lune', 5, [25, 27]),
    seaRoute('rizieres_wild', 'rizieres', 'fusang_road', 'fusang', -8, [28, 30])
].flat();

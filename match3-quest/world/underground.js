// Niveaux souterrains : cavernes et cryptes cachées sous les zones sauvages de quelques régions.
// Écrans plongés dans le noir (`dark: true`) : sans torche, on ne voit qu'à une case autour du héros ; avec la torche (vendue
// par les marchands, `merchants.js`), le rayon de vue s'élargit (explorationView.js). Logique pure, sans DOM ; appliquée par
// `assembleWorld` après l'agrandissement des cartes (les écrans souterrains gardent leur taille).

import { buildZone, freeNeighbor } from './mapKit.js';
import { occupancy } from './junctions.js';

const GRIDS = {
    cave: [
        '####################',
        '#......#......#...3#',
        '#.####.#.####.#.##.#',
        '#.#2...#.#1...#..#.#',
        '#.#.#####.#.###..#.#',
        '<...#.5.6.#...#....#',
        '#.#.#.###.#.##.##.##',
        '#.#...#...#.#4.....#',
        '#.#####.###.#.#.####',
        '#.......#..........#',
        '#.#####...###.####.#',
        '####################'
    ],
    crypt: [
        '####################',
        '#..#.....#.....#..3#',
        '#..#.###.#.###.#...#',
        '#....#2#...#1#.##.##',
        '####.#.#####.#..4..#',
        '<....#.......#.##..#',
        '#.####.#####.#.#...#',
        '#.#....#...#...#.###',
        '#.#.####.#.###.#...#',
        '#....5.6.#.......#.#',
        '#.#.#.#####.#.##...#',
        '####################'
    ]
};

export const UNDERGROUND = [
    {
        id: 'fleuve_cave', parent: 'fleuve_wild', region: 'fleuve', level: 4, layout: 'cave', name: 'Grotte des Limons',
        entrance: 'Entrée de la Grotte des Limons',
        arrival: ['Sous la berge, une bouche de boue séchée s\'enfonce dans la terre. L\'air y sent la vase et le temps arrêté.', 'Sans lumière, vous n\'y verrez presque rien. Une torche aiderait.'],
        chests: [['fleuve_cave_urne', 'Urne des limons', 'Au fond d\'une niche, une urne scellée de vase durcie : des pièces de cuivre, grises comme le fleuve.', 3], ['fleuve_cave_bac', 'Bac du passeur noyé', 'Un coffre de passeur, rongé par l\'humidité, a gardé sa cargaison : de l\'or que personne n\'est venu réclamer.', 2]],
        enemies: [['fleuve_cave_gardien', '1', 'bone_reaver', 'Hebo, Seigneur du Fleuve Noyé', 'sentinel', 1, null, true], ['fleuve_cave_ombre', '2', 'shadow_assassin', 'Ombre de la grotte', 'sentinel', 0], ['fleuve_cave_serpent', '5', 'deep_sea_serpent', 'Serpent des galeries', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'bambous_crypt', parent: 'bambous_wild', region: 'bambous', level: 6, layout: 'crypt', name: 'Crypte des Moines Cendrés',
        entrance: 'Escalier de la Crypte des Moines',
        arrival: ['Une dalle fendue révèle un escalier de pierre noircie. Les moines ont enterré ici ce que le feu n\'a pas pu détruire.', 'Il y fait nuit noire. Sans torche, vous avancerez à tâtons.'],
        chests: [['bambous_crypt_ossuaire', 'Ossuaire des moines', 'Parmi les urnes funéraires, un reliquaire de bois noirci : des offrandes que nul pèlerin n\'est venu reprendre.', 3], ['bambous_crypt_niche', 'Niche du sutra', 'Une niche creusée dans le mur abrite des pièces d\'offrande, serrées dans un linge de soie brûlé.', 2]],
        enemies: [['bambous_crypt_abbe', '1', 'temple_warden', 'Lion Cendré, Gardien du Sutra', 'sentinel', 1, null, true], ['bambous_crypt_ombre', '2', 'shadow_assassin', 'Ombre des cryptes', 'sentinel', 0], ['bambous_crypt_moine', '5', 'bone_reaver', 'Moine sans visage', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'gobi_crypt', parent: 'gobi_wild', region: 'gobi', level: 11, layout: 'crypt', name: 'Crypte Ensablée',
        entrance: 'Trappe de la Crypte Ensablée',
        arrival: ['Entre deux dunes, le vent a dégagé une trappe de pierre. En dessous, l\'ombre d\'un tombeau de caravaniers que le sable a oublié.', 'Sans torche, vous ne distinguerez que vos propres pas.'],
        chests: [['gobi_crypt_sarcophage', 'Sarcophage du marchand', 'Un sarcophage de bois peint, déjà entrouvert : le marchand a emporté peu de chose, mais assez pour vous.', 3], ['gobi_crypt_amphore', 'Amphore des caravanes', 'Une amphore scellée à la poix, pleine de pièces d\'argent venues de très loin.', 2]],
        enemies: [['gobi_crypt_gardien', '1', 'sand_colossus', 'Colosse des Caravanes Ensevelies', 'sentinel', 1, null, true], ['gobi_crypt_voleur', '2', 'shadow_assassin', 'Pilleur de tombes', 'sentinel', 0], ['gobi_crypt_momie', '5', 'bone_reaver', 'Caravanier momifié', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'volcan_cave', parent: 'volcan_wild', region: 'volcan', level: 22, layout: 'cave', name: 'Cavernes de Basalte',
        entrance: 'Faille des Cavernes de Basalte',
        arrival: ['Une faille noire fume au pied de la paroi. Derrière elle, des galeries de basalte que la lave a creusées puis abandonnées.', 'La roche y avale la lumière : sans torche, vous ne verrez presque rien.'],
        chests: [['volcan_cave_geode', 'Géode de braise', 'Une géode fendue laisse couler de l\'or fondu, figé en perles rousses.', 3], ['volcan_cave_forge', 'Forge oubliée', 'Une forge de mineurs, froide depuis des siècles, et un coffret de fer qu\'aucun feu n\'a pu ouvrir.', 2]],
        enemies: [['volcan_cave_behemoth', '1', 'lava_behemoth', 'Gardien de la Forge Noire', 'sentinel', 1, null, true], ['volcan_cave_loup', '2', 'ember_wolf', 'Loup des cavernes', 'sentinel', 0], ['volcan_cave_salamandre', '5', 'ember_dragon', 'Lézard-dragon aveugle', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'lune_crypt', parent: 'lune_wild', region: 'lune', level: 40, layout: 'crypt', name: 'Crypte du Lièvre de Jade',
        entrance: 'Escalier de la Crypte du Lièvre',
        arrival: ['Sous la poussière d\'argent, un escalier descend vers une crypte où dorment les premiers pilons de jade.', 'Aucune lune n\'éclaire ces marches : il vous faudra une torche.'],
        chests: [['lune_crypt_reliquaire', 'Reliquaire de jade', 'Un reliquaire de jade blanc, froid comme la lune : des perles d\'argent y dorment depuis l\'aube des temps.', 3], ['lune_crypt_pilon', 'Pilon d\'argent', 'Un pilon et son mortier, oubliés dans une alcôve, avec une bourse de pièces d\'argent lunaire.', 2]],
        enemies: [['lune_crypt_vampire', '1', 'void_vampire', 'Wu Gang, Spectre du Cassia Lunaire', 'sentinel', 1, null, true], ['lune_crypt_sorciere', '2', 'ice_witch', 'Gardienne de givre', 'sentinel', 0], ['lune_crypt_ombre', '5', 'shadow_assassin', 'Ombre de jade', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'rizieres_cave', parent: 'rizieres_wild', region: 'rizieres', level: 2, layout: 'cave', name: 'Terrier de la Digue',
        entrance: 'Trou du Terrier de la Digue',
        arrival: ['Sous la digue fendue, un trou noir s\'enfonce dans la boue durcie. Des galeries de rats d\'eau, creusées par des générations de sécheresse.', 'Sans lumière, vous n\'y verrez presque rien. Une torche aiderait.'],
        chests: [['rizieres_cave_jarre', 'Jarre du paysan enfui', 'Une jarre de grès, cachée là par un paysan qui n\'est jamais revenu : quelques pièces et un peu de riz sec.', 3],['rizieres_cave_nid', 'Nid du rat d\'eau', 'Un nid de paille tressée où un rat d\'eau collectionnait les pièces perdues.', 2]],
        enemies: [['rizieres_cave_gardien', '1', 'forest_guardian', 'Tortue des Boues, Gardienne du Terrier', 'sentinel', 1, null, true],['rizieres_cave_ombre', '2', 'shadow_assassin', 'Ombre du terrier', 'sentinel', 0, null],['rizieres_cave_diablotin', '5', 'goblin_saboteur', 'Petit démon des galeries', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'tonnerre_cave', parent: 'tonnerre_wild', region: 'tonnerre', level: 17, layout: 'cave', name: 'Galeries du Tonnerre Sourd',
        entrance: 'Faille des Galeries du Tonnerre',
        arrival: ['Au creux d\'une paroi balayée par l\'orage, une faille avale la lumière. Dedans, le tonnerre résonne sourdement, comme un cœur qui bat sous la pierre.', 'Il y fait noir : sans torche, vous avancerez à tâtons.'],
        chests: [['tonnerre_cave_foudre', 'Pierre de foudre', 'Une pierre vitrifiée par la foudre : à l\'intérieur, de l\'or fondu en perles bleutées.', 3],['tonnerre_cave_tambour', 'Tambour fendu', 'Un tambour de guerre éventré, dont la peau cachait une bourse de pièces.', 2]],
        enemies: [['tonnerre_cave_wyrm', '1', 'storm_wyrm', 'Long du Tonnerre Sourd', 'sentinel', 1, null, true],['tonnerre_cave_chevalier', '2', 'storm_knight', 'Chevalier sans orage', 'sentinel', 0, null],['tonnerre_cave_champignon', '5', 'fungal_horror', 'Horreur des galeries', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'fauves_crypt', parent: 'fauves_wild', region: 'fauves', level: 27, layout: 'crypt', name: 'Crypte des Griffes Blanches',
        entrance: 'Dalle de la Crypte des Griffes',
        arrival: ['Au milieu des herbes hautes, une dalle gravée de griffures cache un escalier. Les fauves y enterraient leurs anciens, et leurs esprits veillent encore.', 'Aucune lueur ne descend jusqu\'en bas : il vous faudra une torche.'],
        chests: [['fauves_crypt_ossements', 'Ossements parés', 'Parmi les ossements parés d\'ornements d\'or, un collier que nul chasseur n\'a osé reprendre.', 3],['fauves_crypt_peau', 'Peau de tigre roulée', 'Une peau de tigre roulée serre une poignée de pièces d\'argent.', 2]],
        enemies: [['fauves_crypt_tigre', '1', 'fire_tiger', 'Tigre Blanc des Ancêtres', 'sentinel', 1, null, true],['fauves_crypt_loup', '2', 'ember_wolf', 'Loup des tombes', 'sentinel', 0, null],['fauves_crypt_squelette', '5', 'bone_reaver', 'Chasseur décharné', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'mer_cave', parent: 'mer_wild', region: 'mer', level: 32, layout: 'cave', name: 'Grotte des Marées',
        entrance: 'Bouche de la Grotte des Marées',
        arrival: ['À marée basse, une bouche de roche mouillée s\'ouvre au pied de la falaise. L\'eau y entre et en sort comme une respiration.', 'Sans torche, vous ne distinguerez que le bruit des gouttes.'],
        chests: [['mer_cave_perles', 'Coquillage de perles', 'Un grand coquillage fermé sur un trésor de petites perles et de pièces rongées par le sel.', 3],['mer_cave_epave', 'Coffre d\'épave', 'Le coffre d\'une épave jeté là par la tempête, encore lourd d\'or humide.', 2]],
        enemies: [['mer_cave_serpent', '1', 'deep_sea_serpent', 'Serpent des Marées Noires', 'sentinel', 1, null, true],['mer_cave_docteur', '2', 'plague_doctor', 'Naufragé fiévreux', 'sentinel', 0, null],['mer_cave_ombre', '5', 'shadow_assassin', 'Ombre des récifs', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'fusang_crypt', parent: 'fusang_wild', region: 'fusang', level: 37, layout: 'crypt', name: 'Crypte des Branches Mortes',
        entrance: 'Racine de la Crypte des Branches',
        arrival: ['Entre deux racines du Fusang, un escalier de bois fossilisé s\'enfonce sous l\'arbre. Là dorment les immortels qui n\'ont pas su monter.', 'Rien n\'y brille plus : une torche vous sera nécessaire.'],
        chests: [['fusang_crypt_nectar', 'Coupe de nectar séché', 'Une coupe d\'or où un nectar d\'immortalité a séché en perles ambrées.', 3],['fusang_crypt_rouleau', 'Rouleau scellé', 'Un rouleau scellé de cire d\'or, glissé dans une niche par un sage qui comptait revenir.', 2]],
        enemies: [['fusang_crypt_liche', '1', 'crypt_lich', 'Immortel Déchu des Branches', 'sentinel', 1, null, true],['fusang_crypt_savant', '2', 'arcane_scholar', 'Érudit des racines', 'sentinel', 0, null],['fusang_crypt_ombre', '5', 'bone_reaver', 'Gardien desséché', 'patrol', 0, ['5', '6']]]
    }
];

const cheb = (a, b) => Math.max(Math.abs(a.x - b[0]), Math.abs(a.y - b[1]));

function findEntrance(screen, occ, seed) {
    const danger = screen.enemies.flatMap(e => [[e.x, e.y], ...(e.patrol || []).map(p => (Array.isArray(p) ? p : [p.x, p.y]))]);
    const cells = [];
    for (let x = 1; x < screen.w - 1; x++) for (let y = 1; y < screen.h - 1; y++) {
        if (!occ.free(x, y) || occ.openNeighbors(x, y) < 3) continue;
        if ((screen.paths || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh)) continue;
        if (danger.some(d => cheb({ x, y }, d) < 4)) continue;
        const exitDist = Math.min(...screen.exits.filter(e => !e.door).map(e => Math.abs(e.x - x) + Math.abs(e.y - y)), 99);
        if (exitDist < 4) continue;
        cells.push({ x, y, exitDist });
    }
    cells.sort((a, b) => b.exitDist - a.exitDist || a.x - b.x || a.y - b.y);
    const top = cells.slice(0, 6);
    return top.length ? top[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % top.length] : null;
}

// Trésors des culs-de-sac : sans torche, ils sont presque introuvables. Un coffre au fond d'une impasse ne barre jamais un couloir.
const TREASURES = {
    cave: [['Filon de pièces', 'Dans la roche luit un filon de pièces fondues, que personne n\'a vu faute de lumière.'], ['Cachette de contrebandier', 'Une cache de contrebandier, dissimulée sous une dalle : des sacs de cuivre et d\'argent.'], ['Bourse d\'un égaré', 'Les os d\'un explorateur serrent encore sa bourse. Il n\'avait pas de torche non plus.'], ['Coffret moisi', 'Un coffret moisi mais bien rempli, calé dans une faille.'], ['Géode de pièces', 'Une géode creuse, tapissée de pièces collées par les siècles.'], ['Offrande aux esprits', 'Une offrande de pièces laissée aux esprits de la grotte par des mineurs superstitieux.'], ['Trésor oublié', 'Un trésor rangé là par quelqu\'un qui comptait revenir.'], ['Réserve du passeur', 'Une réserve soigneusement cachée au fond d\'une galerie.']],
    crypt: [['Offrande funéraire', 'Au pied d\'un sarcophage, des offrandes funéraires que les pilleurs n\'ont pas trouvées dans le noir.'], ['Urne cinéraire', 'Une urne cinéraire dont les cendres cachent des pièces d\'or.'], ['Coffret du défunt', 'Le coffret du défunt, resté à son côté pour l\'au-delà.'], ['Bourse du pilleur', 'Un pilleur de tombes est mort ici, la bourse pleine, sans trouver la sortie.'], ['Niche aux pièces', 'Une niche murée dissimule une poignée de pièces d\'argent anciennes.'], ['Reliquaire scellé', 'Un reliquaire scellé à la cire, intact.']]
};

function addTreasures(zone, u) {
    const rects = zone.obstacles;
    const blocked = (x, y) => x < 0 || y < 0 || x >= zone.w || y >= zone.h || rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
    const taken = new Set([...zone.chests, ...zone.enemies, ...zone.exits, zone.spawn, ...zone.enemies.flatMap(e => (e.patrol || []).map(p => ({ x: p[0], y: p[1] })))].map(e => `${e.x},${e.y}`));
    const near = (x, y) => zone.enemies.some(e => Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) <= 1);
    const ends = [];
    for (let y = 1; y < zone.h - 1; y++) for (let x = 1; x < zone.w - 1; x++) {
        if (blocked(x, y) || taken.has(`${x},${y}`) || near(x, y)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !blocked(x + dx, y + dy)).length <= 1) ends.push({ x, y });
    }
    const labels = TREASURES[u.layout];
    ends.forEach((p, i) => {
        const [label, openText] = labels[i % labels.length];
        zone.chests.push({ id: `${u.id}_tresor_${i + 1}`, label, openText, gold: 15 * u.level * (i % 3 === 2 ? 4 : 3), lootTier: i % 3 === 2 ? 3 : 2, x: p.x, y: p.y });
    });
}

const inBounds = (screen, p) => p.x > 0 && p.y > 0 && p.x < screen.w - 1 && p.y < screen.h - 1;

/**
 * Crée les cavernes / cryptes et les relie à leur zone sauvage (entrée sur une case de terre ferme, retour devant l'entrée).
 * À appeler après l'agrandissement des cartes : `screens` est complété.
 */
export function applyUnderground(screens) {
    UNDERGROUND.forEach(u => {
        const parent = screens[u.parent];
        if (!parent) return;
        const zone = buildZone({
            id: u.id, region: u.region, biome: 'cave', kind: 'wild', grid: GRIDS[u.layout],
            chests: u.chests.map(([id, label, openText, tier], i) => ({ id, at: i === 0 ? '3' : '4', label, openText, gold: 15 * u.level * tier, lootTier: Math.min(3, tier) })),
            enemies: u.enemies.map(([id, at, templateId, name, kind, offset, patrol, boss]) => ({ id, at, templateId, name, kind, offset, permanent: true, ...(patrol ? { patrol } : {}), ...(boss ? { boss: { name, level: u.level + 2 } } : {}) })),
            exits: []
        }, { npcDef: id => ({ id }), chestDef: id => ({ id }), screenText: () => ({ name: u.name, arrival: u.arrival }) });
        addTreasures(zone, u);
        zone.dark = true;
        zone.underground = true;

        // entrée sur la terre ferme, à bonne distance des sorties et des ennemis (jamais dans leur zone de vigilance)
        const pos = findEntrance(parent, occupancy(parent, screens), u.id);
        if (!pos) throw new Error(`souterrain ${u.id} : pas de place pour l'entrée dans ${u.parent}`);
        const back = freeNeighbor(parent, pos.x, pos.y);
        if (!back || !inBounds(parent, back)) throw new Error(`souterrain ${u.id} : pas de case de retour dans ${u.parent}`);
        parent.exits.push({ x: pos.x, y: pos.y, to: u.id, label: u.name, arrive: { ...zone.spawn } });
        zone.exits.push({ x: 0, y: zone.spawn.y, to: u.parent, label: 'Remonter à la surface', arrive: back });
        screens[u.id] = zone;
    });
    return screens;
}

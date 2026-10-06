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
        '#.#.#.#######.##...#',
        '####################'
    ]
};

export const UNDERGROUND = [
    {
        id: 'fleuve_cave', parent: 'fleuve_wild', region: 'fleuve', level: 2, layout: 'cave', name: 'Grotte des Limons',
        entrance: 'Entrée de la Grotte des Limons',
        arrival: ['Sous la berge, une bouche de boue séchée s\'enfonce dans la terre. L\'air y sent la vase et le temps arrêté.', 'Sans lumière, vous n\'y verrez presque rien. Une torche aiderait.'],
        chests: [['fleuve_cave_urne', 'Urne des limons', 'Au fond d\'une niche, une urne scellée de vase durcie : des pièces de cuivre, grises comme le fleuve.', 3], ['fleuve_cave_bac', 'Bac du passeur noyé', 'Un coffre de passeur, rongé par l\'humidité, a gardé sa cargaison : de l\'or que personne n\'est venu réclamer.', 2]],
        enemies: [['fleuve_cave_gardien', '1', 'bone_reaver', 'Passeur des limons', 'sentinel', 1], ['fleuve_cave_ombre', '2', 'shadow_assassin', 'Ombre de la grotte', 'sentinel', 0], ['fleuve_cave_serpent', '5', 'deep_sea_serpent', 'Serpent des galeries', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'bambous_crypt', parent: 'bambous_wild', region: 'bambous', level: 3, layout: 'crypt', name: 'Crypte des Moines Cendrés',
        entrance: 'Escalier de la Crypte des Moines',
        arrival: ['Une dalle fendue révèle un escalier de pierre noircie. Les moines ont enterré ici ce que le feu n\'a pas pu détruire.', 'Il y fait nuit noire. Sans torche, vous avancerez à tâtons.'],
        chests: [['bambous_crypt_ossuaire', 'Ossuaire des moines', 'Parmi les urnes funéraires, un reliquaire de bois noirci : des offrandes que nul pèlerin n\'est venu reprendre.', 3], ['bambous_crypt_niche', 'Niche du sutra', 'Une niche creusée dans le mur abrite des pièces d\'offrande, serrées dans un linge de soie brûlé.', 2]],
        enemies: [['bambous_crypt_abbe', '1', 'temple_warden', 'Abbé de cendre', 'sentinel', 1], ['bambous_crypt_ombre', '2', 'shadow_assassin', 'Ombre des cryptes', 'sentinel', 0], ['bambous_crypt_moine', '5', 'bone_reaver', 'Moine sans visage', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'gobi_crypt', parent: 'gobi_wild', region: 'gobi', level: 5, layout: 'crypt', name: 'Crypte Ensablée',
        entrance: 'Trappe de la Crypte Ensablée',
        arrival: ['Entre deux dunes, le vent a dégagé une trappe de pierre. En dessous, l\'ombre d\'un tombeau de caravaniers que le sable a oublié.', 'Sans torche, vous ne distinguerez que vos propres pas.'],
        chests: [['gobi_crypt_sarcophage', 'Sarcophage du marchand', 'Un sarcophage de bois peint, déjà entrouvert : le marchand a emporté peu de chose, mais assez pour vous.', 3], ['gobi_crypt_amphore', 'Amphore des caravanes', 'Une amphore scellée à la poix, pleine de pièces d\'argent venues de très loin.', 2]],
        enemies: [['gobi_crypt_gardien', '1', 'sand_colossus', 'Colosse de la crypte', 'sentinel', 1], ['gobi_crypt_voleur', '2', 'shadow_assassin', 'Pilleur de tombes', 'sentinel', 0], ['gobi_crypt_momie', '5', 'bone_reaver', 'Caravanier momifié', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'volcan_cave', parent: 'volcan_wild', region: 'volcan', level: 9, layout: 'cave', name: 'Cavernes de Basalte',
        entrance: 'Faille des Cavernes de Basalte',
        arrival: ['Une faille noire fume au pied de la paroi. Derrière elle, des galeries de basalte que la lave a creusées puis abandonnées.', 'La roche y avale la lumière : sans torche, vous ne verrez presque rien.'],
        chests: [['volcan_cave_geode', 'Géode de braise', 'Une géode fendue laisse couler de l\'or fondu, figé en perles rousses.', 3], ['volcan_cave_forge', 'Forge oubliée', 'Une forge de mineurs, froide depuis des siècles, et un coffret de fer qu\'aucun feu n\'a pu ouvrir.', 2]],
        enemies: [['volcan_cave_behemoth', '1', 'lava_behemoth', 'Béhémoth des galeries', 'sentinel', 1], ['volcan_cave_loup', '2', 'ember_wolf', 'Loup des cavernes', 'sentinel', 0], ['volcan_cave_salamandre', '5', 'ember_dragon', 'Salamandre aveugle', 'patrol', 0, ['5', '6']]]
    },
    {
        id: 'lune_crypt', parent: 'lune_wild', region: 'lune', level: 16, layout: 'crypt', name: 'Crypte du Lièvre de Jade',
        entrance: 'Escalier de la Crypte du Lièvre',
        arrival: ['Sous la poussière d\'argent, un escalier descend vers une crypte où dorment les premiers pilons de jade.', 'Aucune lune n\'éclaire ces marches : il vous faudra une torche.'],
        chests: [['lune_crypt_reliquaire', 'Reliquaire de jade', 'Un reliquaire de jade blanc, froid comme la lune : des perles d\'argent y dorment depuis l\'aube des temps.', 3], ['lune_crypt_pilon', 'Pilon d\'argent', 'Un pilon et son mortier, oubliés dans une alcôve, avec une bourse de pièces d\'argent lunaire.', 2]],
        enemies: [['lune_crypt_vampire', '1', 'void_vampire', 'Jiangshi de la crypte', 'sentinel', 1], ['lune_crypt_sorciere', '2', 'ice_witch', 'Gardienne de givre', 'sentinel', 0], ['lune_crypt_ombre', '5', 'shadow_assassin', 'Ombre de jade', 'patrol', 0, ['5', '6']]]
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
            chests: u.chests.map(([id, label, openText, tier], i) => ({ id, at: i === 0 ? '3' : '4', label, openText, gold: 15 * u.level * tier })),
            enemies: u.enemies.map(([id, at, templateId, name, kind, offset, patrol]) => ({ id, at, templateId, name, kind, offset, permanent: true, ...(patrol ? { patrol } : {}) })),
            exits: []
        }, { npcDef: id => ({ id }), chestDef: id => ({ id }), screenText: () => ({ name: u.name, arrival: u.arrival }) });
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

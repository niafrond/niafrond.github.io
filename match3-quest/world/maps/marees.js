// Région 9 bis — Hautes-Eaux de la Lune Montante (world/PLAN-MAREES.md) : entre le Fusang et la Lune, trois zones et un autel.
//
//   fusang ─► marees_road   Haute Mer des Pontons   (zone 1, exploration + combat : digue sûre, pontons de repos, tout le reste est eau)
//          ─► marees_village Shuiyu-sous-l'Eau       (zone 2, village sans combat : maisons sur pilotis à demi submergées)
//          ─► marees_wild   Gouffre des Mirages     (zone 3, exploration + combat vers le boss : eau plus dense, moins de pontons)
//          ─► marees        Autel de Mazu           (sanctuaire sans soleil : Changxi et l'épreuve de bravoure) ─► lune
//
// Le format de région impose la chaîne route ─► village ─► zone sauvage ─► sanctuaire : la zone 1 est donc la « route » (`marees_road`),
// la zone 3 la « zone sauvage » (`marees_wild`). Cartes natives (format v2). L'eau (`~`) bloque sans le Pas de Yu (quête `sq_pas_de_yu`)
// et déclenche des rencontres aquatiques : `grass: { water: true, table }` donne à chaque zone de combat sa propre table, sans case « " ».
// Jamais `aquatic` : un écran aquatique rendrait l'eau toujours franchissable et supprimerait le verrou voulu.
// Légende : ~ eau (hautes herbes marines) · = ponton / passerelle · . digue, planches · # rocher, pieu · A-C bâtiments sur pilotis · W pierre de voyage.

const grid = (w, h, fill = '~') => Array.from({ length: h }, () => Array(w).fill(fill));
const put = (g, x, y, ch) => { g[y][x] = ch; };
const fill = (g, x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
// Bâtiment sur pilotis : lettre majuscule sur toute la surface, porte en minuscule au milieu de la rangée du bas.
const house = (g, x0, y0, x1, y1, letter) => {
    fill(g, x0, y0, x1, y1, letter);
    put(g, Math.round((x0 + x1) / 2), y1, letter.toLowerCase());
};
const rows = g => g.map(r => r.join(''));

// ── Zone 1 : Haute Mer des Pontons (48×22) ─────────────────────────────────────────────────────────────────────────────────────────
// Pontons d'UNE case de large (planche de pêcheur) : chaque ponton est un îlot séparé par de l'eau (le Pas de Yu les relie). Coffres, ennemis et
// PNJ sont posés sur de petites avancées d'une case, jamais sur la planche elle-même, pour ne pas la barrer.
const road = grid(48, 22);
fill(road, 0, 8, 7, 13, '.');                 // Digue des Dernières Racines : seule terre ferme, sûre
fill(road, 0, 7, 7, 7, '#'); fill(road, 0, 14, 7, 14, '#');
fill(road, 7, 10, 12, 10, '=');               // ponton de la Dernière Racine : relié à la digue, premier relais
fill(road, 20, 4, 20, 9, '=');                // ponton des Trois Lanternes (vertical)
put(road, 21, 5, '=');                        // avancée : coffre de l'anneau
fill(road, 27, 15, 33, 15, '=');              // ponton du Sel Rouge, gardé par des crabes
fill(road, 28, 14, 28, 14, '='); fill(road, 30, 14, 30, 14, '='); fill(road, 32, 14, 32, 14, '='); put(road, 30, 16, '=');
fill(road, 38, 4, 38, 9, '='); put(road, 39, 6, '=');          // ponton du Cormoran Veuf (vertical)
fill(road, 41, 10, 44, 10, '=');              // dernier ponton, vers Shuiyu-sous-l'Eau
fill(road, 45, 9, 47, 11, '=');               // accostage de 3 cases (passage de bord)
put(road, 0, 10, '<'); put(road, 2, 10, 'S'); put(road, 6, 11, '1');
put(road, 21, 5, 'i'); put(road, 30, 16, 'j'); put(road, 39, 6, 'k');
put(road, 28, 14, '2'); put(road, 30, 14, '3'); put(road, 32, 14, '4');
put(road, 47, 10, '>');

// ── Zone 2 : Shuiyu-sous-l'Eau, village sur pilotis (30×22) ──────────────────────────────────────────────────────────────────────────
const village = grid(30, 22);
fill(village, 0, 10, 29, 12, '=');            // grande passerelle est-ouest (3 rangées : passages de bord de 3 cases)
house(village, 3, 5, 7, 8, 'A'); fill(village, 5, 9, 5, 9, '=');            // cabane des cormorans
house(village, 11, 5, 15, 8, 'B'); fill(village, 13, 9, 13, 9, '=');        // petit temple de Mazu
house(village, 19, 5, 23, 8, 'C'); fill(village, 21, 9, 21, 9, '=');        // atelier des bateaux-lanternes
fill(village, 14, 13, 14, 17, '='); fill(village, 6, 17, 14, 17, '=');       // passerelle vers le quartier sud
fill(village, 15, 13, 24, 16, '=');           // radeau-marché de Maître Tang
fill(village, 6, 13, 6, 16, '=');             // quai du charpentier
put(village, 0, 11, '<'); put(village, 29, 11, '>'); put(village, 2, 12, 'S'); put(village, 26, 12, 'W');
put(village, 20, 14, '2'); put(village, 9, 11, '3'); put(village, 7, 15, '5'); put(village, 24, 11, '6');
put(village, 10, 17, 'j'); put(village, 22, 16, 'k'); put(village, 27, 10, 'm');

// ── Zone 3 : Gouffre des Mirages (48×24) ───────────────────────────────────────────────────────────────────────────────────────────
const deep = grid(48, 24);
fill(deep, 0, 11, 2, 13, '=');                // accostage d'arrivée de 3 cases, relié au village
fill(deep, 3, 12, 7, 12, '=');                // premier ponton
fill(deep, 12, 6, 12, 11, '='); put(deep, 13, 7, '=');                           // ponton des Racines noyées : coffre sur l'avancée
fill(deep, 17, 17, 23, 17, '='); put(deep, 20, 18, '='); put(deep, 19, 16, '=');  // ponton du Cormoran Veuf : coffre et cormoran-fantôme
fill(deep, 29, 5, 29, 10, '='); put(deep, 30, 6, '='); put(deep, 28, 6, '='); put(deep, 28, 8, '='); put(deep, 30, 9, '=');   // ponton du Sel Rouge : four à sel flottant
fill(deep, 35, 15, 41, 15, '='); put(deep, 38, 16, '='); put(deep, 38, 14, '=');  // autel du Dragon-Roi : urne de riz, gardée par une tortue des récifs
fill(deep, 42, 12, 44, 12, '=');
fill(deep, 45, 11, 47, 13, '=');              // dernier accostage, vers l'Autel de Mazu
put(deep, 0, 12, '<'); put(deep, 47, 12, '>');
put(deep, 13, 7, 'i'); put(deep, 20, 18, 'j'); put(deep, 28, 8, 'k'); put(deep, 38, 16, 'l');
put(deep, 38, 14, '2'); put(deep, 30, 6, '1'); put(deep, 19, 16, '3'); put(deep, 28, 6, '4'); put(deep, 30, 9, 'm');

// ── Sanctuaire : Autel de Mazu (30×16) ───────────────────────────────────────────────────────────────────────────────────────────────
const altar = grid(30, 22);
// Carte native 30×22. Une passerelle de 3 cases de large mène du pavillon à la sortie ; l'eau autour est infranchissable ici, et Changxi barre le passage (piliers de la jonction gardée).
fill(altar, 0, 9, 5, 11, '=');                // ponton d'arrivée (3 cases de large : passage de bord)
fill(altar, 6, 10, 11, 10, '=');              // passerelle vers le pavillon
fill(altar, 12, 6, 21, 14, '=');              // pavillon laqué
fill(altar, 12, 5, 21, 5, '#'); fill(altar, 12, 15, 21, 15, '#');
fill(altar, 22, 9, 29, 11, '=');              // passerelle de Changxi puis dernier ponton, vers la Lune
put(altar, 0, 10, '<'); put(altar, 2, 10, 'S'); put(altar, 29, 10, '>'); put(altar, 3, 9, 'W');
put(altar, 27, 10, '1'); put(altar, 24, 10, '2');

// Table de rencontres : zone 1, aquatique « courante » ; zone 3, plus dense et plus forte (Changxi attend au bout).
const roadTable = [
    { templateId: 'crabe_soldat', name: 'Crabe-soldat des bancs', weight: 5, offset: -1 },
    { templateId: 'carpe_doree', name: 'Carpe dorée des pontons', weight: 4, offset: 0 },
    { templateId: 'hai_she', name: 'Serpent des tourbillons', weight: 3, offset: 0 },
    { templateId: 'shuimu_denglong', name: 'Méduse-lanterne', weight: 3, offset: 0 },
    { templateId: 'lu_ci_gui', name: 'Cormoran-fantôme', weight: 2, offset: 0 },
    { templateId: 'ren_yu', name: 'Sirène chantante', weight: 1, offset: 1 }
];
const deepTable = [
    { templateId: 'baoyu_jian', name: 'Poisson-épée de tempête', weight: 4, offset: 0 },
    { templateId: 'hai_ma_xing', name: "Hippocampe-lancier", weight: 4, offset: 0 },
    { templateId: 'shuimu_denglong', name: 'Méduse-lanterne des abîmes', weight: 3, offset: 1 },
    { templateId: 'hai_she', name: 'Serpent des tourbillons', weight: 3, offset: 1 },
    { templateId: 'ren_yu', name: 'Sirène des mirages', weight: 3, offset: 1 },
    { templateId: 'lu_ci_gui', name: 'Cormoran-fantôme', weight: 2, offset: 1 },
    { templateId: 'hai_gui', name: 'Tortue des récifs', weight: 1, offset: 1 },
    { templateId: 'jiaolong', name: 'Jiaolong des hautes eaux', weight: 1, offset: 2 }
];

export default {
    road: {
        id: 'marees_road', biome: 'tides', native: true,
        grid: rows(road),
        exits: [{
            at: '>', to: 'marees_village', label: "Shuiyu-sous-l'Eau", requires: 'sq_pas_de_yu',
            lockedMessage: "Devant vous, l'escalier de la digue s'enfonce dans la mer noire. Nulle barque ne reste : pour y marcher, il faudrait connaître la démarche de Yu."
        }],
        grass: { water: true, rate: 0.12, safeSteps: 3, table: roadTable },
        npcs: [{ id: 'marees_road_xu', at: '1' }],
        chests: [
            { id: 'marees_anneau_chest', at: 'i', gold: 300 },
            { id: 'marees_road_salt', at: 'j', gold: 450 },
            { id: 'marees_road_widow', at: 'k', gold: 450 }
        ],
        enemies: [
            { id: 'marees_crab_a', at: '2', templateId: 'crabe_soldat', name: 'Crabe-soldat du ponton', kind: 'sentinel', offset: 0, group: 'marees_crabs', permanent: true },
            { id: 'marees_crab_b', at: '3', templateId: 'crabe_soldat', name: 'Crabe-soldat du ponton', kind: 'sentinel', offset: 0, group: 'marees_crabs', permanent: true },
            { id: 'marees_crab_c', at: '4', templateId: 'crabe_soldat', name: 'Crabe-soldat du ponton', kind: 'sentinel', offset: 0, group: 'marees_crabs', permanent: true }
        ]
    },

    village: {
        id: 'marees_village', biome: 'tides', native: true,
        grid: rows(village),
        npcs: [
            { id: 'merchant_marees', at: '2' },
            { id: 'marees_village_canne', at: '3' },
            { id: 'marees_village_hu', at: '5' },
            { id: 'marees_village_jiaoxia', at: '6' }
        ],
        chests: [
            { id: 'marees_village_nets', at: 'j', gold: 240, label: 'Filet de pêche roulé', openText: 'Dans un filet roulé sur le quai, quelques pièces mouillées et un hameçon en bronze.' },
            { id: 'marees_village_raft', at: 'k', gold: 480, puzzle: 'marees_charrette', label: 'Caisse du radeau-marché', openText: 'Une caisse de sel et de monnaie, que Maître Tang jure ne pas avoir perdue.' },
            { id: 'marees_village_roof', at: 'm', gold: 300, puzzle: 'marees_jarres', label: 'Jarre sur le toit', openText: 'Une jarre coincée entre deux pieux, pleine de pièces de cuivre salées.' }
        ]
    },

    wild: {
        id: 'marees_wild', biome: 'tides', native: true,
        grid: rows(deep),
        grass: { water: true, rate: 0.16, safeSteps: 3, table: deepTable },
        gate: {
            requires: 'marees_compass_chest',
            lockedMessage: "Devant vous, le chemin de pontons se perd dans un mirage : une cité de lanternes que la mer dessine et efface. Il faudrait la boussole de jade de Mazu, quelque part sur le four à sel, pour voir les vrais pontons."
        },
        npcs: [{ id: 'marees_deep_salter', at: '1' }],
        chests: [
            { id: 'marees_deep_root', at: 'i', gold: 450 },
            { id: 'marees_deep_widow', at: 'j', gold: 450 },
            { id: 'marees_deep_salt', at: 'k', gold: 600 },
            { id: 'marees_riz_chest', at: 'l', gold: 450 },
            { id: 'marees_compass_chest', at: 'm', gold: 300 }
        ],
        enemies: [
            { id: 'marees_hai_gui', at: '2', templateId: 'hai_gui', name: 'Tortue des récifs gardienne de l\'urne', kind: 'sentinel', offset: 1, permanent: true },
            { id: 'marees_deep_cormorant', at: '3', templateId: 'lu_ci_gui', name: 'Cormoran-fantôme du ponton', kind: 'sentinel', offset: 1 },
            { id: 'marees_deep_mirage', at: '4', templateId: 'shuimu_denglong', name: 'Méduse des mirages', kind: 'sentinel', offset: 1, permanent: true }
        ]
    },

    interiors: [
        {
            id: 'marees_h_cormoran', house: 'A',
            grid: [
                '##########',
                '#.1......#',
                '#..###...#',
                '#2.......#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [{ id: 'marees_village_ling', at: '1' }],
            chests: [{ id: 'marees_h_cormoran_box', at: '2', gold: 150 }]
        },
        {
            id: 'marees_h_temple', house: 'B',
            grid: [
                '############',
                '#.1......2.#',
                '#....###...#',
                '#..........#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [{ id: 'marees_village_nonne_mo', at: '1' }],
            chests: [{ id: 'marees_h_temple_box', at: '2', gold: 240 }]
        },
        {
            id: 'marees_h_lanternes', house: 'C',
            grid: [
                '##########',
                '#......1.#',
                '#..###...#',
                '#2.......#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [{ id: 'marees_village_lanterne', at: '1' }],
            chests: [{ id: 'marees_cire_chest', at: '2', gold: 150 }]
        }
    ],

    sanctuary: {
        id: 'marees', waypoint: { x: 3, y: 9 }, native: true,
        grid: rows(altar),
        places: {
            changxi: '1',
            changxi_calm: '2'
        }
    }
};

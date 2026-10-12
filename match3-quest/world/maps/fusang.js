// Région 9 — Cime du Fusang : Terrasses de Fusang-le-Bas, Perchoir des Grues, Racines Géantes, Racines et Branches Dorées, cinq maisons.
// Cartes natives (format v2, world/DESIGN-V2.md) : village 32×28, hameau 28×22, route 44×16, zone sauvage 48×24, sanctuaire 30×22.
// Légende : # racines/murs de terrasse · = escalier/ruelle/pont · ~ sève dorée, nuages bas · " hautes herbes dorées · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'fusang_village', biome: 'fusang', native: true,
        grid: [
            '~~~~~~~~~~~~~##^##~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~##..#~~~~~~~~~~~~~~',
            '~~###########.....############~~',
            '~~##...........==............#~~',
            '~~#.AAAAA.BBBBB==.CCCCC....#.#~~',
            '~~#.AAAAA.BBBBB==.CCCCC....#.#~~',
            '~~#.AAaAA.BBbBB==.CCcCC....#o#~~',
            '~~#========================###~~',
            '~~#.....#....6.==....#7.....##~~',
            '~~####==#######==#######==####~~',
            '~~#i.......==========.8.~~~~.#~~',
            '##.##......=1=====W==..~~~~~~.##',
            '##.....0...==========...~~~~..##',
            '<.============================.>',
            '##============================##',
            '##.##......==S=====2=3...94##.##',
            '~~##.....5.==========.......##~~',
            '~~#==========================#~~',
            '~~#DDDDDD....p.==......EEEEEE#~~',
            '~~#DDDDDD.#####==#####.EEEEEE#~~',
            '~~#DDDdDD.#....==....#.EEEeEE#~~',
            '~~#...=...#....==....#....=..#~~',
            '~~###==##.#.m..==..n.#.##==###~~',
            '~~##j...#.#....==....#.#...k##~~',
            '~~#######.#####==#####.#######~~',
            '~~#############...############~~',
            '~~~~~~~~~~~~~##..#~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~##v##~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_fusang', at: 'p' },
            { id: 'hua_fusang', at: '1' },
            { id: 'child_yuer', at: '2' },
            { id: 'phoenix_chick', at: '3' },
            { id: 'oxherd_niulang', at: '0' },
            { id: 'gatekeeper_men', at: '4' },
            { id: 'star_child_xing', at: '5' },
            { id: 'honey_keeper_mi', at: '6' },
            { id: 'cloud_sweeper_yun', at: '7' },
            { id: 'stair_mason_shi', at: '8' },
            { id: 'kite_boy_feng', at: '9' }
        ],
        chests: [
            { id: 'terrace_urn', at: 'i', gold: 135, label: 'Urne de la terrasse', openText: 'Une urne dorée posée au pied d\'un mur de terrasse : quelques sous et une odeur de miel.' },
            { id: 'fusang_garden_a', at: 'j', gold: 225, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'fusang_garden_b', at: 'k', gold: 225, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'fusang_market_a', at: 'm', gold: 450, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'fusang_market_b', at: 'n', gold: 450, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' },
            { id: 'fusang_village_nook', at: 'o', gold: 270 }
        ]
    },

    hamlet: {
        id: 'fusang_hamlet', biome: 'fusang', native: true,
        grid: [
            '~~~~~~~~~~~~#~^~#~~~~~~~~~~~',
            '~~~~~~~~~~~~#~=~#~~~~~~~~~~~',
            '~~##~~~~~~###~=~###~~~~~##~~',
            '~~~~~~~~~~###.=.###~~~~~~~~~',
            '~~~~~~~..###..=..###.~~~~~~~',
            '~~~~~.........=........~~~~~',
            '~~~##.AAAAA...=..BBBBB..~~~~',
            '~~~...AAAAA...=..BBBBB...~~~',
            '~~#...AAAAA...=..BBBBB.###~~',
            '~~###.AAaAA...=..BBbBB.###~~',
            '~.###==================..#.~',
            '~.#...........=..........~~~',
            '~.#..........S=.........=j~~',
            '~.#.........1.=...2......~~~',
            '~~#.....0.....=..........#~~',
            '~~#...3.............W....#~~',
            '~~~....................##~~~',
            '~~~~.###.i..........###.~~~~',
            '~~~~~###............###~~~~~',
            '~~##~~~##############~~~##~~',
            '~~~~~~~~~~~......~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'weaver_zhinu', at: '0' },
            { id: 'pilgrim_wuya', at: '1' },
            { id: 'paper_dragon_long', at: '2' },
            { id: 'crane_apprentice_ling', at: '3' }
        ],
        chests: [
            { id: 'loom_chest', at: 'i', gold: 135 },
            { id: 'fusang_hamlet_pier', at: 'j', gold: 270 }
        ]
    },

    road: {
        id: 'fusang_road', biome: 'fusang', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '##########################################~~',
            '.....#...#.#########.~~....#######.##..j.#~~',
            '<==.##.......#####...~~....................#',
            '...=...4......###....~~........5..##........',
            '##..==........##.....~~.........==##=======>',
            '~.#...=.......##.....~~..#...===..##........',
            '~.#....==.....##=========#===....###........',
            '~.#....."==...##2....==.....3...""##.....#..',
            '~.#..."""""====....1.~~...........##.....#.~',
            '~~##.."""""""........~~..###..#.####.....#~~',
            '~~#.....""".########.~~......##.####.....#~~',
            '~~#######i###########~~########k##########~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.1,
            table: [
                { templateId: 'goblin_saboteur', name: 'Renard des pétales', weight: 5, offset: -1 },
                { templateId: 'forest_guardian', name: 'Esprit des racines', weight: 4, offset: 0 },
                { templateId: 'storm_wyrm', name: 'Serpent de sève', weight: 2, offset: 0 },
                { templateId: 'sun_paladin', name: 'Garde solaire égaré', weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'root_surveyor_gen', at: '1' }
        ],
        chests: [
            { id: 'fusang_road_chest_a', at: 'i', gold: 135 },
            { id: 'fusang_road_chest_b', at: 'j', gold: 270 },
            { id: 'fusang_road_hidden', at: 'k', gold: 405 }
        ],
        enemies: [
            { id: 'fusang_road_spirit', at: '2', templateId: 'forest_guardian', name: 'Esprit de la racine géante', kind: 'sentinel', offset: 0 },
            { id: 'fusang_road_monkey', at: '3', templateId: 'goblin_saboteur', name: 'Singe-démon pillard', kind: 'sentinel', offset: -1 },
            { id: 'fusang_road_wyrm', at: '4', templateId: 'storm_wyrm', name: 'Serpent de sève', kind: 'patrol', patrol: ['4', [7, 12]], offset: 0 },
            { id: 'fusang_road_hopper', at: '5', templateId: 'void_vampire', name: 'Jiangshi sauteur des racines', kind: 'patrol', patrol: ['5', [38, 5]], offset: 0 }
        ]
    },

    wild: {
        id: 'fusang_wild', biome: 'fusang', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~#####################k#################7######',
            '~~##..#.....4...t====.r..............l="""".....',
            '~~#....==========....=================""""""===>',
            '~~##.==...............................""""""....',
            '~~##===...##########..##....##########.##....###',
            '~~##===######j################################~~',
            '~~##===######.##########~~####################~~',
            '~~##===...1...#.#####...~~...##.......##.....#~~',
            '~~###..=======........======w....======....m.#~~',
            '~~###.p""""""o========..==...====......==....#.~',
            '~~#####""##"".9......q..~~.....#####.....=.#8#~~',
            '~~###################...~~....########..===.##~~',
            '~~####...##########6####~~##############===###~~',
            '~~#5.....n..#######.####################===###~~',
            '##..."#"..2.W######..##"""".######...#""""".##~~',
            '....""""".........===""""""..........."""""..#~~',
            '<.==""""".....====s.......=======u======.....#~~',
            '...."""""=====.......~~~~~~3...............###~~',
            '##.#.."..##.#........i~~~~..#####........#...#~~',
            '~~#################################....#######~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#...#~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#.v.#~~~~~~~~~'
        ],
        grass: {
            table: [
                { templateId: 'goblin_saboteur', name: 'Renard des pétales', weight: 5, offset: -1 },
                { templateId: 'forest_guardian', name: 'Esprit des mousses dorées', weight: 4, offset: 0 },
                { templateId: 'storm_wyrm', name: 'Serpent de sève', weight: 3, offset: 0 },
                { templateId: 'void_vampire', name: 'Jiangshi des feuillages', weight: 2, offset: 0 },
                { templateId: 'crystal_sage', name: 'Sage de jade des herbes', weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'root_elder', at: '1' },
            { id: 'monkey_ji', at: '2' },
            { id: 'whale_kun', at: '3' },
            { id: 'wind_piper_fei', at: '4' }
        ],
        chests: [
            { id: 'seal_shard_a', at: '5', gold: 270 },
            { id: 'seal_shard_b', at: '6', gold: 270 },
            { id: 'seal_shard_c', at: '7', gold: 405 },
            { id: 'journal_page_fus', at: '8', gold: 135 },
            { id: 'peach_stash', at: '9', gold: 270 },
            { id: 'kun_scale_chest', at: 'i', gold: 405 },
            { id: 'fusang_wild_roots', at: 'j', gold: 405 },
            { id: 'fusang_wild_hive', at: 'k', gold: 270 }
        ],
        enemies: [
            { id: 'fusang_root_guard', at: 'l', templateId: 'sun_paladin', name: 'Garde solaire des racines', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Garde solaire des racines', level: 37 } },
            { id: 'fusang_jade_wraith', at: 'm', templateId: 'crystal_sage', name: 'Immortel de jade égaré', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fusang_w_moth', at: 's', templateId: 'void_vampire', name: 'Phalène des racines', kind: 'patrol', patrol: ['s', [27, 18]], offset: 0 },
            { id: 'fusang_w_wyrm', at: 't', templateId: 'storm_wyrm', name: 'Dragonnet de sève', kind: 'patrol', patrol: ['t', [26, 4]], offset: -1 },
            { id: 'fusang_w_scholar', at: 'n', templateId: 'arcane_scholar', name: 'Lettré des branches', kind: 'sentinel', offset: 0 },
            { id: 'fusang_thief_a', at: 'o', templateId: 'goblin_saboteur', name: 'Singe-démon voleur', kind: 'sentinel', offset: 0, permanent: true, group: 'peach_thieves' },
            { id: 'fusang_thief_b', at: 'p', templateId: 'goblin_saboteur', name: 'Singe-démon voleur', kind: 'sentinel', offset: 0, permanent: true, group: 'peach_thieves' },
            { id: 'fusang_frost_wyrm', at: 'q', templateId: 'frost_dragon', name: 'Long de givre égaré', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fusang_w_wolf', at: 'u', templateId: 'ember_wolf', name: 'Loup de braise des terrasses', kind: 'patrol', patrol: ['u', [38, 19]], offset: 0 },
            { id: 'fusang_w_mist', at: 'w', templateId: 'void_vampire', name: 'Jiangshi de la brume dorée', kind: 'patrol', patrol: ['w', [35, 10]], offset: 0 },
            { id: 'fusang_w_general', at: 'r', templateId: 'storm_knight', name: 'Général des nuées égaré', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'sq_sceau_racines',
            lockedMessage: 'Le sceau de la Reine Mère qui protège la cime est brisé : il faut en retrouver les trois éclats, cachés dans les racines, avant de monter.'
        }
    },

    interiors: [
        {
            id: 'fusang_h_grue', house: 'A',
            grid: [
                '###########',
                '#....1....#',
                '#..#####..#',
                '#.........#',
                '#.......2.#',
                '#....S....#',
                '#####v#####'
            ],
            npcs: [
                { id: 'crane_envoy', at: '1' }
            ],
            chests: [
                { id: 'crane_feather_box', at: '2', gold: 135 }
            ]
        },
        {
            id: 'fusang_h_cueilleur', house: 'B',
            grid: [
                '############',
                '#.##....##.#',
                '#.##.1..##.#',
                '#..........#',
                '#.........2#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'picker_tao', at: '1' }
            ],
            chests: [
                { id: 'peach_basket', at: '2', gold: 270 }
            ]
        },
        {
            id: 'fusang_h_astronome', house: 'C',
            grid: [
                '##########',
                '#..#..#..#',
                '#..#..#..#',
                '#...1....#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'astronomer_xing', at: '1' }
            ],
            chests: []
        },
        {
            id: 'fusang_h_temple', house: 'D',
            grid: [
                '##########',
                '#.#.#.#.##',
                '#........#',
                '#...1....#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'acolyte_ri', at: '1' }
            ],
            chests: []
        },
        {
            id: 'fusang_h_chambre', house: 'E',
            grid: [
                '############',
                '#.1......2.#',
                '#...####...#',
                '#...####...#',
                '#..........#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'teamaster_you', at: '1' }
            ],
            chests: [
                { id: 'teapot_chest', at: '2', gold: 135 }
            ]
        },
        {
            id: 'fusang_h2_grues', house: 'A', in: 'hamlet',
            grid: [
                '##########',
                '#...1....#',
                '#........#',
                '#.###....#',
                '#5.......#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'crane_elder_hegu', at: '1' }
            ],
            chests: [
                { id: 'crane_pavilion_box', at: '5', gold: 135 }
            ]
        },
        {
            id: 'fusang_h2_encens', house: 'B', in: 'hamlet',
            grid: [
                '##########',
                '#...1....#',
                '#........#',
                '#....###.#',
                '#.......5#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'incense_lanxiang', at: '1' }
            ],
            chests: [
                { id: 'incense_chest', at: '5', gold: 270 }
            ]
        }
    ],

    sanctuary: {
        id: 'fusang', waypoint: { x: 4, y: 15 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~##########################~~',
            '~~##########.3.........#####~~',
            '~~######.#....~~~~~~.2...###~~',
            '~~####i....#..~~~~~~....#.##~~',
            '~~###..................7......',
            '~~###..........#...#.......1..',
            '~~####..........###........9.>',
            '~~#####.......#.###.#.........',
            '~~#####.........###...........',
            '~~#####...4....#...#...8...#..',
            '~~#####.................#..#~~',
            '~~##........#.........##...#~~',
            '~~#.........5.......6.....##~~',
            '##..W....##...#.........####~~',
            '........#.###.........######~~',
            '<..S......##################~~',
            '....#....###################~~',
            '...#########################~~',
            '~~~~...~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        places: {
            sun_ten: '1',
            parley_sun9: '2',
            fusang_guard: '3',
            fusang_sage: '4',
            fusang_dragon: '5',
            fusang_vampire: '6',
            sun9_wardens_a: '7',
            sun9_wardens_b: '8',
            sun_9: '9',
            crane_nest: 'i'
        }
    }
};

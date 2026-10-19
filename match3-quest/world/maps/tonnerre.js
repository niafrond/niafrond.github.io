// Région 5 — Monts du Tonnerre : Village des Forges-Éclairs, Crêtes Foudroyées, cinq maisons (format v2 : cartes natives).
// Légende : # roc/paratonnerre/murs · ~ torrent · = ruelle/marche/pont de corde · " hautes herbes · A-E bâtiments (porte minuscule) · W pierre de voyage.
// Chaîne : Désert de Gobi ─► Escalier des Crêtes (road) ─► Village des Forges-Éclairs ─► Crêtes Foudroyées ─► sanctuaire ; hameau au sud des crêtes.

export default {
    village: {
        id: 'tonnerre_village', biome: 'storm', native: true,
        grid: [
            '~~~~~~~~~~~~~~.^.~~~~~~~~~~~~~~~',
            '~#############.=.##############~',
            '~#############.=.##############~',
            '~####....CCCC#.=..BBBBB.EEEEE##~',
            '~##AAAAA.CCCC..=..BBBBB.EEEEE##~',
            '~##AAAAA.CCCC#.=.#BBBBB.EEEEE##~',
            '~##AAAAA.CCCC..=.#BBBBB.EEEEE##~',
            '~##AAAAA.CCCC..=##BBbBB.EEeEE##~',
            '~##AAaAA.CcCC##=....=.....=...#~',
            '~##.=========================.#~',
            '~##..=....===========.....=...#~',
            '~##..=.#...=W=======...#..=...#~',
            '.....=.....=========......=.....',
            '<==============================>',
            '...........=========........#...',
            '~##..~~~~..=#S=====#.........##~',
            '~####~~~~..=========...########~',
            '~##DDDDDDDD=...=#......#....###~',
            '~##DDDDDDDD=...=.#..........###~',
            '~##DDDDDDDD=...=...##..#....###~',
            '~##DDDDDDDD=...=......##....###~',
            '~##DDDdDDDD=...=.......########~',
            '~##.============.#....#.##...##~',
            '~##......#.....=...........####~',
            '~##....####..#.=........#..####~',
            '~##............=...........####~',
            '~#############.=.##############~',
            '~~~~~~~~~~~~~~.v.~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_tonnerre', x: 17, y: 11 },
            { id: 'kids_leimei', x: 13, y: 16 },
            { id: 'hua_tonnerre', x: 22, y: 12 },
            { id: 'bard_xiang', x: 8, y: 10 },
            { id: 'rain_pu', x: 13, y: 21 },
            { id: 'porter_san', x: 21, y: 16 },
            { id: 'tonnerre_village_roper', x: 27, y: 10 },
            { id: 'tonnerre_village_counter', x: 4, y: 11 },
            { id: 'tonnerre_village_apprentice', x: 6, y: 12 },
            { id: 'tonnerre_village_baker', x: 19, y: 21 },
            { id: 'tonnerre_village_watchman', x: 25, y: 14 }
        ],
        chests: [
            { id: 'tonnerre_garden_a', x: 26, y: 19, gold: 105, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'tonnerre_garden_b', x: 4, y: 24, gold: 105, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'tonnerre_market_a', x: 18, y: 23, gold: 210, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'tonnerre_market_b', x: 21, y: 23, gold: 210, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' },
            { id: 'tonnerre_village_niche', x: 29, y: 8, gold: 150 }
        ]
    },

    hamlet: {
        id: 'tonnerre_hamlet', biome: 'storm', native: true,
        grid: [
            '~~~~~~~~~~~~~.^.~~~~~~~~~~~~',
            '~############.=.###########~',
            '~####.........=........####~',
            '~###..#.....#.=###...#..###~',
            '~##.AAAAAA#...=...BBBBBB###~',
            '~##.AAAAAA....=...BBBBBB.##~',
            '~##.AAAAAA....=...BBBBBB.##~',
            '~##.AAaAAA....=...BBbBBB.##~',
            '~##...=...###.=.....=....##~',
            '~##..==================..##~',
            '~##..#........=.......#..##~',
            '~##.#.##......S....#.....##~',
            '~##.....#.....=....#.....##~',
            '~##....###........###....##~',
            '~##....#.####.....#.#....##~',
            '~##....................#.##~',
            '~##..........#...........##~',
            '~##...#.....###........W.##~',
            '~###...#....#.#.###.....###~',
            '~####..................####~',
            '~##########################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'goat_yang', x: 10, y: 11 },
            { id: 'climber_dai', x: 21, y: 15 },
            { id: 'keeper_ao', x: 15, y: 15 },
            { id: 'tonnerre_hamlet_lichen_gatherer', x: 6, y: 15 }
        ],
        chests: [
            { id: 'goat_shed', x: 4, y: 16, gold: 75 },
            { id: 'tonnerre_hamlet_cairn_box', x: 22, y: 12, gold: 75 }
        ]
    },

    road: {
        id: 'tonnerre_road', biome: 'storm', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~##########################################~',
            '~##########################################~',
            '~####.....###############.......##.#......#~',
            '~####.....#############................#....',
            '~####.....###..#..................=========>',
            '~######.###..................##...=..##.....',
            '~######.##..............===========.......#~',
            '~##.###......============.................#~',
            '~#..#...##...=......##....................#~',
            '......========..#.........................#~',
            '<======".........#....##....##...........##~',
            '.""""""""~~~~.....##.......###....#########~',
            '~##""""".......############################~',
            '~##########################################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'tonnerre_road_pilgrim', x: 23, y: 6 }
        ],
        chests: [
            { id: 'tonnerre_road_sack', x: 20, y: 7, gold: 75 },
            { id: 'tonnerre_road_niche', x: 7, y: 3, gold: 150 },
            { id: 'tonnerre_road_ledge', x: 32, y: 12, gold: 75 }
        ],
        enemies: [
            { id: 'tonnerre_road_stair_guard', x: 16, y: 9, templateId: 'soldat_terre_cuite', name: 'Statue des marches', kind: 'sentinel', offset: 0 },
            { id: 'tonnerre_road_spark_imp', x: 28, y: 5, templateId: 'huli_jing', name: 'Jing d\'étincelles', kind: 'sentinel', offset: -1 },
            { id: 'tonnerre_road_stair_wyrm', x: 6, y: 13, templateId: 'yinglong', name: 'Serpenteau des marches', kind: 'patrol', patrol: [[6, 13], [14, 13]], offset: 0 },
            { id: 'tonnerre_road_gust_rider', x: 27, y: 9, templateId: 'assassin_masque', name: 'Rôdeur de bourrasque', kind: 'patrol', patrol: [[27, 9], [35, 9]], offset: 0 },
            { id: 'tonnerre_road_lingzhi', x: 38, y: 7, templateId: 'lingzhi_maudit', name: 'Lingzhi foudroyé', kind: 'sentinel', offset: 0 }
        ],
        grass: {
            rate: 0.1, safeSteps: 4,
            table: [
                { templateId: 'huli_jing', name: 'Jing des marches', weight: 5, offset: -1 },
                { templateId: 'lingzhi_maudit', name: 'Lingzhi des corniches', weight: 3, offset: 0 },
                { templateId: 'yinglong', name: 'Serpenteau de bruine', weight: 2, offset: 0 },
                { templateId: 'lei_gong', name: 'Éclaireur de l\'orage', weight: 1, offset: 1 }
            ]
        }
    },

    wild: {
        id: 'tonnerre_wild', biome: 'storm', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~##############################################~',
            '~#######.....####.......###~~~####........#####~',
            '~####.###...........#####..~~~.......###.######~',
            '~##...=======###======##===~~~...#....##...#....',
            '~##...=..#....#.""".......=======#=============>',
            '~####.=.###..""""""""".....===#.........##......',
            '~####.=#####...."""....##..~~~##....######..###~',
            '~####.=...#################~########......#####~',
            '~####.=...#####################...##......#####~',
            '~###..====#...#~~~#...........#.....#.......###~',
            '~###.#....=##..~~~...##.............#.......###~',
            '~###...##.============#=====#===##=======#..###~',
            '~###....#......===..W."""""##.........#==...###~',
            '~##~~..........~~~~~~.~~~~"""........~~==~..~##~',
            '~##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~==~~~~##~',
            '~##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~==~~~~##~',
            '~#.~~~~.~~~~~...........~~~~...~~......==....##~',
            '..........#.....##.......##.......#.#...=.....#~',
            '<======================#=================.....#~',
            '..""""""""""##........##....=....##"""""##....#~',
            '~#""""##"""#####..##........=...#####"#"""....#~',
            '~##########################.=.#################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~.v.~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'cairn_spirit', x: 11, y: 5 },
            { id: 'fairy_yun', x: 31, y: 4 },
            { id: 'pup_tuan', x: 13, y: 19 },
            { id: 'tonnerre_wild_rope_keeper', x: 37, y: 13 }
        ],
        chests: [
            { id: 'crest_cache', x: 3, y: 4, gold: 75 },
            { id: 'storm_gong_chest', x: 38, y: 8, gold: 150 },
            { id: 'lightning_vault', x: 32, y: 9, gold: 225 },
            { id: 'journal_page_ton', x: 9, y: 13, gold: 75 },
            { id: 'thunder_urn', x: 37, y: 21, gold: 150 },
            { id: 'peak_cache', x: 38, y: 2, gold: 225 },
            { id: 'tonnerre_wild_rope_box', x: 42, y: 13, gold: 75 }
        ],
        enemies: [
            { id: 'tonnerre_stone_lion', x: 38, y: 10, templateId: 'suanni', name: 'Lion-gardien fendu', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Lion-gardien fendu', level: 22 } },
            { id: 'tonnerre_crest_general', x: 21, y: 5, templateId: 'lei_gong', name: 'Général de la crête', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'tonnerre_w_wyrm', x: 14, y: 19, templateId: 'yinglong', name: 'Serpent d\'éclairs', kind: 'patrol', patrol: [[14, 19], [21, 19]], offset: 0 },
            { id: 'tonnerre_w_statue', x: 23, y: 11, templateId: 'soldat_terre_cuite', name: 'Statue de foudre', kind: 'patrol', patrol: [[23, 11], [30, 11]], offset: -1 },
            { id: 'tonnerre_w_ogre', x: 29, y: 19, templateId: 'shanxiao', name: 'Ogre des cimes', kind: 'sentinel', offset: 0 },
            { id: 'tonnerre_wyrm_calf', x: 7, y: 11, templateId: 'yinglong', name: 'Serpenteau d\'orage', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'tonnerre_rider_a', x: 34, y: 6, templateId: 'lei_gong', name: 'Cavalier de l\'orage', kind: 'sentinel', offset: 0, permanent: true, group: 'storm_riders' },
            { id: 'tonnerre_rider_b', x: 36, y: 5, templateId: 'lei_gong', name: 'Cavalier de l\'orage', kind: 'sentinel', offset: 0, permanent: true, group: 'storm_riders' },
            { id: 'tonnerre_wild_gust_imp', x: 12, y: 3, templateId: 'huli_jing', name: 'Jing des bourrasques', kind: 'patrol', patrol: [[12, 3], [18, 3]], offset: -1 },
            { id: 'tonnerre_wild_bridge_sentry', x: 30, y: 13, templateId: 'soldat_terre_cuite', name: 'Sentinelle du pont de corde', kind: 'patrol', patrol: [[30, 13], [34, 13]], offset: 0 },
            { id: 'tonnerre_wild_moss_horror', x: 6, y: 6, templateId: 'lingzhi_maudit', name: 'Champignon des corniches', kind: 'sentinel', offset: 0 },
            { id: 'tonnerre_wild_ridge_assassin', x: 43, y: 19, templateId: 'assassin_masque', name: 'Rôdeur des corniches', kind: 'sentinel', offset: 0 }
        ],
        grass: {
            rate: 0.12, safeSteps: 3,
            table: [
                { templateId: 'huli_jing', name: 'Jing des bourrasques', weight: 5, offset: -1 },
                { templateId: 'yinglong', name: 'Serpenteau d\'étincelles', weight: 4, offset: -1 },
                { templateId: 'lingzhi_maudit', name: 'Champignon à foudre', weight: 3, offset: 0 },
                { templateId: 'shanxiao', name: 'Ogre des corniches', weight: 2, offset: 0 },
                { templateId: 'suanni', name: 'Lion de pierre éveillé', weight: 1, offset: 1 }
            ]
        },
        gate: {
            requires: 'storm_gong_chest',
            lockedMessage: 'Le portail de pierre vers le sanctuaire reste muet : il ne s\'ouvrira qu\'au son du Gong d\'orage, enfermé dans un coffre de foudre sur les crêtes.'
        }
    },

    interiors: [
        {
            id: 'tonnerre_h_tie', house: 'A',
            grid: [
                '############',
                '#...####...#',
                '#...#..#...#',
                '#....1.....#',
                '#..........#',
                '#.2........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'smith_tie', at: '1' }
            ],
            chests: [
                { id: 'tie_anvil_box', at: '2', gold: 150 }
            ]
        },
        {
            id: 'tonnerre_h_lei', house: 'B',
            grid: [
                '##########',
                '#.#....#.#',
                '#.#.1..#.#',
                '#........#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'hermit_lei', at: '1' }
            ],
            chests: []
        },
        {
            id: 'tonnerre_h_tour', house: 'C',
            grid: [
                '##########',
                '#.1....2.#',
                '#...##...#',
                '#...##...#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'rodman_gang', at: '1' }
            ],
            chests: [
                { id: 'copper_chest', at: '2', gold: 75 }
            ]
        },
        {
            id: 'tonnerre_h_auberge', house: 'D',
            grid: [
                '############',
                '#.###......#',
                '#........1.#',
                '#.##..##...#',
                '#.##..##...#',
                '#.........2#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'innkeeper_pao', at: '1' },
                { id: 'monkey_sun', at: '2' }
            ],
            chests: []
        },
        {
            id: 'tonnerre_h_montagne', house: 'E',
            grid: [
                '##########',
                '#..####..#',
                '#...1....#',
                '#......2.#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'nun_ying', at: '1' }
            ],
            chests: [
                { id: 'offering_box', at: '2', gold: 75 }
            ]
        },
        {
            id: 'tonnerre_h2_garde', house: 'A', in: 'hamlet',
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
                { id: 'pass_guard_kuang', at: '1' }
            ],
            chests: [
                { id: 'guard_post_box', at: '5', gold: 75 }
            ]
        },
        {
            id: 'tonnerre_h2_verre', house: 'B', in: 'hamlet',
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
                { id: 'glassblower_ouyang', at: '1' }
            ],
            chests: [
                { id: 'glass_chest', at: '5', gold: 150 }
            ]
        }
    ],

    sanctuary: {
        id: 'tonnerre', waypoint: { x: 4, y: 9 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~############################~',
            '~###################.########~',
            '~######.###########......####~',
            '~###.....##########.......###~',
            '~###....#####.............###~',
            '~###.....###.............####~',
            '~###....##.........#.....#..#~',
            '~#......##.......###........#~',
            '~#..W..##...................#~',
            '...............##.............',
            '<..S...#.........###.........>',
            '......##.......###............',
            '~#...####........###........#~',
            '~#...#####.........##.......#~',
            '~##.######.#...............##~',
            '~###########...............##~',
            '~###########......###......##~',
            '~###########......###......##~',
            '~###########......####.######~',
            '~############################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        places: {
            parley_sun5: [24, 16],
            tonnerre_knight: [13, 6],
            tonnerre_warden: [15, 17],
            thunder_wyrm: [22, 4],
            sun5_wardens_a: [25, 8],
            sun5_wardens_b: [25, 14],
            sun_5: [27, 11],
            lei_drum: [4, 5],
            tonnerre_chest: [14, 5],
            spawn: [3, 11],
            waypoint: [4, 9]
        }
    }
};

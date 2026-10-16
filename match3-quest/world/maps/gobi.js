// Région 4 — Désert de Gobi (cartes natives, format v2) : Caravansérail de Yueya, Oasis de Yuquan, Dunes des Voix Sablées (canyon),
// route d'accès « Piste des Caravanes », sanctuaire du Soleil des Mirages, cinq maisons.
// Légende : # rocs, falaises, murs de pisé · ~ puits, oasis · = piste caravanière · " herbe sèche (hautes herbes) · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'gobi_village', biome: 'gobi', native: true,
        grid: [
            '~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~......##..#..==...##....#...~~',
            '~~.............==.............~~',
            '~~..###########==###########..~~',
            '~~#.###########==###########.9~~',
            '~~.###AAAAA.BBB==.CCCCC.DD###.~~',
            '~~..##AAAAA.BBB==.CCCCC.DD##..~~',
            '~~..##AAAAA.BBB==.CCCCC.DD##..~~',
            '~~#.##AAaAA.BbB==.CCcCC.dD###.~~',
            '~~..##..=....=.==...=...=.##..~~',
            '~~.###..=.7.=========...=.##..~~',
            '~~......====1=2=W.===...===...~~',
            '<~============.==.============~>',
            '~~===========S.==.=3==========~~',
            '~~..##.4....==.==.=~~~..#.##..~~',
            '~~..##..==========6~~~.0..##..~~',
            '~~..##EEEEE.#.#===========###.~~',
            '~~.###EEEEE.#.#==..##...####..~~',
            '~~..##EEEEE.#j#==8...p..n.##..~~',
            '~~#.##EEeEE.#.#==..m......###.~~',
            '~~.###5.=...###==....##..k##.#~~',
            '~~..###########==###########..~~',
            '~~..###########==###########..~~',
            '~~.............==.............~~',
            '~~...#....##...==.....###..#..~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~v~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_gobi', at: 'p' },
            { id: 'hua_gobi', at: '1' },
            { id: 'storyteller_yun', at: '2' },
            { id: 'boy_tarik', at: '3' },
            { id: 'caravan_cook_lu', at: '0' },
            { id: 'falconer_arslan', at: '4' },
            { id: 'camel_foreman_tang', at: '5' },
            { id: 'gobi_village_water_seller', at: '6' },
            { id: 'gobi_village_kid_guide', at: '7' },
            { id: 'gobi_village_old_weaver', at: '8' }
        ],
        chests: [
            { id: 'caravan_stash', at: '9', gold: 60, label: 'Cachette de caravanier', openText: 'Une bourse de cuir enterrée dans le sable : le péage d\'un caravanier prudent.' },
            { id: 'gobi_garden_a', at: 'j', gold: 75, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'gobi_garden_b', at: 'k', gold: 75, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'gobi_market_a', at: 'm', gold: 150, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'gobi_market_b', at: 'n', gold: 150, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    hamlet: {
        id: 'gobi_hamlet', biome: 'gobi', native: true,
        grid: [
            '~~~~~~~~~~~~~~^~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~##########..=..#########~~',
            '~~########....=.....######~~',
            '~~######......=.......####~~',
            '~~#####.......=.........##~~',
            '~~##AAAAA.....S....BBBBB##~~',
            '~~##AAAAA.....=....BBBBB.#~~',
            '~~##AAAAA.....5....BBBBB.#~~',
            '~~#.AAaAA.....=....BBbBB.#~~',
            '~~....=.......=......=...#~~',
            '~~....================...#~~',
            '~~#...........=........6.#~~',
            '~~.#....#.0.......1.....#.~~',
            '~~..#.........~~~...7.....~~',
            '~~#.....2..~~~~~~~~~...#..~~',
            '~~##.......~~~~~~~~~......~~',
            '~~###3#...#~~~~~~~~~.....#~~',
            '~~#####....#..~~~....W..##~~',
            '~~#######...........#.####~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'date_farmer_ismail', at: '0' },
            { id: 'girl_noor', at: '1' },
            { id: 'oracle_ahmad', at: '2' },
            { id: 'gobi_hamlet_old_dyer', at: '5' }
        ],
        chests: [
            { id: 'date_basket', at: '3', gold: 60 },
            { id: 'gobi_hamlet_palm_jar', at: '6', gold: 60 },
            { id: 'gobi_hamlet_well_chest', at: '7', gold: 120 }
        ]
    },

    wild: {
        id: 'gobi_wild', biome: 'gobi', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~##.##########.............##################~~',
            '~~#...#######.....................####..######~~',
            '~~##......................."........#....#####~~',
            '~~##....................."""""......#....#####~~',
            '~~#........................"................##~~',
            '~~...............#.######.#..................#~~',
            '<~.............###############.....#.......#.#~~',
            '~~............#######...#########.............~~',
            '~~....W.......#######...#########....~~~~~....~~',
            '~~#..""""".....######...#########....~~~~~....~~',
            '~~##""""""".....#####...#########....~~~~~..#.~~',
            '~~###""""".......####...#######...............~~',
            '~~###...............##..#####......#..........~~',
            '~~####....................#..............#....~>',
            '~~########.............................""".##.~~',
            '~~########...#........................"""""###~~',
            '~~########...##.........""".......#.##.""".###~~',
            '~~########...##......."""""""...#######.....##~~',
            '~~#########..#.....##..."""....###########..##~~',
            '~~#########...#.....##########.###############~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~v~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.08,
            table: [
                { templateId: 'shadow_assassin', name: 'Scorpion de sable', weight: 5, offset: -1 },
                { templateId: 'goblin_saboteur', name: 'Chacal des dunes', weight: 4, offset: 0 },
                { templateId: 'sand_colossus', name: 'Colosse de poussière', weight: 3, offset: -1 },
                { templateId: 'arcane_scholar', name: 'Mirage hargneux', weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'mirage_djinn', x: 9, y: 6 },
            { id: 'lost_pilgrim_ren', x: 15, y: 12 },
            { id: 'fennec_lili', x: 36, y: 13 },
            { id: 'gobi_wild_old_caravaneer', x: 31, y: 6 }
        ],
        chests: [
            { id: 'dune_cache', x: 4, y: 3, gold: 60 },
            { id: 'mirage_chest', x: 22, y: 10, gold: 120 },
            { id: 'warlord_loot', x: 45, y: 13, gold: 180 },
            { id: 'journal_page_gob', x: 22, y: 2, gold: 60 },
            { id: 'sand_obelisk', x: 30, y: 21, gold: 120 },
            { id: 'bandit_stash', x: 18, y: 21, gold: 180 },
            { id: 'gobi_wild_oasis_jar', x: 36, y: 11, gold: 60 },
            { id: 'gobi_wild_cliff_chest', x: 43, y: 20, gold: 120 }
        ],
        enemies: [
            { id: 'gobi_dune_warlord', x: 45, y: 15, templateId: 'orc_warmaster', name: 'Chef de dune, Bras-de-Sable', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Chef de dune, Bras-de-Sable', level: 11 } },
            { id: 'gobi_golem_a', x: 18, y: 14, templateId: 'sand_colossus', name: 'Colosse des dunes', kind: 'sentinel', offset: 0, permanent: true, group: 'dune_golems' },
            { id: 'gobi_golem_b', x: 27, y: 15, templateId: 'sand_colossus', name: 'Colosse des dunes', kind: 'sentinel', offset: 0, permanent: true, group: 'dune_golems' },
            { id: 'gobi_w_bandit', x: 14, y: 5, templateId: 'iron_gladiator', name: 'Brigand des dunes', kind: 'patrol', patrol: [[14, 5], [21, 5]], offset: 0 },
            { id: 'gobi_w_scorpion', x: 20, y: 17, templateId: 'shadow_assassin', name: 'Scorpion de sable', kind: 'patrol', patrol: [[20, 17], [28, 17]], offset: -1 },
            { id: 'gobi_camel_thief', x: 32, y: 6, templateId: 'shadow_assassin', name: 'Voleur de chameaux', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'gobi_lost_a', x: 32, y: 16, templateId: 'bone_reaver', name: 'Caravanier squelette', kind: 'sentinel', offset: 0, permanent: true, group: 'lost_caravan' },
            { id: 'gobi_lost_b', x: 34, y: 17, templateId: 'bone_reaver', name: 'Caravanier squelette', kind: 'sentinel', offset: 0, permanent: true, group: 'lost_caravan' },
            { id: 'gobi_wild_sand_raider', x: 6, y: 14, templateId: 'iron_gladiator', name: 'Pillard des sables', kind: 'patrol', patrol: [[6, 14], [14, 14]], offset: 0 },
            { id: 'gobi_wild_dune_viper', x: 38, y: 6, templateId: 'shadow_assassin', name: 'Vipère cornue', kind: 'patrol', patrol: [[38, 6], [43, 6]], offset: -1 },
            { id: 'gobi_wild_mummy', x: 41, y: 19, templateId: 'bone_reaver', name: 'Cadavre desséché de caravanier', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'gobi_dune_warlord',
            lockedMessage: 'Un chef de brigands de sable tient le col entre les dunes et exige un péage que personne ne peut payer : il faudra le vaincre pour passer.'
        }
    },

    road: {
        id: 'gobi_road', biome: 'gobi', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~#.####...#..####.....##########.#######.~~',
            '~~........"...............................~~',
            '<~.....""""""".....................###....~~',
            '~~===========================.=..######...~~',
            '~~..........##................=...######..~~',
            '~~.....######################.=...#####...~~',
            '~~.....######################.=.""".##....~~',
            '~~............................="""""".....~~',
            '~~......................~~....=.""".......~~',
            '~~......................~~....============~>',
            '~~................####....................~~',
            '~~########..###.....########....##########~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.07,
            table: [
                { templateId: 'goblin_saboteur', name: 'Chacal des dunes', weight: 5, offset: -1 },
                { templateId: 'shadow_assassin', name: 'Scorpion de sable', weight: 4, offset: 0 },
                { templateId: 'arcane_scholar', name: 'Mirage hargneux', weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'gobi_road_old_drover', x: 5, y: 6 }
        ],
        chests: [
            { id: 'gobi_road_saddle_pack', x: 3, y: 2, gold: 60 },
            { id: 'gobi_road_niche', x: 33, y: 2, gold: 120 },
            { id: 'gobi_road_well_urn', x: 23, y: 11, gold: 60 }
        ],
        enemies: [
            { id: 'gobi_road_scorpion', x: 14, y: 4, templateId: 'shadow_assassin', name: 'Scorpion des pistes', kind: 'patrol', patrol: [[14, 4], [22, 4]], offset: -1 },
            { id: 'gobi_road_golem', x: 32, y: 7, templateId: 'sand_colossus', name: 'Colosse de la piste', kind: 'sentinel', offset: 0 },
            { id: 'gobi_road_bandit', x: 14, y: 10, templateId: 'iron_gladiator', name: 'Brigand de la piste', kind: 'sentinel', offset: 0 },
            { id: 'gobi_road_jackal', x: 38, y: 9, templateId: 'goblin_saboteur', name: 'Chacal charognard', kind: 'sentinel', offset: 0 }
        ]
    },

    interiors: [
        {
            id: 'gobi_h_ma', house: 'A',
            grid: [
                '############',
                '#.##.##....#',
                '#.##.##..1.#',
                '#..........#',
                '#..........#',
                '#.2........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'merchant_ma', at: '1' }
            ],
            chests: [
                { id: 'ma_strongbox', at: '2', gold: 120 }
            ]
        },
        {
            id: 'gobi_h_dawa', house: 'B',
            grid: [
                '##########',
                '#........#',
                '#..#..1..#',
                '#........#',
                '#.....#..#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'guide_dawa', at: '1' }
            ],
            chests: []
        },
        {
            id: 'gobi_h_bains', house: 'C',
            grid: [
                '############',
                '#..........#',
                '#..~~~~~~.1#',
                '#..~~~~~~..#',
                '#..~~~~~~..#',
                '#2.........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'keeper_nur', at: '1' }
            ],
            chests: [
                { id: 'cistern_jar', at: '2', gold: 60 }
            ]
        },
        {
            id: 'gobi_h_cartes', house: 'D',
            grid: [
                '##########',
                '#.###....#',
                '#......1.#',
                '#....##..#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'mapmaker_ali', at: '1' }
            ],
            chests: []
        },
        {
            id: 'gobi_h_chameaux', house: 'E',
            grid: [
                '############',
                '##.#.#.#...#',
                '##.#.#.#...#',
                '#........1.#',
                '#..........#',
                '#.2........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'camel_baba', at: '1' }
            ],
            chests: [
                { id: 'saddle_bag', at: '2', gold: 60 }
            ]
        },
        {
            id: 'gobi_h2_puits', house: 'A', in: 'hamlet',
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
                { id: 'well_digger_omar', at: '1' }
            ],
            chests: [
                { id: 'well_coin_box', at: '5', gold: 60 }
            ]
        },
        {
            id: 'gobi_h2_tapis', house: 'B', in: 'hamlet',
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
                { id: 'rug_seller_zeynep', at: '1' }
            ],
            chests: [
                { id: 'rug_chest', at: '5', gold: 120 }
            ]
        }
    ],

    sanctuary: {
        id: 'gobi', waypoint: { x: 4, y: 12 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~############....########.#~~',
            '~~##########.......######...~~',
            '~~#########......#...####..#~~',
            '~~#######~~......#.........#~~',
            '~~#####~~~~#...............#~~',
            '~~####.....#................~~',
            '~~###..#.............#......~~',
            '~~###.......................~~',
            '~~..........................~~',
            '<~S...........##............~>',
            '~~..W.......................~~',
            '~~####.....................#~~',
            '~~####.#.............#.....#~~',
            '~~#####....#...............#~~',
            '~~#####....#...............#~~',
            '~~######.........#........##~~',
            '~~########.......#......####~~',
            '~~#########........###...###~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        places: {
            gobi_colossus: [14, 8],
            mirage_1: [20, 6],
            mirage_2: [20, 16],
            mirage_3: [23, 11],
            bandit_a: [9, 15],
            bandit_b: [14, 17],
            sun_4: [27, 11],
            oasis_cache: [6, 7],
            gobi_chest: [26, 3]
        }
    }
};

// Région 6 — Gorges du Volcan : Hameau des Braises Sages, Coulées et Passerelles Rougeoyantes, cinq maisons (format v2 : cartes natives).
// Légende : # basalte/murs · ~ lave ou source chaude · = ruelle/pont de basalte · " herbes de cendre · A-E bâtiments (porte minuscule) · W pierre de voyage.
// Chaîne : Monts du Tonnerre ─► Galerie de Basalte (road) ─► Hameau des Braises Sages ─► Coulées et Passerelles ─► sanctuaire ; Sources Tièdes au sud des coulées.

export default {
    village: {
        id: 'volcan_village', biome: 'volcano', native: true,
        grid: [
            '~~~~~~~~~.^.~~~~~~~~~~~~~~~~~~~~',
            '~########.=.###################~',
            '~########.=.####~~#############~',
            '~####.....=.....~~#BBBBBB..####~',
            '~##AAAAAA.=#CCCC~~.BBBBBB...###~',
            '~##AAAAAA#=.CCCC~~.BBBBBB...###~',
            '~##AAAAAA#=.CCCC~~.BBBBBB...###~',
            '~##AAAAAA.=.CCCC==.BBbBBB#..###~',
            '~##AAaAAA.=.CcCC==...=.....####~',
            '~##.============~~...=...######~',
            '~#...=....=..=..~~..========.##~',
            '~#...=..#.=..=..~~..========.##~',
            '.....=....=..=..==..==S====#....',
            '<==============================>',
            '......W...=.....==.#========#...',
            '~##.~~~~..=...#.~~##========.##~',
            '~###~~~~..=.....~~.......EEEE##~',
            '~##.......=.....~~.##...#EEEE##~',
            '~##DDDDDDD=.....~~...##..EEEE##~',
            '~##DDDDDDD=.....~~..#....EEEE##~',
            '~##DDDDDDD=.#...==..#....EeEE##~',
            '~##DDDDDDD=.....==........=..##~',
            '~##DDDdDDD=...#.~~........=..##~',
            '~##.=======.....~~..........###~',
            '~###......=..#..~~.........####~',
            '~####...#.=.....~~..#......####~',
            '~########.=.###################~',
            '~~~~~~~~~.v.~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_volcan', x: 20, y: 11 },
            { id: 'lizard_zao', x: 8, y: 10 },
            { id: 'hua_volcan', x: 23, y: 14 },
            { id: 'young_miner_bo', x: 12, y: 11 },
            { id: 'geologist_zhou', x: 6, y: 11 },
            { id: 'widow_cai', x: 13, y: 16 },
            { id: 'courier_tong', x: 25, y: 11 },
            { id: 'volcan_village_bellows_man', x: 11, y: 15 },
            { id: 'volcan_village_surveyor', x: 13, y: 19 },
            { id: 'volcan_village_washer', x: 11, y: 21 },
            { id: 'volcan_village_lantern_maker', x: 23, y: 20 },
            { id: 'volcan_village_ember_boy', x: 14, y: 10 }
        ],
        chests: [
            { id: 'basalt_pot', x: 2, y: 11, gold: 90, label: 'Pot de basalte enfoui', openText: 'Un pot de basalte encore tiède, rempli de pièces noircies par la suie.' },
            { id: 'volcan_garden_a', x: 26, y: 4, gold: 135, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'volcan_garden_b', x: 5, y: 25, gold: 135, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'volcan_market_a', x: 20, y: 23, gold: 270, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'volcan_market_b', x: 23, y: 23, gold: 270, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' },
            { id: 'volcan_village_slag_jar', x: 5, y: 3, gold: 180 }
        ]
    },

    hamlet: {
        id: 'volcan_hamlet', biome: 'volcano', native: true,
        grid: [
            '~~~~~~~~~~~~~.^.~~~~~~~~~~~~',
            '~############.=.###########~',
            '~####.........=........####~',
            '~###...~~~..#.=....~~~..###~',
            '~##..~~~~~~~..=..~~~~~~~.##~',
            '~##..~~~~~~~..=..~~~~~~~.##~',
            '~##....~~~....=....~~~...##~',
            '~##.####...#..=..#.....#.##~',
            '~##...........S..........##~',
            '~##.AAAAAA.#..=...BBBBBB.##~',
            '~##.AAAAAA....=...BBBBBB.##~',
            '~##.AAAAAA....=...BBBBBB.##~',
            '~##.AAaAAA....=...BBbBBB.##~',
            '~##...=.......=.....=....##~',
            '~##..==================..##~',
            '~##....................W.##~',
            '~##....~........#........##~',
            '~##..~~~~~..##...#...#...##~',
            '~###...~................###~',
            '~####..................####~',
            '~##########################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'bath_mu', x: 11, y: 6 },
            { id: 'dragonet_xiaohong', x: 21, y: 16 },
            { id: 'bath_old_wang', x: 16, y: 8 },
            { id: 'volcan_hamlet_steam_keeper', x: 12, y: 15 }
        ],
        chests: [
            { id: 'hot_spring_chest', x: 4, y: 17, gold: 90 },
            { id: 'volcan_hamlet_steam_box', x: 20, y: 18, gold: 90 }
        ]
    },

    road: {
        id: 'volcan_road', biome: 'volcano', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~##########################################~',
            '~#####..##########~~######....#~~####...###~',
            '~###.....#####....~~#####.....#~~##......##~',
            '~##..............~~..###.......~~.........#~',
            '~#...............~~.....#......~~...........',
            '~#....#...#....=======.....#..~~......#===.>',
            '....##.........============..=======.=......',
            '<.===========#=..~~........==========.....#~',
            '........#......#.~~.....#..#..~~......#...#~',
            '~#..............~~#............~~........##~',
            '~#.""##"""......~~#######"""....~~###.....#~',
            '~#"""""""##....#~~#####..""###.#~~###.....#~',
            '~##""""""##....##~~############~~####.....#~',
            '~##########################################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'volcan_road_prospector', x: 24, y: 8 }
        ],
        chests: [
            { id: 'volcan_road_slag_pot', x: 12, y: 5, gold: 90 },
            { id: 'volcan_road_alcove_chest', x: 39, y: 12, gold: 180 },
            { id: 'volcan_road_cooling_box', x: 27, y: 3, gold: 90 }
        ],
        enemies: [
            { id: 'volcan_road_ember_wolf', x: 8, y: 6, templateId: 'loup_braise', name: 'Loup des galeries', kind: 'sentinel', offset: 0 },
            { id: 'volcan_road_boar_patrol', x: 6, y: 12, templateId: 'sanglier_flammes', name: 'Sanglier de scories', kind: 'patrol', patrol: [[6, 12], [13, 12]], offset: 0 },
            { id: 'volcan_road_basalt_guard', x: 24, y: 6, templateId: 'soldat_terre_cuite', name: 'Garde de basalte', kind: 'sentinel', offset: 0 },
            { id: 'volcan_road_tiger_patrol', x: 33, y: 5, templateId: 'tigre_embrase', name: 'Tigre des galeries', kind: 'patrol', patrol: [[33, 5], [38, 5]], offset: 0 },
            { id: 'volcan_road_lava_imp', x: 37, y: 8, templateId: 'huli_jing', name: 'Petit gui des coulées', kind: 'sentinel', offset: -1 }
        ],
        grass: {
            rate: 0.1, safeSteps: 4,
            table: [
                { templateId: 'loup_braise', name: 'Chiot de braise', weight: 5, offset: -1 },
                { templateId: 'huli_jing', name: 'Petit gui de cendre', weight: 4, offset: -1 },
                { templateId: 'sanglier_flammes', name: 'Sanglier de scories', weight: 2, offset: 0 },
                { templateId: 'pixiu', name: 'Pixiu des galeries', weight: 1, offset: 1 },
                { templateId: 'huo_shen', name: "Huo Shen", weight: 3, offset: 0 },
                { templateId: 'chi_niao', name: "Chi Niao", weight: 5, offset: -1 },
                { templateId: 'zhuque', name: "Zhuque", weight: 1, offset: 1 },
                { templateId: 'dijiang', name: "Dijiang", weight: 3, offset: 0 },
                { templateId: 'hanba', name: "Hanba", weight: 3, offset: 0 }
            ]
        }
    },

    wild: {
        id: 'volcan_wild', biome: 'volcano', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~##############################################~',
            '~###############~~~#.######~~~########~~~######~',
            '~##############~~~##.######~~~########~~~######~',
            '~###.###.###..~~~..#.####..~~~......#~~~####..#~',
            '~#....~~.###..~~~....#####.~~~.###....~~~.##..#~',
            '~#.......###...~~~.....~#=====.""".....~~~....#~',
            '~#.............~~~....========="""".....~~~...#~',
            '~#............~~~.....=~=====.~=""..###..~~~....',
            '~#...........~~~.....=.~..~~~.~.=...~~~..~~~...>',
            '~#..""""""..~~~......=.....~~~...=.....=====....',
            '~#..""""""..~~~......=......~~~...===========.#~',
            '~#..""""""..~~~.....=.......~~~.......=====...#~',
            '~#.........###~~~...=""""...~~~.........~~~.".#~',
            '~#............~~~...=""""...~~~...".....~~~"""#~',
            '~#.............~~~..=""""...~~~."""""..~~~."""#~',
            '~#....W........~~~..=.......~~~.""""".~~~...".#~',
            '~#...........=====.==.......~~~..."..~~~......#~',
            '.............======.........~~~......~~~...####~',
            '<...=========.=====.....###~~~#.......~~~.....#~',
            '.........#...###~~~.......~~~####......~~~....#~',
            '~###############~~~######~~~#####.....##~~~####~',
            '~#################################...##########~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.v.~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'forge_spirit', x: 21, y: 14 },
            { id: 'lava_fish_bi', x: 11, y: 9 },
            { id: 'ghost_miner_shu', x: 5, y: 10 },
            { id: 'volcan_wild_ash_sweeper', x: 31, y: 15 }
        ],
        chests: [
            { id: 'cinder_cache', x: 3, y: 5, gold: 90 },
            { id: 'basalt_niche', x: 20, y: 2, gold: 180 },
            { id: 'forge_vault', x: 21, y: 19, gold: 270 },
            { id: 'journal_page_vol', x: 31, y: 16, gold: 90 },
            { id: 'obsidian_cache', x: 36, y: 17, gold: 180 },
            { id: 'cinnabar_vault', x: 36, y: 5, gold: 270 },
            { id: 'volcan_wild_slag_box', x: 10, y: 17, gold: 90 },
            { id: 'volcan_wild_ash_urn', x: 45, y: 5, gold: 180 }
        ],
        enemies: [
            { id: 'volcan_forge_giant', x: 41, y: 11, templateId: 'pixiu', name: 'Forgeron de lave', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Forgeron de lave', level: 4 } },
            { id: 'volcan_ember_imp', x: 19, y: 8, templateId: 'huli_jing', name: 'Démon des cendres', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'volcan_w_salamander', x: 19, y: 10, templateId: 'chilong', name: 'Lézard-dragon de lave', kind: 'patrol', patrol: [[19, 10], [19, 16]], offset: -1 },
            { id: 'volcan_w_smith', x: 31, y: 12, templateId: 'gui_guerrier', name: 'Forgeron calciné', kind: 'patrol', patrol: [[31, 12], [36, 12]], offset: 0 },
            { id: 'volcan_w_hound', x: 8, y: 13, templateId: 'loup_braise', name: 'Chien de braise', kind: 'sentinel', offset: 0 },
            { id: 'volcan_hound_a', x: 33, y: 8, templateId: 'loup_braise', name: 'Chien de magma', kind: 'sentinel', offset: 0, permanent: true, group: 'magma_hounds' },
            { id: 'volcan_hound_b', x: 35, y: 15, templateId: 'loup_braise', name: 'Chien de magma', kind: 'sentinel', offset: 0, permanent: true, group: 'magma_hounds' },
            { id: 'volcan_obsidian_guard', x: 23, y: 12, templateId: 'soldat_terre_cuite', name: 'Soldat d\'obsidienne', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'volcan_wild_ash_boar', x: 6, y: 8, templateId: 'sanglier_flammes', name: 'Sanglier de braise', kind: 'patrol', patrol: [[6, 8], [6, 14]], offset: 0 },
            { id: 'volcan_wild_tiger_patrol', x: 34, y: 18, templateId: 'tigre_embrase', name: 'Tigre de cendre', kind: 'patrol', patrol: [[34, 18], [36, 18]], offset: 0 },
            { id: 'volcan_wild_cinder_imp', x: 25, y: 16, templateId: 'huli_jing', name: 'Jing des scories', kind: 'sentinel', offset: -1 },
            { id: 'volcan_wild_ash_scholar', x: 44, y: 15, templateId: 'lettre_sorcier', name: 'Lettré des cendres', kind: 'sentinel', offset: 0 }
        ],
        grass: {
            rate: 0.12, safeSteps: 3,
            table: [
                { templateId: 'huli_jing', name: 'Petit gui de cendre', weight: 5, offset: -1 },
                { templateId: 'loup_braise', name: 'Loup des cendres hautes', weight: 4, offset: 0 },
                { templateId: 'sanglier_flammes', name: 'Sanglier de basalte', weight: 3, offset: 0 },
                { templateId: 'tigre_embrase', name: 'Tigre de braise', weight: 2, offset: 0 },
                { templateId: 'chilong', name: 'Lézard-dragon rouge', weight: 1, offset: 1 },
                { templateId: 'huo_shou', name: "Huo Shou", weight: 3, offset: 0 },
                { templateId: 'bi_fang', name: "Bi Fang", weight: 3, offset: 0 },
                { templateId: 'nuba', name: "Nüba", weight: 1, offset: 1 },
                { templateId: 'zhulong_serpent', name: "Zhulong", weight: 1, offset: 1 },
                { templateId: 'yazi', name: "Yazi", weight: 3, offset: 0 }
            ]
        },
        gate: {
            requires: 'volcan_forge_giant',
            lockedMessage: 'Le pont de basalte vers le sanctuaire est rompu : un forgeron de lave frappe son enclume dessus. Il faut le calmer pour que le passage s\'ouvre.'
        }
    },

    interiors: [
        {
            id: 'volcan_h_shan', house: 'A',
            grid: [
                '###########',
                '#.##.1.##.#',
                '#.........#',
                '#.........#',
                '#.......2.#',
                '#....S....#',
                '#####v#####'
            ],
            npcs: [
                { id: 'miner_shan', at: '1' }
            ],
            chests: [
                { id: 'shan_ore_box', at: '2', gold: 90 }
            ]
        },
        {
            id: 'volcan_h_yan', house: 'B',
            grid: [
                '##########',
                '#...1....#',
                '#...##...#',
                '#...~~...#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'priestess_yan', at: '1' }
            ],
            chests: []
        },
        {
            id: 'volcan_h_potier', house: 'C',
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
                { id: 'potter_rui', at: '1' }
            ],
            chests: [
                { id: 'lava_vase', at: '2', gold: 180 }
            ]
        },
        {
            id: 'volcan_h_bains', house: 'D',
            grid: [
                '############',
                '#..........#',
                '#.~~~~....1#',
                '#.~~~~.~~~.#',
                '#.~~~~.~~~.#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'bather_fei', at: '1' }
            ],
            chests: []
        },
        {
            id: 'volcan_h_cantine', house: 'E',
            grid: [
                '############',
                '#.1......2.#',
                '#..........#',
                '#..######..#',
                '#..........#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'cook_dada', at: '1' }
            ],
            chests: [
                { id: 'cantine_stash', at: '2', gold: 90 }
            ]
        },
        {
            id: 'volcan_h2_alchimiste', house: 'A', in: 'hamlet',
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
                { id: 'alchemist_dan', at: '1' }
            ],
            chests: [
                { id: 'alchemy_chest', at: '5', gold: 180 }
            ]
        },
        {
            id: 'volcan_h2_chauffeur', house: 'B', in: 'hamlet',
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
                { id: 'stoker_ge', at: '1' }
            ],
            chests: [
                { id: 'stoker_box', at: '5', gold: 90 }
            ]
        }
    ],

    sanctuary: {
        id: 'volcan', waypoint: { x: 3, y: 13 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~############################~',
            '~###########.#.###.##..######~',
            '~##########........~~.......#~',
            '~##....####........~~.......#~',
            '~##....####.......~~....#...#~',
            '~###...####.....#.~~........#~',
            '~###....###......~~.........#~',
            '~##....#####.....~~#..#...#.#~',
            '~##....#####..#..~~.........#~',
            '................======#.......',
            '<..........###..======.......>',
            '................======........',
            '~#....####.####....~~.......#~',
            '~#...#####.........~~..#..#.#~',
            '~#########......#.~~........#~',
            '~#########........~~#.......#~',
            '~########........~~...#.....#~',
            '~#########...#...~~.##.....##~',
            '~##########.#####.###########~',
            '~############################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        places: {
            parley_sun6: [24, 16],
            fengmeng_2: [8, 11],
            volcan_lich: [15, 16],
            ore_guard_a: [23, 4],
            ore_guard_b: [26, 5],
            volcan_dragon: [15, 6],
            sun6_wardens_a: [25, 8],
            sun6_wardens_b: [25, 14],
            sun_6: [27, 11],
            phoenix_brazier: [4, 5],
            volcan_chest: [13, 3],
            spawn: [3, 11],
            waypoint: [2, 10]
        }
    }
};

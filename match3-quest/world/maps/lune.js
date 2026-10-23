// Région 10 — Pic de la Lune : Hameau sous la Lune (26×24, allégé), Sentier Lunaire, Sentier d'Argent, trois maisons.
// Cartes natives (format v2, world/DESIGN-V2.md) : village 26×24, route 40×16, sentier 40×22, sanctuaire 30×22. Pas de hameau.
// Légende : # roc/cristaux · ~ lac de lune, rivière d'argent · = ruelle/marches de jade · " herbes argentées · A-C bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'lune_village', biome: 'moon', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~######################~~',
            '~~#........#...#......o#~~',
            '~~#.AAAAA.........BBBBB#~~',
            '~~#.AAAAA.6..~....BBBBB#~~',
            '~~#.AAaAA.~~~~~~~8BBbBB#~~',
            '~~#...=..~~~~~~~~~..=..#~~',
            '~~#.......~~~=~~~...####~~',
            '~~##...1....3=......#k##~~',
            '####....#i======2...#=#.##',
            '###.......=0=====.......##',
            '<.======================.>',
            '##============S=======#=##',
            '##.......#======p==4#...##',
            '~~##CCCCC.=========....#~~',
            '~~#.CCCCC...W..##==#####~~',
            '~~#.CCcCC.7..9.#.....#.#~~',
            '~~#..==....##..#.m.n.#.#~~',
            '~~###=####.....#.....#.#~~',
            '~~##..j..#.....#########~~',
            '~~######################~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_lune', at: 'p' },
            { id: 'moon_child', at: '1' },
            { id: 'moon_cook_gui', at: '0' },
            { id: 'moon_rabbit_yutu', at: '2' },
            { id: 'moon_ferryman_yin', at: '3' },
            { id: 'moon_child_lan', at: '4' },
            { id: 'moon_lamplighter_qiu', at: '6' },
            { id: 'moon_dew_gatherer_lu', at: '7' },
            { id: 'moon_stargazer_ming', at: '8' },
            { id: 'moon_taster_bao', at: '9' }
        ],
        chests: [
            { id: 'moon_cake_tin', at: 'i', gold: 150 },
            { id: 'lune_garden_a', at: 'j', gold: 240, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'lune_garden_b', at: 'k', gold: 240, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'lune_market_a', at: 'm', gold: 480, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'lune_market_b', at: 'n', gold: 480, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' },
            { id: 'lune_village_hollow', at: 'o', gold: 300 }
        ]
    },

    road: {
        id: 'lune_road', biome: 'moon', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '###################################k##~~',
            '.....#############.##....#j####......#~~',
            '<..........######......................#',
            '..6.##..4..#####.................5......',
            '##.........##.........~......3##.......>',
            '~.#........##...1...~~~~~...#.##........',
            '..#......."##....===========..##........',
            '..#....""""##".2...~~~~~~~....##.....#..',
            '~.#....""""""".......~~~......##.....#.~',
            '~.#.......".................####..##.#~~',
            '~~##..i.......####.#.......######...##~~',
            '~~####################################~~',
            '~~~~~~....~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.08,
            table: [
                { templateId: 'dame_des_neiges', name: 'Xianzi de rosée', weight: 5, offset: -1 },
                { templateId: 'assassin_masque', name: 'Ombre du sentier', weight: 4, offset: 0 },
                { templateId: 'jiangshi', name: 'Jiangshi des herbes argentées', weight: 2, offset: 0 },
                { templateId: 'pretresse_lunaire', name: 'Veilleuse égarée', weight: 1, offset: 1 },
                { templateId: 'yutu', name: "Yutu", weight: 3, offset: 0 },
                { templateId: 'nu_gui', name: "Nü Gui", weight: 3, offset: 0 },
                { templateId: 'yuan_gui', name: "Yuan Gui", weight: 1, offset: 1 },
                { templateId: 'nuwa', name: "Nüwa", weight: 1, offset: 1 },
                { templateId: 'yayu', name: "Yayu", weight: 1, offset: 1 },
                { templateId: 'yingzhao_ailee', name: "Yingzhao", weight: 3, offset: 0 }
            ]
        },
        npcs: [
            { id: 'jade_step_keeper_lin', at: '1' },
            { id: 'changxi_moon', at: '6' }
        ],
        chests: [
            { id: 'lune_road_lanterns', at: 'i', gold: 150 },
            { id: 'lune_road_stone', at: 'j', gold: 300 },
            { id: 'lune_road_hidden', at: 'k', gold: 450 }
        ],
        enemies: [
            { id: 'lune_road_witch', at: '2', templateId: 'dame_des_neiges', name: 'Dame des neiges égarée', kind: 'sentinel', offset: 0 },
            { id: 'lune_road_shade', at: '3', templateId: 'assassin_masque', name: 'Ombre du sentier', kind: 'sentinel', offset: 0 },
            { id: 'lune_road_hopper', at: '4', templateId: 'jiangshi', name: 'Jiangshi du givre', kind: 'patrol', patrol: ['4', [8, 11]], offset: 0 },
            { id: 'lune_road_veil', at: '5', templateId: 'pretresse_lunaire', name: 'Veilleuse égarée', kind: 'patrol', patrol: ['5', [33, 10]], offset: 0 }
        ]
    },

    wild: {
        id: 'lune_wild', biome: 'moon', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~####################################~~',
            '~~####..6..#####.......#############....',
            '~~###i#.....#...#........#######........',
            '~~##.......#.....~~~~~~~...####...l...=>',
            '~~##............~~~~~~~~~.p.##.....##.=.',
            '~~##.....1...t..~~~~~~~~~...##s.......=.',
            '~~##..............~~~~~....##..""""".#=.',
            '~~###..........3.........7###..""""".#..',
            '~~###...m.~#............#####...."...#..',
            '~~#.......~..............####.9......#..',
            '##..##.q..~....#""""""""n##....#...#5#.~',
            '#.........~.W....""#"""....==========#.~',
            '<==========..##......======.o........#~~',
            '...#......==2========.......##.......#~~',
            '........#.~.r.................u..#####~~',
            '~~#..##"""~.......##...#.........#####~~',
            '~~#4.."""8~..##.............##########~~',
            '~~########~###########################~~',
            '~~~~~~~.~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            table: [
                { templateId: 'assassin_masque', name: 'Ombre des herbes argentées', weight: 4, offset: -1 },
                { templateId: 'dame_des_neiges', name: 'Xianzi de givre', weight: 4, offset: 0 },
                { templateId: 'jiangshi', name: 'Jiangshi lunaire', weight: 3, offset: 0 },
                { templateId: 'canglong', name: 'Dragonneau de givre égaré', weight: 1, offset: 1 },
                { templateId: 'gui_po', name: "Gui Po", weight: 3, offset: 0 },
                { templateId: 'diaosi_gui', name: "Diao Si Gui", weight: 3, offset: 0 },
                { templateId: 'heibai_wuchang', name: "Heibai Wuchang", weight: 1, offset: 1 },
                { templateId: 'fuxi', name: "Fuxi", weight: 1, offset: 1 },
                { templateId: 'feiyi', name: "Feiyi", weight: 3, offset: 0 },
                { templateId: 'tiangou_lune', name: "Tiangou", weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'osmanthus_woodcutter', at: '1' },
            { id: 'moon_crow_wu', at: '2' },
            { id: 'moon_fisher_tong', at: '3' }
        ],
        chests: [
            { id: 'frost_cache', at: '4', gold: 300 },
            { id: 'moon_key_chest', at: '5', gold: 300 },
            { id: 'osmanthus_hoard', at: '6', gold: 450 },
            { id: 'journal_page_lune', at: '7', gold: 150 },
            { id: 'silver_river_cache', at: '8', gold: 300 },
            { id: 'lune_wild_steps_box', at: '9', gold: 300 },
            { id: 'lune_wild_moonwell', at: 'i', gold: 450 }
        ],
        enemies: [
            { id: 'lune_frost_priestess', at: 'l', templateId: 'pretresse_lunaire', name: 'Prêtresse de givre', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Prêtresse de givre', level: 43 } },
            { id: 'lune_mirror_shade', at: 'm', templateId: 'assassin_masque', name: 'Ombre du miroir', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'lune_w_hare', at: 'q', templateId: 'dame_des_neiges', name: 'Xianzi de givre', kind: 'patrol', patrol: ['q', [7, 16]], offset: 0 },
            { id: 'lune_w_jiangshi', at: 'r', templateId: 'jiangshi', name: 'Jiangshi lunaire', kind: 'patrol', patrol: ['r', [25, 16]], offset: -1 },
            { id: 'lune_w_frostdragon', at: 'p', templateId: 'canglong', name: 'Long de givre', kind: 'sentinel', offset: 0 },
            { id: 'lune_shade_a', at: 'n', templateId: 'assassin_masque', name: 'Ombre du miroir', kind: 'sentinel', offset: 0, permanent: true, group: 'mirror_shades' },
            { id: 'lune_shade_b', at: 'o', templateId: 'assassin_masque', name: 'Ombre du miroir', kind: 'sentinel', offset: 0, permanent: true, group: 'mirror_shades' },
            { id: 'lune_w_owl', at: 's', templateId: 'assassin_masque', name: 'Guetteur d’ombre', kind: 'patrol', patrol: ['s', [37, 7]], offset: 0 },
            { id: 'lune_w_wisp', at: 't', templateId: 'dame_des_neiges', name: 'Esprit de rosée', kind: 'patrol', patrol: ['t', [13, 10]], offset: 0 },
            { id: 'lune_w_crystal', at: 'u', templateId: 'immortel_jade', name: 'Veilleur de cristal', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'moon_key_chest',
            lockedMessage: 'La porte du Pic est scellée par une serrure de lumière : sa clé repose dans un reliquaire, quelque part sur le sentier d\'argent.'
        }
    },

    interiors: [
        {
            id: 'lune_h_veilleuse', house: 'A',
            grid: [
                '############',
                '#.###....1.#',
                '#....3.....#',
                '#......###.#',
                '#.2........#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'keeper_lunar', at: '1' },
                { id: 'hua_lune', at: '3' }
            ],
            chests: [
                { id: 'veilleuse_chest', at: '2', gold: 150 }
            ]
        },
        {
            id: 'lune_h_lievres', house: 'B',
            grid: [
                '##########',
                '#....1...#',
                '#..#.....#',
                '#.....#..#',
                '#.......2#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'jade_hare', at: '1' }
            ],
            chests: [
                { id: 'jade_mortar_box', at: '2', gold: 300 }
            ]
        },
        {
            id: 'lune_h_tisseuse', house: 'C',
            grid: [
                '##########',
                '#......1.#',
                '#..###...#',
                '#2.......#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'spinner_yue', at: '1' }
            ],
            chests: [
                { id: 'moon_thread_box', at: '2', gold: 150 }
            ]
        }
    ],

    sanctuary: {
        id: 'lune', waypoint: { x: 3, y: 14 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~##########################~~',
            '~~###########.....##########~~',
            '~~########...#........######~~',
            '~~####~~~~~~~~...3......####~~',
            '~~####~~~~~~~~...........###~~',
            '~~####~~~~~~~~.........6...#..',
            '~~###...~~~~....##.........#..',
            '~~###....1......##.....5...7..',
            '~~##.#.....................#..',
            '~~##......====.............#..',
            '~~###....=====......#......#..',
            '~~##i...======.............#~~',
            '~~#W...=====..2..........###~~',
            '##.....====..........##..###~~',
            '.......===.......#......####~~',
            '<.S......##...........######~~',
            '........4.###......#########~~',
            '############################~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        places: {
            change_moon: '1',
            moon_cakes_cache: 'i',
            lune_priestess: { at: '2', patrol: ['2', [23, 14]] },
            lune_vampire: '3',
            lune_assassin: '4',
            fengmeng_3a: '5',
            fengmeng_3b: '6',
            moon_altar: '7'
        }
    }
};

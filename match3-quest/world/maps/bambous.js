// Région 3 — Forêt de Bambous Calcinée (cartes natives, format v2) : Village des Cent Tiges, Clairière des Lampions,
// Sentier des Tiges Cendrées (forêt-labyrinthe), route d'accès « Sentier des Moines », sanctuaire du Soleil de Cendres, cinq maisons.
// Légende : # tiges de bambou / murs · ~ mare, ruisseau · = ruelle, passerelle · " hautes herbes · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'bambous_village', biome: 'bamboo', native: true,
        grid: [
            '~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~############.==#############~~',
            '~~####.........==..........###~~',
            '~~##AAAAA.BBBB.==.CCCCCC....#9~~',
            '~~##AAAAA.BBBB.==.CCCCCC.DDDD.~~',
            '~~#.AAAAA.BBBB.==.CCCCCC.DDDD.~~',
            '~~#.AAaAA.BbBB.==.CCCCCC.DDDD.~~',
            '~~#.#.=....=...==.CCcCCC.DdDD.~~',
            '~~##..===========...=...#.=...~~',
            '~~##k....0.==========.....=...~~',
            '~~##.......==1=============...~~',
            '~~.........==..==W.==.6.....#.~~',
            '<~===========..==..===========~>',
            '~~===========..==..===========~~',
            '~~##.....7.==S=====5=.......##~~',
            '~~#.#..=====================.#~~',
            '~~#..EEEEE.....===...........#~~',
            '~~#..EEEEE#####===.##....##..#~~',
            '~~#..EEEEE#.j.#===....p..3...#~~',
            '~~#..EEeEE#...#===...........#~~',
            '~~#....=..#4..#===....##.....#~~',
            '~~#.~~~~..##.##===.m......n..#~~',
            '~~#~~~~~~.2....==...........##~~',
            '~~#~~~~~~...#..==#.#......####~~',
            '~~############.==#############~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~v~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_bambous', at: 'p' },
            { id: 'huli_xia', at: '1' },
            { id: 'young_monk_zhi', at: '0' },
            { id: 'scholar_dong', at: '2' },
            { id: 'bambous_village_fan_seller', at: '3' },
            { id: 'bambous_village_old_gardener', at: '4' },
            { id: 'bambous_village_kid_runner', at: '5' },
            { id: 'bambous_village_tea_porter', at: '6' },
            { id: 'bambous_village_scribe_wei', at: '7' }
        ],
        chests: [
            { id: 'tea_hideout', at: '9', gold: 45, label: 'Cachette de thé', openText: 'Sous une natte brûlée, un pot de thé fêlé… et quelques sous que quelqu\'un avait cachés là.' },
            { id: 'bambous_garden_a', at: 'j', gold: 45, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'bambous_garden_b', at: 'k', gold: 45, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'bambous_market_a', at: 'm', gold: 90, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'bambous_market_b', at: 'n', gold: 90, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    hamlet: {
        id: 'bambous_hamlet', biome: 'bamboo', native: true,
        grid: [
            '~~~~~~~~~~~~~~^~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~##########..=..#########~~',
            '~~#########...=....#######~~',
            '~~#######.....=.....######~~',
            '~~###AAAAA....=...BBBBB###~~',
            '~~###AAAAA....S...BBBBB###~~',
            '~~##.AAAAA....=...BBBBB...~~',
            '~~#..AAaAA....5...BBbBB.#.~~',
            '~~##...=......=.....=.....~~',
            '~~#....==============.....~~',
            '~~#...........=........##.~~',
            '~~#.#.....2...=..3........~~',
            '~~#.##.......0....6......#~~',
            '~~#................~~~~~~#~~',
            '~~##...1...##......~~~~~~#~~',
            '~~##.4............7~~~~~~#~~',
            '~~###...........##.......#~~',
            '~~####...#.........W....##~~',
            '~~#####................###~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'panda_baobao', at: '0' },
            { id: 'beekeeper_ju', at: '1' },
            { id: 'archer_huo', at: '2' },
            { id: 'cricket_boy_hao', at: '3' },
            { id: 'bambous_hamlet_old_lamplighter', at: '5' }
        ],
        chests: [
            { id: 'honey_hive', at: '4', gold: 45 },
            { id: 'bambous_hamlet_lantern_cache', at: '6', gold: 45 },
            { id: 'bambous_hamlet_pond_urn', at: '7', gold: 90 }
        ]
    },

    wild: {
        id: 'bambous_wild', biome: 'bamboo', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~###############.############################~~',
            '~~##############......"""""...#.##############~~',
            '~~#############......"""""""..#...############~~',
            '~~###.#######........."""""...#.....#####.....~>',
            '~~##...####..........................####.....~~',
            '~~###..###............................#.....##~~',
            '~~###..##..........#...######..............###~~',
            '~~###..##........####......#####......#.....##~~',
            '~~###..........######........#####....#"""...#~~',
            '~~###.........#######.........#####..."""""..#~~',
            '~~##.........#########..####.#####~~..."""...#~~',
            '~~##.........#########..##########~~.........#~~',
            '~~.....W.....#######......####....~~........##~~',
            '~~...........###............#.....==........#.~~',
            '~~..........###.............#.....==..........~~',
            '~~........##......................==.........#~~',
            '<~.."""""..#................"""...~~##......##~~',
            '~~.""""""".............##.""""""##~~######..##~~',
            '~~##"""""..........######..###############...#~~',
            '~~##..............######...################.##~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~v~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.09,
            table: [
                { templateId: 'lingzhi_maudit', name: 'Lingzhi des fougères', weight: 5, offset: -1 },
                { templateId: 'huli_jing', name: 'Petit démon des tiges', weight: 4, offset: 0 },
                { templateId: 'assassin_masque', name: 'Ombre rampante', weight: 2, offset: 0 },
                { templateId: 'shu_jing', name: 'Jeune esprit du bambou', weight: 1, offset: 1 },
                { templateId: 'mu_mei', name: "Mu Mei", weight: 5, offset: -1 },
                { templateId: 'lu_jing', name: "Lu Jing", weight: 3, offset: 0 },
                { templateId: 'he_jing', name: "He Jing", weight: 3, offset: 0 },
                { templateId: 'shouling', name: "Shouling", weight: 5, offset: -1 },
                { templateId: 'shan_shen', name: "Shan Shen", weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'lantern_old', x: 4, y: 16 },
            { id: 'stem_sprite', x: 8, y: 10 },
            { id: 'snake_qing', x: 33, y: 14 },
            { id: 'bambous_wild_old_woodcutter', x: 23, y: 7 }
        ],
        chests: [
            { id: 'hidden_grove_chest', x: 5, y: 5, gold: 90 },
            { id: 'hollow_stem', x: 28, y: 11, gold: 90 },
            { id: 'monk_hoard', x: 43, y: 20, gold: 135 },
            { id: 'journal_page_bam', x: 5, y: 21, gold: 45 },
            { id: 'ash_urn', x: 17, y: 3, gold: 135 },
            { id: 'ash_cache', x: 32, y: 4, gold: 45 },
            { id: 'bambous_wild_reed_box', x: 16, y: 21, gold: 45 },
            { id: 'bambous_wild_incense_chest', x: 44, y: 12, gold: 90 }
        ],
        enemies: [
            { id: 'bambous_seal_keeper', x: 43, y: 5, templateId: 'suanni', name: 'Gardien des cendres', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Gardien des cendres', level: 17 } },
            { id: 'bambous_ember_wisp', x: 12, y: 9, templateId: 'lingzhi_maudit', name: 'Lingzhi des braises', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_lingzhi' },
            { id: 'bambous_ember_wisp_b', x: 27, y: 6, templateId: 'lingzhi_maudit', name: 'Lingzhi des braises', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_lingzhi' },
            { id: 'bambous_w_shade', x: 14, y: 7, templateId: 'assassin_masque', name: 'Ombre de cendre', kind: 'patrol', patrol: [[14, 7], [20, 7]], offset: 0 },
            { id: 'bambous_w_spirit', x: 13, y: 17, templateId: 'shu_jing', name: 'Esprit des tiges brûlées', kind: 'patrol', patrol: [[13, 17], [21, 17]], offset: -1 },
            { id: 'bambous_w_pilgrim', x: 37, y: 12, templateId: 'gui_guerrier', name: 'Pèlerin calciné', kind: 'sentinel', offset: 0 },
            { id: 'bambous_ash_shadow_a', x: 22, y: 12, templateId: 'assassin_masque', name: 'Ombre des cendres', kind: 'sentinel', offset: 0, permanent: true, group: 'ash_shadows' },
            { id: 'bambous_ash_shadow_b', x: 26, y: 10, templateId: 'assassin_masque', name: 'Ombre des cendres', kind: 'sentinel', offset: 0, permanent: true, group: 'ash_shadows' },
            { id: 'bambous_lantern_thief', x: 31, y: 5, templateId: 'huli_jing', name: 'Démon voleur de lampions', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'bambous_wild_ghost_monk', x: 31, y: 14, templateId: 'gui_guerrier', name: 'Moine errant calciné', kind: 'patrol', patrol: [[31, 14], [31, 17]], offset: 0 },
            { id: 'bambous_wild_pine_spirit', x: 41, y: 16, templateId: 'shu_jing', name: 'Pin de cendre', kind: 'sentinel', offset: 0 },
            { id: 'bambous_wild_lamp_priestess', x: 19, y: 4, templateId: 'pretresse_lunaire', name: 'Prêtresse des lampions éteints', kind: 'sentinel', offset: -1 }
        ],
        gate: {
            requires: 'bambous_seal_keeper',
            lockedMessage: 'Les sceaux du moine Zhen ne tiennent plus : un gardien de cendres retient le sentier du temple. Il faut le dompter pour passer.'
        }
    },

    road: {
        id: 'bambous_road', biome: 'bamboo', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~.......#####..##......~~..........###..#~~',
            '~~........###...........~~............#...~~',
            '~~...."""""......"""....==...........###..~~',
            '~~..."""""##...."""""...==................~~',
            '~~....""#######.."""....==................~~',
            '~~......######..........~~.....#####......~~',
            '~~.......######.........~~.....#####......~~',
            '~~......................~~.....#####......~~',
            '~~...............#......~~................~~',
            '<~......###############.~~###."####.......~>',
            '~~.....#################~~##########......~~',
            '~~######################~~###########.....~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.08,
            table: [
                { templateId: 'lingzhi_maudit', name: 'Lingzhi des fougères', weight: 5, offset: -1 },
                { templateId: 'huli_jing', name: 'Petit démon des tiges', weight: 4, offset: 0 },
                { templateId: 'shu_jing', name: 'Jeune esprit du bambou', weight: 1, offset: 1 },
                { templateId: 'mu_gui', name: "Mu Gui", weight: 5, offset: -1 },
                { templateId: 'hu_jing', name: "Hu Jing", weight: 3, offset: 0 },
                { templateId: 'lang_jing', name: "Lang Jing", weight: 5, offset: -1 },
                { templateId: 'jing_shou', name: "Jing Shou", weight: 5, offset: -1 },
                { templateId: 'qilin', name: "Qilin", weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'bambous_road_old_pilgrim', x: 5, y: 9 }
        ],
        chests: [
            { id: 'bambous_road_offering', x: 3, y: 4, gold: 45 },
            { id: 'bambous_road_niche', x: 14, y: 2, gold: 90 },
            { id: 'bambous_road_bank_urn', x: 40, y: 13, gold: 45 }
        ],
        enemies: [
            { id: 'bambous_road_lingzhi', x: 14, y: 9, templateId: 'lingzhi_maudit', name: 'Lingzhi pèlerin', kind: 'sentinel', offset: 0 },
            { id: 'bambous_road_shade', x: 14, y: 3, templateId: 'assassin_masque', name: 'Ombre du sentier', kind: 'patrol', patrol: [[14, 3], [22, 3]], offset: -1 },
            { id: 'bambous_road_stone_lion', x: 28, y: 6, templateId: 'suanni', name: 'Lion de pierre éveillé', kind: 'sentinel', offset: 0 },
            { id: 'bambous_road_thief', x: 37, y: 9, templateId: 'huli_jing', name: 'Petit démon voleur d\'offrandes', kind: 'sentinel', offset: 0 }
        ]
    },

    interiors: [
        {
            id: 'bambous_h_zhen', house: 'A',
            grid: [
                '##########',
                '#.1....2.#',
                '#........#',
                '#..####..#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'monk_zhen', at: '1' }
            ],
            chests: [
                { id: 'zhen_alms_box', at: '2', gold: 45 }
            ]
        },
        {
            id: 'bambous_h_xu', house: 'B',
            grid: [
                '############',
                '#.#.#.#.#..#',
                '#..........#',
                '#........1.#',
                '#..####....#',
                '#.2........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'herbalist_xu', at: '1' }
            ],
            chests: [
                { id: 'xu_herb_chest', at: '2', gold: 90 }
            ]
        },
        {
            id: 'bambous_h_the', house: 'C',
            grid: [
                '############',
                '#..........#',
                '#.##..##.1.#',
                '#.##..##...#',
                '#....2.....#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'lady_lan', at: '1' },
                { id: 'panda_mimi', at: '2' }
            ],
            chests: []
        },
        {
            id: 'bambous_h_papier', house: 'D',
            grid: [
                '############',
                '#.1.####.3.#',
                '#...####...#',
                '#...####...#',
                '#..........#',
                '#.2........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'ke_paper', at: '1' },
                { id: 'apprentice_zhu', at: '2' }
            ],
            chests: [
                { id: 'paper_roll_box', at: '3', gold: 45 }
            ]
        },
        {
            id: 'bambous_h_flute', house: 'E',
            grid: [
                '##########',
                '#.#.#.#..#',
                '#........#',
                '#...1....#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'flutist_chuan', at: '1' }
            ],
            chests: []
        },
        {
            id: 'bambous_h2_lanterne', house: 'A', in: 'hamlet',
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
                { id: 'lanternier_fa', at: '1' }
            ],
            chests: [
                { id: 'lantern_box', at: '5', gold: 45 }
            ]
        },
        {
            id: 'bambous_h2_sculpteur', house: 'B', in: 'hamlet',
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
                { id: 'carver_ling', at: '1' }
            ],
            chests: [
                { id: 'carver_chest', at: '5', gold: 90 }
            ]
        }
    ],

    sanctuary: {
        id: 'bambous', waypoint: { x: 4, y: 12 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~##############...#######.#~~',
            '~~##############...######...~~',
            '~~######.......#......###..#~~',
            '~~######...................#~~',
            '~~#####...............##...#~~',
            '~~####....##..#............#~~',
            '~~####...##...#............#~~',
            '~~###....#........##.......#~~',
            '~~......##..................~~',
            '<~S....###.#................~>',
            '~~..W...####................~~',
            '~~###....##.......##........~~',
            '~~####"""###..#............#~~',
            '~~####""""##..#...........##~~',
            '~~#####""........."...##..##~~',
            '~~######......."""""""...###~~',
            '~~######.......###".....####~~',
            '~~#######..#################~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.07,
            table: [
                { templateId: 'lingzhi_maudit', name: 'Lingzhi des fougères', weight: 5, offset: -1 },
                { templateId: 'assassin_masque', name: 'Ombre rampante', weight: 3, offset: 0 },
                { templateId: 'shu_jing', name: 'Jeune esprit du bambou', weight: 1, offset: 1 },
                { templateId: 'shan_gui', name: "Shan Gui", weight: 5, offset: -1 },
                { templateId: 'xiong_jing', name: "Xiong Jing", weight: 3, offset: 0 },
                { templateId: 'she_jing', name: "She Jing", weight: 3, offset: 0 }
            ]
        },
        places: {
            parley_sun3: [17, 4],
            bambous_assassin: [16, 9],
            bambous_fungus: [12, 17],
            bambous_priestess: [20, 7],
            old_pine: [9, 19],
            sun3_wardens_a: [24, 8],
            sun3_wardens_b: [24, 14],
            sun_3: [27, 11],
            temple_bell: [17, 2],
            bambous_chest: [26, 3]
        }
    }
};

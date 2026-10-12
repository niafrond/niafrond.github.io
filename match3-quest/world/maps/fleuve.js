// Région 2 — Lit du Fleuve Jaune : Berge des Barques Échouées, Port-à-Sec de Hekou, Écluse-aux-Oies, Méandres de Boue et d'Écluses, sept maisons.
// Cartes natives (format v2, world/DESIGN-V2.md) : route 44×16, village 32×28, hameau 28×22, route principale 48×24, sanctuaire 30×22.
// Légende : # coque/banc de sable/roche · ~ flaque ou fosse · = quai, passerelle ou piste · " roseaux (hautes herbes) · A-E bâtiments (porte minuscule) ·
// W pierre de voyage · S apparition · < > ^ v bords de carte. Entités posées par x/y (voir world/FORMAT.md §9).

export default {
    road: {
        id: 'fleuve_road', biome: 'riverbed', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~##########################################~',
            '~####.....#....#............#.####......###~',
            '~###..###.#........~~~~~......#......##..##~',
            '~##.......##.=====.~~~~~......#.=====##...#~',
            '~##.......#..=...=.~~##~.....##.=...=.....#~',
            '~.........#..=.#.=.~~~~~......#.=..#=......~',
            '<========##.==.#.===========..#.=..#=======>',
            '~.......=.#.=..#...=====...=..##=..#.......~',
            '~##.....=.#.=..#...~##~~...=..#.=.##......#~',
            '~##.....=...=.##...~~~~~...=....=..#..##..#~',
            '~##.###.====##.#..........###====..##.##..#~',
            '~######.....##.##.."""""""###...##.#.....##~',
            '~####..........#..."""""""..#......#....###~',
            '~##########################################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.1, safeSteps: 4,
            table: [
                { templateId: 'goblin_saboteur', name: 'Diablotin des flaques', weight: 5, offset: -1 },
                { templateId: 'plague_doctor', name: 'Sorcier des vases', weight: 3, offset: 0 },
                { templateId: 'deep_sea_serpent', name: 'Anguille de vase', weight: 3, offset: 0 },
                { templateId: 'iron_gladiator', name: 'Sentinelle d\'argile', weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'fleuve_road_toll_keeper', x: 14, y: 9 }
        ],
        chests: [
            { id: 'fleuve_road_chest_bank', x: 5, y: 3, gold: 30 },
            { id: 'fleuve_road_chest_ford', x: 26, y: 13, gold: 60 },
            { id: 'fleuve_road_chest_niche', x: 40, y: 3, gold: 60 }
        ],
        enemies: [
            { id: 'fleuve_road_mud_imp', x: 9, y: 13, templateId: 'goblin_saboteur', name: 'Diablotin des flaques', kind: 'sentinel', offset: -1 },
            { id: 'fleuve_road_plank_drowned', x: 19, y: 8, templateId: 'bone_reaver', name: 'Noyé de la passerelle', kind: 'patrol', patrol: [[19, 8], [23, 8]], offset: 0 },
            { id: 'fleuve_road_serpent', x: 24, y: 13, templateId: 'deep_sea_serpent', name: 'Anguille de vase', kind: 'sentinel', offset: 0 },
            { id: 'fleuve_road_doctor', x: 38, y: 9, templateId: 'plague_doctor', name: 'Docteur-démon des berges', kind: 'sentinel', offset: 0 },
            { id: 'fleuve_road_prowler', x: 12, y: 3, templateId: 'shadow_assassin', name: 'Rôdeur des berges', kind: 'patrol', patrol: [[12, 3], [17, 3]], offset: 0 }
        ]
    },

    village: {
        id: 'fleuve_village', biome: 'riverbed', native: true,
        grid: [
            '~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~',
            '~##############.###############~',
            '~##############.###############~',
            '~#####....................#####~',
            '~###.AAAA##.BBBBB.##.CCCC...###~',
            '~##..AAAA##.BBBBB....CCCC....##~',
            '~##..AaAA...BBbBB....CcCC....##~',
            '~##...=.......=.......=......##~',
            '~##.=====S==================.##~',
            '~##.....===============......##~',
            '~###....=...~~~~~~~...=......##~',
            '~##.W...=.~####~~~~~~.=......##~',
            '~.......=~~####~~~~~~~=........~',
            '<==============================>',
            '~.......=~~~~~~~~###~~=........~',
            '~##.....=.~~~~~~~###~.=......##~',
            '~##.....=...~~~~~~~...=......##~',
            '~##.....===============.....###~',
            '~##.========================.##~',
            '~##..DDDDD.#.........#EEEE...##~',
            '~##..DDDDD.#=========#EEEE...##~',
            '~##..DDdDD.#.#.....#.#EeEE...##~',
            '~##....=...#.........#.=.....##~',
            '~######.#######.######......###~',
            '~#####.....#.........#....#####~',
            '~##############.###############~',
            '~##############.###############~',
            '~~~~~~~~~~~~~~~v~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_fleuve', x: 24, y: 11 },
            { id: 'girl_lian', x: 6, y: 15 },
            { id: 'boatman_shan', x: 5, y: 17 },
            { id: 'hua_fleuve', x: 26, y: 9 },
            { id: 'ferry_pei', x: 16, y: 18 },
            { id: 'fortune_sha', x: 7, y: 9 },
            { id: 'tea_zhuang', x: 25, y: 14 },
            { id: 'fleuve_village_kid_ming', x: 11, y: 7 },
            { id: 'fleuve_village_old_caulker', x: 6, y: 12 },
            { id: 'fleuve_village_dock_clerk', x: 20, y: 7 },
            { id: 'fleuve_village_rope_maker', x: 14, y: 22 }
        ],
        chests: [
            { id: 'fleuve_garden_a', x: 8, y: 24, gold: 30, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'fleuve_garden_b', x: 24, y: 24, gold: 30, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'fleuve_market_a', x: 13, y: 24, gold: 60, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'fleuve_market_b', x: 18, y: 24, gold: 60, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' },
            { id: 'fleuve_village_cache', x: 27, y: 4, gold: 60 }
        ]
    },

    hamlet: {
        id: 'fleuve_hamlet', biome: 'riverbed', native: true,
        grid: [
            '~~~~~~~~~~~~~~^~~~~~~~~~~~~~',
            '~############...###########~',
            '~############...###########~',
            '~####.........=........####~',
            '~###..AAAAA...=.....##..###~',
            '~##...AAAAA...=.....##...##~',
            '~##...AAaAA...=..........##~',
            '~##.....=.....=..........##~',
            '~##..=====S============#.##~',
            '~##...W.......=..........##~',
            '~##.~~~~~~~~~===~~~~~~~~.##~',
            '~##.~~~~~~~~~===~~~~~~~~.##~',
            '~##.~~~~~~~~~===~~~~~~~~.##~',
            '~##...........=..........##~',
            '~##...........=...BBBB...##~',
            '~##.##============BBBB=..##~',
            '~##.##........=...BbBB...##~',
            '~###......###......=....###~',
            '~####..................####~',
            '~##########################~',
            '~##########################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'goose_dagong', x: 15, y: 9 },
            { id: 'orphan_xiaoyu', x: 8, y: 13 },
            { id: 'poet_bo', x: 21, y: 9 },
            { id: 'fleuve_hamlet_kid_dun', x: 17, y: 7 }
        ],
        chests: [
            { id: 'goose_nest', x: 12, y: 13, gold: 30 },
            { id: 'fleuve_hamlet_sluice_barrel', x: 6, y: 17, gold: 60 }
        ]
    },

    wild: {
        id: 'fleuve_wild', biome: 'riverbed', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~##############################################~',
            '~##############################################~',
            '~###..........~~~................#####.....####~',
            '~.....#.##.....""""""...~~~.......###....#..###~',
            '<=======##===.""""""""............##.........##~',
            '~..........~~~."""""###.......##..##...##""..##~',
            '~##.W.......==#==~~============........##....##~',
            '~###..........#...............========~......##~',
            '~##########################...=...##......##.##~',
            '~#####........................#...##......##.##~',
            '~####...#.=============.......=...##..###....##~',
            '~###......=##....####.####....=...##.........##~',
            '~###.#..".=##....#....===#=====...###...~~..###~',
            '~###.#."""=......###########."""..####.....####~',
            '~###....".=.#......."""".....""".##############~',
            '~###......=....################################~',
            '~###......#.........................~~~........~',
            '~###..~~~.=................#........~~~.##.....~',
            '~###..~~~.========##=======#============##=====>',
            '~####...................=.""""###...===........~',
            '~#####........#.........=.."""".....~~~.....###~',
            '~#####################..=..####################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~v~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.12, safeSteps: 3,
            table: [
                { templateId: 'goblin_saboteur', name: 'Diablotin des flaques', weight: 5, offset: -1 },
                { templateId: 'plague_doctor', name: 'Sorcier des vases', weight: 3, offset: 0 },
                { templateId: 'deep_sea_serpent', name: 'Anguille de vase', weight: 3, offset: 0 },
                { templateId: 'bone_reaver', name: 'Noyé errant', weight: 2, offset: 0 },
                { templateId: 'iron_gladiator', name: 'Sentinelle d\'argile', weight: 1, offset: 1 }
            ]
        },
        npcs: [
            { id: 'carp_jin', x: 6, y: 17 },
            { id: 'mud_imp_pit', x: 14, y: 13 },
            { id: 'captain_lo', x: 16, y: 13 },
            { id: 'fleuve_wild_old_surveyor', x: 32, y: 4 }
        ],
        chests: [
            { id: 'mud_cache', x: 13, y: 3, gold: 30 },
            { id: 'sluice_key_chest', x: 44, y: 5, gold: 60 },
            { id: 'carp_pearl', x: 5, y: 19, gold: 60 },
            { id: 'wreck_hoard', x: 19, y: 13, gold: 90 },
            { id: 'journal_page_fle', x: 8, y: 21, gold: 30 },
            { id: 'barge_strongbox', x: 23, y: 13, gold: 60 },
            { id: 'reed_stash', x: 38, y: 13, gold: 60 },
            { id: 'fleuve_wild_chest_trench', x: 35, y: 21, gold: 30 },
            { id: 'fleuve_wild_chest_hidden', x: 37, y: 4, gold: 90 }
        ],
        enemies: [
            { id: 'fleuve_sluice_golem', x: 43, y: 19, templateId: 'iron_gladiator', name: 'Golem de l\'écluse', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Golem de l\'écluse', level: 4 } },
            { id: 'fleuve_salt_thief', x: 26, y: 5, templateId: 'shadow_assassin', name: 'Voleur de sel masqué', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fleuve_w_doctor', x: 20, y: 4, templateId: 'plague_doctor', name: 'Docteur-démon des vases', kind: 'sentinel', offset: -1 },
            { id: 'fleuve_w_serpent', x: 28, y: 4, templateId: 'deep_sea_serpent', name: 'Serpent de vase', kind: 'patrol', patrol: [[28, 4], [28, 13]], offset: 0 },
            { id: 'fleuve_w_drowned', x: 6, y: 12, templateId: 'bone_reaver', name: 'Noyé sans barque', kind: 'patrol', patrol: [[6, 12], [6, 16]], offset: 0 },
            { id: 'barge_ghost_a', x: 19, y: 15, templateId: 'bone_reaver', name: 'Matelot noyé revenant', kind: 'sentinel', offset: 0, permanent: true, group: 'barge_ghosts' },
            { id: 'barge_ghost_b', x: 23, y: 15, templateId: 'bone_reaver', name: 'Matelot noyé revenant', kind: 'sentinel', offset: 0, permanent: true, group: 'barge_ghosts' },
            { id: 'mud_imp_a', x: 13, y: 20, templateId: 'goblin_saboteur', name: 'Diablotin de vase', kind: 'sentinel', offset: 0, permanent: true, group: 'mud_imps' },
            { id: 'mud_imp_b', x: 41, y: 11, templateId: 'goblin_saboteur', name: 'Diablotin de vase', kind: 'sentinel', offset: 0, permanent: true, group: 'mud_imps' },
            { id: 'fleuve_wild_patrol_crab', x: 30, y: 19, templateId: 'goblin_saboteur', name: 'Crabe de vase', kind: 'patrol', patrol: [[30, 19], [34, 19]], offset: 0 },
            { id: 'fleuve_wild_patrol_eel', x: 6, y: 6, templateId: 'deep_sea_serpent', name: 'Anguille des chenaux', kind: 'patrol', patrol: [[6, 6], [10, 6]], offset: -1 },
            { id: 'fleuve_wild_lock_guard', x: 43, y: 17, templateId: 'iron_gladiator', name: 'Garde-vanne rouillé', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'sluice_key_chest',
            lockedMessage: 'La grande écluse est verrouillée : sa clé repose dans un coffre, quelque part dans les méandres.'
        }
    },

    interiors: [
        {
            id: 'fleuve_h_gu', house: 'A',
            grid: [
                '###########',
                '#.2..1....#',
                '#.........#',
                '#.##...##.#',
                '#.........#',
                '#....S....#',
                '#####v#####'
            ],
            npcs: [
                { id: 'ferryman_gu', at: '1' }
            ],
            chests: [
                { id: 'ferry_lockbox', at: '2', gold: 30 }
            ]
        },
        {
            id: 'fleuve_h_mei', house: 'B',
            grid: [
                '############',
                '#.1........#',
                '#..####....#',
                '#..#..#..2.#',
                '#..####....#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'weaver_mei', at: '1' }
            ],
            chests: [
                { id: 'mei_thread_box', at: '2', gold: 30 }
            ]
        },
        {
            id: 'fleuve_h_sel', house: 'C',
            grid: [
                '############',
                '#.##.....1.#',
                '#.##.....#.#',
                '#........#.#',
                '#.2..##....#',
                '#....##....#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'salt_hu', at: '1' }
            ],
            chests: [
                { id: 'salt_barrel', at: '2', gold: 60 }
            ]
        },
        {
            id: 'fleuve_h_ecrivain', house: 'D',
            grid: [
                '##########',
                '#.##..1..#',
                '#.##.....#',
                '#....##..#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'scribe_ou', at: '1' }
            ],
            chests: []
        },
        {
            id: 'fleuve_h_tortue', house: 'E',
            grid: [
                '############',
                '#..........#',
                '#.~~~~.....#',
                '#.~~~~..1..#',
                '#.~~~~.....#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'gui_turtle', at: '1' }
            ],
            chests: []
        },
        {
            id: 'fleuve_h2_ecluse', house: 'A', in: 'hamlet',
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
                { id: 'sluicekeeper_rong', at: '1' }
            ],
            chests: [
                { id: 'sluice_logbook_box', at: '5', gold: 30 }
            ]
        },
        {
            id: 'fleuve_h2_pecheur', house: 'B', in: 'hamlet',
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
                { id: 'net_mender_wei', at: '1' }
            ],
            chests: [
                { id: 'net_basket', at: '5', gold: 30 }
            ]
        }
    ],

    sanctuary: {
        id: 'fleuve', waypoint: { x: 5, y: 15 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~############################~',
            '~############################~',
            '~####.......########.....####~',
            '~###..##.....######.."""..###~',
            '~##.........#.####.."#"""..##~',
            '~##.........#.####.#.....#.##~',
            '~##..~~~......####.#..##...##~',
            '~##..~~~""""..####....##...##~',
            '~##......""...####.........##~',
            '~...............#............~',
            '<===S======================..>',
            '~.......#......##............~',
            '~##.....#.....####.........##~',
            '~##...........####.#..##...##~',
            '~###.W........####.#..##...##~',
            '~###....~~##..####.......#.##~',
            '~###....~~...######.#"""".###~',
            '~####.......########"""""####~',
            '~############################~',
            '~############################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.1, safeSteps: 4,
            table: [
                { templateId: 'goblin_saboteur', name: 'Diablotin des flaques', weight: 5, offset: -1 },
                { templateId: 'plague_doctor', name: 'Sorcier des vases', weight: 3, offset: 0 },
                { templateId: 'deep_sea_serpent', name: 'Anguille de vase', weight: 3, offset: 0 }
            ]
        },
        places: {
            parley_sun2: [21, 16],
            fleuve_chest: [25, 4],
            drowned_a: [7, 5],
            drowned_b: [11, 5],
            river_serpent: [23, 5],
            fleuve_doctor: [10, 13],
            fleuve_lich: [6, 17],
            sun2_wardens_a: [24, 9],
            sun2_wardens_b: [24, 13],
            sun_2: [27, 11]
        }
    }
};

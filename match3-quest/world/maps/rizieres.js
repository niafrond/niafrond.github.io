// Région 1 — Rizières Desséchées : Hameau de Dongqiao, Hameau des Lucioles, Digue et Marais Craquelés, sept maisons.
// Cartes natives (format v2, world/DESIGN-V2.md) : village 32×28, hameau 28×22, route principale 48×24, sanctuaire 30×22.
// Légende : # roseaux/murs · ~ mare craquelée · = ruelle ou digue · " hautes herbes · A-E bâtiments (porte minuscule) · W pierre de voyage ·
// S apparition · < > ^ v bords de carte. Entités posées par x/y (voir world/FORMAT.md §9).

export default {
    village: {
        id: 'rizieres_village', biome: 'paddy', native: true,
        grid: [
            '~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~',
            '~##############.###############~',
            '~##############.###############~',
            '~####.....................#####~',
            '~#####AAAA.##.BBBB.##.CCCC#####~',
            '~####.AAAA.##.BBBB.##.CCCC.####~',
            '~##...AaAA....BbBB....CcCC...##~',
            '~##....S.......=.......=.....##~',
            '~##..=======================.##~',
            '~##.#..........=.............##~',
            '~##.........========...~~~~.###~',
            '~##....~~~.==========..~~~~.###~',
            '~##...~~~~~====#======.....#...~',
            '~##..~~~~~~~===================>',
            '~##...~~~~~==========..........~',
            '~##....~~~..========.......#.##~',
            '~##...DDDDD..=.......EEEE....##~',
            '~##..WDDDDD..=.......EEEE....##~',
            '~####.DDdDD..=.......EeEE....##~',
            '~###....=....=........=......##~',
            '~###.======================.###~',
            '~###.........=====..........###~',
            '~#######.####....####.#########~',
            '~#####......#............######~',
            '~#####......###.#........######~',
            '~##############.###############~',
            '~##############.###############~',
            '~~~~~~~~~~~~~~~v~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_rizieres', x: 19, y: 10 },
            { id: 'xiaobao', x: 24, y: 12 },
            { id: 'hua_riz', x: 11, y: 10 },
            { id: 'scarecrow_cao', x: 27, y: 9 },
            { id: 'matchmaker_hong', x: 10, y: 9 },
            { id: 'lao_shuo_riz', x: 15, y: 15 },
            { id: 'rizieres_village_potter', x: 20, y: 15 },
            { id: 'rizieres_village_kid_lan', x: 11, y: 14 },
            { id: 'rizieres_village_old_watch', x: 26, y: 15 },
            { id: 'rizieres_village_porter', x: 12, y: 19 }
        ],
        chests: [
            { id: 'rizieres_garden_a', x: 6, y: 23, gold: 15, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'rizieres_garden_b', x: 28, y: 6, gold: 15, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'rizieres_market_a', x: 19, y: 23, gold: 30, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'rizieres_market_b', x: 23, y: 23, gold: 30, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' },
            { id: 'rizieres_village_cache', x: 3, y: 15, gold: 30 }
        ]
    },

    hamlet: {
        id: 'rizieres_hamlet', biome: 'paddy', native: true,
        grid: [
            '~~~~~~~~~~~~~~^~~~~~~~~~~~~~',
            '~############...###########~',
            '~############...###########~',
            '~####.........=........####~',
            '~###......##..=.#.......###~',
            '~##..BBBB.....=....AAAA..##~',
            '~##..BBBB.....=....AAAA..##~',
            '~##..BbBB.....=....AaAA..##~',
            '~##..================....##~',
            '~##.......====S====......##~',
            '~##.......===#=====......##~',
            '~##...........=..........##~',
            '~##..W.~~~~...=....~~~...##~',
            '~##..~~~~~~~~.=....~~~...##~',
            '~##..~~~~~~~~.=..........##~',
            '~##..~~~~~~~~.=..........##~',
            '~##..~~~~~~~==========...##~',
            '~####..~~~~............####~',
            '~####.................#####~',
            '~##########################~',
            '~##########################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'duck_fu', x: 13, y: 15 },
            { id: 'kid_dandan', x: 16, y: 11 },
            { id: 'pigeon_zhao', x: 23, y: 10 },
            { id: 'monk_kong', x: 11, y: 6 },
            { id: 'rizieres_hamlet_weaver_zhu', x: 5, y: 10 }
        ],
        chests: [
            { id: 'duck_pond_cache', x: 5, y: 17, gold: 15 },
            { id: 'hamlet_well_box', x: 15, y: 11, gold: 30 },
            { id: 'rizieres_hamlet_reed_basket', x: 24, y: 16, gold: 30 }
        ]
    },

    wild: {
        id: 'rizieres_wild', biome: 'paddy', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~##############################################~',
            '~##############################################~',
            '~####....#.....##~~##...#........##############~',
            '~###.....#.~~~..#~~#~~..#.~~....~~#######..####~',
            '~##......#.......~~.~~..#.~~==..~~.#####....###~',
            '~##..""..##......~~.....#...==.....####..##..##~',
            '~##""""".#.......~~.....#..#==.....####..##..##~',
            '~##""""".#.=====.~~..##.##.#=====#.####......##~',
            '~##.""".##.=.#.=.~~.....#..=..#..#.####.#....##~',
            '~........#.=.#.=.~~.....#..=..#..=.####.#......~',
            '<=======.#.=.#.========##..=..#..=.............~',
            '~......=.#.=.#...==...=.#."=".##.==============>',
            '~##W...=...=.##..~~...=.#."=".#................~',
            '~##....=...=.#...~~...=....=..#....####......##~',
            '~##.~~~~====.#...~~...======.##....####.##...##~',
            '~##.~~~~.....#.##~~.~~....=...#.~~.####.##...##~',
            '~##.........##.##~~.~~....~~..#.~~.####..""".##~',
            '~##..""""....#...~~.......~~""#....####..""#.##~',
            '~###.""""....#..#~~#......="""#...######...####~',
            '~####........#.##~~##.....=...#..########..####~',
            '~#######################..=..##################~',
            '~########################...###################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~v~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.1, safeSteps: 4,
            table: [
                { templateId: 'crapaud_boue', name: 'Crapaud de boue', weight: 5, offset: -1 },
                { templateId: 'huli_jing', name: 'Renardeau des roseaux', weight: 4, offset: 0 },
                { templateId: 'gui_guerrier', name: 'Épouvantail raide', weight: 2, offset: 0 },
                { templateId: 'shu_jing', name: 'Esprit des diguettes', weight: 1, offset: 1 },
                { templateId: 'cao_jing', name: "Cao Jing", weight: 5, offset: -1 },
                { templateId: 'huli_commun', name: "Huli", weight: 5, offset: -1 },
                { templateId: 'shui_gui', name: "Shui Gui", weight: 5, offset: -1 },
                { templateId: 'jingwei', name: "Jingwei", weight: 5, offset: -1 },
                { templateId: 'zu_xian', name: "Zu Xian", weight: 5, offset: -1 },
                { templateId: 'xuan_she', name: "Xuan She", weight: 3, offset: 0 }
            ]
        },
        npcs: [
            { id: 'huang_xian', x: 31, y: 10 },
            { id: 'crow_wing', x: 29, y: 4 },
            { id: 'toad_chan', x: 5, y: 14 },
            { id: 'rizieres_wild_old_dikekeeper', x: 33, y: 14 }
        ],
        chests: [
            { id: 'dike_cache', x: 10, y: 10, gold: 15 },
            { id: 'reed_kite', x: 16, y: 6, gold: 30 },
            { id: 'warden_hoard', x: 44, y: 8, gold: 45 },
            { id: 'journal_page_riz', x: 32, y: 3, gold: 15 },
            { id: 'rice_idol', x: 5, y: 20, gold: 30 },
            { id: 'rizieres_wild_chest_jar', x: 14, y: 3, gold: 15 },
            { id: 'rizieres_wild_chest_dike', x: 22, y: 18, gold: 30 },
            { id: 'rizieres_wild_chest_shrine', x: 42, y: 20, gold: 45 }
        ],
        enemies: [
            { id: 'rizieres_warden', x: 45, y: 12, templateId: 'shu_jing', name: 'Gardien de la digue', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Gardien de la digue', level: 4 } },
            { id: 'rizieres_marsh_imp', x: 28, y: 18, templateId: 'huli_jing', name: 'Démon des roseaux', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'rizieres_w_toad', x: 8, y: 7, templateId: 'crapaud_boue', name: 'Crapaud de boue', kind: 'sentinel', offset: -1 },
            { id: 'rizieres_w_lingzhi', x: 23, y: 9, templateId: 'lingzhi_maudit', name: 'Lingzhi des diguettes', kind: 'sentinel', offset: 0 },
            { id: 'rizieres_w_spirit', x: 21, y: 12, templateId: 'shu_jing', name: 'Esprit des diguettes', kind: 'patrol', patrol: [[21, 12], [21, 15]], offset: 0 },
            { id: 'rizieres_w_waterthief', x: 5, y: 18, templateId: 'huli_jing', name: 'Voleur d\'eau', kind: 'patrol', patrol: [[5, 18], [12, 18]], offset: 0 },
            { id: 'crow_a', x: 25, y: 6, templateId: 'huli_jing', name: 'Corbeau-démon voleur', kind: 'sentinel', offset: 0, permanent: true, group: 'crow_gang' },
            { id: 'crow_b', x: 31, y: 6, templateId: 'huli_jing', name: 'Corbeau-démon voleur', kind: 'sentinel', offset: 0, permanent: true, group: 'crow_gang' },
            { id: 'rizieres_mill_ghost', x: 34, y: 7, templateId: 'gui_guerrier', name: 'Meunier revenant', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'rizieres_wild_patrol_toads', x: 42, y: 8, templateId: 'crapaud_boue', name: 'Crapauds en file', kind: 'patrol', patrol: [[42, 8], [42, 16]], offset: -1 },
            { id: 'rizieres_wild_patrol_imp', x: 10, y: 5, templateId: 'huli_jing', name: 'Petit jing des diguettes', kind: 'patrol', patrol: [[10, 5], [16, 5]], offset: 0 },
            { id: 'rizieres_wild_scarecrow', x: 44, y: 17, templateId: 'shu_jing', name: 'Épouvantail possédé', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'rizieres_warden',
            lockedMessage: 'Le vieux gardien de la digue, rendu fou par la chaleur, barre le chemin du sanctuaire : il faut le calmer avant de passer.'
        }
    },

    interiors: [
        {
            id: 'rizieres_h_houyi', house: 'A',
            grid: [
                '###########',
                '#.##...1..#',
                '#.#.......#',
                '#.....##..#',
                '#.2.......#',
                '#....S....#',
                '#####v#####'
            ],
            npcs: [
                { id: 'change', at: '1' }
            ],
            chests: [
                { id: 'houyi_trunk', at: '2', gold: 15 }
            ]
        },
        {
            id: 'rizieres_h_wen', house: 'B',
            grid: [
                '##########',
                '#.###..1.#',
                '#.#......#',
                '#...##...#',
                '#2.......#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'elder_wen', at: '1' }
            ],
            chests: [
                { id: 'wen_scroll_box', at: '2', gold: 15 }
            ]
        },
        {
            id: 'rizieres_h_lin', house: 'C',
            grid: [
                '##########',
                '#..#..1..#',
                '#..#.....#',
                '#....##..#',
                '#.2......#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'farmer_lin', at: '1' },
                { id: 'ping', at: '2' }
            ],
            chests: []
        },
        {
            id: 'rizieres_h_grenier', house: 'D',
            grid: [
                '############',
                '#.##..##.1.#',
                '#.##..##...#',
                '#..........#',
                '#.2........#',
                '#..###.....#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'grandma_tao', at: '1' }
            ],
            chests: [
                { id: 'granary_sack', at: '2', gold: 30 }
            ]
        },
        {
            id: 'rizieres_h_etable', house: 'E',
            grid: [
                '############',
                '#..........#',
                '#.#.#.#.#..#',
                '#..........#',
                '#..1.......#',
                '#.#.#.#.#..#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'buffalo_dahei', at: '1' }
            ],
            chests: []
        },
        {
            id: 'rizieres_h2_moulin', house: 'A', in: 'hamlet',
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
                { id: 'miller_gao', at: '1' }
            ],
            chests: [
                { id: 'mill_flour_bin', at: '5', gold: 15 }
            ]
        },
        {
            id: 'rizieres_h2_lucioles', house: 'B', in: 'hamlet',
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
                { id: 'aunt_liu', at: '1' }
            ],
            chests: [
                { id: 'firefly_jar', at: '5', gold: 15 }
            ]
        }
    ],

    sanctuary: {
        id: 'rizieres', waypoint: { x: 5, y: 7 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~############################~',
            '~############################~',
            '~####.......########.....####~',
            '~###..##.....######..."...###~',
            '~##........#..####.."""""#.##~',
            '~##........#..####.."""""..##~',
            '~##..W........####...##....##~',
            '~###..........~~~~...##....##~',
            '~##...........~~~~.........##~',
            '~............................~',
            '<===S======================..>',
            '~..............##............~',
            '~##...........~~~~.........##~',
            '~##...........~~~~.....##..##~',
            '~##..~~~~.....####.#...##..##~',
            '~##..~~~~.....####.#.""""..##~',
            '~###......##.######.""""""###~',
            '~####.......########.."".####~',
            '~############################~',
            '~############################~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: {
            rate: 0.1, safeSteps: 4,
            table: [
                { templateId: 'crapaud_boue', name: 'Crapaud de boue', weight: 5, offset: -1 },
                { templateId: 'huli_jing', name: 'Renardeau des roseaux', weight: 4, offset: 0 },
                { templateId: 'shu_jing', name: 'Esprit des diguettes', weight: 1, offset: 1 },
                { templateId: 'hua_jing', name: "Hua Jing", weight: 3, offset: 0 },
                { templateId: 'shuihou', name: "Shuihou", weight: 5, offset: -1 },
                { templateId: 'qing_she', name: "Qing She", weight: 5, offset: -1 },
                { templateId: 'she_shen', name: "She Shen", weight: 3, offset: 0 },
                { templateId: 'du_she', name: "Du She", weight: 3, offset: 0 }
            ]
        },
        places: {
            lotus_cache: [5, 17],
            fengmeng_1: [15, 11],
            rizieres_goblin: [20, 14],
            rizieres_shroom: [26, 16],
            rizieres_guardian: { x: 20, y: 6, patrol: [[20, 6], [20, 15]] },
            rice_thief: [25, 8],
            sun_1: [27, 11]
        }
    }
};

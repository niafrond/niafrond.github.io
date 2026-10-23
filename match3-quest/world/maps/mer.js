// Région 8 — Rivage de la Mer Orientale : Port aux Perles de Haiyan (village 32×28), jetée (route 44×16), Falaises et Criques du Dragon
// (côte 48×24 : criques, bancs de sable, ponton vers le hameau), Anse des Coquillages (hameau 28×22, sortie vers l'archipel), sanctuaire du Soleil des Marées (30×22).
// Légende : # falaises/coques/rochers · ~ mer · = quai/jetée · " herbes de dune · A-E bâtiments (porte minuscule) · W pierre de voyage.
// Cartes natives (jamais étirées) : voir world/DESIGN-V2.md et world/FORMAT.md §9.

export default {
    village: {
        id: 'mer_village', biome: 'coast', native: true,
        grid: [
            '~~~~~~~~~~~~~~.^.~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~.==~~~~~~~~~~~~~~~',
            '~~##########...==....###....##~~',
            '~~#########....==.....##.EEEEE~~',
            '~~#AAAAAABBBBB.==.CCCCCC.EEEEE~~',
            '~~.AAAAAABBBBB.==.CCCCCC.EEEEE~~',
            '~~.AAAAAABBBBB.==.CCCCCC.EEEEE~~',
            '~~.AAaAAABBbBB.==.CCCcCC.EEeEE~~',
            '~~.==========================.~~',
            '~~.==========================.~~',
            '~~...........=====.2......5...~~',
            '~~#DDDDD....========.........#~~',
            '~~#DDDDD...W===~~====.1.......~~',
            '~~#DDDDD...====~~====.........~~',
            '..#DDdDD....========............',
            '<.============================.>',
            '..============================..',
            '~~........3....=S...0...4.....~~',
            '~~.##..##==============.......~~',
            '~~.#....#..==..==..==...##..##~~',
            '~~.#.6..#..==~~==~~==...##..##~~',
            '~~.#....#..==~~==~~==~....p...~~',
            '~~.#...7#.~==~~==~~==~~.8..#9.~~',
            '~~.#....#.~==~~=======~.##..##~~',
            '~~#######..~~##==~~#~~..##..##~~',
            '~~###........~~==~##........##~~',
            '~~~~~~~~~~~~~~..=~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~.v.~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_mer', at: 'p' },
            { id: 'hua_mer', x: 13, y: 10 },
            { id: 'crab_old_gong', x: 10, y: 18 },
            { id: 'girl_net_mi', at: '0' },
            { id: 'sailor_tai', at: '1' },
            { id: 'priestess_mazu', at: '2' },
            { id: 'singer_hailing', x: 12, y: 9 },
            { id: 'mer_village_meiling', at: '3' },
            { id: 'mer_village_awen', at: '4' },
            { id: 'mer_village_rong', x: 22, y: 9 },
            { id: 'mer_village_yue', at: '5' }
        ],
        chests: [
            { id: 'mer_garden_a', at: '6', gold: 195, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'mer_garden_b', at: '7', gold: 195, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'mer_market_a', at: '8', gold: 390, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'mer_market_b', at: '9', gold: 390, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' },
            { id: 'mer_village_stub_chest', x: 21, y: 23, gold: 240 }
        ]
    },

    hamlet: {
        id: 'mer_hamlet', biome: 'coast', native: true,
        grid: [
            '~~~~~~~~~~~~.^.~~~~~~~~~~~~~',
            '~~~~~~~~~~~~...~~~~~~~~~~~~~',
            '~~#########..=...#########~~',
            '~~########...=....########~~',
            '~~...AAAAAA..=...BBBBBB...~~',
            '~~...AAAAAA..=...BBBBBB...~~',
            '~~...AAAAAA..S...BBBBBB...~~',
            '~~...AAaAAA..=...BBBbBB...~~',
            '~~.0...=.....=......=....~~~',
            '~~.....==============..~~~~~',
            '~~..........====W...2~~~~~~~',
            '~~.......1.====#####..~~~~~~',
            '~~.============#####~~~~~~=.',
            '~~.=~~==~~=.====...========.',
            '~~.=~~==~~=...#....========.',
            '~~.========...#....=======~~',
            '~~.=~~==~~=...3.......~~~~~~',
            '~~.========.#........~~~~~~~',
            '~~##.......5#........4~~~~~~',
            '~~####..................#~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'gull_pip', at: '0' },
            { id: 'kid_ahu', at: '1' },
            { id: 'salt_jun', x: 6, y: 15 },
            { id: 'mer_hamlet_lanfang', at: '2' },
            { id: 'mer_hamlet_dao', at: '3' }
        ],
        chests: [
            { id: 'salt_pan', x: 4, y: 17, gold: 120 },
            { id: 'mer_hamlet_net_chest', at: '4', gold: 120 },
            { id: 'mer_hamlet_shell_chest', at: '5', gold: 240 }
        ],
        exits: [
            { x: 27, y: 13, to: 'mer_archipel' }
        ]
    },

    wild: {
        id: 'mer_wild', biome: 'coast', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~#######################################....#~~',
            '~~########################.##############..6.#~~',
            '~~.3......##.##.......#......###......###....#~~',
            '.........k##....#..."""""..p...."".q...###..##~~',
            '<.===========..##....#""..##...""""""..###t.#.~~',
            '..####.####.=========#........."=========.....~~',
            '~~###..##........o..=======.....=l.....m=.....~~',
            '~~..........~~~~~~~.....=.=.~~~~~~~..##.===...~~',
            '~~.5#...0..~~~~~~~~~....=.=.~~~~~~~~.##...=...~~',
            '~~..##.....~~~~~~~~~..===.=~~~~~~~~~~.....=...~~',
            '~~....W.....~~~~~~~~..=...=.=~~~~~~~~1....=...~~',
            '~~..."".#.i...~~~~..===...=.=~~~~~~...2.##=j..~~',
            '~~..""""#....""""".#=.....=.=.~.~.........=...~~',
            '~~..n"".....""""""".=========....##.....""="..~~',
            '~~....=.....##r.....=.s...=......=#.....""="....',
            '~~....=~.~.....~~~~.=.....=.~.~..=~~~~....====.>',
            '~~~~~#=~~~##~~~~~~~~=#~~~.=.~##~~=~~~~......#...',
            '~~~~~~=~~~~~~~~~~~~~=~~~~.=.~~#~~=~~~~........~~',
            '~~~~..=""".~~~~~~~..=.~~~.=.~~~~.=..#.......9.~~',
            '~~~~.4.""".~~~##~~..7..##...~~~.u.8...........~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~...~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~.v.~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: { rate: 0.1, safeSteps: 3, table: [
            { templateId: 'soldat_terre_cuite', name: 'Crabe des sables', weight: 5, offset: -1 },
            { templateId: 'assassin_masque', name: 'Rôdeur des dunes', weight: 4, offset: 0 },
            { templateId: 'jiaolong', name: 'Anguille de la grève', weight: 3, offset: 0 },
            { templateId: 'dame_des_neiges', name: 'Dame d\'écume', weight: 1, offset: 1 },
                { templateId: 'hai_ruo', name: "Hai Ruo", weight: 1, offset: 1 },
                { templateId: 'hai_she', name: "Hai She", weight: 3, offset: 0 },
                { templateId: 'xuanwu', name: "Xuanwu", weight: 1, offset: 1 },
                { templateId: 'shenlong', name: "Shenlong", weight: 1, offset: 1 }
        ] },
        npcs: [
            { id: 'mermaid_jiaoren', at: '0' },
            { id: 'jelly_shui', at: '1' },
            { id: 'octo_ba', at: '2' }
        ],
        chests: [
            { id: 'cove_cache', at: '3', gold: 120 },
            { id: 'tide_key_chest', at: '4', gold: 240 },
            { id: 'tear_pearl_chest', at: '5', gold: 240 },
            { id: 'dragon_grotto', at: '6', gold: 360 },
            { id: 'journal_page_mer', at: '7', gold: 120 },
            { id: 'reef_cache', at: '8', gold: 240 },
            { id: 'wreck_treasure', at: '9', gold: 360 },
            { id: 'mer_wild_dune_chest', at: 'i', gold: 240 }
        ],
        enemies: [
            { id: 'mer_tide_serpent', at: 'j', templateId: 'jiaolong', name: 'Serpent de marée', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Serpent de marée', level: 32 } },
            { id: 'mer_kelp_witch', at: 'k', templateId: 'dame_des_neiges', name: 'Dame des algues givrées', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'mer_w_crab', at: 'l', templateId: 'shanxiao', name: 'Démon des falaises', kind: 'patrol', offset: 0, patrol: ['l', 'm'] },
            { id: 'mer_w_wraith', at: 'n', templateId: 'wen_shen', name: 'Spectre de la marée', kind: 'patrol', offset: -1, patrol: ['n', [12, 15]] },
            { id: 'mer_w_cutter', at: 'o', templateId: 'assassin_masque', name: 'Coupeur de filets', kind: 'sentinel', offset: 0 },
            { id: 'mer_crab_a', at: 'p', templateId: 'crabe_soldat', name: 'Crabe-soldat', kind: 'sentinel', offset: 0, permanent: true, group: 'giant_crabs' },
            { id: 'mer_crab_b', at: 'q', templateId: 'crabe_soldat', name: 'Crabe-soldat', kind: 'sentinel', offset: 0, permanent: true, group: 'giant_crabs' },
            { id: 'mer_wild_pier_patrol', x: 26, y: 16, templateId: 'jiaolong', name: 'Anguille de la jetée', kind: 'patrol', offset: 0, patrol: [[26, 16], [26, 19]] },
            { id: 'mer_wild_dune_patrol', at: 'r', templateId: 'crabe_soldat', name: 'Crabe-lame des bancs', kind: 'patrol', offset: -1, patrol: ['r', 's'] },
            { id: 'mer_wild_grotto_guard', at: 't', templateId: 'jiaolong', name: 'Gardien de la grotte du dragon', kind: 'sentinel', offset: 1 },
            { id: 'mer_wild_reef_sentinel', at: 'u', templateId: 'wen_shen', name: 'Naufragé fiévreux du récif', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'tide_key_chest',
            lockedMessage: 'La grotte qui mène au sanctuaire est fermée par une porte de corail : sa clé de marée dort au fond d\'une crique.'
        }
    },

    road: {
        id: 'mer_road', biome: 'coast', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~.###################################....~~',
            '~~.2.#################################....~~',
            '...."""""........1.###"".......#..""""....~~',
            '<.==========...#...""""..#....7."""""""...~~',
            '....""""##.=.0.#.........#.....###."".##..~~',
            '~~......##.==.........6....======...8.##..~~',
            '~~..........================....=========.~~',
            '~~.............~~~~~~~~~...=.....~~~....=...',
            '~~...........~~~~~~~~~~~...=...~~~~~~...==.>',
            '~~............~~~~~~~~~~...=...~~~~~~~..##..',
            '~~..~~~~~......~~~~~~~.....=....~~~~~...##~~',
            '~~..~~~~~~....4.......5..............9..3.~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: { rate: 0.09, safeSteps: 3, table: [
            { templateId: 'soldat_terre_cuite', name: 'Petit crabe des galets', weight: 5, offset: -1 },
            { templateId: 'jiaolong', name: 'Anguille de rivage', weight: 3, offset: -1 },
            { templateId: 'wen_shen', name: 'Spectre d\'écume', weight: 1, offset: 1 },
                { templateId: 'hai_shen', name: "Hai Shen", weight: 1, offset: 1 },
                { templateId: 'ren_yu', name: "Ren Yu", weight: 3, offset: 0 },
                { templateId: 'longwang', name: "Longwang", weight: 1, offset: 1 },
                { templateId: 'long', name: "Long", weight: 1, offset: 1 }
        ] },
        npcs: [
            { id: 'mer_road_ferryman_zhong', at: '0' }
        ],
        chests: [
            { id: 'mer_road_driftwood_chest', at: '1', gold: 120 },
            { id: 'mer_road_cliff_chest', at: '2', gold: 240 },
            { id: 'mer_road_beach_chest', at: '3', gold: 360 }
        ],
        enemies: [
            { id: 'mer_road_beach_patrol', at: '4', templateId: 'crabe_soldat', name: 'Crabe-lame des galets', kind: 'patrol', offset: -1, patrol: ['4', '5'] },
            { id: 'mer_road_jetty_serpent', at: '6', templateId: 'jiaolong', name: 'Anguille de la jetée', kind: 'sentinel', offset: 0 },
            { id: 'mer_road_spray_witch', at: '7', templateId: 'dame_des_neiges', name: 'Dame des embruns', kind: 'sentinel', offset: 0 },
            { id: 'mer_road_tide_patrol', x: 32, y: 7, templateId: 'wen_shen', name: 'Spectre du reflux', kind: 'patrol', offset: -1, patrol: [[32, 7], '8'] },
            { id: 'mer_road_reef_wraith', at: '9', templateId: 'assassin_masque', name: 'Rôdeur des galets', kind: 'sentinel', offset: 0 }
        ]
    },

    interiors: [
        {
            id: 'mer_h_hai', house: 'A',
            grid: [
                '###########',
                '#.#.#...1.#',
                '#.#.#.....#',
                '#.........#',
                '#2........#',
                '#....S....#',
                '#####v#####'
            ],
            npcs: [
                { id: 'fisher_hai', at: '1' }
            ],
            chests: [
                { id: 'hai_net_box', at: '2', gold: 120 }
            ]
        },
        {
            id: 'mer_h_longwang', house: 'B',
            grid: [
                '############',
                '#....1.....#',
                '#.#......#.#',
                '#...~~~~...#',
                '#...~~~~..2#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'envoy_longwang', at: '1' }
            ],
            chests: [
                { id: 'envoy_coffer', at: '2', gold: 240 }
            ]
        },
        {
            id: 'mer_h_perles', house: 'C',
            grid: [
                '##########',
                '#.1....2.#',
                '#..####..#',
                '#........#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'pearl_diver_xi', at: '1' }
            ],
            chests: [
                { id: 'pearl_tray', at: '2', gold: 120 }
            ]
        },
        {
            id: 'mer_h_marin', house: 'D',
            grid: [
                '##########',
                '#.##..1..#',
                '#........#',
                '#.....##.#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'sailor_bao', at: '1' }
            ],
            chests: []
        },
        {
            id: 'mer_h_phare', house: 'E',
            grid: [
                '##########',
                '#.1......#',
                '#..####..#',
                '#..####..#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'lighthouse_ming', at: '1' }
            ],
            chests: []
        },
        {
            id: 'mer_h2_ecaillere', house: 'A', in: 'hamlet',
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
                { id: 'oyster_coque', at: '1' }
            ],
            chests: [
                { id: 'oyster_box', at: '5', gold: 120 }
            ]
        },
        {
            id: 'mer_h2_chantier', house: 'B', in: 'hamlet',
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
                { id: 'shipwright_bing', at: '1' }
            ],
            chests: [
                { id: 'shipyard_chest', at: '5', gold: 240 }
            ]
        }
    ],

    sanctuary: {
        id: 'mer', waypoint: { x: 4, y: 9 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~###................#....8.~~',
            '~~#####.......1......#......~~',
            '~~######.......~....##.2=.3.~~',
            '~~..####....~~~~~~~======...~~',
            '~~............~~~~=..#~~=~~~~~',
            '~~....##..........=...~~~~~~~~',
            '~~.........###....=..~~~~~~~~~',
            '~~..W.......#.....=#5~~~~~~~~~',
            '........~~~.=======...........',
            '<.=S====~~~==.....==========.>',
            '....."""~~~...................',
            '~~..."""".........##6.~~~~~~~~',
            '~~....""....##.....#.~~~~~~~~~',
            '~~...##.....##.....0.~~~~~~~~~',
            '~~####.....4.~~~~~...~~~~~~~~~',
            '~~######.....~~~~~..........~~',
            '~~######.###..."""""".......~~',
            '~~####.7......."."""........~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: { rate: 0.09, safeSteps: 4, table: [
            { templateId: 'soldat_terre_cuite', name: 'Crabe-soldat égaré', weight: 5, offset: 0 },
            { templateId: 'jiaolong', name: 'Anguille des marées', weight: 3, offset: 0 },
            { templateId: 'dame_des_neiges', name: 'Dame d\'embruns', weight: 1, offset: 1 },
                { templateId: 'hai_gui', name: "Hai Gui", weight: 3, offset: 0 },
                { templateId: 'kun', name: "Kun", weight: 1, offset: 1 },
                { templateId: 'panlong', name: "Panlong", weight: 3, offset: 0 }
        ] },
        places: {
            parley_sun8: '0',
            mer_witch: '1',
            net_cutter_a: '2',
            net_cutter_b: '3',
            mer_doctor: '4',
            sun8_wardens_a: '5',
            sun8_wardens_b: '6',
            sun_8: [27, 11],
            dragon_pearl: '7',
            mer_chest: '8',
            jian_quiver: [9, 7]
        }
    }
};

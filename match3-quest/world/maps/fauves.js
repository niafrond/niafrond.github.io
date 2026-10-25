// Région 7 — Plaine des Fauves : Enclos de Caoyuan (village 32×28), piste des troupeaux (route 44×16), Hautes Herbes de Cendre
// (vaste plaine 48×24, nappes d'herbe haute, lac et pont), Campement des Vents (hameau 28×22), sanctuaire du Soleil des Bêtes Folles (30×22).
// Légende : # palissade/bosquet/roc · ~ point d'eau · = piste · " hautes herbes · A-E yourtes et bâtiments (porte minuscule) · W pierre de voyage.
// Cartes natives (jamais étirées) : voir world/DESIGN-V2.md et world/FORMAT.md §9.

export default {
    village: {
        id: 'fauves_village', biome: 'savanna', native: true,
        grid: [
            '~~~~~~~~~~~~~~.^.~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~.==~~~~~~~~~~~~~~~',
            '~~###....###...==....###...###~~',
            '~~###.....##...==.....##.#####~~',
            '~~#AAAAAA.BBBBB==.CCCCCC.#...#~~',
            '~~.AAAAAA.BBBBB==.CCCCCC.#...#~~',
            '~~.AAAAAA.BBBBB==.CCCCCC.#..5#~~',
            '~~.AAaAAA.BBbBB==.CCCcCC.#...#~~',
            '~~.==========================#~~',
            '~~.==========================.~~',
            '~~...........======...3.......~~',
            '~~#DDDDD....========....EEEEEE~~',
            '~~#DDDDD...W===~~====...EEEEEE~~',
            '~~#DDDDD...====~~====...EEEEEE~~',
            '..#DDdDD....========....EEeEEE..',
            '<.============================.>',
            '..============================..',
            '~~.......1.....=S....2........~~',
            '~~.###..###....==.....=======.~~',
            '~~.#......#.##...4##.......##.~~',
            '~~.#.6....#.##...0##...~~~~~#.~~',
            '~~.#...#..#....p....========~.~~',
            '~~.#.....7#..8....9...~~~~~~~~~~',
            '~~.#......#.##....##..~~~~~~~~~~',
            '~~#########.##....##...~~~~~##~~',
            '~~#########....==.....########~~',
            '~~~~~~~~~~~~~~...~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~.v.~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'merchant_fauves', at: 'p' },
            { id: 'twins_mu', x: 13, y: 10 },
            { id: 'hua_fauves', at: '0' },
            { id: 'old_nomad_bayan', x: 19, y: 12 },
            { id: 'bandit_gerel', at: '1' },
            { id: 'drover_boldo', x: 26, y: 9 },
            { id: 'traveler_hui', x: 5, y: 16 },
            { id: 'fauves_village_naran', at: '2' },
            { id: 'fauves_village_khulan', x: 12, y: 9 },
            { id: 'fauves_village_erdene', at: '3' },
            { id: 'fauves_village_tsetseg', at: '4' }
        ],
        chests: [
            { id: 'nomad_trunk', at: '5', gold: 105, label: 'Malle du vieux nomade', openText: 'Une malle de feutre oubliée contre la palissade : des pièces, et un morceau de fromage vénérable.' },
            { id: 'fauves_garden_a', at: '6', gold: 165, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'fauves_garden_b', at: '7', gold: 165, puzzle: 'fauves_jarres', label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'fauves_market_a', at: '8', gold: 330, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'fauves_market_b', at: '9', gold: 330, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' },
            { id: 'fauves_village_pier_chest', x: 27, y: 21, gold: 210 }
        ]
    },

    hamlet: {
        id: 'fauves_hamlet', biome: 'savanna', native: true,
        grid: [
            '~~~~~~~~~~~~.^.~~~~~~~~~~~~~',
            '~~~~~~~~~~~~...~~~~~~~~~~~~~',
            '~~####...##..=..##########~~',
            '~~####.......=.....#######~~',
            '~~...AAAAAA..=...BBBBBB...~~',
            '~~...AAAAAA..=...BBBBBB...~~',
            '~~...AAAAAA..S...BBBBBB...~~',
            '~~...AAaAAA..=...BBBbBB..4~~',
            '~~.3...=.....=......=.....~~',
            '~~.....==============.....~~',
            '~~5##......1.=..........#.~~',
            '~~.##.0..##.=====.......#.~~',
            '~~.......##=====W.........~~',
            '~~..~~~....======..######.~~',
            '~~.~~~~~~...====......2.#.~~',
            '~~.~~~~~~....=.....#...6#.~~',
            '~~...~~~.....=.....######.~~',
            '~~.......###.=............~~',
            '~~##.7....#..=...##...####~~',
            '~~####............########~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        npcs: [
            { id: 'eagle_boy_temur', at: '0' },
            { id: 'grandma_altan', at: '1' },
            { id: 'mare_chagan', at: '2' },
            { id: 'fauves_hamlet_sarnai', at: '3' },
            { id: 'fauves_hamlet_ganbat', at: '4' }
        ],
        chests: [
            { id: 'eagle_nest', at: '5', gold: 105 },
            { id: 'fauves_hamlet_corral_chest', at: '6', gold: 210 },
            { id: 'fauves_hamlet_reed_chest', at: '7', gold: 105 }
        ]
    },

    wild: {
        id: 'fauves_wild', biome: 'savanna', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~..........###.......###..........###........~~',
            '~~..3.......###..7...."##"..........###.#..5..~~',
            '~~......#######..."""""###""".......###.#r..##~~',
            '..####..#######.i.""""""#""""".....######..###~~',
            '<.======="...##..###""""""""#"#....##.##......~~',
            '........=""0.###.###."#""""#####..............~~',
            '~~..##..=...m###.....##.......##........"""##.~~',
            '~~...~~.=##...##..................l....."""##.~~',
            '~~..~~~.=##...##.""..~~~8~~~...========.""..1.~~',
            '~~......=====.##""".~~~...~~...=.##...=......p~~',
            '~~..W...##..=.#."""=============.####.=.......~~',
            '~~.......###=n.."""============="""##.=."""o..~~',
            '~~.......###========~~~~~~~~~..."""###=""#"".q~~',
            '~~..................#~~~~~~.....""".##=."##...~~',
            '~~####...#######.j....k.......###"".##=...#.....',
            '~~####..########..####""""""""###...##========.>',
            '~~...........##..####"""""""#"""...####.........',
            '~~.4.....2...##..####""""#####"""#.######..##.~~',
            '~~.."""""".6.###...".""""#####...########..##.~~',
            '~~.."""""....###......."""."##...#####.9......~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.v.~~~~~~~~~~~~~~~'
        ],
        grass: { rate: 0.14, safeSteps: 3, table: [
            { templateId: 'loup_braise', name: 'Louveteau de braise', weight: 5, offset: -1 },
            { templateId: 'sanglier_flammes', name: 'Marcassin de flammes', weight: 4, offset: 0 },
            { templateId: 'tigre_embrase', name: 'Tigreau des chaumes', weight: 2, offset: 0 },
            { templateId: 'shanxiao', name: 'Ogre des herbes hautes', weight: 1, offset: 1 },
                { templateId: 'bai_ze', name: "Bai Ze", weight: 3, offset: 0 },
                { templateId: 'xiezhi', name: "Xiezhi", weight: 1, offset: 1 },
                { templateId: 'tianlu_gardien', name: "Tianlu", weight: 1, offset: 1 },
                { templateId: 'fuxi_dragon', name: "Fuxi", weight: 5, offset: -1 },
                { templateId: 'taotie_bronze', name: "Taotie", weight: 3, offset: 0 },
                { templateId: 'xiangliu', name: "Xiangliu", weight: 1, offset: 1 },
                { templateId: 'xingtian', name: "Xingtian", weight: 3, offset: 0 }
        ] },
        npcs: [
            { id: 'hare_tuzi', at: '0' },
            { id: 'wolf_pup_baatar', at: '1' },
            { id: 'ghost_rider_tolui', at: '2' }
        ],
        chests: [
            { id: 'grass_cache', at: '3', gold: 105 },
            { id: 'lost_lamb_pen', at: '4', gold: 210 },
            { id: 'alpha_den', at: '5', gold: 315 },
            { id: 'journal_page_fau', x: 41, y: 13, gold: 105 },
            { id: 'burial_mound', at: '6', gold: 210 },
            { id: 'pack_den', at: '7', gold: 315 },
            { id: 'fauves_wild_islet_chest', at: '8', gold: 210 },
            { id: 'fauves_wild_hollow_chest', at: '9', gold: 315 }
        ],
        enemies: [
            { id: 'fauves_alpha_tiger', x: 45, y: 17, templateId: 'tigre_embrase', name: 'Tigre alpha, Griffe-de-Feu', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Tigre alpha, Griffe-de-Feu', level: 27 } },
            { id: 'fauves_lamb_wolf', x: 6, y: 20, templateId: 'loup_braise', name: 'Loup chapardeur de braise', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fauves_boar_chief', x: 24, y: 20, templateId: 'sanglier_flammes', name: 'Hure, sanglier de flammes', kind: 'sentinel', offset: 1, permanent: true },
            { id: 'fauves_w_pack_a', at: 'i', templateId: 'loup_braise', name: 'Loup de la meute', kind: 'patrol', offset: 0, patrol: ['i', [23, 5]] },
            { id: 'fauves_w_pack_b', at: 'j', templateId: 'tigre_embrase', name: 'Tigresse des herbes', kind: 'patrol', offset: -1, patrol: ['j', 'k'] },
            { id: 'fauves_w_ogre', at: 'l', templateId: 'shanxiao', name: 'Ogre de la plaine', kind: 'sentinel', offset: 0 },
            { id: 'fauves_hyena_a', at: 'm', templateId: 'loup_braise', name: 'Hyène de braise', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_hyenas' },
            { id: 'fauves_hyena_b', at: 'n', templateId: 'loup_braise', name: 'Hyène de braise', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_hyenas' },
            { id: 'fauves_ember_bull', at: 'o', templateId: 'taureau_braise', name: 'Taureau de braise', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fauves_wild_boar_patrol', x: 21, y: 18, templateId: 'sanglier_flammes', name: 'Sanglier des vagues d\'herbe', kind: 'patrol', offset: 0, patrol: [[21, 18], [27, 18]] },
            { id: 'fauves_wild_jackal_patrol', at: 'p', templateId: 'loup_braise', name: 'Chacal de braise', kind: 'patrol', offset: -1, patrol: ['p', 'q'] },
            { id: 'fauves_wild_den_guard', at: 'r', templateId: 'tigre_embrase', name: 'Tigreau de la tanière', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'fauves_alpha_tiger',
            lockedMessage: 'Le tigre alpha de la plaine barre les hautes herbes : tant qu\'il rôde, la meute ne laissera aucun voyageur approcher du sanctuaire.'
        }
    },

    road: {
        id: 'fauves_road', biome: 'savanna', native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~..##########.#########.......########...~~',
            '.....#.#####...##########...6......####...~~',
            '<.======="".#..##.#####........=====......~~',
            '....."##="".#..##...........====..#=..#...~~',
            '~~....##=.0....##...~~....""=""...#=.4##..~~',
            '~~......=......#..~~~~~~1.."=""#...=.....2~~',
            '~~......=======.....~~.....==..##..=====..~~',
            '~~............====.....=====...##...##.==.~~',
            '~~####.....##....=======##.....##..###..=...',
            '~~#####.##.##....##""""""####..##.."""".==.>',
            '~~......5......#."#"""""######.##.."###.....',
            '~~.3.########..##."""""""#####.###########~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: { rate: 0.1, safeSteps: 3, table: [
            { templateId: 'loup_braise', name: 'Louveteau égaré', weight: 5, offset: -1 },
            { templateId: 'sanglier_flammes', name: 'Marcassin fouisseur', weight: 4, offset: -1 },
            { templateId: 'tigre_embrase', name: 'Tigreau de la piste', weight: 1, offset: 1 },
                { templateId: 'bai_ze_savant', name: "Bai Ze", weight: 1, offset: 1 },
                { templateId: 'bixie', name: "Bixie", weight: 3, offset: 0 },
                { templateId: 'pixiu_tresor', name: "Pixiu", weight: 1, offset: 1 },
                { templateId: 'chaofeng', name: "Chaofeng", weight: 5, offset: -1 },
                { templateId: 'taotie_bete', name: "Tao Tie", weight: 1, offset: 1 },
                { templateId: 'nian', name: "Nian", weight: 1, offset: 1 }
        ] },
        npcs: [
            { id: 'fauves_road_herder_oyun', at: '0' }
        ],
        chests: [
            { id: 'fauves_road_trough_chest', at: '1', gold: 105 },
            { id: 'fauves_road_camp_chest', at: '2', gold: 210 },
            { id: 'fauves_road_cairn_chest', at: '3', gold: 315 }
        ],
        enemies: [
            { id: 'fauves_road_scout', x: 9, y: 8, templateId: 'loup_braise', name: 'Éclaireur de la meute', kind: 'patrol', offset: 0, patrol: [[9, 8], [14, 8]] },
            { id: 'fauves_road_boar', x: 21, y: 11, templateId: 'sanglier_flammes', name: 'Sanglier fouisseur', kind: 'sentinel', offset: 0 },
            { id: 'fauves_road_hyena', at: '4', templateId: 'loup_braise', name: 'Hyène de la piste', kind: 'sentinel', offset: -1 },
            { id: 'fauves_road_alcove_tiger', at: '5', templateId: 'tigre_embrase', name: 'Tigresse de la combe', kind: 'sentinel', offset: 0 },
            { id: 'fauves_road_ridge_wolf', at: '6', templateId: 'loup_braise', name: 'Loup de crête', kind: 'sentinel', offset: 0 }
        ]
    },

    interiors: [
        {
            id: 'fauves_h_wu', house: 'A',
            grid: [
                '############',
                '#.#.#.#....#',
                '#.#.#.#..1.#',
                '#..........#',
                '#..........#',
                '#.........2#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'hunter_wu', at: '1' }
            ],
            chests: [
                { id: 'wu_quiver_box', at: '2', gold: 105 }
            ]
        },
        {
            id: 'fauves_h_zi', house: 'B',
            grid: [
                '##########',
                '#.1......#',
                '#...##...#',
                '#...##...#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'shepherd_zi', at: '1' }
            ],
            chests: []
        },
        {
            id: 'fauves_h_chevaux', house: 'C',
            grid: [
                '############',
                '#..........#',
                '#.#..#..#..#',
                '#.#..#..#.1#',
                '#.#..#..#..#',
                '#2.........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'horse_tian', at: '1' }
            ],
            chests: [
                { id: 'saddle_chest', at: '2', gold: 105 }
            ]
        },
        {
            id: 'fauves_h_chaman', house: 'D',
            grid: [
                '############',
                '#....1.....#',
                '#..........#',
                '#....##....#',
                '#........2.#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'shaman_ula', at: '1' }
            ],
            chests: [
                { id: 'shaman_drum_box', at: '2', gold: 210 }
            ]
        },
        {
            id: 'fauves_h_fromage', house: 'E',
            grid: [
                '##########',
                '#.##..##.#',
                '#.##..##.#',
                '#...1....#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'cheese_sa', at: '1' }
            ],
            chests: []
        },
        {
            id: 'fauves_h2_feutre', house: 'A', in: 'hamlet',
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
                { id: 'felt_maker_uyun', at: '1' }
            ],
            chests: [
                { id: 'felt_chest', at: '5', gold: 105 }
            ]
        },
        {
            id: 'fauves_h2_marechal', house: 'B', in: 'hamlet',
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
                { id: 'farrier_batu', at: '1' }
            ],
            chests: [
                { id: 'farrier_box', at: '5', gold: 210 }
            ]
        }
    ],

    sanctuary: {
        id: 'fauves', waypoint: { x: 4, y: 9 }, native: true,
        grid: [
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~###...............##......~~',
            '~~####......"""""...##...2..~~',
            '~~######...##"...#####......~~',
            '~~..####...##.............8.~~',
            '~~#......#....0...1.##......~~',
            '~~##.....#..........########~~',
            '~~##...........##3...#######~~',
            '~~..W.....=====##....#######~~',
            '..........=...====............',
            '<.=S=======...5..===========.>',
            '...."""""..#............6.....',
            '~~..""""..............######~~',
            '~~##.."........##4...#######~~',
            '~~##...........##....#######~~',
            '~~#####.###..........####...~~',
            '~~#########.##....###.......~~',
            '~~######......""""##........~~',
            '~~####...7....."""..........~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
            '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
        ],
        grass: { rate: 0.1, safeSteps: 4, table: [
            { templateId: 'loup_braise', name: 'Loup des cendres', weight: 5, offset: 0 },
            { templateId: 'sanglier_flammes', name: 'Sanglier des cendres', weight: 3, offset: 0 },
            { templateId: 'tigre_embrase', name: 'Tigresse affamée', weight: 1, offset: 1 },
                { templateId: 'zouyu', name: "Zouyu", weight: 3, offset: 0 },
                { templateId: 'tianlu', name: "Tianlu", weight: 3, offset: 0 },
                { templateId: 'bian', name: "Bian", weight: 3, offset: 0 },
                { templateId: 'longma', name: "Longma", weight: 1, offset: 1 },
                { templateId: 'jiuweihu', name: "Jiuweihu", weight: 1, offset: 1 },
                { templateId: 'kuafu_geant', name: "Kuafu", weight: 1, offset: 1 }
        ] },
        places: {
            fauves_boar: '0',
            fauves_troll: '1',
            scarred_tiger: '2',
            pack_wolf_a: '3',
            pack_boar: '4',
            pack_tiger: '5',
            pack_wolf_b: '6',
            sun_7: [27, 11],
            zi_bell: '7',
            fauves_chest: '8',
            tou_stash: [7, 3]
        }
    }
};

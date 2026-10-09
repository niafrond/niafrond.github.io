// Région 1 — Rizières Desséchées : Hameau de Dongqiao, Hameau des Lucioles, Digue et Marais Craquelés, sept maisons.
// Légende : # roseaux/murs · ~ mare craquelée · = ruelle · A-E bâtiments (porte minuscule) · W pierre de voyage · 0-9 i-z ^ v ancres.

export default {
    village: {
        id: 'rizieres_village', biome: 'paddy',
        grid: [
            '####################',
            '#.AAAA..BBBB..CCCC.#',
            '#.AAAA.#BBBB..CCCC.#',
            '#.AaAA..BbBB..CcCC.#',
            '#..S..0..=.....=..3#',
            '#..===============.#',
            '#..=..W.~~~~1..=...>',
            '#..=.2..~~~~...=...#',
            '#.DDDD........EEEE.#',
            '#.DDDD.p.#....EEEE.#',
            '#.DdDD.....4..EeEE.#',
            '#..=============...#',
            '#..................#',
            '#.###....==....###.#',
            '#.#j.....==.....k#.#',
            '#.###.~~.==.~~.###.#',
            '#.....~~.==.~~.....#',
            '#..=============...#',
            '#..=..#.....#..=...#',
            '#..=..#.m.n.#..=...#',
            '#..=..#.....#..=...#',
            '#..=..###.###..=...#',
            '#..=============...#',
            '####################'
        ],
        npcs: [
            { id: 'merchant_rizieres', at: 'p' },
            { id: 'xiaobao', at: '1' },
            { id: 'hua_riz', at: '2' },
            { id: 'scarecrow_cao', at: '3' },
            { id: 'matchmaker_hong', at: '0' },
            { id: 'lao_shuo_riz', at: '4' }
        ],
        chests: [
            { id: 'rizieres_garden_a', at: 'j', gold: 15, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'rizieres_garden_b', at: 'k', gold: 15, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'rizieres_market_a', at: 'm', gold: 30, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'rizieres_market_b', at: 'n', gold: 30, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    hamlet: {
        id: 'rizieres_hamlet', biome: 'paddy',
        grid: [
            '########^#######',
            '##......=.....##',
            '#.AAAA.5=.BBBB.#',
            '#.AAAA..=1BBBB.#',
            '#.AaAA2.=.BbBB.#',
            '#..=========...#',
            '#..3....S....0.#',
            '#.~~~~.....4...#',
            '#.~~~~.#.....W.#',
            '##..........#..#',
            '################'
        ],
        npcs: [
            { id: 'duck_fu', at: '0' },
            { id: 'kid_dandan', at: '1' },
            { id: 'pigeon_zhao', at: '2' },
            { id: 'monk_kong', at: '3' }
        ],
        chests: [
            { id: 'duck_pond_cache', at: '4', gold: 15 },
            { id: 'hamlet_well_box', at: '5', gold: 30 }
        ]
    },

    wild: {
        id: 'rizieres_wild', biome: 'paddy',
        grid: [
            '##################',
            '#..........k#.0.z#',
            '#.##n..#.j..#....#',
            '#.##..9.....####.#',
            '#........~~......#',
            '#....i.l~~~...1..>',
            '<.......~~~.7....#',
            '#..#..o.~~~...m..#',
            '#...W...#.4......#',
            '#.##..3..##.8.2..#',
            '#.......5...6...y#',
            '###v##############'
        ],
        npcs: [
            { id: 'huang_xian', at: '9' },
            { id: 'crow_wing', at: 'i' },
            { id: 'toad_chan', at: 'j' }
        ],
        chests: [
            { id: 'dike_cache', at: '0', gold: 15 },
            { id: 'reed_kite', at: 'y', gold: 30 },
            { id: 'warden_hoard', at: 'z', gold: 45 },
            { id: 'journal_page_riz', at: 'k', gold: 15 },
            { id: 'rice_idol', at: 'l', gold: 30 }
        ],
        enemies: [
            { id: 'rizieres_warden', at: '1', templateId: 'forest_guardian', name: 'Gardien de la digue', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Gardien de la digue', level: 4 } },
            { id: 'rizieres_marsh_imp', at: '2', templateId: 'goblin_saboteur', name: 'Xiao Gui des roseaux', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'rizieres_w_toad', at: '3', templateId: 'fungal_horror', name: 'Crapaud de boue', kind: 'sentinel', offset: -1 },
            { id: 'rizieres_w_lingzhi', at: '4', templateId: 'fungal_horror', name: 'Lingzhi des diguettes', kind: 'sentinel', offset: 0 },
            { id: 'rizieres_w_spirit', at: '5', templateId: 'forest_guardian', name: 'Esprit des diguettes', kind: 'patrol', patrol: ['5', '6'], offset: 0 },
            { id: 'rizieres_w_waterthief', at: '7', templateId: 'goblin_saboteur', name: 'Voleur d\'eau', kind: 'patrol', patrol: ['7', '8'], offset: 0 },
            { id: 'crow_a', at: 'm', templateId: 'goblin_saboteur', name: 'Corbeau-démon voleur', kind: 'sentinel', offset: 0, permanent: true, group: 'crow_gang' },
            { id: 'crow_b', at: 'n', templateId: 'goblin_saboteur', name: 'Corbeau-démon voleur', kind: 'sentinel', offset: 0, permanent: true, group: 'crow_gang' },
            { id: 'rizieres_mill_ghost', at: 'o', templateId: 'bone_reaver', name: 'Meunier revenant', kind: 'sentinel', offset: 0, permanent: true }
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

    sanctuary: { id: 'rizieres', waypoint: { x: 2, y: 5 } }
};

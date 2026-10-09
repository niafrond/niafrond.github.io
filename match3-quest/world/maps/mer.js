// Région 8 — Rivage de la Mer Orientale : Port aux Perles de Haiyan, Falaises et Criques du Dragon, cinq maisons.
// Légende : # falaises/coques/murs · ~ mer · = quai/jetée · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'mer_village', biome: 'coast',
        grid: [
            '####################',
            '#.AAAA..BBBB..CCCC.#',
            '#.AAAA..BBBB..CCCC.#',
            '#.AaAA..BbBB..CcCC.#',
            '#=================.#',
            '#.0.5..4=1..#.EEE..#',
            '##.DDDD#=.W...EEE..#',
            '#..DDDD.=...3.EEE.##',
            '#.2DdDD.=.S..#EeE..#',
            '<==================>',
            '#~~~~~~~~==~~~~~~~~#',
            '#~~~##~~~==~~~###~~#',
            '#..................#',
            '#.###....==p...###.#',
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
            { id: 'merchant_mer', at: 'p' },
            { id: 'hua_mer', at: '1' },
            { id: 'crab_old_gong', at: '2' },
            { id: 'girl_net_mi', at: '3' },
            { id: 'sailor_tai', at: '0' },
            { id: 'priestess_mazu', at: '4' },
            { id: 'singer_hailing', at: '5' }
        ],
        chests: [
            { id: 'mer_garden_a', at: 'j', gold: 195, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'mer_garden_b', at: 'k', gold: 195, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'mer_market_a', at: 'm', gold: 390, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'mer_market_b', at: 'n', gold: 390, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    hamlet: {
        id: 'mer_hamlet', biome: 'coast',
        grid: [
            '#######^########',
            '#~~~...=......##',
            '#......S.......#',
            '#......=..1..W.#',
            '#.....2=.......#',
            '#3AAAA.=..BBBB.#',
            '#.AAAA.=..BBBB.#',
            '#.AaAA.=.0BbBB.#',
            '#..=========...#',
            '#.............##',
            '################'
        ],
        npcs: [
            { id: 'gull_pip', at: '0' },
            { id: 'kid_ahu', at: '1' },
            { id: 'salt_jun', at: '2' }
        ],
        chests: [
            { id: 'salt_pan', at: '3', gold: 120 }
        ]
    },

    wild: {
        id: 'mer_wild', biome: 'coast',
        grid: [
            '##################',
            '#.####0.......#z.#',
            '#.####..#####.#..#',
            '#.####.k###.5.l#.#',
            '<.......###......#',
            '#...W....i.3..4..#',
            '#.#...2.....6..#.#',
            '#..n.8...1...#j..>',
            '#o..~~~~...~~~...#',
            '#..y~~~~.9.~~~7.m#',
            '#..~~~~~~~~~~~~~~#',
            '#v################'
        ],
        npcs: [
            { id: 'mermaid_jiaoren', at: '8' },
            { id: 'jelly_shui', at: 'i' },
            { id: 'octo_ba', at: 'j' }
        ],
        chests: [
            { id: 'cove_cache', at: '0', gold: 120 },
            { id: 'tide_key_chest', at: '9', gold: 240 },
            { id: 'tear_pearl_chest', at: 'y', gold: 240 },
            { id: 'dragon_grotto', at: 'z', gold: 360 },
            { id: 'journal_page_mer', at: 'k', gold: 120 },
            { id: 'reef_cache', at: 'l', gold: 240 },
            { id: 'wreck_treasure', at: 'm', gold: 360 }
        ],
        enemies: [
            { id: 'mer_tide_serpent', at: '1', templateId: 'deep_sea_serpent', name: 'Serpent de marée', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Serpent de marée', level: 32 } },
            { id: 'mer_kelp_witch', at: '2', templateId: 'ice_witch', name: 'Dame des algues givrées', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'mer_w_crab', at: '3', templateId: 'war_troll', name: 'Crabe-roi des falaises', kind: 'patrol', patrol: ['3', '4'], offset: 0 },
            { id: 'mer_w_wraith', at: '5', templateId: 'plague_doctor', name: 'Spectre de la marée', kind: 'patrol', patrol: ['5', '6'], offset: -1 },
            { id: 'mer_w_cutter', at: '7', templateId: 'shadow_assassin', name: 'Coupeur de filets', kind: 'sentinel', offset: 0 },
            { id: 'mer_crab_a', at: 'n', templateId: 'iron_gladiator', name: 'Crabe-soldat', kind: 'sentinel', offset: 0, permanent: true, group: 'giant_crabs' },
            { id: 'mer_crab_b', at: 'o', templateId: 'iron_gladiator', name: 'Crabe-soldat', kind: 'sentinel', offset: 0, permanent: true, group: 'giant_crabs' }
        ],
        gate: {
            requires: 'tide_key_chest',
            lockedMessage: 'La grotte qui mène au sanctuaire est fermée par une porte de corail : sa clé de marée dort au fond d\'une crique.'
        }
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

    sanctuary: { id: 'mer', waypoint: { x: 2, y: 5 } }
};

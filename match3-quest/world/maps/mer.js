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
            '#.......=1..#.EEE..#',
            '##.DDDD#=.W...EEE..#',
            '#..DDDD.=...3.EEE.##',
            '#.2DdDD.=.S..#EeE..#',
            '<==================>',
            '#~~~~~~~~==~~~~~~~~#',
            '#~~~##~~~==~~~###~~#',
            '####################'
        ],
        npcs: [
            { id: 'hua_mer', at: '1' },
            { id: 'crab_old_gong', at: '2' },
            { id: 'girl_net_mi', at: '3' }
        ],
        chests: []
    },

    wild: {
        id: 'mer_wild', biome: 'coast',
        grid: [
            '##################',
            '#.####0.......#v.#',
            '#.####..#####.#..#',
            '#.####..###.5..#.#',
            '<.......###......#',
            '#...W......3...4.#',
            '#.#...2.....6..#.#',
            '#....8...1...#...>',
            '#...~~~~...~~~...#',
            '#..^~~~~.9.~~~.7.#',
            '#~~~~~~~~~~~~~~~~#',
            '##################'
        ],
        npcs: [
            { id: 'mermaid_jiaoren', at: '8' }
        ],
        chests: [
            { id: 'cove_cache', at: '0', gold: 120 },
            { id: 'tide_key_chest', at: '9', gold: 240 },
            { id: 'tear_pearl_chest', at: '^', gold: 240 },
            { id: 'dragon_grotto', at: 'v', gold: 360 }
        ],
        enemies: [
            { id: 'mer_tide_serpent', at: '1', templateId: 'deep_sea_serpent', emoji: '🐉', name: 'Serpent de marée', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Serpent de marée', level: 13 } },
            { id: 'mer_kelp_witch', at: '2', templateId: 'ice_witch', emoji: '🧜‍♀️', name: 'Dame des algues givrées', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'mer_w_crab', at: '3', templateId: 'war_troll', emoji: '🦀', name: 'Crabe-roi des falaises', kind: 'patrol', patrol: ['3', '4'], offset: 0 },
            { id: 'mer_w_wraith', at: '5', templateId: 'plague_doctor', emoji: '🌊', name: 'Spectre de la marée', kind: 'patrol', patrol: ['5', '6'], offset: -1 },
            { id: 'mer_w_cutter', at: '7', templateId: 'shadow_assassin', emoji: '🔪', name: 'Coupeur de filets', kind: 'sentinel', offset: 0 }
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
        }
    ],

    sanctuary: { id: 'mer', waypoint: { x: 2, y: 5 } }
};

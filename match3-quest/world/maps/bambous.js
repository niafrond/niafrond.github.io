// Région 3 — Forêt de Bambous Calcinée : Village des Cent Tiges, Sentier des Tiges Cendrées, cinq maisons.
// Légende : # tiges de bambou/murs · ~ mare à thé · = ruelle · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'bambous_village', biome: 'bamboo',
        grid: [
            '####################',
            '#.AAAA#.BBBB..CCCC.#',
            '#.AAAA#.BBBB.#CCCC.#',
            '#.AaAA..BbBB..CcCC.#',
            '#..=.....=.....=...#',
            '##.==============#.#',
            '<..=..W..~~~.S.=...>',
            '#..=.1.#.~~~...=...#',
            '#.DDDD........EEEE.#',
            '#.DDDD......#.EEEE.#',
            '#.DdDD...#....EeEE##',
            '#..=============...#',
            '####################'
        ],
        npcs: [
            { id: 'huli_xia', at: '1' }
        ],
        chests: []
    },

    wild: {
        id: 'bambous_wild', biome: 'bamboo',
        grid: [
            '##################',
            '#9......4...5.#0.#',
            '####..#.......##.>',
            '#.#...#.2##......#',
            '#..8..#..##...1..#',
            '#...........#....#',
            '#...W............#',
            '#.....#..###....##',
            '#..##.#.3###..^..#',
            '<.....#..........#',
            '#.......6...7...v#',
            '##################'
        ],
        npcs: [
            { id: 'lantern_old', at: '8' }
        ],
        chests: [
            { id: 'ash_cache', at: '0', gold: 45 },
            { id: 'hollow_stem', at: '9', gold: 90 },
            { id: 'monk_hoard', at: 'v', gold: 135 }
        ],
        enemies: [
            { id: 'bambous_seal_keeper', at: '1', templateId: 'temple_warden', emoji: '🏮', name: 'Gardien des cendres', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Gardien des cendres', level: 3 } },
            { id: 'bambous_ember_wisp', at: '2', templateId: 'fungal_horror', emoji: '🍄', name: 'Lingzhi des braises', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_lingzhi' },
            { id: 'bambous_ember_wisp_b', at: '3', templateId: 'fungal_horror', emoji: '🍄', name: 'Lingzhi des braises', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_lingzhi' },
            { id: 'bambous_w_shade', at: '4', templateId: 'shadow_assassin', emoji: '🥷', name: 'Ombre de cendre', kind: 'patrol', patrol: ['4', '5'], offset: 0 },
            { id: 'bambous_w_spirit', at: '6', templateId: 'forest_guardian', emoji: '🎋', name: 'Esprit des tiges brûlées', kind: 'patrol', patrol: ['6', '7'], offset: -1 },
            { id: 'bambous_w_pilgrim', at: '^', templateId: 'bone_reaver', emoji: '💀', name: 'Pèlerin calciné', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'sq_sentier_sceaux',
            lockedMessage: 'Les sceaux du moine Zhen ne tiennent plus : un gardien de cendres retient le sentier du temple. Il faut le dompter, puis rapporter la nouvelle au moine.'
        }
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
        }
    ],

    sanctuary: { id: 'bambous', waypoint: { x: 2, y: 4 } }
};

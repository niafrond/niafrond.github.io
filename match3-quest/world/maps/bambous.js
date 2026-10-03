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
            '#..=..0..=.....=...#',
            '##.==============#.#',
            '<..=..W..~~~.S.=...>',
            '#..=.1.#.~~~...=...#',
            '#.DDDD........EEEE.#',
            '#.DDDD......#.EEEE.#',
            '#.DdDD.2.#....EeEE##',
            '#9#=============...#',
            '####################'
        ],
        npcs: [
            { id: 'huli_xia', at: '1' },
            { id: 'young_monk_zhi', at: '0' },
            { id: 'scholar_dong', at: '2' }
        ],
        chests: [
            { id: 'tea_hideout', at: '9', gold: 45, label: 'Cachette de thé', emoji: '🍵', openText: '🎁 Sous une natte brûlée, un pot de thé fêlé… et quelques sous que quelqu\'un avait cachés là.' }
        ]
    },

    hamlet: {
        id: 'bambous_hamlet', biome: 'bamboo',
        grid: [
            '########^#######',
            '##......=.....##',
            '#.AAAA..=.BBBB.#',
            '#.AAAA..=.BBBB.#',
            '#.AaAA2.=.BbBB.#',
            '#..=========...#',
            '#.......S......#',
            '#4........0.~~.#',
            '#..1...#....~W.#',
            '##...#....3.#..#',
            '################'
        ],
        npcs: [
            { id: 'panda_baobao', at: '0' },
            { id: 'beekeeper_ju', at: '1' },
            { id: 'archer_huo', at: '2' },
            { id: 'cricket_boy_hao', at: '3' }
        ],
        chests: [
            { id: 'honey_hive', at: '4', gold: 45 }
        ]
    },

    wild: {
        id: 'bambous_wild', biome: 'bamboo',
        grid: [
            '##################',
            '#9......4...5.#0.#',
            '####.l#...p...##.>',
            '#k#...#.2##......#',
            '#..8..#..##.o.1..#',
            '#...........#....#',
            '#.n.W...i......j.#',
            '#.....#..###m...##',
            '#..##.#.3###..y..#',
            '<.....#..........#',
            '#.......6...7...z#',
            '###v##############'
        ],
        npcs: [
            { id: 'lantern_old', at: '8' },
            { id: 'stem_sprite', at: 'i' },
            { id: 'snake_qing', at: 'j' }
        ],
        chests: [
            { id: 'ash_cache', at: '0', gold: 45 },
            { id: 'hollow_stem', at: '9', gold: 90 },
            { id: 'monk_hoard', at: 'z', gold: 135 },
            { id: 'journal_page_bam', at: 'k', gold: 45 },
            { id: 'hidden_grove_chest', at: 'l', gold: 90 },
            { id: 'ash_urn', at: 'm', gold: 135 }
        ],
        enemies: [
            { id: 'bambous_seal_keeper', at: '1', templateId: 'temple_warden', emoji: '🏮', name: 'Gardien des cendres', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Gardien des cendres', level: 3 } },
            { id: 'bambous_ember_wisp', at: '2', templateId: 'fungal_horror', emoji: '🍄', name: 'Lingzhi des braises', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_lingzhi' },
            { id: 'bambous_ember_wisp_b', at: '3', templateId: 'fungal_horror', emoji: '🍄', name: 'Lingzhi des braises', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_lingzhi' },
            { id: 'bambous_w_shade', at: '4', templateId: 'shadow_assassin', emoji: '🥷', name: 'Ombre de cendre', kind: 'patrol', patrol: ['4', '5'], offset: 0 },
            { id: 'bambous_w_spirit', at: '6', templateId: 'forest_guardian', emoji: '🎋', name: 'Esprit des tiges brûlées', kind: 'patrol', patrol: ['6', '7'], offset: -1 },
            { id: 'bambous_w_pilgrim', at: 'y', templateId: 'bone_reaver', emoji: '💀', name: 'Pèlerin calciné', kind: 'sentinel', offset: 0 },
            { id: 'bambous_ash_shadow_a', at: 'n', templateId: 'shadow_assassin', emoji: '🥷', name: 'Ombre des cendres', kind: 'sentinel', offset: 0, permanent: true, group: 'ash_shadows' },
            { id: 'bambous_ash_shadow_b', at: 'o', templateId: 'shadow_assassin', emoji: '🥷', name: 'Ombre des cendres', kind: 'sentinel', offset: 0, permanent: true, group: 'ash_shadows' },
            { id: 'bambous_lantern_thief', at: 'p', templateId: 'goblin_saboteur', emoji: '🏮', name: 'Xiao Gui voleur de lampions', kind: 'sentinel', offset: 0, permanent: true }
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

    sanctuary: { id: 'bambous', waypoint: { x: 2, y: 4 } }
};

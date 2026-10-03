// Région 1 — Rizières Desséchées : Hameau de Dongqiao, Digue et Marais Craquelés, six maisons (voir world/FORMAT.md).
// Légende : # roseaux/murs · ~ mare craquelée · = ruelle · A-E bâtiments (porte minuscule) · W pierre de voyage · 0-9 ^ v ancres.

export default {
    village: {
        id: 'rizieres_village', biome: 'paddy',
        grid: [
            '####################',
            '#.AAAA..BBBB..CCCC.#',
            '#.AAAA.#BBBB..CCCC.#',
            '#.AaAA..BbBB..CcCC.#',
            '#..S.....=.....=..3#',
            '#..===============.#',
            '#..=..W.~~~~1..=...>',
            '#..=.2..~~~~...=...#',
            '#.DDDD........EEEE.#',
            '#.DDDD...#....EEEE.#',
            '#.DdDD........EeEE.#',
            '#..=============...#',
            '####################'
        ],
        npcs: [
            { id: 'xiaobao', at: '1' },
            { id: 'hua_riz', at: '2' },
            { id: 'scarecrow_cao', at: '3' }
        ],
        chests: []
    },

    wild: {
        id: 'rizieres_wild', biome: 'paddy',
        grid: [
            '##################',
            '#...........#.0..#',
            '#.##...#....#....#',
            '#.##..9.....####.#',
            '#........~~......#',
            '#.......~~~...1..>',
            '<.......~~~.7....#',
            '#..#....~~~.....v#',
            '#...W...#.4......#',
            '#.##..3..##.8.2..#',
            '#.......5...6...^#',
            '##################'
        ],
        npcs: [{ id: 'huang_xian', at: '9' }],
        chests: [
            { id: 'dike_cache', at: '0', gold: 15 },
            { id: 'reed_kite', at: '^', gold: 30 },
            { id: 'warden_hoard', at: 'v', gold: 45 }
        ],
        enemies: [
            { id: 'rizieres_warden', at: '1', templateId: 'forest_guardian', emoji: '🌳', name: 'Gardien de la digue', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Gardien de la digue', level: 2 } },
            { id: 'rizieres_marsh_imp', at: '2', templateId: 'goblin_saboteur', emoji: '🦊', name: 'Xiao Gui des roseaux', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'rizieres_w_toad', at: '3', templateId: 'fungal_horror', emoji: '🐸', name: 'Crapaud de boue', kind: 'sentinel', offset: -1 },
            { id: 'rizieres_w_lingzhi', at: '4', templateId: 'fungal_horror', emoji: '🍄', name: 'Lingzhi des diguettes', kind: 'sentinel', offset: 0 },
            { id: 'rizieres_w_spirit', at: '5', templateId: 'forest_guardian', emoji: '🌾', name: 'Esprit des diguettes', kind: 'patrol', patrol: ['5', '6'], offset: 0 },
            { id: 'rizieres_w_waterthief', at: '7', templateId: 'goblin_saboteur', emoji: '🦊', name: "Voleur d'eau", kind: 'patrol', patrol: ['7', '8'], offset: 0 }
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
            npcs: [{ id: 'change', at: '1' }],
            chests: [{ id: 'houyi_trunk', at: '2', gold: 15 }]
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
            npcs: [{ id: 'elder_wen', at: '1' }],
            chests: [{ id: 'wen_scroll_box', at: '2', gold: 15 }]
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
            npcs: [{ id: 'farmer_lin', at: '1' }, { id: 'ping', at: '2' }],
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
            npcs: [{ id: 'grandma_tao', at: '1' }],
            chests: [{ id: 'granary_sack', at: '2', gold: 30 }]
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
            npcs: [{ id: 'buffalo_dahei', at: '1' }],
            chests: []
        }
    ],

    sanctuary: { id: 'rizieres', waypoint: { x: 2, y: 5 } }
};

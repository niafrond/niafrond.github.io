// Région 2 — Lit du Fleuve Jaune : Port-à-Sec de Hekou, Hameau des Eaux Mortes, Méandres de Boue et d'Écluses, sept maisons.
// Légende : # coque/banc de sable/mur · ~ flaque · = quai · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'fleuve_village', biome: 'riverbed',
        grid: [
            '####################',
            '#.AAAA..BBBB..CCCC.#',
            '#.AAAA..BBBB..CCCC.#',
            '#.AaAA..BbBB..CcCC.#',
            '#..=..4..=.2...=...#',
            '#..=============.3.#',
            '<..=..W.S.0.~~.5=..>',
            '#..=.1......~~..=..#',
            '#.~~~..DDDD..EEEE..#',
            '#.~~~..DDDD..EEEE..#',
            '#.~~~..DdDD..EeEE..#',
            '#.##...=========...#',
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
            { id: 'girl_lian', at: '1' },
            { id: 'boatman_shan', at: '2' },
            { id: 'hua_fleuve', at: '3' },
            { id: 'ferry_pei', at: '0' },
            { id: 'fortune_sha', at: '4' },
            { id: 'tea_zhuang', at: '5' }
        ],
        chests: [
            { id: 'fleuve_garden_a', at: 'j', gold: 30, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'fleuve_garden_b', at: 'k', gold: 30, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'fleuve_market_a', at: 'm', gold: 60, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'fleuve_market_b', at: 'n', gold: 60, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    hamlet: {
        id: 'fleuve_hamlet', biome: 'riverbed',
        grid: [
            '######^#########',
            '##....=..~~~~~##',
            '#.....=S.~~~~~.#',
            '#.....=........#',
            '#..3..=....2.W.#',
            '#.AAAA.0..BBBB.#',
            '#.AAAA....BBBB.#',
            '#.AaAA....BbBB.#',
            '#..=========.1.#',
            '##............##',
            '################'
        ],
        npcs: [
            { id: 'goose_dagong', at: '0' },
            { id: 'orphan_xiaoyu', at: '1' },
            { id: 'poet_bo', at: '2' }
        ],
        chests: [
            { id: 'goose_nest', at: '3', gold: 30 }
        ]
    },

    wild: {
        id: 'fleuve_wild', biome: 'riverbed',
        grid: [
            '##################',
            '#...#p.m....#...k#',
            '#.0.#..##.2.#.y..#',
            '#.###n.##...#....#',
            '#........i....1.l#',
            '<....W......~~...#',
            '#.......4..5...j.>',
            '#..####....####..#',
            '#.~~q.8..3.o######',
            '#.~~..........z.##',
            '#9...6......7#####',
            '##v###############'
        ],
        npcs: [
            { id: 'carp_jin', at: '8' },
            { id: 'mud_imp_pit', at: 'i' },
            { id: 'captain_lo', at: 'j' }
        ],
        chests: [
            { id: 'mud_cache', at: '0', gold: 30 },
            { id: 'sluice_key_chest', at: 'y', gold: 60 },
            { id: 'carp_pearl', at: '9', gold: 60 },
            { id: 'wreck_hoard', at: 'z', gold: 90 },
            { id: 'journal_page_fle', at: 'k', gold: 30 },
            { id: 'barge_strongbox', at: 'l', gold: 60 },
            { id: 'reed_stash', at: 'm', gold: 60 }
        ],
        enemies: [
            { id: 'fleuve_sluice_golem', at: '1', templateId: 'iron_gladiator', name: 'Golem de l\'écluse', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Golem de l\'écluse', level: 2 } },
            { id: 'fleuve_salt_thief', at: '2', templateId: 'shadow_assassin', name: 'Voleur de sel masqué', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fleuve_w_doctor', at: '3', templateId: 'plague_doctor', name: 'Docteur-démon des vases', kind: 'sentinel', offset: -1 },
            { id: 'fleuve_w_serpent', at: '4', templateId: 'deep_sea_serpent', name: 'Serpent de vase', kind: 'patrol', patrol: ['4', '5'], offset: 0 },
            { id: 'fleuve_w_drowned', at: '6', templateId: 'bone_reaver', name: 'Noyé sans barque', kind: 'patrol', patrol: ['6', '7'], offset: 0 },
            { id: 'barge_ghost_a', at: 'n', templateId: 'bone_reaver', name: 'Matelot noyé revenant', kind: 'sentinel', offset: 0, permanent: true, group: 'barge_ghosts' },
            { id: 'barge_ghost_b', at: 'o', templateId: 'bone_reaver', name: 'Matelot noyé revenant', kind: 'sentinel', offset: 0, permanent: true, group: 'barge_ghosts' },
            { id: 'mud_imp_a', at: 'p', templateId: 'goblin_saboteur', name: 'Diablotin de vase', kind: 'sentinel', offset: 0, permanent: true, group: 'mud_imps' },
            { id: 'mud_imp_b', at: 'q', templateId: 'goblin_saboteur', name: 'Diablotin de vase', kind: 'sentinel', offset: 0, permanent: true, group: 'mud_imps' }
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

    sanctuary: { id: 'fleuve', waypoint: { x: 2, y: 5 } }
};

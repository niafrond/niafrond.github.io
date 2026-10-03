// Région 2 — Lit du Fleuve Jaune : Port-à-Sec de Hekou, Méandres de Boue et d'Écluses, cinq maisons.
// Légende : # coque/banc de sable/mur · ~ flaque · = quai · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'fleuve_village', biome: 'riverbed',
        grid: [
            '####################',
            '#.AAAA..BBBB..CCCC.#',
            '#.AAAA..BBBB..CCCC.#',
            '#.AaAA..BbBB..CcCC.#',
            '#..=.....=.2...=...#',
            '#..=============.3.#',
            '<..=..W.S...~~..=..>',
            '#..=.1......~~..=..#',
            '#.~~~..DDDD..EEEE..#',
            '#.~~~..DDDD..EEEE..#',
            '#.~~~..DdDD..EeEE..#',
            '#.##...=========...#',
            '####################'
        ],
        npcs: [
            { id: 'girl_lian', at: '1' },
            { id: 'boatman_shan', at: '2' },
            { id: 'hua_fleuve', at: '3' }
        ],
        chests: []
    },

    wild: {
        id: 'fleuve_wild', biome: 'riverbed',
        grid: [
            '##################',
            '#...#.......#....#',
            '#.0.#..##.2.#.^..#',
            '#.###..##...#....#',
            '#.............1..#',
            '<....W......~~...#',
            '#.......4..5.....>',
            '#..####....####..#',
            '#.~~..8..3..######',
            '#.~~..........v.##',
            '#9...6......7#####',
            '##################'
        ],
        npcs: [{ id: 'carp_jin', at: '8' }],
        chests: [
            { id: 'mud_cache', at: '0', gold: 30 },
            { id: 'sluice_key_chest', at: '^', gold: 60 },
            { id: 'carp_pearl', at: '9', gold: 60 },
            { id: 'wreck_hoard', at: 'v', gold: 90 }
        ],
        enemies: [
            { id: 'fleuve_sluice_golem', at: '1', templateId: 'iron_gladiator', emoji: '🗿', name: "Golem de l'écluse", kind: 'sentinel', offset: 1, permanent: true, boss: { name: "Golem de l'écluse", level: 2 } },
            { id: 'fleuve_salt_thief', at: '2', templateId: 'shadow_assassin', emoji: '🥷', name: 'Voleur de sel masqué', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fleuve_w_doctor', at: '3', templateId: 'plague_doctor', emoji: '🧪', name: 'Docteur-démon des vases', kind: 'sentinel', offset: -1 },
            { id: 'fleuve_w_serpent', at: '4', templateId: 'deep_sea_serpent', emoji: '🐍', name: 'Serpent de vase', kind: 'patrol', patrol: ['4', '5'], offset: 0 },
            { id: 'fleuve_w_drowned', at: '6', templateId: 'bone_reaver', emoji: '💀', name: 'Noyé sans barque', kind: 'patrol', patrol: ['6', '7'], offset: 0 }
        ],
        gate: {
            requires: 'sluice_key_chest',
            lockedMessage: "La grande écluse est verrouillée : sa clé repose dans un coffre, quelque part dans les méandres."
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
            npcs: [{ id: 'ferryman_gu', at: '1' }],
            chests: [{ id: 'ferry_lockbox', at: '2', gold: 30 }]
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
            npcs: [{ id: 'weaver_mei', at: '1' }],
            chests: [{ id: 'mei_thread_box', at: '2', gold: 30 }]
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
            npcs: [{ id: 'salt_hu', at: '1' }],
            chests: [{ id: 'salt_barrel', at: '2', gold: 60 }]
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
            npcs: [{ id: 'scribe_ou', at: '1' }],
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
            npcs: [{ id: 'gui_turtle', at: '1' }],
            chests: []
        }
    ],

    sanctuary: { id: 'fleuve', waypoint: { x: 2, y: 5 } }
};

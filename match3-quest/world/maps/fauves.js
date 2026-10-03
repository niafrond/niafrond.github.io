// Région 7 — Plaine des Fauves : Enclos de Caoyuan, Hautes Herbes de Cendre, cinq maisons.
// Légende : # palissade/herbes hautes/roc · ~ point d'eau · = piste · A-E yourtes et bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'fauves_village', biome: 'savanna',
        grid: [
            '####################',
            '#.AAAAA..BBB..CCCC.#',
            '#.AAAAA#.BBB..CCCC.#',
            '##AAaAA..BbB..CcCC.#',
            '#...=.....=..#.=..##',
            '#...=.....S.2..=3..#',
            '<==================>',
            '#....1.=.....W.....#',
            '#.DDDD.=EEEEE.######',
            '#.DDDD.=EEEEE....#.#',
            '#.DdDD.=EEeEE.####.#',
            '#9#========........#',
            '####################'
        ],
        npcs: [
            { id: 'twins_mu', at: '1' },
            { id: 'hua_fauves', at: '2' },
            { id: 'old_nomad_bayan', at: '3' }
        ],
        chests: [
            { id: 'nomad_trunk', at: '9', gold: 105, label: 'Malle du vieux nomade', emoji: '🧳', openText: '🎁 Une malle de feutre oubliée contre la palissade : des pièces, et un morceau de fromage vénérable.' }
        ]
    },

    wild: {
        id: 'fauves_wild', biome: 'savanna',
        grid: [
            '##################',
            '#0#............#v#',
            '#.#..#..4...5..#.#',
            '#......#......1..#',
            '#...8......#.....>',
            '<.....#.~~~......#',
            '#.......~~~.^..#.#',
            '#....W.........#.#',
            '#.#.#..6...7.....#',
            '#.#9#.2.....#...##',
            '#.###....3...##..#',
            '##################'
        ],
        npcs: [
            { id: 'hare_tuzi', at: '8' }
        ],
        chests: [
            { id: 'grass_cache', at: '0', gold: 105 },
            { id: 'lost_lamb_pen', at: '9', gold: 210 },
            { id: 'alpha_den', at: 'v', gold: 315 }
        ],
        enemies: [
            { id: 'fauves_alpha_tiger', at: '1', templateId: 'fire_tiger', emoji: '🐯', name: 'Tigre alpha, Griffe-de-Feu', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Tigre alpha, Griffe-de-Feu', level: 11 } },
            { id: 'fauves_lamb_wolf', at: '2', templateId: 'ember_wolf', emoji: '🐺', name: 'Loup chapardeur de braise', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fauves_boar_chief', at: '3', templateId: 'flame_boar', emoji: '🐗', name: 'Hure, sanglier de flammes', kind: 'sentinel', offset: 1, permanent: true },
            { id: 'fauves_w_pack_a', at: '4', templateId: 'ember_wolf', emoji: '🐺', name: 'Loup de la meute', kind: 'patrol', patrol: ['4', '5'], offset: 0 },
            { id: 'fauves_w_pack_b', at: '6', templateId: 'fire_tiger', emoji: '🐅', name: 'Tigresse des herbes', kind: 'patrol', patrol: ['6', '7'], offset: -1 },
            { id: 'fauves_w_ogre', at: '^', templateId: 'war_troll', emoji: '👹', name: 'Ogre de la plaine', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'fauves_alpha_tiger',
            lockedMessage: 'Le tigre alpha de la plaine barre les hautes herbes : tant qu\'il rôde, la meute ne laissera aucun voyageur approcher du sanctuaire.'
        }
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
        }
    ],

    sanctuary: { id: 'fauves', waypoint: { x: 2, y: 4 } }
};

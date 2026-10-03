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
            '#...=..0..=..#.=..##',
            '#.4.=.....S.2.5=3..#',
            '<==================>',
            '#....1.=.....W.....#',
            '#.DDDD.=EEEEE.######',
            '#.DDDD.=EEEEE....#.#',
            '#.DdDD.=EEeEE.####.#',
            '#9#========........#',
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
            { id: 'twins_mu', at: '1' },
            { id: 'hua_fauves', at: '2' },
            { id: 'old_nomad_bayan', at: '3' },
            { id: 'bandit_gerel', at: '0' },
            { id: 'drover_boldo', at: '4' },
            { id: 'traveler_hui', at: '5' }
        ],
        chests: [
            { id: 'nomad_trunk', at: '9', gold: 105, label: 'Malle du vieux nomade', emoji: '🧳', openText: '🎁 Une malle de feutre oubliée contre la palissade : des pièces, et un morceau de fromage vénérable.' },
            { id: 'fauves_garden_a', at: 'j', gold: 165, label: 'Jarre du jardin clos', emoji: '🏺', openText: '🎁 Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'fauves_garden_b', at: 'k', gold: 165, label: 'Coffret de la haie', emoji: '🎁', openText: '🎁 Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'fauves_market_a', at: 'm', gold: 330, label: 'Malle du marché', emoji: '🧳', openText: '🎁 Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'fauves_market_b', at: 'n', gold: 330, label: 'Caisse de la cour', emoji: '📦', openText: '🎁 Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    hamlet: {
        id: 'fauves_hamlet', biome: 'savanna',
        grid: [
            '########^#######',
            '##......=.....##',
            '#.AAAA..=.BBBB.#',
            '#.AAAA..=.BBBB.#',
            '#.AaAA0.=.BbBB.#',
            '#..=========.1.#',
            '#.......S......#',
            '#..............#',
            '#.3....#.....W.#',
            '##...2.........#',
            '################'
        ],
        npcs: [
            { id: 'eagle_boy_temur', at: '0' },
            { id: 'grandma_altan', at: '1' },
            { id: 'mare_chagan', at: '2' }
        ],
        chests: [
            { id: 'eagle_nest', at: '3', gold: 105 }
        ]
    },

    wild: {
        id: 'fauves_wild', biome: 'savanna',
        grid: [
            '##################',
            '#0#............#z#',
            '#.#.n#..4...5..#.#',
            '#......#..o...1..#',
            '#...8......#.....>',
            '<.....#m~~~...j..#',
            '#.......~~~.y..#.#',
            '#....W...p.....#.#',
            '#.#.#..6...7..i..#',
            '#.#9#.2.....#...##',
            '#l###....3..k##..#',
            '###############v##'
        ],
        npcs: [
            { id: 'hare_tuzi', at: '8' },
            { id: 'wolf_pup_baatar', at: 'i' },
            { id: 'ghost_rider_tolui', at: 'j' }
        ],
        chests: [
            { id: 'grass_cache', at: '0', gold: 105 },
            { id: 'lost_lamb_pen', at: '9', gold: 210 },
            { id: 'alpha_den', at: 'z', gold: 315 },
            { id: 'journal_page_fau', at: 'k', gold: 105 },
            { id: 'burial_mound', at: 'l', gold: 210 },
            { id: 'pack_den', at: 'm', gold: 315 }
        ],
        enemies: [
            { id: 'fauves_alpha_tiger', at: '1', templateId: 'fire_tiger', emoji: '🐯', name: 'Tigre alpha, Griffe-de-Feu', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Tigre alpha, Griffe-de-Feu', level: 11 } },
            { id: 'fauves_lamb_wolf', at: '2', templateId: 'ember_wolf', emoji: '🐺', name: 'Loup chapardeur de braise', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fauves_boar_chief', at: '3', templateId: 'flame_boar', emoji: '🐗', name: 'Hure, sanglier de flammes', kind: 'sentinel', offset: 1, permanent: true },
            { id: 'fauves_w_pack_a', at: '4', templateId: 'ember_wolf', emoji: '🐺', name: 'Loup de la meute', kind: 'patrol', patrol: ['4', '5'], offset: 0 },
            { id: 'fauves_w_pack_b', at: '6', templateId: 'fire_tiger', emoji: '🐅', name: 'Tigresse des herbes', kind: 'patrol', patrol: ['6', '7'], offset: -1 },
            { id: 'fauves_w_ogre', at: 'y', templateId: 'war_troll', emoji: '👹', name: 'Ogre de la plaine', kind: 'sentinel', offset: 0 },
            { id: 'fauves_hyena_a', at: 'n', templateId: 'ember_wolf', emoji: '🐺', name: 'Hyène de braise', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_hyenas' },
            { id: 'fauves_hyena_b', at: 'o', templateId: 'ember_wolf', emoji: '🐺', name: 'Hyène de braise', kind: 'sentinel', offset: 0, permanent: true, group: 'ember_hyenas' },
            { id: 'fauves_ember_bull', at: 'p', templateId: 'flame_boar', emoji: '🐂', name: 'Taureau de braise', kind: 'sentinel', offset: 0, permanent: true }
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

    sanctuary: { id: 'fauves', waypoint: { x: 2, y: 4 } }
};

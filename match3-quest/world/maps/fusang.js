// Région 9 — Cime du Fusang : Terrasses de Fusang-le-Bas, Racines et Branches Dorées, cinq maisons.
// Légende : # racines/murs de terrasse · = escalier/ruelle · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'fusang_village', biome: 'fusang',
        grid: [
            '####################',
            '#.AAAA..BBBB..CCCC.#',
            '##AAAA#.BBBB.#CCCC.#',
            '#.AaAA..BbBB..CcCC##',
            '#..=============...#',
            '###=###########=####',
            '<========S=========>',
            '#.5..1.0...W..2..3.#',
            '#######==###########',
            '#.DDDD.==.#..EEEEE.#',
            '#.DdDD.==4..#EEeEE9#',
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
            { id: 'hua_fusang', at: '1' },
            { id: 'child_yuer', at: '2' },
            { id: 'phoenix_chick', at: '3' },
            { id: 'oxherd_niulang', at: '0' },
            { id: 'gatekeeper_men', at: '4' },
            { id: 'star_child_xing', at: '5' }
        ],
        chests: [
            { id: 'terrace_urn', at: '9', gold: 135, label: 'Urne de la terrasse', emoji: '🏺', openText: '🎁 Une urne dorée posée au pied d\'un mur de terrasse : quelques sous et une odeur de miel.' },
            { id: 'fusang_garden_a', at: 'j', gold: 225, label: 'Jarre du jardin clos', emoji: '🏺', openText: '🎁 Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'fusang_garden_b', at: 'k', gold: 225, label: 'Coffret de la haie', emoji: '🎁', openText: '🎁 Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'fusang_market_a', at: 'm', gold: 450, label: 'Malle du marché', emoji: '🧳', openText: '🎁 Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'fusang_market_b', at: 'n', gold: 450, label: 'Caisse de la cour', emoji: '📦', openText: '🎁 Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    hamlet: {
        id: 'fusang_hamlet', biome: 'fusang',
        grid: [
            '########^#######',
            '##......=.....##',
            '#.AAAA..=.BBBB.#',
            '#.AAAA..=.BBBB.#',
            '#.AaAA..=.BbBB.#',
            '#..=========...#',
            '#....0..S..1...#',
            '#..............#',
            '#.2....#.....W.#',
            '##...3......#..#',
            '################'
        ],
        npcs: [
            { id: 'weaver_zhinu', at: '0' },
            { id: 'pilgrim_wuya', at: '1' },
            { id: 'paper_dragon_long', at: '2' }
        ],
        chests: [
            { id: 'loom_chest', at: '3', gold: 135 }
        ]
    },

    wild: {
        id: 'fusang_wild', biome: 'fusang',
        grid: [
            '##################',
            '#....#l#9#....#.z#',
            '#..7.#....o.5.#..#',
            '#....#..i.#...#..>',
            '#....#....#..p#..#',
            '#..8.#..2.#....j.#',
            '<......#..#.6....#',
            '#.#.......#....1.#',
            '##..W#.3.4##.n...#',
            '#0#..#....#..#..##',
            '#....#..m.......k#',
            '##############v###'
        ],
        npcs: [
            { id: 'root_elder', at: '8' },
            { id: 'monkey_ji', at: 'i' },
            { id: 'whale_kun', at: 'j' }
        ],
        chests: [
            { id: 'seal_shard_a', at: '0', gold: 270 },
            { id: 'seal_shard_b', at: '9', gold: 270 },
            { id: 'seal_shard_c', at: 'z', gold: 405 },
            { id: 'journal_page_fus', at: 'k', gold: 135 },
            { id: 'peach_stash', at: 'l', gold: 270 },
            { id: 'kun_scale_chest', at: 'm', gold: 405 }
        ],
        enemies: [
            { id: 'fusang_root_guard', at: '1', templateId: 'sun_paladin', emoji: '🛡️', name: 'Garde solaire des racines', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Garde solaire des racines', level: 15 } },
            { id: 'fusang_jade_wraith', at: '2', templateId: 'crystal_sage', emoji: '💎', name: 'Immortel de jade égaré', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fusang_w_moth', at: '3', templateId: 'void_vampire', emoji: '🦋', name: 'Phalène des racines', kind: 'patrol', patrol: ['3', '4'], offset: 0 },
            { id: 'fusang_w_wyrm', at: '5', templateId: 'storm_wyrm', emoji: '🐲', name: 'Dragonnet de sève', kind: 'patrol', patrol: ['5', '6'], offset: -1 },
            { id: 'fusang_w_scholar', at: '7', templateId: 'arcane_scholar', emoji: '📜', name: 'Lettré des branches', kind: 'sentinel', offset: 0 },
            { id: 'fusang_thief_a', at: 'n', templateId: 'goblin_saboteur', emoji: '🐒', name: 'Singe-démon voleur', kind: 'sentinel', offset: 0, permanent: true, group: 'peach_thieves' },
            { id: 'fusang_thief_b', at: 'o', templateId: 'goblin_saboteur', emoji: '🐒', name: 'Singe-démon voleur', kind: 'sentinel', offset: 0, permanent: true, group: 'peach_thieves' },
            { id: 'fusang_frost_wyrm', at: 'p', templateId: 'frost_dragon', emoji: '🐲', name: 'Long de givre égaré', kind: 'sentinel', offset: 0, permanent: true }
        ],
        gate: {
            requires: 'sq_sceau_racines',
            lockedMessage: 'Le sceau de la Reine Mère qui protège la cime est brisé : il faut en retrouver les trois éclats, cachés dans les racines, avant de monter.'
        }
    },

    interiors: [
        {
            id: 'fusang_h_grue', house: 'A',
            grid: [
                '###########',
                '#....1....#',
                '#..#####..#',
                '#.........#',
                '#.......2.#',
                '#....S....#',
                '#####v#####'
            ],
            npcs: [
                { id: 'crane_envoy', at: '1' }
            ],
            chests: [
                { id: 'crane_feather_box', at: '2', gold: 135 }
            ]
        },
        {
            id: 'fusang_h_cueilleur', house: 'B',
            grid: [
                '############',
                '#.##....##.#',
                '#.##.1..##.#',
                '#..........#',
                '#.........2#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'picker_tao', at: '1' }
            ],
            chests: [
                { id: 'peach_basket', at: '2', gold: 270 }
            ]
        },
        {
            id: 'fusang_h_astronome', house: 'C',
            grid: [
                '##########',
                '#..#..#..#',
                '#..#..#..#',
                '#...1....#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'astronomer_xing', at: '1' }
            ],
            chests: []
        },
        {
            id: 'fusang_h_temple', house: 'D',
            grid: [
                '##########',
                '#.#.#.#.##',
                '#........#',
                '#...1....#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'acolyte_ri', at: '1' }
            ],
            chests: []
        },
        {
            id: 'fusang_h_chambre', house: 'E',
            grid: [
                '############',
                '#.1......2.#',
                '#...####...#',
                '#...####...#',
                '#..........#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'teamaster_you', at: '1' }
            ],
            chests: [
                { id: 'teapot_chest', at: '2', gold: 135 }
            ]
        },
        {
            id: 'fusang_h2_grues', house: 'A', in: 'hamlet',
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
                { id: 'crane_elder_hegu', at: '1' }
            ],
            chests: [
                { id: 'crane_pavilion_box', at: '5', gold: 135 }
            ]
        },
        {
            id: 'fusang_h2_encens', house: 'B', in: 'hamlet',
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
                { id: 'incense_lanxiang', at: '1' }
            ],
            chests: [
                { id: 'incense_chest', at: '5', gold: 270 }
            ]
        }
    ],

    sanctuary: { id: 'fusang', waypoint: { x: 2, y: 5 } }
};

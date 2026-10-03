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
            '#....1.....W..2..3.#',
            '#######==###########',
            '#.DDDD.==.#..EEEEE.#',
            '#.DdDD.==...#EEeEE##',
            '#..=============...#',
            '####################'
        ],
        npcs: [
            { id: 'hua_fusang', at: '1' },
            { id: 'child_yuer', at: '2' },
            { id: 'phoenix_chick', at: '3' }
        ],
        chests: []
    },

    wild: {
        id: 'fusang_wild', biome: 'fusang',
        grid: [
            '##################',
            '#....#.#9#....#.v#',
            '#..7.#......5.#..#',
            '#....#....#...#..>',
            '#....#....#...#..#',
            '#..8.#..2.#......#',
            '<......#..#.6....#',
            '#.#.......#....1.#',
            '##..W#.3.4##.....#',
            '#0#..#....#..#..##',
            '#....#...........#',
            '##################'
        ],
        npcs: [
            { id: 'root_elder', at: '8' }
        ],
        chests: [
            { id: 'seal_shard_a', at: '0', gold: 270 },
            { id: 'seal_shard_b', at: '9', gold: 270 },
            { id: 'seal_shard_c', at: 'v', gold: 405 }
        ],
        enemies: [
            { id: 'fusang_root_guard', at: '1', templateId: 'sun_paladin', emoji: '🛡️', name: 'Garde solaire des racines', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Garde solaire des racines', level: 15 } },
            { id: 'fusang_jade_wraith', at: '2', templateId: 'crystal_sage', emoji: '💎', name: 'Immortel de jade égaré', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'fusang_w_moth', at: '3', templateId: 'void_vampire', emoji: '🦋', name: 'Phalène des racines', kind: 'patrol', patrol: ['3', '4'], offset: 0 },
            { id: 'fusang_w_wyrm', at: '5', templateId: 'storm_wyrm', emoji: '🐲', name: 'Dragonnet de sève', kind: 'patrol', patrol: ['5', '6'], offset: -1 },
            { id: 'fusang_w_scholar', at: '7', templateId: 'arcane_scholar', emoji: '📜', name: 'Lettré des branches', kind: 'sentinel', offset: 0 }
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
        }
    ],

    sanctuary: { id: 'fusang', waypoint: { x: 2, y: 5 } }
};

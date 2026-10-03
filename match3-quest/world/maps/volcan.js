// Région 6 — Gorges du Volcan : Hameau des Braises Sages, Coulées et Passerelles Rougeoyantes, cinq maisons.
// Légende : # basalte/murs · ~ lave ou source chaude · = ruelle/pont · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'volcan_village', biome: 'volcano',
        grid: [
            '####################',
            '#.AAAA.BBBB.~.CCCC.#',
            '#.AAAA#BBBB.~.CCCC.#',
            '##AaAA.BbBB.~#CcCC.#',
            '#..=....=...~..=..##',
            '#..=....=.S.~..=...#',
            '<==================>',
            '#....1...3..~.2....#',
            '#.DDDD#..W#.~.EEEE.#',
            '##DDDD......~.EEEE##',
            '#.DdDD...#..~.EeEE.#',
            '#..=============...#',
            '####################'
        ],
        npcs: [
            { id: 'lizard_zao', at: '1' },
            { id: 'hua_volcan', at: '2' },
            { id: 'young_miner_bo', at: '3' }
        ],
        chests: []
    },

    wild: {
        id: 'volcan_wild', biome: 'volcano',
        grid: [
            '##################',
            '#....~~.###~~..#v#',
            '#.#..~~..9.~~..#.#',
            '<....==..#.~~.5..#',
            '#....~~.2..~~....#',
            '#....~~....==....#',
            '#..7#~~3..4~~.6..#',
            '#....~~....~~....#',
            '#....==.8..~~.1..>',
            '#..W.~~....==....#',
            '#0...~~.#..~~.#..#',
            '##################'
        ],
        npcs: [
            { id: 'forge_spirit', at: '8' }
        ],
        chests: [
            { id: 'cinder_cache', at: '0', gold: 90 },
            { id: 'basalt_niche', at: '9', gold: 180 },
            { id: 'forge_vault', at: 'v', gold: 270 }
        ],
        enemies: [
            { id: 'volcan_forge_giant', at: '1', templateId: 'lava_behemoth', emoji: '🌋', name: 'Forgeron de lave', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Forgeron de lave', level: 9 } },
            { id: 'volcan_ember_imp', at: '2', templateId: 'goblin_saboteur', emoji: '🦊', name: 'Xiao Gui des cendres', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'volcan_w_salamander', at: '3', templateId: 'ember_dragon', emoji: '🦎', name: 'Salamandre de lave', kind: 'patrol', patrol: ['3', '4'], offset: -1 },
            { id: 'volcan_w_smith', at: '5', templateId: 'bone_reaver', emoji: '⚒️', name: 'Forgeron calciné', kind: 'patrol', patrol: ['5', '6'], offset: 0 },
            { id: 'volcan_w_hound', at: '7', templateId: 'ember_wolf', emoji: '🐕', name: 'Chien de braise', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'sq_pont_braise',
            lockedMessage: 'Le pont de basalte vers le sanctuaire est rompu : un forgeron de lave frappe son enclume dessus. Les mineurs ne le réparent pas tant qu\'il n\'est pas calmé.'
        }
    },

    interiors: [
        {
            id: 'volcan_h_shan', house: 'A',
            grid: [
                '###########',
                '#.##.1.##.#',
                '#.........#',
                '#.........#',
                '#.......2.#',
                '#....S....#',
                '#####v#####'
            ],
            npcs: [
                { id: 'miner_shan', at: '1' }
            ],
            chests: [
                { id: 'shan_ore_box', at: '2', gold: 90 }
            ]
        },
        {
            id: 'volcan_h_yan', house: 'B',
            grid: [
                '##########',
                '#...1....#',
                '#...##...#',
                '#...~~...#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'priestess_yan', at: '1' }
            ],
            chests: []
        },
        {
            id: 'volcan_h_potier', house: 'C',
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
                { id: 'potter_rui', at: '1' }
            ],
            chests: [
                { id: 'lava_vase', at: '2', gold: 180 }
            ]
        },
        {
            id: 'volcan_h_bains', house: 'D',
            grid: [
                '############',
                '#..........#',
                '#.~~~~....1#',
                '#.~~~~.~~~.#',
                '#.~~~~.~~~.#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'bather_fei', at: '1' }
            ],
            chests: []
        },
        {
            id: 'volcan_h_cantine', house: 'E',
            grid: [
                '############',
                '#.1......2.#',
                '#..........#',
                '#..######..#',
                '#..........#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'cook_dada', at: '1' }
            ],
            chests: [
                { id: 'cantine_stash', at: '2', gold: 90 }
            ]
        }
    ],

    sanctuary: { id: 'volcan', waypoint: { x: 2, y: 4 } }
};

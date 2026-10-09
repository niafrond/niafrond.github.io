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
            '#..=p...=.S.~..=.5.#',
            '<==================>',
            '#....1.0.3..~.2....#',
            '#.DDDD#..W#.~.EEEE.#',
            '#.DDDD......~.EEEE##',
            '#.DdDD.4.#..~.EeEE.#',
            '#9#=============...#',
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
            { id: 'merchant_volcan', at: 'p' },
            { id: 'lizard_zao', at: '1' },
            { id: 'hua_volcan', at: '2' },
            { id: 'young_miner_bo', at: '3' },
            { id: 'geologist_zhou', at: '0' },
            { id: 'widow_cai', at: '4' },
            { id: 'courier_tong', at: '5' }
        ],
        chests: [
            { id: 'basalt_pot', at: '9', gold: 90, label: 'Pot de basalte enfoui', openText: 'Un pot de basalte encore tiède, rempli de pièces noircies par la suie.' },
            { id: 'volcan_garden_a', at: 'j', gold: 135, label: 'Jarre du jardin clos', openText: 'Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'volcan_garden_b', at: 'k', gold: 135, label: 'Coffret de la haie', openText: 'Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'volcan_market_a', at: 'm', gold: 270, label: 'Malle du marché', openText: 'Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'volcan_market_b', at: 'n', gold: 270, label: 'Caisse de la cour', openText: 'Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    hamlet: {
        id: 'volcan_hamlet', biome: 'volcano',
        grid: [
            '#######^########',
            '##~~~..=...~~~##',
            '#.~~~..S.......#',
            '#......=.2...W.#',
            '#......=.......#',
            '#.AAAA.=..BBBB.#',
            '#.AAAA.=..BBBB.#',
            '#.AaAA.=3.BbBB.#',
            '#..==0======...#',
            '##..........1.##',
            '################'
        ],
        npcs: [
            { id: 'bath_mu', at: '0' },
            { id: 'dragonet_xiaohong', at: '1' },
            { id: 'bath_old_wang', at: '2' }
        ],
        chests: [
            { id: 'hot_spring_chest', at: '3', gold: 90 }
        ]
    },

    wild: {
        id: 'volcan_wild', biome: 'volcano',
        grid: [
            '##################',
            '#....~~m###~~.p#z#',
            '#.#..~~..9.~~..#.#',
            '<.j.i==..#.~~.5..#',
            '#....~~.2..~~....#',
            '#....~~....=o...n#',
            '#..7#~~3..4~~.6..#',
            '#....~~....~~....#',
            '#....==.8..~~.1..>',
            '#..W.~~....==....#',
            '#0...~~l#..~~k#..#',
            '#########v########'
        ],
        npcs: [
            { id: 'forge_spirit', at: '8' },
            { id: 'lava_fish_bi', at: 'i' },
            { id: 'ghost_miner_shu', at: 'j' }
        ],
        chests: [
            { id: 'cinder_cache', at: '0', gold: 90 },
            { id: 'basalt_niche', at: '9', gold: 180 },
            { id: 'forge_vault', at: 'z', gold: 270 },
            { id: 'journal_page_vol', at: 'k', gold: 90 },
            { id: 'obsidian_cache', at: 'l', gold: 180 },
            { id: 'cinnabar_vault', at: 'm', gold: 270 }
        ],
        enemies: [
            { id: 'volcan_forge_giant', at: '1', templateId: 'lava_behemoth', name: 'Forgeron de lave', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Forgeron de lave', level: 22 } },
            { id: 'volcan_ember_imp', at: '2', templateId: 'goblin_saboteur', name: 'Xiao Gui des cendres', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'volcan_w_salamander', at: '3', templateId: 'ember_dragon', name: 'Salamandre de lave', kind: 'patrol', patrol: ['3', '4'], offset: -1 },
            { id: 'volcan_w_smith', at: '5', templateId: 'bone_reaver', name: 'Forgeron calciné', kind: 'patrol', patrol: ['5', '6'], offset: 0 },
            { id: 'volcan_w_hound', at: '7', templateId: 'ember_wolf', name: 'Chien de braise', kind: 'sentinel', offset: 0 },
            { id: 'volcan_hound_a', at: 'n', templateId: 'ember_wolf', name: 'Chien de magma', kind: 'sentinel', offset: 0, permanent: true, group: 'magma_hounds' },
            { id: 'volcan_hound_b', at: 'o', templateId: 'ember_wolf', name: 'Chien de magma', kind: 'sentinel', offset: 0, permanent: true, group: 'magma_hounds' },
            { id: 'volcan_obsidian_guard', at: 'p', templateId: 'iron_gladiator', name: 'Soldat d\'obsidienne', kind: 'sentinel', offset: 0, permanent: true }
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
        },
        {
            id: 'volcan_h2_alchimiste', house: 'A', in: 'hamlet',
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
                { id: 'alchemist_dan', at: '1' }
            ],
            chests: [
                { id: 'alchemy_chest', at: '5', gold: 180 }
            ]
        },
        {
            id: 'volcan_h2_chauffeur', house: 'B', in: 'hamlet',
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
                { id: 'stoker_ge', at: '1' }
            ],
            chests: [
                { id: 'stoker_box', at: '5', gold: 90 }
            ]
        }
    ],

    sanctuary: { id: 'volcan', waypoint: { x: 2, y: 4 } }
};

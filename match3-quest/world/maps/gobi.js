// Région 4 — Désert de Gobi : Caravansérail de Yueya, Dunes des Voix Sablées, cinq maisons.
// Légende : # rocs/murs de pisé · ~ puits/citerne · = piste caravanière · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'gobi_village', biome: 'gobi',
        grid: [
            '####################',
            '#.AAAAA..BBBB..CCC.#',
            '#.AAAAA#.BBBB..CCC.#',
            '##AAaAA..BbBB..CcC.#',
            '#...=.....=.....=.##',
            '#...=.1.S.=..#..=..#',
            '<==================>',
            '#.....W.=.~~.2.....#',
            '#.DDDD..=3~~EEEEEE.#',
            '#.DDDD.#=...EEEEEE##',
            '#.DdDD..=...EEeEEE.#',
            '#9#============....#',
            '####################'
        ],
        npcs: [
            { id: 'hua_gobi', at: '1' },
            { id: 'storyteller_yun', at: '2' },
            { id: 'boy_tarik', at: '3' }
        ],
        chests: [
            { id: 'caravan_stash', at: '9', gold: 60, label: 'Cachette de caravanier', emoji: '💰', openText: '🎁 Une bourse de cuir enterrée dans le sable : le péage d\'un caravanier prudent.' }
        ]
    },

    wild: {
        id: 'gobi_wild', biome: 'gobi',
        grid: [
            '##################',
            '#...#######9####.#',
            '#...#######.####.#',
            '#.#.4....5#.####.#',
            '#......2.....###.#',
            '<....8...#.......#',
            '#.............1..>',
            '#...W.....#......#',
            '#.#....6...7.###.#',
            '#...######..3###v#',
            '#0#.######...###.#',
            '##################'
        ],
        npcs: [
            { id: 'mirage_djinn', at: '8' }
        ],
        chests: [
            { id: 'dune_cache', at: '0', gold: 60 },
            { id: 'mirage_chest', at: '9', gold: 120 },
            { id: 'warlord_loot', at: 'v', gold: 180 }
        ],
        enemies: [
            { id: 'gobi_dune_warlord', at: '1', templateId: 'orc_warmaster', emoji: '🏴', name: 'Chef de dune, Bras-de-Sable', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Chef de dune, Bras-de-Sable', level: 5 } },
            { id: 'gobi_golem_a', at: '2', templateId: 'sand_colossus', emoji: '🏜️', name: 'Golem des dunes', kind: 'sentinel', offset: 0, permanent: true, group: 'dune_golems' },
            { id: 'gobi_golem_b', at: '3', templateId: 'sand_colossus', emoji: '🏜️', name: 'Golem des dunes', kind: 'sentinel', offset: 0, permanent: true, group: 'dune_golems' },
            { id: 'gobi_w_bandit', at: '4', templateId: 'iron_gladiator', emoji: '🗡️', name: 'Brigand des dunes', kind: 'patrol', patrol: ['4', '5'], offset: 0 },
            { id: 'gobi_w_scorpion', at: '6', templateId: 'shadow_assassin', emoji: '🦂', name: 'Scorpion de sable', kind: 'patrol', patrol: ['6', '7'], offset: -1 }
        ],
        gate: {
            requires: 'gobi_dune_warlord',
            lockedMessage: 'Un chef de brigands de sable tient le col entre les dunes et exige un péage que personne ne peut payer : il faudra le vaincre pour passer.'
        }
    },

    interiors: [
        {
            id: 'gobi_h_ma', house: 'A',
            grid: [
                '############',
                '#.##.##....#',
                '#.##.##..1.#',
                '#..........#',
                '#..........#',
                '#.2........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'merchant_ma', at: '1' }
            ],
            chests: [
                { id: 'ma_strongbox', at: '2', gold: 120 }
            ]
        },
        {
            id: 'gobi_h_dawa', house: 'B',
            grid: [
                '##########',
                '#........#',
                '#..#..1..#',
                '#........#',
                '#.....#..#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'guide_dawa', at: '1' }
            ],
            chests: []
        },
        {
            id: 'gobi_h_bains', house: 'C',
            grid: [
                '############',
                '#..........#',
                '#..~~~~~~.1#',
                '#..~~~~~~..#',
                '#..~~~~~~..#',
                '#2.........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'keeper_nur', at: '1' }
            ],
            chests: [
                { id: 'cistern_jar', at: '2', gold: 60 }
            ]
        },
        {
            id: 'gobi_h_cartes', house: 'D',
            grid: [
                '##########',
                '#.###....#',
                '#......1.#',
                '#....##..#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'mapmaker_ali', at: '1' }
            ],
            chests: []
        },
        {
            id: 'gobi_h_chameaux', house: 'E',
            grid: [
                '############',
                '##.#.#.#...#',
                '##.#.#.#...#',
                '#........1.#',
                '#..........#',
                '#.2........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'camel_baba', at: '1' }
            ],
            chests: [
                { id: 'saddle_bag', at: '2', gold: 60 }
            ]
        }
    ],

    sanctuary: { id: 'gobi', waypoint: { x: 2, y: 5 } }
};

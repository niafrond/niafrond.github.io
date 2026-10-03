// Région 5 — Monts du Tonnerre : Village des Forges-Éclairs, Crêtes Foudroyées, cinq maisons.
// Légende : # roc/paratonnerre/murs · = ruelle · A-E bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'tonnerre_village', biome: 'storm',
        grid: [
            '####################',
            '#.AAAA..BBBBB..CCC.#',
            '##AAAA..BBBBB.#CCC.#',
            '#.AaAA.#BBbBB.#CCC.#',
            '#..=......=....CcC.#',
            '#..=.1#...=S.#..=..#',
            '<==================>',
            '#......W.=..#.2....#',
            '#.DDDD#..=...EEEEE.#',
            '##DDDD...=...EEEEE##',
            '#.DdDD#..=...EEeEE.#',
            '#..=============...#',
            '####################'
        ],
        npcs: [
            { id: 'kids_leimei', at: '1' },
            { id: 'hua_tonnerre', at: '2' }
        ],
        chests: []
    },

    wild: {
        id: 'tonnerre_wild', biome: 'storm',
        grid: [
            '##################',
            '#0#...#........#9#',
            '#.#...#..........#',
            '#.....#.2.....1..>',
            '#........#.#.....#',
            '#.....#....#..#..#',
            '#..#..#..8.#.5..6#',
            '#.....#..........#',
            '<......3..4......#',
            '#...W....#.......#',
            '#.......7......#v#',
            '##################'
        ],
        npcs: [
            { id: 'cairn_spirit', at: '8' }
        ],
        chests: [
            { id: 'crest_cache', at: '0', gold: 75 },
            { id: 'storm_gong_chest', at: '9', gold: 150 },
            { id: 'lightning_vault', at: 'v', gold: 225 }
        ],
        enemies: [
            { id: 'tonnerre_stone_lion', at: '1', templateId: 'temple_warden', emoji: '🦁', name: 'Lion-gardien fendu', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Lion-gardien fendu', level: 7 } },
            { id: 'tonnerre_crest_general', at: '2', templateId: 'storm_knight', emoji: '🌩️', name: 'Général de la crête', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'tonnerre_w_wyrm', at: '3', templateId: 'storm_wyrm', emoji: '⚡', name: 'Serpent d\'éclairs', kind: 'patrol', patrol: ['3', '4'], offset: 0 },
            { id: 'tonnerre_w_statue', at: '5', templateId: 'iron_gladiator', emoji: '🗿', name: 'Statue de foudre', kind: 'patrol', patrol: ['5', '6'], offset: -1 },
            { id: 'tonnerre_w_ogre', at: '7', templateId: 'war_troll', emoji: '👹', name: 'Ogre des cimes', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'storm_gong_chest',
            lockedMessage: 'Le portail de pierre vers le sanctuaire reste muet : il ne s\'ouvrira qu\'au son du Gong d\'orage, enfermé dans un coffre de foudre sur les crêtes.'
        }
    },

    interiors: [
        {
            id: 'tonnerre_h_tie', house: 'A',
            grid: [
                '############',
                '#...####...#',
                '#...#..#...#',
                '#....1.....#',
                '#..........#',
                '#.2........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'smith_tie', at: '1' }
            ],
            chests: [
                { id: 'tie_anvil_box', at: '2', gold: 150 }
            ]
        },
        {
            id: 'tonnerre_h_lei', house: 'B',
            grid: [
                '##########',
                '#.#....#.#',
                '#.#.1..#.#',
                '#........#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'hermit_lei', at: '1' }
            ],
            chests: []
        },
        {
            id: 'tonnerre_h_tour', house: 'C',
            grid: [
                '##########',
                '#.1....2.#',
                '#...##...#',
                '#...##...#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'rodman_gang', at: '1' }
            ],
            chests: [
                { id: 'copper_chest', at: '2', gold: 75 }
            ]
        },
        {
            id: 'tonnerre_h_auberge', house: 'D',
            grid: [
                '############',
                '#.###......#',
                '#........1.#',
                '#.##..##...#',
                '#.##..##...#',
                '#.........2#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'innkeeper_pao', at: '1' },
                { id: 'monkey_sun', at: '2' }
            ],
            chests: []
        },
        {
            id: 'tonnerre_h_montagne', house: 'E',
            grid: [
                '##########',
                '#..####..#',
                '#...1....#',
                '#......2.#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'nun_ying', at: '1' }
            ],
            chests: [
                { id: 'offering_box', at: '2', gold: 75 }
            ]
        }
    ],

    sanctuary: { id: 'tonnerre', waypoint: { x: 2, y: 4 } }
};

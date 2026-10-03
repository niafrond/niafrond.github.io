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
            '#.DDDD#..=.0.EEEEE.#',
            '##DDDD..4=...EEEEE##',
            '#.DdDD#..=3..EEeEE.#',
            '#..=============...#',
            '####################'
        ],
        npcs: [
            { id: 'kids_leimei', at: '1' },
            { id: 'hua_tonnerre', at: '2' },
            { id: 'bard_xiang', at: '0' },
            { id: 'rain_pu', at: '3' },
            { id: 'porter_san', at: '4' }
        ],
        chests: []
    },

    hamlet: {
        id: 'tonnerre_hamlet', biome: 'storm',
        grid: [
            '########^#######',
            '##......=.....##',
            '#.AAAA..=.BBBB.#',
            '#.AAAA..=.BBBB.#',
            '#.AaAA..=1BbBB.#',
            '#..=========.0.#',
            '#...2...S......#',
            '#.........3....#',
            '#....#.#.....W.#',
            '##..........#..#',
            '################'
        ],
        npcs: [
            { id: 'goat_yang', at: '0' },
            { id: 'climber_dai', at: '1' },
            { id: 'keeper_ao', at: '2' }
        ],
        chests: [
            { id: 'goat_shed', at: '3', gold: 75 }
        ]
    },

    wild: {
        id: 'tonnerre_wild', biome: 'storm',
        grid: [
            '##################',
            '#0#...#.m.....k#9#',
            '#.#...#..........#',
            '#.p...#.2..l..1..>',
            '#........#.#.....#',
            '#..o..#....#..#..#',
            '#..#.n#..8.#.5..6#',
            '#.....#..........#',
            '<......3..4.j..i.#',
            '#...W....#.......#',
            '#.......7......#z#',
            '#############v####'
        ],
        npcs: [
            { id: 'cairn_spirit', at: '8' },
            { id: 'fairy_yun', at: 'i' },
            { id: 'pup_tuan', at: 'j' }
        ],
        chests: [
            { id: 'crest_cache', at: '0', gold: 75 },
            { id: 'storm_gong_chest', at: '9', gold: 150 },
            { id: 'lightning_vault', at: 'z', gold: 225 },
            { id: 'journal_page_ton', at: 'k', gold: 75 },
            { id: 'thunder_urn', at: 'l', gold: 150 },
            { id: 'peak_cache', at: 'm', gold: 225 }
        ],
        enemies: [
            { id: 'tonnerre_stone_lion', at: '1', templateId: 'temple_warden', emoji: '🦁', name: 'Lion-gardien fendu', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Lion-gardien fendu', level: 7 } },
            { id: 'tonnerre_crest_general', at: '2', templateId: 'storm_knight', emoji: '🌩️', name: 'Général de la crête', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'tonnerre_w_wyrm', at: '3', templateId: 'storm_wyrm', emoji: '⚡', name: 'Serpent d\'éclairs', kind: 'patrol', patrol: ['3', '4'], offset: 0 },
            { id: 'tonnerre_w_statue', at: '5', templateId: 'iron_gladiator', emoji: '🗿', name: 'Statue de foudre', kind: 'patrol', patrol: ['5', '6'], offset: -1 },
            { id: 'tonnerre_w_ogre', at: '7', templateId: 'war_troll', emoji: '👹', name: 'Ogre des cimes', kind: 'sentinel', offset: 0 },
            { id: 'tonnerre_wyrm_calf', at: 'n', templateId: 'storm_wyrm', emoji: '🐲', name: 'Serpenteau d\'orage', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'tonnerre_rider_a', at: 'o', templateId: 'storm_knight', emoji: '🏇', name: 'Cavalier de l\'orage', kind: 'sentinel', offset: 0, permanent: true, group: 'storm_riders' },
            { id: 'tonnerre_rider_b', at: 'p', templateId: 'storm_knight', emoji: '🏇', name: 'Cavalier de l\'orage', kind: 'sentinel', offset: 0, permanent: true, group: 'storm_riders' }
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
        },
        {
            id: 'tonnerre_h2_garde', house: 'A', in: 'hamlet',
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
                { id: 'pass_guard_kuang', at: '1' }
            ],
            chests: [
                { id: 'guard_post_box', at: '5', gold: 75 }
            ]
        },
        {
            id: 'tonnerre_h2_verre', house: 'B', in: 'hamlet',
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
                { id: 'glassblower_ouyang', at: '1' }
            ],
            chests: [
                { id: 'glass_chest', at: '5', gold: 150 }
            ]
        }
    ],

    sanctuary: { id: 'tonnerre', waypoint: { x: 2, y: 4 } }
};

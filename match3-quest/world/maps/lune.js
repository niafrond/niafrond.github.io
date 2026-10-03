// Région 10 — Pic de la Lune : Hameau sous la Lune (16×11, allégé), Sentier d'Argent, trois maisons.
// Légende : # roc/murs · ~ glace ou mare lunaire · = ruelle · A-C bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'lune_village', biome: 'moon',
        grid: [
            '################',
            '#.AAAA....BBBB.#',
            '#.AAAA..#.BBBB.#',
            '##AaAA....BbBB##',
            '#..=========...#',
            '<=======S======>',
            '#...1.CCCC.....#',
            '#.~~~.CCCC..W.##',
            '#.~~~.CcCC.#.#.#',
            '#......===.....#',
            '################'
        ],
        npcs: [
            { id: 'moon_child', at: '1' }
        ],
        chests: []
    },

    wild: {
        id: 'lune_wild', biome: 'moon',
        grid: [
            '##################',
            '#0#.....#9#....#v#',
            '#.#.........5..#.#',
            '#..#..2..1...8...#',
            '#......~~~~......>',
            '#...W..~~~~..#...#',
            '<.....#~~~~.6....#',
            '#......~~~~..##..#',
            '#.#.7.......###..#',
            '#....###.....##..#',
            '#......3....4....#',
            '##################'
        ],
        npcs: [
            { id: 'osmanthus_woodcutter', at: '8' }
        ],
        chests: [
            { id: 'frost_cache', at: '0', gold: 300 },
            { id: 'moon_key_chest', at: '9', gold: 300 },
            { id: 'osmanthus_hoard', at: 'v', gold: 450 }
        ],
        enemies: [
            { id: 'lune_frost_priestess', at: '1', templateId: 'moon_priestess', emoji: '🌙', name: 'Prêtresse de givre', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Prêtresse de givre', level: 17 } },
            { id: 'lune_mirror_shade', at: '2', templateId: 'shadow_assassin', emoji: '🪞', name: 'Ombre du miroir', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'lune_w_hare', at: '3', templateId: 'ice_witch', emoji: '❄️', name: 'Fée de givre', kind: 'patrol', patrol: ['3', '4'], offset: 0 },
            { id: 'lune_w_jiangshi', at: '5', templateId: 'void_vampire', emoji: '🧛', name: 'Jiangshi lunaire', kind: 'patrol', patrol: ['5', '6'], offset: -1 },
            { id: 'lune_w_frostdragon', at: '7', templateId: 'frost_dragon', emoji: '🐉', name: 'Long de givre', kind: 'sentinel', offset: 0 }
        ],
        gate: {
            requires: 'moon_key_chest',
            lockedMessage: 'La porte du Pic est scellée par une serrure de lumière : sa clé repose dans un reliquaire, quelque part sur le sentier d\'argent.'
        }
    },

    interiors: [
        {
            id: 'lune_h_veilleuse', house: 'A',
            grid: [
                '############',
                '#.###....1.#',
                '#....3.....#',
                '#......###.#',
                '#.2........#',
                '#..........#',
                '#.....S....#',
                '######v#####'
            ],
            npcs: [
                { id: 'keeper_lunar', at: '1' },
                { id: 'hua_lune', at: '3' }
            ],
            chests: [
                { id: 'veilleuse_chest', at: '2', gold: 150 }
            ]
        },
        {
            id: 'lune_h_lievres', house: 'B',
            grid: [
                '##########',
                '#....1...#',
                '#..#.....#',
                '#.....#..#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'jade_hare', at: '1' }
            ],
            chests: []
        },
        {
            id: 'lune_h_tisseuse', house: 'C',
            grid: [
                '##########',
                '#......1.#',
                '#..###...#',
                '#2.......#',
                '#........#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'spinner_yue', at: '1' }
            ],
            chests: [
                { id: 'moon_thread_box', at: '2', gold: 150 }
            ]
        }
    ],

    sanctuary: { id: 'lune', waypoint: { x: 2, y: 5 } }
};

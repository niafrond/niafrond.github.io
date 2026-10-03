// Région 10 — Pic de la Lune : Hameau sous la Lune (16×11, allégé), Sentier d'Argent, trois maisons.
// Légende : # roc/murs · ~ glace ou mare lunaire · = ruelle · A-C bâtiments (porte minuscule) · W pierre de voyage.

export default {
    village: {
        id: 'lune_village', biome: 'moon',
        grid: [
            '################',
            '#.AAAA....BBBB.#',
            '#.AAAA..#.BBBB.#',
            '##AaAA.0.4BbBB##',
            '#..=========.2.#',
            '<=======S======>',
            '#.3.1.CCCC.....#',
            '#.~~~.CCCC..W.##',
            '#.~~~.CcCC.#.#.#',
            '#5.....===.....#',
            '#..............#',
            '#.###..==..###.#',
            '#.#j...==...k#.#',
            '#.###.~==~.###.#',
            '#.....~==~.....#',
            '#.=========....#',
            '#.=..#....#.=..#',
            '#.=..#.mn.#.=..#',
            '#.=..###.##.=..#',
            '#.===========..#',
            '#..............#',
            '################'
        ],
        npcs: [
            { id: 'moon_child', at: '1' },
            { id: 'moon_cook_gui', at: '0' },
            { id: 'moon_rabbit_yutu', at: '2' },
            { id: 'moon_ferryman_yin', at: '3' },
            { id: 'moon_child_lan', at: '4' }
        ],
        chests: [
            { id: 'moon_cake_tin', at: '5', gold: 150 },
            { id: 'lune_garden_a', at: 'j', gold: 240, label: 'Jarre du jardin clos', emoji: '🏺', openText: '🎁 Dans un jardin fermé par une haie, une jarre oubliée…' },
            { id: 'lune_garden_b', at: 'k', gold: 240, label: 'Coffret de la haie', emoji: '🎁', openText: '🎁 Un coffret glissé sous la haie, derrière le quartier sud.' },
            { id: 'lune_market_a', at: 'm', gold: 480, label: 'Malle du marché', emoji: '🧳', openText: '🎁 Une malle de marchand abandonnée dans la cour du marché.' },
            { id: 'lune_market_b', at: 'n', gold: 480, label: 'Caisse de la cour', emoji: '📦', openText: '🎁 Une caisse de bois sous l’auvent de la cour : des pièces, glissées là par un marchand prudent.' }
        ]
    },

    wild: {
        id: 'lune_wild', biome: 'moon',
        grid: [
            '##################',
            '#0#....m#9#....#z#',
            '#.#.........5..#.#',
            '#..#..2..1...8...#',
            '#......~~~~j.....>',
            '#...W..~~~~..#.i.#',
            '<.....#~~~~.6....#',
            '#.....l~~~~..##..#',
            '#.#.7.....k.###..#',
            '#....###.....##..#',
            '#......3....4....#',
            '##################'
        ],
        npcs: [
            { id: 'osmanthus_woodcutter', at: '8' },
            { id: 'moon_crow_wu', at: 'i' }
        ],
        chests: [
            { id: 'frost_cache', at: '0', gold: 300 },
            { id: 'moon_key_chest', at: '9', gold: 300 },
            { id: 'osmanthus_hoard', at: 'z', gold: 450 },
            { id: 'journal_page_lune', at: 'j', gold: 150 },
            { id: 'silver_river_cache', at: 'k', gold: 300 }
        ],
        enemies: [
            { id: 'lune_frost_priestess', at: '1', templateId: 'moon_priestess', emoji: '🌙', name: 'Prêtresse de givre', kind: 'sentinel', offset: 1, permanent: true, boss: { name: 'Prêtresse de givre', level: 17 } },
            { id: 'lune_mirror_shade', at: '2', templateId: 'shadow_assassin', emoji: '🪞', name: 'Ombre du miroir', kind: 'sentinel', offset: 0, permanent: true },
            { id: 'lune_w_hare', at: '3', templateId: 'ice_witch', emoji: '❄️', name: 'Fée de givre', kind: 'patrol', patrol: ['3', '4'], offset: 0 },
            { id: 'lune_w_jiangshi', at: '5', templateId: 'void_vampire', emoji: '🧛', name: 'Jiangshi lunaire', kind: 'patrol', patrol: ['5', '6'], offset: -1 },
            { id: 'lune_w_frostdragon', at: '7', templateId: 'frost_dragon', emoji: '🐉', name: 'Long de givre', kind: 'sentinel', offset: 0 },
            { id: 'lune_shade_a', at: 'l', templateId: 'shadow_assassin', emoji: '🪞', name: 'Ombre du miroir', kind: 'sentinel', offset: 0, permanent: true, group: 'mirror_shades' },
            { id: 'lune_shade_b', at: 'm', templateId: 'shadow_assassin', emoji: '🪞', name: 'Ombre du miroir', kind: 'sentinel', offset: 0, permanent: true, group: 'mirror_shades' }
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
                '#.......2#',
                '#....S...#',
                '#####v####'
            ],
            npcs: [
                { id: 'jade_hare', at: '1' }
            ],
            chests: [
                { id: 'jade_mortar_box', at: '2', gold: 300 }
            ]
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

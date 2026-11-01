// La Fête des lanternes d'hiver : les deux terrains au-delà du village (couche B : données pures, sans moteur).
//
//  - Le col des pins gelés : sentier de montagne, poudreuse (hautes herbes), bassin gelé, source chaude qui fait fondre la porte du sanctuaire,
//    énigme des blocs de glace, quelques créatures du givre. Contemplatif : la plupart des ennemis sont en patrouille courte ou en sentinelle ;
//  - Le sanctuaire de la flamme : terrasse de pierre, gardiens de glace, Gardien de la flamme hivernale (boss facultatif), jade de l'hiver.
//
// Cartes tracées par formes comme les terrains de la Nuit des âmes errantes (`makeGrid`) : bord de murs, intérieur ouvert, puis rectangles
// `[caractère, x, y, largeur, hauteur]` (`#` obstacle, `~` glace, `=` chemin de pierre, `"` poudreuse, `.` sol). Entités posées en x, y.

import * as D from './data.js';

export const COL = 'wlm_col', SANCTUAIRE = 'wlm_sanctuaire';

/** Grille ASCII `w × h` : bord de murs, intérieur ouvert, puis formes `[caractère, x, y, w, h]` dans l'ordre. */
export function makeGrid(w, h, shapes) {
    const rows = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.')));
    shapes.forEach(([ch, x, y, sw = 1, sh = 1]) => {
        for (let j = y; j < y + sh; j++) for (let i = x; i < x + sw; i++) if (j >= 0 && j < h && i >= 0 && i < w) rows[j][i] = ch;
    });
    return rows.map(r => r.join(''));
}

const npc = (id, name, title, idle, extra = {}) => ({ id, name, title, idle, ...extra });

// `gates` : cases du bord par côté (W, E) ; `spawn` : arrivée par défaut (téléportation). Niveaux : `offset` au-dessus du niveau de la région.
export const TERRAINS = [
    {
        id: COL, name: 'Le col des pins gelés', w: 64, h: 28, gates: { W: 14, E: 18 }, spawn: [2, 14],
        arrival: [
            'Le sentier grimpe entre des pins aux branches ployées de neige. Sous les flocons, des lanternes de pierre bordent la route, éteintes mais bien droites, comme si quelqu\'un les attendait.',
            'L\'air est vif, le ciel d\'un bleu profond. Quelque part au-delà du col, on entend des cloches : le sanctuaire n\'est pas loin.'
        ],
        shapes: [
            // poudreuse (hautes herbes) : de grands champs de neige de part et d'autre du sentier
            ['"', 2, 2, 12, 7], ['"', 2, 17, 10, 9], ['"', 6, 10, 8, 3], ['"', 20, 2, 12, 4], ['"', 20, 11, 12, 6], ['"', 20, 21, 14, 5],
            ['"', 38, 2, 10, 5], ['"', 38, 10, 10, 6], ['"', 38, 21, 10, 5], ['"', 50, 3, 12, 9], ['"', 50, 21, 12, 5], ['"', 14, 19, 5, 6], ['"', 36, 13, 2, 7],
            ['~', 24, 13, 5, 3], ['~', 42, 12, 5, 2],
            // sentier de montagne en lacets : ouest → nord → est → sud-est
            ['=', 1, 14, 17, 1], ['=', 17, 8, 1, 7], ['=', 17, 8, 18, 1], ['=', 34, 8, 1, 11], ['=', 34, 18, 29, 1],
            ['#', 6, 5, 2, 2], ['#', 10, 20, 2, 2], ['#', 26, 5, 2, 2], ['#', 30, 22, 3, 2], ['#', 44, 4, 2, 2], ['#', 44, 22, 2, 2], ['#', 56, 14, 2, 2],
            ['#', 14, 3, 1, 1], ['#', 40, 15, 2, 1], ['#', 58, 24, 3, 2], ['#', 8, 12, 2, 1], ['#', 46, 16, 2, 1], ['#', 22, 10, 1, 2], ['#', 52, 10, 2, 1]
        ],
        grass: { rate: 0.14, safeSteps: 3, table: [
            { templateId: 'dame_des_neiges', name: 'Esprit du givre', weight: 4, offset: 0 }, { templateId: 'xue_niao', name: 'Oiseau de givre', weight: 3, offset: 0 },
            { templateId: 'shan_gui', name: 'Esprit des cols', weight: 2, offset: 1 }
        ] },
        npcs: [
            npc('wlm_pelerin', 'Pèlerin porteur de lanterne', 'Voyageur du solstice', [
                'Je monte au sanctuaire chaque année pour y déposer une lanterne. Cette année, la porte est gelée : il faut trouver de quoi la faire fondre.',
                'On dit qu\'une source chaude fume quelque part sous la neige, vers l\'est du col. Cherchez la vapeur.'
            ], { x: 10, y: 15 })
        ],
        chests: [
            { ...D.SOURCE_CHAUDE.chest, x: 57, y: 6, tier: 2 },
            { id: D.CLOCHETTE.id, x: 5, y: 22, label: D.CLOCHETTE.label, tier: 2, openText: D.CLOCHETTE.openText, questItem: { ...D.CLOCHETTE.item, quest: D.QUEST_IDS.tangyuan } },
            { ...D.PUZZLE_GLACE.chest, x: 30, y: 15, tier: D.PUZZLE_GLACE.tier, puzzle: D.PUZZLE_GLACE.id, questItem: { ...D.PUZZLE_GLACE.item, quest: D.QUEST_IDS.flamme } },
            { id: 'wlm_coffre_col', x: 60, y: 23, label: 'Panier du pèlerin', tier: 2, openText: 'Un panier de bambou rempli de tangyuan tièdes, enveloppés dans des feuilles, et d\'un peu d\'argent laissé à celui qui passerait par là. Vous prenez les deux, et vous remerciez à voix haute.' }
        ],
        enemies: [
            { id: 'wlm_esprit_givre_1', spriteKey: 'wlm_esprit_givre', x: 24, y: 5, templateId: 'dame_des_neiges', name: 'Esprit du givre', kind: 'sentinel', offset: 0 },
            { id: 'wlm_esprit_givre_2', spriteKey: 'wlm_esprit_givre', x: 8, y: 21, templateId: 'dame_des_neiges', name: 'Esprit du givre', kind: 'sentinel', offset: 0 },
            { id: 'wlm_oiseau_givre', spriteKey: 'wlm_oiseau_givre', x: 38, y: 12, templateId: 'xue_niao', name: 'Oiseau de givre', kind: 'patrol', offset: 0, patrol: [[38, 12], [48, 12]] },
            { id: 'wlm_oiseau_givre_2', spriteKey: 'wlm_oiseau_givre', x: 44, y: 24, templateId: 'xue_niao', name: 'Oiseau de givre', kind: 'patrol', offset: 0, patrol: [[44, 24], [54, 24]] },
            { id: 'wlm_gardien_glace_col', spriteKey: 'wlm_gardien_glace', x: 56, y: 8, templateId: 'shi_jing', name: 'Gardien de glace', kind: 'sentinel', offset: 1 }
        ]
    },
    {
        id: SANCTUAIRE, name: 'Le sanctuaire de la flamme', w: 52, h: 28, gates: { W: 14 }, spawn: [2, 14],
        arrival: [
            'La porte gelée a cédé. Au-delà, une terrasse de pierre dallée donne sur un vide de ciel pâle ; au fond, sur un autel de jade et d\'or, une flamme minuscule vacille.',
            'Des rubans de soie rouge claquent dans le vent. Rien ne vous presse : ici, tout se fait lentement, comme on réchauffe un thé.'
        ],
        shapes: [
            ['"', 2, 2, 14, 8], ['"', 2, 18, 14, 8], ['"', 18, 3, 12, 5], ['"', 18, 20, 12, 5], ['"', 36, 2, 14, 5], ['"', 36, 22, 14, 4], ['"', 10, 11, 8, 2], ['"', 10, 15, 8, 2],
            ['=', 1, 14, 20, 1], ['=', 32, 8, 16, 13],
            ['#', 20, 6, 1, 1], ['#', 20, 22, 1, 1], ['#', 26, 10, 2, 2], ['#', 26, 17, 2, 2], ['#', 3, 12, 3, 2], ['#', 8, 6, 1, 1], ['#', 8, 22, 1, 1], ['#', 31, 7, 1, 1], ['#', 31, 21, 1, 1], ['#', 14, 4, 1, 1], ['#', 14, 24, 1, 1]
        ],
        grass: { rate: 0.12, safeSteps: 3, table: [
            { templateId: 'dame_des_neiges', name: 'Esprit du givre', weight: 4, offset: 1 }, { templateId: 'xue_niao', name: 'Oiseau de givre', weight: 3, offset: 1 },
            { templateId: 'shan_gui', name: 'Esprit des cols', weight: 2, offset: 1 }
        ] },
        npcs: [],
        chests: [
            { id: D.SANCTUAIRE_CHEST_3.id, x: 5, y: 24, label: D.SANCTUAIRE_CHEST_3.label, tier: 2, openText: D.SANCTUAIRE_CHEST_3.openText, questItem: { ...D.SANCTUAIRE_CHEST_3.item, quest: D.QUEST_IDS.flamme } },
            { ...D.JADE.chest, x: 48, y: 14, tier: 3, questItem: { ...D.JADE.item, quest: D.QUEST_IDS.chaleur } }
        ],
        enemies: [
            { id: 'wlm_gardien_glace_1', spriteKey: 'wlm_gardien_glace', x: 29, y: 11, templateId: 'shi_jing', name: 'Gardien de glace', kind: 'sentinel', offset: 1, group: D.GUARDS_GROUP },
            { id: 'wlm_gardien_glace_2', spriteKey: 'wlm_gardien_glace', x: 29, y: 17, templateId: 'shi_jing', name: 'Gardien de glace', kind: 'sentinel', offset: 1, group: D.GUARDS_GROUP },
            {
                id: D.BOSS.id, spriteKey: 'wlm_gardien_flamme', x: 42, y: 14, templateId: 'shan_shen', name: D.BOSS.name, kind: 'sentinel', offset: 2, boss: true,
                shieldedBy: D.GUARDS_GROUP, unsealedBy: [D.QUEST_IDS.lanternes],
                weakenedBy: [D.SOURCE_CHAUDE.chest.id, D.QUEST_IDS.tangyuan],   // la source chaude et les tangyuan retirent chacun un niveau au Gardien
                shieldLines: [
                    'Un voile de givre doré vibre devant le Gardien : vos flèches s\'y perdent comme des flocons.',
                    'Il faut soit défaire les gardiens de glace qui l\'entourent, soit rallumer les lanternes du village pour que le voile retombe.'
                ]
            }
        ]
    }
];

// Portes entre les écrans : la porte gelée du sanctuaire ne s'ouvre qu'une fois la source chaude libérée.
export const LINKS = [
    { from: D.REALM_ID, side: 'E', to: COL, label: 'Col des pins gelés' },
    { from: COL, side: 'E', to: SANCTUAIRE, label: 'Sanctuaire de la flamme', requires: [D.SOURCE_CHAUDE.chest.id],
      lockedMessage: 'La porte du sanctuaire est prise dans une gangue de glace. Une source chaude fume peut-être quelque part dans le col : la glace fond près de la chaleur.' }
];

// Énigmes déclarées dans PUZZLES par le module d'événement (celles du village + celle du col sont dans data.js).
export const TERRAIN_PUZZLES = [];

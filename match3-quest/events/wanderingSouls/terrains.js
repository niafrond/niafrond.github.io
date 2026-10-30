// La Nuit des âmes errantes : les six terrains du royaume au-delà de la salle d'entrée (couche B : données pures, sans moteur).
//
// Chaque terrain reprend une étape du monde des morts chinois (Diyu) avec sa particularité de jeu :
//  - Route des Sources Jaunes (黃泉路) : hautes herbes de feux follets, deux rivières à traverser par des ponts, fleurs de l'autre rive ;
//  - Terrasse du Regard vers le pays (望鄉台) : mirages du pays natal (ils se dissipent au son de la cloche), énigme des souvenirs ;
//  - Pont Naihe (奈何橋) : pont étroit gardé, Meng Po et sa soupe d'oubli : on ne passe qu'après lui avoir parlé ;
//  - Fengdu, la cité fantôme (酆都) : rues, marché des fantômes (鬼市) et messagers Heibai Wuchang qui gardent le tribunal ;
//  - Miroir du Karma (孽鏡台) : le miroir révèle les fautes ; l'énigme des miroirs affaiblit le reflet du pécheur ;
//  - Roue des six voies (六道輪迴) : fin du voyage, le roi Yanluo et le trésor des renaissances.
//
// Les cartes sont tracées par formes (`grid`) : fond ouvert entouré de murs, puis rectangles `[caractère, x, y, largeur, hauteur]` appliqués dans
// l'ordre (`#` mur, `~` eau, `=` dalles, `"` hautes herbes, `.` sol). Les entités sont posées en x, y. Les portes entre terrains se déclarent dans
// `LINKS` : la sortie et la case d'arrivée symétrique sont calculées à la construction (index.js).

import * as D from './data.js';

export const FENGDU = 'ws_fengdu', SOURCES = 'ws_sources', TERRASSE = 'ws_terrasse', PONT = 'ws_pont', MIROIR = 'ws_miroir', ROUE = 'ws_roue';

// ── Tracé ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Grille ASCII `w × h` : bord de murs, intérieur ouvert, puis formes `[caractère, x, y, w, h]` dans l'ordre. */
export function makeGrid(w, h, shapes) {
    const rows = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.')));
    shapes.forEach(([ch, x, y, sw = 1, sh = 1]) => {
        for (let j = y; j < y + sh; j++) for (let i = x; i < x + sw; i++) if (j >= 0 && j < h && i >= 0 && i < w) rows[j][i] = ch;
    });
    return rows.map(r => r.join(''));
}

// ── Textes ───────────────────────────────────────────────────────────────────────────────────────────────────────

const npc = (id, name, title, idle, extra = {}) => ({ id, name, title, idle, ...extra });

// ── Les terrains ─────────────────────────────────────────────────────────────────────────────────────────────────
// `gates` : cases du bord par côté (W, E, N, S) ; `spawn` : arrivée par défaut (téléportation). Niveaux : `offset` au-dessus du niveau de l'hôte.

export const TERRAINS = [
    {
        id: SOURCES, name: 'La Route des Sources Jaunes', w: 40, h: 16, gates: { W: 8, E: 8 }, spawn: [2, 8],
        arrival: [
            'Un chemin de terre jaune longe deux rivières couleur d\'ambre. Sur les talus poussent des fleurs rouges sans feuilles, celles qu\'on dit semées pour les morts qui ne regardent plus en arrière.',
            'Des feux follets pâles glissent dans les hautes herbes. Ils ne vous veulent pas de bien, mais ils ne savent pas où ils vont non plus.'
        ],
        shapes: [
            ['"', 2, 2, 10, 3], ['"', 2, 12, 10, 2], ['"', 19, 1, 7, 4], ['"', 19, 12, 7, 3], ['"', 31, 2, 7, 4], ['"', 31, 11, 7, 3],
            ['~', 14, 1, 4, 14], ['~', 27, 1, 3, 14],
            ['=', 1, 8, 13, 1], ['=', 14, 7, 4, 3], ['=', 18, 8, 9, 1], ['=', 27, 7, 3, 3], ['=', 30, 8, 9, 1],
            ['#', 6, 5, 2, 2], ['#', 9, 10, 2, 1], ['#', 21, 6, 3, 1], ['#', 22, 10, 2, 1], ['#', 33, 6, 2, 1], ['#', 34, 10, 3, 1]
        ],
        grass: { rate: 0.14, safeSteps: 3, table: [
            { templateId: 'gui_esprit', weight: 4, offset: 0 }, { templateId: 'wangliang', weight: 3, offset: 0 },
            { templateId: 'mu_gui', weight: 2, offset: 1 }, { templateId: 'shui_gui', weight: 2, offset: 1 }
        ] },
        npcs: [
            npc('ws_passeur', 'Passeur des sources', 'Ombre sans visage', [
                'Je fais traverser ceux qui n\'ont pas de pièce à donner. Les vivants me paient avec une histoire ; les morts, avec un souvenir.',
                'Ne cueillez pas les fleurs rouges. Elles ne se fanent jamais, et c\'est précisément ce qui les rend tristes.'
            ], { x: 20, y: 6 }),
            npc('ws_cueilleuse', 'Cueilleuse de higan', 'Âme au panier', [
                'Je ramasse les pétales que le vent détache. Les morts les mettent dans leurs cheveux, pour reconnaître le chemin au retour.',
                'Au retour ? Oh, on ne revient pas. Mais l\'idée est jolie.'
            ], { x: 8, y: 10 })
        ],
        chests: [
            { id: 'ws_coffre_sources_1', x: 12, y: 13, label: 'Panier de pétales', tier: 2, openText: 'Un panier tressé, plein de pétales rouges et de quelques pièces de papier doré. Quelqu\'un l\'a laissé là en croyant revenir.' },
            { id: 'ws_coffre_sources_2', x: 36, y: 2, label: 'Offrande de la rive', tier: 2, openText: 'Un bol de riz tiède et une lanterne éteinte, posés sur une pierre plate : l\'offrande d\'une famille qui pense encore aux siens.' }
        ],
        enemies: [
            { id: 'ws_noye_pont', x: 13, y: 6, templateId: 'shui_gui', name: 'Noyé de la rivière jaune', kind: 'sentinel', offset: 1 },
            { id: 'ws_feu_follet', x: 20, y: 2, templateId: 'gui_esprit', name: 'Feu follet', kind: 'patrol', offset: 1, patrol: [[20, 2], [25, 2]] },
            { id: 'ws_gardien_talus', x: 30, y: 5, templateId: 'mu_gui', name: 'Fantôme des arbres morts', kind: 'sentinel', offset: 2 }
        ]
    },
    {
        id: TERRASSE, name: 'La Terrasse du Regard vers le pays', w: 28, h: 20, gates: { W: 10, E: 10 }, spawn: [2, 10],
        arrival: [
            'Une haute terrasse de pierre domine un vide de brume. Les morts s\'y arrêtent pour regarder, une dernière fois, la maison où ils sont nés.',
            'On dit que ceux qui s\'y attardent trop voient des choses qui n\'existent plus. Ne croyez pas tout ce que vos yeux vous montrent ici.'
        ],
        shapes: [
            ['~', 1, 1, 26, 2],
            ['=', 1, 10, 26, 1], ['=', 9, 4, 10, 5],
            ['#', 9, 4, 1, 1], ['#', 18, 4, 1, 1], ['#', 9, 8, 1, 1], ['#', 18, 8, 1, 1],
            ['#', 3, 13, 3, 2], ['#', 22, 13, 3, 2], ['#', 12, 15, 4, 2], ['#', 3, 5, 2, 3], ['#', 23, 5, 2, 3]
        ],
        npcs: [
            npc('ws_ame_nostalgique', 'Âme nostalgique', 'Regard tourné vers le pays', [
                'Là, sous la brume… vous voyez ? Le toit de chaume, la fumée, ma sœur qui étend le linge. Elle ne vieillit pas, elle.',
                'Ça fait longtemps que je regarde. Je crois que c\'est le regard qui retient les morts ici, pas les sceaux.'
            ], { x: 13, y: 6 })
        ],
        chests: [
            { id: 'ws_souvenir', x: 13, y: 17, label: 'Coffret des souvenirs', tier: 3, puzzle: 'ws_souvenirs',
              openText: 'Les trois urnes reposent sur leurs dalles, et le couvercle du coffret se soulève de lui-même : dedans, un souvenir plié comme une lettre, tiède d\'avoir été relu.',
              questItem: { id: 'qi_ws_souvenir', name: 'Souvenir du pays', description: 'Un souvenir d\'enfance plié comme une lettre : la maison, la cour, un parfum de soupe. À rapporter à celui qui l\'a perdu.', earlyDescription: 'Un petit coffret scellé.' } },
            { id: 'ws_coffre_terrasse', x: 24, y: 17, label: 'Lanterne de la terrasse', tier: 2, openText: 'Une lanterne de papier encore chaude, avec quelques pièces dans son socle : on a laissé de quoi payer le voyage.' }
        ],
        enemies: [
            { id: 'ws_ombre_pays_1', x: 6, y: 7, templateId: 'nu_gui', name: 'Ombre du pays natal', kind: 'sentinel', offset: 1, illusion: true, hideWhen: D.BELL.chest.id,
              illusionLines: ['Une cour, un puits, quelqu\'un qui vous appelle par votre nom d\'enfant. Vous tendez la main : il n\'y a que la brume.', 'Un mirage du pays natal : il se dissipe de lui-même, et se reforme plus loin.'] },
            { id: 'ws_ombre_pays_2', x: 21, y: 7, templateId: 'nu_gui', name: 'Ombre du pays natal', kind: 'sentinel', offset: 1, illusion: true, hideWhen: D.BELL.chest.id,
              illusionLines: ['Une table dressée pour un repas qu\'on ne finira pas. L\'image se défait quand vous cherchez à la toucher.'] },
            { id: 'ws_ombre_pays_3', x: 14, y: 13, templateId: 'nu_gui', name: 'Ombre du pays natal', kind: 'sentinel', offset: 1, illusion: true, hideWhen: D.BELL.chest.id,
              illusionLines: ['Un champ de riz vert sous un ciel de printemps. Puis plus rien : la brume a repris sa place.'] },
            { id: 'ws_veilleuse_pays', x: 8, y: 16, templateId: 'yuan_gui', name: 'Veilleuse du pays', kind: 'sentinel', offset: 2 },
            { id: 'ws_pendu_terrasse', x: 4, y: 17, templateId: 'diaosi_gui', name: 'Pendu de la terrasse', kind: 'patrol', offset: 1, patrol: [[4, 17], [10, 17]] }
        ]
    },
    {
        id: PONT, name: 'Le Pont Naihe', w: 44, h: 12, gates: { W: 6, E: 6 }, spawn: [2, 6],
        arrival: [
            'Un long pont de pierre blanche enjambe une rivière où ne se reflète aucun visage. À l\'autre bout, une vieille femme remue une marmite qui ne se vide jamais.',
            'Tous ceux qui renaissent passent ici. Elle leur sert une soupe, et ils oublient. Vous qui êtes vivant, vous pouvez peut-être lui parler sans boire.'
        ],
        shapes: [
            ['~', 9, 1, 26, 4], ['~', 9, 8, 26, 3], ['=', 9, 5, 26, 3],
            ['#', 3, 2, 2, 2], ['#', 3, 8, 2, 2], ['#', 38, 2, 2, 2], ['#', 38, 8, 3, 2]
        ],
        npcs: [
            npc('ws_meng_po', 'Meng Po', 'Vieille dame de la soupe d\'oubli', [
                'Une louche, et le chagrin s\'en va ; une autre, et le nom s\'en va aussi. Les gens ont le choix : ils choisissent presque toujours d\'oublier.',
                'Vous, archer, vous n\'êtes pas venu pour boire. Je le vois à vos mains : elles se souviennent trop bien de la corde.',
                'Passez. La Roue est au bout, et tout le monde y passe un jour. Même ceux qui visent le soleil.'
            ], { x: 37, y: 5, talkDone: ['« Gardez vos souvenirs, archer. C\'est ce qui vous rend dangereux. »'] })
        ],
        chests: [
            { id: 'ws_bol_meng_po', x: 40, y: 4, label: 'Bol de Meng Po', tier: 2,
              openText: 'Un bol de soupe qui ne refroidit pas. Vous ne la buvez pas : mais vous gardez le bol, et un peu de ce qu\'il y avait au fond.',
              questItem: { id: 'qi_ws_bol', name: 'Bol de la soupe d\'oubli', description: 'Un bol de céramique blanche, toujours tiède. Un seul cheveu y flotte : celui d\'un souvenir qu\'on a laissé partir.', earlyDescription: 'Un bol de céramique blanche.' } }
        ],
        enemies: [
            { id: 'ws_garde_pont_1', x: 12, y: 5, templateId: 'gui_guerrier', name: 'Garde du pont', kind: 'patrol', offset: 2, patrol: [[12, 5], [30, 5]] },
            { id: 'ws_garde_pont_2', x: 30, y: 7, templateId: 'gui_guerrier', name: 'Garde du pont', kind: 'patrol', offset: 2, patrol: [[30, 7], [12, 7]] },
            { id: 'ws_noye_rive_1', x: 6, y: 3, templateId: 'shui_gui', name: 'Noyé de la rive', kind: 'sentinel', offset: 1 },
            { id: 'ws_noye_rive_2', x: 6, y: 9, templateId: 'shui_gui', name: 'Noyé de la rive', kind: 'sentinel', offset: 1 }
        ]
    },
    {
        id: FENGDU, name: 'Fengdu, la cité fantôme', w: 36, h: 22, gates: { N: 18, E: 11 }, spawn: [18, 2],
        arrival: [
            'Une cité entière, aux toits courbes et aux volets clos, s\'étend dans la brume. Pas un souffle, pas un bruit de pas : et pourtant, partout, des lanternes brillent.',
            'C\'est Fengdu, la capitale des morts. Les vivants y passent avec la bouche fermée, et font semblant de ne pas voir ceux qui les regardent.'
        ],
        shapes: [
            ['=', 15, 1, 6, 7], ['=', 10, 8, 16, 7], ['=', 1, 11, 9, 1], ['=', 26, 11, 9, 1],
            ['#', 3, 3, 5, 3], ['#', 10, 3, 5, 3], ['#', 21, 3, 5, 3], ['#', 28, 3, 5, 3],
            ['#', 3, 8, 5, 3], ['#', 28, 8, 5, 3], ['#', 3, 12, 5, 3], ['#', 28, 12, 5, 3],
            ['#', 3, 17, 5, 3], ['#', 10, 17, 5, 3], ['#', 21, 17, 5, 3], ['#', 28, 17, 5, 3],
            ['#', 12, 9, 2, 1], ['#', 22, 9, 2, 1], ['#', 12, 13, 2, 1], ['#', 22, 13, 2, 1], ['#', 17, 11, 2, 1]
        ],
        npcs: [
            npc('ws_marchande_papier', 'Marchande de papier', 'Étal du marché des fantômes', [
                'Maisons, chevaux, serviteurs, tout en papier fin : on les brûle chez les vivants, et ils arrivent ici bien réels. Je vends le double de ce qu\'on m\'envoie.',
                'Rien n\'est donné, rien n\'est volé. Ici, on échange des souvenirs contre des souvenirs. Et vous, vous avez de quoi payer ?'
            ], { x: 13, y: 11 }),
            npc('ws_veilleur_fengdu', 'Veilleur de nuit', 'Gardien des rues', [
                'Je compte les heures qui ne passent pas. Une, deux, trois… toujours la même nuit.',
                'Le tribunal est à l\'est. Les messagers noir et blanc en gardent la porte : ils ne laissent passer que ceux qui les ont battus, ou qui sont morts.'
            ], { x: 18, y: 5 }),
            npc('ws_ame_marche', 'Âme au marché', 'Cherche quelqu\'un', [
                'Je cherche ma mère dans la foule. Chaque année elle est dans une autre allée. Chaque année je l\'ai manquée de peu.'
            ], { x: 23, y: 11 })
        ],
        chests: [
            { id: 'ws_coffre_marche_1', x: 11, y: 14, label: 'Étal abandonné', tier: 2, openText: 'Un étal de papier plié, des lanternes en forme de lotus et, au fond d\'un tiroir, une bourse de papier doré qui tinte comme du vrai métal.' },
            { id: 'ws_coffre_marche_2', x: 24, y: 8, label: 'Caisse du marchand', tier: 2, openText: 'Une caisse de bois marquée du sceau d\'une guilde que plus personne ne nomme. Elle est pleine de pièces trouées : de la monnaie des morts, mais aussi un peu de la vôtre.' },
            { id: 'ws_coffre_fengdu_secret', x: 2, y: 20, label: 'Cachette sous l\'escalier', tier: 3, openText: 'Derrière un pan de mur, une cachette que les gardes ont oubliée : un coffret de laque rouge où tient tout un trésor de petites choses.' }
        ],
        enemies: [
            { id: 'ws_wuchang_blanc', x: 33, y: 10, templateId: 'heibai_wuchang', name: 'Bai Wuchang', kind: 'sentinel', offset: 3, boss: true },
            { id: 'ws_wuchang_noir', x: 33, y: 12, templateId: 'heibai_wuchang', name: 'Hei Wuchang', kind: 'sentinel', offset: 3, boss: true },
            { id: 'ws_sauteur_1', x: 15, y: 6, templateId: 'jiangshi', name: 'Sauteur de la ville', kind: 'patrol', offset: 1, patrol: [[15, 6], [20, 6]] },
            { id: 'ws_sauteur_2', x: 15, y: 16, templateId: 'jiangshi', name: 'Sauteur de la ville', kind: 'patrol', offset: 1, patrol: [[15, 16], [20, 16]] },
            { id: 'ws_faux_etal', x: 24, y: 12, templateId: 'huli_jing', name: 'Faux étal', kind: 'sentinel', offset: 0, illusion: true, spriteKey: 'ws_huli_jing', hideWhen: D.BELL.chest.id,
              illusionLines: ['L\'étal se déplie comme un éventail, et il n\'y a plus rien derrière : un décor de papier de la renarde.'] },
            { id: 'ws_veuve_fengdu', x: 6, y: 20, templateId: 'nu_gui', name: 'Fantôme aux cheveux défaits', kind: 'sentinel', offset: 2 }
        ]
    },
    {
        id: MIROIR, name: 'Le Miroir du Karma', w: 26, h: 16, gates: { W: 8 }, spawn: [2, 8],
        arrival: [
            'Une vaste salle, froide comme un puits. Au fond, sur une estrade, se dresse un grand miroir de bronze où l\'on voit, non pas son visage, mais ses actes.',
            'Les juges y lisent les fautes des morts avant de les envoyer vers leur peine. Les vivants qui s\'y regardent n\'en ressortent pas tout à fait les mêmes.'
        ],
        shapes: [
            ['=', 17, 5, 7, 7],
            ['#', 6, 3, 1, 2], ['#', 6, 11, 1, 2], ['#', 12, 3, 1, 2], ['#', 12, 11, 1, 2]
        ],
        npcs: [
            npc('ws_greffier_miroir', 'Greffier du tribunal', 'Plume sans fin', [
                'J\'inscris ce que le miroir montre. Il ne ment pas : c\'est le plus dur. On ne plaide pas contre un reflet.',
                'Si vous voulez affaiblir le reflet du pécheur, réglez d\'abord les miroirs du reliquaire : un rayon bien placé le trouble, et il perd de sa force.'
            ], { x: 4, y: 4 })
        ],
        chests: [
            { id: 'ws_reliquaire_karma', x: 23, y: 3, label: 'Reliquaire du miroir', tier: 3, puzzle: 'ws_miroir_karma',
              openText: 'Le dernier rayon frappe la pierre sacrée, et le reliquaire s\'ouvre : un fragment du grand miroir, qui ne montre plus que ce qu\'on a de meilleur.',
              questItem: { id: 'qi_ws_karma', name: 'Éclat du miroir du karma', description: 'Un éclat de bronze poli. Y regarder fait mal un instant, puis donne une étrange paix.', earlyDescription: 'Un reliquaire fermé.' } }
        ],
        enemies: [
            { id: 'ws_reflet_peche', x: 20, y: 8, templateId: 'yuan_gui', name: 'Reflet du pécheur', kind: 'sentinel', offset: 3, boss: true, weakenedBy: ['ws_reliquaire_karma'] },
            { id: 'ws_juge_ombre_1', x: 8, y: 5, templateId: 'nu_gui', name: 'Ombre du tribunal', kind: 'patrol', offset: 2, patrol: [[8, 5], [8, 11]] },
            { id: 'ws_juge_ombre_2', x: 14, y: 11, templateId: 'diaosi_gui', name: 'Pendu du tribunal', kind: 'patrol', offset: 2, patrol: [[14, 11], [14, 5]] }
        ]
    },
    {
        id: ROUE, name: 'La Roue des six voies', w: 24, h: 22, gates: { W: 11 }, spawn: [2, 11],
        arrival: [
            'Une immense roue de pierre tourne sans bruit au centre d\'une cour circulaire, partagée en six rayons : dieux, hommes, titans, animaux, fantômes affamés, enfers. Chaque âme monte sur l\'un d\'eux.',
            'Au pied de la roue, assis sur un trône de pierre, le roi Yanluo pèse les noms. Il ne hait personne, et ne pardonne rien.'
        ],
        shapes: [
            ['=', 8, 6, 8, 10],
            ['#', 12, 3, 1, 1], ['#', 19, 7, 1, 1], ['#', 19, 15, 1, 1], ['#', 12, 19, 1, 1], ['#', 5, 15, 1, 1], ['#', 5, 7, 1, 1]
        ],
        npcs: [
            npc('ws_gardien_roue', 'Gardien de la roue', 'Veilleur des six voies', [
                'Six chemins, et un seul nom pour chacun. Le Roi les lit à haute voix, et la roue fait le reste.',
                'On dit que celui qui bat le roi Yanluo peut choisir sa voie. Je n\'ai jamais vu quelqu\'un essayer. Je n\'ai jamais vu quelqu\'un revenir, non plus.'
            ], { x: 4, y: 10 })
        ],
        chests: [
            { id: 'ws_tresor_six_voies', x: 21, y: 11, label: 'Trésor des six voies', tier: 4, openText: 'Derrière le trône, un coffre aux six serrures : dieux, hommes, titans, animaux, fantômes, enfers. Il les a toutes ouvertes pour vous.' }
        ],
        enemies: [
            { id: 'ws_yanluo', x: 17, y: 11, templateId: 'yuan_gui', name: 'Roi Yanluo', kind: 'sentinel', offset: 5, boss: true },
            { id: 'ws_juge_roue_1', x: 12, y: 5, templateId: 'heibai_wuchang', name: 'Messager de la roue', kind: 'sentinel', offset: 3 },
            { id: 'ws_juge_roue_2', x: 12, y: 17, templateId: 'heibai_wuchang', name: 'Messager de la roue', kind: 'sentinel', offset: 3 }
        ]
    }
];

/**
 * Portes entre terrains (et depuis la salle d'entrée) : chaque lien déclare la sortie de `from` sur son côté `side` et l'arrivée symétrique
 * dans `to`. `requires` : conditions d'avancement (ennemis vaincus, PNJ à qui l'on a parlé) pour ouvrir la sortie de `from`.
 */
export const LINKS = [
    { from: D.REALM_ID, side: 'E', to: SOURCES, label: 'Route des Sources Jaunes' },
    { from: SOURCES, side: 'E', to: TERRASSE, label: 'Terrasse du Regard vers le pays' },
    { from: TERRASSE, side: 'E', to: PONT, label: 'Pont Naihe' },
    { from: PONT, side: 'E', to: ROUE, label: 'Roue des six voies', requires: ['ws_meng_po'],
      lockedMessage: 'Meng Po garde la fin du pont : il faut lui parler avant de continuer vers la Roue.' },
    { from: D.REALM_ID, side: 'S', to: FENGDU, label: 'Fengdu, la cité fantôme' },
    { from: FENGDU, side: 'E', to: MIROIR, label: 'Miroir du Karma', requires: ['ws_wuchang_blanc', 'ws_wuchang_noir'],
      lockedMessage: 'Les messagers Bai et Hei Wuchang gardent la porte du tribunal : il faut les vaincre pour passer.' }
];

// Cases de la salle d'entrée pour ses deux nouvelles sorties (voir data.js GRID : « > » et « v »).
export const HUB_GATES = { E: { x: 21, y: 6 }, S: { x: 12, y: 12 } };

// ── Énigmes des nouveaux terrains ────────────────────────────────────────────────────────────────────────────────
// Elles verrouillent un coffre (champ `puzzle`), n'appartiennent à aucune armure antique et sont déclarées dans PUZZLES par index.js.

export const PUZZLE_SOUVENIRS = {
    id: 'ws_souvenirs',
    def: {
        title: 'Les urnes de la terrasse',
        mode: 'push',
        level: { grid: ['###########', '#@........#', '#.$.$.$...#', '#.........#', '#..*.*.*..#', '###########'] }
    }
};

export const PUZZLE_KARMA = {
    id: 'ws_miroir_karma',
    def: {
        title: 'Le miroir du karma',
        mode: 'mirror',
        level: { grid: ['############', '#..........#', '#T....../..#', '#...\\...../#', '#...*...\\..#', '#>../.....T#', '############'] }
    }
};

export const TERRAIN_PUZZLES = [PUZZLE_SOUVENIRS, PUZZLE_KARMA];

// ── Quête finale ─────────────────────────────────────────────────────────────────────────────────────────────────

export const QUEST_DIYU = {
    id: D.QUEST_IDS.diyu, title: 'La route des âmes',
    offer: [
        'Vous avez rendu l\'ordre au registre, archer. Mais un registre ne sert à rien si les âmes ne savent pas où aller.',
        'Suivez la route des Sources Jaunes jusqu\'au pont Naihe, parlez à Meng Po, rapportez le souvenir d\'une âme de la terrasse, brisez le reflet du tribunal et, si vous l\'osez, tenez tête au roi Yanluo. Quand le chemin sera rétabli, le vieux sanctuaire pourra se refermer.'
    ],
    hint: ['À l\'est : les Sources Jaunes, la Terrasse, le pont Naihe (Meng Po). Au sud : Fengdu, puis le tribunal du Miroir (vainquez les messagers Bai et Hei Wuchang). La Roue des six voies est au bout du pont.'],
    complete: [
        'Les âmes ont retrouvé leur chemin, et la Roue tourne de nouveau sans heurt. Vous avez fait en une nuit ce que les vivants appellent un pèlerinage.',
        'La porte peut se refermer, maintenant : elle ne s\'ouvrira que l\'an prochain, pour d\'autres curieux. Allez, archer. L\'aube est loin, mais elle vous attend.'
    ],
    objectives: {
        talk: 'Parler à Meng Po, au bout du pont Naihe',
        souvenir: 'Rapporter le souvenir du coffret de la terrasse du Regard vers le pays',
        reflet: 'Briser le Reflet du pécheur au Miroir du Karma',
        yanluo: 'Tenir tête au roi Yanluo, au pied de la Roue des six voies'
    },
    fragment: 'Route des âmes',
    reward: { gold: 200, xp: 480 }
};

export const TERRAIN_IDS = TERRAINS.map(t => t.id);

// Particularité de chaque terrain, en une phrase (soluce, documentation).
export const PARTICULARITY = {
    [SOURCES]: 'Route de terre jaune de la tradition (黃泉路) bordée de fleurs rouges : deux rivières à franchir par des ponts, et des hautes herbes où rôdent des feux follets (combats aléatoires).',
    [TERRASSE]: 'Terrasse d\'où les morts regardent leur pays (望鄉台) : trois mirages du pays natal que la cloche d\'exorcisme dissipe, des fantômes pendus et vengeurs, et l\'énigme des urnes qui garde le souvenir.',
    [PONT]: 'Pont Naihe (奈何橋) : un pont étroit gardé par des soldats gui, des noyés sur les rives, et Meng Po (孟婆), dont la soupe d\'oubli donne son nom au lieu. La porte de la Roue ne s\'ouvre qu\'après lui avoir parlé.',
    [FENGDU]: 'Fengdu (酆都), capitale des morts : un dédale de rues, le marché des fantômes (鬼市) et les messagers Bai et Hei Wuchang qui gardent le tribunal. La porte du Miroir ne s\'ouvre qu\'après les avoir vaincus tous les deux.',
    [MIROIR]: 'Miroir du Karma (孽鏡台) : le grand miroir montre les fautes des morts ; l\'énigme des miroirs du reliquaire trouble le reflet du pécheur et lui retire un niveau.',
    [ROUE]: 'Roue des six voies (六道輪迴) : fin du voyage, où le roi Yanluo (閻羅王) pèse les noms au pied de la roue, et où dort le trésor des six voies.'
};

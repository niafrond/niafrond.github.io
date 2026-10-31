// La Fête des lanternes d'hiver : données de l'événement (couche B). Aucune logique ici, voir ./index.js.
//
// Inspirations : Dongzhi (solstice d'hiver, réunion autour d'un repas chaud), tangyuan (boulettes de riz gluant de la réunion), lanternes
// rouges et dorées, villages de montagne enneigés, jade et symboles de longévité. Aucun code de Noël occidental (pas de traîneau, de
// lutins ni de houx) : c'est une fête chinoise de la lumière et du partage. Ton chaleureux : une seule zone est franchement hostile,
// le reste est contemplatif et les habitants se rallient par la générosité, pas par le combat.

export const ID = 'winterLanternFestival';
export const REALM_ID = 'winter_lantern_mountain';
export const BIOME = 'winter_lantern_mountain';
// Sprite de la porte du col (placeholder : la lanterne rouge existante, à remplacer par `wlm_gate`, voir prompts-gm.md).
export const GATE_SPRITE = 'red_lantern';

// Entrée : l'ancien col enneigé de la zone sauvage du Tonnerre. Niveau de référence de la région (REGION_LEVEL.tonnerre).
export const HOST = { region: 'tonnerre', wild: 'tonnerre_wild', level: 22 };

export const VILLAGE = {
    name: 'Le Village des lanternes enneigées',
    entrance: 'Ancien col des lanternes',
    exitLabel: 'Redescendre le col',
    notice: {
        id: 'winterLanternFestival',
        title: 'La Fête des lanternes d\'hiver',
        lines: [
            'Au cœur de l\'hiver, un vieux col enneigé s\'est rouvert. Au-delà, un village de montagne attend le solstice, mais ses lanternes sacrées s\'éteignent une à une.',
            'Nul ne vous oblige à monter, et rien ne sera perdu si vous passez votre chemin : il y a seulement, là-haut, de la soupe chaude, des gens qui ont besoin d\'un coup de main et une flamme à retrouver.'
        ]
    },
    intro: { id: BIOME, kicker: 'Montagne des lanternes', name: 'La Montagne des lanternes enneigées', description: 'Là où la lumière revient après la nuit la plus longue' },
    arrival: [
        'Le col débouche sur un village aux toits courbés, coiffés de neige. Des fils de soie rouge courent d\'une maison à l\'autre, mais presque toutes les lanternes sont éteintes.',
        'Pourtant, de la fumée monte des cheminées et une odeur de riz sucré flotte entre les ruelles. C\'est bientôt le solstice : ici, on ne laisse personne affronter le froid seul.'
    ]
};

export const QUEST_IDS = {
    solstice: 'sq_wlm_solstice', lanternes: 'sq_wlm_lanternes', tangyuan: 'sq_wlm_tangyuan',
    flamme: 'sq_wlm_flamme', chaleur: 'sq_wlm_chaleur', celebration: 'sq_wlm_celebration'
};

// 28 × 13. « < » : sortie ouest (vers le col du Tonnerre) ; « > » : sortie est (col des pins gelés) ; « ~ » : bassin gelé ; « = » : place dallée.
export const GRID = [
    '############################',
    '#..#.......2.........#..o..#',
    '#..........==========......#',
    '#.###..~~..=........=..#...#',
    '#.#....~~..=...3....=..###.#',
    '<S......1..=........=......>',
    '#....j.....==========..4...#',
    '#..###...............#.....#',
    '#..k.....6......7....#..m..#',
    '#.....##.......#.....r.....#',
    '#..5.......8.......9.#.....#',
    '#........#.........#..0....#',
    '############################'
];

export const GATES = { W: { x: 0, y: 5 }, E: { x: 27, y: 5 } };

// ── Personnages non hostiles du village ───────────────────────────────────────────────────────────────────────────

export const ANCIEN = {
    id: 'wlm_ancien', at: 'j', name: 'Grand-père Lao Dong', title: 'Ancien du village',
    idle: [
        'On raconte qu\'autrefois, un archer a décroché neuf soleils pour sauver les récoltes. Le dixième, on l\'a gardé pour l\'hiver : c\'est lui qui revient après la nuit la plus longue.',
        'Le froid n\'est pas un ennemi, petit. C\'est la moitié d\'un équilibre. Notre travail, c\'est de garder l\'autre moitié allumée.'
    ],
    talkDone: ['« Vous avez rallumé la montagne. Les vieux disent que le solstice, c\'est le jour où la lumière recommence à gagner un pas par jour. Merci d\'avoir fait le premier. »']
};

export const CUISINIER = {
    id: 'wlm_cuisinier', at: '2', name: 'Maître Boulette', title: 'Cuisinier des tangyuan',
    idle: [
        'Blanc pour la pureté, rose pour la chance, doré pour l\'abondance. Mais le secret, c\'est de les rouler ensemble : une boulette seule, ce n\'est pas un tangyuan.',
        'Mange chaud, voyageur. Ici, personne ne discute avec l\'estomac vide.'
    ],
    talkDone: ['« Une marmite pleine, un village réuni : voilà tout le solstice. Reprenez donc une boulette. »']
};

export const ARTISAN = {
    id: 'wlm_artisan', at: '3', name: 'Dame Hong Deng', title: 'Artisane des lanternes',
    idle: [
        'Du bambou fendu, du papier de riz, un peu de colle de farine. Une lanterne, c\'est trois fois rien, jusqu\'à ce qu\'on l\'allume.',
        'Les rouges chassent le froid, les dorées appellent la chance, les blanches guident ceux qui rentrent tard, et les jade, c\'est pour les amoureux. Ne demandez pas pourquoi.'
    ],
    talkDone: ['« Elles brûlent toutes droit, ce soir. Je n\'avais pas vu ça depuis ma jeunesse. »']
};

export const GARDIEN = {
    id: 'wlm_gardien_sanctuaire', at: '1', name: 'Tianlan', title: 'Gardien du sanctuaire de la flamme',
    idle: [
        'Ma famille garde le sanctuaire depuis neuf générations. La flamme céleste nous a été confiée pour que le froid et la chaleur restent en paix. Elle s\'est brisée en trois fragments.',
        'Ne vous pressez pas : une flamme ne se rallume pas à coups de hâte, mais de patience et de gens autour.'
    ],
    talkDone: ['« Le sanctuaire est tiède, pour la première fois depuis des hivers. Vous avez ma gratitude, archer, et une place à notre table. »']
};

export const ENFANTS = {
    id: 'wlm_enfants', at: '4', name: 'Enfants du village', title: 'Bataille de boules de neige',
    idle: [
        '« On a fait un bonhomme, mais il a une barbe de bambou et un chapeau de paille ! Lui, il a la tête d\'un vieux sage ! »',
        '« Vous voulez voir la lanterne en forme de lapin ? Elle est ratée. C\'est la meilleure. »'
    ],
    celebrationLines: [
        'Les enfants vous entourent, un bol de tangyuan dans chaque main, et vous apprennent la chanson du solstice. Vous la chantez faux. Personne ne vous le reproche.'
    ]
};

export const ESPRIT_VILLAGE = {
    id: 'wlm_esprit_village', at: '5', name: 'Esprit protecteur du village', title: 'Petite flamme sur un seuil',
    idle: [
        'Je ne suis qu\'une petite flamme au fond d\'une lanterne, mais je me souviens de chaque visage qui est passé devant cette porte.',
        'Quand on ne m\'allume plus, je m\'éteins. Quand on m\'offre un tangyuan, je brille. Je ne suis pas difficile.'
    ],
    celebrationLines: [
        'La petite flamme s\'étire, vous salue d\'un clignement, et la porte du village se couvre de lueur dorée.'
    ]
};

export const FAMILLE = {
    id: 'wlm_famille', at: 'o', name: 'Famille Lin', title: 'Habitants préparant le Dongzhi',
    idle: [
        'Les enfants roulent les boulettes, grand-mère surveille la marmite, et moi, je coupe le bois. Ce soir, nous serons dix à table.',
        'Il y a toujours une place de plus. On l\'ajoute chaque année, au cas où.'
    ],
    celebrationLines: [
        'La famille Lin pousse un banc de plus à la table. On vous raconte l\'hiver où le puits a gelé, et comment tout le village a fait la chaîne avec des seaux d\'eau chaude.'
    ]
};

export const RENARD = {
    id: 'wlm_renard_neiges', at: 'k', name: 'Renard des neiges', title: 'Guide des passages cachés',
    idle: [
        'Le renard vous regarde, tête penchée, puis trotte de quelques pas dans la neige et s\'assoit pour vous attendre. Ses yeux brillent d\'un bleu pâle.',
        'Il ne s\'enfuit pas quand vous approchez. Sa queue balaie la neige comme un petit pinceau.'
    ]
};

// ── Objets de la fête (objets de quête, inventaire existant) ────────────────────────────────────────────────────

export const LANTERN_ITEM = { id: 'qi_wlm_lanterne', name: 'Lanterne céleste', description: 'Une lanterne rouge et or dont la flamme ne chauffe pas la main mais éclaire les chemins sous la neige. Elle révèle le renard des neiges et les ingrédients enfouis.', earlyDescription: 'Une lanterne de papier encore froide.' };
export const REVEALED_BY = 'wlm_lanterne_1';

export const LANTERNS = [
    { id: 'wlm_lanterne_1', at: '6', label: 'Lanterne du puits', item: LANTERN_ITEM, openText: 'Vous approchez la mèche : la flamme s\'allume d\'elle-même, rouge et or, et la neige alentour fond d\'un pas. Quelque chose bouge au pied d\'une haie : un renard blanc aux yeux bleus vous observe. Plus à l\'est, une seconde mèche attend.' },
    { id: 'wlm_lanterne_2', at: '7', showWhen: 'wlm_lanterne_1', label: 'Lanterne du pont', openText: 'La lanterne du carrefour s\'embrase avec un petit claquement de bois sec. Sur la place, les fils de soie rouge se mettent à luire, l\'un après l\'autre, comme une vague de chaleur. Une dernière mèche vous attend au sud-ouest.' },
    { id: 'wlm_lanterne_3', at: '8', showWhen: 'wlm_lanterne_2', label: 'Lanterne de la porte', openText: 'La lanterne de la porte du village prend sa couleur d\'or. Les toits fument plus fort, quelqu\'un chante derrière une fenêtre, et la neige se met à tomber doucement, sans froid.' }
];

export const RIZ = {
    chest: { id: 'wlm_riz_gluant', at: 'm', label: 'Sac de riz gluant', openText: 'Un sac de toile oublié sous l\'auvent, plein de riz gluant blanc comme la neige. Il pèse ce qu\'il faut pour réunir une grande tablée.' },
    item: { id: 'qi_wlm_riz', name: 'Sac de riz gluant', description: 'Un sac de riz gluant pour les tangyuan : blanc pour la pureté, il se roule en boulettes qu\'on partage.', earlyDescription: 'Un sac de toile.' }
};
export const SESAME = {
    chest: { id: 'wlm_sesame_noir', at: 'r', label: 'Pot de sésame noir', showWhen: REVEALED_BY, openText: 'Sous un tas de neige, un pot de grès : du sésame noir moulu, sucré au sucre roux. La lanterne vous l\'a montré, sinon vous seriez passé dessus sans le voir.' },
    item: { id: 'qi_wlm_sesame', name: 'Sésame noir moulu', description: 'Le fourrage préféré des tangyuan de la montagne : sombre, gras et un peu trop sucré, comme il se doit.', earlyDescription: 'Un pot de grès.' }
};
export const CLOCHETTE = {
    id: 'wlm_clochette', label: 'Clochette de montagne',
    openText: 'Une clochette de bronze est suspendue à une branche couverte de givre. Son tintement est cristallin : les passages cachés et les esprits protecteurs y répondent.',
    item: { id: 'qi_wlm_clochette', name: 'Clochette de montagne', description: 'Une clochette de bronze au son clair. Elle attire les créatures curieuses et fait réagir les esprits protecteurs des villages.', earlyDescription: 'Une clochette ternie.' }
};

// Fragments de la flamme céleste (objets de quête principaux de la chaîne).
export const FRAGMENTS = [
    { id: 'qi_wlm_flamme_1', name: 'Fragment de flamme céleste (I)', description: 'Un éclat de flamme figée dans du cristal. Il est tiède, et il bat doucement comme un cœur.', earlyDescription: 'Un petit cristal pâle.' },
    { id: 'qi_wlm_flamme_2', name: 'Fragment de flamme céleste (II)', description: 'Le deuxième éclat de la flamme céleste, pris dans la glace. Il fond doucement entre vos doigts sans jamais disparaître.', earlyDescription: 'Un bloc de glace aux reflets dorés.' },
    { id: 'qi_wlm_flamme_3', name: 'Fragment de flamme céleste (III)', description: 'Le dernier éclat de la flamme céleste, scellé dans une niche du sanctuaire. Il a la chaleur d\'un feu de cuisine.', earlyDescription: 'Un éclat qui brille faiblement.' }
];
export const JADE = {
    chest: { id: 'wlm_jade_hiver', label: 'Jade de l\'hiver', openText: 'Dans la niche de l\'autel, derrière la flamme apaisée, un jade vert profond sculpté en grue : un symbole de longévité, froid d\'apparence et tiède au toucher.' },
    item: { id: 'qi_wlm_jade', name: 'Jade de l\'hiver', description: 'Un jade sculpté en forme de grue, symbole de longue vie. Il protège celui qui le porte contre les morsures du gel.', earlyDescription: 'Un jade vert, froid.' }
};
export const SOURCE_CHAUDE = {
    chest: { id: 'wlm_source_chaude', label: 'Source chaude', openText: 'Une vapeur monte d\'une vasque de pierre : une source chaude, cachée sous la neige. Quand vous la libérez, la glace de la porte du sanctuaire se met à craquer et à fondre, goutte à goutte.' }
};

// ── Énigmes (moteur d'énigmes existant ; absentes quand l'événement est désactivé) ───────────────────────────────

// Miroirs de lumière : le rayon descend de la source (v) ; il faut basculer les miroirs pour qu'il atteigne la lanterne cible (T). Niveau facile.
export const PUZZLE_MIROIR = {
    id: 'wlm_miroirs',
    tier: 3,
    def: {
        title: 'Les miroirs de la Lanterne du solstice',
        mode: 'mirror',
        level: {
            grid: [
                '##########',
                '#.......v#',
                '#..\\..T..#',
                '#........#',
                '#........#',
                '#../....\\#',
                '##########'
            ]
        }
    },
    chest: { id: 'wlm_cache_miroirs', at: '9', label: 'Cache du miroir de lumière', openText: 'Le dernier miroir s\'aligne, un trait de lumière dorée traverse le coffret, et la serrure de glace se brise : un fragment de flamme repose sur du velours rouge.' },
    item: FRAGMENTS[0]
};
// Blocs de glace à déplacer sur les dalles marquées (mode « push »). Niveau facile à moyen.
export const PUZZLE_GLACE = {
    id: 'wlm_blocs_glace',
    tier: 3,
    def: {
        title: 'Les blocs de glace du col',
        mode: 'push',
        level: {
            grid: [
                '#########',
                '#@......#',
                '#.$..$..#',
                '#.......#',
                '#..*..*.#',
                '#########'
            ]
        }
    },
    chest: { id: 'wlm_cache_glace', label: 'Cache des blocs de glace', openText: 'Les deux blocs glissent sur leurs dalles et un panneau de glace s\'ouvre : un fragment de flamme, comme un charbon doré enfermé dans un glaçon.' },
    item: FRAGMENTS[1]
};
export const PUZZLE_LIST = [PUZZLE_MIROIR, PUZZLE_GLACE];

// ── Sanctuaire ───────────────────────────────────────────────────────────────────────────────────────────────────

export const SANCTUAIRE_CHEST_3 = {
    id: 'wlm_fragment_3', label: 'Niche du sanctuaire',
    openText: 'Dans une niche de l\'angle du sanctuaire, protégée par un rideau de soie rouge, le troisième fragment de la flamme céleste brille faiblement. Vous le prenez en refermant les deux mains autour.',
    item: FRAGMENTS[2]
};

export const GUARDS_GROUP = 'wlm_gardiens_de_glace';
export const BOSS = { id: 'wlm_gardien_flamme', name: 'Gardien de la flamme hivernale' };

// ── Quêtes ───────────────────────────────────────────────────────────────────────────────────────────────────────

export const QUESTS = {
    solstice: {
        id: QUEST_IDS.solstice, title: 'Les préparatifs du solstice',
        offer: [
            'Voyageur ! Vous tombez à pic. Le Dongzhi approche, la nuit la plus longue de l\'année, et le village n\'est pas prêt. Les lanternes sont éteintes, la marmite est vide et tout le monde court dans tous les sens.',
            'Allez voir Maître Boulette, le cuisinier, puis Dame Hong Deng, l\'artisane. Dites-leur que l\'ancien envoie quelqu\'un pour aider. Ça les rassurera.'
        ],
        hint: ['Parlez à Maître Boulette (cuisinier) et à Dame Hong Deng (artisane des lanternes), sur la place du village.'],
        complete: ['Vous avez fait le tour de la place : c\'est bien. Un village qui sait qu\'on l\'aide respire mieux.', 'Maintenant, il y a deux tâches : rallumer les lanternes avec l\'artisane, et préparer les tangyuan avec le cuisinier.'],
        objectives: { cook: 'Parler à Maître Boulette, le cuisinier des tangyuan', artisan: 'Parler à Dame Hong Deng, l\'artisane des lanternes' },
        cookLines: ['« Ah, c\'est vous ! Je ne dis pas non à des mains en plus. J\'aurai bientôt besoin de riz gluant et de fourrage, passez me voir. »'],
        artisanLines: ['« Les lanternes du village sont éteintes depuis la dernière neige. Prenez celle du puits : elle mène aux autres. »'],
        fragment: 'Préparatifs du solstice',
        reward: { gold: 150, xp: 220 }
    },
    lanternes: {
        id: QUEST_IDS.lanternes, title: 'Rallumer les lanternes du village',
        offer: [
            'Trois lanternes éclairaient jadis le village : celle du puits, celle du pont et celle de la porte. Rallumez-les dans cet ordre, chacune révèle la suivante.',
            'Prenez la lanterne céleste en premier : elle fait fondre la neige qui cache les choses.'
        ],
        hint: ['Trois lanternes éteintes sont dispersées dans le village ; elles s\'allument dans l\'ordre, chacune révélant la suivante.'],
        complete: ['Les trois flammes brûlent, et le village a retrouvé sa couleur. Même la neige a l\'air plus douce.', 'Reste la flamme céleste elle-même, au sanctuaire. Voyez Tianlan, le gardien, il vous expliquera.'],
        objectives: { lantern: n => `Rallumer la lanterne n°${n} du village des lanternes` },
        fragment: 'Lanternes du village',
        reward: { gold: 260, xp: 380 }
    },
    tangyuan: {
        id: QUEST_IDS.tangyuan, title: 'Les tangyuan du solstice',
        offer: [
            'Il me faut du riz gluant, du sésame noir pour le fourrage, et quelque chose pour appeler les esprits au festin : une clochette, ça fera l\'affaire.',
            'Le riz est sous l\'auvent, le sésame est enfoui sous la neige près de la ruelle est (la lanterne céleste vous le montrera), et la clochette pend à un arbre du col.'
        ],
        hint: ['Cherchez le sac de riz gluant sur la place, le pot de sésame noir (visible grâce à la lanterne du puits) et la clochette de montagne dans le col des pins gelés.'],
        complete: ['Le riz est roulé, le sésame est fondu : blanc, rose, doré. Chaque boulette est une promesse de réunion.', 'Tenez, le premier bol est pour vous. Le deuxième, pour l\'esprit du village : il en raffole.'],
        objectives: { riz: 'Rapporter le sac de riz gluant', sesame: 'Rapporter le pot de sésame noir (caché sous la neige)', clochette: 'Rapporter la clochette de montagne (col des pins gelés)' },
        fragment: 'Recette des tangyuan',
        reward: { gold: 240, xp: 340 }
    },
    flamme: {
        id: QUEST_IDS.flamme, title: 'Les fragments de la flamme céleste',
        offer: [
            'La flamme céleste est brisée en trois fragments. Le premier dort dans un coffret de lumière au village, le deuxième dans la glace du col, le troisième dans une niche du sanctuaire.',
            'Le sanctuaire est fermé par une porte gelée. Cherchez une source chaude dans le col : la glace fond près de la chaleur.'
        ],
        hint: ['Fragments : coffret des miroirs de lumière (village), cache des blocs de glace (col), niche du sanctuaire. La porte gelée du sanctuaire fond près de la source chaude du col.'],
        complete: ['Trois fragments, et la flamme les reconnaît : elle se rassemble dans votre main avant que je ne puisse dire un mot.', 'Il ne reste qu\'à la ramener à l\'autel, et à apaiser son gardien, qui ne vous connaît pas encore.'],
        objectives: { f1: 'Retrouver le premier fragment (miroirs de lumière, village)', f2: 'Retrouver le deuxième fragment (blocs de glace, col)', f3: 'Retrouver le troisième fragment (sanctuaire)' },
        fragment: 'Flamme céleste',
        reward: { gold: 420, xp: 640 }
    },
    chaleur: {
        id: QUEST_IDS.chaleur, title: 'Rétablir la chaleur du sanctuaire',
        offer: [
            'Le gardien de la flamme hivernale n\'est pas un ennemi : c\'est un équilibre qui a perdu le sien. Sa flamme est trop faible, son cœur de glace trop dur.',
            'Les gardiens de glace qui l\'entourent s\'écarteront si les lanternes sont allumées. Affaiblissez-le avec la source chaude et un bon bol de tangyuan, puis rapportez le jade de l\'hiver.'
        ],
        hint: ['Le Gardien de la flamme hivernale se tient au fond du sanctuaire. La source chaude du col et la recette des tangyuan l\'affaiblissent ; le jade de l\'hiver repose derrière lui.'],
        complete: ['Il s\'est incliné, puis la flamme est montée droit comme un cierge. Le sanctuaire est tiède.', 'Gardez le jade, archer : il vous protégera du froid, même loin d\'ici. Et venez au village : tout le monde vous attend pour le repas.'],
        objectives: { boss: 'Apaiser ou vaincre le Gardien de la flamme hivernale', jade: 'Rapporter le jade de l\'hiver' },
        fragment: 'Jade de l\'hiver',
        reward: { gold: 600, xp: 900 }
    },
    celebration: {
        id: QUEST_IDS.celebration, title: 'La table du solstice',
        offer: [
            'Alors ? La flamme est rallumée, et le village n\'a plus peur du froid. Il y a une dernière chose à faire, la plus importante : venir à table.',
            'Allez saluer la famille Lin, les enfants et la petite flamme qui garde la porte. Ils veulent vous remercier avant de servir.'
        ],
        hint: ['Parlez à la famille Lin, aux enfants et à l\'esprit protecteur du village, sur la place.'],
        complete: ['Les bols passent de main en main, les lanternes rient dans leurs cadres de bambou, et la neige, dehors, tombe doucement.', 'C\'est le solstice : demain, la lumière gagnera un pas. Et ce pas, un peu, c\'est le vôtre.'],
        objectives: { famille: 'Saluer la famille Lin', enfants: 'Saluer les enfants du village', esprit: 'Saluer l\'esprit protecteur du village' },
        fragment: 'La table du solstice',
        reward: { gold: 500, xp: 700 }
    }
};

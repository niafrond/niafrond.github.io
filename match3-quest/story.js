// Histoire et cartes d'exploration de Match3-Quest : « La Couronne Brisée ».
//
// Données pures (aucun accès DOM) : la logique est dans exploration.js, le rendu dans
// explorationView.js. Chaque écran est une petite carte isométrique (w x h tuiles) ;
// on n'en affiche qu'un à la fois, les sorties (`exits`) mènent à l'écran voisin.
//
// Rectangles : [x, y, largeur, hauteur] en tuiles. Les `obstacles` et `liquids` sont
// infranchissables, les `paths` sont purement décoratifs.
//
// Ennemis :
//  - kind 'sentinel' : immobile, se déclenche si on passe à `AGGRO_RADIUS` tuile(s) ;
//  - kind 'patrol'   : fait des allers-retours entre les points de `patrol` ;
//  - permanent:true  : ne réapparaît jamais (ennemis d'histoire), sinon il revient à chaque
//                      entrée dans l'écran (le joueur peut donc s'entraîner) ;
//  - boss            : { name, level } → combat de boss (niveau au moins égal à celui du joueur) ;
//  - offset          : écart de niveau par rapport au joueur (-1, 0 ou +1) pour les ennemis normaux.

export const STORY_TITLE = 'La Couronne Brisée';

export const STORY_INTRO = [
    "Le royaume de Valdoria est en péril. La Couronne des Cinq Sceaux, qui protégeait les terres depuis mille ans, a été brisée par Zar'khul, le Seigneur du Vide.",
    "Ses fragments se sont dispersés dans cinq contrées hostiles, chacune gardée par un tyran : le Roi Gobelin, le Chef de Guerre orc, le Gardien du Soleil, le Dragon de Glace… et Zar'khul lui-même, tapi dans les Abysses.",
    "À Brumechêne, dernier village encore debout, l'Ancienne Maëlle cherche un héros. Allez lui parler."
];

export const STORY_ENDING = [
    "Zar'khul s'effondre en poussière noire et le Vide se referme. Les cinq fragments s'assemblent dans votre main : la Couronne est de nouveau entière.",
    "Valdoria est sauvée. Mais les créatures rôdent toujours… et un héros ne se repose jamais. Vous pouvez continuer à explorer et à vous entraîner."
];

export const SCREENS = {
    village: {
        id: 'village', region: 'forest', name: 'Brumechêne', biome: 'village',
        w: 14, h: 10, spawn: { x: 2, y: 4 },
        obstacles: [[2, 1, 3, 2], [7, 1, 3, 2], [11, 1, 2, 2], [2, 6, 3, 2], [9, 6, 3, 2], [0, 8, 2, 2]],
        liquids: [],
        paths: [[0, 4, 14, 1], [6, 2, 1, 3]],
        exits: [
            { x: 13, y: 4, to: 'forest', arrive: { x: 1, y: 4 }, label: 'Forêt Sylvestre' }
        ],
        npcs: [
            { id: 'maelle', x: 6, y: 3, name: 'Maëlle', title: 'Ancienne du village', emoji: '👵',
              idle: ["Que la lumière vous guide, voyageur. Revenez me voir quand vous aurez du nouveau."] },
            { id: 'bran', x: 10, y: 5, name: 'Bran', title: 'Forgeron', emoji: '🧔',
              idle: [
                  "Les monstres se font plus nombreux chaque semaine. Vous les voyez de loin : un cercle rouge marque leur zone de vigilance. Contournez-les si vous ne vous sentez pas prêt !",
                  "Et n'oubliez pas de passer à la boutique et de vérifier vos sorts avant de partir."
              ] }
        ],
        enemies: [],
        chests: []
    },

    forest: {
        id: 'forest', region: 'forest', name: 'Forêt Sylvestre', biome: 'forest',
        w: 14, h: 10, spawn: { x: 1, y: 4 },
        obstacles: [[2, 1, 2, 2], [8, 1, 1, 2], [11, 2, 2, 2], [4, 6, 2, 2], [9, 6, 2, 1], [1, 7, 2, 2]],
        liquids: [],
        paths: [[0, 4, 7, 1], [6, 0, 1, 5], [6, 7, 8, 1]],
        exits: [
            { x: 0, y: 4, to: 'village', arrive: { x: 12, y: 4 }, label: 'Brumechêne' },
            { x: 6, y: 0, to: 'goblin_den', arrive: { x: 6, y: 8 }, label: 'Antre du Roi Gobelin' },
            { x: 13, y: 7, to: 'ruins', arrive: { x: 1, y: 7 }, label: 'Ruines Antiques' }
        ],
        npcs: [],
        enemies: [
            { id: 'forest_gob', templateId: 'goblin_saboteur', emoji: '🗡️', name: 'Gobelin Saboteur', kind: 'sentinel', x: 5, y: 3, offset: 0 },
            { id: 'forest_shroom', templateId: 'fungal_horror', emoji: '🍄', name: 'Horreur Mycélienne', kind: 'sentinel', x: 9, y: 3, offset: 0 },
            { id: 'forest_priestess', templateId: 'moon_priestess', emoji: '🌙', name: 'Prêtresse Lunaire', kind: 'patrol', x: 3, y: 9, patrol: [[3, 9], [12, 9]], offset: 0 }
        ],
        chests: []
    },

    goblin_den: {
        id: 'goblin_den', region: 'forest', name: 'Antre du Roi Gobelin', biome: 'den',
        w: 14, h: 10, spawn: { x: 6, y: 8 },
        obstacles: [[1, 1, 2, 3], [11, 1, 2, 3], [4, 4, 1, 2], [9, 4, 1, 2], [0, 6, 2, 2], [12, 6, 2, 2], [5, 0, 1, 2], [8, 0, 1, 2]],
        liquids: [],
        paths: [[6, 0, 1, 10]],
        exits: [
            { x: 6, y: 9, to: 'forest', arrive: { x: 6, y: 1 }, label: 'Forêt Sylvestre' }
        ],
        npcs: [],
        enemies: [
            { id: 'den_guard_l', templateId: 'goblin_saboteur', emoji: '🗡️', name: 'Garde gobelin', kind: 'sentinel', x: 3, y: 7, offset: -1 },
            { id: 'den_guard_r', templateId: 'goblin_saboteur', emoji: '🗡️', name: 'Garde gobelin', kind: 'sentinel', x: 11, y: 7, offset: -1 },
            { id: 'goblin_king', templateId: 'goblin_saboteur', emoji: '👺', name: 'Grukk, Roi Gobelin', kind: 'sentinel', x: 6, y: 2,
              permanent: true, boss: { name: 'Grukk, Roi Gobelin', level: 3 } }
        ],
        chests: [
            { id: 'den_chest', x: 12, y: 5, gold: 40 }
        ]
    },

    ruins: {
        id: 'ruins', region: 'ruins', name: 'Ruines Antiques', biome: 'ruins',
        w: 14, h: 10, spawn: { x: 1, y: 7 },
        obstacles: [[3, 2, 1, 1], [3, 6, 1, 1], [10, 2, 1, 1], [10, 7, 1, 1], [5, 0, 1, 1], [8, 8, 1, 2], [12, 5, 2, 1], [1, 2, 1, 2]],
        liquids: [],
        paths: [[0, 7, 6, 1], [6, 0, 2, 10], [6, 4, 8, 1]],
        exits: [
            { x: 0, y: 7, to: 'forest', arrive: { x: 12, y: 7 }, label: 'Forêt Sylvestre' },
            { x: 13, y: 4, to: 'warcamp', arrive: { x: 1, y: 4 }, label: 'Camp de Guerre' }
        ],
        npcs: [
            { id: 'aldric', x: 7, y: 4, name: 'Aldric', title: 'Sage encerclé', emoji: '🧙‍♂️',
              idle: ["Merci, brave héros. Sans vous, ces morts-vivants m'auraient emporté."] }
        ],
        enemies: [
            { id: 'aldric_guard_n', templateId: 'bone_reaver', emoji: '🦴', name: 'Faucheur d\'os', kind: 'sentinel', x: 7, y: 3, offset: 0, permanent: true, group: 'aldric_guards' },
            { id: 'aldric_guard_s', templateId: 'crypt_lich', emoji: '☠️', name: 'Liche des cryptes', kind: 'sentinel', x: 7, y: 5, offset: 0, permanent: true, group: 'aldric_guards' },
            { id: 'aldric_guard_w', templateId: 'bone_reaver', emoji: '🦴', name: 'Faucheur d\'os', kind: 'sentinel', x: 6, y: 4, offset: 0, permanent: true, group: 'aldric_guards' },
            { id: 'aldric_guard_e', templateId: 'temple_warden', emoji: '🛡️', name: 'Gardien du temple', kind: 'sentinel', x: 8, y: 4, offset: 0, permanent: true, group: 'aldric_guards' },
            { id: 'ruins_scholar', templateId: 'arcane_scholar', emoji: '📜', name: 'Érudit arcanique', kind: 'sentinel', x: 3, y: 4, offset: 0 },
            { id: 'ruins_gladiator', templateId: 'iron_gladiator', emoji: '⚔️', name: 'Gladiateur d\'acier', kind: 'patrol', x: 11, y: 9, patrol: [[11, 9], [11, 6]], offset: 0 }
        ],
        chests: [
            { id: 'ruins_chest', x: 12, y: 1, gold: 60 }
        ]
    },

    warcamp: {
        id: 'warcamp', region: 'warcamp', name: 'Camp de Guerre', biome: 'warcamp',
        w: 14, h: 10, spawn: { x: 1, y: 4 },
        obstacles: [[3, 1, 2, 2], [3, 7, 2, 2], [6, 6, 2, 1], [9, 0, 2, 2], [12, 2, 1, 2], [9, 7, 2, 2], [6, 1, 1, 2]],
        liquids: [],
        paths: [[0, 4, 14, 1], [12, 4, 1, 4]],
        exits: [
            { x: 0, y: 4, to: 'ruins', arrive: { x: 12, y: 4 }, label: 'Ruines Antiques' },
            { x: 13, y: 8, to: 'desert', arrive: { x: 1, y: 5 }, label: 'Désert Ardent' }
        ],
        npcs: [],
        enemies: [
            { id: 'war_assassin', templateId: 'shadow_assassin', emoji: '🥷', name: 'Assassin de l\'Ombre', kind: 'sentinel', x: 5, y: 5, offset: 0 },
            { id: 'war_doctor', templateId: 'plague_doctor', emoji: '🧪', name: 'Médecin de la Peste', kind: 'patrol', x: 3, y: 5, patrol: [[3, 5], [3, 6]], offset: 0 },
            { id: 'war_knight', templateId: 'storm_knight', emoji: '🌩️', name: 'Chevalier de l\'Orage', kind: 'patrol', x: 8, y: 9, patrol: [[8, 9], [12, 9]], offset: 0 },
            { id: 'gorm_kar', templateId: 'orc_warmaster', emoji: '👹', name: 'Gorm-Kar, Chef de Guerre', kind: 'sentinel', x: 10, y: 4,
              permanent: true, boss: { name: 'Gorm-Kar, Chef de Guerre', level: 6 } }
        ],
        chests: [
            { id: 'war_chest', x: 12, y: 0, gold: 80 }
        ]
    },

    desert: {
        id: 'desert', region: 'desert', name: 'Désert Ardent', biome: 'desert',
        w: 14, h: 10, spawn: { x: 1, y: 5 },
        obstacles: [[3, 1, 2, 2], [4, 7, 2, 2], [8, 6, 1, 2], [12, 6, 1, 2], [9, 0, 1, 1], [2, 8, 1, 1]],
        liquids: [],
        paths: [[0, 5, 8, 1], [7, 0, 1, 6]],
        exits: [
            { x: 0, y: 5, to: 'warcamp', arrive: { x: 12, y: 8 }, label: 'Camp de Guerre' },
            { x: 7, y: 0, to: 'frozen', arrive: { x: 7, y: 8 }, label: 'Terres Gelées' }
        ],
        npcs: [
            { id: 'tariq', x: 2, y: 6, name: 'Tariq', title: 'Nomade des dunes', emoji: '🧕',
              idle: ["Le désert ne pardonne pas. Buvez, et regardez où vous mettez les pieds."] }
        ],
        enemies: [
            { id: 'desert_colossus', templateId: 'sand_colossus', emoji: '🏜️', name: 'Colosse des dunes', kind: 'sentinel', x: 5, y: 4, offset: 0 },
            { id: 'desert_behemoth', templateId: 'lava_behemoth', emoji: '🌋', name: 'Béhémoth de lave', kind: 'patrol', x: 3, y: 9, patrol: [[3, 9], [12, 9]], offset: 0 },
            { id: 'sun_guardian', templateId: 'sun_paladin', emoji: '☀️', name: 'Solarion, Gardien du Soleil', kind: 'sentinel', x: 10, y: 3,
              permanent: true, boss: { name: 'Solarion, Gardien du Soleil', level: 9 } }
        ],
        // Le coffre est à deux tuiles du gardien : on peut le voler sans se battre.
        chests: [
            { id: 'sun_chest', x: 12, y: 1, gold: 100, label: 'Amulette du Soleil' }
        ]
    },

    frozen: {
        id: 'frozen', region: 'frozen', name: 'Terres Gelées', biome: 'frozen',
        w: 14, h: 10, spawn: { x: 7, y: 8 },
        obstacles: [[2, 1, 2, 2], [10, 1, 2, 2], [2, 6, 2, 2], [10, 6, 2, 2], [5, 5, 1, 1], [8, 5, 1, 1], [0, 4, 2, 1]],
        liquids: [[4, 8, 2, 1], [9, 8, 2, 1]],
        paths: [[7, 0, 1, 10]],
        exits: [
            { x: 7, y: 9, to: 'desert', arrive: { x: 7, y: 1 }, label: 'Désert Ardent' },
            { x: 0, y: 3, to: 'abyss', arrive: { x: 12, y: 3 }, label: 'Abysses Interdites' }
        ],
        npcs: [
            { id: 'ylva', x: 3, y: 4, name: 'Ylva', title: 'Ermite du givre', emoji: '🧙‍♀️',
              idle: ["Le froid garde les secrets. Que la chaleur de votre courage ne s'éteigne jamais."] }
        ],
        enemies: [
            { id: 'frozen_witch', templateId: 'ice_witch', emoji: '❄️', name: 'Sorcière du givre', kind: 'sentinel', x: 5, y: 3, offset: 0 },
            { id: 'frozen_troll', templateId: 'war_troll', emoji: '🪓', name: 'Troll de guerre', kind: 'patrol', x: 12, y: 8, patrol: [[12, 8], [12, 5]], offset: 0 },
            { id: 'frozen_wyrm', templateId: 'storm_wyrm', emoji: '⚡', name: 'Wyrm fulgurant', kind: 'sentinel', x: 9, y: 4, offset: 0 },
            { id: 'frost_dragon', templateId: 'frost_dragon', emoji: '🐉', name: 'Glacius, Dragon de Glace', kind: 'sentinel', x: 7, y: 2,
              permanent: true, boss: { name: 'Glacius, Dragon de Glace', level: 12 } }
        ],
        chests: [
            { id: 'frozen_chest', x: 1, y: 8, gold: 120 }
        ]
    },

    abyss: {
        id: 'abyss', region: 'abyss', name: 'Abysses Interdites', biome: 'abyss',
        w: 14, h: 10, spawn: { x: 12, y: 3 },
        obstacles: [[2, 2, 2, 2], [2, 6, 2, 2], [5, 4, 1, 2], [9, 5, 1, 2], [11, 7, 2, 2], [9, 0, 2, 1]],
        liquids: [[6, 8, 3, 2], [0, 4, 1, 2]],
        paths: [[7, 0, 1, 5], [7, 3, 7, 1]],
        exits: [
            { x: 13, y: 3, to: 'frozen', arrive: { x: 1, y: 3 }, label: 'Terres Gelées' }
        ],
        npcs: [],
        enemies: [
            { id: 'abyss_serpent', templateId: 'deep_sea_serpent', emoji: '🌊', name: 'Serpent abyssal', kind: 'patrol', x: 10, y: 8, patrol: [[10, 8], [10, 5]], offset: 0 },
            { id: 'abyss_sage', templateId: 'crystal_sage', emoji: '💎', name: 'Sage de cristal', kind: 'sentinel', x: 4, y: 3, offset: 0 },
            { id: 'void_lord', templateId: 'void_vampire', emoji: '🧛', name: "Zar'khul, Seigneur du Vide", kind: 'sentinel', x: 7, y: 1,
              permanent: true, boss: { name: "Zar'khul, Seigneur du Vide", level: 15 } }
        ],
        chests: [
            { id: 'abyss_chest', x: 1, y: 9, gold: 200 }
        ]
    }
};

// Point d'arrivée de la téléportation depuis la carte du monde (une entrée par région).
export const REGION_ENTRY_SCREEN = {
    forest: 'village',
    ruins: 'ruins',
    warcamp: 'warcamp',
    desert: 'desert',
    frozen: 'frozen',
    abyss: 'abyss'
};

// Niveau minimal du joueur pour ENTRER dans un écran de la région (brume magique sinon).
export const REGION_UNLOCK_LEVEL = {
    forest: 1,
    ruins: 1,
    warcamp: 4,
    desert: 7,
    frozen: 10,
    abyss: 13
};

// Quêtes de l'histoire, dans l'ordre. Statut : locked → available → active → ready → done.
//  - giver      : PNJ qui propose la quête (absent + autoStart:true = démarre toute seule)
//  - turnIn     : PNJ auquel on rend compte (absent = validée automatiquement)
//  - requires   : quêtes à terminer avant
//  - objectives : kill (ennemi), killGroup (groupe d'ennemis), chest (ouvrir un coffre)
export const QUESTS = [
    {
        id: 'goblin_king',
        title: 'Le Roi Gobelin',
        chapter: 'Chapitre I — Les gobelins de Brumechêne',
        giver: 'maelle', turnIn: 'maelle', requires: [],
        objectives: [{ type: 'kill', target: 'goblin_king', text: 'Vaincre Grukk, Roi Gobelin (Antre du Roi Gobelin, au nord de la forêt)' }],
        offer: [
            "Les gobelins pillent nos réserves depuis des semaines. Leur roi, Grukk, s'est terré dans un antre au nord de la Forêt Sylvestre : il détient le premier fragment de la Couronne.",
            "Tuez-le, et Brumechêne vous devra la vie. Prenez garde : ses gardes veillent à l'entrée."
        ],
        hint: ["L'antre de Grukk est au nord de la forêt. Les gobelins sont rusés : ne les sous-estimez pas."],
        complete: [
            "Vous l'avez fait ! Grukk n'est plus… Voici le premier fragment de la Couronne, et une bourse pour vos peines.",
            "Un érudit, Aldric, est parti chercher des réponses dans les Ruines Antiques à l'est de la forêt, et n'est jamais revenu…"
        ],
        reward: { gold: 80, fragment: 'Fragment des Bois' }
    },
    {
        id: 'sage_rescue',
        title: 'Le sage encerclé',
        chapter: 'Chapitre II — Les Ruines Antiques',
        giver: 'maelle', turnIn: 'aldric', requires: ['goblin_king'],
        objectives: [{ type: 'killGroup', target: 'aldric_guards', text: 'Terrasser les 4 morts-vivants qui encerclent Aldric (Ruines Antiques)' }],
        offer: [
            "Aldric est un vieil ami. Il cherchait les ruines du temple pour comprendre comment réparer la Couronne.",
            "Allez le retrouver dans les Ruines Antiques, à l'est de la forêt. S'il est encore en vie, il est sûrement en danger."
        ],
        hint: ["Les Ruines Antiques sont à l'est de la Forêt Sylvestre. Cherchez un sage cerné par des morts-vivants."],
        complete: [
            "Merci, héros ! Je croyais ma dernière heure venue… Ces revenants gardaient le deuxième fragment, que voici.",
            "Écoutez : le Chef de Guerre Gorm-Kar rassemble une horde dans le Camp de Guerre, plus à l'est. Il cherche lui aussi les fragments. Il faut l'arrêter avant qu'il ne les réunisse !"
        ],
        reward: { gold: 120, fragment: 'Fragment de Pierre' }
    },
    {
        id: 'warmaster',
        title: 'Le Chef de Guerre',
        chapter: 'Chapitre III — Le Camp de Guerre',
        autoStart: true, turnIn: null, requires: ['sage_rescue'],
        objectives: [{ type: 'kill', target: 'gorm_kar', text: 'Vaincre Gorm-Kar, Chef de Guerre (Camp de Guerre, à l\'est des ruines)' }],
        offer: ["Nouvelle mission : renverser Gorm-Kar dans le Camp de Guerre, à l'est des Ruines Antiques. (Niveau 4 conseillé)"],
        hint: [],
        complete: [
            "Gorm-Kar s'écroule dans un rugissement. Sa horde se disperse et vous récupérez le troisième fragment de la Couronne dans les cendres de son trône."
        ],
        reward: { gold: 150, fragment: 'Fragment de Fer' }
    },
    {
        id: 'sun_relic',
        title: "L'amulette du Soleil",
        chapter: 'Chapitre IV — Le Désert Ardent',
        giver: 'tariq', turnIn: null, requires: ['warmaster'],
        objectives: [{ type: 'chest', target: 'sun_chest', text: "Récupérer l'Amulette du Soleil dans le coffre du désert" }],
        offer: [
            "Je suis Tariq. Mon peuple garde une amulette sacrée, le quatrième fragment de la Couronne, mais le paladin Solarion, rendu fou par le soleil, l'a enfermée dans un coffre au nord-est de l'oasis.",
            "Le vaincre demande de la force… ou de la discrétion. Son regard ne porte pas à plus d'une tuile : un voleur habile pourrait atteindre le coffre sans croiser sa lame. (Niveau 7 conseillé)"
        ],
        hint: ["Le coffre est près de Solarion, au nord-est. Combattez-le ou contournez-le avec prudence."],
        complete: [
            "L'Amulette du Soleil brille dans vos mains ! Le quatrième fragment est à vous, et les miens vous en sont reconnaissants.",
            "Au nord, dans les Terres Gelées, une ermite nommée Ylva parle d'un dragon qui garde le dernier fragment."
        ],
        reward: { gold: 200, fragment: 'Fragment du Soleil' }
    },
    {
        id: 'frost_dragon',
        title: 'Le Dragon de Glace',
        chapter: 'Chapitre V — Les Terres Gelées',
        giver: 'ylva', turnIn: 'ylva', requires: ['sun_relic'],
        objectives: [{ type: 'kill', target: 'frost_dragon', text: 'Vaincre Glacius, Dragon de Glace (Terres Gelées)' }],
        offer: [
            "Je t'attendais, porteur de fragments. Glacius, le dragon de givre, dort sur le cinquième fragment, au fond de ces terres.",
            "Aucune magie de feu ne peut le réchauffer… mais le courage, peut-être. (Niveau 10 conseillé)"
        ],
        hint: ["Glacius se tient au nord de la vallée gelée. Utilisez la magie rouge : le froid déteste la chaleur."],
        complete: [
            "Glacius est tombé, et le dernier fragment est à toi. La Couronne est presque complète.",
            "Reste Zar'khul, celui qui l'a brisée. Il t'attend dans les Abysses Interdites, à l'ouest d'ici. Que la chance te suive."
        ],
        reward: { gold: 300, fragment: 'Fragment de Glace' }
    },
    {
        id: 'void_lord',
        title: 'Le Seigneur du Vide',
        chapter: 'Chapitre VI — Les Abysses Interdites',
        autoStart: true, turnIn: null, requires: ['frost_dragon'], final: true,
        objectives: [{ type: 'kill', target: 'void_lord', text: "Vaincre Zar'khul, Seigneur du Vide (Abysses Interdites, à l'ouest des Terres Gelées)" }],
        offer: ["Dernière mission : franchissez la brèche à l'ouest des Terres Gelées et affrontez Zar'khul dans les Abysses. (Niveau 13 conseillé)"],
        hint: [],
        complete: STORY_ENDING,
        reward: { gold: 500, fragment: 'Couronne des Cinq Sceaux' }
    }
];

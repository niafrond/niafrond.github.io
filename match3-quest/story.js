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
    "Il y a mille ans, les Cinq Sceaux furent forgés dans l'or des étoiles et réunis en une Couronne. Tant qu'elle brillait, Valdoria ne connut ni famine, ni guerre, ni ténèbres.",
    "Puis vint la Nuit de la Brisure, il y a vingt ans. La Couronne éclata en cinq fragments qui s'éparpillèrent aux quatre coins du royaume, et le Vide, cette faille noire au fond des Abysses, se mit à respirer. On accuse Zar'khul, le Seigneur du Vide, d'en être l'auteur.",
    "Depuis, chaque fragment est aux mains d'un tyran : Grukk, le Roi Gobelin ; Gorm-Kar, le Chef de Guerre orc ; Solarion, le Gardien du Soleil ; Glacius, le Dragon de Glace… et Zar'khul lui-même, tapi dans les Abysses. Certains murmurent qu'ils n'ont pas toujours été ainsi.",
    "À Brumechêne, dernier village encore debout, l'Ancienne Maëlle cherche quelqu'un d'assez brave pour recoudre le royaume. Allez lui parler."
];

export const STORY_ENDING = [
    "Zar'khul s'effondre en poussière noire et le Vide se referme dans un long soupir. Les cinq fragments s'assemblent dans votre main : la Couronne est de nouveau entière.",
    "Là où gisait le Seigneur du Vide, un homme fatigué se relève : le roi Valdorin, enfin libéré. « Merci… Dites à ma sœur que j'ai tenu ma promesse, et que je rentre à la maison. »",
    "Le soleil se lève sur Valdoria comme il ne l'avait pas fait depuis vingt ans. Les gobelins retrouvent leurs sources, les orcs leurs vallées, les dunes leur douceur. À Brumechêne, Maëlle allume un grand feu sur la place.",
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
              idle: [
                  "Que la lumière vous guide, voyageur. Revenez me voir quand vous aurez du nouveau.",
                  "Brumechêne a connu des jours meilleurs, mais tant qu'il reste un feu allumé sur la place, il reste de l'espoir."
              ],
              talk: [
                  { whenDone: 'sage_rescue', lines: [
                      "Aldric est vivant ! Le vieil entêté… Il vous a raconté des histoires sur le passé, n'est-ce pas ? Il parle trop, celui-là.",
                      "Peu importe. La horde de Gorm-Kar ne se dispersera pas toute seule : à l'est, le Camp de Guerre vous attend."
                  ] },
                  { whenDone: 'gorm_kar', lines: [
                      "Un blason royal sur l'armure d'un orc ? Ce n'est rien, un souvenir d'une vieille alliance. Ne vous attardez pas là-dessus.",
                      "Continuez vers le désert : les nomades savent où repose le quatrième fragment."
                  ] },
                  { whenDone: 'sun_relic', lines: [
                      "Quatre fragments ! Mon cœur bat comme celui d'une jeune fille. Allez voir Ylva, au nord : c'est la plus sage d'entre nous, elle vous dira le reste."
                  ] },
                  { whenDone: 'frost_dragon', lines: [
                      "Ylva vous a tout dit, alors. Oui… Zar'khul est mon frère. Il s'appelait Valdorin, et il était roi. Je n'ai pas eu le courage de vous l'avouer plus tôt.",
                      "Ramenez-le, je vous en prie. Ramenez-le-moi."
                  ] },
                  { whenDone: 'void_lord', lines: [
                      "Il est arrivé ce matin, à la porte du village : mon petit frère Valdorin, vieilli de vingt ans mais souriant. Vous avez rendu un roi à Valdoria, et un frère à une vieille femme.",
                      "Ma maison est la vôtre. Pour toujours."
                  ] }
              ] },
            { id: 'bran', x: 10, y: 5, name: 'Bran', title: 'Forgeron', emoji: '🧔',
              idle: [
                  "Les monstres se font plus nombreux chaque semaine. Vous les voyez de loin : un cercle rouge marque leur zone de vigilance. Contournez-les si vous ne vous sentez pas prêt !",
                  "Et n'oubliez pas de passer à la boutique et de vérifier vos sorts avant de partir."
              ],
              talk: [
                  { whenDone: 'bran_hammer', lines: [
                      "Marteau-d'Aïeul est de retour sur son établi, et moi de bonne humeur ! Vous savez que mon grand-père a forgé la première armure de la garde royale avec lui ?"
                  ] },
                  { whenDone: 'goblin_king', lines: [
                      "Vous avez réglé son compte au roi gobelin ? Les gobelins sont moins insolents depuis. Il paraît que leur tribu vivait près d'une source sacrée, avant que la forêt ne flétrisse.",
                      "Mon père forgeait les épées des gardes royaux. Il disait toujours que le blason à cinq pointes ne devait jamais être terni."
                  ] },
                  { whenDone: 'gorm_kar', lines: [
                      "Le blason de Valdoria sur l'armure d'un orc ? Mon père parlait d'un pacte entre le roi et les clans orcs, autrefois. Je me demande ce qu'il en est advenu."
                  ] },
                  { whenDone: 'frost_dragon', lines: [
                      "Vous avez les cinq fragments, alors ? Je forge mieux qu'un roi, mais je ne peux pas réparer ça. Revenez entier, c'est tout ce que je demande."
                  ] },
                  { whenDone: 'void_lord', lines: [
                      "La Couronne est entière ! Je vais forger une enseigne à cinq pointes pour la porte de la forge. Vous mangerez ici tant que vous le voudrez, héros."
                  ] }
              ] },
            { id: 'odile', x: 3, y: 5, name: 'Odile', title: 'Bergère', emoji: '👩‍🌾',
              idle: ["Mes brebis bêlent moins fort quand elles sentent qu'un héros passe. Bonne route, voyageur !"],
              talk: [
                  { whenDone: 'boar_hunt', lines: [
                      "Mes brebis paissent en paix depuis la fin de Vieux Groin. Elles vous saluent, à leur façon. Bêêê !"
                  ] }
              ] }
        ],
        enemies: [],
        chests: []
    },

    forest: {
        id: 'forest', region: 'forest', name: 'Forêt Sylvestre', biome: 'forest',
        w: 14, h: 10, spawn: { x: 1, y: 4 },
        arrival: [
            "La Forêt Sylvestre bruisse d'un silence inquiet. Les arbres, si verts autrefois, semblent avoir la fièvre depuis la Brisure. Au nord, un antre gobelin ; à l'est, des ruines oubliées."
        ],
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
            { id: 'forest_priestess', templateId: 'moon_priestess', emoji: '🌙', name: 'Prêtresse Lunaire', kind: 'patrol', x: 3, y: 9, patrol: [[3, 9], [12, 9]], offset: 0 },
            // Bête nommée (quête secondaire « Vieux Groin »), tapie dans le coin nord-est.
            { id: 'old_tusk', templateId: 'forest_guardian', emoji: '🐗', name: 'Vieux Groin, sanglier géant', kind: 'sentinel', x: 12, y: 0, offset: 0, permanent: true }
        ],
        chests: []
    },

    goblin_den: {
        id: 'goblin_den', region: 'forest', name: 'Antre du Roi Gobelin', biome: 'den',
        w: 14, h: 10, spawn: { x: 6, y: 8 },
        arrival: [
            "Une odeur de suie et de peur. Sur les murs, des dessins d'enfants gobelins : une source, des arbres, un grand soleil. Le roi Grukk n'a pas toujours été un monstre."
        ],
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
            { id: 'den_chest', x: 12, y: 5, gold: 40 },
            // Marteau de Bran (quête secondaire) : côté est, loin de Grukk, accessible sans combattre.
            { id: 'bran_hammer', x: 13, y: 4, gold: 15, label: "Marteau d'Aïeul" }
        ]
    },

    ruins: {
        id: 'ruins', region: 'ruins', name: 'Ruines Antiques', biome: 'ruins',
        w: 14, h: 10, spawn: { x: 1, y: 7 },
        arrival: [
            "Les Ruines Antiques dorment sous la mousse. Sur une fresque à demi effacée, cinq gardiens s'agenouillent devant un roi qui brise lui-même une couronne. Étrange scène pour une trahison…"
        ],
        obstacles: [[3, 2, 1, 1], [3, 6, 1, 1], [10, 2, 1, 1], [10, 7, 1, 1], [5, 0, 1, 1], [8, 8, 1, 2], [12, 5, 2, 1], [1, 2, 1, 2]],
        liquids: [],
        paths: [[0, 7, 6, 1], [6, 0, 2, 10], [6, 4, 8, 1]],
        exits: [
            { x: 0, y: 7, to: 'forest', arrive: { x: 12, y: 7 }, label: 'Forêt Sylvestre' },
            { x: 13, y: 4, to: 'warcamp', arrive: { x: 1, y: 4 }, label: 'Camp de Guerre' }
        ],
        npcs: [
            { id: 'aldric', x: 7, y: 4, name: 'Aldric', title: 'Sage encerclé', emoji: '🧙‍♂️',
              idle: ["Merci, brave héros. Sans vous, ces morts-vivants m'auraient emporté."],
              talk: [
                  { whenDone: 'gorm_kar', lines: [
                      "Gorm-Kar est tombé ? Je le croyais avide de pouvoir… Peut-être ne cherchait-il qu'à sauver les siens. La peur fait commettre bien des erreurs, même aux orcs."
                  ] },
                  { whenDone: 'frost_dragon', lines: [
                      "Ylva a donc parlé. Bien. Je me suis tu pendant vingt ans par peur de perdre Valdorin une seconde fois. Vous, vous n'avez pas peur. Allez le délivrer, et rendez-lui son nom.",
                      "J'ai été son conseiller, et son maître. Je serais fier qu'il soit ce que vous avez fait de lui : un roi qu'on sauve."
                  ] },
                  { whenDone: 'void_lord', lines: [
                      "Le rituel est achevé… Après vingt ans, j'ai enfin le droit de refermer mes livres. Je resterai ici à recopier les fresques : Valdoria aura besoin de nouveaux sages."
                  ] }
              ] },
            { id: 'nessa', x: 1, y: 5, name: 'Nessa', title: 'Archiviste du temple', emoji: '📚',
              idle: ["Chut… parlez bas ! Les parchemins ont la mémoire longue, et les squelettes l'oreille fine."],
              talk: [
                  { whenDone: 'nessa_nest', lines: [
                      "Mes parchemins sont en sécurité, et je peux enfin les relire sans trembler. Le jour où j'aurai tout déchiffré, vous serez le premier à savoir."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'aldric_guard_n', templateId: 'bone_reaver', emoji: '🦴', name: 'Faucheur d\'os', kind: 'sentinel', x: 7, y: 3, offset: 0, permanent: true, group: 'aldric_guards' },
            { id: 'aldric_guard_s', templateId: 'crypt_lich', emoji: '☠️', name: 'Liche des cryptes', kind: 'sentinel', x: 7, y: 5, offset: 0, permanent: true, group: 'aldric_guards' },
            { id: 'aldric_guard_w', templateId: 'bone_reaver', emoji: '🦴', name: 'Faucheur d\'os', kind: 'sentinel', x: 6, y: 4, offset: 0, permanent: true, group: 'aldric_guards' },
            { id: 'aldric_guard_e', templateId: 'temple_warden', emoji: '🛡️', name: 'Gardien du temple', kind: 'sentinel', x: 8, y: 4, offset: 0, permanent: true, group: 'aldric_guards' },
            // Nid de la crypte basse (quête secondaire « Les parchemins de Nessa »), le long du bord sud-ouest.
            { id: 'nest_reaver_a', templateId: 'bone_reaver', emoji: '🦴', name: 'Faucheur d\'os de la crypte', kind: 'sentinel', x: 0, y: 9, offset: 0, permanent: true, group: 'crypt_nest' },
            { id: 'nest_reaver_b', templateId: 'bone_reaver', emoji: '🦴', name: 'Faucheur d\'os de la crypte', kind: 'sentinel', x: 4, y: 9, offset: 0, permanent: true, group: 'crypt_nest' },
            { id: 'nest_lich', templateId: 'crypt_lich', emoji: '☠️', name: 'Liche de la crypte basse', kind: 'sentinel', x: 2, y: 9, offset: 0, permanent: true, group: 'crypt_nest' },
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
        arrival: [
            "Le Camp de Guerre résonne de cris et de coups de forge. Partout flotte un étendard noir orné d'une couronne à cinq pointes, barrée d'une déchirure. Ces orcs ne se battent pas par plaisir : leurs regards sont hantés."
        ],
        obstacles: [[3, 1, 2, 2], [3, 7, 2, 2], [6, 6, 2, 1], [9, 0, 2, 2], [12, 2, 1, 2], [9, 7, 2, 2], [6, 1, 1, 2]],
        liquids: [],
        paths: [[0, 4, 14, 1], [12, 4, 1, 4]],
        exits: [
            { x: 0, y: 4, to: 'ruins', arrive: { x: 12, y: 4 }, label: 'Ruines Antiques' },
            { x: 13, y: 8, to: 'desert', arrive: { x: 1, y: 5 }, label: 'Désert Ardent' }
        ],
        npcs: [
            { id: 'brakka', x: 1, y: 7, name: 'Brakka', title: 'Orque du clan des Cendres', emoji: '🧝‍♀️',
              idle: ["Chut ! Ici, même les tentes ont des oreilles. Les miens vous devront une fière chandelle."],
              talk: [
                  { whenDone: 'brakka_jailer', lines: [
                      "Mes frères respirent l'air libre, grâce à vous. Le clan des Cendres n'oubliera jamais.",
                      "Gorm-Kar n'était pas un monstre : il avait peur de perdre les siens. C'est la peur qui l'a rendu cruel. Gardez votre courage, mais gardez aussi votre pitié."
                  ] }
              ] }
        ],
        enemies: [
            // Geôlier nommé (quête secondaire « Les chaînes de Brakka »), le long du bord sud-ouest.
            { id: 'warden_vrok', templateId: 'war_troll', emoji: '⛓️', name: 'Vrok, le Geôlier', kind: 'sentinel', x: 0, y: 9, offset: 1, permanent: true },
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
        arrival: [
            "Le Désert Ardent brûle sous un ciel blanc. Le soleil est trop grand, trop proche, comme s'il refusait de se coucher. Quelque part, un paladin monte la garde depuis vingt ans."
        ],
        obstacles: [[3, 1, 2, 2], [4, 7, 2, 2], [8, 6, 1, 2], [12, 6, 1, 2], [9, 0, 1, 1], [2, 8, 1, 1]],
        liquids: [],
        paths: [[0, 5, 8, 1], [7, 0, 1, 6]],
        exits: [
            { x: 0, y: 5, to: 'warcamp', arrive: { x: 12, y: 8 }, label: 'Camp de Guerre' },
            { x: 7, y: 0, to: 'frozen', arrive: { x: 7, y: 8 }, label: 'Terres Gelées' }
        ],
        npcs: [
            { id: 'tariq', x: 2, y: 6, name: 'Tariq', title: 'Nomade des dunes', emoji: '🧕',
              idle: ["Le désert ne pardonne pas. Buvez, et regardez où vous mettez les pieds."],
              talk: [
                  { whenDone: 'sun_relic', lines: [
                      "Solarion est enfin délivré de sa veille. Je prie pour lui chaque soir, il était le plus loyal des gardiens. Le désert vous devra toujours cette amulette."
                  ] },
                  { whenDone: 'void_lord', lines: [
                      "Le ciel du désert n'a jamais été aussi clair. Je crois entendre chanter les dunes. Buvez de l'eau, héros : vous l'avez bien gagnée."
                  ] }
              ] },
            { id: 'hakim', x: 10, y: 7, name: 'Hakim', title: 'Chamelier', emoji: '🐪',
              idle: ["Que le sable vous soit léger ! Mes chameaux et moi, on n'a pas peur du soleil, seulement des scorpions."],
              talk: [
                  { whenDone: 'skorr_hunt', lines: [
                      "La piste des caravanes est de nouveau sûre ! Mes chameaux se remettent à marcher droit. Que votre route soit longue et fortunée !"
                  ] }
              ] }
        ],
        enemies: [
            // Scorpion nommé (quête secondaire « Le défi des dunes »), dans le coin nord-ouest.
            { id: 'sand_skorr', templateId: 'sand_colossus', emoji: '🦂', name: 'Skorr, Roi des sables', kind: 'sentinel', x: 1, y: 1, offset: 1, permanent: true },
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
        arrival: [
            "Les Terres Gelées s'étendent, muettes. Votre souffle se change en cristaux devant vos lèvres. Au loin, une forme immense repose, enroulée sur quelque chose qui luit faiblement."
        ],
        obstacles: [[2, 1, 2, 2], [10, 1, 2, 2], [2, 6, 2, 2], [10, 6, 2, 2], [5, 5, 1, 1], [8, 5, 1, 1], [0, 4, 2, 1]],
        liquids: [[4, 8, 2, 1], [9, 8, 2, 1]],
        paths: [[7, 0, 1, 10]],
        exits: [
            { x: 7, y: 9, to: 'desert', arrive: { x: 7, y: 1 }, label: 'Désert Ardent' },
            { x: 0, y: 3, to: 'abyss', arrive: { x: 12, y: 3 }, label: 'Abysses Interdites' }
        ],
        npcs: [
            { id: 'ylva', x: 3, y: 4, name: 'Ylva', title: 'Ermite du givre', emoji: '🧙‍♀️',
              idle: ["Le froid garde les secrets. Que la chaleur de votre courage ne s'éteigne jamais."],
              talk: [
                  { whenDone: 'frost_dragon', lines: [
                      "Glacius repose enfin. Il m'a parlé dans mes rêves cette nuit : « J'ai tenu la promesse faite au roi. » Va, héros, la brèche est à l'ouest."
                  ] },
                  { whenDone: 'void_lord', lines: [
                      "Le givre fond, doucement. Étrange : je regrette déjà un peu le silence. Mais je crois que je préfère le printemps."
                  ] }
              ] }
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
        arrival: [
            "Les Abysses Interdites. Ici, le sol n'est plus tout à fait du sol : il respire. Les cinq fragments vibrent à votre ceinture, et une voix très ancienne, très lasse, chuchote votre nom : « Enfin… »"
        ],
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

// Quêtes, dans l'ordre : d'abord l'histoire principale, puis les quêtes secondaires (`side: true`).
// Statut : locked → available → active → ready → done.
//  - giver      : PNJ qui propose la quête (absent + autoStart:true = démarre toute seule)
//  - turnIn     : PNJ auquel on rend compte (absent = validée automatiquement)
//  - requires   : quêtes à terminer avant
//  - objectives : kill (ennemi), killGroup (groupe d'ennemis), chest (ouvrir un coffre)
//  - side       : quête secondaire (optionnelle) : jamais requise par une quête principale
// Les PNJ peuvent aussi avoir `talk: [{ whenDone: id | [ids], lines }]` : répliques d'ambiance
// selon l'avancement (id = quête terminée, ennemi vaincu ou coffre ouvert ; la dernière
// condition remplie l'emporte, sinon `idle`). Un écran peut avoir `arrival: [lignes]`
// (texte du Narrateur à la première visite).
export const QUESTS = [
    {
        id: 'goblin_king',
        title: 'Le Roi Gobelin',
        chapter: 'Chapitre I — Les gobelins de Brumechêne',
        giver: 'maelle', turnIn: 'maelle', requires: [],
        objectives: [{ type: 'kill', target: 'goblin_king', text: 'Vaincre Grukk, Roi Gobelin (Antre du Roi Gobelin, au nord de la forêt)' }],
        offer: [
            "Approchez, voyageur, n'ayez pas peur. Je suis Maëlle, et j'ai veillé sur Brumechêne pendant quarante hivers. Je crois que vous êtes celui que j'attendais.",
            "Depuis la Brisure, les gobelins de la forêt pillent nos greniers. Leur roi, Grukk, s'est terré dans un antre au nord de la Forêt Sylvestre : il détient le premier fragment de la Couronne.",
            "Ses gardes veillent à l'entrée. Ne vous jetez pas sur eux : les monstres se voient de loin, et un cercle rouge marque leur zone de vigilance.",
            "Vainquez-le, et Brumechêne vous devra la vie."
        ],
        hint: [
            "L'antre de Grukk est au nord de la forêt. Les gobelins sont rusés : ne les sous-estimez pas.",
            "Prenez le temps de vous entraîner dans la forêt, si vous vous sentez trop faible. Les monstres reviennent toujours."
        ],
        complete: [
            "Vous l'avez fait ! Voici le premier fragment de la Couronne, et une bourse pour vos peines. Comme il brille…",
            "On dit que Grukk était un bon chef, avant. Sa tribu vivait en paix près de la source sacrée ; quand la forêt a flétri, ses gobelins ont eu faim, et la faim rend cruel. Ne le plaignez pas trop, mais souvenez-vous-en.",
            "Aldric, mon vieux maître, est parti chercher des réponses dans les Ruines Antiques, à l'est de la forêt. Trois semaines sans nouvelles… Allez le voir, je vous en prie."
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
            "Aldric fut mon maître, et celui de bien d'autres. Autrefois conseiller de la cour, il connaît la Couronne mieux que personne. Il cherchait dans les ruines du temple le secret de la Brisure.",
            "Les Ruines Antiques sont à l'est de la forêt. S'il est encore en vie, il est sûrement en danger : ces lieux grouillent de revenants.",
            "Retrouvez-le, et revenez me dire ce qu'il sait."
        ],
        hint: [
            "Les Ruines Antiques sont à l'est de la Forêt Sylvestre. Cherchez un sage cerné par des morts-vivants.",
            "Ils sont quatre, et ils bloquent tous les accès. Il faudra les vaincre un par un."
        ],
        complete: [
            "Merci, héros ! Je croyais ma dernière heure venue. Ces revenants gardaient le deuxième fragment, que voici.",
            "Je dois vous avouer une chose : je n'étais pas qu'un simple érudit. J'étais le conseiller du roi Valdorin, le dernier souverain de Valdoria, la nuit où la Couronne s'est brisée. Ce que j'ai vu ce soir-là ne ressemblait pas à une trahison.",
            "Je n'ai pas encore toutes les réponses. Mais je sais que le Chef de Guerre Gorm-Kar rassemble une horde au Camp de Guerre, plus à l'est, et qu'il cherche lui aussi les fragments. Arrêtez-le avant qu'il ne les réunisse !",
            "Et… ne dites pas à Maëlle que je vous ai parlé du roi. Pas encore. Elle a ses raisons."
        ],
        reward: { gold: 120, fragment: 'Fragment de Pierre' }
    },
    {
        id: 'warmaster',
        title: 'Le Chef de Guerre',
        chapter: 'Chapitre III — Le Camp de Guerre',
        autoStart: true, turnIn: null, requires: ['sage_rescue'],
        objectives: [{ type: 'kill', target: 'gorm_kar', text: 'Vaincre Gorm-Kar, Chef de Guerre (Camp de Guerre, à l\'est des ruines)' }],
        offer: [
            "Nouvelle mission : renverser Gorm-Kar dans le Camp de Guerre, à l'est des Ruines Antiques. (Niveau 4 conseillé)",
            "Sa horde est nombreuse : évitez les cercles rouges et avancez avec prudence."
        ],
        hint: [],
        complete: [
            "Gorm-Kar s'écroule dans un rugissement. Sa horde se disperse et vous récupérez le troisième fragment de la Couronne dans les cendres de son trône.",
            "Avant de s'éteindre, l'orc murmure : « Mon clan… le Vide l'a avalé en une nuit. Je voulais seulement réunir les fragments pour refermer la brèche… Le roi disait que c'était impossible. »",
            "Il n'achève pas sa phrase. Sur son armure, gravé à la hâte, vous reconnaissez un blason : une couronne à cinq pointes. Celui de Valdoria."
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
            "Je suis Tariq, et mon peuple traverse ces dunes depuis avant les rois. Nous gardions l'amulette sacrée, le quatrième fragment, jusqu'à ce que le paladin Solarion la prenne sous sa garde.",
            "Ce n'était pas un voleur : le roi lui-même lui avait confié le Sceau du Soleil pour le protéger de Gorm-Kar. Mais à force de fixer le ciel pendant sa veille, le soleil lui a brûlé l'esprit. Il a enfermé l'amulette dans un coffre au nord-est de l'oasis, et il attaque quiconque approche.",
            "Le vaincre demande de la force… ou de la discrétion. Son regard ne porte pas à plus d'une tuile : un voleur habile pourrait atteindre le coffre sans croiser sa lame. (Niveau 7 conseillé)"
        ],
        hint: [
            "Le coffre est près de Solarion, au nord-est. Combattez-le ou contournez-le avec prudence.",
            "Marchez à deux tuiles de lui, pas moins : son regard ne porte pas plus loin qu'une tuile."
        ],
        complete: [
            "L'Amulette du Soleil brille dans vos mains ! Le quatrième fragment est à vous, et les miens vous en sont reconnaissants. Solarion lui-même serait soulagé de la savoir libre.",
            "Au nord, dans les Terres Gelées, l'ermite Ylva parle d'un dragon qui garde le dernier fragment. Elle sait des choses sur la Brisure que personne d'autre n'ose dire. Allez la voir."
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
            "Je t'attendais, porteur de fragments. Le froid garde les secrets, et je garde le froid depuis vingt ans.",
            "Glacius, le dragon de givre, dort sur le cinquième fragment, au fond de ces terres. Il n'est pas cruel : il a peur. Quand la Couronne s'est brisée, il s'est couché sur son fragment pour le refroidir, afin qu'aucune main ne puisse s'en emparer.",
            "Aucune magie de feu ne peut le réchauffer… mais le courage, peut-être. Il attaquera pour protéger son trésor. (Niveau 10 conseillé)"
        ],
        hint: [
            "Glacius se tient au nord de la vallée gelée. Utilisez la magie rouge : le froid déteste la chaleur.",
            "Ses sbires rôdent dans la vallée. Regardez bien les cercles rouges avant de vous engager."
        ],
        complete: [
            "Glacius est tombé… et le dernier fragment est à toi. Écoute-moi bien, car c'est ici que le mensonge s'arrête.",
            "La nuit de la Brisure, le Vide s'est ouvert au fond des Abysses et menaçait de tout engloutir. Le roi Valdorin a compris que la Couronne entière serait dévorée d'un coup. Alors il l'a brisée lui-même, de ses mains, et a confié chaque fragment à un gardien fidèle : Grukk, Gorm-Kar, Solarion et Glacius.",
            "Puis il est descendu dans les Abysses et il a pris le Vide en lui pour le retenir. Voilà ce qu'est Zar'khul : un roi qui se consume pour empêcher la fin du monde. Maëlle est sa sœur ; Aldric et moi étions du conseil. Nous avons gardé le silence.",
            "Réunir la Couronne est le seul moyen de le délivrer. Mais il ne te reconnaîtra pas : le Vide combattra à travers lui. Va, à l'ouest, et rends-lui son nom."
        ],
        reward: { gold: 300, fragment: 'Fragment de Glace' }
    },
    {
        id: 'void_lord',
        title: 'Le Seigneur du Vide',
        chapter: 'Chapitre VI — Les Abysses Interdites',
        autoStart: true, turnIn: null, requires: ['frost_dragon'], final: true,
        objectives: [{ type: 'kill', target: 'void_lord', text: "Vaincre Zar'khul, Seigneur du Vide (Abysses Interdites, à l'ouest des Terres Gelées)" }],
        offer: [
            "Dernière mission : franchissez la brèche à l'ouest des Terres Gelées et affrontez Zar'khul dans les Abysses. (Niveau 13 conseillé)",
            "Les cinq fragments vibrent doucement à votre ceinture, comme s'ils reconnaissaient une voix familière, là-bas, dans l'obscurité."
        ],
        hint: [],
        complete: STORY_ENDING,
        reward: { gold: 500, fragment: 'Couronne des Cinq Sceaux' }
    },
    // ── Quêtes secondaires (facultatives, or seulement) ─────────────────────
    {
        id: 'bran_hammer', side: true,
        title: "Le marteau de Bran",
        chapter: '✦ Quête secondaire — Brumechêne',
        giver: 'bran', turnIn: 'bran', requires: [],
        objectives: [{ type: 'chest', target: 'bran_hammer', text: "Retrouver Marteau-d'Aïeul dans le coffre de l'Antre gobelin (côté est, loin de Grukk)" }],
        offer: [
            "Justement, un truc me ronge. Les gobelins m'ont volé Marteau-d'Aïeul, le marteau de mon grand-père, celui qui a forgé la première armure de la garde royale.",
            "Ils l'ont sûrement caché dans un coffre de leur antre, à l'est, loin du trône de Grukk. Inutile de vous battre : glissez-vous entre les gardes, c'est un coffre que je veux, pas une guerre."
        ],
        hint: ["Le coffre est dans l'Antre du Roi Gobelin, contre le mur est. Passez à deux tuiles des gardes, pas moins."],
        complete: [
            "Marteau-d'Aïeul ! Aussi lourd qu'avant, aussi bien équilibré. Vous m'avez rendu bien plus qu'un outil.",
            "Prenez ces pièces, elles sont bien gagnées. Et quand tout ça sera fini, je vous forgerai quelque chose de digne d'un héros."
        ],
        reward: { gold: 40, fragment: "Marteau d'Aïeul (souvenir)" }
    },
    {
        id: 'boar_hunt', side: true,
        title: 'Vieux Groin',
        chapter: '✦ Quête secondaire — Forêt Sylvestre',
        giver: 'odile', turnIn: 'odile', requires: [],
        objectives: [{ type: 'kill', target: 'old_tusk', text: 'Chasser Vieux Groin, le sanglier géant (coin nord-est de la Forêt Sylvestre)' }],
        offer: [
            "Ah, voyageur ! Vous tombez bien. Un sanglier énorme, Vieux Groin, saccage mon pâturage et mes brebis n'osent plus sortir.",
            "Il s'est terré dans un coin de la Forêt Sylvestre, tout au nord-est, derrière les arbres serrés. Je ne demande pas grand-chose : qu'il cesse de détruire mes clôtures. Je vous paierai de mes économies."
        ],
        hint: ["Vieux Groin est tout au nord-est de la Forêt Sylvestre, derrière les arbres. Il charge dès qu'on l'approche !"],
        complete: [
            "Vieux Groin ne reviendra plus ? Mes brebis vont enfin brouter en paix !",
            "Tenez, la bourse de mes économies, et cette pelote de laine porte-bonheur. Elle a survécu à trois hivers, elle vous protégera aussi."
        ],
        reward: { gold: 50, fragment: 'Pelote porte-bonheur' }
    },
    {
        id: 'nessa_nest', side: true,
        title: 'Les parchemins de Nessa',
        chapter: '✦ Quête secondaire — Ruines Antiques',
        giver: 'nessa', turnIn: 'nessa', requires: ['goblin_king'],
        objectives: [{ type: 'killGroup', target: 'crypt_nest', text: 'Chasser les 3 gardiens de la crypte basse (bord sud-ouest des Ruines Antiques)' }],
        offer: [
            "Chut… parlez bas ! Je suis Nessa, archiviste du temple. Depuis la Brisure, des squelettes ont investi la crypte basse, dans le coin sud-ouest des ruines. Ils gardent mes parchemins.",
            "Je ne suis pas courageuse, mais ces parchemins racontent la vraie histoire de la Couronne. Deux faucheurs d'os et une liche : rien d'impossible pour un héros comme vous."
        ],
        hint: ["La crypte basse est le long du bord sud des ruines, côté ouest. Ils sont trois : deux faucheurs d'os et une liche."],
        complete: [
            "Mes parchemins ! Intacts, ou presque… Merci mille fois.",
            "Regardez ce que j'ai déjà déchiffré : la Couronne n'a pas été brisée par un ennemi, mais de l'intérieur, d'une main royale. Je ne comprends pas encore pourquoi. Prenez ces pièces, c'est peu, mais c'est tout ce que j'ai."
        ],
        reward: { gold: 70, fragment: 'Parchemin de la Brisure' }
    },
    {
        id: 'brakka_jailer', side: true,
        title: 'Les chaînes de Brakka',
        chapter: '✦ Quête secondaire — Camp de Guerre',
        giver: 'brakka', turnIn: 'brakka', requires: ['sage_rescue'],
        objectives: [{ type: 'kill', target: 'warden_vrok', text: 'Vaincre Vrok, le Geôlier (coin sud-ouest du Camp de Guerre)' }],
        offer: [
            "Psst ! Ne me regardez pas, ils me chercheraient. Je suis Brakka, du clan des Cendres. Gorm-Kar nous a enrôlés de force quand le Vide a dévoré notre vallée : il croyait sauver ce qui restait de notre clan.",
            "Vrok, le geôlier, garde encore mes frères enchaînés dans le coin sud-ouest du camp. Lui n'a aucune excuse : il aime ça. Battez-le, et je pourrai libérer les miens."
        ],
        hint: ["Vrok garde les prisonniers dans le coin sud-ouest du camp. C'est un troll : frappez-le fort !"],
        complete: [
            "Les chaînes tombent ! Mes frères sont libres. Que la terre vous soit douce, héros.",
            "Prenez cette bourse : c'est la solde que Gorm-Kar ne m'a jamais versée."
        ],
        reward: { gold: 90, fragment: 'Cor du clan des Cendres' }
    },
    {
        id: 'skorr_hunt', side: true,
        title: 'Le défi des dunes',
        chapter: '✦ Quête secondaire — Désert Ardent',
        giver: 'hakim', turnIn: 'hakim', requires: ['warmaster'],
        objectives: [{ type: 'kill', target: 'sand_skorr', text: 'Défier Skorr, Roi des sables (coin nord-ouest du Désert Ardent)' }],
        offer: [
            "Que le sable vous soit léger, étranger ! Je suis Hakim, chamelier. Skorr, un scorpion des sables grand comme une maison, s'est installé dans le coin nord-ouest du désert, sur la piste des caravanes.",
            "Trois de mes chameaux y ont déjà disparu. Les nomades disent qu'il faut un champion pour le défier, comme dans les arènes d'antan. Vous avez l'air d'en être un !"
        ],
        hint: ["Skorr rôde dans le coin nord-ouest du désert, près de la piste. Attention : c'est un adversaire de taille !"],
        complete: [
            "Skorr est vaincu ! La piste des caravanes est de nouveau sûre, et mes chameaux vont pouvoir marcher droit.",
            "Voici de quoi vous payer un festin, et cette selle brodée : elle porte chance à ceux qui traversent les dunes."
        ],
        reward: { gold: 110, fragment: "Selle brodée d'Hakim" }
    }
];

// La Nuit des âmes errantes : données de l'événement (couche B). Aucune logique ici, voir ./index.js.
//
// Inspirations : Zhongyuan Jie (fête des fantômes : lanternes, offrandes, rites d'apaisement), Zhong Kui (pourfendeur de démons, ici
// protecteur du sanctuaire), talismans de scellement (symboles fictifs), jugement des défunts. Pas de citrouilles, de sorcières ni de
// châteaux gothiques. Tous les esprits ne sont pas hostiles : le fantôme affamé s'apaise par la parole, sans combat.

export const ID = 'wanderingSouls';
export const REALM_ID = 'wandering_souls_realm';
export const BIOME = 'wandering_souls';

// Le royaume est accessible depuis la zone sauvage de n'importe quelle région (une entrée par biome, sans condition) ; le talisman et la
// gardienne des rites, qui lancent la chaîne de quêtes, se trouvent dans la région des Bambous.
export const HOST = { region: 'bambous', wild: 'bambous_wild', village: 'bambous_village', level: 17 };

export const REALM = {
    name: 'Le Royaume des âmes errantes',
    entrance: 'Sanctuaire des âmes errantes',
    exitLabel: 'Quitter le royaume',
    closedMessage: 'Les sceaux ont été restaurés et le vieux sanctuaire est refermé. Les âmes y reposent en paix : laissez-les dormir.',
    // Annonce affichée une seule fois, à la première arrivée dans le royaume (data.eventNotices).
    notice: {
        id: 'wanderingSouls',
        title: 'La Nuit des âmes errantes',
        lines: [
            'Ce royaume est un clin d\'œil à la saison : en France, Halloween (31 octobre) puis la Toussaint (1er novembre) sont les jours où l\'on pense aux disparus et où l\'on fête, un peu en frissonnant, les fantômes.',
            'Le jeu y répond à sa façon, avec le folklore chinois : lanternes, offrandes, talismans, Zhong Kui et la fête des fantômes. Rien n\'est obligatoire : c\'est un bonus, sans limite de temps, et rien n\'est perdu si vous passez votre chemin.'
        ]
    },
    arrival: [
        'La porte cède sans un bruit. De l\'autre côté, la brume monte des dalles et des lanternes rouges flottent sans fil, comme si quelqu\'un les tenait de très loin.',
        'Ici, la frontière entre les vivants et les morts est fine comme du papier de riz. Marchez doucement : tous les esprits ne sont pas vos ennemis.'
    ]
};

// 22 × 13. « < » : sortie ouest ; « = » : dalles décoratives ; chiffres et « j » : ancres des entités.
export const GRID = [
    '######################',
    '#.........p.......q..#',
    '#.##..4..#....#.##.3.#',
    '#.#..r...#....n......#',
    '#...j..##....##......#',
    '#..................7.#',
    '<..1...==.....==.....#',
    '#..........2.....#...#',
    '#.##..#.......##....k#',
    '#.#...5.....6......o.#',
    '#...8.....##...9...0.#',
    '#..m.................#',
    '######################'
];

export const QUEST_IDS = { talisman: 'sq_ws_talisman', lanternes: 'sq_ws_lanternes', sceaux: 'sq_ws_sceaux' };

// Talisman de passage : posé dans la zone sauvage, il ouvre le sanctuaire (la sortie exige que ce coffre ait été ouvert).
export const TALISMAN = {
    chest: { id: 'ws_talisman_porte', label: 'Talisman de papier', openText: 'Sous une pierre plate, un talisman de papier jauni, couvert de signes qu\'aucun livre ne connaît. Il est tiède, comme s\'il venait d\'être écrit.' },
    item: { id: 'qi_ws_talisman', name: 'Talisman du sanctuaire', description: 'Un talisman de papier qui protège celui qui le porte parmi les esprits du royaume des âmes errantes.', earlyDescription: 'Un papier jauni couvert de signes inconnus.' }
};

export const GIVER = {
    id: 'ws_gardienne_rites', name: 'Dame Ruyi', title: 'Gardienne des rites oubliés',
    idle: [
        'Chaque année, à la même nuit, je dépose un bol de riz devant la porte. Chaque année, il est vide au matin. Je ne pose pas de questions.',
        'On dit que les morts ont faim. Moi, je dis qu\'ils ont surtout envie qu\'on pense à eux.'
    ],
    talkDone: ['« Le sanctuaire est plus calme depuis votre passage. Les lanternes me le disent : elles brûlent droit, ce soir. »']
};

export const ZHONG_KUI = {
    id: 'ws_zhong_kui', name: 'Zhong Kui', title: 'Pourfendeur de démons',
    idle: [
        'Je ne suis pas ici pour punir les morts. Je suis ici pour que les vivants ne soient pas punis à leur place.',
        'Ces lanternes sont éteintes depuis trop longtemps. Un esprit sans lumière ne sait plus où aller.'
    ],
    talkDone: ['« Les sceaux tiennent. Allez, archer : l\'aube vous attend, et moi, je garde la porte. »']
};

export const HUNGRY_GHOST = {
    id: 'ws_fantome_affame', name: 'Fantôme affamé', title: 'Âme perdue',
    idle: ['Faim… Pas de pain. Pas de riz. Juste… l\'odeur du riz.'],
    talkDone: ['« Merci… J\'ai senti l\'offrande. Je peux partir, maintenant. »'],
    // Parler suffit à l'apaiser : réplique jouée à l'objectif « talk » de la quête des lanternes.
    appeaseLines: [
        'Vous vous asseyez à sa hauteur et vous l\'écoutez, sans arme à la main. Le fantôme parle longtemps, de riz, de sa maison, de la dernière nuit.',
        '« Ma famille n\'a plus jamais allumé de lanterne pour moi… Alors j\'ai tourné, tourné. Merci de vous être arrêté. »',
        'Sa silhouette s\'éclaircit, et une lueur verte monte vers le plafond de brume.'
    ]
};

// Objets de l'au-delà (objets de quête, inventaire existant). Leur effet vient des conditions d'avancement du moteur :
//  - Lanterne de l'au-delà (1re lanterne) : révèle l'âme guide et l'offrande cachées (`showWhen`) ;
//  - Sceau des esprits : retire un niveau au Gardien du jugement (`weakenedBy`) ;
//  - Cloche d'exorcisme : dissipe pour de bon le faux passage de la renarde (`hideWhen`).
export const LANTERN_ITEM = { id: 'qi_ws_lanterne', name: 'Lanterne de l\'au-delà', description: 'Une lanterne de papier à la flamme verte. Elle révèle les esprits et les offrandes que la brume cachait.', earlyDescription: 'Une lanterne de papier encore froide.' };
export const SEAL = {
    chest: { id: 'ws_sceau_esprits', at: 'n', label: 'Sceau des esprits', openText: 'Un fragment de sceau brisé, gravé de signes fictifs que la brume n\'a pas effacés. Dans votre paume, il se recolle de lui-même.' },
    item: { id: 'qi_ws_sceau', name: 'Sceau des esprits', description: 'Un sceau de pierre reconstitué. Il fait trembler le Gardien du jugement : son niveau baisse d\'un cran.', earlyDescription: 'Un fragment de pierre gravé.' }
};
export const BELL = {
    chest: { id: 'ws_cloche_exorcisme', at: 'm', label: 'Cloche d\'exorcisme', openText: 'Une clochette ancienne, couverte de vert-de-gris. Son tintement efface les décors de papier de la renarde.' },
    item: { id: 'qi_ws_cloche', name: 'Cloche d\'exorcisme', description: 'Une clochette qui dissipe les illusions : les faux passages de la huli jing ne résistent pas à son tintement.', earlyDescription: 'Une clochette ternie.' }
};
// Cachés tant que la Lanterne de l'au-delà n'a pas été allumée (ws_lanterne_1).
export const REVEALED_BY = 'ws_lanterne_1';
export const GUIDE = {
    id: 'ws_ame_guide', at: 'p', name: 'Âme du passage', title: 'Esprit guide', showWhen: REVEALED_BY,
    idle: [
        'Vous me voyez ? Enfin quelqu\'un qui porte une lumière… Je garde ce couloir depuis si longtemps.',
        'Un fragment de sceau dort au nord-est, près de la salle des archives. Une cloche, elle, rouille au sud-ouest : la renarde la déteste.',
        'Derrière le gardien repose le registre des noms. Soyez poli avec lui : il a beaucoup de choses à peser.'
    ]
};
export const OFFERING = { id: 'ws_offrande', at: 'o', label: 'Offrande abandonnée', showWhen: REVEALED_BY, openText: 'Un bol de riz froid, des pièces de papier doré et de vraies pièces posées là par des mains oubliées. Vous les prenez avec respect.' };

export const LANTERNS = [
    { id: 'ws_lanterne_1', at: '2', label: 'Lanterne de l\'entrée', item: LANTERN_ITEM, openText: 'Vous touchez la mèche. Une flamme verte, froide et claire, prend d\'elle-même. Elle ne chauffe pas, mais elle éclaire : autour de vous, des silhouettes apparaissent dans la brume. Au nord-est, une seconde mèche s\'allume.' },
    { id: 'ws_lanterne_2', at: '3', showWhen: 'ws_lanterne_1', label: 'Lanterne du pavillon', openText: 'La lanterne du pavillon s\'allume en grésillant. Sur le sol, des traces de pas lumineuses apparaissent, puis s\'effacent. Elles mènent vers le nord-ouest, où une dernière mèche vous attend.' },
    { id: 'ws_lanterne_3', at: '4', showWhen: 'ws_lanterne_2', label: 'Lanterne des archives', openText: 'Le papier rouge de la lanterne se tend, éclairé de l\'intérieur. Un nom, très ancien, y flotte un instant avant de disparaître.' }
];

export const JADE = {
    chest: { id: 'ws_jade_ames', at: '0', label: 'Jade des âmes', openText: 'Dans une niche scellée derrière le gardien, un jade sombre, gravé d\'un registre de noms. Il pèse peu, mais il paraît contenir beaucoup de monde.' },
    item: { id: 'qi_ws_jade', name: 'Jade des âmes', description: 'Un jade sombre où dorment les noms des âmes errantes. Il protège celui qui le porte des malédictions du sanctuaire.', earlyDescription: 'Un jade sombre, lourd de noms.' }
};

// Ennemis : [id, ancre, modèle, nom, comportement, décalage de niveau, patrouille, boss, champs supplémentaires].
// Les deux Jiangshi forment le groupe qui protège le Gardien : il reste intouchable tant qu'ils ne sont pas vaincus,
// sauf si le rite des lanternes (quête sq_ws_lanternes) est accompli (`unsealedBy`) : on peut le vaincre par les armes ou par les rites.
export const SHIELD_GROUP = 'ws_gardes_du_sceau';
export const ENEMIES = [
    ['ws_jiangshi_patrouille', '5', 'jiangshi', 'Jiangshi du sanctuaire', 'patrol', 0, ['5', '6'], false, { group: SHIELD_GROUP }],
    ['ws_jiangshi_garde', '7', 'jiangshi', 'Jiangshi endormi', 'sentinel', 0, null, false, { group: SHIELD_GROUP, spriteKey: 'ws_jiangshi_patrouille' }],
    ['ws_huli_jing', '8', 'huli_jing', 'Renarde des faux chemins', 'sentinel', 0, null],
    // Mirage de la renarde : se dissipe au contact et réapparaît ailleurs (illusion), jamais de combat.
    ['ws_faux_passage', 'k', 'huli_jing', 'Faux passage', 'sentinel', 0, null, false, {
        illusion: true, spriteKey: 'ws_huli_jing', hideWhen: BELL.chest.id,
        illusionLines: ['Le couloir s\'efface comme un rideau de fumée. Quelque part, une renarde rit sans bruit.', 'Un passage de papier : la huli jing aime les décors.']
    }],
    ['ws_gardien_jugement', '9', 'gui_esprit', 'Gardien du jugement', 'sentinel', 1, null, true, {
        shieldedBy: SHIELD_GROUP, unsealedBy: [QUEST_IDS.lanternes],
        weakenedBy: [SEAL.chest.id, HUNGRY_GHOST.id],   // le Sceau des esprits et l'âme apaisée retirent chacun un niveau au Gardien
        shieldLines: [
            'Une barrière de sceaux scintille devant le Gardien : vos flèches s\'y éteignent.',
            'Il faut soit défaire ceux qui l\'entourent, soit rallumer les lanternes pour que les sceaux se taisent.'
        ]
    }]
];

export const QUESTS = {
    talisman: {
        id: QUEST_IDS.talisman, title: 'Le talisman de protection',
        offer: [
            'Voyageur, savez-vous que des portes s\'entrouvrent un peu partout cette nuit-là ? Elles mènent au royaume des âmes errantes, là où les sceaux ont craqué : n\'importe quel sentier sauvage peut vous y conduire.',
            'Je ne peux plus marcher jusque là-bas. Trouvez le talisman que j\'ai caché sous une pierre plate, dans la zone sauvage des Bambous, au sud-est : sans lui, Zhong Kui, le gardien du royaume, ne vous confiera rien.'
        ],
        hint: ['Le talisman est caché sous une pierre plate, dans la zone sauvage des Bambous. Une fois en poche, entrez dans le royaume par n\'importe quel sentier sauvage.'],
        complete: ['Le papier est tiède, c\'est bon signe. Les esprits vous laisseront parler.', 'Dans le royaume, cherchez Zhong Kui : lui seul sait comment rallumer les lanternes.'],
        objective: 'Rapporter le talisman caché sous une pierre plate (zone sauvage des Bambous, au sud-est)',
        fragment: 'Talisman du sanctuaire'
    },
    lanternes: {
        id: QUEST_IDS.lanternes, title: 'Les lanternes des âmes',
        offer: [
            'Vous êtes entré, donc vous êtes ou très courageux, ou très perdu. Dans les deux cas, j\'ai du travail pour vous.',
            'Trois lanternes éclairaient jadis ce lieu. Rallumez-les, et les âmes retrouveront leur chemin. Et si vous croisez un fantôme affamé, ne le frappez pas : écoutez-le.'
        ],
        hint: ['Trois lanternes éteintes sont dispersées dans le royaume ; elles s\'allument dans l\'ordre, chacune révélant la suivante. Le fantôme affamé erre près de l\'entrée ; il suffit de lui parler.'],
        complete: ['Les trois flammes brûlent, et l\'âme perdue est partie en paix. Vous avez le sens des rites.', 'Reste le gardien du jugement, au fond de la salle. Les sceaux n\'ont pas fini de craquer.'],
        objectives: {
            lantern: n => `Rallumer la lanterne n°${n} du royaume des âmes errantes`,
            ghost: 'Apaiser le fantôme affamé en lui parlant (royaume des âmes errantes)'
        },
        fragment: 'Rites des lanternes',
        reward: { gold: 170, xp: 160 }
    },
    sceaux: {
        id: QUEST_IDS.sceaux, title: 'Le gardien du jugement',
        offer: [
            'Au fond de la salle veille le Gardien du jugement, celui qui pèse les noms du registre. Les sceaux brisés l\'ont rendu soupçonneux : il prend les vivants pour des fugitifs.',
            'Affrontez-le, archer, puis rapportez le jade des âmes caché derrière lui. Je le remettrai à sa place, et le passage se refermera de lui-même.'
        ],
        hint: ['Le Gardien du jugement se tient au fond du royaume. Le jade des âmes repose dans une niche derrière lui.'],
        complete: ['Le registre est de nouveau en ordre et la porte peut se refermer. Gardez le jade : il vous protégera des malédictions des vivants, aussi.', 'On dira dans les villages que la nuit des âmes errantes a été douce, cette année. Ce sera à votre mérite.'],
        objectives: {
            boss: 'Affronter le Gardien du jugement (royaume des âmes errantes)',
            jade: 'Rapporter le jade des âmes caché derrière le gardien'
        },
        fragment: 'Jade des âmes',
        reward: { gold: 200, xp: 240 }
    }
};

// Énigme des miroirs rituels (moteur d'énigmes existant, mode « mirror » : puzzle/modes.js) : le rayon descend de la source (v), il faut
// basculer les trois miroirs (/ et \) pour qu'il atteigne la cible (T). Pas de famille d'armure (`set`) : l'énigme ouvre seulement un coffre.
// Déclarée dans PUZZLES par le module d'événement (donc absente quand l'événement est désactivé).
export const PUZZLE = {
    id: 'ws_miroirs',
    def: {
        title: 'Les miroirs rituels du royaume',
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
    chest: { id: 'ws_cache_miroir', at: 'q', label: 'Cache des miroirs', openText: 'Le dernier miroir s\'aligne, et le rayon clair éclaire une niche : un éclat de miroir spirituel, froid comme une eau profonde.' },
    item: { id: 'qi_ws_miroir', name: 'Fragment de miroir spirituel', description: 'Un éclat de miroir où l\'on voit, un instant, la version de la salle que les vivants oublient.', earlyDescription: 'Un éclat de verre très clair.' }
};

// Énigme des urnes (mode « push » : puis des jarres sur les dalles marquées). Même principe que les miroirs : elle verrouille un coffre
// et n'appartient à aucune famille d'armure antique.
export const PUZZLE_BLOCKS = {
    id: 'ws_urnes',
    def: {
        title: 'Les urnes du pavillon des archives',
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
    chest: { id: 'ws_cache_urnes', at: 'r', label: 'Cache des archives', openText: 'Les deux urnes reposent sur leurs dalles, et une trappe s\'ouvre dans le mur : la clé d\'un sanctuaire, enveloppée de papier de riz.' },
    item: { id: 'qi_ws_cle', name: 'Clé d\'un sanctuaire', description: 'Une petite clé de bronze, usée par les mains qui l\'ont tenue. Elle n\'ouvre plus rien ici, mais on la garde.', earlyDescription: 'Une clé de bronze.' }
};
// Toutes les énigmes de l'événement, déclarées dans PUZZLES par le module d'événement.
export const PUZZLE_LIST = [PUZZLE, PUZZLE_BLOCKS];

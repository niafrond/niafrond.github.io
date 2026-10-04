// Histoire et cartes d'exploration de Match3-Quest : « La Légende de Hou Yi ».
//
// Fantasy chinoise : l'archer Hou Yi doit abattre neuf des dix soleils (UNIVERS.md est la source de
// vérité pour les identifiants). Données pures (aucun accès DOM) : la logique est dans exploration.js,
// le rendu dans explorationView.js. Chaque écran est une carte de 14 x 10 tuiles, une région = un écran
// (id d'écran = id de région) ; on n'en affiche qu'un à la fois, les sorties (`exits`) mènent à l'écran
// voisin : sortie à l'ouest (x = 0) vers la région précédente, sortie à l'est (x = 13) vers la suivante.
// Chaque écran a un coin « village » à l'ouest (PNJ, quêtes) et un « sanctuaire » à l'est (le Soleil-Boss).
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
//  - offset          : écart de niveau par rapport au joueur (-1, 0 ou +1) pour les ennemis normaux ;
//  - spriteKey       : clé de sprite si différente de l'id (les mirages réutilisent `sun_4`) ;
//  - illusion:true   : mirage, pas de combat : il se dissipe au contact (`illusionLines`) ;
//  - shieldedBy      : id d'un `group` d'ennemis ; tant qu'il n'est pas vaincu, le boss est intouchable
//                      (le contact affiche `shieldLines`) ;
//  - defeatScene     : { speaker: { name, title?, npc? | enemy? }, lines } jouée après la victoire ;
//  - afterScenes     : [{ speaker, lines }] interlude à plusieurs voix (speaker.hero : le héros) après le texte de victoire ;
//  - duel            : règles de duel de Fengmeng (mirror, heroHpPct, rapidShots, zoneTraps : voir duel.js) ;
//  - showWhen / hideWhen : (aussi sur PNJ et coffres) l'entité n'existe qu'après / jusqu'à ce que la
//                      condition d'avancement (id de quête, d'ennemi vaincu ou de coffre) soit remplie.
// Sorties : `requires` (+ `lockedMessage`) les ferme tant que la condition d'avancement n'est pas remplie.

import { assembleWorld } from './world/index.js';
import { buildArenaScreens } from './arena.js';

export const STORY_TITLE = 'La Légende de Hou Yi';

export const STORY_INTRO = [
    "Au commencement, les dix soleils, fils de Di Jun, dormaient dans les branches de l'Arbre Fusang et se levaient chacun à leur tour, un par jour, dans un char traîné par un corbeau d'or.",
    "Mais un matin, les dix frères s'élancèrent ensemble, par jeu. Les fleuves tarirent, les rizières jaunirent, les forêts prirent feu, et les bêtes sauvages, rendues folles par la chaleur, descendirent sur les villages.",
    "L'empereur Yao supplia Di Jun de rappeler ses fils. Les soleils rirent, et le ciel resta en feu. Alors Yao se souvint de Hou Yi, l'archer dont les flèches n'ont jamais manqué leur but.",
    "Vous êtes Hou Yi. Vous avez pour épouse Chang'e, qui pétrit des gâteaux de lune dès l'aube et que vous aimez plus que tout ce que le ciel éclaire, et pour disciple Fengmeng, qui vous admire autant qu'il vous jalouse. Sur l'autel des ancêtres repose l'Élixir d'Immortalité, offert par la Reine Mère de l'Occident.",
    "Si vous reprenez l'arc, c'est pour elle : pour lui rendre des nuits, la fête de la lune, le temps de vieillir ensemble. À l'aube, elle a brisé en deux son miroir de bronze, rond comme la lune d'automne, et vous en a glissé une moitié dans la manche : « Quand la lune reviendra, regarde-la dans ce bronze. J'y regarderai aussi. »",
    "Le doyen Wen vous attend dans les Rizières Desséchées avec le décret de l'empereur : abattre neuf soleils, et en épargner un seul, afin que la Terre garde un jour. Allez lui parler."
];

export const STORY_ENDING = [
    "Le dernier jour a été long. Hou Yi ramasse la corbeille de gâteaux de lune et s'avance seul vers l'autel du pic : au haricot rouge, au taro, au thé vert, ceux que Chang'e pétrissait pour lui chaque aube, avant qu'il ne parte.",
    "Sur l'autel, la pierre est blanche et fraîche. Il dispose les gâteaux sur l'autel, un à un, comme elle le faisait, puis il s'assoit. Au-dessus de lui, la pleine lune est si grande qu'on croirait pouvoir la toucher du bout de l'arc.",
    "Un seul soleil traverse désormais le ciel, et la Terre a de nouveau des jours et des nuits. Les rizières reverdissent, le fleuve gonfle, les villages allument des lanternes pour la fête d'automne. Hou Yi n'entend plus que le vent.",
    "Hou Yi lève vers le ciel sa moitié de miroir et l'ajuste contre la lune : le bronze en couvre une moitié, la lumière achève l'autre. Le cercle est entier. Sur le disque, une silhouette passe, une main levée, très lentement. Hou Yi lève la sienne. Chaque année, à la pleine lune d'automne, les hommes poseront des gâteaux de lune sur leurs toits, et cette nuit-là, quelqu'un, là-haut, leur sourira.",
    "Ainsi s'achève la légende de Hou Yi. Mais une légende se raconte toujours une fois de plus : une Nouvelle Partie + vous attend, où les soleils se lèveront plus ardents."
];

// Le miroir brisé : au départ, Chang'e a brisé en deux son miroir de bronze et en a confié une moitié à Hou Yi.
// Chaque soleil abattu rend un peu de nuit au ciel ; tant que la lune est haute, les deux moitiés reflètent la même
// lune et les époux s'y parlent. Interludes joués après le texte de victoire de chaque soleil (`afterScenes`) ;
// après le neuvième, le bronze reste froid : Chang'e a déjà fui vers le Pic de la Lune.
const HOU_YI = { name: 'Hou Yi', title: 'La moitié de miroir', hero: true };
const CHANGE_MIRROR = { name: "Chang'e", title: 'Dans la moitié de miroir', npc: 'change' };
const MOONLIGHT = { name: 'Narrateur', title: 'Clair de lune' };

const MIRROR_TALKS = {
    sun_1: [
        { speaker: MOONLIGHT, lines: [
            "Le soir tombe, un vrai soir, le premier depuis trois lunes. Hou Yi veille sur le tertre du temple, où la cendre fume encore. Une lune mince se lève au-dessus des rizières, et dans sa manche, la moitié de miroir devient tiède.",
            "Il la sort. Dans le bronze, il y a la lune ; et sous la lune, un visage poudré de farine, qui le regarde à travers la même lumière."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Hou Yi ? Je tenais ma moitié à la fenêtre pour y voir la lune, et c'est toi que je vois. Tu as de la cendre plein le front. Pourquoi ne rentres-tu pas ? La maison est à deux cents pas."
        ] },
        { speaker: HOU_YI, lines: [
            "Si je passe notre porte ce soir, je n'aurai plus le courage de repartir. Le fleuve m'attend à l'aube. Mais je t'entends, Chang'e. Je t'entends vraiment."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Les anciens disent qu'un miroir est une petite lune. Il faut croire que la grande se souvient de nous. Tu as mangé les gâteaux du muret, au moins ?"
        ] },
        { speaker: HOU_YI, lines: [
            "Pas encore. Je voulais d'abord te rendre ta première nuit. Il y en aura d'autres, je te le promets : des nuits entières, et la fête de la lune au bord du fleuve, comme avant."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "La lune redescend déjà. Mange, mon archer. À la prochaine lune."
        ] },
        { speaker: HOU_YI, lines: [
            "À la prochaine lune."
        ] }
    ],
    sun_2: [
        { speaker: MOONLIGHT, lines: [
            "Cette nuit-là, la lune reste un peu plus longtemps. Assis dans la barque du passeur, qui flotte de nouveau, Hou Yi écoute l'eau revenir. Le bronze tiédit dans sa paume."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Ici, on n'entend que les grillons. Raconte-moi le fleuve."
        ] },
        { speaker: HOU_YI, lines: [
            "Il revient comme quelqu'un qui rentre tard : sans bruit, en essayant de ne réveiller personne. Je suis près du gué. Tu sais lequel."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Le gué des saules. J'y avais lâché une lanterne pour la fête de la lune, elle s'était prise dans les roseaux. Un grand nigaud a tiré une flèche pour la libérer, et il a failli mettre le feu à la rive."
        ] },
        { speaker: HOU_YI, lines: [
            "Je n'ai pas failli : la lanterne est repartie. C'est la seule flèche que j'aie jamais tirée sans cible."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Sans cible ? Tu m'as regardée tout le temps que tu bandais l'arc. J'ai bien vu."
        ] },
        { speaker: HOU_YI, lines: [
            "Alors elle a touché. À la prochaine fête, nous y retournerons. Je porterai la lanterne, et je laisserai mes flèches au carquois."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "À la prochaine lune, mon grand nigaud."
        ] }
    ],
    sun_3: [
        { speaker: MOONLIGHT, lines: [
            "Dans la forêt calcinée, la nuit sent la cendre mouillée. Hou Yi s'est adossé à un bambou noir ; ses doigts saignent encore de la corde. Il sort le miroir sans même ouvrir les yeux."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Tu as la voix de quelqu'un qui n'a pas dormi depuis trois soleils. Ouvre les yeux, que je les voie… Rouges comme des braises. Mon pauvre archer."
        ] },
        { speaker: HOU_YI, lines: [
            "Ce n'est que la fumée. Parle-moi d'autre chose que du feu. N'importe quoi."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Du premier gâteau de lune que je t'ai fait, alors. Il était noir comme cette forêt. Tu l'as mangé jusqu'à la dernière miette, et tu as dit : « Parfait. »"
        ] },
        { speaker: HOU_YI, lines: [
            "C'est le seul mensonge que je t'aie jamais fait. Je le referais demain."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Je sais. C'est pour cela que je t'ai épousé : un homme qui ment si mal, et seulement pour moi. Dors, maintenant. Je garde la lune à ta place."
        ] },
        { speaker: HOU_YI, lines: [
            "Ne la lâche pas."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Jamais. À la prochaine lune."
        ] }
    ],
    sun_4: [
        { speaker: MOONLIGHT, lines: [
            "Le désert, la nuit, est plus froid qu'on ne le croit. Les mirages se sont dissipés, mais Hou Yi tient le miroir à deux mains, comme s'il craignait qu'il s'efface lui aussi."
        ] },
        { speaker: HOU_YI, lines: [
            "Chang'e, dis-moi quelque chose que toi seule pourrais dire."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Tu as encore laissé tes bottes devant l'autel des ancêtres, et les ancêtres en rougissent. Pourquoi cette voix ? Qu'as-tu vu, là-bas ?"
        ] },
        { speaker: HOU_YI, lines: [
            "Toi. Dix fois. Au bord d'une source qui n'existait pas. Toutes me souriaient ; aucune ne m'a grondé de ne pas manger. C'est comme cela que j'ai su qu'aucune n'était toi."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Je finirai par te gronder exprès, pour que tu me reconnaisses partout. La maison est trop grande sans toi, tu sais. Je mets deux bols sur la table ; le tien refroidit, je le bois quand même."
        ] },
        { speaker: HOU_YI, lines: [
            "Garde-moi le bol. Je rentrerai le boire chaud. C'est pour cela que je tire : pour une table où les bols n'ont plus le temps de refroidir."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Alors vise juste. À la prochaine lune."
        ] }
    ],
    sun_5: [
        { speaker: MOONLIGHT, lines: [
            "Une pluie fine tombe sur les Monts du Tonnerre, la première depuis l'été des dix soleils. La lune passe entre deux nuages, et la voix de Chang'e arrive mouillée de rire."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Il pleut chez toi aussi ? Ici, les voisins dansent dans la boue. Il pleuvait le jour de nos noces, tu te souviens ? Ma mère criait au mauvais présage."
        ] },
        { speaker: HOU_YI, lines: [
            "Et tu as soulevé ton voile toute seule pour regarder la pluie. Le village en a parlé pendant un an. Moi, je n'ai rien vu d'autre que toi, trempée, qui riais."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Ce soir-là, tu m'as dit : « Ni le ciel ni la terre ne nous sépareront. » J'y repense en regardant la fiole sur l'autel. Une gorgée pour vivre longtemps, la fiole entière pour monter au ciel…"
        ] },
        { speaker: HOU_YI, lines: [
            "Nous l'avons décidé ensemble : jamais l'un sans l'autre. Nous la partagerons, vieux et ridés, une gorgée chacun. Le ciel, je n'en veux pas, s'il faut y monter seul."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Moi non plus. Je voulais seulement te l'entendre dire encore. À la prochaine lune, mon époux."
        ] }
    ],
    sun_6: [
        { speaker: MOONLIGHT, lines: [
            "La roche refroidit en craquant comme du verre. Les nuits sont plus longues, désormais : la lune a le temps de monter haut. Mais quand Hou Yi sort le miroir, Chang'e y est déjà, comme si elle attendait depuis des heures."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Fengmeng est venu à la maison. Il avait la cendre des gorges sur ses bottes. Il n'a pas voulu de thé. Il a regardé l'autel, longtemps. Puis il m'a regardée, moi."
        ] },
        { speaker: HOU_YI, lines: [
            "Je l'ai battu au défilé. Il m'a dit qu'il allait voir les miens, et je n'ai pas compris. Je rentre, Chang'e. Demain, à l'aube."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Non. Il reste trois soleils, et des enfants qui n'ont jamais vu une nuit entière. Si tu rentres pour moi, ils te le pardonneront. Toi, jamais."
        ] },
        { speaker: HOU_YI, lines: [
            "C'est pour toi que je fais tout cela. Pour toi d'abord. Que me restera-t-il, si ce monde revit et que tu n'y es plus ?"
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Je suis là. J'ai mis la barre à la porte, et la fiole contre ma poitrine. Fengmeng n'aura rien de nous."
        ] },
        { speaker: HOU_YI, lines: [
            "Garde ta moitié de miroir sur toi, toujours. Et s'il revient, cours."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Alors je courrai vers la lune : c'est là que tu me cherches. À la prochaine lune."
        ] }
    ],
    sun_7: [
        { speaker: MOONLIGHT, lines: [
            "Sur la plaine, les bêtes survivantes dorment enfin, serrées les unes contre les autres. Hou Yi, lui, ne dort pas. La lune est presque ronde ; dans le bronze, Chang'e a les yeux cernés."
        ] },
        { speaker: HOU_YI, lines: [
            "Tu n'as pas dormi."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "J'écoute la digue. Chaque pas me fait sursauter, et ce n'est jamais que le vent dans les roseaux. Même les fauves ont peur, la nuit, dit-on. Moi aussi."
        ] },
        { speaker: HOU_YI, lines: [
            "Moi aussi, j'ai peur. Pas des soleils : de rentrer et de trouver la maison vide. Avant toi, je n'avais peur de rien."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Alors écoute. Je vais te chanter celle que je fredonne en pétrissant. « Dors, petit, la nuit te tient la main, et demain t'attend sur le chemin. »"
        ] },
        { speaker: HOU_YI, lines: [
            "Je ne suis pas petit."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Ce soir, si. Et demain t'attend, mon archer : demain, et tous les autres, jusqu'à ce que nous soyons vieux. À la prochaine lune."
        ] }
    ],
    sun_8: [
        { speaker: MOONLIGHT, lines: [
            "La mer est revenue, et avec elle le bruit des vagues. Pour la première fois, la nuit est presque entière, et la lune presque pleine. Hou Yi s'assoit sur le sable mouillé, le miroir sur les genoux."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Plus qu'un. Dans dix jours, c'est la fête de la lune. J'ai déjà le taro, et les jaunes d'œuf salé que tu fais semblant de ne pas aimer."
        ] },
        { speaker: HOU_YI, lines: [
            "Je serai là. Nous irons au gué des saules lâcher une lanterne, et je te dirai tout ce que je n'ai pas eu le temps de te dire."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Dis-le maintenant. On ne sait jamais combien de temps la lune reste haute."
        ] },
        { speaker: HOU_YI, lines: [
            "Je t'aime, Chang'e. Les soleils, l'empereur, la légende, peu m'importe. J'ai fait tout cela pour vieillir avec toi, dans un monde où il y a des nuits."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Je le sais depuis le gué. Écoute-moi, maintenant : quoi qu'il arrive, regarde la lune, chaque nuit. Même si le miroir se tait. Promets-le-moi."
        ] },
        { speaker: HOU_YI, lines: [
            "Il ne se taira pas. Mais je te le promets."
        ] },
        { speaker: MOONLIGHT, lines: [
            "La lune descend vers la mer. Le bronze tiédit encore un instant, puis refroidit. Bien plus tard, Hou Yi s'aperçoit qu'elle n'a pas dit « à la prochaine lune »."
        ] }
    ],
    sun_9: [
        { speaker: MOONLIGHT, lines: [
            "Avant que la grue ne se pose, Hou Yi tire le miroir de sa manche, comme chaque fois qu'un soleil tombe. Il fait grand jour, un vrai jour, sous un seul soleil ; la lune n'est qu'une écaille pâle au-dessus du Fusang."
        ] },
        { speaker: HOU_YI, lines: [
            "Chang'e. Neuf. C'est fini, je rentre. Chang'e ?"
        ] },
        { speaker: MOONLIGHT, lines: [
            "Le bronze est froid. Pas tiède, comme lorsqu'elle tient sa moitié contre elle : froid comme une pierre de rivière. Il n'y reflète que le ciel."
        ] },
        { speaker: HOU_YI, lines: [
            "À la prochaine lune… Réponds-moi."
        ] }
    ]
};

const FENGMENG_SPEAKER = id => ({ name: 'Fengmeng', title: 'Disciple de Hou Yi', enemy: id });

const BASE_SCREENS = {
    // ── 1. Rizières Desséchées : maison de Hou Yi, tutoriel, duel d'entraînement de Fengmeng ──────────
    rizieres: {
        id: 'rizieres', region: 'rizieres', name: 'Rizières Desséchées', biome: 'paddy',
        w: 14, h: 10, spawn: { x: 3, y: 4 },
        obstacles: [[1, 1, 3, 2], [6, 0, 2, 3], [6, 6, 2, 4], [9, 0, 1, 2], [12, 0, 2, 1], [4, 6, 2, 1]],
        liquids: [[0, 8, 3, 2]],
        paths: [[0, 4, 14, 1], [2, 3, 1, 1]],
        exits: [
            {
                x: 13, y: 4, to: 'fleuve', arrive: { x: 1, y: 4 }, label: 'Lit du Fleuve Jaune',
                requires: 'sun_1',
                lockedMessage: "Le Soleil Ardent embrase encore la route de l'est : abattez-le avant de poursuivre."
            }
        ],
        npcs: [
            { id: 'change', x: 2, y: 3, name: "Chang'e", title: 'Épouse de Hou Yi', emoji: '👩', hideWhen: 'sun_9',
              idle: [
                  "Te voilà, mon archer ! Les gâteaux de lune sont encore tièdes : prends-en pour la route. Haricot rouge pour le courage, taro pour la patience.",
                  "Le doyen Wen t'attend près de la digue, avec le décret de l'empereur. Écoute-le avec le cœur : Yao ne demande jamais pour rien."
              ],
              talk: [
                  { whenDone: 'fengmeng_1', lines: [
                      "Fengmeng est rentré sans me dire un mot, la lèvre fendue, les yeux brûlants. Sois bon avec lui, Hou Yi. Il n'a que toi au monde, et cela lui fait mal.",
                      "Et toi, montre tes doigts. La corde t'a encore entaillé. Donne : un peu de baume, un nœud de lin, et tu pourras aller décrocher tes soleils."
                  ] },
                  { whenDone: 'sun_1', lines: [
                      "Tu disais que tu n'aurais plus le courage de repartir, si tu passais la porte ? Te voilà pourtant. Prends ce gâteau et file au Lit du Fleuve Jaune : l'eau y manque autant que le courage.",
                      "Je prie la Lune chaque soir pour qu'elle te ramène. Elle écoute, tu sais : la preuve, elle nous prête sa lumière pour nous parler."
                  ] },
                  { whenDone: 'sun_2', lines: [
                      "Tu sens la vase et les saules. Assieds-toi, que je t'ôte ces bottes : on dirait que tu as traversé le fleuve à pied, et pas en barque.",
                      "J'ai mis de côté une lanterne de papier rouge pour la fête. Cette année, au gué, c'est toi qui la lâcheras. Et sans flèche."
                  ] },
                  { whenDone: 'sun_3', lines: [
                      "Tu as les yeux rougis par la fumée. Mange ce gâteau, il est au thé vert, comme tu les aimes. Et ne dis pas « parfait » s'il ne l'est pas.",
                      "Je regarde parfois la fiole d'élixir sur l'autel des ancêtres. Une gorgée pour vivre longtemps, la fiole entière pour monter au ciel. Nous la garderons pour nos vieux jours, et nous la boirons à deux : une gorgée chacun, pas davantage."
                  ] },
                  { whenDone: 'sun_4', lines: [
                      "Penche-toi : tu as du sable jusque dans le chignon. Là… Voilà mon mari, et pas un mirage.",
                      "Ne ris pas : certains soirs, je t'entends rentrer, et ce n'est que le vent qui pousse la porte. Assieds-toi. Ton bol est chaud, pour une fois."
                  ] },
                  { whenDone: 'sun_5', lines: [
                      "Tu sens la pluie. Donne-moi ce poignet… Voilà : un fil rouge. L'autre bout est noué au mien. Les vieilles disent que le fil des époux ne casse jamais ; il s'étire, c'est tout.",
                      "Ne l'enlève pas, même pour tirer. S'il te gêne, c'est que tu penses à moi : tant mieux."
                  ] },
                  { whenDone: 'fengmeng_2', lines: [
                      "Fengmeng est passé ce matin, la poussière de l'Occident et la cendre des gorges sur ses bottes. Il n'a pas voulu de thé. Il a demandé si l'élixir était toujours sur l'autel. J'ai répondu que oui… et il a souri. Je n'aime pas ce sourire.",
                      "Ne fais pas cette tête. Je ne te le dis pas pour que tu rebrousses chemin : finis ce que tu as commencé. J'ai pétri assez de pâte dans ma vie pour avoir des bras."
                  ] },
                  { whenDone: 'sun_6', lines: [
                      "Six soleils… Mon archer, ta main tremble sur ton arc, même quand tu dors. Rentre vite.",
                      "J'ai gardé la fiole contre ma poitrine, cette nuit, comme on garde un enfant. Et ma moitié de miroir sous l'oreiller, pour que la lune me trouve."
                  ] },
                  { whenDone: 'sun_7', lines: [
                      "Montre tes mains. Griffures, brûlures… Tu en rapportes, des cicatrices, pour un monde que tu ne voulais même pas conquérir.",
                      "J'ai cousu un sachet d'osmanthus dans ton col. Les bêtes fuient cette odeur, dit-on. Moi, je l'ai mis pour qu'en la sentant, tu penses à la maison."
                  ] },
                  { whenDone: 'sun_8', lines: [
                      "Huit. Plus qu'un. J'ai déjà sorti les moules de bois qu'on nous a offerts à nos noces : le lièvre, l'osmanthus, et le double bonheur.",
                      "Reste encore un peu. Non, ne dis rien. Laisse-moi te regarder, comme si je devais m'en souvenir longtemps."
                  ] }
              ] },
            { id: 'elder_wen', x: 4, y: 2, name: 'Doyen Wen', title: 'Doyen du village', emoji: '👴',
              idle: [
                  "Le riz ne pousse plus, mais les enfants rient encore : c'est cela qui me tient debout. Prenez soin de vous, Hou Yi.",
                  "Si le courage vous manque, passez chez Dame Chang'e : un gâteau de lune a remis sur pied plus d'un guerrier."
              ],
              talk: [
                  { whenDone: 'sun_1', lines: [
                      "Le ciel est plus clément ; mes vieux os le sentent. Les enfants ont osé sortir jouer dans la boue.",
                      "Poursuivez vers l'est, jusqu'au Lit du Fleuve : on dit que le passeur Gu y attend un miracle."
                  ] },
                  { whenDone: 'sun_9', lines: [
                      "Neuf soleils abattus ! Les chroniques de l'Empire parleront de vous pendant dix mille ans. Mais… la maison de Dame Chang'e est vide, la porte forcée. Les voisins parlent d'une grue blanche, et d'un archer pressé.",
                      "Hou Yi, faites vite."
                  ] },
                  { whenDone: 'q_epilogue', lines: [
                      "On raconte déjà votre histoire au coin du feu, Hou Yi. Les enfants l'ont mise en chanson, et ils en changent la fin à chaque fois.",
                      "Chaque automne, nous poserons des gâteaux de lune sur les toits. Que celle qui les reçoit sache qu'ils viennent de très loin, et de très bon cœur."
                  ] }
              ] },
            { id: 'farmer_lin', x: 1, y: 7, name: 'Lin', title: 'Paysan désespéré', emoji: '🧑‍🌾',
              idle: [
                  "Dix-sept jours que mon champ n'a pas bu une goutte. Regardez-moi cette terre : elle s'ouvre comme une bouche.",
                  "Mes enfants me demandent s'il pleuvra demain. Je leur réponds que oui. Un père a bien le droit de mentir un peu."
              ],
              talk: [
                  { whenDone: 'sq_rice_thief', lines: [
                      "Ma jarre d'eau sacrée a retrouvé sa place sur l'autel de la maison. Le puits est toujours sec, mais on dirait que mon riz a redressé la tête. Merci, seigneur archer."
                  ] },
                  { whenDone: 'sun_1', lines: [
                      "Il pleut ! Pas du ciel : de mes yeux, mais c'est de la pluie quand même. Le riz reprendra, j'en jurerais."
                  ] }
              ] }
        ],
        enemies: [
            // Duel d'entraînement : Fengmeng garde la digue, seul passage vers l'est (corridor de 3 tuiles de large).
            { id: 'fengmeng_1', templateId: 'shadow_assassin', emoji: '🏹', name: 'Fengmeng, le Disciple', kind: 'sentinel', x: 6, y: 4,
              permanent: true, boss: { name: 'Fengmeng, le Disciple', level: 2 },
              defeatScene: {
                  speaker: FENGMENG_SPEAKER('fengmeng_1'),
                  lines: [
                      "…Un coup de chance, Maître. Ce n'est pas la première fois qu'on me bat à l'entraînement, mais c'est la première fois que cela me brûle.",
                      "Je vous suis depuis dix ans. Dix ans à tendre l'arc derrière vous, à ramasser vos flèches. Les gens disent « Hou Yi » et jamais « Fengmeng ». Un jour, ils diront mon nom.",
                      "Allez abattre votre soleil. Je vous suivrai de loin. Après tout, il faut bien que quelqu'un vous couvre."
                  ]
              } },
            { id: 'rizieres_goblin', templateId: 'goblin_saboteur', emoji: '🦊', name: 'Xiao Gui farceur', kind: 'sentinel', x: 5, y: 8, offset: -1 },
            { id: 'rizieres_shroom', templateId: 'fungal_horror', emoji: '🍄', name: 'Lingzhi maudit', kind: 'sentinel', x: 9, y: 7, offset: 0 },
            { id: 'rizieres_guardian', templateId: 'forest_guardian', emoji: '🌳', name: 'Esprit des digues', kind: 'patrol', x: 8, y: 9, patrol: [[8, 9], [12, 9]], offset: 0 },
            // Chapardeur nommé (quête secondaire), côté est de la digue.
            { id: 'rice_thief', templateId: 'goblin_saboteur', emoji: '🦊', name: 'Xiao Gui, le chapardeur', kind: 'sentinel', x: 12, y: 6, offset: 1, permanent: true },
            { id: 'sun_1', templateId: 'goblin_saboteur', emoji: '☀️', name: 'Soleil Ardent', kind: 'sentinel', x: 11, y: 2,
              permanent: true, boss: { name: 'Soleil Ardent', level: 3 },
              afterScenes: MIRROR_TALKS.sun_1 }
        ],
        chests: [
            { id: 'lotus_cache', x: 3, y: 9, gold: 25, label: 'Jarre de graines de lotus' }
        ]
    },

    // ── 2. Lit du Fleuve Jaune ───────────────────────────────────────────────
    fleuve: {
        id: 'fleuve', region: 'fleuve', name: 'Lit du Fleuve Jaune', biome: 'riverbed',
        w: 14, h: 10, spawn: { x: 1, y: 4 },
        arrival: [
            "Le Fleuve Jaune n'est plus qu'un lit de boue craquelée où gisent des barques échouées et des poissons de pierre. Au bord, un vieux passeur regarde un horizon sans eau.",
            "Quelque part à l'est, dans le sanctuaire des rochers fendus, le deuxième soleil a bu le fleuve jusqu'à la dernière goutte."
        ],
        obstacles: [[3, 1, 2, 2], [2, 7, 3, 1], [6, 0, 1, 3], [6, 7, 1, 3], [9, 3, 1, 1], [9, 6, 1, 1]],
        liquids: [[1, 8, 2, 2]],
        paths: [[0, 4, 6, 1], [5, 4, 1, 2], [5, 5, 9, 1]],
        exits: [
            { x: 0, y: 4, to: 'rizieres', arrive: { x: 12, y: 4 }, label: 'Rizières Desséchées' },
            {
                x: 13, y: 5, to: 'bambous', arrive: { x: 1, y: 5 }, label: 'Forêt de Bambous Calcinée',
                requires: 'sun_2',
                lockedMessage: "Le Soleil des Eaux Taries garde le lit du fleuve : la route de l'est reste brûlante."
            }
        ],
        npcs: [
            { id: 'ferryman_gu', x: 3, y: 6, name: 'Gu', title: 'Passeur du fleuve', emoji: '🧔',
              idle: [
                  "Trente ans que je passe les gens d'une rive à l'autre. Maintenant il n'y a plus de rive, juste de la boue, et ma vieille barque qui rêve d'eau.",
                  "Un jeune archer pressé est passé hier, à pied, en pestant contre la poussière. Il m'a demandé le chemin le plus court vers l'Occident. Je lui ai montré la piste des caravanes."
              ],
              talk: [
                  { whenDone: 'sq_river_serpent', lines: [
                      "Plus de serpent au gué ! Les voyageurs vont pouvoir passer en chantant. Et s'ils n'ont pas de pièces, je les passerai contre des gâteaux de lune : c'est la monnaie de ce temps."
                  ] },
                  { whenDone: 'sun_2', lines: [
                      "L'eau ! Elle revient ! Je l'ai entendue avant de la voir, comme une vieille chanson. Ma barque flotte…",
                      "Prenez la rive est, seigneur archer : je vous y passerai gratuitement, pour toujours."
                  ] }
              ] },
            { id: 'weaver_mei', x: 2, y: 2, name: 'Mei', title: 'Tisserande', emoji: '👵',
              idle: [
                  "Je tisse ce que le soleil n'a pas brûlé : un fil à la fois. Le tissu raconte ce que les mots oublient.",
                  "Les gens du village disent que mes broderies portent chance. Je leur réponds que la chance, c'est surtout de la patience bien rangée."
              ],
              talk: [
                  { whenDone: 'sq_drowned', lines: [
                      "Mon métier chante de nouveau. Un jour, je vous tisserai un manteau, seigneur archer : il sera bleu, pour que vous n'oubliiez pas l'eau."
                  ] },
                  { whenDone: 'sun_2', lines: [
                      "L'eau est revenue ce matin, par la rive est. Vous avez entendu ? Elle chante comme une vieille amie. Les poissons de pierre n'étaient que des poissons endormis."
                  ] }
              ] }
        ],
        enemies: [
            // Noyés revenants (quête secondaire de Mei), nord du lit.
            { id: 'drowned_a', templateId: 'bone_reaver', emoji: '💀', name: 'Noyé revenant', kind: 'sentinel', x: 8, y: 1, offset: 0, permanent: true, group: 'drowned' },
            { id: 'drowned_b', templateId: 'bone_reaver', emoji: '💀', name: 'Noyé revenant', kind: 'sentinel', x: 10, y: 2, offset: 0, permanent: true, group: 'drowned' },
            // Vieux serpent nommé (quête secondaire de Gu), coin nord-est.
            { id: 'river_serpent', templateId: 'deep_sea_serpent', emoji: '🐍', name: 'Serpent du Fleuve Jaune', kind: 'sentinel', x: 12, y: 1, offset: 0, permanent: true },
            { id: 'fleuve_doctor', templateId: 'plague_doctor', emoji: '🧪', name: 'Docteur-démon des vases', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            { id: 'fleuve_lich', templateId: 'crypt_lich', emoji: '☠️', name: 'Sorcier-squelette du gué', kind: 'sentinel', x: 4, y: 9, offset: 0 },
            { id: 'sun_2', templateId: 'iron_gladiator', emoji: '☀️', name: 'Soleil des Eaux Taries', kind: 'sentinel', x: 11, y: 8,
              permanent: true, boss: { name: 'Soleil des Eaux Taries', level: 4 },
              afterScenes: MIRROR_TALKS.sun_2 }
        ],
        chests: [
            { id: 'fleuve_chest', x: 12, y: 3, gold: 60 }
        ]
    },

    // ── 3. Forêt de Bambous Calcinée ─────────────────────────────────────────
    bambous: {
        id: 'bambous', region: 'bambous', name: 'Forêt de Bambous Calcinée', biome: 'bamboo',
        w: 14, h: 10, spawn: { x: 1, y: 5 },
        arrival: [
            "Des bambous noircis dressent leurs fûts creux comme des cierges éteints. Il flotte une odeur de cendre douce, et quelque part, une cloche fêlée tinte sans que personne ne la touche.",
            "Le troisième soleil a incendié la forêt et s'est installé à l'est, près des ruines d'un temple."
        ],
        obstacles: [[3, 0, 3, 2], [6, 0, 1, 3], [6, 7, 1, 3], [4, 8, 2, 2], [9, 0, 2, 1], [12, 6, 1, 2]],
        liquids: [],
        paths: [[0, 5, 6, 1], [5, 4, 9, 2]],
        exits: [
            { x: 0, y: 5, to: 'fleuve', arrive: { x: 12, y: 5 }, label: 'Lit du Fleuve Jaune' },
            {
                x: 13, y: 4, to: 'gobi', arrive: { x: 1, y: 4 }, label: 'Désert de Gobi',
                requires: 'sun_3',
                lockedMessage: "Les flammes du Soleil de Cendres barrent la lisière orientale de la forêt."
            }
        ],
        npcs: [
            { id: 'monk_zhen', x: 4, y: 2, name: 'Zhen', title: 'Moine du temple brûlé', emoji: '🧘',
              idle: [
                  "Paix à vous, voyageur. Je prie ce qu'il reste à prier : les cendres, le silence, et une cloche absente.",
                  "Un jeune archer est venu méditer ici, il y a quelques jours. Il n'a pas réussi : sa respiration battait comme un tambour de guerre. Il m'a demandé s'il existe un breuvage qui épargne la mort. Je lui ai répondu : oui, le temps."
              ],
              talk: [
                  { whenDone: 'sq_bell', lines: [
                      "La cloche est de retour sur son pilier. Elle sonne les heures, et même celles qui n'existent pas encore : l'aube de demain, par exemple."
                  ] },
                  { whenDone: 'sun_3', lines: [
                      "Un brin de bambou vert, hier. Un autre ce matin. La forêt renaît.",
                      "Que le Ciel garde votre arc, seigneur."
                  ] }
              ] },
            { id: 'herbalist_xu', x: 3, y: 8, name: 'Xu', title: 'Herboriste', emoji: '🧑‍⚕️',
              idle: [
                  "Plus une plante vivante à dix lis à la ronde. Je cherche, je cherche… Tenez, sentez cette cendre : elle sent encore le gingembre, c'est dire.",
                  "Une tisane de chrysanthème, après un combat, remet tout en place. Je n'ai plus de chrysanthème, mais l'intention y est."
              ],
              talk: [
                  { whenDone: 'sq_old_pine', lines: [
                      "La plante a une deuxième feuille ! C'est la fête chez moi. Je la nomme « Hou Yi », avec votre permission."
                  ] },
                  { whenDone: 'sun_3', lines: [
                      "Les bambous verdissent, et mes plantes aussi. J'ai trouvé du ginseng sauvage sous une pierre : il a tenu bon. Une racine pour la route, seigneur ?"
                  ] }
              ] }
        ],
        enemies: [
            { id: 'bambous_assassin', templateId: 'shadow_assassin', emoji: '🥷', name: 'Ombre des cendres', kind: 'sentinel', x: 8, y: 1, offset: 0 },
            { id: 'bambous_fungus', templateId: 'fungal_horror', emoji: '🍄', name: 'Lingzhi maudit', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            { id: 'bambous_priestess', templateId: 'moon_priestess', emoji: '🌙', name: 'Prêtresse égarée', kind: 'sentinel', x: 12, y: 8, offset: 0 },
            // Esprit-arbre nommé (quête secondaire de Xu), coin sud-ouest.
            { id: 'old_pine', templateId: 'forest_guardian', emoji: '🌲', name: 'Vieux Pin Noir', kind: 'sentinel', x: 1, y: 9, offset: 0, permanent: true },
            { id: 'sun_3', templateId: 'fungal_horror', emoji: '☀️', name: 'Soleil de Cendres', kind: 'sentinel', x: 11, y: 1,
              permanent: true, boss: { name: 'Soleil de Cendres', level: 5 },
              afterScenes: MIRROR_TALKS.sun_3 }
        ],
        chests: [
            { id: 'temple_bell', x: 2, y: 0, gold: 10, label: 'Cloche du temple' },
            { id: 'bambous_chest', x: 12, y: 3, gold: 70 }
        ]
    },

    // ── 4. Désert de Gobi : illusions ────────────────────────────────────────
    gobi: {
        id: 'gobi', region: 'gobi', name: 'Désert de Gobi', biome: 'gobi',
        w: 14, h: 10, spawn: { x: 1, y: 4 },
        arrival: [
            "Le Gobi vibre sous un ciel blanc. Le soleil a l'air d'être partout à la fois. L'horizon ondule, et l'on ne sait plus si les dunes sont des dunes.",
            "Le quatrième soleil s'est multiplié en mirages. Un seul est réel : celui qui pèse sur le sable."
        ],
        obstacles: [[4, 1, 2, 2], [7, 0, 1, 2], [7, 8, 1, 1], [9, 3, 1, 1], [9, 6, 1, 1], [12, 7, 1, 1]],
        liquids: [[0, 8, 2, 2]],
        paths: [[0, 4, 7, 1], [6, 4, 1, 2], [6, 5, 8, 1]],
        exits: [
            { x: 0, y: 4, to: 'bambous', arrive: { x: 12, y: 4 }, label: 'Forêt de Bambous Calcinée' },
            {
                x: 13, y: 5, to: 'tonnerre', arrive: { x: 1, y: 5 }, label: 'Monts du Tonnerre',
                requires: 'sun_4',
                lockedMessage: "Le Soleil des Mirages brouille la piste de l'est : trouvez le vrai soleil et abattez-le."
            }
        ],
        npcs: [
            { id: 'merchant_ma', x: 3, y: 2, name: 'Ma', title: 'Marchand de caravane', emoji: '👳',
              idle: [
                  "Soies, épices, thé de Pu'er ! … enfin, il me reste du thé et beaucoup d'espoir. Les affaires sont aussi sèches que le Gobi.",
                  "Un caravanier m'a parlé d'un archer qui courait vers l'Occident sans boire ni dormir. « Il fuit quelque chose, disait-il, ou il court après. » Je ne sais pas lequel est pire."
              ],
              talk: [
                  { whenDone: 'sq_bandits', lines: [
                      "Ma caravane a passé le col sans une égratignure ! Je vous ferai une remise sur tout ce que je vendrai en chemin, seigneur. Même sur le thé."
                  ] },
                  { whenDone: 'sun_4', lines: [
                      "Tout le désert est net, clair, c'est presque indécent. Mes chameaux marchent droit pour la première fois depuis des semaines, et moi, je ne sais plus sur quoi râler."
                  ] }
              ] },
            { id: 'guide_dawa', x: 3, y: 7, name: 'Dawa', title: 'Guide du désert', emoji: '🧕',
              idle: [
                  "Au Gobi, on apprend vite à douter de ses yeux. Un mirage vous fait des signes, vous sourit, vous promet de l'eau. Il ment comme les plus beaux.",
                  "Les anciens disent : « le vrai soleil ne projette pas d'ombre ». Les anciens se trompent, ou ils parlent du ciel. Ici, sur terre, c'est l'inverse : tout ce qui est vrai pèse sur le sable, donc a une ombre.",
                  "Un mirage, lui, flotte : il scintille, sans ombre ni nom. Cherchez le soleil qui projette une ombre à ses pieds et porte un niveau au-dessus de sa tête : c'est le vrai."
              ],
              talk: [
                  { whenDone: 'sq_oasis', lines: [
                      "Ma cache ! Voyez comme le désert rend toujours ce qu'on lui confie, si l'on sait attendre. Prenez une gorgée d'eau avant de partir."
                  ] },
                  { whenDone: 'sun_4', lines: [
                      "On dit qu'un guide qui a vu un vrai soleil face à face ne se perd plus jamais. C'est faux, bien sûr : je me perds encore. Mais maintenant, je sais où je me retrouve."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'gobi_colossus', templateId: 'sand_colossus', emoji: '🏜️', name: 'Golem de sable', kind: 'sentinel', x: 6, y: 1, offset: 0 },
            // Mirages du Soleil des Mirages : même sprite que `sun_4`, sans ombre ni niveau, ils scintillent.
            { id: 'mirage_1', spriteKey: 'sun_4', templateId: 'arcane_scholar', emoji: '☀️', name: 'Soleil des Mirages', kind: 'sentinel', x: 9, y: 1,
              permanent: true, illusion: true,
              illusionLines: [
                  "Votre main traverse le soleil comme une fumée : un mirage, qui se dissipe en poussière de lumière.",
                  "Ce n'était pas lui. Le vrai soleil, lui, pèse sur le sable."
              ] },
            { id: 'mirage_2', spriteKey: 'sun_4', templateId: 'arcane_scholar', emoji: '☀️', name: 'Soleil des Mirages', kind: 'sentinel', x: 12, y: 1,
              permanent: true, illusion: true,
              illusionLines: [
                  "Le disque ardent vacille, se déchire comme un voile de soie : encore un mirage.",
                  "Cherchez celui qui projette une ombre."
              ] },
            { id: 'mirage_3', spriteKey: 'sun_4', templateId: 'arcane_scholar', emoji: '☀️', name: 'Soleil des Mirages', kind: 'sentinel', x: 8, y: 8,
              permanent: true, illusion: true,
              illusionLines: [
                  "L'image se plie en deux et s'évanouit, laissant une odeur de sable chaud.",
                  "Le désert se moque de vous, mais ses mensonges se font de plus en plus rares."
              ] },
            // Brigands nommés (quête secondaire de Ma), sud-ouest.
            { id: 'bandit_a', templateId: 'iron_gladiator', emoji: '🗡️', name: 'Brigand du Gobi', kind: 'sentinel', x: 4, y: 9, offset: 0, permanent: true, group: 'sand_bandits' },
            { id: 'bandit_b', templateId: 'shadow_assassin', emoji: '🥷', name: 'Lame masquée du Gobi', kind: 'sentinel', x: 6, y: 9, offset: 0, permanent: true, group: 'sand_bandits' },
            { id: 'sun_4', templateId: 'arcane_scholar', emoji: '☀️', name: 'Soleil des Mirages', kind: 'sentinel', x: 11, y: 8,
              permanent: true, boss: { name: 'Soleil des Mirages', level: 7 },
              afterScenes: MIRROR_TALKS.sun_4 }
        ],
        chests: [
            { id: 'oasis_cache', x: 1, y: 1, gold: 10, label: "Cache de l'oasis" },
            { id: 'gobi_chest', x: 12, y: 3, gold: 80 }
        ]
    },

    // ── 5. Monts du Tonnerre ─────────────────────────────────────────────────
    tonnerre: {
        id: 'tonnerre', region: 'tonnerre', name: 'Monts du Tonnerre', biome: 'storm',
        w: 14, h: 10, spawn: { x: 1, y: 5 },
        arrival: [
            "Les Monts du Tonnerre grondent. Les éclairs frappent la même arête, encore et encore, comme un forgeron céleste qui n'aurait pas fini son ouvrage.",
            "Le cinquième soleil a fait de la montagne son enclume : il règne à l'est, au milieu des orages."
        ],
        obstacles: [[4, 0, 2, 2], [4, 7, 2, 2], [6, 0, 1, 2], [6, 8, 1, 2], [9, 2, 1, 1], [9, 6, 1, 1], [12, 6, 1, 2]],
        liquids: [],
        paths: [[0, 5, 7, 1], [6, 3, 1, 3], [6, 3, 8, 1]],
        exits: [
            { x: 0, y: 5, to: 'gobi', arrive: { x: 12, y: 5 }, label: 'Désert de Gobi' },
            {
                x: 13, y: 3, to: 'volcan', arrive: { x: 1, y: 3 }, label: 'Gorges du Volcan',
                requires: 'sun_5',
                lockedMessage: "Les éclairs du Soleil des Orages interdisent le col de l'est."
            }
        ],
        npcs: [
            { id: 'smith_tie', x: 3, y: 7, name: 'Tie', title: 'Forgeron de flèches', emoji: '👨‍🔧',
              idle: [
                  "Une flèche ne vaut que par sa pointe, et la pointe que par la main qui l'a trempée. La mienne tremble, je le reconnais : des semaines sans repos, avec ces éclairs qui n'arrêtent pas.",
                  "Si vous trouvez de la foudre, du fer de ciel, du jade du matin, rapportez-les-moi : j'en ferai quelque chose de digne d'un archer."
              ],
              talk: [
                  { whenDone: 'sq_thunder_wyrm', lines: [
                      "Votre foudre en bouteille est à votre carquois, et mon enclume chante comme au premier jour. Ah, ces dragons… je leur dois mes meilleures idées."
                  ] },
                  { whenDone: 'sun_5', lines: [
                      "Plus un éclair, plus un orage : seulement du ciel. J'ai retrouvé le sommeil, seigneur. Je ne savais pas que cela manquait autant."
                  ] }
              ] },
            { id: 'hermit_lei', x: 3, y: 1, name: 'Lei', title: 'Ermite du tonnerre', emoji: '🧙',
              idle: [
                  "Chut. Il parle. Le tonnerre parle, voyez-vous : un coup long, deux coups courts… c'est son nom.",
                  "Il m'a prévenu : un arc sera tendu contre un autre arc avant la fin de l'histoire. Je ne sais pas lequel des deux se brisera."
              ],
              talk: [
                  { whenDone: 'sq_lei_drum', lines: [
                      "Mon tambour résonne ! Le tonnerre me répond enfin, en do mineur. Il manquait de musique, ici."
                  ] },
                  { whenDone: 'sun_5', lines: [
                      "Le tonnerre s'est tu. Je pensais que cela m'attristerait. Je suis seulement plus calme, comme après avoir dit ce qu'on avait à dire."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'tonnerre_knight', templateId: 'storm_knight', emoji: '🌩️', name: 'Général du tonnerre', kind: 'sentinel', x: 8, y: 1, offset: 0 },
            { id: 'tonnerre_warden', templateId: 'temple_warden', emoji: '🦁', name: 'Lion-gardien de pierre', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            // Dragon-serpent nommé (quête secondaire de Tie), coin nord-est.
            { id: 'thunder_wyrm', templateId: 'storm_wyrm', emoji: '⚡', name: 'Dragon-serpent du tonnerre', kind: 'sentinel', x: 12, y: 1, offset: 0, permanent: true },
            { id: 'sun_5', templateId: 'storm_knight', emoji: '☀️', name: 'Soleil des Orages', kind: 'sentinel', x: 11, y: 8,
              permanent: true, boss: { name: 'Soleil des Orages', level: 9 },
              afterScenes: MIRROR_TALKS.sun_5 }
        ],
        chests: [
            { id: 'lei_drum', x: 1, y: 0, gold: 10, label: 'Tambour du tonnerre' },
            { id: 'tonnerre_chest', x: 12, y: 5, gold: 100 }
        ]
    },

    // ── 6. Gorges du Volcan : embuscade de Fengmeng ──────────────────────────
    volcan: {
        id: 'volcan', region: 'volcan', name: 'Gorges du Volcan', biome: 'volcano',
        w: 14, h: 10, spawn: { x: 1, y: 3 },
        arrival: [
            "Les Gorges du Volcan crachent un air épais. Des ruisseaux de magma découpent la roche noire ; le long des parois, on a taillé des marches pour une époque où l'on y vivait.",
            "Au milieu du défilé, une silhouette connue attend, l'arc déjà tendu : Fengmeng. Au-delà, le sixième soleil."
        ],
        obstacles: [[1, 0, 3, 2], [6, 0, 2, 3], [6, 6, 2, 4], [4, 7, 2, 2], [9, 6, 1, 1], [12, 6, 1, 1]],
        liquids: [[9, 0, 3, 1], [8, 9, 3, 1], [0, 9, 2, 1]],
        paths: [[0, 3, 5, 1], [4, 3, 1, 2], [4, 4, 10, 1], [12, 4, 2, 2]],
        exits: [
            { x: 0, y: 3, to: 'tonnerre', arrive: { x: 12, y: 3 }, label: 'Monts du Tonnerre' },
            {
                x: 13, y: 5, to: 'fauves', arrive: { x: 1, y: 5 }, label: 'Plaine des Fauves',
                requires: 'sun_6',
                lockedMessage: "Le Soleil de Magma coule sur la sortie : il faut l'éteindre d'abord."
            }
        ],
        npcs: [
            { id: 'miner_shan', x: 3, y: 7, name: 'Shan', title: 'Mineur', emoji: '⛏️',
              idle: [
                  "Cinquante ans sous terre, et jamais rien d'aussi chaud ! Les veines de cinabre sont à nu, mais personne ne peut en approcher.",
                  "Un jeune archer est passé tout à l'heure, l'arc tendu, vers le défilé. Un garçon qui a faim, voilà ce que j'ai vu. Un garçon qui a faim."
              ],
              talk: [
                  { whenDone: 'sq_ore', lines: [
                      "La veine coule, les pioches chantent ! Je dois à vos flèches l'été le plus riche de ma carrière."
                  ] },
                  { whenDone: 'sun_6', lines: [
                      "La roche refroidit, doucement. On entend les murs se détendre, comme un vieux qui s'assied. Je crois que les gorges sont sauvées."
                  ] }
              ] },
            { id: 'priestess_yan', x: 3, y: 2, name: 'Yan', title: 'Prêtresse du feu repentie', emoji: '👩‍🦰',
              idle: [
                  "Autrefois, j'allumais un brasero à l'aube pour saluer les soleils. Je croyais qu'ils étaient des dieux. Ils n'étaient que des enfants capricieux.",
                  "Je connais ce regard, celui de l'archer pressé qui vous suit depuis les rizières : un garçon qui croit que le monde lui doit quelque chose. J'ai eu ce regard, à seize ans, devant l'autel d'un soleil."
              ],
              talk: [
                  { whenDone: 'sq_ember', lines: [
                      "La braise est entre de bonnes mains. Elle ne brûlera plus que pour renaître, et c'est tout ce que je lui souhaite."
                  ] },
                  { whenDone: 'sun_6', lines: [
                      "Je ne priais plus que par habitude. Aujourd'hui, je prie pour de bon : pour les soleils tombés, pour ceux qui restent, et pour vous, archer."
                  ] }
              ] }
        ],
        enemies: [
            // Embuscade : Fengmeng tient le défilé (corridor de 3 tuiles), seul passage vers l'est.
            { id: 'fengmeng_2', templateId: 'shadow_assassin', emoji: '🏹', name: "Fengmeng, l'Archer Pressé", kind: 'sentinel', x: 6, y: 4,
              permanent: true, boss: { name: "Fengmeng, l'Archer Pressé", level: 10 },
              defeatScene: {
                  speaker: FENGMENG_SPEAKER('fengmeng_2'),
                  lines: [
                      "J'étais parti deux jours avant vous, Maître. Je voulais que ce sixième soleil tombe sous ma flèche, et que pour une fois les villages chantent « Fengmeng ». Mais vous arrivez toujours à temps, n'est-ce pas ?",
                      "Encore ! Même à armes égales ! Qu'avez-vous de plus que moi, Maître ? La patience ? La faveur du Ciel ? La Reine Mère de l'Occident m'a dit la même chose : « Ce n'est pas à toi. »",
                      "Oui, j'y suis allé. J'ai gravi les marches du Kunlun pour lui demander un élixir, un seul. Elle a ri avec douceur, la vieille. On ne rit pas de moi avec douceur.",
                      "Prenez votre sixième soleil. Je ne vous gênerai plus… pour l'instant. Je retourne voir les vôtres : on dit que la maison du Maître garde le plus beau trésor du royaume, et qu'elle est bien seule."
                  ]
              } },
            { id: 'volcan_lich', templateId: 'crypt_lich', emoji: '☠️', name: 'Sorcier-squelette des braises', kind: 'sentinel', x: 1, y: 8, offset: 0 },
            // Pixiu gardiens de la veine (quête secondaire de Shan), nord-est.
            { id: 'ore_guard_a', templateId: 'lava_behemoth', emoji: '🌋', name: 'Pixiu de magma', kind: 'sentinel', x: 9, y: 1, offset: 0, permanent: true, group: 'ore_guards' },
            { id: 'ore_guard_b', templateId: 'lava_behemoth', emoji: '🌋', name: 'Pixiu de magma', kind: 'sentinel', x: 12, y: 1, offset: 0, permanent: true, group: 'ore_guards' },
            { id: 'volcan_dragon', templateId: 'ember_dragon', emoji: '🐲', name: 'Long de braise', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            { id: 'sun_6', templateId: 'lava_behemoth', emoji: '☀️', name: 'Soleil de Magma', kind: 'sentinel', x: 11, y: 8,
              permanent: true, boss: { name: 'Soleil de Magma', level: 11 },
              afterScenes: MIRROR_TALKS.sun_6 }
        ],
        chests: [
            { id: 'phoenix_brazier', x: 5, y: 0, gold: 10, label: 'Brasero du phénix' },
            { id: 'volcan_chest', x: 12, y: 3, gold: 110 }
        ]
    },

    // ── 7. Plaine des Fauves : soleil protégé par la meute ───────────────────
    fauves: {
        id: 'fauves', region: 'fauves', name: 'Plaine des Fauves', biome: 'savanna',
        w: 14, h: 10, spawn: { x: 1, y: 5 },
        arrival: [
            "La Plaine des Fauves ondule d'herbes sèches. Des traînées de braise courent entre les touffes, et l'on devine des formes fauves qui rôdent, flammes au poil, yeux de charbon.",
            "Le septième soleil trône à l'est, entouré d'une meute embrasée qui le protège comme une reine."
        ],
        obstacles: [[4, 1, 2, 1], [4, 8, 1, 2], [6, 0, 1, 2], [9, 3, 1, 1], [9, 6, 1, 1]],
        liquids: [],
        paths: [[0, 5, 6, 1], [5, 4, 9, 1]],
        exits: [
            { x: 0, y: 5, to: 'volcan', arrive: { x: 12, y: 5 }, label: 'Gorges du Volcan' },
            {
                x: 13, y: 4, to: 'mer', arrive: { x: 1, y: 4 }, label: 'Rivage de la Mer Orientale',
                requires: 'sun_7',
                lockedMessage: "Le Soleil des Bêtes Folles garde la plaine : la piste de l'est est un brasier."
            }
        ],
        npcs: [
            { id: 'hunter_wu', x: 3, y: 2, name: 'Wu', title: 'Chasseur', emoji: '🏹',
              idle: [
                  "Trente ans que je chasse ces plaines. Jamais vu de bêtes si furieuses : leurs flammes ne sont pas un feu naturel, mais celui d'une colère qui ne leur appartient pas.",
                  "Si vous allez vers le soleil, souvenez-vous : tuez la meute avant. Il n'y a pas de chasse sans pitié, mais il n'y a pas de pitié sans survivants."
              ],
              talk: [
                  { whenDone: 'sq_scarred_tiger', lines: [
                      "Balafré repose… J'ai posé un gâteau de lune sur sa tombe, comme on le fait pour un adversaire digne. Les bêtes aussi ont droit à leur offrande."
                  ] },
                  { whenDone: 'sun_7', lines: [
                      "Les loups hurlent à la lune, comme avant. Cela me donne envie de pleurer, et je ne sais pas pourquoi."
                  ] }
              ] },
            { id: 'shepherd_zi', x: 3, y: 8, name: 'Zi', title: 'Bergère', emoji: '👩‍🌾',
              idle: [
                  "Mes brebis ont couru droit devant elles, quand les flammes ont pris. Je les cherche tous les soirs, avec une lanterne, en chantant.",
                  "Un gâteau de lune, cela console plus qu'on ne croit. Moi, j'en laisse un chaque soir sur la pierre plate : la lune est bonne cliente."
              ],
              talk: [
                  { whenDone: 'sq_zi_bell', lines: [
                      "Écoutez ! J'entends déjà les premiers bêlements, là-bas, derrière la colline. Elles reviennent, seigneur, elles reviennent !"
                  ] },
                  { whenDone: 'sun_7', lines: [
                      "Le troupeau est entier. Vingt-sept têtes. Et une agnelle de plus, que je n'avais jamais vue : le soleil nous a fait un cadeau, au dernier moment."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'fauves_boar', templateId: 'flame_boar', emoji: '🐗', name: 'Sanglier de flammes', kind: 'sentinel', x: 7, y: 1, offset: 0 },
            { id: 'fauves_troll', templateId: 'war_troll', emoji: '👹', name: 'Ogre de la plaine', kind: 'sentinel', x: 10, y: 1, offset: 0 },
            // Tigre nommé (quête secondaire de Wu), coin nord-est.
            { id: 'scarred_tiger', templateId: 'fire_tiger', emoji: '🐯', name: 'Balafré, tigre embrasé', kind: 'sentinel', x: 13, y: 1, offset: 1, permanent: true },
            // Meute qui protège le soleil : tant qu'elle vit, `sun_7` est intouchable.
            { id: 'pack_wolf_a', templateId: 'ember_wolf', emoji: '🐺', name: 'Loup de braise', kind: 'sentinel', x: 9, y: 7, offset: 0, permanent: true, group: 'beast_pack' },
            { id: 'pack_boar', templateId: 'flame_boar', emoji: '🐗', name: 'Sanglier de flammes', kind: 'sentinel', x: 9, y: 9, offset: 0, permanent: true, group: 'beast_pack' },
            { id: 'pack_tiger', templateId: 'fire_tiger', emoji: '🐯', name: 'Tigre embrasé', kind: 'sentinel', x: 13, y: 8, offset: 0, permanent: true, group: 'beast_pack' },
            { id: 'pack_wolf_b', templateId: 'ember_wolf', emoji: '🐺', name: 'Loup de braise', kind: 'sentinel', x: 11, y: 9, offset: 0, permanent: true, group: 'beast_pack' },
            { id: 'sun_7', templateId: 'war_troll', emoji: '☀️', name: 'Soleil des Bêtes Folles', kind: 'sentinel', x: 11, y: 8,
              permanent: true, shieldedBy: 'beast_pack', boss: { name: 'Soleil des Bêtes Folles', level: 13 },
              afterScenes: MIRROR_TALKS.sun_7,
              shieldLines: [
                  "Un bouclier de flammes ondule autour du Soleil des Bêtes Folles : vos flèches se consumeraient avant de l'atteindre.",
                  "Quatre bêtes embrasées tournent autour de lui comme des gardiennes : tigre, sanglier, loups. Tant qu'elles vivent, il est intouchable.",
                  "Abattez la meute, et le bouclier tombera."
              ] }
        ],
        chests: [
            { id: 'zi_bell', x: 5, y: 9, gold: 10, label: 'Clochette du bélier' },
            { id: 'fauves_chest', x: 12, y: 3, gold: 120 }
        ]
    },

    // ── 8. Rivage de la Mer Orientale ────────────────────────────────────────
    mer: {
        id: 'mer', region: 'mer', name: 'Rivage de la Mer Orientale', biome: 'coast',
        w: 14, h: 10, spawn: { x: 1, y: 4 },
        arrival: [
            "La Mer Orientale s'est retirée de plusieurs lis. Sur la grève fumante, des filets étendus sèchent comme des toiles d'araignée, et des perles blanches gisent dans la vase.",
            "Le huitième soleil tient l'eau suspendue au-dessus des rochers de l'est, comme une cloche prête à retomber."
        ],
        obstacles: [[4, 1, 2, 2], [4, 7, 2, 1], [6, 0, 1, 2], [9, 3, 1, 1], [9, 7, 1, 1]],
        liquids: [[0, 9, 14, 1]],
        paths: [[0, 4, 7, 1], [6, 4, 1, 3], [6, 6, 8, 1]],
        exits: [
            { x: 0, y: 4, to: 'fauves', arrive: { x: 12, y: 4 }, label: 'Plaine des Fauves' },
            {
                x: 13, y: 6, to: 'fusang', arrive: { x: 1, y: 6 }, label: 'Cime du Fusang',
                requires: 'sun_8',
                lockedMessage: "Le Soleil des Marées tient la grève : la route du Fusang reste fermée."
            }
        ],
        npcs: [
            { id: 'fisher_hai', x: 3, y: 7, name: 'Hai', title: 'Pêcheur', emoji: '🎣',
              idle: [
                  "La mer s'est retirée si loin que mes filets sèchent comme du linge. Je n'ai jamais passé autant de temps à terre : cela ne me réussit pas.",
                  "Un gâteau de lune flottait ce matin là où la mer devrait être. Ma femme dit que c'est une offrande du Roi-Dragon. Moi, je dis que c'est de la boue."
              ],
              talk: [
                  { whenDone: 'sq_nets', lines: [
                      "Les filets sont raccommodés, la pierre de glace est au frais… non, vous l'avez : que je suis bête. Le poisson va revenir, je le sens dans mes rhumatismes."
                  ] },
                  { whenDone: 'sun_8', lines: [
                      "La mer est revenue, à pas de loup d'abord, puis en courant ! J'ai pleuré dans mon filet. Vous ne le direz à personne."
                  ] }
              ] },
            { id: 'envoy_longwang', x: 3, y: 2, name: 'Longwang', title: 'Envoyé du Roi-Dragon', emoji: '🐲',
              idle: [
                  "Salutations, seigneur archer. Je suis Longwang, envoyé du Roi-Dragon de la Mer Orientale. Mon maître est affligé : la mer étouffe sous le soleil, et ses fils dépérissent.",
                  "Il m'a chargé de vous dire ceci : la Reine Mère de l'Occident n'offre pas son élixir à n'importe qui. Elle sait lire dans les cœurs. Elle a vu quelque chose dans le vôtre, et quelque chose dans un autre, qu'elle n'a pas aimé."
              ],
              talk: [
                  { whenDone: 'sq_pearl', lines: [
                      "La perle est à son cou : mon maître a enfin pu pleurer, et la mer avec lui. C'est la plus belle pluie que j'aie jamais vue."
                  ] },
                  { whenDone: 'sun_8', lines: [
                      "La mer est revenue. Mon maître vous fera porter, par les courants, un présent à chacune de vos nuits. Il ne dira jamais merci à voix haute, mais il y pense."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'mer_witch', templateId: 'ice_witch', emoji: '❄️', name: 'Dame des neiges égarée', kind: 'sentinel', x: 8, y: 1, offset: 0 },
            // Serpents coupe-filets (quête secondaire de Hai), nord-est.
            { id: 'net_cutter_a', templateId: 'deep_sea_serpent', emoji: '🐍', name: 'Serpent coupe-filets', kind: 'sentinel', x: 11, y: 1, offset: 0, permanent: true, group: 'net_cutters' },
            { id: 'net_cutter_b', templateId: 'deep_sea_serpent', emoji: '🐍', name: 'Serpent coupe-filets', kind: 'sentinel', x: 13, y: 1, offset: 0, permanent: true, group: 'net_cutters' },
            { id: 'mer_doctor', templateId: 'plague_doctor', emoji: '🧪', name: 'Docteur-démon des marées', kind: 'sentinel', x: 7, y: 8, offset: 0 },
            { id: 'sun_8', templateId: 'deep_sea_serpent', emoji: '☀️', name: 'Soleil des Marées', kind: 'sentinel', x: 11, y: 8,
              permanent: true, boss: { name: 'Soleil des Marées', level: 15 },
              afterScenes: MIRROR_TALKS.sun_8 }
        ],
        chests: [
            { id: 'dragon_pearl', x: 1, y: 8, gold: 10, label: 'Perle du Roi-Dragon' },
            { id: 'mer_chest', x: 12, y: 4, gold: 130 }
        ]
    },

    // ── 9. Cime du Fusang : le Dixième Soleil, bouclier du Neuvième ──────────
    fusang: {
        id: 'fusang', region: 'fusang', name: 'Cime du Fusang', biome: 'fusang',
        w: 14, h: 10, spawn: { x: 1, y: 6 },
        arrival: [
            "Au sommet du monde, l'Arbre Fusang déploie ses branches d'or. Ici dormaient les dix soleils, et leurs nids de feu sont encore tièdes. Il y règne un silence de temple.",
            "Le neuvième soleil s'est réfugié au pied de l'arbre, devant son plus jeune frère, le dixième, qui tremble. Un tir de précision : n'effleurez jamais le dernier soleil."
        ],
        obstacles: [[4, 0, 2, 2], [6, 0, 1, 2], [6, 8, 1, 2], [9, 0, 1, 1], [12, 0, 2, 1], [2, 8, 2, 1]],
        liquids: [],
        paths: [[0, 6, 6, 1], [5, 4, 1, 3], [5, 4, 9, 1]],
        exits: [
            { x: 0, y: 6, to: 'mer', arrive: { x: 12, y: 6 }, label: 'Rivage de la Mer Orientale' },
            {
                x: 13, y: 4, to: 'lune', arrive: { x: 1, y: 4 }, label: 'Pic de la Lune',
                requires: 'sun_9',
                lockedMessage: "Le sentier du Pic de la Lune est caché derrière le dernier soleil : abattez le Soleil Lâche."
            }
        ],
        npcs: [
            { id: 'crane_envoy', x: 3, y: 2, name: 'La Grue', title: 'Messagère de la Reine Mère', emoji: '🦢',
              idle: [
                  "Je suis le souffle de la Reine Mère de l'Occident, archer. Elle me prête sa voix quand elle a besoin d'être entendue de très loin.",
                  "Elle m'a chargée de veiller sur l'Arbre, et sur la fiole d'élixir qu'elle a confiée à Dame Chang'e."
              ],
              talk: [
                  { whenDone: 'sun_8', lines: [
                      "Un jeune archer est venu frapper à la porte de la Reine Mère, il y a quelques semaines. Il demandait un élixir pour lui seul. Elle a refusé avec bonté : « Cet élixir est déjà promis. »",
                      "Je n'ai jamais vu quelqu'un pâlir ainsi, ni sourire en même temps."
                  ] },
                  { whenDone: 'sun_9', lines: [
                      "Le Dixième vous doit la vie. La Reine Mère dit que cela compte plus que la moitié des victoires.",
                      "Hâtez-vous vers le Pic de la Lune : le temps presse, et Fengmeng ne s'arrêtera pas."
                  ] }
              ] },
            // Le Dixième Soleil se cache derrière le Neuvième : on ne peut lui parler qu'après sa chute.
            { id: 'sun_ten', x: 12, y: 1, name: 'Dixième Soleil', title: 'Dernier des dix soleils', emoji: '🌞',
              idle: [
                  "…Tu es l'archer ? Celui qui a… mes frères ? Non, ne me regarde pas comme ça : je ne bouge pas, je te le jure.",
                  "Je n'ai jamais voulu brûler personne. Mes frères disaient que c'était un jeu. Moi, j'avais peur de la chaleur."
              ],
              talk: [
                  { whenDone: 'sun_9', lines: [
                      "Merci de m'avoir épargné. Je ne comprends pas encore pourquoi. Je serai le seul, maintenant. Cela fait… beaucoup de ciel.",
                      "Je me lèverai à l'heure, chaque matin. Promis."
                  ] },
                  { whenDone: 'q_epilogue', lines: [
                      "Je me lève à l'aube, chaque jour. Tu sais, il y a quelqu'un, sur la lune, qui me regarde passer. Elle me sourit."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'fusang_guard', templateId: 'sun_paladin', emoji: '🛡️', name: 'Garde solaire', kind: 'sentinel', x: 7, y: 1, offset: 0 },
            { id: 'fusang_sage', templateId: 'crystal_sage', emoji: '💎', name: 'Immortel de jade', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            { id: 'fusang_dragon', templateId: 'frost_dragon', emoji: '🐉', name: 'Long de givre', kind: 'sentinel', x: 4, y: 9, offset: 0 },
            { id: 'fusang_vampire', templateId: 'void_vampire', emoji: '🧛', name: 'Jiangshi des cimes', kind: 'sentinel', x: 12, y: 9, offset: 0 },
            { id: 'sun_9', templateId: 'ember_dragon', emoji: '☀️', name: 'Soleil Lâche', kind: 'sentinel', x: 11, y: 2,
              permanent: true, boss: { name: 'Soleil Lâche', level: 17 },
              afterScenes: MIRROR_TALKS.sun_9 }
        ],
        chests: [
            { id: 'crane_nest', x: 1, y: 1, gold: 10, label: 'Nid de la grue' }
        ]
    },

    // ── 10. Pic de la Lune : finale ──────────────────────────────────────────
    lune: {
        id: 'lune', region: 'lune', name: 'Pic de la Lune', biome: 'moon',
        w: 14, h: 10, spawn: { x: 1, y: 4 },
        arrival: [
            "Le Pic de la Lune se dresse comme une dent d'argent. L'air est froid, limpide ; le ciel semble à portée de main, et la lune, immense, éclaire le sentier de pierre pâle comme en plein jour.",
            "Au sommet, deux ombres se font face : une femme qui serre une fiole contre elle, et l'archer qui l'a suivie."
        ],
        obstacles: [[6, 0, 1, 2], [6, 7, 1, 3], [8, 2, 1, 1], [8, 6, 1, 1], [3, 7, 2, 2]],
        liquids: [[4, 1, 3, 2]],
        paths: [[0, 4, 13, 1]],
        exits: [
            { x: 0, y: 4, to: 'fusang', arrive: { x: 12, y: 4 }, label: 'Cime du Fusang' }
        ],
        npcs: [
            // Chang'e vêtue de lumière lunaire, au bord du bassin d'eau lunaire ; après son envol, il n'en reste que le reflet.
            { id: 'change_moon', x: 3, y: 2, name: "Chang'e", title: 'Vêtue de lumière lunaire', emoji: '👸',
              idle: [
                  "Hou Yi… Tu es venu. Je savais que tu viendrais, avant même que la grue ne parte. Regarde-moi : la lune m'a déjà un peu changée.",
                  "J'ai la fiole contre moi. Fengmeng arrive : j'entends ses pas sur le sentier de l'est. Il ne se calmera pas, tu sais. Il a trop faim d'être aimé, ce garçon.",
                  "Prends un gâteau, pour tenir debout quand tout tremble. Tu n'as jamais su te battre le ventre vide."
              ],
              talk: [
                  { whenDone: 'fengmeng_3a', lines: [
                      "(Son image vacille à la surface du bassin, plus lumineuse que jamais.)",
                      "Je suis là, mon archer, dans la lumière, au-dessus de toi. L'élixir m'a prise, mais pas mon cœur. Fais ce que tu dois : ne le hais pas, il se déteste déjà assez."
                  ] },
                  { whenDone: 'q_epilogue', lines: [
                      "(Le reflet se pose sur l'autel comme une main sur une épaule.)",
                      "Chaque année, à la pleine lune d'automne, regarde le ciel. Je serai là."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'lune_priestess', templateId: 'moon_priestess', emoji: '🌙', name: 'Prêtresse lunaire', kind: 'patrol', x: 8, y: 8, patrol: [[8, 8], [12, 8]], offset: 0 },
            { id: 'lune_vampire', templateId: 'void_vampire', emoji: '🧛', name: 'Jiangshi des neiges', kind: 'sentinel', x: 9, y: 1, offset: 0 },
            { id: 'lune_assassin', templateId: 'shadow_assassin', emoji: '🥷', name: 'Ombre du pic', kind: 'sentinel', x: 1, y: 9, offset: 0 },
            // Finale en deux phases. La phase 2 n'existe qu'après la défaite de la phase 1.
            // Phase 1 : il copie les techniques du héros, qui arrive affaibli par les neuf soleils (duel.js).
            { id: 'fengmeng_3a', templateId: 'shadow_assassin', emoji: '🏹', name: "Fengmeng, l'Archer Miroir", kind: 'sentinel', x: 11, y: 4,
              permanent: true, boss: { name: "Fengmeng, l'Archer Miroir", level: 18 },
              duel: { mirror: true, heroHpPct: 0.75 },
              defeatScene: {
                  speaker: { name: 'Narrateur', title: 'Le Pic de la Lune' },
                  lines: [
                      "Fengmeng tombe à genoux, son arc brisé à ses côtés. Hou Yi s'avance, la main tendue pour l'aider à se relever. Mais le disciple, d'un geste de serpent, tend la sienne vers Chang'e : « L'élixir, Madame. Donnez-le-moi, ou la prochaine flèche trouvera la poitrine du Maître. »",
                      "Il tient encore un carreau empoisonné dans sa paume, pointé contre le cœur de Hou Yi, trop près pour qu'on puisse l'arrêter. Chang'e regarde son époux, puis la pointe, puis le visage de celui qu'elle a nourri pendant dix ans. Elle sourit comme on sourit à un enfant perdu.",
                      "« Tu ne tireras pas, Fengmeng. Il n'y a plus de marché à passer. » Elle porte la fiole à ses lèvres. « Pardonne-moi, mon archer. Une gorgée pour vivre longtemps, la fiole entière pour monter au ciel… Ce n'est pas un adieu. Regarde la lune, chaque nuit. Je serai là. »",
                      "Une lumière d'argent la soulève, et sa robe de hanfu flotte comme une voile. Elle s'élève, lentement, sans cesser de regarder Hou Yi, jusqu'à devenir un point clair devant le disque immense de la lune. Sur le bassin d'eau lunaire, son reflet demeure, comme un souvenir qui ne veut pas partir.",
                      "Fengmeng hurle. Ce qu'il voulait vient de lui échapper à jamais ; il ne reste que la fureur. Il saisit un nouvel arc et un carquois plein, et ses yeux ne sont plus ceux d'un disciple."
                  ]
              } },
            { id: 'fengmeng_3b', templateId: 'storm_knight', emoji: '🏹', name: 'Fengmeng, Rage et Désespoir', kind: 'sentinel', x: 11, y: 3,
              permanent: true, showWhen: 'fengmeng_3a', boss: { name: 'Fengmeng, Rage et Désespoir', level: 19 },
              // Phase 2 : fureur, tirs rapides (un tour bonus tous les 3 tours) et pièges de zone (tous les 2 tours).
              duel: { rapidShots: 3, zoneTraps: 2 },
              defeatScene: {
                  speaker: FENGMENG_SPEAKER('fengmeng_3b'),
                  lines: [
                      "…Pourquoi ? Pourquoi ne m'avez-vous jamais regardé comme vous la regardiez, elle ?",
                      "Je voulais seulement que quelqu'un me dise : « Tu es digne. » Vous aviez votre Chang'e, vos soleils, votre légende. Moi, j'avais des flèches.",
                      "(Il laisse tomber son arc.) Allez. Elle vous attend dans la lumière. Moi, je redescendrai à pied, comme tout le monde."
                  ]
              } }
        ],
        chests: [
            { id: 'moon_cakes_cache', x: 1, y: 7, gold: 60, label: "Corbeille d'offrandes" },
            // L'autel n'apparaît qu'après la victoire sur Fengmeng : l'ouvrir déclenche l'épilogue.
            { id: 'moon_altar', x: 12, y: 4, gold: 0, label: 'Autel des gâteaux de lune', showWhen: 'fengmeng_3b',
              emojiOnly: true, emoji: '🌕', emojiOpened: '🏮',
              openText: "🌕 Vous déposez les gâteaux de lune sur l'autel de pierre blanche…" }
        ]
    }
};

// Niveau minimal du joueur pour ENTRER dans un écran de la région (brume magique sinon).
export const REGION_UNLOCK_LEVEL = {
    rizieres: 1,
    fleuve: 2,
    bambous: 3,
    gobi: 5,
    tonnerre: 7,
    volcan: 9,
    fauves: 11,
    mer: 13,
    fusang: 15,
    lune: 16
};

// Quêtes, dans l'ordre : d'abord l'histoire principale, puis les quêtes secondaires (`side: true`).
// Statut : locked → available → active → ready → done.
//  - giver      : PNJ qui propose la quête ; avec `autoStart:true` la quête démarre toute seule et le PNJ
//                 ne fait que rappeler l'objectif (`hint`)
//  - turnIn     : PNJ auquel on rend compte (absent = validée automatiquement)
//  - requires   : quêtes à terminer avant
//  - objectives : kill (ennemi), killGroup (groupe d'ennemis), chest (ouvrir un coffre)
//  - side       : quête secondaire (optionnelle) : jamais requise par une quête principale
//  - final      : sa validation met `ended = true` (épilogue, Nouvelle Partie + disponible)
// Les PNJ peuvent aussi avoir `talk: [{ whenDone: id | [ids], lines }]` : répliques d'ambiance
// selon l'avancement (id = quête terminée, ennemi vaincu ou coffre ouvert ; la dernière
// condition remplie l'emporte, sinon `idle`). Un écran peut avoir `arrival: [lignes]`
// (texte du Narrateur à la première visite).
const BASE_QUESTS = [
    // ── Histoire principale : neuf soleils, Fengmeng, épilogue ───────────────
    {
        id: 'q_sun_1',
        title: 'Le Soleil Ardent',
        chapter: 'Chapitre I — Les Rizières Desséchées',
        giver: 'elder_wen', turnIn: null, requires: [],
        objectives: [{ type: 'kill', target: 'sun_1', text: 'Abattre le Soleil Ardent (sanctuaire à l\'est des Rizières Desséchées, au-delà de la digue)' }],
        offer: [
            "Hou Yi ! Que les ancêtres soient loués. Vous savez l'état du monde : dix soleils, fils de Di Jun, brûlent le ciel depuis trois lunes. Ma vieille tête ne se souvient d'aucun été pareil.",
            "L'empereur Yao m'envoie son décret, scellé de jade : « Que l'archer Hou Yi abatte neuf soleils, et qu'il en épargne un seul, afin que la Terre garde un jour. » Il vous le demande, il ne vous l'ordonne pas.",
            "Le premier se tient sur le tertre du temple des moissons, à l'est, au bout de nos rizières. Mais prenez garde : votre disciple Fengmeng rôde sur la digue, et il a dans les yeux quelque chose que je n'aime pas. Il veut vous éprouver.",
            "Entraînez-vous sur les maraudeurs de nos champs si vous le jugez nécessaire. (Niveau 3 conseillé)"
        ],
        hint: [
            "Le Soleil Ardent est à l'est, sur le tertre du temple. La digue est étroite : méfiez-vous de Fengmeng, qui y rôde.",
            "Les maraudeurs des rizières sont de bons adversaires pour s'échauffer, et ils reviennent toujours. Les monstres se voient de loin : un cercle rouge marque leur zone de vigilance."
        ],
        complete: [
            "Le Soleil Ardent s'effondre en pluie de braise et, pour la première fois depuis trois lunes, un souffle de vent frais traverse les rizières. Les villageois sortent de leurs huttes et tombent à genoux. Certains pleurent.",
            "Du corps du soleil, il ne reste qu'un disque de cendre tiède et une plume de feu que vous glissez dans votre carquois. Huit autres soleils vous attendent.",
            "À l'est, la digue s'ouvre sur le chemin du Fleuve Jaune. Chang'e vous a laissé un paquet de gâteaux de lune sur le muret : il est encore chaud."
        ],
        reward: { gold: 80, fragment: 'Éclat du Soleil Ardent' }
    },
    {
        id: 'q_sun_2',
        title: 'Le Soleil des Eaux Taries',
        chapter: 'Chapitre II — Le Lit du Fleuve Jaune',
        giver: 'ferryman_gu', autoStart: true, turnIn: null, requires: ['q_sun_1'],
        objectives: [{ type: 'kill', target: 'sun_2', text: 'Abattre le Soleil des Eaux Taries (sanctuaire du Lit du Fleuve Jaune, au sud-est)' }],
        offer: [
            "Deuxième soleil : celui des Eaux Taries a bu le Fleuve Jaune jusqu'au dernier filet. Son sanctuaire, un banc de rochers fendus, se dresse au sud-est du lit asséché. (Niveau 4 conseillé)",
            "Le passeur Gu et la tisserande Mei connaissent ces rives mieux que quiconque."
        ],
        hint: [
            "Le Soleil des Eaux Taries se tient au sud-est du lit du fleuve, parmi les rochers fendus. Vous voyez ses gardes de loin : les noyés ne dorment plus.",
            "Quand l'eau reviendra, ma barque sera la première à flotter. Je compte sur vous, seigneur archer."
        ],
        complete: [
            "Le Soleil des Eaux Taries pousse un soupir humide et se dissout en brume. Un grondement monte du sol : très loin, en amont, l'eau revient.",
            "Elle avance d'abord comme un murmure, puis comme une main qui lisse la boue. Le passeur Gu enfonce sa perche dans la vase et crie de joie : sa barque se remet à flotter.",
            "Deux soleils abattus. L'est vous attend : la Forêt de Bambous Calcinée."
        ],
        reward: { gold: 110, fragment: 'Éclat du Soleil des Eaux Taries' }
    },
    {
        id: 'q_sun_3',
        title: 'Le Soleil de Cendres',
        chapter: 'Chapitre III — La Forêt de Bambous Calcinée',
        giver: 'monk_zhen', autoStart: true, turnIn: null, requires: ['q_sun_2'],
        objectives: [{ type: 'kill', target: 'sun_3', text: 'Abattre le Soleil de Cendres (sanctuaire de la Forêt de Bambous Calcinée, au nord-est)' }],
        offer: [
            "Troisième soleil : celui de Cendres a transformé une forêt entière en cierges noirs. Il se tient à l'est, près du temple brûlé, là où la cloche sonne encore toute seule. (Niveau 5 conseillé)",
            "Le moine Zhen veille sur ce qu'il reste du sanctuaire ; l'herboriste Xu cherche encore des plantes vivantes."
        ],
        hint: [
            "Le Soleil de Cendres est au nord-est de la forêt, au-delà des bambous noircis. Évitez les cercles rouges : les esprits y sont nerveux.",
            "Si le feu vous fait peur, souvenez-vous : il ne reste à brûler que ce qui a déjà brûlé."
        ],
        complete: [
            "Le Soleil de Cendres s'éteint comme une braise sous l'eau : sans bruit, avec une volute grise. Alors, très doucement, la cloche du temple sonne, et personne ne la touche.",
            "Le moine Zhen joint les mains. Dans la cendre, un premier brin de bambou vert perce, pas plus grand qu'une aiguille. La forêt n'est pas morte : elle attendait.",
            "Trois soleils sont tombés. Le Gobi vous attend, à l'est, avec ses mirages."
        ],
        reward: { gold: 140, fragment: 'Éclat du Soleil de Cendres' }
    },
    {
        id: 'q_sun_4',
        title: 'Le Soleil des Mirages',
        chapter: 'Chapitre IV — Le Désert de Gobi',
        giver: 'guide_dawa', autoStart: true, turnIn: null, requires: ['q_sun_3'],
        objectives: [{ type: 'kill', target: 'sun_4', text: 'Trouver et abattre le vrai Soleil des Mirages parmi ses doubles (Désert de Gobi)' }],
        offer: [
            "Quatrième soleil : celui des Mirages. Il s'est dédoublé, triplé, partout à la fois, et les caravanes marchent en rond jusqu'à mourir de soif. Le vrai est caché parmi ses doubles. (Niveau 7 conseillé)",
            "Le guide Dawa saura vous dire comment faire la différence."
        ],
        hint: [
            "Les mirages se dissipent au toucher, sans mal ; mais seul le vrai soleil peut être abattu. Cherchez celui qui projette une ombre au sol et porte un niveau au-dessus de sa tête.",
            "Un mirage scintille, comme l'air chaud : il n'a ni ombre, ni nom. Si vous hésitez, touchez-le : au pire, il se défait entre vos doigts."
        ],
        complete: [
            "Le vrai soleil s'effondre ; autour de lui, tous les mirages s'évanouissent d'un coup, comme des bulles de savon. Le désert redevient simplement le désert : immense, honnête, silencieux.",
            "Dawa ôte son turban et le tend vers le ciel, enfin bleu. « On dit que celui qui sait voir le vrai du faux dans le Gobi n'a plus rien à craindre dans la vie », murmure-t-il.",
            "Quatre soleils sont tombés. Les Monts du Tonnerre grondent à l'est."
        ],
        reward: { gold: 180, fragment: 'Éclat du Soleil des Mirages' }
    },
    {
        id: 'q_sun_5',
        title: 'Le Soleil des Orages',
        chapter: 'Chapitre V — Les Monts du Tonnerre',
        giver: 'hermit_lei', autoStart: true, turnIn: null, requires: ['q_sun_4'],
        objectives: [{ type: 'kill', target: 'sun_5', text: 'Abattre le Soleil des Orages (sanctuaire des Monts du Tonnerre, au sud-est)' }],
        offer: [
            "Cinquième soleil : celui des Orages. Il lance des éclairs sur chaque crête, et les Monts du Tonnerre n'ont plus de nuit. Il règne à l'est, au milieu des nuages noirs. (Niveau 9 conseillé)",
            "Le forgeron Tie ajustera vos flèches ; l'ermite Lei sait où frappe l'éclair."
        ],
        hint: [
            "Le tonnerre est un tambour, archer : écoutez-le avant de tirer. Le Soleil des Orages est au sud-est ; ses gardes frappent plus fort qu'ils n'en ont l'air.",
            "Gardez vos distances avec les cercles rouges, et ne comptez pas sur le silence entre deux éclairs."
        ],
        complete: [
            "Le Soleil des Orages éclate en un dernier coup de tonnerre, si fort que les montagnes en tremblent. Puis le silence, d'une pureté stupéfiante, et une pluie fine, tiède, qui sent le fer et la terre.",
            "Au loin, le forgeron Tie lève son marteau vers le ciel clair. L'ermite Lei, qui parlait au tonnerre depuis trente ans, hoche simplement la tête : le tonnerre a fini de répondre.",
            "Cinq soleils abattus. À l'est, les Gorges du Volcan fument, et quelqu'un vous y attend."
        ],
        reward: { gold: 230, fragment: 'Éclat du Soleil des Orages' }
    },
    {
        id: 'q_sun_6',
        title: 'Le Soleil de Magma',
        chapter: 'Chapitre VI — Les Gorges du Volcan',
        giver: 'priestess_yan', autoStart: true, turnIn: null, requires: ['q_sun_5'],
        objectives: [{ type: 'kill', target: 'sun_6', text: 'Abattre le Soleil de Magma (sanctuaire des Gorges du Volcan, au-delà du défilé)' }],
        offer: [
            "Sixième soleil : celui de Magma. Il a fait de la gorge une forge, et le basalte coule comme de l'eau. Son sanctuaire se tient à l'est, au-delà du défilé. (Niveau 11 conseillé)",
            "Une silhouette connue vous attend à l'entrée des gorges, l'arc déjà tendu…"
        ],
        hint: [
            "Le défilé est étroit : un archer pressé y a tendu une embuscade. Après lui, le Soleil de Magma vous attend à l'est.",
            "Les pixiu de magma gardent les veines de cinabre : prudence, ils chargent la tête baissée."
        ],
        complete: [
            "Le Soleil de Magma se fige, noircit, se fend comme une coulée refroidie, puis s'effondre en gravats encore chauds. Les rivières de feu ralentissent et s'éteignent une à une, laissant une roche luisante comme du verre.",
            "La prêtresse Yan s'agenouille, le front contre la pierre : elle priait les soleils comme des dieux, autrefois. « Pardonnez-moi, murmure-t-elle, de les avoir aimés. »",
            "Six soleils sont tombés. Reste à franchir les plaines, où les fauves sont devenus fous de chaleur."
        ],
        reward: { gold: 290, fragment: 'Éclat du Soleil de Magma' }
    },
    {
        id: 'q_sun_7',
        title: 'Le Soleil des Bêtes Folles',
        chapter: 'Chapitre VII — La Plaine des Fauves',
        giver: 'hunter_wu', autoStart: true, turnIn: null, requires: ['q_sun_6'],
        objectives: [{ type: 'kill', target: 'sun_7', text: 'Abattre la meute embrasée puis le Soleil des Bêtes Folles (sanctuaire de la Plaine des Fauves, au sud-est)' }],
        offer: [
            "Septième soleil : celui des Bêtes Folles. Il a rendu fous tigres, sangliers et loups, qui ravagent la plaine en meutes embrasées. Le soleil se tient au milieu d'elles, protégé comme une reine. (Niveau 13 conseillé)",
            "Le chasseur Wu connaît leurs habitudes."
        ],
        hint: [
            "Tant que la meute vit, le soleil est protégé par un bouclier de flammes : abattez d'abord les quatre bêtes qui l'entourent.",
            "Frappez-les une à une : aucune ne vous suivra loin de son maître."
        ],
        complete: [
            "La meute est tombée, puis le soleil. Les flammes qui couraient dans l'herbe s'éteignent d'un coup, et les bêtes survivantes se couchent, hagardes, comme éveillées d'un cauchemar.",
            "Le chasseur Wu dépose sa lance : « Je les ai chassées toute ma vie, dit-il. Je n'ai jamais pensé qu'elles pouvaient avoir peur. »",
            "Sept soleils abattus. La Mer Orientale vous attend à l'est : il paraît qu'elle s'est retirée."
        ],
        reward: { gold: 360, fragment: 'Éclat du Soleil des Bêtes Folles' }
    },
    {
        id: 'q_sun_8',
        title: 'Le Soleil des Marées',
        chapter: 'Chapitre VIII — Le Rivage de la Mer Orientale',
        giver: 'envoy_longwang', autoStart: true, turnIn: null, requires: ['q_sun_7'],
        objectives: [{ type: 'kill', target: 'sun_8', text: 'Abattre le Soleil des Marées (sanctuaire du Rivage de la Mer Orientale, au sud-est)' }],
        offer: [
            "Huitième soleil : celui des Marées. Il a aspiré la mer et la tient en suspens au-dessus de la grève, comme une cloche d'eau prête à retomber. Il siège sur les rochers de l'est. (Niveau 15 conseillé)",
            "Un envoyé du Roi-Dragon attend de pouvoir vous remercier."
        ],
        hint: [
            "Mon maître le Roi-Dragon supplie le Ciel depuis des semaines : la mer étouffe. Le Soleil des Marées est au sud-est, sur les rochers.",
            "Ses serpents de mer ont perdu leur eau et leur raison : méfiez-vous des cercles rouges."
        ],
        complete: [
            "Le Soleil des Marées éclate en une pluie tiède, et la cloche d'eau, enfin libérée, retombe sur la grève : un bruit de tonnerre mou, un grand soupir d'écume, puis l'immense mer qui revient, doucement, lécher les pieds des pêcheurs.",
            "L'envoyé Longwang s'incline si bas que ses cheveux touchent le sable. « Le Roi-Dragon n'oubliera pas. Il y a, dans son palais, des écailles pour d'autres flèches. »",
            "Huit soleils abattus. Il reste le Neuvième, au sommet du monde, et le Dixième, que vous devez épargner."
        ],
        reward: { gold: 440, fragment: 'Éclat du Soleil des Marées' }
    },
    {
        id: 'q_sun_9',
        title: 'Le Soleil Lâche',
        chapter: 'Chapitre IX — La Cime du Fusang',
        giver: 'crane_envoy', autoStart: true, turnIn: null, requires: ['q_sun_8'],
        objectives: [{ type: 'kill', target: 'sun_9', text: 'Abattre le Soleil Lâche sans toucher au Dixième Soleil (sanctuaire de la Cime du Fusang, au nord-est)' }],
        offer: [
            "Neuvième soleil : celui qu'on appelle le Lâche. Il s'est réfugié au pied du Fusang, à l'abri derrière son plus jeune frère, le Dixième, qui tremble de tout son corps. (Niveau 17 conseillé)",
            "Vous devez abattre le Neuvième sans toucher au Dixième : un seul tir mal placé, et la Terre n'aurait plus de jour."
        ],
        hint: [
            "Le Soleil Lâche est dans le sanctuaire, au nord-est. Le Dixième se tient derrière lui, terrifié : ne le visez jamais.",
            "Un archer sans tremblement : c'est ce qu'il faut, ici. Ni trop tôt, ni trop fort."
        ],
        complete: [
            "Le Soleil Lâche tombe sans un cri, comme un fruit mûr. Derrière lui, le Dixième Soleil, un petit être lumineux de la taille d'un enfant, se serre contre le tronc du Fusang et ose enfin regarder son sauveur.",
            "« Tu… tu ne m'as pas touché », murmure-t-il. « Je serai sage. Je me lèverai à l'heure. Je ne brûlerai personne. » Il lève vers le ciel un visage mouillé de lumière.",
            "Neuf soleils sont tombés ; un seul demeure, qui éclairera la Terre à jamais. Mais déjà, une grue blanche descend de la plus haute branche…"
        ],
        reward: { gold: 540, fragment: 'Éclat du Soleil Lâche' }
    },
    {
        id: 'q_fengmeng',
        title: "L'Archer Miroir",
        chapter: 'Chapitre Final — Le Pic de la Lune',
        giver: 'crane_envoy', autoStart: true, turnIn: null, requires: ['q_sun_9'],
        objectives: [{ type: 'kill', target: 'fengmeng_3b', text: 'Affronter Fengmeng au sommet du Pic de la Lune (duel en deux phases, à l\'est du Fusang)' }],
        offer: [
            "La grue blanche se pose sur la plus haute branche, un rouleau dans le bec : le sceau de la Reine Mère de l'Occident. « Hou Yi. Fengmeng a forcé votre porte à l'aube. Dame Chang'e s'est enfuie avec l'élixir. »",
            "« Elle vous attend au Pic de la Lune, à l'est de l'Arbre : c'est le seul endroit du monde où la Reine Mère peut encore veiller sur elle. Fengmeng la suit. Allez, archer : il ne vous reste que le temps d'un soupir. » (Niveau 16 conseillé)"
        ],
        hint: [
            "Le Pic de la Lune est à l'est de l'Arbre. Fengmeng est un archer redoutable, et il connaît vos techniques par cœur : n'attendez pas de lui qu'il tire autrement que vous.",
            "Ne cherchez pas à le détester. Dame Chang'e vous le dirait elle-même."
        ],
        complete: [
            "Fengmeng ne se relève pas tout de suite. Quand il le fait, il a vieilli de dix ans. Il laisse son carquois au pied de l'autel et redescend vers la vallée, sans se retourner.",
            "On dit qu'il passa le reste de ses jours à tirer à l'arc sur des cibles de paille, pour ne plus jamais viser personne.",
            "Le silence retombe sur le pic. Il ne reste plus, dans la lumière froide, que l'archer, la lune, et la dernière chose que Chang'e lui demande."
        ],
        reward: { gold: 600, fragment: 'Carquois de Fengmeng' }
    },
    {
        id: 'q_epilogue',
        title: 'Les gâteaux de lune',
        chapter: 'Épilogue — Le Pic de la Lune',
        giver: 'change_moon', autoStart: true, turnIn: null, requires: ['q_fengmeng'], final: true,
        objectives: [{ type: 'chest', target: 'moon_altar', text: "Déposer les gâteaux de lune sur l'autel (sommet du Pic de la Lune)" }],
        offer: [
            "Le calme revient sur le pic. Là où la pierre était nue, un autel blanc apparaît, gravé d'une lune et d'un lièvre de jade : l'autel des gâteaux de lune.",
            "Chang'e vous attend dans la lumière. Elle ne dit rien, elle sourit seulement, et désigne la corbeille posée devant l'autel. Déposez les gâteaux : c'est la dernière chose qu'elle vous demande."
        ],
        hint: [
            "L'autel de pierre blanche attend vos gâteaux de lune. Ouvrez-le : c'est tout ce qu'elle vous demande.",
            "Prenez votre temps. La lune ne s'en va pas."
        ],
        complete: STORY_ENDING,
        reward: { gold: 800, fragment: 'Gâteau de pleine lune' }
    },

    // ── Quêtes secondaires (facultatives) : or et composants de flèche ───────
    {
        id: 'sq_rice_thief', side: true,
        title: 'Le chapardeur des rizières',
        chapter: '✦ Quête secondaire — Rizières Desséchées',
        giver: 'farmer_lin', turnIn: 'farmer_lin', requires: [],
        objectives: [{ type: 'kill', target: 'rice_thief', text: 'Chasser Xiao Gui, le chapardeur (champs de l\'est, au sud, au-delà de la digue)' }],
        offer: [
            "Seigneur archer… Un petit démon-renard, Xiao Gui, vole mes derniers sacs de riz, la nuit. Il a même emporté la jarre d'eau sacrée de mes ancêtres, la seule qui ne soit pas encore vide.",
            "Il se cache dans les champs de l'est, de l'autre côté de la digue, près de la clôture. Il est petit, mais rusé : méfiez-vous des pièges."
        ],
        hint: ["Xiao Gui rôde dans les champs de l'est, au sud, près de la clôture. Il aime les pièges."],
        complete: [
            "Ma jarre ! Elle est fêlée au col, mais elle contient encore une larme de l'eau sacrée de mes ancêtres.",
            "Prenez-la, seigneur : pour la pointe de vos flèches. Et ces pièces, c'est tout ce qui me reste du dernier marché."
        ],
        reward: { gold: 40, fragment: 'Eau sacrée' }
    },
    {
        id: 'sq_river_serpent', side: true,
        title: 'Le serpent du gué',
        chapter: '✦ Quête secondaire — Lit du Fleuve Jaune',
        giver: 'ferryman_gu', turnIn: 'ferryman_gu', requires: ['q_sun_1'],
        objectives: [{ type: 'kill', target: 'river_serpent', text: 'Chasser le Serpent du Fleuve Jaune (coin nord-est du lit, près des rochers)' }],
        offer: [
            "Seigneur archer, vous qui chassez les soleils, auriez-vous un moment pour un serpent ? Un vieux serpent de rivière s'est niché dans une fosse de boue, au nord-est. Depuis que l'eau s'est retirée, il attaque les voyageurs.",
            "Il n'est pas méchant de nature : il a soif, comme tout le monde. Mais soif ou pas, il m'a pris ma perche favorite, et je n'ai plus que mes mains pour pousser la barque quand l'eau reviendra.",
            "Au fait, un jeune archer pressé m'a demandé hier le chemin de l'Occident. Il courait comme on court après un rêve, ou après un remords. Un de vos disciples, peut-être ?"
        ],
        hint: ["Le serpent est au nord-est du lit, dans la fosse, près des rochers fendus. Il frappe d'un coup sec."],
        complete: [
            "Il a cessé de siffler ? Alors le gué est à moi de nouveau ! Quant à ma perche, je la retrouverai bien un jour.",
            "Voici une poignée de limon sacré, ramassé sous la dernière flaque du fleuve : on dit qu'il donne aux flèches la mémoire de l'eau. Et un peu d'or, pour le dérangement."
        ],
        reward: { gold: 55, fragment: 'Limon sacré' }
    },
    {
        id: 'sq_drowned', side: true,
        title: 'Le métier de Mei',
        chapter: '✦ Quête secondaire — Lit du Fleuve Jaune',
        giver: 'weaver_mei', turnIn: 'weaver_mei', requires: ['q_sun_1'],
        objectives: [{ type: 'killGroup', target: 'drowned', text: 'Renvoyer dormir les 2 noyés revenants (nord du lit du fleuve)' }],
        offer: [
            "Seigneur archer… Je suis Mei, tisserande. Mon métier à tisser est resté sur la rive nord, avec les fils de soie que je gardais pour la mariée du village. Mais deux noyés sont remontés de la boue, et ils s'y sont installés comme chez eux.",
            "Je n'ose pas leur parler. Pourriez-vous les renvoyer dormir ? Ils ne vous feront pas de mal… enfin, pas beaucoup."
        ],
        hint: ["Les deux noyés rôdent dans la partie nord du lit, près de mon métier. Ils sont lents, mais ils frappent fort."],
        complete: [
            "Mon métier ! Les fils sont intacts. Le dernier noyé m'a même laissé son sourire, ou ce qu'il en reste.",
            "Prenez cette soie de ver céleste : elle est assez fine pour qu'une flèche passe à travers un anneau. Et ces pièces, pour que vous ayez de quoi manger."
        ],
        reward: { gold: 60, fragment: 'Soie de ver céleste' }
    },
    {
        id: 'sq_bell', side: true,
        title: 'La cloche du temple',
        chapter: '✦ Quête secondaire — Forêt de Bambous Calcinée',
        giver: 'monk_zhen', turnIn: 'monk_zhen', requires: ['q_sun_2'],
        objectives: [{ type: 'chest', target: 'temple_bell', text: 'Retrouver la cloche du temple sous les cendres (coin nord-ouest, près des ruines)' }],
        offer: [
            "Mon temple ne chante plus. Quand le Soleil de Cendres a brûlé la forêt, notre petite cloche de bronze est tombée dans les décombres, au nord-ouest. Sans elle, je ne sais plus à quelle heure prier.",
            "Pouvez-vous la retrouver ? Je ne demande ni gloire ni or : juste un son.",
            "Un jeune archer est venu méditer ici l'autre jour. Il n'a pas réussi : sa respiration battait comme un tambour de guerre. Il m'a demandé s'il existe un breuvage qui épargne la mort. Je lui ai répondu : oui, le temps."
        ],
        hint: ["La cloche est sous les cendres, dans le coin nord-ouest, à côté du temple brûlé. Aucun ennemi ne la garde."],
        complete: [
            "La voilà ! Un peu noircie, un peu fêlée, mais elle chante encore. Écoutez : c'est le son d'un monde qui continue.",
            "Prenez ce cinabre du temple, la poudre rouge qui scelle les talismans. Et ces pièces, offertes par les villageois."
        ],
        reward: { gold: 50, fragment: 'Cinabre du temple' }
    },
    {
        id: 'sq_old_pine', side: true,
        title: 'Le Vieux Pin Noir',
        chapter: '✦ Quête secondaire — Forêt de Bambous Calcinée',
        giver: 'herbalist_xu', turnIn: 'herbalist_xu', requires: ['q_sun_2'],
        objectives: [{ type: 'kill', target: 'old_pine', text: 'Apaiser le Vieux Pin Noir (coin sud-ouest de la forêt)' }],
        offer: [
            "Je cherche des plantes, seigneur. Elles ont toutes brûlé sauf une, qui pousse dans le coin sud-ouest, juste sous le Vieux Pin Noir, un esprit-arbre qui a perdu la tête dans l'incendie.",
            "Il n'attaque que lorsqu'on s'approche trop près. Pouvez-vous l'apaiser ? Ou l'abattre, s'il ne veut pas être apaisé."
        ],
        hint: ["Le Vieux Pin Noir est dans le coin sud-ouest de la forêt, au bord de la zone brûlée. Il charge quand on l'approche."],
        complete: [
            "Il s'est éteint comme une bougie. Je crois qu'il me remercie. La plante est sauve, regardez : une seule feuille, mais verte.",
            "Prenez cette sève de bambou, mise en gourde : elle rend la flèche légère. Et ces pièces, pour l'effort."
        ],
        reward: { gold: 75, fragment: 'Sève de bambou' }
    },
    {
        id: 'sq_oasis', side: true,
        title: "La cache de l'oasis",
        chapter: '✦ Quête secondaire — Désert de Gobi',
        giver: 'guide_dawa', turnIn: 'guide_dawa', requires: ['q_sun_3'],
        objectives: [{ type: 'chest', target: 'oasis_cache', text: "Retrouver la cache de l'oasis (coin nord-ouest du Gobi, près des tentes)" }],
        offer: [
            "Un guide du Gobi ne se perd jamais, seigneur. Mais il laisse parfois des choses derrière lui. J'ai enterré, il y a longtemps, une cache de rosée d'oasis dans le coin nord-ouest, sous une dalle rouge.",
            "Allez la chercher avant que le sable ne la mange. Et méfiez-vous de ce qui scintille au loin : un mirage n'a ni ombre ni poids, alors que tout ce qui est vrai écrase le sable de son ombre."
        ],
        hint: ["La cache est enterrée dans le coin nord-ouest, près des tentes du marchand. Évitez de suivre les silhouettes qui scintillent au loin."],
        complete: [
            "Elle est intacte ! La rosée d'oasis ne se perd jamais, voyez-vous : elle attend qu'on la boive.",
            "Gardez-en pour vos flèches, elles tiendront la soif du désert. Et prenez ces pièces : un guide paie toujours ses dettes."
        ],
        reward: { gold: 45, fragment: "Rosée d'oasis" }
    },
    {
        id: 'sq_bandits', side: true,
        title: 'La caravane de Ma',
        chapter: '✦ Quête secondaire — Désert de Gobi',
        giver: 'merchant_ma', turnIn: 'merchant_ma', requires: ['q_sun_3'],
        objectives: [{ type: 'killGroup', target: 'sand_bandits', text: 'Chasser les 2 brigands du Gobi (sud-ouest du désert, sur la piste des caravanes)' }],
        offer: [
            "Seigneur, un mot ? Je suis Ma, marchand. Deux brigands attaquent ma caravane chaque semaine, au sud-ouest, là où la piste tourne. Ils ne volent pas seulement : ils cassent tout ce qu'ils n'emportent pas.",
            "Si vous pouviez les calmer, mon cœur et mon chargement vous en seraient reconnaissants.",
            "Un caravanier m'a parlé d'un archer qui courait vers l'Occident sans boire ni dormir. « Il fuit quelque chose, disait-il, ou il court après. » Je ne sais pas lequel est pire."
        ],
        hint: ["Les brigands tiennent le sud-ouest du Gobi, sur la piste des caravanes : un gladiateur et une lame masquée."],
        complete: [
            "La piste est libre ! Mes chameaux marchent la tête haute, et mon cœur bat de nouveau régulièrement.",
            "Prenez ce verre du désert, ramassé là où la foudre a frappé le sable : il est dur comme le ciel. Et ces pièces, pour votre peine."
        ],
        reward: { gold: 85, fragment: 'Verre du désert' }
    },
    {
        id: 'sq_thunder_wyrm', side: true,
        title: 'Le dragon-serpent du tonnerre',
        chapter: '✦ Quête secondaire — Monts du Tonnerre',
        giver: 'smith_tie', turnIn: 'smith_tie', requires: ['q_sun_4'],
        objectives: [{ type: 'kill', target: 'thunder_wyrm', text: 'Terrasser le dragon-serpent du tonnerre (coin nord-est des monts, sur la crête)' }],
        offer: [
            "Alors c'est vous, l'archer ? Bien. Je suis Tie, forgeron de flèches. Un dragon-serpent du tonnerre a niché dans le coin nord-est des monts, sur la crête où frappe l'éclair. Il en fait des perles de foudre, que je ne peux plus récolter.",
            "Battez-le, et je vous en garde une, enfermée dans du verre : de la foudre en bouteille, pour la pointe de votre meilleure flèche."
        ],
        hint: ["Le dragon-serpent du tonnerre est dans le coin nord-est, sur la crête. Il lance des éclairs : ne restez pas à découvert."],
        complete: [
            "Il est tombé ? Alors voici : de la foudre en bouteille, la dernière perle qu'il a faite. N'ouvrez jamais le bouchon sans vouloir tirer.",
            "Et ces pièces, gagnées à la sueur de votre front, et de mon enclume. Quand vous reviendrez, je vous referai toutes vos flèches."
        ],
        reward: { gold: 100, fragment: 'Foudre en bouteille' }
    },
    {
        id: 'sq_lei_drum', side: true,
        title: 'Le tambour du tonnerre',
        chapter: '✦ Quête secondaire — Monts du Tonnerre',
        giver: 'hermit_lei', turnIn: 'hermit_lei', requires: ['q_sun_4'],
        objectives: [{ type: 'chest', target: 'lei_drum', text: 'Retrouver le tambour du tonnerre (coin nord-ouest des Monts du Tonnerre)' }],
        offer: [
            "Je parle au tonnerre depuis trente ans, archer. Un jour, il m'a répondu, et il m'a demandé un tambour. J'en ai fabriqué un avec une peau de nuage, mais le vent l'a emporté dans le coin nord-ouest de la montagne.",
            "Rapportez-le-moi, et je vous donnerai un peu de vent céleste, celui qui court sous les nuages. Il rend les flèches droites comme la vérité.",
            "Le tonnerre m'a prévenu : un arc sera tendu contre un autre arc avant la fin de l'histoire. Je ne sais pas lequel des deux se brisera."
        ],
        hint: ["Le tambour est tombé dans le coin nord-ouest, près de ma hutte. Aucun ennemi ne le garde ; seul le vent s'en amuse."],
        complete: [
            "Mon tambour ! Écoutez comme il sonne. Le tonnerre va être content, il s'ennuyait.",
            "Voici le vent céleste que je vous ai promis, enfermé dans cette gourde : à n'ouvrir qu'en tirant. Et ces pièces, pour votre peine."
        ],
        reward: { gold: 70, fragment: 'Vent céleste' }
    },
    {
        id: 'sq_ore', side: true,
        title: 'La veine de cinabre',
        chapter: '✦ Quête secondaire — Gorges du Volcan',
        giver: 'miner_shan', turnIn: 'miner_shan', requires: ['q_sun_5'],
        objectives: [{ type: 'killGroup', target: 'ore_guards', text: 'Chasser les 2 pixiu de magma (nord-est des gorges, au-delà du défilé)' }],
        offer: [
            "Seigneur archer ! Je suis Shan, mineur. Deux pixiu de magma gardent la veine de cinabre, au nord-est de la gorge, derrière la barrière de lave. Impossible d'en tirer un grain de minerai sans se faire charger.",
            "Je suis prêt à vous payer tout ce que j'ai, et à vous offrir un morceau d'obsidienne vive, la plus noire que j'aie jamais taillée.",
            "Prenez garde au défilé, en chemin : un jeune archer y est passé tout à l'heure et vous attend, l'arc tendu. Un garçon qui a faim, voilà ce que j'ai vu. Un garçon qui a faim."
        ],
        hint: ["Les deux pixiu de magma gardent la veine au nord-est des gorges, passé le défilé. Ils chargent la tête baissée."],
        complete: [
            "Voilà la veine libre ! Mes pioches vont chanter.",
            "Voici l'obsidienne vive que je vous avais promise. Elle tranche le feu, dit-on. Et mon or : ne le dépensez pas en gâteaux, ma femme les fait mieux."
        ],
        reward: { gold: 110, fragment: 'Obsidienne vive' }
    },
    {
        id: 'sq_ember', side: true,
        title: 'La braise du phénix',
        chapter: '✦ Quête secondaire — Gorges du Volcan',
        giver: 'priestess_yan', turnIn: 'priestess_yan', requires: ['q_sun_5'],
        objectives: [{ type: 'chest', target: 'phoenix_brazier', text: 'Rapporter la cendre du brasero du phénix (coin nord-ouest, derrière le sanctuaire)' }],
        offer: [
            "Autrefois, je servais les soleils. J'ai rallumé chaque aube un brasero de cendre de phénix, près du sanctuaire, au nord-ouest. Depuis que les soleils sont devenus fous, ce brasero est abandonné.",
            "Récupérez-en la cendre. Elle n'a plus de maître, et je ne veux pas qu'un autre la prenne pour de mauvaises raisons.",
            "Je connais le regard de l'archer qui vous guette au défilé : celui d'un garçon qui croit que le monde lui doit quelque chose. J'ai eu ce regard, à seize ans, devant l'autel d'un soleil."
        ],
        hint: ["Le brasero est à l'ouest, dans l'enceinte du vieux temple du feu, derrière le sanctuaire. Rien ne le garde."],
        complete: [
            "La cendre de phénix… Elle est encore tiède, comme si l'oiseau venait de s'envoler.",
            "Prenez-la : c'est pour vos flèches, pour qu'elles renaissent à chaque tir. Et ces pièces. Je n'ai plus besoin de rien d'autre que de votre pardon."
        ],
        reward: { gold: 80, fragment: 'Cendre de phénix' }
    },
    {
        id: 'sq_scarred_tiger', side: true,
        title: 'Balafré',
        chapter: '✦ Quête secondaire — Plaine des Fauves',
        giver: 'hunter_wu', turnIn: 'hunter_wu', requires: ['q_sun_6'],
        objectives: [{ type: 'kill', target: 'scarred_tiger', text: 'Abattre Balafré, le tigre embrasé (coin nord-est de la plaine)' }],
        offer: [
            "Seigneur archer, je vous attendais. Je suis Wu, chasseur. Balafré, un tigre embrasé, rôde dans le coin nord-est de la plaine : il m'a laissé cette cicatrice, et il a tué mon meilleur chien.",
            "Je ne vous demande pas de tuer pour tuer : la chaleur l'a rendu fou. Mais si vous ne l'arrêtez pas, il mettra le feu au village des bergers."
        ],
        hint: ["Balafré rôde dans le coin nord-est de la plaine, derrière les ennemis de la lisière. Il est rapide : visez avant qu'il charge."],
        complete: [
            "Balafré est tombé… J'avais cru éprouver de la haine. Je n'éprouve que de la fatigue.",
            "Prenez ce croc, il est encore chaud : il aiguisera la pointe de vos flèches. Et ces pièces, pour un chasseur honnête."
        ],
        reward: { gold: 130, fragment: 'Croc de tigre embrasé' }
    },
    {
        id: 'sq_zi_bell', side: true,
        title: 'La clochette du bélier',
        chapter: '✦ Quête secondaire — Plaine des Fauves',
        giver: 'shepherd_zi', turnIn: 'shepherd_zi', requires: ['q_sun_6'],
        objectives: [{ type: 'chest', target: 'zi_bell', text: "Retrouver la clochette du troupeau (sud-ouest de la plaine, derrière l'enclos)" }],
        offer: [
            "Seigneur, je suis Zi. Mon troupeau s'est enfui à cause des flammes, mais la clochette de mon bélier-guide est restée derrière l'enclos, au sud-ouest. Sans elle, les bêtes ne reviendront pas.",
            "Je ne peux pas aller la chercher : la meute rôde plus loin. Vous qui avez de bonnes jambes…"
        ],
        hint: ["La clochette est derrière l'enclos, au sud-ouest de la plaine, loin de la meute. Passez par le sud : c'est le plus sûr."],
        complete: [
            "Ma clochette ! Écoutez comme elle tinte : mes bêtes vont l'entendre de loin et rentrer comme des enfants.",
            "Prenez cette laine de nuage, tressée par mes brebis : légère comme l'air, elle étouffe le bruit des flèches. Et ces pièces."
        ],
        reward: { gold: 60, fragment: 'Laine de nuage' }
    },
    {
        id: 'sq_nets', side: true,
        title: 'Les filets déchirés',
        chapter: '✦ Quête secondaire — Rivage de la Mer Orientale',
        giver: 'fisher_hai', turnIn: 'fisher_hai', requires: ['q_sun_7'],
        objectives: [{ type: 'killGroup', target: 'net_cutters', text: 'Chasser les 2 serpents coupe-filets (nord-est de la grève)' }],
        offer: [
            "Seigneur archer, regardez mes filets : ils pendent en lambeaux. Deux serpents de mer, échoués au nord-est de la grève, les ont déchirés pour s'en faire un nid. Sans filets, pas de poisson ; sans poisson, pas de village.",
            "Ils ont perdu l'eau, ils ont perdu la raison. Si vous pouvez les calmer, je vous donnerai la pierre de glace que je garde dans ma glacière : la dernière du rivage."
        ],
        hint: ["Les serpents coupe-filets sont au nord-est de la grève, sur les rochers. Ils mordent vite, mais sont lents à tourner."],
        complete: [
            "Mes filets ! Presque entiers. On les raccommodera ce soir, en chantant.",
            "Voici la pierre de glace, comme promis : elle garde le poisson frais trois jours, et la flèche froide une vie. Et ces pièces."
        ],
        reward: { gold: 95, fragment: 'Pierre de glace' }
    },
    {
        id: 'sq_pearl', side: true,
        title: 'La perle du Roi-Dragon',
        chapter: '✦ Quête secondaire — Rivage de la Mer Orientale',
        giver: 'envoy_longwang', turnIn: 'envoy_longwang', requires: ['q_sun_7'],
        objectives: [{ type: 'chest', target: 'dragon_pearl', text: 'Retrouver la perle du Roi-Dragon (coin sud-ouest de la grève)' }],
        offer: [
            "Archer, une faveur. J'ai laissé tomber la perle de mon maître en traversant la grève, au sud-ouest. Sans elle, je ne puis rentrer au palais ; avec elle, le Roi-Dragon pourra enfin pleurer, et sa mer avec lui.",
            "Récupérez-la. Je suis tenu de ne pas quitter mon poste, et je tremble à l'idée que le sable l'ait avalée.",
            "Mon maître m'a chargé d'ajouter ceci : la Reine Mère de l'Occident n'offre pas son élixir à n'importe qui. Elle sait lire dans les cœurs. Elle a vu quelque chose dans le vôtre, et quelque chose dans un autre, qu'elle n'a pas aimé."
        ],
        hint: ["La perle est dans le coin sud-ouest de la grève, juste au-dessus de la ligne d'eau. Aucun ennemi ne la garde."],
        complete: [
            "La perle ! Elle est intacte ! Le Roi-Dragon vous en sera redevable dix mille ans.",
            "En gage de sa gratitude, voici une écaille de dragon, détachée de sa propre barbe. Vos flèches voleront aussi droit que la mer. Et ces pièces d'or."
        ],
        reward: { gold: 140, fragment: 'Écaille de dragon' }
    },
    {
        id: 'sq_crane', side: true,
        title: 'Le nid de la grue',
        chapter: '✦ Quête secondaire — Cime du Fusang',
        giver: 'crane_envoy', turnIn: 'crane_envoy', requires: ['q_sun_8'],
        objectives: [{ type: 'chest', target: 'crane_nest', text: 'Rapporter les plumes du nid de grue (coin nord-ouest du Fusang, derrière le pavillon)' }],
        offer: [
            "Archer, ma sœur la grue a perdu ses petits, et son nid, au nord-ouest de l'Arbre, ne tient plus qu'à un fil. J'ai besoin de quelqu'un d'adroit pour y ramasser les dernières plumes avant la pluie.",
            "La Reine Mère en fait des flèches de messager : celles qui ne manquent jamais ceux qu'on aime.",
            "Un jeune archer est venu frapper à sa porte, il y a quelques semaines. Il demandait un élixir pour lui seul. Elle a refusé avec bonté : « Cet élixir est déjà promis. » Je n'ai jamais vu quelqu'un pâlir ainsi, ni sourire en même temps."
        ],
        hint: ["Le nid est dans le coin nord-ouest du Fusang, derrière le pavillon. Aucun ennemi ne le garde."],
        complete: [
            "Elles sont intactes… et chaudes. Ma sœur vous remercie, à sa manière : par ce cri que vous entendrez cette nuit.",
            "Voici une plume de grue, choisie pour vous : elle guide la flèche, même dans le vent. Et ces pièces d'or, de la part de la Reine Mère."
        ],
        reward: { gold: 70, fragment: 'Plume de grue' }
    }
];

// Monde final : les 10 sanctuaires ci-dessus, précédés de villages et de zones sauvages (world/).
const WORLD = assembleWorld(BASE_SCREENS, BASE_QUESTS);
// L'Arène des Mille Flèches (arena.js) : parvis + salles des huit cercles, hors de la chaîne des régions.
export const SCREENS = { ...WORLD.screens, ...buildArenaScreens() };
export const QUESTS = WORLD.quests;

// Écran d'arrivée d'une région depuis la carte du monde : son village quand il existe, sinon son sanctuaire.
export const REGION_ENTRY_SCREEN = Object.fromEntries(
    ['rizieres', 'fleuve', 'bambous', 'gobi', 'tonnerre', 'volcan', 'fauves', 'mer', 'fusang', 'lune']
        .map(region => [region, SCREENS[`${region}_village`] ? `${region}_village` : region])
);

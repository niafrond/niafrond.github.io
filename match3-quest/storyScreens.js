// Écrans de base de l'histoire (un par région/sanctuaire : décor, PNJ, ennemis, coffres, sorties).
// Données pures, extraites de story.js ; le format est décrit en tête de story.js.
import { MIRROR_TALKS, FENGMENG_SPEAKER } from './storyMirror.js';

export const BASE_SCREENS = {
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
            { id: 'change', x: 2, y: 3, name: "Chang'e", title: 'Épouse de Hou Yi', hideWhen: 'sun_9',
              idle: [
                  "Te voilà, mon archer ! Les gâteaux de lune sont encore tièdes : prends-en pour la route. Haricot rouge pour le courage, taro pour la patience.",
                  "Le doyen Wen t'attend près de la digue, avec le décret de l'empereur. Écoute-le avec le cœur : Yao ne demande jamais pour rien."
              ],
              talk: [
                  { whenDone: 'fengmeng_1', lines: [
                      "Fengmeng est rentré en riant, la poussière de la digue plein les manches. Il a même demandé une seconde part de gâteau.",
                      "Vous vous êtes bien battus tous les deux, et sans vous faire de mal : c'est tout ce que je demande à un entraînement.",
                      "Et toi, montre tes doigts. La corde t'a encore entaillé. Donne : un peu de baume, un nœud de lin, et tu pourras aller décrocher tes soleils."
                  ] },
                  { whenDone: 'sun_1', lines: [
                      "Tu disais que tu n'aurais plus le courage de repartir, si tu passais la porte ? Te voilà pourtant.",
                      "Prends ce gâteau et file aux Gorges du Volcan : la fraîcheur y manque autant que le courage.",
                      "Je prie la Lune chaque soir pour qu'elle te ramène. Elle écoute, tu sais : la preuve, elle nous prête sa lumière pour nous parler."
                  ] },
                  { whenDone: 'fengmeng_2', lines: [
                      "Fengmeng est passé ce matin, la poussière de l'Occident et la cendre des gorges sur ses bottes. Il n'a pas voulu de thé.",
                      "Il a demandé si l'élixir était toujours sur l'autel. J'ai répondu que oui… et il a souri. Je n'aime pas ce sourire.",
                      "Ne fais pas cette tête : je ne te le dis pas pour que tu rebrousses chemin. Finis ce que tu as commencé. J'ai pétri assez de pâte pour avoir des bras."
                  ] },
                  { whenDone: 'sun_6', lines: [
                      "Deux soleils… Mon archer, ta main tremble sur ton arc, même quand tu dors. Rentre vite.",
                      "J'ai gardé la fiole contre ma poitrine, cette nuit, comme on garde un enfant. Et ma moitié de miroir sous l'oreiller, pour que la lune me trouve."
                  ] },
                  { whenDone: 'sun_4', lines: [
                      "Penche-toi : tu as du sable jusque dans le chignon. Là… Voilà mon mari, et pas un mirage.",
                      "Ne ris pas : certains soirs, je t'entends rentrer, et ce n'est que le vent qui pousse la porte. Assieds-toi. Ton bol est chaud, pour une fois."
                  ] },
                  { whenDone: 'sun_2', lines: [
                      "Tu sens la vase et les saules. Assieds-toi, que je t'ôte ces bottes : on dirait que tu as traversé le fleuve à pied, et pas en barque.",
                      "J'ai mis de côté une lanterne de papier rouge pour la fête. Cette année, au gué, c'est toi qui la lâcheras. Et sans flèche."
                  ] },
                  { whenDone: 'sun_3', lines: [
                      "Tu as les yeux rougis par la fumée. Mange ce gâteau, il est au thé vert, comme tu les aimes. Et ne dis pas « parfait » s'il ne l'est pas.",
                      "Je regarde parfois la fiole d'élixir sur l'autel des ancêtres. Une gorgée pour vivre longtemps, la fiole entière pour monter au ciel.",
                      "Nous la garderons pour nos vieux jours, et nous la boirons à deux : une gorgée chacun, pas davantage."
                  ] },
                  { whenDone: 'sun_5', lines: [
                      "Tu sens la pluie. Donne-moi ce poignet… Voilà : un fil rouge. L'autre bout est noué au mien.",
                      "Les vieilles disent que le fil des époux ne casse jamais ; il s'étire, c'est tout.",
                      "Ne l'enlève pas, même pour tirer. S'il te gêne, c'est que tu penses à moi : tant mieux."
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
            { id: 'elder_wen', x: 4, y: 2, name: 'Doyen Wen', title: 'Doyen du village', 
              idle: [
                  "Le riz ne pousse plus, mais les enfants rient encore : c'est cela qui me tient debout. Prenez soin de vous, Hou Yi.",
                  "Si le courage vous manque, passez chez Dame Chang'e : un gâteau de lune a remis sur pied plus d'un guerrier."
              ],
              talk: [
                  { whenDone: 'sun_1', lines: [
                      "Le ciel est plus clément ; mes vieux os le sentent. Les enfants ont osé sortir jouer dans la boue.",
                      "Poursuivez vers l'est, jusqu'aux Gorges du Volcan : on dit que la prêtresse Yan y veille encore sur les cendres d'un vieux temple."
                  ] },
                  { whenDone: 'sun_9', lines: [
                      "Neuf soleils abattus ! Les chroniques de l'Empire parleront de vous pendant dix mille ans.",
                      "Mais… la maison de Dame Chang'e est vide, la porte forcée. Les voisins parlent d'une grue blanche, et d'un archer pressé.",
                      "Hou Yi, faites vite."
                  ] },
                  { whenDone: 'q_epilogue', lines: [
                      "On raconte déjà votre histoire au coin du feu, Hou Yi. Les enfants l'ont mise en chanson, et ils en changent la fin à chaque fois.",
                      "Chaque automne, nous poserons des gâteaux de lune sur les toits. Que celle qui les reçoit sache qu'ils viennent de très loin, et de très bon cœur."
                  ] }
              ] },
            { id: 'farmer_lin', x: 1, y: 7, name: 'Lin', title: 'Paysan désespéré', 
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
            { id: 'fengmeng_1', templateId: 'fengmeng_1', name: 'Fengmeng, le Disciple', kind: 'sentinel', x: 6, y: 4, scaledAggro: 3, sight: 1, allAround: true, seal: 'x',
              permanent: true, boss: { name: 'Fengmeng, le Disciple', level: 4 },
              defeatScene: {
                  speaker: FENGMENG_SPEAKER('fengmeng_1'),
                  lines: [
                      "Touché, Maître ! Vous n'avez pas faibli d'un pouce. Ce n'était qu'un entraînement, et j'en sors plus fort : mon bras tremble de plaisir, pas de honte.",
                      "Dix ans que je tends l'arc derrière vous, et j'apprends encore à chaque duel. Un jour, je viserai aussi juste que mon Maître.",
                      "Allez abattre votre soleil. Je vous suivrai de loin. Après tout, il faut bien que quelqu'un vous couvre."
                  ]
              } },
            { id: 'rizieres_goblin', templateId: 'huli_jing', name: 'Démon-renard farceur', kind: 'sentinel', x: 5, y: 8, offset: -1 },
            { id: 'rizieres_shroom', templateId: 'lingzhi_maudit', name: 'Lingzhi maudit', kind: 'sentinel', x: 9, y: 7, offset: 0 },
            { id: 'rizieres_guardian', templateId: 'shu_jing', name: 'Esprit des digues', kind: 'patrol', x: 8, y: 9, patrol: [[8, 9], [12, 9]], offset: 0 },
            // Chapardeur nommé (quête secondaire), côté est de la digue.
            { id: 'rice_thief', templateId: 'huli_jing', name: 'Le démon chapardeur', kind: 'sentinel', x: 12, y: 6, offset: 1, permanent: true },
            { id: 'sun_1', templateId: 'sun_1', name: 'Soleil Ardent', kind: 'sentinel', x: 11, y: 2,
              permanent: true, boss: { name: 'Soleil Ardent', level: 6 },
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
            "Quelque part à l'est, dans le sanctuaire des rochers fendus, le quatrième soleil a bu le fleuve jusqu'à la dernière goutte."
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
            { id: 'ferryman_gu', x: 3, y: 6, name: 'Gu', title: 'Passeur du fleuve', 
              idle: [
                  "Trente ans que je passe les gens d'une rive à l'autre. Maintenant il n'y a plus de rive, juste de la boue, et ma vieille barque qui rêve d'eau.",
                  "Un jeune archer pressé est passé hier, en pestant contre la poussière. Il voulait le chemin le plus court vers l'Occident. Je lui ai montré la piste des caravanes."
              ],
              talk: [
                  { whenDone: 'sq_river_serpent', lines: [
                      "Plus de serpent au gué ! Les voyageurs vont pouvoir passer en chantant.",
                      "Et s'ils n'ont pas de pièces, je les passerai contre des gâteaux de lune : c'est la monnaie de ce temps."
                  ] },
                  { whenDone: 'sun_2', lines: [
                      "L'eau ! Elle revient ! Je l'ai entendue avant de la voir, comme une vieille chanson. Ma barque flotte…",
                      "Prenez la rive est, seigneur archer : je vous y passerai gratuitement, pour toujours."
                  ] }
              ] },
            { id: 'weaver_mei', x: 2, y: 2, name: 'Mei', title: 'Tisserande', 
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
              ] },
            // Chemin relationnel du soleil 4 : après la quête de Mei, le doyen des noyés parlemente et rappelle ses gardes (`unsealedBy`).
            { id: 'parley_sun2', x: 10, y: 8, name: 'Yuan', title: 'Doyen des noyés', showWhen: 'sq_drowned', hideWhen: ['sun2_wardens_a', 'sun2_wardens_b'],
              parley: { lines: [
                  "Posez votre arc, seigneur archer. Je suis Yuan, le plus ancien des noyés de ce fleuve, et je ne suis pas venu pour me battre.",
                  "Mes gens ne gardent pas ce soleil par amour. Il a bu le fleuve : tant qu'il le tient, nous n'avons plus de lit où dormir.",
                  "On m'a dit que vous aviez renvoyé dormir les noyés de Mei sans les humilier. Un archer qui sait cela mérite d'être écouté.",
                  "Abattez le soleil, rendez-nous l'eau. Mes gardes s'écartent : ils n'ont jamais voulu que retrouver le courant."
              ] },
              idle: [
                  "Chut. Le fleuve est mort, mais nous l'écoutons encore.",
                  "Les roches fendues gardent l'écho de l'eau. Venez, si vous avez le cœur patient."
              ],
              talk: [
                  { whenDone: 'parley_sun2', lines: [
                      "Mes gardes se sont retirés dans la boue. Ils attendent le courant, comme moi.",
                      "Tirez sans crainte : le soleil est seul, maintenant. Et que l'eau revienne vite."
                  ] },
                  { whenDone: 'sun_2', lines: [
                      "Entendez-vous ? Le courant ! Mes gens dorment dans le lit, enfin. Allez, seigneur archer, et que le fleuve vous porte."
                  ] }
              ] }
        ],
        enemies: [
            // Noyés revenants (quête secondaire de Mei), nord du lit.
            { id: 'drowned_a', templateId: 'gui_guerrier', name: 'Noyé revenant', kind: 'sentinel', x: 8, y: 1, offset: 0, permanent: true, group: 'drowned' },
            { id: 'drowned_b', templateId: 'gui_guerrier', name: 'Noyé revenant', kind: 'sentinel', x: 10, y: 2, offset: 0, permanent: true, group: 'drowned' },
            // Vieux serpent nommé (quête secondaire de Gu), coin nord-est.
            { id: 'river_serpent', templateId: 'jiaolong', name: 'Serpent du Fleuve Jaune', kind: 'sentinel', x: 12, y: 1, offset: 0, permanent: true },
            // Carpe dorée nommée (quête secondaire de Gu : elle devient la compagne Yu), nord-ouest du lit.
            { id: 'golden_carp', templateId: 'carpe_doree', name: 'Carpe dorée du gué', kind: 'sentinel', x: 3, y: 2, offset: 0, permanent: true },
            { id: 'fleuve_doctor', templateId: 'wen_shen', name: 'Docteur-démon des vases', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            { id: 'fleuve_lich', templateId: 'gui_esprit', name: 'Taoïste-squelette du gué', kind: 'sentinel', x: 4, y: 9, offset: 0 },
            // Gardes du sanctuaire : tant qu'ils vivent, sun_2 est intouchable, sauf pourparlers (parley_sun2 : ils s'écartent, `hideWhen`).
            { id: 'sun2_wardens_a', templateId: 'noye_garde', name: 'Noyé-garde des roches', kind: 'sentinel', x: 9, y: 7, offset: 2, permanent: true, group: 'sun2_wardens', hideWhen: 'parley_sun2' },
            { id: 'sun2_wardens_b', templateId: 'noye_garde', name: 'Noyé-garde des roches', kind: 'sentinel', x: 13, y: 9, offset: 2, permanent: true, group: 'sun2_wardens', hideWhen: 'parley_sun2' },
            { id: 'sun_2', templateId: 'sun_2', name: 'Soleil des Eaux Taries', kind: 'sentinel', x: 11, y: 8,
              permanent: true, shieldedBy: 'sun2_wardens', unsealedBy: ['parley_sun2'], weakenedBy: ['sq_river_serpent', 'sq_drowned'], boss: { name: 'Soleil des Eaux Taries', level: 19 },
              afterScenes: MIRROR_TALKS.sun_2,
              shieldLines: [
                  "Le Soleil des Eaux Taries est tapi derrière un cercle de roches fendues, et deux noyés-gardes lui font un rempart de boue durcie.",
                  "Vos flèches s'enfonceraient dans la vase sans l'atteindre. Les gardes montent la garde depuis que l'eau s'est retirée : ils n'ont plus que lui.",
                  "Renvoyez-les à la boue, et le rempart s'effondrera. (Le serpent du gué et les noyés de Mei, que vous aurez calmés, affaibliront le soleil.)",
                  "Au pied des roches, un vieux noyé guette le fleuve disparu. Il ne se montre, dit-on, qu'à ceux qui ont su laisser dormir les siens."
              ] }
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
            "Le cinquième soleil a incendié la forêt et s'est installé à l'est, près des ruines d'un temple."
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
            { id: 'monk_zhen', x: 4, y: 2, name: 'Zhen', title: 'Moine du temple brûlé', 
              idle: [
                  "Paix à vous, voyageur. Je prie ce qu'il reste à prier : les cendres, le silence, et une cloche absente.",
                  "Un jeune archer est venu méditer ici, sa respiration battait comme un tambour de guerre. Il voulait un breuvage contre la mort. Je lui ai répondu : le temps."
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
            { id: 'herbalist_xu', x: 3, y: 8, name: 'Xu', title: 'Herboriste', 
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
              ] },
            // Chemin relationnel du soleil 3 : une fois la cloche rendue, son âme parle et rappelle les deux échos qui gardent le soleil.
            { id: 'parley_sun3', x: 11, y: 3, name: 'Tintement', title: 'Âme de la cloche fêlée', showWhen: 'sq_bell', hideWhen: ['sun3_wardens_a', 'sun3_wardens_b'],
              parley: { lines: [
                  "Dong. Ne tirez pas, archer. Je suis ce qui sonne dans la cloche quand personne ne la touche.",
                  "Les deux esprits qui tournent autour du soleil sont mes échos. Quand le temple a brûlé, ils ont perdu leur cloche. Ils ont suivi la chaleur.",
                  "Vous avez remis la cloche sur son pilier : elle sonne, et ils m'entendent. Un écho obéit toujours à sa voix.",
                  "Allez. Mes échos se rendormiront dans le bronze. Le soleil, lui, n'a plus personne pour l'entourer."
              ] },
              idle: [
                  "Dong… dong… Le bronze se souvient de l'heure.",
                  "Si vous m'entendez, c'est que la cloche tient encore. Approchez sans bruit."
              ],
              talk: [
                  { whenDone: 'parley_sun3', lines: [
                      "Mes échos reposent dans le bronze. Je ne sonne plus que pour la forêt.",
                      "Le soleil est seul sous la cloche. Visez juste, archer : la cendre n'attend plus que vous."
                  ] },
                  { whenDone: 'sun_3', lines: [
                      "La cendre se tait. Écoutez : la forêt apprend à respirer."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'bambous_assassin', templateId: 'assassin_masque', name: 'Ombre des cendres', kind: 'sentinel', x: 8, y: 1, offset: 0 },
            { id: 'bambous_fungus', templateId: 'lingzhi_maudit', name: 'Lingzhi maudit', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            { id: 'bambous_priestess', templateId: 'pretresse_lunaire', name: 'Prêtresse égarée', kind: 'sentinel', x: 12, y: 8, offset: 0 },
            // Esprit-arbre nommé (quête secondaire de Xu), coin sud-ouest.
            { id: 'old_pine', templateId: 'shu_jing', name: 'Vieux Pin Noir', kind: 'sentinel', x: 1, y: 9, offset: 0, permanent: true },
            // Gardes du sanctuaire : tant qu'ils vivent, sun_3 est intouchable, sauf pourparlers (parley_sun3 : ils s'écartent, `hideWhen`).
            { id: 'sun3_wardens_a', templateId: 'esprit_cloche', name: 'Esprit de la cloche', kind: 'sentinel', x: 9, y: 2, offset: 2, permanent: true, group: 'sun3_wardens', hideWhen: 'parley_sun3' },
            { id: 'sun3_wardens_b', templateId: 'esprit_cloche', name: 'Esprit de la cloche', kind: 'sentinel', x: 13, y: 2, offset: 2, permanent: true, group: 'sun3_wardens', hideWhen: 'parley_sun3' },
            { id: 'sun_3', templateId: 'sun_3', name: 'Soleil de Cendres', kind: 'sentinel', x: 11, y: 1,
              permanent: true, shieldedBy: 'sun3_wardens', unsealedBy: ['parley_sun3'], weakenedBy: ['sq_bell', 'sq_old_pine'], boss: { name: 'Soleil de Cendres', level: 24 },
              afterScenes: MIRROR_TALKS.sun_3,
              shieldLines: [
                  "Le Soleil de Cendres couve sous la cloche fêlée, et deux esprits du temple brûlé tournent autour de lui comme des cierges.",
                  "Tant qu'ils veillent, la cendre retombe sur chacune de vos flèches avant qu'elle n'atteigne le soleil.",
                  "Éteignez les esprits, un à un, et le soleil restera seul. (Réconforter la forêt avant lui l'affaiblira.)",
                  "Les esprits tournent au rythme d'un tintement qui n'existe plus. Qui rendrait sa voix à la cloche saurait peut-être leur parler."
              ] }
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
            "Le troisième soleil s'est multiplié en mirages. Dix mirages dansent sur les dunes ; un seul est réel, tapi au sud-est, et le sable murera la piste de l'est tant qu'il vivra."
        ],
        obstacles: [[4, 1, 2, 2], [7, 0, 1, 2], [7, 8, 1, 1], [9, 3, 1, 1], [9, 6, 1, 1], [12, 7, 1, 1]],
        liquids: [[0, 8, 2, 2]],
        paths: [[0, 4, 7, 1], [6, 4, 1, 2], [6, 5, 8, 1]],
        exits: [
            { x: 0, y: 4, to: 'bambous', arrive: { x: 12, y: 4 }, label: 'Forêt de Bambous Calcinée' },
            {
                x: 13, y: 5, to: 'tonnerre', arrive: { x: 1, y: 5 }, label: 'Monts du Tonnerre',
                requires: 'sun_4', wall: 'sand',
                lockedMessage: "Un mur de sable barre la piste de l'est : trouvez le vrai Soleil des Mirages, tapi au sud-est parmi ses doubles, et abattez-le."
            }
        ],
        npcs: [
            { id: 'merchant_ma', x: 3, y: 2, name: 'Ma', title: 'Marchand de caravane', 
              idle: [
                  "Soies, épices, thé de Pu'er ! … enfin, il me reste du thé et beaucoup d'espoir. Les affaires sont aussi sèches que le Gobi.",
                  "Un caravanier a vu un archer courir vers l'Occident sans boire ni dormir. « Il fuit quelque chose, ou il court après. » Je ne sais pas lequel est pire."
              ],
              talk: [
                  { whenDone: 'sq_bandits', lines: [
                      "Ma caravane a passé le col sans une égratignure ! Je vous ferai une remise sur tout ce que je vendrai en chemin, seigneur. Même sur le thé."
                  ] },
                  { whenDone: 'sun_4', lines: [
                      "Tout le désert est net, c'est presque indécent. Mes chameaux marchent droit pour la première fois depuis des semaines, et je ne sais plus sur quoi râler."
                  ] }
              ] },
            { id: 'guide_dawa', x: 3, y: 7, name: 'Dawa', title: 'Guide du désert', 
              idle: [
                  "Au Gobi, on apprend vite à douter de ses yeux. Un mirage vous fait des signes, vous sourit, vous promet de l'eau. Il ment comme les plus beaux.",
                  "Ne vous fiez pas à vos yeux : les mirages copient le vrai soleil jusqu'à son ombre et à son nom. Fiez-vous plutôt à vos pas.",
                  "Quand un mirage se défait, un autre se forme ailleurs, au hasard des dunes. Le vrai soleil, lui, ne bouge jamais : c'est celui qui reste toujours à la même place."
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
            { id: 'gobi_colossus', templateId: 'hundun', name: 'Colosse de sable', kind: 'sentinel', x: 6, y: 1, offset: 0 },
            // Mirages du Soleil des Mirages : même sprite que `sun_4`, ombre et niveau identiques ; ils changent de place quand on les dissipe.
            { id: 'mirage_1', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 9, y: 1,
              permanent: true, illusion: true,
              illusionLines: [
                  "Votre main traverse le soleil comme une fumée : un mirage, qui se dissipe en poussière de lumière.",
                  "Ce n'était pas lui. Le vrai soleil, lui, pèse sur le sable."
              ] },
            { id: 'mirage_2', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 12, y: 1,
              permanent: true, illusion: true,
              illusionLines: [
                  "Le disque ardent vacille, se déchire comme un voile de soie : encore un mirage.",
                  "Cherchez celui qui projette une ombre."
              ] },
            { id: 'mirage_3', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 8, y: 8,
              permanent: true, illusion: true,
              illusionLines: [
                  "L'image se plie en deux et s'évanouit, laissant une odeur de sable chaud.",
                  "Le désert se moque de vous, mais ses mensonges se font de plus en plus rares."
              ] },
            { id: 'mirage_4', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 11, y: 3,
              permanent: true, illusion: true,
              illusionLines: [
                  "Le soleil se plisse comme une page de sable et s'éparpille : un mirage de plus.",
                  "Ce n'était qu'un reflet. Le vrai pèse quelque part au sud-est."
              ] },
            { id: 'mirage_5', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 4, y: 5,
              permanent: true, illusion: true,
              illusionLines: [
                  "Votre flèche le traverse sans bruit : l'image tremble, puis s'efface dans la chaleur.",
                  "Trop brillant pour être vrai."
              ] },
            { id: 'mirage_6', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 8, y: 6,
              permanent: true, illusion: true,
              illusionLines: [
                  "Le disque se dérobe devant vous, léger comme une vapeur : encore un mirage.",
                  "Cherchez celui qui projette une ombre."
              ] },
            { id: 'mirage_7', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 5, y: 8,
              permanent: true, illusion: true,
              illusionLines: [
                  "Un souffle de sable et il n'y a plus rien : ce soleil-là n'avait pas de poids.",
                  "Le désert vous fait marcher en rond."
              ] },
            { id: 'mirage_8', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 9, y: 4,
              permanent: true, illusion: true,
              illusionLines: [
                  "Le mirage s'étire, se déchire et s'envole en poussière dorée.",
                  "Ce n'était pas lui."
              ] },
            { id: 'mirage_9', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 2, y: 6,
              permanent: true, illusion: true,
              illusionLines: [
                  "La silhouette ardente se dissout comme du sucre dans le thé.",
                  "Plus que quelques mensonges avant la vérité."
              ] },
            { id: 'mirage_10', spriteKey: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 10, y: 9,
              permanent: true, illusion: true,
              illusionLines: [
                  "L'illusion se fendille et retombe en pluie de grains brillants.",
                  "Le vrai soleil est tout près… et il ne bouge pas."
              ] },
            // Brigands nommés (quête secondaire de Ma), sud-ouest.
            { id: 'bandit_a', templateId: 'brigand_sables', name: 'Brigand du Gobi', kind: 'sentinel', x: 4, y: 9, offset: 0, permanent: true, group: 'sand_bandits' },
            { id: 'bandit_b', templateId: 'assassin_masque', name: 'Lame masquée du Gobi', kind: 'sentinel', x: 6, y: 9, offset: 0, permanent: true, group: 'sand_bandits' },
            { id: 'sun_4', templateId: 'sun_4', name: 'Soleil des Mirages', kind: 'sentinel', x: 11, y: 8,
              permanent: true, noDoorGuard: true, weakenedBy: ['sq_oasis', 'sq_carte_vraie'], boss: { name: 'Soleil des Mirages', level: 14 },
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
            "Le sixième soleil a fait de la montagne son enclume : il règne à l'est, au milieu des orages."
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
            { id: 'smith_tie', x: 3, y: 7, name: 'Tie', title: 'Forgeron de flèches', 
              idle: [
                  "Une flèche ne vaut que par sa pointe, et la pointe par la main qui l'a trempée. La mienne tremble : ces éclairs ne m'ont pas laissé dormir depuis des semaines.",
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
            { id: 'hermit_lei', x: 3, y: 1, name: 'Lei', title: 'Ermite du tonnerre', 
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
              ] },
            // Chemin relationnel du soleil 5 : le tambour de Lei rendu, la petite voix du tonnerre ordonne à ses frères de lâcher la cage.
            { id: 'parley_sun5', x: 11, y: 9, name: 'Rongrong', title: 'Petite voix du tonnerre', showWhen: 'sq_lei_drum', hideWhen: ['sun5_wardens_a', 'sun5_wardens_b'],
              parley: { lines: [
                  "Boum ! Ne tire pas, archer. Je suis Rongrong, la petite voix du tonnerre. Le vieux Lei m'a rendu mon tambour, alors je viens dire merci.",
                  "Le foudre-garde du col est mon grand frère, et le lion de pierre son vieux compagnon.",
                  "Le soleil les nourrit d'éclairs : ils tiennent sa cage et n'écoutent plus personne.",
                  "Ils croient défendre la montagne. La cage ne retient qu'un soleil qui a peur d'être éteint.",
                  "Je leur dis de la lâcher. Passe, archer. Mais ne tarde pas : un orage retenu finit toujours par éclater."
              ] },
              idle: [
                  "Boum… boum… C'est mon cœur, pas un orage. Enfin, presque.",
                  "Le tambour de Lei bat plus juste que le ciel. Je l'écoute."
              ],
              talk: [
                  { whenDone: 'parley_sun5', lines: [
                      "Mes frères ont lâché la cage. Ils boudent un peu, sur le col.",
                      "Le soleil est tout seul, maintenant. Vise bien : je ferai un roulement de tambour pour toi."
                  ] },
                  { whenDone: 'sun_5', lines: [
                      "Plus d'éclairs sur la crête. Je vais apprendre à rouler doucement, comme un chat qui ronronne."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'tonnerre_knight', templateId: 'lei_gong', name: 'Général du tonnerre', kind: 'sentinel', x: 8, y: 1, offset: 0 },
            { id: 'tonnerre_warden', templateId: 'suanni', name: 'Lion-gardien de pierre', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            // Dragon-serpent nommé (quête secondaire de Tie), coin nord-est.
            { id: 'thunder_wyrm', templateId: 'yinglong', name: 'Dragon-serpent du tonnerre', kind: 'sentinel', x: 12, y: 1, offset: 0, permanent: true },
            // Gardes du sanctuaire : tant qu'ils vivent, sun_5 est intouchable, sauf pourparlers (parley_sun5 : ils s'écartent, `hideWhen`).
            { id: 'sun5_wardens_a', templateId: 'foudre_garde', name: 'Foudre-garde du col', kind: 'sentinel', x: 9, y: 9, offset: 2, permanent: true, group: 'sun5_wardens', hideWhen: 'parley_sun5' },
            { id: 'sun5_wardens_b', templateId: 'suanni', name: 'Lion de pierre du col', kind: 'sentinel', x: 13, y: 8, offset: 2, permanent: true, group: 'sun5_wardens', hideWhen: 'parley_sun5' },
            { id: 'sun_5', templateId: 'sun_5', name: 'Soleil des Orages', kind: 'sentinel', x: 11, y: 8,
              permanent: true, shieldedBy: 'sun5_wardens', unsealedBy: ['parley_sun5'], weakenedBy: ['sq_thunder_wyrm', 'sq_lei_drum'], boss: { name: 'Soleil des Orages', level: 30 },
              afterScenes: MIRROR_TALKS.sun_5,
              shieldLines: [
                  "Une cage d'éclairs ceint le Soleil des Orages : un foudre-garde et un lion de pierre la tiennent tendue, d'un pylône à l'autre.",
                  "Aucune flèche ne traverse la cage tant que ses deux gardiens sont debout ; elle crépite à vous en faire dresser les cheveux.",
                  "Abattez les gardes, et la cage tombera. (Le dragon-serpent et le tambour de Lei, une fois réglés, affaibliront le soleil.)",
                  "Les gardes ne bougent qu'en mesure, comme au son d'un tambour lointain. Si le tonnerre retrouvait sa voix, ils l'écouteraient peut-être."
              ] }
        ],
        chests: [
            { id: 'lei_drum', x: 1, y: 0, gold: 10, label: 'Tambour du tonnerre' },
            { id: 'tonnerre_chest', x: 12, y: 5, gold: 100 },
            { id: 'spark_egg', x: 2, y: 1, gold: 10, label: 'Œuf de foudre' }
        ]
    },

    // ── 6. Gorges du Volcan : embuscade de Fengmeng ──────────────────────────
    volcan: {
        id: 'volcan', region: 'volcan', name: 'Gorges du Volcan', biome: 'volcano',
        w: 14, h: 10, spawn: { x: 1, y: 3 },
        arrival: [
            "Les Gorges du Volcan crachent un air épais. Des ruisseaux de magma découpent la roche noire ; le long des parois, on a taillé des marches pour une époque où l'on y vivait.",
            "Au milieu du défilé, une silhouette connue attend, l'arc déjà tendu : Fengmeng. Au-delà, le deuxième soleil."
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
            { id: 'miner_shan', x: 3, y: 7, name: 'Shan', title: 'Mineur', 
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
            { id: 'priestess_yan', x: 3, y: 2, name: 'Yan', title: 'Prêtresse du feu repentie', 
              idle: [
                  "Autrefois, j'allumais un brasero à l'aube pour saluer les soleils. Je croyais qu'ils étaient des dieux. Ils n'étaient que des enfants capricieux.",
                  "L'archer pressé qui vous suit depuis les rizières a ce regard-là : celui d'un garçon qui croit que le monde lui doit quelque chose. J'ai eu ce regard à seize ans."
              ],
              talk: [
                  { whenDone: 'sq_ember', lines: [
                      "La braise est entre de bonnes mains. Elle ne brûlera plus que pour renaître, et c'est tout ce que je lui souhaite.",
                      "Mon vieux maître, l'attiseur du temple, veille encore près du sanctuaire. Je lui ai fait dire que vous aviez sauvé la cendre : il vous écoutera."
                  ] },
                  { whenDone: 'sun_6', lines: [
                      "Je ne priais plus que par habitude. Aujourd'hui, je prie pour de bon : pour les soleils tombés, pour ceux qui restent, et pour vous, archer."
                  ] }
              ] },
            // Chemin relationnel du soleil 6 : la cendre du phénix sauvée, le vieil attiseur du temple du feu ordonne aux forgerons de poser leurs soufflets.
            { id: 'parley_sun6', x: 11, y: 7, name: 'Chi', title: 'Vieil attiseur du temple du feu', showWhen: 'sq_ember', hideWhen: ['sun6_wardens_a', 'sun6_wardens_b'],
              parley: { lines: [
                  "Doucement, archer. Je suis Chi, l'attiseur du vieux temple du feu. Yan fut mon acolyte : elle m'a fait dire que vous aviez sauvé la cendre du phénix.",
                  "Les deux forgerons du magma sont mes derniers servants. Depuis que le brasero s'est éteint, ils attisent le soleil à sa place.",
                  "La cendre est en sûreté, la flamme pourra renaître ailleurs. Ils n'ont plus de raison de souffler.",
                  "Je leur ordonne de poser leurs soufflets. Le soleil retombera sous votre flèche. Pardonnez-nous de l'avoir aimé."
              ] },
              idle: [
                  "Un feu qu'on a veillé longtemps ne s'éteint jamais tout à fait.",
                  "Asseyez-vous près de la braise, archer. Le basalte est tiède, ce soir."
              ],
              talk: [
                  { whenDone: 'parley_sun6', lines: [
                      "Les soufflets sont posés. Mes servants dorment debout, comme de vieux outils.",
                      "Le soleil n'a plus que sa propre chaleur. Allez, et tirez sans haine."
                  ] },
                  { whenDone: 'sun_6', lines: [
                      "La roche refroidit sans bruit. Je vais rallumer un petit feu, ailleurs, pour Yan. Un tout petit, qui ne brûle personne."
                  ] }
              ] }
        ],
        enemies: [
            // Embuscade : Fengmeng tient le défilé (corridor de 3 tuiles), seul passage vers l'est.
            { id: 'fengmeng_2', templateId: 'fengmeng_2', name: "Fengmeng, l'Archer Pressé", kind: 'sentinel', x: 6, y: 4, scaledAggro: 3, sight: 1, allAround: true, seal: 'x',
              permanent: true, boss: { name: "Fengmeng, l'Archer Pressé", level: 8 },
              defeatScene: {
                  speaker: FENGMENG_SPEAKER('fengmeng_2'),
                  lines: [
                      "J'étais parti deux jours avant vous, Maître. Je voulais que ce deuxième soleil tombe sous ma flèche, et que pour une fois les villages chantent « Fengmeng ». Mais vous arrivez toujours à temps, n'est-ce pas ?",
                      "Encore ! Même à armes égales ! Qu'avez-vous de plus que moi, Maître ? La patience ? La faveur du Ciel ?",
                      "Oui, j'ai gravi les marches du Kunlun. J'ai demandé à la Reine Mère le même élixir que le vôtre. Elle n'en a qu'un seul véritable, m'a-t-elle dit, et il est déjà donné. Elle a refusé, avec douceur.",
                      "J'ai compris en la regardant : l'élixir n'est plus chez elle. Il est chez vous. Chez Dame Chang'e.",
                      "Prenez votre deuxième soleil. Ne me retenez pas : j'ai fait mon choix, et personne d'autre que moi ne l'a fait. Je vais la voir."
                  ]
              } },
            { id: 'volcan_lich', templateId: 'gui_esprit', name: 'Taoïste-squelette des braises', kind: 'sentinel', x: 1, y: 8, offset: 0 },
            // Pixiu gardiens de la veine (quête secondaire de Shan), nord-est.
            { id: 'ore_guard_a', templateId: 'pixiu', name: 'Pixiu de magma', kind: 'sentinel', x: 9, y: 1, offset: 0, permanent: true, group: 'ore_guards' },
            { id: 'ore_guard_b', templateId: 'pixiu', name: 'Pixiu de magma', kind: 'sentinel', x: 12, y: 1, offset: 0, permanent: true, group: 'ore_guards' },
            { id: 'volcan_dragon', templateId: 'chilong', name: 'Long de braise', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            // Louveteau de braise nommé (quête secondaire de Shan : il devient le compagnon Braise).
            { id: 'ember_pup', templateId: 'loup_braise', name: 'Louveteau de braise', kind: 'sentinel', x: 2, y: 7, offset: 0, permanent: true },
            // Gardes du sanctuaire : tant qu'ils vivent, sun_6 est intouchable, sauf pourparlers (parley_sun6 : ils s'écartent, `hideWhen`).
            { id: 'sun6_wardens_a', templateId: 'forgeron_magma', name: 'Forgeron de magma', kind: 'sentinel', x: 9, y: 7, offset: 2, permanent: true, group: 'sun6_wardens', hideWhen: 'parley_sun6' },
            { id: 'sun6_wardens_b', templateId: 'forgeron_magma', name: 'Forgeron de magma', kind: 'sentinel', x: 13, y: 8, offset: 2, permanent: true, group: 'sun6_wardens', hideWhen: 'parley_sun6' },
            { id: 'sun_6', templateId: 'sun_6', name: 'Soleil de Magma', kind: 'sentinel', x: 11, y: 8,
              permanent: true, shieldedBy: 'sun6_wardens', unsealedBy: ['parley_sun6'], weakenedBy: ['sq_ore', 'sq_ember'], boss: { name: 'Soleil de Magma', level: 9 },
              afterScenes: MIRROR_TALKS.sun_6,
              shieldLines: [
                  "Deux forgerons de magma attisent le Soleil de Magma comme une fournaise : tant qu'ils soufflent, il se rallume de lui-même.",
                  "Le basalte coule entre vous et lui en nappes d'or rouge ; les flèches fondent avant d'y toucher.",
                  "Faites taire les soufflets et le soleil perdra son alimentation. (Les veines de cinabre et la cendre du phénix, une fois réglées, l'affaibliront.)",
                  "Ces forgerons soufflent sans conviction, en servants dont le temple a brûlé. Quelqu'un, dans les gorges, pourrait leur dire d'arrêter."
              ] }
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
            { id: 'hunter_wu', x: 3, y: 2, name: 'Wu', title: 'Chasseur', 
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
            { id: 'shepherd_zi', x: 3, y: 8, name: 'Zi', title: 'Bergère', 
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
            { id: 'fauves_boar', templateId: 'sanglier_flammes', name: 'Sanglier de flammes', kind: 'sentinel', x: 7, y: 1, offset: 0 },
            { id: 'fauves_troll', templateId: 'shanxiao', name: 'Ogre de la plaine', kind: 'sentinel', x: 10, y: 1, offset: 0 },
            // Tigre nommé (quête secondaire de Wu), coin nord-est.
            { id: 'scarred_tiger', templateId: 'tigre_embrase', name: 'Balafré, tigre embrasé', kind: 'sentinel', x: 13, y: 1, offset: 1, permanent: true },
            // Meute qui protège le soleil : tant qu'elle vit, `sun_7` est intouchable.
            { id: 'pack_wolf_a', templateId: 'loup_braise', name: 'Loup de braise', kind: 'sentinel', x: 9, y: 7, offset: 0, permanent: true, group: 'beast_pack' },
            { id: 'pack_boar', templateId: 'sanglier_flammes', name: 'Sanglier de flammes', kind: 'sentinel', x: 9, y: 9, offset: 0, permanent: true, group: 'beast_pack' },
            { id: 'pack_tiger', templateId: 'tigre_embrase', name: 'Tigre embrasé', kind: 'sentinel', x: 13, y: 8, offset: 0, permanent: true, group: 'beast_pack' },
            { id: 'pack_wolf_b', templateId: 'loup_braise', name: 'Loup de braise', kind: 'sentinel', x: 11, y: 9, offset: 0, permanent: true, group: 'beast_pack' },
            { id: 'sun_7', templateId: 'sun_7', name: 'Soleil des Bêtes Folles', kind: 'sentinel', x: 11, y: 8,
              permanent: true, shieldedBy: 'beast_pack', weakenedBy: ['sq_scarred_tiger', 'sq_zi_bell'], boss: { name: 'Soleil des Bêtes Folles', level: 35 },
              afterScenes: MIRROR_TALKS.sun_7,
              shieldLines: [
                  "Un bouclier de flammes ondule autour du Soleil des Bêtes Folles : vos flèches se consumeraient avant de l'atteindre.",
                  "Quatre bêtes embrasées tournent autour de lui comme des gardiennes : tigre, sanglier, loups. Tant qu'elles vivent, il est intouchable.",
                  "Abattez la meute, et le bouclier tombera."
              ] }
        ],
        chests: [
            { id: 'zi_bell', x: 5, y: 9, gold: 10, label: 'Clochette du bélier' },
            { id: 'fauves_chest', x: 12, y: 3, gold: 120 },
            { id: 'tou_stash', x: 1, y: 1, gold: 10, label: 'Cachette de Tou' }
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
            { id: 'fisher_hai', x: 3, y: 7, name: 'Hai', title: 'Pêcheur', 
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
            { id: 'envoy_longwang', x: 3, y: 2, name: 'Longwang', title: 'Envoyé du Roi-Dragon', 
              idle: [
                  "Salutations, seigneur archer. Je suis Longwang, envoyé du Roi-Dragon. Mon maître est affligé : la mer étouffe sous le soleil, et ses fils dépérissent.",
                  "Mon maître ajoute ceci : la Reine Mère n'offre pas son élixir à n'importe qui. Elle a vu quelque chose dans votre cœur, et dans un autre, qu'elle n'a pas aimé."
              ],
              talk: [
                  { whenDone: 'sq_pearl', lines: [
                      "La perle est à son cou : mon maître a enfin pu pleurer, et la mer avec lui. C'est la plus belle pluie que j'aie jamais vue."
                  ] },
                  { whenDone: 'sun_8', lines: [
                      "La mer est revenue. Mon maître vous fera porter, par les courants, un présent à chacune de vos nuits. Il ne dira jamais merci à voix haute, mais il y pense."
                  ] }
              ] },
            // Chemin relationnel du soleil 8 : la perle rendue, l'amiral du Roi-Dragon lève la consigne des gardes-marée.
            { id: 'parley_sun8', x: 12, y: 7, name: 'Amiral Xie', title: 'Amiral de l\'escadre du Roi-Dragon', showWhen: 'sq_pearl', hideWhen: ['sun8_wardens_a', 'sun8_wardens_b'],
              parley: { lines: [
                  "Garde-à-vous, archer. Amiral Xie, de l'escadre du Roi-Dragon. La perle de mon maître est rentrée au palais : il m'a chargé de vous remercier.",
                  "Mes gardes-marée tiennent la cloche d'eau sur ordre du Roi. Si elle retombait, la grève et ses villages seraient noyés d'un coup.",
                  "Ils ne vous barrent pas la route par méchanceté. Ils attendent un archer en qui le Roi aurait confiance. La perle dit que c'est vous.",
                  "Je lève la consigne. Brisez la cloche sur le soleil, pas sur le village. Et saluez le Roi de ma part : il est susceptible."
              ] },
              idle: [
                  "Au rapport : la marée est basse, le moral est bas, la discipline est haute.",
                  "Je ne recule jamais. Je me déplace latéralement, c'est différent."
              ],
              talk: [
                  { whenDone: 'parley_sun8', lines: [
                      "Consigne levée. Mes gardes se sont retirés vers les récifs, en bon ordre.",
                      "Le soleil est à vous, archer. Brisez la cloche d'un seul tir, et que la mer retombe où elle doit."
                  ] },
                  { whenDone: 'sun_8', lines: [
                      "La mer est rentrée dans son lit au pas de charge. Le Roi-Dragon m'a fait dire qu'il n'était pas ému. Il pleurait."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'mer_witch', templateId: 'dame_des_neiges', name: 'Dame des neiges égarée', kind: 'sentinel', x: 8, y: 1, offset: 0 },
            // Serpents coupe-filets (quête secondaire de Hai), nord-est.
            { id: 'net_cutter_a', templateId: 'jiaolong', name: 'Serpent coupe-filets', kind: 'sentinel', x: 11, y: 1, offset: 0, permanent: true, group: 'net_cutters' },
            { id: 'net_cutter_b', templateId: 'jiaolong', name: 'Serpent coupe-filets', kind: 'sentinel', x: 13, y: 1, offset: 0, permanent: true, group: 'net_cutters' },
            { id: 'mer_doctor', templateId: 'wen_shen', name: 'Docteur-démon des marées', kind: 'sentinel', x: 7, y: 8, offset: 0 },
            // Gardes du sanctuaire : tant qu'ils vivent, sun_8 est intouchable, sauf pourparlers (parley_sun8 : ils s'écartent, `hideWhen`).
            { id: 'sun8_wardens_a', templateId: 'garde_maree', name: 'Garde-marée du Roi-Dragon', kind: 'sentinel', x: 10, y: 7, offset: 2, permanent: true, group: 'sun8_wardens', hideWhen: 'parley_sun8' },
            { id: 'sun8_wardens_b', templateId: 'garde_maree', name: 'Garde-marée du Roi-Dragon', kind: 'sentinel', x: 13, y: 8, offset: 2, permanent: true, group: 'sun8_wardens', hideWhen: 'parley_sun8' },
            { id: 'sun_8', templateId: 'sun_8', name: 'Soleil des Marées', kind: 'sentinel', x: 11, y: 8,
              permanent: true, shieldedBy: 'sun8_wardens', unsealedBy: ['parley_sun8'], weakenedBy: ['sq_nets', 'sq_pearl'], boss: { name: 'Soleil des Marées', level: 40 },
              afterScenes: MIRROR_TALKS.sun_8,
              shieldLines: [
                  "La cloche d'eau du Soleil des Marées est tenue en suspens par deux gardes-marée : si vous tirez, elle retombera sur vous.",
                  "Ils chantent à voix basse, et l'eau se tient immobile comme un mur de verre.",
                  "Faites-les taire, et la cloche d'eau se brisera sur le soleil. (Les filets et la perle, une fois rendus, l'affaibliront.)",
                  "Ces gardes obéissent à un ordre du palais plus qu'à leur colère. On l'entendrait peut-être lever, si le Roi-Dragon avait une raison de vous faire confiance."
              ] }
        ],
        chests: [
            { id: 'dragon_pearl', x: 1, y: 8, gold: 10, label: 'Perle du Roi-Dragon' },
            { id: 'mer_chest', x: 12, y: 4, gold: 130 },
            { id: 'jian_quiver', x: 2, y: 2, gold: 10, label: 'Carquois de Jian' }
        ]
    },

    // ── 9. Cime du Fusang : le Dixième Soleil, bouclier du Neuvième ──────────
    fusang: {
        id: 'fusang', region: 'fusang', name: 'Cime du Fusang', biome: 'fusang',
        w: 14, h: 10, spawn: { x: 1, y: 6 },
        arrival: [
            "Au sommet du monde, l'Arbre Fusang déploie ses branches d'or. Ici dormaient les dix soleils, et leurs nids de feu sont encore tièdes. Il y règne un silence de temple.",
            "Les deux derniers soleils se serrent l'un contre l'autre au pied de l'arbre : le neuvième, qui se cache, et le dixième, son plus jeune frère, qui tremble. Vous n'en abattrez qu'un."
        ],
        obstacles: [[4, 0, 2, 2], [6, 0, 1, 2], [6, 8, 1, 2], [9, 0, 1, 1], [12, 0, 2, 1], [2, 8, 2, 1]],
        liquids: [],
        paths: [[0, 6, 6, 1], [5, 4, 1, 3], [5, 4, 9, 1]],
        exits: [
            { x: 0, y: 6, to: 'mer', arrive: { x: 12, y: 6 }, label: 'Rivage de la Mer Orientale' },
            {
                x: 13, y: 4, to: 'lune', arrive: { x: 1, y: 4 }, label: 'Pic de la Lune',
                requires: 'sun_9',
                lockedMessage: "La route des Hautes-Eaux, vers le Pic de la Lune, reste cachée derrière le dernier soleil : abattez le Soleil Lâche."
            }
        ],
        npcs: [
            { id: 'crane_envoy', x: 3, y: 2, name: 'La Grue', title: 'Messagère de la Reine Mère', 
              idle: [
                  "Je suis le souffle de la Reine Mère de l'Occident, archer. Elle me prête sa voix quand elle a besoin d'être entendue de très loin.",
                  "Elle m'a chargée de veiller sur l'Arbre, et sur la fiole d'élixir qu'elle a confiée à Dame Chang'e."
              ],
              talk: [
                  { whenDone: 'sun_8', lines: [
                      "Un jeune archer est venu frapper à la porte de la Reine Mère, il y a quelques semaines. Il demandait un élixir pour lui seul.",
                      "Elle a refusé avec bonté : « Je n'ai qu'un seul véritable élixir, et il est déjà donné. »",
                      "Il n'a pas insisté. Il a compris, d'un coup, à qui elle l'avait confié. Je n'ai jamais vu quelqu'un pâlir ainsi, ni sourire en même temps."
                  ] },
                  { whenDone: 'sun_9', lines: [
                      "Le Dixième vous doit la vie. La Reine Mère dit que cette pitié compte plus que la moitié des victoires.",
                      "Hâtez-vous vers les Hautes-Eaux, puis vers le Pic de la Lune : le temps presse, et Fengmeng ne s'arrêtera pas."
                  ] }
              ] },
            // Messager de la Lune : après la chute du Neuvième, quand le miroir se tait, il vient près du héros (carte d'exploration)
            // expliquer que Chang'e a coupé le lien elle-même, pour que Fengmeng ne puisse pas la retrouver.
            { id: 'moon_messenger', x: 10, y: 2, name: 'Lièvre de jade', title: 'Messager de la Lune', showWhen: 'sun_9', arrival: { hop: true },
              idle: [
                  "Ne secouez pas le bronze, archer : il n'est pas brisé. C'est Dame Chang'e qui a coupé le lien, de ses propres mains.",
                  "Elle sait qu'elle devra partir. Tant que les deux moitiés se répondaient, Fengmeng pouvait vous suivre à la trace jusqu'à elle. Elle a préféré se taire plutôt que de le guider.",
                  "Elle m'a dit : « Dis-lui que ce n'est pas un adieu, et qu'il regarde la lune. » Elle vous attend au Pic de la Lune, par les Hautes-Eaux."
              ],
              talk: [
                  { whenDone: 'q_changxi', lines: [
                      "Le silence du miroir n'est pas un abandon, archer. C'est le dernier geste de protection qu'elle avait. Montez : elle vous attend."
                  ] }
              ] },
            // Le Dixième Soleil se cache derrière le Neuvième : on ne peut lui parler qu'après sa chute.
            { id: 'sun_ten', x: 12, y: 1, name: 'Dixième Soleil', title: 'Dernier des dix soleils', 
              idle: [
                  "…Tu es l'archer ? Celui qui a… mes frères ? Non, ne me regarde pas comme ça : je ne bouge pas, je te le jure.",
                  "Je n'ai jamais voulu brûler personne. Mes frères disaient que c'était un jeu. Moi, j'avais peur de la chaleur."
              ],
              talk: [
                  { whenDone: 'sun_9', lines: [
                      "Merci de m'avoir épargné. Tu as dit que c'était par pitié. Je serai le seul, maintenant. Cela fait… beaucoup de ciel.",
                      "Je me lèverai à l'heure, chaque matin. Promis."
                  ] },
                  { whenDone: 'q_epilogue', lines: [
                      "Je me lève à l'aube, chaque jour. Tu sais, il y a quelqu'un, sur la lune, qui me regarde passer. Elle me sourit."
                  ] }
              ] },
            // Chemin relationnel du soleil 9 : le nid retrouvé, la sœur de la messagère rappelle les grues-lige qui couvrent le Dixième.
            { id: 'parley_sun9', x: 10, y: 4, name: 'Hegui', title: 'Grue au nid retrouvé', showWhen: 'sq_crane', hideWhen: ['sun9_wardens_a', 'sun9_wardens_b'],
              parley: { lines: [
                  "Paix, archer. Je suis Hegui, la sœur de la messagère. Vous avez rapporté les plumes de mon nid : un nid retrouvé vaut bien un passage.",
                  "Les grues-lige que vous voyez ne protègent pas le Neuvième. Elles couvrent le Dixième, le plus jeune, qui tremble derrière lui.",
                  "Elles ont peur d'un tir maladroit. Alors elles se tiennent entre vous et lui, ailes ouvertes, sans oser reculer.",
                  "Je les rappelle. Elles se poseront sur la branche haute. Visez avec calme : le Dixième est derrière, et il faut qu'il reste."
              ] },
              idle: [
                  "Mes petits dorment, enfin. Je ne veux pas troubler le silence.",
                  "Les grues parlent peu. Elles veillent."
              ],
              talk: [
                  { whenDone: 'parley_sun9', lines: [
                      "Les grues-lige ont rejoint la branche haute. Elles couvrent le petit de loin, cette fois.",
                      "Le Neuvième est seul sous votre arc. Ne regardez pas derrière lui, archer. Regardez la cible."
                  ] },
                  { whenDone: 'sun_9', lines: [
                      "Le petit a levé la tête. Merci d'avoir tenu votre main."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'fusang_guard', templateId: 'garde_solaire', name: 'Garde solaire', kind: 'sentinel', x: 7, y: 1, offset: 0 },
            { id: 'fusang_sage', templateId: 'immortel_jade', name: 'Immortel de jade', kind: 'sentinel', x: 8, y: 8, offset: 0 },
            { id: 'fusang_dragon', templateId: 'canglong', name: 'Long de givre', kind: 'sentinel', x: 4, y: 9, offset: 0 },
            { id: 'fusang_vampire', templateId: 'jiangshi', name: 'Jiangshi des cimes', kind: 'sentinel', x: 12, y: 9, offset: 0 },
            // Gardes du sanctuaire : tant qu'ils vivent, sun_9 est intouchable, sauf pourparlers (parley_sun9 : ils s'écartent, `hideWhen`).
            { id: 'sun9_wardens_a', templateId: 'grue_lige', name: 'Grue-lige du Fusang', kind: 'sentinel', x: 9, y: 3, offset: 2, permanent: true, group: 'sun9_wardens', hideWhen: 'parley_sun9' },
            { id: 'sun9_wardens_b', templateId: 'grue_lige', name: 'Grue-lige du Fusang', kind: 'sentinel', x: 12, y: 3, offset: 2, permanent: true, group: 'sun9_wardens', hideWhen: 'parley_sun9' },
            { id: 'sun_9', templateId: 'sun_9', name: 'Soleil Lâche', kind: 'sentinel', x: 11, y: 2,
              permanent: true, shieldedBy: 'sun9_wardens', unsealedBy: ['parley_sun9'], weakenedBy: ['sq_crane', 'sq_sceau_racines'], boss: { name: 'Soleil Lâche', level: 45 },
              afterScenes: MIRROR_TALKS.sun_9,
              shieldLines: [
                  "Deux grues-lige du Fusang se tiennent devant le Soleil Lâche, ailes déployées : elles couvrent aussi le Dixième Soleil, collé à son frère.",
                  "Un tir maladroit pourrait toucher celui qu'on doit épargner : il faut d'abord écarter les gardes, sans trembler.",
                  "Écartez-les, et le Neuvième restera seul sous votre arc. (Les grues apaisées et le sceau des racines l'affaibliront.)",
                  "Les grues se tiennent tournées vers le Dixième, pas vers vous : c'est lui qu'elles défendent. Une grue qui retrouverait son nid les rappellerait peut-être."
              ] }
        ],
        chests: [
            { id: 'crane_nest', x: 1, y: 1, gold: 10, label: 'Nid de la grue' }
        ]
    },

    // ── 9 bis. Hautes-Eaux de la Lune Montante : autel de Mazu (world/maps/marees.js, world/PLAN-MAREES.md) ──
    // Sanctuaire sans soleil : Changxi, mère des douze lunes, y dort ; l'épreuve de bravoure ouvre le passage vers la Lune.
    marees: {
        id: 'marees', region: 'marees', name: 'Autel de Mazu', biome: 'tides',
        w: 14, h: 10, spawn: { x: 1, y: 5 },
        arrival: [
            "Au bout des pontons, un petit pavillon laqué flotte sur l'eau noire : l'autel de Mazu et du Dragon-Roi. Des lanternes rouges s'y reflètent par dizaines.",
            "Une femme immense y dort, pelotonnée contre la balustrade, des lunes pâles tournant lentement autour de sa tête. Personne n'ose la réveiller."
        ],
        obstacles: [[0, 0, 14, 2], [0, 8, 14, 2]],
        liquids: [],
        paths: [[0, 5, 14, 1]],
        exits: [
            { x: 0, y: 5, to: 'fusang', arrive: { x: 12, y: 4 }, label: 'Gouffre des Mirages' },
            {
                x: 13, y: 5, to: 'lune', arrive: { x: 1, y: 4 }, label: 'Pic de la Lune',
                requires: 'changxi',
                lockedMessage: "Le chemin de lune ne s'ouvre pas tout seul : Changxi, mère des douze lunes, doit d'abord éprouver votre courage."
            }
        ],
        // Après l'épreuve, Changxi (immense, muette) emporte Hou Yi sur la Lune d'un geste ; sur la Lune, elle le ramène sur Terre (world/text/lune.js).
        npcs: [
            { id: 'changxi_calm', name: 'Changxi', title: 'Mère des douze lunes', x: 7, y: 5, showWhen: 'changxi', span: 6,
              idle: ['...'],
              warp: {
                  to: 'lune_road', label: 'Monter vers la Lune', stay: 'Pas encore',
                  lines: ['...', "(Changxi se redresse, immense, et son ombre couvre tout l'autel. Elle ne dit rien. Elle vous regarde comme on regarde quelqu'un qui est enfin arrivé, puis elle tend la paume, et les douze lunes se rangent autour de vous.)"]
              } }
        ],
        enemies: [
            { id: 'changxi', templateId: 'changxi', name: 'Changxi, mère des douze lunes', kind: 'sentinel', x: 9, y: 5, offset: 0, span: 6,
              permanent: true, boss: { name: 'Changxi, mère des douze lunes', level: 41 } }
        ],
        chests: []
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
            { id: 'change_moon', x: 3, y: 2, name: "Chang'e", title: 'Vêtue de lumière lunaire',
              // Chang'e est l'appât : lui parler attire Fengmeng, et le duel (phase 1 puis phase 2, sans répit) commence aussitôt.
              bait: {
                  enemy: 'fengmeng_3a',
                  lines: [
                      "Hou Yi… Tu es venu. Je savais que tu viendrais, avant même que la grue ne parte. Regarde-moi : la lune m'a déjà un peu changée.",
                      "Pardonne le silence du bronze : c'est moi qui l'ai éteint. Tant qu'il parlait, Fengmeng pouvait te suivre à la trace jusqu'à moi. Je savais que je devrais partir, alors j'ai coupé le fil moi-même.",
                      "J'ai la fiole contre moi. Fengmeng la veut, et il me suit depuis la digue, pas à pas. Il ne s'arrêtera jamais tant qu'il croira pouvoir l'avoir.",
                      "Alors laissons-le croire. Je resterai là, au bord du bassin, la fiole bien en vue : je serai l'appât, et toi l'archer qui l'attend.",
                      "Ne discute pas : tu n'as jamais su me faire changer d'avis.",
                      "(Elle élève la fiole dans la lumière. Sur le sentier de l'est, un pas craque, puis un autre.)",
                      "Le voilà. Ne le hais pas, mon archer, mais ne baisse pas ta garde : entre ses flèches, il n'y aura aucun répit, et personne pour te rendre ton souffle."
                  ],
                  retry: [
                      "Il revient, Hou Yi. Il revient toujours. Reprends ton souffle, si tu le peux : la fiole brille encore, et lui aussi te guette.",
                      "(Elle élève de nouveau la fiole. Un pas craque sur le sentier de l'est.)"
                  ]
              },
              idle: [
                  "Il n'y a plus que la lune et nous, Hou Yi. Prends un gâteau, pour tenir debout quand tout tremble."
              ],
              talk: [
                  { whenDone: 'fengmeng_3a', lines: [
                      "(Son image vacille à la surface du bassin, plus lumineuse que jamais.)",
                      "Je suis là, mon archer, dans la lumière, au-dessus de toi. L'élixir m'a prise, pas mon cœur. Fais ce que tu dois : ne le hais pas, il se déteste déjà assez."
                  ] },
                  { whenDone: 'q_epilogue', lines: [
                      "(Le reflet se pose sur l'autel comme une main sur une épaule.)",
                      "Chaque année, à la pleine lune d'automne, regarde le ciel. Je serai là."
                  ] }
              ] }
        ],
        enemies: [
            { id: 'lune_priestess', templateId: 'pretresse_lunaire', name: 'Prêtresse lunaire', kind: 'patrol', x: 8, y: 8, patrol: [[8, 8], [12, 8]], offset: 0 },
            { id: 'lune_vampire', templateId: 'jiangshi', name: 'Jiangshi des neiges', kind: 'sentinel', x: 9, y: 1, offset: 0 },
            { id: 'lune_assassin', templateId: 'assassin_masque', name: 'Ombre du pic', kind: 'sentinel', x: 1, y: 9, offset: 0 },
            // Finale en deux phases. La phase 2 n'existe qu'après la défaite de la phase 1.
            // Phase 1 : il copie les techniques du héros, qui arrive affaibli par les neuf soleils (duel.js).
            { id: 'fengmeng_3a', templateId: 'fengmeng_3a', name: "Fengmeng, l'Archer Miroir", kind: 'sentinel', x: 11, y: 4,
              permanent: true, boss: { name: "Fengmeng, l'Archer Miroir", level: 45 },
              // Il surgit quand le héros parle à Chang'e (l'appât), puis la phase 2 s'enchaîne sans retour sur la carte.
              showWhen: 'change_moon', chain: 'fengmeng_3b',
              duel: { mirror: true, heroHpPct: 0.75 },
              defeatScene: {
                  speaker: { name: 'Narrateur', title: 'Le Pic de la Lune' },
                  lines: [
                      "Fengmeng tombe à genoux, son arc brisé à ses côtés. Hou Yi s'avance, la main tendue pour l'aider à se relever. Mais le disciple, d'un geste de serpent, tend la sienne vers Chang'e : « L'élixir, Madame. Donnez-le-moi, ou la prochaine flèche trouvera la poitrine du Maître. »",
                      "Il tient encore un carreau empoisonné dans sa paume, pointé contre le cœur de Hou Yi, trop près pour qu'on puisse l'arrêter. Chang'e comprend alors ce que le miroir lui disait depuis des lunes : cet homme ne reculera devant rien, et son époux est en danger de mort.",
                      "Elle ne cherche pas à discuter. Elle lève la fiole avant que la main de Fengmeng ne l'atteigne. « Tu ne l'auras pas, Fengmeng. Ni lui, ni moi ne mourrons ici. Je ne perds pas la vie : je perds seulement d'être près de lui. »",
                      "Elle se tourne vers Hou Yi, et sourit comme on sourit à celui qu'on aime. « Pardonne-moi, mon archer. Une gorgée pour vivre longtemps, la fiole entière pour monter au ciel. Ce n'est pas un adieu. Regarde la lune, chaque nuit. Je serai là. » Elle boit.",
                      "Une lumière d'argent la soulève, et sa robe de hanfu flotte comme une voile. Elle s'élève, lentement, sans cesser de regarder Hou Yi, jusqu'à devenir un point clair devant le disque immense de la lune. Sur le bassin d'eau lunaire, son reflet demeure, comme un souvenir qui ne veut pas partir.",
                      "Fengmeng hurle. L'élixir lui échappe à jamais, et le carreau tremble dans sa main. Il aurait pu le jeter. Il choisit de saisir un nouvel arc et un carquois plein : cette fureur-là est la sienne, et ses yeux ne sont plus ceux d'un disciple."
                  ]
              } },
            { id: 'fengmeng_3b', templateId: 'fengmeng_3b', name: 'Fengmeng, Rage et Désespoir', kind: 'sentinel', x: 11, y: 3,
              permanent: true, showWhen: 'fengmeng_3a', boss: { name: 'Fengmeng, Rage et Désespoir', level: 48 },
              // Les PV du héros ne remontent pas entre les deux phases ; une défaite ici recommence tout le duel.
              carryHp: true, chainedFrom: 'fengmeng_3a',
              // Phase 2 : fureur, tirs rapides (un tour bonus tous les 3 tours) et pièges de zone (tous les 2 tours).
              duel: { rapidShots: 3, zoneTraps: 2 },
              defeatScene: {
                  speaker: FENGMENG_SPEAKER('fengmeng_3b'),
                  lines: [
                      "…Je voulais seulement que quelqu'un me dise : « Tu es digne. » Vous aviez votre Chang'e, vos soleils, votre légende. Moi, j'avais des flèches.",
                      "Mais ce manque n'excuse rien. Personne ne m'a poussé : j'ai forcé votre porte, j'ai visé votre cœur, j'ai chassé Dame Chang'e jusqu'à la lune. Ce sont mes mains.",
                      "(Il dépose son arc et son carquois au pied de l'autel.) Je n'attends pas de pardon. Je redescends à pied, sans arme. Les villages que j'ai effrayés, l'empereur Yao, la Reine Mère : je leur dirai ce que j'ai fait, et ils décideront de ce que je dois.",
                      "Allez. Elle vous attend dans la lumière."
                  ]
              } }
        ],
        chests: [
            { id: 'moon_cakes_cache', x: 1, y: 7, gold: 60, label: "Corbeille d'offrandes" },
            // L'autel n'apparaît qu'après la victoire sur Fengmeng : l'ouvrir déclenche l'épilogue.
            { id: 'moon_altar', x: 12, y: 4, gold: 0, label: 'Autel des gâteaux de lune', showWhen: 'fengmeng_3b',
              altar: true,
              openText: "Vous déposez les gâteaux de lune sur l'autel de pierre blanche…" }
        ]
    }
};

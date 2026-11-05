// Le miroir brisé de Chang'e : interludes joués après chaque soleil abattu (MIRROR_TALKS) et orateur de Fengmeng.
// Données pures, extraites de story.js.

// Le miroir brisé : au départ, Chang'e a brisé en deux son miroir de bronze et en a confié une moitié à Hou Yi.
// Chaque soleil abattu rend un peu de nuit au ciel ; tant que la lune est haute, les deux moitiés reflètent la même
// lune et les époux s'y parlent. Interludes joués après le texte de victoire de chaque soleil (`afterScenes`) ;
// après le neuvième, le bronze reste froid : Chang'e a déjà fui vers le Pic de la Lune.
const HOU_YI = { name: 'Hou Yi', title: 'La moitié de miroir', hero: true };
const CHANGE_MIRROR = { name: "Chang'e", title: 'Dans la moitié de miroir', npc: 'change' };
const MOONLIGHT = { name: 'Narrateur', title: 'Clair de lune' };
const SUN_TEN = { name: 'Dixième Soleil', title: 'Dernier des dix soleils', npc: 'sun_ten' };

export const MIRROR_TALKS = {
    sun_1: [
        { speaker: MOONLIGHT, lines: [
            "Le soir tombe, un vrai soir, le premier depuis trois lunes. Hou Yi veille sur le tertre du temple, où la cendre fume encore. Une lune mince se lève au-dessus des rizières, et dans sa manche, la moitié de miroir devient tiède.",
            "Il la sort. Dans le bronze, il y a la lune ; et sous la lune, un visage poudré de farine, qui le regarde à travers la même lumière."
        ] },
        { speaker: CHANGE_MIRROR, lines: [
            "Hou Yi ? Je tenais ma moitié à la fenêtre pour y voir la lune, et c'est toi que je vois. Tu as de la cendre plein le front. Pourquoi ne rentres-tu pas ? La maison est à deux cents pas."
        ] },
        { speaker: HOU_YI, lines: [
            "Si je passe notre porte ce soir, je n'aurai plus le courage de repartir. Les Gorges du Volcan m'attendent à l'aube. Mais je t'entends, Chang'e. Je t'entends vraiment."
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
            "Tu as la voix de quelqu'un qui n'a pas dormi depuis trois jours. Ouvre les yeux, que je les voie… Rouges comme des braises. Mon pauvre archer."
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
            "Une pluie fine tombe sur les Monts du Tonnerre, tiède, qui sent le fer et la terre. La lune passe entre deux nuages, et la voix de Chang'e arrive mouillée de rire."
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
            "Non. Il reste sept soleils, et des enfants qui n'ont jamais vu une nuit entière. Si tu rentres pour moi, ils te le pardonneront. Toi, jamais."
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
            "Le Neuvième est tombé. Le Dixième, serré contre le tronc du Fusang, n'a pas bougé : la flèche est passée entre eux deux, sans lui effleurer la lumière. Il lève vers Hou Yi un visage mouillé."
        ] },
        { speaker: SUN_TEN, lines: [
            "Tu as pu viser mon frère sans me toucher… Pourquoi pas moi ? Tu es venu pour nous abattre tous. Nous étions dix, et la Terre brûlait."
        ] },
        { speaker: HOU_YI, lines: [
            "Il faut un jour à la Terre, pas dix. Le Neuvième se cachait derrière toi pour brûler à l'abri ; toi, tu tremblais. Ce n'est pas la même faute.",
            "J'ai tué par devoir, neuf fois. Je n'ai pas le droit de tuer par habitude. Un seul soleil restera, et ce sera toi. Sois-en digne : lève-toi à l'heure."
        ] },
        { speaker: SUN_TEN, lines: [
            "Je me lèverai à l'heure, je te le jure. Je me souviendrai que tu as eu pitié."
        ] },
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
        ] },
        { speaker: MOONLIGHT, lines: [
            "Aucune voix ne répond. Mais là-bas, dans l'herbe dorée, quelque chose approche en sautillant : un lièvre blanc au pelage de jade, qui vient droit vers lui."
        ] }
    ]
};

export const FENGMENG_SPEAKER = id => ({ name: 'Fengmeng', title: 'Disciple de Hou Yi', enemy: id });

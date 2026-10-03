// Textes — Plaine des Fauves (Enclos de Caoyuan, hautes herbes de cendre).
export default {
  screens: {
    fauves_village: { name: 'Enclos de Caoyuan', arrival: [
      'À Caoyuan, on dort un œil ouvert : la palissade est neuve, les moutons sont rares et la bergère compte à voix haute.',
      'Quelque part dans la plaine, des meutes de feu rôdent encore. Mais ici, il y a du thé.'] },
    fauves_wild: { name: 'Hautes Herbes de Cendre', gateMessage: 'Griffe-de-Feu, le tigre alpha, rôde dans les hautes herbes : tant qu\'il est là, la route du sanctuaire reste fermée.', arrival: [
      'L\'herbe haute ondule en vagues dorées. Un grondement lointain vous rappelle que la plaine ne dort jamais vraiment.'] },
    fauves_h_wu: { name: 'Pavillon du chasseur Wu', arrival: ['Des trophées de cornes, un râtelier d\'arcs. On y raconte beaucoup, on y prouve moins.'] },
    fauves_h_zi: { name: 'Yourte de Zi', arrival: ['Une yourte de feutre claire, où le thé au lait chauffe toute la journée sur un petit poêle.'] },
    fauves_h_chevaux: { name: 'Écurie des chevaux célestes', arrival: ['Des chevaux lents mais fiers, qui dédaignent les carottes et jugent votre posture.'] },
    fauves_h_chaman: { name: 'Tente de la chamane', arrival: ['Peaux, plumes, tambours : la tente d\'Ula sent la fumée de sauge et les secrets du vent.'] },
    fauves_h_fromage: { name: 'Fromagerie de Dame Sa', arrival: ['Des meules, des odeurs puissantes, un fumet à faire reculer les loups eux-mêmes.'] }
  },
  npcs: {
    horse_tian: { name: 'Tian', title: 'Cheval céleste retraité', emoji: '🐎',
      idle: ['Hennis. Autrefois, je galopais d\'un bout du ciel à l\'autre. Maintenant, je mâche de l\'herbe et je contemple.', 'Un cheval céleste n\'est jamais en retard : il arrive quand il faut. Même si c\'est le lendemain.'],
      talk: [{ whenDone: 'sun_7', lines: ['Le septième soleil est tombé. Le vent a changé. Je sens l\'envie de galoper, mais mes genoux disent non. Je galoperai en pensée.'] }] },
    shaman_ula: { name: 'Ula', title: 'Chamane des vents', emoji: '🪶',
      idle: ['Les vents me parlent. Aujourd\'hui, ils disent « il va faire chaud ». Je n\'avais pas besoin d\'eux pour ça.', 'On raconte qu\'un lièvre blanc vit dans la plaine, un lièvre de la Lune. Il connaît une dame qui boit l\'élixir, un jour.'],
      talk: [{ whenDone: 'sun_7', lines: ['Les vents ont changé de chanson : ils disent « lune ». Je ne sais pas ce que cela présage, mais je préfère ce vent-là.'] }] },
    cheese_sa: { name: 'Dame Sa', title: 'Fromagère', emoji: '🧀',
      idle: ['Mon fromage de brebis est fort. Les loups reculent, les voisins aussi, mais les clients reviennent.', 'Prenez un morceau, archer. Il a du caractère, comme vous. Il vieillit mieux.'],
      talk: [{ whenDone: 'sun_7', lines: ['Plus de meute, plus de peur ! Les brebis donnent un lait plus doux. Mon fromage perd en caractère, mais gagne en sourire.'] }] },
    twins_mu: { name: 'Les jumeaux Mu', title: 'Enfants-bergers', emoji: '👦',
      idle: ['On est deux, mais on ne parle que d\'une voix ! Elle dit qu\'on garde les moutons. Il dit que ce sont eux qui nous gardent.', 'Notre agneau s\'appelle Nuage. Il a disparu dans l\'herbe. On a pleuré à deux, ça a fait plus de bruit.'],
      talk: [{ whenDone: 'sq_agneau_perdu', lines: ['Nuage est de retour ! Il dort déjà ! Merci, archer. On a mis un ruban rouge à son cou, pour le retrouver la prochaine fois.'] }] },
    hua_fauves: { name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒',
      idle: ['Cloches, rubans, fromages de brebis : les nomades n\'ont pas de maison, mais ils aiment les jolies choses.', 'Plus loin, j\'irai jusqu\'à la mer. Ou plus haut, jusqu\'à l\'arbre. On verra : la route décide, pas moi.'],
      talk: [{ whenDone: 'sun_7', lines: ['Septième soleil ! Mon sac est plus léger, mon cœur aussi. La mer m\'attend, archer, et peut-être votre lettre aussi.'] }] },
    hare_tuzi: { name: 'Tuzi', title: 'Lièvre du Palais lunaire', emoji: '🐇',
      idle: ['Je pile l\'élixir dans un mortier, sur la Lune. Enfin, je pilais. Là, je prends l\'air.', 'Les humains croient que l\'élixir rend immortel. Il rend surtout nostalgique. C\'est un peu la même chose.'],
      talk: [{ whenDone: 'sq_lievre_lune', lines: ['Dites à Chang\'e, un jour, que son lièvre pense à elle. Et qu\'elle ne se laisse pas convaincre par un jaloux. Je suis lièvre, mais j\'ai l\'ouïe fine.'] }] },
    old_nomad_bayan: { name: 'Bayan', title: 'Vieux nomade', emoji: '🧓',
      idle: ['J\'ai traversé cette plaine mille fois. Elle ne change jamais, mais je ne suis plus le même.', 'Le soleil, la lune : tout tourne, sauf les vieux, qui s\'assoient.'],
      talk: [{ whenDone: 'sun_7', lines: ['Un soleil de plus tombé… Dans ma jeunesse, on disait qu\'il en restait un. Ce n\'est pas vrai : il en restera deux, je le sens à mes genoux.'] }] }
  },
  chests: {
    wu_quiver_box: { label: 'Coffre à carquois', openText: '🎁 Des flèches de chasseur, bien rangées, et sous elles un peu de monnaie : « pour les temps maigres ».', emoji: '🏹', emojiOpened: '🏹' },
    saddle_chest: { label: 'Coffre à selles', openText: '🎁 Parmi les selles et les brides, une bourse oubliée par un cavalier distrait.', emoji: '🪢', emojiOpened: '🪢' },
    shaman_drum_box: { label: 'Boîte à tambours', openText: '🎁 Sous les peaux de tambour, des offrandes de voyageurs : pièces, plumes et un vœu écrit sur un os.', emoji: '🥁', emojiOpened: '🥁' },
    grass_cache: { label: 'Cache dans les herbes', openText: '🎁 Une cache de chasseur, enfouie dans les herbes : quelques pièces et un bout de fromage dur.', emoji: '🌾', emojiOpened: '🌾' },
    lost_lamb_pen: { label: 'Enclos oublié', openText: '🎁 Dans l\'enclos oublié, un petit agneau tout ébouriffé qui vous regarde, soulagé. Une bourse est restée sur la paille.', emoji: '🐑', emojiOpened: '🐑' },
    alpha_den: { label: 'Tanière de l\'alpha', openText: '🎁 La tanière de Griffe-de-Feu. Des pièces arrachées à des voyageurs, et des os de mouton qu\'on ne détaillera pas.', emoji: '🐯', emojiOpened: '🐯' }
  },
  quests: [
    { id: 'sq_agneau_perdu', title: 'L\'agneau des jumeaux', chapter: '✦ Quête secondaire — Plaine des Fauves', giver: 'twins_mu', turnIn: 'twins_mu', requires: [], side: true,
      objectives: [
        { type: 'kill', target: 'fauves_lamb_wolf', text: 'Chasser le loup de braise qui poursuit l\'agneau (hautes herbes de cendre)' },
        { type: 'chest', target: 'lost_lamb_pen', text: 'Retrouver l\'agneau dans l\'enclos oublié (hautes herbes de cendre)' }],
      offer: ['Archer ! Notre agneau Nuage s\'est enfui dans les hautes herbes, et un loup de braise le suit ! On n\'ose pas y aller, c\'est trop haut.', 'Il y a un vieil enclos là-bas, je crois qu\'il s\'y est réfugié. Retrouve-le, s\'il te plaît !'],
      hint: ['Le loup de braise rôde dans les hautes herbes. L\'agneau s\'est caché dans un vieil enclos oublié.'],
      complete: ['Nuage ! Il va bien ! Il dort déjà ! Merci, merci, merci. Tiens, c\'est une mèche de sa laine : elle est douce comme un nuage, et chaude comme un secret.'],
      reward: { gold: 160, fragment: 'Toison de nuage', xp: 290 } },
    { id: 'sq_lievre_lune', title: 'Le lièvre de la Lune', chapter: '✦ Quête secondaire — Plaine des Fauves', giver: 'shaman_ula', turnIn: 'shaman_ula', requires: [], side: true,
      objectives: [{ type: 'talk', target: 'hare_tuzi', text: 'Parler au lièvre Tuzi (hautes herbes de cendre)', lines: ['Chang\'e ? Vous la connaissez ? Dites-lui que le mortier est toujours là. Et que l\'élixir… attention aux mains avides. Je ne vous en dis pas plus : les lièvres ont l\'ouïe fine, mais la langue courte.'] }],
      offer: ['Un lièvre blanc rôde dans les hautes herbes. Je soupçonne qu\'il vient du Palais lunaire : les vents me l\'ont murmuré.', 'S\'il connaît Chang\'e, il pourrait nous dire des choses que même les vents ignorent. Allez lui parler.'],
      hint: ['Le lièvre blanc Tuzi se cache dans les hautes herbes de cendre, derrière l\'enclos.'],
      complete: ['Ainsi l\'élixir attire les mains avides… Je transmettrai aux vents. Gardez ce brin de plume lunaire : le lièvre l\'a laissé sur ma tente.'],
      reward: { gold: 165, fragment: 'Plume lunaire', xp: 300 } },
    { id: 'sq_hure', title: 'La colère de Hure', chapter: '✦ Quête secondaire — Plaine des Fauves', giver: 'cheese_sa', turnIn: 'cheese_sa', requires: ['sq_lievre_lune'], side: true,
      objectives: [{ type: 'kill', target: 'fauves_boar_chief', text: 'Chasser Hure, le sanglier de flammes, des pâturages (hautes herbes de cendre)' }],
      offer: ['Le sanglier Hure saccage mes pâturages à l\'aube. Il boude les brebis, mais il adore mon fromage, et il ne paie jamais.', 'Chassez-le des hautes herbes, archer. Vous avez entendu le lièvre ; maintenant, entendez mon fromage.'],
      hint: ['Hure, le sanglier de flammes, rôde dans les hautes herbes de cendre, près des pâturages.'],
      complete: ['Mes pâturages sont libres ! Voilà pour vous : un fromage de sanglier. Non, de brebis. Je vous conseille de ne pas demander la différence.'],
      reward: { gold: 170, fragment: 'Croc de sanglier', xp: 310 } }
  ]
};

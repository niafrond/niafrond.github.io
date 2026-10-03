// Textes — Gorges du Volcan (Hameau des Braises Sages, coulées rougeoyantes).
export default {
  screens: {
    volcan_village: { name: 'Hameau des Braises Sages', arrival: [
      'Aux Braises Sages, on fait cuire le riz dans une fissure et l\'on salue le volcan chaque matin, avec la prudence que l\'on doit à un voisin irascible.',
      'Les cheminées fument. Les gens, eux, essaient de ne pas en faire autant.'] },
    volcan_wild: { name: 'Coulées et Passerelles Rougeoyantes', gateMessage: 'Le pont de basalte vers le sanctuaire est rompu : le forgeron de lave frappe son enclume en plein milieu.', arrival: [
      'Les gorges grondent doucement, à la manière d\'un grand chat qui rêve. Mieux vaut ne pas le réveiller, et surtout ne pas passer en courant.'] },
    volcan_h_shan: { name: 'Maison de Shan', arrival: ['Une maison creusée dans la roche, tapissée de pics, de lampes et de minerais soigneusement étiquetés.'] },
    volcan_h_yan: { name: 'Petit temple de Yan', arrival: ['Une flamme brûle sur l\'autel, calme et fière. Elle n\'a plus rien à prouver.'] },
    volcan_h_potier: { name: 'Atelier du potier de lave', arrival: ['Des vases noirs aux reflets rouges, cuits sans four, directement par la terre. Le potier jure qu\'il ne fait que les ramasser.'] },
    volcan_h_bains: { name: 'Bains de source chaude', arrival: ['Des bassins fumants et un silence satisfait. On se détend ici entre deux éruptions.'] },
    volcan_h_cantine: { name: 'Cantine des mineurs', arrival: ['Une longue table, des bols fumants et des plaisanteries sur le dos des cailloux.'] }
  },
  npcs: {
    potter_rui: { name: 'Rui', title: 'Potier de lave', emoji: '🏺',
      idle: ['Mes vases sont cuits par la montagne elle-même. Je ne fais que les ramasser au bon moment, avec des gants.', 'Un vase raté, c\'est un vase qui a une personnalité. Les miens ont beaucoup de personnalité.'],
      talk: [{ whenDone: 'sun_6', lines: ['Le sixième soleil est tombé. Le sol est tiède, il n\'est plus brûlant. Mes vases sortent moins noirs, plus roses. C\'est sans doute le soulagement.'] }] },
    bather_fei: { name: 'Grand-père Fei', title: 'Baigneur invétéré', emoji: '🧖',
      idle: ['Rien ne vaut un bain chaud à mon âge. Ni un archer, ni un empereur, ni un élixir d\'immortalité : un bain.', 'L\'autre soir, j\'ai entendu quelqu\'un passer en pestant contre « ce vieux maître ». Je n\'ai pas bougé, de peur de refroidir.'],
      talk: [{ whenDone: 'fengmeng_2', lines: ['Alors c\'était lui ! Le disciple qui vous a tendu une embuscade. Je savais bien que sa voix sentait le soufre. Moi, je reste dans mon bain : les jeunes gens énervent l\'eau.'] }] },
    cook_dada: { name: 'Dada', title: 'Cuisinière des mineurs', emoji: '🍲',
      idle: ['Mes mineurs mangent trois bols de nouilles par jour et se plaignent quand même. Les gens sont ingrats, mais prévisibles.', 'La soupe cuit toute seule sur une fissure chaude. Je lui parle, elle mijote mieux.'],
      talk: [{ whenDone: 'sun_6', lines: ['Un sixième soleil de moins, c\'est une casserole de moins à surveiller. Tenez, une brioche à la braise : elle est chaude, mais elle ne mord pas.'] }] },
    lizard_zao: { name: 'Zao', title: 'Salamandre bavarde', emoji: '🦎',
      idle: ['Je vis dans les braises. Elles sont moelleuses, je vous assure, quand on a le cuir qu\'il faut.', 'Les salamandres sont nées du feu, dit-on. Moi, je dis que je suis née dans un lit, comme tout le monde. Mais le feu est plus flatteur.'],
      talk: [{ whenDone: 'sun_6', lines: ['Un soleil de moins, c\'est un volcan qui se calme. Je suis un peu triste : mes amis les flammes dansent plus doucement.'] }] },
    hua_volcan: { name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒',
      idle: ['Gants ignifugés, éventails de pierre, tisane contre les brûlures de langue : tout est à vendre, sauf ma patience.', 'Dernièrement, j\'ai vendu une lanterne à un archer pressé. Il ne m\'a pas dit son nom, mais il avait un air de jalousie bien cuite.'],
      talk: [{ whenDone: 'sun_6', lines: ['Je suis encore là, archer ! Le prochain arrêt, c\'est la plaine des Fauves. Je compte vendre des bergères à des moutons. Non, l\'inverse.'] }] },
    young_miner_bo: { name: 'Bo', title: 'Jeune mineur curieux', emoji: '👷',
      idle: ['Je viens d\'être embauché. Shan m\'a dit de ne jamais toucher une pierre rouge. Je me demande pourquoi.', 'Un jour, je découvrirai une veine de jade. Je la montrerai à tout le monde, puis je la garderai pour moi.'],
      talk: [{ whenDone: 'sun_6', lines: ['Les gorges sont plus calmes depuis que le soleil de magma est tombé. Shan dit que je peux toucher une pierre rouge, maintenant. J\'ai touché. Elle était chaude.'] }] },
    forge_spirit: { name: 'Cendrillon', title: 'Esprit de la forge de lave', emoji: '🔥',
      idle: ['Je suis la dernière braise de la forge. Je garde le secret de l\'enclume, et de ceux qui l\'ont frappée.', 'On m\'appelle Cendrillon, parce que je dors dans les cendres. Un prince viendra m\'y réveiller un jour.'],
      talk: [{ whenDone: 'sq_cendrillon', lines: ['Dites au vieux Fei que son bain est trop chaud pour mes souvenirs. Le disciple est parti vers l\'ouest, rageur. Il a dit qu\'il reviendrait « pour l\'élixir ». Je n\'ai rien compris, moi, je suis une braise.'] }] }
  },
  chests: {
    shan_ore_box: { label: 'Caisse de minerais', openText: '🎁 Des minerais étiquetés, et une bourse de mineur au fond. Shan appelle ça « le filon personnel ».', emoji: '⛏️', emojiOpened: '⛏️' },
    lava_vase: { label: 'Vase de lave scellé', openText: '🎁 Un vase sombre aux reflets rouges, rempli de pièces patinées par la chaleur.', emoji: '🏺', emojiOpened: '🏺' },
    cantine_stash: { label: 'Réserve de la cantine', openText: '🎁 Sous les sacs de nouilles : un petit pécule que Dada garde pour les jours de grande faim.', emoji: '🥡', emojiOpened: '🥡' },
    cinder_cache: { label: 'Cache dans les cendres', openText: '🎁 Dans les cendres tièdes, une cassette de mineur, noircie mais intacte.', emoji: '🪨', emojiOpened: '🪨' },
    basalt_niche: { label: 'Niche de basalte cachée', openText: '🎁 Le plus beau vase de Rui, lisse et sombre, veiné de rouge. Il repose sur quelques pièces.', emoji: '🏺', emojiOpened: '🏺' },
    forge_vault: { label: 'Caveau de la forge', openText: '🎁 Le caveau de la vieille forge. Des lingots refroidis et des pièces fondues en grappes.', emoji: '🔥', emojiOpened: '🔥' }
  },
  quests: [
    { id: 'sq_pont_braise', title: 'Le pont de braise', chapter: '✦ Quête secondaire — Gorges du Volcan', giver: 'miner_shan', turnIn: 'miner_shan', requires: [], side: true,
      objectives: [{ type: 'kill', target: 'volcan_forge_giant', text: 'Calmer le forgeron de lave qui frappe sur le pont de basalte (coulées rougeoyantes)' }],
      offer: ['Seigneur archer, le pont de basalte menant au sanctuaire est rompu. Un forgeron de lave y frappe son enclume nuit et jour, et nous ne pouvons pas le réparer.', 'Calmez-le à votre manière, mais gardez quelques planches : nous aurons du travail.'],
      hint: ['Le forgeron de lave se dresse sur le pont de basalte, au bout des coulées rougeoyantes.'],
      complete: ['Le pont est libre ! Nous allons le réparer avant la nuit. Prenez cette pierre de forge : elle garde la chaleur pour les flèches froides.'],
      reward: { gold: 150, fragment: 'Pierre de forge', xp: 260 } },
    { id: 'sq_vase_rui', title: 'Le vase de Rui', chapter: '✦ Quête secondaire — Gorges du Volcan', giver: 'potter_rui', turnIn: 'potter_rui', requires: [], side: true,
      objectives: [{ type: 'chest', target: 'basalt_niche', text: 'Récupérer le vase de Rui dans la niche de basalte (coulées rougeoyantes)' }],
      offer: ['J\'ai laissé mon plus beau vase dans une niche de basalte, avant que les gorges ne s\'embrasent. Il est trop beau pour finir en cendres.', 'Récupérez-le, archer, avant qu\'il ne refroidisse. Il y a des vases qui se fâchent quand on les oublie.'],
      hint: ['La niche de basalte est cachée dans les coulées rougeoyantes. Cherchez une paroi lisse, presque polie.'],
      complete: ['Mon vase ! Il est encore tiède, comme un enfant endormi. Il vous revient en partie : ce fragment de lave refroidie est ma meilleure création.'],
      reward: { gold: 155, fragment: 'Lave refroidie', xp: 270 } },
    { id: 'sq_cendrillon', title: 'Le murmure de la forge', chapter: '✦ Quête secondaire — Gorges du Volcan', giver: 'bather_fei', turnIn: 'bather_fei', requires: ['sq_vase_rui'], side: true,
      objectives: [{ type: 'talk', target: 'forge_spirit', text: 'Interroger Cendrillon, l\'esprit de la forge (coulées rougeoyantes)', lines: ['Un disciple en colère ? Oui, il est passé. Il parlait d\'un vieux maître, d\'un flacon, d\'une porte close. Il est reparti vers l\'ouest, les poings serrés. Moi, je n\'ai pas bougé : j\'étais une braise.'] }],
      offer: ['Archer, j\'ai entendu Fengmeng passer dans les gorges, en pestant. Il parlait de son maître et d\'un flacon d\'immortalité. Je suis trop vieux pour y aller, et trop sage pour m\'en mêler.', 'L\'esprit de la forge, Cendrillon, a tout vu. Demandez-lui, gentiment : les braises sont susceptibles.'],
      hint: ['Cendrillon, l\'esprit de la forge, se trouve dans les coulées rougeoyantes. Soyez poli : c\'est une braise.'],
      complete: ['Ainsi il convoite l\'élixir… Merci, archer. Gardez cette cendre vive : un souvenir de la forge, pour vos flèches de feu.'],
      reward: { gold: 160, fragment: 'Cendre vive', xp: 280 } }
  ]
};

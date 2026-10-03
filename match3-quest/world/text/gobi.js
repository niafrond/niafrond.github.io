// Textes — Désert de Gobi (Caravansérail de Yueya, dunes des Voix Sablées).
export default {
  screens: {
    gobi_village: { name: 'Caravansérail de Yueya', arrival: [
      'Yueya, le « Croissant », se blottit contre une dune en forme de sourire. On y troque tout, sauf l\'ombre, qui est gratuite.',
      'Des clochettes de chameaux tintent comme de la monnaie qui rêve.'] },
    gobi_wild: { name: 'Dunes des Voix Sablées', gateMessage: 'Le chef de dune, Bras-de-Sable, tient le col et réclame un péage : impossible de passer tant qu\'il est debout.', arrival: [
      'Le sable chante ici, d\'une voix grave et patiente. Fiez-vous à vos pas plus qu\'à vos yeux : les mirages ont de l\'humour, et pas toujours bon.'] },
    gobi_h_ma: { name: 'Entrepôt du marchand Ma', arrival: ['Ballots de soie, jarres de thé, balances partout. Chaque pièce y est pesée deux fois, et chaque sourire trois.'] },
    gobi_h_dawa: { name: 'Tente de Dawa', arrival: ['Des étoiles brodées au feutre et une odeur de thé à la cardamome. Dawa lit le ciel comme d\'autres lisent leurs comptes.'] },
    gobi_h_bains: { name: 'Maison des eaux', arrival: ['La citerne du caravansérail : fraîche, sombre, presque sacrée. On y parle bas, par respect pour l\'eau.'] },
    gobi_h_cartes: { name: 'Atelier du cartographe', arrival: ['Des dizaines de cartes du désert, qui se contredisent toutes avec la plus grande assurance.'] },
    gobi_h_chameaux: { name: 'Écurie des chameaux', arrival: ['Les chameaux vous jaugent du haut de leur nez. L\'un d\'eux soupire, visiblement déçu par votre allure.'] }
  },
  npcs: {
    keeper_nur: { name: 'Nur', title: 'Gardienne de la citerne', emoji: '🧕',
      idle: ['L\'eau est sacrée ici. Ne la gaspillez pas, ne la comptez pas, et surtout ne la bénissez pas à voix haute : elle rougit.', 'Chaque goutte a un nom. La dernière s\'appelle Espoir. Je ne lui parle jamais, de peur qu\'elle s\'évapore.'],
      talk: [{ whenDone: 'sun_4', lines: ['Le quatrième soleil n\'est plus. L\'eau de la citerne paraît plus douce. Je jure qu\'elle a souri.'] }] },
    mapmaker_ali: { name: 'Ali', title: 'Cartographe optimiste', emoji: '🗺️',
      idle: ['Mes cartes sont exactes. Enfin, jusqu\'à ce que la dune bouge. Alors je les corrige. Au pire, je les réécris.', 'Un voyageur m\'a demandé la route de l\'Occident. Je lui ai dit : « Tout droit, puis à gauche au troisième mirage ». Il n\'a pas ri. Il avait un arc au dos.'],
      talk: [{ whenDone: 'sun_4', lines: ['Le quatrième soleil tombé, mon encre sèche moins vite. J\'ai redessiné toute la carte. Elle est fausse, mais avec plus de style.'] }] },
    camel_baba: { name: 'Baba', title: 'Chameau diplomate', emoji: '🐫',
      idle: ['Pfff. Les humains courent, je marche. Qui arrive le premier ? Moi, et sans me plaindre.', 'Je crache sur ceux qui m\'ennuient. Je ne vous ai pas encore craché dessus, archer : c\'est un compliment.'],
      talk: [{ whenDone: 'sun_4', lines: ['Pfff. Un soleil de moins, c\'est un chameau de moins qui transpire. Je te regarde presque avec respect, mortel.'] }] },
    hua_gobi: { name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒',
      idle: ['Encore vous ! Le monde est un village où les routes se croisent. Tenez, goûtez cette datte : elle n\'a pas peur du soleil.', 'Au Gobi, on vend du sel, de l\'eau, et surtout des histoires. Les histoires pèsent moins lourd que le sel.'],
      talk: [{ whenDone: 'sq_lettre_bao_2', lines: ['Votre lettre est bien arrivée ? Oh, je vois. Gardez-la encore un peu : la route de la mer est longue, et je n\'y vais qu\'à l\'hiver.'] }, { whenDone: 'sun_4', lines: ['Un soleil de moins ! Mon prix de l\'eau a baissé de moitié. C\'est la première fois que je vends moins cher avec plaisir.'] }] },
    storyteller_yun: { name: 'Yun', title: 'Conteur de caravane', emoji: '📖',
      idle: ['Écoutez la légende de Hou Yi et des dix soleils… non, ne me payez pas : vous êtes dedans.', 'La nuit, au caravansérail, on raconte qu\'un disciple jaloux fait des vœux devant la lune. On dit aussi que la lune ne répond pas aux jaloux.'],
      talk: [{ whenDone: 'sun_4', lines: ['Quatre soleils ! La légende s\'allonge, archer. Je vais devoir réécrire le début pour faire de la place à la suite.'] }] },
    boy_tarik: { name: 'Tarik', title: 'Garçon passeur d\'eau', emoji: '👦',
      idle: ['Je porte l\'eau de la citerne aux voyageurs. Une gorgée pour un sourire, deux pour un conte.', 'Un jour, je serai guide comme Dawa. Je saurai trouver le vrai soleil même au milieu de cent faux.'],
      talk: [{ whenDone: 'sun_4', lines: ['Dawa dit que vous avez trouvé le vrai soleil parmi les doubles ! Moi, j\'aurais flanché. Vous m\'apprenez à viser, un jour ?'] }] },
    mirage_djinn: { name: 'Sablier', title: 'Esprit des mirages repenti', emoji: '🧞',
      idle: ['Autrefois, je montrais aux voyageurs des oasis qui n\'existaient pas. Aujourd\'hui, je ne leur montre que des vérités fatigantes.', 'Les mirages sont des mensonges qui ont perdu leur chemin. Je les aide à rentrer.'],
      talk: [{ whenDone: 'sq_carte_vraie', lines: ['Votre cartographe a de la chance : sa carte est presque exacte. J\'y ai glissé un mirage, pour le principe.'] }] }
  },
  chests: {
    ma_strongbox: { label: 'Coffre-fort de Ma', openText: '🎁 Le coffre-fort de Ma est si bien gardé que même lui hésite à l\'ouvrir. Un joli bénéfice vous attend.', emoji: '🧰', emojiOpened: '🧰' },
    cistern_jar: { label: 'Jarre de la citerne', openText: '🎁 Au fond de la jarre sacrée : quelques pièces offertes par des voyageurs reconnaissants. L\'eau, elle, garde son secret.', emoji: '🏺', emojiOpened: '🏺' },
    saddle_bag: { label: 'Sacoche de selle', openText: '🎁 Une sacoche oubliée par un caravanier : pièces, dattes et un mot griffonné « à retrouver ».', emoji: '👜', emojiOpened: '👜' },
    dune_cache: { label: 'Cache sous la dune', openText: '🎁 Sous le sable, une cassette de pillard enterrée à la hâte. Un peu de monnaie rouillée.', emoji: '🪨', emojiOpened: '🪨' },
    mirage_chest: { label: 'Coffre mirage (le vrai !)', openText: '🎁 Parmi tous les coffres illusoires, celui-ci est bien réel. Une jolie bourse, et un miroir de poche pour se consoler des autres.', emoji: '🪞', emojiOpened: '🪞' },
    warlord_loot: { label: 'Butin du chef de dune', openText: '🎁 Les péages du chef de dune, soigneusement entassés. Il en prenait beaucoup, pour une dune.', emoji: '💰', emojiOpened: '💰' }
  },
  quests: [
    { id: 'sq_lettre_bao_3', title: 'La lettre prend le large', chapter: '✦ Quête secondaire — Désert de Gobi', giver: 'hua_gobi', turnIn: 'sailor_bao', requires: ['sq_lettre_bao_2'], side: true,
      objectives: [{ type: 'talk', target: 'sailor_bao', text: 'Remettre la lettre de Petit Bao à son père, le marin Bao (Port aux Perles de Haiyan, Mer Orientale)', lines: ['Une lettre de mon petit Bao ? Donnez, donnez ! Mes mains tremblent plus que sur la grand-voile.'] }],
      offer: ['Votre lettre est arrivée jusqu\'ici sans se froisser, bravo. Moi, je ne vais pas à la mer avant l\'hiver. Mais vous, si !', 'Le père de Petit Bao s\'appelle Bao, comme son fils. Il vit au Port aux Perles de Haiyan. Dites-lui que l\'enfant va bien et que la maison tient.'],
      hint: ['Le marin Bao habite au Port aux Perles de Haiyan, sur le rivage de la Mer Orientale.'],
      complete: ['Bao serre la lettre contre son cœur, les yeux humides : « Je vais répondre. Il faudra que quelqu\'un la porte, jusqu\'à Dongqiao. »'],
      reward: { gold: 90, fragment: 'Vent de marin', xp: 150 } },
    { id: 'sq_carte_vraie', title: 'La carte qui ne ment pas', chapter: '✦ Quête secondaire — Désert de Gobi', giver: 'mapmaker_ali', turnIn: 'mapmaker_ali', requires: [], side: true,
      objectives: [
        { type: 'talk', target: 'mirage_djinn', text: 'Écouter l\'esprit Sablier (dunes des Voix Sablées)', lines: ['Je ne peux pas dessiner, mais je peux montrer. Le vrai coffre est celui qui ne brille pas. Cherchez parmi les dunes celui qui n\'a pas d\'ombre… non, attendez, c\'est le contraire : celui qui en a une.'] },
        { type: 'chest', target: 'mirage_chest', text: 'Ouvrir le vrai coffre parmi les mirages (dunes des Voix Sablées)' }],
      offer: ['Seigneur archer, je veux dessiner une carte exacte des dunes, une fois dans ma vie. Mais Sablier, l\'esprit des mirages, brouille ma vue.', 'Écoutez-le, il parle volontiers. Puis trouvez le coffre qu\'il vous désignera : il contient le plus précieux, un compas qui ne dérive pas.'],
      hint: ['Sablier rôde dans les dunes des Voix Sablées. Le coffre vrai est celui qui projette une ombre.'],
      complete: ['Un compas qui ne dérive pas ! Ma carte sera enfin juste. Gardez ce grain de sable étoilé : il vient du centre du désert.'],
      reward: { gold: 100, fragment: 'Sable étoilé', xp: 170 } },
    { id: 'sq_golems_puits', title: 'Les golems du puits', chapter: '✦ Quête secondaire — Désert de Gobi', giver: 'keeper_nur', turnIn: 'keeper_nur', requires: [], side: true,
      objectives: [{ type: 'killGroup', target: 'dune_golems', text: 'Abattre les deux golems de sable qui boivent l\'eau de la citerne (dunes des Voix Sablées)' }],
      offer: ['Deux golems de sable rôdent près de la citerne. Chaque nuit sans lune, ils boivent à même ma jarre, et ils ne sont pas élégants.', 'Débarrassez-nous-en, seigneur archer, avant qu\'il ne reste plus une goutte dans le désert.'],
      hint: ['Les deux golems de sable rôdent dans les dunes des Voix Sablées. Ils sont lents, mais têtus.'],
      complete: ['L\'eau est sauve ! Prenez ceci : une larme de la citerne, cristallisée. Elle brille plus fort qu\'un diamant, et se boit plus vite.'],
      reward: { gold: 110, fragment: 'Larme de citerne', xp: 180 } }
  ]
};

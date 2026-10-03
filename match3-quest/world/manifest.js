// Manifeste du « Grand Monde » — squelette narratif (étape 1). Voir world/FORMAT.md §2.
// Fils récurrents : Hua la colporteuse (hua_*), la lettre de Petit Bao (sq_lettre_bao_1..3),
// le rival Fengmeng (rumeurs), l'élixir de Chang'e, la tortue Gui et le conteur Lao Shuo.

export const MANIFEST = {
  // ───────────────────────── 1. RIZIÈRES ─────────────────────────
  rizieres: {
    village: {
      id: 'rizieres_village', name: 'Hameau de Dongqiao',
      mood: 'Un village de chaume et de lanternes pâles, où l\'on parle de pluie comme d\'une vieille amie disparue.',
      arrival: ['Dongqiao se serre autour de son puits à sec. Les lanternes rouges pendent mollement : même le vent a fait la sieste.',
                'Au loin, les digues craquelées attendent un archer.']
    },
    wild: {
      id: 'rizieres_wild', name: 'Digue et Marais Craquelés',
      mood: 'Une digue de terre fendue, des roseaux secs qui crissent et la boue cuite en dallage de poterie.',
      arrival: ['Au-delà du hameau, la terre s\'est ouverte comme une assiette fêlée. Les roseaux murmurent des rumeurs que seuls les crapauds comprennent.'],
      gate: { type: 'kill', id: 'rizieres_warden', hint: 'Le vieux gardien de la digue, rendu fou par la chaleur, barre le chemin du sanctuaire et prend les voyageurs pour des voleurs d\'eau.' }
    },
    houses: [
      { id: 'rizieres_h_houyi', name: 'Maison de Hou Yi et Chang\'e', desc: 'Le foyer de l\'archer : un arc au mur, un four à gâteaux de lune toujours tiède.', residents: ['change'], chests: ['houyi_trunk'] },
      { id: 'rizieres_h_wen', name: 'Maison du Doyen Wen', desc: 'Une salle pleine de rouleaux de comptes de récoltes, de plus en plus courts.', residents: ['elder_wen'], chests: ['wen_scroll_box'] },
      { id: 'rizieres_h_lin', name: 'Chaumière de Lin', desc: 'Une chaumière modeste où une jarre ébréchée trône sur l\'autel des ancêtres.', residents: ['farmer_lin', 'ping'], chests: [] },
      { id: 'rizieres_h_grenier', name: 'Grenier communal', desc: 'Le grenier du hameau, désormais plus sonore que rempli.', residents: ['grandma_tao'], chests: ['granary_sack'] },
      { id: 'rizieres_h_etable', name: 'Étable de Dahei', desc: 'Une étable tiède qui sent la paille, où dort le buffle le plus philosophe de la province.', residents: ['buffalo_dahei'], chests: [] }
    ],
    npcs: [
      { id: 'change', where: 'house:rizieres_h_houyi' },
      { id: 'elder_wen', where: 'house:rizieres_h_wen' },
      { id: 'farmer_lin', where: 'house:rizieres_h_lin' },
      { id: 'ping', name: 'Ping', title: 'Épouse de Lin', emoji: '👩‍🌾', where: 'house:rizieres_h_lin', role: 'ambiance' },
      { id: 'xiaobao', name: 'Petit Bao', title: 'Enfant du hameau', emoji: '🧒', where: 'place', role: 'donneur' },
      { id: 'grandma_tao', name: 'Grand-mère Tao', title: 'Doyenne des commères', emoji: '👵', where: 'house:rizieres_h_grenier', role: 'indice' },
      { id: 'buffalo_dahei', name: 'Dahei', title: 'Buffle d\'eau philosophe', emoji: '🐃', where: 'house:rizieres_h_etable', role: 'ambiance' },
      { id: 'hua_riz', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'place', role: 'marchand' },
      { id: 'scarecrow_cao', name: 'Cao l\'Épouvantail', title: 'Sentinelle des champs', emoji: '🎃', where: 'place', role: 'ambiance' },
      { id: 'huang_xian', name: 'Huang Xian', title: 'Belette jaune de la digue', emoji: '🦦', where: 'wild', role: 'indice' }
    ],
    chests: [
      { id: 'houyi_trunk', where: 'house:rizieres_h_houyi', tier: 1, label: 'Coffre de voyage de Hou Yi' },
      { id: 'wen_scroll_box', where: 'house:rizieres_h_wen', tier: 1, label: 'Boîte à rouleaux du Doyen' },
      { id: 'granary_sack', where: 'house:rizieres_h_grenier', tier: 2, label: 'Dernier sac du grenier' },
      { id: 'dike_cache', where: 'wild', tier: 1, label: 'Cache sous la digue' },
      { id: 'reed_kite', where: 'wild', tier: 2, label: 'Cerf-volant dans les roseaux' },
      { id: 'warden_hoard', where: 'wild', tier: 3, label: 'Trésor du gardien de la digue' }
    ],
    enemies: [
      { id: 'rizieres_warden', name: 'Gardien de la digue', templateHint: 'forest_guardian', role: 'gate' },
      { id: 'rizieres_marsh_imp', name: 'Xiao Gui des roseaux', templateHint: 'goblin_saboteur', role: 'quest' }
    ],
    quests: [
      { id: 'sq_cerf_volant', title: 'Le cerf-volant de Petit Bao', giver: 'xiaobao', turnIn: 'xiaobao', chain: null,
        summary: 'Le cerf-volant de Petit Bao s\'est pris dans les roseaux de la digue. Retrouvez-le avant que le marais ne le mange.',
        objectives: [{ type: 'chest', target: 'reed_kite' }] },
      { id: 'sq_cerf_volant_ficelle', title: 'La ficelle du chapardeur', giver: 'xiaobao', turnIn: 'xiaobao', chain: 'sq_cerf_volant',
        summary: 'Le cerf-volant est retrouvé, mais sa ficelle a été volée par un petit démon des roseaux. Corrigez ce Xiao Gui sans méchanceté.',
        objectives: [{ type: 'kill', target: 'rizieres_marsh_imp' }] },
      { id: 'sq_lettre_bao_1', title: 'Une lettre pour papa', giver: 'xiaobao', turnIn: 'ferryman_gu', chain: null,
        summary: 'Petit Bao a écrit à son père, marin parti vers la Mer Orientale. Confiez la lettre au passeur Gu, au Lit du Fleuve Jaune.',
        objectives: [{ type: 'talk', target: 'ferryman_gu' }] }
    ]
  },

  // ───────────────────────── 2. FLEUVE ─────────────────────────
  fleuve: {
    village: {
      id: 'fleuve_village', name: 'Port-à-Sec de Hekou',
      mood: 'Un port où les bateaux reposent sur le flanc comme des baleines échouées et où l\'on amarre les rumeurs faute d\'eau.',
      arrival: ['Les quais de Hekou donnent sur du vide : des barques couchées dans la boue, des amarres tendues vers rien.',
                'Les habitants vous regardent avec cet espoir poli que l\'on réserve aux marchands de pluie.']
    },
    wild: {
      id: 'fleuve_wild', name: 'Méandres de Boue et d\'Écluses',
      mood: 'Le fond d\'un grand fleuve mis à nu : bancs de vase craquelée, écluses rouillées, ossements de bateaux.',
      arrival: ['Le fleuve s\'est retiré comme un roi vexé, laissant derrière lui ses meubles. Quelque part, une vieille écluse garde encore son secret.'],
      gate: { type: 'chest', id: 'sluice_key_chest', hint: 'La grande écluse qui mène au sanctuaire est verrouillée : sa clé repose dans un coffre englouti, quelque part dans les méandres.' }
    },
    houses: [
      { id: 'fleuve_h_gu', name: 'Cabane du passeur Gu', desc: 'Une cabane de planches goudronnées, ornée de rames de rechange et d\'un poisson séché porte-bonheur.', residents: ['ferryman_gu'], chests: ['ferry_lockbox'] },
      { id: 'fleuve_h_mei', name: 'Atelier de Mei', desc: 'Un métier à tisser immense et mille fils de couleur qui racontent des histoires.', residents: ['weaver_mei'], chests: ['mei_thread_box'] },
      { id: 'fleuve_h_sel', name: 'Entrepôt de sel de Hu', desc: 'Des pyramides de sel gris et un marchand qui goûte tout ce qu\'on lui vend.', residents: ['salt_hu'], chests: ['salt_barrel'] },
      { id: 'fleuve_h_ecrivain', name: 'Échoppe de l\'écrivain public', desc: 'Pinceaux, encre et pigeons voyageurs : on y écrit, on y lit et on y colporte.', residents: ['scribe_ou'], chests: [] },
      { id: 'fleuve_h_tortue', name: 'Mare de la Tortue Gui', desc: 'Une dernière mare cernée de pierres où vit la plus ancienne habitante du fleuve.', residents: ['gui_turtle'], chests: [] }
    ],
    npcs: [
      { id: 'ferryman_gu', where: 'house:fleuve_h_gu' },
      { id: 'weaver_mei', where: 'house:fleuve_h_mei' },
      { id: 'salt_hu', name: 'Hu', title: 'Marchand de sel', emoji: '🧂', where: 'house:fleuve_h_sel', role: 'marchand' },
      { id: 'scribe_ou', name: 'Maître Ou', title: 'Écrivain public', emoji: '🖋️', where: 'house:fleuve_h_ecrivain', role: 'indice' },
      { id: 'gui_turtle', name: 'Gui', title: 'Vieille tortue noire', emoji: '🐢', where: 'house:fleuve_h_tortue', role: 'indice' },
      { id: 'girl_lian', name: 'Lian', title: 'Collectionneuse de coquillages', emoji: '👧', where: 'place', role: 'donneur' },
      { id: 'boatman_shan', name: 'Laoshan', title: 'Batelier désœuvré', emoji: '🧑‍🦲', where: 'place', role: 'ambiance' },
      { id: 'hua_fleuve', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'place', role: 'marchand' },
      { id: 'carp_jin', name: 'Jin', title: 'Carpe dorée dans sa flaque', emoji: '🐟', where: 'wild', role: 'indice' }
    ],
    chests: [
      { id: 'ferry_lockbox', where: 'house:fleuve_h_gu', tier: 1, label: 'Cassette du passeur' },
      { id: 'mei_thread_box', where: 'house:fleuve_h_mei', tier: 1, label: 'Boîte à fils de soie' },
      { id: 'salt_barrel', where: 'house:fleuve_h_sel', tier: 2, label: 'Tonneau de sel scellé' },
      { id: 'mud_cache', where: 'wild', tier: 1, label: 'Cache dans la vase' },
      { id: 'carp_pearl', where: 'wild', tier: 2, label: 'Perle de la flaque dorée' },
      { id: 'sluice_key_chest', where: 'wild', tier: 2, label: 'Coffre-clé de l\'écluse' },
      { id: 'wreck_hoard', where: 'wild', tier: 3, label: 'Cale d\'une épave' }
    ],
    enemies: [
      { id: 'fleuve_sluice_golem', name: 'Golem de l\'écluse', templateHint: 'iron_gladiator', role: 'elite' },
      { id: 'fleuve_salt_thief', name: 'Voleur de sel masqué', templateHint: 'shadow_assassin', role: 'quest' }
    ],
    quests: [
      { id: 'sq_lettre_bao_2', title: 'La lettre fait escale', giver: 'ferryman_gu', turnIn: 'hua_gobi', chain: 'sq_lettre_bao_1',
        summary: 'Gu ne peut pas quitter son fleuve, mais Hua la colporteuse part vers le Désert de Gobi. Rejoignez-la pour lui confier la lettre de Petit Bao.',
        objectives: [{ type: 'talk', target: 'hua_gobi' }] },
      { id: 'sq_perle_carpe', title: 'La perle de la carpe Jin', giver: 'girl_lian', turnIn: 'girl_lian', chain: null,
        summary: 'Lian jure que la carpe Jin garde une perle dans sa flaque, au creux des méandres. Allez la chercher avant que la flaque ne s\'évapore.',
        objectives: [{ type: 'talk', target: 'carp_jin' }, { type: 'chest', target: 'carp_pearl' }] },
      { id: 'sq_sel_vole', title: 'Le sel envolé', giver: 'salt_hu', turnIn: 'salt_hu', chain: null,
        summary: 'Un voleur masqué dérobe le sel de Hu pour le revendre aux caravanes. Retrouvez-le dans les méandres et rapportez les sacs.',
        objectives: [{ type: 'kill', target: 'fleuve_salt_thief' }] }
    ]
  },

  // ───────────────────────── 3. BAMBOUS ─────────────────────────
  bambous: {
    village: {
      id: 'bambous_village', name: 'Village des Cent Tiges',
      mood: 'Des maisons sur pilotis de bambou noirci, des clochettes de vent muettes et une odeur de thé brûlé.',
      arrival: ['Le village des Cent Tiges n\'en compte plus que dix-neuf debout. Les autres sont devenues des flûtes, des balais et des souvenirs.',
                'Quelqu\'un, quelque part, essaie encore de jouer un air.']
    },
    wild: {
      id: 'bambous_wild', name: 'Sentier des Tiges Cendrées',
      mood: 'Un sentier de cendre tiède entre des tiges calcinées qui craquent comme des genoux de vieux.',
      arrival: ['La forêt brûlée respire à peine. Des sceaux de papier pendent aux tiges : le moine Zhen a tenté de contenir quelque chose.'],
      gate: { type: 'quest', id: 'sq_sentier_sceaux', hint: 'Un gardien de cendres retient le sentier du temple : il faut le dompter pour que les sceaux du moine Zhen tiennent à nouveau.' }
    },
    houses: [
      { id: 'bambous_h_zhen', name: 'Cellule du moine Zhen', desc: 'Une cellule austère : une natte, un gong fêlé et des sceaux de papier prêts à servir.', residents: ['monk_zhen'], chests: ['zhen_alms_box'] },
      { id: 'bambous_h_xu', name: 'Officine de Xu', desc: 'Des centaines de bocaux d\'herbes : on dirait que la forêt entière s\'y est rangée en étiquettes.', residents: ['herbalist_xu'], chests: ['xu_herb_chest'] },
      { id: 'bambous_h_the', name: 'Maison de thé de Dame Lan', desc: 'Une salle de thé chaleureuse, où l\'on parle bas et où l\'on se ressert souvent.', residents: ['lady_lan', 'panda_mimi'], chests: [] },
      { id: 'bambous_h_papier', name: 'Atelier de papier', desc: 'Des feuilles de papier de bambou sèchent sur des cordes comme du linge de fantômes.', residents: ['ke_paper', 'apprentice_zhu'], chests: ['paper_roll_box'] },
      { id: 'bambous_h_flute', name: 'Maison du flûtiste', desc: 'Une maison pleine de flûtes de toutes tailles, dont aucune ne joue juste.', residents: ['flutist_chuan'], chests: [] }
    ],
    npcs: [
      { id: 'monk_zhen', where: 'house:bambous_h_zhen' },
      { id: 'herbalist_xu', where: 'house:bambous_h_xu' },
      { id: 'lady_lan', name: 'Dame Lan', title: 'Tenancière de la maison de thé', emoji: '🍵', where: 'house:bambous_h_the', role: 'indice' },
      { id: 'panda_mimi', name: 'Mimi', title: 'Jeune panda lettré', emoji: '🐼', where: 'house:bambous_h_the', role: 'ambiance' },
      { id: 'ke_paper', name: 'Vieux Ke', title: 'Papetier', emoji: '🧓', where: 'house:bambous_h_papier', role: 'ambiance' },
      { id: 'apprentice_zhu', name: 'Petite Zhu', title: 'Apprentie papetière', emoji: '👧', where: 'house:bambous_h_papier', role: 'ambiance' },
      { id: 'flutist_chuan', name: 'Chuan', title: 'Flûtiste en panne d\'air', emoji: '🪈', where: 'house:bambous_h_flute', role: 'donneur' },
      { id: 'huli_xia', name: 'Xia', title: 'Renarde huli jing curieuse', emoji: '🦊', where: 'place', role: 'indice' },
      { id: 'lantern_old', name: 'Vieux Lanternier', title: 'Esprit des sentiers', emoji: '🏮', where: 'wild', role: 'indice' }
    ],
    chests: [
      { id: 'zhen_alms_box', where: 'house:bambous_h_zhen', tier: 1, label: 'Tronc des offrandes' },
      { id: 'xu_herb_chest', where: 'house:bambous_h_xu', tier: 2, label: 'Coffre aux simples rares' },
      { id: 'paper_roll_box', where: 'house:bambous_h_papier', tier: 1, label: 'Caisse de papier précieux' },
      { id: 'ash_cache', where: 'wild', tier: 1, label: 'Cache sous la cendre' },
      { id: 'hollow_stem', where: 'wild', tier: 2, label: 'Tige creuse scellée' },
      { id: 'monk_hoard', where: 'wild', tier: 3, label: 'Réserve oubliée du temple' }
    ],
    enemies: [
      { id: 'bambous_seal_keeper', name: 'Gardien des cendres', templateHint: 'temple_warden', role: 'gate' },
      { id: 'bambous_ember_wisp', name: 'Lingzhi des braises', templateHint: 'fungal_horror', role: 'quest', group: 'ember_lingzhi' },
      { id: 'bambous_ember_wisp_b', name: 'Lingzhi des braises', templateHint: 'fungal_horror', role: 'quest', group: 'ember_lingzhi' }
    ],
    quests: [
      { id: 'sq_flute_1', title: 'La flûte fêlée', giver: 'flutist_chuan', turnIn: 'flutist_chuan', chain: null,
        summary: 'La flûte de Chuan s\'est fendue dans l\'incendie. Une tige creuse intacte, scellée quelque part sur le sentier, pourrait la remplacer.',
        objectives: [{ type: 'chest', target: 'hollow_stem' }] },
      { id: 'sq_flute_2', title: 'Le chant du bambou', giver: 'flutist_chuan', turnIn: 'flutist_chuan', chain: 'sq_flute_1',
        summary: 'La flûte réparée n\'obéit toujours pas : des lingzhi des braises étouffent le souffle du sentier. Chassez-les pour que l\'air chante à nouveau.',
        objectives: [{ type: 'killGroup', target: 'ember_lingzhi' }] },
      { id: 'sq_sentier_sceaux', title: 'Les sceaux du sentier', giver: 'monk_zhen', turnIn: 'monk_zhen', chain: null,
        summary: 'Le moine Zhen ne peut renouveler les sceaux tant qu\'un gardien de cendres rôde sur le sentier. Abattez-le sans insulter les bambous.',
        objectives: [{ type: 'kill', target: 'bambous_seal_keeper' }] }
    ]
  },

  // ───────────────────────── 4. GOBI ─────────────────────────
  gobi: {
    village: {
      id: 'gobi_village', name: 'Caravansérail de Yueya',
      mood: 'Un caravansérail de pisé ocre autour d\'un puits précieux, où chaque conversation commence par le prix de l\'eau.',
      arrival: ['Yueya, le « Croissant », se blottit contre une dune en forme de sourire. On y troque tout, sauf l\'ombre, qui est gratuite.',
                'Des clochettes de chameaux tintent comme de la monnaie qui rêve.']
    },
    wild: {
      id: 'gobi_wild', name: 'Dunes des Voix Sablées',
      mood: 'Des dunes qui murmurent au vent, des os de chameaux blanchis et des miroirs de chaleur trompeurs.',
      arrival: ['Le sable chante ici, d\'une voix grave et patiente. Fiez-vous à vos pas plus qu\'à vos yeux : les mirages ont de l\'humour, et pas toujours bon.'],
      gate: { type: 'kill', id: 'gobi_dune_warlord', hint: 'Un chef de brigands de sable tient le col entre les dunes et exige un péage que personne ne peut payer.' }
    },
    houses: [
      { id: 'gobi_h_ma', name: 'Entrepôt du marchand Ma', desc: 'Des ballots de soie, des jarres de thé et un comptoir où chaque pièce est pesée deux fois.', residents: ['merchant_ma'], chests: ['ma_strongbox'] },
      { id: 'gobi_h_dawa', name: 'Tente de Dawa', desc: 'Une tente de feutre aux motifs d\'étoiles, où le guide lit le ciel comme un livre.', residents: ['guide_dawa'], chests: [] },
      { id: 'gobi_h_bains', name: 'Maison des eaux', desc: 'Le citerne-sanctuaire du caravansérail : fraîche, sombre, presque sacrée.', residents: ['keeper_nur'], chests: ['cistern_jar'] },
      { id: 'gobi_h_cartes', name: 'Atelier du cartographe', desc: 'Des cartes du désert qui se contredisent toutes avec assurance.', residents: ['mapmaker_ali'], chests: [] },
      { id: 'gobi_h_chameaux', name: 'Écurie des chameaux', desc: 'Une écurie bruyante où les chameaux jugent chaque visiteur du haut de leur nez.', residents: ['camel_baba'], chests: ['saddle_bag'] }
    ],
    npcs: [
      { id: 'merchant_ma', where: 'house:gobi_h_ma' },
      { id: 'guide_dawa', where: 'house:gobi_h_dawa' },
      { id: 'keeper_nur', name: 'Nur', title: 'Gardienne de la citerne', emoji: '🧕', where: 'house:gobi_h_bains', role: 'ambiance' },
      { id: 'mapmaker_ali', name: 'Ali', title: 'Cartographe optimiste', emoji: '🗺️', where: 'house:gobi_h_cartes', role: 'donneur' },
      { id: 'camel_baba', name: 'Baba', title: 'Chameau diplomate', emoji: '🐫', where: 'house:gobi_h_chameaux', role: 'ambiance' },
      { id: 'hua_gobi', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'place', role: 'marchand' },
      { id: 'storyteller_yun', name: 'Yun', title: 'Conteur de caravane', emoji: '📖', where: 'place', role: 'indice' },
      { id: 'boy_tarik', name: 'Tarik', title: 'Garçon passeur d\'eau', emoji: '👦', where: 'place', role: 'ambiance' },
      { id: 'mirage_djinn', name: 'Sablier', title: 'Esprit des mirages repenti', emoji: '🧞', where: 'wild', role: 'donneur' }
    ],
    chests: [
      { id: 'ma_strongbox', where: 'house:gobi_h_ma', tier: 2, label: 'Coffre-fort de Ma' },
      { id: 'cistern_jar', where: 'house:gobi_h_bains', tier: 1, label: 'Jarre de la citerne' },
      { id: 'saddle_bag', where: 'house:gobi_h_chameaux', tier: 1, label: 'Sacoche de selle' },
      { id: 'dune_cache', where: 'wild', tier: 1, label: 'Cache sous la dune' },
      { id: 'mirage_chest', where: 'wild', tier: 2, label: 'Coffre mirage (le vrai !)' },
      { id: 'warlord_loot', where: 'wild', tier: 3, label: 'Butin du chef de dune' }
    ],
    enemies: [
      { id: 'gobi_dune_warlord', name: 'Chef de dune, Bras-de-Sable', templateHint: 'orc_warmaster', role: 'gate' },
      { id: 'gobi_golem_a', name: 'Golem des dunes', templateHint: 'sand_colossus', role: 'quest', group: 'dune_golems' },
      { id: 'gobi_golem_b', name: 'Golem des dunes', templateHint: 'sand_colossus', role: 'quest', group: 'dune_golems' }
    ],
    quests: [
      { id: 'sq_lettre_bao_3', title: 'La lettre prend le large', giver: 'hua_gobi', turnIn: 'sailor_bao', chain: 'sq_lettre_bao_2',
        summary: 'Hua n\'ira pas jusqu\'à la mer avant l\'hiver, mais vous, si. Portez la lettre au marin Bao, sur le rivage de la Mer Orientale.',
        objectives: [{ type: 'talk', target: 'sailor_bao' }] },
      { id: 'sq_carte_vraie', title: 'La carte qui ne ment pas', giver: 'mapmaker_ali', turnIn: 'mapmaker_ali', chain: null,
        summary: 'Ali veut dessiner une carte exacte des dunes, mais le mirage Sablier lui brouille la vue. Allez écouter le djinn, puis trouvez le coffre qu\'il désigne.',
        objectives: [{ type: 'talk', target: 'mirage_djinn' }, { type: 'chest', target: 'mirage_chest' }] },
      { id: 'sq_golems_puits', title: 'Les golems du puits', giver: 'keeper_nur', turnIn: 'keeper_nur', chain: null,
        summary: 'Deux golems de sable boivent l\'eau du puits à chaque nuit sans lune. Abattez-les pour sauver la citerne.',
        objectives: [{ type: 'killGroup', target: 'dune_golems' }] }
    ]
  },

  // ───────────────────────── 5. TONNERRE ─────────────────────────
  tonnerre: {
    village: {
      id: 'tonnerre_village', name: 'Village des Forges-Éclairs',
      mood: 'Un village de pierre grise accroché à la pente, où chaque toit porte une tige de fer et chaque habitant une opinion sur les orages.',
      arrival: ['Aux Forges-Éclairs, on ne dit pas « il pleut » mais « le ciel fait ses comptes ». Le fer chante sur les toits.',
                'Les gamins courent entre les tiges de cuivre en parlant tout bas, au cas où le tonnerre écouterait.']
    },
    wild: {
      id: 'tonnerre_wild', name: 'Crêtes Foudroyées',
      mood: 'Une arête de roche vitrifiée, des arcs d\'étincelles entre les cairns et un vent qui sent le fer chaud.',
      arrival: ['Les crêtes brillent d\'un éclat vitreux là où la foudre a frappé. Des cairns de pierre portent des offrandes et des avertissements, à peu près à parts égales.'],
      gate: { type: 'chest', id: 'storm_gong_chest', hint: 'Le portail de pierre vers le sanctuaire ne s\'ouvre qu\'au son du Gong d\'orage, enfermé dans un coffre de foudre sur les crêtes.' }
    },
    houses: [
      { id: 'tonnerre_h_tie', name: 'Forge de Tie', desc: 'Un brasier rugissant, des marteaux de toutes tailles et un seau d\'eau qui n\'ose plus bouillir.', residents: ['smith_tie'], chests: ['tie_anvil_box'] },
      { id: 'tonnerre_h_lei', name: 'Grotte-cabane de Lei', desc: 'Une cabane adossée à une grotte où résonne le moindre murmure du ciel.', residents: ['hermit_lei'], chests: [] },
      { id: 'tonnerre_h_tour', name: 'Tour des paratonnerres', desc: 'Une tour de cuivre où le vieux Gang entretient les tiges qui protègent le village.', residents: ['rodman_gang'], chests: ['copper_chest'] },
      { id: 'tonnerre_h_auberge', name: 'Auberge du Coup-de-Tonnerre', desc: 'Une auberge dont la soupe est réputée « fulgurante ».', residents: ['innkeeper_pao', 'monkey_sun'], chests: [] },
      { id: 'tonnerre_h_montagne', name: 'Chapelle du Dieu des monts', desc: 'Une petite chapelle fraîche, où l\'on dépose de la monnaie contre une bonne météo.', residents: ['nun_ying'], chests: ['offering_box'] }
    ],
    npcs: [
      { id: 'smith_tie', where: 'house:tonnerre_h_tie' },
      { id: 'hermit_lei', where: 'house:tonnerre_h_lei' },
      { id: 'rodman_gang', name: 'Gang', title: 'Gardien des paratonnerres', emoji: '⚡', where: 'house:tonnerre_h_tour', role: 'donneur' },
      { id: 'innkeeper_pao', name: 'Pao', title: 'Aubergiste', emoji: '🍜', where: 'house:tonnerre_h_auberge', role: 'indice' },
      { id: 'monkey_sun', name: 'Houzi', title: 'Singe filou de l\'auberge', emoji: '🐒', where: 'house:tonnerre_h_auberge', role: 'ambiance' },
      { id: 'nun_ying', name: 'Sœur Ying', title: 'Gardienne de la chapelle', emoji: '🙏', where: 'house:tonnerre_h_montagne', role: 'ambiance' },
      { id: 'kids_leimei', name: 'Leimei', title: 'Petite chasseuse d\'étincelles', emoji: '🧒', where: 'place', role: 'ambiance' },
      { id: 'hua_tonnerre', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'place', role: 'marchand' },
      { id: 'cairn_spirit', name: 'Vieux Cairn', title: 'Esprit des pierres empilées', emoji: '🪨', where: 'wild', role: 'indice' }
    ],
    chests: [
      { id: 'tie_anvil_box', where: 'house:tonnerre_h_tie', tier: 2, label: 'Boîte sous l\'enclume' },
      { id: 'copper_chest', where: 'house:tonnerre_h_tour', tier: 1, label: 'Coffre de cuivre' },
      { id: 'offering_box', where: 'house:tonnerre_h_montagne', tier: 1, label: 'Tronc de la chapelle' },
      { id: 'crest_cache', where: 'wild', tier: 1, label: 'Cache d\'un cairn' },
      { id: 'storm_gong_chest', where: 'wild', tier: 2, label: 'Coffre du Gong d\'orage' },
      { id: 'lightning_vault', where: 'wild', tier: 3, label: 'Caveau foudroyé' }
    ],
    enemies: [
      { id: 'tonnerre_stone_lion', name: 'Lion-gardien fendu', templateHint: 'temple_warden', role: 'elite' },
      { id: 'tonnerre_crest_general', name: 'Général de la crête', templateHint: 'storm_knight', role: 'quest' }
    ],
    quests: [
      { id: 'sq_etincelles', title: 'Les étincelles de Leimei', giver: 'kids_leimei', turnIn: 'kids_leimei', chain: null,
        summary: 'Leimei collectionne les étincelles dans des pots, mais elles s\'échappent toujours. Montez parler au Vieux Cairn : il connaît un pot qui tient.',
        objectives: [{ type: 'talk', target: 'cairn_spirit' }, { type: 'chest', target: 'crest_cache' }] },
      { id: 'sq_paratonnerre', title: 'Le paratonnerre de la crête', giver: 'rodman_gang', turnIn: 'rodman_gang', chain: null,
        summary: 'La tige de cuivre de la crête ne fonctionne plus depuis qu\'un général du tonnerre s\'y perche. Délogez-le, puis allez la vérifier.',
        objectives: [{ type: 'kill', target: 'tonnerre_crest_general' }, { type: 'visit', target: 'tonnerre_wild' }] },
      { id: 'sq_singe_soupe', title: 'Le singe et la soupe', giver: 'innkeeper_pao', turnIn: 'innkeeper_pao', chain: null,
        summary: 'Houzi le singe a emporté la louche d\'argent de Pao. Il prétend l\'avoir « prêtée » au Vieux Cairn. Allez vérifier.',
        objectives: [{ type: 'talk', target: 'monkey_sun' }, { type: 'talk', target: 'cairn_spirit' }] }
    ]
  },

  // ───────────────────────── 6. VOLCAN ─────────────────────────
  volcan: {
    village: {
      id: 'volcan_village', name: 'Hameau des Braises Sages',
      mood: 'Un hameau de basalte noir chauffé par la terre elle-même, où l\'on cuit le pain dans le sol et où l\'on s\'excuse en permanence de la fumée.',
      arrival: ['Aux Braises Sages, on fait cuire le riz dans une fissure et l\'on salue le volcan chaque matin, avec la prudence que l\'on doit à un voisin irascible.',
                'Les cheminées fument. Les gens, eux, essaient de ne pas en faire autant.']
    },
    wild: {
      id: 'volcan_wild', name: 'Coulées et Passerelles Rougeoyantes',
      mood: 'Des passerelles de pierre sur des rivières de lave figée, un air qui tremble et des geysers de cendres.',
      arrival: ['Les gorges grondent doucement, à la manière d\'un grand chat qui rêve. Mieux vaut ne pas le réveiller, et surtout ne pas passer en courant.'],
      gate: { type: 'quest', id: 'sq_pont_braise', hint: 'Le pont de basalte vers le sanctuaire est rompu : un forgeron de lave doit être maîtrisé pour que les mineurs puissent le réparer.' }
    },
    houses: [
      { id: 'volcan_h_shan', name: 'Maison de Shan', desc: 'Une maison creusée dans la roche, tapissée de pics, de lampes et de minerais étiquetés.', residents: ['miner_shan'], chests: ['shan_ore_box'] },
      { id: 'volcan_h_yan', name: 'Petit temple de Yan', desc: 'Un temple modeste où brûle une flamme qui n\'a plus rien à prouver.', residents: ['priestess_yan'], chests: [] },
      { id: 'volcan_h_potier', name: 'Atelier du potier de lave', desc: 'Des vases noirs aux reflets rouges, cuits sans four, directement par la terre.', residents: ['potter_rui'], chests: ['lava_vase'] },
      { id: 'volcan_h_bains', name: 'Bains de source chaude', desc: 'Des bassins fumants où l\'on se détend entre deux éruptions.', residents: ['bather_fei'], chests: [] },
      { id: 'volcan_h_cantine', name: 'Cantine des mineurs', desc: 'Une longue table, des bols fumants et des plaisanteries sur le dos des cailloux.', residents: ['cook_dada'], chests: ['cantine_stash'] }
    ],
    npcs: [
      { id: 'miner_shan', where: 'house:volcan_h_shan' },
      { id: 'priestess_yan', where: 'house:volcan_h_yan' },
      { id: 'potter_rui', name: 'Rui', title: 'Potier de lave', emoji: '🏺', where: 'house:volcan_h_potier', role: 'donneur' },
      { id: 'bather_fei', name: 'Grand-père Fei', title: 'Baigneur invétéré', emoji: '🧖', where: 'house:volcan_h_bains', role: 'indice' },
      { id: 'cook_dada', name: 'Dada', title: 'Cuisinière des mineurs', emoji: '🍲', where: 'house:volcan_h_cantine', role: 'ambiance' },
      { id: 'lizard_zao', name: 'Zao', title: 'Salamandre bavarde', emoji: '🦎', where: 'place', role: 'ambiance' },
      { id: 'hua_volcan', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'place', role: 'marchand' },
      { id: 'young_miner_bo', name: 'Bo', title: 'Jeune mineur curieux', emoji: '👷', where: 'place', role: 'indice' },
      { id: 'forge_spirit', name: 'Cendrillon', title: 'Esprit de la forge de lave', emoji: '🔥', where: 'wild', role: 'indice' }
    ],
    chests: [
      { id: 'shan_ore_box', where: 'house:volcan_h_shan', tier: 1, label: 'Caisse de minerais' },
      { id: 'lava_vase', where: 'house:volcan_h_potier', tier: 2, label: 'Vase de lave scellé' },
      { id: 'cantine_stash', where: 'house:volcan_h_cantine', tier: 1, label: 'Réserve de la cantine' },
      { id: 'cinder_cache', where: 'wild', tier: 1, label: 'Cache dans les cendres' },
      { id: 'basalt_niche', where: 'wild', tier: 2, label: 'Niche de basalte cachée' },
      { id: 'forge_vault', where: 'wild', tier: 3, label: 'Caveau de la forge' }
    ],
    enemies: [
      { id: 'volcan_forge_giant', name: 'Forgeron de lave', templateHint: 'lava_behemoth', role: 'gate' },
      { id: 'volcan_ember_imp', name: 'Xiao Gui des cendres', templateHint: 'goblin_saboteur', role: 'quest' }
    ],
    quests: [
      { id: 'sq_pont_braise', title: 'Le pont de braise', giver: 'miner_shan', turnIn: 'miner_shan', chain: null,
        summary: 'Les mineurs ne peuvent réparer le pont tant que le forgeron de lave y frappe son enclume. Calmez-le à votre manière.',
        objectives: [{ type: 'kill', target: 'volcan_forge_giant' }] },
      { id: 'sq_vase_rui', title: 'Le vase de Rui', giver: 'potter_rui', turnIn: 'potter_rui', chain: null,
        summary: 'Rui a laissé son plus beau vase dans une niche de basalte, avant que les gorges ne s\'embrasent. Récupérez-le avant qu\'il ne refroidisse.',
        objectives: [{ type: 'chest', target: 'basalt_niche' }] },
      { id: 'sq_cendrillon', title: 'Le murmure de la forge', giver: 'bather_fei', turnIn: 'bather_fei', chain: 'sq_vase_rui',
        summary: 'Fei jure avoir entendu Fengmeng passer par les gorges en pestant contre « ce vieux maître ». Interrogez l\'esprit de la forge, qui a tout vu.',
        objectives: [{ type: 'talk', target: 'forge_spirit' }] }
    ]
  },

  // ───────────────────────── 7. FAUVES ─────────────────────────
  fauves: {
    village: {
      id: 'fauves_village', name: 'Enclos de Caoyuan',
      mood: 'Un village ceint d\'une palissade de troncs, avec des toits d\'herbe sèche et des troupeaux qui rêvent de pâturages.',
      arrival: ['À Caoyuan, on dort un œil ouvert : la palissade est neuve, les moutons sont rares et la bergère compte à voix haute.',
                'Quelque part dans la plaine, des meutes de feu rôdent encore. Mais ici, il y a du thé.']
    },
    wild: {
      id: 'fauves_wild', name: 'Hautes Herbes de Cendre',
      mood: 'Une savane dorée où chaque ondulation d\'herbe peut cacher une bête de braise ou un lièvre insolent.',
      arrival: ['L\'herbe haute ondule en vagues dorées. Un grondement lointain vous rappelle que la plaine ne dort jamais vraiment.'],
      gate: { type: 'kill', id: 'fauves_alpha_tiger', hint: 'Le tigre alpha de la plaine barre les hautes herbes : tant qu\'il est là, la meute ne laissera aucun voyageur approcher du sanctuaire.' }
    },
    houses: [
      { id: 'fauves_h_wu', name: 'Pavillon du chasseur Wu', desc: 'Des trophées de cornes et un râtelier d\'arcs. On y raconte beaucoup, on y prouve moins.', residents: ['hunter_wu'], chests: ['wu_quiver_box'] },
      { id: 'fauves_h_zi', name: 'Yourte de Zi', desc: 'Une yourte de feutre claire, où le thé au lait chauffe toute la journée.', residents: ['shepherd_zi'], chests: [] },
      { id: 'fauves_h_chevaux', name: 'Écurie des chevaux célestes', desc: 'Une écurie de chevaux lents mais fiers, qui dédaignent les carottes.', residents: ['horse_tian'], chests: ['saddle_chest'] },
      { id: 'fauves_h_chaman', name: 'Tente de la chamane', desc: 'Une tente tapissée de peaux et de plumes, où l\'on déchiffre le vent.', residents: ['shaman_ula'], chests: ['shaman_drum_box'] },
      { id: 'fauves_h_fromage', name: 'Fromagerie de Dame Sa', desc: 'Des meules et des odeurs puissantes, qui font reculer même les loups.', residents: ['cheese_sa'], chests: [] }
    ],
    npcs: [
      { id: 'hunter_wu', where: 'house:fauves_h_wu' },
      { id: 'shepherd_zi', where: 'house:fauves_h_zi' },
      { id: 'horse_tian', name: 'Tian', title: 'Cheval céleste retraité', emoji: '🐎', where: 'house:fauves_h_chevaux', role: 'ambiance' },
      { id: 'shaman_ula', name: 'Ula', title: 'Chamane des vents', emoji: '🪶', where: 'house:fauves_h_chaman', role: 'indice' },
      { id: 'cheese_sa', name: 'Dame Sa', title: 'Fromagère', emoji: '🧀', where: 'house:fauves_h_fromage', role: 'marchand' },
      { id: 'twins_mu', name: 'Les jumeaux Mu', title: 'Enfants-bergers', emoji: '👦', where: 'place', role: 'donneur' },
      { id: 'hua_fauves', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'place', role: 'marchand' },
      { id: 'hare_tuzi', name: 'Tuzi', title: 'Lièvre du Palais lunaire', emoji: '🐇', where: 'wild', role: 'indice' },
      { id: 'old_nomad_bayan', name: 'Bayan', title: 'Vieux nomade', emoji: '🧓', where: 'place', role: 'indice' }
    ],
    chests: [
      { id: 'wu_quiver_box', where: 'house:fauves_h_wu', tier: 1, label: 'Coffre à carquois' },
      { id: 'saddle_chest', where: 'house:fauves_h_chevaux', tier: 1, label: 'Coffre à selles' },
      { id: 'shaman_drum_box', where: 'house:fauves_h_chaman', tier: 2, label: 'Boîte à tambours' },
      { id: 'grass_cache', where: 'wild', tier: 1, label: 'Cache dans les herbes' },
      { id: 'lost_lamb_pen', where: 'wild', tier: 2, label: 'Enclos oublié' },
      { id: 'alpha_den', where: 'wild', tier: 3, label: 'Tanière de l\'alpha' }
    ],
    enemies: [
      { id: 'fauves_alpha_tiger', name: 'Tigre alpha, Griffe-de-Feu', templateHint: 'fire_tiger', role: 'gate' },
      { id: 'fauves_lamb_wolf', name: 'Loup chapardeur de braise', templateHint: 'ember_wolf', role: 'quest' },
      { id: 'fauves_boar_chief', name: 'Hure, sanglier de flammes', templateHint: 'flame_boar', role: 'elite' }
    ],
    quests: [
      { id: 'sq_agneau_perdu', title: 'L\'agneau des jumeaux', giver: 'twins_mu', turnIn: 'twins_mu', chain: null,
        summary: 'Un agneau a fui dans les hautes herbes ; un loup de braise le suit. Libérez l\'enclos où il s\'est réfugié.',
        objectives: [{ type: 'kill', target: 'fauves_lamb_wolf' }, { type: 'chest', target: 'lost_lamb_pen' }] },
      { id: 'sq_lievre_lune', title: 'Le lièvre de la Lune', giver: 'shaman_ula', turnIn: 'shaman_ula', chain: null,
        summary: 'Ula soupçonne que le lièvre Tuzi vient du Palais lunaire et connaît Chang\'e. Allez lui parler dans les hautes herbes.',
        objectives: [{ type: 'talk', target: 'hare_tuzi' }] },
      { id: 'sq_hure', title: 'La colère de Hure', giver: 'cheese_sa', turnIn: 'cheese_sa', chain: 'sq_lievre_lune',
        summary: 'Le sanglier Hure saccage les pâturages à l\'aube. Une fois le lièvre entendu, chassez-le des herbes hautes.',
        objectives: [{ type: 'kill', target: 'fauves_boar_chief' }] }
    ]
  },

  // ───────────────────────── 8. MER ─────────────────────────
  mer: {
    village: {
      id: 'mer_village', name: 'Port aux Perles de Haiyan',
      mood: 'Un village de pêcheurs aux toits bleu-vert, des filets étendus comme des voiles de mariées et l\'odeur salée de la nostalgie.',
      arrival: ['Haiyan sent le sel, la corde mouillée et la poésie tragique. Les barques se balancent doucement, contre toute logique, sur une mer que le soleil a fait reculer.',
                'On y raconte que le Roi-Dragon écoute aux portes.']
    },
    wild: {
      id: 'mer_wild', name: 'Falaises et Criques du Dragon',
      mood: 'Des falaises ruisselantes, des criques secrètes, des grottes où la marée chante en sourdine.',
      arrival: ['Les falaises dominent une mer qui a perdu sa patience. Dans l\'écume, des écailles brillent : le Roi-Dragon n\'est jamais très loin.'],
      gate: { type: 'chest', id: 'tide_key_chest', hint: 'La grotte qui mène au sanctuaire est fermée par une porte de corail : sa clé de marée dort au fond d\'une crique.' }
    },
    houses: [
      { id: 'mer_h_hai', name: 'Cabane du pêcheur Hai', desc: 'Une cabane où pendent des filets réparés mille fois, et une photographie… non, un portrait de sa barque.', residents: ['fisher_hai'], chests: ['hai_net_box'] },
      { id: 'mer_h_longwang', name: 'Pavillon de l\'envoyé', desc: 'Un pavillon laqué de bleu : l\'envoyé du Roi-Dragon y reçoit avec une courtoisie humide.', residents: ['envoy_longwang'], chests: ['envoy_coffer'] },
      { id: 'mer_h_perles', name: 'Atelier des perles', desc: 'Des perles de toutes tailles triées dans des coupelles de nacre.', residents: ['pearl_diver_xi'], chests: ['pearl_tray'] },
      { id: 'mer_h_marin', name: 'Maison du marin Bao', desc: 'Une maison de marin avec un hamac pour cheval, une carte et un portrait d\'un petit garçon.', residents: ['sailor_bao'], chests: [] },
      { id: 'mer_h_phare', name: 'Phare de Haiyan', desc: 'Un phare tout de blanc, où veille une gardienne taciturne.', residents: ['lighthouse_ming'], chests: [] }
    ],
    npcs: [
      { id: 'fisher_hai', where: 'house:mer_h_hai' },
      { id: 'envoy_longwang', where: 'house:mer_h_longwang' },
      { id: 'pearl_diver_xi', name: 'Xi', title: 'Plongeuse de perles', emoji: '🤿', where: 'house:mer_h_perles', role: 'donneur' },
      { id: 'sailor_bao', name: 'Bao', title: 'Marin, père de Petit Bao', emoji: '⚓', where: 'house:mer_h_marin', role: 'donneur' },
      { id: 'lighthouse_ming', name: 'Ming', title: 'Gardienne du phare', emoji: '🔦', where: 'house:mer_h_phare', role: 'indice' },
      { id: 'hua_mer', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'place', role: 'marchand' },
      { id: 'crab_old_gong', name: 'Vieux Gong', title: 'Crabe sentencieux', emoji: '🦀', where: 'place', role: 'ambiance' },
      { id: 'mermaid_jiaoren', name: 'Jiaoren', title: 'Sirène aux larmes de perle', emoji: '🧜', where: 'wild', role: 'indice' },
      { id: 'girl_net_mi', name: 'Mi', title: 'Fillette réparatrice de filets', emoji: '👧', where: 'place', role: 'ambiance' }
    ],
    chests: [
      { id: 'hai_net_box', where: 'house:mer_h_hai', tier: 1, label: 'Caisse à hameçons' },
      { id: 'envoy_coffer', where: 'house:mer_h_longwang', tier: 2, label: 'Coffret laqué de l\'envoyé' },
      { id: 'pearl_tray', where: 'house:mer_h_perles', tier: 1, label: 'Plateau de perles' },
      { id: 'cove_cache', where: 'wild', tier: 1, label: 'Cache dans la crique' },
      { id: 'tide_key_chest', where: 'wild', tier: 2, label: 'Coffre-clé de marée' },
      { id: 'tear_pearl_chest', where: 'wild', tier: 2, label: 'Coffre aux larmes de perle' },
      { id: 'dragon_grotto', where: 'wild', tier: 3, label: 'Coffre de la grotte du dragon' }
    ],
    enemies: [
      { id: 'mer_tide_serpent', name: 'Serpent de marée', templateHint: 'deep_sea_serpent', role: 'elite' },
      { id: 'mer_kelp_witch', name: 'Dame des algues givrées', templateHint: 'ice_witch', role: 'quest' }
    ],
    quests: [
      { id: 'sq_larmes_perle', title: 'Les larmes de Jiaoren', giver: 'pearl_diver_xi', turnIn: 'pearl_diver_xi', chain: null,
        summary: 'La sirène Jiaoren pleure des perles qu\'elle ne peut plus garder. Écoutez-la, puis rapportez son coffre à Xi.',
        objectives: [{ type: 'talk', target: 'mermaid_jiaoren' }, { type: 'chest', target: 'tear_pearl_chest' }] },
      { id: 'sq_dame_algues', title: 'La Dame des algues', giver: 'lighthouse_ming', turnIn: 'lighthouse_ming', chain: null,
        summary: 'Le phare de Haiyan s\'éteint chaque fois qu\'une Dame des algues passe sur la crique. Faites-la reculer.',
        objectives: [{ type: 'kill', target: 'mer_kelp_witch' }] },
      { id: 'sq_marin_reponse', title: 'La réponse du marin', giver: 'sailor_bao', turnIn: 'xiaobao', chain: 'sq_lettre_bao_3',
        summary: 'Bao a lu la lettre de son fils en pleurant dans sa barbe. Ramenez-lui sa réponse, ainsi qu\'un galet porte-bonheur, au hameau de Dongqiao.',
        objectives: [{ type: 'talk', target: 'xiaobao' }] }
    ]
  },

  // ───────────────────────── 9. FUSANG ─────────────────────────
  fusang: {
    village: {
      id: 'fusang_village', name: 'Terrasses de Fusang-le-Bas',
      mood: 'Un village en gradins, aux toits dorés et aux escaliers infinis, juste sous les racines de l\'arbre où dorment les soleils.',
      arrival: ['Fusang-le-Bas monte à l\'assaut de la colline comme un escalier pour géants. Les habitants y parlent bas : on ne sait jamais à quelle branche ils sont accrochés.',
                'Le Dixième Soleil n\'est pas loin : l\'air sent le miel tiède.']
    },
    wild: {
      id: 'fusang_wild', name: 'Racines et Branches Dorées',
      mood: 'Une forêt de racines géantes, des ponts de branches entrelacées et des lucioles qui ressemblent à des soleils minuscules.',
      arrival: ['Les racines du Fusang forment une cathédrale sans toit. Un vent doré porte des murmures de grue et des promesses de lumière.'],
      gate: { type: 'quest', id: 'sq_sceau_racines', hint: 'Le sceau de la Reine Mère qui protège la cime est brisé : il faut en retrouver les trois morceaux avant de monter.' }
    },
    houses: [
      { id: 'fusang_h_grue', name: 'Nid de la messagère', desc: 'Un nid géant tressé de plumes blanches, au sommet d\'un perchoir.', residents: ['crane_envoy'], chests: ['crane_feather_box'] },
      { id: 'fusang_h_cueilleur', name: 'Maison du cueilleur de pêches', desc: 'Une cabane sucrée où l\'on cueille encore des pêches d\'immortalité, une par siècle.', residents: ['picker_tao'], chests: ['peach_basket'] },
      { id: 'fusang_h_astronome', name: 'Observatoire de Mère Xing', desc: 'Des instruments de laiton pointés vers un ciel qui ne se laisse pas mesurer.', residents: ['astronomer_xing'], chests: [] },
      { id: 'fusang_h_temple', name: 'Petit temple des Dix Soleils', desc: 'Un temple de dix lanternes, dont huit sont éteintes.', residents: ['acolyte_ri'], chests: [] },
      { id: 'fusang_h_chambre', name: 'Maison de thé suspendue', desc: 'Une maison de thé accrochée aux branches, qui se balance au gré du vent.', residents: ['teamaster_you'], chests: ['teapot_chest'] }
    ],
    npcs: [
      { id: 'crane_envoy', where: 'house:fusang_h_grue' },
      { id: 'picker_tao', name: 'Tao', title: 'Cueilleur de pêches', emoji: '🍑', where: 'house:fusang_h_cueilleur', role: 'marchand' },
      { id: 'astronomer_xing', name: 'Mère Xing', title: 'Astronome de l\'arbre', emoji: '🔭', where: 'house:fusang_h_astronome', role: 'indice' },
      { id: 'acolyte_ri', name: 'Ri', title: 'Acolyte aux neuf lanternes', emoji: '🕯️', where: 'house:fusang_h_temple', role: 'donneur' },
      { id: 'teamaster_you', name: 'Maître You', title: 'Maître de thé suspendu', emoji: '🍃', where: 'house:fusang_h_chambre', role: 'ambiance' },
      { id: 'hua_fusang', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'place', role: 'marchand' },
      { id: 'child_yuer', name: 'Yuer', title: 'Fillette qui écoute les soleils', emoji: '🧒', where: 'place', role: 'indice' },
      { id: 'phoenix_chick', name: 'Petit Fenghuang', title: 'Poussin de phénix', emoji: '🐥', where: 'place', role: 'ambiance' },
      { id: 'root_elder', name: 'Racine-Ancienne', title: 'Esprit de l\'arbre', emoji: '🌳', where: 'wild', role: 'indice' }
    ],
    chests: [
      { id: 'crane_feather_box', where: 'house:fusang_h_grue', tier: 1, label: 'Coffre de plumes' },
      { id: 'peach_basket', where: 'house:fusang_h_cueilleur', tier: 2, label: 'Panier de pêches' },
      { id: 'teapot_chest', where: 'house:fusang_h_chambre', tier: 1, label: 'Coffre de la théière' },
      { id: 'seal_shard_a', where: 'wild', tier: 2, label: 'Premier éclat du sceau' },
      { id: 'seal_shard_b', where: 'wild', tier: 2, label: 'Deuxième éclat du sceau' },
      { id: 'seal_shard_c', where: 'wild', tier: 3, label: 'Troisième éclat du sceau' }
    ],
    enemies: [
      { id: 'fusang_root_guard', name: 'Garde solaire des racines', templateHint: 'sun_paladin', role: 'elite' },
      { id: 'fusang_jade_wraith', name: 'Immortel de jade égaré', templateHint: 'crystal_sage', role: 'quest' }
    ],
    quests: [
      { id: 'sq_sceau_racines', title: 'Le sceau des racines', giver: 'astronomer_xing', turnIn: 'astronomer_xing', chain: null,
        summary: 'Le sceau de la Reine Mère est brisé en trois éclats cachés dans les racines. Retrouvez-les pour rouvrir la voie vers la cime.',
        objectives: [{ type: 'chest', target: 'seal_shard_a' }, { type: 'chest', target: 'seal_shard_b' }, { type: 'chest', target: 'seal_shard_c' }] },
      { id: 'sq_neuf_lanternes', title: 'Les neuf lanternes', giver: 'acolyte_ri', turnIn: 'acolyte_ri', chain: null,
        summary: 'Ri veut rallumer une lanterne pour chaque soleil abattu, afin de ne pas oublier ce qu\'ils furent. Écoutez la Racine-Ancienne pour savoir quoi dire.',
        objectives: [{ type: 'talk', target: 'root_elder' }, { type: 'talk', target: 'child_yuer' }] },
      { id: 'sq_immortel_egare', title: 'L\'immortel égaré', giver: 'child_yuer', turnIn: 'child_yuer', chain: 'sq_neuf_lanternes',
        summary: 'Un immortel de jade vagabonde dans les racines, hanté par un souvenir. Yuer croit qu\'il suffit de le calmer, et vous êtes le plus doué pour cela.',
        objectives: [{ type: 'kill', target: 'fusang_jade_wraith' }] }
    ]
  },

  // ───────────────────────── 10. LUNE (allégée) ─────────────────────────
  lune: {
    village: {
      id: 'lune_village', name: 'Hameau sous la Lune',
      mood: 'Un tout petit hameau de pierre pâle sous une lune immense, où le silence a un goût de gâteau et de regret.',
      arrival: ['Le hameau sous la Lune ne compte que quelques maisons pâles et beaucoup de silence. La lune est si grande qu\'on pourrait lui parler à voix basse.',
                'Quelque part là-haut, quelqu\'un vous attend.']
    },
    wild: {
      id: 'lune_wild', name: 'Sentier d\'Argent',
      mood: 'Un sentier de pierre pâle et de givre bleuté qui monte vers le Pic, sous un ciel de velours.',
      arrival: ['Le sentier monte, d\'argent et de nuit. À chaque pas, la lune semble écouter.'],
      gate: { type: 'chest', id: 'moon_key_chest', hint: 'La porte du Pic est scellée par une serrure de lumière : sa clé repose dans un reliquaire sur le sentier.' }
    },
    houses: [
      { id: 'lune_h_veilleuse', name: 'Maison de la veilleuse', desc: 'Une petite maison où une vieille veilleuse tient les lanternes du hameau allumées.', residents: ['keeper_lunar', 'hua_lune'], chests: ['veilleuse_chest'] },
      { id: 'lune_h_lievres', name: 'Terrier des lièvres de jade', desc: 'Un terrier tapissé de mousse blanche, où les lièvres de jade pilent l\'élixir pour de rire.', residents: ['jade_hare'], chests: [] },
      { id: 'lune_h_tisseuse', name: 'Chaumière de la tisseuse d\'argent', desc: 'Une chaumière silencieuse où l\'on file de la lumière de lune sur un rouet.', residents: ['spinner_yue'], chests: ['moon_thread_box'] }
    ],
    npcs: [
      { id: 'keeper_lunar', name: 'Veilleuse Yin', title: 'Gardienne des lanternes', emoji: '🏮', where: 'house:lune_h_veilleuse', role: 'indice' },
      { id: 'hua_lune', name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒', where: 'house:lune_h_veilleuse', role: 'marchand' },
      { id: 'jade_hare', name: 'Lièvre de jade', title: 'Pileur d\'élixir', emoji: '🐇', where: 'house:lune_h_lievres', role: 'indice' },
      { id: 'spinner_yue', name: 'Yue', title: 'Tisseuse d\'argent', emoji: '🧶', where: 'house:lune_h_tisseuse', role: 'ambiance' },
      { id: 'moon_child', name: 'Enfant de la Lune', title: 'Petit veilleur', emoji: '🧒', where: 'place', role: 'ambiance' },
      { id: 'osmanthus_woodcutter', name: 'Wu Gang', title: 'Bûcheron éternel de l\'osmanthus', emoji: '🪓', where: 'wild', role: 'donneur' }
    ],
    chests: [
      { id: 'veilleuse_chest', where: 'house:lune_h_veilleuse', tier: 1, label: 'Coffre de la veilleuse' },
      { id: 'moon_thread_box', where: 'house:lune_h_tisseuse', tier: 1, label: 'Boîte à fils d\'argent' },
      { id: 'frost_cache', where: 'wild', tier: 2, label: 'Cache sous le givre' },
      { id: 'moon_key_chest', where: 'wild', tier: 2, label: 'Reliquaire à clé de lumière' },
      { id: 'osmanthus_hoard', where: 'wild', tier: 3, label: 'Trésor de l\'osmanthus' }
    ],
    enemies: [
      { id: 'lune_frost_priestess', name: 'Prêtresse de givre', templateHint: 'moon_priestess', role: 'elite' },
      { id: 'lune_mirror_shade', name: 'Ombre du miroir', templateHint: 'shadow_assassin', role: 'quest' }
    ],
    quests: [
      { id: 'sq_osmanthus', title: 'L\'osmanthus qui repousse', giver: 'osmanthus_woodcutter', turnIn: 'osmanthus_woodcutter', chain: null,
        summary: 'Wu Gang coupe l\'arbre depuis mille ans et l\'arbre repousse toujours. Aidez-le à vider sa dernière cache de bois et à chasser l\'ombre qui rôde.',
        objectives: [{ type: 'chest', target: 'frost_cache' }, { type: 'kill', target: 'lune_mirror_shade' }] },
      { id: 'sq_lanterne_hua', title: 'La dernière lanterne de Hua', giver: 'hua_lune', turnIn: 'keeper_lunar', chain: null,
        summary: 'Hua a fait un long chemin pour livrer une dernière lanterne à la veilleuse. Elle vous la confie avec un clin d\'œil, car vous avez passé la sienne en chemin.',
        objectives: [{ type: 'talk', target: 'keeper_lunar' }] }
    ]
  }
};

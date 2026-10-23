// Bestiaire de la Chine ancienne : créatures du CSV (`bestiaire.csv`) devenues gabarits d'ennemis.
// Source unique lue par tools/build-bestiary.mjs, qui produit : enemies.catalog.json (gabarits), tools/sprite-prompts-bestiary.js
// (prompts Pixel Lab) et la répartition dans les hautes herbes des régions (world/maps/*.js).
//
// Ligne : [id, nom affiché, race, titre, couleur dominante (red|blue|green|yellow|purple), région, archétype, prompt Pixel Lab (anglais)]
// Archétypes : m = mineur, b = brute, c = lanceur de sorts, e = élite (rare), l = légende (très rare, régions finales).
// Les créatures du CSV déjà incarnées par un gabarit existant ne sont pas répétées (voir EXISTING_MAP).

export const REGION_LEVEL = { rizieres: 1, volcan: 4, gobi: 6, fleuve: 11, bambous: 17, tonnerre: 22, fauves: 27, mer: 32, fusang: 37, lune: 40 };

// Entrées du CSV déjà couvertes (gabarit du jeu) ou volontairement exclues (le héros et la déesse sont des personnages).
export const EXISTING_MAP = {
  'Jiaolong': 'deep_sea_serpent', 'Hundun': 'sand_colossus', 'Chiyou': 'orc_warmaster', 'Huli Jing': 'goblin_saboteur',
  'Pixiu': 'lava_behemoth', 'Suanni': 'temple_warden', 'Lei Gong': 'storm_knight', 'Wen Shen': 'plague_doctor',
  'Shu Jing': 'forest_guardian', 'Shanxiao': 'war_troll', 'Canglong': 'frost_dragon', 'Chilong': 'ember_dragon',
  'Yinglong': 'storm_wyrm', 'Houyi': null, "Chang'e": null
};

export const BESTIARY = [
  // ── Rizières (niveau 1) : marais, esprits d'eau douce, petits esprits
  ['cao_jing', 'Cao Jing', 'Esprit végétal', 'Petit Esprit des Herbes', 'green', 'rizieres', 'm', 'Cao Jing, tiny grass spirit, small humanoid covered in green leaves and reeds, big curious eyes, hiding pose'],
  ['hua_jing', 'Hua Jing', 'Esprit végétal', 'Fée aux Pétales', 'green', 'rizieres', 'c', 'Hua Jing, delicate flower spirit girl, hair and dress made of pink lotus petals, drifting perfume, serene face'],
  ['huli_commun', 'Huli', 'Bête', 'Renard des Digues', 'red', 'rizieres', 'm', 'ordinary red fox with a fine muzzle, upright ears and a bushy tail, alert, small sacred red ribbon on the neck'],
  ['shuihou', 'Shuihou', 'Esprit aquatique', 'Singe de la Vase', 'blue', 'rizieres', 'm', 'Shuihou, water monkey humanoid, slimy dark green skin, wet matted fur, long arms, webbed hands, dripping with pond water'],
  ['shui_gui', 'Shui Gui', 'Gui', 'Noyé des Berges', 'blue', 'rizieres', 'm', 'Shui Gui, drowned ghost, pale bloated skin, soaked tattered clothes, dripping water, hollow eyes, reaching arms'],
  ['qing_she', 'Qing She', 'Serpent', 'Serpent Vert de Jade', 'green', 'rizieres', 'm', 'Qing She, slim green jade snake with glossy scales, raised head, thin forked tongue, coiled'],
  ['jingwei', 'Jingwei', 'Oiseau', 'Oiseau qui Comble la Mer', 'blue', 'rizieres', 'm', 'Jingwei, small bird with a colorful crest and pale beak, carrying a twig and a pebble in its beak, determined'],
  ['she_shen', 'She Shen', 'Esprit', 'Gardien du Terroir', 'green', 'rizieres', 'c', 'She Shen, earth altar spirit, small stout old man made of clay and straw, yellow robe, offerings bowl, calm'],
  ['zu_xian', 'Zu Xian', 'Esprit', 'Ancêtre Mécontent', 'purple', 'rizieres', 'm', 'Zu Xian, angry ancestor ghost in ritual white mourning robe and old-fashioned cap, grey beard, glowing pale outline'],
  ['du_she', 'Du She', 'Serpent', 'Serpent à Venin', 'green', 'rizieres', 'b', 'Du She, thick dark snake with visible fangs, dripping green venom, swamp mud on the scales, hissing'],
  ['xuan_she', 'Xuan She', 'Serpent', 'Serpent Noir Prodigieux', 'purple', 'rizieres', 'b', 'Xuan She, enormous glossy black serpent coiled in the water, long gleaming body, cold bright eyes'],

  // ── Volcan (niveau 4) : feu, sécheresse, oiseaux de flamme
  ['huo_shen', 'Huo Shen', 'Esprit de feu', 'Esprit de la Flamme', 'red', 'volcan', 'c', 'Huo Shen, fire spirit, red-robed figure with a face wreathed in flames, burning hair, holding a fire fan'],
  ['huo_shou', 'Huo Shou', 'Bête', 'Bête de Cendre', 'red', 'volcan', 'b', 'Huo Shou, beast with incandescent fur, dark horns, smoking jaws, trails of ash, quadruped'],
  ['chi_niao', 'Chi Niao', 'Oiseau', 'Oiseau Ardent', 'red', 'volcan', 'm', 'Chi Niao, red bird with burning feathers and a long fiery tail, wings spread, sharp beak'],
  ['bi_fang', 'Bi Fang', 'Oiseau', 'Oiseau à Une Patte', 'red', 'volcan', 'c', 'Bi Fang, one-legged crane-like bird with blue and red plumage, small flames at the beak, standing on a single leg'],
  ['hanba', 'Hanba', 'Esprit', 'Esprit de la Sécheresse', 'red', 'volcan', 'c', 'Hanba, drought demon, gaunt woman with cracked dry skin, disheveled hair, scorched ragged robe, heat haze'],
  ['nuba', 'Nüba', 'Divinité', 'Déesse de la Sécheresse', 'red', 'volcan', 'e', 'Nuba, drought goddess, tall luminous woman in a yellow robe with long loose hair, scorching glow, dry cracked ground'],
  ['zhuque', 'Zhuque', 'Oiseau', 'Oiseau Vermillon du Sud', 'red', 'volcan', 'e', 'Zhuque, vermilion bird of the south, large crimson phoenix with long tail feathers of flame, golden eyes, wings spread'],
  ['zhulong_serpent', 'Zhulong', 'Dragon', 'Serpent Rouge à Visage Humain', 'red', 'volcan', 'e', 'Zhulong, gigantic red serpent with a human face, glowing eyes, coiled body, torch-like light'],
  ['dijiang', 'Dijiang', 'Esprit informe', 'Sac Rouge sans Visage', 'red', 'volcan', 'b', 'Dijiang, round scarlet body like a sack, six short legs, four small wings, no face and no eyes, glowing red'],
  ['yazi', 'Yazi', 'Hybride', 'Fauve à Tête de Dragon', 'red', 'volcan', 'b', 'Yazi, dragon-headed feline beast with a lizard-like body, fierce open jaws, sword-like blade fixed to its back'],

  // ── Gobi (niveau 6) : désert, esprits du sable et de la terre
  ['mei', 'Mei', 'Esprit', 'Esprit Trompeur', 'purple', 'gobi', 'c', 'Mei, shapeshifting mischievous spirit, half veiled figure with a shifting face, faint violet haze, wavering outline'],
  ['wangliang', 'Wangliang', 'Esprit', 'Esprit des Lieux Sauvages', 'yellow', 'gobi', 'm', 'Wangliang, wild mountain spirit, hunched hairy humanoid with a dusty cloak, glowing yellow eyes, long fingers'],
  ['wangxiang', 'Wangxiang', 'Esprit', 'Guetteur des Tombes', 'purple', 'gobi', 'm', 'Wangxiang, grave-haunting spirit, pale thin boy-like creature with red eyes and long arms, crouching'],
  ['shi_jing', 'Shi Jing', 'Esprit de pierre', 'Esprit de Pierre', 'green', 'gobi', 'b', 'Shi Jing, stone spirit, angular body of grey rock with glowing cracks, heavy fists, immobile stare'],
  ['houtu', 'Houtu', 'Divinité', 'Souveraine de la Terre', 'green', 'gobi', 'e', 'Houtu, earth goddess, majestic woman in an ochre imperial robe, crown of mountains, hands holding soil, warm glow'],
  ['feima', 'Feima', 'Bête', 'Cheval Volant', 'yellow', 'gobi', 'm', 'Feima, flying horse with feathered wings, sandy golden coat, flowing mane, galloping pose'],
  ['bashe', 'Bashé', 'Serpent', 'Avaleur d\'Éléphants', 'green', 'gobi', 'e', 'Bashe, gigantic python swallowing an elephant, huge thick body, bulging throat, small head, dune sand'],
  ['tiangou_noir', 'Tian Gou', 'Bête', 'Chien Céleste', 'purple', 'gobi', 'b', 'Tian Gou, celestial black dog with an immense mouth, star-spotted fur, leaping pose, glowing eyes'],
  ['fucanglong', 'Fucanglong', 'Dragon', 'Dragon des Trésors Enfouis', 'green', 'gobi', 'e', 'Fucanglong, hidden underground dragon with dark gold scales, massive body emerging from sand, gem-like eyes, clutching treasure'],
  ['dilong', 'Dilong', 'Dragon', 'Dragon de la Terre', 'green', 'gobi', 'b', 'Dilong, earth dragon, brown serpentine body covered in dust, short claws, burrowing out of the ground'],
  ['jing_jing', 'Jing Jing', 'Esprit', 'Esprit d\'Objet Ancien', 'yellow', 'gobi', 'm', 'Jing Jing, possessed old bronze mirror with arms and legs, cracked reflective face, green patina, floating'],
  ['meng_shou', 'Meng Shou', 'Bête', 'Bête des Rêves', 'purple', 'gobi', 'c', 'Meng Shou, dream beast with oversized glowing eyes and shifting iridescent skin, tapir-like body, drifting sleepy aura'],
  ['wu_shou', 'Wu Shou', 'Bête', 'Bête de Brume', 'purple', 'gobi', 'c', 'Wu Shou, dark long-legged beast wrapped in a veil of fog, faint silhouette, glowing eyes in the mist'],

  // ── Fleuve (niveau 11) : dragons d'eau, tortues, poissons
  ['he_bo', 'He Bo', 'Divinité', 'Seigneur du Fleuve Jaune', 'blue', 'fleuve', 'e', 'He Bo, Yellow River god, stately man in a blue-and-gold robe, white dragon chariot motif, river wave crown, holding a scepter'],
  ['shui_shen', 'Shui Shen', 'Esprit aquatique', 'Esprit des Eaux', 'blue', 'fleuve', 'c', 'Shui Shen, water spirit, translucent blue humanoid made of flowing water, long ripple hair, pearls floating around'],
  ['jiao', 'Jiao', 'Dragon', 'Dragon des Remous', 'blue', 'fleuve', 'b', 'Jiao, young river dragon-serpent with budding horns, scaly teal body, swirling water around it, snarling'],
  ['bai_she', 'Bai She', 'Serpent', 'Serpent Blanc', 'blue', 'fleuve', 'c', 'Bai She, graceful white serpent spirit with pale scales and bright eyes, wearing a jade hairpin, coiled above water'],
  ['heishui_xuan_she', 'Heishui Xuan She', 'Serpent', 'Serpent des Eaux Noires', 'purple', 'fleuve', 'b', 'Heishui Xuan She, huge black snake in dark murky water, glistening scales, only head and arched neck above water'],
  ['heilong', 'Heilong', 'Dragon', 'Dragon Noir des Profondeurs', 'purple', 'fleuve', 'e', 'Heilong, Chinese black dragon, long wingless serpentine body of dark scales, glowing yellow eyes, whiskers, storm clouds'],
  ['bailong', 'Bailong', 'Dragon', 'Dragon Blanc', 'blue', 'fleuve', 'e', 'Bailong, Chinese white dragon, long wingless pale serpentine body, pearl scales, long whiskers, mist'],
  ['ao', 'Ao', 'Tortue', 'Tortue Porteuse de Montagne', 'blue', 'fleuve', 'e', 'Ao, giant sea turtle carrying a small mountain and a pagoda on its shell, mossy shell, calm ancient eyes'],
  ['gui_tortue', 'Gui', 'Tortue', 'Tortue Spirituelle', 'green', 'fleuve', 'b', 'Gui, spirit tortoise with an ornate shell patterned with divination lines, ancient wrinkled head, slow and heavy'],
  ['linggui', 'Linggui', 'Tortue', 'Tortue des Présages', 'blue', 'fleuve', 'c', 'Linggui, sacred turtle with glowing luminous patterns on the shell, calm, soft cyan aura'],
  ['xuan_gui', 'Xuan Gui', 'Tortue', 'Grande Tortue Noire', 'purple', 'fleuve', 'b', 'Xuan Gui, huge black tortoise with a dark shell and thick legs, dripping river water'],
  ['bixi', 'Bixi', 'Dragon', 'Dragon-Tortue Porte-Stèle', 'green', 'fleuve', 'b', 'Bixi, dragon-headed tortoise with a massive shell carrying a carved stone stele, heavy body, stony teeth'],
  ['feiyu', 'Feiyu', 'Poisson', 'Poisson à Contre-Courant', 'blue', 'fleuve', 'm', 'Feiyu, magical fish with shimmering scales and wide fins, leaping upstream, water splash'],
  ['jiaoyu', 'Jiaoyu', 'Poisson', 'Poisson-Dragon', 'blue', 'fleuve', 'm', 'Jiaoyu, dragon-like carp with a whiskered head, scaly body of green and gold, tail like a fan, leaping'],
  ['yingyu', 'Yingyu', 'Poisson', 'Poisson Ailé des Crues', 'blue', 'fleuve', 'm', 'Yingyu, fish with feathered bird wings instead of fins, silver blue body, flying above water'],

  // ── Bambous (niveau 17) : esprits de forêt, animaux-esprits
  ['mu_mei', 'Mu Mei', 'Esprit végétal', 'Esprit du Bois', 'green', 'bambous', 'm', 'Mu Mei, tree spirit, wooden figure with bark skin, twiggy hands and leaf hair, mossy, slow'],
  ['mu_gui', 'Mu Gui', 'Gui', 'Fantôme des Arbres Morts', 'green', 'bambous', 'm', 'Mu Gui, dead tree ghost, knotted grey dry wood body with roots, hollow face in the trunk, crawling vines'],
  ['shan_gui', 'Shan Gui', 'Esprit', 'Esprit Sauvage des Cols', 'green', 'bambous', 'm', 'Shan Gui, mountain pass spirit, shaggy humanoid covered in leaves and fur, one-eyed look, wooden staff'],
  ['lu_jing', 'Lu Jing', 'Esprit-animal', 'Cerf Lumineux', 'green', 'bambous', 'c', 'Lu Jing, deer spirit with branching glowing antlers and a luminous pale coat, graceful, light motes'],
  ['hu_jing', 'Hu Jing', 'Esprit-animal', 'Tigre Esprit', 'yellow', 'bambous', 'b', 'Hu Jing, tiger spirit, large striped tiger with long claws and an almost human gaze, standing on hind legs'],
  ['xiong_jing', 'Xiong Jing', 'Esprit-animal', 'Ours Esprit', 'green', 'bambous', 'b', 'Xiong Jing, huge spirit bear with thick dark brown fur, powerful arms, bamboo stalk club, angry'],
  ['he_jing', 'He Jing', 'Esprit-animal', 'Grue Esprit', 'blue', 'bambous', 'c', 'He Jing, white crane spirit, long legs, elegant plumage, red crowned head, drifting mist'],
  ['lang_jing', 'Lang Jing', 'Esprit-animal', 'Loup Esprit', 'purple', 'bambous', 'm', 'Lang Jing, grey wolf spirit, glowing eyes, sleek fur, half human silhouette stance, snarling'],
  ['she_jing', 'She Jing', 'Esprit-animal', 'Serpent Esprit', 'green', 'bambous', 'c', 'She Jing, serpent spirit woman, humanoid upper body with green scales and snake lower body, fixed hypnotic eyes'],
  ['shouling', 'Shouling', 'Esprit-animal', 'Âme de la Bête', 'green', 'bambous', 'm', 'Shouling, animal spirit, deer-like beast whose face looks almost human, calm, dappled glowing fur'],
  ['jing_shou', 'Jing Shou', 'Esprit-animal', 'Bête aux Yeux Lumineux', 'purple', 'bambous', 'm', 'Jing Shou, ordinary-looking beast with glowing eyes and strange markings on its body, watchful'],
  ['shan_shen', 'Shan Shen', 'Divinité', 'Esprit de la Montagne', 'green', 'bambous', 'e', 'Shan Shen, mountain god, imposing bearded giant in a stone-green robe, horned crown of rock, wooden staff'],
  ['qilin', 'Qilin', 'Hybride', 'Licorne de Vertu', 'green', 'bambous', 'e', 'Qilin, Chinese chimera with a deer body, dragon scales, hooves, a single horn and a bushy tail, gentle glow'],

  // ── Tonnerre (niveau 22) : vent, pluie, éclairs, neige
  ['feng_bo', 'Feng Bo', 'Divinité', 'Vieux Maître du Vent', 'yellow', 'tonnerre', 'c', 'Feng Bo, wind god, old man with a long beard riding a cloud, holding a big wind bag, swirling robe'],
  ['yu_shi', 'Yu Shi', 'Divinité', 'Maître de la Pluie', 'blue', 'tonnerre', 'c', 'Yu Shi, rain god, celestial figure in a blue robe holding a water vase and a branch, raindrops falling'],
  ['dian_mu', 'Dian Mu', 'Divinité', 'Dame des Éclairs', 'yellow', 'tonnerre', 'e', 'Dian Mu, goddess of lightning, woman in a pale robe holding two mirrors that flash lightning, radiant'],
  ['lei_shou', 'Lei Shou', 'Bête', 'Bête du Tonnerre', 'yellow', 'tonnerre', 'b', 'Lei Shou, thunder beast with a claw-armed body wrapped in lightning, a drum-like belly, glowing yellow eyes'],
  ['feng_shou', 'Feng Shou', 'Bête', 'Bête des Vents', 'yellow', 'tonnerre', 'm', 'Feng Shou, light creature with long ears like wings, body of swirling wind, small and quick'],
  ['yun_shou', 'Yun Shou', 'Bête', 'Bête des Nuées', 'blue', 'tonnerre', 'm', 'Yun Shou, pale beast whose body is a vaporous cloud, vague outline, small bright eyes, drifting'],
  ['xue_niao', 'Xue Niao', 'Oiseau', 'Oiseau des Neiges', 'blue', 'tonnerre', 'm', 'Xue Niao, white bird with icy feathers and a pale beak, frost on the wings, perched in snow'],
  ['feilong', 'Feilong', 'Dragon', 'Dragon Volant', 'blue', 'tonnerre', 'e', 'Feilong, flying Chinese dragon, scaly body and clawed limbs, flowing mane, wrapped in clouds, soaring'],
  ['tengshe', 'Tengshe', 'Serpent', 'Serpent Volant', 'yellow', 'tonnerre', 'b', 'Tengshe, flying snake with a long wavy body and small wings, riding mist, striking pose'],
  ['baihu', 'Baihu', 'Bête', 'Tigre Blanc de l\'Ouest', 'yellow', 'tonnerre', 'e', 'Baihu, great white tiger with black stripes and a golden marking on the forehead, powerful stance, metal glint'],
  ['qinglong', 'Qinglong', 'Dragon', 'Dragon Azur de l\'Est', 'green', 'tonnerre', 'e', 'Qinglong, azure dragon of the east, long wingless body of blue-green scales, long mane, clawed, majestic'],
  ['qiongqi', 'Qiongqi', 'Bête', 'Tigre Ailé Cruel', 'purple', 'tonnerre', 'b', 'Qiongqi, winged tiger with a dark striped coat, sharp fangs and wings of feathers, vicious snarling pose'],
  ['tianma', 'Tianma', 'Bête', 'Cheval Céleste', 'blue', 'tonnerre', 'm', 'Tianma, celestial white horse with a flowing mane and a faintly glowing hoofprint trail, galloping on clouds'],
  ['chiwen', 'Chiwen', 'Hybride', 'Dragon-Poisson des Toits', 'blue', 'tonnerre', 'm', 'Chiwen, dragon-headed fish creature with a wide open mouth and a curled tail, roof ornament look, blue-green'],
  ['pulao', 'Pulao', 'Dragon', 'Dragon des Cloches', 'yellow', 'tonnerre', 'm', 'Pulao, small coiled dragon with a mane and a gaping mouth, shaped like a bell handle, bronze color'],

  // ── Fauves (niveau 27) : grands fauves, chimères, monstres anciens
  ['bai_ze', 'Bai Ze', 'Bête', 'Bête Blanche Omnisciente', 'blue', 'fauves', 'c', 'Bai Ze, white lion-like beast with horns and several eyes along its flanks, wise expression, mist aura'],
  ['bai_ze_savant', 'Bai Ze', 'Bête', 'Bête du Savoir', 'purple', 'fauves', 'e', 'Bai Ze the scholar beast, white horned composite beast with a calm intelligent face and a rolled scroll tied to its back'],
  ['zouyu', 'Zouyu', 'Bête', 'Tigre de Bon Augure', 'yellow', 'fauves', 'b', 'Zouyu, white tiger with black stripes and a very long tail, noble, peaceful but powerful stance'],
  ['xiezhi', 'Xiezhi', 'Bête', 'Bête de Justice', 'green', 'fauves', 'e', 'Xiezhi, horned ox-goat beast with a single horn and piercing gaze, dark green coat, judging stance'],
  ['bixie', 'Bixie', 'Hybride', 'Lion Ailé Protecteur', 'yellow', 'fauves', 'b', 'Bixie, winged lion with horns, bronze-gold coat, shaggy mane, feathered wings, fierce'],
  ['tianlu', 'Tianlu', 'Hybride', 'Gardien Cornu', 'yellow', 'fauves', 'b', 'Tianlu, horned winged feline guardian, lion body, stone-like bronze coat, long curved horn'],
  ['tianlu_gardien', 'Tianlu', 'Hybride', 'Gardien des Portes', 'yellow', 'fauves', 'e', 'Tianlu gate guardian, sculptural winged horned lion statue come alive, gold inlay, heavy stone feet'],
  ['pixiu_tresor', 'Pixiu', 'Hybride', 'Gardien des Richesses', 'yellow', 'fauves', 'e', 'Pixiu, treasure guardian beast, dragon head, lion body, small wings, wide mouth, coins and gold ingots under it'],
  ['bian', 'Bian', 'Bête', 'Fauve des Prisons', 'purple', 'fauves', 'b', 'Bian, robust tiger-like beast with dragon whiskers, striped coat, chain around the neck, stern'],
  ['fuxi_dragon', 'Fuxi', 'Dragon', 'Fils du Dragon', 'green', 'fauves', 'm', 'Fuxi son of the dragon, small dragon-headed creature with a stout body of scales, hanging pose, like a musical instrument handle'],
  ['chaofeng', 'Chaofeng', 'Hybride', 'Sentinelle des Hauteurs', 'yellow', 'fauves', 'm', 'Chaofeng, hybrid dragon and beast with a crest and short horns, vigilant crouch, roof corner guardian'],
  ['longma', 'Longma', 'Hybride', 'Cheval-Dragon', 'green', 'fauves', 'e', 'Longma, dragon horse, horse body covered in scales, small horns, wings, shining mane, galloping'],
  ['taotie_bronze', 'Taotie', 'Masque', 'Masque de Bronze', 'yellow', 'fauves', 'b', 'Taotie bronze mask, floating symmetrical ritual bronze mask with big round eyes, horns and gaping jaws, green patina, no body'],
  ['taotie_bete', 'Tao Tie', 'Bête', 'Dévoreur sans Fin', 'purple', 'fauves', 'e', 'Tao Tie, huge-headed beast, massive horned head, powerful jaws full of teeth, bulky body, bronze-like motifs on the skin'],
  ['jiuweihu', 'Jiuweihu', 'Esprit-animal', 'Renard à Neuf Queues', 'red', 'fauves', 'e', 'Jiuweihu, nine-tailed fox, white-red fox with nine bushy tails spread like a fan, glowing golden eyes, elegant'],
  ['xiangliu', 'Xiangliu', 'Serpent', 'Serpent à Neuf Têtes', 'green', 'fauves', 'e', 'Xiangliu, nine-headed serpent monster, one thick body with nine necks and heads, poison dripping, dark green'],
  ['nian', 'Nian', 'Bête', 'Monstre de la Veille du Nouvel An', 'yellow', 'fauves', 'e', 'Nian, massive monster with a lion or bull head, horns, fangs, a mane and scales, red and gold, roaring'],
  ['kuafu_geant', 'Kuafu', 'Géant', 'Géant du Soleil', 'yellow', 'fauves', 'e', 'Kuafu, colossal giant with a huge club, rough tunic, sun-burnt skin, tired determined face, running pose'],
  ['xingtian', 'Xingtian', 'Géant', 'Géant sans Tête', 'red', 'fauves', 'b', 'Xingtian, headless giant with eyes on the chest and a mouth in the navel, wielding an axe and a shield, fierce'],

  // ── Mer (niveau 32) : océan, rois-dragons, créatures marines
  ['hai_ruo', 'Hai Ruo', 'Divinité', 'Esprit de la Mer', 'blue', 'mer', 'e', 'Hai Ruo, sea spirit, aquatic humanoid with a fish tail and blue skin, coral crown, pearl necklace'],
  ['hai_shen', 'Hai Shen', 'Divinité', 'Dieu de la Mer', 'blue', 'mer', 'e', 'Hai Shen, sea god, stern king with a scaly torso and a wave crown, holding a trident, waves around'],
  ['hai_gui', 'Hai Gui', 'Tortue', 'Tortue des Récifs', 'blue', 'mer', 'b', 'Hai Gui, giant sea turtle with a shell covered in seaweed and coral, ancient wise eyes'],
  ['hai_she', 'Hai She', 'Serpent', 'Serpent des Tourbillons', 'blue', 'mer', 'b', 'Hai She, immense dark sea serpent with a finned crest, swirling whirlpool around its body'],
  ['ren_yu', 'Ren Yu', 'Hybride', 'Sirène Chantante', 'blue', 'mer', 'c', 'Ren Yu, mermaid with a human upper body and a fish tail, singing, pearl in her hair, shimmering scales'],
  ['kun', 'Kun', 'Poisson', 'Poisson Colossal', 'blue', 'mer', 'l', 'Kun, colossal fish as big as a landscape, deep blue body, huge mouth, tiny islands on its back'],
  ['xuanwu', 'Xuanwu', 'Tortue', 'Tortue Noire du Nord', 'purple', 'mer', 'e', 'Xuanwu, black tortoise of the north entwined by a snake, dark shell, serpent head, cold water aura'],
  ['longwang', 'Longwang', 'Divinité', 'Roi-Dragon des Mers', 'blue', 'mer', 'l', 'Longwang, dragon king, regal man in a ceremonial teal robe with dragon scales on arms and a dragon crown, holding a pearl'],
  ['panlong', 'Panlong', 'Dragon', 'Dragon Lové', 'green', 'mer', 'b', 'Panlong, coiled dragon wrapped around itself like a pillar, tight scales, mane, calm'],
  ['shenlong', 'Shenlong', 'Dragon', 'Dragon Divin', 'blue', 'mer', 'l', 'Shenlong, divine dragon, long wingless body in blue and gold, swirling in clouds, wise eyes'],
  ['long', 'Long', 'Dragon', 'Dragon Céleste', 'yellow', 'mer', 'e', 'Long, Chinese celestial dragon, long serpentine body with four clawed legs, antlers and whiskers, shining golden scales'],

  // ── Fusang (niveau 37) : soleil, oiseaux divins, héros-géants
  ['jinwu', 'Jinwu', 'Oiseau', 'Oiseau d\'Or du Soleil', 'red', 'fusang', 'e', 'Jinwu, golden sun bird with three legs and a halo of fire, brilliant wings, noble'],
  ['sanzu_wu', 'Sanzu Wu', 'Oiseau', 'Corbeau à Trois Pattes', 'red', 'fusang', 'b', 'Sanzu Wu, black crow with three legs, red solar disc behind it, glowing eyes, wings open'],
  ['fenghuang', 'Fenghuang', 'Oiseau', 'Phénix Auspicieux', 'red', 'fusang', 'l', 'Fenghuang, Chinese phoenix with multicolored plumage, long ornate tail feathers, crest, majestic, glowing'],
  ['qingniao', 'Qingniao', 'Oiseau', 'Oiseau Bleu Messager', 'blue', 'fusang', 'c', 'Qingniao, blue-green bird messenger, elegant wings, long tail, carrying a small scroll'],
  ['ruiniao', 'Rui Niao', 'Oiseau', 'Oiseau de Bon Augure', 'yellow', 'fusang', 'm', 'Rui Niao, auspicious bird with long colorful plumes, crest, peaceful, golden light'],
  ['peng', 'Peng', 'Oiseau', 'Oiseau Gigantesque', 'blue', 'fusang', 'l', 'Peng, gigantic bird whose wings resemble clouds covering the sky, dark blue feathers, soaring'],
  ['jiu_tou_niao', 'Jiu Tou Niao', 'Oiseau', 'Oiseau à Neuf Têtes', 'purple', 'fusang', 'e', 'Jiu Tou Niao, nine-headed bird, dark reddish plumage, nine long necks, wide wings, nocturnal'],
  ['ming_niao', 'Ming Niao', 'Oiseau', 'Oiseau des Ténèbres', 'purple', 'fusang', 'm', 'Ming Niao, dark nocturnal bird, glowing eyes, silent wide wings, dusk-colored plumage'],
  ['guai_niao', 'Guai Niao', 'Oiseau', 'Oiseau Monstrueux', 'purple', 'fusang', 'b', 'Guai Niao, monstrous bird with asymmetrical wings, hooked beak, odd plumage, crooked stance'],
  ['kuafu', 'Kua Fu', 'Géant', 'Poursuivant du Soleil', 'yellow', 'fusang', 'l', 'Kua Fu, immense giant chasing the sun, a peach tree staff in his hand, sun-lit skin, strong stride'],
  ['shennong', 'Shennong', 'Divinité', 'Souverain des Plantes', 'green', 'fusang', 'l', 'Shennong, mythic farmer king with small bull horns, leafy robe, holding medicinal herbs, warm smile'],
  ['huangdi', 'Huangdi', 'Divinité', 'Empereur Jaune', 'yellow', 'fusang', 'l', 'Huangdi, Yellow Emperor, majestic man in an imperial golden robe with dragon embroidery, crown with beads, holding a sword'],
  ['zhulong_torche', 'Zhulong', 'Dragon', 'Dragon-Torche', 'red', 'fusang', 'l', 'Zhulong, huge red torch dragon with a human face, eyes that blaze like sun and moon, coiling body of fire'],
  ['yingzhao_cheval', 'Yingzhao', 'Hybride', 'Bête Sacrée des Monts', 'green', 'fusang', 'b', 'Yingzhao, horse-like beast with feathered wings and a tiger-striped body, sacred mountains, grassy feet'],

  // ── Lune (niveau 40) : fantômes, dieux, songes
  ['yutu', 'Yutu', 'Esprit-animal', 'Lièvre de Jade', 'purple', 'lune', 'c', 'Yutu, white jade rabbit with a mortar and a pestle, glowing silver fur, crescent moon behind it'],
  ['gui_po', 'Gui Po', 'Gui', 'Vieille aux Cheveux Longs', 'purple', 'lune', 'c', 'Gui Po, old woman ghost with long grey hair, funeral clothes, pale face, holding a bowl of tea, ghostly light'],
  ['nu_gui', 'Nü Gui', 'Gui', 'Fantôme aux Cheveux Défaits', 'purple', 'lune', 'b', 'Nu Gui, female ghost with long loose hair, floating white robe, no visible feet, sad face'],
  ['diaosi_gui', 'Diao Si Gui', 'Gui', 'Pendu', 'purple', 'lune', 'b', 'Diao Si Gui, hanged ghost with a rope around the neck, twisted face, long red tongue, tattered white robe'],
  ['yuan_gui', 'Yuan Gui', 'Gui', 'Esprit Vengeur', 'red', 'lune', 'e', 'Yuan Gui, vengeful spirit with a face marked by sorrow and wounds, red mourning robe, glowing furious eyes'],
  ['heibai_wuchang', 'Heibai Wuchang', 'Esprit', 'Messagers des Morts', 'purple', 'lune', 'l', 'Heibai Wuchang, two ghost guides, one in white one in black, long robes, tall hats, long dangling tongue, chains'],
  ['nuwa', 'Nüwa', 'Divinité', 'Mère des Hommes', 'yellow', 'lune', 'l', 'Nuwa, goddess with a human upper body and a serpent tail, colorful stones in her hands, flowing robe, serene'],
  ['fuxi', 'Fuxi', 'Divinité', 'Souverain des Trigrammes', 'green', 'lune', 'l', 'Fuxi, civilizing god with a human torso and a serpent tail, holding a set of trigram tablets, wise'],
  ['yayu', 'Yayu', 'Hybride', 'Bête au Destin Tragique', 'red', 'lune', 'e', 'Yayu, hybrid beast with a dragon head and a bull-like body, crimson fur, sad eyes, pained stance'],
  ['feiyi', 'Feiyi', 'Serpent', 'Serpent à Deux Têtes', 'purple', 'lune', 'b', 'Feiyi, two-headed serpent with a winding body, two heads facing different ways, dusky violet scales'],
  ['yingzhao_ailee', 'Yingzhao', 'Hybride', 'Bête Ailée', 'blue', 'lune', 'c', 'Yingzhao, composite winged beast with a pale silhouette and uncertain details, shimmering wings, mountain mist'],
  ['tiangou_lune', 'Tiangou', 'Bête', 'Chien Dévoreur de Lune', 'purple', 'lune', 'e', 'Tiangou, dark dog leaping at the moon, huge open mouth, black fur dotted with stars, cosmic glow']
];

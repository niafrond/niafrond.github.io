// Textes — Hautes-Eaux de la Lune Montante (dossier narratif : world/PLAN-MAREES.md). Après le neuvième soleil, avant la Lune.
// Les dialogues ne dépendent que de `sun_9`, `sq_pas_de_yu` et des quêtes de la région (le Pic de la Lune est postérieur).
export default {
  waypointName: "Pierre de voyage — Autel de Mazu",
  screens: {
    marees_road: { name: "Haute Mer des Pontons", arrival: [
      "Devant vous, l'escalier de la digue s'enfonce dans la mer noire. Nulle barque ne reste, et la Lune, immense, tire sur l'eau comme sur une nappe.",
      "Au loin, de minces pontons de bois flottent comme des îlots, des lanternes rouges accrochées à leurs pieux. Pour y aller, il faudrait marcher sur l'eau."] },
    marees_village: { name: "Shuiyu-sous-l'Eau", arrival: [
      "Shuiyu a gardé ses toits et perdu ses rues. On y entre par la fenêtre et on en sort par le puits.",
      "Des maisons sur pilotis dorment les pieds dans la marée, reliées par des passerelles de bambou. Des cormorans somnolent sur les faîtages, et la nuit entière sent la saumure, le camphre et le thé de gingembre."] },
    marees_wild: { name: "Gouffre des Mirages", arrival: [
      "Ici l'eau est plus noire et plus profonde, et les pontons se font rares. Parfois, une cité de lanternes se dessine à l'horizon : elle disparaît quand on s'en approche.",
      "Les pêcheurs disent que la mer fait voir ce qu'on n'ose pas regarder. Gardez les yeux sur vos pieds."] },
    marees_h_cormoran: { name: "Cabane des cormorans", arrival: ["Une cabane tiède, où des perchoirs de bambou luisent de graisse de poisson. Une odeur de fumée, de filet mouillé et de patience."] },
    marees_h_temple: { name: "Petit temple de Mazu", arrival: ["Un temple minuscule, laqué de rouge. Une statue de Mazu veille, la lanterne à la main, sur ceux qui sont en mer — et sur ceux qui ne savent pas qu'ils y sont."] },
    marees_h_lanternes: { name: "Atelier des bateaux-lanternes", arrival: ["Des centaines de petites coques de papier huilé sèchent au plafond. Chacune porte une mèche et une prière."] }
  },
  arrivalSanctuary: [],
  npcs: {
    marees_road_xu: { name: "Vieux Xu", title: "Passeur de la Digue",
      idle: [
        "Plus de barque, plus de passeur. Je reste là par habitude. Vous voulez passer ? Alors ne comptez pas sur moi, comptez sur vos pieds.",
        "J'ai vu un homme marcher sur ces eaux, il y a longtemps, avant ma jambe. Pas de barque. Trois pas devant, trois sur le côté, un derrière : une danse de boiteux. Ça venait d'une tortue, je crois. Une vieille, qui parle trop lentement.",
        "Une tortue noire, qui vivait là où le fleuve s'est tari. Je ne sais plus le nom du village. Il y avait un quai qui donnait sur du vide, ça, je m'en souviens. Faites votre chemin, archer."],
      talk: [{ whenDone: "sq_pas_de_yu", lines: [
        "Vous marchez sur l'eau ? C'est donc vous, l'archer. Un conseil : ne pensez pas au pas, pensez à l'invitation. L'eau n'aime pas les gens trop sûrs d'eux."] }] },
    marees_village_ling: { name: "Ling", title: "Dresseuse de cormorans",
      idle: [
        "Mon cormoran Pointe-de-Neige porte un anneau de paille à la gorge : il pêche, il rapporte, il n'avale pas. Un contrat de confiance.",
        "Depuis que la mer est montée, il pêche chez moi, au salon. Il est vexé qu'on lui facilite la tâche."],
      talk: [{ whenDone: "sq_cormoran", lines: [
        "Pointe-de-Neige a retrouvé son anneau. Il l'a porté toute la nuit. C'est un cormoran, il ne dit pas merci, mais il dort contre ma main."] }] },
    merchant_marees: { name: "Maître Tang", title: "Saunier des radeaux",
      talk: [{ whenDone: "sun_9", lines: ["La nuit entière ! Mon sel sèche mieux sous la lune. Ça ne devrait pas, mais c'est comme ça."] }] },
    marees_village_nonne_mo: { name: "Sœur Mo", title: "Gardienne de l'autel de Mazu",
      idle: [
        "Mazu protège ceux qui sont en mer. Elle protège même ceux qui ne savent pas qu'ils y sont. Les marées d'ici sont plus pieuses que les hommes.",
        "Ma sœur aînée, Dame Mo, veille sur la baie des Coquillages. Moi, je veille sur l'autel, au bout des pontons. Il y dort quelqu'un que je ne réveille pas : elle n'est pas d'ici."],
      talk: [{ whenDone: "sq_offrande_mazu", lines: [
        "L'offrande a flotté jusqu'à la statue, et elle a souri. Passez, archer. Elle aime ceux qui traversent la mer pour retrouver quelqu'un."] }] },
    marees_village_canne: { name: "Vieille Canne", title: "Pêcheur aveugle",
      idle: [
        "Je n'ai plus besoin d'yeux. La mer me raconte ce qu'elle porte. En ce moment, elle porte la peur d'un homme. Un archer, mais pas vous. Un autre.",
        "Il a pris la jonque du père Hu et il n'a même pas levé la tête quand les enfants ont crié. Je l'ai entendu rire, une fois, pas de joie."] },
    marees_village_lanterne: { name: "Xiao Deng", title: "Fabricante de bateaux-lanternes",
      idle: [
        "Chaque lanterne est un petit bateau pour les âmes de ceux qui sont tombés à l'eau. J'en ai fait quarante, ça devrait suffire pour cette année.",
        "Les grands dorment mal depuis que la Lune bouge. Moi, je trouve ça joli, une Lune qui bouge."],
      talk: [{ whenDone: "sq_bateaux_lanternes", lines: [
        "Les lanternes sont parties vers la Lune. Elles ne reviennent jamais, mais elles brillent tout le trajet."] }] },
    marees_village_hu: { name: "Père Hu", title: "Charpentier de jonques",
      idle: [
        "Ma dernière jonque, on me l'a prise. Un jeune homme à l'arc, qui avait les yeux de quelqu'un qui ne dort plus. J'ai bien vu qu'il avait peur de quelque chose.",
        "Je construis maintenant des radeaux. Un radeau, ça pardonne tout. Une jonque, ça coule avec dignité."] },
    marees_village_jiaoxia: { name: "Sage Jiaoxia", title: "Crabe-commerçant",
      idle: [
        "Vous croisez un crabe qui parle, et vous vous étonnez. La vraie question, c'est pourquoi les hommes n'en parlent pas davantage.",
        "Je marche de côté depuis la dernière dynastie. Aucune route directe ne vaut la peine : elle ne connaît pas les pontons."],
      talk: [{ whenDone: "sq_pas_de_yu", lines: [
        "Vous avez le pas de Yu ? Alors vous marchez comme un crabe, et vous ne le saviez pas. Bienvenue chez les nôtres."] }] },
    marees_deep_salter: { name: "Dame Yan", title: "Saunière du Sel Rouge",
      idle: [
        "Mon four flotte sur quatre barils vides. Le sel rouge est celui des mirages : il pique, il fait voir double, et il se vend très bien.",
        "Si la mer vous montre une ville, ne lui répondez pas. Les villes d'ici n'aiment pas qu'on leur dise bonsoir."] }
  },
  chests: {
    marees_anneau_chest: { label: "Anneau de paille de Pointe-de-Neige", openText: "Sur le ponton des Trois Lanternes, coincé entre deux planches, l'anneau de paille d'un cormoran. Il porte encore l'odeur du poisson." },
    marees_road_salt: { label: "Tonnelet de sel rouge", openText: "Un tonnelet que la marée a oublié sur le ponton : du sel rouge et quelques pièces dedans." },
    marees_road_widow: { label: "Offrande du Cormoran Veuf", openText: "Au pied d'un pieu, un petit bol de riz et de monnaie : l'offrande des pêcheurs au cormoran qui a perdu son compagnon." },
    marees_village_nets: { label: "Filet de pêche roulé", openText: "Dans un filet roulé sur le quai, quelques pièces mouillées et un hameçon en bronze." },
    marees_village_raft: { label: "Caisse du radeau-marché", openText: "Une caisse de sel et de monnaie, que Maître Tang jure ne pas avoir perdue." },
    marees_village_roof: { label: "Jarre sur le toit", openText: "Une jarre coincée entre deux pieux, pleine de pièces de cuivre salées." },
    marees_h_cormoran_box: { label: "Coffret de la cabane", openText: "Un coffret rempli de pièces et de plumes grises, sous le perchoir de Pointe-de-Neige." },
    marees_h_temple_box: { label: "Tronc de Mazu", openText: "Le tronc du petit temple : les offrandes de ceux qui partent en mer, et de ceux qui en reviennent." },
    marees_cire_chest: { label: "Caisse de mèches de cire", openText: "Une caisse de mèches de cire d'abeille, enveloppées dans du papier huilé. Au fond, quelques pièces." },
    marees_deep_root: { label: "Cachette sous le ponton", openText: "Sous les planches, une cache de pêcheur : des pièces, enveloppées dans une feuille de lotus." },
    marees_deep_widow: { label: "Offrande des cormorans", openText: "Un coffret de bambou où les pêcheurs déposent leur part de pièces pour les cormorans noyés." },
    marees_deep_salt: { label: "Coffre du four à sel", openText: "Un lourd coffre croûté de sel rouge, sur le four flottant de Dame Yan : des pièces, et la sueur de dix mille marées." },
    marees_compass_chest: { label: "Boussole de jade de Mazu", openText: "Sous le sel rouge, une boussole de jade dont l'aiguille tremble vers l'est. Les mirages se déchirent : les vrais pontons apparaissent." },
    marees_riz_chest: { label: "Urne de riz sacré de Mazu", openText: "Une urne laquée pleine de riz sacré, posée sur l'autel du Dragon-Roi. Le riz luit comme de la perle." }
  },
  quests: [
    { id: "sq_cormoran", title: "L'anneau de Pointe-de-Neige", chapter: "✦ Quête secondaire — Hautes-Eaux de la Lune Montante", giver: "marees_village_ling", turnIn: "marees_village_ling", requires: [], side: true,
      objectives: [
        { type: "chest", target: "marees_anneau_chest", text: "Retrouver l'anneau de paille de Pointe-de-Neige (ponton des Trois Lanternes)" },
        { type: "killGroup", target: "marees_crabs", text: "Chasser les crabes-soldats qui rôdent sur le ponton du Sel Rouge" }],
      offer: ["Pointe-de-Neige a perdu son anneau sur un ponton. Sans lui, il avale tout, y compris ses prises, et il est insupportable.", "Retrouvez-le, et chassez les crabes qui ont élu domicile par là. Ils pincent."],
      hint: ["L'anneau de paille est sur le ponton des Trois Lanternes. Les crabes tiennent le ponton du Sel Rouge, plus au sud. Il faut marcher sur l'eau pour y aller."],
      complete: ["Ling passe l'anneau à la gorge de son oiseau, qui ne remercie pas mais s'endort sur son bras. « Tenez, un peu de sel rouge pour la route. »"],
      reward: { gold: 120, fragment: "Anneau de cormoran", xp: 90 } },
    { id: "sq_bateaux_lanternes", title: "Quarante lanternes pour la Lune", chapter: "✦ Quête secondaire — Hautes-Eaux de la Lune Montante", giver: "marees_village_lanterne", turnIn: "marees_village_lanterne", requires: [], side: true,
      objectives: [
        { type: "chest", target: "marees_cire_chest", text: "Rapporter la caisse de mèches de cire (atelier des bateaux-lanternes)" },
        { type: "kill", target: "marees_deep_mirage", text: "Chasser la méduse des mirages qui éteint les flammes (Gouffre des Mirages)" }],
      offer: ["Il me manque des mèches de cire pour finir mes quarante bateaux-lanternes. Et une méduse du Gouffre éteint les flammes de loin : elle les prend pour des étoiles.", "Aidez-moi, voulez-vous ? La Lune aime qu'on lui écrive."],
      hint: ["La caisse de mèches est dans l'atelier, au fond. La méduse rôde dans le Gouffre des Mirages, à l'est de la grande passerelle."],
      complete: ["Xiao Deng allume la première mèche. Elle brille. « Elles ne reviendront pas, mais elles éclaireront tout le trajet. Merci. »"],
      reward: { gold: 100, fragment: "Lanterne de Xiao Deng", xp: 80 } },
    { id: "sq_offrande_mazu", title: "Le riz de Mazu", chapter: "✦ Quête secondaire — Hautes-Eaux de la Lune Montante", giver: "marees_village_nonne_mo", turnIn: "marees_village_nonne_mo", requires: [], side: true,
      objectives: [
        { type: "chest", target: "marees_riz_chest", text: "Rapporter l'urne de riz sacré de l'autel du Dragon-Roi (Gouffre des Mirages)" },
        { type: "kill", target: "marees_hai_gui", text: "Écarter la tortue des récifs qui garde l'urne (Gouffre des Mirages)" }],
      offer: ["Il manque du riz sacré à l'autel de Mazu : l'urne repose sur le ponton du Dragon-Roi, au cœur du Gouffre. Une vieille tortue des récifs s'y est installée et ne veut plus partir.", "Il faut marcher sur l'eau pour aller là-bas. Si vous le pouvez, rapportez l'urne."],
      hint: ["L'autel du Dragon-Roi est sur un ponton du Gouffre des Mirages, tout au sud-est. La tortue ne bouge pas tant qu'on ne l'y force pas."],
      complete: ["Sœur Mo pose le riz devant la statue. Les lanternes vacillent, puis s'apaisent. « Mazu est contente. Prenez une perle de ce riz : elle protège ceux qui marchent sur l'eau. »"],
      reward: { gold: 140, fragment: "Riz de Mazu", xp: 100 } }
  ]
};

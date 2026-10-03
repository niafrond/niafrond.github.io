// Textes — Cime du Fusang (Terrasses de Fusang-le-Bas, racines et branches dorées).
export default {
  screens: {
    fusang_village: { name: 'Terrasses de Fusang-le-Bas', arrival: [
      'Fusang-le-Bas monte à l\'assaut de la colline comme un escalier pour géants. Les habitants y parlent bas : on ne sait jamais à quelle branche ils sont accrochés.',
      'Le Dixième Soleil n\'est pas loin : l\'air sent le miel tiède.'] },
    fusang_wild: { name: 'Racines et Branches Dorées', gateMessage: 'Le sceau de la Reine Mère est brisé. Il faut en retrouver les trois éclats avant de monter à la cime.', arrival: [
      'Les racines du Fusang forment une cathédrale sans toit. Un vent doré porte des murmures de grue et des promesses de lumière.'] },
    fusang_h_grue: { name: 'Nid de la messagère', arrival: ['Un nid géant tressé de plumes blanches. La Grue y garde les messages de la Reine Mère, et ses opinions.'] },
    fusang_h_cueilleur: { name: 'Maison du cueilleur de pêches', arrival: ['Une cabane sucrée qui sent la pêche mûre. On y cueille encore, une par siècle, des fruits d\'immortalité.'] },
    fusang_h_astronome: { name: 'Observatoire de Mère Xing', arrival: ['Des instruments de laiton pointés vers un ciel qui ne se laisse pas mesurer. Mère Xing a renoncé à la précision, elle observe.'] },
    fusang_h_temple: { name: 'Petit temple des Dix Soleils', arrival: ['Un temple de dix lanternes, dont neuf sont éteintes. La dixième vacille, comme si elle hésitait.'] },
    fusang_h_chambre: { name: 'Maison de thé suspendue', arrival: ['Accrochée aux branches, elle se balance doucement. Le thé n\'y tremble pas : il a l\'habitude.'] }
  },
  npcs: {
    picker_tao: { name: 'Tao', title: 'Cueilleur de pêches', emoji: '🍑',
      idle: ['Une pêche par siècle ! C\'est le rythme de l\'arbre. Je ne suis pas pressé, moi, j\'ai l\'éternité devant moi, ou du moins une partie.', 'On me demande souvent si ces pêches rendent immortel. Réponse : seulement si on les mange avec modération.'],
      talk: [{ whenDone: 'sun_9', lines: ['Le neuvième soleil est tombé. Les pêches ont pâli, puis rougi. J\'y vois un signe, mais je ne sais pas encore lequel.'] }] },
    astronomer_xing: { name: 'Mère Xing', title: 'Astronome de l\'arbre', emoji: '🔭',
      idle: ['J\'ai compté dix soleils dans le ciel, il y a longtemps. J\'en compte maintenant un seul. La différence est très reposante.', 'Une étoile m\'a dit que la Lune a une nouvelle habitante. Je ne sais pas si c\'est une bonne nouvelle. Les étoiles aiment les ragots.'],
      talk: [{ whenDone: 'sun_9', lines: ['Le neuvième soleil abattu, le ciel est calme. Il ne reste qu\'un soleil, et il tremble de peur. Soyez doux avec lui, archer.'] }] },
    acolyte_ri: { name: 'Ri', title: 'Acolyte aux neuf lanternes', emoji: '🕯️',
      idle: ['Je prends soin de dix lanternes. Neuf sont éteintes, la dixième tient bon. Je lui parle, elle ne me répond pas.', 'Les soleils étaient des frères. On les a abattus, un à un. Je prie pour eux, sans rancune.'],
      talk: [{ whenDone: 'sun_9', lines: ['J\'ai rallumé une lanterne pour chaque soleil, en souvenir. Ce ne sont plus des menaces, mais des mémoires. C\'est mieux.'] }] },
    teamaster_you: { name: 'Maître You', title: 'Maître de thé suspendu', emoji: '🍃',
      idle: ['Le thé se prépare comme la vie : lentement, avec respect, en tenant bien la tasse.', 'Une grue vient parfois boire ici. Elle dit qu\'une dame, là-haut, lui a offert un flacon. Je ne la crois pas, mais elle boit bien.'],
      talk: [{ whenDone: 'sun_9', lines: ['Le thé est meilleur depuis que le ciel est calme. J\'ai tenté d\'en offrir au dernier soleil. Il l\'a refusé poliment. Il est timide.'] }] },
    hua_fusang: { name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒',
      idle: ['Me voilà à la cime ! Mes pieds sont vaincus, mon sac ravi. Il y a des clients ici qui ne marchandent pas : les arbres.', 'J\'ai vendu une lanterne à Ri, une écharpe à la Grue, et une histoire au vent. Pas mal pour une journée.'],
      talk: [{ whenDone: 'sun_9', lines: ['Neuf soleils ! Je file vers la Lune. Pas à pied, cette fois : j\'ai promis une lanterne à la veilleuse là-haut.'] }] },
    child_yuer: { name: 'Yuer', title: 'Fillette qui écoute les soleils', emoji: '🧒',
      idle: ['Je suis la seule qui entende les soleils. Ils chantent, tout bas, dans leur sommeil.', 'Le dernier soleil a peur. Il chante une berceuse pour ne pas pleurer. Elle est très jolie.'],
      talk: [{ whenDone: 'sq_neuf_lanternes', lines: ['Les neuf lanternes sont rallumées. Le dernier soleil a souri. J\'ai entendu. C\'était un petit rire de lumière.'] }] },
    phoenix_chick: { name: 'Petit Fenghuang', title: 'Poussin de phénix', emoji: '🐥',
      idle: ['Piou ! Je suis un poussin de phénix. Je renais tous les matins. Ça fatigue.', 'Ma mère me dit que je serai grand, rouge et or. Moi, je préfère rester petit et jaune.'],
      talk: [{ whenDone: 'sun_9', lines: ['Piou ! Le soleil est moins chaud ! Je peux sortir toute la journée ! Merci, archer, je vous donne une plume (non, pas la mienne, j\'en ai besoin).'] }] },
    root_elder: { name: 'Racine-Ancienne', title: 'Esprit de l\'arbre', emoji: '🌳',
      idle: ['Je suis l\'arbre où les soleils ont dormi. J\'ai bercé dix frères, et je n\'en garde qu\'un.', 'Les racines se souviennent de tout. Même des soleils qui ont brillé trop fort.'],
      talk: [{ whenDone: 'sq_sceau_racines', lines: ['Le sceau est reformé. La cime est ouverte. Montez, archer, mais avec douceur : un soleil dort là-haut, et il rêve de vous.'] }] }
  },
  chests: {
    crane_feather_box: { label: 'Coffre de plumes', openText: '🎁 Des plumes de grue d\'une blancheur de neige, et sous elles quelques pièces d\'argent, cadeau de la Reine Mère.', emoji: '🪶', emojiOpened: '🪶' },
    peach_basket: { label: 'Panier de pêches', openText: '🎁 Un panier de pêches d\'immortalité… vides de noyau, mais pleines de pièces. Tao dit que c\'est plus prudent.', emoji: '🍑', emojiOpened: '🍑' },
    teapot_chest: { label: 'Coffre de la théière', openText: '🎁 Dans la théière, quelques pièces glissées par des voyageurs reconnaissants, et une feuille de thé qui sent le miel.', emoji: '🫖', emojiOpened: '🫖' },
    seal_shard_a: { label: 'Premier éclat du sceau', openText: '✨ Un premier éclat du sceau de la Reine Mère brille dans votre main, tiède comme une lune d\'été.', emoji: '💠', emojiOpened: '💠' },
    seal_shard_b: { label: 'Deuxième éclat du sceau', openText: '✨ Un deuxième éclat du sceau, plus lourd que le premier. Il chante tout bas.', emoji: '💠', emojiOpened: '💠' },
    seal_shard_c: { label: 'Troisième éclat du sceau', openText: '✨ Le troisième et dernier éclat du sceau. Ensemble, ils forment une étoile de jade. Un peu d\'or l\'accompagne.', emoji: '💠', emojiOpened: '💠' }
  },
  quests: [
    { id: 'sq_sceau_racines', title: 'Le sceau des racines', chapter: '✦ Quête secondaire — Cime du Fusang', giver: 'astronomer_xing', turnIn: 'astronomer_xing', requires: [], side: true,
      objectives: [
        { type: 'chest', target: 'seal_shard_a', text: 'Retrouver le premier éclat du sceau (racines et branches dorées)' },
        { type: 'chest', target: 'seal_shard_b', text: 'Retrouver le deuxième éclat du sceau (racines et branches dorées)' },
        { type: 'chest', target: 'seal_shard_c', text: 'Retrouver le troisième éclat du sceau (racines et branches dorées)' }],
      offer: ['Seigneur archer, le sceau que la Reine Mère avait posé sur la cime est brisé en trois éclats, cachés dans les racines. Tant qu\'il n\'est pas recomposé, la voie vers le sanctuaire reste close.', 'Retrouvez-les, un à un. Ils sont dans des coffres que seule la patience ouvre.'],
      hint: ['Les trois éclats du sceau se cachent dans les racines et branches dorées, derrière le village.'],
      complete: ['Le sceau est reformé ! La cime est ouverte. Gardez cet éclat de jade céleste : il vient d\'un ciel qui n\'est plus.'],
      reward: { gold: 195, fragment: 'Éclat de jade céleste', xp: 380 } },
    { id: 'sq_neuf_lanternes', title: 'Les neuf lanternes', chapter: '✦ Quête secondaire — Cime du Fusang', giver: 'acolyte_ri', turnIn: 'acolyte_ri', requires: [], side: true,
      objectives: [
        { type: 'talk', target: 'root_elder', text: 'Écouter la Racine-Ancienne (racines et branches dorées)', lines: ['Les soleils étaient des frères joueurs. Dites à Ri de les nommer en rallumant les lanternes. Les noms réchauffent, même les morts.'] },
        { type: 'talk', target: 'child_yuer', text: 'Parler à Yuer, la fillette qui écoute les soleils (terrasses de Fusang-le-Bas)', lines: ['Les soleils disent merci à Ri. Ils veulent qu\'on se souvienne d\'eux comme de frères, pas comme d\'ennemis. C\'est ça, rallumer une lanterne.'] }],
      offer: ['Je voudrais rallumer une lanterne pour chaque soleil abattu, afin de ne pas oublier ce qu\'ils furent. Mais je ne sais pas quoi dire.', 'Écoutez la Racine-Ancienne, puis parlez à Yuer. Elles sauront me souffler les mots.'],
      hint: ['La Racine-Ancienne est dans les racines et branches dorées. Yuer est sur la place du village.'],
      complete: ['Merci, archer. Les lanternes brûlent, et leurs noms avec elles. Voici une cendre de lanterne : elle ne s\'éteint jamais complètement.'],
      reward: { gold: 200, fragment: 'Cendre de lanterne', xp: 390 } },
    { id: 'sq_immortel_egare', title: 'L\'immortel égaré', chapter: '✦ Quête secondaire — Cime du Fusang', giver: 'child_yuer', turnIn: 'child_yuer', requires: ['sq_neuf_lanternes'], side: true,
      objectives: [{ type: 'kill', target: 'fusang_jade_wraith', text: 'Calmer l\'immortel de jade égaré (racines et branches dorées)' }],
      offer: ['Un immortel de jade vagabonde dans les racines, hanté par un souvenir. Les soleils m\'ont dit qu\'il cherche son maître.', 'Il suffit de le calmer, vous êtes le plus doué pour ça. Mais ne lui faites pas de mal : il est fragile comme un vase.'],
      hint: ['L\'immortel de jade égaré rôde dans les racines et branches dorées, derrière le village.'],
      complete: ['Il a retrouvé le calme ! Il m\'a dit merci, dans sa voix de cristal. Il m\'a donné ceci : un morceau de jade chantant.'],
      reward: { gold: 200, fragment: 'Jade chantant', xp: 400 } }
  ]
};

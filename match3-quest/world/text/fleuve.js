// Textes — Lit du Fleuve Jaune (Port-à-Sec de Hekou, méandres).
export default {
  screens: {
    fleuve_village: { name: 'Port-à-Sec de Hekou', arrival: [
      'Les quais de Hekou donnent sur du vide : des barques couchées dans la boue, des amarres tendues vers rien.',
      'Les habitants vous regardent avec cet espoir poli que l\'on réserve aux marchands de pluie.'] },
    fleuve_wild: { name: 'Méandres de Boue et d\'Écluses', gateMessage: 'La grande écluse est verrouillée. Sa clé repose dans un coffre, quelque part dans les méandres.', arrival: [
      'Le fleuve s\'est retiré comme un roi vexé, laissant derrière lui ses meubles. Quelque part, une vieille écluse garde encore son secret.'] },
    fleuve_h_gu: { name: 'Cabane du passeur Gu', arrival: ['Des rames de rechange, un poisson séché porte-bonheur et une odeur de goudron : la cabane d\'un homme sans bateau mais pas sans fierté.'] },
    fleuve_h_mei: { name: 'Atelier de Mei', arrival: ['Un métier immense, des fils de toutes les couleurs. On dirait que la pièce elle-même est tissée.'] },
    fleuve_h_sel: { name: 'Entrepôt de sel de Hu', arrival: ['Des pyramides de sel gris luisent dans la pénombre. Le marchand goûte tout, y compris les compliments.'] },
    fleuve_h_ecrivain: { name: 'Échoppe de l\'écrivain public', arrival: ['Pinceaux, encre, pigeons voyageurs : ici, on écrit les lettres des autres, et on lit parfois celles qu\'on ne devrait pas.'] },
    fleuve_h_tortue: { name: 'Mare de la Tortue Gui', arrival: ['Une dernière mare, entourée de pierres. L\'eau est si calme qu\'elle semble réfléchir.'] }
  },
  npcs: {
    salt_hu: { name: 'Hu', title: 'Marchand de sel', 
      idle: ['Sans eau, le sel ne manque pas ! C\'est la seule chose qui prospère ici. On appelle ça une consolation salée.', 'Goûtez ce sel gris : il vient du fond du fleuve, il a goût de regrets et de vieux poisson.'],
      talk: [{ whenDone: 'sun_2', lines: ['Le deuxième soleil est tombé, et j\'ai senti un peu d\'humidité dans mes tonneaux. Du jamais vu depuis trois lunes. Je vous offre une pincée de bonheur en poudre.'] }] },
    scribe_ou: { name: 'Maître Ou', title: 'Écrivain public', 
      idle: ['J\'écris des lettres pour ceux qui ne savent pas, et je lis celles qui n\'étaient pas pour moi. Déformation professionnelle.', 'Un jeune archer est passé me demander un papier à entête impériale. Il avait le regard d\'un homme qui veut quelque chose qu\'on ne lui a pas donné.'],
      talk: [{ whenDone: 'fengmeng_1', lines: ['Votre disciple Fengmeng a écrit une lettre qu\'il n\'a pas envoyée. Je l\'ai lue, bien sûr. Elle disait : « Maître, regardez-moi enfin. » Il n\'a pas signé. Les orgueilleux ne signent pas ce qui les trahit.'] }] },
    gui_turtle: { name: 'Gui', title: 'Vieille tortue noire', 
      idle: ['J\'ai porté la terre sur mon dos pendant des siècles. Un soleil de plus ou de moins, c\'est une saison dans ma vie.', 'On m\'a dit qu\'une femme garde un élixir qui rend immortel. Que n\'ai-je pas eu cette chance… oh, j\'ai déjà. Et croyez-moi, ça fatigue.'],
      talk: [{ whenDone: 'sun_2', lines: ['Le fleuve reviendra. Pas demain. Après-demain peut-être. Mais je suis une tortue : je ne me presse pas.'] }] },
    girl_lian: { name: 'Lian', title: 'Collectionneuse de coquillages', 
      idle: ['J\'ai trois cent douze coquillages ! Ils ne vivent plus dans l\'eau, mais ils chantent quand même.', 'Quand j\'approche l\'oreille, j\'entends le fleuve. Il dit qu\'il est désolé d\'être parti.'],
      talk: [{ whenDone: 'sun_2', lines: ['Les coquillages ont changé de chanson ! Ils disent « bientôt » au lieu de « jamais ». C\'est grâce à vous, archer !'] }] },
    boatman_shan: { name: 'Laoshan', title: 'Batelier désœuvré', 
      idle: ['Je suis batelier sans bateau et sans fleuve. Un peu comme un poète sans mots : on tient quand même le coup.', 'Je répare ma barque tous les jours, pour qu\'elle soit prête quand l\'eau reviendra. L\'espoir, c\'est du goudron.'],
      talk: [{ whenDone: 'sun_2', lines: ['Le fleuve a gargouillé cette nuit. Ma barque a frémi. Elle l\'a senti avant moi.'] }] },
    hua_fleuve: { name: 'Hua', title: 'Colporteuse aux mille babioles', 
      idle: ['Tiens, on se revoit ! Le monde est petit quand on marche vite. Une épingle ? Une rumeur ? Les deux ?', 'Je suis venue chercher du sel pour la route du désert. Hu me fait toujours un prix d\'ami, c\'est-à-dire pas du tout.'],
      talk: [{ whenDone: 'sun_2', lines: ['Je file vers le Gobi avec la caravane. Si vous avez des lettres à faire voyager, je suis votre colporteuse.'] }] },
    carp_jin: { name: 'Jin', title: 'Carpe dorée dans sa flaque', 
      idle: ['Blub. Je suis la dernière carpe du coin et la plus mal logée. Mais ma flaque est dorée, et elle me reste.', 'On dit que les carpes qui franchissent la Porte du Dragon deviennent des dragons. Moi, je vise déjà une vraie mare.'],
      talk: [{ whenDone: 'sq_perle_carpe', lines: ['Merci pour la perle, archer. Ma flaque est plus légère, et moi aussi.'] }] }
  },
  chests: {
    ferry_lockbox: { label: 'Cassette du passeur', openText: 'La cassette de Gu contient des pièces de passage, soigneusement comptées « au cas où l\'eau reviendrait ».' },
    mei_thread_box: { label: 'Boîte à fils de soie', openText: 'Sous les bobines de soie, un petit pécule : Mei vend aussi des motifs, aux marchands pressés.' },
    salt_barrel: { label: 'Tonneau de sel scellé', openText: 'Le sel cache un sac de pièces. Hu appelle ça « l\'épargne salée ».' },
    mud_cache: { label: 'Cache dans la vase', openText: 'Dans la boue séchée, une cassette de batelier avec quelques pièces. Elle sent la vase et le souvenir.' },
    carp_pearl: { label: 'Perle de la flaque dorée', openText: 'Au fond de la flaque, une perle dorée et des pièces. La carpe Jin la gardait depuis longtemps.' },
    sluice_key_chest: { label: 'Coffre-clé de l\'écluse', openText: 'Une lourde clé de bronze repose dans le coffre, avec quelques pièces. La grande écluse devrait s\'ouvrir !' },
    wreck_hoard: { label: 'Cale d\'une épave', openText: 'La cale de l\'épave recèle le fret d\'un marchand malchanceux : un joli butin.' }
  },
  quests: [
    { id: 'sq_lettre_bao_2', title: 'La lettre fait escale', chapter: '✦ Quête secondaire — Lit du Fleuve Jaune', giver: 'ferryman_gu', turnIn: 'hua_gobi', requires: ['sq_lettre_bao_1'], side: true,
      objectives: [{ type: 'talk', target: 'hua_gobi', text: 'Confier la lettre de Petit Bao à Hua la colporteuse (caravansérail de Yueya, Désert de Gobi)', lines: ['La lettre de Petit Bao ? Donnez, donnez. Je la glisse dans mon sac à bonnes nouvelles. Elle ira loin.'] }],
      offer: ['La lettre du petit Bao… Je ne quitte jamais mon fleuve, mais Hua la colporteuse part pour le Gobi avec la caravane. Elle connaît toutes les routes, et tous les marins du coin.', 'Portez-lui la lettre. Elle sera au caravansérail de Yueya, entre deux marchandages.'],
      hint: ['Hua la colporteuse est au caravansérail de Yueya, dans le désert de Gobi. Elle prend toujours les lettres.'],
      complete: ['Hua tapote son sac : « Bien reçu ! Pour la mer, je ne vais pas jusque-là. Mais vous, si. »'],
      reward: { gold: 50, fragment: 'Sceau de cire', xp: 45 } },
    { id: 'sq_perle_carpe', title: 'La perle de la carpe Jin', chapter: '✦ Quête secondaire — Lit du Fleuve Jaune', giver: 'girl_lian', turnIn: 'girl_lian', requires: [], side: true,
      objectives: [
        { type: 'talk', target: 'carp_jin', text: 'Parler à la carpe Jin (dans sa flaque dorée, dans les méandres)', lines: ['Blub. Une perle ? Oui, au fond de ma flaque. Elle me gêne : trop brillante pour dormir. Prends-la, archer.'] },
        { type: 'chest', target: 'carp_pearl', text: 'Récupérer la perle au fond de la flaque dorée (méandres du fleuve)' }],
      offer: ['Archer ! Il y a une carpe dorée dans une flaque, au creux des méandres. On dit qu\'elle cache une perle !', 'Moi je suis trop petite pour traverser la vase. Mais toi, tu peux ! Rapporte-moi la perle, et je te donne ce que j\'ai de plus précieux.'],
      hint: ['La flaque dorée est au creux des méandres, derrière le village. La carpe Jin te dira où chercher.'],
      complete: ['Une perle ! Elle est plus grosse qu\'un œil de dragon ! Je vais la mettre avec mes coquillages. Tiens, ton cadeau : ce morceau de nacre est tout ce que j\'ai de plus précieux.'],
      reward: { gold: 55, fragment: 'Nacre dorée', xp: 55 } },
    { id: 'sq_sel_vole', title: 'Le sel envolé', chapter: '✦ Quête secondaire — Lit du Fleuve Jaune', giver: 'salt_hu', turnIn: 'salt_hu', requires: [], side: true,
      objectives: [{ type: 'kill', target: 'fleuve_salt_thief', text: 'Retrouver le voleur de sel masqué (dans les méandres, derrière le village)' }],
      offer: ['Un voleur masqué m\'a dérobé trois sacs de sel ! C\'est pas le vol qui me désole, c\'est le mauvais goût : il les revend aux caravanes comme du sel de qualité inférieure.', 'Rattrapez-le dans les méandres et rapportez ce qu\'il reste. Le sel a une mémoire plus longue que les hommes.'],
      hint: ['Le voleur masqué traîne dans les méandres derrière le village. Il emporte du sel, pas de l\'or.'],
      complete: ['Mes sacs ! Un peu mouillés, mais intacts. Prenez cette pierre de sel : elle sert à fabriquer des flèches qui ne rouillent jamais.'],
      reward: { gold: 60, fragment: 'Pierre de sel', xp: 60 } }
  ]
};

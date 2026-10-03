// Textes — Rizières Desséchées (village de Dongqiao, digue, maisons).
export default {
  screens: {
    rizieres_village: { name: 'Hameau de Dongqiao', arrival: [
      'Dongqiao se serre autour de son puits à sec. Les lanternes rouges pendent mollement : même le vent a fait la sieste.',
      'Au loin, les digues craquelées attendent un archer.'] },
    rizieres_wild: { name: 'Digue et Marais Craquelés', gateMessage: 'Le vieux gardien de la digue barre le passage : impossible d\'atteindre le sanctuaire tant qu\'il se dresse là.', arrival: [
      'Au-delà du hameau, la terre s\'est ouverte comme une assiette fêlée. Les roseaux murmurent des rumeurs que seuls les crapauds comprennent.'] },
    rizieres_h_houyi: { name: 'Maison de Hou Yi et Chang\'e', arrival: ['Le four à gâteaux de lune est encore tiède. Chez soi, même la sécheresse sent un peu moins fort.'] },
    rizieres_h_wen: { name: 'Maison du Doyen Wen', arrival: ['Des rouleaux de comptes s\'empilent partout. Chacun raconte une récolte plus courte que la précédente.'] },
    rizieres_h_lin: { name: 'Chaumière de Lin', arrival: ['Une jarre ébréchée trône sur l\'autel des ancêtres, avec l\'air de s\'excuser.'] },
    rizieres_h_grenier: { name: 'Grenier communal', arrival: ['Le grenier résonne comme un tambour : preuve qu\'il n\'est plus très plein.'] },
    rizieres_h_etable: { name: 'Étable de Dahei', arrival: ['Une odeur de paille chaude et de sagesse bovine vous accueille.'] }
  },
  npcs: {
    ping: { name: 'Ping', title: 'Épouse de Lin', emoji: '👩‍🌾',
      idle: ['Lin dit que le riz repoussera. Moi, je dis qu\'il faut d\'abord que le riz veuille bien.', 'Je garde de l\'eau de cuisson pour les plantes. Elles me disent merci, à leur manière : en ne mourant pas.'],
      talk: [{ whenDone: 'sun_1', lines: ['Ce matin, un nuage est passé. Un seul, tout timide. Lin a pleuré, les enfants ont dansé : on a eu l\'impression de recevoir de la famille.'] }] },
    xiaobao: { name: 'Petit Bao', title: 'Enfant du hameau', emoji: '🧒',
      idle: ['Tu es vraiment l\'archer ? Tu peux tirer sur un nuage pour le faire pleuvoir ?', 'Papa est parti loin, sur la mer. Il me manque. Il manque aussi aux poissons, je crois.', 'Mon cerf-volant vole mieux que les oiseaux, parce que lui n\'a pas peur du soleil !'],
      talk: [{ whenDone: 'sun_1', lines: ['Il y a un nuage ! Il a la forme d\'une tortue ! Je vais lui écrire une lettre pour qu\'il revienne.'] }] },
    grandma_tao: { name: 'Grand-mère Tao', title: 'Doyenne des commères', emoji: '👵',
      idle: ['Je sais tout sur tout le monde. Je sais aussi que le doyen Wen cache des bonbons au gingembre dans son rouleau de comptes.', 'Un jeune disciple est passé l\'autre jour, des yeux de lame. Il regardait l\'autel des ancêtres de Chang\'e, celui où repose la fiole précieuse. On ne regarde pas ainsi une fiole : on le respecte ou on le laisse.'],
      talk: [{ whenDone: 'fengmeng_1', lines: ['Ce garçon, Fengmeng, a perdu son duel et gagné une rancune. À mon âge, on connaît la recette : jalousie, orgueil, et un peu de sel pour finir la marmite.'] }] },
    buffalo_dahei: { name: 'Dahei', title: 'Buffle d\'eau philosophe', emoji: '🐃',
      idle: ['Meuh. Autrement dit : la terre est sèche, mais la patience est humide.', 'J\'ai vu neuf soleils se lever dans mes rêves. Au dixième, je me suis réveillé. Je préfère rester sur celui-là.'],
      talk: [{ whenDone: 'sun_1', lines: ['Meuh, archer. J\'ai senti l\'humidité dans le vent ce matin. Si tu continues, je pourrai bientôt me rouler dans une vraie mare.'] }] },
    hua_riz: { name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒',
      idle: ['Épingles, clochettes, nouvelles fraîches ! Tout se vend, même les rumeurs. Surtout les rumeurs.', 'Je remonte le pays d\'ouest en est, village après village. Peut-être que nos routes se recroiseront, archer.'],
      talk: [{ whenDone: 'sun_1', lines: ['Le premier soleil est tombé ? Voilà qui va faire du bruit sur les routes. Je pars l\'annoncer au fleuve : les nouvelles voyagent mieux avec moi qu\'à pied.'] }] },
    scarecrow_cao: { name: 'Cao l\'Épouvantail', title: 'Sentinelle des champs', emoji: '🎃',
      idle: ['Je garde ces champs depuis trente saisons. Je n\'ai jamais fait peur à un oiseau, mais ils respectent mon engagement.', 'Quand le vent se lève, je parle un peu. Quand il se tait, je pense. C\'est plus reposant.'],
      talk: [{ whenDone: 'sun_1', lines: ['Un nuage ! Mon chapeau de paille a frémi. C\'est ma façon de pleurer de joie.'] }] },
    huang_xian: { name: 'Huang Xian', title: 'Belette jaune de la digue', emoji: '🦦',
      idle: ['Chut. Je ne suis pas là. Je suis une branche. Une branche qui parle, soit, mais discrète.', 'Je vois tout depuis la digue. Même un petit démon-renard qui vole des ficelles dans les roseaux.'],
      talk: [{ whenDone: 'rizieres_warden', lines: ['Le gardien est tombé ! La digue peut respirer. Moi aussi : on le prenait pour un grand-oncle mal luné, mais il l\'était vraiment.'] }] }
  },
  chests: {
    houyi_trunk: { label: 'Coffre de voyage de Hou Yi', openText: '🎁 Dans le coffre, une pochette de pièces que Chang\'e a glissée « au cas où ». Elle pense à tout.', emoji: '🧳', emojiOpened: '🧳' },
    wen_scroll_box: { label: 'Boîte à rouleaux du Doyen', openText: '🎁 Sous les rouleaux de comptes, quelques pièces et… un bonbon au gingembre. Vous prenez les pièces.', emoji: '📦', emojiOpened: '📭' },
    granary_sack: { label: 'Dernier sac du grenier', openText: '🎁 Le fond du sac cache des pièces de cuivre : le doyen les gardait pour la fête de la pluie.', emoji: '🌾', emojiOpened: '🌾' },
    dike_cache: { label: 'Cache sous la digue', openText: '🎁 Une cachette de contrebande de paysans : quelques pièces et un mot « pour le prochain qui aura soif ».', emoji: '🪨', emojiOpened: '🪨' },
    reed_kite: { label: 'Cerf-volant dans les roseaux', openText: '🎁 Le cerf-volant de Petit Bao, un peu froissé mais intact, et quelques pièces tombées d\'on ne sait où.', emoji: '🪁', emojiOpened: '🪁' },
    warden_hoard: { label: 'Trésor du gardien de la digue', openText: '🎁 Le gardien amassait les offrandes des voyageurs depuis des années. Vous soupesez un joli pécule.', emoji: '🏺', emojiOpened: '🏺' }
  },
  quests: [
    { id: 'sq_cerf_volant', title: 'Le cerf-volant de Petit Bao', chapter: '✦ Quête secondaire — Rizières Desséchées', giver: 'xiaobao', turnIn: 'xiaobao', requires: [], side: true,
      objectives: [{ type: 'chest', target: 'reed_kite', text: 'Retrouver le cerf-volant de Petit Bao (dans les roseaux de la digue, au-delà du hameau)' }],
      offer: ['Archer ! Mon cerf-volant s\'est pris dans les roseaux de la digue, là-bas. Moi je n\'ose pas : la belette dit que les roseaux mangent les enfants.', 'Elle plaisante, hein ? Dis-moi qu\'elle plaisante.'],
      hint: ['Le cerf-volant est resté coincé dans les roseaux de la digue, derrière le hameau. Cherche une tache de couleur.'],
      complete: ['Il est là ! Tout froissé, mais il vole encore dans ma tête. Merci, archer. Tiens, c\'est une plume de mon cerf-volant : papa disait qu\'elle porte chance.'],
      reward: { gold: 30, fragment: 'Plume de cerf-volant', xp: 20 } },
    { id: 'sq_cerf_volant_ficelle', title: 'La ficelle du chapardeur', chapter: '✦ Quête secondaire — Rizières Desséchées', giver: 'xiaobao', turnIn: 'xiaobao', requires: ['sq_cerf_volant'], side: true,
      objectives: [{ type: 'kill', target: 'rizieres_marsh_imp', text: 'Corriger le Xiao Gui des roseaux qui a volé la ficelle (marais de la digue)' }],
      offer: ['Le cerf-volant est revenu, mais sans sa ficelle ! Un Xiao Gui l\'a volée pour s\'en faire une corde à sauter, j\'en suis sûr. Tu peux lui dire d\'arrêter ?'],
      hint: ['Le petit démon-renard traîne dans les roseaux du marais. Il n\'aime pas qu\'on lui reprenne ses jouets.'],
      complete: ['Ma ficelle ! Elle est un peu mâchouillée, mais elle tient. Tu es le plus fort des archers, et le plus gentil des grands !'],
      reward: { gold: 40, fragment: 'Ficelle de soie', xp: 30 } },
    { id: 'sq_lettre_bao_1', title: 'Une lettre pour papa', chapter: '✦ Quête secondaire — Rizières Desséchées', giver: 'xiaobao', turnIn: 'ferryman_gu', requires: [], side: true,
      objectives: [{ type: 'talk', target: 'ferryman_gu', text: 'Porter la lettre de Petit Bao au passeur Gu (Lit du Fleuve Jaune)', lines: ['Une lettre d\'un petit garçon pour son père marin ? Je ne vais pas loin, mais je connais des gens qui vont plus loin que moi. Laissez-la-moi, archer : elle ne sera pas perdue.'] }],
      offer: ['J\'ai écrit à papa ! Il est marin, il navigue vers la Mer Orientale. Un jour tu iras jusqu\'au fleuve, n\'est-ce pas ? Le passeur Gu connaît tout le monde. Donne-lui ma lettre, s\'il te plaît.'],
      hint: ['Le passeur Gu t\'attend au fleuve, après le premier soleil. Petit Bao compte sur toi pour la lettre.'],
      complete: ['Gu glisse la lettre dans sa manche en hochant la tête : « Elle voyagera, ne vous inquiétez pas. »'],
      reward: { gold: 35, fragment: 'Encre de voyage', xp: 25 } }
  ]
};

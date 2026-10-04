// Textes — Forêt de Bambous Calcinée (Village des Cent Tiges, sentier cendré).
export default {
  screens: {
    bambous_village: { name: 'Village des Cent Tiges', arrival: [
      'Le village des Cent Tiges n\'en compte plus que dix-neuf debout. Les autres sont devenues des flûtes, des balais et des souvenirs.',
      'Quelqu\'un, quelque part, essaie encore de jouer un air.'] },
    bambous_wild: { name: 'Sentier des Tiges Cendrées', gateMessage: 'Les sceaux du moine Zhen ne tiennent plus : le gardien des cendres barre le sentier du temple.', arrival: [
      'La forêt brûlée respire à peine. Des sceaux de papier pendent aux tiges : le moine Zhen a tenté de contenir quelque chose.'] },
    bambous_h_zhen: { name: 'Cellule du moine Zhen', arrival: ['Une natte, un gong fêlé, des sceaux de papier prêts à servir. La sobriété pousse ici comme le bambou.'] },
    bambous_h_xu: { name: 'Officine de Xu', arrival: ['Des centaines de bocaux d\'herbes, étiquetés d\'une écriture minuscule. La forêt entière semble s\'y être rangée.'] },
    bambous_h_the: { name: 'Maison de thé de Dame Lan', arrival: ['Le thé fume, les voix se font basses. Il y a un panda qui lit dans un coin, et personne n\'y trouve rien à redire.'] },
    bambous_h_papier: { name: 'Atelier de papier', arrival: ['Des feuilles de papier de bambou sèchent sur des cordes comme du linge de fantômes bien élevés.'] },
    bambous_h_flute: { name: 'Maison du flûtiste', arrival: ['Des flûtes de toutes les tailles pendent aux poutres. Aucune ne joue juste, mais toutes essaient.'] }
  },
  npcs: {
    lady_lan: { name: 'Dame Lan', title: 'Tenancière de la maison de thé', 
      idle: ['Un thé ? Il est brûlé, mais il l\'était déjà avant le feu, alors on s\'y habitue.', 'Les clients parlent beaucoup, ici. Un disciple jaloux, un archer vertueux, un élixir tentant… Je ne retiens rien, je ressers.'],
      talk: [{ whenDone: 'sun_3', lines: ['Le troisième soleil est tombé. Les clients disent que l\'air sent moins la cendre. Pour moi, il sent toujours le thé, c\'est déjà ça.'] }] },
    panda_mimi: { name: 'Mimi', title: 'Jeune panda lettré', 
      idle: ['Chut, je lis. C\'est un poème sur le bambou. Il dit « grandis, grandis ». Moi, je mange et je grandis.', 'On dit que les pandas portent chance. Je préfère dire que nous portons du bambou, et que c\'est déjà beaucoup.'],
      talk: [{ whenDone: 'sun_3', lines: ['Le feu s\'éloigne. J\'ai trouvé une tige verte, la première depuis des semaines. Je ne l\'ai pas mangée. Je l\'ai regardée. C\'est mon plus grand sacrifice.'] }] },
    ke_paper: { name: 'Vieux Ke', title: 'Papetier', 
      idle: ['Je fais du papier avec ce que le feu a épargné. Les mots y tiennent mieux, ils ont connu l\'épreuve.', 'Un jeune homme m\'a commandé du papier sans ligne, pour y écrire un « testament ». Il a pris peur en me voyant le regarder.'],
      talk: [{ whenDone: 'sun_3', lines: ['La papeterie renaît. Les gens veulent à nouveau écrire : des vœux, des lettres, des pardons. Les gens écrivent plus volontiers quand le ciel s\'éclaircit.'] }] },
    apprentice_zhu: { name: 'Petite Zhu', title: 'Apprentie papetière', 
      idle: ['Je plie, je presse, je sèche. Maître Ke dit que le papier est de la patience qui a pris forme.', 'J\'ai fait un oiseau en papier. Il ne vole pas, mais il a l\'air content.'],
      talk: [{ whenDone: 'sun_3', lines: ['Mon oiseau en papier a volé jusqu\'au toit ! Il est tombé après, mais il a volé. C\'est ce qui compte.'] }] },
    flutist_chuan: { name: 'Chuan', title: 'Flûtiste en panne d\'air', 
      idle: ['Ma flûte siffle comme une bouilloire fêlée. Un artiste sans instrument, c\'est un oiseau sans ciel.', 'Avant l\'incendie, tout le village dansait quand je jouais. Maintenant, ils me tendent des mouchoirs.'],
      talk: [{ whenDone: 'sq_flute_2', lines: ['Entendez-vous ? C\'est un air de pluie. Je l\'ai composé pour vous, archer. Le premier qui ne soit pas triste.'] }] },
    huli_xia: { name: 'Xia', title: 'Renarde huli jing curieuse', 
      idle: ['Je suis une renarde à neuf queues… presque. J\'en ai sept, je rattrape mon retard. Ne le dites à personne.', 'Les rumeurs ont du goût, comme les fruits. Celle de Fengmeng est un peu amère : il parle de l\'élixir à voix basse, en dormant.'],
      talk: [{ whenDone: 'sun_3', lines: ['Ah, l\'archer ! J\'ai senti le parfum de la victoire sur vos vêtements. Cendres, suie, et un soupçon de triomphe. Mon préféré.'] }] },
    lantern_old: { name: 'Vieux Lanternier', title: 'Esprit des sentiers', 
      idle: ['Je suis une lanterne qui a perdu sa mèche mais pas son sens de l\'orientation. Avancez, je vous guide… par principe.', 'Les gardiens des cendres sont des esprits en colère. Ne leur en voulez pas : ils ont perdu leur forêt.'],
      talk: [{ whenDone: 'bambous_seal_keeper', lines: ['Le gardien est calmé. Le sentier est libre, et ma flamme a repris un peu de couleur. Je dirais même que je rougis.'] }] }
  },
  chests: {
    zhen_alms_box: { label: 'Tronc des offrandes', openText: 'Le tronc contient quelques pièces de pèlerins, et un petit mot : « Pour le prochain feu ».' },
    xu_herb_chest: { label: 'Coffre aux simples rares', openText: 'Des herbes séchées rares, et surtout une bourse bien cachée sous les feuilles de ginseng.' },
    paper_roll_box: { label: 'Caisse de papier précieux', openText: 'Des feuilles fines comme l\'aile d\'une libellule, et quelques pièces que Ke avait mises « dans le papier ».' },
    ash_cache: { label: 'Cache sous la cendre', openText: 'Sous une couche de cendre tiède, une cassette de pèlerin avec quelques pièces noircies.' },
    hollow_stem: { label: 'Tige creuse scellée', openText: 'Dans la tige, une tige-flûte intacte et quelques pièces : quelqu\'un a voulu les sauver du feu.' },
    monk_hoard: { label: 'Réserve oubliée du temple', openText: 'La réserve des moines, scellée avant l\'incendie. Quelques pièces d\'argent, et un parfum d\'encens figé.' }
  },
  quests: [
    { id: 'sq_flute_1', title: 'La flûte fêlée', chapter: '✦ Quête secondaire — Forêt de Bambous Calcinée', giver: 'flutist_chuan', turnIn: 'flutist_chuan', requires: [], side: true,
      objectives: [{ type: 'chest', target: 'hollow_stem', text: 'Trouver une tige creuse intacte, scellée sur le sentier des Tiges Cendrées' }],
      offer: ['Seigneur archer, ma flûte s\'est fendue dans l\'incendie. Je connais une tige creuse, scellée par les moines avant le feu, quelque part sur le sentier cendré.', 'Rapportez-la-moi, et je jouerai pour vous un air qui n\'a pas de nom.'],
      hint: ['La tige creuse est cachée sur le sentier des Tiges Cendrées, derrière le village. Cherchez une tige scellée de papier.'],
      complete: ['La voilà ! Intacte, claire, sonore. Je vais la tailler cette nuit. Tenez, un peu de ma chance : c\'est un fragment de bambou qui a survécu.'],
      reward: { gold: 70, fragment: 'Bambou survivant', xp: 80 } },
    { id: 'sq_flute_2', title: 'Le chant du bambou', chapter: '✦ Quête secondaire — Forêt de Bambous Calcinée', giver: 'flutist_chuan', turnIn: 'flutist_chuan', requires: ['sq_flute_1'], side: true,
      objectives: [{ type: 'killGroup', target: 'ember_lingzhi', text: 'Chasser les lingzhi des braises qui étouffent le souffle du sentier (Sentier des Tiges Cendrées)' }],
      offer: ['La flûte est réparée, mais elle ne joue toujours pas : des lingzhi des braises respirent l\'air du sentier et le rendent lourd. Je n\'ai pas de souffle à leur opposer, moi.', 'Chassez-les, archer, et le bambou chantera à nouveau.'],
      hint: ['Les lingzhi des braises sont deux, sur le sentier des Tiges Cendrées. Ils sont rouges, ronds, et ils sentent le champignon rôti.'],
      complete: ['Écoutez ! Le sentier respire, la flûte chante ! Je joue pour vous, une fois, rien que pour vous. Ensuite, je reviens aux enterrements. Non, je plaisante, c\'est pour la pluie.'],
      reward: { gold: 80, fragment: 'Souffle de bambou', xp: 100 } },
    { id: 'sq_sentier_sceaux', title: 'Les sceaux du sentier', chapter: '✦ Quête secondaire — Forêt de Bambous Calcinée', giver: 'monk_zhen', turnIn: 'monk_zhen', requires: [], side: true,
      objectives: [{ type: 'kill', target: 'bambous_seal_keeper', text: 'Maîtriser le gardien des cendres qui barre le sentier du temple (Sentier des Tiges Cendrées)' }],
      offer: ['Seigneur archer, j\'ai posé des sceaux de papier sur le sentier pour retenir un esprit en colère. Mais le gardien des cendres s\'est réveillé, et plus rien ne tient.', 'Abattez-le sans insulter les bambous, je vous prie. Ils ont déjà assez souffert.'],
      hint: ['Le gardien des cendres se dresse au bout du sentier des Tiges Cendrées. Il garde la route du sanctuaire.'],
      complete: ['Les sceaux tiennent à nouveau. Le sentier est libre, le temple pourra être rebâti. Acceptez ce fragment de sceau : c\'est un papier qui retient plus que les mots.'],
      reward: { gold: 90, fragment: 'Sceau de papier', xp: 120 } }
  ]
};

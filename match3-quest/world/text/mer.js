// Textes — Rivage de la Mer Orientale (Port aux Perles de Haiyan, falaises et criques).
export default {
  screens: {
    mer_village: { name: 'Port aux Perles de Haiyan', arrival: [
      'Haiyan sent le sel, la corde mouillée et la poésie tragique. Les barques se balancent doucement, contre toute logique, sur une mer que le soleil a fait reculer.',
      'On y raconte que le Roi-Dragon écoute aux portes.'] },
    mer_wild: { name: 'Falaises et Criques du Dragon', gateMessage: 'La grotte du sanctuaire est fermée par une porte de corail. Sa clé de marée dort dans un coffre, au fond d\'une crique.', arrival: [
      'Les falaises dominent une mer qui a perdu sa patience. Dans l\'écume, des écailles brillent : le Roi-Dragon n\'est jamais très loin.'] },
    mer_h_hai: { name: 'Cabane du pêcheur Hai', arrival: ['Des filets réparés mille fois pendent aux poutres, et un portrait de sa barque, plus ressemblant que sa photographie… qui n\'existe pas.'] },
    mer_h_longwang: { name: 'Pavillon de l\'envoyé', arrival: ['Un pavillon laqué de bleu : l\'envoyé du Roi-Dragon y reçoit avec une courtoisie humide.'] },
    mer_h_perles: { name: 'Atelier des perles', arrival: ['Des perles de toutes tailles, triées dans des coupelles de nacre. Elles brillent comme des lunes minuscules.'] },
    mer_h_marin: { name: 'Maison du marin Bao', arrival: ['Un hamac, une carte marine et, au mur, un dessin d\'enfant : un petit garçon, un cerf-volant, une mer trop grande.'] },
    mer_h_phare: { name: 'Phare de Haiyan', arrival: ['Un phare tout de blanc, où veille une gardienne taciturne. De là-haut, la mer ressemble à une promesse.'] }
  },
  npcs: {
    pearl_diver_xi: { name: 'Xi', title: 'Plongeuse de perles', emoji: '🤿',
      idle: ['Je plonge sans masque ni cordon, avec un seul souffle et beaucoup d\'obstination. Les perles me connaissent.', 'Les perles les plus belles sont les plus tristes. Chaque larme de sirène en fait une.'],
      talk: [{ whenDone: 'sun_8', lines: ['Le huitième soleil est tombé. Les marées retrouvent leur rythme, et mes perles sont plus claires. Comme si la mer respirait enfin.'] }] },
    sailor_bao: { name: 'Bao', title: 'Marin, père de Petit Bao', emoji: '⚓',
      idle: ['Je suis marin. Mon cœur est resté à terre, dans un petit hameau de rizières. Je ne m\'en plains pas : on a toujours une moitié qui navigue.', 'La mer est large, mais l\'amour de mon fils est plus long encore. J\'aimerais qu\'il le sache.'],
      talk: [{ whenDone: 'sq_marin_reponse', lines: ['Mon petit a ma réponse ? Merci, archer. Vous êtes plus fiable que ma boussole.'] }, { whenDone: 'sun_8', lines: ['Le huitième soleil est tombé. Je pourrai bientôt rentrer à Dongqiao. Dites-le à Petit Bao.'] }] },
    lighthouse_ming: { name: 'Ming', title: 'Gardienne du phare', emoji: '🔦',
      idle: ['J\'allume le phare chaque soir. Personne ne me remercie, mais personne ne se perd. C\'est mon salaire.', 'Dans la nuit, j\'ai vu quelqu\'un passer sur la falaise, un archer sans nom. Il murmurait « l\'élixir, l\'élixir » comme une prière.'],
      talk: [{ whenDone: 'sun_8', lines: ['La mer est calme. Mon phare brille. Il ne reste que moi et la nuit, et je ne m\'en plains pas.'] }] },
    hua_mer: { name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒',
      idle: ['J\'ai fini par arriver jusqu\'à la mer ! Mes pieds ont des ampoules, mon sac des coquillages, ma bourse… un peu moins.', 'La mer est le seul client qui ne marchande pas. Il prend tout, ou rien.'],
      talk: [{ whenDone: 'sq_lettre_bao_3', lines: ['La lettre est arrivée ? Quel bonheur ! Les lettres sont comme les coquillages : elles chantent quand on les écoute.'] }, { whenDone: 'sun_8', lines: ['Huit soleils ! Je vais continuer vers l\'arbre. Quelqu\'un doit bien vendre des lanternes à la cime.'] }] },
    crab_old_gong: { name: 'Vieux Gong', title: 'Crabe sentencieux', emoji: '🦀',
      idle: ['Je marche de côté, mais je pense droit. Telle est la sagesse des crabes.', 'La marée monte, la marée descend. Moi, je reste. Je suis une pierre qui a des pinces.'],
      talk: [{ whenDone: 'sun_8', lines: ['Le soleil des marées a cessé de jouer avec l\'eau. Je remarque la différence, et mon voisin la bernique aussi.'] }] },
    mermaid_jiaoren: { name: 'Jiaoren', title: 'Sirène aux larmes de perle', emoji: '🧜',
      idle: ['Mes larmes deviennent des perles. C\'est joli, mais je préférerais qu\'elles redeviennent de l\'eau.', 'J\'ai entendu dire que la Reine Mère a offert un élixir à une mortelle. Les marées en parlent. Elles ne comprennent pas pourquoi un jaloux en ferait son but.'],
      talk: [{ whenDone: 'sq_larmes_perle', lines: ['Mes larmes ont trouvé preneur. Merci, archer. La mer est moins lourde, et mon cœur aussi.'] }] },
    girl_net_mi: { name: 'Mi', title: 'Fillette réparatrice de filets', emoji: '👧',
      idle: ['Je répare les filets que les serpents coupent. Mes doigts sont plus rapides que leurs dents.', 'Un jour, je navigue. Je serai capitaine, ou poissonnière. Ça dépendra du vent.'],
      talk: [{ whenDone: 'sun_8', lines: ['Plus de filets coupés cette semaine ! Les serpents sont partis voir ailleurs si l\'herbe était plus verte. Enfin, l\'algue.'] }] }
  },
  chests: {
    hai_net_box: { label: 'Caisse à hameçons', openText: '🎁 Parmi les hameçons et les plombs, une bourse de pêcheur. « Pour la saison maigre », dit une étiquette.', emoji: '🎣', emojiOpened: '🎣' },
    envoy_coffer: { label: 'Coffret laqué de l\'envoyé', openText: '🎁 Un coffret laqué de bleu. À l\'intérieur, des perles de cérémonie que Longwang prétend avoir « oubliées là ».', emoji: '📦', emojiOpened: '📭' },
    pearl_tray: { label: 'Plateau de perles', openText: '🎁 Un plateau de nacre, plein de perles trop petites pour les colliers. Elles ont néanmoins leur valeur.', emoji: '🦪', emojiOpened: '🦪' },
    cove_cache: { label: 'Cache dans la crique', openText: '🎁 Dans une anfractuosité de la crique, une cache de contrebandier : un peu d\'or et un mot illisible.', emoji: '🪨', emojiOpened: '🪨' },
    tide_key_chest: { label: 'Coffre-clé de marée', openText: '🔑 La clé de marée, en corail poli, repose sur un lit d\'algues. La porte de corail devrait s\'ouvrir !', emoji: '🗝️', emojiOpened: '🗝️' },
    tear_pearl_chest: { label: 'Coffre aux larmes de perle', openText: '🎁 Les larmes de Jiaoren, devenues perles, brillent doucement dans leur coffre. Elles pèsent peu, mais valent beaucoup.', emoji: '🦪', emojiOpened: '🦪' },
    dragon_grotto: { label: 'Coffre de la grotte du dragon', openText: '🎁 La grotte du dragon garde un trésor ancien : or, jade et un parfum de mer lointaine.', emoji: '🐲', emojiOpened: '🐲' }
  },
  quests: [
    { id: 'sq_larmes_perle', title: 'Les larmes de Jiaoren', chapter: '✦ Quête secondaire — Rivage de la Mer Orientale', giver: 'pearl_diver_xi', turnIn: 'pearl_diver_xi', requires: [], side: true,
      objectives: [
        { type: 'talk', target: 'mermaid_jiaoren', text: 'Écouter la sirène Jiaoren (falaises et criques du Dragon)', lines: ['Mes larmes deviennent des perles, et je n\'ai nulle part où les garder. Je les ai mises dans un coffre, dans une crique. Prenez-les, pour les rendre utiles.'] },
        { type: 'chest', target: 'tear_pearl_chest', text: 'Rapporter le coffre aux larmes de perle (criques du Dragon)' }],
      offer: ['Archer, une sirène pleure dans les criques du Dragon. Ses larmes deviennent des perles, et elle ne sait plus où les mettre.', 'Écoutez-la, puis rapportez-moi son coffre. Les perles de larmes sont les plus rares, et elle mérite qu\'on en prenne soin.'],
      hint: ['La sirène Jiaoren se tient dans les criques du Dragon. Son coffre est tout près.'],
      complete: ['Ses larmes sont magnifiques ! Je les garderai précieusement, et je lui apporterai du thé. Tenez, une perle de brume pour vos flèches de mer.'],
      reward: { gold: 175, fragment: 'Perle de brume', xp: 320 } },
    { id: 'sq_dame_algues', title: 'La Dame des algues', chapter: '✦ Quête secondaire — Rivage de la Mer Orientale', giver: 'lighthouse_ming', turnIn: 'lighthouse_ming', requires: [], side: true,
      objectives: [{ type: 'kill', target: 'mer_kelp_witch', text: 'Faire reculer la Dame des algues givrées (falaises et criques du Dragon)' }],
      offer: ['Mon phare s\'éteint chaque fois qu\'une Dame des algues givrées passe sur la crique. Elle ne le fait pas exprès : elle a froid, et elle cherche de la chaleur.', 'Faites-la reculer, archer, sans lui faire de mal si possible.'],
      hint: ['La Dame des algues givrées rôde dans les criques du Dragon, sous les falaises.'],
      complete: ['Mon phare brille à nouveau, et elle est partie, soulagée. Prenez ce givre d\'algue : il garde la fraîcheur, même dans le feu.'],
      reward: { gold: 180, fragment: 'Givre d\'algue', xp: 340 } },
    { id: 'sq_marin_reponse', title: 'La réponse du marin', chapter: '✦ Quête secondaire — Rivage de la Mer Orientale', giver: 'sailor_bao', turnIn: 'xiaobao', requires: ['sq_lettre_bao_3'], side: true,
      objectives: [{ type: 'talk', target: 'xiaobao', text: 'Rapporter la réponse du marin Bao à son fils (Hameau de Dongqiao, Rizières)', lines: ['Une lettre de papa ! Et un galet ! Il dit qu\'il rentrera bientôt ! Merci, archer, merci !'] }],
      offer: ['Votre lettre est arrivée, et je pleure dans ma barbe. Voilà ma réponse, écrite à la hâte et à l\'encre salée. Portez-la à Dongqiao, à mon fils.', 'Ajoutez ce galet poli par la mer : il lui portera chance.'],
      hint: ['Petit Bao vit au Hameau de Dongqiao, dans les rizières, tout au début de votre voyage.'],
      complete: ['Petit Bao serre la lettre contre son cœur : « Il rentrera ! Il me l\'a dit ! » Il vous tend son cerf-volant : « Pour ton carquois, archer. »'],
      reward: { gold: 190, fragment: 'Galet du marin', xp: 360 } }
  ]
};

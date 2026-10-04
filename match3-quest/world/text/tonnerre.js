// Textes — Monts du Tonnerre (Village des Forges-Éclairs, crêtes foudroyées).
export default {
  screens: {
    tonnerre_village: { name: 'Village des Forges-Éclairs', arrival: [
      'Aux Forges-Éclairs, on ne dit pas « il pleut » mais « le ciel fait ses comptes ». Le fer chante sur les toits.',
      'Les gamins courent entre les tiges de cuivre en parlant tout bas, au cas où le tonnerre écouterait.'] },
    tonnerre_wild: { name: 'Crêtes Foudroyées', gateMessage: 'Le portail de pierre ne s\'ouvrira qu\'au son du Gong d\'orage, enfermé dans un coffre quelque part sur les crêtes.', arrival: [
      'Les crêtes brillent d\'un éclat vitreux là où la foudre a frappé. Des cairns de pierre portent des offrandes et des avertissements, à peu près à parts égales.'] },
    tonnerre_h_tie: { name: 'Forge de Tie', arrival: ['Un brasier rugissant, des marteaux de toutes tailles, un seau d\'eau qui n\'ose plus bouillir.'] },
    tonnerre_h_lei: { name: 'Grotte-cabane de Lei', arrival: ['Une cabane adossée à une grotte où résonne le moindre murmure du ciel. On y parle bas, au cas où le ciel répondrait.'] },
    tonnerre_h_tour: { name: 'Tour des paratonnerres', arrival: ['Une tour de cuivre vert-de-grisé. Chaque étage porte une tige, et chaque tige une histoire de foudre.'] },
    tonnerre_h_auberge: { name: 'Auberge du Coup-de-Tonnerre', arrival: ['Une auberge bruyante, où la soupe est réputée « fulgurante » et le singe de la maison « pas fiable ».'] },
    tonnerre_h_montagne: { name: 'Chapelle du Dieu des monts', arrival: ['Une petite chapelle fraîche, où l\'on dépose de la monnaie contre une bonne météo. Le dieu a parfois d\'autres projets.'] }
  },
  npcs: {
    rodman_gang: { name: 'Gang', title: 'Gardien des paratonnerres', 
      idle: ['J\'ai été foudroyé sept fois. La septième, j\'ai compris que les tiges de cuivre sont plus sages que moi.', 'Mon travail : empêcher la foudre de frapper le village. Mon problème : elle préfère mon chapeau.'],
      talk: [{ whenDone: 'sun_5', lines: ['Le cinquième soleil, abattu. Les tiges de cuivre ne grésillent plus. Je ne sais pas si je dois me réjouir ou m\'inquiéter pour mon emploi.'] }] },
    innkeeper_pao: { name: 'Pao', title: 'Aubergiste', 
      idle: ['Ma soupe est fulgurante ! Elle vous réveille d\'un seul coup, comme la foudre. Parfois pour de bon.', 'Les voyageurs parlent beaucoup. Hier, un jeune archer pestait contre « ce vieux maître qui ne voit rien ». J\'ai servi une double portion, par compassion.'],
      talk: [{ whenDone: 'sun_5', lines: ['Le cinquième soleil est tombé ! La soupe est offerte, la louche d\'argent… eh bien, tant qu\'elle revient, je ne compte pas.'] }] },
    monkey_sun: { name: 'Houzi', title: 'Singe filou de l\'auberge', 
      idle: ['Ouistiti ! Je n\'ai rien pris. J\'ai emprunté. L\'emprunt est un vol bien élevé.', 'La louche ? Quelle louche ? Ah, la brillante ! Je l\'ai prêtée au Vieux Cairn. Il avait faim de soupe.'],
      talk: [{ whenDone: 'sq_singe_soupe', lines: ['Tu as retrouvé la louche ? Bravo ! Je savais que tu étais un bon voleur… archer, je veux dire. Archer.'] }] },
    nun_ying: { name: 'Sœur Ying', title: 'Gardienne de la chapelle', 
      idle: ['Je prie le Dieu des monts pour qu\'il garde l\'orage loin de nous. Il me répond toujours « on verra ».', 'Un jeune archer est passé, il y a quelques jours. Il a laissé une pièce et un vœu qu\'il n\'a pas osé dire à voix haute. Les dieux ont une mémoire sélective.'],
      talk: [{ whenDone: 'sun_5', lines: ['La chapelle est calme. J\'ai déposé une offrande pour vous, archer. Pas de monnaie : un vœu. Il vaut plus, il pèse moins.'] }] },
    kids_leimei: { name: 'Leimei', title: 'Petite chasseuse d\'étincelles', 
      idle: ['Je chasse les étincelles ! Je les mets dans des pots, mais elles s\'échappent. Elles ont des jambes, c\'est sûr.', 'Papa dit qu\'il faut avoir peur du tonnerre. Moi je lui dis bonjour tous les matins. Il ne répond pas, mais il tonne poliment.'],
      talk: [{ whenDone: 'sun_5', lines: ['Le ciel est plus doux ! Les étincelles dansent au lieu de mordre. Je crois que le tonnerre rit un peu.'] }] },
    hua_tonnerre: { name: 'Hua', title: 'Colporteuse aux mille babioles', 
      idle: ['Les monts, c\'est dur pour les mollets mais bon pour les affaires : on achète tout, ici, pourvu que ça ne brûle pas.', 'J\'ai croisé votre disciple, à un col. Il m\'a acheté une corde, et un miroir. Un miroir ! Un archer qui s\'interroge sur son reflet, c\'est inquiétant.'],
      talk: [{ whenDone: 'sun_5', lines: ['Je repars pour les gorges du volcan. Si vous croisez quelqu\'un qui vend des gants ignifugés, c\'est mon cousin. Il est très prudent.'] }] },
    cairn_spirit: { name: 'Vieux Cairn', title: 'Esprit des pierres empilées', 
      idle: ['Je suis une pile de cailloux. Chaque voyageur en pose un. Je suis la mémoire de ceux qui sont passés.', 'Une louche d\'argent ? Il m\'est arrivé d\'en garder une. Il y a beaucoup de choses sous mes pierres. Je ne les compte pas, je les garde.'],
      talk: [{ whenDone: 'sq_etincelles', lines: ['Le pot qui tenait est parti danser chez la petite Leimei, archer. Ma cache est plus légère, et moi aussi.'] }] }
  },
  chests: {
    tie_anvil_box: { label: 'Boîte sous l\'enclume', openText: 'Sous l\'enclume, Tie cachait sa paie des dix dernières années. Il est sentimental, pas économe.' },
    copper_chest: { label: 'Coffre de cuivre', openText: 'Un coffre vert-de-gris, plein de pièces de cuivre et d\'une odeur d\'orage.' },
    offering_box: { label: 'Tronc de la chapelle', openText: 'Les offrandes de la chapelle : de petites pièces et un mot : « Pour la bonne météo. »' },
    crest_cache: { label: 'Cache d\'un cairn', openText: 'Sous les pierres du cairn, un pot en verre qui retient les étincelles, et quelques pièces de voyageurs reconnaissants.' },
    storm_gong_chest: { label: 'Coffre du Gong d\'orage', openText: 'Le Gong d\'orage résonne comme un coup de tonnerre apprivoisé. Le portail de pierre devrait s\'ouvrir !' },
    lightning_vault: { label: 'Caveau foudroyé', openText: 'Un caveau vitrifié par la foudre. Il contient un butin étincelant, au sens propre.' }
  },
  quests: [
    { id: 'sq_etincelles', title: 'Les étincelles de Leimei', chapter: '✦ Quête secondaire — Monts du Tonnerre', giver: 'kids_leimei', turnIn: 'kids_leimei', requires: [], side: true,
      objectives: [
        { type: 'talk', target: 'cairn_spirit', text: 'Parler au Vieux Cairn (crêtes foudroyées, au-delà du village)', lines: ['Un pot qui tient les étincelles ? Il est dans ma cache, sous la pierre la plus plate. Prends-le, mais promets d\'apprendre à ses étincelles à danser.'] },
        { type: 'chest', target: 'crest_cache', text: 'Ouvrir la cache du cairn sur les crêtes foudroyées' }],
      offer: ['Archer ! Mes pots à étincelles ne tiennent pas : les étincelles s\'échappent toujours. Le Vieux Cairn, là-haut, a un pot qui tient, paraît-il.', 'Peux-tu aller lui demander ? Moi je n\'ose pas : il a une voix de cailloux qui s\'entrechoquent.'],
      hint: ['Le Vieux Cairn est sur les crêtes foudroyées, derrière le village. Parlez-lui, puis ouvrez sa cache.'],
      complete: ['Le pot ! Il brille ! Les étincelles dedans dansent en rond. Je vais l\'appeler Éclair. Merci, archer. Prends ça : une étincelle que j\'ai gardée pour toi.'],
      reward: { gold: 120, fragment: 'Étincelle en pot', xp: 200 } },
    { id: 'sq_paratonnerre', title: 'Le paratonnerre de la crête', chapter: '✦ Quête secondaire — Monts du Tonnerre', giver: 'rodman_gang', turnIn: 'rodman_gang', requires: [], side: true,
      objectives: [
        { type: 'kill', target: 'tonnerre_crest_general', text: 'Déloger le général qui s\'est perché sur le paratonnerre (crêtes foudroyées)' },
        { type: 'visit', target: 'tonnerre_wild', text: 'Aller vérifier la tige de la crête (crêtes foudroyées)' }],
      offer: ['La grande tige de cuivre de la crête ne fonctionne plus depuis qu\'un général du tonnerre s\'y est perché. La foudre le prend pour son quartier général.', 'Délogez-le, puis allez voir si la tige tient encore. Elle protège tout le village.'],
      hint: ['Le général du tonnerre se tient sur les crêtes foudroyées. Une fois battu, allez vérifier la tige.'],
      complete: ['La tige est droite, le cuivre luit ! Le village est à l\'abri. Je vous dois bien ce fragment de cuivre foudroyé : il attire les bonnes surprises.'],
      reward: { gold: 130, fragment: 'Cuivre foudroyé', xp: 220 } },
    { id: 'sq_singe_soupe', title: 'Le singe et la soupe', chapter: '✦ Quête secondaire — Monts du Tonnerre', giver: 'innkeeper_pao', turnIn: 'innkeeper_pao', requires: [], side: true,
      objectives: [
        { type: 'talk', target: 'monkey_sun', text: 'Interroger Houzi le singe (auberge du Coup-de-Tonnerre)', lines: ['Ouistiti ! La louche ? Oui, je l\'ai « prêtée » au Vieux Cairn. Il avait l\'air d\'avoir faim. Va la lui demander, moi je suis occupé à ne rien faire.'] },
        { type: 'talk', target: 'cairn_spirit', text: 'Récupérer la louche auprès du Vieux Cairn (crêtes foudroyées)', lines: ['La louche ? Elle est ici, sous mon plus gros caillou. Je la rends volontiers : elle m\'a rendu service pour remuer les étoiles.'] }],
      offer: ['Ma louche d\'argent a disparu ! Cette louche remue ma soupe depuis quatre générations.', 'Je soupçonne Houzi, le singe. Allez le voir, il a la mauvaise manie de tout prêter à tout le monde.'],
      hint: ['Houzi est à l\'auberge. Selon lui, la louche serait chez le Vieux Cairn, sur les crêtes foudroyées.'],
      complete: ['Ma louche ! Elle est un peu cabossée, mais elle remue encore. Prenez cette amulette de soupe : elle porte chance aux affamés.'],
      reward: { gold: 140, fragment: 'Amulette de soupe', xp: 240 } }
  ]
};

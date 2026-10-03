// Textes — Pic de la Lune (Hameau sous la Lune, sentier d'argent). Région finale, allégée.
export default {
  screens: {
    lune_village: { name: 'Hameau sous la Lune', arrival: [
      'Le hameau sous la Lune ne compte que quelques maisons pâles et beaucoup de silence. La lune est si grande qu\'on pourrait lui parler à voix basse.',
      'Quelque part là-haut, quelqu\'un vous attend.'] },
    lune_wild: { name: 'Sentier d\'Argent', gateMessage: 'La porte du Pic est scellée par une serrure de lumière. Sa clé repose dans un reliquaire, quelque part sur le sentier.', arrival: [
      'Le sentier monte, d\'argent et de nuit. À chaque pas, la lune semble écouter.'] },
    lune_h_veilleuse: { name: 'Maison de la veilleuse', arrival: ['Une petite maison tiède, éclairée de mille lanternes. Elle sent la cire et la patience.'] },
    lune_h_lievres: { name: 'Terrier des lièvres de jade', arrival: ['Un terrier tapissé de mousse blanche, où des mortiers de jade pilent un élixir imaginaire. Ils font semblant, mais avec talent.'] },
    lune_h_tisseuse: { name: 'Chaumière de la tisseuse d\'argent', arrival: ['Un rouet file la lumière de lune en fils fins. La pièce est silencieuse, à l\'exception d\'un soupir de laine.'] }
  },
  npcs: {
    keeper_lunar: { name: 'Veilleuse Yin', title: 'Gardienne des lanternes', emoji: '🏮',
      idle: ['J\'allume les lanternes du hameau, une à une. Chacune éclaire un souvenir de quelqu\'un qui est monté là-haut.', 'Chang\'e est arrivée il y a peu. Elle a demandé une lanterne, pour guider quelqu\'un. Je crois que c\'était pour vous.'],
      talk: [{ whenDone: 'sq_lanterne_hua', lines: ['La lanterne de Hua brille. C\'est la plus petite, mais elle éclaire le plus loin. Montez, archer : elle vous suivra.'] }] },
    hua_lune: { name: 'Hua', title: 'Colporteuse aux mille babioles', emoji: '🎒',
      idle: ['Eh oui, me voilà ! Je suis venue à pied, à dos de grue, à dos de nuage. Pas de moyen sans mon sac.', 'J\'ai tout vendu, sauf une lanterne. Elle n\'est pas à vendre : elle est pour la veilleuse. Et un peu pour vous.'],
      talk: [{ whenDone: 'sq_lanterne_hua', lines: ['Vous l\'avez portée jusqu\'à Yin ? Merci. Je me remets en route : le monde a besoin d\'une colporteuse, même quand il se tait.'] }] },
    jade_hare: { name: 'Lièvre de jade', title: 'Pileur d\'élixir', emoji: '🐇',
      idle: ['Je pile, je pile, je pile. L\'élixir de la Reine Mère s\'est tu depuis longtemps, mais les mortiers ne le savent pas.', 'Dame Chang\'e est montée au pic avec sa fiole. Elle la serre comme on serre un enfant. Quelqu\'un la suit, dit-on, et ce quelqu\'un ne vient pas pour prier.'],
      talk: [{ whenDone: 'fengmeng_3a', lines: ['L\'Archer Miroir est à terre, mais Fengmeng ne l\'est pas : ce qu\'il a perdu va le rendre plus dangereux. Ayez le cœur léger, archer : la colère coupe plus qu\'elle n\'éclaire.'] }] },
    spinner_yue: { name: 'Yue', title: 'Tisseuse d\'argent', emoji: '🧶',
      idle: ['Je file la lumière de lune. Elle est fine, froide, et pardonne tout.', 'J\'ai tissé un voile pour Chang\'e. Il est trop beau pour qu\'on l\'use. Elle l\'a mis quand même.'],
      talk: [{ whenDone: 'fengmeng_3a', lines: ['Un fil s\'est rompu dans mon rouet à l\'instant. C\'est signe qu\'un combat se déroule. Mais je ne sais pas qui le gagne.'] }] },
    moon_child: { name: 'Enfant de la Lune', title: 'Petit veilleur', emoji: '🧒',
      idle: ['Je vis ici depuis toujours. Je n\'ai jamais vu le soleil. On dit que c\'est chaud et que ça brûle.', 'La nuit est longue ici, mais elle est belle. On y entend des histoires que le jour ne raconte pas.'],
      talk: [{ whenDone: 'fengmeng_3a', lines: ['Vous avez vaincu le disciple à l\'arc ? Il n\'a pas fini de pleurer, alors. Ne le haïssez pas : il a trop faim d\'être aimé.'] }] },
    osmanthus_woodcutter: { name: 'Wu Gang', title: 'Bûcheron éternel de l\'osmanthus', emoji: '🪓',
      idle: ['Je coupe cet arbre depuis mille ans. Il repousse toujours. C\'est une punition, ou une leçon, je n\'ai jamais su.', 'Un jour, l\'arbre tombera. Ou moi. Je parie sur l\'arbre : il est plus têtu.'],
      talk: [{ whenDone: 'sq_osmanthus', lines: ['L\'ombre est partie, ma cache est vide. Je vais pouvoir couper en paix. L\'arbre repoussera, mais cette fois, j\'aurai le sourire.'] }] }
  },
  chests: {
    veilleuse_chest: { label: 'Coffre de la veilleuse', openText: '🎁 Un coffre rempli de pièces d\'argent pâle : les offrandes de ceux qui montent vers la Lune.', emoji: '🪔', emojiOpened: '🪔' },
    moon_thread_box: { label: 'Boîte à fils d\'argent', openText: '🎁 Des bobines de fil d\'argent et, tout au fond, quelques pièces de lumière froide.', emoji: '🧵', emojiOpened: '🧵' },
    frost_cache: { label: 'Cache sous le givre', openText: '🎁 Sous le givre bleuté, la dernière cache de bois de Wu Gang, et quelques pièces pâles par-dessus le marché.', emoji: '❄️', emojiOpened: '❄️' },
    moon_key_chest: { label: 'Reliquaire à clé de lumière', openText: '🔑 Une clé de lumière pure scintille dans le reliquaire. La porte du Pic devrait s\'ouvrir !', emoji: '🗝️', emojiOpened: '🗝️' },
    osmanthus_hoard: { label: 'Trésor de l\'osmanthus', openText: '🎁 Parmi les racines de l\'osmanthus, un trésor oublié depuis mille ans : de l\'argent lunaire et des fleurs séchées.', emoji: '🌕', emojiOpened: '🌕' }
  },
  quests: [
    { id: 'sq_osmanthus', title: 'L\'osmanthus qui repousse', chapter: '✦ Quête secondaire — Pic de la Lune', giver: 'osmanthus_woodcutter', turnIn: 'osmanthus_woodcutter', requires: [], side: true,
      objectives: [
        { type: 'chest', target: 'frost_cache', text: 'Vider la dernière cache de bois de Wu Gang (sentier d\'argent)' },
        { type: 'kill', target: 'lune_mirror_shade', text: 'Chasser l\'ombre du miroir qui rôde sur le sentier (sentier d\'argent)' }],
      offer: ['Je coupe l\'osmanthus depuis mille ans, et il repousse toujours. Aujourd\'hui, je voudrais juste vider ma dernière cache de bois et chasser l\'ombre qui rôde.', 'Aidez-moi, archer.'],
      hint: ['La cache de Wu Gang est sous le givre, sur le sentier d\'argent. L\'ombre du miroir rôde dans les parages.'],
      complete: ['Ma cache est vide, l\'ombre s\'est dissipée. Je coupe en paix. Prenez cette écorce d\'osmanthus : elle sent la nostalgie et la cannelle.'],
      reward: { gold: 200, fragment: 'Écorce d\'osmanthus', xp: 400 } },
    { id: 'sq_lanterne_hua', title: 'La dernière lanterne de Hua', chapter: '✦ Quête secondaire — Pic de la Lune', giver: 'hua_lune', turnIn: 'keeper_lunar', requires: [], side: true,
      objectives: [{ type: 'talk', target: 'keeper_lunar', text: 'Porter la lanterne de Hua à la veilleuse Yin (Hameau sous la Lune)', lines: ['Une lanterne de Hua ? La plus petite que j\'aie vue. La plus lumineuse aussi. Merci, archer.'] }],
      offer: ['J\'ai fait un long chemin pour livrer une dernière lanterne à la veilleuse Yin. Mes pieds n\'iront pas plus loin.', 'Portez-la-lui, voulez-vous ? Vous avez passé la mienne en chemin, quelque part, je crois.'],
      hint: ['La veilleuse Yin est dans sa maison, au cœur du Hameau sous la Lune.'],
      complete: ['Yin lève la lanterne, qui projette sa lumière sur les murs. Les ombres dansent. « C\'est exactement celle que j\'attendais », murmure-t-elle.'],
      reward: { gold: 200, fragment: 'Lanterne de Hua', xp: 400 } }
  ]
};

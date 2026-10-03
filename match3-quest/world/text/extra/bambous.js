// Textes additionnels — Forêt de Bambous Calcinée (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    bambous_hamlet: {
      name: "Clairière des Lampions",
      arrival: [
        "La Clairière des Lampions a gardé un coin de vert dans la forêt calcinée. Des lanternes de papier se balancent aux branches, sans qu'on sache qui les allume.",
        "Un sentier discret la rattache au sentier cendré, comme un secret entre amis."
      ]
    },
    bambous_h2_lanterne: {
      name: "Atelier du lanternier Fa",
      arrival: [
        "Le papier translucide filtre la lumière en rose et en or. On croirait entrer dans un lampion géant."
      ]
    },
    bambous_h2_sculpteur: {
      name: "Maison de la sculptrice Ling",
      arrival: [
        "Des centaines de petites figures de bambou vous regardent. Quelques-unes semblent vous juger."
      ]
    }
  },
  npcs: {
    lanternier_fa: {
      name: "Fa",
      title: "Lanternier",
      emoji: "🏮",
      idle: [
        "Une lanterne bien faite éclaire trois choses : le chemin, le visage, et le chagrin.",
        "Je fabrique des lampions pour la fête. Trois vols, cette année. Mon papier est trop beau."
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Les lampions brillent mieux sous un ciel dégagé. Je vais en faire cent de plus."
          ]
        }
      ]
    },
    carver_ling: {
      name: "Ling",
      title: "Sculptrice de bambou",
      emoji: "🪚",
      idle: [
        "Je sculpte ce que le feu a épargné. Un bambou noirci donne de belles figures sombres.",
        "Mon dernier modèle a bougé pendant la pose. C'était un panda. Je ne lui en veux pas."
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Le feu s'éloigne, les couleurs reviennent. Je vais tenter du vert pour changer."
          ]
        }
      ]
    },
    panda_baobao: {
      name: "Baobao",
      title: "Bébé panda",
      emoji: "🐼",
      idle: [
        "Hmm ? Hmm hmm ! (Il semble réclamer quelque chose de sucré.)",
        "Hmm hmm hmm. (Il vous montre un bambou, et le mange.)"
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Hmm ! Hmm hmm hmm ! (Il vous tend une feuille. C'est son plus beau cadeau.)"
          ]
        }
      ]
    },
    beekeeper_ju: {
      name: "Ju",
      title: "Apicultrice",
      emoji: "🐝",
      idle: [
        "Mes abeilles ont survécu au feu. Elles sont plus braves que moi, plus pressées aussi.",
        "Le miel de cendre est le meilleur. Il a le goût du courage."
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Ses abeilles bourdonnent un air plus gai. « Elles aiment la victoire », dit-elle."
          ]
        }
      ]
    },
    archer_huo: {
      name: "Huo",
      title: "Vieil archer retraité",
      emoji: "🏹",
      idle: [
        "J'ai tiré mille flèches. La plus belle ne m'a jamais quitté, c'était un compliment de ma mère.",
        "Un jeune archer m'a demandé ma meilleure technique. Je lui ai dit : « Vise avec le cœur. » Il a répondu : « Le mien est trop agité. »"
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Le troisième soleil est tombé. Mon vieux bras tremble, mais mon vieux cœur applaudit."
          ]
        }
      ]
    },
    young_monk_zhi: {
      name: "Zhi",
      title: "Jeune moine novice",
      emoji: "🧑‍🦲",
      idle: [
        "Le Maître dit : « Avant de balayer le monde, balaie la cour. » Je balaie la cour depuis trois ans.",
        "Je rêve de lire les sutras. Pour l'instant, je lis les étiquettes de l'herboriste."
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Maître Zhen a souri ce matin. Il a dit que le temple se relèverait. J'ai déposé mon balai pour l'embrasser."
          ]
        }
      ]
    },
    scholar_dong: {
      name: "Dong",
      title: "Lettré vagabond",
      emoji: "🎓",
      idle: [
        "Je cherche un lieu paisible pour écrire. Les cendres ne sont pas idéales, mais l'inspiration est tragique.",
        "Savez-vous pourquoi le bambou plie sans casser ? Moi non plus, mais j'ai écrit un poème dessus."
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Mon inspiration a changé de couleur. Elle est devenue verte. C'est un début."
          ]
        }
      ]
    },
    stem_sprite: {
      name: "Tigelle",
      title: "Esprit de tige",
      emoji: "🎋",
      idle: [
        "Je suis la dernière tige verte du sentier. Je suis entourée de fantômes, mais je tiens bon.",
        "Le feu m'a coupé les pieds, pas la parole."
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Mes racines frémissent. Quelque chose revient, comme une vieille chanson."
          ]
        }
      ]
    },
    snake_qing: {
      name: "Dame Qing",
      title: "Serpente blanche lettrée",
      emoji: "🐍",
      idle: [
        "Ne me craignez pas. Les serpents lisent, eux aussi. Même les poèmes tristes.",
        "Autrefois, j'ai aimé un mortel. Aujourd'hui, j'aime un parfum de pluie."
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Un soleil de moins. Je ressens la fraîcheur qui revient dans mes écailles. Merci, archer."
          ]
        }
      ]
    },
    cricket_boy_hao: {
      name: "Hao",
      title: "Petit éleveur de grillons",
      emoji: "🦗",
      idle: [
        "Mon grillon chante comme un rossignol ! Enfin, comme un grillon.",
        "Si tu en trouves un qui chante faux, apporte-le-moi. Je le mets à l'école."
      ],
      talk: [
        {
          whenDone: "sun_3",
          lines: [
            "Mon grillon chante la victoire ! Il n'a rien compris, mais il y croit."
          ]
        }
      ]
    }
  },
  chests: {
    lantern_box: {
      label: "Boîte à lampions",
      openText: "🎁 Sous les lampions pliés, une bourse de lanternier, un peu cirée.",
      emoji: "🏮",
      emojiOpened: "🏮"
    },
    carver_chest: {
      label: "Coffre de la sculptrice",
      openText: "🎁 Une statuette de bambou, creuse, remplie de pièces.",
      emoji: "🪆",
      emojiOpened: "🪆"
    },
    honey_hive: {
      label: "Ruche de cendre",
      openText: "🎁 Dans la ruche, du miel doré et quelques pièces d'apicultrice.",
      emoji: "🍯",
      emojiOpened: "🍯"
    },
    hidden_grove_chest: {
      label: "Coffre du bosquet caché",
      openText: "🎁 Un bosquet vert que le feu a oublié. Un coffre dort entre deux tiges, rempli de lampions dorés et de pièces.",
      emoji: "🎋",
      emojiOpened: "🎋"
    },
    ash_urn: {
      label: "Urne de cendre",
      openText: "🎁 Une urne ancienne, scellée avant l'incendie. Elle contient des pièces d'argent et une lettre d'amour.",
      emoji: "⚱️",
      emojiOpened: "⚱️"
    },
    journal_page_bam: {
      label: "Page coincée dans une tige",
      openText: "🎁 Une page roulée dans une tige creuse : « Il parle de son disciple comme d'un fantôme. Je suis le fantôme. »",
      emoji: "📄",
      emojiOpened: "📄"
    }
  },
  quests: [
    {
      id: "sq_bam_lampions_1",
      title: "Du papier pour les lampions",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "lanternier_fa",
      turnIn: "lanternier_fa",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "ke_paper",
          text: "Demander du papier à Vieux Ke (atelier de papier, Cent Tiges)",
          lines: [
            "Du papier translucide ? J'en ai de côté pour Fa, le meilleur du canton. Dites-lui que le prix est une anecdote."
          ]
        }
      ],
      offer: [
        "Mes lampions manquent de papier, et mon fournisseur est à l'autre bout du sentier. Aidez-moi, archer, je vous fais un lampion à votre nom."
      ],
      hint: [
        "Vieux Ke tient son atelier au village des Cent Tiges. Il garde du papier pour Fa."
      ],
      complete: [
        "Le papier est parfait. Ce soir, j'allume cent lampions en votre honneur. Ensuite, je vous raconte le vol."
      ],
      reward: {
        gold: 55,
        fragment: "Papier translucide",
        xp: 65
      }
    },
    {
      id: "sq_bam_lampions_2",
      title: "Le voleur de lampions",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "lanternier_fa",
      turnIn: "lanternier_fa",
      requires: [
        "sq_bam_lampions_1"
      ],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "bambous_lantern_thief",
          text: "Chasser le voleur de lampions (Sentier des Tiges Cendrées)"
        }
      ],
      offer: [
        "Maintenant que j'ai du papier, mes lampions disparaissent ! C'est un petit démon-renard, j'en jurerais. Chassez-le, archer."
      ],
      hint: [
        "Le Xiao Gui rôde sur le sentier, derrière la clairière. Il aime les lueurs."
      ],
      complete: [
        "Mes lampions sont revenus, quelques-uns roussis. Le démon a laissé un mot : « Excusez-moi, c'était joli. »"
      ],
      reward: {
        gold: 75,
        fragment: "Étincelle de lampion",
        xp: 90
      }
    },
    {
      id: "sq_bam_lampions_3",
      title: "Le lampion d'or",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "lanternier_fa",
      turnIn: "lanternier_fa",
      requires: [
        "sq_bam_lampions_2"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "hidden_grove_chest",
          text: "Trouver le bosquet caché et son coffre (Sentier des Tiges Cendrées)"
        }
      ],
      offer: [
        "Mon grand-père avait caché un lampion d'or dans un bosquet épargné par le feu. Retrouvez-le, que la clairière brille encore."
      ],
      hint: [
        "Le bosquet est caché entre deux tiges, sur le sentier. Cherchez une tache de vert dans le noir."
      ],
      complete: [
        "Le lampion d'or ! Il scintille comme un petit soleil apprivoisé. Merci, archer : voici un morceau d'or filé."
      ],
      reward: {
        gold: 100,
        fragment: "Or de lampion",
        xp: 115
      }
    },
    {
      id: "sq_bam_panda",
      title: "Le miel de Baobao",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "panda_baobao",
      turnIn: "panda_baobao",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "beekeeper_ju",
          text: "Parler à Ju l'apicultrice (Clairière des Lampions)",
          lines: [
            "Du miel pour Baobao ? Il en réclame chaque jour. Allez ouvrir la ruche, mais délicatement."
          ]
        },
        {
          type: "chest",
          target: "honey_hive",
          text: "Ouvrir la ruche de cendre (Clairière des Lampions)"
        }
      ],
      offer: [
        "Hmm hmm ! Hmm hmm hmm ! (Le panda tire sur votre manche et mime des abeilles. Vous comprenez : miel.)"
      ],
      hint: [
        "Ju est au hameau, près de la ruche. Le panda vous suit, plein d'espoir."
      ],
      complete: [
        "Baobao dévore le miel avec un sérieux admirable. Puis il vous offre une feuille de bambou : son plus grand trésor."
      ],
      reward: {
        gold: 60,
        fragment: "Feuille de panda",
        xp: 70
      }
    },
    {
      id: "sq_bam_ombres",
      title: "Les ombres du temple",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "monk_zhen",
      turnIn: "monk_zhen",
      requires: [
        "q_sun_3"
      ],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "ash_shadows",
          text: "Chasser les ombres des cendres (Sentier des Tiges Cendrées)"
        }
      ],
      offer: [
        "Des ombres, archer, deux ombres qui ne sont à personne. Elles errent entre les tiges et effraient les pèlerins. Chassez-les."
      ],
      hint: [
        "Les deux ombres rôdent près des sceaux, sur le sentier. Elles se déplacent sans bruit."
      ],
      complete: [
        "Les ombres sont rentrées dans la cendre. Le sentier est paisible. Que la lumière vous suive, archer."
      ],
      reward: {
        gold: 90,
        fragment: "Voile d'ombre",
        xp: 110
      }
    },
    {
      id: "sq_bam_sculpture",
      title: "Le modèle de Ling",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "carver_ling",
      turnIn: "carver_ling",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "lady_lan",
          text: "Demander à Dame Lan de poser (maison de thé de Dame Lan)",
          lines: [
            "Moi, poser ? Ma tasse sur la tête, alors. D'accord, pour Ling."
          ]
        },
        {
          type: "talk",
          target: "apprentice_zhu",
          text: "Demander à Petite Zhu de poser (atelier de papier)",
          lines: [
            "Poser ? Oh oui ! Mais je bouge beaucoup. Ling sera courageuse."
          ]
        },
        {
          type: "talk",
          target: "scholar_dong",
          text: "Demander à Dong de poser (place des Cent Tiges)",
          lines: [
            "Poser pour la postérité ? Immédiatement ! Dites-lui de me sculpter avec un air pensif."
          ]
        }
      ],
      offer: [
        "Je veux une statue des habitants des Cent Tiges, avec trois modèles : Dame Lan, la petite Zhu, et le lettré Dong. Pouvez-vous leur demander de venir poser ?"
      ],
      hint: [
        "Dame Lan est à la maison de thé, Petite Zhu à l'atelier de papier, Dong sur la place."
      ],
      complete: [
        "Ils ont posé ! La statue est splendide. Dong est tout fier de son air pensif. Voici un éclat de bambou pour vos flèches."
      ],
      reward: {
        gold: 75,
        fragment: "Éclat de bambou sculpté",
        xp: 90
      }
    },
    {
      id: "sq_bam_qing",
      title: "La lettre de Dame Qing",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "snake_qing",
      turnIn: "snake_qing",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "herbalist_xu",
          text: "Demander un remède à Xu (officine de Xu)",
          lines: [
            "Pour Dame Qing ? Du thé de chrysanthème et du repos. Dites-lui que la tristesse se soigne par la patience."
          ]
        },
        {
          type: "chest",
          target: "ash_urn",
          text: "Retrouver l'urne de cendre et y déposer la lettre (Sentier des Tiges Cendrées)"
        }
      ],
      offer: [
        "Je suis une serpente, mais j'ai un cœur. Il y a une urne dans les cendres, où dort une lettre d'amour. Je voudrais l'ouvrir. Mais ma tristesse m'étouffe. Demandez un remède à l'herboriste, puis allez chercher l'urne."
      ],
      hint: [
        "Xu est à l'officine, au village. L'urne est cachée dans les cendres du sentier."
      ],
      complete: [
        "Elle a lu la lettre sans pleurer. « Il avait pensé à moi jusqu'à la fin. » Je crois que c'est tout ce qu'elle voulait savoir."
      ],
      reward: {
        gold: 85,
        fragment: "Écaille blanche",
        xp: 100
      }
    },
    {
      id: "sq_bam_lettre",
      title: "Le courrier du hameau",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "lady_lan",
      turnIn: "monk_zhen",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "archer_huo",
          text: "Remettre la lettre à Huo (Clairière des Lampions)",
          lines: [
            "Une lettre de Lan ? Elle me pose toujours les mêmes questions. Dites au moine que mon avis est « oui, il faut tenter »."
          ]
        },
        {
          type: "talk",
          target: "monk_zhen",
          text: "Rapporter la réponse à Maître Zhen (cellule du moine Zhen)",
          lines: [
            "« Oui, il faut tenter »… Alors nous tenterons. Merci, archer, d'avoir été notre facteur."
          ]
        }
      ],
      offer: [
        "J'ai une lettre pour Huo, le vieil archer de la clairière. Il me répondra pour le moine. Je suis trop occupée pour courir. Faites le facteur, archer."
      ],
      hint: [
        "Huo est au hameau, dans la clairière. Zhen est dans sa cellule, aux Cent Tiges."
      ],
      complete: [
        "Le moine a déchiffré la réponse, le front soucieux. Puis il a souri. « On reconstruit le temple. » Merci, facteur."
      ],
      reward: {
        gold: 70,
        fragment: "Sceau de facteur",
        xp: 80
      }
    },
    {
      id: "sq_journal_3",
      title: "La page dans la tige",
      chapter: "✦ Quête secondaire — Forêt de Bambous Calcinée",
      giver: "lady_lan",
      turnIn: "lady_lan",
      requires: [
        "sq_journal_2"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_bam",
          text: "Retrouver la page dans une tige creuse (Sentier des Tiges Cendrées)"
        }
      ],
      offer: [
        "Un client m'a dit avoir vu un jeune archer glisser un papier dans une tige. Je vous parie cent tasses que c'est une page de carnet. Allez voir."
      ],
      hint: [
        "La page est roulée dans une tige creuse du sentier, du côté des sceaux."
      ],
      complete: [
        "« Il parle de son disciple comme d'un fantôme. Je suis le fantôme. » Dame Lan sert un thé, en silence. Elle ne dit rien. Elle sert."
      ],
      reward: {
        gold: 70,
        fragment: "Page du carnet (III)",
        xp: 80
      }
    }
  ]
};

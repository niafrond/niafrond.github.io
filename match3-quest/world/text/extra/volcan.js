// Textes additionnels — Gorges du Volcan (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    volcan_hamlet: {
      name: "Sources Tièdes",
      arrival: [
        "Aux Sources Tièdes, tout le monde sent le soufre et le savon. Les geysers y sont domestiqués, plus ou moins.",
        "Un sentier de basalte les relie aux coulées, en bordure du vacarme."
      ]
    },
    volcan_h2_alchimiste: {
      name: "Laboratoire de l'alchimiste Dan",
      arrival: [
        "Des cornues bouillonnent. Une odeur d'œuf pourri et de promesses chimiques flotte dans l'air."
      ]
    },
    volcan_h2_chauffeur: {
      name: "Chaufferie de Ge",
      arrival: [
        "Des tuyaux gémissent, la vapeur monte en nuages. Au milieu, un homme en nage vous salue d'un signe de tête."
      ]
    }
  },
  npcs: {
    alchemist_dan: {
      name: "Dan",
      title: "Alchimiste du cinabre",
      emoji: "⚗️",
      idle: [
        "Je cherche l'élixir de longue vie. Je n'ai trouvé que des brûlures de longue durée.",
        "Le cinabre est beau, mortel et cher. Comme la plupart des choses intéressantes."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Un soleil de moins : mes cornues ont cessé de siffler. Je ne sais pas si j'en suis soulagé ou déçu."
          ]
        }
      ]
    },
    stoker_ge: {
      name: "Ge",
      title: "Chauffeur des bains",
      emoji: "🔥",
      idle: [
        "J'entretiens la vapeur. Mon seul interlocuteur est un tuyau qui glougloute.",
        "Un jour, je prendrai un bain, moi aussi. Quand j'aurai le temps."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Les tuyaux sont plus calmes. Je me suis autorisé un bain. J'ai pleuré de joie, en silence."
          ]
        }
      ]
    },
    geologist_zhou: {
      name: "Zhou",
      title: "Géologue des gorges",
      emoji: "🪨",
      idle: [
        "Chaque roche est une phrase. Celle-ci dit : « Éloigne-toi, imbécile ».",
        "Je cherche d'où vient la chaleur. On me répond : « de la terre ». C'est vague."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Les pierres sont moins nerveuses. Je vais pouvoir en classer quelques-unes sans crainte."
          ]
        }
      ]
    },
    widow_cai: {
      name: "Dame Cai",
      title: "Veuve au grand cœur",
      emoji: "👩",
      idle: [
        "Mon mari est tombé dans la mine, un soir de crue. Il me manque, mais le volcan est respectueux.",
        "Je fais des gâteaux de riz pour les mineurs. Ils les mangent sans lever les yeux. C'est un compliment."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Un soleil de moins. Je garde mes gâteaux pour la fête. Hou Yi, vous en aurez un."
          ]
        }
      ]
    },
    bath_mu: {
      name: "Mu",
      title: "Gardienne des bains",
      emoji: "🛁",
      idle: [
        "Les bains soignent tout : douleurs, rancunes, même la timidité si l'eau est assez chaude.",
        "Ne parlez pas trop fort. Les geysers sont susceptibles."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Les bains sont pleins. Quand les héros se reposent, le monde respire."
          ]
        }
      ]
    },
    dragonet_xiaohong: {
      name: "Xiaohong",
      title: "Petit dragon de braise",
      emoji: "🐲",
      idle: [
        "Grrr ! Je suis un dragon féroce ! Enfin, un dragonnet. Un très féroce dragonnet.",
        "J'ai perdu mon œuf. Pas le mien, celui de ma sœur. Elle va me manger."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Grrr ! Mon œuf est de retour. Ma sœur ne me mangera pas. Elle me mangera moins."
          ]
        }
      ]
    },
    courier_tong: {
      name: "Tong",
      title: "Messager des gorges",
      emoji: "📮",
      idle: [
        "Je porte les lettres de gorge en gorge. Je ne les lis jamais. Presque.",
        "Ma botte gauche est brûlée. Ma botte droite aussi. C'est cohérent."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "La poste reprend. Les gens écrivent à nouveau. Preuve que l'espoir est une manie."
          ]
        }
      ]
    },
    lava_fish_bi: {
      name: "Bi",
      title: "Poisson de lave",
      emoji: "🐟",
      idle: [
        "Blup ! Je nage dans le magma. Mes cousins me trouvent excentrique.",
        "Je suis le seul poisson qui rougisse quand on le regarde."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Blup ! Le magma est moins froid. Pardon : moins chaud. Je ne sais plus."
          ]
        }
      ]
    },
    ghost_miner_shu: {
      name: "Vieux Shu",
      title: "Fantôme de mineur",
      emoji: "👻",
      idle: [
        "Je suis mort ici. C'est un bon endroit, il y fait chaud.",
        "Les nouveaux mineurs ne me voient pas. Seul le jeune Bo m'entend. Il a de bonnes oreilles."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Je ne regrette rien. Sauf peut-être mon casque. On me l'a emprunté, ça fait vingt ans."
          ]
        }
      ]
    },
    bath_old_wang: {
      name: "Grand-père Wang",
      title: "Vieux baigneur du hameau",
      emoji: "🧓",
      idle: [
        "Je trempe mes pieds depuis soixante ans. Je suis le plus heureux des hommes.",
        "J'ai connu Fei dans un bain. Nous sommes frères d'eau chaude."
      ],
      talk: [
        {
          whenDone: "sun_6",
          lines: [
            "Un soleil de moins : l'eau du bain est plus onctueuse. Je vous le dis, archer, c'est le début d'un monde nouveau."
          ]
        }
      ]
    }
  },
  chests: {
    alchemy_chest: {
      label: "Coffre de l'alchimiste",
      openText: "🎁 Sous une pile de grimoires brûlés, un coffret de cinabre et de pièces.",
      emoji: "⚗️",
      emojiOpened: "⚗️"
    },
    stoker_box: {
      label: "Boîte du chauffeur",
      openText: "🎁 Une boîte à tabac, remplie de pièces plutôt que de feuilles.",
      emoji: "📦",
      emojiOpened: "📦"
    },
    hot_spring_chest: {
      label: "Coffre des bains",
      openText: "🎁 Au fond d'un bassin vidé, un coffre scellé de cire. Quelques pièces.",
      emoji: "🛁",
      emojiOpened: "🛁"
    },
    obsidian_cache: {
      label: "Cache d'obsidienne",
      openText: "🎁 Un éclat noir cache une cavité secrète. Elle contient de l'or fin et un œuf de basalte.",
      emoji: "🥚",
      emojiOpened: "🥚"
    },
    cinnabar_vault: {
      label: "Caveau de cinabre",
      openText: "🎁 Un caveau rouge sang : cinabre pur, pièces de rubis et poussière d'or.",
      emoji: "💎",
      emojiOpened: "💎"
    },
    journal_page_vol: {
      label: "Page coincée dans une fissure",
      openText: "🎁 Une page brûlée aux coins : « Ma flèche a manqué. Il m'a regardé, enfin. Je n'aurais pas dû. »",
      emoji: "📄",
      emojiOpened: "📄"
    }
  },
  quests: [
    {
      id: "sq_vol_alchimie_1",
      title: "Le cinabre d'Occident",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "alchemist_dan",
      turnIn: "alchemist_dan",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "herbalist_xu",
          text: "Demander l'herbe rare à Xu (Officine de Xu, forêt de bambous)",
          lines: [
            "Pour un alchimiste du volcan ? Hmm, du lingzhi séché, alors. Dites-lui de ne pas le fumer, c'est un conseil de médecin."
          ]
        }
      ],
      offer: [
        "Il me faut un lingzhi séché, de grande qualité. Seul un herboriste de la forêt de bambous en a. Si vous passez là-bas, faites-moi plaisir."
      ],
      hint: [
        "Xu tient son officine au village des Cent Tiges, dans la forêt de bambous."
      ],
      complete: [
        "Le lingzhi ! Je vais pouvoir terminer mon élixir. Non, pas celui-là : un autre, plus modeste. Je ne touche plus à l'immortalité."
      ],
      reward: {
        gold: 105,
        fragment: "Lingzhi séché",
        xp: 195
      }
    },
    {
      id: "sq_vol_alchimie_2",
      title: "Les chiens de magma",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "alchemist_dan",
      turnIn: "alchemist_dan",
      requires: [
        "sq_vol_alchimie_1"
      ],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "magma_hounds",
          text: "Chasser les chiens de magma (coulées rougeoyantes)"
        }
      ],
      offer: [
        "Mes chiens de garde ont mal tourné : ils se sont enfuis dans les coulées. Je ne peux plus laisser traîner le cinabre. Chassez-les."
      ],
      hint: [
        "Les deux chiens de magma errent dans les coulées, tout rougeoyants."
      ],
      complete: [
        "Ils sont maîtrisés, je m'en occupe. Je leur donnerai des os de basalte. Tenez, une cornée de cornue : fragile, utile."
      ],
      reward: {
        gold: 150,
        fragment: "Cornue brisée",
        xp: 280
      }
    },
    {
      id: "sq_vol_alchimie_3",
      title: "Le grand œuvre",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "alchemist_dan",
      turnIn: "alchemist_dan",
      requires: [
        "sq_vol_alchimie_2"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "cinnabar_vault",
          text: "Ouvrir le caveau de cinabre (coulées rougeoyantes)"
        }
      ],
      offer: [
        "Mon grand œuvre n'attend plus que du cinabre pur. Un caveau en regorge, dans les coulées. Ouvrez-le, archer, mais ne touchez à rien."
      ],
      hint: [
        "Le caveau est dans les coulées rougeoyantes, sur une plate-forme de basalte rouge."
      ],
      complete: [
        "Du cinabre pur ! Avec ça, je fabrique une poudre qui rend les flèches rouges. C'est inutile, mais très beau."
      ],
      reward: {
        gold: 195,
        fragment: "Poudre de cinabre",
        xp: 365
      }
    },
    {
      id: "sq_vol_farceur",
      title: "Le farceur des cendres",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "cook_dada",
      turnIn: "cook_dada",
      requires: [],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "volcan_ember_imp",
          text: "Chasser le Xiao Gui des cendres (coulées rougeoyantes)"
        }
      ],
      offer: [
        "Un petit démon vole mes bols de nouilles ! Il laisse une trace de cendres. Chassez-le, ou nous finirons tous au pain sec."
      ],
      hint: [
        "Le Xiao Gui des cendres rôde dans les coulées. Il adore les bols fumants."
      ],
      complete: [
        "Mes bols sont revenus ! Il a même laissé un mot : « Bonnes nouilles ». Tenez, une cuillère de braise."
      ],
      reward: {
        gold: 135,
        fragment: "Cuillère de braise",
        xp: 250
      }
    },
    {
      id: "sq_vol_geologue",
      title: "Les trois témoins",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "geologist_zhou",
      turnIn: "geologist_zhou",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "miner_shan",
          text: "Interroger Shan le mineur (Maison de Shan)",
          lines: [
            "Chaleur ? Du fond de la terre, comme toujours. Demandez à Bo, il creuse plus profond que moi."
          ]
        },
        {
          type: "talk",
          target: "young_miner_bo",
          text: "Interroger Bo (place des Braises Sages)",
          lines: [
            "Chaleur ? Le soleil a mis le feu aux entrailles de la terre. Vieux Shu, le fantôme, en sait plus long."
          ]
        },
        {
          type: "talk",
          target: "ghost_miner_shu",
          text: "Interroger le fantôme Shu (coulées rougeoyantes)",
          lines: [
            "La chaleur vient du soleil de magma. Mais elle repart avec lui. Dis-le à Zhou."
          ]
        }
      ],
      offer: [
        "Je cherche l'origine de la chaleur. Interrogez trois témoins : Shan, Bo et un fantôme de mineur. Leurs réponses me fixeront."
      ],
      hint: [
        "Shan est dans sa maison, Bo sur la place, Shu dans les coulées."
      ],
      complete: [
        "Trois réponses, une conclusion : la chaleur partira avec le soleil. Joli bilan scientifique. Voici un échantillon de basalte."
      ],
      reward: {
        gold: 150,
        fragment: "Basalte étiqueté",
        xp: 280
      }
    },
    {
      id: "sq_vol_poisson",
      title: "Le poisson dans le bain",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "bath_mu",
      turnIn: "bath_mu",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "lava_fish_bi",
          text: "Parler au poisson Bi (coulées rougeoyantes)",
          lines: [
            "Blup ! Le bain était délicieux, merci. Dites à Mu que je reviendrai quand il y aura plus de mousse."
          ]
        },
        {
          type: "chest",
          target: "hot_spring_chest",
          text: "Ouvrir le coffre des bains (Sources Tièdes)"
        }
      ],
      offer: [
        "Un poisson de lave a nagé dans les bains. Il y a pris goût. Parlez-lui, puis ouvrez le coffre du fond : il s'y cache."
      ],
      hint: [
        "Bi est dans les coulées, près du magma. Le coffre est au hameau."
      ],
      complete: [
        "Bi est rentré chez lui, le poisson. Il m'a laissé une écaille pourpre. Elle chauffe les mains : un trésor."
      ],
      reward: {
        gold: 135,
        fragment: "Écaille pourpre",
        xp: 250
      }
    },
    {
      id: "sq_vol_dragonnet",
      title: "L'œuf de la sœur",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "priestess_yan",
      turnIn: "priestess_yan",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "dragonet_xiaohong",
          text: "Parler au dragonnet Xiaohong (Sources Tièdes)",
          lines: [
            "Grrr ! Mon œuf est tombé dans une cavité. Je ne suis pas féroce quand je pleure."
          ]
        },
        {
          type: "chest",
          target: "obsidian_cache",
          text: "Récupérer l'œuf dans la cache d'obsidienne (coulées rougeoyantes)"
        }
      ],
      offer: [
        "Un petit dragon pleure à ma porte : il a perdu l'œuf de sa sœur. Je crois savoir où il est tombé. Aidez-le, archer."
      ],
      hint: [
        "Xiaohong est au hameau. La cache d'obsidienne est dans les coulées."
      ],
      complete: [
        "L'œuf est revenu. La sœur a embrassé son petit frère, et ne l'a pas mangé. C'est une victoire familiale."
      ],
      reward: {
        gold: 150,
        fragment: "Coquille de dragonnet",
        xp: 280
      }
    },
    {
      id: "sq_vol_obsidienne",
      title: "Les soldats d'obsidienne",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "potter_rui",
      turnIn: "potter_rui",
      requires: [
        "q_sun_6"
      ],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "volcan_obsidian_guard",
          text: "Abattre le soldat d'obsidienne (coulées rougeoyantes)"
        }
      ],
      offer: [
        "Un soldat d'obsidienne casse mes vases. Il croit que ce sont des ennemis. Mes vases ne sont pas dangereux, hélas."
      ],
      hint: [
        "Le soldat d'obsidienne patrouille dans les coulées. Il brille en noir."
      ],
      complete: [
        "Mes vases sont sauvés. Le soldat est devenu une statue sur la route : elle sert d'épouvantail. Voici un éclat d'obsidienne."
      ],
      reward: {
        gold: 180,
        fragment: "Éclat d'obsidienne",
        xp: 335
      }
    },
    {
      id: "sq_journal_6",
      title: "La page brûlée",
      chapter: "✦ Quête secondaire — Gorges du Volcan",
      giver: "bather_fei",
      turnIn: "bather_fei",
      requires: [
        "sq_journal_5"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_vol",
          text: "Retrouver la page dans la fissure (coulées rougeoyantes)"
        }
      ],
      offer: [
        "Une page brûlée a volé jusqu'au bain. Elle parle d'une flèche manquée et d'un regard. Je crois qu'il y en a d'autres. Allez dans les coulées."
      ],
      hint: [
        "La page est coincée dans une fissure de basalte, dans les coulées."
      ],
      complete: [
        "« Ma flèche a manqué. Il m'a regardé, enfin. Je n'aurais pas dû. » Fei se tait, et trempe ses pieds en silence."
      ],
      reward: {
        gold: 135,
        fragment: "Page du carnet (VI)",
        xp: 250
      }
    }
  ]
};

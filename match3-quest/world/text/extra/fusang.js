// Textes additionnels — Cime du Fusang (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    fusang_hamlet: {
      name: "Perchoir des Grues",
      arrival: [
        "Le Perchoir des Grues flotte à mi-hauteur de l'arbre, entre ciel et racines. Les grues y font une halte, les mortels un détour.",
        "Un pont de lianes dorées le relie aux branches de la zone sauvage."
      ]
    },
    fusang_h2_grues: {
      name: "Pavillon des grues messagères",
      arrival: [
        "Des centaines de plumes blanches tapissent le sol. Les grues vous observent avec la politesse des diplomates."
      ]
    },
    fusang_h2_encens: {
      name: "Atelier d'encens de Lanxiang",
      arrival: [
        "Une fumée de santal vous accueille. Elle dessine des idéogrammes au plafond, et vous pensez presque les comprendre."
      ]
    }
  },
  npcs: {
    crane_elder_hegu: {
      name: "Hegu",
      title: "Doyenne des grues messagères",
      emoji: "🦢",
      idle: [
        "Nous portons les lettres du ciel. Certaines sont heureuses, la plupart sont des factures.",
        "Une grue ne dit jamais ce qu'elle porte. Mais elle le sait."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "Neuf soleils sont tombés. Nous avons porté la nouvelle à la Reine Mère. Elle a hoché la tête, très lentement."
          ]
        }
      ]
    },
    incense_lanxiang: {
      name: "Lanxiang",
      title: "Faiseuse d'encens",
      emoji: "🪔",
      idle: [
        "L'encens est une prière qui monte. Je fabrique les plus longues.",
        "Chaque parfum a son histoire. Le santal, la patience. Le jasmin, le pardon."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "La fumée monte plus droit depuis le départ du soleil. Un bon présage, il me semble."
          ]
        }
      ]
    },
    weaver_zhinu: {
      name: "Zhinü",
      title: "Tisseuse des nuages",
      emoji: "👸",
      idle: [
        "Je tisse les nuages du soir. Chaque nuit, je regarde le ciel : mon bien-aimé est de l'autre côté du fleuve.",
        "Un fil d'or, un fil d'argent. La séparation est une trame comme une autre."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "Les étoiles brillent mieux depuis la chute du neuvième soleil. Le fleuve d'argent est plus clair."
          ]
        }
      ]
    },
    oxherd_niulang: {
      name: "Niulang",
      title: "Bouvier de la rive",
      emoji: "🐂",
      idle: [
        "Mon bœuf céleste est mon seul compagnon. Il me parle de Zhinü, et d'herbe.",
        "Je vis de l'autre côté du fleuve d'argent. Une fois l'an, un pont de pies nous réunit."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "Neuf soleils tombés, un seul reste. Si le ciel est apaisé, peut-être mon pont durera plus d'une nuit."
          ]
        }
      ]
    },
    pilgrim_wuya: {
      name: "Wuya",
      title: "Pèlerin sans destination",
      emoji: "🧳",
      idle: [
        "Je marche depuis toujours. Je ne cherche rien. C'est la meilleure façon de trouver.",
        "Un jour, je m'assiérai. Pas aujourd'hui. Pas avant d'avoir tout vu."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "La cime est calme. Je m'assiérais bien, mais mes pieds protestent à l'idée de ne plus marcher."
          ]
        }
      ]
    },
    gatekeeper_men: {
      name: "Men",
      title: "Portier du sceau",
      emoji: "🚪",
      idle: [
        "Je garde la porte entre le village et la cime. Elle est fermée. Je suis très sérieux.",
        "On ne passe pas sans mot de passe. Le mot de passe est « s'il vous plaît »."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "Le sceau est reformé. Je peux enfin me reposer. Un peu. Sur un pied."
          ]
        }
      ]
    },
    star_child_xing: {
      name: "Xingxing",
      title: "Enfant d'étoile",
      emoji: "🌟",
      idle: [
        "Je suis né d'une étoile filante. Mes parents sont partis. Je les attends.",
        "Les étoiles me parlent. Elles disent : « Dors, petit, et rêve de nous. »"
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "Une étoile m'a dit que la lune attendait une visite. Elle a l'air impatiente, d'après elle."
          ]
        }
      ]
    },
    monkey_ji: {
      name: "Ji",
      title: "Singe voleur de pêches",
      emoji: "🐵",
      idle: [
        "Ouistiti ! Je ne vole pas les pêches, je les libère de leur arbre.",
        "Je suis bavard. Je suis rapide. Je suis très, très innocent."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "Ouistiti ! Les pêches sont moins bien gardées. Je prépare mon plus beau retour."
          ]
        }
      ]
    },
    whale_kun: {
      name: "Kun",
      title: "Poisson géant des nuages",
      emoji: "🐋",
      idle: [
        "Je suis Kun, le plus grand des poissons. Je nage dans les nuages, par fainéantise.",
        "Un jour, je deviendrai oiseau. Pas aujourd'hui, il y a trop de nuages."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "Les nuages sont plus calmes. Je nage plus lentement, c'est un plaisir."
          ]
        }
      ]
    },
    paper_dragon_long: {
      name: "Petit Long",
      title: "Dragon de papier",
      emoji: "🐉",
      idle: [
        "Je suis un dragon de papier. Ne soufflez pas trop fort, je me froisse.",
        "Je rêve d'être un vrai dragon. En attendant, je fais une très belle décoration."
      ],
      talk: [
        {
          whenDone: "sun_9",
          lines: [
            "Un soleil de moins, c'est une flamme de moins à craindre. Je respire, enfin. Je ne brûle plus."
          ]
        }
      ]
    }
  },
  chests: {
    crane_pavilion_box: {
      label: "Coffre à parchemins",
      openText: "🎁 Sous les parchemins du ciel, une bourse d'argent et une plume dorée.",
      emoji: "📜",
      emojiOpened: "📜"
    },
    incense_chest: {
      label: "Coffre à encens",
      openText: "🎁 Dans le coffret de cèdre, de l'encens précieux et des pièces d'or fin.",
      emoji: "🪔",
      emojiOpened: "🪔"
    },
    loom_chest: {
      label: "Coffre du métier à tisser",
      openText: "🎁 Dans le coffre du métier, des fils d'or et quelques pièces.",
      emoji: "🧵",
      emojiOpened: "🧵"
    },
    peach_stash: {
      label: "Cache de pêches",
      openText: "🎁 Dans le creux d'une racine, une cache de pêches séchées et de pièces.",
      emoji: "🍑",
      emojiOpened: "🍑"
    },
    kun_scale_chest: {
      label: "Coffre aux écailles de Kun",
      openText: "🎁 Une écaille géante recouvre un coffre qui contient des trésors célestes.",
      emoji: "🐋",
      emojiOpened: "🐋"
    },
    journal_page_fus: {
      label: "Page accrochée à une branche",
      openText: "🎁 Une page accrochée à une branche dorée : « Je sais où est la boîte. Je saurai la prendre. Il me remerciera plus tard. »",
      emoji: "📄",
      emojiOpened: "📄"
    }
  },
  quests: [
    {
      id: "sq_fus_pont_1",
      title: "Le message du bouvier",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "oxherd_niulang",
      turnIn: "oxherd_niulang",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "weaver_zhinu",
          text: "Remettre le mot à Zhinü (Perchoir des Grues)",
          lines: [
            "Un mot de Niulang ? Dites-lui que je tisse un nuage pour lui, un nuage tout blanc, et qu'il aura mon cœur pour oreiller."
          ]
        }
      ],
      offer: [
        "Hou Yi, je ne vous demande pas grand-chose : un mot à porter. Zhinü est de l'autre côté, au Perchoir. Dites-lui que je l'attends, chaque nuit."
      ],
      hint: [
        "Zhinü est au Perchoir des Grues, au hameau, près de son métier."
      ],
      complete: [
        "Un nuage pour moi… Je sens déjà sa douceur. Merci, archer. Gardez ce fil d'argent : il vient de son métier."
      ],
      reward: {
        gold: 160,
        fragment: "Fil d'argent",
        xp: 320
      }
    },
    {
      id: "sq_fus_pont_2",
      title: "Les pêches de Zhinü",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "weaver_zhinu",
      turnIn: "weaver_zhinu",
      requires: [
        "sq_fus_pont_1"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "peach_stash",
          text: "Récupérer les pêches séchées dans la cache (racines et branches dorées)"
        },
        {
          type: "talk",
          target: "oxherd_niulang",
          text: "Porter les pêches à Niulang (place de Fusang-le-Bas)",
          lines: [
            "Des pêches ! Ma Zhinü pense à tout. Dites-lui que je les mangerai une par une, en attendant le pont."
          ]
        }
      ],
      offer: [
        "Je voudrais envoyer des pêches séchées à Niulang. Elles sont dans une cache, dans les racines. Pouvez-vous aller les lui livrer ?"
      ],
      hint: [
        "La cache est dans une racine creuse, au cœur des racines dorées. Niulang est sur la place."
      ],
      complete: [
        "Il a souri en croquant la première. C'est tout ce qu'elle voulait savoir. Prenez ce noyau de pêche céleste."
      ],
      reward: {
        gold: 200,
        fragment: "Noyau de pêche",
        xp: 400
      }
    },
    {
      id: "sq_fus_pont_3",
      title: "Le pont des pies",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "gatekeeper_men",
      turnIn: "weaver_zhinu",
      requires: [
        "sq_fus_pont_2"
      ],
      side: true,
      objectives: [
        {
          type: "visit",
          target: "fusang_wild",
          text: "Gagner les racines et branches dorées"
        },
        {
          type: "talk",
          target: "gatekeeper_men",
          text: "Demander un permis de pont à Men (place de Fusang-le-Bas)",
          lines: [
            "Un pont qui dure ? C'est contraire au règlement. Mais je suis romantique. Tenez, voici le permis."
          ]
        }
      ],
      offer: [
        "Zhinü voudrait que le pont des pies tienne plus d'une nuit par an. Il lui faudrait un permis, et je ne les accorde pas à la légère. Passez par les racines dorées, puis revenez me voir : nous en reparlerons."
      ],
      hint: [
        "Men est sur la place, devant la porte du sceau."
      ],
      complete: [
        "Le permis ! Le pont sera plus long cette année. Merci, archer. Voici une plume de pie : elle ne ment jamais."
      ],
      reward: {
        gold: 200,
        fragment: "Plume de pie",
        xp: 400
      }
    },
    {
      id: "sq_fus_singes",
      title: "Les voleurs de pêches",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "picker_tao",
      turnIn: "picker_tao",
      requires: [],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "peach_thieves",
          text: "Chasser les singes-démons voleurs (racines et branches dorées)"
        }
      ],
      offer: [
        "Deux singes dérobent mes pêches. Elles sont précieuses : une par siècle ! Je n'en ai pas plus. Chassez-les."
      ],
      hint: [
        "Les deux singes rôdent dans les racines et branches dorées. Ils font du bruit en mâchant."
      ],
      complete: [
        "Mes pêches sont sauves ! Tenez, une pêche mûre : pas celle d'immortalité, hélas, l'autre, celle du dessert."
      ],
      reward: {
        gold: 200,
        fragment: "Pêche céleste",
        xp: 400
      }
    },
    {
      id: "sq_fus_encens",
      title: "Le parfum du matin",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "incense_lanxiang",
      turnIn: "incense_lanxiang",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "root_elder",
          text: "Consulter la Racine-Ancienne (racines et branches dorées)",
          lines: [
            "Le parfum de l'aube ? Mélange de bois et de promesse. Elle se souviendra de tout."
          ]
        },
        {
          type: "talk",
          target: "phoenix_chick",
          text: "Consulter Petit Fenghuang (place de Fusang-le-Bas)",
          lines: [
            "Piou ! Moi, ce que j'aime, c'est l'odeur de la cendre chaude. Ça sent la renaissance !"
          ]
        },
        {
          type: "talk",
          target: "astronomer_xing",
          text: "Consulter Mère Xing (Observatoire de Mère Xing)",
          lines: [
            "L'odeur du ciel ? Fraîche, métallique, avec une pointe de mystère."
          ]
        }
      ],
      offer: [
        "La Reine Mère me demande un parfum du matin. Je ne sais pas par où commencer. Interrogez trois sages pour moi : la Racine, le poussin de phénix, Mère Xing."
      ],
      hint: [
        "La Racine-Ancienne est dans les racines, le poussin sur la place, Mère Xing à l'observatoire."
      ],
      complete: [
        "Bois, cendre et ciel : voilà mon parfum. La Reine Mère sera ravie. Tenez, un bâton d'encens céleste."
      ],
      reward: {
        gold: 200,
        fragment: "Encens céleste",
        xp: 400
      }
    },
    {
      id: "sq_fus_etoile",
      title: "L'enfant d'étoile",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "star_child_xing",
      turnIn: "star_child_xing",
      requires: [
        "q_sun_8"
      ],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "fusang_root_guard",
          text: "Vaincre le garde solaire des racines (racines et branches dorées)"
        }
      ],
      offer: [
        "Mes parents sont partis. Le garde solaire a pris leur lueur, je crois. Reprenez-la, s'il vous plaît !"
      ],
      hint: [
        "Le garde solaire se tient dans les racines et branches dorées, près d'un arbre brillant."
      ],
      complete: [
        "La lueur est revenue ! Elle est dans mon cœur. Je sais maintenant qu'ils me veillent. Merci, archer. Voici un éclat d'étoile."
      ],
      reward: {
        gold: 200,
        fragment: "Éclat d'étoile",
        xp: 400
      }
    },
    {
      id: "sq_fus_pelerin",
      title: "Les écailles de Kun",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "pilgrim_wuya",
      turnIn: "pilgrim_wuya",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "whale_kun",
          text: "Demander une écaille à Kun (racines et branches dorées)",
          lines: [
            "Une écaille ? Il y en a une sur le coffre, là-bas. Prends ce qu'il y a dessous, c'est pour toi."
          ]
        },
        {
          type: "chest",
          target: "kun_scale_chest",
          text: "Ouvrir le coffre aux écailles de Kun (racines et branches dorées)"
        }
      ],
      offer: [
        "On dit qu'une écaille de Kun guérit ceux qui marchent trop. Je voudrais essayer. Allez la demander au poisson géant."
      ],
      hint: [
        "Kun nage au-dessus des racines et branches dorées. Il y a un coffre juste au-dessous."
      ],
      complete: [
        "L'écaille m'a calmé. Je vais m'asseoir, enfin. Elle est à vous, par amitié : voici le coffre, et un fragment pour vos flèches."
      ],
      reward: {
        gold: 200,
        fragment: "Écaille de Kun",
        xp: 400
      }
    },
    {
      id: "sq_fus_wyrm",
      title: "Le long égaré",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "gatekeeper_men",
      turnIn: "gatekeeper_men",
      requires: [],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "fusang_frost_wyrm",
          text: "Chasser le long de givre égaré (racines et branches dorées)"
        }
      ],
      offer: [
        "Un long de givre s'est perdu dans les branches. Il gèle les ponts. Chassez-le, archer, avec douceur."
      ],
      hint: [
        "Le long de givre rôde dans les racines et branches dorées, près des lianes."
      ],
      complete: [
        "Le pont dégèle. Merci, archer. Voici une écaille de givre : elle garde la fraîcheur, même près d'un feu de camp."
      ],
      reward: {
        gold: 200,
        fragment: "Écaille de givre",
        xp: 400
      }
    },
    {
      id: "sq_journal_9",
      title: "La page accrochée",
      chapter: "✦ Quête secondaire — Cime du Fusang",
      giver: "crane_envoy",
      turnIn: "crane_envoy",
      requires: [
        "sq_journal_8"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_fus",
          text: "Retrouver la page accrochée (racines et branches dorées)"
        }
      ],
      offer: [
        "J'ai vu passer un jeune archer, l'air sombre. Il a laissé une page dans les branches. Elle parle d'une boîte, et d'une dame que je connais : Chang'e."
      ],
      hint: [
        "La page est accrochée à une branche dorée, dans les racines et branches du Fusang."
      ],
      complete: [
        "« Je sais où est la boîte. Je saurai la prendre. Il me remerciera plus tard. » La Grue baisse la tête : « Il faut prévenir Dame Chang'e. »"
      ],
      reward: {
        gold: 180,
        fragment: "Page du carnet (IX)",
        xp: 360
      }
    }
  ]
};

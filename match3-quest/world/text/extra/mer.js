// Textes additionnels — Rivage de la Mer Orientale (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    mer_hamlet: {
      name: "Anse des Coquillages",
      arrival: [
        "L'Anse des Coquillages sent le sel et le calfatage. Des coquilles blanches tapissent les ruelles, et les mouettes y tiennent un conseil permanent.",
        "Un sentier de galets la relie aux criques du Dragon."
      ]
    },
    mer_h2_ecaillere: {
      name: "Maison de Dame Coque",
      arrival: [
        "Des coquilles s'empilent en montagnes blanches. Dame Coque ouvre une huître et la regarde avec tendresse."
      ]
    },
    mer_h2_chantier: {
      name: "Chantier du calfat Bing",
      arrival: [
        "La coque d'un navire à moitié construit remplit la salle. Bing y tape à coups réguliers, comme à une porte."
      ]
    }
  },
  npcs: {
    oyster_coque: {
      name: "Dame Coque",
      title: "Écaillère",
      emoji: "🦪",
      idle: [
        "Une huître est un coffre-fort qui s'ignore. Moi, je suis le cambrioleur gentil.",
        "On trouve de tout dans une huître : une perle, un caillou, un souvenir."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Le huitième soleil est tombé. Mes huîtres s'ouvrent toutes seules, de soulagement."
          ]
        }
      ]
    },
    shipwright_bing: {
      name: "Bing",
      title: "Calfat et charpentier",
      emoji: "⚒️",
      idle: [
        "Je construis un navire pour naviguer jusqu'au bout du monde. Il manque le bois, la voile, et le courage.",
        "Un navire, c'est un cheval qui rêve de nager."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Un soleil de moins, c'est un navire de plus ! Je vais finir mon chantier avant l'hiver."
          ]
        }
      ]
    },
    gull_pip: {
      name: "Pip",
      title: "Mouette bavarde",
      emoji: "🕊️",
      idle: [
        "Criii ! Du pain ! Non ? Un beignet ? Non plus ? Vous êtes nul.",
        "Je vois tout d'en haut. Les amoureux, les voleurs, et le dernier poisson."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Criii ! Un soleil de moins, c'est un reflet de moins dans mes yeux. Je vole mieux."
          ]
        }
      ]
    },
    kid_ahu: {
      name: "Ahu",
      title: "Petit ramasseur de coquillages",
      emoji: "🧒",
      idle: [
        "J'ai trouvé une coquille qui chante ! Écoute : elle fait « chhhh ». C'est la mer.",
        "Je collectionne les coquilles. Maman dit que je suis un petit crabe."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Mes coquilles chantent plus fort, ce soir ! Comme si elles aussi étaient heureuses."
          ]
        }
      ]
    },
    salt_jun: {
      name: "Jun",
      title: "Saunier",
      emoji: "🧂",
      idle: [
        "Le sel naît de la mer et du soleil. Les soleils étaient mes meilleurs associés, hélas. Depuis qu'ils s'emballent, mon sel cuit sur place.",
        "Mes salines sont blanches, la mer est bleue, mes comptes sont rouges."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Le soleil se calme, mes salines respirent. Je vais enfin dormir, une nuit entière."
          ]
        }
      ]
    },
    sailor_tai: {
      name: "Vieux Tai",
      title: "Marin retraité",
      emoji: "⛵",
      idle: [
        "J'ai vu des tempêtes, des sirènes, des dragons. J'ai surtout vu des soupes de poisson.",
        "Un marin n'a pas de patrie, il a des ports."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Je reprendrais bien la mer, mais mes genoux ont déserté. Les genoux, ça ne se ramasse pas."
          ]
        }
      ]
    },
    priestess_mazu: {
      name: "Dame Mo",
      title: "Prêtresse de Mazu",
      emoji: "🛕",
      idle: [
        "Mazu, déesse des mers, protège les marins qui lui offrent du riz et de la sincérité.",
        "Chaque vague est une prière qui revient."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Mazu a souri ce matin. La mer l'a senti, et moi aussi."
          ]
        }
      ]
    },
    singer_hailing: {
      name: "Hailing",
      title: "Chanteuse des marins",
      emoji: "🎤",
      idle: [
        "Je chante pour les marins qui partent et pour ceux qui reviennent. Les deux pleurent pareil.",
        "Une chanson de mer ne rime pas : elle roule."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Une chanson nouvelle me vient : « Huit soleils sont tombés, la mer respire ». Ça a de la gueule."
          ]
        }
      ]
    },
    jelly_shui: {
      name: "Shui",
      title: "Méduse philosophe",
      emoji: "🪼",
      idle: [
        "Je flotte. Je pense. Je pique un peu. C'est tout.",
        "On me dit transparente. Je réponds : lisible."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "La mer est plus claire. Je me vois enfin entière, ce qui est inquiétant."
          ]
        }
      ]
    },
    octo_ba: {
      name: "Ba",
      title: "Poulpe cuisinier",
      emoji: "🐙",
      idle: [
        "Huit bras, huit casseroles ! Je fais la meilleure soupe de poisson des abysses.",
        "Je suis à cran : on m'a volé ma louche en bois. Le coupable aura huit coups de louche."
      ],
      talk: [
        {
          whenDone: "sun_8",
          lines: [
            "Un soleil de moins : mes marmites cuisent plus doucement. Ça sent la fête."
          ]
        }
      ]
    }
  },
  chests: {
    oyster_box: {
      label: "Caisse d'huîtres",
      openText: "🎁 Au fond de la caisse, une perle noire et quelques pièces.",
      emoji: "🦪",
      emojiOpened: "🦪"
    },
    shipyard_chest: {
      label: "Coffre du chantier",
      openText: "🎁 Sous les copeaux, un petit coffre de charpentier avec de bonnes pièces.",
      emoji: "🪵",
      emojiOpened: "🪵"
    },
    salt_pan: {
      label: "Cache de la saline",
      openText: "🎁 Dans un tas de sel, une cassette scellée de cire. Quelques pièces salées.",
      emoji: "🧂",
      emojiOpened: "🧂"
    },
    reef_cache: {
      label: "Cache du récif",
      openText: "🎁 Dans une grotte basse, une cache d'équipage : planches, clous et monnaie.",
      emoji: "🪸",
      emojiOpened: "🪸"
    },
    wreck_treasure: {
      label: "Trésor de l'épave",
      openText: "🎁 Une épave ancienne garde un coffre scellé : or, jade, et un éventail de nacre.",
      emoji: "⚓",
      emojiOpened: "⚓"
    },
    journal_page_mer: {
      label: "Page flottant sur un récif",
      openText: "🎁 Une page échouée sur un récif : « J'ai entendu parler de l'élixir. Elle le garde dans une boîte rouge. »",
      emoji: "📄",
      emojiOpened: "📄"
    }
  },
  quests: [
    {
      id: "sq_mer_navire_1",
      title: "Du bois pour le navire",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "shipwright_bing",
      turnIn: "shipwright_bing",
      requires: [],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "reef_cache",
          text: "Récupérer les planches de la cache du récif (criques du Dragon)"
        }
      ],
      offer: [
        "Mon navire manque de planches. Je sais qu'une cache d'équipage en conserve, dans les criques. Allez la chercher, archer."
      ],
      hint: [
        "La cache est dans une grotte basse, sur le récif. Mouillez-vous un peu."
      ],
      complete: [
        "Du bois sec, de bonnes planches. Mon navire respire. Il me reste à nettoyer la coque, à chasser les parasites…"
      ],
      reward: {
        gold: 150,
        fragment: "Planche de teck",
        xp: 290
      }
    },
    {
      id: "sq_mer_navire_2",
      title: "Les crabes de la coque",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "shipwright_bing",
      turnIn: "shipwright_bing",
      requires: [
        "sq_mer_navire_1"
      ],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "giant_crabs",
          text: "Chasser les crabes-soldats (criques du Dragon)"
        }
      ],
      offer: [
        "Deux crabes-soldats grignotent ma coque ! Ils se prennent pour des termites. Chassez-les."
      ],
      hint: [
        "Les crabes rôdent dans les criques du Dragon, au pied de la falaise."
      ],
      complete: [
        "Ma coque est sauve ! Voici une pince de crabe : elle ne pince plus, elle porte chance."
      ],
      reward: {
        gold: 190,
        fragment: "Pince de crabe",
        xp: 360
      }
    },
    {
      id: "sq_mer_navire_3",
      title: "Le dernier clou",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "shipwright_bing",
      turnIn: "shipwright_bing",
      requires: [
        "sq_mer_navire_2"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "wreck_treasure",
          text: "Ouvrir le trésor de l'épave (criques du Dragon)"
        }
      ],
      offer: [
        "Le dernier clou est d'or : il vient d'une épave ancienne, tout au bout des criques. Rapportez-le-moi, que mon navire soit parfait."
      ],
      hint: [
        "L'épave est au bout des criques du Dragon. Le trésor est sous un amas d'algues."
      ],
      complete: [
        "Le clou d'or ! Mon navire peut naviguer ! Je vous baptise « premier passager ». Tenez, un second clou d'or, pour vos flèches."
      ],
      reward: {
        gold: 200,
        fragment: "Clou d'or",
        xp: 400
      }
    },
    {
      id: "sq_mer_coquille",
      title: "La perle de Dame Coque",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "oyster_coque",
      turnIn: "oyster_coque",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "octo_ba",
          text: "Interroger le poulpe Ba (criques du Dragon)",
          lines: [
            "Une perle noire ? Je l'ai prise pour un œuf, oups. Je l'ai donnée à la méduse, pour qu'elle la regarde."
          ]
        },
        {
          type: "talk",
          target: "jelly_shui",
          text: "Interroger la méduse Shui (criques du Dragon)",
          lines: [
            "Je la vois, elle flotte en moi. Si vous me chatouillez, elle sortira peut-être. Ou pas."
          ]
        }
      ],
      offer: [
        "Ma perle noire a disparu ! La plus grosse, la plus noire ! Elle a roulé vers les criques, je jure. Interrogez les poulpes et les méduses."
      ],
      hint: [
        "Ba et Shui sont dans les criques du Dragon, côte à côte."
      ],
      complete: [
        "La perle est revenue ! Elle a fait le tour des criques, la coquine. Voici un coquillage rare, par gratitude."
      ],
      reward: {
        gold: 170,
        fragment: "Coquillage rare",
        xp: 325
      }
    },
    {
      id: "sq_mer_mazu",
      title: "Le serpent de Mazu",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "priestess_mazu",
      turnIn: "priestess_mazu",
      requires: [
        "q_sun_8"
      ],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "mer_tide_serpent",
          text: "Chasser le serpent de marée (criques du Dragon)"
        }
      ],
      offer: [
        "Un serpent de marée empêche les pêcheurs d'offrir du riz à Mazu. La déesse s'impatiente. Rendez-lui sa mer."
      ],
      hint: [
        "Le serpent de marée rôde dans les criques du Dragon, sous les falaises."
      ],
      complete: [
        "Mazu a accepté l'offrande. La mer est apaisée, les marins sourient. Prenez ce talisman : il garde des tempêtes."
      ],
      reward: {
        gold: 200,
        fragment: "Talisman de Mazu",
        xp: 400
      }
    },
    {
      id: "sq_mer_chanson",
      title: "La chanson du port",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "singer_hailing",
      turnIn: "singer_hailing",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "fisher_hai",
          text: "Recueillir un couplet auprès de Hai (Cabane du pêcheur Hai)",
          lines: [
            "« Mon filet est vide, mon cœur est plein, de poisson ou de vent, tout me revient. »"
          ]
        },
        {
          type: "talk",
          target: "envoy_longwang",
          text: "Recueillir un couplet auprès de Longwang (Pavillon de l'envoyé)",
          lines: [
            "« Du fond des mers je vous salue, d'un geste ample et d'un air grave. » C'est mieux en chœur."
          ]
        },
        {
          type: "talk",
          target: "girl_net_mi",
          text: "Recueillir un couplet auprès de Mi (place de Haiyan)",
          lines: [
            "« Je raccommode les filets, un fil après l'autre, et c'est moi qui rattrape les poissons. »"
          ]
        }
      ],
      offer: [
        "Ma chanson du port a trois couplets à trouver. Allez voir Hai, Longwang et la petite Mi. Rapportez-moi leurs mots !"
      ],
      hint: [
        "Hai est dans sa cabane, Longwang dans son pavillon, Mi sur la place de Haiyan."
      ],
      complete: [
        "Trois couplets, une chanson ! Je la chanterai à la fête. Tenez, une corde de luth : elle chantera pour vos flèches."
      ],
      reward: {
        gold: 190,
        fragment: "Corde de luth",
        xp: 360
      }
    },
    {
      id: "sq_mer_sel",
      title: "Le sel de Jun",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "salt_jun",
      turnIn: "salt_jun",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "pearl_diver_xi",
          text: "Livrer le sel à Xi (Atelier des perles)",
          lines: [
            "Du sel de Jun ? Pour mes perles, c'est un baume. Merci, archer."
          ]
        },
        {
          type: "talk",
          target: "lighthouse_ming",
          text: "Livrer le sel à Ming (Phare de Haiyan)",
          lines: [
            "Du sel pour les mouettes ? Ha, ha. Plutôt pour ma soupe. Dites à Jun que je pense à lui."
          ]
        }
      ],
      offer: [
        "J'ai du sel de choix pour Xi et Ming. Je suis coincé à ma saline : la marée n'attend pas. Pouvez-vous livrer pour moi ?"
      ],
      hint: [
        "Xi est à l'atelier des perles, Ming au phare. Toutes deux à Haiyan."
      ],
      complete: [
        "Elles sont ravies ! Jun vous offre un cristal de sel pur : il brille comme une petite étoile."
      ],
      reward: {
        gold: 170,
        fragment: "Cristal de sel",
        xp: 325
      }
    },
    {
      id: "sq_mer_ahu",
      title: "La coquille qui chante",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "kid_ahu",
      turnIn: "kid_ahu",
      requires: [],
      side: true,
      objectives: [
        {
          type: "visit",
          target: "mer_h2_ecaillere",
          text: "Visiter la maison de Dame Coque (Anse des Coquillages)"
        },
        {
          type: "chest",
          target: "salt_pan",
          text: "Fouiller la cache de la saline (Anse des Coquillages)"
        }
      ],
      offer: [
        "Archer, aide-moi : j'ai perdu ma coquille qui chante. Je l'ai peut-être laissée chez Dame Coque, ou près des salines. Cherche avec moi !"
      ],
      hint: [
        "La maison de Dame Coque et la saline sont toutes deux au hameau de l'Anse."
      ],
      complete: [
        "Ma coquille ! Elle chante encore ! Je te la prête quand tu seras triste. Elle dit « chhhh » et tout va mieux."
      ],
      reward: {
        gold: 170,
        fragment: "Coquille chantante",
        xp: 325
      }
    },
    {
      id: "sq_journal_8",
      title: "La page du récif",
      chapter: "✦ Quête secondaire — Rivage de la Mer Orientale",
      giver: "lighthouse_ming",
      turnIn: "lighthouse_ming",
      requires: [
        "sq_journal_7"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_mer",
          text: "Retrouver la page sur le récif (criques du Dragon)"
        }
      ],
      offer: [
        "Une page est venue s'échouer sur un récif, juste sous mon phare. Elle porte de l'encre rouge. Allez voir, mais soyez prudent."
      ],
      hint: [
        "La page flotte sur un récif des criques du Dragon, entre deux vagues."
      ],
      complete: [
        "« J'ai entendu parler de l'élixir. Elle le garde dans une boîte rouge. » Ming éteint son phare un instant, comme pour le cacher."
      ],
      reward: {
        gold: 170,
        fragment: "Page du carnet (VIII)",
        xp: 325
      }
    }
  ]
};

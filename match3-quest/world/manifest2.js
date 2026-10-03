// Manifeste complémentaire du « Grand Monde » : hameaux, PNJ, coffres, ennemis et quêtes annexes supplémentaires.
// Même forme que manifest.js ; chaque région peut avoir un 'hamlet' (2e village, 16×11, relié à <R>_wild).
// where: 'place' | 'house:<id>' | 'wild' | 'hamlet' | 'hamlet-house:<id>'
export const MANIFEST2 = {
  rizieres: {
    hamlet: {
      id: "rizieres_hamlet",
      name: "Hameau des Lucioles",
      mood: "Quelques cabanes sur pilotis autour d'un étang vaseux, où les lucioles survivent à la sécheresse en tenant conseil.",
      arrival: [
        "Le Hameau des Lucioles tient dans un mouchoir de boue sèche. La nuit, dit-on, ses habitants s'éclairent à l'aide de petits amis volants.",
        "Un chemin de digue le relie au marais, à l'écart des regards."
      ],
      houses: [
        {
          id: "rizieres_h2_moulin",
          name: "Moulin tari du meunier Gao",
          desc: "Un moulin à eau sans eau : la roue tourne à vide, par habitude et par orgueil.",
          residents: [
            "miller_gao"
          ],
          chests: [
            "mill_flour_bin"
          ]
        },
        {
          id: "rizieres_h2_lucioles",
          name: "Cabane de Tante Liu",
          desc: "Une cabane tapissée de jarres de verre où dort la lumière.",
          residents: [
            "aunt_liu"
          ],
          chests: [
            "firefly_jar"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "miller_gao",
        name: "Gao",
        title: "Meunier sans rivière",
        emoji: "👨‍🌾",
        where: "hamlet-house:rizieres_h2_moulin",
        role: "donneur"
      },
      {
        id: "aunt_liu",
        name: "Tante Liu",
        title: "Gardienne des lucioles",
        emoji: "👵",
        where: "hamlet-house:rizieres_h2_lucioles",
        role: "indice"
      },
      {
        id: "duck_fu",
        name: "Fu",
        title: "Éleveur de canards",
        emoji: "🦆",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "kid_dandan",
        name: "Dandan",
        title: "Gamine curieuse",
        emoji: "🧒",
        where: "hamlet",
        role: "ambiance"
      },
      {
        id: "pigeon_zhao",
        name: "Zhao",
        title: "Éleveur de pigeons voyageurs",
        emoji: "🕊️",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "monk_kong",
        name: "Frère Kong",
        title: "Moine itinérant",
        emoji: "🧘",
        where: "hamlet",
        role: "ambiance"
      },
      {
        id: "matchmaker_hong",
        name: "Dame Hong",
        title: "Marieuse du canton",
        emoji: "💐",
        where: "place",
        role: "donneur"
      },
      {
        id: "lao_shuo_riz",
        name: "Lao Shuo",
        title: "Conteur itinérant",
        emoji: "📜",
        where: "place",
        role: "indice"
      },
      {
        id: "crow_wing",
        name: "Aile-Noire",
        title: "Corbeau parlant",
        emoji: "🐦‍⬛",
        where: "wild",
        role: "indice"
      },
      {
        id: "toad_chan",
        name: "Chan",
        title: "Crapaud sage",
        emoji: "🐸",
        where: "wild",
        role: "indice"
      }
    ],
    chests: [
      {
        id: "mill_flour_bin",
        where: "hamlet-house:rizieres_h2_moulin",
        tier: 1,
        label: "Coffre à farine"
      },
      {
        id: "firefly_jar",
        where: "hamlet-house:rizieres_h2_lucioles",
        tier: 1,
        label: "Jarre de lucioles"
      },
      {
        id: "duck_pond_cache",
        where: "hamlet",
        tier: 1,
        label: "Cache de l'étang"
      },
      {
        id: "hamlet_well_box",
        where: "hamlet",
        tier: 2,
        label: "Coffre du puits"
      },
      {
        id: "rice_idol",
        where: "wild",
        tier: 2,
        label: "Idole de riz cachée"
      },
      {
        id: "journal_page_riz",
        where: "wild",
        tier: 1,
        label: "Page déchirée dans les roseaux"
      }
    ],
    enemies: [
      {
        id: "crow_a",
        name: "Corbeau-démon voleur",
        templateHint: "goblin_saboteur",
        role: "quest",
        where: "wild",
        group: "crow_gang"
      },
      {
        id: "crow_b",
        name: "Corbeau-démon voleur",
        templateHint: "goblin_saboteur",
        role: "quest",
        where: "wild",
        group: "crow_gang"
      },
      {
        id: "rizieres_mill_ghost",
        name: "Meunier revenant",
        templateHint: "bone_reaver",
        role: "quest",
        where: "wild"
      }
    ],
    quests: [
      {
        id: "sq_riz_pigeon",
        title: "Le pigeon de Zhao",
        giver: "pigeon_zhao",
        turnIn: "pigeon_zhao",
        chain: null,
        summary: "Un pigeon voyageur s'est égaré avec un message d'importance. Cherchez-le du côté du marais puis de l'étang.",
        objectives: [
          {
            type: "talk",
            target: "toad_chan"
          },
          {
            type: "chest",
            target: "duck_pond_cache"
          }
        ]
      },
      {
        id: "sq_riz_mill_1",
        title: "Le moulin muet",
        giver: "miller_gao",
        turnIn: "miller_gao",
        chain: null,
        summary: "La roue du moulin ne tourne plus sans eau, mais un bruit étrange hante les nuits. Tante Liu en sait peut-être plus.",
        objectives: [
          {
            type: "talk",
            target: "aunt_liu"
          }
        ]
      },
      {
        id: "sq_riz_mill_2",
        title: "Le meunier revenant",
        giver: "miller_gao",
        turnIn: "miller_gao",
        chain: "sq_riz_mill_1",
        summary: "Le fantôme de l'ancien meunier refuse de quitter la roue. Apaisez-le dans les roseaux, où il rôde.",
        objectives: [
          {
            type: "kill",
            target: "rizieres_mill_ghost"
          }
        ]
      },
      {
        id: "sq_riz_mill_3",
        title: "La farine de la fête",
        giver: "miller_gao",
        turnIn: "elder_wen",
        chain: "sq_riz_mill_2",
        summary: "Le meunier veut offrir au doyen la dernière farine pour la fête de la pluie. Récupérez-la et portez-la à Dongqiao.",
        objectives: [
          {
            type: "chest",
            target: "mill_flour_bin"
          },
          {
            type: "talk",
            target: "elder_wen"
          }
        ]
      },
      {
        id: "sq_riz_corbeaux",
        title: "Les corbeaux voleurs",
        giver: "duck_fu",
        turnIn: "duck_fu",
        chain: null,
        summary: "Une bande de corbeaux-démons pille le grain des canards. Chassez-les du marais.",
        objectives: [
          {
            type: "killGroup",
            target: "crow_gang"
          }
        ]
      },
      {
        id: "sq_riz_marieuse",
        title: "Un mariage sans pluie",
        giver: "matchmaker_hong",
        turnIn: "matchmaker_hong",
        chain: null,
        summary: "Dame Hong prétend marier un buffle philosophe à un épouvantail. Comme les deux refusent, il faut faire la tournée des fiancés.",
        objectives: [
          {
            type: "talk",
            target: "buffalo_dahei"
          },
          {
            type: "talk",
            target: "scarecrow_cao"
          }
        ]
      },
      {
        id: "sq_riz_hameau",
        title: "Le hameau des lucioles",
        giver: "grandma_tao",
        turnIn: "grandma_tao",
        chain: null,
        summary: "Grand-mère Tao s'inquiète pour sa vieille amie Liu, au hameau. Allez la voir.",
        objectives: [
          {
            type: "visit",
            target: "rizieres_hamlet"
          },
          {
            type: "talk",
            target: "aunt_liu"
          }
        ]
      },
      {
        id: "sq_riz_gateau",
        title: "Les lanternes de Chang'e",
        giver: "change",
        turnIn: "miller_gao",
        chain: null,
        requires: [
          "q_sun_1"
        ],
        summary: "Chang'e prépare des lanternes pour la prochaine pleine lune, mais il lui faut de la farine et de la lumière. Rapportez une jarre de lucioles au meunier Gao.",
        objectives: [
          {
            type: "chest",
            target: "firefly_jar"
          }
        ]
      },
      {
        id: "sq_journal_1",
        title: "Une page tombée du ciel",
        giver: "grandma_tao",
        turnIn: "grandma_tao",
        chain: null,
        summary: "Une page déchirée d'un carnet traîne dans les roseaux. Grand-mère Tao croit reconnaître l'écriture de Fengmeng.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_riz"
          }
        ]
      }
    ]
  },
  fleuve: {
    hamlet: {
      id: "fleuve_hamlet",
      name: "Écluse-aux-Oies",
      mood: "Un hameau d'éclusiers perché sur une vieille digue, où les oies sauvages veillent mieux que les chiens.",
      arrival: [
        "Écluse-aux-Oies surveille un canal sans eau. Les oies, elles, continuent de monter la garde avec un sérieux de magistrats.",
        "Ici, on parle de crues comme d'anciennes amours."
      ],
      houses: [
        {
          id: "fleuve_h2_ecluse",
          name: "Maison de l'éclusier Rong",
          desc: "Une maison de bois surplombant l'écluse, pleine de leviers, de registres et d'une cloche.",
          residents: [
            "sluicekeeper_rong"
          ],
          chests: [
            "sluice_logbook_box"
          ]
        },
        {
          id: "fleuve_h2_pecheur",
          name: "Cabane de Dame Wei",
          desc: "Une cabane de raccommodeuse de filets, où pendent mille mailles et mille histoires.",
          residents: [
            "net_mender_wei"
          ],
          chests: [
            "net_basket"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "sluicekeeper_rong",
        name: "Rong",
        title: "Éclusier du fleuve",
        emoji: "🧑‍🔧",
        where: "hamlet-house:fleuve_h2_ecluse",
        role: "donneur"
      },
      {
        id: "net_mender_wei",
        name: "Dame Wei",
        title: "Raccommodeuse de filets",
        emoji: "🧶",
        where: "hamlet-house:fleuve_h2_pecheur",
        role: "donneur"
      },
      {
        id: "goose_dagong",
        name: "Dagong",
        title: "Oie sauvage vigilante",
        emoji: "🪿",
        where: "hamlet",
        role: "indice"
      },
      {
        id: "orphan_xiaoyu",
        name: "Xiaoyu",
        title: "Petit orphelin des quais",
        emoji: "🧒",
        where: "hamlet",
        role: "ambiance"
      },
      {
        id: "ferry_pei",
        name: "Pei",
        title: "Apprenti passeur",
        emoji: "🛶",
        where: "place",
        role: "ambiance"
      },
      {
        id: "fortune_sha",
        name: "Dame Sha",
        title: "Diseuse de bonne aventure",
        emoji: "🔮",
        where: "place",
        role: "ambiance"
      },
      {
        id: "poet_bo",
        name: "Bo",
        title: "Poète ivre",
        emoji: "🍶",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "tea_zhuang",
        name: "Zhuang",
        title: "Marchand de thé ambulant",
        emoji: "🍵",
        where: "place",
        role: "donneur"
      },
      {
        id: "mud_imp_pit",
        name: "Pit",
        title: "Diablotin de vase",
        emoji: "👺",
        where: "wild",
        role: "ambiance"
      },
      {
        id: "captain_lo",
        name: "Capitaine Lo",
        title: "Fantôme d'un capitaine de barge",
        emoji: "👻",
        where: "wild",
        role: "donneur"
      }
    ],
    chests: [
      {
        id: "sluice_logbook_box",
        where: "hamlet-house:fleuve_h2_ecluse",
        tier: 1,
        label: "Coffret du registre"
      },
      {
        id: "net_basket",
        where: "hamlet-house:fleuve_h2_pecheur",
        tier: 1,
        label: "Panier à filets"
      },
      {
        id: "goose_nest",
        where: "hamlet",
        tier: 1,
        label: "Nid d'oie"
      },
      {
        id: "barge_strongbox",
        where: "wild",
        tier: 2,
        label: "Coffre du capitaine"
      },
      {
        id: "reed_stash",
        where: "wild",
        tier: 2,
        label: "Cache de roseaux"
      },
      {
        id: "journal_page_fle",
        where: "wild",
        tier: 1,
        label: "Page prise dans la vase"
      }
    ],
    enemies: [
      {
        id: "barge_ghost_a",
        name: "Matelot noyé revenant",
        templateHint: "bone_reaver",
        role: "quest",
        where: "wild",
        group: "barge_ghosts"
      },
      {
        id: "barge_ghost_b",
        name: "Matelot noyé revenant",
        templateHint: "bone_reaver",
        role: "quest",
        where: "wild",
        group: "barge_ghosts"
      },
      {
        id: "mud_imp_a",
        name: "Diablotin de vase",
        templateHint: "goblin_saboteur",
        role: "quest",
        where: "wild",
        group: "mud_imps"
      },
      {
        id: "mud_imp_b",
        name: "Diablotin de vase",
        templateHint: "goblin_saboteur",
        role: "quest",
        where: "wild",
        group: "mud_imps"
      }
    ],
    quests: [
      {
        id: "sq_fle_oies",
        title: "Les oies de l'éclusier",
        giver: "sluicekeeper_rong",
        turnIn: "sluicekeeper_rong",
        chain: null,
        summary: "L'éclusier a perdu le fil de ses oies sentinelles. Retrouvez leur nid au hameau et parlez à la doyenne du troupeau.",
        objectives: [
          {
            type: "talk",
            target: "goose_dagong"
          },
          {
            type: "chest",
            target: "goose_nest"
          }
        ]
      },
      {
        id: "sq_fle_epave_1",
        title: "Le capitaine de l'épave",
        giver: "scribe_ou",
        turnIn: "scribe_ou",
        chain: null,
        summary: "Le fantôme d'un capitaine hante les méandres, une promesse non tenue sur le cœur. Écoutez-le.",
        objectives: [
          {
            type: "talk",
            target: "captain_lo"
          }
        ]
      },
      {
        id: "sq_fle_epave_2",
        title: "Les matelots noyés",
        giver: "scribe_ou",
        turnIn: "scribe_ou",
        chain: "sq_fle_epave_1",
        summary: "L'équipage noyé du capitaine retient son esprit. Dissipez les deux matelots revenants.",
        objectives: [
          {
            type: "killGroup",
            target: "barge_ghosts"
          }
        ]
      },
      {
        id: "sq_fle_epave_3",
        title: "L'héritage de Gu",
        giver: "scribe_ou",
        turnIn: "ferryman_gu",
        chain: "sq_fle_epave_2",
        summary: "Le coffre du capitaine contient l'héritage promis au passeur Gu. Remettez-le à son destinataire.",
        objectives: [
          {
            type: "chest",
            target: "barge_strongbox"
          },
          {
            type: "talk",
            target: "ferryman_gu"
          }
        ]
      },
      {
        id: "sq_fle_poeme",
        title: "Le poème du fleuve",
        giver: "poet_bo",
        turnIn: "poet_bo",
        chain: null,
        summary: "Le poète Bo cherche des rimes pour son poème du fleuve. Recueillez-en trois auprès de la fillette, du batelier et de la vieille tortue.",
        objectives: [
          {
            type: "talk",
            target: "girl_lian"
          },
          {
            type: "talk",
            target: "boatman_shan"
          },
          {
            type: "talk",
            target: "gui_turtle"
          }
        ]
      },
      {
        id: "sq_fle_the",
        title: "Le thé qui voyage",
        giver: "tea_zhuang",
        turnIn: "tea_zhuang",
        chain: null,
        summary: "Zhuang doit livrer deux sachets de thé de grand cru, l'un à la tisserande, l'autre à la raccommodeuse. Il n'a plus de jambes.",
        objectives: [
          {
            type: "talk",
            target: "weaver_mei"
          },
          {
            type: "talk",
            target: "net_mender_wei"
          }
        ]
      },
      {
        id: "sq_fle_boue",
        title: "Les diablotins de la vase",
        giver: "net_mender_wei",
        turnIn: "net_mender_wei",
        chain: null,
        summary: "Des diablotins de vase dévorent les filets de Dame Wei. Dispersez-les.",
        objectives: [
          {
            type: "killGroup",
            target: "mud_imps"
          }
        ]
      },
      {
        id: "sq_fle_golem",
        title: "Le golem de l'écluse",
        giver: "sluicekeeper_rong",
        turnIn: "sluicekeeper_rong",
        chain: null,
        requires: [
          "q_sun_2"
        ],
        summary: "Un golem de fer rouillé bloque la grande vanne de l'écluse. Débarrassez-en le fleuve.",
        objectives: [
          {
            type: "kill",
            target: "fleuve_sluice_golem"
          }
        ]
      },
      {
        id: "sq_journal_2",
        title: "Le carnet dans la vase",
        giver: "scribe_ou",
        turnIn: "scribe_ou",
        chain: "sq_journal_1",
        summary: "Une deuxième page du carnet de Fengmeng est coincée dans la vase des méandres. Maître Ou la lira avec vous.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_fle"
          }
        ]
      }
    ]
  },
  bambous: {
    hamlet: {
      id: "bambous_hamlet",
      name: "Clairière des Lampions",
      mood: "Une clairière épargnée par les flammes, où des lanternes de papier pendent aux tiges comme des fruits pâles.",
      arrival: [
        "La Clairière des Lampions a gardé un coin de vert dans la forêt calcinée. Des lanternes de papier se balancent aux branches, sans qu'on sache qui les allume.",
        "Un sentier discret la rattache au sentier cendré, comme un secret entre amis."
      ],
      houses: [
        {
          id: "bambous_h2_lanterne",
          name: "Atelier du lanternier Fa",
          desc: "Un atelier tapissé de papier translucide, de colle et de cire.",
          residents: [
            "lanternier_fa"
          ],
          chests: [
            "lantern_box"
          ]
        },
        {
          id: "bambous_h2_sculpteur",
          name: "Maison de la sculptrice Ling",
          desc: "Une maison encombrée de statuettes de bambou, certaines très ressemblantes, d'autres moins.",
          residents: [
            "carver_ling"
          ],
          chests: [
            "carver_chest"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "lanternier_fa",
        name: "Fa",
        title: "Lanternier",
        emoji: "🏮",
        where: "hamlet-house:bambous_h2_lanterne",
        role: "donneur"
      },
      {
        id: "carver_ling",
        name: "Ling",
        title: "Sculptrice de bambou",
        emoji: "🪚",
        where: "hamlet-house:bambous_h2_sculpteur",
        role: "donneur"
      },
      {
        id: "panda_baobao",
        name: "Baobao",
        title: "Bébé panda",
        emoji: "🐼",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "beekeeper_ju",
        name: "Ju",
        title: "Apicultrice",
        emoji: "🐝",
        where: "hamlet",
        role: "indice"
      },
      {
        id: "archer_huo",
        name: "Huo",
        title: "Vieil archer retraité",
        emoji: "🏹",
        where: "hamlet",
        role: "indice"
      },
      {
        id: "young_monk_zhi",
        name: "Zhi",
        title: "Jeune moine novice",
        emoji: "🧑‍🦲",
        where: "place",
        role: "ambiance"
      },
      {
        id: "scholar_dong",
        name: "Dong",
        title: "Lettré vagabond",
        emoji: "🎓",
        where: "place",
        role: "ambiance"
      },
      {
        id: "stem_sprite",
        name: "Tigelle",
        title: "Esprit de tige",
        emoji: "🎋",
        where: "wild",
        role: "ambiance"
      },
      {
        id: "snake_qing",
        name: "Dame Qing",
        title: "Serpente blanche lettrée",
        emoji: "🐍",
        where: "wild",
        role: "donneur"
      },
      {
        id: "cricket_boy_hao",
        name: "Hao",
        title: "Petit éleveur de grillons",
        emoji: "🦗",
        where: "hamlet",
        role: "ambiance"
      }
    ],
    chests: [
      {
        id: "lantern_box",
        where: "hamlet-house:bambous_h2_lanterne",
        tier: 1,
        label: "Boîte à lampions"
      },
      {
        id: "carver_chest",
        where: "hamlet-house:bambous_h2_sculpteur",
        tier: 2,
        label: "Coffre de la sculptrice"
      },
      {
        id: "honey_hive",
        where: "hamlet",
        tier: 1,
        label: "Ruche de cendre"
      },
      {
        id: "hidden_grove_chest",
        where: "wild",
        tier: 2,
        label: "Coffre du bosquet caché"
      },
      {
        id: "ash_urn",
        where: "wild",
        tier: 3,
        label: "Urne de cendre"
      },
      {
        id: "journal_page_bam",
        where: "wild",
        tier: 1,
        label: "Page coincée dans une tige"
      }
    ],
    enemies: [
      {
        id: "bambous_ash_shadow_a",
        name: "Ombre des cendres",
        templateHint: "shadow_assassin",
        role: "quest",
        where: "wild",
        group: "ash_shadows"
      },
      {
        id: "bambous_ash_shadow_b",
        name: "Ombre des cendres",
        templateHint: "shadow_assassin",
        role: "quest",
        where: "wild",
        group: "ash_shadows"
      },
      {
        id: "bambous_lantern_thief",
        name: "Xiao Gui voleur de lampions",
        templateHint: "goblin_saboteur",
        role: "quest",
        where: "wild"
      }
    ],
    quests: [
      {
        id: "sq_bam_lampions_1",
        title: "Du papier pour les lampions",
        giver: "lanternier_fa",
        turnIn: "lanternier_fa",
        chain: null,
        summary: "Le lanternier Fa manque de papier. Allez en demander au vieux Ke, à la papeterie.",
        objectives: [
          {
            type: "talk",
            target: "ke_paper"
          }
        ]
      },
      {
        id: "sq_bam_lampions_2",
        title: "Le voleur de lampions",
        giver: "lanternier_fa",
        turnIn: "lanternier_fa",
        chain: "sq_bam_lampions_1",
        summary: "Un Xiao Gui chaparde les lampions finis. Retrouvez-le sur le sentier cendré.",
        objectives: [
          {
            type: "kill",
            target: "bambous_lantern_thief"
          }
        ]
      },
      {
        id: "sq_bam_lampions_3",
        title: "Le lampion d'or",
        giver: "lanternier_fa",
        turnIn: "lanternier_fa",
        chain: "sq_bam_lampions_2",
        summary: "Pour la fête, Fa rêve d'un lampion d'or. Il se cache dans un bosquet que le feu a oublié.",
        objectives: [
          {
            type: "chest",
            target: "hidden_grove_chest"
          }
        ]
      },
      {
        id: "sq_bam_panda",
        title: "Le miel de Baobao",
        giver: "panda_baobao",
        turnIn: "panda_baobao",
        chain: null,
        summary: "Un bébé panda réclame du miel, mais ne parle pas. Trouvez la ruche de l'apicultrice et expliquez à Ju.",
        objectives: [
          {
            type: "talk",
            target: "beekeeper_ju"
          },
          {
            type: "chest",
            target: "honey_hive"
          }
        ]
      },
      {
        id: "sq_bam_ombres",
        title: "Les ombres du temple",
        giver: "monk_zhen",
        turnIn: "monk_zhen",
        chain: null,
        requires: [
          "q_sun_3"
        ],
        summary: "Deux ombres des cendres tourmentent les pèlerins. Chassez-les du sentier.",
        objectives: [
          {
            type: "killGroup",
            target: "ash_shadows"
          }
        ]
      },
      {
        id: "sq_bam_sculpture",
        title: "Le modèle de Ling",
        giver: "carver_ling",
        turnIn: "carver_ling",
        chain: null,
        summary: "La sculptrice cherche trois modèles pour sa statue du village : une tenancière, une papetière, un lettré.",
        objectives: [
          {
            type: "talk",
            target: "lady_lan"
          },
          {
            type: "talk",
            target: "apprentice_zhu"
          },
          {
            type: "talk",
            target: "scholar_dong"
          }
        ]
      },
      {
        id: "sq_bam_qing",
        title: "La lettre de Dame Qing",
        giver: "snake_qing",
        turnIn: "snake_qing",
        chain: null,
        summary: "Dame Qing veut rouvrir une urne ancienne où dort une lettre d'amour. Elle a besoin d'un remède, puis d'un archer.",
        objectives: [
          {
            type: "talk",
            target: "herbalist_xu"
          },
          {
            type: "chest",
            target: "ash_urn"
          }
        ]
      },
      {
        id: "sq_bam_lettre",
        title: "Le courrier du hameau",
        giver: "lady_lan",
        turnIn: "monk_zhen",
        chain: null,
        summary: "Dame Lan veut faire passer une lettre au vieux Huo, au hameau, et obtenir sa réponse pour Maître Zhen.",
        objectives: [
          {
            type: "talk",
            target: "archer_huo"
          },
          {
            type: "talk",
            target: "monk_zhen"
          }
        ]
      },
      {
        id: "sq_journal_3",
        title: "La page dans la tige",
        giver: "lady_lan",
        turnIn: "lady_lan",
        chain: "sq_journal_2",
        summary: "Une troisième page est roulée dans une tige creuse du sentier. Dame Lan, qui sait tout, vous en parle.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_bam"
          }
        ]
      }
    ]
  },
  gobi: {
    hamlet: {
      id: "gobi_hamlet",
      name: "Oasis de Yuquan",
      mood: "Une oasis minuscule où quelques palmiers et un puits de jade tiennent tête à l'immensité.",
      arrival: [
        "Yuquan, la « Source de Jade », est la seule tache verte à l'horizon. Une dizaine de familles s'y partagent un puits, des dattes et une quantité raisonnable de rancunes.",
        "Un sentier de sable ferme la rattache aux dunes."
      ],
      houses: [
        {
          id: "gobi_h2_puits",
          name: "Maison du puisatier Omar",
          desc: "Une maison fraîche aux murs épais, construite autour d'un puits à poulie.",
          residents: [
            "well_digger_omar"
          ],
          chests: [
            "well_coin_box"
          ]
        },
        {
          id: "gobi_h2_tapis",
          name: "Boutique de tapis de Zeynep",
          desc: "Une boutique où les tapis s'empilent jusqu'au plafond, chacun avec sa légende.",
          residents: [
            "rug_seller_zeynep"
          ],
          chests: [
            "rug_chest"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "well_digger_omar",
        name: "Omar",
        title: "Puisatier",
        emoji: "⛏️",
        where: "hamlet-house:gobi_h2_puits",
        role: "donneur"
      },
      {
        id: "rug_seller_zeynep",
        name: "Zeynep",
        title: "Marchande de tapis",
        emoji: "🧶",
        where: "hamlet-house:gobi_h2_tapis",
        role: "donneur"
      },
      {
        id: "date_farmer_ismail",
        name: "Ismail",
        title: "Cultivateur de dattes",
        emoji: "🌴",
        where: "hamlet",
        role: "ambiance"
      },
      {
        id: "girl_noor",
        name: "Noor",
        title: "Fillette aux yeux de sable",
        emoji: "👧",
        where: "hamlet",
        role: "ambiance"
      },
      {
        id: "caravan_cook_lu",
        name: "Lu",
        title: "Cuisinier de caravane",
        emoji: "🍲",
        where: "place",
        role: "donneur"
      },
      {
        id: "falconer_arslan",
        name: "Arslan",
        title: "Fauconnier",
        emoji: "🦅",
        where: "place",
        role: "ambiance"
      },
      {
        id: "oracle_ahmad",
        name: "Ahmad",
        title: "Devin de la source",
        emoji: "🧙",
        where: "hamlet",
        role: "indice"
      },
      {
        id: "lost_pilgrim_ren",
        name: "Ren",
        title: "Pèlerin égaré",
        emoji: "🧳",
        where: "wild",
        role: "donneur"
      },
      {
        id: "fennec_lili",
        name: "Lili",
        title: "Fennec bavard",
        emoji: "🦊",
        where: "wild",
        role: "ambiance"
      },
      {
        id: "camel_foreman_tang",
        name: "Tang",
        title: "Chef d'étape de la caravane",
        emoji: "🧔",
        where: "place",
        role: "ambiance"
      }
    ],
    chests: [
      {
        id: "well_coin_box",
        where: "hamlet-house:gobi_h2_puits",
        tier: 1,
        label: "Boîte aux vœux du puits"
      },
      {
        id: "rug_chest",
        where: "hamlet-house:gobi_h2_tapis",
        tier: 2,
        label: "Coffre sous les tapis"
      },
      {
        id: "date_basket",
        where: "hamlet",
        tier: 1,
        label: "Panier de dattes"
      },
      {
        id: "sand_obelisk",
        where: "wild",
        tier: 2,
        label: "Obélisque enfoui"
      },
      {
        id: "bandit_stash",
        where: "wild",
        tier: 3,
        label: "Cache des brigands"
      },
      {
        id: "journal_page_gob",
        where: "wild",
        tier: 1,
        label: "Page prise dans le sable"
      }
    ],
    enemies: [
      {
        id: "gobi_camel_thief",
        name: "Voleur de chameaux",
        templateHint: "shadow_assassin",
        role: "quest",
        where: "wild"
      },
      {
        id: "gobi_lost_a",
        name: "Caravanier squelette",
        templateHint: "bone_reaver",
        role: "quest",
        where: "wild",
        group: "lost_caravan"
      },
      {
        id: "gobi_lost_b",
        name: "Caravanier squelette",
        templateHint: "bone_reaver",
        role: "quest",
        where: "wild",
        group: "lost_caravan"
      }
    ],
    quests: [
      {
        id: "sq_gob_chameau_1",
        title: "Le chameau de Ma",
        giver: "merchant_ma",
        turnIn: "merchant_ma",
        chain: null,
        summary: "Le chameau le plus cher de Ma a disparu. Interrogez Baba, le chameau diplomate, qui sait toujours tout.",
        objectives: [
          {
            type: "talk",
            target: "camel_baba"
          }
        ]
      },
      {
        id: "sq_gob_chameau_2",
        title: "Le voleur de chameaux",
        giver: "merchant_ma",
        turnIn: "merchant_ma",
        chain: "sq_gob_chameau_1",
        summary: "Le voleur de chameaux se cache dans les dunes. Retrouvez-le.",
        objectives: [
          {
            type: "kill",
            target: "gobi_camel_thief"
          }
        ]
      },
      {
        id: "sq_gob_chameau_3",
        title: "Le butin des brigands",
        giver: "merchant_ma",
        turnIn: "merchant_ma",
        chain: "sq_gob_chameau_2",
        summary: "En fouillant la cache du voleur, vous pouvez rendre aux caravaniers ce qu'on leur a pris.",
        objectives: [
          {
            type: "chest",
            target: "bandit_stash"
          }
        ]
      },
      {
        id: "sq_gob_puits",
        title: "Qui boit l'eau du puits ?",
        giver: "well_digger_omar",
        turnIn: "well_digger_omar",
        chain: null,
        summary: "Le niveau du puits baisse trop vite. Enquêtez auprès de la gardienne, du petit passeur d'eau et du chameau.",
        objectives: [
          {
            type: "talk",
            target: "keeper_nur"
          },
          {
            type: "talk",
            target: "boy_tarik"
          },
          {
            type: "talk",
            target: "camel_baba"
          }
        ]
      },
      {
        id: "sq_gob_tapis",
        title: "Le tapis volant de Zeynep",
        giver: "rug_seller_zeynep",
        turnIn: "rug_seller_zeynep",
        chain: null,
        summary: "Zeynep veut vendre son tapis volant à Ma, mais il faut d'abord le sortir du coffre.",
        objectives: [
          {
            type: "chest",
            target: "rug_chest"
          },
          {
            type: "talk",
            target: "merchant_ma"
          }
        ]
      },
      {
        id: "sq_gob_caravane",
        title: "La caravane fantôme",
        giver: "guide_dawa",
        turnIn: "guide_dawa",
        chain: null,
        requires: [
          "q_sun_4"
        ],
        summary: "Deux caravaniers squelettes vagabondent dans les dunes. Libérez-les.",
        objectives: [
          {
            type: "killGroup",
            target: "lost_caravan"
          }
        ]
      },
      {
        id: "sq_gob_pelerin",
        title: "La femme du pèlerin",
        giver: "guide_dawa",
        turnIn: "lost_pilgrim_ren",
        chain: null,
        summary: "Un pèlerin égaré dans les dunes cherche la route du Kunlun, pour demander un élixir à la Reine Mère. Il se fie au fennec Lili.",
        objectives: [
          {
            type: "talk",
            target: "fennec_lili"
          },
          {
            type: "talk",
            target: "lost_pilgrim_ren"
          }
        ]
      },
      {
        id: "sq_gob_cuisine",
        title: "La soupe à l'oasis",
        giver: "caravan_cook_lu",
        turnIn: "caravan_cook_lu",
        chain: null,
        summary: "Lu veut cuisiner une soupe de fête, mais il lui manque des dattes et de l'eau fraîche.",
        objectives: [
          {
            type: "chest",
            target: "date_basket"
          },
          {
            type: "talk",
            target: "boy_tarik"
          }
        ]
      },
      {
        id: "sq_journal_4",
        title: "La carte vendue",
        giver: "mapmaker_ali",
        turnIn: "mapmaker_ali",
        chain: "sq_journal_3",
        summary: "Ali se souvient d'un jeune archer qui lui a acheté une carte de la route du Kunlun. Une page du carnet traîne dans le sable.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_gob"
          }
        ]
      }
    ]
  },
  tonnerre: {
    hamlet: {
      id: "tonnerre_hamlet",
      name: "Refuge des Trois Cairns",
      mood: "Trois cairns, quelques cabanes de pierre et un vent qui récite des psaumes : le dernier abri avant les hauteurs.",
      arrival: [
        "Le Refuge des Trois Cairns n'a que trois cairns, quatre cabanes et mille opinions sur la météo. Chaque voyageur y laisse un caillou et en emporte un autre.",
        "Un sentier de pierre le relie aux crêtes, à l'écart du village."
      ],
      houses: [
        {
          id: "tonnerre_h2_garde",
          name: "Poste du garde de col",
          desc: "Un poste fortifié minuscule, avec un feu, une cloche et un registre des passants.",
          residents: [
            "pass_guard_kuang"
          ],
          chests: [
            "guard_post_box"
          ]
        },
        {
          id: "tonnerre_h2_verre",
          name: "Verrerie de la foudre",
          desc: "Un atelier de verre où l'on fond le sable foudroyé en vitraux de tempête.",
          residents: [
            "glassblower_ouyang"
          ],
          chests: [
            "glass_chest"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "pass_guard_kuang",
        name: "Kuang",
        title: "Garde du col",
        emoji: "💂",
        where: "hamlet-house:tonnerre_h2_garde",
        role: "donneur"
      },
      {
        id: "glassblower_ouyang",
        name: "Ouyang",
        title: "Souffleur de verre",
        emoji: "🫧",
        where: "hamlet-house:tonnerre_h2_verre",
        role: "donneur"
      },
      {
        id: "goat_yang",
        name: "Yang",
        title: "Chèvre de montagne bavarde",
        emoji: "🐐",
        where: "hamlet",
        role: "ambiance"
      },
      {
        id: "climber_dai",
        name: "Dai",
        title: "Alpiniste solitaire",
        emoji: "🧗",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "fairy_yun",
        name: "Yunxi",
        title: "Fée des nuages",
        emoji: "☁️",
        where: "wild",
        role: "indice"
      },
      {
        id: "bard_xiang",
        name: "Xiang",
        title: "Barde du vent",
        emoji: "🪕",
        where: "place",
        role: "ambiance"
      },
      {
        id: "rain_pu",
        name: "Pu",
        title: "Marchand de pluie",
        emoji: "🌧️",
        where: "place",
        role: "donneur"
      },
      {
        id: "keeper_ao",
        name: "Ao",
        title: "Gardien des cairns",
        emoji: "🪨",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "porter_san",
        name: "San",
        title: "Porteur de montagne",
        emoji: "🎒",
        where: "place",
        role: "ambiance"
      },
      {
        id: "pup_tuan",
        name: "Tuantuan",
        title: "Chiot d'orage",
        emoji: "🐕",
        where: "wild",
        role: "ambiance"
      }
    ],
    chests: [
      {
        id: "guard_post_box",
        where: "hamlet-house:tonnerre_h2_garde",
        tier: 1,
        label: "Caisse du poste"
      },
      {
        id: "glass_chest",
        where: "hamlet-house:tonnerre_h2_verre",
        tier: 2,
        label: "Coffre du souffleur"
      },
      {
        id: "goat_shed",
        where: "hamlet",
        tier: 1,
        label: "Abri de la chèvre"
      },
      {
        id: "thunder_urn",
        where: "wild",
        tier: 2,
        label: "Urne de sable foudroyé"
      },
      {
        id: "peak_cache",
        where: "wild",
        tier: 3,
        label: "Cache du sommet"
      },
      {
        id: "journal_page_ton",
        where: "wild",
        tier: 1,
        label: "Page prise entre deux rochers"
      }
    ],
    enemies: [
      {
        id: "tonnerre_wyrm_calf",
        name: "Serpenteau d'orage",
        templateHint: "storm_wyrm",
        role: "quest",
        where: "wild"
      },
      {
        id: "tonnerre_rider_a",
        name: "Cavalier de l'orage",
        templateHint: "storm_knight",
        role: "quest",
        where: "wild",
        group: "storm_riders"
      },
      {
        id: "tonnerre_rider_b",
        name: "Cavalier de l'orage",
        templateHint: "storm_knight",
        role: "quest",
        where: "wild",
        group: "storm_riders"
      }
    ],
    quests: [
      {
        id: "sq_ton_verre_1",
        title: "Le sable qui brille",
        giver: "glassblower_ouyang",
        turnIn: "glassblower_ouyang",
        chain: null,
        summary: "Ouyang a besoin de sable foudroyé pour son prochain vitrail. L'urne de fulgurite est sur les crêtes.",
        objectives: [
          {
            type: "chest",
            target: "thunder_urn"
          }
        ]
      },
      {
        id: "sq_ton_verre_2",
        title: "Le serpenteau chapardeur",
        giver: "glassblower_ouyang",
        turnIn: "glassblower_ouyang",
        chain: "sq_ton_verre_1",
        summary: "Un serpenteau d'orage a pris goût au verre et grignote les vitraux. Chassez-le des crêtes.",
        objectives: [
          {
            type: "kill",
            target: "tonnerre_wyrm_calf"
          }
        ]
      },
      {
        id: "sq_ton_verre_3",
        title: "Le verre de Tie",
        giver: "glassblower_ouyang",
        turnIn: "glassblower_ouyang",
        chain: "sq_ton_verre_2",
        summary: "Un verre de foudre est prêt : portez-le au forgeron Tie, qui veut en faire un œil de flèche.",
        objectives: [
          {
            type: "talk",
            target: "smith_tie"
          }
        ]
      },
      {
        id: "sq_ton_pluie",
        title: "La pluie de Pu",
        giver: "rain_pu",
        turnIn: "rain_pu",
        chain: null,
        summary: "Le marchand de pluie voudrait de la vraie pluie. Interrogez l'ermite, la fée des nuages et la petite Leimei.",
        objectives: [
          {
            type: "talk",
            target: "hermit_lei"
          },
          {
            type: "talk",
            target: "fairy_yun"
          },
          {
            type: "talk",
            target: "kids_leimei"
          }
        ]
      },
      {
        id: "sq_ton_cavaliers",
        title: "Les cavaliers de l'orage",
        giver: "pass_guard_kuang",
        turnIn: "pass_guard_kuang",
        chain: null,
        requires: [
          "q_sun_5"
        ],
        summary: "Deux cavaliers de l'orage rançonnent les passants du col. Mettez fin à leurs chevauchées.",
        objectives: [
          {
            type: "killGroup",
            target: "storm_riders"
          }
        ]
      },
      {
        id: "sq_ton_chevre",
        title: "La chèvre qui n'en fait qu'à sa tête",
        giver: "keeper_ao",
        turnIn: "keeper_ao",
        chain: null,
        summary: "La chèvre Yang a laissé tomber le caillou des offrandes dans un abri. Récupérez-le.",
        objectives: [
          {
            type: "talk",
            target: "goat_yang"
          },
          {
            type: "chest",
            target: "goat_shed"
          }
        ]
      },
      {
        id: "sq_ton_lion",
        title: "Le lion fendu",
        giver: "nun_ying",
        turnIn: "nun_ying",
        chain: null,
        summary: "Un lion-gardien de pierre fendu par la foudre tourmente la chapelle. Calmez-le.",
        objectives: [
          {
            type: "kill",
            target: "tonnerre_stone_lion"
          }
        ]
      },
      {
        id: "sq_ton_dai",
        title: "Le frère de Dai",
        giver: "climber_dai",
        turnIn: "climber_dai",
        chain: null,
        summary: "Dai cherche la cache de son frère, perdue au sommet. Il n'ose pas y monter seul.",
        objectives: [
          {
            type: "visit",
            target: "tonnerre_wild"
          },
          {
            type: "chest",
            target: "peak_cache"
          }
        ]
      },
      {
        id: "sq_journal_5",
        title: "Une page entre deux rochers",
        giver: "innkeeper_pao",
        turnIn: "innkeeper_pao",
        chain: "sq_journal_4",
        summary: "Pao a vu un jeune archer fourrer un papier entre deux rochers. Retrouvez-le.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_ton"
          }
        ]
      }
    ]
  },
  volcan: {
    hamlet: {
      id: "volcan_hamlet",
      name: "Sources Tièdes",
      mood: "Un hameau de bains et de vapeurs, niché dans un repli des gorges, où l'on soigne les brûlures par d'autres brûlures.",
      arrival: [
        "Aux Sources Tièdes, tout le monde sent le soufre et le savon. Les geysers y sont domestiqués, plus ou moins.",
        "Un sentier de basalte les relie aux coulées, en bordure du vacarme."
      ],
      houses: [
        {
          id: "volcan_h2_alchimiste",
          name: "Laboratoire de l'alchimiste Dan",
          desc: "Un laboratoire encombré de cornues, de cinabre et d'un four qui parle tout seul.",
          residents: [
            "alchemist_dan"
          ],
          chests: [
            "alchemy_chest"
          ]
        },
        {
          id: "volcan_h2_chauffeur",
          name: "Chaufferie de Ge",
          desc: "Une chaufferie qui alimente les bains en vapeur, tenue par un homme taciturne.",
          residents: [
            "stoker_ge"
          ],
          chests: [
            "stoker_box"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "alchemist_dan",
        name: "Dan",
        title: "Alchimiste du cinabre",
        emoji: "⚗️",
        where: "hamlet-house:volcan_h2_alchimiste",
        role: "donneur"
      },
      {
        id: "stoker_ge",
        name: "Ge",
        title: "Chauffeur des bains",
        emoji: "🔥",
        where: "hamlet-house:volcan_h2_chauffeur",
        role: "donneur"
      },
      {
        id: "geologist_zhou",
        name: "Zhou",
        title: "Géologue des gorges",
        emoji: "🪨",
        where: "place",
        role: "donneur"
      },
      {
        id: "widow_cai",
        name: "Dame Cai",
        title: "Veuve au grand cœur",
        emoji: "👩",
        where: "place",
        role: "ambiance"
      },
      {
        id: "bath_mu",
        name: "Mu",
        title: "Gardienne des bains",
        emoji: "🛁",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "dragonet_xiaohong",
        name: "Xiaohong",
        title: "Petit dragon de braise",
        emoji: "🐲",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "courier_tong",
        name: "Tong",
        title: "Messager des gorges",
        emoji: "📮",
        where: "place",
        role: "ambiance"
      },
      {
        id: "lava_fish_bi",
        name: "Bi",
        title: "Poisson de lave",
        emoji: "🐟",
        where: "wild",
        role: "ambiance"
      },
      {
        id: "ghost_miner_shu",
        name: "Vieux Shu",
        title: "Fantôme de mineur",
        emoji: "👻",
        where: "wild",
        role: "indice"
      },
      {
        id: "bath_old_wang",
        name: "Grand-père Wang",
        title: "Vieux baigneur du hameau",
        emoji: "🧓",
        where: "hamlet",
        role: "ambiance"
      }
    ],
    chests: [
      {
        id: "alchemy_chest",
        where: "hamlet-house:volcan_h2_alchimiste",
        tier: 2,
        label: "Coffre de l'alchimiste"
      },
      {
        id: "stoker_box",
        where: "hamlet-house:volcan_h2_chauffeur",
        tier: 1,
        label: "Boîte du chauffeur"
      },
      {
        id: "hot_spring_chest",
        where: "hamlet",
        tier: 1,
        label: "Coffre des bains"
      },
      {
        id: "obsidian_cache",
        where: "wild",
        tier: 2,
        label: "Cache d'obsidienne"
      },
      {
        id: "cinnabar_vault",
        where: "wild",
        tier: 3,
        label: "Caveau de cinabre"
      },
      {
        id: "journal_page_vol",
        where: "wild",
        tier: 1,
        label: "Page coincée dans une fissure"
      }
    ],
    enemies: [
      {
        id: "volcan_hound_a",
        name: "Chien de magma",
        templateHint: "ember_wolf",
        role: "quest",
        where: "wild",
        group: "magma_hounds"
      },
      {
        id: "volcan_hound_b",
        name: "Chien de magma",
        templateHint: "ember_wolf",
        role: "quest",
        where: "wild",
        group: "magma_hounds"
      },
      {
        id: "volcan_obsidian_guard",
        name: "Soldat d'obsidienne",
        templateHint: "iron_gladiator",
        role: "quest",
        where: "wild"
      }
    ],
    quests: [
      {
        id: "sq_vol_alchimie_1",
        title: "Le cinabre d'Occident",
        giver: "alchemist_dan",
        turnIn: "alchemist_dan",
        chain: null,
        summary: "Dan a besoin d'une herbe rare cultivée par l'herboriste Xu, dans la forêt de bambous. Allez la lui demander.",
        objectives: [
          {
            type: "talk",
            target: "herbalist_xu"
          }
        ]
      },
      {
        id: "sq_vol_alchimie_2",
        title: "Les chiens de magma",
        giver: "alchemist_dan",
        turnIn: "alchemist_dan",
        chain: "sq_vol_alchimie_1",
        summary: "Deux chiens de magma ont fui de leur cage et dévorent le cinabre. Chassez-les.",
        objectives: [
          {
            type: "killGroup",
            target: "magma_hounds"
          }
        ]
      },
      {
        id: "sq_vol_alchimie_3",
        title: "Le grand œuvre",
        giver: "alchemist_dan",
        turnIn: "alchemist_dan",
        chain: "sq_vol_alchimie_2",
        summary: "Pour terminer son grand œuvre, Dan a besoin d'un caveau de cinabre que seul un archer osera ouvrir.",
        objectives: [
          {
            type: "chest",
            target: "cinnabar_vault"
          }
        ]
      },
      {
        id: "sq_vol_farceur",
        title: "Le farceur des cendres",
        giver: "cook_dada",
        turnIn: "cook_dada",
        chain: null,
        summary: "Un Xiao Gui des cendres vole les bols de la cantine. Faites-lui regretter son appétit.",
        objectives: [
          {
            type: "kill",
            target: "volcan_ember_imp"
          }
        ]
      },
      {
        id: "sq_vol_geologue",
        title: "Les trois témoins",
        giver: "geologist_zhou",
        turnIn: "geologist_zhou",
        chain: null,
        summary: "Zhou veut savoir d'où vient la chaleur des gorges. Il interroge un mineur, un jeune et un fantôme.",
        objectives: [
          {
            type: "talk",
            target: "miner_shan"
          },
          {
            type: "talk",
            target: "young_miner_bo"
          },
          {
            type: "talk",
            target: "ghost_miner_shu"
          }
        ]
      },
      {
        id: "sq_vol_poisson",
        title: "Le poisson dans le bain",
        giver: "bath_mu",
        turnIn: "bath_mu",
        chain: null,
        summary: "Un poisson de lave a pris goût aux bains. Parlez-lui, puis ouvrez le coffre au fond du bassin.",
        objectives: [
          {
            type: "talk",
            target: "lava_fish_bi"
          },
          {
            type: "chest",
            target: "hot_spring_chest"
          }
        ]
      },
      {
        id: "sq_vol_dragonnet",
        title: "L'œuf de la sœur",
        giver: "priestess_yan",
        turnIn: "priestess_yan",
        chain: null,
        summary: "Un dragonnet a égaré l'œuf de sa sœur. Elle risque de le dévorer. Cherchez l'œuf et réconciliez-les.",
        objectives: [
          {
            type: "talk",
            target: "dragonet_xiaohong"
          },
          {
            type: "chest",
            target: "obsidian_cache"
          }
        ]
      },
      {
        id: "sq_vol_obsidienne",
        title: "Les soldats d'obsidienne",
        giver: "potter_rui",
        turnIn: "potter_rui",
        chain: null,
        requires: [
          "q_sun_6"
        ],
        summary: "Un soldat d'obsidienne casse les vases du potier. Débarrassez-en les gorges.",
        objectives: [
          {
            type: "kill",
            target: "volcan_obsidian_guard"
          }
        ]
      },
      {
        id: "sq_journal_6",
        title: "La page brûlée",
        giver: "bather_fei",
        turnIn: "bather_fei",
        chain: "sq_journal_5",
        summary: "Une page du carnet de Fengmeng, brûlée aux coins, est coincée dans une fissure des coulées.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_vol"
          }
        ]
      }
    ]
  },
  fauves: {
    hamlet: {
      id: "fauves_hamlet",
      name: "Campement des Vents",
      mood: "Un cercle de yourtes aux toits de feutre qui change de place avec les saisons, mais jamais d'avis.",
      arrival: [
        "Le Campement des Vents se déplace avec les saisons ; aujourd'hui, il campe derrière un pli de la plaine. Les yourtes fument doucement, comme des théières géantes.",
        "Une piste d'herbe piétinée rejoint les hautes herbes."
      ],
      houses: [
        {
          id: "fauves_h2_feutre",
          name: "Yourte d'Uyun la feutrière",
          desc: "Une yourte tendue de feutres de toutes les couleurs, qui sent la laine mouillée et la patience.",
          residents: [
            "felt_maker_uyun"
          ],
          chests: [
            "felt_chest"
          ]
        },
        {
          id: "fauves_h2_marechal",
          name: "Forge du maréchal Batu",
          desc: "Une forge de nomades, montée sur chariot, qui sent le fer chaud et le crottin.",
          residents: [
            "farrier_batu"
          ],
          chests: [
            "farrier_box"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "felt_maker_uyun",
        name: "Uyun",
        title: "Feutrière",
        emoji: "🧶",
        where: "hamlet-house:fauves_h2_feutre",
        role: "donneur"
      },
      {
        id: "farrier_batu",
        name: "Batu",
        title: "Maréchal-ferrant",
        emoji: "🐴",
        where: "hamlet-house:fauves_h2_marechal",
        role: "donneur"
      },
      {
        id: "eagle_boy_temur",
        name: "Temur",
        title: "Petit dresseur d'aigle",
        emoji: "🦅",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "grandma_altan",
        name: "Grand-mère Altan",
        title: "Chanteuse des berceuses",
        emoji: "🧓",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "mare_chagan",
        name: "Chagan",
        title: "Jument blanche bavarde",
        emoji: "🐎",
        where: "hamlet",
        role: "ambiance"
      },
      {
        id: "bandit_gerel",
        name: "Gerel",
        title: "Ancien bandit repenti",
        emoji: "🥷",
        where: "place",
        role: "donneur"
      },
      {
        id: "drover_boldo",
        name: "Boldo",
        title: "Conducteur de troupeaux",
        emoji: "🐂",
        where: "place",
        role: "ambiance"
      },
      {
        id: "traveler_hui",
        name: "Hui",
        title: "Voyageur marchand d'épices",
        emoji: "🌶️",
        where: "place",
        role: "ambiance"
      },
      {
        id: "wolf_pup_baatar",
        name: "Baatar",
        title: "Louveteau de braise",
        emoji: "🐺",
        where: "wild",
        role: "ambiance"
      },
      {
        id: "ghost_rider_tolui",
        name: "Tolui",
        title: "Fantôme d'un cavalier",
        emoji: "👻",
        where: "wild",
        role: "donneur"
      }
    ],
    chests: [
      {
        id: "felt_chest",
        where: "hamlet-house:fauves_h2_feutre",
        tier: 1,
        label: "Coffre de feutre"
      },
      {
        id: "farrier_box",
        where: "hamlet-house:fauves_h2_marechal",
        tier: 2,
        label: "Boîte à fers"
      },
      {
        id: "eagle_nest",
        where: "hamlet",
        tier: 1,
        label: "Perchoir de l'aigle"
      },
      {
        id: "burial_mound",
        where: "wild",
        tier: 2,
        label: "Tumulus du cavalier"
      },
      {
        id: "pack_den",
        where: "wild",
        tier: 3,
        label: "Repaire de la meute"
      },
      {
        id: "journal_page_fau",
        where: "wild",
        tier: 1,
        label: "Page accrochée à une herbe"
      }
    ],
    enemies: [
      {
        id: "fauves_hyena_a",
        name: "Hyène de braise",
        templateHint: "ember_wolf",
        role: "quest",
        where: "wild",
        group: "ember_hyenas"
      },
      {
        id: "fauves_hyena_b",
        name: "Hyène de braise",
        templateHint: "ember_wolf",
        role: "quest",
        where: "wild",
        group: "ember_hyenas"
      },
      {
        id: "fauves_ember_bull",
        name: "Taureau de braise",
        templateHint: "flame_boar",
        role: "quest",
        where: "wild"
      }
    ],
    quests: [
      {
        id: "sq_fau_cheval_1",
        title: "Le cheval qui boite",
        giver: "farrier_batu",
        turnIn: "farrier_batu",
        chain: null,
        summary: "Un cheval boite sans cause visible. Allez demander conseil à Tian, le vieux cheval céleste.",
        objectives: [
          {
            type: "talk",
            target: "horse_tian"
          }
        ]
      },
      {
        id: "sq_fau_cheval_2",
        title: "Les hyènes de braise",
        giver: "farrier_batu",
        turnIn: "farrier_batu",
        chain: "sq_fau_cheval_1",
        summary: "Deux hyènes de braise effraient les chevaux. Chassez-les des hautes herbes.",
        objectives: [
          {
            type: "killGroup",
            target: "ember_hyenas"
          }
        ]
      },
      {
        id: "sq_fau_cheval_3",
        title: "Le cavalier sans cheval",
        giver: "farrier_batu",
        turnIn: "farrier_batu",
        chain: "sq_fau_cheval_2",
        summary: "Le fantôme d'un cavalier cherche son cheval. Aidez-le à trouver son tumulus.",
        objectives: [
          {
            type: "talk",
            target: "ghost_rider_tolui"
          },
          {
            type: "chest",
            target: "burial_mound"
          }
        ]
      },
      {
        id: "sq_fau_feutre",
        title: "Du feutre pour la bergère",
        giver: "felt_maker_uyun",
        turnIn: "felt_maker_uyun",
        chain: null,
        summary: "Uyun a fait du feutre pour la bergère Zi et la fromagère Sa. Portez-leur chacune sa part.",
        objectives: [
          {
            type: "talk",
            target: "shepherd_zi"
          },
          {
            type: "talk",
            target: "cheese_sa"
          }
        ]
      },
      {
        id: "sq_fau_aigle",
        title: "L'aigle égaré",
        giver: "eagle_boy_temur",
        turnIn: "eagle_boy_temur",
        chain: null,
        summary: "L'aigle de Temur est parti et a laissé sa bague au perchoir du campement. Allez la chercher.",
        objectives: [
          {
            type: "visit",
            target: "fauves_wild"
          },
          {
            type: "chest",
            target: "eagle_nest"
          }
        ]
      },
      {
        id: "sq_fau_louveteau",
        title: "Le louveteau et le taureau",
        giver: "hunter_wu",
        turnIn: "hunter_wu",
        chain: null,
        summary: "Un louveteau de braise a perdu sa mère à cause d'un taureau enragé. Calmez le taureau.",
        objectives: [
          {
            type: "talk",
            target: "wolf_pup_baatar"
          },
          {
            type: "kill",
            target: "fauves_ember_bull"
          }
        ]
      },
      {
        id: "sq_fau_excuses",
        title: "Les excuses de Gerel",
        giver: "bandit_gerel",
        turnIn: "bandit_gerel",
        chain: null,
        summary: "Gerel, ancien bandit, veut présenter ses excuses à ceux qu'il a volés. Accompagnez-le chez eux.",
        objectives: [
          {
            type: "talk",
            target: "hunter_wu"
          },
          {
            type: "talk",
            target: "shepherd_zi"
          },
          {
            type: "talk",
            target: "cheese_sa"
          }
        ]
      },
      {
        id: "sq_fau_berceuse",
        title: "La berceuse de la Lune",
        giver: "grandma_altan",
        turnIn: "grandma_altan",
        chain: null,
        summary: "Grand-mère Altan veut retrouver les paroles d'une berceuse que Chang'e fredonnait. Interrogez le vieux nomade et le lièvre.",
        objectives: [
          {
            type: "talk",
            target: "old_nomad_bayan"
          },
          {
            type: "talk",
            target: "hare_tuzi"
          }
        ]
      },
      {
        id: "sq_journal_7",
        title: "La page dans l'herbe",
        giver: "shaman_ula",
        turnIn: "shaman_ula",
        chain: "sq_journal_6",
        summary: "Les vents ont emporté une page du carnet de Fengmeng jusque dans les hautes herbes.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_fau"
          }
        ]
      }
    ]
  },
  mer: {
    hamlet: {
      id: "mer_hamlet",
      name: "Anse des Coquillages",
      mood: "Une petite anse abritée où les pêcheurs ramassent les coquilles et les salines blanchissent au soleil.",
      arrival: [
        "L'Anse des Coquillages sent le sel et le calfatage. Des coquilles blanches tapissent les ruelles, et les mouettes y tiennent un conseil permanent.",
        "Un sentier de galets la relie aux criques du Dragon."
      ],
      houses: [
        {
          id: "mer_h2_ecaillere",
          name: "Maison de Dame Coque",
          desc: "Une maison de pierre où l'on ouvre les huîtres à la chaîne, avec un sourire en prime.",
          residents: [
            "oyster_coque"
          ],
          chests: [
            "oyster_box"
          ]
        },
        {
          id: "mer_h2_chantier",
          name: "Chantier du calfat Bing",
          desc: "Un petit chantier naval en bois, qui sent le goudron, la résine et l'orgueil.",
          residents: [
            "shipwright_bing"
          ],
          chests: [
            "shipyard_chest"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "oyster_coque",
        name: "Dame Coque",
        title: "Écaillère",
        emoji: "🦪",
        where: "hamlet-house:mer_h2_ecaillere",
        role: "donneur"
      },
      {
        id: "shipwright_bing",
        name: "Bing",
        title: "Calfat et charpentier",
        emoji: "⚒️",
        where: "hamlet-house:mer_h2_chantier",
        role: "donneur"
      },
      {
        id: "gull_pip",
        name: "Pip",
        title: "Mouette bavarde",
        emoji: "🕊️",
        where: "hamlet",
        role: "ambiance"
      },
      {
        id: "kid_ahu",
        name: "Ahu",
        title: "Petit ramasseur de coquillages",
        emoji: "🧒",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "salt_jun",
        name: "Jun",
        title: "Saunier",
        emoji: "🧂",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "sailor_tai",
        name: "Vieux Tai",
        title: "Marin retraité",
        emoji: "⛵",
        where: "place",
        role: "ambiance"
      },
      {
        id: "priestess_mazu",
        name: "Dame Mo",
        title: "Prêtresse de Mazu",
        emoji: "🛕",
        where: "place",
        role: "donneur"
      },
      {
        id: "singer_hailing",
        name: "Hailing",
        title: "Chanteuse des marins",
        emoji: "🎤",
        where: "place",
        role: "donneur"
      },
      {
        id: "jelly_shui",
        name: "Shui",
        title: "Méduse philosophe",
        emoji: "🪼",
        where: "wild",
        role: "ambiance"
      },
      {
        id: "octo_ba",
        name: "Ba",
        title: "Poulpe cuisinier",
        emoji: "🐙",
        where: "wild",
        role: "ambiance"
      }
    ],
    chests: [
      {
        id: "oyster_box",
        where: "hamlet-house:mer_h2_ecaillere",
        tier: 1,
        label: "Caisse d'huîtres"
      },
      {
        id: "shipyard_chest",
        where: "hamlet-house:mer_h2_chantier",
        tier: 2,
        label: "Coffre du chantier"
      },
      {
        id: "salt_pan",
        where: "hamlet",
        tier: 1,
        label: "Cache de la saline"
      },
      {
        id: "reef_cache",
        where: "wild",
        tier: 2,
        label: "Cache du récif"
      },
      {
        id: "wreck_treasure",
        where: "wild",
        tier: 3,
        label: "Trésor de l'épave"
      },
      {
        id: "journal_page_mer",
        where: "wild",
        tier: 1,
        label: "Page flottant sur un récif"
      }
    ],
    enemies: [
      {
        id: "mer_crab_a",
        name: "Crabe-soldat",
        templateHint: "iron_gladiator",
        role: "quest",
        where: "wild",
        group: "giant_crabs"
      },
      {
        id: "mer_crab_b",
        name: "Crabe-soldat",
        templateHint: "iron_gladiator",
        role: "quest",
        where: "wild",
        group: "giant_crabs"
      }
    ],
    quests: [
      {
        id: "sq_mer_navire_1",
        title: "Du bois pour le navire",
        giver: "shipwright_bing",
        turnIn: "shipwright_bing",
        chain: null,
        summary: "Bing manque de planches pour son navire. Une cache de récif en conserve.",
        objectives: [
          {
            type: "chest",
            target: "reef_cache"
          }
        ]
      },
      {
        id: "sq_mer_navire_2",
        title: "Les crabes de la coque",
        giver: "shipwright_bing",
        turnIn: "shipwright_bing",
        chain: "sq_mer_navire_1",
        summary: "Deux crabes-soldats grignotent la coque du navire. Chassez-les des criques.",
        objectives: [
          {
            type: "killGroup",
            target: "giant_crabs"
          }
        ]
      },
      {
        id: "sq_mer_navire_3",
        title: "Le dernier clou",
        giver: "shipwright_bing",
        turnIn: "shipwright_bing",
        chain: "sq_mer_navire_2",
        summary: "Il manque à Bing un clou d'or, caché dans le trésor d'une épave ancienne.",
        objectives: [
          {
            type: "chest",
            target: "wreck_treasure"
          }
        ]
      },
      {
        id: "sq_mer_coquille",
        title: "La perle de Dame Coque",
        giver: "oyster_coque",
        turnIn: "oyster_coque",
        chain: null,
        summary: "Une perle noire a roulé hors de la caisse de Dame Coque. Le poulpe cuisinier et la méduse l'ont peut-être vue.",
        objectives: [
          {
            type: "talk",
            target: "octo_ba"
          },
          {
            type: "talk",
            target: "jelly_shui"
          }
        ]
      },
      {
        id: "sq_mer_mazu",
        title: "Le serpent de Mazu",
        giver: "priestess_mazu",
        turnIn: "priestess_mazu",
        chain: null,
        requires: [
          "q_sun_8"
        ],
        summary: "Un serpent de marée gêne les offrandes à Mazu. Chassez-le des criques.",
        objectives: [
          {
            type: "kill",
            target: "mer_tide_serpent"
          }
        ]
      },
      {
        id: "sq_mer_chanson",
        title: "La chanson du port",
        giver: "singer_hailing",
        turnIn: "singer_hailing",
        chain: null,
        summary: "Hailing compose une chanson du port. Elle cherche trois couplets : le pêcheur, l'envoyé et la petite Mi.",
        objectives: [
          {
            type: "talk",
            target: "fisher_hai"
          },
          {
            type: "talk",
            target: "envoy_longwang"
          },
          {
            type: "talk",
            target: "girl_net_mi"
          }
        ]
      },
      {
        id: "sq_mer_sel",
        title: "Le sel de Jun",
        giver: "salt_jun",
        turnIn: "salt_jun",
        chain: null,
        summary: "Jun a mis de côté du sel pour deux fidèles clientes : la plongeuse Xi et la gardienne Ming.",
        objectives: [
          {
            type: "talk",
            target: "pearl_diver_xi"
          },
          {
            type: "talk",
            target: "lighthouse_ming"
          }
        ]
      },
      {
        id: "sq_mer_ahu",
        title: "La coquille qui chante",
        giver: "kid_ahu",
        turnIn: "kid_ahu",
        chain: null,
        summary: "Ahu cherche une coquille qui chante, cachée dans la maison de Dame Coque et au bord d'une saline.",
        objectives: [
          {
            type: "visit",
            target: "mer_h2_ecaillere"
          },
          {
            type: "chest",
            target: "salt_pan"
          }
        ]
      },
      {
        id: "sq_journal_8",
        title: "La page du récif",
        giver: "lighthouse_ming",
        turnIn: "lighthouse_ming",
        chain: "sq_journal_7",
        summary: "Une page du carnet de Fengmeng s'est échouée sur un récif. Elle parle d'une boîte rouge.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_mer"
          }
        ]
      }
    ]
  },
  fusang: {
    hamlet: {
      id: "fusang_hamlet",
      name: "Perchoir des Grues",
      mood: "Un perchoir de bois blanc suspendu aux branches hautes, où les grues se posent entre deux messages et deux nuages.",
      arrival: [
        "Le Perchoir des Grues flotte à mi-hauteur de l'arbre, entre ciel et racines. Les grues y font une halte, les mortels un détour.",
        "Un pont de lianes dorées le relie aux branches de la zone sauvage."
      ],
      houses: [
        {
          id: "fusang_h2_grues",
          name: "Pavillon des grues messagères",
          desc: "Un pavillon tout en plumes et en parchemins, où les grues déposent les lettres du ciel.",
          residents: [
            "crane_elder_hegu"
          ],
          chests: [
            "crane_pavilion_box"
          ]
        },
        {
          id: "fusang_h2_encens",
          name: "Atelier d'encens de Lanxiang",
          desc: "Un atelier parfumé de santal, de cèdre et de jasmin, aux fumées lentes et studieuses.",
          residents: [
            "incense_lanxiang"
          ],
          chests: [
            "incense_chest"
          ]
        }
      ]
    },
    npcs: [
      {
        id: "crane_elder_hegu",
        name: "Hegu",
        title: "Doyenne des grues messagères",
        emoji: "🦢",
        where: "hamlet-house:fusang_h2_grues",
        role: "donneur"
      },
      {
        id: "incense_lanxiang",
        name: "Lanxiang",
        title: "Faiseuse d'encens",
        emoji: "🪔",
        where: "hamlet-house:fusang_h2_encens",
        role: "donneur"
      },
      {
        id: "weaver_zhinu",
        name: "Zhinü",
        title: "Tisseuse des nuages",
        emoji: "👸",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "oxherd_niulang",
        name: "Niulang",
        title: "Bouvier de la rive",
        emoji: "🐂",
        where: "place",
        role: "donneur"
      },
      {
        id: "pilgrim_wuya",
        name: "Wuya",
        title: "Pèlerin sans destination",
        emoji: "🧳",
        where: "hamlet",
        role: "donneur"
      },
      {
        id: "gatekeeper_men",
        name: "Men",
        title: "Portier du sceau",
        emoji: "🚪",
        where: "place",
        role: "donneur"
      },
      {
        id: "star_child_xing",
        name: "Xingxing",
        title: "Enfant d'étoile",
        emoji: "🌟",
        where: "place",
        role: "ambiance"
      },
      {
        id: "monkey_ji",
        name: "Ji",
        title: "Singe voleur de pêches",
        emoji: "🐵",
        where: "wild",
        role: "ambiance"
      },
      {
        id: "whale_kun",
        name: "Kun",
        title: "Poisson géant des nuages",
        emoji: "🐋",
        where: "wild",
        role: "indice"
      },
      {
        id: "paper_dragon_long",
        name: "Petit Long",
        title: "Dragon de papier",
        emoji: "🐉",
        where: "hamlet",
        role: "ambiance"
      }
    ],
    chests: [
      {
        id: "crane_pavilion_box",
        where: "hamlet-house:fusang_h2_grues",
        tier: 1,
        label: "Coffre à parchemins"
      },
      {
        id: "incense_chest",
        where: "hamlet-house:fusang_h2_encens",
        tier: 2,
        label: "Coffre à encens"
      },
      {
        id: "loom_chest",
        where: "hamlet",
        tier: 1,
        label: "Coffre du métier à tisser"
      },
      {
        id: "peach_stash",
        where: "wild",
        tier: 2,
        label: "Cache de pêches"
      },
      {
        id: "kun_scale_chest",
        where: "wild",
        tier: 3,
        label: "Coffre aux écailles de Kun"
      },
      {
        id: "journal_page_fus",
        where: "wild",
        tier: 1,
        label: "Page accrochée à une branche"
      }
    ],
    enemies: [
      {
        id: "fusang_thief_a",
        name: "Singe-démon voleur",
        templateHint: "goblin_saboteur",
        role: "quest",
        where: "wild",
        group: "peach_thieves"
      },
      {
        id: "fusang_thief_b",
        name: "Singe-démon voleur",
        templateHint: "goblin_saboteur",
        role: "quest",
        where: "wild",
        group: "peach_thieves"
      },
      {
        id: "fusang_frost_wyrm",
        name: "Long de givre égaré",
        templateHint: "frost_dragon",
        role: "quest",
        where: "wild"
      }
    ],
    quests: [
      {
        id: "sq_fus_pont_1",
        title: "Le message du bouvier",
        giver: "oxherd_niulang",
        turnIn: "oxherd_niulang",
        chain: null,
        summary: "Niulang veut faire parvenir un mot à Zhinü, de l'autre côté du fleuve d'argent.",
        objectives: [
          {
            type: "talk",
            target: "weaver_zhinu"
          }
        ]
      },
      {
        id: "sq_fus_pont_2",
        title: "Les pêches de Zhinü",
        giver: "weaver_zhinu",
        turnIn: "weaver_zhinu",
        chain: "sq_fus_pont_1",
        summary: "Zhinü rêve d'envoyer des pêches séchées à Niulang. Une cache en contient, dans les racines.",
        objectives: [
          {
            type: "chest",
            target: "peach_stash"
          },
          {
            type: "talk",
            target: "oxherd_niulang"
          }
        ]
      },
      {
        id: "sq_fus_pont_3",
        title: "Le pont des pies",
        giver: "gatekeeper_men",
        turnIn: "weaver_zhinu",
        chain: "sq_fus_pont_2",
        summary: "Pour que le pont des pies tienne plus d'une nuit, il faut le permis du portier Men.",
        objectives: [
          {
            type: "visit",
            target: "fusang_wild"
          },
          {
            type: "talk",
            target: "gatekeeper_men"
          }
        ]
      },
      {
        id: "sq_fus_singes",
        title: "Les voleurs de pêches",
        giver: "picker_tao",
        turnIn: "picker_tao",
        chain: null,
        summary: "Deux singes-démons dérobent les pêches d'immortalité. Mettez fin à leurs larcins.",
        objectives: [
          {
            type: "killGroup",
            target: "peach_thieves"
          }
        ]
      },
      {
        id: "sq_fus_encens",
        title: "Le parfum du matin",
        giver: "incense_lanxiang",
        turnIn: "incense_lanxiang",
        chain: null,
        summary: "Lanxiang cherche un parfum pour la Reine Mère. Il lui faut l'avis de la Racine-Ancienne, du poussin de phénix et de Mère Xing.",
        objectives: [
          {
            type: "talk",
            target: "root_elder"
          },
          {
            type: "talk",
            target: "phoenix_chick"
          },
          {
            type: "talk",
            target: "astronomer_xing"
          }
        ]
      },
      {
        id: "sq_fus_etoile",
        title: "L'enfant d'étoile",
        giver: "star_child_xing",
        turnIn: "star_child_xing",
        chain: null,
        requires: [
          "q_sun_8"
        ],
        summary: "Xingxing cherche ses parents étoiles. Le seul indice est un garde solaire des racines.",
        objectives: [
          {
            type: "kill",
            target: "fusang_root_guard"
          }
        ]
      },
      {
        id: "sq_fus_pelerin",
        title: "Les écailles de Kun",
        giver: "pilgrim_wuya",
        turnIn: "pilgrim_wuya",
        chain: null,
        summary: "Wuya croit qu'une écaille de Kun peut guérir son errance. Trouvez le coffre sous l'écaille.",
        objectives: [
          {
            type: "talk",
            target: "whale_kun"
          },
          {
            type: "chest",
            target: "kun_scale_chest"
          }
        ]
      },
      {
        id: "sq_fus_wyrm",
        title: "Le long égaré",
        giver: "gatekeeper_men",
        turnIn: "gatekeeper_men",
        chain: null,
        summary: "Un long de givre égaré gèle le pont de lianes. Chassez-le avant qu'il ne gèle tout le Perchoir.",
        objectives: [
          {
            type: "kill",
            target: "fusang_frost_wyrm"
          }
        ]
      },
      {
        id: "sq_journal_9",
        title: "La page accrochée",
        giver: "crane_envoy",
        turnIn: "crane_envoy",
        chain: "sq_journal_8",
        summary: "La Grue a vu un jeune archer glisser une page dans les branches. Retrouvez-la : c'est l'avant-dernière.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_fus"
          }
        ]
      }
    ]
  },
  lune: {
    npcs: [
      {
        id: "moon_cook_gui",
        name: "Gui",
        title: "Cuisinier de gâteaux de lune",
        emoji: "🥮",
        where: "place",
        role: "donneur"
      },
      {
        id: "moon_rabbit_yutu",
        name: "Yutu",
        title: "Lapin de jade",
        emoji: "🐰",
        where: "place",
        role: "ambiance"
      },
      {
        id: "moon_ferryman_yin",
        name: "Vieux Shen",
        title: "Passeur d'argent",
        emoji: "⛵",
        where: "place",
        role: "indice"
      },
      {
        id: "moon_child_lan",
        name: "Lan",
        title: "Petite veilleuse",
        emoji: "🧒",
        where: "place",
        role: "ambiance"
      },
      {
        id: "moon_crow_wu",
        name: "Corbeau d'ombre",
        title: "Messager d'ombre",
        emoji: "🐦‍⬛",
        where: "wild",
        role: "indice"
      }
    ],
    chests: [
      {
        id: "moon_cake_tin",
        where: "place",
        tier: 1,
        label: "Boîte à gâteaux de lune"
      },
      {
        id: "jade_mortar_box",
        where: "house:lune_h_lievres",
        tier: 2,
        label: "Mortier de jade"
      },
      {
        id: "silver_river_cache",
        where: "wild",
        tier: 2,
        label: "Cache de la rivière d'argent"
      },
      {
        id: "journal_page_lune",
        where: "wild",
        tier: 1,
        label: "Dernière page du carnet"
      }
    ],
    enemies: [
      {
        id: "lune_shade_a",
        name: "Ombre du miroir",
        templateHint: "shadow_assassin",
        role: "quest",
        where: "wild",
        group: "mirror_shades"
      },
      {
        id: "lune_shade_b",
        name: "Ombre du miroir",
        templateHint: "shadow_assassin",
        role: "quest",
        where: "wild",
        group: "mirror_shades"
      }
    ],
    quests: [
      {
        id: "sq_lune_gateaux",
        title: "Les gâteaux de Gui",
        giver: "moon_cook_gui",
        turnIn: "moon_cook_gui",
        chain: null,
        summary: "Gui veut envoyer ses gâteaux aux habitants du hameau. Trouvez sa boîte et portez la première part à la veilleuse Yin.",
        objectives: [
          {
            type: "chest",
            target: "moon_cake_tin"
          },
          {
            type: "talk",
            target: "keeper_lunar"
          }
        ]
      },
      {
        id: "sq_lune_passeur",
        title: "La rivière d'argent",
        giver: "moon_ferryman_yin",
        turnIn: "moon_ferryman_yin",
        chain: null,
        summary: "Le vieux Yin a laissé une cache au bord de la rivière d'argent. Allez la chercher et écoutez le Corbeau d'ombre.",
        objectives: [
          {
            type: "talk",
            target: "moon_crow_wu"
          },
          {
            type: "chest",
            target: "silver_river_cache"
          }
        ]
      },
      {
        id: "sq_lune_ombres",
        title: "Les ombres du miroir",
        giver: "moon_child_lan",
        turnIn: "moon_child_lan",
        chain: null,
        requires: [
          "q_sun_9"
        ],
        summary: "Deux ombres du miroir effraient la petite Lan sur le sentier d'argent. Chassez-les.",
        objectives: [
          {
            type: "killGroup",
            target: "mirror_shades"
          }
        ]
      },
      {
        id: "sq_journal_10",
        title: "La dernière page",
        giver: "moon_rabbit_yutu",
        turnIn: "moon_rabbit_yutu",
        chain: "sq_journal_9",
        summary: "La dernière page du carnet de Fengmeng est ici, sur le sentier. Yutu veut vous la remettre en main propre.",
        objectives: [
          {
            type: "chest",
            target: "journal_page_lune"
          }
        ]
      }
    ]
  }
};

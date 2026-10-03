// Textes additionnels — Plaine des Fauves (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    fauves_hamlet: {
      name: "Campement des Vents",
      arrival: [
        "Le Campement des Vents se déplace avec les saisons ; aujourd'hui, il campe derrière un pli de la plaine. Les yourtes fument doucement, comme des théières géantes.",
        "Une piste d'herbe piétinée rejoint les hautes herbes."
      ]
    },
    fauves_h2_feutre: {
      name: "Yourte d'Uyun la feutrière",
      arrival: [
        "Le feutre étouffe tous les bruits. Dehors, la plaine rugit ; ici, elle murmure."
      ]
    },
    fauves_h2_marechal: {
      name: "Forge du maréchal Batu",
      arrival: [
        "Un soufflet souffle, un fer chauffe. Les chevaux attendent en file, avec la patience des nobles."
      ]
    }
  },
  npcs: {
    felt_maker_uyun: {
      name: "Uyun",
      title: "Feutrière",
      emoji: "🧶",
      idle: [
        "Mon feutre garde le chaud, l'humide et les secrets. Surtout les secrets.",
        "On dit que la laine a une mémoire. La mienne retient tout ce qu'on oublie."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "Plus de meutes, plus de peur. Mon feutre est plus doux, ce soir, il me semble."
          ]
        }
      ]
    },
    farrier_batu: {
      name: "Batu",
      title: "Maréchal-ferrant",
      emoji: "🐴",
      idle: [
        "Un cheval bien ferré va loin. Un cheval mal ferré va chez moi.",
        "Mon marteau chante deux notes. L'une pour le fer, l'autre pour le cheval."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "Le septième soleil est tombé. Mes enclumes en tintent encore. Je ferre de bon cœur."
          ]
        }
      ]
    },
    eagle_boy_temur: {
      name: "Temur",
      title: "Petit dresseur d'aigle",
      emoji: "🦅",
      idle: [
        "Mon aigle s'appelle Ciel. Il ne me répond jamais, mais il revient toujours.",
        "Quand je serai grand, je chasserai le loup avec lui. Ou le lièvre. Ou le déjeuner."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "Ciel est revenu me voir ce matin. Il m'a regardé de haut. C'était une déclaration d'amour."
          ]
        }
      ]
    },
    grandma_altan: {
      name: "Grand-mère Altan",
      title: "Chanteuse des berceuses",
      emoji: "🧓",
      idle: [
        "Je chante les chansons de ma mère, qui chantait celles de la sienne. Aucune ne parle de héros, toutes parlent de lune.",
        "Une berceuse, c'est un souffle qu'on confie à un enfant. Il le garde toute sa vie."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "La plaine chante plus doucement. Je reprends mes berceuses. Je crois que quelqu'un, là-haut, les écoute."
          ]
        }
      ]
    },
    mare_chagan: {
      name: "Chagan",
      title: "Jument blanche bavarde",
      emoji: "🐎",
      idle: [
        "Hennissement poli. Je suis la doyenne des juments du camp, donc la plus sage.",
        "Les humains pensent que je les porte. En réalité, je les accompagne."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "Le septième soleil est tombé ? Les herbes ont parlé de tout autre chose, ce matin, mais je suis ravie."
          ]
        }
      ]
    },
    bandit_gerel: {
      name: "Gerel",
      title: "Ancien bandit repenti",
      emoji: "🥷",
      idle: [
        "J'étais bandit. Je suis devenu berger. Les moutons, eux, ne me demandent jamais de comptes.",
        "On ne guérit pas de la honte. On la porte, comme un bon manteau."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "Un soleil de moins. Le monde va mieux, et mes remords restent là. Je vais tenter de les réparer."
          ]
        }
      ]
    },
    drover_boldo: {
      name: "Boldo",
      title: "Conducteur de troupeaux",
      emoji: "🐂",
      idle: [
        "Je conduis mille bêtes sur mille lis. Mon chien me conduit, lui, mais il ne le dira à personne.",
        "Les troupeaux ont peur du feu. Moi, du silence."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "La plaine est plus calme. Mes bêtes marchent en rang. Quel miracle."
          ]
        }
      ]
    },
    traveler_hui: {
      name: "Hui",
      title: "Voyageur marchand d'épices",
      emoji: "🌶️",
      idle: [
        "Poivre, cannelle, safran ! Tout ce qui fait pleurer de joie les marmites.",
        "J'ai croisé Hua sur la route. Elle m'a vendu mes propres épices. Je n'ai rien compris."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "Septième soleil tombé ! Mon poivre pique davantage. C'est la joie, je suppose."
          ]
        }
      ]
    },
    wolf_pup_baatar: {
      name: "Baatar",
      title: "Louveteau de braise",
      emoji: "🐺",
      idle: [
        "Awou ! Je suis un loup féroce ! (Il glousse.)",
        "Ma mère m'a dit de ne pas parler aux archers. Mais vous avez l'air gentil."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "Awou ! Plus de gros loups méchants dans les herbes. Je peux jouer à voler les chaussettes."
          ]
        }
      ]
    },
    ghost_rider_tolui: {
      name: "Tolui",
      title: "Fantôme d'un cavalier",
      emoji: "👻",
      idle: [
        "Je cours dans les herbes. Je ne sais plus après quoi.",
        "Mon cheval est mort avant moi. Il m'attend quelque part, plus loin."
      ],
      talk: [
        {
          whenDone: "sun_7",
          lines: [
            "Je ne suis plus pressé. La plaine est belle, vue de là-haut."
          ]
        }
      ]
    }
  },
  chests: {
    felt_chest: {
      label: "Coffre de feutre",
      openText: "🎁 Sous des couches de feutre, un petit sac de pièces.",
      emoji: "🧶",
      emojiOpened: "🧶"
    },
    farrier_box: {
      label: "Boîte à fers",
      openText: "🎁 Dans la boîte à fers, des pièces d'argent enfoncées dans la limaille.",
      emoji: "🔩",
      emojiOpened: "🔩"
    },
    eagle_nest: {
      label: "Perchoir de l'aigle",
      openText: "🎁 Dans le nid de branches, une bague d'argent et quelques pièces.",
      emoji: "🪹",
      emojiOpened: "🪹"
    },
    burial_mound: {
      label: "Tumulus du cavalier",
      openText: "🎁 Un tumulus herbeux qui garde l'épée d'un cavalier, des bijoux et de la monnaie ancienne.",
      emoji: "⛰️",
      emojiOpened: "⛰️"
    },
    pack_den: {
      label: "Repaire de la meute",
      openText: "🎁 Dans le repaire, des os, des pièces et un joli bracelet que personne ne réclame.",
      emoji: "🐺",
      emojiOpened: "🐺"
    },
    journal_page_fau: {
      label: "Page accrochée à une herbe",
      openText: "🎁 Une page prise dans les herbes : « Je les ai suivis jusqu'à la plaine. Il tirait comme un dieu. Je tirerai mieux. »",
      emoji: "📄",
      emojiOpened: "📄"
    }
  },
  quests: [
    {
      id: "sq_fau_cheval_1",
      title: "Le cheval qui boite",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "farrier_batu",
      turnIn: "farrier_batu",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "horse_tian",
          text: "Consulter Tian (écurie des chevaux célestes)",
          lines: [
            "Il boite d'un fer, pas d'une patte. Le vrai mal vient de la peur. Cherchez les hyènes dans les herbes."
          ]
        }
      ],
      offer: [
        "Un cheval boite sans cause visible. Je ne comprends pas. Demandez à Tian, le vieux cheval céleste, il a toujours une opinion."
      ],
      hint: [
        "Tian est à l'écurie, à l'enclos de Caoyuan."
      ],
      complete: [
        "Les hyènes… Je m'en doutais. Il faudra les chasser pour de bon."
      ],
      reward: {
        gold: 120,
        fragment: "Fer de cheval",
        xp: 215
      }
    },
    {
      id: "sq_fau_cheval_2",
      title: "Les hyènes de braise",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "farrier_batu",
      turnIn: "farrier_batu",
      requires: [
        "sq_fau_cheval_1"
      ],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "ember_hyenas",
          text: "Chasser les hyènes de braise (hautes herbes de cendre)"
        }
      ],
      offer: [
        "Les hyènes de braise effraient mes chevaux. Débarrassez-nous-en, archer, avant que les bêtes ne s'enfuient."
      ],
      hint: [
        "Les hyènes rôdent dans les hautes herbes, près de la lisière. Leur rire est reconnaissable."
      ],
      complete: [
        "Les hyènes sont parties, et mes chevaux broutent paisiblement. Voici une clochette que j'ai fabriquée pour eux."
      ],
      reward: {
        gold: 170,
        fragment: "Clochette de cheval",
        xp: 310
      }
    },
    {
      id: "sq_fau_cheval_3",
      title: "Le cavalier sans cheval",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "farrier_batu",
      turnIn: "farrier_batu",
      requires: [
        "sq_fau_cheval_2"
      ],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "ghost_rider_tolui",
          text: "Écouter Tolui (hautes herbes de cendre)",
          lines: [
            "Mon cheval et moi dormons sous le même tertre. Ouvrez-le, qu'on soit réunis, et que le monde nous oublie en paix."
          ]
        },
        {
          type: "chest",
          target: "burial_mound",
          text: "Ouvrir le tumulus du cavalier (hautes herbes de cendre)"
        }
      ],
      offer: [
        "Mon vieux compagnon de marteau, le fantôme Tolui, cherche son cheval. Il est enterré dans un tumulus. Allez l'y rejoindre."
      ],
      hint: [
        "Tolui se tient dans les hautes herbes, près d'un tertre. Le tumulus est tout proche."
      ],
      complete: [
        "Ils sont réunis. Le vent a soufflé trois notes de morin khuur. Voici un fragment de bride, qu'il vous offre."
      ],
      reward: {
        gold: 200,
        fragment: "Bride du cavalier",
        xp: 400
      }
    },
    {
      id: "sq_fau_feutre",
      title: "Du feutre pour la bergère",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "felt_maker_uyun",
      turnIn: "felt_maker_uyun",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "shepherd_zi",
          text: "Livrer le feutre à Zi (Yourte de Zi)",
          lines: [
            "Du feutre pour ma yourte ? Quel bonheur ! L'hiver sera moins cruel."
          ]
        },
        {
          type: "talk",
          target: "cheese_sa",
          text: "Livrer le feutre à Dame Sa (Fromagerie de Dame Sa)",
          lines: [
            "Du feutre pour mes meules ? Excellent : elles garderont leur parfum. Merci à Uyun."
          ]
        }
      ],
      offer: [
        "J'ai terminé deux pièces de feutre, pour Zi et pour Dame Sa. Mes jambes sont aussi molles que ma laine. Portez-les, archer."
      ],
      hint: [
        "Zi est dans sa yourte, Sa dans sa fromagerie, à Caoyuan."
      ],
      complete: [
        "Elles sont ravies ! Uyun vous offre un morceau de feutre argenté. Il garde tout, même les mauvais souvenirs."
      ],
      reward: {
        gold: 155,
        fragment: "Feutre argenté",
        xp: 280
      }
    },
    {
      id: "sq_fau_aigle",
      title: "L'aigle égaré",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "eagle_boy_temur",
      turnIn: "eagle_boy_temur",
      requires: [],
      side: true,
      objectives: [
        {
          type: "visit",
          target: "fauves_wild",
          text: "Gagner les hautes herbes de cendre"
        },
        {
          type: "chest",
          target: "eagle_nest",
          text: "Retrouver la bague au perchoir de l'aigle (Campement des Vents)"
        }
      ],
      offer: [
        "Mon aigle Ciel est parti depuis hier. Il a laissé sa bague au perchoir. Mais je ne l'atteins pas. Aidez-moi, archer."
      ],
      hint: [
        "Le perchoir est au hameau, dans les branches. Vous pouvez aussi surveiller le ciel."
      ],
      complete: [
        "Ciel est revenu, la bague à la patte. Temur le serre contre son cœur. Voici une plume d'aigle, la plus belle."
      ],
      reward: {
        gold: 170,
        fragment: "Plume d'aigle",
        xp: 310
      }
    },
    {
      id: "sq_fau_louveteau",
      title: "Le louveteau et le taureau",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "hunter_wu",
      turnIn: "hunter_wu",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "wolf_pup_baatar",
          text: "Écouter le louveteau Baatar (hautes herbes de cendre)",
          lines: [
            "Un gros taureau rouge m'a fait peur. Maman est partie le chasser et n'est pas revenue. Je l'attends."
          ]
        },
        {
          type: "kill",
          target: "fauves_ember_bull",
          text: "Chasser le taureau de braise (hautes herbes de cendre)"
        }
      ],
      offer: [
        "Un louveteau pleure dans les herbes : un taureau de braise a fait fuir sa mère. Allez l'écouter, puis réglez cela."
      ],
      hint: [
        "Le louveteau est dans les hautes herbes. Le taureau de braise rôde non loin."
      ],
      complete: [
        "Le taureau est vaincu. La louve est revenue chercher son petit. Wu hoche la tête : « Les bêtes ont aussi leur honneur. »"
      ],
      reward: {
        gold: 170,
        fragment: "Poil de louve",
        xp: 310
      }
    },
    {
      id: "sq_fau_excuses",
      title: "Les excuses de Gerel",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "bandit_gerel",
      turnIn: "bandit_gerel",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "hunter_wu",
          text: "Présenter les excuses de Gerel à Wu (Pavillon du chasseur Wu)",
          lines: [
            "Gerel s'excuse ? Il a toujours eu bon cœur sous le masque. Je lui pardonne, dites-lui."
          ]
        },
        {
          type: "talk",
          target: "shepherd_zi",
          text: "Présenter les excuses de Gerel à Zi (Yourte de Zi)",
          lines: [
            "Gerel, mon voleur de brebis ? Dites-lui que je lui pardonne, mais qu'il me doit deux brebis."
          ]
        },
        {
          type: "talk",
          target: "cheese_sa",
          text: "Présenter les excuses de Gerel à Dame Sa (Fromagerie de Dame Sa)",
          lines: [
            "Mon fromage manqué ? Qu'il revienne en acheter, je lui en offrirai un."
          ]
        }
      ],
      offer: [
        "J'ai été un voleur. Aujourd'hui, je voudrais m'excuser auprès de Wu, de Zi et de Sa. Je n'ose pas y aller seul. Voulez-vous porter mes mots ?"
      ],
      hint: [
        "Wu, Zi et Sa vivent tous à Caoyuan. Écoutez bien leurs réponses."
      ],
      complete: [
        "Ils lui pardonnent ! Gerel pleure comme un enfant. Il vous remet un bijou volé qu'il avait gardé comme remords."
      ],
      reward: {
        gold: 185,
        fragment: "Bijou de remords",
        xp: 340
      }
    },
    {
      id: "sq_fau_berceuse",
      title: "La berceuse de la Lune",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "grandma_altan",
      turnIn: "grandma_altan",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "old_nomad_bayan",
          text: "Interroger Bayan (place de Caoyuan)",
          lines: [
            "Une berceuse de la Lune ? Elle commençait par « Dors, petit, la nuit te tient la main ». Le reste, j'ai oublié."
          ]
        },
        {
          type: "talk",
          target: "hare_tuzi",
          text: "Interroger le lièvre Tuzi (hautes herbes de cendre)",
          lines: [
            "Chang'e la chantait en broyant l'élixir. « Dors, petit, la nuit te tient la main, et demain t'attend sur le chemin. » C'est ma préférée."
          ]
        }
      ],
      offer: [
        "Une berceuse, archer, que Chang'e fredonnait paraît-il à son lièvre. J'en ai perdu les paroles. Interrogez Bayan et le lièvre Tuzi."
      ],
      hint: [
        "Bayan est sur la place, Tuzi dans les hautes herbes."
      ],
      complete: [
        "Je la chantais, hier, pour mes petits-enfants. Elle me rappelle que même loin, on peut tenir quelqu'un par la main. Voici une plume de berceuse."
      ],
      reward: {
        gold: 200,
        fragment: "Plume de berceuse",
        xp: 370
      }
    },
    {
      id: "sq_journal_7",
      title: "La page dans l'herbe",
      chapter: "✦ Quête secondaire — Plaine des Fauves",
      giver: "shaman_ula",
      turnIn: "shaman_ula",
      requires: [
        "sq_journal_6"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_fau",
          text: "Retrouver la page dans l'herbe (hautes herbes de cendre)"
        }
      ],
      offer: [
        "Les vents m'ont apporté un papier. Ils me l'ont dicté mot pour mot : « Il tirait comme un dieu. » Vous voulez lire l'original ? Il est dans les hautes herbes."
      ],
      hint: [
        "La page est accrochée à une herbe, dans les hautes herbes de cendre."
      ],
      complete: [
        "« Je les ai suivis jusqu'à la plaine. Il tirait comme un dieu. Je tirerai mieux. » Ula hoche la tête : « L'envie est la plus vieille des flèches. »"
      ],
      reward: {
        gold: 155,
        fragment: "Page du carnet (VII)",
        xp: 280
      }
    }
  ]
};

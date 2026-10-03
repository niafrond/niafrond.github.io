// Textes additionnels — Rizières Desséchées (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    rizieres_hamlet: {
      name: "Hameau des Lucioles",
      arrival: [
        "Le Hameau des Lucioles tient dans un mouchoir de boue sèche. La nuit, dit-on, ses habitants s'éclairent à l'aide de petits amis volants.",
        "Un chemin de digue le relie au marais, à l'écart des regards."
      ]
    },
    rizieres_h2_moulin: {
      name: "Moulin tari du meunier Gao",
      arrival: [
        "La grande roue ne grince plus. Le meunier, lui, grince pour deux."
      ]
    },
    rizieres_h2_lucioles: {
      name: "Cabane de Tante Liu",
      arrival: [
        "Des centaines de petites lueurs clignent derrière le verre. La pièce ressemble à un ciel qui aurait déménagé."
      ]
    }
  },
  npcs: {
    miller_gao: {
      name: "Gao",
      title: "Meunier sans rivière",
      emoji: "👨‍🌾",
      idle: [
        "Ma roue tourne à vide depuis trois lunes. Le pire, c'est le bruit du silence.",
        "On ne moud pas du vent. J'ai essayé, c'est décevant."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "Un soleil de moins, et ma roue a frémi toute seule ! Je n'ose pas y croire. Je l'ai caressée comme un vieux chien."
          ]
        }
      ]
    },
    aunt_liu: {
      name: "Tante Liu",
      title: "Gardienne des lucioles",
      emoji: "👵",
      idle: [
        "Mes lucioles ne mordent pas. Elles éclairent, c'est tout, et elles sont de bonne compagnie.",
        "Chaque lueur est une petite promesse. J'en ai trois cents. Je suis très riche."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "Mes lucioles brillent plus fort ce soir. Elles disent que l'archer est un homme de bien. Elles sont rarement trompées."
          ]
        }
      ]
    },
    duck_fu: {
      name: "Fu",
      title: "Éleveur de canards",
      emoji: "🦆",
      idle: [
        "Mes canards savent nager, ils ne savent juste plus où. Ils tournent en rond dans la boue.",
        "Un canard heureux fait coin-coin. Un canard inquiet aussi, mais plus fort."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "Mes canards ont retrouvé le sourire. Enfin, le bec en croissant. Tout est relatif."
          ]
        }
      ]
    },
    kid_dandan: {
      name: "Dandan",
      title: "Gamine curieuse",
      emoji: "🧒",
      idle: [
        "Tu veux voir mon trésor ? C'est un caillou. Il est magnifique, regarde.",
        "Je serai archère plus tard. Ou grenouille. Je n'ai pas encore décidé."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "Toute la nuit, j'ai regardé la lune. Elle me regardait aussi. On est devenues amies."
          ]
        }
      ]
    },
    pigeon_zhao: {
      name: "Zhao",
      title: "Éleveur de pigeons voyageurs",
      emoji: "🕊️",
      idle: [
        "Mes pigeons portent les lettres d'un bout du pays à l'autre. Quand ils ne s'égarent pas.",
        "Un pigeon ne se trompe jamais de route, dit-on. Le mien se trompe de maison, ce qui est pire."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "Les nouvelles circulent mieux depuis que le ciel s'éclaircit. Les pigeons volent plus droit, moi aussi."
          ]
        }
      ]
    },
    monk_kong: {
      name: "Frère Kong",
      title: "Moine itinérant",
      emoji: "🧘",
      idle: [
        "Je marche, je prie, je mange. Dans l'ordre inverse, parfois.",
        "Le vide, mon enfant, n'est pas rien. C'est un bol avant le riz."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "Un soleil est tombé. Le monde est plus léger de quelques péchés de feu."
          ]
        }
      ]
    },
    matchmaker_hong: {
      name: "Dame Hong",
      title: "Marieuse du canton",
      emoji: "💐",
      idle: [
        "Je marie tout le monde. Même ceux qui n'ont rien demandé, surtout ceux-là.",
        "Un bon mariage est une bonne récolte : on sème tôt, on arrose, on prie."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "Les mariages se multiplient quand la pluie revient. Je vous recommande de ne pas rester seul, archer."
          ]
        }
      ]
    },
    lao_shuo_riz: {
      name: "Lao Shuo",
      title: "Conteur itinérant",
      emoji: "📜",
      idle: [
        "Écoutez, écoutez ! L'histoire de l'archer qui ne manquait jamais son soleil !",
        "Je raconte les légendes. Les héros me paient en anecdotes."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "J'ai déjà une chanson sur vous. Elle est mauvaise, mais elle rime."
          ]
        }
      ]
    },
    crow_wing: {
      name: "Aile-Noire",
      title: "Corbeau parlant",
      emoji: "🐦‍⬛",
      idle: [
        "Croa. Tout brille ici, rien ne se mange. Cruel pays.",
        "Je vole ce qui brille. Le reste, je le regarde avec mépris."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "Croa. Le gardien de la digue est tombé. Plus personne pour nous empêcher de piller. Moi, je me range des affaires."
          ]
        }
      ]
    },
    toad_chan: {
      name: "Chan",
      title: "Crapaud sage",
      emoji: "🐸",
      idle: [
        "Ribbit. Depuis que la mare est sèche, je médite sur la nature de l'eau.",
        "Je vois tout depuis mon rocher. Et je le répète à qui paie en mouches."
      ],
      talk: [
        {
          whenDone: "sun_1",
          lines: [
            "La digue n'est plus gardée par la colère. Je reprendrai peut-être mes chants du soir."
          ]
        }
      ]
    }
  },
  chests: {
    mill_flour_bin: {
      label: "Coffre à farine",
      openText: "🎁 Sous la dernière farine, une petite bourse de meunier, enfarinée.",
      emoji: "🌾",
      emojiOpened: "🌾"
    },
    firefly_jar: {
      label: "Jarre de lucioles",
      openText: "🎁 Une jarre qui brille doucement, avec quelques pièces collées au fond.",
      emoji: "🫙",
      emojiOpened: "🫙"
    },
    duck_pond_cache: {
      label: "Cache de l'étang",
      openText: "🎁 Au bord de l'étang, une bague de pigeonnier et quelques pièces de canard.",
      emoji: "🦆",
      emojiOpened: "🦆"
    },
    hamlet_well_box: {
      label: "Coffre du puits",
      openText: "🎁 Dans un seau remonté du puits à sec, une bourse oubliée.",
      emoji: "🪣",
      emojiOpened: "🪣"
    },
    rice_idol: {
      label: "Idole de riz cachée",
      openText: "🎁 Une petite idole de riz sculptée, dissimulée derrière les roseaux. Elle cache de la monnaie.",
      emoji: "🗿",
      emojiOpened: "🗿"
    },
    journal_page_riz: {
      label: "Page déchirée dans les roseaux",
      openText: "🎁 Une page arrachée d'un carnet, à l'écriture nerveuse : « Le maître ne me regarde jamais. »",
      emoji: "📄",
      emojiOpened: "📄"
    }
  },
  quests: [
    {
      id: "sq_riz_pigeon",
      title: "Le pigeon de Zhao",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "pigeon_zhao",
      turnIn: "pigeon_zhao",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "toad_chan",
          text: "Interroger le crapaud Chan (digue et marais)",
          lines: [
            "Un pigeon ? Il a atterri près de l'étang, tout essoufflé. Cherchez sa bague."
          ]
        },
        {
          type: "chest",
          target: "duck_pond_cache",
          text: "Fouiller la cache au bord de l'étang (Hameau des Lucioles)"
        }
      ],
      offer: [
        "Archer ! Mon meilleur pigeon n'est pas rentré. Il portait un message pour le doyen. Ne me dites pas que j'ai encore perdu un pigeon…"
      ],
      hint: [
        "Le crapaud Chan, sur la digue, a vu l'oiseau. Sa bague doit être près de l'étang du hameau."
      ],
      complete: [
        "Voilà sa bague ! Le pigeon rentrera à pied. Prenez cette plume : un pigeon ne donne rien pour rien, mais il donne une plume."
      ],
      reward: {
        gold: 30,
        fragment: "Plume de pigeon",
        xp: 25
      }
    },
    {
      id: "sq_riz_mill_1",
      title: "Le moulin muet",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "miller_gao",
      turnIn: "miller_gao",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "aunt_liu",
          text: "Interroger Tante Liu (Hameau des Lucioles)",
          lines: [
            "Le bruit ? C'est le fantôme de l'ancien meunier. Il continue de moudre, par habitude. Je lui ai laissé de la lumière, il ne répond pas."
          ]
        }
      ],
      offer: [
        "Chaque nuit, mon moulin gémit. Ce n'est pas le vent : le vent a trop de tact. Demandez à Tante Liu, elle voit des choses."
      ],
      hint: [
        "Tante Liu vit dans la cabane aux lucioles, au hameau. Elle vous attend."
      ],
      complete: [
        "Un fantôme ! Alors il se passe bien quelque chose. Il faudra l'affronter, mais c'est une autre histoire."
      ],
      reward: {
        gold: 30,
        fragment: "Étincelle de luciole",
        xp: 20
      }
    },
    {
      id: "sq_riz_mill_2",
      title: "Le meunier revenant",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "miller_gao",
      turnIn: "miller_gao",
      requires: [
        "sq_riz_mill_1"
      ],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "rizieres_mill_ghost",
          text: "Apaiser le meunier revenant (digue et marais)"
        }
      ],
      offer: [
        "Il faut le faire taire, archer. Pas par méchanceté : il est mort depuis quarante ans, il ne sait plus quoi faire de ses mains."
      ],
      hint: [
        "Le meunier revenant hante la digue, entre les roseaux. Il traîne un sac de farine invisible."
      ],
      complete: [
        "Il est parti, doucement. J'ai entendu la roue soupirer. Peut-être qu'elle moudra un jour quelque chose de vrai."
      ],
      reward: {
        gold: 40,
        fragment: "Farine d'esprit",
        xp: 30
      }
    },
    {
      id: "sq_riz_mill_3",
      title: "La farine de la fête",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "miller_gao",
      turnIn: "elder_wen",
      requires: [
        "sq_riz_mill_2"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "mill_flour_bin",
          text: "Récupérer la farine dans le coffre du moulin (Hameau des Lucioles)"
        },
        {
          type: "talk",
          target: "elder_wen",
          text: "Porter la farine au Doyen Wen (maison du Doyen, Dongqiao)",
          lines: [
            "Une farine pour la fête de la pluie ? Gao n'a pas perdu l'espoir, bravo à lui. Nous la ferons bénir et nous attendrons le ciel."
          ]
        }
      ],
      offer: [
        "Prenez ma dernière farine, la plus fine. Portez-la au doyen Wen pour la fête de la pluie. Qu'on y croie, au moins !"
      ],
      hint: [
        "La farine est dans le coffre du moulin, au hameau. Le doyen Wen est dans sa maison, à Dongqiao."
      ],
      complete: [
        "Le doyen sourit, les mains dans la farine. « Qu'il pleuve ou non, nous aurons de quoi faire des gâteaux. » C'est un début."
      ],
      reward: {
        gold: 50,
        fragment: "Farine bénie",
        xp: 40
      }
    },
    {
      id: "sq_riz_corbeaux",
      title: "Les corbeaux voleurs",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "duck_fu",
      turnIn: "duck_fu",
      requires: [],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "crow_gang",
          text: "Chasser les corbeaux-démons voleurs (digue et marais)"
        }
      ],
      offer: [
        "Des corbeaux me volent le grain ! Ils croassent en riant. Il faut leur apprendre les bonnes manières, à coups de flèches s'il le faut."
      ],
      hint: [
        "Les deux corbeaux-démons rôdent sur la digue, au-delà du village. Ils adorent ce qui brille."
      ],
      complete: [
        "Mes canards sont sauvés ! Je vous offre un œuf : il porte chance. Il est dur, mais moral."
      ],
      reward: {
        gold: 40,
        fragment: "Plume de corbeau",
        xp: 30
      }
    },
    {
      id: "sq_riz_marieuse",
      title: "Un mariage sans pluie",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "matchmaker_hong",
      turnIn: "matchmaker_hong",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "buffalo_dahei",
          text: "Sonder Dahei le buffle (étable de Dahei, Dongqiao)",
          lines: [
            "Meuh. Me marier ? Je suis un buffle, pas un chef de village. Dis à la dame que je réfléchis. Pour toujours."
          ]
        },
        {
          type: "talk",
          target: "scarecrow_cao",
          text: "Sonder Cao l'Épouvantail (place de Dongqiao)",
          lines: [
            "Une épouse ? Je n'ai que de la paille et des oiseaux. Dis-lui merci, mais j'ai déjà un champ à garder."
          ]
        }
      ],
      offer: [
        "Archer, aidez-moi : j'ai décidé de marier Dahei et Cao. Ils s'entendront à merveille : l'un rumine, l'autre ne bouge pas."
      ],
      hint: [
        "Dahei est dans son étable, Cao sur la place. Sondez-les tous les deux."
      ],
      complete: [
        "Deux refus ! Quel échec… Mais un échec gracieux. Acceptez mon fragment de ruban rouge : il a servi à vingt-trois mariages."
      ],
      reward: {
        gold: 30,
        fragment: "Ruban rouge",
        xp: 25
      }
    },
    {
      id: "sq_riz_hameau",
      title: "Le hameau des lucioles",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "grandma_tao",
      turnIn: "grandma_tao",
      requires: [],
      side: true,
      objectives: [
        {
          type: "visit",
          target: "rizieres_hamlet",
          text: "Rejoindre le Hameau des Lucioles (chemin latéral de la digue)"
        },
        {
          type: "talk",
          target: "aunt_liu",
          text: "Prendre des nouvelles de Tante Liu",
          lines: [
            "Tao m'envoie un archer ? C'est donc qu'elle pense à moi. Dites-lui que mes lucioles lui font signe."
          ]
        }
      ],
      offer: [
        "Ma vieille amie Liu vit au hameau des lucioles, au-delà de la digue. Je n'ai plus les jambes. Allez la voir pour moi."
      ],
      hint: [
        "Le chemin du hameau part de la digue, sur le côté. Tante Liu vous attend dans sa cabane."
      ],
      complete: [
        "Elle a pensé à moi ! Mes vieux os vont mieux déjà. Prenez ce brin de lumière : une luciole l'a laissé sur mon châle."
      ],
      reward: {
        gold: 35,
        fragment: "Lueur de luciole",
        xp: 25
      }
    },
    {
      id: "sq_riz_gateau",
      title: "Les lanternes de Chang'e",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "change",
      turnIn: "change",
      requires: [
        "q_sun_1"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "firefly_jar",
          text: "Rapporter une jarre de lucioles (Hameau des Lucioles)"
        },
        {
          type: "talk",
          target: "miller_gao",
          text: "Demander de la farine au meunier Gao (moulin tari, hameau)",
          lines: [
            "De la farine pour Chang'e ? Prenez le sac du fond, il est encore blanc. Dites-lui que mon moulin tourne pour elle."
          ]
        }
      ],
      offer: [
        "Hou Yi, tu repars bientôt, et je voudrais faire des lanternes pour la lune. Il me faut de la lumière et de la farine : les lucioles et le meunier du hameau."
      ],
      hint: [
        "La jarre à lucioles est chez Tante Liu, la farine chez Gao. Les deux au hameau, après la digue."
      ],
      complete: [
        "Elle sourit en allumant la première lanterne. « Pour que tu retrouves toujours le chemin de la maison. » Tu gardes ce fragment, tout près du cœur."
      ],
      reward: {
        gold: 50,
        fragment: "Lanterne de Chang'e",
        xp: 35
      }
    },
    {
      id: "sq_journal_1",
      title: "Une page tombée du ciel",
      chapter: "✦ Quête secondaire — Rizières Desséchées",
      giver: "grandma_tao",
      turnIn: "grandma_tao",
      requires: [],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_riz",
          text: "Retrouver la page déchirée (digue et marais)"
        }
      ],
      offer: [
        "J'ai vu un papier voler dans les roseaux. L'écriture ressemble à celle du disciple, ce Fengmeng. Allez la chercher, et nous lirons ensemble."
      ],
      hint: [
        "La page est restée dans les roseaux de la digue. Cherchez une tache blanche."
      ],
      complete: [
        "« Le maître ne me regarde jamais. » C'est tout ce qu'elle dit. Je crois que ce garçon souffre d'une jalousie qui n'a pas de nom. Gardez cette page, archer."
      ],
      reward: {
        gold: 35,
        fragment: "Page du carnet (I)",
        xp: 25
      }
    }
  ]
};

// Textes additionnels — Lit du Fleuve Jaune (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    fleuve_hamlet: {
      name: "Écluse-aux-Oies",
      arrival: [
        "Écluse-aux-Oies surveille un canal sans eau. Les oies, elles, continuent de monter la garde avec un sérieux de magistrats.",
        "Ici, on parle de crues comme d'anciennes amours."
      ]
    },
    fleuve_h2_ecluse: {
      name: "Maison de l'éclusier Rong",
      arrival: [
        "Des registres de crues s'empilent jusqu'au plafond. Chaque page commence par « Aujourd'hui, il pleut ». Aucune ne finit pareil."
      ]
    },
    fleuve_h2_pecheur: {
      name: "Cabane de Dame Wei",
      arrival: [
        "Des filets partout, comme une forêt de dentelle. Dame Wei raccommode sans lever les yeux, mais voit tout."
      ]
    }
  },
  npcs: {
    sluicekeeper_rong: {
      name: "Rong",
      title: "Éclusier du fleuve",
      idle: [
        "Je garde une écluse sans fleuve. C'est une charge honorable, à défaut d'être utile.",
        "Quand l'eau reviendra, je serai prêt. J'ai graissé tous mes leviers, trois fois."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Un soleil de moins, et j'ai entendu l'écluse gémir. Elle se souvient de l'eau, la pauvre."
          ]
        }
      ]
    },
    net_mender_wei: {
      name: "Dame Wei",
      title: "Raccommodeuse de filets",
      idle: [
        "Chaque maille est une pensée. Je raccommode des filets qui n'attrapent plus que du vent.",
        "Mon fils est parti pêcher en mer. Il ne m'écrit pas. Je lui tricote des chaussettes pour le prix de son silence."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Les mailles sont plus souples, ce soir. Le fleuve va revenir, je le sens aux doigts."
          ]
        }
      ]
    },
    goose_dagong: {
      name: "Dagong",
      title: "Oie sauvage vigilante",
      idle: [
        "Hon ! Qui va là ? Ah, c'est vous. Passez. L'oie garde, l'oie voit, l'oie mord.",
        "Nous suivons la route des étoiles. Un jour, nous partirons vers le sud, toutes ensemble."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Hon. Le deuxième soleil est tombé. Les oies ont dansé, ce qui est rare et pas très gracieux."
          ]
        }
      ]
    },
    orphan_xiaoyu: {
      name: "Xiaoyu",
      title: "Petit orphelin des quais",
      idle: [
        "J'ai trouvé un poisson séché. Il est vieux, mais il est à moi.",
        "Quand je serai grand, je construirai un bateau en papier qui flottera sur la boue."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Il y a une flaque aujourd'hui ! Une vraie ! J'y ai mis mon poisson. Il va mieux."
          ]
        }
      ]
    },
    ferry_pei: {
      name: "Pei",
      title: "Apprenti passeur",
      idle: [
        "Gu m'apprend le métier. Pour l'instant, je rame sur le sable, c'est de l'entraînement.",
        "Un passeur doit savoir se taire. Moi, j'ai encore beaucoup de progrès à faire."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Mon maître a souri en regardant l'horizon. C'est la première fois depuis des semaines."
          ]
        }
      ]
    },
    fortune_sha: {
      name: "Dame Sha",
      title: "Diseuse de bonne aventure",
      idle: [
        "Je vois l'avenir ! Hélas, il est aussi sec que le présent.",
        "Une rumeur dans mes cartes : un disciple jaloux fera pleurer son maître. Je ne dis pas qui. Je le sais, c'est tout."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Mes cartes disent : « le fleuve revient ». C'est la première fois qu'elles ne mentent pas."
          ]
        }
      ]
    },
    poet_bo: {
      name: "Bo",
      title: "Poète ivre",
      idle: [
        "Ô fleuve, rends-moi mes rimes ! Elles ont coulé avec toi.",
        "J'écris à l'encre de vin. Mes vers sont moins bons, mais plus sincères."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Un nouveau vers m'est venu : « Le soleil tombe, le poète se relève ». Il est nul. Je le garde."
          ]
        }
      ]
    },
    tea_zhuang: {
      name: "Zhuang",
      title: "Marchand de thé ambulant",
      idle: [
        "Du thé du Sud ! Chaud, froid, ou entre les deux, selon le prix.",
        "Mes clients disent que mon thé réveille les morts. Je dis : prenez-en pas trop."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Un soleil de moins : mon thé refroidit plus lentement. Bon pour les affaires."
          ]
        }
      ]
    },
    mud_imp_pit: {
      name: "Pit",
      title: "Diablotin de vase",
      idle: [
        "Chuuut ! Je suis invisible. Ne le répétez pas.",
        "Je joue dans la boue. Je ne fais rien de mal. Presque rien."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Pit s'est vexé de vous avoir croisé. Il n'a pas répondu."
          ]
        }
      ]
    },
    captain_lo: {
      name: "Capitaine Lo",
      title: "Fantôme d'un capitaine de barge",
      idle: [
        "Ma barge repose sur le flanc. Je l'ai coulée avec mon honneur et mes dettes.",
        "Je garde mon coffre. Il n'y a rien dedans, sauf une promesse."
      ],
      talk: [
        {
          whenDone: "sun_2",
          lines: [
            "Le capitaine soupire dans les roseaux. Il semble plus serein."
          ]
        }
      ]
    }
  },
  chests: {
    sluice_logbook_box: {
      label: "Coffret du registre",
      openText: "Entre deux registres de crues, une bourse d'éclusier.",
    },
    net_basket: {
      label: "Panier à filets",
      openText: "Au fond du panier, des pièces nouées dans un mouchoir de laine.",
    },
    goose_nest: {
      label: "Nid d'oie",
      openText: "Dans le nid de duvet, quelques pièces et un œuf bleu dont on ne sait que faire.",
    },
    barge_strongbox: {
      label: "Coffre du capitaine",
      openText: "Le coffre du capitaine Lo : un trésor modeste, une lettre jaunie et un vieux compas de cuivre.",
    },
    reed_stash: {
      label: "Cache de roseaux",
      openText: "Dans les roseaux fanés, une cache de contrebandier : or terni et huile de lampe.",
    },
    journal_page_fle: {
      label: "Page prise dans la vase",
      openText: "Une page à demi dissoute : « J'ai suivi mon maître à distance. Il n'a pas retourné la tête. »",
    }
  },
  quests: [
    {
      id: "sq_fle_oies",
      title: "Les oies de l'éclusier",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "sluicekeeper_rong",
      turnIn: "sluicekeeper_rong",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "goose_dagong",
          text: "Parler à l'oie Dagong (Écluse-aux-Oies)",
          lines: [
            "Hon ! Ouvrez l'œil : le nid est sous la passerelle. Ne touchez pas aux œufs, mais prenez la bourse qui dort dessous."
          ]
        },
        {
          type: "chest",
          target: "goose_nest",
          text: "Fouiller le nid d'oie sous la passerelle"
        }
      ],
      offer: [
        "Mes oies ont déserté la passerelle. Ma sentinelle favorite, Dagong, saura où elles nichent. Allez la voir, archer."
      ],
      hint: [
        "Dagong est au hameau, près de la passerelle. Le nid est juste dessous."
      ],
      complete: [
        "Les oies sont de retour ! Elles font un vacarme du diable, mais j'adore ça. Prenez cette plume d'oie : elle écrit droit."
      ],
      reward: {
        gold: 45,
        fragment: "Plume d'oie sauvage",
        xp: 50
      }
    },
    {
      id: "sq_fle_epave_1",
      title: "Le capitaine de l'épave",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "scribe_ou",
      turnIn: "scribe_ou",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "captain_lo",
          text: "Écouter le capitaine Lo (méandres de boue)",
          lines: [
            "Une promesse. J'avais promis à Gu de lui remettre son héritage. Mon équipage me retient. Libérez-les, et mon coffre sera à vous."
          ]
        }
      ],
      offer: [
        "Un fantôme errant demande qu'on l'écoute. Je suis écrivain, pas exorciste. Parlez-lui, archer : il a une histoire."
      ],
      hint: [
        "Le capitaine Lo hante l'épave, dans les méandres, derrière le village."
      ],
      complete: [
        "Une promesse non tenue… On ne meurt jamais tranquille quand on a laissé une dette. Il faudra l'aider davantage."
      ],
      reward: {
        gold: 40,
        fragment: "Cordage fantôme",
        xp: 40
      }
    },
    {
      id: "sq_fle_epave_2",
      title: "Les matelots noyés",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "scribe_ou",
      turnIn: "scribe_ou",
      requires: [
        "sq_fle_epave_1"
      ],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "barge_ghosts",
          text: "Dissiper les matelots noyés revenants (méandres de boue)"
        }
      ],
      offer: [
        "Il faut libérer l'équipage, archer. Deux matelots, noyés, rôdent autour de la barge. Ils sont fidèles jusqu'à l'obstination."
      ],
      hint: [
        "Les deux matelots rôdent près de l'épave. Ils portent encore leurs cirés."
      ],
      complete: [
        "Ils sont partis en paix. J'ai entendu une chanson de matelots sur le vent. Elle était fausse. Elle était belle."
      ],
      reward: {
        gold: 55,
        fragment: "Écume noyée",
        xp: 60
      }
    },
    {
      id: "sq_fle_epave_3",
      title: "L'héritage de Gu",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "scribe_ou",
      turnIn: "ferryman_gu",
      requires: [
        "sq_fle_epave_2"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "barge_strongbox",
          text: "Ouvrir le coffre du capitaine Lo (méandres de boue)"
        },
        {
          type: "talk",
          target: "ferryman_gu",
          text: "Remettre l'héritage au passeur Gu (cabane du passeur)",
          lines: [
            "Lo ! Ce vieux crabe… Il m'avait promis son compas. Je le garde, il me rappelle que même les fantômes tiennent parole."
          ]
        }
      ],
      offer: [
        "Le coffre du capitaine est libre. Il contient un héritage pour Gu, son vieux compagnon de rames. Portez-le-lui."
      ],
      hint: [
        "Le coffre est dans l'épave, dans les méandres. Gu est dans sa cabane, au village."
      ],
      complete: [
        "Gu serre le compas dans sa main. Il regarde le fleuve vide. « Un jour, il me guidera à nouveau. »"
      ],
      reward: {
        gold: 70,
        fragment: "Compas du capitaine",
        xp: 80
      }
    },
    {
      id: "sq_fle_poeme",
      title: "Le poème du fleuve",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "poet_bo",
      turnIn: "poet_bo",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "girl_lian",
          text: "Recueillir une rime auprès de Lian (place de Hekou)",
          lines: [
            "Une rime ? « Coquille » et « gentille » ! Dis au poète qu'il peut les garder."
          ]
        },
        {
          type: "talk",
          target: "boatman_shan",
          text: "Recueillir une rime auprès de Laoshan (place de Hekou)",
          lines: [
            "« Rame » et « âme » ! Ça rime, non ? Dis-lui d'arrêter de boire pour mieux écrire."
          ]
        },
        {
          type: "talk",
          target: "gui_turtle",
          text: "Recueillir une rime auprès de la tortue Gui (mare de la Tortue)",
          lines: [
            "« Éternité » et « humidité ». Ce sont les deux seules choses que je connaisse."
          ]
        }
      ],
      offer: [
        "Archer ! Mon poème du fleuve est inachevé. Il me manque trois rimes, que je n'ose demander moi-même. Allez voir la petite, le batelier et la tortue."
      ],
      hint: [
        "Lian et Laoshan sont sur la place. La tortue Gui est dans sa mare."
      ],
      complete: [
        "« Coquille gentille, rame âme, éternité humidité » ! Mon chef-d'œuvre est complet. Il est nul. J'adore."
      ],
      reward: {
        gold: 50,
        fragment: "Rime du fleuve",
        xp: 55
      }
    },
    {
      id: "sq_fle_the",
      title: "Le thé qui voyage",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "tea_zhuang",
      turnIn: "tea_zhuang",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "weaver_mei",
          text: "Livrer le thé à Mei (atelier de Mei, Hekou)",
          lines: [
            "Du thé du Sud ? Quel luxe ! Je tisse mieux en buvant. Remerciez Zhuang pour moi."
          ]
        },
        {
          type: "talk",
          target: "net_mender_wei",
          text: "Livrer le thé à Dame Wei (cabane de Dame Wei, Écluse-aux-Oies)",
          lines: [
            "Un sachet de thé ! Mon fils m'en rapportait quand il passait… Merci, archer. Je boirai à sa santé."
          ]
        }
      ],
      offer: [
        "J'ai deux sachets de thé de grand cru, pour deux clientes fidèles : Mei à Hekou, Dame Wei à l'écluse. Mes jambes refusent. Portez-les, archer."
      ],
      hint: [
        "Mei est dans son atelier à Hekou. Dame Wei est au hameau d'Écluse-aux-Oies."
      ],
      complete: [
        "Mes deux clientes sont ravies ! Prenez ce pan de thé séché : il est parfumé et ne trahit personne."
      ],
      reward: {
        gold: 55,
        fragment: "Feuille de thé",
        xp: 60
      }
    },
    {
      id: "sq_fle_boue",
      title: "Les diablotins de la vase",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "net_mender_wei",
      turnIn: "net_mender_wei",
      requires: [],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "mud_imps",
          text: "Disperser les diablotins de vase (méandres de boue)"
        }
      ],
      offer: [
        "Ces petites pestes me rongent les filets ! Je ne leur en veux pas, ils s'ennuient. Mais mes mailles, si."
      ],
      hint: [
        "Deux diablotins de vase rôdent dans les méandres. Ils aiment les filets et les farces."
      ],
      complete: [
        "Mes filets sont sauvés. Tenez, un peu de ma meilleure maille : elle retient l'eau et les flèches."
      ],
      reward: {
        gold: 55,
        fragment: "Maille de filet",
        xp: 60
      }
    },
    {
      id: "sq_fle_golem",
      title: "Le golem de l'écluse",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "sluicekeeper_rong",
      turnIn: "sluicekeeper_rong",
      requires: [
        "q_sun_2"
      ],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "fleuve_sluice_golem",
          text: "Abattre le golem de l'écluse (méandres de boue)"
        }
      ],
      offer: [
        "Un golem de fer s'est planté devant ma vanne. Il me regarde comme un reproche. Je ne peux plus faire mon travail."
      ],
      hint: [
        "Le golem de l'écluse se tient au milieu des méandres, près de la grande vanne."
      ],
      complete: [
        "La vanne est libre ! J'ai même osé la caresser. Prenez ce boulon d'écluse : il tient tout ce qu'on lui demande."
      ],
      reward: {
        gold: 65,
        fragment: "Boulon d'écluse",
        xp: 70
      }
    },
    {
      id: "sq_journal_2",
      title: "Le carnet dans la vase",
      chapter: "✦ Quête secondaire — Lit du Fleuve Jaune",
      giver: "scribe_ou",
      turnIn: "scribe_ou",
      requires: [
        "sq_journal_1"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_fle",
          text: "Retrouver la page dans la vase (méandres de boue)"
        }
      ],
      offer: [
        "Une autre page, archer. Je les reconnais à leur manière de s'échapper. Celle-ci est dans la vase, quelque part dans les méandres."
      ],
      hint: [
        "Cherchez dans la boue des méandres, du côté des roseaux. Le papier est jauni."
      ],
      complete: [
        "« J'ai suivi mon maître à distance. Il n'a pas retourné la tête. » Nous lisons ce garçon comme on lit une fable triste."
      ],
      reward: {
        gold: 50,
        fragment: "Page du carnet (II)",
        xp: 55
      }
    }
  ]
};

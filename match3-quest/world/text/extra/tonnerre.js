// Textes additionnels — Monts du Tonnerre (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    tonnerre_hamlet: {
      name: "Refuge des Trois Cairns",
      arrival: [
        "Le Refuge des Trois Cairns n'a que trois cairns, quatre cabanes et mille opinions sur la météo. Chaque voyageur y laisse un caillou et en emporte un autre.",
        "Un sentier de pierre le relie aux crêtes, à l'écart du village."
      ]
    },
    tonnerre_h2_garde: {
      name: "Poste du garde de col",
      arrival: [
        "Le feu crépite dans une cheminée trop grande. Au mur, une cloche attend l'orage ou le visiteur."
      ]
    },
    tonnerre_h2_verre: {
      name: "Verrerie de la foudre",
      arrival: [
        "Des vitraux bleus et jaunes captent l'éclat des éclairs. Dehors, l'orage ; dedans, de la lumière en bouteille."
      ]
    }
  },
  npcs: {
    pass_guard_kuang: {
      name: "Kuang",
      title: "Garde du col",
      idle: [
        "Je garde le col depuis vingt ans. Il n'a jamais tenté de s'enfuir. Je le surveille quand même.",
        "Chaque passant écrit son nom dans mon registre. L'archer qui est passé hier a écrit « personne »."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Le cinquième soleil, tombé ! Mon registre en tremble. J'inscris « victoire » en rouge."
          ]
        }
      ]
    },
    glassblower_ouyang: {
      name: "Ouyang",
      title: "Souffleur de verre",
      idle: [
        "Le sable foudroyé donne un verre plein de sursauts. Ça pétille, ça éclate, ça enchante.",
        "Chaque vitrail est une tempête captive. Je lui chante une berceuse pour qu'elle dorme."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Mon verre est plus clair depuis le départ du soleil des orages. Les vitraux soupirent d'aise."
          ]
        }
      ]
    },
    goat_yang: {
      name: "Yang",
      title: "Chèvre de montagne bavarde",
      idle: [
        "Mêh ! Je grimpe, je saute, je mange du lichen. La vie est un caillou chaud.",
        "Les humains ont peur de la foudre. Moi, je la prends pour un sifflement."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Mêh ! Un soleil de moins, c'est un caillou plus frais ! Merci, archer."
          ]
        }
      ]
    },
    climber_dai: {
      name: "Dai",
      title: "Alpiniste solitaire",
      idle: [
        "Je grimpe pour trouver. Je ne sais pas quoi. Mon frère le savait.",
        "Les cimes ne parlent pas. Elles écoutent, c'est pire."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "J'ai levé la tête ce matin. Le ciel n'était plus en colère. Mon frère aurait aimé ça."
          ]
        }
      ]
    },
    fairy_yun: {
      name: "Yunxi",
      title: "Fée des nuages",
      idle: [
        "Je suis un nuage qui a pris forme humaine. Le matin, je me dissipe, le soir, je m'épaissis.",
        "Les orages sont mes cousins mal élevés. Je leur ai demandé de baisser le ton."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Les orages sont moins sévères. Je flotte plus facilement, c'est agréable."
          ]
        }
      ]
    },
    bard_xiang: {
      name: "Xiang",
      title: "Barde du vent",
      idle: [
        "Je chante les orages. Ils me répondent. Une fois, un éclair m'a demandé de rejouer.",
        "Ma lyre est faite de câbles de cuivre. Elle joue avec les nuages."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Je compose une ballade : « Ô archer, ton nom est foudre ». C'est un début. Je cherche la rime."
          ]
        }
      ]
    },
    rain_pu: {
      name: "Pu",
      title: "Marchand de pluie",
      idle: [
        "Pluie en bouteille ! Pluie fraîche, pluie rare, pluie garantie d'origine !",
        "Mon stock est limité, mon enthousiasme non."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Un soleil de moins, c'est de la pluie en plus. Je songe à baisser mes prix."
          ]
        }
      ]
    },
    keeper_ao: {
      name: "Ao",
      title: "Gardien des cairns",
      idle: [
        "Je veille sur les trois cairns. Chacun a sa personnalité : l'un bavarde, l'autre pleure, le dernier boude.",
        "Pose un caillou, enlève un caillou. C'est l'équilibre du monde."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Les cairns se tiennent droit, ce soir. On dirait qu'ils saluent."
          ]
        }
      ]
    },
    porter_san: {
      name: "San",
      title: "Porteur de montagne",
      idle: [
        "Je porte des sacs pour qui paie. Parfois, je porte des histoires pour qui écoute.",
        "Le plus lourd, c'est ce qu'on ne dit pas."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Mon dos va mieux. Le fardeau est plus léger, depuis que le ciel s'est apaisé."
          ]
        }
      ]
    },
    pup_tuan: {
      name: "Tuantuan",
      title: "Chiot d'orage",
      idle: [
        "Wouf ! Je suis fait d'étincelles. Ne me touche pas si tu n'aimes pas les picotements.",
        "Je poursuis les éclairs. Je n'en ai jamais attrapé un. Un jour."
      ],
      talk: [
        {
          whenDone: "sun_5",
          lines: [
            "Wouf ! L'orage est parti jouer ailleurs. Je le retrouverai demain."
          ]
        }
      ]
    }
  },
  chests: {
    guard_post_box: {
      label: "Caisse du poste",
      openText: "La solde mise de côté d'un garde qui n'a jamais eu l'occasion de la dépenser.",
    },
    glass_chest: {
      label: "Coffre du souffleur",
      openText: "Entre deux vitraux emballés dans la paille, des pièces tintent.",
    },
    goat_shed: {
      label: "Abri de la chèvre",
      openText: "Sous le foin de l'abri, un petit pécule et un grelot.",
    },
    thunder_urn: {
      label: "Urne de sable foudroyé",
      openText: "Une urne de fulgurite, légère et fragile. Elle contient du sable cristallisé et de l'argent.",
    },
    peak_cache: {
      label: "Cache du sommet",
      openText: "Une cache d'alpiniste calée sous un surplomb : corde, piolet, et des pièces serrées dans un étui.",
    },
    journal_page_ton: {
      label: "Page prise entre deux rochers",
      openText: "Une page pliée entre deux pierres : « J'ai fait semblant d'être calme. Il m'a félicité. C'est pire. »",
    }
  },
  quests: [
    {
      id: "sq_ton_verre_1",
      title: "Le sable qui brille",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "glassblower_ouyang",
      turnIn: "glassblower_ouyang",
      requires: [],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "thunder_urn",
          text: "Récupérer l'urne de sable foudroyé (Crêtes foudroyées)"
        }
      ],
      offer: [
        "Mon four manque de sable foudroyé. Il est dans une urne, sur les crêtes, en équilibre précaire. Rapportez-la, archer, avec délicatesse."
      ],
      hint: [
        "L'urne est sur les crêtes, dans une anfractuosité. N'éternuez pas."
      ],
      complete: [
        "Du sable de foudre ! Voyez comme il brille, même à l'ombre. Je vais fabriquer un verre qui retient l'orage."
      ],
      reward: {
        gold: 100,
        fragment: "Sable de foudre",
        xp: 185
      }
    },
    {
      id: "sq_ton_verre_2",
      title: "Le serpenteau chapardeur",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "glassblower_ouyang",
      turnIn: "glassblower_ouyang",
      requires: [
        "sq_ton_verre_1"
      ],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "tonnerre_wyrm_calf",
          text: "Chasser le serpenteau d'orage (Crêtes foudroyées)"
        }
      ],
      offer: [
        "Un petit serpent-dragon a pris mes vitraux pour des bonbons. Je l'aime bien, mais pas à ce point. Chassez-le."
      ],
      hint: [
        "Le serpenteau d'orage rôde sur les crêtes, à la lisière des cairns. Il crépite."
      ],
      complete: [
        "Mes vitraux sont saufs ! Le petit n'a pas trop de rancœur. Voici une écaille d'éclair, il l'a laissée en partant."
      ],
      reward: {
        gold: 125,
        fragment: "Écaille d'éclair",
        xp: 230
      }
    },
    {
      id: "sq_ton_verre_3",
      title: "Le verre de Tie",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "glassblower_ouyang",
      turnIn: "glassblower_ouyang",
      requires: [
        "sq_ton_verre_2"
      ],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "smith_tie",
          text: "Apporter le verre de foudre à Tie (Forge de Tie)",
          lines: [
            "Un verre qui capte l'orage ? Voilà qui fera des flèches magnifiques. Dites à Ouyang que je suis sous le charme."
          ]
        }
      ],
      offer: [
        "Le verre est coulé. Portez-le à Tie, le forgeron. Il saura en faire un œil de flèche, à condition de ne pas le casser."
      ],
      hint: [
        "Tie est à sa forge, dans le village des Forges-Éclairs."
      ],
      complete: [
        "Tie m'a envoyé un billet : « Il brille comme une promesse. » Voilà un éclat de mon dernier lot, pour vous."
      ],
      reward: {
        gold: 165,
        fragment: "Œil d'orage",
        xp: 300
      }
    },
    {
      id: "sq_ton_pluie",
      title: "La pluie de Pu",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "rain_pu",
      turnIn: "rain_pu",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "hermit_lei",
          text: "Interroger l'ermite Lei (Grotte-cabane de Lei)",
          lines: [
            "La pluie ? Elle vient quand elle veut. Demandez-lui poliment, et attendez."
          ]
        },
        {
          type: "talk",
          target: "fairy_yun",
          text: "Interroger la fée Yunxi (Crêtes foudroyées)",
          lines: [
            "De la pluie ? Mes cousins les nuages en ont. Mais ils sont timides. Dites à Pu de les inviter à dîner."
          ]
        },
        {
          type: "talk",
          target: "kids_leimei",
          text: "Interroger Leimei (place des Forges-Éclairs)",
          lines: [
            "La pluie ? C'est le tonnerre qui pleure. Dis à Pu de lui chanter une chanson."
          ]
        }
      ],
      offer: [
        "Je vends de la pluie en bouteille, mais elle est factice ! J'aimerais de la vraie. Interrogez les experts : l'ermite, la fée et la petite."
      ],
      hint: [
        "Lei est dans sa grotte, Yunxi sur les crêtes, Leimei sur la place."
      ],
      complete: [
        "Les conseils sont contradictoires, mais ils sont tous poétiques. Je vais inviter les nuages à dîner. En attendant, voici une fiole de vraie pluie."
      ],
      reward: {
        gold: 125,
        fragment: "Pluie en fiole",
        xp: 230
      }
    },
    {
      id: "sq_ton_cavaliers",
      title: "Les cavaliers de l'orage",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "pass_guard_kuang",
      turnIn: "pass_guard_kuang",
      requires: [
        "q_sun_5"
      ],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "storm_riders",
          text: "Disperser les cavaliers de l'orage (Crêtes foudroyées)"
        }
      ],
      offer: [
        "Deux cavaliers, mi-généraux mi-éclairs, rançonnent mon col. Je suis garde, pas héros. Pouvez-vous leur faire la leçon ?"
      ],
      hint: [
        "Les cavaliers patrouillent sur les crêtes, entre les cairns. Ils crépitent."
      ],
      complete: [
        "Mon col est libre ! J'ai écrit « victoire » dans mon registre, en rouge. Prenez cet éperon d'orage."
      ],
      reward: {
        gold: 150,
        fragment: "Éperon d'orage",
        xp: 275
      }
    },
    {
      id: "sq_ton_chevre",
      title: "La chèvre qui n'en fait qu'à sa tête",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "keeper_ao",
      turnIn: "keeper_ao",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "goat_yang",
          text: "Convaincre la chèvre Yang (Refuge des Trois Cairns)",
          lines: [
            "Mêh ! Le caillou ? Je l'ai mis sous le foin pour le garder au chaud. On n'a jamais rien dit de plus raisonnable !"
          ]
        },
        {
          type: "chest",
          target: "goat_shed",
          text: "Fouiller l'abri de la chèvre"
        }
      ],
      offer: [
        "Le caillou des offrandes a disparu ! J'ai interrogé les cairns, ils sont muets. Reste la chèvre. Parlez-lui, elle comprend les cailloux."
      ],
      hint: [
        "Yang est au hameau, dans l'abri près des cairns. Soyez patient."
      ],
      complete: [
        "Le caillou est revenu. Les cairns grincent de bonheur. Prenez ce fragment de schiste : il a dormi avec la chèvre."
      ],
      reward: {
        gold: 100,
        fragment: "Schiste de chèvre",
        xp: 185
      }
    },
    {
      id: "sq_ton_lion",
      title: "Le lion fendu",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "nun_ying",
      turnIn: "nun_ying",
      requires: [],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "tonnerre_stone_lion",
          text: "Calmer le lion-gardien fendu (Crêtes foudroyées)"
        }
      ],
      offer: [
        "Le lion-gardien de la chapelle s'est fissuré sous la foudre. Il erre, désorienté, dans les crêtes. Calmez-le sans le briser de nouveau."
      ],
      hint: [
        "Le lion fendu rôde sur les crêtes, près des cairns. Il rugit d'une voix de pierre."
      ],
      complete: [
        "Il est paisible, adossé au rocher, la gueule tournée vers le ciel. Il gardera la chapelle comme avant. Merci, archer."
      ],
      reward: {
        gold: 140,
        fragment: "Éclat de lion",
        xp: 255
      }
    },
    {
      id: "sq_ton_dai",
      title: "Le frère de Dai",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "climber_dai",
      turnIn: "climber_dai",
      requires: [],
      side: true,
      objectives: [
        {
          type: "visit",
          target: "tonnerre_wild",
          text: "Atteindre les crêtes foudroyées"
        },
        {
          type: "chest",
          target: "peak_cache",
          text: "Trouver la cache du sommet (Crêtes foudroyées)"
        }
      ],
      offer: [
        "Mon frère a laissé une cache sous un surplomb, avant de disparaître. Je n'ose pas y monter. Pouvez-vous la chercher pour moi ?"
      ],
      hint: [
        "La cache est calée sous un surplomb, tout en haut des crêtes. Cherchez une corde tressée."
      ],
      complete: [
        "Il y a un mot dans l'étui : « Pour Dai, quand tu seras assez grand pour me pardonner. » Dai sourit entre ses larmes."
      ],
      reward: {
        gold: 140,
        fragment: "Corde du frère",
        xp: 255
      }
    },
    {
      id: "sq_journal_5",
      title: "Une page entre deux rochers",
      chapter: "✦ Quête secondaire — Monts du Tonnerre",
      giver: "innkeeper_pao",
      turnIn: "innkeeper_pao",
      requires: [
        "sq_journal_4"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_ton",
          text: "Retrouver la page entre les rochers (Crêtes foudroyées)"
        }
      ],
      offer: [
        "Un client est passé, l'air vexé. Il a glissé un papier entre deux rochers, là-haut, sur les crêtes. Allez voir ce que c'est, archer."
      ],
      hint: [
        "La page est pliée entre deux pierres, sur les crêtes."
      ],
      complete: [
        "« J'ai fait semblant d'être calme. Il m'a félicité. C'est pire. » Pao verse une soupe fumante : « Pour vous, archer. Pour lui, plus tard. »"
      ],
      reward: {
        gold: 115,
        fragment: "Page du carnet (V)",
        xp: 205
      }
    }
  ]
};

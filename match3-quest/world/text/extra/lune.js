// Textes additionnels — Pic de la Lune (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {},
  npcs: {
    moon_cook_gui: {
      name: "Gui",
      title: "Cuisinier de gâteaux de lune",
      emoji: "🥮",
      idle: [
        "Je fais des gâteaux de lune pour les habitants du hameau. Ils se plaignent, puis en redemandent.",
        "La pâte de lotus est un art. La pâte de haricot, un artisanat."
      ],
      talk: [
        {
          whenDone: "fengmeng_3a",
          lines: [
            "Chang'e m'a envoyé une recette. Elle y a ajouté un mot : « Pour Hou Yi, s'il passe »."
          ]
        }
      ]
    },
    moon_rabbit_yutu: {
      name: "Yutu",
      title: "Lapin de jade",
      emoji: "🐰",
      idle: [
        "Je pile, je pile, je pile. L'élixir de la Reine Mère dort dans une fiole, là-haut, mais l'habitude de piler reste.",
        "Un lapin n'a pas d'avis sur l'immortalité. Il a un avis sur les carottes."
      ],
      talk: [
        {
          whenDone: "fengmeng_3a",
          lines: [
            "Un archer est venu à la Lune ! Je dois le dire à tous les lapins de jade. Ils vont faire des gâteaux."
          ]
        }
      ]
    },
    moon_ferryman_yin: {
      name: "Vieux Yin",
      title: "Passeur d'argent",
      emoji: "⛵",
      idle: [
        "Je fais passer les âmes sur la rivière de lune. Aujourd'hui, seulement deux. Beau temps.",
        "Chang'e m'a demandé si l'on pouvait ne plus jamais redescendre d'ici. Je lui ai dit que la Lune ne retient que ceux qui s'y laissent porter. Elle a serré sa fiole et souri quand même."
      ],
      talk: [
        {
          whenDone: "fengmeng_3a",
          lines: [
            "Quand vous la reverrez, dites-lui que la rivière est calme. Elle comprendra."
          ]
        }
      ]
    },
    moon_child_lan: {
      name: "Lan",
      title: "Petite veilleuse",
      emoji: "🧒",
      idle: [
        "Je garde les lanternes avec la veilleuse. Je ne dors jamais. Je compte les étoiles.",
        "Je suis née ici. Je n'ai jamais vu de rizière. À quoi ça ressemble ?"
      ],
      talk: [
        {
          whenDone: "fengmeng_3a",
          lines: [
            "Il paraît que vous venez d'en bas. Moi, je ne connais que le haut. On pourrait échanger."
          ]
        }
      ]
    },
    moon_crow_wu: {
      name: "Corbeau d'ombre",
      title: "Messager d'ombre",
      emoji: "🐦‍⬛",
      idle: [
        "Croa. Je porte les messages entre la Terre et la Lune. Ils sont rarement joyeux.",
        "Un jeune archer a demandé à passer. Je l'ai envoyé promener. Il a insisté."
      ],
      talk: [
        {
          whenDone: "fengmeng_3a",
          lines: [
            "Croa. L'archer en colère s'approche. Soyez prêt."
          ]
        },
        {
          whenDone: "fengmeng_3b",
          lines: [
            "Croa. L'archer en colère redescend, l'arc baissé. Je porterai ses messages, désormais : ils seront plus doux."
          ]
        }
      ]
    }
  },
  chests: {
    moon_cake_tin: {
      label: "Boîte à gâteaux de lune",
      openText: "🎁 Une boîte de fer-blanc remplie de gâteaux de lune et de quelques pièces d'argent.",
      emoji: "🥮",
      emojiOpened: "🥮"
    },
    jade_mortar_box: {
      label: "Mortier de jade",
      openText: "🎁 Dans le mortier de jade, un petit trésor scintille : poudre d'argent et pièces de lune.",
      emoji: "🏺",
      emojiOpened: "🏺"
    },
    silver_river_cache: {
      label: "Cache de la rivière d'argent",
      openText: "🎁 Une cache déposée par un passeur, au bord de la rivière d'argent.",
      emoji: "🌊",
      emojiOpened: "🌊"
    },
    journal_page_lune: {
      label: "Dernière page du carnet",
      openText: "🎁 La dernière page du carnet : « Je ne veux pas lui faire de mal. Je veux juste qu'il me regarde. Je n'ai que mes flèches. »",
      emoji: "📄",
      emojiOpened: "📄"
    }
  },
  quests: [
    {
      id: "sq_lune_gateaux",
      title: "Les gâteaux de Gui",
      chapter: "✦ Quête secondaire — Pic de la Lune",
      giver: "moon_cook_gui",
      turnIn: "moon_cook_gui",
      requires: [],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "moon_cake_tin",
          text: "Retrouver la boîte à gâteaux (Hameau sous la Lune)"
        },
        {
          type: "talk",
          target: "keeper_lunar",
          text: "Porter un gâteau à la veilleuse Yin (maison de la veilleuse)",
          lines: [
            "Un gâteau de lune ? Mes yeux sont fatigués, mais mon cœur a de la place. Merci, archer."
          ]
        }
      ],
      offer: [
        "Ma boîte de gâteaux de lune a disparu ! Elle contient tout mon travail de la semaine. Retrouvez-la, puis portez une part à la veilleuse."
      ],
      hint: [
        "La boîte est quelque part sur la place du hameau. La veilleuse est dans sa maison."
      ],
      complete: [
        "Les gâteaux sont partis, la boîte est revenue, et le hameau est content. Je vous offre ce fragment de pâte de lotus."
      ],
      reward: {
        gold: 200,
        fragment: "Pâte de lotus",
        xp: 400
      }
    },
    {
      id: "sq_lune_passeur",
      title: "La rivière d'argent",
      chapter: "✦ Quête secondaire — Pic de la Lune",
      giver: "moon_ferryman_yin",
      turnIn: "moon_ferryman_yin",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "moon_crow_wu",
          text: "Écouter le Corbeau d'ombre (sentier d'argent)",
          lines: [
            "La rivière ? Le long du sentier, là où l'argent brille. Une cache y dort. Prenez-la avant que les ombres ne la trouvent."
          ]
        },
        {
          type: "chest",
          target: "silver_river_cache",
          text: "Récupérer la cache de la rivière d'argent (sentier d'argent)"
        }
      ],
      offer: [
        "J'ai déposé quelques souvenirs au bord de la rivière d'argent. Je suis trop vieux pour y retourner. Pouvez-vous les chercher, archer ?"
      ],
      hint: [
        "La cache est au bord de la rivière d'argent, sur le sentier. Le Corbeau d'ombre rôde par là."
      ],
      complete: [
        "Mes souvenirs ! Un peigne, une lettre, un caillou. Je vous offre le caillou : il est plus précieux qu'il n'en a l'air."
      ],
      reward: {
        gold: 200,
        fragment: "Caillou d'argent",
        xp: 400
      }
    },
    {
      id: "sq_lune_ombres",
      title: "Les ombres du miroir",
      chapter: "✦ Quête secondaire — Pic de la Lune",
      giver: "moon_child_lan",
      turnIn: "moon_child_lan",
      requires: [
        "q_sun_9"
      ],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "mirror_shades",
          text: "Chasser les ombres du miroir (sentier d'argent)"
        }
      ],
      offer: [
        "Il y a deux ombres qui me suivent, sur le sentier, avec mon visage. Elles sont drôles, mais elles me font peur. Chassez-les, archer."
      ],
      hint: [
        "Les deux ombres rôdent sur le sentier d'argent, entre les cairns de givre."
      ],
      complete: [
        "Mes ombres sont reparties dans le miroir. Je n'ai plus peur. Tenez, un éclat de miroir lunaire."
      ],
      reward: {
        gold: 200,
        fragment: "Éclat de miroir",
        xp: 400
      }
    },
    {
      id: "sq_journal_10",
      title: "La dernière page",
      chapter: "✦ Quête secondaire — Pic de la Lune",
      giver: "moon_rabbit_yutu",
      turnIn: "moon_rabbit_yutu",
      requires: [
        "sq_journal_9"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_lune",
          text: "Retrouver la dernière page du carnet (sentier d'argent)"
        }
      ],
      offer: [
        "Un papier est tombé de la manche d'un jeune archer, il y a peu. Il le cherche partout. Allez le chercher avant lui, sur le sentier."
      ],
      hint: [
        "La page est sur le sentier d'argent, à demi cachée dans le givre."
      ],
      complete: [
        "« Je ne veux pas lui faire de mal. Je veux juste qu'il me regarde. Je n'ai que mes flèches. » Yutu se tait. Il pile doucement, à contretemps."
      ],
      reward: {
        gold: 200,
        fragment: "Carnet complet",
        xp: 400
      }
    }
  ]
};

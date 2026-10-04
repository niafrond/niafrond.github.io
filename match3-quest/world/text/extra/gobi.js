// Textes additionnels — Désert de Gobi (hameau, PNJ, coffres et quêtes supplémentaires).
export default {
  screens: {
    gobi_hamlet: {
      name: "Oasis de Yuquan",
      arrival: [
        "Yuquan, la « Source de Jade », est la seule tache verte à l'horizon. Une dizaine de familles s'y partagent un puits, des dattes et une quantité raisonnable de rancunes.",
        "Un sentier de sable ferme la rattache aux dunes."
      ]
    },
    gobi_h2_puits: {
      name: "Maison du puisatier Omar",
      arrival: [
        "La fraîcheur est immédiate. L'eau profonde murmure au fond du puits comme un secret bien gardé."
      ]
    },
    gobi_h2_tapis: {
      name: "Boutique de tapis de Zeynep",
      arrival: [
        "Des tapis rouges, bleus, ocre. L'un d'eux, dit-on, vole. Zeynep ne confirme ni ne dément."
      ]
    }
  },
  npcs: {
    well_digger_omar: {
      name: "Omar",
      title: "Puisatier",
      idle: [
        "Je creuse depuis quarante ans. L'eau est un trésor qu'on trouve à reculons.",
        "Mon puits a une voix. Quand il chante, c'est qu'il a soif."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Le puits chante plus fort ce soir. Il dit merci, je crois."
          ]
        }
      ]
    },
    rug_seller_zeynep: {
      name: "Zeynep",
      title: "Marchande de tapis",
      idle: [
        "Ce tapis a traversé trois déserts et deux divorces. Il vaut le prix.",
        "Un tapis, c'est un poème qu'on marche dessus. Marchez doucement."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Les affaires reprennent. Les caravanes passent plus nombreuses et marchandent moins."
          ]
        }
      ]
    },
    date_farmer_ismail: {
      name: "Ismail",
      title: "Cultivateur de dattes",
      idle: [
        "Mes palmiers pleurent de la datte. Je ne suis pas pressé de leur dire de s'arrêter.",
        "Une datte vaut un baiser, dans ce désert. Moi, je les distribue avec parcimonie."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Mes palmiers ont donné double cette année. Le désert devient généreux."
          ]
        }
      ]
    },
    girl_noor: {
      name: "Noor",
      title: "Fillette aux yeux de sable",
      idle: [
        "Le sable chante quand on le caresse. Écoute… il dit « bonsoir ».",
        "Un jour, je serai chamelière. J'ai déjà un nom pour mon chameau : Monsieur Bosse."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Le sable chante plus fort aujourd'hui. Il chante ton nom, archer."
          ]
        }
      ]
    },
    caravan_cook_lu: {
      name: "Lu",
      title: "Cuisinier de caravane",
      idle: [
        "Ma soupe est épicée. Si vous pleurez, ce n'est pas de joie, c'est de piment.",
        "Un bon cuisinier ne se plaint jamais. Il met du sel, il remue, il prie."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Le désert est plus doux depuis le soleil. Mes piments sont plus rouges. Ils chantent."
          ]
        }
      ]
    },
    falconer_arslan: {
      name: "Arslan",
      title: "Fauconnier",
      idle: [
        "Mon faucon voit tout. Même les mirages qui n'existent pas.",
        "Un faucon ne s'excuse jamais. Moi, si, en son nom."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Mon faucon a survolé le sanctuaire. Il dit qu'il n'y avait qu'un seul soleil. Le vrai. Le sage."
          ]
        }
      ]
    },
    oracle_ahmad: {
      name: "Ahmad",
      title: "Devin de la source",
      idle: [
        "Je lis dans le sable. Aujourd'hui, il dit : « Du vent. »",
        "Ce disciple qui vous suit… Le sable ne l'aime pas. Il glisse sous ses pas."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Le sable dit : « Six soleils restent. Un seul est sage. » Je ne sais pas ce que cela veut dire."
          ]
        }
      ]
    },
    lost_pilgrim_ren: {
      name: "Ren",
      title: "Pèlerin égaré",
      idle: [
        "Je cherchais le Kunlun, la montagne de la Reine Mère. Je me suis trompé de direction. Il est plus loin qu'on ne croit.",
        "Ma femme est malade depuis l'hiver. Je veux demander une gorgée d'élixir à la Reine Mère."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Un archer m'a montré le chemin. Le Kunlun, c'est vers l'ouest. Je m'en doutais."
          ]
        }
      ]
    },
    fennec_lili: {
      name: "Lili",
      title: "Fennec bavard",
      idle: [
        "Mes oreilles sont grandes parce que j'entends tout. Surtout ce qu'il vaudrait mieux ignorer.",
        "Les fennecs ne boivent pas. Ils rêvent d'eau, ce qui est moins pratique."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Les dunes bavardent plus ce soir. Je n'ai pas tout compris, mais j'ai tout retenu."
          ]
        }
      ]
    },
    camel_foreman_tang: {
      name: "Tang",
      title: "Chef d'étape de la caravane",
      idle: [
        "Je tiens les comptes de la caravane. Chameaux, outres, rancunes.",
        "Une étape bien faite, c'est un voyage sans histoire. Je préfère ça à la légende."
      ],
      talk: [
        {
          whenDone: "sun_4",
          lines: [
            "Les comptes sont bons ce mois-ci. J'ai presque envie de sourire."
          ]
        }
      ]
    }
  },
  chests: {
    well_coin_box: {
      label: "Boîte aux vœux du puits",
      openText: "Des pièces jetées par des voyageurs, repêchées avec respect.",
    },
    rug_chest: {
      label: "Coffre sous les tapis",
      openText: "Sous le dernier tapis, un coffre rempli d'or de caravane.",
    },
    date_basket: {
      label: "Panier de dattes",
      openText: "Un panier de dattes dorées, avec des pièces glissées entre les fruits.",
    },
    sand_obelisk: {
      label: "Obélisque enfoui",
      openText: "Un obélisque de grès à moitié enterré, qui cache une petite chambre et du métal fin.",
    },
    bandit_stash: {
      label: "Cache des brigands",
      openText: "La cache d'une bande de pillards : ballots de soie, thé et monnaie.",
    },
    journal_page_gob: {
      label: "Page prise dans le sable",
      openText: "Une page à demi ensablée : « J'ai acheté une carte de la route jusqu'au Kunlun. Je saurai m'en servir. »",
    }
  },
  quests: [
    {
      id: "sq_gob_chameau_1",
      title: "Le chameau de Ma",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "merchant_ma",
      turnIn: "merchant_ma",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "camel_baba",
          text: "Interroger Baba (écurie des chameaux)",
          lines: [
            "Pfff. Quelqu'un l'a emmené dans la nuit. Un homme à l'odeur de ténèbres. Cherchez du côté des dunes."
          ]
        }
      ],
      offer: [
        "Mon meilleur chameau s'est envolé ! Je m'en doute : un voleur. Mais qui ? Interrogez Baba, il voit tout."
      ],
      hint: [
        "Baba est à l'écurie, au caravansérail. Il aime qu'on l'écoute."
      ],
      complete: [
        "Un voleur… Quel monde ! Il faut le retrouver, archer. Il y va de ma réputation."
      ],
      reward: {
        gold: 70,
        fragment: "Cordon de chameau",
        xp: 120
      }
    },
    {
      id: "sq_gob_chameau_2",
      title: "Le voleur de chameaux",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "merchant_ma",
      turnIn: "merchant_ma",
      requires: [
        "sq_gob_chameau_1"
      ],
      side: true,
      objectives: [
        {
          type: "kill",
          target: "gobi_camel_thief",
          text: "Retrouver le voleur de chameaux (dunes des Voix Sablées)"
        }
      ],
      offer: [
        "Le voleur est dans les dunes, d'après Baba. Rapportez-moi mon chameau, et mettez-lui un coup de pied si vous voulez."
      ],
      hint: [
        "Le voleur rôde dans les dunes, loin du caravansérail. Il laisse des traces en tête d'épingle."
      ],
      complete: [
        "Mon chameau ! Il est revenu avec une moue offensée. Je lui ferai un thé. Quant au voleur, plus de souci."
      ],
      reward: {
        gold: 100,
        fragment: "Selle usée",
        xp: 170
      }
    },
    {
      id: "sq_gob_chameau_3",
      title: "Le butin des brigands",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "merchant_ma",
      turnIn: "merchant_ma",
      requires: [
        "sq_gob_chameau_2"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "bandit_stash",
          text: "Fouiller la cache des brigands (dunes des Voix Sablées)"
        }
      ],
      offer: [
        "Le voleur n'agissait pas seul. Sa bande a une cache quelque part dans les dunes. Rendons à chacun ce qui lui revient."
      ],
      hint: [
        "La cache est dans les dunes, bien cachée par des pierres plates."
      ],
      complete: [
        "Les ballots de soie, le thé, les épices : tout est là. Ma réputation est sauve. Prenez ce fragment de soie noire."
      ],
      reward: {
        gold: 130,
        fragment: "Soie noire",
        xp: 220
      }
    },
    {
      id: "sq_gob_puits",
      title: "Qui boit l'eau du puits ?",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "well_digger_omar",
      turnIn: "well_digger_omar",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "keeper_nur",
          text: "Interroger Nur la gardienne (Maison des eaux)",
          lines: [
            "Moi, boire l'eau du puits ? Jamais ! Je la bénis. Interrogez plutôt Tarik, il en puise."
          ]
        },
        {
          type: "talk",
          target: "boy_tarik",
          text: "Interroger Tarik (place du caravansérail)",
          lines: [
            "Moi ? Je ne prends que deux gorgées ! Mais Baba, lui… il boit beaucoup."
          ]
        },
        {
          type: "talk",
          target: "camel_baba",
          text: "Interroger Baba (écurie des chameaux)",
          lines: [
            "Pfff. Un chameau boit quand il a soif. C'est la loi du désert. Qu'on me laisse tranquille."
          ]
        }
      ],
      offer: [
        "Mon puits baisse depuis dix jours. Quelqu'un en boit trop, et pas qu'un peu. Interrogez la gardienne, le petit puiseur et l'écurie, voulez-vous ?"
      ],
      hint: [
        "Nur est à la citerne, Tarik sur la place, Baba à l'écurie."
      ],
      complete: [
        "Le coupable est Baba ! Un chameau boit pour une semaine. Je le pardonne. Voilà pour vous : un maillon d'eau, ma plus belle poulie."
      ],
      reward: {
        gold: 100,
        fragment: "Poulie de puits",
        xp: 170
      }
    },
    {
      id: "sq_gob_tapis",
      title: "Le tapis volant de Zeynep",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "rug_seller_zeynep",
      turnIn: "rug_seller_zeynep",
      requires: [],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "rug_chest",
          text: "Ouvrir le coffre sous les tapis (boutique de Zeynep)"
        },
        {
          type: "talk",
          target: "merchant_ma",
          text: "Proposer le tapis à Ma (entrepôt de Ma)",
          lines: [
            "Un tapis volant ? Elle exagère toujours. Mais je le prends à l'essai : je ne résiste jamais à une légende."
          ]
        }
      ],
      offer: [
        "Mon tapis volant dort dans le coffre. Je voudrais le vendre à Ma, mais il ne me croit pas. Prenez le tapis, présentez-le-lui."
      ],
      hint: [
        "Le coffre est dans la boutique, à l'oasis de Yuquan. Ma est au caravansérail."
      ],
      complete: [
        "Ma l'a essayé, a volé trois mètres, puis s'est écrasé dans les dattes. Il l'a acheté quand même. Voici un fil du tapis volant."
      ],
      reward: {
        gold: 100,
        fragment: "Fil de tapis volant",
        xp: 170
      }
    },
    {
      id: "sq_gob_caravane",
      title: "La caravane fantôme",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "guide_dawa",
      turnIn: "guide_dawa",
      requires: [
        "q_sun_4"
      ],
      side: true,
      objectives: [
        {
          type: "killGroup",
          target: "lost_caravan",
          text: "Libérer les caravaniers squelettes (dunes des Voix Sablées)"
        }
      ],
      offer: [
        "Une caravane s'est perdue il y a vingt ans, dans une tempête. Deux de ses hommes marchent encore, droit devant eux. Libérez-les."
      ],
      hint: [
        "Les deux caravaniers errent dans les dunes. Ils portent des outres sèches."
      ],
      complete: [
        "Ils se sont couchés dans le sable, enfin. La nuit est plus calme. Voici un morceau de leur drapeau : il garde la direction du retour."
      ],
      reward: {
        gold: 120,
        fragment: "Drapeau de caravane",
        xp: 205
      }
    },
    {
      id: "sq_gob_pelerin",
      title: "La femme du pèlerin",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "guide_dawa",
      turnIn: "lost_pilgrim_ren",
      requires: [],
      side: true,
      objectives: [
        {
          type: "talk",
          target: "fennec_lili",
          text: "Parler au fennec Lili (dunes des Voix Sablées)",
          lines: [
            "Un pèlerin ? Il est là-bas, près de la dune qui ressemble à une oreille. Il parle tout seul, il a l'air triste."
          ]
        },
        {
          type: "talk",
          target: "lost_pilgrim_ren",
          text: "Rejoindre le pèlerin Ren (dunes des Voix Sablées)",
          lines: [
            "Ma femme est malade depuis l'hiver. On dit que la Reine Mère de l'Occident garde un élixir de longue vie. Je voulais lui en demander une gorgée, une seule."
          ]
        }
      ],
      offer: [
        "Un homme errant demande la route du Kunlun, chez la Reine Mère. Il est seul et perdu. Allez le voir, archer. Lili le fennec vous guidera."
      ],
      hint: [
        "Lili est dans les dunes. Le pèlerin n'est pas loin, près d'une dune en forme d'oreille."
      ],
      complete: [
        "Ren pleure en silence. « Si vous croisez la Reine Mère, dites-lui qu'un homme a marché jusqu'ici pour une gorgée. » Je lui promets, archer. Mais c'est sans doute à vous de le faire."
      ],
      reward: {
        gold: 110,
        fragment: "Larme du désert",
        xp: 185
      }
    },
    {
      id: "sq_gob_cuisine",
      title: "La soupe à l'oasis",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "caravan_cook_lu",
      turnIn: "caravan_cook_lu",
      requires: [],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "date_basket",
          text: "Chercher des dattes à l'oasis (Oasis de Yuquan)"
        },
        {
          type: "talk",
          target: "boy_tarik",
          text: "Demander de l'eau fraîche à Tarik (place du caravansérail)",
          lines: [
            "De l'eau pour la soupe de Lu ? Évidemment ! Mais seulement si j'ai une cuillère."
          ]
        }
      ],
      offer: [
        "Pour la soupe de fête, il me faut des dattes de l'oasis et de l'eau fraîche. Mes jambes ne me portent plus assez loin, archer."
      ],
      hint: [
        "Les dattes sont à l'oasis de Yuquan. Tarik porte l'eau à la citerne."
      ],
      complete: [
        "La soupe est un triomphe ! Les convives en redemandent. Voici une gousse de piment sacré, la meilleure du Gobi."
      ],
      reward: {
        gold: 90,
        fragment: "Piment sacré",
        xp: 155
      }
    },
    {
      id: "sq_journal_4",
      title: "La carte vendue",
      chapter: "✦ Quête secondaire — Désert de Gobi",
      giver: "mapmaker_ali",
      turnIn: "mapmaker_ali",
      requires: [
        "sq_journal_3"
      ],
      side: true,
      objectives: [
        {
          type: "chest",
          target: "journal_page_gob",
          text: "Retrouver la page ensablée (dunes des Voix Sablées)"
        }
      ],
      offer: [
        "J'ai vendu à un jeune archer une carte de la route du Kunlun. Je ne savais pas qu'il en ferait… ce qu'il en fera. Une page s'est envolée dans le sable."
      ],
      hint: [
        "La page est ensablée à moitié dans les dunes. Cherchez un coin de papier qui dépasse."
      ],
      complete: [
        "« J'ai acheté une carte de la route jusqu'au Kunlun. Je saurai m'en servir. » Ali blêmit. Il griffonne : « Retiens-le, archer. »"
      ],
      reward: {
        gold: 90,
        fragment: "Page du carnet (IV)",
        xp: 155
      }
    }
  ]
};

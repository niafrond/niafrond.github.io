// Catalogue des plantes herbacées (vivaces, couvre-sols, graminées, bulbes, aquatiques, potager, pelouse).
// Schéma : voir jardin/SPECS.md §16.
export default [
  {
    "id": "h-lavande",
    "commonName": "Lavande vraie",
    "latinName": "Lavandula angustifolia",
    "category": "perennial",
    "heightAdult": 0.6,
    "widthAdult": 0.7,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -20,
    "water": "low",
    "soil": [
      "limestone",
      "sandy",
      "loam"
    ],
    "foliage": "evergreen",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "violet",
    "zones": [
      "lowplants",
      "path",
      "terrace"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        8,
        9
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter en plein soleil, sol drainant, au printemps ou à l'automne.",
      "pruning": "Tailler après floraison en arrondissant, sans recéper dans le vieux bois.",
      "fertilizer": "Aucun engrais ; un peu de compost au printemps suffit.",
      "watering": "Arroser à la plantation puis très peu une fois installée.",
      "notes": "Craint l'humidité hivernale et les sols lourds."
    }
  },
  {
    "id": "h-sauge-nemorosa",
    "commonName": "Sauge des bois",
    "latinName": "Salvia nemorosa",
    "category": "perennial",
    "heightAdult": 0.6,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8,
      9
    ],
    "bloomColor": "violet-bleu",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        9,
        10
      ],
      "pruneMonths": [
        3,
        8
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol bien drainé.",
      "pruning": "Couper les hampes fanées pour relancer la floraison ; rabattre en fin d'hiver.",
      "fertilizer": "Compost léger au printemps.",
      "watering": "Peu d'arrosage une fois établie.",
      "notes": "Peu sensible aux maladies ; l'excès d'eau fait pourrir le pied."
    }
  },
  {
    "id": "h-echinacee",
    "commonName": "Échinacée pourpre",
    "latinName": "Echinacea purpurea",
    "category": "perennial",
    "heightAdult": 1,
    "widthAdult": 0.5,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [
      "loam",
      "clay",
      "sandy"
    ],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9
    ],
    "bloomColor": "rose pourpre",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        9,
        10
      ],
      "pruneMonths": [
        2,
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol frais mais drainé.",
      "pruning": "Laisser les capitules en hiver pour les oiseaux, rabattre en fin d'hiver.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en cas de sécheresse prolongée.",
      "notes": "Limaces sur jeunes pousses ; oïdium possible."
    }
  },
  {
    "id": "h-rudbeckia",
    "commonName": "Rudbeckia",
    "latinName": "Rudbeckia fulgida",
    "category": "perennial",
    "heightAdult": 0.8,
    "widthAdult": 0.5,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9,
      10
    ],
    "bloomColor": "jaune",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        9,
        10
      ],
      "pruneMonths": [
        2,
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol ordinaire, frais.",
      "pruning": "Rabattre en fin d'hiver ; diviser tous les 3-4 ans.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Oïdium en fin d'été ; limaces au printemps."
    }
  },
  {
    "id": "h-geranium-rozanne",
    "commonName": "Géranium vivace Rozanne",
    "latinName": "Geranium 'Rozanne'",
    "category": "perennial",
    "heightAdult": 0.5,
    "widthAdult": 0.8,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -20,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8,
      9,
      10
    ],
    "bloomColor": "bleu violet",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        11,
        12
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil ou mi-ombre en sol frais.",
      "pruning": "Rabattre à 10 cm après la première floraison ou en hiver.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Très peu de maladies."
    }
  },
  {
    "id": "h-hemerocalle",
    "commonName": "Hémérocalle",
    "latinName": "Hemerocallis hybrida",
    "category": "perennial",
    "heightAdult": 0.8,
    "widthAdult": 0.7,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "orange jaune",
    "zones": [
      "midplants",
      "lowplants"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        11,
        12
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter collet à 2 cm sous la surface, au soleil ou mi-ombre.",
      "pruning": "Couper les hampes fanées, nettoyer le feuillage en hiver.",
      "fertilizer": "Compost ou engrais organique au printemps.",
      "watering": "Arroser en cas de sécheresse.",
      "notes": "Rustique et robuste ; division tous les 5 ans."
    }
  },
  {
    "id": "h-pivoine",
    "commonName": "Pivoine herbacée",
    "latinName": "Paeonia lactiflora",
    "category": "perennial",
    "heightAdult": 0.8,
    "widthAdult": 0.8,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [
      "clay",
      "loam",
      "limestone"
    ],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "rose blanc",
    "zones": [
      "midplants"
    ],
    "toxic": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.9,
    "care": {
      "plantMonths": [
        10,
        11
      ],
      "pruneMonths": [
        10,
        11
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à l'automne, yeux à 3-4 cm sous la surface.",
      "pruning": "Couper les tiges au ras du sol en automne.",
      "fertilizer": "Compost bien mûr au printemps.",
      "watering": "Arroser en cas de sécheresse, surtout avant floraison.",
      "notes": "Ne fleurit pas si planté trop profond ; botrytis par temps humide."
    }
  },
  {
    "id": "h-achillee",
    "commonName": "Achillée millefeuille",
    "latinName": "Achillea millefolium",
    "category": "perennial",
    "heightAdult": 0.7,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -30,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8,
      9
    ],
    "bloomColor": "blanc rose jaune",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        10,
        11
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter en plein soleil, sol pauvre bien drainé.",
      "pruning": "Couper les fleurs fanées, rabattre en automne.",
      "fertilizer": "Pas d'engrais ; trop riche, elle verse.",
      "watering": "Très peu d'arrosage.",
      "notes": "Peut s'étendre ; oïdium en été humide."
    }
  },
  {
    "id": "h-nepeta",
    "commonName": "Népéta",
    "latinName": "Nepeta x faassenii",
    "category": "perennial",
    "heightAdult": 0.5,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      5,
      6,
      7,
      8,
      9
    ],
    "bloomColor": "bleu lavande",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        6,
        11
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol drainé.",
      "pruning": "Rabattre de moitié après la première floraison pour relancer.",
      "fertilizer": "Aucun engrais nécessaire.",
      "watering": "Peu d'arrosage.",
      "notes": "Attire les chats ; très résistant."
    }
  },
  {
    "id": "h-sedum-spectabile",
    "commonName": "Orpin d'automne",
    "latinName": "Hylotelephium spectabile",
    "category": "perennial",
    "heightAdult": 0.5,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -30,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      8,
      9,
      10
    ],
    "bloomColor": "rose",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        9,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol drainé.",
      "pruning": "Laisser sécher les inflorescences l'hiver, couper en mars.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arrosage minimal.",
      "notes": "Pourriture en sol détrempé."
    }
  },
  {
    "id": "h-hellebore",
    "commonName": "Hellébore d'Orient",
    "latinName": "Helleborus orientalis",
    "category": "perennial",
    "heightAdult": 0.4,
    "widthAdult": 0.5,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [
      "limestone",
      "loam",
      "clay"
    ],
    "foliage": "evergreen",
    "bloom": [
      1,
      2,
      3,
      4
    ],
    "bloomColor": "rose blanc pourpre",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        9,
        10,
        11
      ],
      "pruneMonths": [
        11,
        12
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre en sol frais, riche en humus.",
      "pruning": "Supprimer les vieilles feuilles abîmées en fin d'automne.",
      "fertilizer": "Compost ou fumier décomposé à l'automne.",
      "watering": "Arroser en été sec.",
      "notes": "Toutes les parties sont toxiques ; taches noires sur feuilles."
    }
  },
  {
    "id": "h-hosta",
    "commonName": "Hosta",
    "latinName": "Hosta spp.",
    "category": "perennial",
    "heightAdult": 0.5,
    "widthAdult": 0.8,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "high",
    "soil": [
      "humus",
      "loam",
      "clay"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "blanc lavande",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "toxic": true,
    "maintenance": "medium",
    "kc": 0.8,
    "spacing": 0.7,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        11
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à l'ombre ou mi-ombre en sol frais et riche.",
      "pruning": "Couper le feuillage jauni en automne.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser régulièrement, surtout en été.",
      "notes": "Limaces et escargots : principal ennemi."
    }
  },
  {
    "id": "h-fougere-male",
    "commonName": "Fougère mâle",
    "latinName": "Dryopteris filix-mas",
    "category": "perennial",
    "heightAdult": 0.9,
    "widthAdult": 0.8,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [
      "humus",
      "loam",
      "clay"
    ],
    "foliage": "semi",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.8,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10,
        11
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à l'ombre en sol frais et humifère.",
      "pruning": "Couper les frondes abîmées en fin d'hiver.",
      "fertilizer": "Compost de feuilles en automne.",
      "watering": "Garder le sol frais, arroser en été sec.",
      "notes": "Très rustique et peu sensible aux maladies."
    }
  },
  {
    "id": "h-alchemille",
    "commonName": "Alchémille molle",
    "latinName": "Alchemilla mollis",
    "category": "perennial",
    "heightAdult": 0.5,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "jaune-vert",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        7,
        11
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil ou à mi-ombre en sol frais.",
      "pruning": "Rabattre après floraison pour éviter l'envahissement par les graines.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Se resème abondamment."
    }
  },
  {
    "id": "h-astilbe",
    "commonName": "Astilbe",
    "latinName": "Astilbe x arendsii",
    "category": "perennial",
    "heightAdult": 0.8,
    "widthAdult": 0.6,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "high",
    "soil": [
      "humus",
      "loam",
      "clay"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "rose rouge blanc",
    "zones": [
      "lowplants",
      "midplants",
      "pond"
    ],
    "maintenance": "medium",
    "kc": 0.9,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        10,
        11
      ],
      "pruneMonths": [
        11
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre en sol frais à humide, humifère.",
      "pruning": "Couper les hampes sèches en fin d'automne.",
      "fertilizer": "Compost ou terreau de feuilles au printemps.",
      "watering": "Garder le sol constamment frais.",
      "notes": "Dessèche vite au soleil ou en sol sec."
    }
  },
  {
    "id": "h-agapanthe",
    "commonName": "Agapanthe",
    "latinName": "Agapanthus praecox",
    "category": "perennial",
    "heightAdult": 0.9,
    "widthAdult": 0.6,
    "sun": [
      "full"
    ],
    "hardiness": -10,
    "water": "medium",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      7,
      8,
      9
    ],
    "bloomColor": "bleu",
    "zones": [
      "terrace",
      "lowplants",
      "midplants"
    ],
    "toxic": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        4,
        5,
        9
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [
        4,
        5,
        6
      ],
      "planting": "Planter au soleil, abrité du gel ; idéal en pot.",
      "pruning": "Couper les hampes fanées en automne.",
      "fertilizer": "Engrais fleurs en été.",
      "watering": "Arroser régulièrement en été, peu en hiver.",
      "notes": "Protéger du gel sous 10 °C, pailler ou rentrer les pots."
    }
  },
  {
    "id": "h-gaura",
    "commonName": "Gaura",
    "latinName": "Gaura lindheimeri",
    "category": "perennial",
    "heightAdult": 0.9,
    "widthAdult": 0.7,
    "sun": [
      "full"
    ],
    "hardiness": -15,
    "water": "low",
    "soil": [
      "sandy",
      "loam",
      "limestone"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8,
      9,
      10
    ],
    "bloomColor": "blanc rose",
    "zones": [
      "midplants",
      "lowplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        5
      ],
      "pruneMonths": [
        3,
        4
      ],
      "fertMonths": [
        4
      ],
      "planting": "Planter au soleil en sol drainé.",
      "pruning": "Rabattre à 15 cm en mars.",
      "fertilizer": "Compost léger.",
      "watering": "Très peu d'arrosage.",
      "notes": "Craint l'excès d'humidité hivernale."
    }
  },
  {
    "id": "h-verveine-bonariensis",
    "commonName": "Verveine de Buenos Aires",
    "latinName": "Verbena bonariensis",
    "category": "perennial",
    "heightAdult": 1.5,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -12,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9,
      10
    ],
    "bloomColor": "violet",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        4,
        5
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        4
      ],
      "planting": "Planter au soleil en sol drainé.",
      "pruning": "Couper au ras en mars.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser peu.",
      "notes": "Se ressème facilement."
    }
  },
  {
    "id": "h-phlox-paniculata",
    "commonName": "Phlox paniculé",
    "latinName": "Phlox paniculata",
    "category": "perennial",
    "heightAdult": 1,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [
      "loam",
      "clay",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9
    ],
    "bloomColor": "rose blanc",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "medium",
    "kc": 0.8,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        10,
        11
      ],
      "pruneMonths": [
        11
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil ou mi-ombre en sol frais et riche.",
      "pruning": "Supprimer les fleurs fanées, rabattre en automne.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été, éviter de mouiller le feuillage.",
      "notes": "Oïdium fréquent ; choisir des variétés résistantes."
    }
  },
  {
    "id": "h-anemone-japon",
    "commonName": "Anémone du Japon",
    "latinName": "Anemone x hybrida",
    "category": "perennial",
    "heightAdult": 1,
    "widthAdult": 0.6,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [
      "loam",
      "clay",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [
      8,
      9,
      10
    ],
    "bloomColor": "rose blanc",
    "zones": [
      "midplants"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        10
      ],
      "pruneMonths": [
        11
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre en sol frais et profond.",
      "pruning": "Couper les tiges fanées en novembre.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Peut s'étendre par drageons."
    }
  },
  {
    "id": "h-heuchere",
    "commonName": "Heuchère",
    "latinName": "Heuchera spp.",
    "category": "perennial",
    "heightAdult": 0.4,
    "widthAdult": 0.4,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      5,
      6,
      7
    ],
    "bloomColor": "rose crème",
    "zones": [
      "lowplants",
      "terrace",
      "path"
    ],
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre en sol drainé et frais.",
      "pruning": "Retirer les feuilles abîmées au printemps.",
      "fertilizer": "Compost léger.",
      "watering": "Arroser en été sec.",
      "notes": "Charançon : surveiller les racines."
    }
  },
  {
    "id": "h-coreopsis",
    "commonName": "Coréopsis",
    "latinName": "Coreopsis verticillata",
    "category": "perennial",
    "heightAdult": 0.5,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8,
      9
    ],
    "bloomColor": "jaune",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        11,
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol drainé.",
      "pruning": "Couper les fleurs fanées, rabattre en fin d'hiver.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser peu.",
      "notes": "Très rustique."
    }
  },
  {
    "id": "h-delphinium",
    "commonName": "Pied d'alouette",
    "latinName": "Delphinium elatum",
    "category": "perennial",
    "heightAdult": 1.5,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [
      "loam",
      "clay",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7
    ],
    "bloomColor": "bleu",
    "zones": [
      "tallplants"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "high",
    "kc": 0.8,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        7,
        11
      ],
      "fertMonths": [
        3,
        4
      ],
      "planting": "Planter au soleil, abrité du vent, en sol riche.",
      "pruning": "Rabattre après floraison pour une seconde floraison ; tuteurer.",
      "fertilizer": "Compost et engrais organique au printemps.",
      "watering": "Arroser régulièrement.",
      "notes": "Limaces, oïdium ; toutes les parties sont toxiques."
    }
  },
  {
    "id": "h-ancolie",
    "commonName": "Ancolie",
    "latinName": "Aquilegia vulgaris",
    "category": "perennial",
    "heightAdult": 0.7,
    "widthAdult": 0.4,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "bleu violet rose",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        7
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre en sol frais.",
      "pruning": "Couper les hampes fanées pour limiter les semis.",
      "fertilizer": "Compost léger.",
      "watering": "Arroser en sécheresse.",
      "notes": "Mineuse des feuilles ; se ressème facilement."
    }
  },
  {
    "id": "h-digitale",
    "commonName": "Digitale pourpre",
    "latinName": "Digitalis purpurea",
    "category": "perennial",
    "heightAdult": 1.5,
    "widthAdult": 0.5,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [
      "loam",
      "humus",
      "sandy"
    ],
    "foliage": "deciduous",
    "bloom": [
      5,
      6,
      7
    ],
    "bloomColor": "rose pourpre",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        7
      ],
      "fertMonths": [
        3
      ],
      "planting": "Semer ou planter à mi-ombre en sol frais.",
      "pruning": "Couper après floraison ; plante bisannuelle qui se ressème.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Très toxique, à éloigner des enfants et animaux."
    }
  },
  {
    "id": "h-aster-novi-belgii",
    "commonName": "Aster d'automne",
    "latinName": "Symphyotrichum novi-belgii",
    "category": "perennial",
    "heightAdult": 1,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      9,
      10,
      11
    ],
    "bloomColor": "violet bleu",
    "zones": [
      "midplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil ou mi-ombre en sol frais.",
      "pruning": "Rabattre en fin d'hiver ; diviser tous les 3 ans.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Oïdium fréquent."
    }
  },
  {
    "id": "h-bergenia",
    "commonName": "Bergénia",
    "latinName": "Bergenia cordifolia",
    "category": "perennial",
    "heightAdult": 0.4,
    "widthAdult": 0.5,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "low",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      3,
      4,
      5
    ],
    "bloomColor": "rose",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        5
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre ou soleil en sol quelconque.",
      "pruning": "Retirer les feuilles abîmées après l'hiver.",
      "fertilizer": "Compost léger.",
      "watering": "Peu d'arrosage.",
      "notes": "Limaces occasionnelles."
    }
  },
  {
    "id": "h-euphorbe-characias",
    "commonName": "Euphorbe characias",
    "latinName": "Euphorbia characias",
    "category": "perennial",
    "heightAdult": 1,
    "widthAdult": 1,
    "sun": [
      "full"
    ],
    "hardiness": -12,
    "water": "low",
    "soil": [
      "limestone",
      "sandy",
      "loam"
    ],
    "foliage": "evergreen",
    "bloom": [
      3,
      4,
      5
    ],
    "bloomColor": "jaune-vert",
    "zones": [
      "midplants",
      "lowplants"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.8,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        6,
        7
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol très drainé.",
      "pruning": "Couper les tiges ayant fleuri à la base en été (gants).",
      "fertilizer": "Aucun engrais.",
      "watering": "Peu d'arrosage.",
      "notes": "Latex irritant et toxique."
    }
  },
  {
    "id": "h-rose-tremiere",
    "commonName": "Rose trémière",
    "latinName": "Alcea rosea",
    "category": "perennial",
    "heightAdult": 2,
    "widthAdult": 0.6,
    "sun": [
      "full"
    ],
    "hardiness": -20,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "rose rouge blanc",
    "zones": [
      "tallplants",
      "path"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [
        3
      ],
      "planting": "Semer ou planter au soleil, à l'abri du vent.",
      "pruning": "Couper les tiges fanées après graines.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser peu.",
      "notes": "Rouille fréquente ; bisannuelle qui se ressème."
    }
  },
  {
    "id": "h-iris-germanica",
    "commonName": "Iris des jardins",
    "latinName": "Iris germanica",
    "category": "perennial",
    "heightAdult": 0.8,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [
      "limestone",
      "loam",
      "sandy"
    ],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "bleu violet jaune",
    "zones": [
      "lowplants",
      "midplants"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        7,
        8,
        9
      ],
      "pruneMonths": [
        6,
        10
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter rhizomes à fleur de terre, au soleil.",
      "pruning": "Couper les hampes fanées, retirer les feuilles abîmées.",
      "fertilizer": "Engrais pauvre en azote.",
      "watering": "Arroser très peu.",
      "notes": "Pourriture du rhizome en sol humide."
    }
  },
  {
    "id": "h-centranthe",
    "commonName": "Valériane des jardins",
    "latinName": "Centranthus ruber",
    "category": "perennial",
    "heightAdult": 0.8,
    "widthAdult": 0.6,
    "sun": [
      "full"
    ],
    "hardiness": -20,
    "water": "low",
    "soil": [
      "limestone",
      "sandy",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      5,
      6,
      7,
      8,
      9
    ],
    "bloomColor": "rose rouge blanc",
    "zones": [
      "lowplants",
      "midplants",
      "path"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        7,
        8
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil, sol pauvre calcaire.",
      "pruning": "Couper après floraison pour limiter les semis.",
      "fertilizer": "Aucun engrais.",
      "watering": "Aucun arrosage une fois établie.",
      "notes": "Se ressème très facilement."
    }
  },
  {
    "id": "h-pervenche",
    "commonName": "Petite pervenche",
    "latinName": "Vinca minor",
    "category": "groundcover",
    "heightAdult": 0.15,
    "widthAdult": 1,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      3,
      4,
      5
    ],
    "bloomColor": "bleu",
    "zones": [
      "lowplants",
      "path"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre ou à l'ombre en sol frais.",
      "pruning": "Tondre ou tailler court en fin d'hiver.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser la première année.",
      "notes": "Peut devenir envahissante ; toxique en grande quantité."
    }
  },
  {
    "id": "h-bugle",
    "commonName": "Bugle rampante",
    "latinName": "Ajuga reptans",
    "category": "groundcover",
    "heightAdult": 0.15,
    "widthAdult": 0.6,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      4,
      5,
      6
    ],
    "bloomColor": "bleu",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        6
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre en sol frais.",
      "pruning": "Couper les hampes fanées.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser en été sec.",
      "notes": "Oïdium en sol sec."
    }
  },
  {
    "id": "h-lierre-terrestre",
    "commonName": "Lierre terrestre",
    "latinName": "Glechoma hederacea",
    "category": "groundcover",
    "heightAdult": 0.1,
    "widthAdult": 0.8,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "semi",
    "bloom": [
      3,
      4,
      5
    ],
    "bloomColor": "bleu-violet",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        6
      ],
      "fertMonths": [],
      "planting": "Planter à l'ombre ou mi-ombre en sol frais.",
      "pruning": "Contenir en arrachant les stolons.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser en été sec.",
      "notes": "Très vigoureux, à surveiller."
    }
  },
  {
    "id": "h-thym-serpolet",
    "commonName": "Thym serpolet",
    "latinName": "Thymus serpyllum",
    "category": "groundcover",
    "heightAdult": 0.1,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [
      "limestone",
      "sandy",
      "loam"
    ],
    "foliage": "evergreen",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "rose violet",
    "zones": [
      "path",
      "lowplants",
      "terrace"
    ],
    "melliferous": true,
    "edible": true,
    "windTolerant": true,
    "harvest": [
      5,
      6,
      7,
      8,
      9
    ],
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        4
      ],
      "fertMonths": [],
      "planting": "Planter au soleil en sol très drainé, entre dalles.",
      "pruning": "Tondre légèrement après floraison.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser très peu.",
      "notes": "Craint l'humidité hivernale."
    }
  },
  {
    "id": "h-geranium-macrorrhizum",
    "commonName": "Géranium à gros rhizomes",
    "latinName": "Geranium macrorrhizum",
    "category": "groundcover",
    "heightAdult": 0.35,
    "widthAdult": 0.6,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "low",
    "soil": [],
    "foliage": "semi",
    "bloom": [
      5,
      6,
      7
    ],
    "bloomColor": "rose",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre, même sol sec.",
      "pruning": "Supprimer les feuilles abîmées au printemps.",
      "fertilizer": "Compost léger.",
      "watering": "Peu d'arrosage.",
      "notes": "Très robuste, à feuillage aromatique."
    }
  },
  {
    "id": "h-cotoneaster-horizontalis",
    "commonName": "Cotonéaster rampant",
    "latinName": "Cotoneaster horizontalis",
    "category": "groundcover",
    "heightAdult": 0.6,
    "widthAdult": 1.5,
    "sun": [
      "full",
      "partial",
      "shade"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "rose blanc",
    "zones": [
      "lowplants",
      "path"
    ],
    "toxic": true,
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 1,
    "care": {
      "plantMonths": [
        10,
        11,
        3
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil ou mi-ombre, tout sol.",
      "pruning": "Éclaircir et raccourcir en fin d'hiver.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser peu.",
      "notes": "Baies toxiques ; feu bactérien possible."
    }
  },
  {
    "id": "h-trefle-nain",
    "commonName": "Trèfle nain",
    "latinName": "Trifolium repens 'Microclover'",
    "category": "groundcover",
    "heightAdult": 0.1,
    "widthAdult": 0.5,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [],
    "foliage": "semi",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "blanc",
    "zones": [
      "lawn",
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.2,
    "care": {
      "plantMonths": [
        4,
        5,
        9
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Semer au printemps ou à l'automne en sol léger.",
      "pruning": "Tondre haut, ou laisser fleurir pour les abeilles.",
      "fertilizer": "Aucun engrais, il fixe l'azote.",
      "watering": "Arroser peu une fois installé.",
      "notes": "Tolère bien le piétinement léger."
    }
  },
  {
    "id": "h-sagine",
    "commonName": "Sagine subulée",
    "latinName": "Sagina subulata",
    "category": "groundcover",
    "heightAdult": 0.05,
    "widthAdult": 0.3,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      5,
      6,
      7
    ],
    "bloomColor": "blanc",
    "zones": [
      "path",
      "lowplants"
    ],
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.15,
    "care": {
      "plantMonths": [
        4,
        5,
        9
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter entre dalles, sol frais, soleil ou mi-ombre.",
      "pruning": "Aucune taille.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser en été sec.",
      "notes": "Brûle en plein soleil sec."
    }
  },
  {
    "id": "h-lamier",
    "commonName": "Lamier maculé",
    "latinName": "Lamium maculatum",
    "category": "groundcover",
    "heightAdult": 0.2,
    "widthAdult": 0.6,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "semi",
    "bloom": [
      4,
      5,
      6
    ],
    "bloomColor": "rose pourpre",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        7
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à l'ombre ou mi-ombre en sol frais.",
      "pruning": "Rabattre après floraison.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser en été sec.",
      "notes": "Peu de maladies ; bon couvre-sol d'ombre."
    }
  },
  {
    "id": "h-millepertuis-couvre-sol",
    "commonName": "Millepertuis à grandes fleurs",
    "latinName": "Hypericum calycinum",
    "category": "groundcover",
    "heightAdult": 0.4,
    "widthAdult": 1,
    "sun": [
      "full",
      "partial",
      "shade"
    ],
    "hardiness": -20,
    "water": "low",
    "soil": [],
    "foliage": "semi",
    "bloom": [
      6,
      7,
      8,
      9
    ],
    "bloomColor": "jaune",
    "zones": [
      "lowplants",
      "path"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        10,
        11,
        3
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre ou soleil, tout sol.",
      "pruning": "Rabattre court en mars.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser peu.",
      "notes": "Rouille possible ; drageonne beaucoup."
    }
  },
  {
    "id": "h-waldsteinia",
    "commonName": "Waldsteinia",
    "latinName": "Waldsteinia ternata",
    "category": "groundcover",
    "heightAdult": 0.15,
    "widthAdult": 0.5,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "evergreen",
    "bloom": [
      4,
      5
    ],
    "bloomColor": "jaune",
    "zones": [
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        6
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à l'ombre en sol frais et humifère.",
      "pruning": "Aucune taille, tondre court si besoin.",
      "fertilizer": "Compost léger.",
      "watering": "Arroser en été sec.",
      "notes": "Très robuste."
    }
  },
  {
    "id": "h-sedum-album",
    "commonName": "Orpin blanc",
    "latinName": "Sedum album",
    "category": "groundcover",
    "heightAdult": 0.1,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -30,
    "water": "low",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      6,
      7
    ],
    "bloomColor": "blanc",
    "zones": [
      "path",
      "lowplants",
      "terrace"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.3,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        9
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter en plein soleil, sol pauvre drainé, toits ou murets.",
      "pruning": "Aucune taille.",
      "fertilizer": "Aucun engrais.",
      "watering": "Aucun arrosage nécessaire.",
      "notes": "Pourrit en sol détrempé."
    }
  },
  {
    "id": "h-miscanthus",
    "commonName": "Miscanthus",
    "latinName": "Miscanthus sinensis",
    "category": "grass",
    "heightAdult": 1.8,
    "widthAdult": 1,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      8,
      9,
      10
    ],
    "bloomColor": "argenté",
    "zones": [
      "tallplants",
      "midplants"
    ],
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.8,
    "spacing": 1,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        9
      ],
      "pruneMonths": [
        2,
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol frais.",
      "pruning": "Couper à 10 cm en fin d'hiver.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser les 2 premières années, puis en cas de sécheresse.",
      "notes": "Rouille possible ; très rustique."
    }
  },
  {
    "id": "h-pennisetum",
    "commonName": "Herbe aux écouvillons",
    "latinName": "Pennisetum alopecuroides",
    "category": "grass",
    "heightAdult": 0.9,
    "widthAdult": 0.8,
    "sun": [
      "full"
    ],
    "hardiness": -20,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9,
      10
    ],
    "bloomColor": "brun rosé",
    "zones": [
      "midplants",
      "lowplants",
      "terrace"
    ],
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.7,
    "care": {
      "plantMonths": [
        4,
        5
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        4
      ],
      "planting": "Planter au soleil en sol drainé.",
      "pruning": "Couper à 10 cm en mars.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser peu.",
      "notes": "Craint l'excès d'eau en hiver."
    }
  },
  {
    "id": "h-stipa-tenuissima",
    "commonName": "Stipe cheveux d'ange",
    "latinName": "Stipa tenuissima",
    "category": "grass",
    "heightAdult": 0.6,
    "widthAdult": 0.4,
    "sun": [
      "full"
    ],
    "hardiness": -15,
    "water": "low",
    "soil": [
      "sandy",
      "limestone",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "beige",
    "zones": [
      "lowplants",
      "midplants",
      "path"
    ],
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [],
      "planting": "Planter au soleil en sol bien drainé.",
      "pruning": "Peigner avec les doigts au printemps.",
      "fertilizer": "Aucun engrais.",
      "watering": "Très peu d'arrosage.",
      "notes": "Se ressème, craint l'humidité hivernale."
    }
  },
  {
    "id": "h-carex-evergold",
    "commonName": "Laîche du Japon",
    "latinName": "Carex oshimensis 'Evergold'",
    "category": "grass",
    "heightAdult": 0.35,
    "widthAdult": 0.4,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -20,
    "water": "medium",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      4,
      5
    ],
    "bloomColor": "discrète",
    "zones": [
      "lowplants",
      "terrace",
      "path"
    ],
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre en sol frais.",
      "pruning": "Peigner et couper les feuilles abîmées au printemps.",
      "fertilizer": "Compost léger.",
      "watering": "Arroser régulièrement en été.",
      "notes": "Très peu de problèmes."
    }
  },
  {
    "id": "h-festuca-glauca",
    "commonName": "Fétuque bleue",
    "latinName": "Festuca glauca",
    "category": "grass",
    "heightAdult": 0.3,
    "widthAdult": 0.3,
    "sun": [
      "full"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [
      "sandy",
      "limestone",
      "loam"
    ],
    "foliage": "evergreen",
    "bloom": [
      5,
      6,
      7
    ],
    "bloomColor": "bleu argenté",
    "zones": [
      "lowplants",
      "terrace",
      "path"
    ],
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [],
      "planting": "Planter au soleil en sol drainé.",
      "pruning": "Peigner les feuilles sèches au printemps ; diviser tous les 3 ans.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser très peu.",
      "notes": "Le centre se dégarnit avec l'âge."
    }
  },
  {
    "id": "h-calamagrostis",
    "commonName": "Calamagrostis 'Karl Foerster'",
    "latinName": "Calamagrostis x acutiflora",
    "category": "grass",
    "heightAdult": 1.5,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "beige doré",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        2,
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter au soleil en sol ordinaire.",
      "pruning": "Couper à 10 cm en fin d'hiver.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Port très dressé, rustique."
    }
  },
  {
    "id": "h-hakonechloa",
    "commonName": "Hakonéchloé",
    "latinName": "Hakonechloa macra",
    "category": "grass",
    "heightAdult": 0.4,
    "widthAdult": 0.6,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -20,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      8,
      9
    ],
    "bloomColor": "discrète",
    "zones": [
      "lowplants",
      "terrace"
    ],
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à mi-ombre en sol frais et humifère.",
      "pruning": "Couper à ras en fin d'hiver.",
      "fertilizer": "Compost léger.",
      "watering": "Garder le sol frais.",
      "notes": "Brûle au soleil direct."
    }
  },
  {
    "id": "h-molinie",
    "commonName": "Molinie bleue",
    "latinName": "Molinia caerulea",
    "category": "grass",
    "heightAdult": 1,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "medium",
    "soil": [
      "humus",
      "sandy",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9
    ],
    "bloomColor": "violet",
    "zones": [
      "midplants",
      "pond"
    ],
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [],
      "planting": "Planter au soleil ou mi-ombre en sol frais, plutôt acide.",
      "pruning": "Couper à ras en fin d'hiver.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser en été sec.",
      "notes": "Prend de belles teintes jaune d'or en automne."
    }
  },
  {
    "id": "h-tulipe",
    "commonName": "Tulipe",
    "latinName": "Tulipa spp.",
    "category": "bulb",
    "heightAdult": 0.4,
    "widthAdult": 0.15,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [
      "sandy",
      "loam",
      "limestone"
    ],
    "foliage": "deciduous",
    "bloom": [
      4,
      5
    ],
    "bloomColor": "multicolore",
    "zones": [
      "lowplants",
      "midplants",
      "terrace"
    ],
    "toxic": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.12,
    "care": {
      "plantMonths": [
        10,
        11
      ],
      "pruneMonths": [],
      "fertMonths": [
        3
      ],
      "planting": "Planter à l'automne, à 10-15 cm de profondeur, en sol drainé.",
      "pruning": "Couper les fleurs fanées, laisser jaunir le feuillage.",
      "fertilizer": "Engrais bulbes à la reprise.",
      "watering": "Arroser peu, surtout en pot.",
      "notes": "Pourrissent en sol détrempé ; campagnols."
    }
  },
  {
    "id": "h-narcisse",
    "commonName": "Narcisse",
    "latinName": "Narcissus pseudonarcissus",
    "category": "bulb",
    "heightAdult": 0.4,
    "widthAdult": 0.15,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      3,
      4
    ],
    "bloomColor": "jaune",
    "zones": [
      "lowplants",
      "midplants",
      "lawn"
    ],
    "toxic": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.12,
    "care": {
      "plantMonths": [
        9,
        10
      ],
      "pruneMonths": [],
      "fertMonths": [
        3
      ],
      "planting": "Planter en automne à 10-15 cm.",
      "pruning": "Ne pas couper le feuillage avant jaunissement complet.",
      "fertilizer": "Engrais bulbes après floraison.",
      "watering": "Arroser peu.",
      "notes": "Toxique ; mouche du narcisse."
    }
  },
  {
    "id": "h-crocus",
    "commonName": "Crocus de printemps",
    "latinName": "Crocus vernus",
    "category": "bulb",
    "heightAdult": 0.1,
    "widthAdult": 0.08,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      2,
      3
    ],
    "bloomColor": "violet blanc",
    "zones": [
      "lawn",
      "lowplants",
      "path"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.08,
    "care": {
      "plantMonths": [
        9,
        10
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter à l'automne à 5-8 cm, en groupes, même en pelouse.",
      "pruning": "Ne pas tondre avant jaunissement du feuillage.",
      "fertilizer": "Aucun engrais.",
      "watering": "Aucun arrosage.",
      "notes": "Les oiseaux et rongeurs peuvent les déterrer."
    }
  },
  {
    "id": "h-allium-giganteum",
    "commonName": "Ail d'ornement",
    "latinName": "Allium giganteum",
    "category": "bulb",
    "heightAdult": 1.3,
    "widthAdult": 0.3,
    "sun": [
      "full"
    ],
    "hardiness": -25,
    "water": "low",
    "soil": [
      "sandy",
      "loam",
      "limestone"
    ],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "violet",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        9,
        10
      ],
      "pruneMonths": [
        7
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à l'automne à 15 cm de profondeur, sol drainé.",
      "pruning": "Couper les hampes fanées ou les laisser sécher décoratives.",
      "fertilizer": "Engrais bulbes au printemps.",
      "watering": "Arroser peu.",
      "notes": "Le feuillage jaunit avant la floraison, masquer avec des vivaces."
    }
  },
  {
    "id": "h-dahlia",
    "commonName": "Dahlia",
    "latinName": "Dahlia x hybrida",
    "category": "bulb",
    "heightAdult": 1.2,
    "widthAdult": 0.6,
    "sun": [
      "full"
    ],
    "hardiness": -5,
    "water": "medium",
    "soil": [
      "loam",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9,
      10
    ],
    "bloomColor": "multicolore",
    "zones": [
      "midplants",
      "tallplants",
      "terrace"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "high",
    "kc": 0.8,
    "spacing": 0.7,
    "care": {
      "plantMonths": [
        4,
        5
      ],
      "pruneMonths": [
        7,
        8
      ],
      "fertMonths": [
        5,
        6,
        7
      ],
      "planting": "Planter les tubercules après les gelées, à 10 cm de profondeur, au soleil.",
      "pruning": "Pincer et supprimer les fleurs fanées ; tuteurer.",
      "fertilizer": "Engrais riche en potasse en été.",
      "watering": "Arroser régulièrement et abondamment en été.",
      "notes": "Arracher et stocker à l'abri du gel après les premières gelées sauf régions douces ; limaces."
    }
  },
  {
    "id": "h-lys",
    "commonName": "Lys",
    "latinName": "Lilium candidum",
    "category": "bulb",
    "heightAdult": 1.2,
    "widthAdult": 0.3,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -20,
    "water": "medium",
    "soil": [
      "humus",
      "loam",
      "sandy"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "blanc rose orange",
    "zones": [
      "midplants",
      "tallplants",
      "terrace"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        9,
        10,
        3
      ],
      "pruneMonths": [
        9
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter à 3 fois la hauteur du bulbe, pieds à l'ombre et tête au soleil.",
      "pruning": "Couper les tiges après jaunissement.",
      "fertilizer": "Engrais bulbes au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Criocère du lys ; toxique pour les chats."
    }
  },
  {
    "id": "h-perce-neige",
    "commonName": "Perce-neige",
    "latinName": "Galanthus nivalis",
    "category": "bulb",
    "heightAdult": 0.12,
    "widthAdult": 0.08,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      1,
      2,
      3
    ],
    "bloomColor": "blanc",
    "zones": [
      "lowplants",
      "lawn"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.08,
    "care": {
      "plantMonths": [
        2,
        3,
        9
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter « en vert » après floraison ou en automne, à 5 cm.",
      "pruning": "Laisser le feuillage jaunir.",
      "fertilizer": "Aucun engrais.",
      "watering": "Sol frais en saison.",
      "notes": "Les bulbes secs s'implantent mal."
    }
  },
  {
    "id": "h-jacinthe",
    "commonName": "Jacinthe",
    "latinName": "Hyacinthus orientalis",
    "category": "bulb",
    "heightAdult": 0.25,
    "widthAdult": 0.1,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -20,
    "water": "low",
    "soil": [
      "sandy",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      3,
      4
    ],
    "bloomColor": "bleu rose",
    "zones": [
      "lowplants",
      "terrace"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.1,
    "care": {
      "plantMonths": [
        10,
        11
      ],
      "pruneMonths": [],
      "fertMonths": [
        3
      ],
      "planting": "Planter à l'automne à 10 cm.",
      "pruning": "Laisser jaunir le feuillage.",
      "fertilizer": "Engrais bulbes.",
      "watering": "Arroser peu.",
      "notes": "Toxique, peut irriter la peau."
    }
  },
  {
    "id": "h-muscari",
    "commonName": "Muscari",
    "latinName": "Muscari armeniacum",
    "category": "bulb",
    "heightAdult": 0.2,
    "widthAdult": 0.08,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      3,
      4
    ],
    "bloomColor": "bleu",
    "zones": [
      "lowplants",
      "lawn",
      "path"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.08,
    "care": {
      "plantMonths": [
        9,
        10
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter à l'automne à 6-8 cm en groupe.",
      "pruning": "Laisser jaunir le feuillage.",
      "fertilizer": "Aucun engrais.",
      "watering": "Aucun arrosage.",
      "notes": "Se naturalise facilement."
    }
  },
  {
    "id": "h-gladiolus",
    "commonName": "Glaïeul",
    "latinName": "Gladiolus x hortulanus",
    "category": "bulb",
    "heightAdult": 1.1,
    "widthAdult": 0.15,
    "sun": [
      "full"
    ],
    "hardiness": -5,
    "water": "medium",
    "soil": [
      "sandy",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9
    ],
    "bloomColor": "multicolore",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "toxic": true,
    "maintenance": "medium",
    "kc": 0.8,
    "spacing": 0.15,
    "care": {
      "plantMonths": [
        4,
        5
      ],
      "pruneMonths": [
        9
      ],
      "fertMonths": [
        6
      ],
      "planting": "Planter de avril à juin à 12 cm, au soleil.",
      "pruning": "Couper les hampes fanées.",
      "fertilizer": "Engrais riche en potasse en juin.",
      "watering": "Arroser régulièrement.",
      "notes": "Arracher les cormes en automne ; thrips."
    }
  },
  {
    "id": "h-crocosmia",
    "commonName": "Montbretia",
    "latinName": "Crocosmia x crocosmiiflora",
    "category": "bulb",
    "heightAdult": 0.8,
    "widthAdult": 0.4,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -15,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9
    ],
    "bloomColor": "orange rouge",
    "zones": [
      "midplants",
      "tallplants"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.2,
    "care": {
      "plantMonths": [
        3,
        4
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter les cormes au printemps à 8 cm.",
      "pruning": "Couper le feuillage sec en hiver.",
      "fertilizer": "Compost au printemps.",
      "watering": "Arroser en été sec.",
      "notes": "Peut devenir envahissant en sol léger."
    }
  },
  {
    "id": "h-nenuphar",
    "commonName": "Nénuphar",
    "latinName": "Nymphaea alba",
    "category": "aquatic",
    "heightAdult": 0.05,
    "widthAdult": 1.5,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -20,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8,
      9
    ],
    "bloomColor": "blanc",
    "zones": [
      "pond"
    ],
    "maintenance": "low",
    "kc": 1,
    "spacing": 1,
    "care": {
      "plantMonths": [
        4,
        5,
        6
      ],
      "pruneMonths": [
        7
      ],
      "fertMonths": [],
      "planting": "Planter en panier dans 40-80 cm d'eau, soleil.",
      "pruning": "Couper les feuilles jaunies.",
      "fertilizer": "Aucun engrais ; granulés spéciaux en panier si besoin.",
      "watering": "Maintenir le niveau d'eau.",
      "notes": "Éviter les eaux agitées ; pucerons du nénuphar."
    }
  },
  {
    "id": "h-iris-marais",
    "commonName": "Iris des marais",
    "latinName": "Iris pseudacorus",
    "category": "aquatic",
    "heightAdult": 1,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "jaune",
    "zones": [
      "pond"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [],
      "planting": "Planter en bordure de mare dans 0-20 cm d'eau.",
      "pruning": "Couper les feuilles sèches en automne.",
      "fertilizer": "Aucun engrais.",
      "watering": "Garder les racines immergées.",
      "notes": "Toxique ; vigoureux, limiter l'extension."
    }
  },
  {
    "id": "h-jonc-fleuri",
    "commonName": "Jonc fleuri",
    "latinName": "Butomus umbellatus",
    "category": "aquatic",
    "heightAdult": 1,
    "widthAdult": 0.4,
    "sun": [
      "full"
    ],
    "hardiness": -25,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "rose",
    "zones": [
      "pond"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        3,
        4,
        5
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [],
      "planting": "Planter en panier dans 10-30 cm d'eau, plein soleil.",
      "pruning": "Couper le feuillage sec en automne.",
      "fertilizer": "Aucun engrais.",
      "watering": "Maintenir le niveau d'eau.",
      "notes": "Espèce protégée localement ; prélever uniquement en jardinerie."
    }
  },
  {
    "id": "h-rubanier",
    "commonName": "Rubanier dressé",
    "latinName": "Sparganium erectum",
    "category": "aquatic",
    "heightAdult": 1,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "vert-blanc",
    "zones": [
      "pond"
    ],
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        3,
        4,
        5
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [],
      "planting": "Planter dans 10-30 cm d'eau.",
      "pruning": "Couper le feuillage sec en automne.",
      "fertilizer": "Aucun engrais.",
      "watering": "Garder les racines immergées.",
      "notes": "Vigoureux, contenir en panier."
    }
  },
  {
    "id": "h-populage",
    "commonName": "Populage des marais",
    "latinName": "Caltha palustris",
    "category": "aquatic",
    "heightAdult": 0.4,
    "widthAdult": 0.5,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -30,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      3,
      4,
      5
    ],
    "bloomColor": "jaune",
    "zones": [
      "pond"
    ],
    "toxic": true,
    "melliferous": true,
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        7
      ],
      "fertMonths": [],
      "planting": "Planter en bordure humide, 0-10 cm d'eau.",
      "pruning": "Aucune taille particulière.",
      "fertilizer": "Aucun engrais.",
      "watering": "Sol toujours détrempé.",
      "notes": "Entre en repos l'été si trop sec."
    }
  },
  {
    "id": "h-menthe-aquatique",
    "commonName": "Menthe aquatique",
    "latinName": "Mentha aquatica",
    "category": "aquatic",
    "heightAdult": 0.5,
    "widthAdult": 0.5,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9
    ],
    "bloomColor": "lilas",
    "zones": [
      "pond"
    ],
    "melliferous": true,
    "edible": true,
    "windTolerant": true,
    "harvest": [
      6,
      7,
      8,
      9
    ],
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        5
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [],
      "planting": "Planter en bordure de mare, 0-10 cm d'eau.",
      "pruning": "Couper après floraison pour limiter son extension.",
      "fertilizer": "Aucun engrais.",
      "watering": "Garder les racines immergées.",
      "notes": "Envahissante en berge si non limitée."
    }
  },
  {
    "id": "h-myriophylle-epi",
    "commonName": "Myriophylle en épi",
    "latinName": "Myriophyllum spicatum",
    "category": "aquatic",
    "heightAdult": 0.1,
    "widthAdult": 0.5,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -20,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7
    ],
    "bloomColor": "rose",
    "zones": [
      "pond"
    ],
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        4,
        5,
        6
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter en panier dans 30-100 cm d'eau ; oxygénant.",
      "pruning": "Éclaircir s'il envahit.",
      "fertilizer": "Aucun engrais.",
      "watering": "Maintenir le niveau d'eau.",
      "notes": "Ne pas confondre avec le myriophylle du Brésil, invasif."
    }
  },
  {
    "id": "h-jussie",
    "commonName": "Jussie à grandes fleurs",
    "latinName": "Ludwigia grandiflora",
    "category": "aquatic",
    "heightAdult": 0.5,
    "widthAdult": 1,
    "sun": [
      "full"
    ],
    "hardiness": -15,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8,
      9
    ],
    "bloomColor": "jaune",
    "zones": [
      "pond"
    ],
    "invasive": true,
    "maintenance": "high",
    "kc": 1,
    "spacing": 1,
    "care": {
      "plantMonths": [],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "À ne pas planter : espèce exotique envahissante interdite à la vente et à la plantation.",
      "pruning": "Arracher manuellement et évacuer en déchets verts.",
      "fertilizer": "Aucun engrais.",
      "watering": "Sans objet.",
      "notes": "Colonise rapidement les mares et rivières."
    }
  },
  {
    "id": "h-massette",
    "commonName": "Massette à larges feuilles",
    "latinName": "Typha latifolia",
    "category": "aquatic",
    "heightAdult": 2,
    "widthAdult": 1,
    "sun": [
      "full"
    ],
    "hardiness": -30,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "brun",
    "zones": [
      "pond"
    ],
    "windTolerant": true,
    "maintenance": "medium",
    "kc": 1,
    "spacing": 1,
    "care": {
      "plantMonths": [
        3,
        4,
        5
      ],
      "pruneMonths": [
        10,
        11
      ],
      "fertMonths": [],
      "planting": "Planter dans 10-40 cm d'eau, uniquement dans une grande mare.",
      "pruning": "Couper les tiges sèches en automne.",
      "fertilizer": "Aucun engrais.",
      "watering": "Garder les racines immergées.",
      "notes": "Très envahissante, la tenir en panier."
    }
  },
  {
    "id": "h-pontederie",
    "commonName": "Pontédérie",
    "latinName": "Pontederia cordata",
    "category": "aquatic",
    "heightAdult": 0.8,
    "widthAdult": 0.6,
    "sun": [
      "full"
    ],
    "hardiness": -15,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      7,
      8,
      9
    ],
    "bloomColor": "bleu",
    "zones": [
      "pond"
    ],
    "melliferous": true,
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.6,
    "care": {
      "plantMonths": [
        4,
        5
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [],
      "planting": "Planter en panier dans 10-30 cm d'eau, plein soleil.",
      "pruning": "Couper le feuillage sec en automne.",
      "fertilizer": "Aucun engrais.",
      "watering": "Maintenir le niveau d'eau.",
      "notes": "Protéger du gel par une eau plus profonde en hiver."
    }
  },
  {
    "id": "h-cresson-fontaine",
    "commonName": "Cresson de fontaine",
    "latinName": "Nasturtium officinale",
    "category": "aquatic",
    "heightAdult": 0.2,
    "widthAdult": 0.4,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "high",
    "soil": [],
    "foliage": "semi",
    "bloom": [
      5,
      6,
      7
    ],
    "bloomColor": "blanc",
    "zones": [
      "pond",
      "vegetable"
    ],
    "edible": true,
    "harvest": [
      4,
      5,
      6,
      9,
      10
    ],
    "maintenance": "medium",
    "kc": 1,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter en eau claire et fraîche, 0-10 cm de profondeur.",
      "pruning": "Récolter régulièrement les jeunes pousses.",
      "fertilizer": "Aucun engrais.",
      "watering": "Eau courante ou renouvelée.",
      "notes": "Ne consommer que si l'eau est saine."
    }
  },
  {
    "id": "h-jonc-epars",
    "commonName": "Jonc épars",
    "latinName": "Juncus effusus",
    "category": "aquatic",
    "heightAdult": 0.8,
    "widthAdult": 0.4,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "high",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [
      6,
      7
    ],
    "bloomColor": "brun",
    "zones": [
      "pond"
    ],
    "windTolerant": true,
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        3
      ],
      "fertMonths": [],
      "planting": "Planter en berge, 0-10 cm d'eau, soleil ou mi-ombre.",
      "pruning": "Couper les tiges abîmées en mars.",
      "fertilizer": "Aucun engrais.",
      "watering": "Sol constamment humide.",
      "notes": "Très rustique."
    }
  },
  {
    "id": "h-hottonie",
    "commonName": "Hottonie des marais",
    "latinName": "Hottonia palustris",
    "category": "aquatic",
    "heightAdult": 0.2,
    "widthAdult": 0.4,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "high",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "lilas",
    "zones": [
      "pond"
    ],
    "maintenance": "low",
    "kc": 1,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        4,
        5
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter en eau calme, 20-50 cm de profondeur.",
      "pruning": "Éclaircir au besoin.",
      "fertilizer": "Aucun engrais.",
      "watering": "Maintenir le niveau d'eau.",
      "notes": "Espèce protégée dans certaines régions ; acheter en jardinerie."
    }
  },
  {
    "id": "h-tomate",
    "commonName": "Tomate",
    "latinName": "Solanum lycopersicum",
    "category": "vegetable",
    "heightAdult": 1.8,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": 0,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "jaune",
    "zones": [
      "vegetable",
      "terrace"
    ],
    "edible": true,
    "harvest": [
      7,
      8,
      9,
      10
    ],
    "maintenance": "high",
    "kc": 1.1,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        5,
        6
      ],
      "pruneMonths": [
        6,
        7,
        8
      ],
      "fertMonths": [
        5,
        6,
        7
      ],
      "planting": "Repiquer fin mai après les saintes glaces, tuteurer, sol riche.",
      "pruning": "Supprimer les gourmands et pincer la tête en août.",
      "fertilizer": "Compost à la plantation, engrais tomates tous les 15 jours.",
      "watering": "Arroser au pied régulièrement, sans mouiller le feuillage.",
      "notes": "Mildiou : éviter d'arroser les feuilles ; ne pas replanter au même endroit avant 3 ans."
    }
  },
  {
    "id": "h-courgette",
    "commonName": "Courgette",
    "latinName": "Cucurbita pepo",
    "category": "vegetable",
    "heightAdult": 0.5,
    "widthAdult": 1,
    "sun": [
      "full"
    ],
    "hardiness": 0,
    "water": "high",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8,
      9
    ],
    "bloomColor": "jaune",
    "zones": [
      "vegetable"
    ],
    "melliferous": true,
    "edible": true,
    "harvest": [
      6,
      7,
      8,
      9,
      10
    ],
    "maintenance": "medium",
    "kc": 1,
    "spacing": 1,
    "care": {
      "plantMonths": [
        5,
        6
      ],
      "pruneMonths": [],
      "fertMonths": [
        5,
        6,
        7
      ],
      "planting": "Planter fin mai en sol riche, au soleil.",
      "pruning": "Peu de taille ; couper les feuilles malades.",
      "fertilizer": "Compost abondant à la plantation.",
      "watering": "Arroser abondamment au pied.",
      "notes": "Oïdium en fin d'été ; récolter jeune."
    }
  },
  {
    "id": "h-laitue",
    "commonName": "Laitue",
    "latinName": "Lactuca sativa",
    "category": "vegetable",
    "heightAdult": 0.25,
    "widthAdult": 0.3,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -5,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable",
      "terrace"
    ],
    "edible": true,
    "harvest": [
      4,
      5,
      6,
      7,
      8,
      9,
      10
    ],
    "maintenance": "medium",
    "kc": 0.9,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        8,
        9
      ],
      "pruneMonths": [],
      "fertMonths": [
        4,
        5
      ],
      "planting": "Semer ou repiquer de mars à septembre ; à mi-ombre l'été.",
      "pruning": "Aucune taille.",
      "fertilizer": "Compost léger.",
      "watering": "Arroser régulièrement, tôt le matin.",
      "notes": "Limaces ; monte à graines en forte chaleur."
    }
  },
  {
    "id": "h-carotte",
    "commonName": "Carotte",
    "latinName": "Daucus carota subsp. sativus",
    "category": "vegetable",
    "heightAdult": 0.3,
    "widthAdult": 0.1,
    "sun": [
      "full"
    ],
    "hardiness": -5,
    "water": "medium",
    "soil": [
      "sandy",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable"
    ],
    "edible": true,
    "harvest": [
      6,
      7,
      8,
      9,
      10,
      11
    ],
    "maintenance": "medium",
    "kc": 0.8,
    "spacing": 0.05,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        6,
        7
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Semer en place de mars à juillet en sol léger et meuble.",
      "pruning": "Éclaircir à 3-5 cm.",
      "fertilizer": "Pas de fumure fraîche.",
      "watering": "Arroser régulièrement et modérément.",
      "notes": "Mouche de la carotte : voile anti-insectes."
    }
  },
  {
    "id": "h-haricot-vert",
    "commonName": "Haricot vert nain",
    "latinName": "Phaseolus vulgaris",
    "category": "vegetable",
    "heightAdult": 0.4,
    "widthAdult": 0.3,
    "sun": [
      "full"
    ],
    "hardiness": 0,
    "water": "medium",
    "soil": [
      "loam",
      "sandy",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "blanc",
    "zones": [
      "vegetable"
    ],
    "melliferous": true,
    "edible": true,
    "harvest": [
      7,
      8,
      9
    ],
    "maintenance": "low",
    "kc": 0.9,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        5,
        6,
        7
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Semer de mai à juillet quand le sol est à plus de 12 °C.",
      "pruning": "Aucune taille.",
      "fertilizer": "Pas d'engrais azoté.",
      "watering": "Arroser régulièrement à la floraison.",
      "notes": "Pucerons noirs ; semis échelonnés."
    }
  },
  {
    "id": "h-fraisier",
    "commonName": "Fraisier",
    "latinName": "Fragaria x ananassa",
    "category": "vegetable",
    "heightAdult": 0.25,
    "widthAdult": 0.3,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -20,
    "water": "medium",
    "soil": [
      "humus",
      "loam",
      "sandy"
    ],
    "foliage": "evergreen",
    "bloom": [
      4,
      5,
      6
    ],
    "bloomColor": "blanc",
    "zones": [
      "vegetable",
      "terrace",
      "lowplants"
    ],
    "melliferous": true,
    "edible": true,
    "harvest": [
      5,
      6,
      7,
      8
    ],
    "maintenance": "medium",
    "kc": 0.9,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        8,
        9,
        3
      ],
      "pruneMonths": [
        8
      ],
      "fertMonths": [
        3,
        8
      ],
      "planting": "Planter en août-septembre, collet au niveau du sol.",
      "pruning": "Couper les stolons et vieilles feuilles après récolte.",
      "fertilizer": "Compost ou engrais fraisiers au printemps.",
      "watering": "Arroser au pied, pailler à la paille.",
      "notes": "Botrytis et limaces ; renouveler les plants tous les 3-4 ans."
    }
  },
  {
    "id": "h-persil",
    "commonName": "Persil",
    "latinName": "Petroselinum crispum",
    "category": "vegetable",
    "heightAdult": 0.4,
    "widthAdult": 0.3,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -15,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable",
      "terrace"
    ],
    "edible": true,
    "harvest": [
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11
    ],
    "maintenance": "low",
    "kc": 0.8,
    "spacing": 0.2,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        6
      ],
      "pruneMonths": [],
      "fertMonths": [
        4,
        5
      ],
      "planting": "Semer d'avril à juillet à mi-ombre en sol frais.",
      "pruning": "Récolter les feuilles extérieures.",
      "fertilizer": "Compost léger.",
      "watering": "Arroser régulièrement.",
      "notes": "Germination lente (3-4 semaines)."
    }
  },
  {
    "id": "h-basilic",
    "commonName": "Basilic",
    "latinName": "Ocimum basilicum",
    "category": "vegetable",
    "heightAdult": 0.4,
    "widthAdult": 0.3,
    "sun": [
      "full"
    ],
    "hardiness": 2,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      7,
      8
    ],
    "bloomColor": "blanc",
    "zones": [
      "vegetable",
      "terrace"
    ],
    "edible": true,
    "windTolerant": true,
    "harvest": [
      6,
      7,
      8,
      9
    ],
    "maintenance": "medium",
    "kc": 0.9,
    "spacing": 0.25,
    "care": {
      "plantMonths": [
        5,
        6
      ],
      "pruneMonths": [
        6,
        7
      ],
      "fertMonths": [
        5,
        6
      ],
      "planting": "Semer ou repiquer après les gelées, au soleil abrité.",
      "pruning": "Pincer les fleurs pour prolonger la récolte.",
      "fertilizer": "Engrais organique léger.",
      "watering": "Arroser au pied sans mouiller le feuillage.",
      "notes": "Craint le froid ; limaces et mildiou."
    }
  },
  {
    "id": "h-ciboulette",
    "commonName": "Ciboulette",
    "latinName": "Allium schoenoprasum",
    "category": "vegetable",
    "heightAdult": 0.3,
    "widthAdult": 0.2,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -30,
    "water": "medium",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "violet",
    "zones": [
      "vegetable",
      "terrace",
      "path"
    ],
    "melliferous": true,
    "edible": true,
    "harvest": [
      4,
      5,
      6,
      7,
      8,
      9,
      10
    ],
    "maintenance": "low",
    "kc": 0.8,
    "spacing": 0.2,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        6
      ],
      "fertMonths": [
        3,
        6
      ],
      "planting": "Semer ou diviser une touffe en sol frais.",
      "pruning": "Couper à 3 cm pour la repousse ; diviser tous les 3 ans.",
      "fertilizer": "Compost léger.",
      "watering": "Arroser en été sec.",
      "notes": "Rouille possible ; mellifère."
    }
  },
  {
    "id": "h-thym-commun",
    "commonName": "Thym commun",
    "latinName": "Thymus vulgaris",
    "category": "vegetable",
    "heightAdult": 0.25,
    "widthAdult": 0.4,
    "sun": [
      "full"
    ],
    "hardiness": -18,
    "water": "low",
    "soil": [
      "limestone",
      "sandy",
      "loam"
    ],
    "foliage": "evergreen",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "rose",
    "zones": [
      "vegetable",
      "terrace",
      "path"
    ],
    "melliferous": true,
    "edible": true,
    "windTolerant": true,
    "harvest": [
      4,
      5,
      6,
      7,
      8,
      9,
      10
    ],
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.3,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        4,
        8
      ],
      "fertMonths": [],
      "planting": "Planter au soleil en sol drainé.",
      "pruning": "Tailler après floraison, sans trop couper le bois.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser très peu.",
      "notes": "Craint l'humidité hivernale."
    }
  },
  {
    "id": "h-romarin",
    "commonName": "Romarin",
    "latinName": "Salvia rosmarinus",
    "category": "vegetable",
    "heightAdult": 1,
    "widthAdult": 1,
    "sun": [
      "full"
    ],
    "hardiness": -12,
    "water": "low",
    "soil": [
      "limestone",
      "sandy",
      "loam"
    ],
    "foliage": "evergreen",
    "bloom": [
      3,
      4,
      5,
      10
    ],
    "bloomColor": "bleu",
    "zones": [
      "vegetable",
      "terrace",
      "path"
    ],
    "melliferous": true,
    "edible": true,
    "windTolerant": true,
    "harvest": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12
    ],
    "maintenance": "low",
    "kc": 0.4,
    "spacing": 0.8,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        6
      ],
      "fertMonths": [],
      "planting": "Planter au soleil en sol très drainé.",
      "pruning": "Tailler après floraison, éviter le vieux bois.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser très peu.",
      "notes": "Craint les hivers froids humides en dessous de -12 °C."
    }
  },
  {
    "id": "h-poireau",
    "commonName": "Poireau",
    "latinName": "Allium porrum",
    "category": "vegetable",
    "heightAdult": 0.7,
    "widthAdult": 0.1,
    "sun": [
      "full"
    ],
    "hardiness": -15,
    "water": "medium",
    "soil": [
      "humus",
      "loam",
      "clay"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable"
    ],
    "edible": true,
    "harvest": [
      9,
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "maintenance": "medium",
    "kc": 0.9,
    "spacing": 0.15,
    "care": {
      "plantMonths": [
        5,
        6,
        7
      ],
      "pruneMonths": [],
      "fertMonths": [
        5,
        6
      ],
      "planting": "Repiquer de mai à juillet en trou profond.",
      "pruning": "Butter pour blanchir.",
      "fertilizer": "Compost mûr.",
      "watering": "Arroser régulièrement en été.",
      "notes": "Teigne du poireau : voile anti-insectes."
    }
  },
  {
    "id": "h-radis",
    "commonName": "Radis",
    "latinName": "Raphanus sativus",
    "category": "vegetable",
    "heightAdult": 0.2,
    "widthAdult": 0.05,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -5,
    "water": "medium",
    "soil": [
      "loam",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable",
      "terrace"
    ],
    "edible": true,
    "harvest": [
      4,
      5,
      6,
      9,
      10
    ],
    "maintenance": "medium",
    "kc": 0.8,
    "spacing": 0.05,
    "care": {
      "plantMonths": [
        3,
        4,
        5,
        8,
        9
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Semer de mars à septembre à l'ombre en été.",
      "pruning": "Aucune taille.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arroser régulièrement pour éviter le piquant.",
      "notes": "Altises : voile anti-insectes."
    }
  },
  {
    "id": "h-pomme-de-terre",
    "commonName": "Pomme de terre",
    "latinName": "Solanum tuberosum",
    "category": "vegetable",
    "heightAdult": 0.7,
    "widthAdult": 0.4,
    "sun": [
      "full"
    ],
    "hardiness": 0,
    "water": "medium",
    "soil": [
      "sandy",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7
    ],
    "bloomColor": "blanc",
    "zones": [
      "vegetable"
    ],
    "toxic": true,
    "edible": true,
    "harvest": [
      6,
      7,
      8,
      9
    ],
    "maintenance": "medium",
    "kc": 1.1,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        5
      ],
      "pruneMonths": [],
      "fertMonths": [
        3,
        4
      ],
      "planting": "Planter les plants pré-germés de mars à mai, à 10 cm.",
      "pruning": "Butter 2 fois.",
      "fertilizer": "Compost mûr, pas de fumier frais.",
      "watering": "Arroser en cas de sécheresse après floraison.",
      "notes": "Mildiou et doryphores ; feuilles et fruits toxiques."
    }
  },
  {
    "id": "h-ail",
    "commonName": "Ail",
    "latinName": "Allium sativum",
    "category": "vegetable",
    "heightAdult": 0.6,
    "widthAdult": 0.1,
    "sun": [
      "full"
    ],
    "hardiness": -20,
    "water": "low",
    "soil": [
      "sandy",
      "loam",
      "limestone"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable"
    ],
    "edible": true,
    "harvest": [
      6,
      7
    ],
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.1,
    "care": {
      "plantMonths": [
        10,
        11,
        2
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter les caïeux à l'automne ou en février, pointe en haut.",
      "pruning": "Aucune taille.",
      "fertilizer": "Aucun fumier frais.",
      "watering": "Arroser peu.",
      "notes": "Rouille en été humide ; ne pas replanter au même endroit."
    }
  },
  {
    "id": "h-oignon",
    "commonName": "Oignon",
    "latinName": "Allium cepa",
    "category": "vegetable",
    "heightAdult": 0.5,
    "widthAdult": 0.1,
    "sun": [
      "full"
    ],
    "hardiness": -15,
    "water": "low",
    "soil": [
      "sandy",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable"
    ],
    "edible": true,
    "harvest": [
      7,
      8
    ],
    "maintenance": "low",
    "kc": 0.7,
    "spacing": 0.1,
    "care": {
      "plantMonths": [
        3,
        4,
        10
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Planter des bulbilles en mars-avril au soleil.",
      "pruning": "Aucune taille.",
      "fertilizer": "Aucun fumier frais.",
      "watering": "Arroser peu, stopper en fin de saison.",
      "notes": "Mildiou ; laisser sécher avant stockage."
    }
  },
  {
    "id": "h-chou-pomme",
    "commonName": "Chou pommé",
    "latinName": "Brassica oleracea var. capitata",
    "category": "vegetable",
    "heightAdult": 0.5,
    "widthAdult": 0.6,
    "sun": [
      "full"
    ],
    "hardiness": -10,
    "water": "medium",
    "soil": [
      "clay",
      "loam",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable"
    ],
    "edible": true,
    "harvest": [
      6,
      7,
      8,
      9,
      10,
      11,
      12
    ],
    "maintenance": "medium",
    "kc": 1,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        5,
        6,
        7
      ],
      "pruneMonths": [],
      "fertMonths": [
        5,
        6
      ],
      "planting": "Repiquer de mai à juillet en sol riche et frais.",
      "pruning": "Retirer les feuilles jaunies.",
      "fertilizer": "Compost abondant.",
      "watering": "Arroser régulièrement.",
      "notes": "Piéride et altises : filet anti-insectes."
    }
  },
  {
    "id": "h-potimarron",
    "commonName": "Potimarron",
    "latinName": "Cucurbita maxima",
    "category": "vegetable",
    "heightAdult": 0.5,
    "widthAdult": 2,
    "sun": [
      "full"
    ],
    "hardiness": 0,
    "water": "high",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      7,
      8
    ],
    "bloomColor": "orange",
    "zones": [
      "vegetable"
    ],
    "melliferous": true,
    "edible": true,
    "harvest": [
      9,
      10
    ],
    "maintenance": "medium",
    "kc": 1,
    "spacing": 1,
    "care": {
      "plantMonths": [
        5,
        6
      ],
      "pruneMonths": [
        7
      ],
      "fertMonths": [
        5,
        6
      ],
      "planting": "Planter en mai-juin en poquet de compost, au soleil.",
      "pruning": "Pincer les tiges après 3-4 fruits.",
      "fertilizer": "Compost abondant à la plantation.",
      "watering": "Arroser abondamment au pied.",
      "notes": "Oïdium ; récolter avant les gelées."
    }
  },
  {
    "id": "h-poivron",
    "commonName": "Poivron",
    "latinName": "Capsicum annuum",
    "category": "vegetable",
    "heightAdult": 0.7,
    "widthAdult": 0.4,
    "sun": [
      "full"
    ],
    "hardiness": 2,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      6,
      7,
      8
    ],
    "bloomColor": "blanc",
    "zones": [
      "vegetable",
      "terrace"
    ],
    "edible": true,
    "harvest": [
      8,
      9,
      10
    ],
    "maintenance": "medium",
    "kc": 1,
    "spacing": 0.5,
    "care": {
      "plantMonths": [
        5,
        6
      ],
      "pruneMonths": [],
      "fertMonths": [
        5,
        6,
        7
      ],
      "planting": "Repiquer fin mai au chaud et au soleil.",
      "pruning": "Tuteurer, pincer les fleurs précoces.",
      "fertilizer": "Engrais organique en cours de saison.",
      "watering": "Arroser régulièrement au pied.",
      "notes": "Pucerons ; craint le froid."
    }
  },
  {
    "id": "h-betterave",
    "commonName": "Betterave rouge",
    "latinName": "Beta vulgaris",
    "category": "vegetable",
    "heightAdult": 0.4,
    "widthAdult": 0.15,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -8,
    "water": "medium",
    "soil": [
      "loam",
      "sandy",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable"
    ],
    "edible": true,
    "harvest": [
      7,
      8,
      9,
      10,
      11
    ],
    "maintenance": "low",
    "kc": 0.8,
    "spacing": 0.15,
    "care": {
      "plantMonths": [
        4,
        5,
        6
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Semer d'avril à juin à 2 cm, éclaircir à 10 cm.",
      "pruning": "Aucune taille.",
      "fertilizer": "Pas de fumier frais.",
      "watering": "Arroser régulièrement.",
      "notes": "Rouille possible ; récolter avant les fortes gelées."
    }
  },
  {
    "id": "h-epinard",
    "commonName": "Épinard",
    "latinName": "Spinacia oleracea",
    "category": "vegetable",
    "heightAdult": 0.3,
    "widthAdult": 0.2,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -10,
    "water": "medium",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "vegetable"
    ],
    "edible": true,
    "harvest": [
      4,
      5,
      6,
      10,
      11,
      12
    ],
    "maintenance": "low",
    "kc": 0.8,
    "spacing": 0.15,
    "care": {
      "plantMonths": [
        3,
        4,
        8,
        9
      ],
      "pruneMonths": [],
      "fertMonths": [
        3,
        9
      ],
      "planting": "Semer au printemps ou fin d'été, à mi-ombre en été.",
      "pruning": "Aucune taille.",
      "fertilizer": "Compost.",
      "watering": "Arroser régulièrement.",
      "notes": "Monte à graines en chaleur."
    }
  },
  {
    "id": "h-petit-pois",
    "commonName": "Petit pois",
    "latinName": "Pisum sativum",
    "category": "vegetable",
    "heightAdult": 1,
    "widthAdult": 0.2,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -8,
    "water": "medium",
    "soil": [
      "loam",
      "humus"
    ],
    "foliage": "deciduous",
    "bloom": [
      5,
      6
    ],
    "bloomColor": "blanc",
    "zones": [
      "vegetable"
    ],
    "melliferous": true,
    "edible": true,
    "harvest": [
      6,
      7
    ],
    "maintenance": "low",
    "kc": 0.9,
    "spacing": 0.05,
    "care": {
      "plantMonths": [
        2,
        3,
        4,
        10
      ],
      "pruneMonths": [],
      "fertMonths": [],
      "planting": "Semer de février à avril à 3 cm, avec rames.",
      "pruning": "Aucune taille.",
      "fertilizer": "Aucun apport azoté.",
      "watering": "Arroser à la floraison.",
      "notes": "Pucerons, bruches ; arracher et laisser les racines en terre."
    }
  },
  {
    "id": "h-menthe-verte",
    "commonName": "Menthe verte",
    "latinName": "Mentha spicata",
    "category": "vegetable",
    "heightAdult": 0.6,
    "widthAdult": 0.6,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -25,
    "water": "high",
    "soil": [
      "humus",
      "loam"
    ],
    "foliage": "deciduous",
    "bloom": [
      7,
      8
    ],
    "bloomColor": "lilas",
    "zones": [
      "vegetable",
      "terrace"
    ],
    "melliferous": true,
    "edible": true,
    "windTolerant": true,
    "harvest": [
      5,
      6,
      7,
      8,
      9,
      10
    ],
    "maintenance": "medium",
    "kc": 1,
    "spacing": 0.4,
    "care": {
      "plantMonths": [
        3,
        4,
        9
      ],
      "pruneMonths": [
        10
      ],
      "fertMonths": [
        3
      ],
      "planting": "Planter en pot ou en bac enterré, car très envahissante.",
      "pruning": "Couper régulièrement, rabattre en automne.",
      "fertilizer": "Compost léger.",
      "watering": "Garder le sol frais.",
      "notes": "Rouille de la menthe ; renouveler tous les 3 ans."
    }
  },
  {
    "id": "h-gazon-rustique",
    "commonName": "Gazon rustique",
    "latinName": "Lolium perenne / Festuca rubra",
    "category": "lawn",
    "heightAdult": 0.08,
    "widthAdult": 0.01,
    "sun": [
      "full",
      "partial"
    ],
    "hardiness": -20,
    "water": "medium",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "lawn"
    ],
    "maintenance": "medium",
    "kc": 0.8,
    "spacing": 0.01,
    "care": {
      "plantMonths": [
        4,
        5,
        9
      ],
      "pruneMonths": [
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "fertMonths": [
        4,
        9
      ],
      "planting": "Semer au printemps ou à l'automne, 30 g/m², sol bien préparé.",
      "pruning": "Tondre à 5-6 cm, 1 fois par semaine en saison.",
      "fertilizer": "Engrais gazon au printemps et à l'automne.",
      "watering": "Arroser tôt le matin en été sec.",
      "notes": "Mousse en sol compacté ; aérer à l'automne."
    }
  },
  {
    "id": "h-gazon-ombre",
    "commonName": "Gazon d'ombre",
    "latinName": "Poa trivialis / Festuca rubra",
    "category": "lawn",
    "heightAdult": 0.08,
    "widthAdult": 0.01,
    "sun": [
      "partial",
      "shade"
    ],
    "hardiness": -20,
    "water": "medium",
    "soil": [],
    "foliage": "evergreen",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "lawn"
    ],
    "maintenance": "medium",
    "kc": 0.8,
    "spacing": 0.01,
    "care": {
      "plantMonths": [
        4,
        5,
        9
      ],
      "pruneMonths": [
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "fertMonths": [
        4,
        9
      ],
      "planting": "Semer à l'automne avec un mélange adapté à l'ombre.",
      "pruning": "Tondre à 6-7 cm.",
      "fertilizer": "Engrais gazon au printemps et à l'automne.",
      "watering": "Arroser régulièrement mais peu, sol frais.",
      "notes": "Mousse fréquente ; élaguer pour la lumière."
    }
  },
  {
    "id": "h-gazon-sec",
    "commonName": "Gazon résistant à la sécheresse",
    "latinName": "Festuca arundinacea",
    "category": "lawn",
    "heightAdult": 0.08,
    "widthAdult": 0.01,
    "sun": [
      "full"
    ],
    "hardiness": -20,
    "water": "low",
    "soil": [
      "sandy",
      "limestone",
      "loam"
    ],
    "foliage": "evergreen",
    "bloom": [],
    "bloomColor": "aucune",
    "zones": [
      "lawn"
    ],
    "maintenance": "low",
    "kc": 0.6,
    "spacing": 0.01,
    "care": {
      "plantMonths": [
        4,
        5,
        9
      ],
      "pruneMonths": [
        4,
        5,
        6,
        7,
        8,
        9,
        10
      ],
      "fertMonths": [
        4,
        9
      ],
      "planting": "Semer au printemps ou à l'automne en sol profond.",
      "pruning": "Tondre à 6-8 cm pour garder de la réserve d'eau.",
      "fertilizer": "Un apport d'engrais gazon à l'automne.",
      "watering": "Peu d'arrosage ; enraciné profondément.",
      "notes": "Moins dense que le gazon rustique."
    }
  },
  {
    "id": "h-prairie-fleurie",
    "commonName": "Prairie fleurie",
    "latinName": "Mélange annuelles et vivaces mellifères",
    "category": "lawn",
    "heightAdult": 0.8,
    "widthAdult": 0.5,
    "sun": [
      "full"
    ],
    "hardiness": -15,
    "water": "low",
    "soil": [],
    "foliage": "deciduous",
    "bloom": [
      5,
      6,
      7,
      8,
      9
    ],
    "bloomColor": "multicolore",
    "zones": [
      "lawn",
      "lowplants"
    ],
    "melliferous": true,
    "windTolerant": true,
    "maintenance": "low",
    "kc": 0.5,
    "spacing": 0.1,
    "care": {
      "plantMonths": [
        3,
        4,
        9,
        10
      ],
      "pruneMonths": [
        9,
        10
      ],
      "fertMonths": [],
      "planting": "Semer au printemps ou à l'automne, sol pauvre non amendé.",
      "pruning": "Faucher une ou deux fois par an en fin d'été et exporter.",
      "fertilizer": "Aucun engrais.",
      "watering": "Arrosage seulement à la levée.",
      "notes": "Les annuelles disparaissent sans resemis."
    }
  }
];

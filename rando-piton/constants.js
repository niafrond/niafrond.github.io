const STORAGE_KEYS = {
  favorites: "rando-piton:favorites",
  offline: "rando-piton:offline",
  selected: "rando-piton:selected",
  traces: "rando-piton:traces",
  customTrails: "rando-piton:custom-trails",
  baseTrails: "rando-piton:base-trails",
  baseTrailsTimestamp: "rando-piton:base-trails-ts"
}

const USER_CACHE_NAME = "rando-piton-user-offline-v1"
const RANDOPITONS_BASE_URL = "https://randopitons.re"
const RANDOPITONS_SUGGESTIONS_PROXY = "https://api.allorigins.win/raw?url="
const VERSION_FALLBACK = "1.24.1"
const BASE_TRAILS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Quelques fiches de secours si le réseau est indisponible au premier lancement
const DEFAULT_BASE_TRAILS = [
  {
    id: "piton-neiges-bivouac",
    title: "Piton des Neiges avec bivouac",
    sourceUrl: "https://randopitons.re/randonnee/2-piton-neiges-caverne-dufour",
    area: "Centre",
    difficulty: "Soutenue",
    duration: "2 jours",
    distance: "15,8 km",
    elevation: "+1700 m",
    summary: "Classique réunionnaise pour viser le sommet de l'île au lever du soleil.",
    keywords: ["sommet", "piton-des-neiges", "refuge", "bivouac", "lever-du-soleil"],
    highlights: ["Sommet emblématique", "Lever du soleil", "Refuge Caverne Dufour"],
    access: "Approche par Cilaos. Vérifier météo et réservations.",
    offlineChecklist: ["Veste chaude", "Lampe frontale", "Eau 3L", "Encas énergétiques"],
    vibe: "Haute montagne tropicale",
    publicItinerary: [
      "Montée progressive depuis Cilaos jusqu'à la Caverne Dufour ou au refuge.",
      "Départ de nuit pour atteindre le sommet au lever du soleil.",
      "Descente par le même axe avec vigilance sur la fatigue."
    ]
  },
  {
    id: "trou-de-fer",
    title: "Belvédère du Trou de Fer",
    sourceUrl: "https://randopitons.re/randonnee/206-trou-fer-belouve",
    area: "Est",
    difficulty: "Intermédiaire",
    duration: "5h00",
    distance: "11,3 km",
    elevation: "+540 m",
    summary: "Forêt humide vers un belvédère spectaculaire sur les cascades du Trou de Fer.",
    keywords: ["trou-de-fer", "foret", "cascade", "belouve"],
    highlights: ["Forêt primaire", "Passages humides", "Grandes cascades"],
    access: "Départ depuis Bélouve. Prévoir protection pluie.",
    offlineChecklist: ["Poncho", "Housse étanche", "Bâtons conseillés"],
    vibe: "Brume, fougères et ravines",
    publicItinerary: [
      "Sentier traverse la forêt humide de Bélouve sur terrain boueux et chargé en racines.",
      "Progression jusqu'au belvédère dominant le Trou de Fer et ses grandes cascades encaissées.",
      "Retour en restant attentif aux portions glissantes."
    ]
  },
  {
    id: "cilaos-fleurs-jaunes-bras-rouge",
    title: "De Cilaos à la Ravine Fleurs Jaunes par la Cascade du Bras Rouge",
    sourceUrl: "https://randopitons.re/randonnee/1009-cilaos-ravine-fleurs-jaunes-cascade-bras-rouge",
    area: "Cilaos",
    difficulty: "Soutenue",
    duration: "3h30",
    distance: "6,2 km",
    elevation: "+430 m",
    summary: "Fiche emblématique de Randopitons avec longue descente vers Bras Rouge puis portion plus engagée jusqu'aux bassins de Fleurs Jaunes.",
    keywords: ["cilaos", "cascade", "bassin", "ravine", "corniche", "baignade"],
    highlights: ["Cascade du Bras Rouge", "Bassin Roche", "Portions en corniche"],
    access: "Départ au parking du sentier de la Cascade du Bras Rouge.",
    offlineChecklist: ["Chaussures très accrocheuses", "Eau 1,5 L", "Prudence terrain humide"],
    vibe: "Ravine encaissée, roches basaltiques et ambiance canyon",
    publicItinerary: [
      "Longue descente vers la cascade du Bras Rouge par l'ancien tracé du GRR2.",
      "Après Bras Rouge, traversée du gué et remontée en lacets jusqu'à la Ravine des Fleurs Jaunes.",
      "Fin du parcours aux bassins basaltiques de Fleurs Jaunes. Retour par le même chemin."
    ]
  }
]

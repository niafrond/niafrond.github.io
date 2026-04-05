const STORAGE_KEYS = {
  favorites: "rando-piton:favorites",
  offline: "rando-piton:offline",
  selected: "rando-piton:selected",
  traces: "rando-piton:traces",
  customTrails: "rando-piton:custom-trails",
  baseTrails: "rando-piton:base-trails"
}

const DEFAULT_BASE_TRAILS = [
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
    access: "Départ au parking du sentier de la Cascade du Bras Rouge ou par la piste descendant aux Anciens Thermes selon la variante choisie.",
    offlineChecklist: ["Chaussures très accrocheuses", "Eau 1,5 L", "Prudence terrain humide", "Éviter avec enfants"],
    vibe: "Ravine encaissée, roches basaltiques et ambiance canyon",
    publicItinerary: [
      "La fiche publique présente d'abord une longue descente vers la cascade du Bras Rouge par l'ancien tracé du GRR2, avec corniches, marches et vues dégagées sur les reliefs autour de Cilaos.",
      "Après le passage à Bras Rouge, l'itinéraire devient plus sportif: traversée du gué, remontée en lacets, passage près d'une murette, puis progression entre chocas et zones glissantes jusqu'à la Ravine des Fleurs Jaunes.",
      "La fin du parcours mène aux bassins basaltiques de Fleurs Jaunes et au Bassin Roche. Le retour se fait par le même chemin, avec les mêmes efforts dans la remontée finale."
    ]
  },
  {
    id: "maido-rempart",
    title: "Maido et rebord du rempart",
    sourceUrl: "https://randopitons.re/randonnee/1427-maido-tour-point-vue",
    area: "Ouest",
    difficulty: "Facile",
    duration: "1h45",
    distance: "5,2 km",
    elevation: "+220 m",
    summary: "Balade panoramique au lever du jour, idéale pour découvrir les hauts de l'ouest sans grosse difficulté.",
    keywords: ["maido", "mafate", "panorama", "lever-du-soleil", "belvedere"],
    highlights: ["Panorama sur Mafate", "Départ matinal", "Accès facile en voiture"],
    access: "Départ conseillé depuis le belvédère du Maido. Prévoir une couche coupe-vent même par beau temps.",
    offlineChecklist: ["Coupe-vent", "Eau 1 L", "Frontale si départ avant l'aube"],
    vibe: "Crêtes, nuages et grands points de vue",
    publicItinerary: [
      "Départ au Maido pour longer le rebord du rempart et profiter très vite des panoramas sur Mafate.",
      "La progression reste courte et lisible, alternant portions de piste, sentier de crête et points d'arrêt pour observer le cirque.",
      "Le retour suit le même secteur avec une sortie idéale pour une matinée ou un lever du soleil."
    ]
  },
  {
    id: "grand-bassin",
    title: "Descente vers Grand Bassin",
    sourceUrl: "https://randopitons.re/randonnee/68-grand-bassin-bois-court",
    area: "Sud",
    difficulty: "Intermédiaire",
    duration: "4h30",
    distance: "9,4 km",
    elevation: "+680 m",
    summary: "Itinéraire emblématique avec forte descente puis remontée soutenue vers un village encaissé.",
    keywords: ["grand-bassin", "village", "marches", "remontee", "cascade"],
    highlights: ["Cascade du Voile de la Mariée", "Ambiance de fond de vallée", "Village isolé"],
    access: "Départ depuis le parking du Belvédère de Bois Court. Éviter les heures les plus chaudes pour la remontée.",
    offlineChecklist: ["Chaussures accrocheuses", "2 L d'eau", "Petite collation salée"],
    vibe: "Descente minérale et retour physique",
    publicItinerary: [
      "Le parcours plonge depuis Bois Court vers le fond de vallée avec une longue série de marches et des vues régulières sur les remparts.",
      "On rejoint ensuite Grand Bassin pour traverser le village et profiter de l'ambiance isolée du site avant la pause.",
      "La remontée reprend le même sentier et concentre l'essentiel de l'effort sur le retour."
    ]
  },
  {
    id: "piton-neiges-bivouac",
    title: "Piton des Neiges avec bivouac",
    sourceUrl: "https://randopitons.re/randonnee/2-piton-neiges-caverne-dufour",
    area: "Centre",
    difficulty: "Soutenue",
    duration: "2 jours",
    distance: "15,8 km",
    elevation: "+1700 m",
    summary: "Classique réunionnaise pour viser le sommet de l'île au lever du soleil, avec progression longue et exigeante.",
    keywords: ["sommet", "piton-des-neiges", "refuge", "bivouac", "lever-du-soleil"],
    highlights: ["Sommet emblématique", "Lever du soleil", "Étape refuge ou bivouac"],
    access: "Approche possible par Cilaos. Vérifier la météo et les réservations si un hébergement est prévu.",
    offlineChecklist: ["Veste chaude", "Lampe frontale", "Eau 3 L", "Encas énergétiques"],
    vibe: "Haute montagne tropicale",
    publicItinerary: [
      "Montée progressive depuis Cilaos jusqu'à la Caverne Dufour ou au refuge selon l'organisation choisie pour la nuit.",
      "Départ très tôt ou de nuit pour atteindre le sommet avant le lever du soleil sur une pente plus minérale et plus froide.",
      "La descente se fait ensuite par le même axe avec une vigilance accrue sur la fatigue et les appuis."
    ]
  },
  {
    id: "cap-noir-roche-verre-bouteille",
    title: "Cap Noir et Roche Verre Bouteille",
    sourceUrl: "https://randopitons.re/randonnee/110-cap-noir-roche-verre-bouteille",
    area: "Ouest",
    difficulty: "Facile",
    duration: "2h15",
    distance: "6,1 km",
    elevation: "+260 m",
    summary: "Boucle accessible mêlant forêt, passerelles et belvédères, parfaite pour une demi-journée.",
    keywords: ["mafate", "passerelle", "boucle", "foret", "belvedere"],
    highlights: ["Passerelles", "Vue sur Mafate", "Boucle familiale"],
    access: "Départ depuis le parking du Cap Noir à Dos d'Âne. Prudence par terrain humide.",
    offlineChecklist: ["Imperméable léger", "Eau 1 L", "Téléphone chargé"],
    vibe: "Forêt des hauts et points de vue rapides",
    publicItinerary: [
      "Le départ longe rapidement des points de vue sur Mafate avant de s'enfoncer dans un sentier de forêt bien marqué.",
      "La boucle combine passerelles, montées courtes et sections plus ouvertes vers Roche Verre Bouteille.",
      "L'ensemble reste lisible et adapté à une sortie courte avec beaux panoramas."
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
    summary: "Progression dans une végétation humide vers un belvédère spectaculaire sur les cascades du Trou de Fer.",
    keywords: ["trou-de-fer", "foret", "cascade", "boue", "belouve"],
    highlights: ["Forêt primaire", "Passages humides", "Grandes cascades"],
    access: "Départ depuis Bélouve. Prévoir protection pluie et changement sec pour le retour en voiture.",
    offlineChecklist: ["Poncho", "Housse étanche", "Bâtons conseillés"],
    vibe: "Brume, fougères et ravines",
    publicItinerary: [
      "Le sentier traverse la forêt humide de Bélouve sur un terrain régulièrement boueux et chargé en racines.",
      "La progression mène jusqu'au belvédère dominant le Trou de Fer et ses grandes cascades encaissées.",
      "Le retour suit le même chemin en restant attentif aux portions glissantes."
    ]
  },
  {
    id: "anse-des-cascades",
    title: "Anse des Cascades et littoral",
    sourceUrl: "https://randopitons.re/randonnee/1095-anse-cascades-sentier-littoral",
    area: "Est",
    difficulty: "Facile",
    duration: "1h30",
    distance: "4,6 km",
    elevation: "+110 m",
    summary: "Marche côtière courte pour alterner végétation tropicale, coulées anciennes et pauses en bord de mer.",
    keywords: ["littoral", "mer", "cascade", "facile", "vacoas"],
    highlights: ["Littoral basaltique", "Cascades côtières", "Sortie accessible"],
    access: "Départ depuis l'Anse des Cascades. Très bon choix pour une sortie détente ou une reprise.",
    offlineChecklist: ["Casquette", "Crème solaire", "Eau 1 L"],
    vibe: "Ambiance marine et tropicale",
    publicItinerary: [
      "Le circuit suit d'abord le littoral entre vacoas, anciennes coulées et points de vue dégagés sur l'océan.",
      "On alterne petites portions forestières, cascades côtières et passages plus ouverts en bord de mer.",
      "La sortie reste courte, agréable et adaptée à une découverte tranquille du secteur."
    ]
  }
]

const USER_CACHE_NAME = "rando-piton-user-offline-v1"
const RANDOPITONS_BASE_URL = "https://randopitons.re"
const RANDOPITONS_SUGGESTIONS_PROXY = "https://api.allorigins.win/raw?url="
const VERSION_FALLBACK = "1.24.0"

// Initialize base trails in localStorage if not present
function initializeBaseTrails() {
  const stored = localStorage.getItem(STORAGE_KEYS.baseTrails)
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.baseTrails, JSON.stringify(DEFAULT_BASE_TRAILS))
    return DEFAULT_BASE_TRAILS
  }
  try {
    return JSON.parse(stored)
  } catch {
    return DEFAULT_BASE_TRAILS
  }
}

const state = {
  baseTrails: initializeBaseTrails(),
  customTrails: readStoredList(STORAGE_KEYS.customTrails),
  trails: [],
  favorites: new Set(readStoredList(STORAGE_KEYS.favorites)),
  offline: new Set(readStoredList(STORAGE_KEYS.offline)),
  traces: readStoredMap(STORAGE_KEYS.traces),
  selectedId: localStorage.getItem(STORAGE_KEYS.selected) || null,
  isSearchOpen: false,
  itineraryMode: "text",
  searchDraft: "",
  remoteSuggestions: [],
  remoteSuggestionsStatus: "Saisissez au moins 2 lettres",
  remoteSearchRequestId: 0,
  appVersion: VERSION_FALLBACK,
  filters: {
    query: "",
    difficulty: "all",
    view: "all"
  }
}

const elements = {
  trailList: document.getElementById("trailList"),
  detailsPanel: document.getElementById("detailsPanel"),
  activeSearchSummary: document.getElementById("activeSearchSummary"),
  activeSearchText: document.getElementById("activeSearchText"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  remoteSearchStatus: document.getElementById("remoteSearchStatus"),
  remoteSuggestions: document.getElementById("remoteSuggestions"),
  difficultyFilter: document.getElementById("difficultyFilter"),
  viewFilter: document.getElementById("viewFilter"),
  searchSourceBtn: document.getElementById("searchSourceBtn"),
  showOfflineBtn: document.getElementById("showOfflineBtn"),
  clearKeywordsBtn: document.getElementById("clearKeywordsBtn"),
  keywordChips: document.getElementById("keywordChips"),
  searchFab: document.getElementById("searchFab"),
  searchOverlay: document.getElementById("searchOverlay"),
  searchBackdrop: document.getElementById("searchBackdrop"),
  closeSearchBtn: document.getElementById("closeSearchBtn"),
  cardTemplate: document.getElementById("trailCardTemplate"),
  countAll: document.getElementById("countAll"),
  countFavorites: document.getElementById("countFavorites"),
  countOffline: document.getElementById("countOffline"),
  countTraces: document.getElementById("countTraces"),
  networkBadge: document.getElementById("networkBadge"),
  versionBadge: document.getElementById("versionBadge")
}

initialize()

function initialize() {
  rebuildTrailIndex()
  bindEvents()
  ensureInitialSelection()
  updateNetworkBadge()
  updateVersionBadge()
  render()
  void loadAppVersion()
  registerServiceWorker()
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchDraft = event.target.value
    renderKeywordChips()
    state.remoteSuggestions = []
    state.remoteSuggestionsStatus = "Appuyez sur Entrée ou Rechercher"
    renderRemoteSuggestions()
  })

  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault()
    void refreshRemoteSuggestions(state.searchDraft)
    applySearch(state.searchDraft)
    setSearchOverlayOpen(false)
  })

  elements.difficultyFilter.addEventListener("change", (event) => {
    state.filters.difficulty = event.target.value
    renderTrailList()
  })

  elements.viewFilter.addEventListener("change", (event) => {
    state.filters.view = event.target.value
    render()
  })

  window.addEventListener("online", updateNetworkBadge)
  window.addEventListener("offline", updateNetworkBadge)

  elements.clearKeywordsBtn.addEventListener("click", () => {
    state.searchDraft = ""
    state.filters.query = ""
    state.filters.view = "all"
    elements.searchInput.value = ""
    elements.viewFilter.value = "all"
    render()
  })

  elements.showOfflineBtn.addEventListener("click", () => {
    state.searchDraft = ""
    state.filters.query = ""
    state.filters.view = "offline"
    elements.searchInput.value = ""
    elements.viewFilter.value = "offline"
    render()
    setSearchOverlayOpen(false)
  })

  elements.searchSourceBtn.addEventListener("click", () => {
    openRandopitonsSearch(state.searchDraft || state.filters.query)
  })

  elements.searchFab.addEventListener("click", () => {
    setSearchOverlayOpen(true)
  })

  elements.searchBackdrop.addEventListener("click", () => {
    setSearchOverlayOpen(false)
  })

  elements.closeSearchBtn.addEventListener("click", () => {
    setSearchOverlayOpen(false)
  })

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isSearchOpen) {
      setSearchOverlayOpen(false)
    }
  })
}

function ensureInitialSelection() {
  if (state.selectedId && state.trails.some((trail) => trail.id === state.selectedId)) {
    return
  }

  state.selectedId = state.trails[0]?.id || null
}

function render() {
  renderCounters()
  renderActiveSearchSummary()
  renderKeywordChips()
  renderRemoteSuggestions()
  renderTrailList()
  renderDetails()
}

function renderRemoteSuggestions() {
  elements.remoteSearchStatus.textContent = state.remoteSuggestionsStatus
  elements.remoteSuggestions.innerHTML = ""

  if (!state.remoteSuggestions.length) {
    return
  }

  for (const suggestion of state.remoteSuggestions) {
    const row = document.createElement("div")
    row.className = "remote-suggestion"

    const content = document.createElement("div")
    content.className = "remote-suggestion__content"

    const title = document.createElement("span")
    title.className = "remote-suggestion__title"
    title.textContent = suggestion.value

    const meta = document.createElement("span")
    meta.className = "remote-suggestion__meta"
    meta.textContent = suggestion.data?.region || "Randopitons"

    content.append(title, meta)

    const actions = document.createElement("div")
    actions.className = "remote-suggestion__actions"

    const openButton = document.createElement("button")
    openButton.type = "button"
    openButton.className = "remote-suggestion__button"
    openButton.textContent = "Ouvrir"
    openButton.addEventListener("click", () => {
      openRandopitonsUrl(suggestion.data?.url)
    })

    const fillButton = document.createElement("button")
    fillButton.type = "button"
    fillButton.className = "remote-suggestion__button"
    fillButton.textContent = "Filtrer ici"
    fillButton.addEventListener("click", () => {
      state.searchDraft = suggestion.value
      elements.searchInput.value = suggestion.value
      applySearch(suggestion.value)
    })

    const offlineButton = document.createElement("button")
    offlineButton.type = "button"
    offlineButton.className = "remote-suggestion__button"
    offlineButton.textContent = "Ajouter hors ligne"
    offlineButton.addEventListener("click", async () => {
      offlineButton.disabled = true
      offlineButton.textContent = "Import..."

      try {
        await importRemoteSuggestionAsOffline(suggestion)
      } catch {
        window.alert("Impossible d'importer cette fiche Randopitons pour le moment.")
      } finally {
        offlineButton.disabled = false
        offlineButton.textContent = "Ajouter hors ligne"
      }
    })

    actions.append(openButton, fillButton, offlineButton)
    row.append(content, actions)
    elements.remoteSuggestions.appendChild(row)
  }
}

function rebuildTrailIndex() {
  state.trails = [...state.baseTrails, ...state.customTrails]
}

function renderActiveSearchSummary() {
  const parts = []
  if (state.filters.query) {
    parts.push(state.filters.query)
  }
  if (state.filters.view === "offline") {
    parts.push("fiches hors ligne")
  }

  const summary = parts.join(" • ")
  elements.activeSearchSummary.hidden = !summary
  elements.activeSearchText.textContent = summary
  elements.searchFab.textContent = summary ? `Recherche: ${summary}` : "Recherche"
}

function renderCounters() {
  elements.countAll.textContent = String(state.trails.length)
  elements.countFavorites.textContent = String(state.favorites.size)
  elements.countOffline.textContent = String(state.offline.size)
  elements.countTraces.textContent = String(Object.keys(state.traces).length)
}

function updateVersionBadge() {
  elements.versionBadge.textContent = `Version ${state.appVersion}`
}

async function loadAppVersion() {
  try {
    const response = await fetch("../CHANGELOG.md", { cache: "no-cache" })
    if (!response.ok) {
      throw new Error("Changelog indisponible")
    }

    const changelog = await response.text()
    const match = changelog.match(/^## \[(\d+\.\d+\.\d+(?:-[^\]]+)?)\]/m)
    if (!match) {
      throw new Error("Version introuvable")
    }

    state.appVersion = match[1]
    updateVersionBadge()
  } catch {
    state.appVersion = VERSION_FALLBACK
    updateVersionBadge()
  }
}

function getFilteredTrails() {
  return state.trails.filter((trail) => {
    const matchesQuery = matchesTrailQuery(trail)

    const matchesDifficulty = state.filters.difficulty === "all" || trail.difficulty === state.filters.difficulty

    const matchesView = state.filters.view === "all"
      || (state.filters.view === "favorites" && state.favorites.has(trail.id))
      || (state.filters.view === "offline" && state.offline.has(trail.id))
      || (state.filters.view === "with-trace" && Boolean(state.traces[trail.id]))

    return matchesQuery && matchesDifficulty && matchesView
  })
}

function matchesTrailQuery(trail) {
  if (!state.filters.query) {
    return true
  }

  const terms = state.filters.query.split(/\s+/).filter(Boolean)
  if (!terms.length) {
    return true
  }

  const keywordIndex = [
    trail.title,
    trail.area,
    ...(trail.keywords || []),
    ...(trail.highlights || []),
    ...(trail.publicItinerary || [])
  ].join(" ").toLowerCase()

  return terms.every((term) => keywordIndex.includes(term))
}

function renderKeywordChips() {
  const keywords = getPopularKeywords()
  elements.keywordChips.innerHTML = ""

  for (const keyword of keywords) {
    const chip = document.createElement("button")
    chip.type = "button"
    chip.className = "keyword-chip"
    chip.textContent = keyword

    if (state.searchDraft.toLowerCase().split(/\s+/).includes(keyword)) {
      chip.classList.add("is-active")
    }

    chip.addEventListener("click", () => {
      const activeTerms = state.searchDraft.toLowerCase().split(/\s+/).filter(Boolean)
      const nextTerms = activeTerms.includes(keyword)
        ? activeTerms.filter((term) => term !== keyword)
        : [...activeTerms, keyword]

      state.searchDraft = nextTerms.join(" ")
      elements.searchInput.value = state.searchDraft
      applySearch(state.searchDraft)
    })

    elements.keywordChips.appendChild(chip)
  }
}

function setSearchOverlayOpen(isOpen) {
  state.isSearchOpen = isOpen
  elements.searchOverlay.hidden = !isOpen
  elements.searchFab.setAttribute("aria-expanded", String(isOpen))

  if (isOpen) {
    state.searchDraft = state.filters.query
    elements.searchInput.value = state.searchDraft
    state.remoteSuggestions = []
    state.remoteSuggestionsStatus = "Appuyez sur Entrée ou Rechercher"
    renderRemoteSuggestions()
    elements.searchInput.focus()
    elements.searchInput.select()
  }
}

function applySearch(rawQuery) {
  state.filters.query = rawQuery.trim().toLowerCase()
  state.searchDraft = rawQuery.trim().toLowerCase()
  render()
}

function openRandopitonsSearch(rawQuery) {
  const query = rawQuery.trim()
  const searchUrl = query
    ? `${RANDOPITONS_BASE_URL}/recherche?q=${encodeURIComponent(query)}`
    : `${RANDOPITONS_BASE_URL}/recherche`

  window.open(searchUrl, "_blank", "noopener,noreferrer")
}

function openRandopitonsUrl(relativeOrAbsoluteUrl) {
  const url = relativeOrAbsoluteUrl
    ? new URL(relativeOrAbsoluteUrl, RANDOPITONS_BASE_URL).toString()
    : `${RANDOPITONS_BASE_URL}/recherche`

  window.open(url, "_blank", "noopener,noreferrer")
}

async function refreshRemoteSuggestions(rawQuery) {
  const query = rawQuery.trim()
  const requestId = ++state.remoteSearchRequestId

  if (query.length < 2) {
    state.remoteSuggestions = []
    state.remoteSuggestionsStatus = "Saisissez au moins 2 lettres"
    renderRemoteSuggestions()
    return
  }

  state.remoteSuggestionsStatus = "Recherche Randopitons..."
  renderRemoteSuggestions()

  try {
    const suggestions = await fetchRandopitonsSuggestions(query)
    if (requestId !== state.remoteSearchRequestId) {
      return
    }

    state.remoteSuggestions = suggestions.slice(0, 8)
    state.remoteSuggestionsStatus = state.remoteSuggestions.length
      ? `${state.remoteSuggestions.length} suggestion${state.remoteSuggestions.length > 1 ? "s" : ""}`
      : "Aucune suggestion distante"
    renderRemoteSuggestions()
  } catch {
    if (requestId !== state.remoteSearchRequestId) {
      return
    }

    state.remoteSuggestions = []
    state.remoteSuggestionsStatus = "Proxy indisponible"
    renderRemoteSuggestions()
  }
}

async function fetchRandopitonsSuggestions(query) {
  const targetUrl = `${RANDOPITONS_BASE_URL}/recherche/suggestions?query=${encodeURIComponent(query)}`
  const proxyUrl = `${RANDOPITONS_SUGGESTIONS_PROXY}${encodeURIComponent(targetUrl)}`
  const response = await fetch(proxyUrl)

  if (!response.ok) {
    throw new Error("Erreur proxy")
  }

  const payload = await response.json()
  return Array.isArray(payload.suggestions) ? payload.suggestions : []
}

async function importRemoteSuggestionAsOffline(suggestion) {
  const relativeUrl = suggestion?.data?.url
  if (!relativeUrl) {
    throw new Error("Suggestion invalide")
  }

  const sourceUrl = new URL(relativeUrl, RANDOPITONS_BASE_URL).toString()
  const routeKey = getRandopitonsRouteKey(sourceUrl)
  let trail = state.trails.find((item) => getRandopitonsRouteKey(item.sourceUrl) === routeKey)

  if (!trail) {
    trail = await fetchRemoteTrailDetails(suggestion)
    upsertCustomTrail(trail)
  }

  state.selectedId = trail.id
  localStorage.setItem(STORAGE_KEYS.selected, state.selectedId)
  state.offline.add(trail.id)
  storeSet(STORAGE_KEYS.offline, state.offline)
  render()
  await cacheOfflineSelection(trail.id)
}

function upsertCustomTrail(trail) {
  const routeKey = getRandopitonsRouteKey(trail.sourceUrl)
  const existingIndex = state.customTrails.findIndex((item) => (
    item.id === trail.id || getRandopitonsRouteKey(item.sourceUrl) === routeKey
  ))

  if (existingIndex >= 0) {
    state.customTrails[existingIndex] = trail
  } else {
    state.customTrails.unshift(trail)
  }

  localStorage.setItem(STORAGE_KEYS.customTrails, JSON.stringify(state.customTrails))
  rebuildTrailIndex()
}

async function fetchRemoteTrailDetails(suggestion) {
  const relativeUrl = suggestion.data.url
  const sourceUrl = new URL(relativeUrl, RANDOPITONS_BASE_URL).toString()
  const source = new URL(sourceUrl)
  const proxyUrl = `https://r.jina.ai/http://${source.host}${source.pathname}${source.search}`
  const response = await fetch(proxyUrl)

  if (!response.ok) {
    throw new Error("Proxy distant indisponible")
  }

  const markdown = await response.text()
  return buildTrailFromRemoteMarkdown(suggestion, sourceUrl, markdown)
}

function buildTrailFromRemoteMarkdown(suggestion, sourceUrl, markdown) {
  const title = extractRemoteTitle(markdown, suggestion.value)
  const proseLines = extractRemoteProse(markdown)
  const itinerary = proseLines.slice(0, 3)
  const summary = proseLines[0] || `${title} importée depuis Randopitons.`
  const keywords = buildRemoteKeywords(title, suggestion.data?.region, proseLines)
  const routeId = suggestion.data?.url?.split("/").pop() || slugify(title)

  return {
    id: `remote-${routeId}`,
    title,
    sourceUrl,
    area: suggestion.data?.region || "Randopitons",
    difficulty: "À préciser",
    duration: "À préciser",
    distance: "À préciser",
    elevation: "À préciser",
    summary,
    keywords,
    highlights: keywords.slice(0, 3),
    access: proseLines[1] || "Consulter la fiche source Randopitons pour les détails d'accès.",
    offlineChecklist: ["Eau", "Téléphone chargé", "Vérifier météo et accès"],
    vibe: proseLines[2] || "Fiche importée depuis Randopitons",
    publicItinerary: itinerary.length ? itinerary : [summary]
  }
}

function extractRemoteTitle(markdown, fallbackTitle) {
  const titleLine = markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim()
  if (titleLine) {
    return titleLine
  }

  const headingLine = markdown.match(/^#\s+(.+?)\s+—\s+Randopitons$/m)?.[1]?.trim()
  return headingLine || fallbackTitle
}

function extractRemoteProse(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 120)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("*"))
    .filter((line) => !line.startsWith("["))
    .filter((line) => !line.startsWith("!"))
    .filter((line) => !line.startsWith("Title:"))
    .slice(0, 5)
}

function buildRemoteKeywords(title, region, proseLines) {
  const text = [title, region || "", ...proseLines.slice(0, 2)].join(" ")
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4)

  return [...new Set(words)].slice(0, 8)
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getRandopitonsRouteKey(url) {
  if (!url) {
    return ""
  }

  const pathname = new URL(url, RANDOPITONS_BASE_URL).pathname
  const match = pathname.match(/\/randonnee\/(\d+)/)
  return match ? match[1] : pathname
}

function getPopularKeywords() {
  const counts = new Map()

  for (const trail of state.trails) {
    for (const keyword of trail.keywords || []) {
      counts.set(keyword, (counts.get(keyword) || 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "fr"))
    .slice(0, 14)
    .map(([keyword]) => keyword)
}

function renderTrailList() {
  const trails = getFilteredTrails()
  elements.trailList.innerHTML = ""

  if (!trails.length) {
    const empty = document.createElement("div")
    empty.className = "empty-list"
    empty.textContent = "Aucune randonnée ne correspond aux filtres courants."
    elements.trailList.appendChild(empty)

    if (!trails.find((trail) => trail.id === state.selectedId)) {
      renderDetails()
    }
    return
  }

  if (!trails.some((trail) => trail.id === state.selectedId)) {
    state.selectedId = trails[0].id
  }

  for (const trail of trails) {
    const fragment = elements.cardTemplate.content.cloneNode(true)
    const article = fragment.querySelector(".trail-card")
    const button = fragment.querySelector(".trail-card__button")
    const title = fragment.querySelector("h2")
    const difficulty = fragment.querySelector(".pill--difficulty")
    const meta = fragment.querySelector(".trail-card__meta")
    const summary = fragment.querySelector(".trail-card__summary")
    const favoritePill = fragment.querySelector(".pill--favorite")
    const offlinePill = fragment.querySelector(".pill--offline")
    const tracePill = fragment.querySelector(".pill--trace")

    title.textContent = trail.title
    difficulty.textContent = trail.difficulty
    meta.textContent = `${trail.area} • ${trail.duration} • ${trail.distance}`
    summary.textContent = trail.summary
    favoritePill.hidden = !state.favorites.has(trail.id)
    offlinePill.hidden = !state.offline.has(trail.id)
    tracePill.hidden = !state.traces[trail.id]

    if (trail.id === state.selectedId) {
      button.classList.add("is-active")
    }

    button.addEventListener("click", () => {
      state.selectedId = trail.id
      localStorage.setItem(STORAGE_KEYS.selected, state.selectedId)
      renderTrailList()
      renderDetails()
    })

    article.dataset.id = trail.id
    elements.trailList.appendChild(fragment)
  }

  renderDetails()
}

function renderDetails() {
  const trail = state.trails.find((item) => item.id === state.selectedId)

  if (!trail) {
    elements.detailsPanel.innerHTML = '<div class="details__empty"><p>Aucune fiche à afficher.</p></div>'
    return
  }

  const isFavorite = state.favorites.has(trail.id)
  const isOffline = state.offline.has(trail.id)
  const traceInfo = state.traces[trail.id] || null
  const itineraryMode = traceInfo && state.itineraryMode === "map" ? "map" : "text"

  elements.detailsPanel.innerHTML = `
    <div class="details__hero details__hero--compact">
      <div class="detail-tags detail-tags--compact">
        <li>${trail.area}</li>
        <li>${trail.difficulty}</li>
        <li>${isOffline ? "Fiche hors ligne" : "Fiche non sauvegardée"}</li>
        <li>${traceInfo ? "Trace importée" : "Trace non importée"}</li>
      </div>
      <h2>${trail.title}</h2>
      <p class="detail-lead">${trail.summary}</p>
      <div class="detail-actions detail-actions--compact">
        <button type="button" class="action" data-action="favorite">
          ${isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </button>
        <button type="button" class="action action--secondary" data-action="offline">
          ${isOffline ? "Retirer la fiche hors ligne" : "Sauvegarder la fiche hors ligne"}
        </button>
        <a class="action action--ghost" data-action="source" href="${trail.sourceUrl}" target="_blank" rel="noreferrer">Ouvrir la fiche Randopitons</a>
        <button type="button" class="action action--secondary" data-action="import-trace">${traceInfo ? "Remplacer la trace" : "Importer un tracé GPX/KML"}</button>
        <button type="button" class="action action--secondary" data-action="download-trace" ${traceInfo ? "" : "disabled"}>Télécharger la trace locale</button>
        <button type="button" class="action action--secondary" data-action="remove-trace" ${traceInfo ? "" : "disabled"}>Supprimer la trace</button>
      </div>
      <div class="compact-metrics">
        <div class="metric"><strong>${trail.duration}</strong><span>durée</span></div>
        <div class="metric"><strong>${trail.distance}</strong><span>distance</span></div>
        <div class="metric"><strong>${trail.elevation}</strong><span>dénivelé</span></div>
      </div>
    </div>
    <section class="panel panel--itinerary">
      <div class="panel__header panel__header--split">
        <div>
          <h3>Itinéraire</h3>
          <p class="panel__hint">Affichage prioritaire du parcours en texte ou en carte.</p>
        </div>
        <div class="itinerary-switch" role="tablist" aria-label="Mode d'affichage de l'itinéraire">
          <button type="button" class="itinerary-switch__button ${itineraryMode === "text" ? "is-active" : ""}" data-action="itinerary-text" aria-pressed="${itineraryMode === "text"}">Texte</button>
          <button type="button" class="itinerary-switch__button ${itineraryMode === "map" ? "is-active" : ""}" data-action="itinerary-map" aria-pressed="${itineraryMode === "map"}" ${traceInfo ? "" : "disabled"}>Carte</button>
        </div>
      </div>
      <div class="itinerary-stage ${itineraryMode === "map" ? "is-map" : "is-text"}">
        <div class="itinerary-stage__text" ${itineraryMode === "text" ? "" : "hidden"}>
          <ul class="itinerary-steps">${renderItinerary(trail)}</ul>
        </div>
        <div class="itinerary-stage__map" ${itineraryMode === "map" ? "" : "hidden"}>
          <div class="trace-map trace-map--priority" data-trace-map>
            <div class="trace-map__empty">Importez un GPX, KML ou GeoJSON pour afficher la trace ici.</div>
          </div>
        </div>
      </div>
    </section>
    <div class="detail-grid detail-grid--secondary">
      <section class="panel panel--compact">
        <h3>Repères</h3>
        <p>${trail.vibe}</p>
        <div class="detail-tags detail-tags--compact-list">${trail.highlights.map((item) => `<li>${item}</li>`).join("")}</div>
      </section>
      <section class="panel panel--compact">
        <h3>Accès</h3>
        <p class="detail-access">${trail.access}</p>
        <div class="trace-status">
          <p>${formatTraceStatus(traceInfo)}</p>
        </div>
      </section>
      <section class="panel panel--compact">
        <h3>Mots-clés</h3>
        <div class="detail-keywords">${(trail.keywords || []).map((keyword) => `<span>${keyword}</span>`).join("")}</div>
        <h3>Checklist</h3>
        <ul class="checklist">${trail.offlineChecklist.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section class="panel panel--compact">
        <h3>Source</h3>
        <div class="source-note source-note--compact">
          <strong>Connexion requise sur Randopitons</strong>
          <p>La trace protégée reste liée à la connexion sur le site source. Ici, l'itinéraire public reste lisible sans connexion et la trace importée peut être vue sur carte.</p>
        </div>
      </section>
    </div>
  `

  elements.detailsPanel.querySelector('[data-action="favorite"]').addEventListener("click", () => {
    toggleSetValue(state.favorites, trail.id)
    storeSet(STORAGE_KEYS.favorites, state.favorites)
    render()
  })

  elements.detailsPanel.querySelector('[data-action="offline"]').addEventListener("click", async () => {
    toggleSetValue(state.offline, trail.id)
    storeSet(STORAGE_KEYS.offline, state.offline)

    if (state.filters.view === "offline" && !state.offline.has(trail.id)) {
      const remainingOffline = state.trails.filter((item) => state.offline.has(item.id))
      if (!remainingOffline.some((item) => item.id === state.selectedId)) {
        state.selectedId = remainingOffline[0]?.id || null
      }
    }

    render()

    try {
      if (state.offline.has(trail.id)) {
        await cacheOfflineSelection(trail.id)
      } else {
        await removeOfflineSelection(trail.id)
      }
    } catch {
      toggleSetValue(state.offline, trail.id)
      storeSet(STORAGE_KEYS.offline, state.offline)
      render()
    }
  })

  elements.detailsPanel.querySelector('[data-action="import-trace"]').addEventListener("click", async () => {
    const selectedFile = await promptTraceImport()
    if (!selectedFile) {
      return
    }

    try {
      await saveImportedTrace(trail.id, selectedFile)
      render()
    } catch (error) {
      window.alert(error.message)
    }
  })

  elements.detailsPanel.querySelector('[data-action="download-trace"]').addEventListener("click", async () => {
    await downloadImportedTrace(trail.id)
  })

  elements.detailsPanel.querySelector('[data-action="remove-trace"]').addEventListener("click", async () => {
    await removeImportedTrace(trail.id)
    render()
  })

  elements.detailsPanel.querySelector('[data-action="itinerary-text"]').addEventListener("click", () => {
    state.itineraryMode = "text"
    renderDetails()
  })

  elements.detailsPanel.querySelector('[data-action="itinerary-map"]').addEventListener("click", () => {
    if (!traceInfo) {
      return
    }

    state.itineraryMode = "map"
    renderDetails()
  })

  if (itineraryMode === "map") {
    void renderTraceMapForTrail(trail.id)
  }
}

function readStoredList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]")
  } catch {
    return []
  }
}

function storeSet(key, values) {
  localStorage.setItem(key, JSON.stringify([...values]))
}

function storeMap(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function readStoredMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}")
  } catch {
    return {}
  }
}

function toggleSetValue(set, value) {
  if (set.has(value)) {
    set.delete(value)
    return
  }

  set.add(value)
}

function updateNetworkBadge() {
  const online = navigator.onLine
  elements.networkBadge.textContent = online ? "En ligne" : "Mode hors ligne"
  elements.networkBadge.style.background = online ? "rgba(112, 141, 87, 0.18)" : "rgba(201, 111, 59, 0.22)"
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return
  }

  try {
    let hasRefreshedForNewWorker = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasRefreshedForNewWorker) {
        return
      }

      hasRefreshedForNewWorker = true
      window.location.reload()
    })

    const registration = await navigator.serviceWorker.register("sw.js", {
      updateViaCache: "none"
    })

    await registration.update()
  } catch {
    elements.networkBadge.textContent = "SW indisponible"
  }
}

async function cacheOfflineSelection(trailId) {
  if (!("caches" in window)) {
    return
  }

  const cache = await caches.open(USER_CACHE_NAME)
  const payload = state.trails.find((trail) => trail.id === trailId)

  if (!payload) {
    return
  }

  await cache.put(
    new Request(`offline-trail:${trailId}`),
    new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" }
    })
  )
}

async function removeOfflineSelection(trailId) {
  if (!("caches" in window)) {
    return
  }

  const cache = await caches.open(USER_CACHE_NAME)
  await cache.delete(new Request(`offline-trail:${trailId}`))
}

function promptTraceImport() {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".gpx,.kml,.geojson,.json,.xml"
    input.addEventListener("change", () => {
      resolve(input.files?.[0] || null)
    }, { once: true })
    input.click()
  })
}

async function saveImportedTrace(trailId, file) {
  const text = await file.text()
  const parsedTrace = parseTraceDocument(text, file.name)
  const traceInfo = {
    name: file.name,
    size: file.size,
    type: file.type || guessTraceType(file.name),
    importedAt: new Date().toISOString(),
    pointCount: parsedTrace.coordinates.length,
    format: parsedTrace.format,
    bounds: parsedTrace.bounds
  }

  state.traces[trailId] = traceInfo
  storeMap(STORAGE_KEYS.traces, state.traces)

  if ("caches" in window) {
    const cache = await caches.open(USER_CACHE_NAME)
    await cache.put(
      new Request(`imported-trace:${trailId}`),
      new Response(text, {
        headers: {
          "Content-Type": traceInfo.type,
          "X-Trace-File-Name": encodeURIComponent(traceInfo.name)
        }
      })
    )

    await cache.put(
      new Request(`parsed-trace:${trailId}`),
      new Response(JSON.stringify(parsedTrace), {
        headers: { "Content-Type": "application/json" }
      })
    )
  }
}

async function removeImportedTrace(trailId) {
  delete state.traces[trailId]
  storeMap(STORAGE_KEYS.traces, state.traces)

  if (!("caches" in window)) {
    return
  }

  const cache = await caches.open(USER_CACHE_NAME)
  await cache.delete(new Request(`imported-trace:${trailId}`))
  await cache.delete(new Request(`parsed-trace:${trailId}`))
}

async function downloadImportedTrace(trailId) {
  const traceInfo = state.traces[trailId]
  if (!traceInfo || !("caches" in window)) {
    return
  }

  const cache = await caches.open(USER_CACHE_NAME)
  const response = await cache.match(new Request(`imported-trace:${trailId}`))
  if (!response) {
    return
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = traceInfo.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatTraceStatus(traceInfo) {
  if (!traceInfo) {
    return "Aucune trace importée. Après connexion sur Randopitons, téléchargez le fichier GPX/KML puis importez-le ici."
  }

  const importedDate = new Date(traceInfo.importedAt).toLocaleString("fr-FR")
  const sizeKb = Math.max(1, Math.round(traceInfo.size / 1024))
  const pointCount = traceInfo.pointCount ? ` • ${traceInfo.pointCount} points` : ""
  const format = traceInfo.format ? ` • ${traceInfo.format}` : ""
  return `Trace locale: ${traceInfo.name} • ${sizeKb} Ko${pointCount}${format} • importée le ${importedDate}`
}

function renderItinerary(trail) {
  const steps = Array.isArray(trail.publicItinerary) && trail.publicItinerary.length
    ? trail.publicItinerary
    : [trail.summary, trail.access]

  return steps.map((step) => `<li>${step}</li>`).join("")
}

function guessTraceType(fileName) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".gpx") || lower.endsWith(".xml")) {
    return "application/gpx+xml"
  }
  if (lower.endsWith(".kml")) {
    return "application/vnd.google-earth.kml+xml"
  }
  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    return "application/geo+json"
  }
  return "application/octet-stream"
}

async function renderTraceMapForTrail(trailId) {
  const container = elements.detailsPanel.querySelector("[data-trace-map]")
  const traceInfo = state.traces[trailId]

  if (!container) {
    return
  }

  if (!traceInfo) {
    container.innerHTML = '<div class="trace-map__empty">Importez un GPX, KML ou GeoJSON pour afficher la trace ici.</div>'
    return
  }

  const parsedTrace = await loadParsedTrace(trailId)

  if (state.selectedId !== trailId) {
    return
  }

  if (!parsedTrace || !Array.isArray(parsedTrace.coordinates) || parsedTrace.coordinates.length < 2) {
    container.innerHTML = '<div class="trace-map__empty">La trace a été importée, mais aucun segment exploitable n\'a pu être affiché.</div>'
    return
  }

  const svgMarkup = buildTraceSvg(parsedTrace)
  const bounds = parsedTrace.bounds
  container.innerHTML = `
    <div class="trace-map__frame">
      <div class="trace-map__meta">
        <span>${traceInfo.format || "Trace"}</span>
        <span>${parsedTrace.coordinates.length} points</span>
      </div>
      ${svgMarkup}
      <div class="trace-map__legend">
        <span>Ouest ${bounds.minLon.toFixed(4)}</span>
        <span>Est ${bounds.maxLon.toFixed(4)}</span>
        <span>Sud ${bounds.minLat.toFixed(4)}</span>
        <span>Nord ${bounds.maxLat.toFixed(4)}</span>
      </div>
    </div>
  `
}

async function loadParsedTrace(trailId) {
  if (!("caches" in window)) {
    return null
  }

  const cache = await caches.open(USER_CACHE_NAME)
  const response = await cache.match(new Request(`parsed-trace:${trailId}`))
  if (!response) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

function parseTraceDocument(text, fileName) {
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    return parseGeoJsonTrace(text)
  }

  const xml = new DOMParser().parseFromString(text, "application/xml")
  const parserError = xml.querySelector("parsererror")
  if (parserError) {
    throw new Error("Le fichier de trace n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un GPX, KML ou GeoJSON valide.")
  }

  if (lower.endsWith(".kml")) {
    return parseKmlTrace(xml)
  }

  return parseGpxTrace(xml)
}

function parseGeoJsonTrace(text) {
  const geoJson = JSON.parse(text)
  const coordinates = collectGeoJsonCoordinates(geoJson)
  return buildParsedTrace(coordinates, "GeoJSON")
}

function parseGpxTrace(xml) {
  const trackPoints = [...xml.querySelectorAll("trkpt, rtept")]
    .map((point) => [Number(point.getAttribute("lon")), Number(point.getAttribute("lat"))])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))

  return buildParsedTrace(trackPoints, "GPX")
}

function parseKmlTrace(xml) {
  const lineStrings = [...xml.querySelectorAll("LineString coordinates")]
  const gxTracks = [...xml.querySelectorAll("gx\\:coord, coord")]
  const coordinates = []

  for (const lineString of lineStrings) {
    const values = lineString.textContent.trim().split(/\s+/)
    for (const value of values) {
      const [lon, lat] = value.split(",").map(Number)
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        coordinates.push([lon, lat])
      }
    }
  }

  for (const coord of gxTracks) {
    const [lon, lat] = coord.textContent.trim().split(/\s+/).map(Number)
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      coordinates.push([lon, lat])
    }
  }

  return buildParsedTrace(coordinates, "KML")
}

function collectGeoJsonCoordinates(node) {
  if (!node) {
    return []
  }

  if (node.type === "FeatureCollection") {
    return node.features.flatMap((feature) => collectGeoJsonCoordinates(feature))
  }

  if (node.type === "Feature") {
    return collectGeoJsonCoordinates(node.geometry)
  }

  if (node.type === "LineString") {
    return node.coordinates.map(([lon, lat]) => [Number(lon), Number(lat)])
  }

  if (node.type === "MultiLineString") {
    return node.coordinates.flat().map(([lon, lat]) => [Number(lon), Number(lat)])
  }

  if (node.type === "GeometryCollection") {
    return node.geometries.flatMap((geometry) => collectGeoJsonCoordinates(geometry))
  }

  return []
}

function buildParsedTrace(coordinates, format) {
  const validCoordinates = coordinates.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
  if (validCoordinates.length < 2) {
    throw new Error("La trace importée ne contient pas assez de points exploitables pour afficher une carte.")
  }

  const bounds = validCoordinates.reduce((accumulator, [lon, lat]) => ({
    minLon: Math.min(accumulator.minLon, lon),
    maxLon: Math.max(accumulator.maxLon, lon),
    minLat: Math.min(accumulator.minLat, lat),
    maxLat: Math.max(accumulator.maxLat, lat)
  }), {
    minLon: Infinity,
    maxLon: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity
  })

  return {
    format,
    coordinates: validCoordinates,
    bounds
  }
}

function buildTraceSvg(parsedTrace) {
  const width = 560
  const height = 320
  const padding = 26
  const { minLon, maxLon, minLat, maxLat } = parsedTrace.bounds
  const lonSpan = Math.max(maxLon - minLon, 0.0001)
  const latSpan = Math.max(maxLat - minLat, 0.0001)
  const points = parsedTrace.coordinates.map(([lon, lat]) => {
    const x = padding + ((lon - minLon) / lonSpan) * (width - padding * 2)
    const y = height - padding - ((lat - minLat) / latSpan) * (height - padding * 2)
    return [x, y]
  })

  const polyline = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")
  const [startX, startY] = points[0]
  const [endX, endY] = points[points.length - 1]

  return `
    <svg class="trace-map__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Carte simplifiée de la trace importée">
      <defs>
        <linearGradient id="traceGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#c96f3b"></stop>
          <stop offset="100%" stop-color="#17322c"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="22" fill="#eef4ea"></rect>
      <g stroke="rgba(23, 50, 44, 0.12)" stroke-width="1">
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"></line>
        <line x1="${width / 2}" y1="${padding}" x2="${width / 2}" y2="${height - padding}"></line>
        <line x1="${width - padding}" y1="${padding}" x2="${width - padding}" y2="${height - padding}"></line>
        <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}"></line>
        <line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}"></line>
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
      </g>
      <polyline points="${polyline}" fill="none" stroke="url(#traceGradient)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <circle cx="${startX.toFixed(2)}" cy="${startY.toFixed(2)}" r="6" fill="#708d57"></circle>
      <circle cx="${endX.toFixed(2)}" cy="${endY.toFixed(2)}" r="6" fill="#c96f3b"></circle>
    </svg>
  `
}
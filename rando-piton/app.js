const STORAGE_KEYS = {
  favorites: "rando-piton:favorites",
  offline: "rando-piton:offline",
  selected: "rando-piton:selected",
  traces: "rando-piton:traces"
}

const USER_CACHE_NAME = "rando-piton-user-offline-v1"

const state = {
  trails: window.RANDO_PITON_DATA || [],
  favorites: new Set(readStoredList(STORAGE_KEYS.favorites)),
  offline: new Set(readStoredList(STORAGE_KEYS.offline)),
  traces: readStoredMap(STORAGE_KEYS.traces),
  selectedId: localStorage.getItem(STORAGE_KEYS.selected) || null,
  filters: {
    query: "",
    searchMode: "keywords",
    difficulty: "all",
    view: "all"
  }
}

const elements = {
  trailList: document.getElementById("trailList"),
  detailsPanel: document.getElementById("detailsPanel"),
  searchInput: document.getElementById("searchInput"),
  searchModeFilter: document.getElementById("searchModeFilter"),
  difficultyFilter: document.getElementById("difficultyFilter"),
  viewFilter: document.getElementById("viewFilter"),
  clearKeywordsBtn: document.getElementById("clearKeywordsBtn"),
  keywordChips: document.getElementById("keywordChips"),
  cardTemplate: document.getElementById("trailCardTemplate"),
  countAll: document.getElementById("countAll"),
  countFavorites: document.getElementById("countFavorites"),
  countOffline: document.getElementById("countOffline"),
  countTraces: document.getElementById("countTraces"),
  networkBadge: document.getElementById("networkBadge")
}

initialize()

function initialize() {
  bindEvents()
  ensureInitialSelection()
  updateNetworkBadge()
  render()
  registerServiceWorker()
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim().toLowerCase()
    renderTrailList()
    renderKeywordChips()
  })

  elements.searchModeFilter.addEventListener("change", (event) => {
    state.filters.searchMode = event.target.value
    elements.searchInput.placeholder = state.filters.searchMode === "keywords"
      ? "Un ou plusieurs mots-clés..."
      : "Nom, secteur, ambiance, itinéraire..."
    renderTrailList()
    renderKeywordChips()
  })

  elements.difficultyFilter.addEventListener("change", (event) => {
    state.filters.difficulty = event.target.value
    renderTrailList()
  })

  elements.viewFilter.addEventListener("change", (event) => {
    state.filters.view = event.target.value
    renderTrailList()
  })

  window.addEventListener("online", updateNetworkBadge)
  window.addEventListener("offline", updateNetworkBadge)

  elements.clearKeywordsBtn.addEventListener("click", () => {
    state.filters.query = ""
    elements.searchInput.value = ""
    renderTrailList()
    renderKeywordChips()
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
  renderKeywordChips()
  renderTrailList()
  renderDetails()
}

function renderCounters() {
  elements.countAll.textContent = String(state.trails.length)
  elements.countFavorites.textContent = String(state.favorites.size)
  elements.countOffline.textContent = String(state.offline.size)
  elements.countTraces.textContent = String(Object.keys(state.traces).length)
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
    ...(trail.keywords || []),
    ...(trail.highlights || []),
    ...(trail.publicItinerary || [])
  ].join(" ").toLowerCase()

  const freeTextIndex = [
    trail.title,
    trail.area,
    trail.summary,
    trail.vibe,
    trail.access,
    ...(trail.keywords || []),
    ...(trail.highlights || []),
    ...(trail.publicItinerary || [])
  ].join(" ").toLowerCase()

  const haystack = state.filters.searchMode === "keywords" ? keywordIndex : freeTextIndex
  return terms.every((term) => haystack.includes(term))
}

function renderKeywordChips() {
  const keywords = getPopularKeywords()
  elements.keywordChips.innerHTML = ""

  for (const keyword of keywords) {
    const chip = document.createElement("button")
    chip.type = "button"
    chip.className = "keyword-chip"
    chip.textContent = keyword

    if (state.filters.query.split(/\s+/).includes(keyword)) {
      chip.classList.add("is-active")
    }

    chip.addEventListener("click", () => {
      const activeTerms = state.filters.query.split(/\s+/).filter(Boolean)
      const nextTerms = activeTerms.includes(keyword)
        ? activeTerms.filter((term) => term !== keyword)
        : [...activeTerms, keyword]

      state.filters.searchMode = "keywords"
      elements.searchModeFilter.value = "keywords"
      state.filters.query = nextTerms.join(" ")
      elements.searchInput.value = state.filters.query
      elements.searchInput.placeholder = "Un ou plusieurs mots-clés..."
      renderTrailList()
      renderKeywordChips()
    })

    elements.keywordChips.appendChild(chip)
  }
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

  elements.detailsPanel.innerHTML = `
    <div class="details__hero">
      <div class="detail-tags">
        <li>${trail.area}</li>
        <li>${trail.difficulty}</li>
        <li>${isOffline ? "Fiche hors ligne" : "Fiche non sauvegardée"}</li>
        <li>${traceInfo ? "Trace importée" : "Trace non importée"}</li>
      </div>
      <h2>${trail.title}</h2>
      <p class="detail-lead">${trail.summary}</p>
      <div class="detail-actions">
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
      <div class="source-note">
        <strong>Connexion requise sur Randopitons</strong>
        <p>La page source affiche explicitement qu'il faut être connecté pour télécharger les traces. Cette app ne peut pas réutiliser automatiquement cette session distante. Le flux prévu est donc: ouvrir la fiche Randopitons, se connecter, télécharger le GPX/KML, puis l'importer ici pour l'avoir hors ligne.</p>
      </div>
    </div>
    <div class="detail-grid">
      <section class="panel">
        <h3>Repères</h3>
        <div class="detail-metrics">
          <div class="metric"><strong>${trail.duration}</strong><span>durée</span></div>
          <div class="metric"><strong>${trail.distance}</strong><span>distance</span></div>
          <div class="metric"><strong>${trail.elevation}</strong><span>dénivelé</span></div>
        </div>
        <h3>Ambiance</h3>
        <p>${trail.vibe}</p>
        <h3>Temps forts</h3>
        <ul class="detail-tags">${trail.highlights.map((item) => `<li>${item}</li>`).join("")}</ul>
        <h3>Mots-clés</h3>
        <div class="detail-keywords">${(trail.keywords || []).map((keyword) => `<span>${keyword}</span>`).join("")}</div>
        <h3>Itinéraire public</h3>
        <ul class="itinerary-steps">${renderItinerary(trail)}</ul>
      </section>
      <section class="panel">
        <h3>Accès</h3>
        <p class="detail-access">${trail.access}</p>
        <h3>Checklist hors ligne</h3>
        <ul class="checklist">${trail.offlineChecklist.map((item) => `<li>${item}</li>`).join("")}</ul>
        <div class="trace-status">
          <p>${formatTraceStatus(traceInfo)}</p>
        </div>
        <h3>Carte de la trace</h3>
        <div class="trace-map" data-trace-map>
          <div class="trace-map__empty">Importez un GPX, KML ou GeoJSON pour afficher la trace ici.</div>
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

    if (state.offline.has(trail.id)) {
      await cacheOfflineSelection(trail.id)
    } else {
      await removeOfflineSelection(trail.id)
    }

    render()
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

  void renderTraceMapForTrail(trail.id)
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
    await navigator.serviceWorker.register("sw.js")
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
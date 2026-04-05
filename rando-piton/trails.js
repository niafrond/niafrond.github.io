// Gestion de l'index des randonnées et import depuis Randopitons

function rebuildTrailIndex() {
  const customIds = new Set(state.customTrails.map((t) => t.id))
  state.trails = [
    ...state.baseTrails.filter((t) => !customIds.has(t.id)),
    ...state.customTrails
  ]
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

async function selectAndSaveOffline(trail) {
  state.selectedId = trail.id
  localStorage.setItem(STORAGE_KEYS.selected, state.selectedId)
  state.offline.add(trail.id)
  storeSet(STORAGE_KEYS.offline, state.offline)
  render()
  await cacheOfflineSelection(trail.id)
}

async function importRemoteSuggestionAsOffline(suggestion) {
  const relativeUrl = suggestion?.data?.url
  if (!relativeUrl) throw new Error("Suggestion invalide")

  const sourceUrl = new URL(relativeUrl, RANDOPITONS_BASE_URL).toString()
  const routeKey = getRandopitonsRouteKey(sourceUrl)
  let trail = state.trails.find((item) => getRandopitonsRouteKey(item.sourceUrl) === routeKey)

  if (!trail) {
    trail = await fetchRemoteTrailDetails(suggestion)
    upsertCustomTrail(trail)
  }

  await selectAndSaveOffline(trail)
}

async function importTrailFromUrl(rawUrl) {
  const trail = await fetchTrailFromUrl(rawUrl)
  const routeKey = getRandopitonsRouteKey(trail.sourceUrl)
  const existing = state.trails.find((item) => getRandopitonsRouteKey(item.sourceUrl) === routeKey)

  if (existing) {
    state.selectedId = existing.id
    localStorage.setItem(STORAGE_KEYS.selected, state.selectedId)
    render()
    return
  }

  upsertCustomTrail(trail)
  await selectAndSaveOffline(trail)
}

// ─── Construction d'une fiche depuis le HTML brut ────────────────────────────

function buildTrailFromRemoteHTML(suggestion, sourceUrl, html) {
  const doc = new DOMParser().parseFromString(html, "text/html")

  const h1Text = doc.querySelector("h1")?.textContent?.trim() || ""
  const titleTag = (doc.querySelector("title")?.textContent?.trim() || "")
    .replace(/\s*[—–-]\s*Randopitons.*$/i, "").trim()
  const title = h1Text || titleTag || suggestion.value

  const proseLines = Array.from(doc.querySelectorAll("p"))
    .map((el) => el.textContent.trim())
    .filter((line) => line.length > 80)
    .slice(0, 5)

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
  if (!url) return ""
  try {
    const pathname = new URL(url, RANDOPITONS_BASE_URL).pathname
    const match = pathname.match(/\/randonnee\/(\d+)/)
    return match ? match[1] : pathname
  } catch {
    return ""
  }
}


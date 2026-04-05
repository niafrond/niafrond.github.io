// Gestion de l'index des randonnées et import depuis Randopitons

// ─── Normalisation depuis le catalogue JSON ───────────────────────────────────
// Convertit une entrée du catalogue (format léger) vers le format complet de l'app.

function normalizeCatalogueEntry(entry) {
  const id = String(entry.id)
  const title = entry.title || ""
  const area = entry.area || entry.regionGroup || "Réunion"
  const regionGroup = entry.regionGroup || ""
  const type = entry.type || "Randonnée"
  const difficulty = entry.difficulty || "À préciser"

  const keywords = [title, area, regionGroup, type]
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)

  const uniqueKeywords = [...new Set(keywords)].slice(0, 8)

  const distanceStr = entry.distance || "À préciser"
  const elevationStr = entry.elevation || "À préciser"
  const summary = `${type} de ${distanceStr} — ${elevationStr} de dénivelé en ${area}.`

  return {
    id,
    title,
    sourceUrl: entry.sourceUrl || `${RANDOPITONS_BASE_URL}/randonnee/${entry.id}`,
    area,
    regionGroup,
    difficulty,
    type,
    confidence: entry.confidence || "",
    duration: entry.duration || "À préciser",
    distance: distanceStr,
    distanceM: entry.distanceM,
    elevation: elevationStr,
    elevationM: entry.elevationM,
    summary,
    keywords: uniqueKeywords,
    highlights: [],
    access: "Voir la fiche complète sur Randopitons pour les détails d'accès.",
    offlineChecklist: ["Eau", "Téléphone chargé", "Vérifier météo"],
    vibe: `${type} — ${regionGroup || area}`,
    publicItinerary: ["Voir la fiche complète sur Randopitons pour l'itinéraire détaillé."]
  }
}

function rebuildTrailIndex() {
  state.trails = [...state.baseTrails, ...state.customTrails]
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

  state.selectedId = trail.id
  localStorage.setItem(STORAGE_KEYS.selected, state.selectedId)
  state.offline.add(trail.id)
  storeSet(STORAGE_KEYS.offline, state.offline)
  render()
  await cacheOfflineSelection(trail.id)
}

// ─── Construction d'une fiche depuis le markdown Jina ────────────────────────

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
  if (titleLine) return titleLine

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
  if (!url) return ""
  try {
    const pathname = new URL(url, RANDOPITONS_BASE_URL).pathname
    const match = pathname.match(/\/randonnee\/(\d+)/)
    return match ? match[1] : pathname
  } catch {
    return ""
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

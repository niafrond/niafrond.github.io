// Appels réseau vers l'API Randopitons et services tiers

// ─── Version de l'app ────────────────────────────────────────────────────────

async function loadAppVersion() {
  try {
    const response = await fetch("../CHANGELOG.md", { cache: "no-cache" })
    if (!response.ok) throw new Error("Changelog indisponible")
    const changelog = await response.text()
    const match = changelog.match(/^## \[(\d+\.\d+\.\d+(?:-[^\]]+)?)\]/m)
    if (!match) throw new Error("Version introuvable")
    state.appVersion = match[1]
    updateVersionBadge()
  } catch {
    state.appVersion = VERSION_FALLBACK
    updateVersionBadge()
  }
}

// ─── Suggestions de recherche ────────────────────────────────────────────────

async function fetchRandopitonsSuggestions(query) {
  const targetUrl = `${RANDOPITONS_BASE_URL}/recherche/suggestions?query=${encodeURIComponent(query)}`
  const proxyUrl = `${RANDOPITONS_SUGGESTIONS_PROXY}${encodeURIComponent(targetUrl)}`
  const response = await fetch(proxyUrl)

  if (!response.ok) throw new Error("Erreur proxy")

  const payload = await response.json()
  return Array.isArray(payload.suggestions) ? payload.suggestions : []
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
    if (requestId !== state.remoteSearchRequestId) return

    state.remoteSuggestions = suggestions.slice(0, 8)
    state.remoteSuggestionsStatus = state.remoteSuggestions.length
      ? `${state.remoteSuggestions.length} suggestion${state.remoteSuggestions.length > 1 ? "s" : ""}`
      : "Aucune suggestion distante"
    renderRemoteSuggestions()
  } catch {
    if (requestId !== state.remoteSearchRequestId) return
    state.remoteSuggestions = []
    state.remoteSuggestionsStatus = "Proxy indisponible"
    renderRemoteSuggestions()
  }
}

// ─── Détail d'une fiche distante via Jina reader ─────────────────────────────

async function fetchRemoteTrailDetails(suggestion) {
  const relativeUrl = suggestion.data.url
  const sourceUrl = new URL(relativeUrl, RANDOPITONS_BASE_URL).toString()
  const source = new URL(sourceUrl)
  const proxyUrl = `https://r.jina.ai/http://${source.host}${source.pathname}${source.search}`
  const response = await fetch(proxyUrl)

  if (!response.ok) throw new Error("Proxy distant indisponible")

  const markdown = await response.text()
  return buildTrailFromRemoteMarkdown(suggestion, sourceUrl, markdown)
}

// Pas de catalogue JSON local: les résultats en ligne proviennent des appels API
// Randopitons, et le mode hors ligne s'appuie sur les fiches déjà stockées localement.

// ─── Recherche live Randopitons si aucun résultat local ──────────────────────
// Appelé par renderTrailList quand getFilteredTrails() retourne 0 avec une query.
// Interroge l'API suggestions via le proxy allorigins et peuple state.liveResults.

async function searchLiveIfNeeded(query) {
  if (!navigator.onLine) {
    state.liveResultsStatus = "Hors ligne — seules les fiches déjà stockées localement sont disponibles"
    renderTrailList()
    return
  }

  if (query.length < 2) return
  if (state.liveResultsQuery === query) return

  const requestId = ++state.remoteSearchRequestId
  state.liveResultsQuery = query
  state.liveResultsStatus = "Recherche sur Randopitons..."
  state.liveResults = []
  renderTrailList()

  try {
    const suggestions = await fetchRandopitonsSuggestions(query)
    if (requestId !== state.remoteSearchRequestId) return

    state.liveResults = suggestions.slice(0, 12).map((s) => ({
      id: `live-${s.data?.url?.split("/").pop() || slugify(s.value)}`,
      title: s.value,
      sourceUrl: new URL(s.data?.url || "", RANDOPITONS_BASE_URL).toString(),
      area: s.data?.region || "Randopitons",
      regionGroup: s.data?.region || "",
      difficulty: "À préciser",
      duration: "À préciser",
      distance: "À préciser",
      elevation: "À préciser",
      summary: `${s.value} — ${s.data?.region || "Réunion"}`,
      keywords: buildRemoteKeywords(s.value, s.data?.region, []),
      highlights: [],
      access: "Voir la fiche complète sur Randopitons.",
      offlineChecklist: ["Eau", "Téléphone chargé", "Vérifier météo"],
      vibe: "Résultat de recherche Randopitons",
      publicItinerary: [`Résultat de recherche Randopitons pour «\u00a0${query}\u00a0».`],
      isLiveResult: true
    }))

    state.liveResultsStatus = state.liveResults.length
      ? `${state.liveResults.length} résultat${state.liveResults.length > 1 ? "s" : ""} sur Randopitons`
      : "Aucun résultat sur Randopitons"
    renderTrailList()
  } catch {
    if (requestId !== state.remoteSearchRequestId) return
    state.liveResults = []
    state.liveResultsStatus = "Recherche Randopitons indisponible"
    renderTrailList()
  }
}

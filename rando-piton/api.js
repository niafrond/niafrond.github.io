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

// ─── Actualisation périodique des fiches de base ─────────────────────────────
// Interroge plusieurs termes représentatifs pour constituer une liste de base
// vivante. Le résultat est mis en cache localStorage pour BASE_TRAILS_CACHE_TTL_MS.

const BASE_QUERIES = [
  "piton", "cirque", "cascade", "mafate", "cilaos", "salazie",
  "rempart", "grand bassin", "belouve", "maido"
]

async function fetchRandopitonsBaseTrails() {
  const seen = new Set()
  const results = []

  for (const query of BASE_QUERIES) {
    try {
      const suggestions = await fetchRandopitonsSuggestions(query)
      for (const s of suggestions) {
        const routeKey = getRandopitonsRouteKey(new URL(s.data?.url || "", RANDOPITONS_BASE_URL).toString())
        if (routeKey && !seen.has(routeKey)) {
          seen.add(routeKey)
          results.push({
            id: `remote-${s.data?.url?.split("/").pop() || slugify(s.value)}`,
            title: s.value,
            sourceUrl: new URL(s.data?.url || "", RANDOPITONS_BASE_URL).toString(),
            area: s.data?.region || "Randopitons",
            difficulty: "À préciser",
            duration: "À préciser",
            distance: "À préciser",
            elevation: "À préciser",
            summary: `${s.value} — ${s.data?.region || "Réunion"}`,
            keywords: buildRemoteKeywords(s.value, s.data?.region, []),
            highlights: [],
            access: "Ouvrir la fiche Randopitons pour les détails d'accès.",
            offlineChecklist: ["Eau", "Téléphone chargé", "Vérifier météo"],
            vibe: "Fiche Randopitons",
            publicItinerary: [`Fiche importée en temps réel depuis Randopitons — ${s.value}.`]
          })
        }
      }
    } catch {
      // Continuer si une requête échoue
    }
  }

  return results
}

async function refreshBaseTrailsIfNeeded() {
  if (!navigator.onLine) return

  const tsStr = localStorage.getItem(STORAGE_KEYS.baseTrailsTimestamp)
  const ts = tsStr ? Number(tsStr) : 0
  if (Date.now() - ts < BASE_TRAILS_CACHE_TTL_MS) return

  try {
    const fetched = await fetchRandopitonsBaseTrails()
    if (!fetched.length) return

    // Fusionner avec les fiches par défaut pour conserver les descriptions enrichies
    const defaultIds = new Set(DEFAULT_BASE_TRAILS.map((t) => getRandopitonsRouteKey(t.sourceUrl)))
    const newTrails = [
      ...DEFAULT_BASE_TRAILS,
      ...fetched.filter((t) => !defaultIds.has(getRandopitonsRouteKey(t.sourceUrl)))
    ]

    localStorage.setItem(STORAGE_KEYS.baseTrails, JSON.stringify(newTrails))
    localStorage.setItem(STORAGE_KEYS.baseTrailsTimestamp, String(Date.now()))

    state.baseTrails = newTrails
    rebuildTrailIndex()
    render()
  } catch {
    // Silencieux — les fiches de secours restent actives
  }
}

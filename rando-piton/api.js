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

// ─── Détail d'une fiche distante via proxy allorigins ────────────────────────

async function fetchRemoteTrailDetails(suggestion) {
  const relativeUrl = suggestion.data.url
  const sourceUrl = new URL(relativeUrl, RANDOPITONS_BASE_URL).toString()
  const proxyUrl = `${RANDOPITONS_SUGGESTIONS_PROXY}${encodeURIComponent(sourceUrl)}`
  let response
  try {
    response = await fetch(proxyUrl)
  } catch {
    throw new Error("Impossible de récupérer la fiche (vérifiez votre connexion)")
  }

  if (!response.ok) throw new Error("Proxy distant indisponible")

  const html = await response.text()
  return buildTrailFromRemoteHTML(suggestion, sourceUrl, html)
}

// Pas de catalogue JSON local: les fiches proviennent de l'import via URL
// Randopitons, et le mode hors ligne s'appuie sur les fiches déjà stockées localement.

// ─── Import direct depuis une URL Randopitons ─────────────────────────────────

async function fetchTrailFromUrl(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("URL invalide")
  }

  if (!url.hostname.includes("randopitons.re")) {
    throw new Error("Veuillez saisir un lien randopitons.re")
  }

  const relativeUrl = url.pathname + url.search
  const mockSuggestion = {
    value: "",
    data: { url: relativeUrl, region: "" }
  }
  return fetchRemoteTrailDetails(mockSuggestion)
}

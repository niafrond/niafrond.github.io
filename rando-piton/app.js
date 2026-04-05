// Point d'entree de l'application - orchestre initialisation et evenements

function initialize() {
  rebuildTrailIndex()
  initAuth()
  bindEvents()
  ensureInitialSelection()
  updateNetworkBadge()
  updateVersionBadge()
  render()
  void loadAppVersion()
  void loadCatalogue()
  registerServiceWorker()
}

function ensureInitialSelection() {
  if (state.selectedId && state.trails.some((trail) => trail.id === state.selectedId)) return
  state.selectedId = state.trails[0]?.id || null
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchDraft = event.target.value
    renderKeywordChips()
    state.remoteSuggestions = []
    state.remoteSuggestionsStatus = "Appuyez sur Entree ou Rechercher"
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

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return

  try {
    let hasRefreshedForNewWorker = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasRefreshedForNewWorker) return
      hasRefreshedForNewWorker = true
      window.location.reload()
    })

    const registration = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    await registration.update()
  } catch {
    elements.networkBadge.textContent = "SW indisponible"
  }
}

async function cacheOfflineSelection(trailId) {
  if (!("caches" in window)) return

  const cache = await caches.open(USER_CACHE_NAME)
  const payload = state.trails.find((trail) => trail.id === trailId)
  if (!payload) return

  await cache.put(
    new Request(`offline-trail:${trailId}`),
    new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" }
    })
  )
}

async function removeOfflineSelection(trailId) {
  if (!("caches" in window)) return
  const cache = await caches.open(USER_CACHE_NAME)
  await cache.delete(new Request(`offline-trail:${trailId}`))
}

initialize()

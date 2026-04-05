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
  void restoreOfflineTrailsFromCache()
  registerServiceWorker()
}

function ensureInitialSelection() {
  if (state.selectedId && state.trails.some((trail) => trail.id === state.selectedId)) return
  state.selectedId = state.trails[0]?.id || null
}

function bindEvents() {
  elements.urlImportForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    const rawUrl = elements.urlInput.value.trim()
    if (!rawUrl) return

    const submitBtn = elements.urlImportForm.querySelector('[type="submit"]')
    submitBtn.disabled = true
    submitBtn.textContent = "Import…"
    elements.urlImportStatus.textContent = "Récupération de la fiche en cours…"

    try {
      await importTrailFromUrl(rawUrl)
      elements.urlInput.value = ""
      elements.urlImportStatus.textContent = "Fiche importée et sauvegardée hors ligne."
      setSearchOverlayOpen(false)
    } catch (error) {
      elements.urlImportStatus.textContent = error.message || "Impossible d'importer cette fiche."
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = "Importer"
    }
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

  elements.clearFiltersBtn.addEventListener("click", () => {
    state.filters.view = "all"
    state.filters.difficulty = "all"
    elements.viewFilter.value = "all"
    elements.difficultyFilter.value = "all"
    render()
  })

  elements.showOfflineBtn.addEventListener("click", () => {
    state.filters.view = "offline"
    elements.viewFilter.value = "offline"
    render()
    setSearchOverlayOpen(false)
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

async function restoreOfflineTrailsFromCache() {
  if (!("caches" in window)) return

  const missingIds = [...state.offline].filter(
    (id) => !state.trails.some((trail) => trail.id === id)
  )
  if (!missingIds.length) return

  const cache = await caches.open(USER_CACHE_NAME)
  let restored = false

  for (const trailId of missingIds) {
    const response = await cache.match(new Request(`offline-trail:${trailId}`))
    if (!response) continue
    try {
      const trail = await response.json()
      if (trail && trail.id) {
        upsertCustomTrail(trail)
        restored = true
      }
    } catch {
      // ignore corrupted cache entries
    }
  }

  if (restored) render()
}

async function cacheOfflineSelection(trailId) {
  if (!("caches" in window)) return

  const cache = await caches.open(USER_CACHE_NAME)
  const payload = state.trails.find((trail) => trail.id === trailId)
  if (!payload) return

  if (!state.customTrails.some((t) => t.id === trailId)) {
    upsertCustomTrail(payload)
  }

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

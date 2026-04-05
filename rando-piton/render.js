// Rendu UI : éléments DOM, filtres, listes et fiches détail

// ─── Références DOM ──────────────────────────────────────────────────────────

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

// ─── Badges réseau / version ─────────────────────────────────────────────────

function updateNetworkBadge() {
  const online = navigator.onLine
  elements.networkBadge.textContent = online ? "En ligne" : "Mode hors ligne"
  elements.networkBadge.style.background = online
    ? "rgba(112, 141, 87, 0.18)"
    : "rgba(201, 111, 59, 0.22)"
}

function updateVersionBadge() {
  elements.versionBadge.textContent = `Version ${state.appVersion}`
}

// ─── Filtres ─────────────────────────────────────────────────────────────────

function hasActiveFilters() {
  return Boolean(state.filters.query)
    || state.filters.view !== "all"
    || state.filters.difficulty !== "all"
}

function getFilteredTrails() {
  return state.trails.filter((trail) => {
    const matchesQuery = matchesTrailQuery(trail)
    const matchesDifficulty = state.filters.difficulty === "all"
      || trail.difficulty === state.filters.difficulty

    const matchesView = state.filters.view === "all"
      || (state.filters.view === "favorites" && state.favorites.has(trail.id))
      || (state.filters.view === "offline" && state.offline.has(trail.id))
      || (state.filters.view === "with-trace" && Boolean(state.traces[trail.id]))

    return matchesQuery && matchesDifficulty && matchesView
  })
}

function matchesTrailQuery(trail) {
  if (!state.filters.query) return true

  const terms = state.filters.query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean)

  if (!terms.length) return true

  const raw = [
    trail.title,
    trail.area,
    trail.regionGroup || "",
    trail.type || "",
    ...(trail.keywords || []),
    ...(trail.highlights || []),
    ...(trail.publicItinerary || [])
  ].join(" ")

  const keywordIndex = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  return terms.every((term) => keywordIndex.includes(term))
}

// ─── Render principal ────────────────────────────────────────────────────────

function render() {
  renderCounters()
  renderActiveSearchSummary()
  renderKeywordChips()
  renderRemoteSuggestions()
  renderTrailList()
  renderDetails()
}

function renderCounters() {
  elements.countAll.textContent = String(state.trails.length)
  elements.countFavorites.textContent = String(state.favorites.size)
  elements.countOffline.textContent = String(state.offline.size)
  elements.countTraces.textContent = String(Object.keys(state.traces).length)
}

function renderActiveSearchSummary() {
  const parts = []
  if (state.filters.query) parts.push(state.filters.query)
  if (state.filters.view === "offline") parts.push("fiches hors ligne")

  const summary = parts.join(" • ")
  elements.activeSearchSummary.hidden = !summary
  elements.activeSearchText.textContent = summary
  elements.searchFab.textContent = summary ? `Recherche : ${summary}` : "Recherche"
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

function renderRemoteSuggestions() {
  elements.remoteSearchStatus.textContent = state.remoteSuggestionsStatus
  elements.remoteSuggestions.innerHTML = ""
  if (!state.remoteSuggestions.length) return

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

// ─── Liste des randonnées ────────────────────────────────────────────────────

function renderTrailList() {
  elements.trailList.innerHTML = ""

  if (!hasActiveFilters()) {
    const hint = document.createElement("div")
    hint.className = "empty-list"
    hint.textContent = "Utilisez la recherche pour trouver une randonnée."
    elements.trailList.appendChild(hint)
    return
  }

  const trails = getFilteredTrails()

  if (!trails.length) {
    const hasQuery = Boolean(state.filters.query)

    // Déclencher la recherche live si filtre texte et pas encore lancée pour cette query
    if (hasQuery && state.filters.view === "all" && state.liveResultsQuery !== state.filters.query) {
      void searchLiveIfNeeded(state.filters.query)
    }

    // Afficher les résultats live s'il y en a
    if (state.liveResults.length) {
      renderLiveResultsSection(state.liveResults)
      return
    }

    // Afficher un statut pendant la recherche en cours
    if (state.liveResultsStatus && hasQuery) {
      const status = document.createElement("div")
      status.className = "empty-list empty-list--live-status"
      status.textContent = state.liveResultsStatus
      elements.trailList.appendChild(status)
      if (!trails.find((trail) => trail.id === state.selectedId)) renderDetails()
      return
    }

    const empty = document.createElement("div")
    empty.className = "empty-list"
    empty.textContent = "Aucune randonnée ne correspond aux filtres courants."
    elements.trailList.appendChild(empty)
    if (!trails.find((trail) => trail.id === state.selectedId)) renderDetails()
    return
  }

  // On a des résultats locaux : réinitialiser les live results
  if (state.liveResults.length && state.liveResultsQuery !== state.filters.query) {
    state.liveResults = []
    state.liveResultsQuery = ""
    state.liveResultsStatus = ""
  }

  if (!trails.some((trail) => trail.id === state.selectedId)) {
    state.selectedId = trails[0].id
  }

  const isCollapsed = Boolean(state.selectedId) && !state.trailListExpanded

  for (const trail of trails) {
    if (isCollapsed && trail.id !== state.selectedId) continue

    const fragment = elements.cardTemplate.content.cloneNode(true)
    const article = fragment.querySelector(".trail-card")
    const button = fragment.querySelector(".trail-card__button")
    const titleEl = fragment.querySelector("h2")
    const difficulty = fragment.querySelector(".pill--difficulty")
    const meta = fragment.querySelector(".trail-card__meta")
    const summary = fragment.querySelector(".trail-card__summary")
    const favoritePill = fragment.querySelector(".pill--favorite")
    const offlinePill = fragment.querySelector(".pill--offline")
    const tracePill = fragment.querySelector(".pill--trace")

    titleEl.textContent = trail.title
    difficulty.textContent = trail.difficulty
    meta.textContent = `${trail.area} • ${trail.duration} • ${trail.distance}`
    summary.textContent = trail.summary
    favoritePill.hidden = !state.favorites.has(trail.id)
    offlinePill.hidden = !state.offline.has(trail.id)
    tracePill.hidden = !state.traces[trail.id]

    if (trail.id === state.selectedId) button.classList.add("is-active")

    button.addEventListener("click", () => {
      state.selectedId = trail.id
      state.trailListExpanded = false
      localStorage.setItem(STORAGE_KEYS.selected, state.selectedId)
      renderTrailList()
      renderDetails()
    })

    article.dataset.id = trail.id
    elements.trailList.appendChild(fragment)
  }

  if (isCollapsed && trails.length > 1) {
    const expandBtn = document.createElement("button")
    expandBtn.type = "button"
    expandBtn.className = "trail-list__toggle"
    expandBtn.textContent = `Voir les ${trails.length} résultats`
    expandBtn.addEventListener("click", () => {
      state.trailListExpanded = true
      renderTrailList()
    })
    elements.trailList.appendChild(expandBtn)
  } else if (!isCollapsed && state.selectedId && trails.length > 1) {
    const collapseBtn = document.createElement("button")
    collapseBtn.type = "button"
    collapseBtn.className = "trail-list__toggle trail-list__toggle--collapse"
    collapseBtn.textContent = "Réduire la liste"
    collapseBtn.addEventListener("click", () => {
      state.trailListExpanded = false
      renderTrailList()
    })
    elements.trailList.appendChild(collapseBtn)
  }

  renderDetails()
}

// ─── Section résultats Randopitons en live ────────────────────────────────────

function renderLiveResultsSection(liveTrails) {
  const header = document.createElement("div")
  header.className = "live-results-header"
  header.textContent = state.liveResultsStatus || `${liveTrails.length} résultat(s) Randopitons`
  elements.trailList.appendChild(header)

  for (const trail of liveTrails) {
    const fragment = elements.cardTemplate.content.cloneNode(true)
    const article = fragment.querySelector(".trail-card")
    const button = fragment.querySelector(".trail-card__button")
    const titleEl = fragment.querySelector("h2")
    const difficulty = fragment.querySelector(".pill--difficulty")
    const meta = fragment.querySelector(".trail-card__meta")
    const summary = fragment.querySelector(".trail-card__summary")
    const favoritePill = fragment.querySelector(".pill--favorite")
    const offlinePill = fragment.querySelector(".pill--offline")
    const tracePill = fragment.querySelector(".pill--trace")

    titleEl.textContent = trail.title
    difficulty.textContent = trail.area
    meta.textContent = trail.area
    summary.textContent = trail.summary
    favoritePill.hidden = true
    offlinePill.hidden = true
    tracePill.hidden = true
    article.classList.add("trail-card--live")

    button.addEventListener("click", () => {
      // Sélectionner ou importer selon si on l'a déjà dans le catalogue
      const existing = state.trails.find(
        (t) => getRandopitonsRouteKey(t.sourceUrl) === getRandopitonsRouteKey(trail.sourceUrl)
      )
      if (existing) {
        state.selectedId = existing.id
        localStorage.setItem(STORAGE_KEYS.selected, state.selectedId)
        state.liveResults = []
        state.liveResultsQuery = ""
        state.liveResultsStatus = ""
        state.filters.query = ""
        elements.searchInput.value = ""
        renderTrailList()
        renderDetails()
      } else {
        // Ouvrir la fiche source sur Randopitons
        openRandopitonsUrl(trail.sourceUrl)
      }
    })

    article.dataset.id = trail.id
    elements.trailList.appendChild(fragment)
  }
}

// ─── Fiche détail ────────────────────────────────────────────────────────────

function renderDetails() {
  if (!hasActiveFilters()) {
    elements.detailsPanel.innerHTML = '<div class="details__empty"><p>Sélectionnez une randonnée pour afficher sa fiche.</p></div>'
    return
  }

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
        <button type="button" class="action action--secondary" data-action="download-gpx-randopitons">Télécharger GPX Randopitons</button>
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
        ${renderAuthPanel(trail)}
      </section>
    </div>
  `

  // Actions de la fiche
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
    if (!selectedFile) return
    try {
      await saveImportedTrace(trail.id, selectedFile)
      render()
    } catch (error) {
      window.alert(error.message)
    }
  })

  elements.detailsPanel.querySelector('[data-action="download-gpx-randopitons"]').addEventListener("click", async () => {
    const btn = elements.detailsPanel.querySelector('[data-action="download-gpx-randopitons"]')
    btn.disabled = true
    btn.textContent = "Téléchargement…"
    try {
      const blob = await downloadGpxForTrail(trail)
      if (blob) {
        // Import direct si le fetch cross-origin a réussi
        await importGpxBlob(trail.id, blob, `rando-${trail.id}.gpx`)
        render()
        window.alert("Trace GPX importée avec succès !")
      } else {
        window.alert("Page Randopitons ouverte dans un nouvel onglet.\nConnectez-vous si nécessaire, téléchargez le GPX, puis importez-le avec « Importer un tracé GPX/KML ».")
      }
    } catch (error) {
      window.alert(error.message)
    } finally {
      btn.disabled = false
      btn.textContent = "Télécharger GPX Randopitons"
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
    if (!traceInfo) return
    state.itineraryMode = "map"
    renderDetails()
  })

  // Panneau auth
  bindAuthPanelEvents(trail)

  if (itineraryMode === "map") {
    void renderTraceMapForTrail(trail.id)
  }
}

// ─── Section authentification Randopitons ────────────────────────────────────

function renderAuthPanel(trail) {
  const auth = state.auth
  const gpxNote = auth.isLoggedIn
    ? `Connecté en tant que <strong>${escapeHtml(auth.email)}</strong>.`
    : "Connectez-vous à Randopitons pour accéder aux traces GPX."

  return `
    <h3>Connexion Randopitons</h3>
    <div class="auth-section">
      <p class="auth-section__note">${gpxNote}</p>
      ${!auth.isLoggedIn ? `
        <div class="auth-form">
          <input class="auth-email-input" type="email" placeholder="Email Randopitons" value="${escapeHtml(auth.email || "")}" autocomplete="email">
          <div class="auth-form__actions">
            <button type="button" class="action action--secondary" data-action="auth-save-email">Mémoriser l'email</button>
            <button type="button" class="action action--ghost" data-action="auth-open-login">Connexion Randopitons →</button>
          </div>
        </div>
      ` : `
        <div class="auth-form__actions">
          <button type="button" class="action action--ghost" data-action="auth-open-login">Ouvrir Randopitons →</button>
          <button type="button" class="action action--secondary" data-action="auth-logout">Se déconnecter</button>
        </div>
      `}
    </div>
    <div class="source-note source-note--compact">
      <p>Le bouton <em>Télécharger GPX Randopitons</em> utilise la session active de votre navigateur pour accéder au tracé. Si le téléchargement direct échoue, la page Randopitons s'ouvre dans un onglet.</p>
    </div>
  `
}

function bindAuthPanelEvents(trail) {
  const panel = elements.detailsPanel

  const saveEmailBtn = panel.querySelector('[data-action="auth-save-email"]')
  if (saveEmailBtn) {
    saveEmailBtn.addEventListener("click", () => {
      const emailInput = panel.querySelector(".auth-email-input")
      const email = emailInput?.value?.trim()
      if (!email || !email.includes("@")) {
        window.alert("Veuillez saisir un email valide.")
        return
      }
      markAsLoggedIn(email)
      renderDetails()
    })
  }

  const openLoginBtn = panel.querySelector('[data-action="auth-open-login"]')
  if (openLoginBtn) {
    openLoginBtn.addEventListener("click", () => {
      openRandopitonsLogin()
    })
  }

  const logoutBtn = panel.querySelector('[data-action="auth-logout"]')
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth()
      renderDetails()
    })
  }
}

function renderItinerary(trail) {
  const steps = Array.isArray(trail.publicItinerary) && trail.publicItinerary.length
    ? trail.publicItinerary
    : [trail.summary, trail.access]

  return steps.map((step) => `<li>${step}</li>`).join("")
}

// ─── Recherche et navigation ──────────────────────────────────────────────────

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
  state.trailListExpanded = false
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

// ─── Utilitaire ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return ""
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

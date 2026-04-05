// Helpers de persistance localStorage

function readStoredList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]")
  } catch {
    return []
  }
}

function readStoredMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}")
  } catch {
    return {}
  }
}

function storeSet(key, values) {
  localStorage.setItem(key, JSON.stringify([...values]))
}

function storeMap(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function toggleSetValue(set, value) {
  if (set.has(value)) {
    set.delete(value)
  } else {
    set.add(value)
  }
}

function initializeBaseTrails() {
  const stored = localStorage.getItem(STORAGE_KEYS.baseTrails)
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.baseTrails, JSON.stringify(DEFAULT_BASE_TRAILS))
    return [...DEFAULT_BASE_TRAILS]
  }
  try {
    return JSON.parse(stored)
  } catch {
    return [...DEFAULT_BASE_TRAILS]
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
  trailListExpanded: false,
  itineraryMode: "text",
  searchDraft: "",
  remoteSuggestions: [],
  remoteSuggestionsStatus: "Saisissez au moins 2 lettres",
  remoteSearchRequestId: 0,
  appVersion: VERSION_FALLBACK,
  catalogueLoaded: false,
  liveResults: [],
  liveResultsQuery: "",
  liveResultsStatus: "",
  filters: {
    query: "",
    difficulty: "all",
    view: "all"
  },
  auth: {
    email: null,
    isLoggedIn: false
  }
}

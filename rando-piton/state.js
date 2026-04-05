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
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
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
  urlImportStatus: "",
  appVersion: VERSION_FALLBACK,
  filters: {
    difficulty: "all",
    view: "all"
  },
  auth: {
    email: null,
    isLoggedIn: false
  }
}

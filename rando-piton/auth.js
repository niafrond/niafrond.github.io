// Gestion de l'authentification Randopitons
// Les GPX sont protégés par connexion sur le site source. Ce module stocke les
// identifiants localement pour mémoriser l'email de l'utilisateur et propose
// un flux de téléchargement qui s'appuie sur la session navigateur active.

const AUTH_STORAGE_KEY = "rando-piton:auth"

function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function saveAuthToStorage(auth) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
}

function initAuth() {
  const stored = getStoredAuth()
  if (stored) {
    state.auth.email = stored.email || null
    state.auth.isLoggedIn = stored.isLoggedIn || false
  }
}

function markAsLoggedIn(email) {
  const auth = { email: email.trim(), isLoggedIn: true, loginAt: new Date().toISOString() }
  saveAuthToStorage(auth)
  state.auth.email = auth.email
  state.auth.isLoggedIn = true
}

function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  state.auth.email = null
  state.auth.isLoggedIn = false
}

// Ouvre la page de connexion Randopitons dans un nouvel onglet
function openRandopitonsLogin() {
  window.open(`${RANDOPITONS_BASE_URL}/connexion`, "_blank", "noopener,noreferrer")
}

// Extrait l'identifiant numérique depuis l'URL source d'une rando
// ex. "https://randopitons.re/randonnee/1009-cilaos-..." → "1009"
function getRandopitonsTrailNumericId(sourceUrl) {
  try {
    const pathname = new URL(sourceUrl, RANDOPITONS_BASE_URL).pathname
    const match = pathname.match(/\/randonnee\/(\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// Tente de récupérer le GPX depuis Randopitons en utilisant la session navigateur.
// Le navigateur inclut automatiquement les cookies randopitons.re si l'utilisateur
// est connecté. La requête fetch échoue en CORS (randopitons.re ne déclare pas ce
// domaine comme autorisé), on retombe alors sur l'ouverture dans un onglet.
// Retourne le Blob si le téléchargement direct a réussi, null sinon (onglet ouvert).
async function fetchGpxBlob(gpxUrl) {
  try {
    const response = await fetch(gpxUrl, {
      credentials: "include",
      mode: "cors"
    })

    if (response.ok) {
      const contentType = response.headers.get("content-type") || ""
      const isGpx = contentType.includes("xml") || contentType.includes("gpx") || contentType.includes("octet")
      if (isGpx || response.headers.get("content-disposition")?.includes(".gpx")) {
        return await response.blob()
      }
    }
  } catch {
    // CORS bloqué — nominalement attendu pour un site tiers
  }

  // Fallback : ouvrir dans un onglet (le navigateur utilisera la session randopitons.re)
  window.open(gpxUrl, "_blank", "noopener,noreferrer")
  return null
}

// Point d'entrée principal pour télécharger le GPX d'une randonnée.
// Construit l'URL probable, essaie le fetch direct, sinon ouvre l'onglet.
async function downloadGpxForTrail(trail) {
  const trailId = getRandopitonsTrailNumericId(trail.sourceUrl)
  if (!trailId) {
    // Ouvre la page source — l'utilisateur peut y télécharger manuellement
    window.open(new URL(trail.sourceUrl, RANDOPITONS_BASE_URL).toString(), "_blank", "noopener,noreferrer")
    return null
  }

  // Format d'URL GPX observé sur randopitons.re pour les membres connectés
  const gpxUrl = `${RANDOPITONS_BASE_URL}/randonnee/${trailId}/gpx`
  return fetchGpxBlob(gpxUrl)
}

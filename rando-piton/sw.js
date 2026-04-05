const CACHE_PREFIX = "rando-piton-"
const CACHE_NAME = `${CACHE_PREFIX}shell-v2`

const APP_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./icon.svg"
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && !key.startsWith("rando-piton-user-offline"))
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  const requestUrl = new URL(event.request.url)
  const isSameOrigin = requestUrl.origin === self.location.origin
  const isNavigationRequest = event.request.mode === "navigate"
  const isAppShellRequest = isSameOrigin && APP_ASSETS.some((asset) => requestUrl.pathname.endsWith(asset.replace(/^\.\//, "/")) || requestUrl.pathname === "/rando-piton/" || requestUrl.pathname.endsWith("/rando-piton"))

  if (isNavigationRequest || isAppShellRequest) {
    event.respondWith(networkFirst(event.request, "./index.html"))
    return
  }

  event.respondWith(cacheFirst(event.request))
})

async function networkFirst(request, fallbackAsset) {
  try {
    const response = await fetch(request, { cache: "no-store" })

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }

    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }

    return caches.match(fallbackAsset)
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, response.clone())
  }

  return response
}
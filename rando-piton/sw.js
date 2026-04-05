const CACHE_PREFIX = "rando-piton-"
const CACHE_NAME = `${CACHE_PREFIX}shell-v1`

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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && !key.startsWith("rando-piton-user-offline"))
        .map((key) => caches.delete(key))
    ))
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const clone = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
      return response
    }).catch(() => caches.match("./index.html")))
  )
})
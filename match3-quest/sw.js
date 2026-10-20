/**
 * sw.js — Service worker de Hou Yi et les Dix Soleils : le jeu se charge depuis le téléphone (instantané, y compris hors ligne),
 * le réseau ne sert plus qu'aux mises à jour. Script classique en ES2017 (pas de `?.` ni de `??`) pour les vieux navigateurs.
 *
 * Version : lue dans l'URL d'enregistrement `sw.js?v=<build>` (même suffixe `?v=` que les modules, voir index.html) : une release change
 * l'URL, donc installe un nouveau service worker, sans rien à synchroniser dans ce fichier.
 *
 * Deux caches (liste des fichiers : precache-manifest.json, généré par tools/precache-manifest.mjs) :
 *   - match3-core-v<build>  : code, css, polices, données, effets sonores ; rempli à l'installation, un par build, purgé à l'activation.
 *   - match3-media-v1       : musiques et dessins des cinématiques, sorts et ultimes (≈ 120 Mo) ; survit aux builds, indexé par chemin
 *                             (sans `?v=`) ; à l'installation seuls les fichiers déjà présents dont l'empreinte a changé sont retéléchargés.
 *                             Rempli au fil des demandes du jeu et par le pré-téléchargement en arrière-plan (offlineCache.js).
 *
 * Stratégies : page d'accueil, `version.js` et manifeste → réseau d'abord (délai court, repli sur le cache) pour que les mises à jour
 * arrivent vite sans bloquer un téléphone lent ; cœur et médias → cache d'abord. Une URL `?v=` d'un autre build que ce service worker
 * va au réseau (pas de mélange de versions en ligne) et ne retombe sur le cache que si le réseau est coupé.
 */
'use strict';

var BUILD = new URL(self.location.href).searchParams.get('v') || '0';
var CORE_CACHE = 'match3-core-v' + BUILD;
var MEDIA_CACHE = 'match3-media-v1';
var CACHE_PREFIX = 'match3-core-v';
var SCOPE_PATH = new URL(self.registration.scope).pathname;          // « /match3-quest/ »
var ORIGIN = self.location.origin;
var MANIFEST_PATH = SCOPE_PATH + 'precache-manifest.json';
var VERSION_PATH = '/version.js';                                    // à la racine du site, réécrit à chaque release
var HASHES_KEY = ORIGIN + SCOPE_PATH + '__hashes.json';              // { chemin: empreinte } des médias en cache
var NETWORK_TIMEOUT_MS = 3000;
var BATCH = 8;

// Dossiers de médias (voir MEDIA_SPRITE_DIRS dans tools/precache-manifest.mjs)
var MEDIA_RE = new RegExp('^' + SCOPE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(audio/music/|sprites/(ultimates|spellfx|prologue|sunfall|ending|fengmeng|launcher)/)');

var manifestPromise = null;

function fetchManifest(fresh) {
    return fetch(MANIFEST_PATH, { cache: fresh ? 'reload' : 'default' }).then(function (res) {
        if (!res.ok) throw new Error('manifeste HTTP ' + res.status);
        return res;
    });
}

// Manifeste du build installé (cache du cœur), repli sur le réseau ; mémorisé tant que le service worker vit.
function loadManifest() {
    if (!manifestPromise) {
        manifestPromise = caches.open(CORE_CACHE)
            .then(function (cache) { return cache.match(ORIGIN + MANIFEST_PATH); })
            .then(function (hit) { return hit || fetchManifest(false); })
            .then(function (res) { return res.json(); })
            .catch(function () { manifestPromise = null; return { core: [], media: [] }; });
    }
    return manifestPromise;
}

function absolute(path) { return new URL(path, ORIGIN + SCOPE_PATH).href; }
function mediaKey(url) { return ORIGIN + new URL(url).pathname; }   // sans `?v=` : un média ne change que si son empreinte change

// Une réponse issue d'une redirection (serveurs qui réécrivent index.html en /index, par exemple) ne peut pas répondre à une navigation :
// on la reconstruit sans la marque « redirected » avant de la ranger.
function clean(response) {
    if (!response.redirected) return Promise.resolve(response);
    return response.blob().then(function (body) { return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers }); });
}

function putIfOk(cacheName, key, response) {
    if (!response || !response.ok || response.status !== 200) return Promise.resolve();
    return clean(response).then(function (res) { return caches.open(cacheName).then(function (cache) { return cache.put(key, res); }); })
        .catch(function () { /* quota plein : on sert depuis le réseau */ });
}

// ── Empreintes des médias en cache ───────────────────────────────────────────────
function readHashes(mediaCache) {
    return mediaCache.match(HASHES_KEY).then(function (res) { return res ? res.json() : {}; }).catch(function () { return {}; });
}
function writeHashes(mediaCache, hashes) {
    return mediaCache.put(HASHES_KEY, new Response(JSON.stringify(hashes), { headers: { 'Content-Type': 'application/json' } }));
}
function rememberHash(path, hash) {
    return caches.open(MEDIA_CACHE).then(function (cache) {
        return readHashes(cache).then(function (hashes) { hashes[path] = hash; return writeHashes(cache, hashes); });
    }).catch(function () { /* l'empreinte manquante provoquera un simple retéléchargement */ });
}

// ── Installation : cœur du jeu, puis mise à jour des médias déjà téléchargés ───────────────
function inBatches(items, worker) {
    var chain = Promise.resolve();
    for (var i = 0; i < items.length; i += BATCH) {
        (function (chunk) { chain = chain.then(function () { return Promise.all(chunk.map(worker)); }); })(items.slice(i, i + BATCH));
    }
    return chain;
}

function precacheCore() {
    return fetchManifest(true).then(function (manifestRes) {
        return manifestRes.clone().json().then(function (manifest) {
            manifestPromise = Promise.resolve(manifest);
            // [clé de cache, URL à télécharger] ; le manifeste vient d'être téléchargé : on le range tel quel
            var tasks = manifest.core.map(function (p) { return { key: absolute(p), url: absolute(p) }; });
            tasks.push({ key: ORIGIN + VERSION_PATH, url: ORIGIN + VERSION_PATH });
            return caches.open(CORE_CACHE).then(function (cache) {
                return cache.put(ORIGIN + MANIFEST_PATH, manifestRes).then(function () {
                    return inBatches(tasks, function (t) {
                        return fetch(t.url, { cache: 'reload' }).then(function (res) {
                            if (!res.ok) throw new Error(t.url + ' HTTP ' + res.status);
                            return clean(res).then(function (ok) { return cache.put(t.key, ok); });
                        });
                    });
                });
            }).then(function () { return manifest; });
        });
    });
}

// Médias déjà en cache dont l'empreinte a changé : retéléchargés ; médias retirés du jeu : supprimés. Sans effet si le cache média est vide.
function refreshMedia(manifest) {
    return caches.open(MEDIA_CACHE).then(function (cache) {
        return readHashes(cache).then(function (hashes) {
            var wanted = {};
            manifest.media.forEach(function (m) { wanted[m.p] = m; });
            var stale = manifest.media.filter(function (m) { return hashes[m.p] && hashes[m.p] !== m.h; });
            var gone = Object.keys(hashes).filter(function (p) { return !wanted[p]; });
            return inBatches(stale, function (m) {
                return fetch(absolute(m.p), { cache: 'reload' }).then(function (res) {
                    if (!res.ok) return null;
                    hashes[m.p] = m.h;
                    return cache.put(mediaKey(absolute(m.p)), res);
                });
            }).then(function () {
                return Promise.all(gone.map(function (p) { delete hashes[p]; return cache.delete(mediaKey(absolute(p))); }));
            }).then(function () { return writeHashes(cache, hashes); });
        });
    });
}

self.addEventListener('install', function (event) {
    event.waitUntil(precacheCore().then(function (manifest) {
        return refreshMedia(manifest).catch(function () { /* les médias seront remis à jour au prochain démarrage */ });
    }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
    event.waitUntil(caches.keys().then(function (names) {
        return Promise.all(names.filter(function (n) { return n.indexOf(CACHE_PREFIX) === 0 && n !== CORE_CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); }));
});

// ── Réponses ──────────────────────────────────────────────────────────────────
// Réseau d'abord ; si le réseau dépasse `timeoutMs` ou échoue, version en cache. La réponse du réseau met toujours le cache à jour.
function networkFirst(request, cacheName, key, timeoutMs) {
    return new Promise(function (resolve) {
        var settled = false;
        var settle = function (res) { if (!settled && res) { settled = true; resolve(res); } };
        var cached = function () { return caches.open(cacheName).then(function (c) { return c.match(key); }); };
        var timer = setTimeout(function () { cached().then(settle).catch(function () {}); }, timeoutMs);
        fetch(request).then(function (res) {
            clearTimeout(timer);
            if (res.ok) putIfOk(cacheName, key, res.clone());
            settle(res);
        }).catch(function () {
            clearTimeout(timer);
            cached().then(function (hit) { settle(hit || Response.error()); }).catch(function () { settle(Response.error()); });
        });
    });
}

function rangeResponse(cached, rangeHeader) {
    var m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '');
    if (!m || (m[1] === '' && m[2] === '')) return Promise.resolve(cached);
    return cached.arrayBuffer().then(function (buf) {
        var size = buf.byteLength;
        var start = m[1] === '' ? Math.max(0, size - parseInt(m[2], 10)) : parseInt(m[1], 10);
        var end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
        if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
        var headers = new Headers(cached.headers);
        headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
        headers.set('Content-Length', String(end - start + 1));
        return new Response(buf.slice(start, end + 1), { status: 206, headers: headers });
    });
}

function mediaResponse(request) {
    var key = mediaKey(request.url);
    return caches.open(MEDIA_CACHE).then(function (cache) {
        return cache.match(key).then(function (hit) {
            if (hit) return request.headers.get('Range') ? rangeResponse(hit, request.headers.get('Range')) : hit;
            if (request.headers.get('Range')) return fetch(request);   // lecture partielle d'un fichier absent : on ne met rien en cache
            return fetch(request).then(function (res) {
                if (res.ok && res.status === 200) {
                    putIfOk(MEDIA_CACHE, key, res.clone());
                    loadManifest().then(function (manifest) {
                        var path = new URL(request.url).pathname.slice(SCOPE_PATH.length);
                        var entry = manifest.media.filter(function (m) { return m.p === path; })[0];
                        if (entry) rememberHash(path, entry.h);
                    });
                }
                return res;
            });
        });
    });
}

function coreResponse(request, url) {
    return caches.open(CORE_CACHE).then(function (cache) {
        return cache.match(request, { ignoreSearch: true }).then(function (hit) { return hit || fetch(request); });
    });
}

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;
    var url = new URL(request.url);
    if (url.origin !== ORIGIN) return;
    var path = url.pathname;
    if (path === VERSION_PATH) { event.respondWith(networkFirst(request, CORE_CACHE, ORIGIN + VERSION_PATH, 2000)); return; }
    if (path.indexOf(SCOPE_PATH) !== 0) return;                                  // une autre application du site
    if (request.mode === 'navigate' || path === SCOPE_PATH || path === SCOPE_PATH + 'index.html') {
        event.respondWith(networkFirst(request, CORE_CACHE, absolute('index.html'), NETWORK_TIMEOUT_MS));
        return;
    }
    if (path === MANIFEST_PATH) { event.respondWith(networkFirst(request, CORE_CACHE, absolute('precache-manifest.json'), 2000)); return; }
    if (MEDIA_RE.test(path)) { event.respondWith(mediaResponse(request)); return; }
    // URL versionnée d'un autre build (page plus récente ou plus ancienne que ce service worker) : le réseau d'abord, jamais ce cache en ligne
    // (pas de mélange de versions) ; hors ligne, ce cache vaut mieux qu'une erreur.
    var v = url.searchParams.get('v');
    if (v && v !== BUILD) { event.respondWith(fetch(request).catch(function () { return coreResponse(request, url); })); return; }
    event.respondWith(coreResponse(request, url));
});

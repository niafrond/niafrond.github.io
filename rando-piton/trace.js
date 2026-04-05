// Gestion des traces GPX / KML / GeoJSON : import, parsing, rendu carte, stockage

// ─── Sélection de fichier ────────────────────────────────────────────────────

function promptTraceImport() {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".gpx,.kml,.geojson,.json,.xml"
    input.addEventListener("change", () => {
      resolve(input.files?.[0] || null)
    }, { once: true })
    input.click()
  })
}

// ─── Sauvegarde ──────────────────────────────────────────────────────────────

async function saveImportedTrace(trailId, file) {
  const text = await file.text()
  const parsedTrace = parseTraceDocument(text, file.name)
  const traceInfo = {
    name: file.name,
    size: file.size,
    type: file.type || guessTraceType(file.name),
    importedAt: new Date().toISOString(),
    pointCount: parsedTrace.coordinates.length,
    format: parsedTrace.format,
    bounds: parsedTrace.bounds
  }

  state.traces[trailId] = traceInfo
  storeMap(STORAGE_KEYS.traces, state.traces)

  if ("caches" in window) {
    const cache = await caches.open(USER_CACHE_NAME)
    await cache.put(
      new Request(`imported-trace:${trailId}`),
      new Response(text, {
        headers: {
          "Content-Type": traceInfo.type,
          "X-Trace-File-Name": encodeURIComponent(traceInfo.name)
        }
      })
    )
    await cache.put(
      new Request(`parsed-trace:${trailId}`),
      new Response(JSON.stringify(parsedTrace), {
        headers: { "Content-Type": "application/json" }
      })
    )
  }
}

// ─── Suppression ─────────────────────────────────────────────────────────────

async function removeImportedTrace(trailId) {
  delete state.traces[trailId]
  storeMap(STORAGE_KEYS.traces, state.traces)

  if (!("caches" in window)) return

  const cache = await caches.open(USER_CACHE_NAME)
  await cache.delete(new Request(`imported-trace:${trailId}`))
  await cache.delete(new Request(`parsed-trace:${trailId}`))
}

// ─── Téléchargement ──────────────────────────────────────────────────────────

async function downloadImportedTrace(trailId) {
  const traceInfo = state.traces[trailId]
  if (!traceInfo || !("caches" in window)) return

  const cache = await caches.open(USER_CACHE_NAME)
  const response = await cache.match(new Request(`imported-trace:${trailId}`))
  if (!response) return

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = traceInfo.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ─── Chargement depuis le cache ──────────────────────────────────────────────

async function loadParsedTrace(trailId) {
  if (!("caches" in window)) return null

  const cache = await caches.open(USER_CACHE_NAME)
  const response = await cache.match(new Request(`parsed-trace:${trailId}`))
  if (!response) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

// ─── Import d'un GPX Randopitons (blob depuis auth.js) ───────────────────────

async function importGpxBlob(trailId, blob, fileName) {
  const fakeFile = new File([blob], fileName, { type: blob.type || "application/gpx+xml" })
  await saveImportedTrace(trailId, fakeFile)
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseTraceDocument(text, fileName) {
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    return parseGeoJsonTrace(text)
  }

  const xml = new DOMParser().parseFromString(text, "application/xml")
  const parserError = xml.querySelector("parsererror")
  if (parserError) {
    throw new Error("Le fichier de trace n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un GPX, KML ou GeoJSON valide.")
  }

  if (lower.endsWith(".kml")) {
    return parseKmlTrace(xml)
  }

  return parseGpxTrace(xml)
}

function parseGpxTrace(xml) {
  const trackPoints = [...xml.querySelectorAll("trkpt, rtept")]
    .map((point) => [Number(point.getAttribute("lon")), Number(point.getAttribute("lat"))])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))

  return buildParsedTrace(trackPoints, "GPX")
}

function parseKmlTrace(xml) {
  const lineStrings = [...xml.querySelectorAll("LineString coordinates")]
  const gxTracks = [...xml.querySelectorAll("gx\\:coord, coord")]
  const coordinates = []

  for (const lineString of lineStrings) {
    const values = lineString.textContent.trim().split(/\s+/)
    for (const value of values) {
      const [lon, lat] = value.split(",").map(Number)
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        coordinates.push([lon, lat])
      }
    }
  }

  for (const coord of gxTracks) {
    const [lon, lat] = coord.textContent.trim().split(/\s+/).map(Number)
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      coordinates.push([lon, lat])
    }
  }

  return buildParsedTrace(coordinates, "KML")
}

function parseGeoJsonTrace(text) {
  const geoJson = JSON.parse(text)
  const coordinates = collectGeoJsonCoordinates(geoJson)
  return buildParsedTrace(coordinates, "GeoJSON")
}

function collectGeoJsonCoordinates(node) {
  if (!node) return []

  if (node.type === "FeatureCollection") {
    return node.features.flatMap((feature) => collectGeoJsonCoordinates(feature))
  }
  if (node.type === "Feature") {
    return collectGeoJsonCoordinates(node.geometry)
  }
  if (node.type === "LineString") {
    return node.coordinates.map(([lon, lat]) => [Number(lon), Number(lat)])
  }
  if (node.type === "MultiLineString") {
    return node.coordinates.flat().map(([lon, lat]) => [Number(lon), Number(lat)])
  }
  if (node.type === "GeometryCollection") {
    return node.geometries.flatMap((geometry) => collectGeoJsonCoordinates(geometry))
  }

  return []
}

function buildParsedTrace(coordinates, format) {
  const validCoordinates = coordinates.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
  if (validCoordinates.length < 2) {
    throw new Error("La trace importée ne contient pas assez de points exploitables pour afficher une carte.")
  }

  const bounds = validCoordinates.reduce((acc, [lon, lat]) => ({
    minLon: Math.min(acc.minLon, lon),
    maxLon: Math.max(acc.maxLon, lon),
    minLat: Math.min(acc.minLat, lat),
    maxLat: Math.max(acc.maxLat, lat)
  }), { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity })

  return { format, coordinates: validCoordinates, bounds }
}

function guessTraceType(fileName) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".gpx") || lower.endsWith(".xml")) return "application/gpx+xml"
  if (lower.endsWith(".kml")) return "application/vnd.google-earth.kml+xml"
  if (lower.endsWith(".geojson") || lower.endsWith(".json")) return "application/geo+json"
  return "application/octet-stream"
}

// ─── Rendu carte ─────────────────────────────────────────────────────────────

async function renderTraceMapForTrail(trailId) {
  const container = document.querySelector("[data-trace-map]")
  const traceInfo = state.traces[trailId]

  if (!container) return

  if (!traceInfo) {
    container.innerHTML = '<div class="trace-map__empty">Importez un GPX, KML ou GeoJSON pour afficher la trace ici.</div>'
    return
  }

  const parsedTrace = await loadParsedTrace(trailId)

  if (state.selectedId !== trailId) return

  if (!parsedTrace || !Array.isArray(parsedTrace.coordinates) || parsedTrace.coordinates.length < 2) {
    container.innerHTML = '<div class="trace-map__empty">La trace a été importée, mais aucun segment exploitable n\'a pu être affiché.</div>'
    return
  }

  const svgMarkup = buildTraceSvg(parsedTrace)
  const bounds = parsedTrace.bounds
  container.innerHTML = `
    <div class="trace-map__frame">
      <div class="trace-map__meta">
        <span>${traceInfo.format || "Trace"}</span>
        <span>${parsedTrace.coordinates.length} points</span>
      </div>
      ${svgMarkup}
      <div class="trace-map__legend">
        <span>Ouest ${bounds.minLon.toFixed(4)}</span>
        <span>Est ${bounds.maxLon.toFixed(4)}</span>
        <span>Sud ${bounds.minLat.toFixed(4)}</span>
        <span>Nord ${bounds.maxLat.toFixed(4)}</span>
      </div>
    </div>
  `
}

function buildTraceSvg(parsedTrace) {
  const width = 560
  const height = 320
  const padding = 26
  const { minLon, maxLon, minLat, maxLat } = parsedTrace.bounds
  const lonSpan = Math.max(maxLon - minLon, 0.0001)
  const latSpan = Math.max(maxLat - minLat, 0.0001)
  const points = parsedTrace.coordinates.map(([lon, lat]) => {
    const x = padding + ((lon - minLon) / lonSpan) * (width - padding * 2)
    const y = height - padding - ((lat - minLat) / latSpan) * (height - padding * 2)
    return [x, y]
  })

  const polyline = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")
  const [startX, startY] = points[0]
  const [endX, endY] = points[points.length - 1]

  return `
    <svg class="trace-map__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Carte simplifiée de la trace importée">
      <defs>
        <linearGradient id="traceGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#c96f3b"></stop>
          <stop offset="100%" stop-color="#17322c"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="22" fill="#eef4ea"></rect>
      <g stroke="rgba(23, 50, 44, 0.12)" stroke-width="1">
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"></line>
        <line x1="${width / 2}" y1="${padding}" x2="${width / 2}" y2="${height - padding}"></line>
        <line x1="${width - padding}" y1="${padding}" x2="${width - padding}" y2="${height - padding}"></line>
        <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}"></line>
        <line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}"></line>
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
      </g>
      <polyline points="${polyline}" fill="none" stroke="url(#traceGradient)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <circle cx="${startX.toFixed(2)}" cy="${startY.toFixed(2)}" r="6" fill="#708d57"></circle>
      <circle cx="${endX.toFixed(2)}" cy="${endY.toFixed(2)}" r="6" fill="#c96f3b"></circle>
    </svg>
  `
}

// ─── Formatage statut ─────────────────────────────────────────────────────────

function formatTraceStatus(traceInfo) {
  if (!traceInfo) {
    return "Aucune trace importée. Connectez-vous à Randopitons puis utilisez le bouton GPX ci-dessus pour télécharger et importer le tracé."
  }

  const importedDate = new Date(traceInfo.importedAt).toLocaleString("fr-FR")
  const sizeKb = Math.max(1, Math.round(traceInfo.size / 1024))
  const pointCount = traceInfo.pointCount ? ` • ${traceInfo.pointCount} points` : ""
  const format = traceInfo.format ? ` • ${traceInfo.format}` : ""
  return `Trace locale : ${traceInfo.name} • ${sizeKb} Ko${pointCount}${format} • importée le ${importedDate}`
}

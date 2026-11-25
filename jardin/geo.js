// Géolocalisation, boussole, communes (geo.api.gouv.fr), géocodage et altitude (Géoplateforme IGN).
// Plugins Capacitor via window.Capacitor.Plugins (pas d'import npm), repli web propre.

const cap = () => globalThis.Capacitor?.Plugins ?? {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function oneSample(timeoutMs) {
  const plugin = cap().Geolocation;
  if (plugin?.getCurrentPosition) {
    const p = await plugin.getCurrentPosition({ enableHighAccuracy: true, timeout: timeoutMs });
    return { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
  }
  const nav = globalThis.navigator?.geolocation;
  if (!nav) throw Object.assign(new Error('Géolocalisation indisponible sur cet appareil'), { code: 'unsupported' });
  return new Promise((resolve, reject) => {
    nav.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(Object.assign(
        new Error(e && e.code === 1 ? 'Localisation refusée : saisissez votre adresse' : 'Position introuvable'),
        { code: e && e.code === 1 ? 'denied' : 'unavailable' })),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/** Moyenne pondérée (1/précision²) de plusieurs relevés → `{lat, lon, accuracy}`. */
export function averageSamples(samples) {
  let sw = 0, slat = 0, slon = 0;
  for (const s of samples) {
    const acc = Math.max(1, s.accuracy || 50);
    const w = 1 / (acc * acc);
    sw += w; slat += w * s.lat; slon += w * s.lon;
  }
  return { lat: slat / sw, lon: slon / sw, accuracy: Math.sqrt(1 / sw) };
}

export async function getPosition({ samples = 5, timeoutMs = 15000, sampleDelayMs = 500 } = {}) {
  const got = [];
  let lastErr = null;
  for (let i = 0; i < samples; i++) {
    try { got.push(await oneSample(timeoutMs)); } catch (e) {
      lastErr = e;
      if (e.code === 'denied' || e.code === 'unsupported') break;
    }
    if (i < samples - 1) await sleep(sampleDelayMs);
  }
  if (!got.length) throw lastErr || new Error('Position introuvable');
  return averageSamples(got);
}

/** Déclinaison magnétique approchée pour la France (°, positive = est), dérive ~+0,15°/an. */
export function magneticDeclination(lat, lon, date = new Date()) {
  const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
  const base = 1.3 + 0.35 * (lon - 2.3) + 0.05 * (lat - 46.5);
  return Math.round((base + 0.15 * (year - 2025)) * 10) / 10;
}

/**
 * Cap vrai (0–360, depuis le nord géographique) en direct. `cb(deg)`. Renvoie `stop()`.
 * Utilise webkitCompassHeading ou l'événement deviceorientation(absolute) ; lissage circulaire.
 */
export function watchHeading(cb, { lat, lon, target = globalThis.window, smoothing = 0.3 } = {}) {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  const decl = lat != null && lon != null ? magneticDeclination(lat, lon) : 0;
  let cur = null;
  const handler = (e) => {
    let magnetic = null;
    if (typeof e.webkitCompassHeading === 'number') magnetic = e.webkitCompassHeading;
    else if (typeof e.alpha === 'number' && (e.absolute || e.type === 'deviceorientationabsolute')) magnetic = (360 - e.alpha) % 360;
    if (magnetic == null) return;
    const h = (magnetic + decl + 360) % 360;
    if (cur == null) cur = h;
    else {
      const diff = ((h - cur + 540) % 360) - 180;
      cur = (cur + diff * smoothing + 360) % 360;
    }
    cb(Math.round(cur * 10) / 10);
  };
  target.addEventListener('deviceorientationabsolute', handler);
  target.addEventListener('deviceorientation', handler);
  return () => {
    target.removeEventListener('deviceorientationabsolute', handler);
    target.removeEventListener('deviceorientation', handler);
  };
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url);
  if (!res || !res.ok) throw new Error(`Service indisponible (HTTP ${res?.status})`);
  return res.json();
}

/** Commune, département (code), région depuis des coordonnées ; `null` hors de France. */
export async function reverseCommune(lat, lon, { fetchImpl = globalThis.fetch } = {}) {
  const url = `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom,code,codeDepartement,codeRegion,region&format=json`;
  const list = await getJson(fetchImpl, url);
  const c = Array.isArray(list) ? list[0] : null;
  if (!c) return null;
  return {
    commune: c.nom,
    departement: c.codeDepartement ?? null,
    region: c.region?.nom ?? null,
    codeInsee: c.code,
  };
}

/** Recherche d'adresse (Géoplateforme) → `[{label, lat, lon}]`. */
export async function searchAddress(q, { fetchImpl = globalThis.fetch } = {}) {
  const query = String(q ?? '').trim();
  if (query.length < 2) return [];
  const json = await getJson(fetchImpl, `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query)}&limit=5`);
  return (json.features || [])
    .filter((f) => Array.isArray(f.geometry?.coordinates))
    .map((f) => ({ label: f.properties?.label ?? '', lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }));
}

/** Altitude en mètres (IGN, repli Open-Meteo) ; `null` si aucune source ne répond. */
export async function fetchElevation(lat, lon, { fetchImpl = globalThis.fetch } = {}) {
  try {
    const j = await getJson(fetchImpl, `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld&zonly=true`);
    const z = Array.isArray(j.elevations) ? j.elevations[0] : null;
    const v = typeof z === 'object' && z !== null ? z.z : z;
    if (typeof v === 'number' && Number.isFinite(v) && v > -1000) return v;
  } catch { /* repli */ }
  try {
    const j = await getJson(fetchImpl, `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
    const v = Array.isArray(j.elevation) ? j.elevation[0] : j.elevation;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  } catch { /* aucune source */ }
  return null;
}

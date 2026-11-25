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

/** Message français pour une erreur de géolocalisation (code `denied` | `unavailable` | `timeout` | `unsupported`). */
export function geoErrorMessage(e) {
  const code = e && (e.code === 1 ? 'denied' : e.code === 2 ? 'unavailable' : e.code === 3 ? 'timeout' : e.code);
  if (code === 'denied') return 'Localisation refusée : autorisez la position pour cette application dans les réglages du téléphone.';
  if (code === 'unsupported') return 'Géolocalisation indisponible sur cet appareil.';
  if (code === 'timeout') return 'Le GPS met trop de temps à répondre : sortez à découvert et réessayez.';
  return 'Signal GPS indisponible : sortez à découvert et vérifiez que la localisation est activée.';
}
const geoError = (e) => {
  const code = e && (e.code === 1 ? 'denied' : e.code === 2 ? 'unavailable' : e.code === 3 ? 'timeout' : e.code) || 'unavailable';
  return Object.assign(new Error(geoErrorMessage({ code })), { code });
};

/**
 * Demande de maintien de l'écran allumé (Wake Lock) ; repli silencieux si absent ou refusé.
 * Se réactive au retour de l'application au premier plan. Renvoie `release()`.
 */
export function keepScreenOn() {
  let sentinel = null; let off = false;
  const nav = globalThis.navigator;
  const doc = globalThis.document;
  const acquire = async () => {
    try {
      if (off || !nav?.wakeLock?.request) return;
      const s = await nav.wakeLock.request('screen');
      if (off) { try { await s.release(); } catch { /* déjà libéré */ } return; }
      sentinel = s;
    } catch { /* repli silencieux */ }
  };
  const onVisible = () => { if (doc && doc.visibilityState === 'visible' && (!sentinel || sentinel.released)) acquire(); };
  try { doc?.addEventListener?.('visibilitychange', onVisible); } catch { /* sans document */ }
  acquire();
  return function release() {
    off = true;
    try { doc?.removeEventListener?.('visibilitychange', onVisible); } catch { /* ignoré */ }
    const s = sentinel; sentinel = null;
    if (s) { try { Promise.resolve(s.release()).catch(() => {}); } catch { /* ignoré */ } }
  };
}

/**
 * Suivi continu de la position (haute précision, sans cache). `cb({lat, lon, accuracy, t, speed, heading})`,
 * `onError(Error{code, message en français})` (refus, indisponible, délai dépassé, non pris en charge).
 * Garde l'écran allumé tant que le suivi est actif (`keepAwake: false` pour l'éviter). Renvoie `stop()`.
 */
export function watchFix(cb, { onError, keepAwake = true, timeoutMs = 20000 } = {}) {
  let stopped = false; let clear = null;
  const release = keepAwake ? keepScreenOn() : null;
  const fail = (e) => { if (!stopped && onError) onError(geoError(e)); };
  const emit = (p) => {
    if (stopped || !p || !p.coords) return;
    cb({
      lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy,
      speed: p.coords.speed ?? null, heading: p.coords.heading ?? null,
      t: typeof p.timestamp === 'number' && p.timestamp > 0 ? p.timestamp : Date.now(),
    });
  };
  const plugin = cap().Geolocation;
  (async () => {
    try {
      if (plugin?.watchPosition) {
        if (plugin.checkPermissions) {
          let perm = await plugin.checkPermissions();
          if (perm && perm.location !== 'granted' && perm.coarseLocation !== 'granted' && plugin.requestPermissions) {
            perm = await plugin.requestPermissions({ permissions: ['location'] });
          }
          if (perm && perm.location === 'denied') { fail({ code: 'denied' }); return; }
        }
        if (stopped) return;
        const id = await plugin.watchPosition({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }, (pos, err) => {
          if (err) fail({ code: /den|perm/i.test(String(err.message || err.code || '')) ? 'denied' : 'unavailable' });
          else emit(pos);
        });
        if (stopped) { try { plugin.clearWatch({ id }); } catch { /* ignoré */ } return; }
        clear = () => plugin.clearWatch({ id });
        return;
      }
      const nav = globalThis.navigator?.geolocation;
      if (!nav?.watchPosition) { fail({ code: 'unsupported' }); return; }
      const wid = nav.watchPosition(emit, (e) => fail(e), { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs });
      clear = () => nav.clearWatch(wid);
      if (stopped) clear();
    } catch (e) { fail(e && e.code ? e : { code: /den|perm/i.test(String(e && e.message)) ? 'denied' : 'unavailable' }); }
  })();
  return function stop() {
    if (stopped) return;
    stopped = true;
    try { if (clear) clear(); } catch { /* ignoré */ }
    if (release) release();
  };
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

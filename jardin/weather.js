// Météo : Open-Meteo (gratuit, sans clé, usage non commercial).
// Variables journalières : pluie, ET₀ FAO-56, températures mini/maxi.
// Les coordonnées sont arrondies à ~100 m dans la requête (vie privée) ; le résultat est
// mis en cache (localStorage si disponible, sinon mémoire) avec repli hors ligne.

const BASE = 'https://api.open-meteo.com/v1/forecast';
const DAILY = 'precipitation_sum,et0_fao_evapotranspiration,temperature_2m_min,temperature_2m_max';
const PAST_DAYS = 3;
const CACHE_PREFIX = 'jardin:weather:';
const DEFAULT_TTL_MS = 30 * 60 * 1000;

const memoryStore = new Map();
const memoryCache = {
  getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
  setItem: (k, v) => { memoryStore.set(k, String(v)); },
};

function defaultCache() {
  try {
    const ls = globalThis.localStorage;
    if (ls && typeof ls.getItem === 'function') return ls;
  } catch { /* accès refusé */ }
  return memoryCache;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Transforme la réponse Open-Meteo en `[{date, precipMm, et0Mm, tminC, tmaxC}]` (pur). */
export function parseOpenMeteo(json) {
  const d = json && json.daily;
  if (!d || !Array.isArray(d.time)) throw new Error('Réponse météo invalide');
  return d.time.map((date, i) => ({
    date,
    precipMm: num(d.precipitation_sum?.[i]),
    et0Mm: num(d.et0_fao_evapotranspiration?.[i]),
    tminC: num(d.temperature_2m_min?.[i]),
    tmaxC: num(d.temperature_2m_max?.[i]),
  }));
}

export function weatherUrl(lat, lon, days = 7) {
  const n = Math.min(16, Math.max(1, Math.round(days)));
  const r = (x) => Number(x).toFixed(3);
  return `${BASE}?latitude=${r(lat)}&longitude=${r(lon)}&daily=${DAILY}&timezone=auto&forecast_days=${n}&past_days=${PAST_DAYS}`;
}

export function cacheKey(lat, lon) {
  return `${CACHE_PREFIX}${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
}

function readCache(cache, key) {
  try {
    const raw = cache.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && Array.isArray(v.daily) && v.fetchedAt ? v : null;
  } catch { return null; }
}

/**
 * Prévisions (3 jours passés + `days` jours). Cache frais (< ttlMs) → pas de réseau.
 * Réseau en échec → cache périmé (`stale:true`), sinon erreur.
 */
export async function fetchForecast({ lat, lon, days = 7 }, opts = {}) {
  const { fetchImpl = globalThis.fetch, cache = defaultCache(), ttlMs = DEFAULT_TTL_MS, now = Date.now() } = opts;
  const key = cacheKey(lat, lon);
  const cached = readCache(cache, key);
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (cached && nowMs - Date.parse(cached.fetchedAt) < ttlMs && cached.days >= days) {
    return { fetchedAt: cached.fetchedAt, stale: false, daily: cached.daily };
  }
  try {
    if (typeof fetchImpl !== 'function') throw new Error('fetch indisponible');
    const res = await fetchImpl(weatherUrl(lat, lon, days));
    if (!res || !res.ok) throw new Error(`Météo indisponible (HTTP ${res?.status})`);
    const daily = parseOpenMeteo(await res.json());
    const fetchedAt = new Date(nowMs).toISOString();
    try { cache.setItem(key, JSON.stringify({ fetchedAt, days, daily })); } catch { /* quota */ }
    return { fetchedAt, stale: false, daily };
  } catch (err) {
    if (cached) return { fetchedAt: cached.fetchedAt, stale: true, daily: cached.daily };
    throw err;
  }
}

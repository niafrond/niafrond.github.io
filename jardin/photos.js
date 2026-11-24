// Photos d'essences via l'API REST Wikipédia (gratuite, sans clé) : cache mémoire + localStorage, échec silencieux.
export const CREDIT = 'Photo : Wikipédia';
const OK_TTL = 30 * 24 * 3600 * 1000;
const KO_TTL = 24 * 3600 * 1000;
const MAX_PARALLEL = 3;
const API = 'https://fr.wikipedia.org/api/rest_v1/page/summary/';

const mem = new Map();
const inflight = new Map();
let running = 0;
const waiting = [];

function limit(task) {
  return new Promise((resolve) => {
    const run = () => {
      running++;
      Promise.resolve().then(task).catch(() => null).then((v) => { running--; resolve(v); const n = waiting.shift(); if (n) n(); });
    };
    if (running < MAX_PARALLEL) run(); else waiting.push(run);
  });
}

const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

function readCache(id, cache, now) {
  const fresh = (e) => e && typeof e.t === 'number' && now - e.t < (e.data ? OK_TTL : KO_TTL);
  let e = cache ? cache.get(id) : mem.get(id);
  if (fresh(e)) return e;
  if (!cache) {
    try {
      const s = store();
      const raw = s && s.getItem('jardin-photo:' + id);
      if (raw) { e = JSON.parse(raw); if (fresh(e)) { mem.set(id, e); return e; } }
    } catch { /* */ }
  }
  return null;
}
function writeCache(id, entry, cache) {
  if (cache) { try { cache.set(id, entry); } catch { /* */ } return; }
  mem.set(id, entry);
  try { const s = store(); if (s) s.setItem('jardin-photo:' + id, JSON.stringify(entry)); } catch { /* */ }
}

/** Titres à essayer : page Wikipédia, puis nom latin (2 premiers mots), puis nom commun. */
export function photoTitles(plant) {
  const out = [];
  const add = (t) => { const s = String(t || '').trim(); if (s && !out.includes(s)) out.push(s); };
  add(plant && plant.wiki);
  add(String((plant && plant.latinName) || '').split(/\s+/).slice(0, 2).join(' '));
  add(plant && plant.commonName);
  return out;
}

async function tryTitle(title, fetchImpl) {
  try {
    const res = await fetchImpl(API + encodeURIComponent(title.replace(/ /g, '_')), { headers: { Accept: 'application/json' } });
    if (!res || !res.ok) return null;
    const j = await res.json();
    if (!j || j.type === 'disambiguation') return null;
    const url = j.thumbnail && j.thumbnail.source;
    if (!url || typeof url !== 'string') return null;
    const page = (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page)
      || `https://fr.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const large = j.originalimage && j.originalimage.source;
    return { url, medium: url.replace(/\/(\d+)px-/, '/640px-'), large: typeof large === 'string' ? large : url, credit: CREDIT, page };
  } catch { return null; }
}

/**
 * Photo d'une essence → {url, medium, large, credit, page} ou null. Ne lève jamais.
 * `cache` optionnel : objet {get(id), set(id, entry)} (sinon mémoire + localStorage).
 */
export async function getPlantPhoto(plant, { fetchImpl, cache, now = Date.now() } = {}) {
  try {
    if (!plant || !plant.id) return null;
    const hit = readCache(plant.id, cache, now);
    if (hit) return hit.data || null;
    const f = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!f) return null;
    const key = plant.id;
    if (!cache && inflight.has(key)) return await inflight.get(key);
    const job = limit(async () => {
      let data = null;
      for (const t of photoTitles(plant)) { data = await tryTitle(t, f); if (data) break; }
      writeCache(plant.id, { t: now, data }, cache);
      return data;
    });
    if (!cache) { inflight.set(key, job); job.then(() => inflight.delete(key)); }
    return await job;
  } catch { return null; }
}

/** Vide le cache mémoire (tests). */
export function clearPhotoMemory() { mem.clear(); inflight.clear(); }

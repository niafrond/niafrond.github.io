// Transfert d'un jardin entre appareils (PC → téléphone) par lien, QR code ou code collé. Pur (sans DOM).
import { createGarden } from './model.js';
import { polygonArea } from './geometry.js';

/** Longueur maximale d'un lien pour tenir dans un QR code (octets). */
export const QR_MAX_BYTES = 2000;
const SCHEME = 'jardin://import/';
const HASH = '#/import/';
const CHAMPS_LOURDS = new Set(['svg', 'photo', 'photos', 'thumb', 'history', 'historique', 'journal']);

// ── base64url ───────────────────────────────────────────────────────────────
function toB64u(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64u(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const w = stream.writable.getWriter();
  w.write(bytes).catch(() => {});
  w.close().catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
const canDeflate = () => typeof CompressionStream === 'function';
const canInflate = () => typeof DecompressionStream === 'function';

/** Retire récursivement les champs lourds ou régénérables (plan SVG, photos, historiques). */
function allege(v) {
  if (Array.isArray(v)) return v.map(allege);
  if (v && typeof v === 'object') {
    const r = {};
    for (const [k, x] of Object.entries(v)) if (!CHAMPS_LOURDS.has(k)) r[k] = allege(x);
    return r;
  }
  return v;
}

/** Jardin → code de transfert compact (`v1.…` compressé, ou `v1u.…` non compressé). */
export async function encodeGarden(garden) {
  const json = JSON.stringify({ format: 'jardin-v1', garden: allege(garden) });
  const bytes = new TextEncoder().encode(json);
  if (canDeflate()) {
    try { return 'v1.' + toB64u(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch { /* repli */ }
  }
  return 'v1u.' + toB64u(bytes);
}

const fusion = (base, extra) => {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return base;
  const r = { ...base };
  for (const k of Object.keys(extra)) {
    r[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k])
      ? fusion(base[k], extra[k]) : extra[k];
  }
  return r;
};
const ILLISIBLE = 'Code illisible : il est incomplet ou abîmé. Recopiez le lien en entier, ou utilisez le fichier JSON.';

/** Code de transfert → jardin (valeurs par défaut du modèle complétées). Lève une Error en français. */
export async function decodeGarden(code) {
  const c = String(code == null ? '' : code).replace(/\s+/g, '');
  const m = /^v(\d+)(u?)\.([A-Za-z0-9_-]+)$/.exec(c);
  if (!m) throw new Error(ILLISIBLE);
  if (m[1] !== '1') throw new Error('Ce code vient d’une version plus récente de l’application : mettez Mon jardin à jour, puis réessayez.');
  let data;
  try {
    let bytes = fromB64u(m[3]);
    if (!m[2]) {
      if (!canInflate()) throw new Error('Décompression indisponible sur cet appareil : utilisez le fichier JSON.');
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    if (/Décompression indisponible/.test(e.message)) throw e;
    throw new Error(ILLISIBLE);
  }
  if (!data || data.format !== 'jardin-v1' || !data.garden || typeof data.garden !== 'object') throw new Error('Code non reconnu : ce n’est pas un jardin Mon jardin.');
  const brut = data.garden;
  const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (!Array.isArray(brut.boundary) || !Array.isArray(brut.zones ?? []) || !brut.boundary.every(ok)) throw new Error('Jardin invalide : contour ou zones incorrects.');
  const base = createGarden(brut.name || 'Jardin importé');
  const g = fusion(base, brut);
  g.context = fusion(base.context, brut.context);
  g.sun = fusion(base.sun, brut.sun);
  g.plan = fusion(base.plan, brut.plan);
  return g;
}

/** Lien web : `${base}#/import/${code}`. */
export function buildShareLink(code, base) {
  return `${String(base || '').replace(/#.*$/, '')}${HASH}${code}`;
}
/** Lien profond de l'application Android. */
export function buildAppLink(code) { return SCHEME + code; }

/** Extrait le code d'un lien https `#/import/…`, d'un lien `jardin://import/…` ou d'un code collé ; `null` sinon. */
export function codeFromUrl(urlOrText) {
  let s = String(urlOrText == null ? '' : urlOrText).trim();
  const i = s.indexOf(HASH);
  if (i >= 0) s = s.slice(i + HASH.length);
  else if (/^jardin:\/\/import\//i.test(s)) s = s.replace(/^jardin:\/\/import\//i, '');
  else if (/^intent:\/\/import\//i.test(s)) s = s.replace(/^intent:\/\/import\//i, '').replace(/#Intent.*$/i, '');
  s = s.replace(/\s+/g, '').replace(/[?#].*$/, '');
  return /^v\d+u?\.[A-Za-z0-9_-]+$/.test(s) ? s : null;
}

/** Lien entrant (lien profond Android) → `#/import/<code>` ou `null`. */
export function routeFromIncomingUrl(url) {
  const s = String(url == null ? '' : url);
  if (!/(^jardin:\/\/import\/)|(^intent:\/\/import\/)|#\/import\//i.test(s.trim())) return null;
  const code = codeFromUrl(s);
  return code ? HASH + code : null;
}

/** Résumé pour l'aperçu avant import. */
export function describeGarden(garden) {
  const g = garden || {};
  let areaM2 = 0;
  try { if (Array.isArray(g.boundary) && g.boundary.length >= 3) areaM2 = polygonArea(g.boundary); } catch { /* ignore */ }
  const zones = Array.isArray(g.zones) ? g.zones : [];
  const plants = zones.reduce((n, z) => n + (z.plantings || []).reduce((k, p) => k + (Number(p.count) || 1), 0), 0);
  return { name: g.name || 'Jardin sans nom', areaM2, zones: zones.length, plants, items: Array.isArray(g.obstacles) ? g.obstacles.length : 0 };
}

/** Taille d'un code ; `fitsQr` : le lien complet tiendra dans un QR code. */
export function sizeInfo(code) {
  const length = String(code || '').length;
  return { length, fitsQr: length + 80 <= QR_MAX_BYTES };
}

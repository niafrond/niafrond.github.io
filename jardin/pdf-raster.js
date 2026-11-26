// Rastérisation navigateur pour le PDF : SVG → JPEG / RGBA (canvas) et miniatures de photos d'essences.
// Robustesse (téléphones Android) : le SVG est nettoyé avant chargement (caractères XML interdits, NaN/undefined, esperluettes,
// dimensions), validé par DOMParser, chargé par REPLIS successifs (blob URL → data URL → createImageBitmap, avec délai maximal),
// puis dessiné avec REPLI DE RÉSOLUTION (100 % → 70 % → 48 %). En cas d'échec total, `RasterError` porte un diagnostic détaillé.
import { getPlantPhoto } from './photos.js';
import { cleanSvgNumbers } from './render-common.js';

export const RES_SCALES = [1, 0.7, 0.48];
const LOAD_TIMEOUT = 20000;

/** Erreur de rastérisation avec diagnostic : {causes:[string], svgKb, elements, pxWidth, pxHeight, scales:[number]}. */
export class RasterError extends Error {
  constructor(message, diag = {}) { super(message); this.name = 'RasterError'; this.diag = diag; }
}

/** Nettoie un SVG avant chargement : XML valide, nombres finis, xmlns / width / height / viewBox garantis. `strict` retire aussi filtres et styles. */
export function cleanSvgForImage(svg, { strict = false, width = 800, height = 600 } = {}) {
  let s = cleanSvgNumbers(String(svg || ''));
  s = s.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  if (!/^\s*<svg[\s>]/.test(s)) throw new Error('SVG vide ou invalide');
  s = s.replace(/^\s*<svg\b([^>]*)>/, (m, attrs) => {
    let a = attrs;
    if (!/\sxmlns=/.test(` ${a}`)) a += ' xmlns="http://www.w3.org/2000/svg"';
    const vb = /\sviewBox="([^"]*)"/.exec(` ${a}`);
    const okVb = vb && vb[1].trim().split(/[\s,]+/).map(Number).length === 4 && vb[1].trim().split(/[\s,]+/).every((x) => Number.isFinite(Number(x))) && Number(vb[1].trim().split(/[\s,]+/)[2]) > 0 && Number(vb[1].trim().split(/[\s,]+/)[3]) > 0;
    const wAttr = /\swidth="([\d.]+)"/.exec(` ${a}`); const hAttr = /\sheight="([\d.]+)"/.exec(` ${a}`);
    const w = wAttr && Number(wAttr[1]) > 0 ? Number(wAttr[1]) : width; const h = hAttr && Number(hAttr[1]) > 0 ? Number(hAttr[1]) : height;
    a = a.replace(/\s(?:width|height|viewBox)="[^"]*"/g, '');
    return `<svg${a} width="${w}" height="${h}" viewBox="${okVb ? vb[1].trim() : `0 0 ${w} ${h}`}">`;
  });
  if (strict) {
    s = s.replace(/<filter[\s\S]*?<\/filter>/g, '').replace(/\sfilter="[^"]*"/g, '').replace(/\sstyle="[^"]*"/g, '').replace(/<(title|desc)\b[\s\S]*?<\/\1>/g, '').replace(/\spaint-order="[^"]*"/g, '');
  }
  return s;
}

/** Erreur du parseur XML (texte) ou null si le SVG est bien formé. */
export function xmlProblem(svg, DOMParserImpl = typeof DOMParser !== 'undefined' ? DOMParser : null) {
  if (!DOMParserImpl) return null;
  try {
    const d = new DOMParserImpl().parseFromString(svg, 'image/svg+xml');
    const e = d.getElementsByTagName('parsererror')[0];
    return e ? String(e.textContent || 'XML invalide').replace(/\s+/g, ' ').slice(0, 200) : null;
  } catch (e) { return String((e && e.message) || e); }
}

const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} : délai dépassé`)), ms))]);

/** Charge le SVG avec repli blob → data URL → createImageBitmap. Renvoie {source, release, via} ; lève RasterError avec les causes. */
export async function loadSvg(svg, deps = {}, timeoutMs = LOAD_TIMEOUT) {
  const ImageC = deps.Image || (typeof Image !== 'undefined' ? Image : null);
  const U = deps.URL || URL;
  const causes = [];
  const viaImage = (src) => withTimeout(new Promise((res, rej) => {
    const img = new ImageC();
    img.onload = () => res(img); img.onerror = () => rej(new Error('image non décodable'));
    img.src = src;
  }).then(async (img) => { if (img.decode) { try { await img.decode(); } catch { /* déjà chargée */ } } return img; }), timeoutMs, 'image');
  const strategies = [
    ['blob', async () => { const url = U.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })); try { const img = await viaImage(url); return { source: img, release: () => U.revokeObjectURL(url) }; } catch (e) { U.revokeObjectURL(url); throw e; } }],
    ['data', async () => ({ source: await viaImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), release: () => {} })],
    ['bitmap', async () => { const cib = deps.createImageBitmap || (typeof createImageBitmap !== 'undefined' ? createImageBitmap : null); if (!cib) throw new Error('createImageBitmap absent'); const bmp = await withTimeout(cib(new Blob([svg], { type: 'image/svg+xml' })), timeoutMs, 'bitmap'); return { source: bmp, release: () => { try { bmp.close(); } catch { /* */ } } }; }],
  ];
  for (const [via, run] of strategies) {
    try { const r = await run(); return { ...r, via }; } catch (e) { causes.push(`${via} : ${(e && e.message) || e}`); }
  }
  throw new RasterError('image', { causes });
}

const defaultCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

/**
 * SVG (texte) → {type:'jpeg', data, width, height} ou {type:'rgba', ...} (fond transparent).
 * `deps` (tests) : {Image, URL, createImageBitmap, createCanvas}. `onAttempt(info)` reçoit chaque essai.
 */
export async function rasterizeSVG(svg, { width, height, pxWidth, pxHeight, type = 'jpeg', quality = 0.88, scales = RES_SCALES } = {}, deps = {}) {
  const createCanvas = deps.createCanvas || defaultCanvas;
  const diag = { causes: [], svgKb: Math.round(String(svg).length / 1024), elements: (String(svg).match(/<[a-zA-Z]/g) || []).length, pxWidth: pxWidth || width, pxHeight: pxHeight || height, scales: [] };
  let loaded = null;
  for (const strict of [false, true]) {
    let clean;
    try { clean = cleanSvgForImage(svg, { strict, width, height }); } catch (e) { diag.causes.push(`nettoyage : ${e.message}`); continue; }
    let prob = xmlProblem(clean, deps.DOMParser);
    if (prob && !strict) { diag.causes.push(`XML : ${prob}`); continue; } // 2e passage : nettoyage strict
    if (prob) diag.causes.push(`XML (strict) : ${prob}`);
    try { loaded = await loadSvg(clean, deps); diag.via = loaded.via; diag.strict = strict; break; } catch (e) { diag.causes.push(...((e.diag && e.diag.causes) || [String(e.message)]).map((c) => `${strict ? 'strict/' : ''}${c}`)); }
  }
  if (!loaded) throw new RasterError('image', diag);
  try {
    for (const sc of scales) {
      const pw = Math.max(8, Math.round((pxWidth || width) * sc)); const ph = Math.max(8, Math.round((pxHeight || height) * sc));
      diag.scales.push(sc); diag.pxWidth = pw; diag.pxHeight = ph;
      try {
        const canvas = createCanvas(pw, ph);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas indisponible');
        if (type === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pw, ph); }
        ctx.drawImage(loaded.source, 0, 0, pw, ph);
        if (type === 'rgba') { const d = ctx.getImageData(0, 0, pw, ph); return { type: 'rgba', data: new Uint8Array(d.data.buffer, d.data.byteOffset, d.data.byteLength), width: pw, height: ph, scale: sc }; }
        const blob = await toBlob(canvas, 'image/jpeg', quality);
        if (!blob) throw new Error('encodage JPEG impossible');
        return { type: 'jpeg', data: new Uint8Array(await blob.arrayBuffer()), width: pw, height: ph, scale: sc };
      } catch (e) { diag.causes.push(`canvas ${pw}×${ph} : ${(e && e.message) || e}`); }
    }
  } finally { loaded.release(); }
  throw new RasterError('canvas', diag);
}

/** Miniature carrée JPEG d'une essence (Wikipédia, cache local) ; null si indisponible. Ne lève jamais. */
export async function loadPhotoThumb(plant, { size = 96, timeoutMs = 6000 } = {}) {
  const job = (async () => {
    const ph = await getPlantPhoto(plant);
    if (!ph || !ph.url) return null;
    const res = await fetch(ph.url);
    if (!res.ok) return null;
    const burl = URL.createObjectURL(await res.blob());
    let bmp;
    try { bmp = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error('image')); i.src = burl; }); } finally { URL.revokeObjectURL(burl); }
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    const w = bmp.naturalWidth || bmp.width; const h = bmp.naturalHeight || bmp.height; const s = Math.min(w, h);
    ctx.drawImage(bmp, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
    const blob = await toBlob(canvas, 'image/jpeg', 0.8);
    return blob ? { data: new Uint8Array(await blob.arrayBuffer()), width: size, height: size, page: ph.page || '' } : null;
  })().catch(() => null);
  return Promise.race([job, new Promise((r) => setTimeout(() => r(null), timeoutMs))]);
}

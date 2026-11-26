// Générateur PDF minimal, sans dépendance, qui fonctionne hors ligne dans le navigateur, la webview Android et Node.
// Fonctions : pages de tailles différentes, texte (Helvetica / Helvetica-Bold / Helvetica-Oblique, WinAnsi : accents français),
// rectangles, traits, chemins, images JPEG (DCTDecode) et RGB / RGBA brutes (FlateDecode + masque doux SMask), opacité,
// liens internes, signets (outlines), métadonnées, VRAIS calques (Optional Content Groups : /OCProperties, /OC /Lx BDC … EMC).
// Les flux sont compressés par `CompressionStream('deflate')` quand il existe (sinon écrits tels quels).
// Repère de l'API : origine en HAUT à gauche, y vers le bas, unité = point (1/72 pouce).

export const A4 = { w: 595.28, h: 841.89 };
export const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
export const A3_LANDSCAPE = { w: 1190.55, h: 841.89 };

// ---------------------------------------------------------------- texte : WinAnsi et métriques Helvetica
const CP1252 = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89,
  0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};
/** Caractères hors WinAnsi remplacés par un équivalent lisible (les emojis sont simplement retirés). */
const SUBST = {
  '→': '->', '←': '<-', '↑': '^', '↓': 'v', '✔': 'v', '✓': 'v', '✗': 'x', '✘': 'x', '☐': '', '☑': '', '−': '-', '≈': '~', '≥': '>=', '≤': '<=',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '‍': '', '️': '', '\t': ' ', '‑': '-', '★': '*', '☆': '*', '▪': '-', '■': '-',
  '№': 'No', 'ŷ': 'y', 'Ŷ': 'Y',
};

/** Texte → octets WinAnsi (tableau d'entiers 0–255). */
export function winAnsiBytes(str) {
  const out = [];
  for (const ch of String(str ?? '')) {
    const c = ch.codePointAt(0);
    if (c === 10 || c === 13) { out.push(32); continue; }
    if (c >= 0x20 && c < 0x7f) { out.push(c); continue; }
    if (c >= 0xa0 && c <= 0xff) { out.push(c); continue; }
    if (CP1252[c]) { out.push(CP1252[c]); continue; }
    if (Object.prototype.hasOwnProperty.call(SUBST, ch)) { for (const x of SUBST[ch]) out.push(x.charCodeAt(0)); continue; }
    if (c > 0xffff) continue; // emoji et symboles hors plan de base : retirés
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base && base !== ch && base.charCodeAt(0) < 0x7f) { out.push(base.charCodeAt(0)); continue; }
    if (c < 0x20 || (c >= 0x7f && c < 0xa0) || (c >= 0x2190 && c <= 0x2bff) || (c >= 0x2600 && c <= 0x27bf)) continue;
    out.push(0x3f);
  }
  return out;
}
/** Texte tel qu'il apparaîtra dans le PDF (accents conservés, emojis retirés) : utile pour mesurer et pour les tests. */
export const pdfSafeText = (str) => String.fromCharCode(...winAnsiBytes(str));

const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const SPECIAL = { // [regular, bold] pour les codes WinAnsi hors lettres accentuées
  0x80: [556, 556], 0x85: [1000, 1000], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500], 0x94: [333, 500], 0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000],
  0x99: [1000, 1000], 0x8C: [1000, 1000], 0x9C: [944, 944], 0xA0: [278, 278], 0xA1: [333, 333], 0xA9: [737, 737], 0xAB: [556, 556], 0xBB: [556, 556], 0xB0: [400, 400],
  0xB1: [584, 584], 0xB2: [333, 333], 0xB3: [333, 333], 0xB9: [333, 333], 0xB7: [278, 278], 0xBC: [834, 834], 0xBD: [834, 834], 0xBE: [834, 834], 0xBF: [611, 611],
  0xC6: [1000, 1000], 0xE6: [889, 889], 0xD7: [584, 584], 0xF7: [584, 584], 0xDF: [611, 611], 0xB5: [556, 611], 0xA7: [556, 556], 0xA3: [556, 556], 0xA2: [556, 556], 0xA5: [556, 556],
};
const widthCache = [new Map(), new Map()];
/** Largeur (1/1000 d'em) d'un octet WinAnsi dans Helvetica (0) ou Helvetica-Bold (1). */
function glyphWidth(code, bold) {
  const cache = widthCache[bold ? 1 : 0];
  let w = cache.get(code);
  if (w != null) return w;
  if (code >= 32 && code <= 126) w = (bold ? W_BOLD : W_REG)[code - 32];
  else if (SPECIAL[code]) w = SPECIAL[code][bold ? 1 : 0];
  else if (code >= 0xC0) {
    const base = String.fromCharCode(code).normalize('NFD')[0];
    const bc = base.charCodeAt(0);
    w = bc >= 32 && bc <= 126 ? (bold ? W_BOLD : W_REG)[bc - 32] : 556;
  } else w = 556;
  cache.set(code, w);
  return w;
}
const isBold = (font) => font === 'bold';
/** Largeur d'un texte en points. `font` : 'regular' | 'bold' | 'italic'. */
export function textWidth(str, size, font = 'regular') {
  let w = 0;
  const b = isBold(font);
  for (const c of winAnsiBytes(str)) w += glyphWidth(c, b);
  return (w * size) / 1000;
}

/** Coupe un texte en lignes de largeur ≤ `maxWidth` (points) : mots entiers, mots trop longs coupés. */
export function wrapText(str, maxWidth, size, font = 'regular') {
  const lines = [];
  for (const para of String(str ?? '').split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let cur = '';
    const push = () => { lines.push(cur); cur = ''; };
    for (let w of words) {
      while (textWidth(w, size, font) > maxWidth && w.length > 1) { // mot trop long : on le coupe
        if (cur) push();
        let k = w.length - 1;
        while (k > 1 && textWidth(w.slice(0, k), size, font) > maxWidth) k--;
        lines.push(w.slice(0, k)); w = w.slice(k);
      }
      const t = cur ? `${cur} ${w}` : w;
      if (cur && textWidth(t, size, font) > maxWidth) { push(); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

// ---------------------------------------------------------------- outils bas niveau
const num = (n) => { const v = Math.round(n * 1000) / 1000; return Object.is(v, -0) ? '0' : String(v); };
const latin1 = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
const concat = (parts) => {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
/** Chaîne littérale PDF `( … )` à partir d'octets. */
export function escapePdfString(bytes) {
  let s = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) s += `\\${b.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(b);
  }
  return `${s})`;
}
/** Chaîne de métadonnée : UTF-16BE avec BOM, en hexadécimal (accents et caractères Unicode corrects). */
export function pdfTextString(str) {
  let hex = 'FEFF';
  for (let i = 0; i < String(str ?? '').length; i++) hex += String(str).charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}
const pdfDate = (d) => {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `D:${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};
export function parseColor(c) {
  if (Array.isArray(c)) return c;
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ''));
  if (m) { const v = parseInt(m[1], 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; }
  const s = /^#?([0-9a-f]{3})$/i.exec(String(c || ''));
  if (s) { const t = s[1]; return [parseInt(t[0] + t[0], 16) / 255, parseInt(t[1] + t[1], 16) / 255, parseInt(t[2] + t[2], 16) / 255]; }
  return [0, 0, 0];
}
const rgb = (c) => parseColor(c).map((x) => num(x)).join(' ');

/** Lit les dimensions d'un JPEG (marqueur SOF). → {width, height, components, bits} ou null. */
export function jpegInfo(u8) {
  if (!u8 || u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < u8.length) {
    if (u8[i] !== 0xff) { i++; continue; }
    const m = u8[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = (u8[i + 2] << 8) | u8[i + 3];
    if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { bits: u8[i + 4], height: (u8[i + 5] << 8) | u8[i + 6], width: (u8[i + 7] << 8) | u8[i + 8], components: u8[i + 9] };
    }
    i += 2 + len;
  }
  return null;
}

/** Compresse (zlib) si `CompressionStream` existe ; sinon renvoie null (flux non compressé). */
export async function deflate(u8) {
  try {
    if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return null;
    const cs = new CompressionStream('deflate');
    const w = cs.writable.getWriter();
    w.write(u8); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  } catch { return null; }
}

// ---------------------------------------------------------------- page
const FONT_KEY = { regular: 'F1', bold: 'F2', italic: 'F3' };

export class PdfPage {
  constructor(doc, w, h) {
    this.doc = doc; this.w = w; this.h = h;
    this.ops = []; this.fonts = new Set(); this.images = new Set(); this.gs = new Map(); this.layers = new Set();
    this.links = [];
  }

  /** Rectangle (x, y = coin haut gauche). `fill` / `stroke` : couleur '#rrggbb' ; `radius` : coins arrondis ; `opacity` : 0–1. */
  rect(x, y, w, h, { fill = null, stroke = null, lineWidth = 0.6, radius = 0, opacity = null, dash = null } = {}) {
    const y0 = this.h - y - h;
    let p;
    if (radius > 0) {
      const r = Math.min(radius, w / 2, h / 2); const k = r * 0.5523;
      p = `${num(x + r)} ${num(y0)} m ${num(x + w - r)} ${num(y0)} l ${num(x + w - r + k)} ${num(y0)} ${num(x + w)} ${num(y0 + r - k)} ${num(x + w)} ${num(y0 + r)} c `
        + `${num(x + w)} ${num(y0 + h - r)} l ${num(x + w)} ${num(y0 + h - r + k)} ${num(x + w - r + k)} ${num(y0 + h)} ${num(x + w - r)} ${num(y0 + h)} c `
        + `${num(x + r)} ${num(y0 + h)} l ${num(x + r - k)} ${num(y0 + h)} ${num(x)} ${num(y0 + h - r + k)} ${num(x)} ${num(y0 + h - r)} c `
        + `${num(x)} ${num(y0 + r)} l ${num(x)} ${num(y0 + r - k)} ${num(x + r - k)} ${num(y0)} ${num(x + r)} ${num(y0)} c h`;
    } else p = `${num(x)} ${num(y0)} ${num(w)} ${num(h)} re`;
    this._paint(p, { fill, stroke, lineWidth, opacity, dash });
    return this;
  }

  /** Cercle de centre (cx, cy) et de rayon r. */
  circle(cx, cy, r, opts = {}) {
    const y = this.h - cy; const k = r * 0.5523;
    const p = `${num(cx + r)} ${num(y)} m ${num(cx + r)} ${num(y + k)} ${num(cx + k)} ${num(y + r)} ${num(cx)} ${num(y + r)} c `
      + `${num(cx - k)} ${num(y + r)} ${num(cx - r)} ${num(y + k)} ${num(cx - r)} ${num(y)} c `
      + `${num(cx - r)} ${num(y - k)} ${num(cx - k)} ${num(y - r)} ${num(cx)} ${num(y - r)} c `
      + `${num(cx + k)} ${num(y - r)} ${num(cx + r)} ${num(y - k)} ${num(cx + r)} ${num(y)} c h`;
    this._paint(p, { lineWidth: 0.6, ...opts });
    return this;
  }

  /** Ligne brisée / polygone (points [{x, y}] ou [[x, y]]). */
  path(points, { close = false, fill = null, stroke = '#000000', lineWidth = 0.6, opacity = null, dash = null } = {}) {
    if (!points || points.length < 2) return this;
    const P = points.map((q) => (Array.isArray(q) ? { x: q[0], y: q[1] } : q));
    let p = `${num(P[0].x)} ${num(this.h - P[0].y)} m`;
    for (let i = 1; i < P.length; i++) p += ` ${num(P[i].x)} ${num(this.h - P[i].y)} l`;
    if (close) p += ' h';
    this._paint(p, { fill, stroke: fill && !stroke ? null : stroke, lineWidth, opacity, dash });
    return this;
  }

  line(x1, y1, x2, y2, { color = '#000000', width = 0.6, dash = null, opacity = null } = {}) {
    return this.path([{ x: x1, y: y1 }, { x: x2, y: y2 }], { stroke: color, lineWidth: width, dash, opacity });
  }

  _paint(pathOps, { fill, stroke, lineWidth, opacity, dash }) {
    let s = 'q ';
    if (opacity != null && opacity < 1) s += `/${this._gs(opacity)} gs `;
    if (fill) s += `${rgb(fill)} rg `;
    if (stroke) s += `${rgb(stroke)} RG ${num(lineWidth)} w `;
    if (dash) s += `[${dash.map(num).join(' ')}] 0 d `;
    s += pathOps;
    s += fill && stroke ? ' B' : fill ? ' f' : stroke ? ' S' : ' n';
    this.ops.push(`${s} Q`);
  }

  _gs(alpha) {
    const key = num(alpha);
    if (!this.gs.has(key)) this.gs.set(key, `GS${this.gs.size + 1}`);
    return this.gs.get(key);
  }

  /** Texte dont (x, y) est le point de BASE (ligne de base). `align` : 'left' | 'center' | 'right'. Renvoie la largeur. */
  text(str, x, y, { size = 10, font = 'regular', color = '#000000', align = 'left', opacity = null } = {}) {
    const bytes = winAnsiBytes(str);
    if (!bytes.length) return 0;
    const w = textWidth(str, size, font);
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const key = FONT_KEY[font] || 'F1';
    this.fonts.add(key);
    this.ops.push(`q ${opacity != null && opacity < 1 ? `/${this._gs(opacity)} gs ` : ''}BT /${key} ${num(size)} Tf ${rgb(color)} rg ${num(x0)} ${num(this.h - y)} Td ${escapePdfString(bytes)} Tj ET Q`);
    return w;
  }

  /** Image `id` (retour de `doc.addImage`) dans le rectangle (x, y, w, h) ; `layer` : id de calque (`doc.addLayer`). */
  image(id, x, y, w, h, { layer = null, opacity = null } = {}) {
    this.images.add(id);
    const draw = `q ${opacity != null && opacity < 1 ? `/${this._gs(opacity)} gs ` : ''}${num(w)} 0 0 ${num(h)} ${num(x)} ${num(this.h - y - h)} cm /Im${id} Do Q`;
    if (layer != null) this.layer(layer, () => this.ops.push(draw)); else this.ops.push(draw);
    return this;
  }

  /** Exécute `fn` : tout ce qui est dessiné appartient au calque `layerId` (contenu marqué `/OC /Lx BDC … EMC`). */
  layer(layerId, fn) {
    this.layers.add(layerId);
    this.ops.push(`/OC /L${layerId} BDC`);
    fn(this);
    this.ops.push('EMC');
    return this;
  }

  /** Zone cliquable : `target` = {page: PdfPage} (lien interne) ou {url}. */
  link(x, y, w, h, target) {
    this.links.push({ x, y, w, h, target });
    return this;
  }
}

// ---------------------------------------------------------------- document
export class PdfDocument {
  /** `meta` : {title, author, subject, keywords, creator, producer, lang, date}. */
  constructor(meta = {}) {
    this.meta = { creator: 'Jardin', producer: 'Jardin (pdf-writer)', lang: 'fr-FR', ...meta };
    this.pages = []; this.imgs = []; this.layerDefs = []; this.outlineItems = [];
  }

  addPage(size = A4) {
    const p = new PdfPage(this, size.w, size.h);
    this.pages.push(p);
    return p;
  }

  /**
   * Enregistre une image. `{type:'jpeg', data:Uint8Array, width?, height?}` | `{type:'rgb'|'rgba'|'gray', data, width, height}`
   * (octets bruts ligne par ligne, du haut vers le bas). Renvoie l'identifiant à passer à `page.image`.
   */
  addImage(img) {
    const rec = { ...img };
    if (rec.type === 'jpeg') {
      const info = jpegInfo(rec.data);
      if (!info) throw new Error('JPEG invalide');
      rec.width = rec.width || info.width; rec.height = rec.height || info.height; rec.components = info.components;
    }
    this.imgs.push(rec);
    return this.imgs.length;
  }

  /** Déclare un calque (Optional Content Group) ; `on:false` = masqué à l'ouverture. Renvoie son identifiant. */
  addLayer(name, { on = true } = {}) {
    this.layerDefs.push({ name, on });
    return this.layerDefs.length;
  }

  /** Signet (niveau 0 ou 1 : un niveau 1 se range sous le dernier niveau 0). */
  addOutline(title, page, level = 0) {
    this.outlineItems.push({ title, page, level: level > 0 ? 1 : 0 });
  }

  /** Construit le fichier : Uint8Array. */
  async save() {
    const chunks = []; const offsets = [];
    let pos = 0;
    const out = (u) => { chunks.push(u); pos += u.length; };
    const header = concat([latin1('%PDF-1.5\n%'), new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]), latin1('\n')]);
    out(header);
    // numérotation des objets : 1 catalogue, 2 pages, 3 info, 4-6 polices, puis images, calques, pages…
    let next = 7;
    const imgIds = this.imgs.map(() => ({ id: next++, mask: null }));
    this.imgs.forEach((im, i) => { if (im.type === 'rgba') imgIds[i].mask = next++; });
    const ocgIds = this.layerDefs.map(() => next++);
    const pageIds = this.pages.map(() => ({ page: next++, content: next++, annots: [] }));
    this.pages.forEach((p, i) => { for (let k = 0; k < p.links.length; k++) pageIds[i].annots.push(next++); });
    const outIds = this.outlineItems.length ? { root: next++, items: this.outlineItems.map(() => next++) } : null;
    const size = next;

    const writeObj = (id, body) => { offsets[id] = pos; out(latin1(`${id} 0 obj\n${body}\nendobj\n`)); };
    const writeStream = (id, inner, data) => {
      offsets[id] = pos;
      out(latin1(`${id} 0 obj\n<< ${inner} /Length ${data.length} >>\nstream\n`));
      out(data); out(latin1('\nendstream\nendobj\n'));
    };
    const flate = async (u8, extra = '') => {
      const z = await deflate(u8);
      return z && z.length < u8.length ? { inner: `${extra} /Filter /FlateDecode`, data: z } : { inner: extra, data: u8 };
    };

    const d = this.meta.date instanceof Date ? this.meta.date : new Date();
    const info = [`/Producer ${pdfTextString(this.meta.producer)}`, `/Creator ${pdfTextString(this.meta.creator)}`, `/CreationDate (${pdfDate(d)})`, `/ModDate (${pdfDate(d)})`];
    for (const [k, key] of [['title', 'Title'], ['author', 'Author'], ['subject', 'Subject'], ['keywords', 'Keywords']]) if (this.meta[k]) info.push(`/${key} ${pdfTextString(this.meta[k])}`);
    writeObj(3, `<< ${info.join(' ')} >>`);
    writeObj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    writeObj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    writeObj(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');

    // images
    for (let i = 0; i < this.imgs.length; i++) {
      const im = this.imgs[i]; const { id, mask } = imgIds[i];
      const base = `/Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /BitsPerComponent 8`;
      if (im.type === 'jpeg') {
        const cs = im.components === 1 ? '/DeviceGray' : im.components === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
        writeStream(id, `${base} /ColorSpace ${cs} /Filter /DCTDecode`, im.data);
      } else if (im.type === 'rgba') {
        const n = im.width * im.height; const rgbD = new Uint8Array(n * 3); const al = new Uint8Array(n);
        let opaque = true;
        for (let p = 0, q = 0; p < n; p++) { rgbD[q++] = im.data[p * 4]; rgbD[q++] = im.data[p * 4 + 1]; rgbD[q++] = im.data[p * 4 + 2]; const a = im.data[p * 4 + 3]; al[p] = a; if (a !== 255) opaque = false; }
        const c1 = await flate(rgbD, `${base} /ColorSpace /DeviceRGB${opaque ? '' : ` /SMask ${mask} 0 R`}`);
        writeStream(id, c1.inner, c1.data);
        const c2 = opaque ? { inner: `/Type /XObject /Subtype /Image /Width 1 /Height 1 /BitsPerComponent 8 /ColorSpace /DeviceGray`, data: new Uint8Array([255]) }
          : await flate(al, `/Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /BitsPerComponent 8 /ColorSpace /DeviceGray`);
        writeStream(mask, c2.inner, c2.data);
      } else {
        const cs = im.type === 'gray' ? '/DeviceGray' : '/DeviceRGB';
        const c = await flate(im.data instanceof Uint8Array ? im.data : new Uint8Array(im.data), `${base} /ColorSpace ${cs}`);
        writeStream(id, c.inner, c.data);
      }
      await new Promise((r) => setTimeout(r)); // cède la main (interface réactive pendant l'écriture)
    }

    // calques
    this.layerDefs.forEach((l, i) => writeObj(ocgIds[i], `<< /Type /OCG /Name ${pdfTextString(l.name)} >>`));

    // pages
    for (let i = 0; i < this.pages.length; i++) {
      const p = this.pages[i]; const ids = pageIds[i];
      const content = await flate(latin1(p.ops.join('\n')));
      writeStream(ids.content, content.inner.trim(), content.data);
      const res = [`/Font << ${[...p.fonts].map((k) => `/${k} ${({ F1: 4, F2: 5, F3: 6 })[k]} 0 R`).join(' ')} >>`];
      if (p.images.size) res.push(`/XObject << ${[...p.images].map((k) => `/Im${k} ${imgIds[k - 1].id} 0 R`).join(' ')} >>`);
      if (p.gs.size) res.push(`/ExtGState << ${[...p.gs].map(([a, k]) => `/${k} << /Type /ExtGState /ca ${a} /CA ${a} >>`).join(' ')} >>`);
      if (p.layers.size) res.push(`/Properties << ${[...p.layers].map((k) => `/L${k} ${ocgIds[k - 1]} 0 R`).join(' ')} >>`);
      const annots = p.links.length ? ` /Annots [${ids.annots.map((a) => `${a} 0 R`).join(' ')}]` : '';
      writeObj(ids.page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(p.w)} ${num(p.h)}] /Resources << ${res.join(' ')} >> /Contents ${ids.content} 0 R${annots} >>`);
      p.links.forEach((l, k) => {
        const rect = `[${num(l.x)} ${num(p.h - l.y - l.h)} ${num(l.x + l.w)} ${num(p.h - l.y)}]`;
        const dest = l.target && l.target.page ? `/Dest [${pageIds[this.pages.indexOf(l.target.page)].page} 0 R /Fit]` : `/A << /S /URI /URI ${escapePdfString(winAnsiBytes(l.target && l.target.url))} >>`;
        writeObj(ids.annots[k], `<< /Type /Annot /Subtype /Link /Rect ${rect} /Border [0 0 0] ${dest} >>`);
      });
      if (i % 4 === 3) await new Promise((r) => setTimeout(r));
    }

    // signets
    if (outIds) {
      const items = this.outlineItems.map((it, i) => ({ ...it, id: outIds.items[i], children: [] }));
      const top = [];
      for (const it of items) { if (it.level === 1 && top.length) top[top.length - 1].children.push(it); else top.push(it); }
      const linkTo = (it, siblings, parentId) => {
        const k = siblings.indexOf(it);
        const dest = `[${pageIds[this.pages.indexOf(it.page)].page} 0 R /Fit]`;
        let b = `/Title ${pdfTextString(it.title)} /Parent ${parentId} 0 R /Dest ${dest}`;
        if (k > 0) b += ` /Prev ${siblings[k - 1].id} 0 R`;
        if (k < siblings.length - 1) b += ` /Next ${siblings[k + 1].id} 0 R`;
        if (it.children.length) b += ` /First ${it.children[0].id} 0 R /Last ${it.children[it.children.length - 1].id} 0 R /Count ${it.children.length}`;
        writeObj(it.id, `<< ${b} >>`);
        for (const c of it.children) linkTo(c, it.children, it.id);
      };
      for (const t of top) linkTo(t, top, outIds.root);
      writeObj(outIds.root, `<< /Type /Outlines /First ${top[0].id} 0 R /Last ${top[top.length - 1].id} 0 R /Count ${items.length} >>`);
    }

    // catalogue, arbre des pages
    writeObj(2, `<< /Type /Pages /Kids [${pageIds.map((p) => `${p.page} 0 R`).join(' ')}] /Count ${this.pages.length} >>`);
    const oc = this.layerDefs.length
      ? ` /OCProperties << /OCGs [${ocgIds.map((i) => `${i} 0 R`).join(' ')}] /D << /Name ${pdfTextString('Calques')} /BaseState /ON /Order [${ocgIds.map((i) => `${i} 0 R`).join(' ')}] /ON [${ocgIds.filter((_, i) => this.layerDefs[i].on).map((i) => `${i} 0 R`).join(' ')}] /OFF [${ocgIds.filter((_, i) => !this.layerDefs[i].on).map((i) => `${i} 0 R`).join(' ')}] /ListMode /AllPages >> >>`
      : '';
    writeObj(1, `<< /Type /Catalog /Pages 2 0 R /Lang ${escapePdfString(winAnsiBytes(this.meta.lang))} /PageMode ${outIds ? '/UseOutlines' : '/UseNone'} /ViewerPreferences << /DisplayDocTitle true >>${outIds ? ` /Outlines ${outIds.root} 0 R` : ''}${oc} >>`);

    // table des références croisées
    const xrefPos = pos;
    let xr = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let i = 1; i < size; i++) xr += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
    const idHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
    xr += `trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R /ID [<${idHex}> <${idHex}>] >>\nstartxref\n${xrefPos}\n%%EOF\n`;
    out(latin1(xr));
    return concat(chunks);
  }
}

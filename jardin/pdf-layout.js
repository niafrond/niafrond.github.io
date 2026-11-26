// Mise en page des pages de texte du PDF (A4 portrait) : flux vertical, titres, paragraphes, listes à cases, tableaux
// à colonnes calculées avec retours à la ligne et coupure sur plusieurs pages (en-tête de tableau répété). Pur : écrit dans un PdfDocument.
import { A4, textWidth, wrapText } from './pdf-writer.js';

export const COLORS = {
  ink: '#1b1b1b', muted: '#5b665b', line: '#c5cec1', head: '#e4ece1', zebra: '#f5f8f3', accent: '#2f6b3a', dark: '#1f3d27', off: '#e6e9e3', warn: '#8a4b00',
};

/** Pastille numérotée (même code visuel que sur le plan) : 'el' = noire, 'sp' = blanche à contour, 'zone' = arrondie « Z1 ». Renvoie sa largeur. */
export function drawBadge(page, text, cx, cy, kind = 'sp') {
  const t = String(text); const w = Math.max(15, 7 + t.length * 5.6);
  const fill = kind === 'el' ? '#111111' : '#ffffff';
  page.rect(cx - w / 2, cy - 6.5, w, 13, { fill, stroke: '#111111', lineWidth: 0.8, radius: 6.5 });
  page.text(t, cx, cy + 3, { size: 8, font: 'bold', color: kind === 'el' ? '#ffffff' : '#111111', align: 'center' });
  return w;
}

/** Case à cocher dessinée (carré vide). */
export const drawCheckbox = (page, x, y, s = 8) => page.rect(x, y, s, s, { stroke: '#222222', lineWidth: 0.8 });

/** Pastille d'essence : feuillage + fleur. */
export function drawSwatch(page, cx, cy, r, fo, fl) {
  page.circle(cx, cy, r, { fill: fo || '#6aa04a', stroke: '#33442d', lineWidth: 0.5 });
  if (fl) { page.circle(cx + r * 0.38, cy - r * 0.34, r * 0.5, { fill: fl, stroke: '#33442d', lineWidth: 0.4 }); page.circle(cx - r * 0.4, cy + r * 0.38, r * 0.3, { fill: fl, stroke: '#33442d', lineWidth: 0.35 }); }
}

const LH = 1.32;

export class Flow {
  /**
   * @param {PdfDocument} doc
   * @param {{size?:{w,h}, margin?:{l,r,t,b}, headerLeft?:string, headerRight?:string, onNewPage?:(page, flow)=>void}} o
   */
  constructor(doc, o = {}) {
    this.doc = doc; this.size = o.size || A4;
    this.m = { l: 40, r: 40, t: 60, b: 52, ...(o.margin || {}) };
    this.headerLeft = o.headerLeft || ''; this.headerRight = o.headerRight || '';
    this.onNewPage = o.onNewPage || null;
    this.page = null; this.y = 0; this.pages = [];
  }

  get width() { return this.size.w - this.m.l - this.m.r; }
  get bottom() { return this.size.h - this.m.b; }
  get x0() { return this.m.l; }

  newPage(headerRight) {
    if (headerRight != null) this.headerRight = headerRight;
    this.page = this.doc.addPage(this.size); this.pages.push(this.page);
    const p = this.page;
    p.text(this.headerLeft, this.m.l, 30, { size: 8, color: COLORS.muted });
    p.text(this.headerRight, this.size.w - this.m.r, 30, { size: 8, color: COLORS.muted, align: 'right' });
    p.line(this.m.l, 37, this.size.w - this.m.r, 37, { color: COLORS.line, width: 0.6 });
    this.y = this.m.t;
    if (this.onNewPage) this.onNewPage(p, this);
    return p;
  }
  ensure(h) { if (!this.page || this.y + h > this.bottom) this.newPage(); }
  spacer(n = 6) { this.y += n; }

  _line(str, x, size, font, color, align = 'left', w = this.width) {
    const base = this.y + size * 0.88;
    const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
    this.page.text(str, ax, base, { size, font, color, align });
  }

  h1(text, { bookmark = true } = {}) {
    this.ensure(46);
    this._line(text, this.x0, 17, 'bold', COLORS.dark);
    this.y += 22;
    this.page.line(this.x0, this.y, this.x0 + this.width, this.y, { color: COLORS.accent, width: 1.2 });
    this.y += 9;
    void bookmark;
  }
  h2(text, { color = COLORS.accent } = {}) { this.ensure(84); this._line(text, this.x0, 11.5, 'bold', color); this.y += 17; }
  h3(text) { this.ensure(58); this._line(text, this.x0, 9.5, 'bold', COLORS.ink); this.y += 14; }

  /** Paragraphe justifié à gauche ; renvoie la hauteur utilisée. */
  p(text, { size = 9, font = 'regular', color = COLORS.ink, indent = 0, gap = 4, width = null } = {}) {
    const w = (width || this.width) - indent;
    const lines = wrapText(text, w, size, font);
    const lh = size * LH;
    let used = 0;
    for (const ln of lines) {
      this.ensure(lh);
      this._line(ln, this.x0 + indent, size, font, color);
      this.y += lh; used += lh;
    }
    this.y += gap;
    return used + gap;
  }

  bullets(items, { size = 9, indent = 10, gap = 2 } = {}) {
    for (const it of items) {
      const lines = wrapText(it, this.width - indent - 4, size);
      const lh = size * LH;
      this.ensure(lh * Math.min(lines.length, 2));
      this._line('•', this.x0 + 2, size, 'regular', COLORS.accent);
      for (const ln of lines) { this.ensure(lh); this._line(ln, this.x0 + indent + 4, size, 'regular', COLORS.ink); this.y += lh; }
      this.y += gap;
    }
  }

  /** Ligne à cocher « ☐ texte » (carré dessiné). `detail` : seconde ligne grisée. */
  check(text, { size = 9, indent = 0, detail = '', bold = false } = {}) {
    const lines = wrapText(text, this.width - indent - 16, size, bold ? 'bold' : 'regular');
    const dl = detail ? wrapText(detail, this.width - indent - 16, size - 1, 'regular') : [];
    const lh = size * LH;
    this.ensure(lh * (1 + Math.min(1, dl.length)) + 2);
    drawCheckbox(this.page, this.x0 + indent, this.y + 0.5, size - 1);
    for (const ln of lines) { this.ensure(lh); this._line(ln, this.x0 + indent + 14, size, bold ? 'bold' : 'regular', COLORS.ink); this.y += lh; }
    for (const ln of dl) { this.ensure(lh); this._line(ln, this.x0 + indent + 14, size - 1, 'regular', COLORS.muted); this.y += (size - 1) * LH; }
    this.y += 2.5;
  }

  /** Encadré de note (fond doux, texte italique). */
  note(text, { size = 8.5, color = COLORS.muted } = {}) {
    const lines = wrapText(text, this.width - 16, size, 'italic');
    const h = lines.length * size * LH + 10;
    this.ensure(h + 4);
    this.page.rect(this.x0, this.y, this.width, h, { fill: '#f3f6f0', stroke: COLORS.line, lineWidth: 0.5, radius: 3 });
    let yy = this.y + 5;
    for (const ln of lines) { this.page.text(ln, this.x0 + 8, yy + size * 0.88, { size, font: 'italic', color }); yy += size * LH; }
    this.y += h + 6;
  }

  /**
   * Tableau. `cols` : [{label, w (nombre | 'flex'), align, sub}] ; `rows` : tableaux de cellules ou {group:'Titre'} ou {total:[cellules]}.
   * Cellule : texte | {text, bold, italic, color, align} | {name, sub} | {chip, text} | {cal:{months, color, ref}} | {thumb, fo, fl}
   * | {badge, kind} | {check:true} | {draw(page, x, y, w, h), h}.
   */
  table({ cols, rows, size = 8, padX = 3, padY = 3, minRowH = 0, zebra = true, headerFill = COLORS.head }) {
    const flexN = cols.filter((c) => c.w === 'flex').length;
    const fixed = cols.reduce((s, c) => s + (c.w === 'flex' ? 0 : c.w), 0);
    const flexW = flexN ? (this.width - fixed) / flexN : 0;
    const W = cols.map((c) => (c.w === 'flex' ? flexW : c.w));
    const X = []; let ax = this.x0; for (const w of W) { X.push(ax); ax += w; }
    const lh = size * LH;

    const cellOf = (c) => (c !== null && typeof c === 'object' ? c : { text: String(c ?? '') });
    const measure = (cell, w) => {
      const inner = w - padX * 2;
      if (cell.draw) return cell.h || 12;
      if (cell.cal) return 11;
      if (cell.thumb !== undefined || cell.fo) return 24;
      if (cell.badge) return 13;
      if (cell.check) return 10;
      if (cell.name !== undefined) {
        const a = wrapText(cell.name, inner - (cell.prefixW || 0), size, 'bold').length;
        const b = cell.sub ? wrapText(cell.sub, inner, size - 1, 'italic').length : 0;
        return a * lh + b * (size - 1) * LH;
      }
      if (cell.chip) return Math.max(9, wrapText(cell.text || '', inner - 11, size).length * lh);
      return wrapText(cell.text, inner, size, cell.bold ? 'bold' : cell.italic ? 'italic' : 'regular').length * lh;
    };
    const drawCell = (cell, x, y, w, h) => {
      const inner = w - padX * 2; const tx = x + padX;
      const pg = this.page;
      if (cell.draw) { cell.draw(pg, x, y, w, h); return; }
      if (cell.badge !== undefined) { const bw = textWidth(String(cell.badge), 8, 'bold') + 7; drawBadge(pg, cell.badge, x + Math.max(bw / 2 + padX, w / 2) , y + h / 2, cell.kind || 'sp'); return; }
      if (cell.check) { drawCheckbox(pg, x + w / 2 - 4, y + (h - 8) / 2, 8); return; }
      if (cell.cal) {
        const cw = (inner - 11 * 0.8) / 12; const ch = 8.5; const cy = y + (h - ch) / 2;
        for (let m = 1; m <= 12; m++) {
          const on = cell.cal.months.includes(m); const cx = tx + (m - 1) * (cw + 0.8);
          pg.rect(cx, cy, cw, ch, on ? { fill: cell.cal.color || '#999999', stroke: '#444444', lineWidth: 0.4 } : { fill: '#f3f3f0', stroke: '#d0d3cc', lineWidth: 0.3 });
          if (cell.cal.ref === m) pg.rect(cx - 0.4, cy - 1, cw + 0.8, ch + 2, { stroke: '#111111', lineWidth: 0.9 });
        }
        return;
      }
      if (cell.thumb !== undefined || cell.fo) {
        const s = 20; const sx = tx + (inner - s) / 2; const sy = y + (h - s) / 2;
        if (cell.thumb) pg.image(cell.thumb, sx, sy, s, s); else drawSwatch(pg, sx + s / 2, sy + s / 2, s / 2 - 1, cell.fo, cell.fl);
        return;
      }
      if (cell.name !== undefined) {
        let yy = y + padY;
        for (const ln of wrapText(cell.name, inner, size, 'bold')) { pg.text(ln, tx, yy + size * 0.88, { size, font: 'bold', color: COLORS.ink }); yy += lh; }
        if (cell.sub) for (const ln of wrapText(cell.sub, inner, size - 1, 'italic')) { pg.text(ln, tx, yy + (size - 1) * 0.88, { size: size - 1, font: 'italic', color: COLORS.muted }); yy += (size - 1) * LH; }
        return;
      }
      const align = cell.align || 'left';
      let yy = y + padY; let off = 0;
      if (cell.chip) { pg.rect(tx, yy + 0.5, 8, 8, { fill: cell.chip, stroke: '#444444', lineWidth: 0.4 }); off = 11; }
      const lines = wrapText(cell.text || '', inner - off, size, cell.bold ? 'bold' : cell.italic ? 'italic' : 'regular');
      for (const ln of lines) {
        const ax2 = align === 'right' ? x + w - padX : align === 'center' ? x + w / 2 : tx + off;
        pg.text(ln, ax2, yy + size * 0.88, { size, font: cell.bold ? 'bold' : cell.italic ? 'italic' : 'regular', color: cell.color || COLORS.ink, align });
        yy += lh;
      }
    };

    const headH = Math.max(...cols.map((c, i) => wrapText(c.label || '', W[i] - padX * 2, size - 0.5, 'bold').length * (size - 0.5) * LH), 10) + padY * 2 + (cols.some((c) => c.sub) ? 7 : 0);
    const drawHeader = () => {
      const pg = this.page;
      pg.rect(this.x0, this.y, this.width, headH, { fill: headerFill, stroke: COLORS.line, lineWidth: 0.5 });
      cols.forEach((c, i) => {
        let yy = this.y + padY;
        for (const ln of wrapText(c.label || '', W[i] - padX * 2, size - 0.5, 'bold')) {
          const align = c.align || 'left';
          const ax2 = align === 'right' ? X[i] + W[i] - padX : align === 'center' ? X[i] + W[i] / 2 : X[i] + padX;
          pg.text(ln, ax2, yy + (size - 0.5) * 0.88, { size: size - 0.5, font: 'bold', color: COLORS.dark, align });
          yy += (size - 0.5) * LH;
        }
        if (c.sub) {
          const cw = (W[i] - padX * 2 - 11 * 0.8) / 12;
          for (let m = 0; m < 12; m++) pg.text(c.sub[m], X[i] + padX + m * (cw + 0.8) + cw / 2, this.y + headH - 3, { size: 5.5, font: (c.refMonth === m + 1) ? 'bold' : 'regular', color: COLORS.dark, align: 'center' });
        }
      });
      this.y += headH;
    };
    this.ensure(headH + 28);
    drawHeader();
    let k = 0;
    for (const row of rows) {
      if (row && row.group !== undefined) {
        const h = lh + padY * 2;
        if (this.y + h + 22 > this.bottom) { this.newPage(); drawHeader(); }
        this.page.rect(this.x0, this.y, this.width, h, { fill: '#eef3ea', stroke: COLORS.line, lineWidth: 0.4 });
        this.page.text(row.group, this.x0 + padX + 1, this.y + padY + size * 0.88, { size, font: 'bold', color: COLORS.accent });
        this.y += h; k = 0; continue;
      }
      const cells = (Array.isArray(row) ? row : row.total).map(cellOf);
      const total = !Array.isArray(row);
      if (total) cells.forEach((c) => { if (c.text !== undefined && c.bold === undefined) c.bold = true; });
      const h = Math.max(minRowH, ...cells.map((c, i) => measure(c, W[i]) + padY * 2));
      if (this.y + h > this.bottom) { this.newPage(); drawHeader(); }
      if (zebra && k % 2 === 1 && !total) this.page.rect(this.x0, this.y, this.width, h, { fill: COLORS.zebra });
      if (total) this.page.rect(this.x0, this.y, this.width, h, { fill: '#eef3ea' });
      cells.forEach((c, i) => drawCell(c, X[i], this.y, W[i], h));
      this.page.line(this.x0, this.y + h, this.x0 + this.width, this.y + h, { color: total ? '#889488' : COLORS.line, width: total ? 0.8 : 0.4 });
      this.y += h; k++;
    }
    this.y += 8;
  }
}

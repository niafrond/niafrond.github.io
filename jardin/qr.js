// Génération de QR code en SVG (bibliothèque vendorisée, niveau de correction L, version automatique).
import qrcode from './vendor/qrcode.js';
import { QR_MAX_BYTES } from './transfer.js';

/** qrSvg(text, {size}) → string SVG ; `null` si le texte est vide ou trop long (> ~2 000 octets). */
export function qrSvg(text, { size = 256, margin = 4 } = {}) {
  const s = String(text == null ? '' : text);
  if (!s || s.length > QR_MAX_BYTES) return null;
  let q;
  try { q = qrcode(0, 'L'); q.addData(s, 'Byte'); q.make(); } catch { return null; }
  const n = q.getModuleCount();
  const total = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + margin},${r + margin}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code du lien"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// Textures procédurales (canvas 2D) de la vue 3D. Sans DOM (tests Node), chaque fonction renvoie `null`.
import { mulberry32 } from './gl-worker-core.js';

function canvasOf(w, h = w) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(THREE, c, tileM, tileMY = tileM) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / tileM, 1 / tileMY);
  t.anisotropy = 8;
  return t;
}

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

/** Gazon : fond vert et milliers de brins. Tuile 3 m. */
export function lawnTexture(THREE, base = '#6aa84a') {
  const c = canvasOf(512); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(11);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { g.fillStyle = shade(base, 0.85 + r() * 0.3); g.globalAlpha = 0.25; g.beginPath(); g.arc(r() * 512, r() * 512, 20 + r() * 50, 0, 6.3); g.fill(); }
  g.globalAlpha = 1;
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512; const y = r() * 512; const l = 4 + r() * 9; const a = -Math.PI / 2 + (r() - 0.5) * 1.1;
    g.strokeStyle = shade(base, 0.7 + r() * 0.6); g.lineWidth = 1 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    // raccord de la tuile
    if (x < 14) { g.beginPath(); g.moveTo(x + 512, y); g.lineTo(x + 512 + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    if (y < 14) { g.beginPath(); g.moveTo(x, y + 512); g.lineTo(x + Math.cos(a) * l, y + 512 + Math.sin(a) * l); g.stroke(); }
  }
  return toTexture(THREE, c, 3);
}

/** Terrasse en lames de bois. Tuile 1,6 m. */
export function woodTexture(THREE, base = '#b98b5a') {
  const c = canvasOf(512); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(21);
  const rows = 8; const h = 512 / rows;
  for (let i = 0; i < rows; i++) {
    g.fillStyle = shade(base, 0.86 + r() * 0.26); g.fillRect(0, i * h, 512, h);
    for (let k = 0; k < 28; k++) { g.strokeStyle = shade(base, 0.7 + r() * 0.2); g.globalAlpha = 0.35; g.lineWidth = 1; const y = i * h + 3 + r() * (h - 6); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(150, y + r() * 3 - 1.5, 350, y + r() * 3 - 1.5, 512, y); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(40,25,10,.75)'; g.fillRect(0, i * h, 512, 2);
    const cut = r() * 400 + 40; g.fillRect(cut, i * h, 2, h);
  }
  return toTexture(THREE, c, 1.6);
}

/** Terrasse en dalles de pierre. Tuile 2 m (2 × 2 dalles). */
export function slabTexture(THREE, base = '#c7bfb1') {
  const c = canvasOf(512); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(31);
  const n = 2; const s = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = shade(base, 0.9 + r() * 0.2); g.fillRect(i * s, j * s, s, s);
    for (let k = 0; k < 500; k++) { g.fillStyle = shade(base, 0.8 + r() * 0.4); g.globalAlpha = 0.25; g.fillRect(i * s + r() * s, j * s + r() * s, 2 + r() * 3, 2 + r() * 3); }
    g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(70,64,56,.8)';
  for (let i = 0; i <= n; i++) { g.fillRect(i * s - 3, 0, 6, 512); g.fillRect(0, i * s - 3, 512, 6); }
  return toTexture(THREE, c, 2);
}

/** Allée de gravier. Tuile 1,5 m. */
export function gravelTexture(THREE, base = '#c4b9a4') {
  const c = canvasOf(512); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(41);
  g.fillStyle = shade(base, 0.9); g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    g.fillStyle = shade(base, 0.6 + r() * 0.7); g.globalAlpha = 0.85;
    const x = r() * 512; const y = r() * 512; const s = 1.5 + r() * 3.5;
    g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, 6.3); g.fill();
  }
  g.globalAlpha = 1;
  return toTexture(THREE, c, 1.5);
}

/** Terre / paillage des massifs. Tuile 2 m. */
export function soilTexture(THREE, base = '#6b4f3a') {
  const c = canvasOf(512); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(51);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = shade(base, 0.6 + r() * 0.8); g.globalAlpha = 0.7;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 4, 1 + r() * 2.5);
  }
  g.globalAlpha = 1;
  return toTexture(THREE, c, 2);
}

/** Sol du terrain (herbe rase). Tuile 4 m. */
export function groundTexture(THREE) {
  const t = lawnTexture(THREE, '#79a35a');
  if (t) t.repeat.set(1 / 4, 1 / 4);
  return t;
}

/** Clôture à lames verticales. Tuile 1 m. */
export function fenceTexture(THREE, base = '#a9834f') {
  const c = canvasOf(256); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(61);
  const n = 8; const w = 256 / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = shade(base, 0.85 + r() * 0.3); g.fillRect(i * w, 0, w, 256);
    g.fillStyle = 'rgba(40,25,10,.5)'; g.fillRect(i * w, 0, 2, 256);
  }
  return toTexture(THREE, c, 1);
}

/** Feuillage dense (haies). Tuile 1 m. */
export function leafTexture(THREE, base = '#3f8f4a') {
  const c = canvasOf(256); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(71);
  g.fillStyle = shade(base, 0.7); g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = shade(base, 0.55 + r() * 0.8); g.globalAlpha = 0.9;
    g.beginPath(); g.ellipse(r() * 256, r() * 256, 3 + r() * 5, 2 + r() * 3, r() * 3, 0, 6.3); g.fill();
  }
  g.globalAlpha = 1;
  return toTexture(THREE, c, 1);
}

/** Tuiles de toit. Tuile 1 m. */
export function roofTexture(THREE, base = '#a8553a') {
  const c = canvasOf(256); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(81);
  const rows = 8; const h = 256 / rows;
  for (let j = 0; j < rows; j++) for (let i = -1; i < 8; i++) {
    g.fillStyle = shade(base, 0.82 + r() * 0.3);
    g.fillRect(i * 32 + (j % 2 ? 16 : 0), j * h, 31, h - 1);
  }
  g.fillStyle = 'rgba(30,10,5,.45)'; for (let j = 0; j < rows; j++) g.fillRect(0, j * h + h - 2, 256, 2);
  return toTexture(THREE, c, 1);
}

/** Eau : dégradé + petites ondes. Tuile 6 m. */
export function waterTexture(THREE, base = '#3c8dbc') {
  const c = canvasOf(256); if (!c) return null;
  const g = c.getContext('2d'); const r = mulberry32(91);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1 + r() * 1.5;
    const x = r() * 256; const y = r() * 256; const w = 14 + r() * 40;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke();
  }
  return toTexture(THREE, c, 6);
}

/** Paroi de piscine hors sol : tôle ondulée bleu-gris (nervures verticales). Tuile 1,5 m. */
export function poolWallTexture(THREE, base = '#9fb4c0') {
  const c = canvasOf(256); if (!c) return null;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const grad = g.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, shade(base, 0.82)); grad.addColorStop(0.5, shade(base, 1.08)); grad.addColorStop(1, shade(base, 0.82));
    g.fillStyle = grad; g.fillRect(x, 0, 16, 256);
  }
  g.fillStyle = shade(base, 0.7); g.fillRect(0, 118, 256, 4);
  return toTexture(THREE, c, 1.5);
}

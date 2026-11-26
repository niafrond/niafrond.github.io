// Rastérisation navigateur pour le PDF : SVG → JPEG / RGBA (canvas) et miniatures de photos d'essences (cache, hors ligne : repli sans photo).
import { getPlantPhoto } from './photos.js';

const loadImage = (url) => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('image')); img.src = url; });
const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

/** SVG (texte) → {type:'jpeg', data, width, height} ou {type:'rgba', data, width, height} (fond transparent). */
export async function rasterizeSVG(svg, { width, height, pxWidth, pxHeight, type = 'jpeg', quality = 0.88 } = {}) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = pxWidth || width; canvas.height = pxHeight || height;
    const ctx = canvas.getContext('2d');
    if (type === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (type === 'rgba') {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { type: 'rgba', data: new Uint8Array(d.data.buffer, d.data.byteOffset, d.data.byteLength), width: canvas.width, height: canvas.height };
    }
    const blob = await toBlob(canvas, 'image/jpeg', quality);
    if (!blob) throw new Error('jpeg');
    return { type: 'jpeg', data: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(url); }
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
    try { bmp = await loadImage(burl); } finally { URL.revokeObjectURL(burl); }
    bmp = { width: bmp.naturalWidth || bmp.width, height: bmp.naturalHeight || bmp.height, el: bmp };
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    const s = Math.min(bmp.width, bmp.height);
    ctx.drawImage(bmp.el, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    const blob = await toBlob(canvas, 'image/jpeg', 0.8);
    return blob ? { data: new Uint8Array(await blob.arrayBuffer()), width: size, height: size, page: ph.page || '' } : null;
  })().catch(() => null);
  return Promise.race([job, new Promise((r) => setTimeout(() => r(null), timeoutMs))]);
}

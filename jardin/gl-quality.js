// Niveaux de qualité de la vue 3D et détection du GPU (pur, sans three.js).

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

/**
 * Paramètres par niveau : taille de la shadow map, anti-aliasing (MSAA), pixelRatio maximal, densité de feuillage,
 * détail des houppiers (subdivisions de l'icosaèdre), passes et largeur du rendu photo.
 */
export const QUALITIES = {
  low: { id: 'low', label: 'Basse', shadow: 1024, msaa: false, maxPixelRatio: 1, density: 0.35, detail: 1, photoPasses: 16, photoWidth: 1920, softShadows: false },
  medium: { id: 'medium', label: 'Moyenne', shadow: 2048, msaa: true, maxPixelRatio: 1.25, density: 0.65, detail: 1, photoPasses: 48, photoWidth: 2560, softShadows: true },
  high: { id: 'high', label: 'Haute', shadow: 4096, msaa: true, maxPixelRatio: 1.5, density: 1, detail: 2, photoPasses: 128, photoWidth: 3200, softShadows: true },
  ultra: { id: 'ultra', label: 'Ultra', shadow: 8192, msaa: true, maxPixelRatio: 2, density: 1.6, detail: 2, photoPasses: 256, photoWidth: 4096, softShadows: true },
};

/** Le nom du renderer désigne-t-il un rendu logiciel (pas de vrai GPU) ? */
export function isSoftwareRenderer(name) {
  return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|lavapipe/i.test(String(name || ''));
}

/** GPU mobile haut de gamme (Adreno 7xx, Mali-G7x/G8x/G9x, Immortalis, Apple) : MSAA et qualité Moyenne permis. */
export function isStrongMobileGpu(name) {
  return /Adreno\s*\(?TM\)?\s*(7\d\d|6[5-9]\d)|Mali-G(7[1-9]|[89]\d)|Immortalis|Apple (GPU|A1\d|M\d)/i.test(String(name || ''));
}

/** Niveau automatique selon le nom du GPU ; sur mobile : Basse, ou Moyenne si le GPU est costaud. */
export function autoQuality(gpuName, { mobile = false } = {}) {
  const n = String(gpuName || '');
  if (!n || isSoftwareRenderer(n)) return 'low';
  if (mobile) return isStrongMobileGpu(n) ? 'medium' : 'low';
  if (/RTX\s*(30|40|50)|RTX\s*A\d|RX\s*[67]\d{3}|Apple M[2-9]|Radeon Pro W|Ada Generation/i.test(n)) return 'ultra';
  if (/RTX|GTX\s*(16|10)|GeForce|Radeon RX|Radeon\(TM\) RX|Quadro|Arc\b|Apple M1|Apple GPU|Radeon Pro/i.test(n)) return 'high';
  return 'medium'; // GPU intégré (Intel HD/UHD/Iris, Radeon Graphics, Mali, Adreno…)
}

/** Paramètres d'un niveau adaptés aux capacités réelles (`maxTextureSize`) et à l'écran (`dpr`). */
export function resolveQuality(id, { maxTextureSize = 4096, dpr = 1, mobile = false, strongGpu = false } = {}) {
  const q = QUALITIES[id] || QUALITIES.medium;
  const r = {
    ...q,
    shadow: Math.max(512, Math.min(q.shadow, maxTextureSize)),
    pixelRatio: Math.max(0.75, Math.min(dpr || 1, q.maxPixelRatio)),
    photoWidth: Math.min(q.photoWidth, maxTextureSize),
    mobile: !!mobile,
  };
  if (mobile) { // profil appareil mobile : ombres ≤ 2048, pixelRatio ≤ 2, moins de feuillage, photo bornée, MSAA seulement si GPU costaud
    r.shadow = Math.min(r.shadow, 2048);
    r.pixelRatio = Math.min(r.pixelRatio, 2);
    r.density = Math.max(0.25, q.density * 0.6);
    r.photoWidth = Math.min(r.photoWidth, 2048);
    r.photoPasses = Math.min(r.photoPasses, 48);
    r.msaa = !!(q.msaa && strongGpu);
  }
  return r;
}

/** Niveau inférieur (pour la réduction automatique), ou null s'il n'y en a pas. */
export function lowerQuality(id) {
  const i = QUALITY_ORDER.indexOf(id);
  return i > 0 ? QUALITY_ORDER[i - 1] : null;
}

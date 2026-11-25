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

/** Niveau automatique selon le nom du GPU. */
export function autoQuality(gpuName) {
  const n = String(gpuName || '');
  if (!n || isSoftwareRenderer(n)) return 'low';
  if (/RTX\s*(30|40|50)|RTX\s*A\d|RX\s*[67]\d{3}|Apple M[2-9]|Radeon Pro W|Ada Generation/i.test(n)) return 'ultra';
  if (/RTX|GTX\s*(16|10)|GeForce|Radeon RX|Radeon\(TM\) RX|Quadro|Arc\b|Apple M1|Apple GPU|Radeon Pro/i.test(n)) return 'high';
  return 'medium'; // GPU intégré (Intel HD/UHD/Iris, Radeon Graphics, Mali, Adreno…)
}

/** Paramètres d'un niveau adaptés aux capacités réelles (`maxTextureSize`) et à l'écran (`dpr`). */
export function resolveQuality(id, { maxTextureSize = 4096, dpr = 1 } = {}) {
  const q = QUALITIES[id] || QUALITIES.medium;
  return {
    ...q,
    shadow: Math.max(512, Math.min(q.shadow, maxTextureSize)),
    pixelRatio: Math.max(0.75, Math.min(dpr || 1, q.maxPixelRatio)),
    photoWidth: Math.min(q.photoWidth, maxTextureSize),
  };
}

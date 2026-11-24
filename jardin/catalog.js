// Catalogue de plantes : accès, recherche, filtres (pur).
// Le fichier de données peut ne pas être encore présent : import dynamique tolérant.
let _plants = [];
let _byId = new Map();

function setCatalog(list) {
  _plants = Array.isArray(list) ? list : [];
  _byId = new Map(_plants.map((p) => [p.id, p]));
}

try {
  const mod = await import('./data/plants/index.js');
  setCatalog(mod.plants);
} catch (e) {
  setCatalog([]);
}

/** Retire accents et casse pour les comparaisons. */
export function normalizeText(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function allPlants() {
  return _plants;
}

export function getPlant(id) {
  return _byId.get(id) || null;
}

/** Recherche texte (nom commun ou latin, sans accents, tous les mots). `plants` injectable. */
export function searchPlants(query, plants = _plants) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return plants.slice();
  return plants.filter((p) => {
    const hay = `${normalizeText(p.commonName)} ${normalizeText(p.latinName)}`;
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Filtres du §7 : foliage, bloomMonth, heightMax, melliferous, edible,
 * lowMaintenance, lowWater, nonToxic, nonInvasive, category (id ou tableau d'ids).
 */
export function filterPlants(plants, filters = {}) {
  const f = filters || {};
  return (plants || []).filter((p) => {
    if (f.foliage && p.foliage !== f.foliage) return false;
    if (f.bloomMonth && !(p.bloom || []).includes(f.bloomMonth)) return false;
    if (typeof f.heightMax === 'number' && p.heightAdult > f.heightMax) return false;
    if (f.melliferous && !p.melliferous) return false;
    if (f.edible && !p.edible) return false;
    if (f.lowMaintenance && p.maintenance !== 'low') return false;
    if (f.lowWater && p.water !== 'low') return false;
    if (f.nonToxic && p.toxic) return false;
    if (f.nonInvasive && p.invasive) return false;
    if (f.category) {
      const cats = Array.isArray(f.category) ? f.category : [f.category];
      if (cats.length && !cats.includes(p.category)) return false;
    }
    return true;
  });
}

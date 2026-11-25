// Catalogue complet des essences : concatène les fiches ligneuses et herbacées
// et y fusionne les données complémentaires (prix, couleurs, page Wikipédia).
import woody from './woody.js';
import herbaceous from './herbaceous.js';
import extrasWoody from './extras-woody.js';
import extrasHerbaceous from './extras-herbaceous.js';

export const EXTRA_FIELDS = ['priceEur', 'priceUnit', 'priceNote', 'flowerColor', 'foliageColor', 'wiki'];

/** Fusionne les extras (par id) dans chaque plante ; champs absents → null. Pur, ne modifie pas l'entrée. */
export function mergeExtras(list, ...extrasMaps) {
  const extras = Object.assign({}, ...extrasMaps.filter(Boolean));
  return list.map((p) => {
    const x = extras[p.id];
    const out = { ...p };
    for (const k of EXTRA_FIELDS) out[k] = x && x[k] !== undefined ? x[k] : (p[k] !== undefined ? p[k] : null);
    return out;
  });
}

export const plants = mergeExtras([...woody, ...herbaceous], extrasWoody, extrasHerbaceous);
export const plantsById = Object.fromEntries(plants.map((p) => [p.id, p]));
export default plants;

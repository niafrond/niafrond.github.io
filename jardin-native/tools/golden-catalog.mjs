// Golden du catalogue : ids, recherches et filtres sur le catalogue réel.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { allPlants, searchPlants, filterPlants, normalizeText } from '../../jardin/catalog.js';

const here = dirname(fileURLToPath(import.meta.url));
const ids = (l) => l.map((p) => p.id);
const plants = allPlants();
const queries = ['', 'lavande', 'ERABLE', 'érable japonais', 'rosa', 'arbre papillons', 'zzz', '  tomate ', 'prunus', 'h-', 'hosta ombre'];
const filters = [
  {}, { foliage: 'evergreen' }, { category: 'tree' }, { category: ['tree', 'hedge'] }, { bloomMonth: 7 }, { heightMax: 1 },
  { melliferous: true }, { edible: true }, { lowMaintenance: true }, { lowWater: true }, { nonToxic: true }, { nonInvasive: true },
  { melliferous: true, nonInvasive: true, lowWater: true }, { category: [], heightMax: 0.5, bloomMonth: 5 },
];
const out = {
  count: plants.length,
  ids: ids(plants),
  normalize: ['  Érable  ', 'ÇàéîôÜ', null, 'Œuf'].map((s) => [s, normalizeText(s)]),
  search: queries.map((q) => ({ q, ids: ids(searchPlants(q)) })),
  filter: filters.map((f) => ({ f, ids: ids(filterPlants(plants, f)) })),
  sample: plants.filter((_, i) => i % 17 === 0),
};
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/catalog.json'), JSON.stringify(out));
console.log('golden catalog ok');

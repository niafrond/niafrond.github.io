// Exporte le catalogue final (allPlants() + tags d'ambiances / de port / de mare) vers core/src/main/resources/plants.json.
// Usage : node tools/export-catalog.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { allPlants } from '../../jardin/catalog.js';
import AMB from '../../jardin/data/plants/ambiances-tags.js';
import HAB from '../../jardin/data/plants/habits-tags.js';
import POND from '../../jardin/data/plants/pond-tags.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../core/src/main/resources/plants.json');
const plants = allPlants().map((p) => {
  const q = { ...p };
  if (AMB[p.id]) q.ambianceTag = AMB[p.id];
  if (HAB[p.id]) q.habitTag = HAB[p.id];
  if (POND[p.id]) q.pondTag = POND[p.id];
  return q;
});
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ plants }, null, 1) + '\n');
console.log(`${plants.length} essences -> ${out}`);

// Table climatique des départements (climate.js).
import { departements } from '../../jardin/data/climate.js';
writeFileSync(resolve(here, '../core/src/main/resources/departements.json'), JSON.stringify({ departements }, null, 1) + '\n');
console.log(`${departements.length} départements`);

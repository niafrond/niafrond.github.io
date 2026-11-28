// Golden de l'entretien.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MAINTENANCE_LEVELS, plantEffort, effortLabel, effortBadge, levelForZone, fitsMaintenance } from '../../jardin/maintenance.js';
import { allPlants } from '../../jardin/catalog.js';

const here = dirname(fileURLToPath(import.meta.url));
const synth = [
  {}, { maintenance: 'high', water: 'high', category: 'fruit' }, { maintenance: 'low', category: 'grass' },
  { maintenance: 'low', care: { pruneMonths: [1, 2, 3] } }, { maintenance: 'medium', windTolerant: true, water: 'low' },
  { maintenance: 'medium', category: 'shrub', foliage: 'evergreen', hardiness: -15 }, { maintenance: 'high', category: 'hedge', care: { pruneMonths: [1, 2, 3, 4] } },
];
const levels = ['green', 'low', 'none', null, 'zzz'];
const all = [...allPlants(), ...synth];
const efforts = [0, 1, 1.4, 1.5, 2, 2.5, 3, 4, -1, NaN, null, undefined];
const zones = [
  [{ context: { maintenance: 'low' } }, { maintenance: 'none' }], [{ context: { maintenance: 'low' } }, {}], [{ context: {} }, {}], [null, null],
  [{ context: { maintenance: 'zzz' } }, { maintenance: 'yyy' }], [{ context: { maintenance: 'none' } }, null],
];
const out = {
  levels: MAINTENANCE_LEVELS,
  effort: all.map((p) => plantEffort(p)),
  fits: all.map((p) => levels.map((l) => fitsMaintenance(p, l))),
  labels: efforts.map((e) => ({ e: Number.isNaN(e) ? 'NaN' : e ?? null, label: effortLabel(e), badge: effortBadge(e) })),
  zones: zones.map(([g, z]) => ({ g: g?.context?.maintenance ?? null, z: z?.maintenance ?? null, r: levelForZone(g, z) })),
  synth,
  nullEffort: plantEffort(null),
};
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/maintenance.json'), JSON.stringify(out));
console.log('golden maintenance ok');

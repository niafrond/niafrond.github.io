// Golden du budget (pricing.js).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { plantCost, gardenCost, formatEuro, formatPrice, summarizeGarden, bloomRangeText } from '../../jardin/pricing.js';
import { makeGardens, SYNTH, plantsMap } from './fixtures-jardins.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const gardens = makeGardens();
const map = plantsMap();
const lookup = (id) => map.get(id);
const simpleLine = (l) => ({ plantId: l.plantId, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, total: l.total });
const costs = gardens.map((g) => {
  const c = gardenCost(g, lookup);
  return { total: c.total, unknownCount: c.unknownCount, byZone: c.byZone.map((z) => ({ zoneId: z.zoneId, label: z.label, total: z.total, unknownCount: z.unknownCount, lines: z.lines.map(simpleLine) })) };
});
const summaries = gardens.map((g) => summarizeGarden(g, lookup));
const zone = gardens[1].zones[0]; // pelouse 6 x 5 = 30 m²
const plantings = [{ count: 1 }, { count: 0 }, { count: 3 }, { quantity: 7 }, {}, { count: 2, quantity: 9 }];
const plantCosts = [...map.values()].map((p) => ({ id: p.id, r: plantings.map((pl) => plantCost(p, pl, zone)) }));
const nums = [12.5, 0, 1.005, 1234.567, -3.456, 1e6, 999.995, 0.004, 339.6, 0.1 + 0.2, -0.004, 12345678.9, 1.5, 2.5, 0.125];
const euros = nums.map((n) => ({ n, d2: formatEuro(n), d0: formatEuro(n, { digits: 0 }), d1: formatEuro(n, { digits: 1 }), d3: formatEuro(n, { digits: 3 }), price: formatPrice(n) }));
const blooms = [[], [3], [3, 3], [10, 3, 5], [0, 13, 6], [12, 1], [4, 4, 9]].map((m) => ({ m, t: bloomRangeText(m) }));
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/pricing.json'), JSON.stringify({ gardens, synth: SYNTH, costs, summaries, plantCosts, euros, blooms }));
console.log('golden pricing ok');

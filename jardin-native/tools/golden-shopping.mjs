// Golden des listes de courses (shopping.js).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { shoppingList, shoppingByPeriod, suppliesList, itemsToBuy, monthsText, periodOf } from '../../jardin/shopping.js';
import { makeGardens, SYNTH, plantsMap } from './fixtures-jardins.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const gardens = makeGardens();
const map = plantsMap();
const lookup = (id) => map.get(id) || null;
const line = (l) => ({ plantId: l.plantId, format: l.format, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, total: l.total, priced: l.priced, zoneIds: l.zoneIds, plantMonths: l.plantMonths });
const lists = gardens.map((g) => {
  const s = shoppingList(g, lookup);
  return {
    total: s.total, unknownCount: s.unknownCount, plantCount: s.plantCount, lines: s.lines.map(line),
    groups: s.groups.map((x) => ({ id: x.id, label: x.label, subtotal: x.subtotal, lines: x.lines.map(line), formats: x.formats.map((f) => ({ format: f.format, ids: f.lines.map((l) => l.plantId) })) })),
    byZone: s.byZone.map((z) => ({ zoneId: z.zoneId, label: z.label, n: z.n, total: z.total, lines: z.lines.map(line) })),
  };
});
const periods = gardens.map((g) => shoppingByPeriod(g, lookup).map((p) => ({ id: p.id, label: p.label, subtotal: p.subtotal, lines: p.lines.map((l) => ({ ...line(l), best: l.best })) })));
const supplies = gardens.map((g) => { const s = suppliesList(g, lookup); return { ...s }; });
const items = gardens.map((g) => itemsToBuy(g));
const monthCases = [[], [1], [3, 4, 5], [3, 4, 5, 9], [12, 1, 2], [1, 3, 3, 0, 13, 7], null].map((m) => ({ m, t: monthsText(m) }));
const allPeriods = [...map.values()].map((p) => ({ id: p.id, p: periodOf(p) }));
const extra = ['Écharpe', 'echarpe', 'Echarpe', 'écharpe', 'Zèbre', 'zebre', 'Œillet', 'oeillet', 'Oeillet', 'a b', 'a-b', 'ab', 'a,b', 'A1', 'a10', 'a2', "l'if", 'lif', 'L’if', 'pot 3 L', 'pot 3L', 'pot, 3 L', 'caÿeu', 'cayeu', 'côte', 'cote', 'coté', 'côté', ''];
const strings = [...new Set([...map.values()].flatMap((p) => [p.commonName, p.priceNote || '']).concat(extra))];
const sortCheck = { input: strings, sorted: [...strings].sort((a, b) => String(a).localeCompare(String(b), 'fr')) };
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/shopping.json'), JSON.stringify({ gardens, synth: SYNTH, lists, periods, supplies, items, monthCases, allPeriods, sortCheck }));
console.log('golden shopping ok');

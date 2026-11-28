// Golden du climat.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { climateForDepartement, regions, adjustTminForAltitude, hardinessZone, departementFromCommuneCode } from '../../jardin/climate.js';
import { departements } from '../../jardin/data/climate.js';

const here = dirname(fileURLToPath(import.meta.url));
const codes = ['1', '01', '7', '29', '2a', '2B', '20', '99', '75', ' 69 ', '', 'abc', null, 5, 95];
const alts = [null, 0, -5, 100, 250, 500, 1234, 2000];
const tmins = [];
for (let t = -40; t <= 15; t += 0.5) tmins.push(t);
const communes = ['75056', '2A004', '2B033', '01001', '97411', 'abc', '20001', '13055', ' 69123 ', null, '1234', '123456', '95000'];
const out = {
  departementCount: departements.length,
  departementCodes: departements.map((d) => d.code),
  lookup: codes.map((c) => ({ c, r: climateForDepartement(c) })),
  regions: regions(),
  adjust: departements.flatMap((d) => alts.map((a) => ({ t: d.tminC, a, r: adjustTminForAltitude(d.tminC, a) }))),
  zones: tmins.map((t) => ({ t, r: hardinessZone(t) })),
  communes: communes.map((c) => ({ c, r: departementFromCommuneCode(c) })),
};
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/climate.json'), JSON.stringify(out));
console.log('golden climate ok');

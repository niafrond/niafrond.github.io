// Vérification croisée : les codes de transfert produits par Kotlin (core/build/transfer-kotlin-codes.json, écrit par TransferTest)
// doivent être lisibles par le décodeur JS du web et redonner les mêmes jardins que le golden.
// Usage : (gradle :core:test) puis  node tools/verify-transfer-kotlin.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { decodeGarden } from '../../jardin/transfer.js';

const here = dirname(fileURLToPath(import.meta.url));
const codes = JSON.parse(readFileSync(resolve(here, '../core/build/transfer-kotlin-codes.json'), 'utf8'));
const golden = JSON.parse(readFileSync(resolve(here, '../golden/transfer.json'), 'utf8'));
const pick = (g) => ({ name: g.name, boundary: g.boundary, zones: g.zones.map((z) => ({ id: z.id, type: z.type, plantings: z.plantings.map((p) => ({ plantId: p.plantId, count: p.count })) })), items: g.items.map((i) => i.id), obstacles: g.obstacles.map((o) => o.id), svg: g.plan.svg ?? null });
let bad = 0;
for (const c of codes) {
  const exp = pick(golden.withCodes[c.i].decoded);
  for (const k of ['code', 'codeU']) {
    const got = pick(await decodeGarden(c[k]));
    const ok = JSON.stringify(got) === JSON.stringify(exp);
    if (!ok) { bad++; console.error(`jardin ${c.i} (${k}) : différence`, JSON.stringify(got).slice(0, 300), JSON.stringify(exp).slice(0, 300)); }
  }
}
if (bad) { console.error(`${bad} différence(s)`); process.exit(1); }
console.log(`ok : ${codes.length} jardins, codes Kotlin (v2 et v2u) relus par le JS`);

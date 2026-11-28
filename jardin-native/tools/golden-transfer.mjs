// Golden du transfert (transfer.js) : codes générés par le web (compressés par CompressionStream deflate-raw), à relire en Kotlin ;
// le format binaire doit rester identique dans les deux sens (voir aussi verify-transfer-kotlin.mjs).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { encodeGarden, decodeGarden, buildShareLink, buildAppLink, codeFromUrl, routeFromIncomingUrl, describeGarden, sizeInfo, QR_MAX_BYTES } from '../../jardin/transfer.js';
import { createGarden, createZone } from '../../jardin/model.js';
import { makeGardens } from './fixtures-jardins.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const gardens = makeGardens();
{
  const g = createGarden('Gros 🌳 é à ñ');
  g.id = 'g-gros'; g.createdAt = g.updatedAt = '2026-01-01T00:00:00.000Z';
  g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }]; g.boundaryClosed = true; g.status = 'validated';
  g.plan = { svg: '<svg>' + 'x'.repeat(5000) + '</svg>', validatedAt: '2026-01-01', views: { 'iso-ne': '<svg>' + 'y'.repeat(8000) + '</svg>' } };
  g.context.gpsSurveyDraft = { points: Array.from({ length: 50 }, (_, i) => ({ x: i, y: i })) };
  g.context.region = 'Bretagne';
  g.obstacles.push({ id: 'o1', kind: 'tree', center: { x: 2, y: 2 }, radius: 2, height: 6 });
  const z = createZone('lawn', { kind: 'polygon', points: g.boundary }); z.id = 'z1'; z.photos = ['data:image/png;base64,AAAA']; z.history = [1, 2, 3];
  z.plantings.push({ plantId: 'p1', count: 3 }, { plantId: 'p2', count: 2, plantedAt: '2026-05-01' });
  g.zones.push(z);
  gardens.push(g);
}
const withCodes = [];
for (const g of gardens) {
  const code = await encodeGarden(g);
  const decoded = await decodeGarden(code);
  withCodes.push({ code, decoded, length: code.length });
}
// repli non compressé
const CS = globalThis.CompressionStream;
globalThis.CompressionStream = undefined;
const codesU = [];
for (const g of gardens) { const code = await encodeGarden(g); codesU.push({ code, decoded: await decodeGarden(code) }); }
globalThis.CompressionStream = CS;

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const oldGarden = { name: 'Ancien', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }], zones: [], context: { soil: 'clay', location: { lat: 1, lon: 2 } }, sun: { mode: 'uniform', uniform: 'full' } };
const oldJson = JSON.stringify({ format: 'jardin-v1', garden: oldGarden });
const oldCodes = [
  'v1u.' + b64u(Buffer.from(oldJson)),
  'v1.' + b64u(deflateRawSync(Buffer.from(oldJson))),
];
const custom = [];
const raw = (o) => 'v1u.' + b64u(Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)));
const cases = [
  ...oldCodes, raw({ format: 'jardin-v1', garden: { boundary: [], zones: [] } }), raw({ format: 'jardin-v1', garden: { name: '', boundary: [{ x: 1, y: 1 }], context: null, sun: null, plan: null } }),
  raw({ format: 'jardin-v1', garden: { name: 'N', boundary: [{ x: 1, y: 'a' }] } }), raw({ format: 'jardin-v1', garden: { name: 'N', boundary: [{ x: 1, y: 1 }], zones: 'x' } }),
  raw({ format: 'jardin-v1', garden: { name: 'N', boundary: 'x' } }), raw({ format: 'autre', garden: {} }), raw({ a: 1 }), raw('[1,2]'), raw('pas du json'), raw({ format: 'jardin-v1', garden: null }),
  raw({ format: 'jardin-v1', garden: { name: 'Fusion', boundary: [], context: { soil: 'loam', location: { lat: 3, lon: 4 } }, sun: { mode: 'map', regions: [{ level: 'full', points: [{ x: 0, y: 0 }] }] }, plan: { svg: 'a', validatedAt: 'b' }, extraInconnu: { a: 1 } } }),
  '', 'abc', 'v1.', 'v1.@@@', 'v1.AAAA', 'v1u.AAAA', 'v9.AAAA', 'v2.zz.AAAA', 'v2.3.AAAA', 'v2u.', 'v2u.1.', 'v2.1.A', 'v10.abc', 'jardin-v1', 'V1U.AAAA',
  withCodes[1].code.slice(0, withCodes[1].code.length - 30), withCodes[1].code.slice(0, 20) + 'zzzz' + withCodes[1].code.slice(30),
  withCodes[1].code.replace(/(.{40})/g, '$1\n'), withCodes[1].code.replace(/(.{37})/g, '$1 \t'), encodeURIComponent(withCodes[1].code), '  ' + withCodes[2].code + '\r\n',
];
for (const c of cases) {
  try { custom.push({ c, decoded: await decodeGarden(c) }); } catch (e) { custom.push({ c, error: e.message }); }
}
const urlInputs = [
  'https://niafrond.github.io/jardin/#/import/v1.AbC-_123', 'jardin://import/v1.AbC-_123', 'JARDIN://IMPORT/v1.AbC-_123', 'intent://import/v1.AbC-_123#Intent;scheme=jardin;end',
  '  v1.AbC\n-_123 \n', 'bonjour', '', null, undefined, 'https://x/#/import/v2.5.abcde?x=1', 'https://x/#/import/v2.5.abcde#frag', 'https://x/#/import/v2.5.ab%2Dcde',
  withCodes[0].code, 'https://niafrond.github.io/jardin/#/import/' + withCodes[1].code, 'v1.AbC-_123 v1.zzz', 'https://x/#/IMPORT/v1.abc', 'v1', 'v1.', 'v.abc', 'v1u.', '#/import/', '#/import/v3.abc',
  'https://niafrond.github.io/jardin/', 'jardin://other/v1.abc', 'intent://import/v1.abc', 'https://x/#/import/v1.a%zz',
];
const urls = urlInputs.map((u) => ({ u, code: codeFromUrl(u), route: routeFromIncomingUrl(u) }));
const links = [['v1.AbC-_123', 'https://niafrond.github.io/jardin/'], ['v2.1.a', 'https://x/y#/import/old'], ['v1.a', ''], ['v1.a', null], ['v1.a', 'https://x/?q=1#h']]
  .map(([code, base]) => ({ code, base, share: buildShareLink(code, base), app: buildAppLink(code) }));
const descs = gardens.map((g) => describeGarden(g));
const extraDesc = [{ g: {}, d: describeGarden({}) }, { g: { name: 'X', boundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, d: describeGarden({ name: 'X', boundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }) }, { g: { zones: [{ plantings: [{ count: 0 }, {}, { count: 4 }] }], obstacles: [1, 2] }, d: describeGarden({ zones: [{ plantings: [{ count: 0 }, {}, { count: 4 }] }], obstacles: [1, 2] }) }];
const sizes = ['', 'v1.abc', 'v1.' + 'a'.repeat(1900), 'v1.' + 'a'.repeat(1917), 'v1.' + 'a'.repeat(1918), 'v1.' + 'a'.repeat(3000), null].map((c) => ({ c, s: sizeInfo(c) }));
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/transfer.json'), JSON.stringify({ qrMax: QR_MAX_BYTES, gardens, withCodes, codesU, custom, urls, links, descs, extraDesc, sizes }));
console.log('golden transfer ok', withCodes.map((w) => w.length).join(','));

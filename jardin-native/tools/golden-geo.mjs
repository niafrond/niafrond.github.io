// Golden de la géolocalisation (geo.js, parties pures : moyenne GPS, déclinaison, boussole, URL et réponses des services).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { averageSamples, geoErrorMessage, magneticDeclination, watchHeading, reverseCommune, searchAddress, fetchElevation } from '../../jardin/geo.js';

const here = dirname(fileURLToPath(import.meta.url));
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const ko = { ok: false, status: 500, json: async () => ({}) };

const sampleSets = [
  [{ lat: 10, lon: 10, accuracy: 1 }, { lat: 20, lon: 20, accuracy: 100 }],
  [{ lat: 47.2, lon: -1.55, accuracy: 5 }, { lat: 47.2001, lon: -1.5502, accuracy: 3.2 }, { lat: 47.1999, lon: -1.5499, accuracy: 8 }],
  [{ lat: 1, lon: 2 }], [{ lat: 1, lon: 2, accuracy: 0 }, { lat: 3, lon: 4, accuracy: 0.2 }], [{ lat: 48, lon: 2, accuracy: 12.5 }],
];
const averages = sampleSets.map((s) => ({ s, r: averageSamples(s) }));
const errorCodes = [1, 2, 3, 'denied', 'unavailable', 'timeout', 'unsupported', 'x', 4, 0].map((c) => ({ c: String(c), msg: geoErrorMessage({ code: c }) }));
errorCodes.push({ c: null, msg: geoErrorMessage(null) });
const dates = ['2026-01-01', '2025-12-31T23:00:00Z', '2030-07-15', '2020-03-10', '2026-12-31'];
const decl = [[48.85, 2.35], [48.4, -4.5], [48.6, 7.75], [43.3, 5.4], [0, 0], [51, 9.5]].flatMap(([la, lo]) => dates.map((d) => ({ la, lo, d, v: magneticDeclination(la, lo, new Date(d)) })));

function headings(alphas, lat, lon, kind) {
  const t = new EventTarget(); const seen = [];
  watchHeading((h) => seen.push(h), { target: t, lat, lon });
  for (const a of alphas) {
    const e = new Event(kind === 'webkit' ? 'deviceorientation' : 'deviceorientationabsolute');
    if (kind === 'webkit') e.webkitCompassHeading = a; else { e.alpha = a; e.absolute = true; }
    t.dispatchEvent(e);
  }
  return seen;
}
const seqs = [[90, 80, 70, 100, 359, 1, 2, 270, 90], [0, 0, 0], [10, 350, 10, 350, 180, 181, 179], [45.5, 46.25, 300.7]];
const heads = seqs.flatMap((a) => [
  { a, lat: null, lon: null, kind: 'abs', out: headings(a, undefined, undefined, 'abs') },
  { a, lat: 47.2, lon: -1.55, kind: 'abs', out: headings(a, 47.2, -1.55, 'abs') },
  { a, lat: 48.6, lon: 7.75, kind: 'webkit', out: headings(a, 48.6, 7.75, 'webkit') },
]);

const queries = ['1 rue X', ' ', 'a', 'Café de l’été & co ?', "l'église (Saint-Étienne)", 'a/b#c+d', '日本', 'x!*~'];
const searchUrls = []; const searchRes = [];
const features = [
  { features: [{ geometry: { coordinates: [2.35, 48.85] }, properties: { label: '1 rue X 75001 Paris' } }, { geometry: {}, properties: { label: 'sans coord' } }, { geometry: { coordinates: [3, 4] } }] },
  { features: [] }, {},
];
for (const q of queries) { let u = null; const r = await searchAddress(q, { fetchImpl: async (url) => { u = url; return ok(features[0]); } }); searchUrls.push({ q, url: u, r }); }
for (const f of features) searchRes.push({ f, r: await searchAddress('abc', { fetchImpl: async () => ok(f) }) });

const communes = [
  [{ nom: 'Nantes', code: '44109', codeDepartement: '44', codeRegion: '52', region: { code: '52', nom: 'Pays de la Loire' } }],
  [], {}, null, [{ nom: 'Ajaccio', code: '2A004', codeDepartement: '2A' }], [{ code: '1' }], [null],
];
const communeRes = [];
for (const c of communes) { let u = null; const r = await reverseCommune(47.2, -1.55, { fetchImpl: async (url) => { u = url; return ok(c); } }); communeRes.push({ c, r, u }); }
const communeUrls = [];
for (const [la, lo] of [[47.2, -1.55], [0, 0], [48.856614, 2.3522219]]) { let u = null; await reverseCommune(la, lo, { fetchImpl: async (url) => { u = url; return ok([]); } }); communeUrls.push({ la, lo, u }); }

const alt = [
  { ign: ok({ elevations: [412.3] }), om: ko }, { ign: ok({ elevations: [{ z: 12.5 }] }), om: ko }, { ign: ok({ elevations: [-99999] }), om: ok({ elevation: [150] }) },
  { ign: ko, om: ok({ elevation: 33 }) }, { ign: ko, om: ko }, { ign: ok({ elevations: [] }), om: ok({ elevation: [] }) }, { ign: ok({ elevations: ['12'] }), om: ok({ elevation: ['x'] }) },
  { ign: ok({}), om: ok({ elevation: [0] }) }, { ign: ok({ elevations: [-999] }), om: ko }, { ign: ok({ elevations: [-1000] }), om: ko },
];
const elevations = [];
for (const a of alt) {
  const urls = [];
  const r = await fetchElevation(45.5, 3.25, { fetchImpl: async (url) => { urls.push(url); return url.includes('geopf') ? a.ign : a.om; } });
  elevations.push({ ign: a.ign.ok ? await a.ign.json() : null, om: a.om.ok ? await a.om.json() : null, r, urls });
}
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/geo.json'), JSON.stringify({ averages, errorCodes, decl, heads, searchUrls, searchRes, communeRes, communeUrls, elevations }));
console.log('golden geo ok');

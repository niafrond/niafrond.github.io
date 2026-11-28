// Golden de massifs.js : espace libre, propositions de massifs, combinaison de plantes, zones, régénération, familles de
// couleurs, et tri V8 à comparateur aléatoire (le tri du JS dépend de l'ordre exact des comparaisons).
import { freezeNow, writeGolden } from './golden-lib.mjs';
import { recoGardens, SYNTH } from './fixtures-reco.mjs';
import { allPlants } from '../../jardin/catalog.js';
import { createGarden } from '../../jardin/model.js';
freezeNow();
const M = await import('../../jardin/massifs.js');

const gardens = recoGardens();
// jardin dont l'ensoleillement est estimé par le calcul (emplacement connu, aucun relevé) : chemin `estimateSunMap`
{
  const a = gardens.find((g) => g.name === 'A').garden;
  const e = JSON.parse(JSON.stringify(a));
  e.id = 'g-estim'; e.sun = { mode: 'unknown', uniform: null, regions: [] }; e.context.location = { lat: 48.85, lon: 2.35 }; e.context.departement = '75';
  gardens.push({ name: 'estim', garden: e });
}
const byName = (n) => gardens.find((g) => g.name === n).garden;
const out = { gardens: gardens.map((g) => ({ name: g.name, garden: g.garden })) };

// ---- espace libre
const fsOpts = [{}, { allowLawn: true, cell: 0.5 }, { margin: 0.6, clearances: { pool: 2, existing: 0.5, opening: 1.2 } }];
out.free = [];
for (const { name, garden: g } of gardens) {
  fsOpts.forEach((o, k) => {
    const fs = M.freeSpace(g, o);
    const dm = fs.distanceMap();
    out.free.push({
      g: name, k, cell: fs.cell, minX: fs.minX, minY: fs.minY, nx: fs.nx, ny: fs.ny, freeArea: fs.freeArea,
      grid: Array.from(fs.grid).join(''),
      dm: k === 0 ? Array.from(dm) : undefined,
      comps: fs.components().map((c) => ({ n: c.cells.length, a: c.areaM2, c: c.centroid, b: c.bounds })),
      probes: [[1, 1], [5, 5], [10.2, 4.4], [6, 8], [15, 7], [3, 11], [-1, 3]].map(([x, y]) => fs.isFree(x, y)),
    });
  });
}
out.freeOpts = fsOpts;

// ---- propositions
const bedOpts = [
  { seed: 1 },
  { seed: 2, style: 'borders', design: false },
  { seed: 3, style: 'islands', coverage: 0.3 },
  { seed: 4, ambiance: 'bucolique', budget: 800, palette: 'chaud' },
  { seed: 5, maintenance: 'low', allowLawn: true, coverage: 0.7, maxBeds: 5 },
  { seed: 2.5, ambiance: 'pollinisateurs', palette: 'blanc', minArea: 3, maxArea: 12 },
];
out.bedOpts = bedOpts;
out.beds = [];
for (const { name, garden: g } of gardens) {
  bedOpts.forEach((o, k) => {
    if ((name === 'vide' || name === 'nu') && k > 1) return;
    out.beds.push({ g: name, k, r: M.proposeBeds(g, o) });
  });
}

// ---- designBed
const poly = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const bed = (over = {}) => ({ id: 'b1', role: 'bordure', shape: poly(0, 5, 6, 1.5), areaM2: 9, widthM: 1.5, sunLevel: 'full', ...over });
const mk = (id, o) => ({ id, commonName: id, latinName: `${id} x`, category: 'perennial', heightAdult: 0.6, widthAdult: 0.5, sun: ['full'], hardiness: -20, water: 'medium', soil: [], foliage: 'deciduous', bloom: [6], zones: ['midplants'], maintenance: 'low', spacing: 0.5, priceEur: 5, priceUnit: 'plant', flowerColor: '#3355cc', ...o });
const custom = [mk('a', { bloom: [3, 4] }), mk('b', { bloom: [5, 6], heightAdult: 1.4 }), mk('c', { bloom: [7, 8], heightAdult: 0.3 }), mk('d', { bloom: [9, 10], heightAdult: 0.8, flowerColor: '#ffffff' }), mk('e', { bloom: [6, 7], heightAdult: 0.5 }), mk('f', { bloom: [8, 9], heightAdult: 1.8 })];
out.custom = custom;
const noSun = bed(); delete noSun.sunLevel;
const near = bed({ shape: poly(3, 4.1, 5, 0.9), areaM2: 4.5, widthM: 0.9 });
const designs = [
  ['A', bed(), { seed: 3, tminC: -15 }],
  ['A', bed({ sunLevel: 'partial' }), { seed: 1, tminC: -15 }],
  ['A', bed({ sunLevel: 'shade' }), { seed: 2, tminC: -15 }],
  ['A', bed(), { seed: 1, tminC: -15, ambiance: 'zen' }],
  ['A', bed(), { seed: 1, tminC: -15, ambiance: 'pollinisateurs' }],
  ['A', bed(), { seed: 4, tminC: -15, palette: 'froid' }],
  ['A', bed(), { seed: 2, palette: 'pastel', tminC: -10 }],
  ['A', bed(), { seed: 1, maintenance: 'none' }],
  ['A', bed(), { seed: 1, maintenance: 'low' }],
  ['A', bed(), { seed: 3, tminC: -15, budget: 150 }],
  ['A', bed(), { seed: 3, tminC: -15, budget: 30 }],
  ['A', near, { seed: 2, tminC: -15 }],
  ['A', bed({ shape: poly(0, 5, 6, 0.5), areaM2: 3, widthM: 0.5 }), { seed: 1, tminC: -15 }],
  ['A', bed({ shape: poly(0, 5, 6, 3), areaM2: 18, widthM: 3 }), { seed: 1, tminC: -15 }],
  ['A', bed({ role: 'haie-fleurie', widthM: 1.5 }), { seed: 5, tminC: -12 }],
  ['A', noSun, { seed: 1, tminC: -15 }],
  ['A', bed(), { seed: 1, plants: custom }],
  ['A', bed(), { seed: 1, tminC: -15, ambiance: 'bucolique', iterations: 150 }],
  ['A', bed(), { seed: 7, tminC: -15, iterations: 300 }],
  ['A', bed({ id: 'autre' }), { seed: 3, tminC: -15 }],
  ['A', bed(), { seed: 1, plants: [] }],
  ['big', bed({ shape: poly(8, 9, 4, 2), areaM2: 8, widthM: 2, sunLevel: 'partial' }), { seed: 1, tminC: -15 }],
  ['big', noSun, { seed: 2 }],
  ['big-m', bed(), { seed: 2 }],
  ['extra', bed({ ambiance: 'romantique' }), { seed: 2 }],
  ['main', bed(), { seed: 1 }],
  ['mixte', bed({ shape: poly(1, 1, 3, 3), areaM2: 8, widthM: 2.5 }), { seed: 6, ambiance: null }],
];
// jardin avec un arbre existant (sous-bois)
const under = JSON.parse(JSON.stringify(byName('big')));
under.existing = [{ id: 'e1', kind: 'tree', plantId: null, x: 10, y: 11, height: 9, width: 5, keep: true }];
out.under = under;
out.designs = designs.map(([gn, b, o]) => {
  const g = gn === 'under' ? under : byName(gn);
  return { g: gn, bed: b, opts: o, r: M.designBed(g, b, o) };
});
out.designs.push({ g: 'under', bed: bed({ shape: poly(8, 9, 4, 2), areaM2: 8, widthM: 2, sunLevel: 'partial' }), opts: { seed: 1, tminC: -15 }, r: M.designBed(under, bed({ shape: poly(8, 9, 4, 2), areaM2: 8, widthM: 2, sunLevel: 'partial' }), { seed: 1, tminC: -15 }) });

// ---- zones
const zoneFields = (z) => ({ id: z.id, type: z.type, label: z.label, shape: z.shape, plantings: z.plantings, ambiance: z.ambiance, auto: z.auto, autoInfo: z.autoInfo });
out.zones = [];
for (const gn of ['A', 'big', 'extra']) {
  const g = byName(gn);
  const beds = M.proposeBeds(g, { seed: 4, ambiance: 'bucolique' });
  out.zones.push({ g: gn, k: 0, beds, r: M.bedsToZones(g, beds, { ambiance: 'bucolique' }).map(zoneFields) });
  out.zones.push({ g: gn, k: 1, beds, r: M.bedsToZones(g, beds).map(zoneFields) });
  out.zones.push({ g: gn, k: 2, beds, r: M.bedsToZones(g, beds, { startIndex: 5, ambiance: null }).map(zoneFields) });
}
{
  const g = byName('big');
  const beds = M.proposeBeds(g, { seed: 4 });
  const hand = [
    { id: 'x', role: 'bordure', shape: beds[0].shape, plantings: [{ plantId: 'h-trefle-nain', count: 5 }] },
    { id: 'y', role: 'bordure', shape: beds[0].shape, plantings: [{ plantId: 'h-miscanthus', count: 3 }] },
    { id: 'w', role: 'haie-fleurie', shape: beds[0].shape, plantings: [] },
    { id: 'v', role: 'bordure', shape: beds[0].shape, plantings: [] },
  ];
  out.hand = { g: 'big', beds: hand, r: M.bedsToZones(g, hand).map(zoneFields) };
  // numérotation après zones auto existantes
  const h2 = JSON.parse(JSON.stringify(g));
  const first = M.bedsToZones(h2, M.proposeBeds(h2, { seed: 1, maxBeds: 2, coverage: 0.3 }));
  h2.zones.push(...first);
  out.numbering = { garden: h2, r: M.bedsToZones(h2, M.proposeBeds(h2, { seed: 2, maxBeds: 1, coverage: 0.2 })).map(zoneFields) };
}
// régénération : massif gardé, massif manuel intact, graine suivante
out.regen = [];
for (const gn of ['A', 'big']) {
  const g = JSON.parse(JSON.stringify(byName(gn)));
  const first = M.regenerate(g, { seed: 1 });
  g.zones = first.zones;
  const keep = first.added[0]?.id;
  const second = M.regenerate(g, { keepIds: keep ? [keep] : [], seed: 7 });
  const third = M.regenerate(g, {});
  const fmt = (r) => ({ beds: r.beds, zones: r.zones.map(zoneFields), added: r.added.map((z) => z.id), kept: r.kept, removed: r.removed });
  out.regen.push({ g: gn, garden0: JSON.parse(JSON.stringify(byName(gn))), first: fmt(first), keep, second: fmt(second), third: fmt(third) });
}

// ---- couleurs
const hexes = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#fafafa', '#808080', '#ffcc00', '#cc3399', '#336699', 'ffaa00', '#abc', '', null, undefined, '#6b8e23', '#e6e6fa', '#ffd1dc', '#000000', '#f5deb3', '#ff7f50', '#9370db'];
out.colors = [...allPlants().map((p) => p.flowerColor), ...hexes].map((h) => ({ h: h ?? null, f: M.colorFamily(h) }));
out.families = M.COLOR_FAMILIES;

// ---- tri V8 avec comparateur à effets de bord
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
out.sorts = [];
for (const n of [0, 1, 2, 3, 5, 10, 31, 32, 33, 50, 63, 64, 65, 100, 127, 128, 200, 333, 500, 1000, 2500]) {
  for (const mode of ['random', 'sorted', 'reversed', 'runs']) {
    const rnd = mulberry(n * 7 + mode.length);
    let arr = Array.from({ length: n }, () => Math.floor(rnd() * 1000));
    if (mode === 'sorted') arr.sort((a, b) => a - b);
    if (mode === 'reversed') arr.sort((a, b) => b - a);
    if (mode === 'runs') { arr = arr.map((v, i) => (Math.floor(i / 17) % 2 ? v : 1000 - v + i)); }
    const dm = Float32Array.from(arr, (v) => v / 10);
    const idx = arr.map((_, i) => i);
    const r = mulberry(n * 31 + 5);
    idx.sort((a, b) => (dm[b] + r() * 0.8) - (dm[a] + r() * 0.8));
    out.sorts.push({ n, mode, dm: Array.from(dm), r: idx, calls: Math.floor(r() * 1e9) });
  }
}
writeGolden('massifs', out);

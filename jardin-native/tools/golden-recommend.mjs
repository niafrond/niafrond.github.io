// Golden de recommend.js : scorePlant (toutes les essences × contextes), recommandations par zone, quantités, cohérence,
// « Surprends-moi » (graines / ambiance / entretien / budget), suggestForGarden.
import { freezeNow, writeGolden } from './golden-lib.mjs';
import { recoGardens, SYNTH } from './fixtures-reco.mjs';
import { allPlants } from '../../jardin/catalog.js';
freezeNow();
const R = await import('../../jardin/recommend.js');

const plants = allPlants();
const all = [...plants, ...SYNTH];
const gardens = recoGardens();
const slim = (r) => ({ id: r.plant.id, score: r.score, status: r.status, ...(r.rank !== undefined ? { rank: r.rank } : {}), ...(r.forbidden ? { forbidden: true } : {}) });
const full = (r) => ({ ...slim(r), excluded: r.excluded, reasons: r.reasons });
const out = { synth: SYNTH, gardens: gardens.map((g) => ({ name: g.name, garden: g.garden })) };

// ---- scorePlant : toutes les essences × contextes
const base = { tminC: -5, zoneType: 'midplants', sunLevel: 'full', areaM2: 50, minDimension: 6 };
const ctxs = [
  base, { ...base, tminC: -12 }, { ...base, tminC: null, sunLevel: null }, { ...base, zoneType: 'trees', sunLevel: 'shade', soil: 'clay', windy: true, areaM2: 5, minDimension: 2 },
  { ...base, zoneType: 'hedge', sunLevel: 'partial', soil: 'sandy', windy: false, areaM2: 1, minDimension: 0.5 }, { ...base, ambiance: 'mediterraneen' }, { ...base, ambiance: 'zen', zoneType: 'lowplants' },
  { ...base, ambiance: 'sauvage', zoneType: 'hedge' }, { ...base, maintenance: 'low' }, { ...base, maintenance: 'none', ambiance: 'bucolique' }, { ...base, zoneType: 'pond', pondArea: 2, pondDepth: 40, sunLevel: 'partial' },
  { ...base, zoneType: 'pond', pondArea: 30, pondDepth: 90 }, { ...base, zoneType: 'pond', pondArea: 8 }, { ...base, zoneType: 'vegetable', soil: 'loam', areaM2: 0, minDimension: 0 }, { ...base, ambiance: 'inconnue', maintenance: 'green' },
  { zoneType: 'lawn' }, { ...base, zoneType: 'orchard', soil: 'limestone', windy: true, ambiance: 'gourmand', maintenance: 'low' },
];
out.ctxs = ctxs.map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null)));
out.score = ctxs.map((c) => all.map((p) => full({ plant: p, ...R.scorePlant(p, c) })));
out.small = all.filter((p) => R.isSmallShrub(p)).map((p) => p.id);

// ---- contexte + recommandations par zone
out.zones = gardens.map(({ name, garden: g }) => g.zones.map((z) => {
  const cz = (opt) => { const c = R.contextForZone(g, z, opt); return Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== undefined)); };
  const rec = (opt) => R.recommendForZone(g, z, { plants: all, ...opt });
  return {
    g: name, z: z.id,
    ctx: cz(), ctxNoAmb: cz({ ambiance: null }), ctxAmb: cz({ ambiance: 'zen', maintenance: 'none' }),
    resolve: R.resolveAmbiance(z),
    rec: rec().map(slim),
    recAll: rec({ includeDiscouraged: true, includeForbidden: true }).map(slim),
    recFirst: rec({ includeDiscouraged: true }).slice(0, 3).map(full),
    recFiltered: rec({ filters: { melliferous: true, heightMax: 2 } }).map((r) => r.plant.id),
    recMaint: rec({ maintenance: 'none', ambiance: 'bucolique' }).map(slim),
    qty: all.map((p) => R.suggestQuantity(p, z)),
  };
}));

// ---- cohérence
out.coherence = gardens.map(({ name, garden: g }) => ({ g: name, r: R.checkCoherence(g, { plants: all }) }));

// ---- « Surprends-moi »
const seeds = [1, 2, 7, 'abc', '3:1'];
const sels = [{}, { ambiance: 'bucolique' }, { maintenance: 'none' }, { budget: 150 }, { max: 6, ambiance: null }];
out.sel = [];
for (const { name, garden: g } of gardens) {
  for (const z of g.zones) {
    if (z.type === 'pool' || z.type === 'path') continue;
    for (const seed of seeds) for (let k = 0; k < sels.length; k++) {
      if (k > 0 && seed !== 1 && seed !== 'abc') continue;
      out.sel.push({ g: name, z: z.id, seed, k, r: R.suggestSelection(g, z, { seed, plants: all, ...sels[k] }) });
    }
  }
}
out.selOpts = sels;
out.forGarden = [];
for (const { name, garden: g } of gardens) {
  const amb = Object.fromEntries(g.zones.slice(0, 3).map((z, i) => [z.id, i === 1 ? null : 'zen']));
  out.forGarden.push({ g: name, k: 0, ambiances: amb, r: R.suggestForGarden(g, { seed: 4, plants: all, ambiances: amb }) });
  out.forGarden.push({ g: name, k: 1, r: R.suggestForGarden(g, { seed: 'x', plants: all, budget: 600, maintenance: 'low' }) });
}
writeGolden('recommend', out);

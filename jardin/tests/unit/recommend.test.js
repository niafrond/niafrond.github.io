import { scorePlant, recommendForZone, suggestQuantity, checkCoherence, suggestSelection } from '../../recommend.js';

const sq = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const mk = (o) => ({
  id: 'p', commonName: 'Plante', latinName: 'Plantus', category: 'perennial', heightAdult: 0.6, widthAdult: 0.5,
  sun: ['full', 'partial'], hardiness: -20, water: 'medium', soil: [], foliage: 'deciduous', bloom: [6],
  zones: ['midplants'], maintenance: 'low', kc: 0.7, spacing: 0.5, ...o,
});
const garden = (zones, ctx = {}) => ({
  id: 'g', context: { departement: '75', altitude: null, soil: null, wind: null, ...ctx },
  sun: { mode: 'uniform', uniform: 'full', regions: [] }, zones,
});
const zone = (id, type, shape, plantings = [], label) => ({ id, type, label: label || id, shape, plantings, notes: '' });
const baseCtx = { tminC: -8, zoneType: 'midplants', sunLevel: 'full', areaM2: 10, minDimension: 3, soil: null, windy: null };

describe('scorePlant', () => {
  test('idéale : tout est satisfait, raisons lisibles en français', () => {
    const r = scorePlant(mk({ hardiness: -15 }), baseCtx);
    expect(r.status).toBe('ideal');
    expect(r.score).toBeGreaterThanOrEqual(90);
    const rus = r.reasons.find((x) => x.criterion === 'rusticité');
    expect(rus.ok).toBe(true);
    expect(rus.text).toBe('Résiste au gel jusqu\'à −15 °C (votre secteur : −8 °C)');
  });
  test('exclusion dure si rusticité insuffisante', () => {
    const r = scorePlant(mk({ hardiness: -5 }), baseCtx);
    expect(r.excluded).toBe(true);
    expect(r.score).toBe(0);
    expect(r.status).toBe('discouraged');
    expect(r.reasons.find((x) => x.criterion === 'rusticité').ok).toBe(false);
  });
  test('rusticité juste : avertissement', () => {
    const r = scorePlant(mk({ hardiness: -9 }), baseCtx);
    expect(r.excluded).toBe(false);
    expect(r.reasons.find((x) => x.criterion === 'rusticité').ok).toBeNull();
  });
  test('soleil : pénalité croissante, inconnu = pas de pénalité', () => {
    const shade = scorePlant(mk({ sun: ['shade'] }), baseCtx);
    const part = scorePlant(mk({ sun: ['partial'] }), baseCtx);
    const unknown = scorePlant(mk({ sun: ['shade'] }), { ...baseCtx, sunLevel: null });
    expect(shade.score).toBeLessThan(part.score);
    expect(part.score).toBeLessThan(100);
    expect(unknown.score).toBe(scorePlant(mk(), { ...baseCtx, sunLevel: null }).score);
    expect(unknown.reasons.some((x) => x.criterion === 'soleil' && x.ok === null)).toBe(true);
  });
  test('sol, vent', () => {
    expect(scorePlant(mk({ soil: ['limestone'] }), { ...baseCtx, soil: 'clay' }).score).toBeLessThan(100);
    expect(scorePlant(mk({ soil: ['clay'] }), { ...baseCtx, soil: 'clay' }).reasons.some((x) => x.criterion === 'sol' && x.ok)).toBe(true);
    const windy = scorePlant(mk(), { ...baseCtx, windy: true });
    const tol = scorePlant(mk({ windTolerant: true }), { ...baseCtx, windy: true });
    expect(windy.score).toBeLessThan(tol.score);
  });
  test('place : largeur adulte vs dimension, surface', () => {
    const wide = scorePlant(mk({ widthAdult: 4 }), { ...baseCtx, minDimension: 1.5, areaM2: 30 });
    expect(wide.reasons.find((x) => x.criterion === 'place').ok).toBe(false);
    expect(wide.score).toBeLessThan(80);
    const small = scorePlant(mk({ widthAdult: 3 }), { ...baseCtx, minDimension: 5, areaM2: 3 });
    expect(small.reasons.find((x) => x.criterion === 'place').ok).toBe(false);
  });
  test('type de zone absent de plant.zones : déconseillée', () => {
    const r = scorePlant(mk({ zones: ['pond'] }), baseCtx);
    expect(r.status).toBe('discouraged');
    expect(r.reasons.find((x) => x.criterion === 'zone').ok).toBe(false);
  });
  test('score borné 0–100', () => {
    const r = scorePlant(mk({ sun: ['shade'], zones: [], soil: ['clay'], widthAdult: 9 }), { ...baseCtx, soil: 'sandy', windy: true, areaM2: 1, minDimension: 1 });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('recommendForZone', () => {
  const plants = [
    mk({ id: 'a', commonName: 'Alpha' }),
    mk({ id: 'b', commonName: 'Bravo', sun: ['shade'] }),
    mk({ id: 'c', commonName: 'Charlie', hardiness: -2 }),
    mk({ id: 'd', commonName: 'Delta', zones: ['pond'] }),
    mk({ id: 'e', commonName: 'Echo', hardiness: -15, melliferous: true }),
  ];
  const z = zone('z1', 'midplants', sq(0, 0, 4, 3));
  const g = garden([z]);
  test('trié par score, discouraged masquées, exclusion dure absente', () => {
    const r = recommendForZone(g, z, { plants });
    expect(r.map((x) => x.plant.id)).not.toContain('c');
    expect(r.map((x) => x.plant.id)).not.toContain('d');
    expect(r[0].score).toBeGreaterThanOrEqual(r[r.length - 1].score);
    expect(r.every((x) => x.status !== 'discouraged')).toBe(true);
  });
  test('includeDiscouraged affiche les déconseillées mais jamais les exclues', () => {
    const r = recommendForZone(g, z, { plants, includeDiscouraged: true });
    const idsR = r.map((x) => x.plant.id);
    expect(idsR).toContain('d');
    expect(idsR).not.toContain('c');
  });
  test('filtres appliqués', () => {
    const r = recommendForZone(g, z, { plants, filters: { melliferous: true } });
    expect(r.map((x) => x.plant.id)).toEqual(['e']);
  });
  test('altitude durcit le climat', () => {
    const p12 = [mk({ id: 'm', hardiness: -12 })];
    expect(recommendForZone(g, z, { plants: p12 })).toHaveLength(1);
    const cold = garden([z], { altitude: 1000 }); // -9 - 6 = -15 °C
    expect(recommendForZone(cold, z, { plants: p12 })).toHaveLength(0);
  });
});

describe('suggestQuantity', () => {
  test('surface / spacing²', () => {
    expect(suggestQuantity(mk({ spacing: 0.5 }), zone('z', 'midplants', sq(0, 0, 4, 3)))).toBe(48);
    expect(suggestQuantity(mk({ spacing: 1 }), zone('z', 'midplants', sq(0, 0, 2, 2)))).toBe(4);
  });
  test('arbre : 1', () => {
    expect(suggestQuantity(mk({ category: 'tree', spacing: 4 }), zone('z', 'trees', sq(0, 0, 10, 10)))).toBe(1);
  });
  test('haie (ligne) : longueur / spacing', () => {
    const h = zone('h', 'hedge', { kind: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 1 });
    expect(suggestQuantity(mk({ category: 'hedge', spacing: 1 }), h)).toBe(10);
    expect(suggestQuantity(mk({ category: 'hedge', spacing: 0.8 }), h)).toBe(13);
  });
  test('minimum 1', () => {
    expect(suggestQuantity(mk({ spacing: 5 }), zone('z', 'midplants', sq(0, 0, 1, 1)))).toBe(1);
  });
});

describe('checkCoherence', () => {
  const plants = [
    mk({ id: 'tall', commonName: 'Chêne', category: 'tree', heightAdult: 15, widthAdult: 8, spacing: 8 }),
    mk({ id: 'dry', commonName: 'Lavande', water: 'low' }),
    mk({ id: 'wet', commonName: 'Hortensia', water: 'high' }),
    mk({ id: 'inv', commonName: 'Renouée', invasive: true }),
    mk({ id: 'tox', commonName: 'Laurier-rose', toxic: true }),
  ];
  const texts = (g) => checkCoherence(g, { plants });
  test('jardin sans problème', () => {
    const g = garden([zone('a', 'midplants', sq(0, 0, 4, 4), [{ plantId: 'dry', count: 5 }])]);
    expect(texts(g)).toEqual([]);
  });
  test('surdensité', () => {
    const g = garden([zone('a', 'midplants', sq(0, 0, 2, 2), [{ plantId: 'dry', count: 40 }])]);
    const r = texts(g);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ level: 'warn', zoneId: 'a' });
    expect(r[0].text).toMatch(/surdensité/);
  });
  test('arbre haut près d\'une terrasse ou piscine (< 3 m)', () => {
    const g = garden([
      zone('t', 'trees', { kind: 'circle', center: { x: 0, y: 0 }, radius: 1 }, [{ plantId: 'tall', count: 1 }]),
      zone('ter', 'terrace', sq(2.5, -1, 3, 2)),
      zone('far', 'pool', sq(20, 0, 4, 3)),
    ]);
    const r = texts(g).filter((x) => /moins de 3 m/.test(x.text));
    expect(r).toHaveLength(1);
    expect(r[0].text).toMatch(/terrasse/);
    expect(r[0].zoneId).toBe('t');
  });
  test('besoins en eau mélangés', () => {
    const g = garden([zone('a', 'midplants', sq(0, 0, 6, 6), [{ plantId: 'dry', count: 3 }, { plantId: 'wet', count: 3 }])]);
    expect(texts(g).some((x) => /eau/.test(x.text))).toBe(true);
  });
  test('invasive et toxique', () => {
    const g = garden([
      zone('a', 'midplants', sq(0, 0, 6, 6), [{ plantId: 'inv', count: 2 }]),
      zone('v', 'vegetable', sq(10, 0, 6, 6), [{ plantId: 'tox', count: 2 }]),
      zone('m', 'midplants', sq(20, 0, 6, 6), [{ plantId: 'tox', count: 2 }]),
    ]);
    const r = texts(g);
    expect(r.some((x) => /invasive/.test(x.text) && x.zoneId === 'a')).toBe(true);
    expect(r.some((x) => /toxique/.test(x.text) && x.zoneId === 'v')).toBe(true);
    expect(r.some((x) => /toxique/.test(x.text) && x.zoneId === 'm')).toBe(false);
  });
});

describe('suggestSelection', () => {
  const plants = [
    mk({ id: 'g1', commonName: 'Couvre-sol', category: 'groundcover', heightAdult: 0.2, bloom: [3, 4] }),
    mk({ id: 'g2', commonName: 'Couvre-sol 2', category: 'groundcover', heightAdult: 0.25, bloom: [3, 4] }),
    mk({ id: 'v1', commonName: 'Vivace', heightAdult: 0.8, bloom: [6, 7, 8] }),
    mk({ id: 's1', commonName: 'Arbuste', category: 'shrub', heightAdult: 2.5, widthAdult: 1.5, spacing: 1.5, bloom: [10, 11] }),
    mk({ id: 'inv', commonName: 'Invasive', invasive: true, heightAdult: 1, bloom: [1, 2, 3, 4, 5, 9] }),
    mk({ id: 'frile', commonName: 'Frileuse', hardiness: 0 }),
  ];
  const z = zone('z', 'midplants', sq(0, 0, 5, 4));
  const g = garden([z]);
  test('déterministe pour une graine donnée', () => {
    const plantsM = plants.map((p) => ({ ...p, zones: ['midplants'] }));
    expect(suggestSelection(g, z, { seed: 42, plants: plantsM })).toEqual(suggestSelection(g, z, { seed: 42, plants: plantsM }));
  });
  test('exclut invasives et plantes trop frileuses, étage les hauteurs et étale la floraison', () => {
    const z9 = zone('z9', 'midplants', sq(0, 0, 3, 3)); // 9 m² : 3 essences
    const r = suggestSelection(garden([z9]), z9, { seed: 7, plants });
    const idsR = r.map((x) => x.plantId);
    expect(idsR).not.toContain('inv');
    expect(idsR).not.toContain('frile');
    expect(idsR).toContain('s1');
    expect(idsR).toContain('v1');
    expect(idsR.filter((i) => i.startsWith('g'))).toHaveLength(1);
    expect(r.every((x) => x.count >= 1)).toBe(true);
  });
  test('zone sans candidat : liste vide', () => {
    expect(suggestSelection(g, z, { seed: 1, plants: [] })).toEqual([]);
  });
  test('graines différentes peuvent donner des résultats différents mais valides', () => {
    const many = Array.from({ length: 12 }, (_, i) => mk({ id: `x${i}`, commonName: `X${i}`, heightAdult: 0.3 + (i % 4), bloom: [(i % 12) + 1] }));
    const sets = new Set([1, 2, 3, 4, 5, 6].map((s) => suggestSelection(g, z, { seed: s, plants: many }).map((x) => x.plantId).join(',')));
    expect(sets.size).toBeGreaterThan(1);
  });
});

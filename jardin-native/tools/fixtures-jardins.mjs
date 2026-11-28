// Jardins de test déterministes (ids fixes) construits avec les créateurs du modèle JS, partagés par les golden
// pricing / shopping / advice / watering / transfer. Les essences viennent du catalogue réel + quelques essences synthétiques.
import { createGarden, createZone, createItem } from '../../jardin/model.js';
import { createExisting } from '../../jardin/existing.js';
import { allPlants } from '../../jardin/catalog.js';

const sq = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const circ = (x, y, r) => ({ kind: 'circle', center: { x, y }, radius: r });
const line = (pts, width = 1) => ({ kind: 'line', points: pts.map(([x, y]) => ({ x, y })), width });

/** Essences synthétiques (champs complets : kc, hardiness, water…) pour couvrir les cas limites de prix et de conseils. */
export const SYNTH = [
  { id: 'syn-sans-prix', commonName: 'Plante sans prix', latinName: 'Nullus pretium', category: 'perennial', heightAdult: 0.5, widthAdult: 0.5, hardiness: -10, water: 'medium', kc: 0.7, bloom: [6, 7, 8], care: {} },
  { id: 'syn-bulbe', commonName: 'Bulbe test', latinName: 'Bulbus testus', category: 'bulb', heightAdult: 0.3, widthAdult: 0.1, hardiness: -12, water: 'low', kc: 0.5, bloom: [3, 4], priceEur: 0.35, priceUnit: 'bulb', priceNote: 'bulbe calibre 10/12', care: { plantMonths: [9, 10, 11], pruneMonths: [], fertMonths: [3] } },
  { id: 'syn-semis', commonName: 'Légume de semis', latinName: 'Semen testum', category: 'vegetable', heightAdult: 0.6, widthAdult: 0.3, hardiness: 0, water: 'high', kc: 1.1, bloom: [], priceEur: 2.1, priceUnit: 'plant', priceNote: 'semis (graines)', care: { plantMonths: [4, 5], pruneMonths: [], fertMonths: [5] }, harvest: [7, 8, 9] },
  { id: 'syn-racines-nues', commonName: 'Fruitier racines nues', latinName: 'Malus nudus', category: 'fruit', heightAdult: 4, widthAdult: 3, hardiness: -20, water: 'medium', kc: 0.8, bloom: [4, 5], priceEur: 24.9, priceUnit: 'plant', priceNote: 'racines nues', care: { plantMonths: [12, 1, 2], pruneMonths: [1, 2], fertMonths: [3], planting: 'Planter hors gel.' }, harvest: [9, 10] },
  { id: 'syn-frileuse', commonName: 'Frileuse du sud', latinName: 'Tenera australis', category: 'shrub', heightAdult: 1.5, widthAdult: 1.2, hardiness: 2, water: 'low', kc: 0.5, bloom: [5, 6, 9, 10], priceEur: 9.5, priceUnit: 'plant', priceNote: 'pot 3 L', care: { plantMonths: [4, 5], pruneMonths: [6], fertMonths: [], pruning: 'Rabattre au printemps.' } },
  { id: 'syn-gazon-m2', commonName: 'Gazon test', latinName: 'Lolium testum', category: 'lawn', heightAdult: 0.1, widthAdult: 0.1, hardiness: -20, water: 'medium', kc: 0.8, bloom: [], priceEur: 0.6, priceUnit: 'm2', priceNote: 'semences, ≈ 30 g/m²', care: {} },
  { id: 'syn-ba-prix', commonName: 'Écharpe d’eau', latinName: 'Aqua testa', category: 'aquatic', heightAdult: 0.3, widthAdult: 0.5, hardiness: -15, water: 'high', kc: 1, bloom: [7], priceEur: 0.1, priceUnit: 'plant', priceNote: '  ', care: {} },
];

const pick = (cat, n = 2) => allPlants().filter((p) => p.category === cat).slice(0, n).map((p) => p.id);

export function makeGardens() {
  const gardens = [];
  const fin = (g, name) => {
    g.id = `g-${name}`; g.createdAt = g.updatedAt = '2026-01-01T00:00:00.000Z';
    g.zones.forEach((z, i) => { z.id = `z${i + 1}`; });
    g.items.forEach((it, i) => { it.id = `i${i + 1}`; });
    (g.existing || []).forEach((e, i) => { e.id = `e${i + 1}`; });
    gardens.push(g);
    return g;
  };
  const addZone = (g, type, shape, plantings = [], label) => {
    const z = createZone(type, shape);
    if (label !== undefined) z.label = label;
    z.plantings = plantings;
    g.zones.push(z);
    return z;
  };

  // 0 : vide
  fin(createGarden('Vide'), 'vide');

  // 1 : mixte complet, sol argileux, plein soleil
  {
    const g = createGarden('Mixte é ñ');
    g.boundary = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 10 }, { x: 0, y: 10 }]; g.boundaryClosed = true;
    g.context.soil = 'clay'; g.context.roofArea = 42; g.context.location = { lat: 47.2, lon: -1.55 };
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const [t1, t2] = pick('tree'); const [f1] = pick('fruit'); const [s1, s2] = pick('shrub'); const [h1, h2] = pick('hedge');
    const [c1] = pick('climber'); const [p1, p2, p3] = pick('perennial', 3); const [g1] = pick('groundcover'); const [gr1] = pick('grass');
    const [b1, b2] = pick('bulb'); const [a1, a2] = pick('aquatic'); const [v1, v2, v3] = pick('vegetable', 3); const [l1] = pick('lawn');
    addZone(g, 'lawn', sq(0, 0, 6, 5), [{ plantId: l1, count: 1 }], 'Pelouse');
    addZone(g, 'trees', circ(10, 3, 3), [{ plantId: t1, count: 2 }, { plantId: t2, count: 1 }, { plantId: f1, count: 1, plantedAt: '2026-03-01' }], '');
    addZone(g, 'midplants', sq(0, 6, 5, 3), [{ plantId: p1, count: 8 }, { plantId: p2, count: 5 }, { plantId: p3, quantity: 4 }, { plantId: b1, count: 25 }, { plantId: gr1, count: 3 }], 'Massif fleuri');
    addZone(g, 'hedge', line([[0, 0.2], [14, 0.2]], 0.8), [{ plantId: h1, count: 14 }, { plantId: h2, count: 6 }], 'Haie nord');
    addZone(g, 'tallplants', sq(6, 6, 4, 3), [{ plantId: s1, count: 3 }, { plantId: s2, count: 2 }, { plantId: c1, count: 2 }, { plantId: g1, count: 10 }], '');
    addZone(g, 'vegetable', sq(10, 6, 4, 3), [{ plantId: v1, count: 6 }, { plantId: v2, count: 4 }, { plantId: v3, count: 10 }, { plantId: b2, count: 0 }], 'Potager');
    addZone(g, 'pond', circ(4, 3, 1.5), [{ plantId: a1, count: 3 }, { plantId: a2, count: 2 }], '');
    addZone(g, 'terrace', sq(6, 0, 4, 3), [], 'Terrasse');
    g.items.push(createItem('bench', 7, 1), createItem('pergola', 8, 1.5, 15), createItem('fountain', 4, 3), createItem('raised_bed', 12, 8), createItem('table_round', 8, 2));
    g.items[0].label = 'Banc du fond'; g.items[3].width = 0;
    const ex1 = createExisting('tree', { x: 2, y: 8 }); ex1.plantId = t1;
    const ex2 = createExisting('shrub', { x: 12, y: 1 });
    const ex3 = createExisting('hedge', [{ x: 0, y: 9.5 }, { x: 5, y: 9.5 }]); ex3.plantId = h1; ex3.notes = 'Taillée en mars';
    const ex4 = createExisting('fence', [{ x: 14, y: 0 }, { x: 14, y: 10 }]);
    const ex5 = createExisting('climber', { x: 1, y: 1 }); ex5.keep = false;
    const ex6 = createExisting('perennial', { x: 5, y: 9 }); ex6.plantId = p1;
    const ex7 = createExisting('tree', { x: 13, y: 9 }); ex7.keep = false; ex7.label = 'Vieux noyer';
    const ex8 = createExisting('other', { x: 7, y: 9 });
    g.existing.push(ex1, ex2, ex3, ex4, ex5, ex6, ex7, ex8);
    fin(g, 'mixte');
  }

  // 2 : essences synthétiques, sol sableux, mi-ombre, plantes jeunes, essences sans prix
  {
    const g = createGarden('Synthèse');
    g.boundary = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }]; g.boundaryClosed = true;
    g.context.soil = 'sandy'; g.context.location = { lat: 43.6, lon: 3.9 };
    g.sun = { mode: 'uniform', uniform: 'partial', regions: [] };
    addZone(g, 'midplants', sq(0, 0, 4, 3), [{ plantId: 'syn-sans-prix', count: 5 }, { plantId: 'syn-bulbe', count: 30 }, { plantId: 'syn-frileuse', count: 2, plantedAt: '2026-05-20' }], 'Massif');
    addZone(g, 'vegetable', sq(4, 0, 4, 3), [{ plantId: 'syn-semis', count: 12 }, { plantId: 'syn-racines-nues', count: 1 }, { plantId: 'plante-inexistante', count: 3 }], 'Potager');
    addZone(g, 'lawn', sq(0, 3, 8, 3), [{ plantId: 'syn-gazon-m2', count: 1 }], '');
    addZone(g, 'pond', circ(6, 4.5, 1), [{ plantId: 'syn-ba-prix', count: 4 }], 'Mare');
    addZone(g, 'lowplants', sq(0, 0, 0, 0), [{ plantId: 'syn-bulbe', count: 2 }], '');
    g.items.push(createItem('shed_item', 1, 1), createItem('greenhouse', 5, 4), createItem('trampoline', 3, 3));
    g.items[2].radius = 1.2;
    fin(g, 'synth');
  }

  // 3 : plantes à eau variée, limon, ombre, beaucoup de ligneux et arbres, pas d'existant
  {
    const g = createGarden('Verger');
    g.boundary = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 15 }, { x: 0, y: 15 }]; g.boundaryClosed = true;
    g.context.soil = 'loam'; g.context.location = { lat: 48.85, lon: 2.35 };
    g.sun = { mode: 'uniform', uniform: 'shade', regions: [] };
    const fruits = pick('fruit', 6);
    addZone(g, 'orchard', sq(0, 0, 12, 10), fruits.map((id, i) => ({ plantId: id, count: i + 1 })), 'Verger');
    addZone(g, 'trees', sq(12, 0, 8, 10), pick('tree', 4).map((id, i) => ({ plantId: id, count: 1 + (i % 2) })), '');
    addZone(g, 'hedge', line([[0, 14], [20, 14]], 1), pick('hedge', 4).map((id) => ({ plantId: id, count: 7 })), 'Haie');
    addZone(g, 'midplants', sq(0, 10, 8, 3), pick('climber', 3).concat(pick('shrub', 3)).map((id) => ({ plantId: id, count: 2 })), 'Massif sous arbres');
    addZone(g, 'vegetable', sq(8, 10, 6, 3), pick('vegetable', 8).map((id, i) => ({ plantId: id, count: 3 + i })), 'Potager');
    fin(g, 'verger');
  }

  // 4 : jardin dont les sections sont vides ou à plantations absentes ; pelouse sans essence ; sans soleil connu
  {
    const g = createGarden('Sans soleil');
    g.boundary = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]; g.boundaryClosed = true;
    g.context.soil = 'humus';
    addZone(g, 'lawn', sq(0, 0, 5, 3), [], 'Gazon vide');
    addZone(g, 'pond', circ(2, 4, 0.8), [], '');
    addZone(g, 'vegetable', sq(0, 3, 3, 2), [], '');
    addZone(g, 'path', line([[0, 2.5], [5, 2.5]], 1), [], '');
    addZone(g, 'trees', circ(4, 4, 1), [], '');
    addZone(g, 'other', sq(0, 0, 2, 2), [{ plantId: pick('perennial', 1)[0], count: 2, plantedAt: '2025-12-01' }], 'Divers');
    fin(g, 'nu');
  }
  return gardens;
}

/** Résolveur d'essences : catalogue réel + synthétiques. */
export function plantsMap() {
  return new Map([...allPlants(), ...SYNTH].map((p) => [p.id, p]));
}

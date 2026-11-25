// Jardin de test partagé par les tests de rendu : 12×8 m fermé, essences à couleurs connues (injectées via plantLookup).
import { createGarden, createZone } from '../../model.js';

export const PLANTS = {
  cerisier: { id: 'cerisier', commonName: 'Cerisier à fleurs', category: 'tree', heightAdult: 6, widthAdult: 4, spacing: 4, foliage: 'deciduous', bloom: [4], flowerColor: '#ff66aa', foliageColor: '#2f8f3f' },
  lavande: { id: 'lavande', commonName: 'Lavande vraie', category: 'perennial', heightAdult: 0.6, widthAdult: 0.5, spacing: 0.4, foliage: 'evergreen', bloom: [6, 7], flowerColor: '#7744cc', foliageColor: '#6f8f6a' },
  rosier: { id: 'rosier', commonName: 'Rosier arbustif', category: 'shrub', heightAdult: 1.2, widthAdult: 1, spacing: 0.8, foliage: 'deciduous', bloom: [6, 7, 8, 9], flowerColor: '#dd1122', foliageColor: '#2e7d4a' },
  buis: { id: 'buis', commonName: 'Buis', category: 'hedge', heightAdult: 1.5, widthAdult: 0.8, spacing: 0.5, foliage: 'evergreen', bloom: [], flowerColor: null, foliageColor: '#1f6f3a' },
  gazon: { id: 'gazon', commonName: 'Gazon rustique', category: 'lawn', heightAdult: 0.1, widthAdult: 1, spacing: 1, foliage: 'evergreen', bloom: [], flowerColor: null, foliageColor: '#88c057' },
  carotte: { id: 'carotte', commonName: 'Carotte', category: 'vegetable', heightAdult: 0.3, widthAdult: 0.1, spacing: 0.15, foliage: 'deciduous', bloom: [], flowerColor: null, foliageColor: '#5aa03a' },
};
export const lookup = (id) => PLANTS[id];

const poly = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });

export function jardin() {
  const g = createGarden('Jardin <test>');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  g.context.northAngle = 20;
  const pelouse = createZone('lawn', poly(0.3, 3.5, 11.7, 7.7)); pelouse.id = 'z-pelouse';
  pelouse.plantings = [{ plantId: 'gazon', count: 1 }];
  const massif = createZone('midplants', poly(0.5, 2.2, 6, 3.4)); massif.id = 'z-massif'; massif.label = 'Massif';
  massif.plantings = [{ plantId: 'lavande', count: 12 }, { plantId: 'rosier', count: 3 }];
  const arbre = createZone('trees', { kind: 'circle', center: { x: 9, y: 5.5 }, radius: 1.6 }); arbre.id = 'z-arbre';
  arbre.plantings = [{ plantId: 'cerisier', count: 1 }];
  const haie = createZone('hedge', { kind: 'line', points: [{ x: 0.5, y: 7.6 }, { x: 11.5, y: 7.6 }], width: 0.8 }); haie.id = 'z-haie';
  haie.plantings = [{ plantId: 'buis', count: 12 }];
  g.zones.push(pelouse, massif, arbre, haie);
  g.obstacles.push({ id: 'maison', kind: 'house', points: [{ x: 1, y: 0.2 }, { x: 8, y: 0.2 }, { x: 8, y: 1.8 }, { x: 1, y: 1.8 }], height: 5 });
  return g;
}
export const NO_LEGEND = { legend: false, names: false, dims: false };

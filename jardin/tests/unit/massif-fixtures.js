// Jardins de test pour les massifs automatiques (pas un fichier de test).
import { createGarden, createZone, createItem } from '../../model.js';

export const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });

/** Rectangle 12 × 9 m : maison au nord, terrasse, pelouse, banc, piscine. */
export function gardenA() {
  const g = createGarden('Test A');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 9 }, { x: 0, y: 9 }];
  g.boundaryClosed = true;
  g.context.departement = '75';
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  g.obstacles = [{ id: 'maison', kind: 'house', points: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 1.6 }, { x: 0, y: 1.6 }], height: 6 }];
  g.zones = [
    createZone('terrace', rect(3, 1.6, 5, 2.4)),
    createZone('lawn', rect(3, 5, 5, 3)),
    createZone('pool', { kind: 'circle', center: { x: 10.2, y: 6.2 }, radius: 1 }),
  ];
  g.items = [createItem('bench', 1, 4, 0)];
  return g;
}

/** Grand jardin d'environ 300 m² (20 × 15) avec maison, terrasse, pelouse, mobilier, arbres et mare. */
export function gardenBig() {
  const g = createGarden('Test grand');
  g.boundary = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 15 }, { x: 0, y: 15 }];
  g.boundaryClosed = true;
  g.context.departement = '69';
  g.sun = { mode: 'uniform', uniform: 'partial', regions: [] };
  g.boundaryEdges = [{ kind: 'fence' }, { kind: 'hedge' }, { kind: 'wall' }, { kind: 'fence' }];
  g.obstacles = [
    { id: 'maison', kind: 'house', points: [{ x: 4, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 3 }, { x: 4, y: 3 }], height: 6 },
    { id: 'abri', kind: 'shed', points: [{ x: 17, y: 11 }, { x: 19.5, y: 11 }, { x: 19.5, y: 13.5 }, { x: 17, y: 13.5 }], height: 2.3 },
    { id: 'arbre', kind: 'tree', center: { x: 3, y: 11 }, radius: 2, height: 7 },
  ];
  g.zones = [
    createZone('terrace', rect(6, 3, 8, 4)),
    createZone('lawn', rect(5, 8.5, 9, 5)),
    createZone('pond', { kind: 'circle', center: { x: 16, y: 7 }, radius: 1.2 }),
    createZone('path', { kind: 'line', points: [{ x: 10, y: 7 }, { x: 10, y: 8.5 }], width: 1 }),
  ];
  g.items = [createItem('table', 9, 5, 0), createItem('bench', 2, 6, 90)];
  return g;
}

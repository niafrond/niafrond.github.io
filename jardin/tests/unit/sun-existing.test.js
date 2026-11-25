import { createGarden, createZone } from '../../model.js';
import { shadowObstacles, zoneSunLevel, estimateSunMap } from '../../sun.js';
import { createExisting } from '../../existing.js';

function jardin() {
  const g = createGarden('s');
  g.boundary = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }];
  g.boundaryClosed = true;
  g.context.location = { lat: 47, lon: 2 }; // nord = haut du plan
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  return g;
}
const zone = (x, y) => createZone('lawn', { kind: 'polygon', points: [{ x, y }, { x: x + 2, y }, { x: x + 2, y: y + 2 }, { x, y: y + 2 }] });

test('un arbre existant entre dans les obstacles d’ombre', () => {
  const g = jardin(); g.existing = [createExisting('tree', { x: 10, y: 6 })];
  expect(shadowObstacles(g).some((o) => o.existing && o.kind === 'tree')).toBe(true);
});
test('un arbre existant au sud ombrage la zone voisine (plein soleil -> moins)', () => {
  const g = jardin();
  const z = zone(9, 3.5); // au nord de l'arbre : l'ombre tombe vers le nord à midi
  expect(zoneSunLevel(g, z).dominant).toBe('full');
  const t = createExisting('tree', { x: 10, y: 6.5 }); t.height = 12; t.width = 6;
  g.existing = [t];
  const apres = zoneSunLevel(g, z);
  expect(['partial', 'shade']).toContain(apres.dominant);
  // une zone lointaine reste ensoleillée
  expect(zoneSunLevel(g, zone(1, 9)).dominant).toBe('full');
  // « à retirer » : plus d'ombre
  t.keep = false;
  expect(zoneSunLevel(g, z).dominant).toBe('full');
});
test('estimateSunMap tient compte des existants', () => {
  const g = jardin();
  const avant = estimateSunMap(g).filter((r) => r.level !== 'full').length;
  const t = createExisting('tree', { x: 10, y: 6 }); t.height = 12; g.existing = [t];
  expect(estimateSunMap(g).filter((r) => r.level !== 'full').length).toBeGreaterThan(avant);
});

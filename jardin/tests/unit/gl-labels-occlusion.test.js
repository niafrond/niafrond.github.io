import { occludedKeys } from '../../gl-labels.js';
const g = (key, x, z, h, r) => ({ key, radius: r, heightM: h, anchor: { x, y: h + 0.3, z } });

test('un arbre devant cache le nom de la plante derrière lui', () => {
  const cam = { x: 0, y: 3, z: 20 };
  const tree = g('arbre', 0, 10, 8, 2); const lav = g('lavande', 0, 0, 0.6, 1);
  const hid = occludedKeys([tree, lav], cam);
  expect(hid.has('lavande')).toBe(true);
  expect(hid.has('arbre')).toBe(false);
});
test('vue de haut ou décalée : rien n\'est caché', () => {
  const tree = g('arbre', 0, 10, 8, 2); const lav = g('lavande', 0, 0, 0.6, 1);
  expect(occludedKeys([tree, lav], { x: 0, y: 60, z: 12 }).size).toBe(0);
  expect(occludedKeys([tree, lav], { x: 15, y: 3, z: 20 }).size).toBe(0);
});
test('le groupe sélectionné n\'est jamais masqué ; un obstacle plus bas que le rayon ne cache pas', () => {
  const cam = { x: 0, y: 3, z: 20 };
  expect(occludedKeys([g('arbre', 0, 10, 8, 2), g('l', 0, 0, 0.6, 1)], cam, { keep: 'l' }).size).toBe(0);
  expect(occludedKeys([g('bas', 0, 10, 0.3, 2), g('haut', 0, 0, 6, 1)], { x: 0, y: 8, z: 20 }).size).toBe(0);
});

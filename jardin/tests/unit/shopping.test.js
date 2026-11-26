import { createGarden, createZone, createItem } from '../../model.js';
import { allPlants } from '../../catalog.js';
import { gardenCost } from '../../pricing.js';
import { shoppingList, shoppingByPeriod, suppliesList, itemsToBuy, monthsText, periodOf, SUPPLY } from '../../shopping.js';

const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const by = (c) => allPlants().filter((p) => p.category === c && typeof p.priceEur === 'number');
function jardin() {
  const g = createGarden('Courses');
  g.boundary = r(0, 0, 12, 8).points; g.boundaryClosed = true;
  const m = createZone('midplants', r(0, 0, 6, 3)); m.label = 'Massif';
  m.plantings = [{ plantId: by('perennial')[0].id, count: 5 }, { plantId: by('shrub')[0].id, count: 2 }, { plantId: by('climber')[0].id, count: 1 }];
  const t = createZone('trees', { kind: 'circle', center: { x: 9, y: 5 }, radius: 1.5 }); t.label = 'Arbres';
  t.plantings = [{ plantId: by('tree')[0].id, count: 2 }, { plantId: by('perennial')[0].id, count: 3 }];
  const l = createZone('lawn', r(0, 3, 6, 5)); l.plantings = [{ plantId: by('lawn')[0].id, count: 1 }];
  g.zones = [m, t, l];
  g.items = [createItem('bench', 3, 3), createItem('pergola', 8, 2)];
  return g;
}

describe('listes de courses', () => {
  const g = jardin();
  test('regroupement par catégorie et format, sous-totaux et total = gardenCost', () => {
    const s = shoppingList(g);
    expect(s.groups.map((x) => x.id)).toEqual(['trees', 'shrubs', 'climbers', 'perennials', 'lawn']);
    for (const grp of s.groups) {
      expect(grp.formats.flatMap((f) => f.lines)).toHaveLength(grp.lines.length);
      expect(Math.round(grp.lines.reduce((a, l) => a + l.total, 0) * 100) / 100).toBe(grp.subtotal);
    }
    expect(s.total).toBeCloseTo(gardenCost(g, (id) => allPlants().find((p) => p.id === id)).total, 2);
    const viv = s.groups.find((x) => x.id === 'perennials').lines.find((l) => l.plantId === by('perennial')[0].id);
    expect(viv.qty).toBe(8); // 5 + 3 : fusion entre zones
    expect(viv.zoneIds).toHaveLength(2);
    const lawn = s.groups.find((x) => x.id === 'lawn').lines[0];
    expect(lawn.unit).toBe('m2'); expect(lawn.qty).toBeCloseTo(30, 1);
  });
  test('par zone : mêmes totaux', () => {
    const s = shoppingList(g);
    expect(s.byZone).toHaveLength(3);
    expect(Math.round(s.byZone.reduce((a, z) => a + z.total, 0) * 100) / 100).toBe(s.total);
  });
  test('par période de plantation', () => {
    const p = shoppingByPeriod(g);
    expect(p.length).toBeGreaterThan(0);
    expect(p.find((x) => x.id === 'sow').lines.some((l) => l.plant.category === 'lawn')).toBe(true);
    expect(p.flatMap((x) => x.lines)).toHaveLength(shoppingList(g).lines.length);
    expect(periodOf({ category: 'shrub', priceNote: 'racines nues', care: { plantMonths: [12, 1, 2, 11] } })).toBe('winter');
    expect(periodOf({ category: 'shrub', care: { plantMonths: [10, 11] } })).toBe('autumn');
    expect(periodOf({ category: 'perennial', care: { plantMonths: [3, 4] } })).toBe('spring');
  });
  test('fournitures arrondies au sac et au lot', () => {
    const s = suppliesList(g);
    const ids = s.lines.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['compost', 'mulch', 'fert', 'stakes', 'ties', 'trellis', 'water']));
    const c = s.lines.find((l) => l.id === 'compost');
    expect(c.packs).toBe(Math.ceil(c.qty / SUPPLY.compostBagL));
    expect(c.total).toBeCloseTo(c.packs * SUPPLY.compostBagPrice, 2);
    expect(s.lines.find((l) => l.id === 'stakes').packs).toBe(2);
    expect(s.lines.find((l) => l.id === 'trellis').packs).toBe(1);
  });
  test('aménagements', () => {
    const it = itemsToBuy(g);
    expect(it.lines).toHaveLength(2);
    expect(it.total).toBe(90 + 900);
  });
  test('jardin sans plantation : sections vides', () => {
    const e = createGarden('Vide'); e.zones = [createZone('terrace', r(0, 0, 3, 3))];
    expect(shoppingList(e).groups).toEqual([]); expect(shoppingList(e).total).toBe(0);
    expect(shoppingByPeriod(e)).toEqual([]);
    expect(suppliesList(e).lines).toEqual([]);
    expect(itemsToBuy(e)).toEqual({ lines: [], total: 0 });
  });
  test('texte des mois', () => { expect(monthsText([11, 10, 3])).toBe('mars, oct. à nov.'); expect(monthsText([])).toBe(''); });
});

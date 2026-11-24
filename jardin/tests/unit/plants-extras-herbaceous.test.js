import plants from '../../data/plants/herbaceous.js';
import extras from '../../data/plants/extras-herbaceous.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const UNITS = ['plant', 'bulb', 'm2'];

describe('extras herbacées', () => {
  test('couvre exactement les ids de herbaceous.js', () => {
    const ids = plants.map((p) => p.id).sort();
    expect(Object.keys(extras).sort()).toEqual(ids);
  });

  test.each(Object.entries(extras))('%s : champs valides', (id, e) => {
    expect(typeof e.priceEur).toBe('number');
    expect(e.priceEur).toBeGreaterThan(0);
    expect(e.priceEur).toBeLessThan(200);
    expect(UNITS).toContain(e.priceUnit);
    expect(typeof e.priceNote).toBe('string');
    expect(e.priceNote.length).toBeGreaterThan(0);
    for (const c of [e.flowerColor, e.foliageColor]) {
      expect(c === null || HEX.test(c)).toBe(true);
    }
    expect(e.wiki === null || (typeof e.wiki === 'string' && e.wiki.length > 0)).toBe(true);
  });
});

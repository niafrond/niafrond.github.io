import plants from '../../data/plants/herbaceous.js';

const ZONES = ['pond', 'pool', 'terrace', 'path', 'lawn', 'lowplants', 'midplants', 'tallplants', 'hedge', 'trees', 'vegetable', 'orchard', 'other'];
const CATEGORIES = ['perennial', 'groundcover', 'grass', 'bulb', 'aquatic', 'vegetable', 'lawn'];
const SUNS = ['full', 'partial', 'shade'];
const WATERS = ['low', 'medium', 'high'];
const SOILS = ['clay', 'limestone', 'sandy', 'loam', 'humus'];
const FOLIAGES = ['deciduous', 'evergreen', 'semi', 'none'];
const MAINT = ['low', 'medium', 'high'];
const months = (a) => Array.isArray(a) && a.every((m) => Number.isInteger(m) && m >= 1 && m <= 12);
const str = (s) => typeof s === 'string' && s.trim().length > 0;

describe('catalogue herbacées', () => {
  test('au moins 70 entrées', () => {
    expect(plants.length).toBeGreaterThanOrEqual(70);
  });

  test('ids uniques en slug', () => {
    const ids = plants.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  test.each(plants.map((p) => [p.id, p]))('%s est valide', (_id, p) => {
    expect(str(p.commonName)).toBe(true);
    expect(str(p.latinName)).toBe(true);
    expect(CATEGORIES).toContain(p.category);
    expect(p.heightAdult).toBeGreaterThan(0);
    expect(p.widthAdult).toBeGreaterThan(0);
    expect(p.sun.length).toBeGreaterThan(0);
    p.sun.forEach((s) => expect(SUNS).toContain(s));
    expect(typeof p.hardiness).toBe('number');
    expect(p.hardiness).toBeLessThanOrEqual(5);
    expect(WATERS).toContain(p.water);
    expect(Array.isArray(p.soil)).toBe(true);
    p.soil.forEach((s) => expect(SOILS).toContain(s));
    expect(FOLIAGES).toContain(p.foliage);
    expect(months(p.bloom)).toBe(true);
    expect(p.zones.length).toBeGreaterThan(0);
    p.zones.forEach((z) => expect(ZONES).toContain(z));
    expect(MAINT).toContain(p.maintenance);
    expect(p.kc).toBeGreaterThanOrEqual(0.3);
    expect(p.kc).toBeLessThanOrEqual(1.1);
    expect(p.spacing).toBeGreaterThan(0);
    ['invasive', 'toxic', 'melliferous', 'edible', 'windTolerant'].forEach((k) => {
      if (k in p) expect(typeof p[k]).toBe('boolean');
    });
    if (p.edible) expect(months(p.harvest) && p.harvest.length > 0).toBe(true);
    if ('harvest' in p) expect(months(p.harvest)).toBe(true);
    const c = p.care;
    expect(c).toBeTruthy();
    ['plantMonths', 'pruneMonths', 'fertMonths'].forEach((k) => expect(months(c[k])).toBe(true));
    ['planting', 'pruning', 'fertilizer', 'watering', 'notes'].forEach((k) => expect(str(c[k])).toBe(true));
  });

  test('la jussie est marquée invasive', () => {
    expect(plants.find((p) => p.id === 'h-jussie').invasive).toBe(true);
  });
});

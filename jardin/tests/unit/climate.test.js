import { departements } from '../../data/climate.js';
import { climateForDepartement, regions, adjustTminForAltitude, hardinessZone, departementFromCommuneCode } from '../../climate.js';

describe('table climatique', () => {
  test('96 départements métropolitains, codes uniques, corse incluse', () => {
    expect(departements).toHaveLength(96);
    expect(new Set(departements.map((d) => d.code)).size).toBe(96);
    const codes = departements.map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(['01', '2A', '2B', '95']));
    expect(codes).not.toContain('20');
  });

  test('valeurs réalistes et complètes', () => {
    for (const d of departements) {
      expect(typeof d.name).toBe('string');
      expect(typeof d.region).toBe('string');
      expect(d.tminC).toBeGreaterThanOrEqual(-25);
      expect(d.tminC).toBeLessThanOrEqual(0);
      expect(d.rainMm).toBeGreaterThan(400);
      expect(d.rainMm).toBeLessThan(1500);
      expect(d.frostFreeFrom).toBeGreaterThanOrEqual(1);
      expect(d.frostFreeFrom).toBeLessThan(d.frostFreeTo);
      expect(d.frostFreeTo).toBeLessThanOrEqual(12);
      expect(d.zoneUSDA).toBe(hardinessZone(d.tminC));
    }
  });
});

describe('climate.js', () => {
  test('climateForDepartement', () => {
    expect(climateForDepartement('29').region).toBe('Bretagne');
    expect(climateForDepartement('2a').name).toBe('Corse-du-Sud');
    expect(climateForDepartement(7).code).toBe('07');
    expect(climateForDepartement('99')).toBeNull();
    expect(climateForDepartement(null)).toBeNull();
  });
  test('le littoral est plus doux que les Alpes', () => {
    expect(climateForDepartement('06').tminC).toBeGreaterThan(climateForDepartement('05').tminC);
  });
  test('regions triées sans doublon', () => {
    const r = regions();
    expect(r).toContain('Bretagne');
    expect(r).toContain('Corse');
    expect(new Set(r).size).toBe(r.length);
    expect(r).toEqual([...r].sort((a, b) => a.localeCompare(b, 'fr')));
  });
  test('adjustTminForAltitude : -0,6 °C / 100 m', () => {
    expect(adjustTminForAltitude(-10, 500)).toBe(-13);
    expect(adjustTminForAltitude(-10, 0)).toBe(-10);
    expect(adjustTminForAltitude(-10, null)).toBe(-10);
  });
  test('hardinessZone', () => {
    expect(hardinessZone(-15)).toBe('7a');
    expect(hardinessZone(-13)).toBe('7b');
    expect(hardinessZone(-7)).toBe('8b');
    expect(hardinessZone(-3)).toBe('9b');
    expect(hardinessZone(-20)).toBe('6b');
  });
  test('departementFromCommuneCode', () => {
    expect(departementFromCommuneCode('75056')).toBe('75');
    expect(departementFromCommuneCode('2A004')).toBe('2A');
    expect(departementFromCommuneCode('2B033')).toBe('2B');
    expect(departementFromCommuneCode('01001')).toBe('01');
    expect(departementFromCommuneCode('97411')).toBeNull();
    expect(departementFromCommuneCode('abc')).toBeNull();
    expect(departementFromCommuneCode(undefined)).toBeNull();
  });
});

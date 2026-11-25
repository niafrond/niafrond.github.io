import { allPlants, getPlant, searchPlants, filterPlants, normalizeText } from '../../catalog.js';

const P = [
  { id: 'lavande', commonName: 'Lavande', latinName: 'Lavandula angustifolia', category: 'shrub', heightAdult: 0.6, foliage: 'evergreen', bloom: [6, 7, 8], melliferous: true, maintenance: 'low', water: 'low' },
  { id: 'erable', commonName: 'Érable du Japon', latinName: 'Acer palmatum', category: 'tree', heightAdult: 5, foliage: 'deciduous', bloom: [4], maintenance: 'medium', water: 'medium', toxic: false },
  { id: 'buddleia', commonName: 'Arbre à papillons', latinName: 'Buddleja davidii', category: 'shrub', heightAdult: 3, foliage: 'deciduous', bloom: [7, 8, 9], melliferous: true, invasive: true, maintenance: 'low', water: 'medium' },
  { id: 'laurier', commonName: 'Laurier-rose', latinName: 'Nerium oleander', category: 'hedge', heightAdult: 3, foliage: 'evergreen', bloom: [6, 7], toxic: true, maintenance: 'medium', water: 'high' },
  { id: 'fraisier', commonName: 'Fraisier', latinName: 'Fragaria vesca', category: 'groundcover', heightAdult: 0.2, foliage: 'semi', bloom: [5], edible: true, maintenance: 'medium', water: 'medium' },
];
const ids = (l) => l.map((p) => p.id);

test('allPlants/getPlant restent utilisables (catalogue réel éventuellement vide)', () => {
  expect(Array.isArray(allPlants())).toBe(true);
  expect(getPlant('inexistant-xyz')).toBeNull();
});

test('normalizeText', () => {
  expect(normalizeText('  Érable  ')).toBe('erable');
});

describe('searchPlants', () => {
  test('sans accents, casse indifférente, nom commun ou latin', () => {
    expect(ids(searchPlants('erable', P))).toEqual(['erable']);
    expect(ids(searchPlants('ÉRABLE', P))).toEqual(['erable']);
    expect(ids(searchPlants('lavandula', P))).toEqual(['lavande']);
    expect(ids(searchPlants('arbre papillons', P))).toEqual(['buddleia']);
  });
  test('requête vide : tout ; sans résultat : vide', () => {
    expect(searchPlants('', P)).toHaveLength(5);
    expect(searchPlants('zzz', P)).toEqual([]);
  });
});

describe('filterPlants', () => {
  test('foliage, category, bloomMonth', () => {
    expect(ids(filterPlants(P, { foliage: 'evergreen' }))).toEqual(['lavande', 'laurier']);
    expect(ids(filterPlants(P, { category: 'tree' }))).toEqual(['erable']);
    expect(ids(filterPlants(P, { category: ['tree', 'hedge'] }))).toEqual(['erable', 'laurier']);
    expect(ids(filterPlants(P, { bloomMonth: 7 }))).toEqual(['lavande', 'buddleia', 'laurier']);
  });
  test('heightMax, melliferous, edible', () => {
    expect(ids(filterPlants(P, { heightMax: 1 }))).toEqual(['lavande', 'fraisier']);
    expect(ids(filterPlants(P, { melliferous: true }))).toEqual(['lavande', 'buddleia']);
    expect(ids(filterPlants(P, { edible: true }))).toEqual(['fraisier']);
  });
  test('lowMaintenance, lowWater, nonToxic, nonInvasive', () => {
    expect(ids(filterPlants(P, { lowMaintenance: true }))).toEqual(['lavande', 'buddleia']);
    expect(ids(filterPlants(P, { lowWater: true }))).toEqual(['lavande']);
    expect(ids(filterPlants(P, { nonToxic: true }))).not.toContain('laurier');
    expect(ids(filterPlants(P, { nonInvasive: true }))).not.toContain('buddleia');
  });
  test('combinaison et filtres vides', () => {
    expect(ids(filterPlants(P, { melliferous: true, nonInvasive: true }))).toEqual(['lavande']);
    expect(filterPlants(P, {})).toHaveLength(5);
    expect(filterPlants(P)).toHaveLength(5);
  });
});

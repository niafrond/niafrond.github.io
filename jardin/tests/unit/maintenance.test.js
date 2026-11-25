import { MAINTENANCE_LEVELS, getMaintenanceLevel, plantEffort, effortLabel, effortBadge, levelForZone, fitsMaintenance } from '../../maintenance.js';
import { plants } from '../../data/plants/index.js';

const by = (id) => plants.find((p) => p.id === id);

test('niveaux : green, low, none avec emoji, nom et description', () => {
  expect(MAINTENANCE_LEVELS.map((l) => l.id)).toEqual(['green', 'low', 'none']);
  for (const l of MAINTENANCE_LEVELS) { expect(l.label && l.emoji && l.desc).toBeTruthy(); }
  expect(getMaintenanceLevel('none').label).toBe('Pas d’entretien');
  expect(getMaintenanceLevel('x')).toBeUndefined();
});

test('plantEffort : gazon, potager et haies demandent 2 à 3', () => {
  for (const id of ['h-gazon-rustique', 'h-tomate', 'h-laitue', 'thuya', 'laurier-palme', 'charmille']) {
    expect(plantEffort(by(id))).toBeGreaterThanOrEqual(2);
  }
  expect(plantEffort(by('h-gazon-rustique'))).toBe(3);
  expect(plantEffort(by('h-tomate'))).toBe(3);
  expect(plantEffort(by('thuya'))).toBe(3);
});

test('plantEffort : graminées, couvre-sols et arbustes persistants rustiques = 1', () => {
  for (const id of ['h-miscanthus', 'h-stipa-tenuissima', 'h-pervenche', 'h-bugle', 'viorne-tin', 'aucuba', 'laurier-sauce']) {
    expect(plantEffort(by(id))).toBe(1);
  }
});

test('plantEffort : borné entre 1 et 3, valeur moyenne sans donnée', () => {
  expect(plantEffort({ maintenance: 'high', water: 'high', category: 'fruit' })).toBe(3);
  expect(plantEffort({ maintenance: 'low', category: 'grass' })).toBe(1);
  expect(plantEffort({})).toBe(2);
  expect(plantEffort({ maintenance: 'low', care: { pruneMonths: [1, 2, 3] } })).toBe(2);
  expect(plantEffort({ maintenance: 'medium', windTolerant: true, water: 'low' })).toBe(1);
  expect(plants.every((p) => [1, 2, 3].includes(plantEffort(p)))).toBe(true);
});

test('distribution : au moins 40 essences d\'effort 1 (et des 2 et des 3)', () => {
  const n = (e) => plants.filter((p) => plantEffort(p) === e).length;
  expect(n(1)).toBeGreaterThanOrEqual(40);
  expect(n(2)).toBeGreaterThan(10);
  expect(n(3)).toBeGreaterThan(10);
});

test('libellés d\'effort', () => {
  expect([1, 2, 3].map(effortLabel)).toEqual(['léger', 'moyen', 'soutenu']);
  expect(effortBadge(2)).toBe('🧤×2');
});

test('levelForZone : zone > jardin > green', () => {
  expect(levelForZone({ context: { maintenance: 'low' } }, { maintenance: 'none' })).toBe('none');
  expect(levelForZone({ context: { maintenance: 'low' } }, {})).toBe('low');
  expect(levelForZone({ context: {} }, {})).toBe('green');
  expect(levelForZone(null, null)).toBe('green');
  expect(levelForZone({ context: { maintenance: 'zzz' } }, { maintenance: 'yyy' })).toBe('green');
});

test('fitsMaintenance : green ne restreint rien', () => {
  for (const p of plants) expect(fitsMaintenance(p, 'green')).toMatchObject({ ok: true, penalty: 0, discouraged: false });
  expect(fitsMaintenance(by('h-tomate'), null).ok).toBe(true);
});

test('fitsMaintenance : peu d\'entretien', () => {
  expect(fitsMaintenance(by('h-miscanthus'), 'low').ok).toBe(true);
  const r = fitsMaintenance(by('h-tomate'), 'low');
  expect(r).toMatchObject({ ok: false, penalty: 25, discouraged: false });
  expect(r.text).toBe('Demande pas mal d’entretien : déconseillée si vous voulez peu d’entretien');
});

test('fitsMaintenance : pas d\'entretien', () => {
  const ok = fitsMaintenance(by('h-miscanthus'), 'none');
  expect(ok).toMatchObject({ ok: true, penalty: 0, bonus: 10, text: 'Très peu d’entretien : on plante et on oublie' });
  const two = plants.find((p) => plantEffort(p) === 2);
  expect(fitsMaintenance(two, 'none')).toMatchObject({ ok: false, penalty: 30, discouraged: false });
  expect(fitsMaintenance(by('h-tomate'), 'none')).toMatchObject({ ok: false, discouraged: true });
});

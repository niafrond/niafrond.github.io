import { plants, plantsById } from '../../data/plants/index.js';

describe('catalogue complet', () => {
  test('ids uniques entre fichiers et au moins 150 essences', () => {
    expect(plants.length).toBeGreaterThanOrEqual(150);
    expect(Object.keys(plantsById).length).toBe(plants.length);
  });
});

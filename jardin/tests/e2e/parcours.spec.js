// Parcours complet de l'app Jardin : jardin pré-rempli → toutes les étapes → validation → conseils.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';

test('parcours : étapes, rendu, validation, conseils', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);

  // Jardin 10 × 8 m, Île-de-France, 2 zones plantées, créé via le modèle puis stocké.
  const id = await page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const { plants } = await import('./data/plants/index.js');
    const g = createGarden('Jardin test');
    g.context.departement = '75'; g.context.region = 'Île-de-France';
    g.context.orientation = 180; g.context.northAngle = 180;
    g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    g.wishedZoneTypes = ['lawn', 'midplants'];
    const lawn = createZone('lawn', { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 7 }, { x: 1, y: 7 }] });
    const mid = createZone('midplants', { kind: 'polygon', points: [{ x: 7, y: 1 }, { x: 9.5, y: 1 }, { x: 9.5, y: 7 }, { x: 7, y: 7 }] });
    const pick = plants.find((p) => p.category === 'perennial' && p.hardiness <= -10);
    mid.plantings = [{ plantId: pick.id, count: 6 }];
    g.zones = [lawn, mid];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });

  for (const step of ['context', 'boundary', 'wished', 'sun', 'zones', 'items', 'plants']) {
    await page.goto(`${URL}#/garden/${id}/${step}`);
    await page.waitForTimeout(300);
    await expect(page.locator('#app')).not.toContainText('écran en cours de chargement');
    await expect(page.locator('#app svg, #app .step, #app section').first()).toBeVisible();
  }

  await page.goto(`${URL}#/garden/${id}/render`);
  await expect(page.locator('#app svg').first()).toBeVisible();
  await page.getByRole('button', { name: /valider/i }).first().click();
  await page.waitForFunction(async (gid) => (await window.__jardin.storage.getGarden(gid)).status === 'validated', id);

  await page.goto(`${URL}#/garden/${id}/advice`);
  await expect(page.locator('#app')).toContainText(/arrosage/i);

  await page.goto(`${URL}#/settings`);
  await expect(page.locator('#app')).toContainText(/notification/i);

  expect(errors).toEqual([]);
});

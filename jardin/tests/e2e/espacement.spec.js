// Espacements : « Surprends-moi » en zone d'arbres tient dans la capacité ; trop de plants → avertissement ; « Ajuster automatiquement » corrige.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNk+M/AQAJgGlUwEhQAAJ8gARAYF3ItAAAAAElFTkSuQmCC';
const SHOT = process.env.SHOT_DIR;

async function jardinArbres(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Espacement');
    g.context.departement = '75';
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const z = createZone('trees', { kind: 'polygon', points: [{ x: 3, y: 1.5 }, { x: 8.3, y: 1.5 }, { x: 8.3, y: 6.8 }, { x: 3, y: 6.8 }] });
    z.id = 'z-arbres'; z.label = 'Coin des arbres';
    g.zones = [z];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
}

test('espacement : Surprends-moi tient dans la capacité, l’ajout excessif avertit, « Ajuster automatiquement » corrige', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://fr.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'standard', thumbnail: { source: PNG }, content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Test' } } }) }));
  const id = await jardinArbres(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}#/garden/${id}/plants`);
  await page.waitForSelector('#btn-surprise');

  await page.locator('#btn-surprise').click();
  await page.locator('[data-act=amb-ok]').click();
  await expect(page.locator('#proposal-summary')).toContainText('espacements respectés');
  await expect(page.locator('[data-role=spacing-warning][data-kind=surdensite]')).toHaveCount(0);

  const verif = () => page.evaluate(async (i) => {
    await window.__jardin.flush?.();
    const g = await window.__jardin.storage.getGarden(i);
    const { packZone, minDistance } = await import('./spacing.js');
    const { getPlant } = await import('./catalog.js');
    const z = g.zones[0];
    const r = packZone(z, z.plantings, getPlant, { garden: g });
    let min = true;
    for (let a = 0; a < r.positions.length; a++) for (let b = a + 1; b < r.positions.length; b++) {
      const p = r.positions[a]; const q = r.positions[b];
      if (Math.hypot(p.x - q.x, p.y - q.y) < minDistance(getPlant(p.plantId), getPlant(q.plantId)) - 1e-6) min = false;
    }
    return { overflow: r.overflow.length, min, n: r.positions.length, counts: z.plantings.map((x) => x.count) };
  }, id);
  const apres = await verif();
  expect(apres.overflow).toBe(0);
  expect(apres.min).toBe(true);
  expect(apres.n).toBeGreaterThan(2);
  await page.locator('[data-role=spacing-box]').scrollIntoViewIfNeeded();
  if (SHOT) await page.screenshot({ path: `${SHOT}/espacement-propose.png` });

  // trop de plants à la main : avertissement
  const plus = page.locator('.chosen-row [aria-label=Plus]').last();
  for (let i = 0; i < 40; i++) await plus.click();
  await expect(page.locator('[data-role=spacing-warning][data-kind=surdensite]').first()).toBeVisible();
  await expect(page.locator('[data-role=density].over').first()).toBeVisible();
  await page.locator('[data-act=spacing-fix]').scrollIntoViewIfNeeded();
  if (SHOT) await page.screenshot({ path: `${SHOT}/espacement-avertissements.png` });

  // ajustement automatique
  await page.locator('[data-act=spacing-fix]').click();
  await expect(page.locator('[data-role=spacing-warning][data-kind=surdensite]')).toHaveCount(0);
  const fin = await verif();
  expect(fin.overflow).toBe(0);
  expect(fin.min).toBe(true);
  expect(errors).toEqual([]);
});

// Étape essences : vignettes, prix, budget, « Surprends-moi pour tout le jardin », annulation.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
// PNG 8×8 uni (vert), servi comme « vignette Wikipédia » interceptée.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNk+M/AQAJgGlUwEhQAAJ8gARAYF3ItAAAAAElFTkSuQmCC';

async function jardin12x8(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Plantes');
    g.context.departement = '75';
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    const m = createZone('midplants', r(0, 0, 12, 3)); m.label = 'Massif de vivaces';
    const p = createZone('lawn', r(0, 3, 12, 5)); p.label = 'Pelouse';
    g.zones = [m, p];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  return id;
}

test('essences : vignettes, prix, budget, proposition pour tout le jardin puis annulation', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  let wikiCalls = 0;
  await page.route('https://fr.wikipedia.org/api/rest_v1/page/summary/**', (route) => {
    wikiCalls++;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'standard', thumbnail: { source: PNG }, content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Test' } } }) });
  });
  const id = await jardin12x8(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}#/garden/${id}/plants`);
  await page.waitForSelector('.plant-card');

  // vignettes : repli immédiat, puis photo paresseuse + crédit
  await expect(page.locator('.plant-card').first().locator('.plant-thumb')).toBeVisible();
  await expect(page.locator('.plant-card').first().locator('.thumb-box img')).toBeVisible();
  await expect(page.locator('.plant-card').first().locator('.photo-credit')).toHaveText('Photo : Wikipédia');
  expect(wikiCalls).toBeGreaterThan(0);
  expect(wikiCalls).toBeLessThan(40); // chargement paresseux : pas tout le catalogue

  // prix, couleurs, floraison
  await expect(page.locator('.plant-card [data-role=price]').first()).toContainText('≈');
  await expect(page.locator('.plant-card .swatch').first()).toContainText(/Fleurs|Feuillage/);

  // fiche détail
  await page.locator('.plant-card .plant-thumb').first().click();
  await expect(page.locator('[data-role=plant-detail]')).toBeVisible();
  await expect(page.locator('[data-role=plant-detail] img')).toBeVisible();
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/plantes-detail.png` : undefined });
  await page.locator('[data-act=close-detail]').click();
  await expect(page.locator('[data-role=plant-detail]')).toHaveCount(0);

  // ajout manuel → budget
  await expect(page.locator('#budget-bar')).toContainText('Budget estimé ≈ 0 €');
  await expect(page.locator('#budget-bar')).toContainText('prix moyens en jardinerie, à titre indicatif');
  await page.locator('.plant-card .btn-primary').first().click();
  await expect(page.locator('#budget-bar [data-role=budget-main]')).not.toHaveText('Budget estimé ≈ 0 €');

  // proposition pour tout le jardin
  await page.locator('#btn-surprise-all').click();
  await expect(page.locator('#proposal-summary')).toContainText(/essences?, floraison de .+ à .+, ≈ \d/);
  const lire = () => page.evaluate(async (i) => { await window.__jardin.flush?.(); return (await window.__jardin.storage.getGarden(i)).zones.map((z) => z.plantings); }, id);
  const apres = await lire();
  expect(apres[0].length).toBeGreaterThan(0);
  expect(apres[1].length).toBeGreaterThan(0);
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/plantes-proposition.png` : undefined });

  // annulation : retour à la sélection précédente (1 essence ajoutée dans la zone 1, pelouse vide)
  await page.locator('#btn-undo').click();
  const retour = await lire();
  expect(retour[0]).toHaveLength(1);
  expect(retour[1]).toHaveLength(0);
  await expect(page.locator('#btn-undo')).toBeHidden();
  expect(errors).toEqual([]);
});

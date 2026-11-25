// Niveau d'entretien : sélecteur, recommandations, enregistrement, « Surprends-moi ».
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNk+M/AQAJgGlUwEhQAAJ8gARAYF3ItAAAAAElFTkSuQmCC';

async function creerJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Entretien');
    g.context.departement = '75';
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    const m = createZone('midplants', r(0, 0, 12, 4)); m.label = 'Massif de vivaces';
    const b = createZone('lowplants', r(0, 4, 12, 4)); b.label = 'Coin tranquille';
    g.zones = [m, b];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
}

test('entretien : « Pas d\'entretien » change les recommandations et le Surprends-moi', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://fr.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ type: 'standard', thumbnail: { source: PNG }, content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Test' } } }),
  }));
  const id = await creerJardin(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}#/garden/${id}/plants`);
  await page.waitForSelector('.plant-card');

  const shot = (n) => process.env.SHOT_DIR ? page.screenshot({ path: `${process.env.SHOT_DIR}/${n}.png` }) : null;
  await expect(page.locator('[data-role=garden-maintenance]')).toBeVisible();
  await expect(page.locator('[data-role=garden-maintenance] [aria-checked=true]')).toHaveAttribute('data-maintenance', 'green');
  await shot('entretien-entete');
  const avant = await page.locator('.plant-card').evaluateAll((l) => l.slice(0, 12).map((e) => e.dataset.plant));
  const efforts = (sel) => page.locator(sel).evaluateAll((l) => l.slice(0, 8).map((e) => e.querySelector('[data-role=effort]').dataset.effort));
  await expect(page.locator('.plant-card').first().locator('[data-role=effort]')).toBeVisible();

  await page.locator('[data-role=garden-maintenance] [data-maintenance=none]').click();
  await expect(page.locator('[data-role=garden-maintenance] [aria-checked=true]')).toHaveAttribute('data-maintenance', 'none');
  const apres = await page.locator('.plant-card').evaluateAll((l) => l.slice(0, 12).map((e) => e.dataset.plant));
  expect(apres).not.toEqual(avant);
  expect(await efforts('.plant-card')).toEqual(Array(8).fill('1'));
  await page.locator('.plant-card').first().scrollIntoViewIfNeeded();
  await shot('entretien-cartes');
  // essences déconseillées : mention « demande de l'entretien »
  for (let i = 0; i < 8 && !(await page.locator('.plant-card.maint-ko').count()); i++) {
    await page.getByRole('button', { name: /Afficher plus/ }).click();
  }
  const ko = page.locator('.plant-card.maint-ko').first();
  await expect(ko.locator('[data-role=maint-ko]')).toHaveText('demande de l’entretien');
  await ko.scrollIntoViewIfNeeded();
  if (process.env.SHOT_DIR) await ko.screenshot({ path: `${process.env.SHOT_DIR}/entretien-carte-ko.png` });
  await page.evaluate(() => window.scrollTo(0, 0));

  // enregistré en base
  await page.evaluate(() => window.__jardin.flush && window.__jardin.flush());
  const level = await page.evaluate(async (gid) => (await window.__jardin.storage.getGarden(gid)).context.maintenance, id);
  expect(level).toBe('none');

  // niveau d'une zone : « Main verte » sur la première zone
  await page.locator('[data-role=zone-maintenance] [data-maintenance=green]').click();
  await page.evaluate(() => window.__jardin.flush && window.__jardin.flush());
  const zl = await page.evaluate(async (gid) => (await window.__jardin.storage.getGarden(gid)).zones[0].maintenance, id);
  expect(zl).toBe('green');
  await shot('entretien-zone');
  await page.locator('[data-role=zone-maintenance] [data-maintenance=""]').click();

  // Surprends-moi (zone) : rappel dans la fenêtre d'ambiance, essences d'effort 1 uniquement
  await page.locator('#btn-surprise').click();
  await expect(page.locator('[data-role=maint-reminder]')).toContainText('Niveau d’entretien : 🛋 pas d’entretien');
  await shot('entretien-surprise');
  await page.locator('[data-act=amb-ok]').click();
  await expect(page.locator('#proposal-summary')).toContainText('🛋 pas d’entretien');
  const ids = await page.locator('.chosen-row').count();
  expect(ids).toBeGreaterThan(0);
  const eff = await page.evaluate(async (gid) => {
    const { plantEffort } = await import('./maintenance.js');
    const { getPlant } = await import('./catalog.js');
    const g = await window.__jardin.storage.getGarden(gid);
    return g.zones[0].plantings.map((p) => plantEffort(getPlant(p.plantId)));
  }, id);
  // la sauvegarde est différée : on relit après flush
  await page.evaluate(() => window.__jardin.flush && window.__jardin.flush());
  const eff2 = await page.evaluate(async (gid) => {
    const { plantEffort } = await import('./maintenance.js');
    const { getPlant } = await import('./catalog.js');
    const g = await window.__jardin.storage.getGarden(gid);
    return g.zones[0].plantings.map((p) => plantEffort(getPlant(p.plantId)));
  }, id);
  expect(eff2.length).toBeGreaterThan(0);
  expect(eff2.every((e) => e === 1)).toBe(true);
  void eff;

  // tout le jardin
  await page.locator('#btn-surprise-all').click();
  await page.locator('[data-act=amb-ok]').click();
  await expect(page.locator('#proposal-summary')).toContainText('🛋 pas d’entretien');
  await page.evaluate(() => window.__jardin.flush && window.__jardin.flush());
  const tous = await page.evaluate(async (gid) => {
    const { plantEffort } = await import('./maintenance.js');
    const { getPlant } = await import('./catalog.js');
    const g = await window.__jardin.storage.getGarden(gid);
    return g.zones.flatMap((z) => z.plantings.map((p) => plantEffort(getPlant(p.plantId))));
  }, id);
  expect(tous.length).toBeGreaterThan(0);
  expect(tous.every((e) => e === 1)).toBe(true);
  expect(errors).toEqual([]);
});

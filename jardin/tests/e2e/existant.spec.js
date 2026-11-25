// Plantes existantes : poser un arbre, choisir l'espèce du catalogue, régler la hauteur en cm, le retrouver sur le plan final.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
const SHOT = (n) => (process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/${n}.png` : undefined);

async function nouveauJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Existant');
    g.context.departement = '75';
    g.context.location = { lat: 47, lon: 2 };
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    const p = createZone('lawn', r(0.5, 4.5, 11, 3)); p.label = 'Pelouse';
    g.zones = [p];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  await page.goto(`${URL}#/garden/${id}/items`);
  await page.waitForSelector('[data-role=items-editor]');
  return id;
}
const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);
const projeter = (page) => page.evaluate(() => {
  const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect();
  const k = Math.min(r.width / vb.width, r.height / vb.height);
  return { ox: r.left + (r.width - vb.width * k) / 2, oy: r.top + (r.height - vb.height * k) / 2, k, vx: vb.x, vy: vb.y };
});
const px = (p, x, y) => [p.ox + (x - p.vx) * p.k, p.oy + (y - p.vy) * p.k];

test('arbre existant : espèce du catalogue, hauteur en cm, haie, clôture, plan final', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const id = await nouveauJardin(page);
  await page.locator('[data-tab=existing]').click();
  await page.screenshot({ path: SHOT('1-existant'), fullPage: true });

  // arbre : type puis plan
  await page.locator('[data-ex-kind=tree]').click();
  let p = await projeter(page);
  await page.mouse.click(...px(p, 3, 2.5));
  await expect(page.locator('[data-role=sel-banner]')).toContainText('Arbre existant');
  await expect(page.locator('[data-role=existing-count]')).toContainText('1 existant : 1 arbre');

  // espèce du catalogue
  await page.locator('[data-field=plant-search]').fill('érable');
  await page.locator('[data-plant=erable-champetre]').click();
  await expect(page.locator('[data-role=sel-banner]')).toContainText('Érable champêtre');
  await page.screenshot({ path: SHOT('2-espece'), fullPage: true });

  // hauteur en cm
  await page.locator('[data-field=ex-height]').fill('650');
  await page.locator('[data-field=ex-height]').blur();
  await expect(page.locator('[data-role=sel-banner]')).toContainText('650 cm de haut');

  // haie en points puis clôture métal
  await page.locator('[data-ex-kind=hedge]').click();
  p = await projeter(page);
  await page.mouse.click(...px(p, 6, 4)); await page.mouse.click(...px(p, 11, 4));
  await page.locator('[data-act=ex-finish]').click();
  await page.locator('[data-fence-material=metal]').first().click();
  p = await projeter(page);
  await page.mouse.click(...px(p, 7, 1)); await page.mouse.click(...px(p, 11, 1));
  await page.locator('[data-act=ex-finish]').click();
  await page.screenshot({ path: SHOT('3-plan-existants'), fullPage: true });

  const g = await lire(page, id);
  expect(g.existing).toHaveLength(3);
  expect(g.existing[0]).toMatchObject({ kind: 'tree', plantId: 'erable-champetre' });
  expect(g.existing[0].height).toBeCloseTo(6.5, 3);
  expect(g.existing[1]).toMatchObject({ kind: 'hedge' });
  expect(g.existing[2]).toMatchObject({ kind: 'fence', material: 'metal', height: 1.5 });

  // plan final : les existants sont dessinés
  await page.goto(`${URL}#/garden/${id}/render`);
  await page.waitForSelector('[data-role=plan-step]');
  await expect(page.locator('[data-role=plan-content] [data-existing]').first()).toBeVisible();
  await page.screenshot({ path: SHOT('4-plan-final'), fullPage: true });

  // conseils
  await page.evaluate(async () => { window.__jardin.state.garden.status = 'validated'; await window.__jardin.flush(); });
  await page.evaluate((i) => { location.hash = `#/garden/${i}/advice`; }, id);
  await page.locator('[data-tab=care]').click();
  await expect(page.locator('[data-role=existing-advice]')).toContainText('Érable champêtre');
  await page.screenshot({ path: SHOT('5-conseils'), fullPage: true });
  expect(errors).toEqual([]);
});

// Hauteurs réglables : arbre, plante, piscine hors sol, clôture, pergola (saisie en cm, relecture en base, valeur par défaut).
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
const SHOT = process.env.SHOT_DIR;
const shot = (page, name, opts = {}) => (SHOT ? page.screenshot({ path: `${SHOT}/${name}.png`, ...opts }) : Promise.resolve());

async function preparer(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden, createZone, setPoolVariant, createItem } = await import('./model.js');
    const { allPlants } = await import('./catalog.js');
    const arbre = allPlants().find((p) => p.category === 'tree' && p.heightAdult >= 6 && p.heightAdult <= 12);
    const vivace = allPlants().find((p) => p.category === 'perennial');
    const g = createGarden('Hauteurs');
    g.context.departement = '75';
    g.boundary = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 10 }, { x: 0, y: 10 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    const za = createZone('trees', { kind: 'circle', center: { x: 3, y: 3 }, radius: 2 }); za.label = 'Arbre'; za.plantings = [{ plantId: arbre.id, count: 1 }];
    const zv = createZone('midplants', r(0, 6, 5, 3)); zv.label = 'Massif'; zv.plantings = [{ plantId: vivace.id, count: 4 }];
    const zp = createZone('pool', r(8, 1, 4, 4)); zp.label = 'Piscine'; setPoolVariant(zp, 'above');
    g.zones = [za, zv, zp];
    g.items = [createItem('pergola', 9, 8)];
    g.obstacles = [{ id: 'o_cl', kind: 'fence', points: [{ x: 6, y: 6 }, { x: 13, y: 6 }], height: 1.2 }];
    await window.__jardin.storage.saveGarden(g);
    return { id: g.id, arbre: arbre.id, vivace: vivace.id, hArbre: arbre.heightAdult, hVivace: vivace.heightAdult, zones: { a: za.id, v: zv.id, p: zp.id } };
  });
}
const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);
const projeter = (page) => page.evaluate(() => {
  const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect();
  const k = Math.min(r.width / vb.width, r.height / vb.height);
  return { ox: r.left + (r.width - vb.width * k) / 2, oy: r.top + (r.height - vb.height * k) / 2, k, vx: vb.x, vy: vb.y };
});
const px = (p, x, y) => [p.ox + (x - p.vx) * p.k, p.oy + (y - p.vy) * p.k];

test('hauteur d’un arbre et d’une plante dans « Dans cette zone », valeur par défaut', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const s = await preparer(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}#/garden/${s.id}/plants`);
  await page.waitForSelector('.chosen-row');
  const champ = page.locator('.chosen-row [data-field=plant-height]');
  await expect(champ).toHaveAttribute('placeholder', String(Math.round(s.hArbre * 100)));
  await expect(page.locator('[data-role=height-state]')).toHaveText('catalogue');
  const box = await champ.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(43);
  await champ.fill('1500'); await champ.press('Enter');
  await expect(page.locator('[data-role=height-state]')).toContainText('personnalisée');
  await page.locator('[data-role=height-row]').first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await shot(page, 'hauteur-dans-cette-zone');
  let g = await lire(page, s.id);
  expect(g.zones.find((z) => z.id === s.zones.a).plantings[0].height).toBe(15);
  // plante (vivace du massif) : zone suivante
  await page.locator('#zone-sel').selectOption(s.zones.v);
  const c2 = page.locator('.chosen-row [data-field=plant-height]');
  await c2.fill('90'); await c2.blur();
  g = await lire(page, s.id);
  expect(g.zones.find((z) => z.id === s.zones.v).plantings[0].height).toBe(0.9);
  // valeurs par défaut
  await page.locator('[data-act=height-reset]').click();
  await page.locator('#zone-sel').selectOption(s.zones.a);
  await page.locator('[data-act=height-reset]').click();
  g = await lire(page, s.id);
  expect('height' in g.zones.find((z) => z.id === s.zones.a).plantings[0]).toBe(false);
  expect('height' in g.zones.find((z) => z.id === s.zones.v).plantings[0]).toBe(false);
  expect(errors).toEqual([]);
});

test('piscine hors sol : hauteur de la paroi dans le bandeau de zone', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const s = await preparer(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}#/garden/${s.id}/zones`);
  await page.waitForSelector('[data-role=zone-editor]'); await page.waitForTimeout(300);
  const p = await projeter(page);
  const [x, y] = px(p, 10, 3);
  await page.mouse.click(x, y);
  const champ = page.locator('[data-field=zone-height]');
  await expect(champ).toHaveValue('120');
  await champ.fill('170'); await champ.press('Enter');
  await page.locator('[data-role=height-field]').scrollIntoViewIfNeeded();
  await shot(page, 'hauteur-bandeau-piscine');
  expect((await lire(page, s.id)).zones.find((z) => z.id === s.zones.p).height).toBe(1.7);
  await page.locator('[data-act=height-reset]').click();
  expect('height' in (await lire(page, s.id)).zones.find((z) => z.id === s.zones.p)).toBe(false);
  expect(errors).toEqual([]);
});

test('pergola (fenêtre d’appui long) et clôture libre : hauteurs en cm', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const s = await preparer(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}#/garden/${s.id}/items`);
  await page.waitForSelector('[data-role=items-editor]'); await page.waitForTimeout(300);
  let p = await projeter(page);
  const [x, y] = px(p, 9, 8);
  await page.mouse.click(x, y);
  await expect(page.locator('[data-role=sel-banner]')).toContainText('Pergola');
  await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await expect(page.locator('[data-role=pop]')).toBeVisible();
  await expect(page.locator('[data-field=ht]')).toHaveValue('240');
  await shot(page, 'hauteur-fenetre-pergola');
  await page.locator('[data-field=ht]').fill('300');
  await page.locator('[data-act=pop-ok]').click();
  expect((await lire(page, s.id)).items[0].height).toBe(3);
  await page.locator('[data-act=height-reset]').click();
  expect('height' in (await lire(page, s.id)).items[0]).toBe(false);
  // clôture libre
  await page.locator('[data-tab=edges]').click();
  p = await projeter(page);
  const [fx, fy] = px(p, 9.5, 6);
  await page.mouse.click(fx, fy);
  const hc = page.locator('[data-field=free-height]');
  await expect(hc).toHaveValue('120');
  await hc.fill('180'); await hc.press('Enter');
  expect((await lire(page, s.id)).obstacles[0].height).toBe(1.8);
  await page.locator('[data-act=free-height-reset]').click();
  expect((await lire(page, s.id)).obstacles[0].height).toBe(1.2);
  expect(errors).toEqual([]);
});

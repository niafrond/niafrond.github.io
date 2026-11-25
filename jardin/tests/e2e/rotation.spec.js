// Rotation des formes de zones et piscine hors sol, sur téléphone (Pixel 5).
import { test, expect } from '@playwright/test';

const URL = '/jardin/';

async function nouveauJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const g = createGarden('Rotation');
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.wishedZoneTypes = ['terrace', 'pool'];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  await page.goto(`${URL}#/garden/${id}/zones`);
  await page.waitForSelector('[data-role=zone-editor]');
  await page.waitForTimeout(300);
  return id;
}
const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);
const projeter = (page) => page.evaluate(() => {
  const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect();
  const k = Math.min(r.width / vb.width, r.height / vb.height);
  return { ox: r.left + (r.width - vb.width * k) / 2, oy: r.top + (r.height - vb.height * k) / 2, k, vx: vb.x, vy: vb.y };
});
const px = (p, x, y) => [p.ox + (x - p.vx) * p.k, p.oy + (y - p.vy) * p.k];
const aire = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
const angle = (pts) => ((Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI + 360) % 360;

test('rectangle : pivoté de 90° (bouton) puis 30° (champ), points changés, surface identique', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const id = await nouveauJardin(page);
  await page.locator('[data-type=terrace]').click();
  let p = await projeter(page);
  let [x, y] = px(p, 2, 2); await page.mouse.click(x, y);
  [x, y] = px(p, 6, 5); await page.mouse.click(x, y);
  await expect(page.locator('[data-role=zone-rotation]')).toBeVisible();
  await expect(page.locator('[data-handle=rotate]')).toHaveCount(1);
  let g = await lire(page, id);
  const avant = g.zones[0].shape.points; const a0 = aire(avant);

  await page.locator('[data-act=rot-90]').click();
  await expect(page.locator('[data-role=zone-rot]')).toHaveValue('90');
  g = await lire(page, id);
  expect(g.zones[0].shape.points).not.toEqual(avant);
  expect(angle(g.zones[0].shape.points)).toBeCloseTo(90, 0);
  expect(aire(g.zones[0].shape.points)).toBeCloseTo(a0, 1);

  await page.locator('[data-role=zone-rot]').fill('30');
  await page.locator('[data-role=zone-rot]').press('Enter');
  await expect(page.locator('[data-role=zone-rot]')).toHaveValue('30');
  g = await lire(page, id);
  expect(angle(g.zones[0].shape.points)).toBeCloseTo(30, 0);
  expect(aire(g.zones[0].shape.points)).toBeCloseTo(a0, 1);

  // annuler : retour à 90°
  await page.locator('[data-act=undo]').click();
  g = await lire(page, id);
  expect(angle(g.zones[0].shape.points)).toBeCloseTo(90, 0);
  expect(errors).toEqual([]);
});

test('piscine : passée hors sol, variante relue en base', async ({ page }) => {
  const id = await nouveauJardin(page);
  await page.locator('[data-type=pool]').click();
  let p = await projeter(page);
  let [x, y] = px(p, 3, 2); await page.mouse.click(x, y);
  [x, y] = px(p, 8, 6); await page.mouse.click(x, y);
  await expect(page.locator('[data-role=pool-variant]')).toBeVisible();
  let g = await lire(page, id);
  expect(g.zones[0].variant).toBe('inground');
  await page.locator('[data-variant=above]').click();
  await expect(page.locator('[data-variant=above]')).toHaveAttribute('aria-checked', 'true');
  g = await lire(page, id);
  expect(g.zones[0].variant).toBe('above');
  expect(g.zones[0].label).toBe('Piscine hors sol');
  // la zone reste pivotable
  await page.locator('[data-act=rot-cw]').click();
  g = await lire(page, id);
  expect(angle(g.zones[0].shape.points)).toBeCloseTo(15, 0);
});

// Éditeur de zones sur téléphone : rectangle en 2 touches, sélection, dimensions en cm (appui long), dupliquer, supprimer.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';

async function nouveauJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const g = createGarden('Zones');
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.wishedZoneTypes = ['terrace', 'lawn'];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  await page.goto(`${URL}#/garden/${id}/zones`);
  await page.waitForSelector('[data-role=zone-editor]');
  await page.waitForTimeout(300);
  return id;
}
const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);

// monde (m) → pixels écran, d'après le viewBox courant du plan
const projeter = (page) => page.evaluate(() => {
  const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect();
  const k = Math.min(r.width / vb.width, r.height / vb.height);
  return { ox: r.left + (r.width - vb.width * k) / 2, oy: r.top + (r.height - vb.height * k) / 2, k, vx: vb.x, vy: vb.y };
});
const px = (p, x, y) => [p.ox + (x - p.vx) * p.k, p.oy + (y - p.vy) * p.k];

test('zone rectangle en 2 touches, dimensions en cm par appui long, dupliquer, supprimer', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const id = await nouveauJardin(page);

  await expect(page.locator('[data-role=start-panel]')).toBeVisible();
  await page.locator('[data-type=terrace]').click();
  await expect(page.locator('[data-role=start-panel]')).toBeHidden();

  // deux coins opposés
  let p = await projeter(page);
  let [x, y] = px(p, 2, 2); await page.mouse.click(x, y);
  await expect(page.locator('[data-role=live]')).toBeVisible();
  [x, y] = px(p, 6, 5); await page.mouse.click(x, y);
  await expect(page.locator('[data-role=zone-panel]')).toBeVisible();
  await expect(page.locator('[data-role=zone-area]')).toContainText('12,00');

  // désélection puis sélection par toucher
  [x, y] = px(p, 10, 7); await page.mouse.click(x, y);
  await expect(page.locator('[data-role=zone-panel]')).toBeHidden();
  p = await projeter(page);
  [x, y] = px(p, 4, 3.5); await page.mouse.click(x, y);
  await expect(page.locator('[data-role=zone-panel]')).toBeVisible();

  // appui long : dimensions en cm
  await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await expect(page.locator('[data-role=pop]')).toBeVisible();
  await page.locator('[data-field=w]').fill('500');
  await page.locator('[data-field=l]').fill('300');
  await page.locator('[data-act=pop-ok]').click();
  await expect(page.locator('[data-role=zone-area]')).toContainText('15,00');
  let g = await lire(page, id);
  expect(g.zones[0].shape.points[1].x).toBeCloseTo(7, 3);

  // dupliquer
  await page.locator('[data-act=duplicate]').click();
  await expect(page.locator('[data-role=zone-count]')).toHaveText('2');
  expect((await lire(page, id)).zones).toHaveLength(2);

  // supprimer, puis annuler
  await page.locator('[data-act=delete-zone]').click();
  await expect(page.locator('[data-role=zone-count]')).toHaveText('1');
  await page.locator('[data-act=undo]').click();
  await expect(page.locator('[data-role=zone-count]')).toHaveText('2');
  await page.locator('[data-act=redo]').click();
  await expect(page.locator('[data-role=zone-count]')).toHaveText('1');
  expect(errors).toEqual([]);
});

test('appui long sur le plan vide avec un type : zone créée par ses dimensions', async ({ page }) => {
  const id = await nouveauJardin(page);
  await page.locator('[data-type=lawn]').click();
  const p = await projeter(page);
  const [x, y] = px(p, 3, 2);
  await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await expect(page.locator('[data-role=pop]')).toContainText('Nouvelle zone');
  await page.locator('[data-field=w]').fill('400');
  await page.locator('[data-field=l]').fill('250');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-role=zone-area]')).toContainText('10,00');
  expect((await lire(page, id)).zones).toHaveLength(1);
});

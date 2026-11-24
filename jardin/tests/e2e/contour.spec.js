// Saisie rapide du contour : rectangle, appui long sur un côté, toucher une cote.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';

async function nouveauJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const g = createGarden('Saisie');
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  await page.goto(`${URL}#/garden/${id}/boundary`);
  await page.waitForSelector('[data-role=contour-editor]');
  return id;
}
const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);

test('rectangle par dimensions en cm, puis longueur corrigée par appui long', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const id = await nouveauJardin(page);

  await page.locator('[data-act=start-rect]').click();
  await page.locator('[data-field=w]').fill('1000');
  await page.locator('[data-field=l]').fill('800');
  await page.locator('[data-act=pop-ok]').click();
  await expect(page.locator('[data-role=area]')).toHaveText('80,00');

  // appui long au milieu du côté du haut (sommets 1 → 2)
  const svg = page.locator('.jd-svg');
  const box = await svg.boundingBox();
  const pos = await page.evaluate(() => {
    const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect();
    const k = Math.min(r.width / vb.width, r.height / vb.height);
    const ox = r.left + (r.width - vb.width * k) / 2; const oy = r.top + (r.height - vb.height * k) / 2;
    return (x, y) => [ox + (x - vb.x) * k, oy + (y - vb.y) * k];
  }).then(() => page.evaluate(() => {
    const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect();
    const k = Math.min(r.width / vb.width, r.height / vb.height);
    const ox = r.left + (r.width - vb.width * k) / 2; const oy = r.top + (r.height - vb.height * k) / 2;
    return { ox, oy, k, vx: vb.x, vy: vb.y };
  }));
  const px = (x, y) => [pos.ox + (x - pos.vx) * pos.k, pos.oy + (y - pos.vy) * pos.k];
  const [mx, my] = px(5.4, 0); // un peu à droite du milieu du côté pour éviter la poignée du milieu
  expect(box).toBeTruthy();
  await page.mouse.move(mx, my);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.locator('[data-role=pop]')).toBeVisible();
  await page.locator('[data-field=len]').fill('1200');
  await page.locator('[data-act=pop-ok]').click();
  await expect(page.locator('[data-role=area]')).toHaveText('96,00');
  expect((await lire(page, id)).boundary[1].x).toBeCloseTo(12, 3);
  expect(errors).toEqual([]);
});

test('appui long sur le plan vide : le rectangle est proposé ; « 3,5 m » est compris', async ({ page }) => {
  await nouveauJardin(page);
  const box = await page.locator('.jd-svg').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await expect(page.locator('[data-role=pop]')).toContainText('Terrain rectangulaire');
  await page.locator('[data-field=w]').fill('3,5 m');
  await page.locator('[data-field=l]').fill('400');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-role=area]')).toHaveText('14,00');
});

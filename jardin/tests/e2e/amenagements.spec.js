// Aménagements : mobilier (appui long en cm), côté en mur, porte de garage sur une maison.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';

async function nouveauJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const g = createGarden('Aménagements');
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.obstacles = [{ id: 'o_maison', kind: 'house', points: [{ x: 2, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 6 }, { x: 2, y: 6 }], height: 6 }];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  await page.goto(`${URL}#/garden/${id}/items`);
  await page.waitForSelector('[data-role=items-editor]');
  return id;
}
const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);

/** Conversion monde (m) → pixels écran d'après le viewBox courant. */
const projeter = (page) => page.evaluate(() => {
  const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect();
  const k = Math.min(r.width / vb.width, r.height / vb.height);
  return { ox: r.left + (r.width - vb.width * k) / 2, oy: r.top + (r.height - vb.height * k) / 2, k, vx: vb.x, vy: vb.y };
});
const px = (p, x, y) => [p.ox + (x - p.vx) * p.k, p.oy + (y - p.vy) * p.k];

test('banc, taille en cm, mur de 2 m, porte de garage sur la maison', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const id = await nouveauJardin(page);
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/1-mobilier.png` : undefined });

  // 1. Poser un banc : palette puis toucher le plan (hors maison)
  await page.locator('[data-kind=bench]').click();
  let p = await projeter(page);
  const [bx, by] = px(p, 9.5, 4);
  await page.mouse.click(bx, by);
  await expect(page.locator('[data-role=sel-banner]')).toContainText('Banc');

  // 2. Appui long sur le banc → largeur × profondeur en cm
  await page.mouse.move(bx, by);
  await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await expect(page.locator('[data-role=pop]')).toBeVisible();
  await page.locator('[data-field=w]').fill('180');
  await page.locator('[data-field=d]').fill('55');
  await page.locator('[data-act=pop-ok]').click();
  await expect(page.locator('[data-role=sel-banner]')).toContainText('180 × 55 cm');
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/2-banc.png` : undefined });

  // 3. Murs & clôtures : le côté du haut devient un mur de 2 m
  await page.locator('[data-tab=edges]').click();
  p = await projeter(page);
  const [tx, ty] = px(p, 3, 0);
  await page.mouse.click(tx, ty);
  await page.locator('[data-edge-kind=wall]').click();
  await expect(page.locator('[data-role=sel-banner]')).toContainText('Mur');
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/3-murs.png` : undefined });

  // 4. Portes & accès : porte de garage sur le côté sud de la maison
  await page.locator('[data-tab=access]').click();
  await page.locator('[data-opening-kind=garage]').click();
  p = await projeter(page);
  const [gx, gy] = px(p, 4.5, 6.05);
  await page.mouse.click(gx, gy);
  await expect(page.locator('[data-role=sel-banner]')).toContainText('Porte de garage');
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/4-garage.png` : undefined });

  const g = await lire(page, id);
  expect(g.items).toHaveLength(1);
  expect(g.items[0]).toMatchObject({ kind: 'bench' });
  expect(g.items[0].width).toBeCloseTo(1.8, 3);
  expect(g.items[0].depth).toBeCloseTo(0.55, 3);
  expect(g.boundaryEdges[0]).toEqual({ kind: 'wall', height: 2 });
  expect(g.openings).toHaveLength(1);
  expect(g.openings[0]).toMatchObject({ kind: 'garage', ref: { type: 'obstacle', obstacleId: 'o_maison', side: 2 }, swing: 'sliding' });
  expect(g.openings[0].width).toBeCloseTo(2.4, 3);

  // 5. Rechargement : tout est conservé et l'étape suivante est « Essences »
  await page.reload();
  await page.waitForSelector('[data-role=items-editor]');
  await expect(page.locator('[data-role=count]')).toHaveText('1');
  await expect(page.locator('#btn-next')).toContainText('Essences');
  expect(errors).toEqual([]);
});

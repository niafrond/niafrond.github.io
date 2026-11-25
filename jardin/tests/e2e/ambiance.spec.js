// Nom et ambiance d'une zone dès sa création, puis « Surprends-moi » qui demande l'ambiance.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
const shot = (page, name) => page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/${name}.png` : undefined });

async function nouveauJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const g = createGarden('Ambiance');
    g.context.departement = '75';
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    g.wishedZoneTypes = ['midplants', 'lawn'];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  await page.setViewportSize({ width: 390, height: 844 });
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

test('créer une zone, la nommer par les pastilles d’ambiance, puis « Surprends-moi » demande l’ambiance', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const id = await nouveauJardin(page);

  // rectangle en 2 touches
  await page.locator('[data-type=midplants]').click();
  let p = await projeter(page);
  let [x, y] = px(p, 1, 1); await page.mouse.click(x, y);
  [x, y] = px(p, 7, 4.5); await page.mouse.click(x, y);
  await expect(page.locator('[data-role=zone-panel]')).toBeVisible();

  // le champ de nom est mis en évidence, sans clavier forcé
  await expect(page.getByText('Donnez-lui un nom')).toBeVisible();
  const nom = page.locator('[data-role=zone-name]');
  await expect(nom).toHaveAttribute('placeholder', 'ex. Massif bucolique devant la terrasse');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-role'))).not.toBe('zone-name');
  await shot(page, 'ambiance-creation');

  // pastille « bucolique » : nom + ambiance
  await page.locator('[data-role=name-suggestions] [data-ambiance=bucolique]').click();
  await expect(nom).toHaveValue('Massif de plantes moyennes — bucolique');
  await expect(page.locator('[data-role=zone-ambiance] [data-ambiance=bucolique]')).toHaveAttribute('aria-checked', 'true');
  let g = await lire(page, id);
  expect(g.zones[0].label).toMatch(/— bucolique$/);
  expect(g.zones[0].ambiance).toBe('bucolique');
  await shot(page, 'ambiance-selecteur');

  // un nom plus court tapé à la main, puis seconde zone
  await nom.fill('Massif devant la terrasse — bucolique'); await nom.blur();
  g = await lire(page, id);
  expect(g.zones[0].label).toBe('Massif devant la terrasse — bucolique');

  await page.locator('[data-type=lawn]').click();
  p = await projeter(page);
  [x, y] = px(p, 1, 5.5); await page.mouse.click(x, y);
  [x, y] = px(p, 11, 7.5); await page.mouse.click(x, y);
  await page.locator('[data-role=zone-ambiance] [data-ambiance=zen]').click();
  g = await lire(page, id);
  expect(g.zones).toHaveLength(2);
  expect(g.zones[1].ambiance).toBe('zen');

  // étape essences : fenêtre d'ambiance par défaut = ambiance de la zone
  await page.goto(`${URL}#/garden/${id}/plants`);
  await page.waitForSelector('[data-role=zone-head]');
  await expect(page.locator('[data-role=zone-head]')).toContainText('bucolique');
  await page.locator('#btn-surprise').click();
  const dlg = page.locator('[data-role=ambiance-picker]');
  await expect(dlg).toContainText('Quelle ambiance pour cette zone ?');
  await expect(dlg.locator('[data-ambiance=bucolique]')).toHaveAttribute('aria-checked', 'true');
  await dlg.locator('[data-act=amb-ok]').click();
  await expect(page.locator('#proposal-summary')).toContainText(/essences? · ambiance bucolique · floraison/);
  g = await lire(page, id);
  expect(g.zones[0].ambiance).toBe('bucolique');
  expect(g.zones[0].plantings.length).toBeGreaterThan(0);
  await shot(page, 'ambiance-essences');

  // tout le jardin : fenêtre zone par zone
  await page.locator('#btn-undo').click();
  await page.locator('#btn-surprise-all').click();
  await expect(dlg).toContainText('Quelle ambiance pour chaque zone ?');
  await expect(dlg.locator('.amb-row')).toHaveCount(2);
  await shot(page, 'ambiance-globale');
  await dlg.locator('[data-act=same-ambiance]').click();
  await dlg.locator('[data-role=amb-same] [data-ambiance=colore]').click();
  await dlg.locator('[data-act=amb-ok]').click();
  await expect(page.locator('#proposal-summary')).toContainText('ambiance coloré');
  g = await lire(page, id);
  expect(g.zones.map((z) => z.ambiance)).toEqual(['colore', 'colore']);
  expect(errors).toEqual([]);
});

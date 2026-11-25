// Massifs calculés par l'app : choix du mode, étape Massifs (plan, réglages, cartes), verrouillage,
// autre proposition, validation, zones « auto » dans Essences et sur le plan final.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
// PNG 8×8 uni, servi comme « vignette Wikipédia » interceptée.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNk+M/AQAJgGlUwEhQAAJ8gARAYF3ItAAAAAElFTkSuQmCC';
const shot = (page, name) => page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/${name}.png` : undefined });

async function jardin12x9(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Massifs auto');
    g.context.departement = '75';
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 9 }, { x: 0, y: 9 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    g.wishedZoneTypes = ['terrace', 'lawn', 'midplants'];
    const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    const t = createZone('terrace', r(3.5, 0.5, 5, 2.5)); t.label = 'Terrasse';
    const p = createZone('lawn', r(3.5, 4.5, 5, 3.5)); p.label = 'Pelouse';
    g.zones = [t, p];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
}

const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);

test('massifs auto : mode, calcul, verrouillage, autre proposition, validation, Essences et plan final', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://fr.wikipedia.org/api/rest_v1/page/summary/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'standard', thumbnail: { source: PNG }, content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Test' } } }) });
  });
  const id = await jardin12x9(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // 1. choix du mode (étape Zones souhaitées)
  await page.goto(`${URL}#/garden/${id}/wished`);
  await expect(page.locator('[data-bed-mode]')).toHaveCount(2);
  await expect(page.locator('#wish-midplants')).toBeVisible();
  await shot(page, 'massifs-1-mode');
  await page.locator('[data-bed-mode=auto]').click();
  await expect(page.locator('#wish-midplants')).toHaveCount(0);
  await expect(page.locator('[data-role=wished-auto-note]')).toBeVisible();
  await shot(page, 'massifs-1b-mode-auto');
  expect((await lire(page, id)).context.bedMode).toBe('auto');

  // l'éditeur de zones ne propose plus les types massif
  await page.goto(`${URL}#/garden/${id}/zones`);
  await expect(page.locator('[data-role=palette] [data-type=terrace]')).toBeVisible();
  await expect(page.locator('[data-role=palette] [data-type=midplants]')).toHaveCount(0);
  await expect(page.locator('[data-role=beds-note]')).toContainText('calculés à l’étape Massifs');

  // 2. étape Massifs : barre à 9 étapes, plan et réglages
  await page.goto(`${URL}#/garden/${id}/beds`);
  await expect(page.locator('.steps .step')).toHaveCount(9);
  await expect(page.locator('.step[data-step=beds]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.step-title')).toContainText('Massifs');
  await expect(page.locator('[data-role=bed-plan] svg.jd-svg')).toBeVisible();
  await expect(page.locator('[data-role=free-space]')).toBeAttached();
  await expect(page.locator('[data-role=bed-settings]')).toBeVisible();
  await page.waitForTimeout(150);
  await shot(page, 'massifs-2-etape');

  await page.locator('[data-preset=lush]').click();
  await page.locator('[data-palette=chaud]').click();
  await page.locator('[data-act=compute]').click();
  await expect(page.locator('.bed-card').first()).toBeVisible({ timeout: 15000 });
  const n = await page.locator('.bed-card').count();
  expect(n).toBeGreaterThan(1);
  await expect(page.locator('[data-bed-shape]')).toHaveCount(n);
  await page.locator('[data-role=bed-plan]').scrollIntoViewIfNeeded();
  await shot(page, 'massifs-3-plan-calcule');
  await page.locator('.bed-card').first().scrollIntoViewIfNeeded();
  await shot(page, 'massifs-4-cartes');
  await page.locator('.bed-card').first().locator('.bed-cal').scrollIntoViewIfNeeded();
  await page.locator('.bed-card').first().screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/massifs-5-calendrier.png` : undefined });
  await expect(page.locator('.bed-card').first().locator('.bed-month[data-on="1"]').first()).toBeAttached();
  await expect(page.locator('.bed-card').first().locator('.bed-thumb img').first()).toBeAttached({ timeout: 8000 });

  // 3. verrouiller le premier, « Autre proposition » : il reste
  const first = await page.locator('.bed-card').first().getAttribute('data-bed');
  await page.locator('.bed-card').first().locator('[data-act=lock]').click();
  await expect(page.locator('.bed-card').first()).toHaveClass(/locked/);
  await page.locator('[data-act=another]').click();
  await expect(page.locator('[data-act=compute]')).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('.bed-card').first()).toHaveAttribute('data-bed', first);
  await expect(page.locator('.bed-card').first()).toHaveClass(/locked/);
  expect(await page.locator('.bed-card').count()).toBeGreaterThan(1);
  const draft = (await lire(page, id)).context.bedDraft;
  expect(draft.locked).toEqual([first]);

  // 4. valider → zones auto en base, puis étape Essences
  await page.locator('[data-act=validate]').click();
  await expect(page).toHaveURL(/\/plants$/);
  const g = await lire(page, id);
  const autos = g.zones.filter((z) => z.auto === true);
  expect(autos.length).toBeGreaterThan(1);
  autos.forEach((z) => { expect(z.plantings.length).toBeGreaterThan(2); expect(z.autoInfo.why.length).toBeGreaterThan(5); });
  expect(g.zones.filter((z) => !z.auto).map((z) => z.label)).toEqual(['Terrasse', 'Pelouse']);
  await page.locator('#zone-sel').selectOption(autos[0].id);
  await expect(page.locator('[data-role=auto-badge]')).toBeVisible();
  await expect(page.locator('[data-role=auto-info]')).toBeVisible();
  await page.locator('[data-role=zone-head]').scrollIntoViewIfNeeded();
  await shot(page, 'massifs-6-essences');
  await expect(page.locator('.chosen-row').first()).toBeVisible();

  // 5. plan final : les massifs y sont (de vraies zones)
  await page.goto(`${URL}#/garden/${id}/render`);
  await expect(page.locator('[data-role=plan-content] svg')).toBeVisible();
  await expect(page.locator('[data-role=plan-content] svg')).toContainText('Massif');
  await shot(page, 'massifs-7-plan-final');

  // 6. retour sur l'étape : les massifs validés sont là, annulation impossible après rechargement
  await page.goto(`${URL}#/garden/${id}/beds`);
  await expect(page.locator('.bed-card')).toHaveCount(autos.length);
  expect(errors).toEqual([]);
});

test('massifs : jardin sans vide et mode manuel', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const id = await jardin12x9(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}#/garden/${id}/beds`);
  await expect(page.locator('[data-role=beds-manual]')).toContainText('Vos massifs sont dessinés à la main');
  await page.locator('[data-act=to-auto]').click();
  await expect(page.locator('[data-role=beds-auto]')).toBeVisible();
  // un terrain entièrement occupé
  await page.evaluate(async (i) => {
    const g = await window.__jardin.storage.getGarden(i);
    await window.__jardin.flush?.();
    g.context.bedMode = 'auto';
    g.zones = [{ ...g.zones[0], id: 'z_plein', shape: { kind: 'polygon', points: g.boundary } }];
    await window.__jardin.storage.saveGarden(g);
  }, id);
  await page.goto(URL);
  await page.goto(`${URL}#/garden/${id}/beds`);
  await page.reload();
  await expect(page.locator('[data-role=bed-message]')).toContainText('Pas de place libre');
  await page.locator('[data-act=compute]').click();
  await expect(page.locator('.bed-card')).toHaveCount(0);
  await expect(page.locator('[data-role=bed-message]')).toContainText('réduisez les zones ou le mobilier');
  expect(errors).toEqual([]);
});

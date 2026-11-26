// Mares (essences selon la taille) et aperçu « Revoir le plan et la 3D ».
import { test, expect } from '@playwright/test';

const URL = '/jardin/';

async function jardinMare(page, w, h) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async ([w, h]) => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Mare');
    g.context.departement = '75';
    g.boundary = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }, { x: 0, y: 30 }];
    g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const m = createZone('pond', { kind: 'polygon', points: [{ x: 2, y: 2 }, { x: 2 + w, y: 2 }, { x: 2 + w, y: 2 + h }, { x: 2, y: 2 + h }] });
    m.label = 'Mare';
    const l = createZone('lawn', { kind: 'polygon', points: [{ x: 20, y: 2 }, { x: 36, y: 2 }, { x: 36, y: 12 }, { x: 20, y: 12 }] });
    l.label = 'Pelouse';
    g.zones = [m, l];
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  }, [w, h]);
}

async function ouvrir(page, id) {
  await page.route('https://fr.wikipedia.org/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}#/garden/${id}/plants`);
  await page.waitForSelector('#zone-sel');
  await page.locator('#zone-sel').selectOption({ label: /Mare/ }).catch(() => {});
}

const shot = (page, name) => (process.env.SHOT_DIR ? page.screenshot({ path: `${process.env.SHOT_DIR}/${name}.png` }) : null);

test('petite mare (2 m²) : pas de grand nénuphar, raison lisible', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await ouvrir(page, await jardinMare(page, 2, 1));
  await expect(page.locator('[data-role=pond-summary]')).toContainText('Mare de 2,0 m²');
  await expect(page.locator('.plant-card[data-plant=h-nenuphar]')).toHaveCount(0);
  await expect(page.locator('.plant-card[data-plant=saule-tortueux]')).toHaveCount(0);
  await page.locator('[data-role=pond-excluded] summary').click();
  await expect(page.locator('[data-role=pond-excluded] [data-plant=h-nenuphar]')).toContainText('Trop grande pour cette mare');
  await page.locator('[data-field=pond-depth]').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -60));
  await shot(page, 'mare-petite');
  await page.locator('[data-role=pond-excluded]').scrollIntoViewIfNeeded();
  await shot(page, 'mare-ecartees');
  expect(errors).toEqual([]);
});

test('grande mare (30 m²) : le grand nénuphar est proposé', async ({ page }) => {
  await ouvrir(page, await jardinMare(page, 6, 5));
  await expect(page.locator('[data-field=pond-depth]')).toHaveValue('100');
  await expect(page.locator('.plant-card[data-plant=h-nenuphar]')).toHaveCount(1);
  await expect(page.locator('.plant-card[data-plant=h-jussie]')).toHaveCount(0);
});

test('revoir le plan et la 3D : onglet Zones, isométrique, fermeture', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await ouvrir(page, await jardinMare(page, 6, 5));
  await page.locator('#btn-preview').click();
  const ov = page.locator('[data-role=preview-overlay]');
  await expect(ov).toBeVisible();
  await expect(ov.locator('[data-panel=zones] svg').first()).toBeVisible();
  await shot(page, 'apercu-zones');
  await ov.locator('[data-tab=iso]').click();
  await expect(ov.locator('[data-panel=iso] svg').first()).toBeVisible();
  await shot(page, 'apercu-iso');
  await ov.locator('[data-act=preview-close]').click();
  await expect(ov).toHaveCount(0);
  expect(errors).toEqual([]);
});

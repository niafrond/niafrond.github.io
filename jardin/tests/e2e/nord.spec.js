// Indicateur du nord : pastille visible sur chaque éditeur, réglage « Nord à droite » enregistré.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);

async function nouveauJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const g = createGarden('Nord');
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }]; g.boundaryClosed = true;
    g.wishedZoneTypes = ['terrace', 'lawn'];
    g.sun.mode = 'map'; // le pinceau d'ensoleillement n'est monté qu'en carte détaillée
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
}

for (const [route, root] of [['boundary', 'contour-editor'], ['zones', 'zone-editor'], ['items', null], ['sun', 'sun-painter']]) {
  test(`pastille du nord sur « ${route} » : visible, réglage Nord à droite`, async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    const id = await nouveauJardin(page);
    await page.goto(`${URL}#/garden/${id}/${route}`);
    if (root) await page.waitForSelector(`[data-role=${root}]`);
    const badge = page.locator('[data-role=north-badge]');
    await expect(badge).toBeVisible();
    const box = await badge.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(badge).toHaveAttribute('data-known', '0');

    await badge.click();
    await expect(page.locator('[data-role=north-dialog]')).toBeVisible();
    await page.getByRole('button', { name: 'Nord à droite →' }).click();
    await expect(page.locator('[data-role=north-dialog]')).toHaveCount(0);
    await expect(badge).toHaveAttribute('data-angle', '90');
    await expect(badge).toHaveAttribute('aria-label', /Le nord est à droite du plan/);

    const g = await lire(page, id);
    expect(g.context.northAngle).toBe(90);
    expect(g.context.orientation).toBe(270);
    expect(errors).toEqual([]);
  });
}

// Étape Rendu : vues sous différents angles (dessus, isométriques, élévations) et saison.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const URL = '/jardin/';
const SHOTS = process.env.JARDIN_SHOTS; // dossier de captures (facultatif)

/** Jardin 12×8 m fermé : pelouse, massif de 3 essences colorées, 1 arbre, 1 maison. */
async function creerJardin(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const { allPlants } = await import('./catalog.js');
    const g = createGarden('Vues');
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.context.northAngle = 15;
    const poly = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
    const pelouse = createZone('lawn', poly(0.3, 3.6, 11.7, 7.7));
    pelouse.plantings = [{ plantId: allPlants().find((p) => p.category === 'lawn').id, count: 1 }];
    const massif = createZone('midplants', poly(0.5, 2.2, 6.5, 3.5));
    massif.label = 'Massif';
    const fleurs = allPlants().filter((p) => p.category === 'perennial' && p.flowerColor && p.bloom.length && !p.bloom.includes(1)).slice(0, 3);
    massif.plantings = fleurs.map((p) => ({ plantId: p.id, count: 6 }));
    const arbre = createZone('trees', { kind: 'circle', center: { x: 9.5, y: 5.5 }, radius: 1.5 });
    arbre.plantings = [{ plantId: allPlants().find((p) => p.category === 'tree' && p.flowerColor && !p.bloom.includes(1) && p.widthAdult <= 6).id, count: 1 }];
    g.zones.push(pelouse, massif, arbre);
    g.obstacles.push({ id: 'maison', kind: 'house', points: [{ x: 1, y: 0.2 }, { x: 8, y: 0.2 }, { x: 8, y: 1.8 }, { x: 1, y: 1.8 }], height: 5 });
    await window.__jardin.storage.saveGarden(g);
    return { id: g.id, couleurs: fleurs.map((p) => p.flowerColor.toLowerCase()) };
  });
}

const svgHtml = (page) => page.locator('[data-role=plan-content] svg').evaluate((s) => s.outerHTML);

test('vues sous différents angles et saison, sans erreur', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const { id, couleurs } = await creerJardin(page);
  await page.goto(`${URL}#/garden/${id}/render`);
  await page.waitForSelector('[data-role=plan-step] [data-role=plan-content] svg');

  const vues = ['top', 'iso-ne', 'iso-se', 'iso-sw', 'iso-nw', 'front-s', 'front-w', 'front-n', 'front-e'];
  await expect(page.locator('[data-act^=vue-]')).toHaveCount(vues.length);

  // vraies couleurs du dessus (pleine floraison) : fleurs de chaque essence
  let html = (await svgHtml(page)).toLowerCase();
  for (const c of couleurs) expect(html).toContain(c);
  expect(html).toContain('data-flower');

  const vus = new Set();
  const tailles = [{ w: 390, h: 844 }, { w: 1280, h: 800 }];
  for (const v of vues) {
    await page.locator(`[data-act=vue-${v}]`).click();
    await expect(page.locator(`[data-act=vue-${v}]`)).toHaveAttribute('aria-pressed', 'true');
    if (v !== 'top') await expect(page.locator('[data-role=plan-content] svg')).toHaveAttribute('data-view', v);
    vus.add(await svgHtml(page));
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      for (const t of tailles) {
        await page.setViewportSize({ width: t.w, height: t.h });
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${SHOTS}/${v}-${t.w}.png` });
      }
    }
  }
  expect(vus.size).toBe(vues.length);

  // saison : janvier = plus de fleurs ; hiver = arbre dépouillé ; le SVG change dans toutes les vues
  for (const v of ['top', 'iso-sw', 'front-s']) {
    await page.locator(`[data-act=vue-${v}]`).click();
    await page.locator('[data-role=season]').fill('0');
    const plein = await svgHtml(page);
    await page.locator('[data-role=season]').fill('1');
    await expect(page.locator('[data-role=season-label]')).toHaveText('Janv.');
    const janvier = await svgHtml(page);
    expect(janvier).not.toBe(plein);
    expect(janvier).not.toContain('data-flowering'); // hors floraison : feuillage seul
    expect(plein).toContain('data-flowering');
    await page.locator('[data-role=season]').fill('6');
    const juin = (await svgHtml(page)).toLowerCase();
    expect(juin).toContain('juin');
  }
  await page.locator('[data-role=season]').fill('0');

  // plan / illustré / jeunes plants conservés
  await page.locator('[data-act=view-illustrated]').click();
  expect(await svgHtml(page)).toContain('data-role="shadows"');
  await page.locator('[data-act=age-young]').click();
  await page.locator('[data-act=vue-iso-ne]').click();
  expect(await svgHtml(page)).toContain('Jeunes plants');

  // « Toutes les vues » : téléchargement de la feuille de contact
  const dl = page.waitForEvent('download');
  await page.locator('[data-act=export-sheet]').click();
  expect((await dl).suggestedFilename()).toBe('vues-vues.svg');

  // validation : dessus + isométriques enregistrés
  await page.locator('[data-act=validate]').click();
  await expect.poll(() => page.evaluate(async (i) => { await window.__jardin.flush?.(); const g = await window.__jardin.storage.getGarden(i); return g.plan && g.plan.views ? Object.keys(g.plan.views) : null; }, id)).toEqual(['iso-ne', 'iso-se', 'iso-sw', 'iso-nw']);
  const taille = await page.evaluate(async (i) => { const g = await window.__jardin.storage.getGarden(i); return g.plan.svg.length; }, id);
  expect(taille).toBeGreaterThan(1000);

  expect(errors).toEqual([]);
});

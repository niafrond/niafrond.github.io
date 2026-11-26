// Export PDF complet : jardin riche → « PDF du jardin » → téléchargement → relecture du fichier.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const URL = '/jardin/';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNk+M/AQAJgGlUwEhQAAJ8gARAYF3ItAAAAAElFTkSuQmCC';

async function jardinRiche(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden, createZone, createItem, createOpening } = await import('./model.js');
    const { allPlants } = await import('./catalog.js');
    const ex = await import('./existing.js');
    const g = createGarden('Jardin de Léa');
    g.context = { ...g.context, departement: '75', region: 'Île-de-France', commune: 'Paris', altitude: 40, soil: 'loam', northAngle: 20, orientation: 'S', maintenance: 'low' };
    g.boundary = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 9 }, { x: 0, y: 9 }]; g.boundaryClosed = true;
    g.boundaryEdges = [{ kind: 'fence', material: 'wood' }, { kind: 'wall', material: 'stone' }, { kind: 'hedge' }, { kind: 'open' }];
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    const by = (c, n = 0) => allPlants().filter((p) => p.category === c && p.flowerColor && p.bloom && p.bloom.length && typeof p.priceEur === 'number').slice(n, n + 4);
    const ter = createZone('terrace', r(9, 5, 5, 4)); ter.label = 'Terrasse';
    const mas = createZone('midplants', r(0, 0, 8, 3)); mas.label = 'Massif de vivaces'; mas.ambiance = 'bucolique';
    mas.plantings = [...by('perennial'), ...by('grass').slice(0, 1)].map((p, i) => ({ plantId: p.id, count: 5 + i, ...(i === 1 ? { height: 0.9 } : {}) }));
    const pel = createZone('lawn', r(0, 3, 9, 6)); pel.label = 'Pelouse'; pel.plantings = [{ plantId: allPlants().find((p) => p.category === 'lawn' && p.priceEur != null).id, count: 1 }];
    const arb = createZone('trees', { kind: 'circle', center: { x: 11, y: 2.5 }, radius: 2 }); arb.label = 'Arbres'; arb.plantings = by('tree').slice(0, 2).map((p) => ({ plantId: p.id, count: 1 }));
    const hai = createZone('hedge', { kind: 'line', points: [{ x: 0.5, y: 8.7 }, { x: 8.5, y: 8.7 }], width: 1 }); hai.label = 'Haie'; hai.plantings = by('hedge').slice(0, 1).map((p) => ({ plantId: p.id, count: 8 }));
    g.zones = [ter, mas, pel, arb, hai];
    g.obstacles = [{ id: 'mais', kind: 'house', points: r(9.5, 4.2, 4, 0.8).points, height: 6 }];
    g.items = [createItem('table_round', 11.5, 7), createItem('bench', 3, 4), createItem('pergola', 11, 6.3), createItem('composter', 1, 1.5)];
    g.existing = [ex.createExisting('tree', { x: 6.5, y: 5 }), ex.createExisting('hedge', [{ x: 0, y: 9 }, { x: 6, y: 9 }]), ex.createExisting('fence', [{ x: 14, y: 0 }, { x: 14, y: 4 }])];
    g.existing[0].keep = false;
    g.openings = [createOpening('gate', { type: 'boundary', side: 3 }, 0.5)];
    g.status = 'validated';
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
}

test('PDF du jardin : génération, téléchargement, relecture', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://fr.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'standard', thumbnail: { source: PNG }, content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Test' } } }) }));
  const id = await jardinRiche(page);
  await page.goto(`${URL}#/garden/${id}/render`);
  await page.waitForSelector('[data-act=export-pdf]');
  await page.locator('[data-act=export-pdf]').click();
  await expect(page.locator('[data-role=pdf-dialog]')).toBeVisible();
  await page.locator('[data-act=pdf-go]').click();
  await expect(page.locator('[data-role=save-dialog]')).toBeVisible({ timeout: 100_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=save-link]').click()]);
  expect(download.suggestedFilename()).toBe('jardin-Jardin_de_Lea-plan.pdf');
  const file = await download.path();
  const buf = fs.readFileSync(file);
  if (process.env.PDF_OUT) fs.writeFileSync(process.env.PDF_OUT, buf);
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buf.subarray(-8).toString('latin1')).toContain('%%EOF');
  expect(buf.length).toBeGreaterThan(50_000);
  expect(buf.length).toBeLessThan(8_000_000);
  expect(buf.toString('latin1')).toMatch(/\/OCProperties/);
  try {
    const info = execFileSync('pdfinfo', [file]).toString();
    expect(Number(/Pages:\s+(\d+)/.exec(info)[1])).toBeGreaterThan(15);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  expect(errors).toEqual([]);
});

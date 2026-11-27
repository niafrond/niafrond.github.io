// Export PDF complet : jardin riche → « PDF du jardin » → téléchargement → relecture du fichier.
import { test, expect } from '@playwright/test';
import { ouvrirOnglet } from './helpers.js';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const URL = '/jardin/';
// PNG 16×16 vert clair uni (généré dans la page : le PNG 8×8 de plantes.spec est presque noir)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGOYdr2CJMQwqmFUw/DVAAD0iuUQmmAAigAAAABJRU5ErkJggg==';

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
  await page.waitForSelector('[data-role=plan-step]');
  await ouvrirOnglet(page, 'export');
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

test('PDF en arrière-plan : on quitte la fenêtre, le bandeau annonce « prêt », on télécharge', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('https://fr.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'standard', thumbnail: { source: PNG }, content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Test' } } }) }));
  const id = await jardinRiche(page);
  await page.goto(`${URL}#/garden/${id}/render`);
  await page.waitForSelector('[data-role=plan-step]');
  await ouvrirOnglet(page, 'export');
  await page.locator('[data-act=export-pdf]').click();
  await page.locator('[data-act=pdf-go]').click();
  await page.locator('[data-act=pdf-background]').click();
  await expect(page.locator('[data-role=pdf-dialog]')).toBeHidden();
  await expect(page.locator('[data-role=pdf-ready]')).toContainText('Le PDF est prêt', { timeout: 100_000 });
  await page.locator('[data-act=pdf-ready-open]').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=save-link]').click()]);
  expect(download.suggestedFilename()).toBe('jardin-Jardin_de_Lea-plan.pdf');
  expect(fs.readFileSync(await download.path()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
});

test('vignette de photo : jamais noire (fond blanc peint avant le JPEG)', async ({ page }) => {
  await page.route('https://fr.wikipedia.org/api/rest_v1/page/summary/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'standard', thumbnail: { source: PNG }, content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/Test' } } }) }));
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const mean = await page.evaluate(async () => {
    const { loadPhotoThumb } = await import('./pdf-raster.js');
    const { allPlants } = await import('./catalog.js');
    const ph = await loadPhotoThumb(allPlants()[3]);
    if (!ph) return -1;
    const bmp = await createImageBitmap(new Blob([ph.data], { type: 'image/jpeg' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    return s / (d.length / 4) / 3;
  });
  expect(mean).toBeGreaterThan(40); // -1 = pas de photo (repli pastille), jamais une image noire
});

// ---------------------------------------------------------------- robustesse (téléphones) : jardin lourd, CPU ralenti, repli, diagnostic
async function jardinLourd(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden, createZone, createItem, createOpening } = await import('./model.js');
    const { allPlants } = await import('./catalog.js');
    const ex = await import('./existing.js');
    const g = createGarden('Jardin 1 « é » 😀 \u0001 \ud800 & <b>');
    g.context = { ...g.context, departement: '31', region: 'Occitanie', commune: 'Toulouse', soil: 'clay', northAngle: 35, maintenance: 'low' };
    g.boundary = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 32, y: 18 }, { x: 14, y: 22 }, { x: 0, y: 16 }]; g.boundaryClosed = true;
    g.boundaryEdges = [{ kind: 'wall', material: 'brick' }, { kind: 'fence', material: 'metal' }, { kind: 'hedge' }, { kind: 'fence', material: 'mesh' }, { kind: 'wall', material: 'stone' }];
    g.sun = { mode: 'uniform', uniform: 'partial', regions: [] };
    const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    const plants = allPlants().filter((p) => p.category !== 'aquatic' && p.category !== 'lawn' && typeof p.priceEur === 'number');
    const mk = (type, shape, label, n, count) => { const z = createZone(type, shape); z.label = label; z.plantings = plants.slice(n, n + 12).map((p) => ({ plantId: p.id, count })); return z; };
    const pool = createZone('pool', r(18, 2, 6, 4)); pool.variant = 'above'; pool.height = 1.2;
    const pond = createZone('pond', { kind: 'circle', center: { x: 5, y: 12 }, radius: 2.5 }); pond.label = 'Mare \u0000 « é » 😀';
    const path = createZone('path', { kind: 'line', points: [{ x: 2, y: 8 }, { x: 28, y: 8 }], width: 1.2 });
    const out = mk('midplants', r(25, 16, 14, 6), 'Hors terrain', 40, 6); // dépasse du terrain
    g.zones = [pool, pond, path, mk('midplants', r(1, 1, 16, 6), 'Massif 1', 0, 12), mk('tallplants', r(1, 9, 8, 4), 'Hautes', 12, 9), mk('vegetable', r(10, 10, 10, 6), 'Potager', 24, 15), mk('orchard', { kind: 'circle', center: { x: 24, y: 12 }, radius: 4 }, 'Verger', 60, 3), out];
    g.items = ['bench', 'table', 'parasol', 'pergola', 'bbq', 'composter', 'rain_tank', 'shed_item', 'greenhouse', 'swing', 'planter', 'raised_bed'].map((k, i) => createItem(k, 3 + (i % 6) * 4.5, 20 - Math.floor(i / 6) * 3));
    g.items[0].label = 'Banc ￾ 😀';
    g.existing = [];
    for (let i = 0; i < 8; i++) g.existing.push(ex.createExisting(['tree', 'shrub', 'perennial', 'climber'][i % 4], { x: 3 + i * 3.4, y: 14.5 }));
    g.existing.push(ex.createExisting('hedge', [{ x: 0, y: 17 }, { x: 10, y: 20 }]), ex.createExisting('fence', [{ x: 29, y: 1 }, { x: 31, y: 14 }]));
    g.obstacles = [{ id: 'mais', kind: 'house', points: r(8, 1.5, 9, 5).points, height: 7 }];
    g.openings = [createOpening('gate', { type: 'boundary', side: 3 }, 0.5), createOpening('wicket', { type: 'boundary', side: 0 }, 0.3)];
    g.status = 'validated';
    await window.__jardin.storage.saveGarden(g);
    return { id: g.id, plants: g.zones.reduce((s, z) => s + z.plantings.reduce((a, p) => a + p.count, 0), 0) };
  });
}
async function lancer(page, id, { simple = false } = {}) {
  await page.goto(`${URL}#/garden/${id}/render`);
  await page.waitForSelector('[data-role=plan-step]');
  await ouvrirOnglet(page, 'export');
  await page.locator('[data-act=export-pdf]').click();
  await page.locator('[data-act=pdf-go]').click();
  if (simple) return;
}
async function telecharger(page) {
  await expect(page.locator('[data-role=save-dialog]')).toBeVisible({ timeout: 150_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=save-link]').click()]);
  const file = await download.path();
  return { file, buf: fs.readFileSync(file) };
}

test('jardin lourd (centaines de plants, mare, piscine hors sol…), CPU ralenti ×4', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://fr.wikipedia.org/**', (route) => route.abort());
  const { id, plants } = await jardinLourd(page);
  expect(plants).toBeGreaterThan(300);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await lancer(page, id);
  const { file, buf } = await telecharger(page);
  if (process.env.PDF_HEAVY) fs.writeFileSync(process.env.PDF_HEAVY, buf);
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buf.length).toBeLessThan(15_000_000);
  try { expect(Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [file]).toString())[1])).toBeGreaterThan(20); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  expect(errors).toEqual([]);
});

const patchImages = () => {
  const OB = window.Blob;
  window.Blob = class extends OB { constructor(p, o) { super(p, o); if (o && /svg/.test(o.type || '')) this.__t = p.join(''); } };
  const oc = URL.createObjectURL.bind(URL);
  const bad = (t) => window.__failImg === 'all' || (window.__failImg === 'plants' && t.includes('data-plant='));
  URL.createObjectURL = (b) => (b && b.__t && window.__failImg && bad(b.__t) ? 'blob:https://invalid.invalid/none' : oc(b));
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { ...d, set(v) { if (window.__failImg && typeof v === 'string' && v.startsWith('data:image/svg') && bad(decodeURIComponent(v.split(',')[1]))) v = 'data:image/svg+xml,%3Cpas-du-svg'; d.set.call(this, v); } });
};

test('échec de chargement des plans complets : repli automatique « plan simplifié »', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(patchImages);
  await page.route('https://fr.wikipedia.org/**', (route) => route.abort());
  const id = await jardinRiche(page);
  await page.evaluate(() => { window.__failImg = 'plants'; });
  await lancer(page, id);
  const { file, buf } = await telecharger(page);
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  try { expect(execFileSync('pdftotext', [file, '-']).toString()).toContain('Plan simplifié'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
});

test('échec total : diagnostic affiché, puis « Réessayer en mode simplifié » sauve la génération', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(patchImages);
  await page.route('https://fr.wikipedia.org/**', (route) => route.abort());
  const id = await jardinRiche(page);
  await page.evaluate(() => { window.__failImg = 'all'; });
  await lancer(page, id);
  await expect(page.locator('[data-role=pdf-error]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-role=pdf-error]')).toContainText('Impossible de générer le PDF');
  const diag = await page.locator('[data-role=pdf-diag]').textContent();
  expect(diag).toMatch(/Étape : plan niveau 1\/3/); expect(diag).toMatch(/Cause\(s\) : .*blob/); expect(diag).toMatch(/SVG : \d+ Ko, \d+ éléments/);
  expect(diag).toMatch(/Navigateur : /); expect(diag).toMatch(/Application : /);
  await expect(page.locator('[data-act=pdf-copy-diag]')).toBeVisible();
  await page.evaluate(() => { window.__failImg = ''; });
  await page.locator('[data-act=pdf-simple]').click();
  const { file, buf } = await telecharger(page);
  if (process.env.PDF_SIMPLE) fs.writeFileSync(process.env.PDF_SIMPLE, buf);
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  try { expect(Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [file]).toString())[1])).toBeGreaterThan(15); } catch (e) { if (e.code !== 'ENOENT') throw e; }
});

// Vue 3D PC : WebGL logiciel (SwiftShader) en CI ; rendu non vide, heure → image différente, rendu photo, aucune erreur.
import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false,
  launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
});

async function ouvrir(page) {
  await page.goto('/jardin/?3d=1');
  await page.waitForFunction(() => window.__jardin);
  await page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const { allPlants } = await import('./catalog.js');
    const P = allPlants();
    const g = createGarden('Vue 3D');
    g.boundary = [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 12 }, { x: 0, y: 12 }]; g.boundaryClosed = true;
    g.context.location = { lat: 45.76, lon: 4.84 };
    const z = (t, shape, pl = []) => { const zz = createZone(t, shape); pl.forEach(([p, c]) => zz.plantings.push({ plantId: p.id, count: c })); g.zones.push(zz); };
    z('lawn', { kind: 'polygon', points: [{ x: 1, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 11 }, { x: 1, y: 11 }] });
    z('trees', { kind: 'circle', center: { x: 13, y: 8 }, radius: 2.5 }, [[P.find((p) => p.category === 'tree'), 2]]);
    z('midplants', { kind: 'polygon', points: [{ x: 11, y: 1 }, { x: 15, y: 1 }, { x: 15, y: 4 }, { x: 11, y: 4 }] }, [[P.find((p) => p.category === 'perennial'), 8]]);
    z('terrace', { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 1, y: 4 }] });
    g.obstacles.push({ id: 'h', kind: 'house', points: [{ x: 7, y: 0.5 }, { x: 10.5, y: 0.5 }, { x: 10.5, y: 3.5 }, { x: 7, y: 3.5 }], height: 5 });
    const { mountView3D, isDesktop3DCapable } = await import('./ui/view3d.js');
    window.__capable = isDesktop3DCapable();
    const div = document.createElement('div'); document.body.appendChild(div);
    window.__un = mountView3D(div, { garden: g, onClose() {} });
    await window.__un.ready;
  });
}

// Statistiques de l'image : nombre de couleurs distinctes (quantifiées) et luminosité moyenne.
const stats = (page, url) => page.evaluate(async (u) => {
  const img = new Image(); img.src = u; await img.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 100;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, 160, 100);
  const d = x.getImageData(0, 0, 160, 100).data; const set = new Set(); let lum = 0;
  for (let i = 0; i < d.length; i += 4) { set.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`); lum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; }
  return { colors: set.size, lum: lum / (d.length / 4) };
}, url);

test('vue 3D : canvas WebGL, image non vide, l’heure change l’image, rendu photo', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await ouvrir(page);
  expect(await page.evaluate(() => window.__capable)).toBe(true);

  await expect(page.locator('[data-role=canvas]')).toBeVisible();
  expect(await page.evaluate(() => !!document.querySelector('[data-role=canvas]').getContext('webgl2'))).toBe(true);
  await expect(page.locator('[data-role=info]')).toContainText('Scène générée en');
  await expect(page.locator('[data-role=info]')).toContainText('GPU');

  const api = (fn, ...a) => page.evaluate(([f, args]) => window.__un.api[f](...args), [fn, a]);
  await api('setHour', 13);
  const midi = await stats(page, await api('snapshot'));
  expect(midi.colors).toBeGreaterThan(40);
  await api('setHour', 19.5);
  const soir = await stats(page, await api('snapshot'));
  expect(Math.abs(midi.lum - soir.lum)).toBeGreaterThan(4);

  // curseur d'heure et saison dans l'interface
  await page.locator('[data-role=hour]').fill('9');
  await expect(page.locator('[data-role=hour-label]')).toHaveText('9 h 00');
  await page.locator('[data-season=hiver]').click();
  await expect(page.locator('[data-season=hiver]')).toHaveAttribute('aria-pressed', 'true');

  const photo = await page.evaluate(async () => {
    const r = await window.__un.api.photo({ passes: 4, width: 640, download: false });
    return { size: r.blob.size, w: r.width, h: r.height, passes: r.passes, type: r.blob.type };
  });
  expect(photo).toMatchObject({ w: 640, passes: 4, type: 'image/png' });
  expect(photo.size).toBeGreaterThan(5000);

  await page.evaluate(() => window.__un());
  await expect(page.locator('[data-role=view3d]')).toHaveCount(0);
  expect(errors.filter((e) => !/GPU stall|ReadPixels/i.test(e))).toEqual([]);
});

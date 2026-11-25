// Ports des plantes en vue 3D temps réel : bambous, cyprès, pleureur, haie, grimpante, graminée, hosta ; WebGL logiciel (SwiftShader).
// Si SHOTS_DIR est défini, des captures 1280×800 sont écrites dans ce dossier (relecture visuelle).
import { test, expect } from '@playwright/test';

const UA_PC = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
test.describe.configure({ mode: 'serial', timeout: 120_000 });
test.use({
  userAgent: UA_PC,
  viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false,
  launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
});

/** Monte la vue 3D d'un jardin fixture ; `scope` : 'tout' (jardin complet) ou 'bambou' (gros plan sur la touffe). */
async function ouvrir(page, scope = 'tout') {
  await page.goto('/jardin/?3d=1');
  await page.waitForFunction(() => window.__jardin);
  await page.evaluate(async (sc) => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Ports');
    const big = sc === 'tout';
    g.boundary = big ? [{ x: 0, y: 0 }, { x: 18, y: 0 }, { x: 18, y: 13 }, { x: 0, y: 13 }] : [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }];
    g.boundaryClosed = true;
    g.context.location = { lat: 45.76, lon: 4.84 };
    const z = (t, shape, pl = []) => { const zz = createZone(t, shape); pl.forEach(([id, c]) => zz.plantings.push({ plantId: id, count: c })); g.zones.push(zz); };
    const rect = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
    if (big) {
      z('lawn', rect(0.5, 4, 17.5, 12.5));
      z('tallplants', rect(1, 5, 5.5, 9), [['bambou-fargesia', 3]]);
      z('trees', rect(7, 5, 9, 7), [['cypres-de-provence', 1]]);
      z('trees', rect(10, 5, 13, 8), [['bouleau-verruqueux', 1]]);
      z('hedge', { kind: 'line', points: [{ x: 1, y: 12 }, { x: 12, y: 12 }], width: 0.8 }, [['charmille', 1]]);
      z('midplants', rect(13, 9, 17, 11.5), [['h-miscanthus', 2], ['h-hosta', 4]]);
      z('midplants', rect(12.2, 1.4, 16.5, 3), [['clematite-viticella', 2]]);
      g.obstacles.push({ id: 'mur', kind: 'wall', points: [{ x: 12, y: 1 }, { x: 17.5, y: 1 }], height: 2.2 });
      g.obstacles.push({ id: 'maison', kind: 'house', points: [{ x: 1, y: 0.3 }, { x: 8, y: 0.3 }, { x: 8, y: 2.8 }, { x: 1, y: 2.8 }], height: 5 });
    } else {
      z('lawn', rect(0.2, 0.2, 5.8, 4.8));
      z('tallplants', rect(1, 1, 5, 4), [['bambou-fargesia', 4]]);
    }
    const { mountView3D } = await import('./ui/view3d.js');
    const div = document.createElement('div'); document.body.appendChild(div);
    window.__un = mountView3D(div, { garden: g, onClose() { window.__un(); } });
    await window.__un.ready;
  }, scope);
}

const stats = (page, url) => page.evaluate(async (u) => {
  const img = new Image(); img.src = u; await img.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 100;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, 160, 100);
  const d = x.getImageData(0, 0, 160, 100).data; const set = new Set(); let lum = 0;
  for (let i = 0; i < d.length; i += 4) { set.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`); lum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; }
  return { colors: set.size, lum: lum / (d.length / 4) };
}, url);

const shot = async (page, name) => {
  if (!process.env.SHOTS_DIR) return;
  await page.locator('[data-role=canvas]').screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` });
};
const watch = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
};
const api = (page, fn, ...a) => page.evaluate(([f, args]) => window.__un.api[f](...args), [fn, a]);

test('ports : jardin complet, image non vide sous plusieurs angles, été puis automne', async ({ page }) => {
  const errors = watch(page);
  await ouvrir(page);
  await api(page, 'setHour', 13);
  await api(page, 'setDoy', 172);
  const vues = {};
  for (const v of ['ne', 'sw', 'top']) {
    await api(page, 'setView', v);
    await page.waitForTimeout(1300);
    vues[v] = await stats(page, await api(page, 'snapshot'));
    expect(vues[v].colors).toBeGreaterThan(40);
    await shot(page, `ete-${v}`);
  }
  await api(page, 'setView', 'ne'); await page.waitForTimeout(1300);
  const ete = await stats(page, await api(page, 'snapshot'));
  await api(page, 'setDoy', 295); await page.waitForTimeout(300);
  const automne = await stats(page, await api(page, 'snapshot'));
  await shot(page, 'automne-ne');
  expect(Math.abs(ete.lum - automne.lum) + Math.abs(ete.colors - automne.colors)).toBeGreaterThan(3);
  await api(page, 'setDoy', 15); await page.waitForTimeout(300);
  await api(page, 'snapshot'); await shot(page, 'hiver-ne');
  expect(await page.evaluate(() => window.__un.api.info().instances)).toBeGreaterThan(200);
  expect(errors.filter((e) => !/GPU stall|ReadPixels/i.test(e))).toEqual([]);
});

test('ports : touffe de bambous en gros plan, qualité Basse plus légère', async ({ page }) => {
  const errors = watch(page);
  await ouvrir(page, 'bambou');
  await api(page, 'setHour', 15);
  await api(page, 'setDoy', 172);
  await api(page, 'setQuality', 'high');
  await page.waitForTimeout(1500);
  const haute = await page.evaluate(() => window.__un.api.info().instances);
  const img = await stats(page, await api(page, 'snapshot'));
  expect(img.colors).toBeGreaterThan(40);
  await shot(page, 'bambou-haute');
  await api(page, 'setQuality', 'low');
  await page.waitForFunction(() => window.__un.api.info().state.qualityResolved === 'low');
  await page.waitForTimeout(1500);
  await api(page, 'snapshot'); await shot(page, 'bambou-basse');
  const basse = await page.evaluate(() => window.__un.api.info().instances);
  expect(basse).toBeLessThan(haute);
  expect(errors.filter((e) => !/GPU stall|ReadPixels/i.test(e))).toEqual([]);
});

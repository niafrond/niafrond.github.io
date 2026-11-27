// Noms des plantes en vue 3D : un nom par groupe (jamais un par plant), plafond, aucun chevauchement, fiche, mobile ; WebGL logiciel.
// Si SHOTS_DIR est défini, des captures sont écrites dans ce dossier (relecture visuelle de la lisibilité).
import { test, expect } from '@playwright/test';

const UA_PC = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const SHOTS = process.env.SHOTS_DIR || '';
test.describe.configure({ mode: 'serial', timeout: 180_000 });
test.use({
  userAgent: UA_PC,
  viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false,
  launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
});

/** Jardin riche : massifs de plusieurs essences, haie, bambous, plusieurs arbres, existants. Retourne le nombre total de plants déclarés. */
async function ouvrir(page, { scheme = 'dark' } = {}) {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('/jardin/?3d=1');
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const { createExisting } = await import('./existing.js');
    const g = createGarden('Noms 3D');
    g.boundary = [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 16 }, { x: 0, y: 16 }]; g.boundaryClosed = true;
    g.context.location = { lat: 45.76, lon: 4.84 };
    let total = 0;
    const rect = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
    const z = (t, shape, pl, label) => { const zz = createZone(t, shape); if (label) zz.label = label; pl.forEach(([id, c]) => { zz.plantings.push({ plantId: id, count: c }); total += c; }); g.zones.push(zz); };
    z('lawn', rect(0.5, 6, 23.5, 15.5), []);
    z('midplants', rect(2, 7, 7, 10), [['h-lavande', 12]], 'Massif lavande');
    z('midplants', rect(9, 7, 14, 10), [['h-hosta', 8], ['h-sauge-nemorosa', 6]], 'Massif mixte');
    z('midplants', rect(16, 7, 21, 10), [['h-pivoine', 5], ['hortensia-paniculata', 3]], 'Massif d’été');
    z('hedge', { kind: 'line', points: [{ x: 1, y: 14.5 }, { x: 14, y: 14.5 }], width: 0.8 }, [['charmille', 12]], 'Haie');
    z('tallplants', rect(17, 11.5, 21, 14.5), [['bambou-fargesia', 3]], 'Bambous');
    z('trees', rect(2, 1.5, 6, 4.5), [['cerisier-a-fleurs', 2]], 'Cerisiers');
    z('trees', rect(9, 1.5, 15, 4.5), [['bouleau-verruqueux', 5]], 'Bouleaux');
    z('trees', rect(17, 1.5, 21, 4.5), [['pommier', 1]], 'Pommier');
    const e1 = createExisting('tree', { x: 22.5, y: 8 }); e1.plantId = 'cerisier-doux'; e1.height = 5; e1.width = 4;
    const e2 = createExisting('other', { x: 0.8, y: 11 }); e2.label = 'Vieux lilas'; e2.height = 2; e2.width = 2;
    g.existing = [e1, e2];
    g.obstacles.push({ id: 'maison', kind: 'house', points: [{ x: 7, y: 11 }, { x: 11.5, y: 11 }, { x: 11.5, y: 13.5 }, { x: 7, y: 13.5 }], height: 4.5 });
    window.__g = g;
    const { mountView3D } = await import('./ui/view3d.js');
    const div = document.createElement('div'); document.body.appendChild(div);
    window.__un = mountView3D(div, { garden: g, onClose() { window.__closed = true; window.__un(); } });
    await window.__un.ready;
    return total + 2;
  });
}

const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
/** Attend que l'image soit rendue et que le nombre d'étiquettes ait cessé de bouger. */
async function settle(page, min = 0) {
  await page.waitForFunction((m) => document.querySelectorAll('.v3d-label').length >= m, min, { timeout: 60_000 });
  let prev = -1;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400);
    const sig = await page.evaluate(() => [...document.querySelectorAll('.v3d-label')].map((l) => `${l.dataset.key}@${l.style.transform}`).join('|'));
    if (sig === prev) return;
    prev = sig;
  }
}
const rects = (page) => page.evaluate(() => [...document.querySelectorAll('.v3d-label')].map((l) => { const r = l.getBoundingClientRect(); return { key: l.dataset.key, name: l.textContent, x: r.left, y: r.top, w: r.width, h: r.height }; }));
const hit = (a, b, pad) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const noOverlap = (rs) => { for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(hit(rs[i], rs[j], 4), `${rs[i].name} / ${rs[j].name}`).toBe(false); };

test('noms 3D PC : un nom par groupe, plafond 14, jamais de chevauchement sous 4 angles et 2 zooms', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const total = await ouvrir(page);
  expect(await page.locator('[data-role=names]').isChecked()).toBe(true);
  await settle(page, 3);
  await shot(page, 'pc-ensemble');

  const n0 = (await rects(page)).length;
  expect(n0).toBeGreaterThanOrEqual(3);
  expect(n0).toBeLessThanOrEqual(14);
  expect(n0).toBeLessThan(total); // jamais une étiquette par plant
  // une essence = une seule étiquette (les 12 lavandes, la haie)
  const names = (await rects(page)).map((r) => r.name);
  expect(new Set(names).size).toBe(names.length);

  for (const view of ['ne', 'se', 'sw', 'nw']) {
    await page.evaluate((v) => window.__un.api.setView(v), view);
    await page.waitForTimeout(1200);
    await settle(page);
    for (const zoom of [1, 0.45]) {
      await page.evaluate((z) => { const { camera, controls } = window.__un.api; const d = camera.position.clone().sub(controls.target); camera.position.copy(controls.target).addScaledVector(d, z); controls.update(); window.__un.api.snapshot(); }, zoom);
      await page.waitForTimeout(600);
      await settle(page);
      const rs = await rects(page);
      expect(rs.length).toBeLessThanOrEqual(14);
      expect(rs.length).toBeLessThan(total);
      noOverlap(rs);
      for (const r of rs) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(1280); expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y + r.h).toBeLessThanOrEqual(800); }
      if (view === 'ne') await shot(page, `pc-${zoom === 1 ? 'ensemble-ne' : 'zoom-ne'}`);
      // jamais sous la barre du haut ni le panneau ouvert
      const panel = await page.locator('[data-role=panel]').boundingBox();
      if (panel) for (const r of rs) expect(hit(r, { x: panel.x, y: panel.y, w: panel.width, h: panel.height }, 0)).toBe(false);
    }
  }
  expect(errors.filter((e) => !/GPU stall|ReadPixels/i.test(e))).toEqual([]);
});

test('noms 3D : la case « Noms » et la touche N masquent, le nom latin s’ajoute, un clic ouvre la fiche, Échap la ferme', async ({ page }) => {
  await ouvrir(page);
  await settle(page, 3);
  const n = (await rects(page)).length;
  await page.locator('[data-role=names]').uncheck();
  await expect(page.locator('.v3d-label')).toHaveCount(0);
  await page.locator('[data-role=names]').check();
  await settle(page, 3);
  expect((await rects(page)).length).toBeGreaterThanOrEqual(Math.min(n, 3));
  await page.keyboard.press('n');
  await expect(page.locator('.v3d-label')).toHaveCount(0);
  await expect(page.locator('[data-role=names]')).not.toBeChecked();
  await page.keyboard.press('n');
  await settle(page, 3);

  // nom latin
  await page.locator('[data-role=latin]').check();
  await page.waitForFunction(() => document.querySelector('.v3d-label.has-latin'), null, { timeout: 30_000 });
  await settle(page);
  noOverlap(await rects(page));
  await shot(page, 'pc-latin');
  await page.locator('[data-role=latin]').uncheck();
  await settle(page, 3);

  // clic : fiche + mise en évidence de l'essence
  const lab = page.locator('.v3d-label').first();
  await lab.click();
  await expect(page.locator('[data-role=label-card]')).toBeVisible();
  await expect(page.locator('[data-role=label-card] [data-role=card-name]')).not.toHaveText('');
  await expect(page.locator('.v3d-label.is-selected')).toHaveCount(1);
  expect(await page.evaluate(() => !!window.__un.api.scene)).toBe(true);
  await page.waitForTimeout(800);
  await shot(page, 'pc-selection');
  // la mise en évidence atténue le reste de la scène (teintes d'instance)
  const dim = await page.evaluate(() => { let lo = 0; let all = 0; for (const m of window.__un.api.scene.getObjectByName('plantes').children) { all++; if (m.instanceColor && m.instanceColor.array[0] < m.userData.tint0[0] - 1e-6) lo++; } return { lo, all }; });
  expect(dim.lo).toBeGreaterThan(0);
  expect(dim.lo).toBeLessThan(dim.all);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-role=label-card]')).toBeHidden();
  await expect(page.locator('[data-role=view3d]')).toHaveCount(1); // Échap n'a pas fermé la vue
  const dim2 = await page.evaluate(() => { let lo = 0; for (const m of window.__un.api.scene.getObjectByName('plantes').children) if (m.instanceColor && m.instanceColor.array[0] < m.userData.tint0[0] - 1e-6) lo++; return lo; });
  expect(dim2).toBe(0);

  // ligne de la légende : même mise en évidence
  await page.locator('.v3d-legend li[data-essence]').first().click();
  await expect(page.locator('[data-role=label-card]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-role=label-card]')).toBeHidden();
});

test('noms 3D : thème clair, puis vue isométrique SVG avec les mêmes groupes et sans chevauchement', async ({ page }) => {
  await ouvrir(page, { scheme: 'light' });
  await settle(page, 3);
  await shot(page, 'pc-clair');
  const groupes = await page.evaluate(() => window.__un.api.labels.groups().length);
  const total = await page.evaluate(() => window.__g.zones.reduce((s, z) => s + (z.plantings || []).reduce((t, p) => t + p.count, 0), 0));
  expect(groupes).toBeLessThan(total);
  await page.evaluate(async () => {
    window.__un();
    const { renderViewSVG } = await import('./render3d.js');
    const box = document.createElement('div'); box.id = 'iso'; box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff';
    box.innerHTML = renderViewSVG(window.__g, { view: 'iso-ne', width: 1280, height: 800, layers: { legend: false } });
    document.body.appendChild(box);
  });
  const pills = await page.evaluate(() => [...document.querySelectorAll('#iso [data-role=plant-label]')].map((g) => { const r = g.querySelector('rect[data-label-rect]').getBoundingClientRect(); return { key: g.dataset.labelKey, plant: g.dataset.labelPlant, name: g.textContent, x: r.left, y: r.top, w: r.width, h: r.height }; }));
  expect(pills.length).toBeGreaterThanOrEqual(3);
  expect(pills.length).toBeLessThanOrEqual(12);
  expect(new Set(pills.map((p) => p.key)).size).toBe(pills.length);
  expect(pills.filter((p) => p.plant === 'h-lavande').length).toBeLessThanOrEqual(1);
  noOverlap(pills);
  await shot(page, 'iso-ne');
});

test.describe('mobile', () => {
  test.use({ userAgent: UA_ANDROID, viewport: { width: 393, height: 727 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  test('noms 3D mobile : plafond 8, rien sur « Fermer » ni sur la barre du bas, fiche au toucher', async ({ page }) => {
    const total = await ouvrir(page);
    await settle(page, 2);
    await shot(page, 'mobile-ensemble');
    const check = async () => {
      const rs = await rects(page);
      expect(rs.length).toBeLessThanOrEqual(8);
      expect(rs.length).toBeLessThan(total);
      noOverlap(rs);
      const close = await page.locator('[data-act=close]').boundingBox();
      const bar = await page.locator('[data-role=season-bar]').boundingBox();
      const panel = await page.locator('[data-role=panel]').boundingBox();
      for (const r of rs) {
        expect(hit(r, { x: close.x, y: close.y, w: close.width, h: close.height }, 0), `Fermer / ${r.name}`).toBe(false);
        if (bar) expect(hit(r, { x: bar.x, y: bar.y, w: bar.width, h: bar.height }, 0), `barre / ${r.name}`).toBe(false);
        if (panel) expect(hit(r, { x: panel.x, y: panel.y, w: panel.width, h: panel.height }, 0)).toBe(false);
        expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(393);
      }
      return rs;
    };
    await check();
    // toucher une étiquette : fiche en haut, mise en évidence
    await page.locator('.v3d-label').first().tap();
    await expect(page.locator('[data-role=label-card]')).toBeVisible();
    await page.waitForTimeout(600);
    await check();
    await shot(page, 'mobile-selection');
    await page.locator('[data-act=card-close]').tap();
    await expect(page.locator('[data-role=label-card]')).toBeHidden();
    // case « Noms » dans la feuille
    await page.locator('[data-act=toggle-panel]').tap();
    await page.locator('[data-role=names]').uncheck();
    await expect(page.locator('.v3d-label')).toHaveCount(0);
    await page.locator('[data-role=names]').check();
    await page.locator('[data-act=toggle-panel]').tap();
    await settle(page, 2);
    await check();
    // vue du dessus et vue à hauteur d'yeux
    for (const v of ['top', 'eye']) {
      await page.evaluate((id) => window.__un.api.setView(id), v);
      await page.waitForTimeout(1200);
      await page.waitForTimeout(800);
      await check();
    }
  });
});

test('noms 3D : cliquer une plante dans la scène ouvre sa fiche (photo ou cadre) et met son essence en évidence', async ({ page }) => {
  await ouvrir(page);
  await settle(page, 1);
  const pt = await page.evaluate(() => {
    const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
    for (let y = 0.3; y < 0.95; y += 0.04) for (let x = 0.1; x < 0.9; x += 0.04) {
      const px = r.left + r.width * x; const py = r.top + r.height * y;
      const k = window.__un.api.pickAt(px, py); if (k) return { x: px, y: py, k };
    }
    return null;
  });
  expect(pt, 'une plante doit être touchable dans la scène').not.toBeNull();
  await page.mouse.click(pt.x, pt.y);
  await expect(page.locator('[data-role=label-card]')).toBeVisible();
  await expect(page.locator('[data-role=card-photo]')).toBeVisible();
});

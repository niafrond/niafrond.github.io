// Vue 3D PC : WebGL logiciel (SwiftShader) en CI ; rendu non vide, heure → image différente, rendu photo, aucune erreur.
import { test, expect } from '@playwright/test';

// Le projet Playwright `jardin` émule un Pixel 5 (agent Android) : on force ici un agent de bureau
// pour que l'application choisisse l'interface PC ; le bloc « mobile » rétablit l'agent Android.
const UA_PC = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
// WebGL logiciel (SwiftShader) en CI : scènes lourdes, délai large et exécution en série pour ne pas affamer le navigateur.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.use({
  userAgent: UA_PC,
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
    window.__un = mountView3D(div, { garden: g, onClose() { window.__closed = true; window.__un(); } });
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

test('saisons : curseur, puces, année accélérée', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await ouvrir(page);
  const api = (fn, ...a) => page.evaluate(([f, args]) => window.__un.api[f](...args), [fn, a]);
  await api('setHour', 13);
  const slider = page.locator('[data-role=season]');
  const label = page.locator('[data-role=season-label]');

  await slider.fill('172');
  await expect(label).toHaveText('Été · 21 juin');
  const ete = await stats(page, await api('snapshot'));
  await slider.fill('15');
  await expect(label).toHaveText('Hiver · 15 janvier');
  const hiver = await stats(page, await api('snapshot'));
  expect(Math.abs(ete.lum - hiver.lum)).toBeGreaterThan(6); // feuillage, floraison, pelouse et ciel changent l'image

  // puces de saison : elles positionnent le curseur
  for (const [id, nom, jour] of [['printemps', 'Printemps', '105'], ['automne', 'Automne', '288'], ['été', 'Été', '172'], ['hiver', 'Hiver', '15']]) {
    await page.locator(`[data-season="${id}"]`).click();
    await expect(label).toContainText(nom);
    await expect(slider).toHaveValue(jour);
    await expect(page.locator(`[data-season="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
  }

  // année accélérée : démarre (le curseur avance), s'arrête (il se fige)
  const play = page.locator('[data-act=play-year]');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 15_000 }).toBeGreaterThan(20);
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  const v1 = await slider.inputValue();
  await page.waitForTimeout(700);
  expect(await slider.inputValue()).toBe(v1);

  expect(errors.filter((e) => !/GPU stall|ReadPixels/i.test(e))).toEqual([]);
});

// ── Mobile : émulation Pixel 5 (écran 393×727, tactile), WebGL logiciel ──
test.describe('mobile', () => {
  test.use({ userAgent: UA_ANDROID, viewport: { width: 393, height: 727 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.75 });

  test('vue 3D mobile : image non vide, panneau repliable, joystick, Fermer et Retour', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await ouvrir(page);
    expect(await page.evaluate(() => window.__capable)).toBe(true);
    await expect(page.locator('.v3d--mobile')).toHaveCount(1);
    await expect(page.locator('[data-role=canvas]')).toBeVisible();

    const url = await page.evaluate(() => window.__un.api.snapshot());
    expect((await stats(page, url)).colors).toBeGreaterThan(40);
    expect(await page.evaluate(() => window.__un.api.info().quality)).toBe('low');

    // panneau en feuille repliable (replié par défaut)
    const panel = page.locator('[data-role=panel]');
    await expect(panel).toBeHidden();
    await page.locator('[data-act=toggle-panel]').tap();
    await expect(panel).toBeVisible();
    const hb = await page.locator('[data-act=close]').boundingBox();
    expect(hb.height).toBeGreaterThanOrEqual(44);
    await page.locator('[data-act=toggle-panel]').tap();
    await expect(panel).toBeHidden();

    // bandeau « saison » toujours visible quand la feuille est repliée (cible ≥ 44 px), masqué quand elle est ouverte
    const bar = page.locator('[data-role=season-bar]');
    await expect(bar).toBeVisible();
    expect((await page.locator('[data-role=season-strip]').boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await page.locator('[data-act=play-year-strip]').boundingBox()).width).toBeGreaterThanOrEqual(44);
    await page.locator('[data-role=season-strip]').fill('172');
    await expect(page.locator('[data-role=strip-label]')).toContainText('Été');
    await page.locator('[data-act=toggle-panel]').tap();
    await expect(bar).toBeHidden();
    await expect(page.locator('[data-role=season-label]')).toHaveText('Été · 21 juin');
    await page.locator('[data-act=toggle-panel]').tap();
    await expect(bar).toBeVisible();

    // à hauteur d'yeux : joystick virtuel
    await page.evaluate(() => window.__un.api.setView('eye'));
    await expect(page.locator('[data-role=joystick]')).toBeVisible();
    await page.evaluate(() => window.__un.api.setView('top'));
    await expect(page.locator('[data-role=joystick]')).toBeHidden();

    // rendu photo mobile (les plafonds 2048 px / 48 passes sont vérifiés en unitaire ; ici petite taille, portrait lent en WebGL logiciel)
    const photo = await page.evaluate(async () => { const r = await window.__un.api.photo({ passes: 2, width: 480, download: false }); return { w: r.width, p: r.passes }; });
    expect(photo.w).toBe(480);
    expect(photo.p).toBe(2);

    // Fermer
    await page.locator('[data-act=close]').tap();
    await expect(page.locator('[data-role=view3d]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__closed)).toBe(true);
    expect(errors.filter((e) => !/GPU stall|ReadPixels/i.test(e))).toEqual([]);
  });

  test('le bouton Retour d’Android ferme la vue 3D', async ({ page }) => {
    test.setTimeout(60_000);
    await ouvrir(page);
    await expect(page.locator('[data-role=view3d]')).toHaveCount(1);
    await page.goBack();
    await expect(page.locator('[data-role=view3d]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__closed)).toBe(true);
  });
});

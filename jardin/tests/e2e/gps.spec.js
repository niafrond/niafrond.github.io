// Relevé GPS guidé du contour : le terrain se construit seul en marchant (géolocalisation simulée).
// GPS_SHOTS=<dossier> : enregistre une capture 390×844 de chaque étape.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';
const ORIGIN = { latitude: 47.2184, longitude: -1.5536 };
const M_LAT = 1 / 111195;
const M_LON = 1 / (111195 * Math.cos((ORIGIN.latitude * Math.PI) / 180));
/** Position à (est, nord) mètres du point de départ. */
const at = (east, north, accuracy = 2) => ({ latitude: ORIGIN.latitude + north * M_LAT, longitude: ORIGIN.longitude + east * M_LON, accuracy });

test.use({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: at(0, 0) });

let shotN = 0;
async function shot(page, name) {
  if (!process.env.GPS_SHOTS) return;
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${process.env.GPS_SHOTS}/${String(++shotN).padStart(2, '0')}-${name}.png` });
}

async function nouveauJardin(page) {
  await page.addInitScript(() => { window.__JARDIN_GPS = { captureMs: 700 }; });
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const g = createGarden('Relevé GPS');
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  await page.goto(`${URL}#/garden/${id}/boundary`);
  await page.waitForSelector('[data-role=contour-editor]');
  return id;
}
const lire = (page, id) => page.evaluate(async (i) => { await window.__jardin.flush?.(); return window.__jardin.storage.getGarden(i); }, id);

async function poser(page, pos) {
  await page.context().setGeolocation(pos);
  await expect(page.locator('[data-role=gps-pill]')).toHaveClass(/q-(good|medium)/);
  await page.waitForTimeout(200);
  const before = await page.locator('[data-role=survey-count]').textContent();
  await page.locator('[data-act=survey-point]').click();
  await expect(page.locator('[data-role=survey-count]')).not.toHaveText(before, { timeout: 5000 });
}

test('relevé guidé d\'un rectangle 10 × 8 m : le contour se construit seul', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const id = await nouveauJardin(page);
  await shot(page, 'demarrage');

  await page.locator('[data-act=start-gps]').click();
  await expect(page.locator('.jd-survey-on')).toBeVisible();
  await expect(page.locator('[data-role=survey-guide]')).toContainText('Placez-vous sur le 1er angle du terrain');
  await shot(page, 'consignes');

  await page.context().setGeolocation(at(0, 0, 12));
  await expect(page.locator('[data-role=gps-pill]')).toHaveClass(/q-weak/);
  await shot(page, 'signal-faible');
  await expect(page.locator('[data-act=survey-point]')).toBeDisabled();

  await poser(page, at(0, 0, 2));
  await shot(page, 'point-1');
  await page.context().setGeolocation(at(4, 0, 2));
  await expect(page.locator('[data-role=gps-dist]')).toContainText('depuis le point 1');
  await shot(page, 'en-marche');
  await poser(page, at(10, 0, 2));
  await poser(page, at(10, -8, 2)); // 8 m vers le sud : y du plan = +8
  await shot(page, 'point-3');
  await poser(page, at(0, -8, 2));
  await shot(page, 'point-4');

  await page.context().setGeolocation(at(1.2, -0.6, 2));
  await expect(page.locator('[data-role=survey-instr]')).toContainText('du 1er point');
  await shot(page, 'retour-depart');

  await page.locator('[data-act=survey-finish]').click();
  await page.locator('[data-act=ask-skip]').click();
  await expect(page.locator('[data-role=survey-review]')).toBeVisible();
  await shot(page, 'verification');
  await page.locator('[data-act=rv-ok]').click();

  await expect(page.locator('.jd-survey-on')).toHaveCount(0);
  const area = parseFloat((await page.locator('[data-role=area]').textContent()).replace(',', '.'));
  expect(area).toBeGreaterThan(80 * 0.9);
  expect(area).toBeLessThan(80 * 1.1);
  await shot(page, 'contour-final');
  const g = await lire(page, id);
  expect(g.boundary).toHaveLength(4);
  expect(g.boundaryClosed).toBe(true);
  expect(g.context.gpsOrigin.lat).toBeCloseTo(ORIGIN.latitude, 3);
  expect(g.context.gpsSurveyDraft).toBeUndefined();
  expect(g.boundary[2].y).toBeGreaterThan(7); // sud = bas du plan
  expect(errors).toEqual([]);
});

test('précision faible : le bouton reste bloqué, « Poser quand même » demande confirmation', async ({ page }) => {
  const id = await nouveauJardin(page);
  await page.locator('[data-act=start-gps]').click();
  await page.context().setGeolocation(at(0, 0, 25));
  await expect(page.locator('[data-role=gps-pill]')).toContainText('±25,0 m');
  await expect(page.locator('[data-act=survey-point]')).toBeDisabled();
  await page.locator('[data-act=survey-force]').click();
  await expect(page.locator('[data-role=dialog-text]')).toContainText('signal est faible');
  await page.locator('[data-act=ask-wait]').click();
  expect((await lire(page, id)).context.gpsSurveyDraft).toBeUndefined();
  await page.context().setGeolocation(at(0, 0, 2));
  await expect(page.locator('[data-act=survey-point]')).toBeEnabled();
});

test('localisation refusée : message clair et repli sur la saisie des côtés', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: [] });
  const page = await ctx.newPage();
  await nouveauJardin(page);
  await page.locator('[data-act=start-gps]').click();
  await expect(page.locator('[data-role=survey-error]')).toContainText('refusée', { timeout: 8000 });
  await shot(page, 'refus');
  await page.locator('[data-act=survey-manual]').click();
  await expect(page.locator('.jd-survey-on')).toHaveCount(0);
  await expect(page.locator('[data-role=add-length]')).toBeVisible();
  await ctx.close();
});

test('brouillon : un relevé interrompu est repris après rechargement', async ({ page }) => {
  test.setTimeout(45_000);
  const id = await nouveauJardin(page);
  await page.locator('[data-act=start-gps]').click();
  await poser(page, at(0, 0));
  await poser(page, at(10, 0));
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('[data-role=contour-editor]');
  await expect(page.locator('[data-act=start-gps]')).toContainText('Reprendre le relevé GPS (2 points)');
  await page.locator('[data-act=start-gps]').click();
  await page.locator('[data-act=ask-resume]').click();
  await expect(page.locator('[data-role=survey-count]')).toHaveText('2 points');
  expect((await lire(page, id)).context.gpsSurveyDraft.points).toHaveLength(2);
});

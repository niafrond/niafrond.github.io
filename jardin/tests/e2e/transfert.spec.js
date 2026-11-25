// Transfert PC → téléphone : écran de partage (lien + QR), puis import du lien. Dépend du câblage des routes
// #/garden/<id>/share et #/import/<code> dans app.js.
import { test, expect } from '@playwright/test';

const URL = '/jardin/';

test('partager un jardin puis l’importer depuis le lien', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Jardin à envoyer');
    g.boundary = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }];
    g.boundaryClosed = true;
    g.zones.push(createZone('lawn', { kind: 'polygon', points: g.boundary }));
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });

  await page.goto(`${URL}#/garden/${id}/share`);
  const field = page.locator('#share-link');
  await expect(field).toBeVisible();
  await expect(page.locator('.qr-box svg')).toBeVisible();
  await expect(page.getByText('ne le partagez qu’avec vous-même')).toBeVisible();
  const link = await field.inputValue();
  expect(link).toMatch(/#\/import\/v[12]u?\./);

  // le lien est ouvert « sur le téléphone » (même navigateur, adresse locale)
  await page.goto(`${URL}#/import/${link.split('#/import/')[1]}`);
  await expect(page.locator('[data-role=preview]')).toContainText('Jardin à envoyer');
  await page.locator('[data-act=import]').click();
  await page.waitForFunction(() => location.hash !== '' && !location.hash.includes('/import/'));
  const noms = await page.evaluate(async () => (await window.__jardin.storage.listGardens()).map((g) => g.name));
  expect(noms.filter((n) => n === 'Jardin à envoyer').length).toBe(2);

  // code invalide
  await page.goto(`${URL}#/import/v1.AAAA`);
  await expect(page.locator('[data-role=import-error]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('accueil : coller un lien ouvre l’aperçu d’import', async ({ page }) => {
  await page.goto(URL);
  await page.locator('#btn-import-link').click();
  await page.locator('#import-paste').fill('texte sans rapport');
  await page.locator('#import-paste-ok').click();
  await expect(page.getByRole('alert')).toBeVisible();
});


test('jardin validé avec de gros plans : le lien reste court et s’importe ; le fichier JSON s’enregistre', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden, createZone } = await import('./model.js');
    const g = createGarden('Gros plan');
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 9 }, { x: 0, y: 9 }];
    g.boundaryClosed = true; g.status = 'validated';
    g.zones.push(createZone('lawn', { kind: 'polygon', points: g.boundary }));
    // vues SVG du plan validé : plusieurs centaines de Ko (c'était ce qui rendait le lien énorme)
    g.plan = { svg: '<svg>' + 'x'.repeat(300000) + '</svg>', validatedAt: '2026-01-01', views: { 'iso-ne': '<svg>' + 'y'.repeat(500000) + '</svg>' } };
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  });
  await page.goto(`${URL}#/garden/${id}/share`);
  const link = await page.locator('#share-link').inputValue();
  expect(link.length).toBeLessThan(5000);
  await page.goto(`${URL}#/import/${link.split('#/import/')[1]}`);
  await expect(page.locator('[data-role=preview]')).toContainText('Gros plan');

  // fichier JSON : la fenêtre propose un vrai lien d'enregistrement qui télécharge bien le fichier
  await page.goto(`${URL}#/garden/${id}/share`);
  await page.locator('[data-act=download]').click();
  await expect(page.locator('[data-role=save-dialog]')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=save-link]').click()]);
  expect(download.suggestedFilename()).toBe('jardin-Gros_plan.json');
  expect(errors).toEqual([]);
});

test('lien coupé par une messagerie : message explicite', async ({ page }) => {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  const code = await page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const { encodeGarden } = await import('./transfer.js');
    const g = createGarden('Coupé'); g.boundary = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]; g.boundaryClosed = true;
    return encodeGarden(g);
  });
  await page.goto(`${URL}#/import/${code.slice(0, code.length - 25)}`);
  await expect(page.locator('[data-role=import-error]')).toContainText('Lien coupé');
});

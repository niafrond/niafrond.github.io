import { test, expect } from '@playwright/test';

/** URL de base servie par le webServer défini dans playwright.config.js */
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

test.describe('Setup screen (no ?host param)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/quiz/');
  });

  test('affiche l\'écran de configuration', async ({ page }) => {
    await expect(page.locator('[data-screen="screen-setup"]')).toBeVisible();
  });

  test('le formulaire de configuration est présent', async ({ page }) => {
    await expect(page.locator('#host-name')).toBeVisible();
    await expect(page.locator('#btn-start-host')).toBeVisible();
  });

  test('le bouton Démarrer est cliquable avec un nom', async ({ page }) => {
    await page.fill('#host-name', 'Testeur');
    // Le bouton ne doit pas être désactivé avant le clic
    await expect(page.locator('#btn-start-host')).not.toBeDisabled();
  });

  test('le classement local peut être affiché (card présente dans le DOM)', async ({ page }) => {
    // La card du classement est dans le DOM (potentiellement hidden au départ)
    await expect(page.locator('#leaderboard-setup-card')).toBeAttached();
  });

  test('l\'écran de rejoindre est caché', async ({ page }) => {
    await expect(page.locator('[data-screen="screen-join"]')).toBeHidden();
  });
});

test.describe('Join screen (?host=XXXX)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/quiz/?host=fakepeerid123');
  });

  test('affiche l\'écran de rejoindre', async ({ page }) => {
    await expect(page.locator('[data-screen="screen-join"]')).toBeVisible();
  });

  test('l\'écran de configuration est caché', async ({ page }) => {
    await expect(page.locator('[data-screen="screen-setup"]')).toBeHidden();
  });

  test('le champ de nom est présent', async ({ page }) => {
    await expect(page.locator('#player-name')).toBeVisible();
  });

  test('le bouton Rejoindre est présent', async ({ page }) => {
    await expect(page.locator('#btn-join')).toBeVisible();
  });
});

test.describe('Accessibilité de base', () => {
  test('le titre de l\'app est présent', async ({ page }) => {
    await page.goto(BASE + '/quiz/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('le lien de retour accueil est présent', async ({ page }) => {
    await page.goto(BASE + '/quiz/');
    // Bouton ou lien home (présent dans le HTML)
    const homeLink = page.locator('.home-btn').first();
    await expect(homeLink).toBeAttached();
  });
});

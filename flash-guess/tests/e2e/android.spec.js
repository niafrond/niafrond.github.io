/**
 * flash-guess/tests/e2e/android.spec.js
 *
 * Tests Playwright simulant l'environnement Android/APK via émulation d'appareil
 * mobile. Capacitor emballe l'application dans un WebView Android dont le moteur
 * de rendu est identique à Chrome mobile. Ces tests valident que :
 *
 *  1. L'application s'initialise sans erreurs (valide notamment le fix du bug
 *     APK où version.js était manquant hors du webDir Capacitor).
 *  2. La navigation et les interactions tactiles fonctionnent sur mobile.
 *  3. Le flux de jeu complet est fonctionnel sur un viewport paysage Android.
 *
 * Note : Playwright ne peut pas exécuter un APK directement. La simulation
 * d'appareil (viewport, user-agent, touch) est la méthode recommandée pour
 * reproduire le comportement d'un WebView Capacitor en CI.
 */

import { test, expect, devices } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const APP  = `${BASE}/flash-guess/`;

/**
 * Extrait les propriétés d'un appareil Playwright en excluant defaultBrowserType,
 * car cette propriété ne peut pas être utilisée dans test.use() au niveau describe.
 */
function deviceSettings(deviceName, overrides = {}) {
  // eslint-disable-next-line no-unused-vars
  const { defaultBrowserType: _, ...settings } = devices[deviceName];
  return { ...settings, ...overrides };
}

/** Pixel 5 en mode paysage — correspond au viewport de l'APK en jeu. */
const PIXEL_5_PORTRAIT  = deviceSettings('Pixel 5');
const PIXEL_5_LANDSCAPE = deviceSettings('Pixel 5', { viewport: { width: 851, height: 393 } });

/** Attend que l'app JS soit initialisée (la barre de nav devient visible). */
async function waitForInit(page) {
  await expect(page.locator('#bottom-nav')).toBeVisible({ timeout: 8_000 });
}

/** Ajoute un joueur via le formulaire et attend que le cooldown (500 ms) expire. */
async function addPlayer(page, name) {
  await page.fill('#player-input', name);
  await page.click('#btn-add-player');
  // Attend que le joueur soit visible dans la liste (confirme l'ajout)
  await expect(page.locator('#player-list')).toContainText(name, { timeout: 3_000 });
  // Attend la fin du withCooldown global (500 ms) avant toute nouvelle interaction
  await page.waitForTimeout(550);
}

// ─── Initialisation de l'APK ───────────────────────────────────────────────────

test.describe('APK Android — initialisation (Pixel 5 portrait)', () => {
  test.use(PIXEL_5_PORTRAIT);

  test("l'application s'initialise sans erreur JS critique", async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(APP);
    await waitForInit(page);

    // Vérifie l'absence d'erreurs liées aux imports manquants (bug version.js)
    const criticalErrors = errors.filter(e =>
      e.includes('version.js') ||
      e.includes('Cannot find module') ||
      e.includes('Failed to fetch') ||
      e.includes('SyntaxError')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("le titre Flash Guess est correct", async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    expect(await page.title()).toBe('Flash Guess ⚡');
  });

  test("l'écran de configuration s'affiche sur mobile", async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await expect(page.locator('#screen-setup')).toBeVisible();
  });

  test('la barre de navigation inférieure est visible sur mobile', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await expect(page.locator('#bottom-nav')).toBeVisible();
  });

  test("l'indicateur de version est renseigné (fix version.js)", async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    // Le badge version doit contenir un numéro de version (ex: "v1.126.0")
    const versionText = await page.locator('#flashguess-version').textContent();
    expect(versionText).toMatch(/v\d+\.\d+\.\d+/);
  });
});

// ─── Interactions tactiles (portrait) ─────────────────────────────────────────

test.describe('APK Android — interactions tactiles (Pixel 5 portrait)', () => {
  test.use(PIXEL_5_PORTRAIT);

  test('ajouter un joueur par tap', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await page.tap('#player-input');
    await page.fill('#player-input', 'Alice');
    await page.tap('#btn-add-player');
    await expect(page.locator('#player-list .player-item')).toHaveCount(1);
    await expect(page.locator('#player-list')).toContainText('Alice');
  });

  test('la navigation par onglets fonctionne par tap', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await page.tap('#nav-parametres');
    await expect(page.locator('#screen-settings')).toBeVisible();
    await page.tap('#nav-jouer');
    await expect(page.locator('#screen-setup')).toBeVisible();
  });

  test('le bouton Démarrer est interactif', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await expect(page.locator('#btn-start-game')).toBeDisabled();
    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await expect(page.locator('#btn-start-game')).toBeEnabled();
  });

  test('accéder aux paramètres et toggler le Mode Enfant', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await page.tap('#nav-parametres');
    await expect(page.locator('#screen-settings')).toBeVisible();
    const btn = page.locator('#toggle-kids-mode');
    await expect(btn).toHaveAttribute('aria-checked', 'false');
    await btn.tap();
    await expect(btn).toHaveAttribute('aria-checked', 'true');
  });
});

// ─── Flux de jeu complet (paysage) ────────────────────────────────────────────

test.describe('APK Android — flux de jeu (Pixel 5 paysage)', () => {
  test.use(PIXEL_5_LANDSCAPE);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('flashguess_word_draft', '0'));
  });

  test("l'application s'initialise en mode paysage", async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await expect(page.locator('#screen-setup')).toBeVisible();
  });

  test("l'overlay de rotation n'est pas actif en mode paysage (écran setup)", async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    // L'overlay ne doit pas avoir la classe 'active' sur l'écran de setup
    await expect(page.locator('#rotate-overlay')).not.toHaveClass(/active/);
  });

  test('le flux complet setup → catégories → équipes → intro manche', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);

    // Ajouter 2 joueurs
    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await expect(page.locator('#btn-start-game')).toBeEnabled();

    // Catégories
    await page.tap('#btn-start-game');
    await expect(page.locator('#screen-categories')).toBeVisible();
    await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
    await page.tap('#btn-cats-confirm');

    // Équipes
    await expect(page.locator('#screen-teams')).toBeVisible();
    await expect(page.locator('#teams-container')).not.toBeEmpty();
    await page.tap('#btn-launch-game');

    // Intro de manche
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#round-intro-num')).toContainText('1');
  });

  test('le tour actif est jouable sur mobile (mots + boutons)', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);

    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await page.tap('#btn-start-game');
    await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
    await page.tap('#btn-cats-confirm');
    await expect(page.locator('#screen-teams')).toBeVisible();
    await page.tap('#btn-launch-game');
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
    await page.tap('#btn-round-go');
    await expect(page.locator('#screen-pre-turn')).toBeVisible();
    await page.tap('#btn-ready');
    await expect(page.locator('#screen-turn')).toBeVisible();

    // Le mot est affiché
    await expect(page.locator('#word-card-text')).not.toHaveText('…');

    // Le bouton Trouvé est toujours visible en manche 1
    await expect(page.locator('#btn-found')).toBeVisible();
    // btn-skip est caché en manche 1 (canSkip: false) — c'est le comportement attendu

    // Cliquer Trouvé passe au mot suivant (le mot change)
    const word1 = await page.locator('#word-card-text').textContent();
    await page.tap('#btn-found');
    const word2 = await page.locator('#word-card-text').textContent();
    expect(word2).not.toBe(word1);
  });

  test('le bouton Quitter ramène à la configuration', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);

    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await page.tap('#btn-start-game');
    await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
    await page.tap('#btn-cats-confirm');
    await page.tap('#btn-launch-game');
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });

    // Le bouton Quitter est visible pendant le gameplay
    await expect(page.locator('#btn-game-close')).toBeVisible();
    await page.tap('#btn-game-close');
    await expect(page.locator('#screen-setup')).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Validation des correctifs APK ────────────────────────────────────────────

test.describe('APK Android — validation des correctifs', () => {
  test.use(PIXEL_5_PORTRAIT);

  test('version.js est correctement résolu (pas de 404 sur version.js)', async ({ page }) => {
    const failedRequests = [];
    page.on('response', response => {
      if (response.url().includes('version.js') && response.status() >= 400) {
        failedRequests.push(response.url());
      }
    });

    await page.goto(APP);
    await waitForInit(page);

    expect(failedRequests).toHaveLength(0);
  });

  test('leaderboard.js est accessible', async ({ page }) => {
    const failedRequests = [];
    page.on('response', response => {
      if (response.url().includes('leaderboard.js') && response.status() >= 400) {
        failedRequests.push(response.url());
      }
    });

    await page.goto(APP);
    await waitForInit(page);

    expect(failedRequests).toHaveLength(0);
  });

  test('tous les modules JS principaux se chargent sans erreur 404', async ({ page }) => {
    const failedModules = [];
    const coreModules = [
      'main.js', 'state.js', 'ui.js', 'game.js', 'setup.js',
      'members.js', 'words.js', 'leaderboard.js', 'version.js',
    ];

    page.on('response', response => {
      const url = response.url();
      if (coreModules.some(m => url.endsWith(m)) && response.status() >= 400) {
        failedModules.push(`${url} (${response.status()})`);
      }
    });

    await page.goto(APP);
    await waitForInit(page);

    expect(failedModules).toHaveLength(0);
  });
});

/**
 * flash-guess/tests/e2e/app.spec.js
 *
 * Tests Playwright pour l'application Flash Guess (navigateur desktop).
 * Couvre : initialisation, gestion des joueurs, navigation, catégories,
 * équipes, démarrage d'une partie, paramètres, tutoriel, classement.
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const APP  = `${BASE}/flash-guess/`;

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

/** Navigue jusqu'à l'écran Équipes depuis la page de setup avec 2 joueurs. */
async function goToTeams(page) {
  await addPlayer(page, 'Alice');
  await addPlayer(page, 'Bob');
  await page.click('#btn-start-game');
  await expect(page.locator('#screen-categories')).toBeVisible();
  await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
  await page.click('#btn-cats-confirm');
  await expect(page.locator('#screen-teams')).toBeVisible();
}

// ─── Initialisation ────────────────────────────────────────────────────────────

test.describe('Initialisation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
  });

  test('le titre de la page est correct', async ({ page }) => {
    expect(await page.title()).toBe('Flash Guess ⚡');
  });

  test("l'écran de configuration est visible", async ({ page }) => {
    await expect(page.locator('#screen-setup')).toBeVisible();
  });

  test('la barre de navigation inférieure est visible', async ({ page }) => {
    await expect(page.locator('#bottom-nav')).toBeVisible();
  });

  test('le bouton Démarrer est désactivé sans joueurs', async ({ page }) => {
    await expect(page.locator('#btn-start-game')).toBeDisabled();
  });

  test('la liste de joueurs est vide initialement', async ({ page }) => {
    await expect(page.locator('#player-list .player-item')).toHaveCount(0);
  });

  test('le lien retour accueil est présent', async ({ page }) => {
    await expect(page.locator('.home-btn').first()).toBeVisible();
  });

  test("l'indicateur de version est présent dans le DOM", async ({ page }) => {
    await expect(page.locator('#flashguess-version')).toBeAttached();
  });
});

// ─── Gestion des joueurs ───────────────────────────────────────────────────────

test.describe('Gestion des joueurs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
  });

  test('ajouter un joueur via le bouton', async ({ page }) => {
    await addPlayer(page, 'Alice');
    await expect(page.locator('#player-list .player-item')).toHaveCount(1);
    await expect(page.locator('#player-list')).toContainText('Alice');
  });

  test('ajouter un joueur avec la touche Entrée', async ({ page }) => {
    await page.fill('#player-input', 'Alice');
    await page.press('#player-input', 'Enter');
    await expect(page.locator('#player-list .player-item')).toHaveCount(1);
  });

  test('le bouton Démarrer reste désactivé avec un seul joueur', async ({ page }) => {
    await addPlayer(page, 'Alice');
    await expect(page.locator('#btn-start-game')).toBeDisabled();
  });

  test("le bouton Démarrer s'active avec 2 joueurs", async ({ page }) => {
    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await expect(page.locator('#btn-start-game')).toBeEnabled();
  });

  test('le compteur de joueurs est correct', async ({ page }) => {
    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await expect(page.locator('#player-count')).toContainText('2 joueurs');
  });

  test('supprimer un joueur repasse le bouton Démarrer en désactivé', async ({ page }) => {
    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await expect(page.locator('#btn-start-game')).toBeEnabled();
    await page.locator('#player-list .btn-icon').first().click();
    await expect(page.locator('#player-list .player-item')).toHaveCount(1);
    await expect(page.locator('#btn-start-game')).toBeDisabled();
  });

  test("impossible d'ajouter deux joueurs avec le même prénom", async ({ page }) => {
    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Alice');
    await expect(page.locator('#player-list .player-item')).toHaveCount(1);
  });

  test('le champ de saisie est vidé après ajout', async ({ page }) => {
    await addPlayer(page, 'Alice');
    await expect(page.locator('#player-input')).toHaveValue('');
  });
});

// ─── Navigation — barre inférieure ────────────────────────────────────────────

test.describe('Navigation — barre inférieure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
  });

  test("accéder à l'écran Paramètres", async ({ page }) => {
    await page.click('#nav-parametres');
    await expect(page.locator('#screen-settings')).toBeVisible();
    await expect(page.locator('#screen-setup')).toBeHidden();
  });

  test("accéder à l'écran Groupes", async ({ page }) => {
    await page.click('#nav-groupes');
    await expect(page.locator('#screen-groups')).toBeVisible();
  });

  test("accéder à l'écran Catégories", async ({ page }) => {
    await page.click('#nav-cartes');
    await expect(page.locator('#screen-categories')).toBeVisible();
  });

  test('revenir à Jouer depuis Paramètres', async ({ page }) => {
    await page.click('#nav-parametres');
    await page.click('#nav-jouer');
    await expect(page.locator('#screen-setup')).toBeVisible();
  });

  test('le bon onglet est marqué actif', async ({ page }) => {
    await page.click('#nav-parametres');
    await expect(page.locator('#nav-parametres')).toHaveClass(/bottom-nav-item--active/);
    await expect(page.locator('#nav-jouer')).not.toHaveClass(/bottom-nav-item--active/);
  });
});

// ─── Écran Catégories ──────────────────────────────────────────────────────────

test.describe('Écran des catégories', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await page.click('#btn-start-game');
    await expect(page.locator('#screen-categories')).toBeVisible();
  });

  test('la grille des catégories se remplit (chargement async)', async ({ page }) => {
    await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
    const count = await page.locator('#categories-grid .cat-toggle').count();
    expect(count).toBeGreaterThan(10);
  });

  test('le bouton Confirmer est présent', async ({ page }) => {
    await expect(page.locator('#btn-cats-confirm')).toBeVisible();
  });

  test('Tout désélectionner désactive le bouton Confirmer', async ({ page }) => {
    await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
    await page.click('#btn-cats-none');
    await expect(page.locator('#btn-cats-confirm')).toBeDisabled();
    await expect(page.locator('#cats-hint')).toBeVisible();
  });

  test('Tout sélectionner réactive le bouton Confirmer', async ({ page }) => {
    await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
    await page.click('#btn-cats-none');
    await page.click('#btn-cats-all');
    await expect(page.locator('#btn-cats-confirm')).toBeEnabled();
  });

  test('sélectionner une catégorie individuelle active le bouton Confirmer', async ({ page }) => {
    await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
    await page.click('#btn-cats-none');
    await page.locator('#categories-grid .cat-toggle').first().click();
    await expect(page.locator('#btn-cats-confirm')).toBeEnabled();
  });
});

// ─── Écran des équipes ─────────────────────────────────────────────────────────

test.describe('Écran des équipes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await goToTeams(page);
  });

  test('les équipes sont affichées', async ({ page }) => {
    await expect(page.locator('#teams-container')).not.toBeEmpty();
  });

  test('le bouton Rebattre est présent et cliquable', async ({ page }) => {
    // Note : avec 2 joueurs seulement, le bouton Rebattre est caché (mode coop).
    // On vérifie qu'il est présent et fonctionnel avec 3 joueurs.
    const btn = page.locator('#btn-reshuffle');
    // Avec le goToTeams du beforeEach (2 joueurs), le bouton est caché —
    // on vérifie simplement qu'il est attaché au DOM.
    await expect(btn).toBeAttached();
  });

  test('le bouton Rebattre est visible et fonctionnel avec 3 joueurs', async ({ page }) => {
    // Partir d'un contexte frais avec 3 joueurs (pas de beforeEach)
    await page.goto(APP);
    await waitForInit(page);
    await addPlayer(page, 'Alice');
    await addPlayer(page, 'Bob');
    await addPlayer(page, 'Charlie');
    await page.click('#btn-start-game');
    await page.waitForSelector('#categories-grid .cat-toggle', { timeout: 8_000 });
    await page.click('#btn-cats-confirm');
    await expect(page.locator('#screen-teams')).toBeVisible();
    const btn = page.locator('#btn-reshuffle');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('#screen-teams')).toBeVisible();
  });

  test("le bouton C'est parti ! est présent", async ({ page }) => {
    await expect(page.locator('#btn-launch-game')).toBeVisible();
  });
});

// ─── Démarrage d'une partie ────────────────────────────────────────────────────

test.describe("Démarrage d'une partie", () => {
  test.beforeEach(async ({ page }) => {
    // Désactiver le mode choix de mots pour un flux simple
    await page.addInitScript(() => localStorage.setItem('flashguess_word_draft', '0'));
    await page.goto(APP);
    await waitForInit(page);
    await goToTeams(page);
    await page.click('#btn-launch-game');
  });

  test("l'intro de manche s'affiche", async ({ page }) => {
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
  });

  test('la manche numéro 1 est affichée', async ({ page }) => {
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#round-intro-num')).toContainText('1');
  });

  test('le bouton Commencer la manche est présent', async ({ page }) => {
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#btn-round-go')).toBeVisible();
  });

  test("cliquer Commencer mène à l'écran pré-tour", async ({ page }) => {
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
    await page.click('#btn-round-go');
    await expect(page.locator('#screen-pre-turn')).toBeVisible();
  });

  test("cliquer Prêt mène à l'écran de tour actif", async ({ page }) => {
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
    await page.click('#btn-round-go');
    await expect(page.locator('#screen-pre-turn')).toBeVisible();
    await page.click('#btn-ready');
    await expect(page.locator('#screen-turn')).toBeVisible();
  });

  test('le timer démarre sur le tour actif', async ({ page }) => {
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
    await page.click('#btn-round-go');
    await page.click('#btn-ready');
    await expect(page.locator('#screen-turn')).toBeVisible();
    const timerText = await page.locator('#timer-number').textContent();
    expect(Number(timerText)).toBeGreaterThan(0);
  });

  test('le mot est affiché sur le tour actif', async ({ page }) => {
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
    await page.click('#btn-round-go');
    await page.click('#btn-ready');
    await expect(page.locator('#screen-turn')).toBeVisible();
    await expect(page.locator('#word-card-text')).not.toHaveText('…');
  });
});

// ─── Bouton Quitter la partie ──────────────────────────────────────────────────

test.describe('Quitter une partie en cours', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('flashguess_word_draft', '0'));
    await page.goto(APP);
    await waitForInit(page);
    await goToTeams(page);
    await page.click('#btn-launch-game');
    await expect(page.locator('#screen-round-intro')).toBeVisible({ timeout: 8_000 });
  });

  test('le bouton Quitter est présent pendant le gameplay', async ({ page }) => {
    await expect(page.locator('#btn-game-close')).toBeVisible();
  });

  test("le bouton Quitter ramène à l'écran de configuration", async ({ page }) => {
    await page.click('#btn-game-close');
    await expect(page.locator('#screen-setup')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#bottom-nav')).toBeVisible();
  });
});

// ─── Écran Paramètres ──────────────────────────────────────────────────────────

test.describe('Écran Paramètres', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await page.click('#nav-parametres');
    await expect(page.locator('#screen-settings')).toBeVisible();
  });

  test("l'écran paramètres est accessible", async ({ page }) => {
    await expect(page.locator('#screen-settings')).toBeVisible();
  });

  test('le toggle Mode Enfant est présent', async ({ page }) => {
    await expect(page.locator('#toggle-kids-mode')).toBeVisible();
  });

  test('le toggle Choix des mots est présent', async ({ page }) => {
    await expect(page.locator('#toggle-word-draft')).toBeVisible();
  });

  test('le toggle Devineur tournant est présent', async ({ page }) => {
    await expect(page.locator('#toggle-rotating-guesser')).toBeVisible();
  });

  test('le bouton Tutoriel est présent', async ({ page }) => {
    await expect(page.locator('#btn-tutorial')).toBeVisible();
  });

  test('le bouton Classement est présent', async ({ page }) => {
    await expect(page.locator('#btn-leaderboard')).toBeVisible();
  });

  test('le toggle Mode Enfant peut être activé', async ({ page }) => {
    const btn = page.locator('#toggle-kids-mode');
    await expect(btn).toHaveAttribute('aria-checked', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-checked', 'true');
    await expect(btn).toContainText('ON');
  });

  test('le toggle Mode Enfant peut être désactivé après activation', async ({ page }) => {
    const btn = page.locator('#toggle-kids-mode');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-checked', 'true');
    // Attendre la fin du withCooldown (500 ms) avant le second clic
    await page.waitForTimeout(600);
    await btn.click();
    await expect(btn).toHaveAttribute('aria-checked', 'false');
  });

  test('le toggle Choix des mots bascule entre ON et OFF', async ({ page }) => {
    const btn = page.locator('#toggle-word-draft');
    const before = await btn.textContent();
    await btn.click();
    const after = await btn.textContent();
    expect(after).not.toBe(before);
  });

  test('la sélection du nombre de mots fonctionne', async ({ page }) => {
    await page.selectOption('#select-card-count', '20');
    await expect(page.locator('#select-card-count')).toHaveValue('20');
  });

  test('la sélection de la durée du tour fonctionne', async ({ page }) => {
    await page.selectOption('#select-turn-duration', '60');
    await expect(page.locator('#select-turn-duration')).toHaveValue('60');
  });
});

// ─── Tutoriel ──────────────────────────────────────────────────────────────────

test.describe('Tutoriel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await page.click('#nav-parametres');
    await page.click('#btn-tutorial');
    await expect(page.locator('#tutorial-overlay')).toBeVisible();
  });

  test("l'overlay s'ouvre avec du contenu", async ({ page }) => {
    await expect(page.locator('#tutorial-slide-content')).not.toBeEmpty();
  });

  test('le bouton Suivant change le contenu du slide', async ({ page }) => {
    const before = await page.locator('#tutorial-slide-content').textContent();
    await page.click('#tutorial-next');
    const after = await page.locator('#tutorial-slide-content').textContent();
    expect(after).not.toBe(before);
  });

  test('le bouton Précédent revient au slide précédent', async ({ page }) => {
    await page.click('#tutorial-next');
    const after1 = await page.locator('#tutorial-slide-content').textContent();
    await page.click('#tutorial-prev');
    const back = await page.locator('#tutorial-slide-content').textContent();
    expect(back).not.toBe(after1);
  });

  test('fermer le tutoriel avec le bouton ✕', async ({ page }) => {
    await page.click('#tutorial-close');
    await expect(page.locator('#tutorial-overlay')).toBeHidden();
  });

  test("fermer le tutoriel en cliquant sur l'overlay en dehors du modal", async ({ page }) => {
    await page.locator('#tutorial-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#tutorial-overlay')).toBeHidden();
  });
});

// ─── Classement ────────────────────────────────────────────────────────────────

test.describe('Classement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await page.click('#nav-parametres');
    await page.click('#btn-leaderboard');
    await expect(page.locator('#screen-leaderboard')).toBeVisible();
  });

  test("l'écran classement s'affiche", async ({ page }) => {
    await expect(page.locator('#screen-leaderboard')).toBeVisible();
  });

  test('les onglets Standard et Coop 2 joueurs sont présents', async ({ page }) => {
    await expect(page.locator('[data-tab="standard"]')).toBeVisible();
    await expect(page.locator('[data-tab="coop2"]')).toBeVisible();
  });

  test("l'onglet Standard est actif par défaut", async ({ page }) => {
    await expect(page.locator('[data-tab="standard"]')).toHaveClass(/leaderboard-tab-btn--active/);
    await expect(page.locator('#leaderboard-standard')).toBeVisible();
    await expect(page.locator('#leaderboard-coop2')).toBeHidden();
  });

  test("basculer vers l'onglet Coop 2 joueurs", async ({ page }) => {
    await page.click('[data-tab="coop2"]');
    await expect(page.locator('#leaderboard-coop2')).toBeVisible();
    await expect(page.locator('#leaderboard-standard')).toBeHidden();
  });

  test('revenir aux paramètres depuis le classement', async ({ page }) => {
    await page.click('#btn-leaderboard-back');
    await expect(page.locator('#screen-settings')).toBeVisible();
  });
});

// ─── Écran Groupes ─────────────────────────────────────────────────────────────

test.describe('Écran Groupes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await page.click('#nav-groupes');
    await expect(page.locator('#screen-groups')).toBeVisible();
  });

  test("l'écran groupes s'affiche", async ({ page }) => {
    await expect(page.locator('#screen-groups')).toBeVisible();
  });

  test('le formulaire de création de groupe est présent', async ({ page }) => {
    await expect(page.locator('#group-new-name')).toBeVisible();
    await expect(page.locator('#btn-group-create')).toBeVisible();
  });

  test('créer un groupe et le voir apparaître', async ({ page }) => {
    await page.fill('#group-new-name', 'Famille');
    await page.click('#btn-group-create');
    await expect(page.locator('#groups-editor-list')).toContainText('Famille');
  });
});

// ─── Mode démo ─────────────────────────────────────────────────────────────────

test.describe('Mode démo', () => {
  test('le bouton Fausse partie est présent', async ({ page }) => {
    await page.goto(APP);
    await waitForInit(page);
    await expect(page.locator('#btn-launch-demo')).toBeVisible();
  });
});

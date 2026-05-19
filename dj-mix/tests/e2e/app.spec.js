import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
const APP = `${BASE}/dj-mix/`;
const API_BASE = 'http://mocked-api.local';

const API_URL_STORAGE_KEY = 'dj-mix:downloader:api:url';

async function gotoAppWithMockedApi(page) {
  await page.addInitScript(({ apiBase, key }) => {
    localStorage.setItem(key, apiBase);
  }, { apiBase: API_BASE, key: API_URL_STORAGE_KEY });

  await page.goto(APP);
  await expect(page.locator('#app-screen')).toBeVisible();
}

const QUEUE_KEY = 'dj-mix:queue';

const DEFAULT_CACHE_FILES = [
  {
    id: 'cache-1',
    trackName: 'One More Time',
    artistName: 'Daft Punk',
    duration: 320000,
    year: 2000,
    genre: 'House',
    cachePath: '/cache/one-more-time.mp3',
    stemsStatus: 'ready',
    vocals: '/api/cache/one-more-time.vocals.mp3',
    instrumental: '/api/cache/one-more-time.instru.mp3',
  },
  {
    id: 'cache-2',
    trackName: 'Windowlicker',
    artistName: 'Aphex Twin',
    duration: 360000,
    year: 1999,
    genre: 'IDM',
    cachePath: '/cache/windowlicker.mp3',
    stemsStatus: 'pending',
  },
];

const DEFAULT_QUEUE_ITEMS = [
  {
    id: 'q-1',
    uri: 'api:track:q-1',
    name: 'Track One',
    artist: 'Artist One',
    artUrl: '',
    duration: 210000,
    loudnessDb: null,
    cachePath: '',
    ratingKey: '',
    persistedSourceUrl: '',
    sourceState: 'idle',
  },
  {
    id: 'q-2',
    uri: 'api:track:q-2',
    name: 'Track Two',
    artist: 'Artist Two',
    artUrl: '',
    duration: 250000,
    loudnessDb: null,
    cachePath: '',
    ratingKey: '',
    persistedSourceUrl: '',
    sourceState: 'idle',
  },
];

async function installApiMocks(page, options = {}) {
  const {
    cacheFiles = DEFAULT_CACHE_FILES,
    onSearchRequest,
  } = options;

  await page.route(`${API_BASE}/health`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });

  await page.route(`${API_BASE}/api/search**`, async (route) => {
    const url = new URL(route.request().url());
    const term = (url.searchParams.get('term') || '').toLowerCase().trim();

    if (typeof onSearchRequest === 'function') {
      const custom = onSearchRequest(term);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(custom),
      });
      return;
    }

    const payload = {
      results: [
        {
          id: `song-${term || 'demo'}`,
          title: `Title ${term || 'demo'}`,
          artist: 'Mock Artist',
          duration_ms: 185000,
          popularity: 90,
        },
        {
          id: `artist-${term || 'demo'}`,
          type: 'artist',
          name: `Artist ${term || 'demo'}`,
          popularity: 80,
        },
      ],
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });

  await page.route(`${API_BASE}/api/cache/files**`, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    const url = new URL(request.url());
    const limit = Math.max(1, Number.parseInt(url.searchParams.get('limit') || '200', 10) || 200);
    const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const results = cacheFiles.slice(offset, offset + limit);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results,
        hasMore: offset + results.length < cacheFiles.length,
        count: cacheFiles.length,
      }),
    });
  });
}

async function seedLocalStorage(page, options = {}) {
  const {
    apiBase = API_BASE,
    queueItems = null,
    queueIndex = 0,
  } = options;

  await page.addInitScript(({ api, queueKey, queue, index, apiKey }) => {
    localStorage.setItem(apiKey, api);
    if (Array.isArray(queue)) {
      localStorage.setItem(queueKey, JSON.stringify({
        index,
        items: queue,
      }));
    } else {
      localStorage.removeItem(queueKey);
    }
  }, {
    api: apiBase,
    queueKey: QUEUE_KEY,
    queue: queueItems,
    index: queueIndex,
    apiKey: API_URL_STORAGE_KEY,
  });
}

async function gotoApp(page) {
  await page.goto(APP);
  await expect(page.locator('#app-screen')).toBeVisible();
  await expect(page.locator('.tab-bar')).toBeVisible();
}

async function setupApp(page, options = {}) {
  await installApiMocks(page, options);
  await seedLocalStorage(page, {
    queueItems: options.queueItems ?? null,
    queueIndex: options.queueIndex ?? 0,
  });
  await gotoApp(page);
}

test.describe('DJ Mix IHM - structure et navigation', () => {
  test('affiche les blocs principaux de l ecran mix', async ({ page }) => {
    await setupApp(page);

    await expect(page.locator('#tab-mix')).toBeVisible();
    await expect(page.locator('#deck-a-panel')).toBeVisible();
    await expect(page.locator('#deck-b-panel')).toBeVisible();
    await expect(page.locator('#queue-list')).toBeVisible();
    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('#automix-btn')).toBeVisible();
  });

  test('navigue entre mix, cache et config', async ({ page }) => {
    await setupApp(page);

    await page.locator('.tab-bar-btn[data-tab="config"]').click();
    await expect(page.locator('#tab-config')).toBeVisible();
    await expect(page.locator('#tab-mix')).toBeHidden();

    await page.locator('.tab-bar-btn[data-tab="playlist"]').click();
    await expect(page.locator('#tab-playlist')).toBeVisible();
    await expect(page.locator('#playlist-list .cache-item')).toHaveCount(2);

    await page.locator('.tab-bar-btn[data-tab="mix"]').click();
    await expect(page.locator('#tab-mix')).toBeVisible();
  });

  test('toggle le menu mix et la visibilite FX', async ({ page }) => {
    await setupApp(page);

    await expect(page.locator('#tab-mix')).not.toHaveClass(/mix-options-collapsed/);
    await page.click('#toggle-mix-menu-btn');
    await expect(page.locator('#tab-mix')).toHaveClass(/mix-options-collapsed/);
    await page.click('#toggle-mix-menu-btn');
    await expect(page.locator('#tab-mix')).not.toHaveClass(/mix-options-collapsed/);

    await expect(page.locator('#fx-visibility-btn')).toHaveAttribute('aria-expanded', 'true');
    await page.click('#fx-visibility-btn');
    await expect(page.locator('#fx-visibility-btn')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.dj-fx-row')).toBeHidden();
    await page.click('#fx-visibility-btn');
    await expect(page.locator('#fx-visibility-btn')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.dj-fx-row')).toBeVisible();
  });
});

test.describe('DJ Mix IHM - configuration', () => {
  test('sauve et teste l URL API', async ({ page }) => {
    await setupApp(page);

    await page.locator('.tab-bar-btn[data-tab="config"]').click();
    await page.fill('#downloader-api-url-input', API_BASE);
    await page.click('#downloader-api-save-btn');
    await expect(page.locator('#downloader-api-status')).toContainText('Configuration API enregistree');

    await page.click('#downloader-api-test-btn');
    await expect(page.locator('#downloader-api-status')).toContainText('Serveur disponible');
  });

  test('met a jour le crossfade et le mode de transition', async ({ page }) => {
    await setupApp(page);

    await page.locator('.tab-bar-btn[data-tab="config"]').click();
    await page.fill('#crossfade-slider', '12');
    await expect(page.locator('#crossfade-value')).toContainText('12s');

    await page.selectOption('#mix-transition-mode', 'cut_transition');
    await expect(page.locator('#mix-transition-mode')).toHaveValue('cut_transition');
  });

  test('toggle les options de mix locales', async ({ page }) => {
    await setupApp(page);

    await expect(page.locator('#manual-lock-btn')).toContainText('Auto-Fade: ON');
    await page.click('#manual-lock-btn');
    await expect(page.locator('#manual-lock-btn')).toContainText('Auto-Fade: OFF');

    await page.click('#fx-auto-bpm-btn');
    await expect(page.locator('#fx-auto-bpm-btn')).toContainText('Auto BPM: ON');

    await page.click('#fx-echo-btn');
    await expect(page.locator('#fx-echo-btn')).toContainText('Echo: ON');
  });
});

test.describe('DJ Mix IHM - recherche', () => {
  test('ouvre et ferme l overlay de recherche', async ({ page }) => {
    await setupApp(page);

    await page.fill('#search-input', 'justice');
    await page.press('#search-input', 'Enter');
    await expect(page.locator('#search-overlay')).toBeVisible();

    await page.click('#search-close');
    await expect(page.locator('#search-overlay')).toBeHidden();

    await page.fill('#search-input', 'daft');
    await expect(page.locator('#search-clear')).toBeVisible();
    await page.click('#search-clear');
    await expect(page.locator('#search-input')).toHaveValue('');
  });

  test('affiche sections musiques et artistes depuis l API mockee', async ({ page }) => {
    await setupApp(page);

    await page.fill('#search-input', 'daft punk');
    await page.press('#search-input', 'Enter');

    await expect(page.locator('#search-results .search-section[data-section="songs"] .search-result-item')).toHaveCount(1);
    await expect(page.locator('#search-results .search-section[data-section="artists"] .search-result-item')).toHaveCount(1);
    await expect(page.locator('#search-results')).toContainText('Title daft punk');
    await expect(page.locator('#search-results')).toContainText('Artist daft punk');
  });

  test('clic artiste relance une recherche avec son nom', async ({ page }) => {
    const terms = [];

    await setupApp(page, {
      onSearchRequest: (term) => {
        terms.push(term);
        if (term === 'chemical brothers') {
          return {
            results: [
              {
                id: 'artist-chem',
                type: 'artist',
                name: 'The Chemical Brothers',
                popularity: 95,
              },
            ],
          };
        }
        return {
          results: [
            {
              id: 'song-chem-1',
              title: 'Hey Boy Hey Girl',
              artist: 'The Chemical Brothers',
              duration_ms: 250000,
            },
          ],
        };
      },
    });

    await page.fill('#search-input', 'chemical brothers');
    await page.press('#search-input', 'Enter');

    const artistItem = page.locator('#search-results .search-section[data-section="artists"] .search-result-item').first();
    await expect(artistItem).toBeVisible();
    await artistItem.click();

    await expect(page.locator('#search-input')).toHaveValue('The Chemical Brothers');
    await expect(page.locator('#search-results')).toContainText('Hey Boy Hey Girl');
    expect(terms).toContain('chemical brothers');
    expect(terms).toContain('the chemical brothers');
  });
});

test.describe('DJ Mix IHM - cache et file d attente', () => {
  test('charge le cache et applique les filtres', async ({ page }) => {
    await setupApp(page);

    await page.locator('.tab-bar-btn[data-tab="playlist"]').click();
    await expect(page.locator('#playlist-list .cache-item')).toHaveCount(2);
    await expect(page.locator('#cache-filter-count')).toContainText('2 / 2');

    await page.selectOption('#cache-genre-filter', 'House');
    await expect(page.locator('#playlist-list .cache-item')).toHaveCount(1);

    await page.selectOption('#cache-year-filter', '2000');
    await expect(page.locator('#playlist-list .cache-item')).toHaveCount(1);

    await page.check('#cache-stems-filter');
    await expect(page.locator('#playlist-list .cache-item')).toHaveCount(1);

    await page.click('#cache-reset-filters');
    await expect(page.locator('#playlist-list .cache-item')).toHaveCount(2);
  });

  test('ajoute un morceau du cache a la queue sans autoplay force', async ({ page }) => {
    await setupApp(page, {
      queueItems: DEFAULT_QUEUE_ITEMS,
      queueIndex: 0,
    });

    await expect(page.locator('#queue-list .queue-item')).toHaveCount(2);

    await page.locator('.tab-bar-btn[data-tab="playlist"]').click();
    await expect(page.locator('#playlist-list .cache-item')).toHaveCount(2);
    await page.locator('#playlist-list .cache-add-btn').first().click();

    await page.locator('.tab-bar-btn[data-tab="mix"]').click();
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(3);
  });

  test('retire un item non courant puis vide la queue (garde le courant)', async ({ page }) => {
    await setupApp(page, {
      queueItems: DEFAULT_QUEUE_ITEMS,
      queueIndex: 0,
    });

    await expect(page.locator('#queue-list .queue-item')).toHaveCount(2);
    await page.locator('#queue-list .queue-remove').nth(1).click();
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(1);

    await page.click('#clear-queue-btn');
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers supplémentaires
// ─────────────────────────────────────────────────────────────────────────────

/** Ajoute une chanson depuis la recherche et ferme l'overlay. */
async function addTrackViaSearch(page, term) {
  await page.fill('#search-input', term);
  await page.press('#search-input', 'Enter');
  await expect(page.locator('#search-overlay')).toBeVisible();
  const addBtn = page.locator('.search-result-item[data-kind="song"] .add-btn').first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await page.click('#search-close');
}

/** Génère N items de queue factices. */
function makeQueueItems(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    uri: `api:track:t${i + 1}`,
    name: `Track ${i + 1}`,
    artist: `Artist ${i + 1}`,
    artUrl: '',
    duration: 200000 + i * 10000,
    loudnessDb: null,
    cachePath: '',
    ratingKey: '',
    persistedSourceUrl: '',
    sourceState: 'idle',
  }));
}

const UISTATE_REF_ERRORS =
  /currentIndex is not defined|deckBCueIndex is not defined|deckCueDeck is not defined|prevIsCrossfading is not defined|deckMixRatio is not defined|currentTrackId is not defined|isPlaying is not defined/;

// ─────────────────────────────────────────────────────────────────────────────
// CHEMIN UTILISATEUR COMPLET
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Chemin utilisateur complet', () => {
  test('ajout via recherche → cue platine B → DnD → suppression', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(2), queueIndex: 0 });
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(2);

    // 1. Ajoute un 3e morceau via la recherche
    await addTrackViaSearch(page, 'new track');
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(3);

    // 2. Met le 3e item en cue sur la platine B
    const cueBBtn = page.locator('.queue-item[data-index="2"] .queue-cue[data-deck="B"]');
    await cueBBtn.click();
    await expect(cueBBtn).toHaveClass(/is-selected/);

    // 3. Réorganise : déplace item 1 vers item 2 via DnD
    await page.locator('.queue-item[data-index="1"]').dragTo(
      page.locator('.queue-item[data-index="2"]'),
    );
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(3);

    // 4. Supprime le dernier item
    await page.locator('#queue-list .queue-remove').last().click();
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(2);
  });

  test('AutoMix : ajout chanson → cue B → automix → toast sans Erreur', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });

    // Ajoute un 4e item
    await addTrackViaSearch(page, 'deep house');
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(4);

    // Sélectionne un cue B sur item 2
    const cueB = page.locator('.queue-item[data-index="2"] .queue-cue[data-deck="B"]');
    await cueB.click();
    await expect(cueB).toHaveClass(/is-selected/);

    // Déclenche AutoMix
    await page.click('#automix-btn');
    const toast = page.locator('.toast');
    if (await toast.count() > 0) {
      await expect(toast).not.toContainText('Erreur');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// File d'attente — comportements avancés
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix IHM - file d attente avancée', () => {
  test('restaure la queue depuis le localStorage au rechargement', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 1 });
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(3);
  });

  test('queue vide affiche le placeholder #empty-queue', async ({ page }) => {
    await setupApp(page, { queueItems: [], queueIndex: 0 });
    await expect(page.locator('#empty-queue')).toBeVisible();
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(0);
  });

  test('ajout via recherche incrémente le compteur d items', async ({ page }) => {
    await setupApp(page);
    await addTrackViaSearch(page, 'jazz');
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(1);
    await addTrackViaSearch(page, 'techno');
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(2);
  });

  test('remove supprime uniquement l item ciblé', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(4), queueIndex: 0 });
    await page.locator('.queue-item[data-index="2"] .queue-remove').click();
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(3);
  });

  test('clear queue conserve uniquement l item courant', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(4), queueIndex: 0 });
    await page.click('#clear-queue-btn');
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(1);
  });

  test('réorganisation DnD conserve le nombre d items', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    await page.locator('.queue-item[data-index="2"]').dragTo(
      page.locator('.queue-item[data-index="0"]'),
    );
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(3);
  });

  test('numéros 1-based visibles sur les items', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    const nums = await page.locator('#queue-list .queue-num').allTextContents();
    expect(nums.some((n) => /[1-9]/.test(n))).toBe(true);
  });

  test('chips BPM et genre affichées si présentes dans les données', async ({ page }) => {
    const items = [{
      id: 'bpm-1', uri: 'api:track:bpm-1', name: 'Bpm Track', artist: 'DJ',
      artUrl: '', duration: 200000, loudnessDb: null, cachePath: '', ratingKey: '',
      persistedSourceUrl: '', sourceState: 'idle', bpm: 128, genre: 'House',
    }];
    await setupApp(page, { queueItems: items, queueIndex: 0 });
    await expect(page.locator('#queue-list .queue-chip')).toHaveCount(2);
    await expect(page.locator('#queue-list')).toContainText('128 BPM');
    await expect(page.locator('#queue-list')).toContainText('House');
  });

  test('item courant porte la classe is-current', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 1 });
    await expect(page.locator('#queue-list .queue-item.is-current')).toHaveCount(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cue — assigner une piste à une platine depuis la file
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix IHM - cue platines', () => {
  test('cue A sélectionne le bouton is-selected', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    const cueA = page.locator('.queue-item[data-index="1"] .queue-cue[data-deck="A"]');
    await cueA.click();
    await expect(cueA).toHaveClass(/is-selected/);
  });

  test('cue B sélectionne le bouton is-selected', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    const cueB = page.locator('.queue-item[data-index="2"] .queue-cue[data-deck="B"]');
    await cueB.click();
    await expect(cueB).toHaveClass(/is-selected/);
  });

  test('cliquer cue sur un autre item désélectionne le précédent', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    const cueB1 = page.locator('.queue-item[data-index="1"] .queue-cue[data-deck="B"]');
    const cueB2 = page.locator('.queue-item[data-index="2"] .queue-cue[data-deck="B"]');
    await cueB1.click();
    await expect(cueB1).toHaveClass(/is-selected/);
    await cueB2.click();
    await expect(cueB2).toHaveClass(/is-selected/);
    await expect(cueB1).not.toHaveClass(/is-selected/);
  });

  test('double-clic sur le même bouton cue le désélectionne', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    const cueB = page.locator('.queue-item[data-index="1"] .queue-cue[data-deck="B"]');
    await cueB.click();
    await expect(cueB).toHaveClass(/is-selected/);
    await cueB.click();
    await expect(cueB).not.toHaveClass(/is-selected/);
  });

  test('bouton cue de l item 1 n est pas disabled par défaut', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(2), queueIndex: 0 });
    await expect(page.locator('.queue-item[data-index="1"] .queue-cue[data-deck="A"]')).not.toBeDisabled();
  });

  test('cue A et cue B sur items différents peuvent coexister', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(4), queueIndex: 0 });
    await page.locator('.queue-item[data-index="1"] .queue-cue[data-deck="A"]').click();
    await page.locator('.queue-item[data-index="2"] .queue-cue[data-deck="B"]').click();
    await expect(page.locator('.queue-cue.is-selected')).toHaveCount(2);
  });

  test('cue sur item puis suppression de cet item réinitialise le cue', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    await page.locator('.queue-item[data-index="2"] .queue-cue[data-deck="B"]').click();
    await expect(page.locator('.queue-cue.is-selected')).toHaveCount(1);
    await page.locator('.queue-item[data-index="2"] .queue-remove').click();
    await expect(page.locator('.queue-cue.is-selected')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AutoMix et AutoDJ
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix IHM - AutoMix et AutoDJ', () => {
  test('bouton AutoMix visible', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#automix-btn')).toBeVisible();
  });

  test('AutoDJ toggle change aria-pressed', async ({ page }) => {
    await setupApp(page);
    const btn = page.locator('#auto-mode-btn');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('AutoMix avec queue vide ne produit pas de toast d erreur', async ({ page }) => {
    await setupApp(page, { queueItems: [], queueIndex: 0 });
    await page.click('#automix-btn');
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('AutoMix avec 1 seul item ne produit pas de toast d erreur', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(1), queueIndex: 0 });
    await page.click('#automix-btn');
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('AutoMix avec 2+ items déclenche un toast AutoMix', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(2), queueIndex: 0 });
    await page.click('#automix-btn');
    await expect(page.locator('.toast')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.toast')).toContainText('AutoMix');
  });

  test('cue sélectionné avant AutoMix ne génère pas de toast Erreur', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    await page.locator('.queue-item[data-index="2"] .queue-cue[data-deck="B"]').click();
    await page.click('#automix-btn');
    const toastCount = await page.locator('.toast').count();
    if (toastCount > 0) {
      await expect(page.locator('.toast')).not.toContainText('Erreur');
    }
  });

  test('AutoDJ activé puis désactivé ne laisse pas de toast Erreur', async ({ page }) => {
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    await page.click('#auto-mode-btn');
    await page.waitForTimeout(200);
    await page.click('#auto-mode-btn');
    const toastCount = await page.locator('.toast').count();
    if (toastCount > 0) {
      await expect(page.locator('.toast')).not.toContainText('Erreur');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Crossfader et contrôles de mix
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix IHM - crossfader et mix', () => {
  test('crossfader démarre à 0', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#deck-mix-slider')).toHaveValue('0');
  });

  test('déplacer le crossfader à 100 accepte la valeur', async ({ page }) => {
    await setupApp(page);
    await page.fill('#deck-mix-slider', '100');
    await page.locator('#deck-mix-slider').dispatchEvent('input');
    await expect(page.locator('#deck-mix-slider')).toHaveValue('100');
  });

  test('crossfader à 50 accepte la valeur', async ({ page }) => {
    await setupApp(page);
    await page.fill('#deck-mix-slider', '50');
    await page.locator('#deck-mix-slider').dispatchEvent('input');
    await expect(page.locator('#deck-mix-slider')).toHaveValue('50');
  });

  test('boutons +/- ajustent la durée crossfade', async ({ page }) => {
    await setupApp(page);
    const label = page.locator('#crossfade-value-mix');
    const initial = await label.textContent();
    await page.click('#crossfade-faster-btn');
    expect(await label.textContent()).not.toBe(initial);
    await page.click('#crossfade-slower-btn');
    expect(await label.textContent()).toBe(initial);
  });

  test('mode transition changeable depuis le panel mix', async ({ page }) => {
    await setupApp(page);
    await page.selectOption('#mix-transition-mode', 'cut_transition');
    await expect(page.locator('#mix-transition-mode')).toHaveValue('cut_transition');
  });

  test('Manual-lock bascule Auto-Fade ON/OFF', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#manual-lock-btn')).toContainText('Auto-Fade: ON');
    await page.click('#manual-lock-btn');
    await expect(page.locator('#manual-lock-btn')).toContainText('Auto-Fade: OFF');
  });

  test('toggle durée max change le texte du bouton', async ({ page }) => {
    await setupApp(page);
    const toggle = page.locator('#track-max-duration-toggle');
    const before = await toggle.textContent();
    await toggle.click();
    expect(await toggle.textContent()).not.toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Platines
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix IHM - platines', () => {
  test('les deux deck panels sont visibles', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#deck-a-panel')).toBeVisible();
    await expect(page.locator('#deck-b-panel')).toBeVisible();
  });

  test('les labels volume sont affichés', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#deck-a-vol')).toBeVisible();
    await expect(page.locator('#deck-b-vol')).toBeVisible();
  });

  test('les barres de progression existent dans le DOM', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#deck-a-progress')).toBeVisible();
    await expect(page.locator('#deck-b-progress')).toBeVisible();
  });

  test('clic launch deck A sans audio ne génère pas de ReferenceError', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupApp(page, { queueItems: makeQueueItems(1), queueIndex: 0 });
    await page.click('#deck-a-launch');
    await page.waitForTimeout(300);
    expect(errors.filter((e) => UISTATE_REF_ERRORS.test(e))).toHaveLength(0);
  });

  test('clic launch deck B sans audio ne génère pas de ReferenceError', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupApp(page, { queueItems: makeQueueItems(2), queueIndex: 0 });
    await page.click('#deck-b-launch');
    await page.waitForTimeout(300);
    expect(errors.filter((e) => UISTATE_REF_ERRORS.test(e))).toHaveLength(0);
  });

  test('les marqueurs AutoDJ et max-duration sont attachés au DOM', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#deck-a-autodj-marker')).toBeAttached();
    await expect(page.locator('#deck-b-autodj-marker')).toBeAttached();
    await expect(page.locator('#deck-a-maxdur-marker')).toBeAttached();
    await expect(page.locator('#deck-b-maxdur-marker')).toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modes DJ
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix IHM - modes DJ', () => {
  test('par défaut le mode Music est actif', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#dj-mode-music-btn')).toHaveClass(/is-active/);
    await expect(page.locator('#dance-genre-list')).toBeHidden();
  });

  test('passer en mode Dance affiche la liste de genres', async ({ page }) => {
    await setupApp(page);
    await page.click('#dj-mode-dance-btn');
    await expect(page.locator('#dj-mode-dance-btn')).toHaveClass(/is-active/);
    await expect(page.locator('#dance-genre-list')).toBeVisible();
  });

  test('repasser en mode Music masque la liste de genres', async ({ page }) => {
    await setupApp(page);
    await page.click('#dj-mode-dance-btn');
    await page.click('#dj-mode-music-btn');
    await expect(page.locator('#dance-genre-list')).toBeHidden();
  });

  test('cliquer une pastille de genre selectionne ce genre dans la liste', async ({ page }) => {
    await setupApp(page, {
      queueItems: [
        { ...DEFAULT_QUEUE_ITEMS[0], genre: 'House' },
        { ...DEFAULT_QUEUE_ITEMS[1], genre: 'IDM' },
      ],
    });

    await page.click('#dj-mode-dance-btn');
    const genreChip = page.locator('#queue-list .queue-chip--genre[data-genre="House"]');

    await expect(genreChip).toBeVisible();
    await genreChip.click();
    await expect(page.locator('#dance-genre-list')).toHaveValue('House');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FX
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix IHM - FX', () => {
  test('les boutons FX principaux sont visibles', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('#fx-auto-bpm-btn')).toBeVisible();
    await expect(page.locator('#fx-echo-btn')).toBeVisible();
    await expect(page.locator('#fx-distortion-btn')).toBeVisible();
  });

  test('toggle Auto BPM ON puis OFF', async ({ page }) => {
    await setupApp(page);
    await page.click('#fx-auto-bpm-btn');
    await expect(page.locator('#fx-auto-bpm-btn')).toContainText('ON');
    await page.click('#fx-auto-bpm-btn');
    await expect(page.locator('#fx-auto-bpm-btn')).toContainText('OFF');
  });

  test('toggle Echo ON', async ({ page }) => {
    await setupApp(page);
    await page.click('#fx-echo-btn');
    await expect(page.locator('#fx-echo-btn')).toContainText('ON');
  });

  test('toggle Distortion ON', async ({ page }) => {
    await setupApp(page);
    await page.click('#fx-distortion-btn');
    await expect(page.locator('#fx-distortion-btn')).toContainText('ON');
  });

  test('masquer puis afficher le panneau FX', async ({ page }) => {
    await setupApp(page);
    await expect(page.locator('.dj-fx-row')).toBeVisible();
    await page.click('#fx-visibility-btn');
    await expect(page.locator('.dj-fx-row')).toBeHidden();
    await page.click('#fx-visibility-btn');
    await expect(page.locator('.dj-fx-row')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recherche avancée
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix IHM - recherche avancée', () => {
  test('plusieurs recherches successives accumulent les items dans la queue', async ({ page }) => {
    await setupApp(page);
    await addTrackViaSearch(page, 'house');
    await addTrackViaSearch(page, 'techno');
    await expect(page.locator('#queue-list .queue-item')).toHaveCount(2);
  });

  test('recherche sans résultats n affiche pas d items songs', async ({ page }) => {
    await setupApp(page, { onSearchRequest: () => ({ results: [] }) });
    await page.fill('#search-input', 'noresult');
    await page.press('#search-input', 'Enter');
    await expect(page.locator('#search-overlay')).toBeVisible();
    await expect(page.locator('#search-results .search-result-item[data-kind="song"]')).toHaveCount(0);
  });

  test('la touche Escape ferme l overlay de recherche', async ({ page }) => {
    await setupApp(page);
    await page.fill('#search-input', 'test');
    await page.press('#search-input', 'Enter');
    await expect(page.locator('#search-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#search-overlay')).toBeHidden();
  });

  test('bouton Fade ajoute dans la queue sans ReferenceError', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupApp(page);
    await page.fill('#search-input', 'ambient');
    await page.press('#search-input', 'Enter');
    await expect(page.locator('#search-overlay')).toBeVisible();
    const fadeBtn = page.locator('.search-result-item[data-kind="song"] .play-now-btn').first();
    await expect(fadeBtn).toBeVisible();
    await fadeBtn.click();
    await page.waitForTimeout(300);
    expect(errors.filter((e) => UISTATE_REF_ERRORS.test(e))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Régression uiState — aucune ReferenceError liée à la migration
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DJ Mix - régression uiState', () => {
  test('aucune ReferenceError au chargement avec queue vide', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupApp(page, { queueItems: [], queueIndex: 0 });
    await page.waitForTimeout(500);
    expect(errors.filter((e) => UISTATE_REF_ERRORS.test(e))).toHaveLength(0);
  });

  test('aucune ReferenceError avec queue de 5 items et interactions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupApp(page, { queueItems: makeQueueItems(5), queueIndex: 2 });
    await page.locator('.queue-item[data-index="3"] .queue-cue[data-deck="B"]').click();
    await page.locator('.queue-item[data-index="1"] .queue-cue[data-deck="A"]').click();
    await page.click('#automix-btn');
    await page.click('#manual-lock-btn');
    await page.fill('#deck-mix-slider', '50');
    await page.locator('#deck-mix-slider').dispatchEvent('input');
    await page.waitForTimeout(300);
    expect(errors.filter((e) => UISTATE_REF_ERRORS.test(e))).toHaveLength(0);
  });

  test('launchDeckFromQueue ne lève pas currentIndex is not defined', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 0 });
    await page.click('#deck-a-launch');
    await page.click('#deck-b-launch');
    await page.waitForTimeout(300);
    expect(errors.filter((e) => /currentIndex is not defined/.test(e))).toHaveLength(0);
  });

  test('DnD réorganisation ne génère pas de ReferenceError', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupApp(page, { queueItems: makeQueueItems(4), queueIndex: 0 });
    await page.locator('.queue-item[data-index="3"]').dragTo(
      page.locator('.queue-item[data-index="1"]'),
    );
    await page.waitForTimeout(200);
    expect(errors.filter((e) => UISTATE_REF_ERRORS.test(e))).toHaveLength(0);
  });

  test('reset complet via logout ne génère pas de ReferenceError', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupApp(page, { queueItems: makeQueueItems(3), queueIndex: 1 });
    await page.click('#logout-btn');
    await page.waitForTimeout(300);
    expect(errors.filter((e) => UISTATE_REF_ERRORS.test(e))).toHaveLength(0);
  });
});

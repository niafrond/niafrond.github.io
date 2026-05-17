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
    await page.click('#fx-visibility-btn');
    await expect(page.locator('#fx-visibility-btn')).toHaveAttribute('aria-expanded', 'true');
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

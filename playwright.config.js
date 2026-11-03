import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 15_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
  },
  webServer: {
    command: 'npx serve . --listen 4173 --no-clipboard',
    url: 'http://localhost:4173',
    timeout: 60_000,
    reuseExistingServer: false,
  },
  reporter: [['list']],
  projects: [
    {
      name: 'quiz',
      testDir: './quiz/tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'flash-guess',
      testDir: './flash-guess/tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'dj-mix',
      testDir: './dj-mix/tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'match3-quest-mobile',
      testDir: './match3-quest/tests/e2e',
      use: { ...devices['Pixel 5'] },
      metadata: { cpuSlowdown: 4, cores: 4 },
    },
    {
      // Téléphone ancien et bas de gamme : Moto G4 (2016, 360×640 @3x), 2 cœurs, CPU ralenti ×6
      name: 'match3-quest-lowend',
      testDir: './match3-quest/tests/e2e',
      testMatch: 'perf-mobile.spec.js',
      use: { ...devices['Moto G4'] },
      // Mesuré à ≈ 8 s (22 s avant l'instantané du monde) : plafond à 15 s
      metadata: { cpuSlowdown: 6, cores: 2, loadBudgetMs: 15_000 },
    },
  ],
});

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
    timeout: 15_000,
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
  ],
});

import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the production build (`npm run build` first).
 *
 * One worker: the specs share one seeded database and the order-lifecycle
 * spec changes it. No retries: a flaky e2e test is a bug to fix, not to hide.
 */
const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // CSRF checks compare Origin with APP_URL, so it must be this server.
      APP_URL: `http://localhost:${PORT}`,
      SIMULATED_PAYMENTS: 'true',
    },
  },
});

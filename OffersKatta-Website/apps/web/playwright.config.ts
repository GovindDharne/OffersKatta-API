import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a stack already started via:
 *   pnpm docker:dev:build
 *
 * Override the base URL via E2E_BASE_URL when targeting a staging environment.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // we share a DB with seeded data
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

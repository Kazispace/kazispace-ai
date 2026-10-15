import { defineConfig, devices } from '@playwright/test';

/**
 * Product smoke / Deploy Gate E2E against a live FE host.
 *
 * Default: https://kazispace.ai (CORS-safe vs bot.kazispace.ai).
 * Preview: PLAYWRIGHT_BASE_URL=https://owen--kazispace.netlify.app
 *   (use session injection — OTP UI often blocked by CORS, see deploy.md §3)
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://kazispace.ai';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});

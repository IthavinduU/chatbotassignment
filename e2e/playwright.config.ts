import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for Fabulari.
 */
export default defineConfig({
  testDir: './tests',
  workers: 1, 
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
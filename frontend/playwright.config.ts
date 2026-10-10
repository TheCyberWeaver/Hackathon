import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 12_000 },
  workers: 1,
  use: {
    actionTimeout: 12_000,
    baseURL: 'http://127.0.0.1:5186',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  globalSetup: './scripts/e2e-server.mjs',
})

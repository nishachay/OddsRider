import { defineConfig } from 'playwright/test';

// Smoke test: boots the built app, rides for a few seconds, asserts zero console
// errors. It runs fully offline — Polymarket calls are mocked from
// tests/fixtures, and any other external request fails the test.
//
// `pnpm preview` serves the existing `dist/`, so run `pnpm build` first.
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

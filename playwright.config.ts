import { defineConfig } from 'playwright/test';

// Smoke test: boots the built app, rides a frozen track for a few seconds,
// asserts zero console errors, and checks the missing-index error state. It
// runs fully offline — the browser reads only our own committed
// `public/tracks/*.json`, Google Fonts is stubbed, and any other external
// request (including any Polymarket call) fails the test.
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

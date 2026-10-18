import { expect, test, type Page } from 'playwright/test';
import {
  TRACKS,
  assertClean,
  listen,
  mockThirdParties,
  telemetry,
  type DebugHandle,
} from './support';

// ---------------------------------------------------------------------------
// Offline smoke test for the arcade flow.
//
// This test never touches the network. The browser reads only our own frozen
// `/tracks/*.json` (committed to the repo), Google Fonts is stubbed, and any
// other external request — including any call to a Polymarket domain — is
// aborted and reported as a failure.
//
// Scope: the title screen attract mode starts a ride from one keypress, the
// level select opens a track, the daily screen is deterministic for a fixed
// date, and missing/empty indexes show clear error states instead of fake
// data. Gameplay physics are not asserted here.
// ---------------------------------------------------------------------------

const IDS = new Set(TRACKS.map((t) => t.id));

// Wait out the 3-2-1-RIDE gate, then hold gas and watch the bike move.
async function rideBriefly(page: Page): Promise<void> {
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForFunction(
    () => Boolean((window as unknown as { __oddsrider?: DebugHandle }).__oddsrider),
  );
  await expect(page.getByText(/W GAS/)).toHaveCount(0);
  await page.waitForTimeout(1200);

  const before = await telemetry(page);
  await page.keyboard.down('w');
  let furthest = before.x;
  let fastest = 0;
  let sawSimulation = before.simMs;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    const sample = await telemetry(page);
    furthest = Math.max(furthest, sample.x);
    fastest = Math.max(fastest, sample.speed);
    sawSimulation = Math.max(sawSimulation, sample.simMs);
  }
  await page.keyboard.up('w');

  expect(sawSimulation).toBeGreaterThan(before.simMs);
  expect(furthest).toBeGreaterThan(before.x + 20);
  expect(fastest).toBeGreaterThan(0);
}

test('one keypress on the title starts a frozen-track ride', async ({ page }) => {
  test.skip(
    TRACKS.length === 0,
    'smoke: public/tracks/index.json has no published tracks — ride test skipped',
  );
  const { consoleErrors, pageErrors, external } = listen(page);
  await mockThirdParties(page, external);

  // --- Title: attract mode boots behind the menu -----------------------------
  await page.goto('/');
  await expect(page.getByText(/press any key/i)).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/smoke-home.png' });

  // --- One keypress rides ------------------------------------------------------
  await page.keyboard.press('x');
  await expect(page).toHaveURL(/\/ride\/([A-Za-z0-9-]+)$/);
  const rideId = page.url().split('/ride/')[1];
  expect(IDS.has(rideId)).toBe(true);

  await rideBriefly(page);
  await page.screenshot({ path: 'test-results/smoke-ride.png' });

  assertClean(consoleErrors, pageErrors, external);
});

test('level select opens a track by tap and by keyboard', async ({ page }) => {
  test.skip(
    TRACKS.length === 0,
    'smoke: public/tracks/index.json has no published tracks — select test skipped',
  );
  const { consoleErrors, pageErrors, external } = listen(page);
  await mockThirdParties(page, external);

  await page.goto('/tracks');
  const first = TRACKS.find((t) => t.kind === 'live') ?? TRACKS[0];
  await expect(page.getByText(first.question).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/smoke-tracks.png' });

  // Keyboard: arrows move between rows.
  const row = page.getByRole('button', { name: first.question });
  await row.focus();
  await page.keyboard.press('ArrowDown');
  await expect(async () => {
    const focused = await page.evaluate(() => document.activeElement?.textContent?.slice(0, 40) ?? '');
    expect(focused).not.toBe(first.question.slice(0, 40));
  }).toPass();

  // Tap: the row's question button rides the YES side.
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/ride/${first.id}$`));

  await rideBriefly(page);

  assertClean(consoleErrors, pageErrors, external);
});

test('daily loads the same track for a fixed date', async ({ page }) => {
  test.skip(
    TRACKS.length === 0,
    'smoke: public/tracks/index.json has no published tracks — daily test skipped',
  );
  const { consoleErrors, pageErrors, external } = listen(page);
  await mockThirdParties(page, external);

  const readPick = async (): Promise<string | null> =>
    page.evaluate(() => {
      const section = document.querySelector('main section');
      return section?.querySelector('p')?.textContent?.trim() ?? null;
    });

  await page.goto('/daily?date=2026-10-15');
  await expect(page.getByText('2026-10-15').first()).toBeVisible();
  const firstPick = await readPick();
  await page.screenshot({ path: 'test-results/smoke-daily.png' });

  // Same date, reloaded: the same ride. Everyone gets this track today.
  await page.reload();
  await expect(page.getByText('2026-10-15').first()).toBeVisible();
  const secondPick = await readPick();
  expect(secondPick).toBe(firstPick);

  // And the pick is a real frozen track.
  expect(TRACKS.some((t) => t.question === firstPick)).toBe(true);

  assertClean(consoleErrors, pageErrors, external);
});

test('shows a clear error state when the track index is missing', async ({ page }) => {
  const { consoleErrors, pageErrors, external } = listen(page);
  await mockThirdParties(page, external);

  // The frozen index is gone: no tracks may be invented to fill the hole. A 503
  // (rather than an abort) keeps the browser from logging a resource error —
  // the app's own error state is what this test asserts.
  await page.route('**/tracks/index.json', (route) =>
    route.fulfill({ status: 503, body: 'Service Unavailable' }),
  );
  await page.goto('/');

  // The title says plainly that nothing is published, and offers a retry.
  await expect(page.getByText(/no tracks published yet/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  // ...and no phantom race is offered anywhere.
  await expect(page.getByRole('button', { name: /enter race/i })).toHaveCount(0);

  // The browser itself reports the failed request as a resource error; that
  // single expected message is the only console noise allowed.
  assertClean(consoleErrors, pageErrors, external, [/^Failed to load resource/]);
});

test('says plainly when no tracks have been published yet', async ({ page }) => {
  const { consoleErrors, pageErrors, external } = listen(page);
  await mockThirdParties(page, external);

  // An existing but empty manifest: nothing to ride, nothing invented.
  await page.route('**/tracks/index.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 1, generatedAt: '1970-01-01T00:00:00.000Z', tracks: [] }),
    }),
  );
  await page.goto('/');

  await expect(page.getByText(/no tracks published yet/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /enter race/i })).toHaveCount(0);

  assertClean(consoleErrors, pageErrors, external);
});

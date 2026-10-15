import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from 'playwright/test';

// ---------------------------------------------------------------------------
// Offline smoke test.
//
// This test never touches the network. The browser reads only our own frozen
// `/tracks/*.json` (committed to the repo), Google Fonts is stubbed, and any
// other external request — including any call to a Polymarket domain — is
// aborted and reported as a failure.
//
// Scope: the app shell boots from the frozen index, a ride starts on a real
// frozen track, the bike moves under its own power, the console stays clean,
// and a missing index shows a clear error state instead of fake data.
// Gameplay physics are not asserted here.
// ---------------------------------------------------------------------------

interface TrackSummary {
  id: string;
  kind: string;
  question: string;
}

function trackIndex(): TrackSummary[] {
  const path = fileURLToPath(new URL('../public/tracks/index.json', import.meta.url));
  const index = JSON.parse(readFileSync(path, 'utf8')) as { tracks: TrackSummary[] };
  if (index.tracks.length === 0) throw new Error('public/tracks/index.json has no tracks');
  return index.tracks;
}

const TRACKS = trackIndex();
// Whatever the ingest published first is what the home stage features.
const FEATURED = TRACKS[0];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

interface Telemetry {
  x: number;
  y: number;
  angle: number;
  speed: number;
  grounded: boolean;
  crashed: boolean;
  score: number;
  simMs: number;
}

type DebugHandle = Record<string, () => unknown>;

async function telemetry(page: Page): Promise<Telemetry> {
  return page.evaluate(() => {
    const handle = (window as unknown as { __oddsrider?: DebugHandle }).__oddsrider;
    if (!handle) throw new Error('window.__oddsrider is not installed');
    return {
      x: handle.x() as number,
      y: handle.y() as number,
      angle: handle.angle() as number,
      speed: handle.speed() as number,
      grounded: handle.grounded() as boolean,
      crashed: handle.crashed() as boolean,
      score: handle.score() as number,
      simMs: handle.simMs() as number,
    };
  });
}

// Everything third-party is stubbed or forbidden. `external` collects anything
// that is neither local nor stubbed, so a new outbound call — a Polymarket
// request, an analytics pixel, anything — fails the test loudly.
async function mockThirdParties(page: Page, external: string[]): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      return route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '/* stubbed: the smoke test runs offline */',
      });
    }
    if (LOCAL_HOSTS.has(url.hostname)) {
      return route.continue();
    }

    external.push(route.request().url());
    return route.abort();
  });
}

function listen(page: Page): { consoleErrors: string[]; pageErrors: string[]; external: string[] } {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const external: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors, external };
}

function assertClean(
  consoleErrors: string[],
  pageErrors: string[],
  external: string[],
  ignoredConsole: RegExp[] = [],
): void {
  const relevant = consoleErrors.filter((message) => !ignoredConsole.some((re) => re.test(message)));
  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(relevant, `console errors:\n${relevant.join('\n')}`).toEqual([]);
  expect(external, `the smoke test must not reach the network, but saw:\n${external.join('\n')}`).toEqual([]);
}

test('starts a ride from a frozen track with no console errors and no network', async ({ page }) => {
  const { consoleErrors, pageErrors, external } = listen(page);
  await mockThirdParties(page, external);

  // --- Home: the frozen index must render, not a bundled fallback ------------
  await page.goto('/');
  await expect(page.getByText(FEATURED.question).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/smoke-home.png' });

  // --- Start the ride ---------------------------------------------------------
  // The stage CTA drops straight into the game for the featured frozen track.
  await page.getByRole('button', { name: /enter race/i }).click();
  await expect(page).toHaveURL(new RegExp(`/ride/${FEATURED.id}$`));

  // --- The game boots and installs its debug handle ---------------------------
  // (the game canvas is first in the DOM: Phaser mounts before the HUD, whose
  // progress bar renders its own small canvas)
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForFunction(
    () => Boolean((window as unknown as { __oddsrider?: DebugHandle }).__oddsrider),
  );

  // Let the 3-2-1-RIDE gate finish: it ends by resetting the bike to the start,
  // so holding throttle through it would test nothing.
  await expect(page.getByText(/W GAS/)).toHaveCount(0);
  await page.waitForTimeout(1200);

  const before = await telemetry(page);
  expect(Number.isFinite(before.x)).toBe(true);
  expect(before.simMs).toBeGreaterThanOrEqual(0);

  // --- Ride: hold throttle and watch the bike make progress -------------------
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

  await page.screenshot({ path: 'test-results/smoke-ride.png' });

  expect(sawSimulation).toBeGreaterThan(before.simMs);
  expect(furthest).toBeGreaterThan(before.x + 20);
  expect(fastest).toBeGreaterThan(0);

  // --- Nothing may have errored, nothing may have left the box ----------------
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

  // The card says plainly that the feed is down, and offers a retry.
  await expect(page.getByText(/TRACK FEED UNAVAILABLE/)).toBeVisible();
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  // ...and no phantom race is offered anywhere.
  await expect(page.getByRole('button', { name: /enter race/i })).toHaveCount(0);

  // The browser itself reports the failed request as a resource error; that
  // single expected message is the only console noise allowed.
  assertClean(consoleErrors, pageErrors, external, [/^Failed to load resource/]);
});
